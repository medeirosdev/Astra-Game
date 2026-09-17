import type { Ability, AbilityEffect } from "../abilities/types";
import { ABILITIES, type AbilityId } from "../abilities/abilities";
import type { CharacterDef } from "../characters/types";

export interface CastResult {
  ability: Ability;
}

// Controla vida, energia, cooldown e status (stun/slow/buff) de um
// personagem em jogo. Regra de acerto (ver about.md e ROADMAP.md, Fase 3):
// quem decide se FOI atingido é sempre o alvo, não quem atacou — cada
// cliente aplica applyEffect() em si mesmo ao concluir que um cast recebido
// o acertou (ver src/game/combat.ts). Evita a disputa "eu acertei"/"não
// acertou" sem precisar de um host árbitro; entre amigos, tanto faz alguém
// rodar um cliente modificado que ignora isso (mesma ressalva já aceita
// pra P2P em geral).
export class AbilityRuntime {
  health: number;
  energy: number;
  readonly maxHealth: number;
  readonly maxEnergy: number;
  private readonly regenPerSec: number;
  private cooldownUntil = new Map<AbilityId, number>();
  private stunnedUntil = 0;
  private speedFactor = 1;
  private speedFactorUntil = 0;

  constructor(private readonly character: CharacterDef) {
    this.health = character.stats.health;
    this.energy = character.stats.energy;
    this.maxHealth = character.stats.health;
    this.maxEnergy = character.stats.energy;
    this.regenPerSec = character.stats.energyRegenPerSec;
  }

  get slots(): { key: string; abilityId: AbilityId }[] {
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

  canCast(abilityId: AbilityId, now: number): boolean {
    const ability = ABILITIES[abilityId];
    const readyAt = this.cooldownUntil.get(abilityId) ?? 0;
    return now >= readyAt && this.energy >= ability.cost;
  }

  tryCast(abilityId: AbilityId, now: number): CastResult | null {
    if (!this.canCast(abilityId, now)) return null;
    const ability = ABILITIES[abilityId];
    this.energy -= ability.cost;
    this.cooldownUntil.set(abilityId, now + ability.cooldownMs);
    return { ability };
  }

  cooldownRemaining(abilityId: AbilityId, now: number): number {
    const readyAt = this.cooldownUntil.get(abilityId) ?? 0;
    return Math.max(0, readyAt - now);
  }

  applyEffect(effect: AbilityEffect, now: number) {
    switch (effect.kind) {
      case "damage":
        this.health = Math.max(0, this.health - effect.amount);
        break;
      case "heal":
        this.health = Math.min(this.maxHealth, this.health + effect.amount);
        break;
      case "stun":
        this.stunnedUntil = Math.max(this.stunnedUntil, now + effect.durationMs);
        break;
      case "slow":
      case "speedBuff":
        this.speedFactor = effect.factor;
        this.speedFactorUntil = now + effect.durationMs;
        break;
    }
  }

  isStunned(now: number): boolean {
    return now < this.stunnedUntil;
  }

  getSpeedFactor(now: number): number {
    return now < this.speedFactorUntil ? this.speedFactor : 1;
  }
}
