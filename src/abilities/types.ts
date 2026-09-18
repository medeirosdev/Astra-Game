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
  | { kind: "teleport"; distance: number };

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
  effect: AbilityEffect;
  vfx: AbilityVfx;
  // Avanço pra frente ao castar (unidades) — usado pelos socos básicos pra
  // dar sensação de investida; opcional porque a maioria dos poderes não
  // move o personagem.
  lunge?: number;
  // Empurrão pra trás (unidades) aplicado em quem apanha — só faz sentido
  // pra golpes físicos (ver AbilityRuntime/Engine.applyKnockback).
  knockback?: number;
}
