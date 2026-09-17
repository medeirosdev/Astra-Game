import type { Ability } from "../abilities/types";

type Vec3 = { x: number; y: number; z: number };

const MELEE_RANGE = 3;
const PROJECTILE_HIT_RADIUS = 0.8;
export const PROJECTILE_LIFETIME_MS = 3000;
const PROJECTILE_CHECK_INTERVAL_MS = 100;

function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Distância do ponto q até o segmento p0->p1. Precisa ser o segmento
// percorrido entre um tick e o outro, não só a posição instantânea em cada
// tick — a bola de energia anda ~2.5 unidades por tick de 100ms (25 un/s),
// bem mais que o raio de acerto (0.8), então checar só o ponto atual deixa
// o projétil "atravessar" o alvo sem nunca registrar como perto o bastante.
function pointToSegmentDistance(p0: Vec3, p1: Vec3, q: Vec3): number {
  const seg = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
  const segLenSq = seg.x * seg.x + seg.y * seg.y + seg.z * seg.z;
  if (segLenSq === 0) return distance(p0, q);

  const toQ = { x: q.x - p0.x, y: q.y - p0.y, z: q.z - p0.z };
  const t = Math.max(0, Math.min(1, (toQ.x * seg.x + toQ.y * seg.y + toQ.z * seg.z) / segLenSq));
  const closest = { x: p0.x + seg.x * t, y: p0.y + seg.y * t, z: p0.z + seg.z * t };
  return distance(closest, q);
}

// Réplica da trajetória visual em Engine.castAbilityAt (origem + offset
// (0, 0.5, 0) + 1 unidade na direção que o personagem tava olhando (yaw),
// viajando nessa mesma direção na velocidade da habilidade) — precisa bater
// com o que é renderizado pra "fui atingido" fazer sentido pro jogador.
function projectilePositionAt(origin: Vec3, yaw: number, speed: number, elapsedSeconds: number): Vec3 {
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const traveled = 1 + speed * elapsedSeconds;
  return { x: origin.x + forwardX * traveled, y: origin.y + 0.5, z: origin.z + forwardZ * traveled };
}

// Cada cliente decide, pra si mesmo, se um cast recebido de outro peer o
// atingiu (ver regra em AbilityRuntime) — chama onHit() quando concluir que
// sim. Instant/area resolvem na hora; projétil precisa simular a trajetória
// porque leva tempo pra "chegar".
export function resolveIncomingCast(ability: Ability, origin: Vec3, yaw: number, getMyPosition: () => Vec3, onHit: () => void) {
  if (ability.target.kind === "instant") {
    if (distance(origin, getMyPosition()) <= MELEE_RANGE) onHit();
    return;
  }

  if (ability.target.kind === "area") {
    if (distance(origin, getMyPosition()) <= ability.target.radius) onHit();
    return;
  }

  if (ability.target.kind === "projectile") {
    const speed = ability.target.speed;
    const startedAt = performance.now();
    let lastPos = projectilePositionAt(origin, yaw, speed, 0);
    const interval = setInterval(() => {
      const elapsedMs = performance.now() - startedAt;
      if (elapsedMs > PROJECTILE_LIFETIME_MS) {
        clearInterval(interval);
        return;
      }
      const currentPos = projectilePositionAt(origin, yaw, speed, elapsedMs / 1000);
      if (pointToSegmentDistance(lastPos, currentPos, getMyPosition()) <= PROJECTILE_HIT_RADIUS) {
        clearInterval(interval);
        onHit();
        return;
      }
      lastPos = currentPos;
    }, PROJECTILE_CHECK_INTERVAL_MS);
  }

  // "self": nunca acerta quem recebeu o broadcast — só o próprio autor do
  // cast, que já aplica o efeito localmente no momento de castar.
}
