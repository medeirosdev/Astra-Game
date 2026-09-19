import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Ability, AbilityEffect } from "../abilities/types";
import type { CharacterDef } from "../characters/types";
import { AbilityRuntime } from "./AbilityRuntime";
import { CharacterModel } from "./CharacterModel";
import { pickMapPreset, type MapPreset } from "./mapPresets";
import { createTerrainMaterial } from "./textures";
import { playSound } from "./sound";
import { createParticleRenderer, spawnParticleBurst, spawnShockwaveRing } from "./particles";
import type { BatchedRenderer } from "three.quarks";
import { MOB_TYPES } from "./mobs";
import type { MobSnapshot } from "../network/sync";

const GRID_SIZE = 240; // 10x o tamanho original (24), a pedido
const BLOCK_SIZE = 1;
const UP = new THREE.Vector3(0, 1, 0);
const CAMERA_DISTANCE = 7;
const CAMERA_HEIGHT = 1.6;
const MIN_PITCH = -0.2;
const MAX_PITCH = 1.3;
const MOUSE_SENSITIVITY = 0.0025;
const SPAWN_POINT = new THREE.Vector3(0, 0, 0);
const MOVING_THRESHOLD = 0.01;
const WALL_HEIGHT = 4;
const ARENA_BOUND = GRID_SIZE / 2 - 1;
const OBSTACLE_COUNT = 140;
const OBSTACLE_CLEAR_RADIUS = 8; // sem obstáculo em cima do spawn
const OBSTACLE_MELEE_REACH = 3; // mesmo alcance corpo-a-corpo usado contra jogadores (ver combat.ts)
// Mesma constante, exportada — reaproveitada em main.ts pra checar acerto em
// mob no modo Sobrevivência (ver findMobsInRange).
export const MELEE_REACH = OBSTACLE_MELEE_REACH;

const GRAVITY = 22; // unidades/s² — só afeta o pulo, não é física de verdade
const JUMP_SPEED = 8; // velocidade vertical inicial do pulo
const CROUCH_SPEED_FACTOR = 0.5;
const ROLL_DISTANCE = 5; // unidades percorridas durante o rolamento
const ROLL_DURATION_MS = 400;
// A animação "Roll" dura ~1.47s de propósito lento (pra ficar clara isolada);
// acelerada 3.7x ela cabe nos 400ms do dash real, sem precisar de outro clipe.
const ROLL_TIME_SCALE = 3.7;
const ROLL_COOLDOWN_MS = 700;

// Quanto tempo depois de um soco/reação o loop de movimento fica proibido
// de trocar de volta pra idle/walk por cima — sem isso a pose mal aparecia
// (updateMovement roda todo frame e cortava a animação quase na hora).
const ATTACK_ACTION_LOCK_MS = 260;
const HIT_REACTION_LOCK_MS = 300;
// Janela em que updateAttackTrail amostra a posição das mãos pra desenhar o
// rastro do soco/chute, e de quanto em quanto tempo.
const ATTACK_TRAIL_WINDOW_MS = 220;
const TRAIL_SAMPLE_INTERVAL_MS = 35;
// Velocidade de giro da lâmina em crescente (ver createSlashMesh/
// updateProjectiles) — rad/s. Vetor reaproveitado pra não alocar por frame.
const SLASH_SPIN_SPEED = 22;
const SLASH_SPIN_AXIS = new THREE.Vector3();

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  bornAt: number;
  damage: number | null;
  vfx: Ability["vfx"];
  // Só true pro projétil que EU disparei (não a réplica visual de um cast
  // de outro peer) — evita reportar o mesmo acerto em mob mais de uma vez
  // (ver Engine.onProjectileHitMob / main.ts).
  isLocal: boolean;
}

interface Obstacle {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  position: THREE.Vector3;
  radius: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
}

interface RemotePlayer {
  group: THREE.Group;
  placeholder: THREE.Mesh | null;
  model: CharacterModel | null;
  target: THREE.Vector3;
  yaw: number;
}

interface MobVisual {
  group: THREE.Group;
  target: THREE.Vector3;
}

export interface Transform {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

// "instant" é corpo a corpo (soco/golpe); o resto (projétil, área, self) usa
// a pose de conjurar magia (ver public/models/CREDITS.txt) — mesma lógica
// de antes, só trocou o nome do clipe pro pack novo.
function attackAnimationFor(ability: Ability): string {
  return ability.target.kind === "instant" ? "Punch_Cross" : "Spell_Simple_Shoot";
}

// Acha um efeito de um certo tipo dentro da lista (ver Ability.effect em
// abilities/types.ts) — a maioria dos poderes só tem um, mas alguns
// combinam vários (dano + lentidão, cura + invisibilidade...).
function findEffect<K extends AbilityEffect["kind"]>(
  effects: AbilityEffect[],
  kind: K,
): Extract<AbilityEffect, { kind: K }> | undefined {
  return effects.find((e) => e.kind === kind) as Extract<AbilityEffect, { kind: K }> | undefined;
}

// Bola de energia padrão — projétil mágico "normal" (ver createSlashMesh
// pro caso físico).
function createOrbMesh(color: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.25, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 });
  return new THREE.Mesh(geo, mat);
}

// Lâmina em crescente — visual do "corte" que viaja (ver characters.ts,
// personagens físicos cujo soco básico virou projétil). Gira em torno do
// próprio eixo de voo (ver updateProjectiles) pra ler como lâmina
// girando de qualquer ângulo de câmera, não só de um lado específico.
function createSlashMesh(color: string): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.28, 0.5, 20, 1, 0, Math.PI * 1.15);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

export class Engine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly player: THREE.Group;
  private readonly playerModel: CharacterModel;
  private readonly clock = new THREE.Clock();
  private readonly keys = new Set<string>();
  private readonly projectiles: Projectile[] = [];
  private readonly obstacles: Obstacle[] = [];
  private readonly mobs = new Map<string, MobVisual>();
  private readonly remotePlayers = new Map<string, RemotePlayer>();
  private readonly sun: THREE.DirectionalLight;
  private readonly particleRenderer: BatchedRenderer;
  private readonly moveSpeed: number;
  private readonly comboAnims: string[];
  private yaw = 0;
  private pitch = 0.5;
  private frozen = false;
  private comboIndex = 0;
  private shakeStartedAt = 0;
  private shakeDurationMs = 0;
  private shakeStrength = 0;
  private grounded = true;
  private verticalVelocity = 0;
  private crouching = false;
  private rollUntil = 0;
  private lastRollAt = -Infinity;
  private readonly rollDirection = new THREE.Vector3();
  // Enquanto now < isso, updateMovement não pisa em cima da animação atual
  // com idle/walk/sprint — sem isso, um soco tocado via playOnce era cortado
  // quase na hora pelo próprio loop de movimento no frame seguinte.
  private actionLockUntil = 0;
  private hitStopUntil = 0;
  private attackTrailUntil = 0;
  private lastTrailSampleAt = 0;
  readonly runtime: AbilityRuntime;
  // Disparado quando um projétil MEU (isLocal, ver Projectile) atinge um
  // mob — main.ts usa isso pra reportar dano no modo Sobrevivência, mesma
  // ideia de findMobsInRange pra instant/área (ver reportMobHits em main.ts).
  onProjectileHitMob: ((mobId: string, damage: number) => void) | null = null;

  private readonly onHudUpdate: (runtime: AbilityRuntime) => void;
  private readonly map: MapPreset;

  constructor(container: HTMLElement, character: CharacterDef, roomCode: string, onHudUpdate: (runtime: AbilityRuntime) => void) {
    this.onHudUpdate = onHudUpdate;
    this.runtime = new AbilityRuntime(character);
    this.moveSpeed = character.stats.moveSpeed;
    this.comboAnims = character.comboAnims;
    this.map = pickMapPreset(roomCode);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(this.map.backgroundColor);
    this.scene.fog = new THREE.Fog(this.map.backgroundColor, 40, 220);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 8, 12);

    this.sun = this.setupLights();
    this.buildMap();

    this.particleRenderer = createParticleRenderer();
    this.scene.add(this.particleRenderer);

    this.player = new THREE.Group();
    this.player.position.copy(SPAWN_POINT);
    this.scene.add(this.player);
    this.playerModel = new CharacterModel(character.modelUrl, character.color, character.skinTextureUrl, character.outfitUrl);
    this.player.add(this.playerModel.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Threshold alto de propósito: só o VFX das habilidades (emissive forte) deve
    // brilhar — os modelos dos personagens usam material unlit (KHR_materials_unlit,
    // ver public/models/CREDITS.txt) com texturas claras, que com threshold baixo
    // eram capturadas pelo bloom e ficavam com aparência estourada/lavada.
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.4, 0.75);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));

    this.setupMouseLook(container);
  }

  private setupMouseLook(container: HTMLElement) {
    const hint = document.createElement("div");
    hint.className = "mouse-hint";
    hint.textContent = "Clique na tela para travar o mouse e olhar em volta";
    container.appendChild(hint);

    this.renderer.domElement.addEventListener("click", () => {
      this.renderer.domElement.requestPointerLock();
    });
    // Botão direito é bloqueio (ver main.ts) — sem isso o navegador abriria
    // o menu de contexto a cada tentativa de segurar a defesa.
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("pointerlockchange", () => {
      hint.style.display = document.pointerLockElement === this.renderer.domElement ? "none" : "block";
    });

    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch + e.movementY * MOUSE_SENSITIVITY));
    });
  }

  // O mapa ficou grande demais (240x240) pra um frustum de sombra fixo cobrir
  // tudo sem perder resolução — em vez disso, o sol acompanha o jogador (ver
  // updateSun), mantendo sombra nítida sempre perto de quem importa em vez
  // de tentar cobrir o mapa inteiro de uma vez.
  private setupLights(): THREE.DirectionalLight {
    const ambient = new THREE.AmbientLight(0x8090a5, 1.9);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff2d9, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.far = 80;
    this.scene.add(sun);
    this.scene.add(sun.target);
    return sun;
  }

  private updateSun() {
    this.sun.position.set(this.player.position.x + 10, this.player.position.y + 20, this.player.position.z + 10);
    this.sun.target.position.copy(this.player.position);
  }

  private buildMap() {
    this.buildGround();
    this.buildWalls();
    this.buildObstacles();
  }

  // Um plano só, com textura PBR real (ver textures.ts) repetida — bem mais
  // bonito e mais barato de renderizar que os 6400+ cubos do checkerboard
  // antigo, que só tinha cor sólida por instância.
  private buildGround() {
    // Bem maior que GRID_SIZE (a área jogável de verdade, com paredes) e que
    // o alcance da neblina (ver `this.scene.fog` no construtor) — clareando
    // o mapa (ver mapPresets.ts) a borda onde o plano do chão acabava virou
    // uma linha de horizonte reta e feia contra o fundo; um chão bem maior
    // some dentro da neblina antes de chegar na própria borda.
    const groundSize = GRID_SIZE * 3;
    const geo = new THREE.PlaneGeometry(groundSize, groundSize);
    const mat = createTerrainMaterial(this.map.groundTexture, { repeat: groundSize / 6, roughness: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // Muro no perímetro pra sala não ser um platô infinito — sem colisão contra
  // ele mesmo, mas o movimento do jogador já é clamped em ARENA_BOUND (ver
  // updateMovement/clampToArena), então na prática ninguém atravessa.
  private buildWalls() {
    const geo = new THREE.BoxGeometry(BLOCK_SIZE, WALL_HEIGHT, BLOCK_SIZE);
    const mat = createTerrainMaterial("rock", { color: this.map.wallColor, roughness: 0.95 });
    const half = GRID_SIZE / 2;
    const mesh = new THREE.InstancedMesh(geo, mat, GRID_SIZE * 4);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const place = (x: number, z: number, i: number) => {
      dummy.position.set(x * BLOCK_SIZE, WALL_HEIGHT / 2 - 0.5, z * BLOCK_SIZE);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };

    let i = 0;
    for (let x = -half; x < half; x++) {
      place(x, -half, i++);
      place(x, half - 1, i++);
    }
    for (let z = -half + 1; z < half - 1; z++) {
      place(-half, z, i++);
      place(half - 1, z, i++);
    }
    mesh.count = i;
    this.scene.add(mesh);
  }

  // Caixas espalhadas como cobertura básica — só visual por enquanto, sem
  // colisão (ver ROADMAP.md).
  // Caixas espalhadas pelo mapa como cobertura — cada uma com vida própria,
  // destrutível por golpes e poderes (ver resolveObstacleHits/damageObstacle).
  private buildObstacles() {
    const bound = ARENA_BOUND - 3;
    let placed = 0;
    let attempts = 0;
    while (placed < OBSTACLE_COUNT && attempts < OBSTACLE_COUNT * 20) {
      attempts++;
      const x = (Math.random() * 2 - 1) * bound;
      const z = (Math.random() * 2 - 1) * bound;
      if (Math.hypot(x, z) < OBSTACLE_CLEAR_RADIUS) continue;

      const height = 1 + Math.random() * 3;
      const size = 1.4 + Math.random() * 1.2;
      const geo = new THREE.BoxGeometry(size, height, size);
      const material = createTerrainMaterial("rock", { color: this.map.obstacleColor, roughness: 0.9 });
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, height / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const maxHealth = 30 + height * 20;
      this.obstacles.push({
        mesh,
        material,
        baseColor: material.color.clone(),
        position: mesh.position.clone(),
        radius: size * 0.75,
        health: maxHealth,
        maxHealth,
        destroyed: false,
      });
      placed++;
    }
  }

  private clampToArena(position: THREE.Vector3) {
    position.x = THREE.MathUtils.clamp(position.x, -ARENA_BOUND, ARENA_BOUND);
    position.z = THREE.MathUtils.clamp(position.z, -ARENA_BOUND, ARENA_BOUND);
  }

  private damageObstacle(obstacle: Obstacle, amount: number) {
    if (obstacle.destroyed) return;
    obstacle.health = Math.max(0, obstacle.health - amount);
    if (obstacle.health === 0) {
      obstacle.destroyed = true;
      this.scene.remove(obstacle.mesh);
      obstacle.mesh.geometry.dispose();
      obstacle.material.dispose();
      playSound("obstacleBreak");
      spawnParticleBurst(this.scene, this.particleRenderer, "nova", obstacle.position, `#${obstacle.baseColor.getHexString()}`);
      this.triggerShakeAt(obstacle.position, 0.35, 20, 220);
      return;
    }
    const t = obstacle.health / obstacle.maxHealth;
    obstacle.material.color.copy(obstacle.baseColor).multiplyScalar(0.25 + 0.75 * t);
  }

  // Instant/área resolvem contra obstáculos na hora do cast (mesma lógica de
  // combat.ts pra jogadores, só que aqui roda local — obstáculo é estado
  // compartilhado e estático, então todo peer processa o mesmo cast (local ou
  // recebido) e chega no mesmo resultado sem precisar de mensagem extra).
  private resolveObstacleHits(ability: Ability, origin: THREE.Vector3) {
    const damage = findEffect(ability.effect, "damage");
    if (!damage) return;
    const reach = ability.target.kind === "instant" ? OBSTACLE_MELEE_REACH : ability.target.kind === "area" ? ability.target.radius : null;
    if (reach === null) return;
    for (const obstacle of this.obstacles) {
      if (!obstacle.destroyed && obstacle.position.distanceTo(origin) <= reach + obstacle.radius) {
        this.damageObstacle(obstacle, damage.amount);
        // Cada peer roda esse cálculo do mesmo jeito (ver about.md — estado
        // compartilhado, sem precisar de mensagem extra), então isso já dá
        // o impacto físico certo tanto pro soco local quanto pra réplica do
        // soco de um peer remoto acertando um obstáculo perto de mim.
        if (ability.tier === "basic") this.triggerImpact(obstacle.position);
      }
    }
  }

  // Corpo simples de mob (nenhum asset baixado de propósito — o pack de
  // personagem já foi trabalho suficiente, ver public/models/CREDITS.txt):
  // um sólido baixo-poli colorido por tipo (ver mobs.ts) com "olhos"
  // emissivos, o bloom já cuida do resto.
  private createMobMesh(typeId: string): THREE.Group {
    const type = MOB_TYPES[typeId];
    const group = new THREE.Group();
    const bodyGeo = new THREE.IcosahedronGeometry(0.6 * type.scale, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.7, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6 * type.scale;
    body.castShadow = true;
    group.add(body);

    const eyeGeo = new THREE.SphereGeometry(0.09 * type.scale, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#ff2a2a", emissive: "#ff2a2a", emissiveIntensity: 3 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.22 * type.scale, 0.72 * type.scale, 0.48 * type.scale);
      group.add(eye);
    }
    return group;
  }

  // Cria/atualiza/remove os mobs em cena a partir do snapshot mais recente
  // (do host de verdade, ou repassado por rede — ver survival.ts/sync.ts).
  // Chamado todo frame pelo host (direto do seu próprio SurvivalState) e a
  // cada broadcast recebido pelos outros peers.
  updateMobs(snapshots: MobSnapshot[]) {
    const seen = new Set<string>();
    for (const snap of snapshots) {
      seen.add(snap.id);
      let visual = this.mobs.get(snap.id);
      if (!visual) {
        const group = this.createMobMesh(snap.typeId);
        group.position.set(snap.x, snap.y, snap.z);
        this.scene.add(group);
        visual = { group, target: new THREE.Vector3(snap.x, snap.y, snap.z) };
        this.mobs.set(snap.id, visual);
      }
      visual.target.set(snap.x, snap.y, snap.z);
      visual.group.visible = snap.alive;
    }
    for (const [id, visual] of this.mobs) {
      if (seen.has(id)) continue;
      this.scene.remove(visual.group);
      this.mobs.delete(id);
    }
  }

  private updateMobVisuals(dt: number) {
    for (const visual of this.mobs.values()) {
      if (!visual.group.visible) continue;
      visual.group.position.lerp(visual.target, Math.min(1, dt * 8));
      visual.group.lookAt(this.player.position.x, visual.group.position.y, this.player.position.z);
    }
  }

  // IDs dos mobs vivos dentro do alcance — usado no modo Sobrevivência pra
  // saber se um soco/golpe em área acertou algum (ver main.ts). Só cobre
  // instant/área de propósito; projétil não checa mob nessa primeira leva.
  findMobsInRange(origin: { x: number; y: number; z: number }, reach: number): string[] {
    const originVec = new THREE.Vector3(origin.x, origin.y, origin.z);
    const hits: string[] = [];
    for (const [id, visual] of this.mobs) {
      if (visual.group.visible && visual.group.position.distanceTo(originVec) <= reach) hits.push(id);
    }
    return hits;
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  private forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this.yaw);
  }

  setFrozen(frozen: boolean) {
    this.frozen = frozen;
  }

  private updateDeathState(now: number) {
    this.player.visible = !this.runtime.isDead(now);
    if (this.runtime.respawnIfReady(now)) {
      this.player.position.copy(SPAWN_POINT);
      // Reseta estado de movimento — morrer no meio de um pulo/rolamento não
      // pode deixar o respawn com física estranha (grudado no ar, etc).
      this.grounded = true;
      this.verticalVelocity = 0;
      this.crouching = false;
      this.rollUntil = 0;
    }
  }

  private updateMovement(dt: number) {
    const now = performance.now();
    this.updateDeathState(now);
    this.playerModel.update(dt);
    this.setLocalInvisible(this.runtime.isInvisible(now));

    if (this.frozen || this.runtime.isDead(now)) {
      this.updateCamera();
      return;
    }

    this.player.rotation.y = this.yaw;

    // Rolamento tem prioridade sobre tudo — ignora WASD normal enquanto dura.
    if (now < this.rollUntil) {
      const step = (ROLL_DISTANCE / (ROLL_DURATION_MS / 1000)) * dt;
      this.player.position.addScaledVector(this.rollDirection, step);
      this.clampToArena(this.player.position);
      this.updateCamera();
      return;
    }

    this.updateVerticalMotion(dt);
    // Agachar é só segurar "c" — sem estado separado pra manter, igual o
    // WASD (this.keys já é atualizado pelo listener de teclado do Engine).
    this.crouching = this.grounded && this.keys.has("c");

    let moved = false;
    if (!this.runtime.isStunned(now)) {
      const forward = this.forward();
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, this.yaw);
      const move = new THREE.Vector3();
      if (this.keys.has("w")) move.add(forward);
      if (this.keys.has("s")) move.sub(forward);
      if (this.keys.has("a")) move.sub(right);
      if (this.keys.has("d")) move.add(right);
      if (move.lengthSq() > 0) {
        const speedFactor = this.runtime.getSpeedFactor(now);
        // Segurando o bloqueio anda bem mais devagar — trade-off tático
        // (não dá pra correr pra trás bloqueando sem perder terreno).
        const blockFactor = this.runtime.isBlocking() ? 0.4 : 1;
        const crouchFactor = this.crouching ? CROUCH_SPEED_FACTOR : 1;
        const speed = this.moveSpeed * speedFactor * blockFactor * crouchFactor;
        move.normalize().multiplyScalar(speed * dt);
        this.player.position.add(move);
        this.clampToArena(this.player.position);
        // No ar deixa o Jump_Loop tocando — WASD ainda desloca, só não pisa
        // por cima da pose de pulo com a de andar. actionLockUntil segura o
        // mesmo tipo de pisada em cima de um soco/reação em andamento.
        if (this.grounded && now >= this.actionLockUntil) {
          this.playerModel.play(this.crouching ? "Crouch_Fwd_Loop" : speedFactor > 1 ? "Sprint_Loop" : "Walk_Loop");
        }
        moved = true;
      }
    }
    if (!moved && this.grounded && now >= this.actionLockUntil) {
      this.playerModel.play(this.crouching ? "Crouch_Idle_Loop" : this.runtime.isBlocking() ? "Sword_Idle" : "Idle_Loop");
    }

    this.updateCamera();
  }

  private updateVerticalMotion(dt: number) {
    if (this.grounded) return;
    this.verticalVelocity -= GRAVITY * dt;
    const nextY = this.player.position.y + this.verticalVelocity * dt;
    if (nextY <= 0) {
      this.player.position.y = 0;
      this.grounded = true;
      this.verticalVelocity = 0;
      this.playerModel.playOnce("Jump_Land", "Idle_Loop");
    } else {
      this.player.position.y = nextY;
    }
  }

  // Só pula do chão, com defesa erguida ou agachado — evita pulo-duplo e
  // fica mais claro qual estado "cancela" qual.
  tryJump(): boolean {
    if (!this.grounded || this.crouching) return false;
    this.grounded = false;
    this.verticalVelocity = JUMP_SPEED;
    this.playerModel.playOnce("Jump_Start", "Jump_Loop");
    return true;
  }

  // Dash rápido pra frente com invencibilidade breve (ver AbilityRuntime) —
  // só do chão, com cooldown próprio pra não virar spam de i-frame.
  tryRoll(): boolean {
    const now = performance.now();
    if (!this.grounded || now - this.lastRollAt < ROLL_COOLDOWN_MS) return false;
    this.lastRollAt = now;
    this.rollUntil = now + ROLL_DURATION_MS;
    this.rollDirection.copy(this.forward());
    this.crouching = false;
    this.runtime.setInvulnerable(ROLL_DURATION_MS, now);
    this.playerModel.playOnce("Roll", "Idle_Loop", ROLL_TIME_SCALE);
    return true;
  }

  // Sacode a câmera por um instante — usado em impactos grandes (área,
  // destruição de obstáculo) pra dar peso, além das partículas/luz.
  triggerShake(strength: number, durationMs: number) {
    this.shakeStartedAt = performance.now();
    this.shakeDurationMs = durationMs;
    this.shakeStrength = strength;
  }

  // Mesma coisa, mas enfraquece com a distância até o jogador local — uma
  // área/obstáculo destruído do outro lado do mapa (240x240) não devia
  // sacudir a câmera de quem nem viu.
  private triggerShakeAt(worldPos: THREE.Vector3, baseStrength: number, falloffRadius: number, durationMs: number) {
    const dist = worldPos.distanceTo(this.player.position);
    const falloff = Math.max(0, 1 - dist / falloffRadius);
    if (falloff > 0) this.triggerShake(baseStrength * falloff, durationMs);
  }

  // Congela o jogo quase por completo por um instante — clássico "hit-stop"
  // de jogo de luta, dá peso ao golpe conectar. Não é zero cravado (evita
  // dt=0 estranho em qualquer coisa que divida por ele); é só bem lento.
  private triggerHitStop(durationMs: number) {
    this.hitStopUntil = performance.now() + durationMs;
  }

  // Poeira física + faísca + flash de luz breve + tremor de câmera + hit-stop
  // no ponto exato do acerto — só quando um golpe conecta de verdade (não em
  // todo swing). Cor neutra fixa de propósito: soco não é mágico, não usa a
  // cor da habilidade.
  triggerImpact(at: { x: number; y: number; z: number }) {
    const worldPos = new THREE.Vector3(at.x, at.y, at.z);
    spawnParticleBurst(this.scene, this.particleRenderer, "punchImpact", worldPos, "#d8cdb8");
    spawnParticleBurst(this.scene, this.particleRenderer, "spark", worldPos, "#fff6e0");
    const light = new THREE.PointLight(0xfff2d0, 7, 5);
    light.position.copy(worldPos);
    this.scene.add(light);
    setTimeout(() => this.scene.remove(light), 90);
    this.triggerShakeAt(worldPos, 0.22, 6, 130);
    this.triggerHitStop(65);
  }

  // Empurra o jogador local pra longe de quem bateu — resolvido no lado de
  // quem apanhou, igual dano (ver combat.ts/AbilityRuntime, "quem recebe decide").
  applyKnockback(fromOrigin: { x: number; y: number; z: number }, distance: number) {
    const dir = new THREE.Vector3(this.player.position.x - fromOrigin.x, 0, this.player.position.z - fromOrigin.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    this.player.position.addScaledVector(dir, distance);
    this.clampToArena(this.player.position);
  }

  // O oposto do knockback — puxa o jogador local em direção a quem castou
  // (ver "Ruptura do Espaço" em characters.ts). Não deixa passar por cima
  // de quem puxou nem sair do mapa.
  applyPull(fromOrigin: { x: number; y: number; z: number }, distance: number) {
    const dir = new THREE.Vector3(fromOrigin.x - this.player.position.x, 0, fromOrigin.z - this.player.position.z);
    const gap = dir.length();
    if (gap < 0.001) return;
    dir.normalize();
    this.player.position.addScaledVector(dir, Math.min(distance, Math.max(0, gap - 0.5)));
    this.clampToArena(this.player.position);
  }

  // Invisibilidade (ver "Passo Fantasma") — eu ainda me vejo, semi
  // transparente como pista visual; quem tá invisível pros OUTROS peers é
  // decidido em updateRemotePlayers, a partir do PositionPayload.invisible.
  setLocalInvisible(active: boolean) {
    this.playerModel.setOpacity(active ? 0.35 : 1);
  }

  // Tropeço breve de quem apanhou — chamado tanto pro jogador local quanto
  // (via playRemoteAnimation-like path) pra peers remotos.
  playLocalHitReaction() {
    this.playerModel.playOnce("Hit_Chest", "Idle_Loop");
    this.actionLockUntil = Math.max(this.actionLockUntil, performance.now() + HIT_REACTION_LOCK_MS);
  }

  playRemoteHitReaction(peerId: string) {
    this.remotePlayers.get(peerId)?.model?.playOnce("Hit_Chest", "Idle_Loop");
  }

  private updateCamera() {
    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * CAMERA_DISTANCE;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * CAMERA_DISTANCE;
    const offsetY = CAMERA_HEIGHT + Math.sin(this.pitch) * CAMERA_DISTANCE;
    const desired = new THREE.Vector3(
      this.player.position.x + offsetX,
      this.player.position.y + offsetY,
      this.player.position.z + offsetZ,
    );

    const shakeT = this.shakeDurationMs > 0 ? (performance.now() - this.shakeStartedAt) / this.shakeDurationMs : 1;
    if (shakeT < 1) {
      const amp = this.shakeStrength * (1 - shakeT);
      desired.x += (Math.random() - 0.5) * amp;
      desired.y += (Math.random() - 0.5) * amp;
      desired.z += (Math.random() - 0.5) * amp;
    }

    this.camera.position.lerp(desired, 0.2);
    this.camera.lookAt(this.player.position.x, this.player.position.y + 1, this.player.position.z);
  }

  isPointerLocked(): boolean {
    return document.pointerLockElement === this.renderer.domElement;
  }

  getLocalTransform(): Transform {
    return { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z, yaw: this.yaw };
  }

  teleportForward(distance: number) {
    this.player.position.addScaledVector(this.forward(), distance);
    this.clampToArena(this.player.position);
  }

  spawnRemotePlayer(peerId: string, color: string) {
    if (this.remotePlayers.has(peerId)) return;
    const group = new THREE.Group();
    group.position.copy(SPAWN_POINT);
    this.scene.add(group);

    // Cápsula genérica até o "hello" chegar dizendo qual personagem/modelo usar.
    const geo = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const placeholder = new THREE.Mesh(geo, mat);
    placeholder.position.y = 1;
    placeholder.castShadow = true;
    group.add(placeholder);

    this.remotePlayers.set(peerId, { group, placeholder, model: null, target: group.position.clone(), yaw: 0 });
  }

  setRemotePlayerCharacter(peerId: string, modelUrl: string, tintColor: string, skinTextureUrl?: string, outfitUrl?: string) {
    const remote = this.remotePlayers.get(peerId);
    if (!remote || remote.model) return;
    if (remote.placeholder) {
      remote.group.remove(remote.placeholder);
      remote.placeholder.geometry.dispose();
      (remote.placeholder.material as THREE.Material).dispose();
      remote.placeholder = null;
    }
    remote.model = new CharacterModel(modelUrl, tintColor, skinTextureUrl, outfitUrl);
    remote.group.add(remote.model.group);
  }

  updateRemotePlayer(peerId: string, transform: Transform & { alive: boolean; invisible: boolean }) {
    const remote = this.remotePlayers.get(peerId);
    if (!remote) return;
    remote.target.set(transform.x, transform.y, transform.z);
    remote.yaw = transform.yaw;
    remote.group.visible = transform.alive && !transform.invisible;
  }

  // `anim` sobrescreve a animação padrão — usado pelo soco básico, cujo
  // clipe alterna em combo (ver COMBO_ANIMS) e por isso vem no payload de
  // rede em vez de ser derivado só do ability.id.
  playRemoteAnimation(peerId: string, ability: Ability, anim?: string) {
    this.remotePlayers.get(peerId)?.model?.playOnce(anim ?? attackAnimationFor(ability), "Idle_Loop");
  }

  removeRemotePlayer(peerId: string) {
    const remote = this.remotePlayers.get(peerId);
    if (!remote) return;
    this.scene.remove(remote.group);
    if (remote.placeholder) {
      remote.placeholder.geometry.dispose();
      (remote.placeholder.material as THREE.Material).dispose();
    }
    remote.model?.dispose();
    this.remotePlayers.delete(peerId);
  }

  private updateRemotePlayers(dt: number) {
    for (const remote of this.remotePlayers.values()) {
      const before = remote.group.position.clone();
      remote.group.position.lerp(remote.target, 0.25);
      remote.group.rotation.y = remote.yaw;
      remote.model?.update(dt);
      const moved = remote.group.position.distanceTo(before) > MOVING_THRESHOLD;
      remote.model?.play(moved ? "Walk_Loop" : "Idle_Loop");
    }
  }

  // Retorna a animação usada — quem chama (main.ts) manda ela junto no cast
  // de rede pros peers reproduzirem o mesmo clipe (importante pro combo do
  // soco básico, que não dá pra derivar só do ability.id).
  castAbility(ability: Ability): string {
    // Lunge ANTES de resolver o cast — pra poderes tipo "Pulo Mortal" (pula
    // pra frente e bate no chão), a área tem que acertar onde eu aterrissei,
    // não de onde eu saltei.
    if (ability.lunge) {
      this.player.position.addScaledVector(this.forward(), ability.lunge);
      this.clampToArena(this.player.position);
    }
    this.castAbilityAt(ability, this.player.position, this.yaw, true);
    const anim = ability.tier === "basic" ? this.comboAnims[this.comboIndex++ % this.comboAnims.length] : (ability.castAnim ?? attackAnimationFor(ability));
    this.playerModel.playOnce(anim, "Idle_Loop");
    // Segura o loop de movimento de trocar a pose de volta antes da hora
    // (ele roda todo frame) e, pro soco básico, abre a janela do rastro.
    const now = performance.now();
    this.actionLockUntil = Math.max(this.actionLockUntil, now + ATTACK_ACTION_LOCK_MS);
    if (ability.tier === "basic") this.attackTrailUntil = now + ATTACK_TRAIL_WINDOW_MS;
    return anim;
  }

  castAbilityAt(ability: Ability, origin: { x: number; y: number; z: number }, yaw = 0, isLocal = false) {
    const originVec = new THREE.Vector3(origin.x, origin.y, origin.z);
    playSound(ability.vfx.sound);
    if (ability.target.kind === "projectile") {
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, yaw);
      // "Corte" (ataque físico à distância, ver characters.ts) usa uma
      // lâmina em crescente que gira em voo em vez da esfera brilhante
      // padrão — física não é mágica, não devia parecer uma bola de energia.
      const mesh = ability.vfx.particle === "slash" ? createSlashMesh(ability.vfx.color) : createOrbMesh(ability.vfx.color);
      mesh.position.copy(originVec).add(new THREE.Vector3(0, 0.5, 0)).addScaledVector(forward, 1);
      const velocity = forward.clone().multiplyScalar(ability.target.speed);
      this.scene.add(mesh);
      const damage = findEffect(ability.effect, "damage")?.amount ?? null;
      this.projectiles.push({ mesh, velocity, bornAt: performance.now(), damage, vfx: ability.vfx, isLocal });
      // "boca" do disparo — o rastro em voo já é o mesh brilhante acima.
      spawnParticleBurst(this.scene, this.particleRenderer, ability.vfx.particle, mesh.position, ability.vfx.color);
    }
    // area / instant / self: flash de luz + partículas — só pra poderes de
    // verdade. Soco básico ("basic") é ataque físico, não mágico, e não
    // ganha VFX nenhum aqui (só a animação de soco/golpe já cuida disso).
    if (ability.target.kind !== "projectile") {
      if (ability.tier !== "basic") {
        const light = new THREE.PointLight(ability.vfx.color, 4, 6);
        light.position.copy(originVec).add(new THREE.Vector3(0, 1, 0));
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 200);
        spawnParticleBurst(this.scene, this.particleRenderer, ability.vfx.particle, light.position, ability.vfx.color);
      }
      this.resolveObstacleHits(ability, originVec);
    }
    // Área: anel de onda de choque cobrindo o raio real do dano + tremor de
    // câmera — poder de área devia SENTIR grande, não só ter luz piscando.
    if (ability.target.kind === "area") {
      spawnShockwaveRing(this.scene, originVec, ability.target.radius, ability.vfx.color);
      this.triggerShakeAt(originVec, Math.min(0.6, ability.target.radius * 0.05), ability.target.radius * 4, 260);
    }
  }

  private removeProjectile(index: number) {
    const [p] = this.projectiles.splice(index, 1);
    this.scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    (p.mesh.material as THREE.Material).dispose();
  }

  private updateProjectiles(dt: number) {
    const now = performance.now();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.addScaledVector(p.velocity, dt);
      // Lâmina de corte gira em torno do próprio eixo de voo (ver
      // createSlashMesh) — checar o tipo de geometria em vez de guardar
      // uma flag extra no Projectile, só a esfera padrão não é RingGeometry.
      if (p.mesh.geometry.type === "RingGeometry") {
        p.mesh.rotateOnWorldAxis(SLASH_SPIN_AXIS.copy(p.velocity).normalize(), dt * SLASH_SPIN_SPEED);
      }

      if (p.damage !== null) {
        const hit = this.obstacles.find(
          (o) => !o.destroyed && o.position.distanceTo(p.mesh.position) <= o.radius + 0.25,
        );
        if (hit) {
          this.damageObstacle(hit, p.damage);
          spawnParticleBurst(this.scene, this.particleRenderer, p.vfx.particle, p.mesh.position, p.vfx.color);
          this.removeProjectile(i);
          continue;
        }

        // Só o projétil que EU disparei reporta acerto em mob — a réplica
        // visual de um cast recebido de outro peer não teria como decidir
        // "o host aplica dano" sem duplicar (ver onProjectileHitMob).
        if (p.isLocal && this.onProjectileHitMob) {
          let mobHit: string | null = null;
          for (const [id, visual] of this.mobs) {
            if (visual.group.visible && visual.group.position.distanceTo(p.mesh.position) <= 0.9) {
              mobHit = id;
              break;
            }
          }
          if (mobHit) {
            this.onProjectileHitMob(mobHit, p.damage);
            spawnParticleBurst(this.scene, this.particleRenderer, p.vfx.particle, p.mesh.position, p.vfx.color);
            this.removeProjectile(i);
            continue;
          }
        }
      }

      if (now - p.bornAt > 3000) {
        this.removeProjectile(i);
      }
    }
  }

  // Enquanto a janela do rastro (ver castAbility) tá aberta, marca a
  // posição das mãos de tempos em tempos — cada marca é uma partícula
  // pequena e quase parada, juntas formam o "afterimage" do golpe.
  private updateAttackTrail() {
    const now = performance.now();
    if (now >= this.attackTrailUntil) return;
    if (now - this.lastTrailSampleAt < TRAIL_SAMPLE_INTERVAL_MS) return;
    this.lastTrailSampleAt = now;
    for (const pos of this.playerModel.getHandWorldPositions()) {
      spawnParticleBurst(this.scene, this.particleRenderer, "swipeTrail", pos, "#fff3e0");
    }
  }

  start() {
    const loop = () => {
      let dt = Math.min(this.clock.getDelta(), 0.1);
      // Hit-stop: quase congela por um instante no momento do impacto (ver
      // triggerImpact) — não zera de vez pra não ter dt=0 estranho em
      // qualquer lugar que divida por ele.
      if (performance.now() < this.hitStopUntil) dt *= 0.06;
      this.runtime.update(dt);
      this.updateMovement(dt);
      this.updateSun();
      this.updateProjectiles(dt);
      this.updateRemotePlayers(dt);
      this.updateMobVisuals(dt);
      this.updateAttackTrail();
      this.particleRenderer.update(dt);
      this.onHudUpdate(this.runtime);
      this.composer.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
