import type { Ability } from "../abilities/types";
import { ABILITIES } from "../abilities/abilities";
import type { CharacterDef } from "../characters/types";

export interface CastResult {
  ability: Ability;
}

// Controla energia e cooldown de um personagem em jogo.
// Regra: quem decide se um cast é válido é sempre quem roda essa classe
// no host (ver about.md, seção "quem decide o que aconteceu").
export class AbilityRuntime {
  health: number;
  energy: number;
  private readonly maxEnergy: number;
  private readonly regenPerSec: number;
  private cooldownUntil = new Map<string, number>();

  constructor(private readonly character: CharacterDef) {
    this.health = character.stats.health;
    this.energy = character.stats.energy;
    this.maxEnergy = character.stats.energy;
    this.regenPerSec = character.stats.energyRegenPerSec;
  }

  get slots(): { key: string; abilityId: string }[] {
    const l = this.character.loadout;
    return [
      { key: "1", abilityId: l.common[0] },
      { key: "2", abilityId: l.common[1] },
      { key: "3", abilityId: l.strong[0] },
      { key: "4", abilityId: l.strong[1] },
      { key: "5", abilityId: l.super },
    ];
  }

  update(dtSeconds: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + this.regenPerSec * dtSeconds);
  }

  canCast(abilityId: string, now: number): boolean {
    const ability = ABILITIES[abilityId];
    const readyAt = this.cooldownUntil.get(abilityId) ?? 0;
    return now >= readyAt && this.energy >= ability.cost;
  }

  tryCast(abilityId: string, now: number): CastResult | null {
    if (!this.canCast(abilityId, now)) return null;
    const ability = ABILITIES[abilityId];
    this.energy -= ability.cost;
    this.cooldownUntil.set(abilityId, now + ability.cooldownMs);
    return { ability };
  }

  cooldownRemaining(abilityId: string, now: number): number {
    const readyAt = this.cooldownUntil.get(abilityId) ?? 0;
    return Math.max(0, readyAt - now);
  }
}
