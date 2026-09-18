import { MOB_TYPES, WAVES } from "./mobs";

export interface MobInstance {
  id: string;
  typeId: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  attackReadyAt: number;
}

export type SurvivalPhase = "waiting" | "fighting" | "resting" | "victory";

interface PlayerSnapshot {
  key: string; // peerId, ou LOCAL_SCORE_KEY pro jogador local
  x: number;
  z: number;
  alive: boolean;
}

const WAVE_REST_MS = 4000; // respiro entre ondas
const MOB_SPAWN_RADIUS = 40; // longe o bastante do meio, onde os jogadores nascem

// Simulação dos mobs — só o HOST da sala roda isso de verdade (ver
// WebrtcRoom.getIsHost em webrtcRoom.ts); os outros peers só recebem o
// estado já resolvido (ver network/sync.ts, ações mobState/mobAttack) e
// desenham. Sem servidor de verdade, alguém precisa ser dono da simulação
// dos monstros — jogador contra jogador continua "quem recebe decide"
// (about.md), isso aqui só estende a mesma ideia pra NPCs, que não têm
// cliente próprio pra decidir por si.
export class SurvivalState {
  wave = -1; // -1 = nenhuma onda começou ainda
  phase: SurvivalPhase = "waiting";
  mobs: MobInstance[] = [];
  private phaseChangedAt: number;
  private nextMobId = 0;

  constructor(now: number) {
    this.phaseChangedAt = now;
  }

  get totalWaves(): number {
    return WAVES.length;
  }

  get isBossWave(): boolean {
    return this.wave === WAVES.length - 1;
  }

  update(now: number, dt: number, players: PlayerSnapshot[], onMobAttack: (playerKey: string, damage: number) => void) {
    if (this.phase === "waiting") {
      this.startNextWave(now);
      return;
    }
    if (this.phase === "victory") return;
    if (this.phase === "resting") {
      if (now - this.phaseChangedAt >= WAVE_REST_MS) this.startNextWave(now);
      return;
    }

    const alivePlayers = players.filter((p) => p.alive);
    for (const mob of this.mobs) {
      if (!mob.alive) continue;
      const type = MOB_TYPES[mob.typeId];
      const target = nearestPlayer(mob, alivePlayers);
      if (!target) continue;

      const dx = target.x - mob.x;
      const dz = target.z - mob.z;
      const dist = Math.hypot(dx, dz);
      if (dist > type.attackRangeUnits) {
        const step = Math.min(type.speed * dt, dist);
        mob.x += (dx / dist) * step;
        mob.z += (dz / dist) * step;
      } else if (now >= mob.attackReadyAt) {
        mob.attackReadyAt = now + type.attackCooldownMs;
        onMobAttack(target.key, type.damage);
      }
    }

    if (this.mobs.length > 0 && this.mobs.every((m) => !m.alive)) {
      if (this.isBossWave) {
        this.phase = "victory";
      } else {
        this.phase = "resting";
      }
      this.phaseChangedAt = now;
    }
  }

  // Retorna true se acertou de verdade (mob existe e tava vivo) — quem
  // chama (host) só repassa a rede/mata o mob se isso vier true.
  applyDamage(mobId: string, amount: number): boolean {
    const mob = this.mobs.find((m) => m.id === mobId && m.alive);
    if (!mob) return false;
    mob.health = Math.max(0, mob.health - amount);
    if (mob.health === 0) mob.alive = false;
    return true;
  }

  private startNextWave(now: number) {
    this.wave += 1;
    this.phase = "fighting";
    this.phaseChangedAt = now;
    const def = WAVES[this.wave];
    this.mobs = def.mobs.map((typeId) => this.spawnMob(typeId));
  }

  private spawnMob(typeId: string): MobInstance {
    const type = MOB_TYPES[typeId];
    const angle = Math.random() * Math.PI * 2;
    const radius = MOB_SPAWN_RADIUS * (0.7 + Math.random() * 0.3);
    return {
      id: `mob-${this.nextMobId++}`,
      typeId,
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
      health: type.health,
      maxHealth: type.health,
      alive: true,
      attackReadyAt: 0,
    };
  }
}

function nearestPlayer(mob: { x: number; z: number }, players: PlayerSnapshot[]): PlayerSnapshot | null {
  let best: PlayerSnapshot | null = null;
  let bestDist = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - mob.x, p.z - mob.z);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}
