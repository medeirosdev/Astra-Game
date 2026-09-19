import * as THREE from "three";
import {
  ApplyForce,
  Bezier,
  BatchedRenderer,
  type Behavior,
  ColorOverLife,
  ConstantColor,
  ConstantValue,
  Gradient,
  IntervalValue,
  OrbitOverLife,
  ParticleSystem,
  PiecewiseBezier,
  PointEmitter,
  RenderMode,
  SizeOverLife,
  SphereEmitter,
  Vector3 as QVector3,
  Vector4 as QVector4,
} from "three.quarks";

// Uma "receita" por vfx.particle (ver src/abilities/abilities.ts) — mesma
// filosofia de dados das habilidades: ajustar o visual é mexer nesses
// números, não escrever um efeito novo em código.
interface BurstPreset {
  count: number;
  life: [number, number];
  speed: [number, number];
  size: [number, number];
  radius: number; // raio do emissor esférico (posição inicial das partículas)
  gravity: number; // força vertical constante — negativa cai, positiva sobe
  point?: boolean; // usa emissor pontual (sem raio) em vez de esférico
  orbitSpeed?: number; // quando definido, as partículas giram em volta da origem
}

// Vida mínima ficou >0.2s de propósito: o loop principal (Engine.ts) usa
// dt = min(clock.getDelta(), 0.1) — num engasgo de frame real (GC, troca de
// aba, carregar textura), uma vida menor que isso pode morrer antes do
// primeiro frame renderizar (visto na prática rodando headless/software).
// Tamanhos/contagens grandes de propósito — "poderes exagerados" foi pedido
// explicitamente, isso aqui não é sutil.
const PRESETS: Record<string, BurstPreset> = {
  spark: { count: 26, life: [0.24, 0.42], speed: [5, 10], size: [0.22, 0.4], radius: 0.15, gravity: -7 },
  shock: { count: 46, life: [0.3, 0.5], speed: [10, 18], size: [0.32, 0.6], radius: 0.1, gravity: -1 },
  trail: { count: 20, life: [0.28, 0.45], speed: [2.5, 5], size: [0.24, 0.42], radius: 0.15, gravity: -2 },
  nova: { count: 90, life: [0.5, 0.95], speed: [10, 22], size: [0.5, 1], radius: 0.2, gravity: -1.5 },
  frost: { count: 34, life: [0.55, 0.9], speed: [2.5, 5], size: [0.26, 0.46], radius: 0.25, gravity: -7 },
  glow: { count: 18, life: [0.65, 1], speed: [0.5, 1.2], size: [0.28, 0.46], radius: 0.4, gravity: 2.8, point: true },
  shield: { count: 32, life: [0.55, 0.8], speed: [0, 0.6], size: [0.22, 0.34], radius: 1.1, gravity: 0, orbitSpeed: 6 },
  warp: { count: 40, life: [0.34, 0.58], speed: [4, 7], size: [0.2, 0.5], radius: 0.9, gravity: 0, orbitSpeed: -16 },
  // Poeira/estilhaço de impacto físico (soco/golpe conectando) — usada com
  // uma cor neutra passada pelo chamador (ver Engine.triggerImpact), não a
  // cor do vfx da habilidade: golpe físico não é mágico, não deve colorir
  // igual um poder.
  punchImpact: { count: 14, life: [0.2, 0.32], speed: [3, 6], size: [0.1, 0.2], radius: 0.08, gravity: -9 },
  // Marca curta no rastro do punho/chute durante o swing — muito pequena e
  // quase parada, é só um "afterimage" pontilhado, não uma explosão.
  swipeTrail: { count: 3, life: [0.14, 0.2], speed: [0.2, 0.6], size: [0.07, 0.12], radius: 0.03, gravity: 0 },
  // Faíscas finas de metal — boca de disparo e impacto do corte que viaja
  // (ver Engine.castAbilityAt/updateProjectiles, vfx.particle "slash").
  slash: { count: 16, life: [0.16, 0.28], speed: [4, 9], size: [0.07, 0.15], radius: 0.06, gravity: -3 },
};
const DEFAULT_PRESET = PRESETS.spark;

// Curva de tamanho compartilhada: fica no tamanho cheio um pouco e encolhe
// rápido pro final (mais "impacto" que um encolhimento linear). O segundo
// item de cada par é o tempo (0 a 1) em que aquele trecho COMEÇA — com um
// só trecho, tem que começar em 0 pra cobrir a vida inteira da partícula.
const SHRINK_CURVE = new PiecewiseBezier([[new Bezier(1, 0.9, 0.4, 0), 0]]);

// Multiplica a cor acima de 1 igual ao emissiveIntensity dos projéteis
// (Engine.ts) — o bloom tem threshold alto de propósito (só a textura dos
// personagens some, o VFX das habilidades precisa continuar brilhando).
const BRIGHTNESS = 2.6;

let sharedMaterial: THREE.MeshBasicMaterial | null = null;

// Círculo com borda suave — sem isso cada partícula seria um quadrado sólido.
function createParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function getParticleMaterial(): THREE.MeshBasicMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.MeshBasicMaterial({
      map: createParticleTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
  return sharedMaterial;
}

export function createParticleRenderer(): BatchedRenderer {
  return new BatchedRenderer();
}

// Uma explosão só (sem loop) na origem do cast — autoDestroy cuida de tirar
// da cena sozinho quando a última partícula morrer, não precisa rastrear.
// "lightning" é estruturalmente diferente (um raio, não uma explosão radial)
// — cai pra spawnLightningBolt, que por sua vez soma um estouro "shock" no
// chão em vez de reimplementar a explosão de impacto.
export function spawnParticleBurst(
  scene: THREE.Scene,
  renderer: BatchedRenderer,
  kind: string | undefined,
  origin: THREE.Vector3,
  colorHex: string,
) {
  if (kind === "lightning") {
    spawnLightningBolt(scene, origin, colorHex);
    spawnBurstFromPreset(scene, renderer, PRESETS.shock, origin, colorHex);
    return;
  }
  spawnBurstFromPreset(scene, renderer, (kind ? PRESETS[kind] : undefined) ?? DEFAULT_PRESET, origin, colorHex);
}

function spawnBurstFromPreset(scene: THREE.Scene, renderer: BatchedRenderer, preset: BurstPreset, origin: THREE.Vector3, colorHex: string) {
  const color = new THREE.Color(colorHex);
  const startColor = new QVector4(color.r * BRIGHTNESS, color.g * BRIGHTNESS, color.b * BRIGHTNESS, 1);
  // Cor fica constante (multiplicada pelo startColor); só a transparência
  // é animada, de 1 até 0, pro brilho sumir suave em vez de piscar e sumir.
  const fadeOut = new Gradient(
    [
      [new QVector3(1, 1, 1), 0],
      [new QVector3(1, 1, 1), 1],
    ],
    [
      [1, 0],
      [0, 1],
    ],
  );

  const behaviors: Behavior[] = [
    new SizeOverLife(SHRINK_CURVE),
    new ColorOverLife(fadeOut),
    new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(preset.gravity)),
  ];
  if (preset.orbitSpeed !== undefined) {
    behaviors.push(new OrbitOverLife(new ConstantValue(preset.orbitSpeed)));
  }

  const system = new ParticleSystem({
    duration: preset.life[1],
    looping: false,
    autoDestroy: true,
    shape: preset.point ? new PointEmitter() : new SphereEmitter({ radius: preset.radius }),
    startLife: new IntervalValue(preset.life[0], preset.life[1]),
    startSpeed: new IntervalValue(preset.speed[0], preset.speed[1]),
    startSize: new IntervalValue(preset.size[0], preset.size[1]),
    startColor: new ConstantColor(startColor),
    emissionOverTime: new ConstantValue(0),
    emissionBursts: [{ time: 0, count: new ConstantValue(preset.count), cycle: 1, interval: 0, probability: 1 }],
    renderMode: RenderMode.BillBoard,
    material: getParticleMaterial(),
    behaviors,
  });

  system.emitter.position.copy(origin);
  renderer.addSystem(system);
  scene.add(system.emitter);
}

const LIGHTNING_HEIGHT = 9; // de onde o raio "cai" até o alvo
const LIGHTNING_SEGMENTS = 7;
const LIGHTNING_JITTER = 1.4;
const LIGHTNING_DURATION_MS = 220;

// Raio de verdade (não é three.quarks — uma explosão radial não faz cara de
// raio): um tubo fino e brilhante em zigue-zague caindo do céu até o alvo,
// mais um flash de luz forte. Curto de propósito, é um flash, não um beam.
function spawnLightningBolt(scene: THREE.Scene, target: THREE.Vector3, colorHex: string) {
  const start = target.clone().add(new THREE.Vector3(0, LIGHTNING_HEIGHT, 0));
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= LIGHTNING_SEGMENTS; i++) {
    const t = i / LIGHTNING_SEGMENTS;
    const p = start.clone().lerp(target, t);
    if (i > 0 && i < LIGHTNING_SEGMENTS) {
      p.x += (Math.random() - 0.5) * LIGHTNING_JITTER;
      p.z += (Math.random() - 0.5) * LIGHTNING_JITTER;
    }
    points.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 24, 0.07, 6, false);
  const material = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const light = new THREE.PointLight(colorHex, 10, 14);
  light.position.copy(target).add(new THREE.Vector3(0, 1.5, 0));
  scene.add(light);

  const startedAt = performance.now();
  const tick = () => {
    const t = (performance.now() - startedAt) / LIGHTNING_DURATION_MS;
    if (t >= 1) {
      scene.remove(mesh, light);
      geometry.dispose();
      material.dispose();
      return;
    }
    // Alterna cheio/apagado umas 3x antes de sumir — dá o "flicker" de raio
    // de verdade em vez de um fade suave (que pareceria mais mágica que raio).
    material.opacity = (Math.floor(t * 8) % 2 === 0 ? 1 : 0.3) * (1 - t * 0.6);
    light.intensity = 10 * (1 - t);
    requestAnimationFrame(tick);
  };
  tick();
}

const SHOCKWAVE_DURATION_MS = 420;

// Anel plano que expande no chão até o raio da área — dá peso visual às
// habilidades de área, casando o efeito com o alcance real do dano.
export function spawnShockwaveRing(scene: THREE.Scene, origin: THREE.Vector3, radius: number, colorHex: string) {
  const geometry = new THREE.RingGeometry(0.85, 1, 56);
  const material = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(origin);
  mesh.position.y = 0.05;
  mesh.scale.setScalar(0.05);
  scene.add(mesh);

  const startedAt = performance.now();
  const tick = () => {
    const t = (performance.now() - startedAt) / SHOCKWAVE_DURATION_MS;
    if (t >= 1) {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      return;
    }
    const eased = 1 - (1 - t) * (1 - t);
    mesh.scale.setScalar(0.05 + eased * radius);
    material.opacity = 0.85 * (1 - t);
    requestAnimationFrame(tick);
  };
  tick();
}
