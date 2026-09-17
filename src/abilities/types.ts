export type AbilityTier = "common" | "strong" | "super";

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
}
