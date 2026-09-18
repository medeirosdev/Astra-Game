// "basic" é o soco/golpe do botão esquerdo do mouse — fora do loadout de 5
// slots, sem custo de energia, cooldown próprio bem mais curto.
export type AbilityTier = "common" | "strong" | "super" | "basic";

export type AbilityTargetType =
  | { kind: "projectile"; speed: number }
  | { kind: "area"; radius: number }
  | { kind: "instant" }
  | { kind: "self" };

export type AbilityEffect =
  | { kind: "damage"; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "stun"; durationMs: number }
  | { kind: "slow"; factor: number; durationMs: number }
  | { kind: "speedBuff"; factor: number; durationMs: number }
  | { kind: "teleport"; distance: number }
  // Puxa o alvo pra origem do cast (o oposto do knockback) — resolvido pelo
  // Engine (é posicional, AbilityRuntime só sabe vida/energia/status), igual
  // teleport já funciona.
  | { kind: "pull"; distance: number }
  // Some do radar de quem NÃO sou eu — meu próprio cliente ainda se vê
  // (semi-transparente), peers remotos escondem meu avatar de vez (ver
  // sync.ts PositionPayload.invisible).
  | { kind: "invisible"; durationMs: number }
  // Multiplica o dano que EU causo enquanto durar — precisa viajar junto no
  // cast (CastPayload.dmgMult) porque quem decide o valor final é sempre
  // quem apanha, a partir do que o atacante mandou.
  | { kind: "damageBuff"; factor: number; durationMs: number };

export interface AbilityVfx {
  color: string;
  particle?: string;
  sound?: string;
}

export interface Ability {
  id: string;
  name: string;
  tier: AbilityTier;
  cost: number;
  cooldownMs: number;
  target: AbilityTargetType;
  // Lista de efeitos aplicados em quem o target.kind resolver como acertado
  // (ou em mim mesmo, se target.kind for "self") — quase sempre só um, mas
  // alguns poderes fazem mais de uma coisa de uma vez (dano + lentidão,
  // cura + invisibilidade, etc).
  effect: AbilityEffect[];
  // Efeitos aplicados em MIM (o conjurador) na hora do cast, além do que
  // `effect` fizer em quem for acertado — pra poderes tipo "dano em área ao
  // redor E eu fico mais rápido". Ausente na maioria dos poderes (que já
  // afetam só quem foi acertado, via `effect`, ou só a mim, via target self).
  selfEffect?: AbilityEffect[];
  vfx: AbilityVfx;
  // Avanço pra frente ao castar (unidades) — usado pelos socos básicos pra
  // dar sensação de investida; opcional porque a maioria dos poderes não
  // move o personagem.
  lunge?: number;
  // Empurrão pra trás (unidades) aplicado em quem apanha — golpes físicos
  // (ver AbilityRuntime/Engine.applyKnockback) e alguns poderes de área.
  knockback?: number;
  // Sobrescreve a animação padrão (que só olha target.kind) — pra poderes
  // com uma pose própria, tipo um golpe que cai do ar (ver "Pulo Mortal").
  castAnim?: string;
}
