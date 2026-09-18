import type { Ability, AbilityEffect } from "../abilities/types";
import { ABILITIES, type AbilityId } from "../abilities/abilities";
import type { CharacterDef } from "../characters/types";

export interface CastResult {
  ability: Ability;
}

const RESPAWN_DELAY_MS = 3000;

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
  guard: number;
  readonly maxHealth: number;
  readonly maxEnergy: number;
  readonly maxGuard: number;
  private readonly regenPerSec: number;
  private readonly guardRegenPerSec: number;
  private cooldownUntil = new Map<AbilityId, number>();
  private stunnedUntil = 0;
  private speedFactor = 1;
  private speedFactorUntil = 0;
  private deadUntil = 0;
  // Segurando o botão direito do mouse — não é o mesmo que "bloqueando de
  // verdade" (ver isBlocking): guarda a 0 quebra a defesa mesmo segurando.
  private blockHeld = false;
  // Janela de i-frame do rolamento (ver Engine.tryRoll) — ignora qualquer
  // efeito recebido, não só dano.
  private invulnerableUntil = 0;

  constructor(private readonly character: CharacterDef) {
    this.health = character.stats.health;
    this.energy = character.stats.energy;
    this.guard = character.stats.guard;
    this.maxHealth = character.stats.health;
    this.maxEnergy = character.stats.energy;
    this.maxGuard = character.stats.guard;
    this.regenPerSec = character.stats.energyRegenPerSec;
    this.guardRegenPerSec = character.stats.guardRegenPerSec;
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
    // Só regenera guarda com o botão solto — segurar bloqueio depois que a
    // guarda quebrou não deixa ela voltar, tem que soltar pra recuperar.
    if (!this.blockHeld) {
      this.guard = Math.min(this.maxGuard, this.guard + this.guardRegenPerSec * dtSeconds);
    }
  }

  setBlocking(active: boolean) {
    this.blockHeld = active;
  }

  // Bloqueando de verdade (segurando E com guarda de sobra) — guarda a 0
  // quebra a defesa mesmo com o botão ainda pressionado.
  isBlocking(): boolean {
    return this.blockHeld && this.guard > 0;
  }

  setInvulnerable(durationMs: number, now: number) {
    this.invulnerableUntil = Math.max(this.invulnerableUntil, now + durationMs);
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
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
    if (this.isDead(now)) return;
    if (effect.kind !== "heal" && this.isInvulnerable(now)) return;
    switch (effect.kind) {
      case "damage": {
        // Bloqueando: o dano consome a guarda primeiro; o que sobrar (guarda
        // quebrou no meio do golpe) vaza pra vida, igual dano normal.
        const toGuard = this.isBlocking() ? Math.min(this.guard, effect.amount) : 0;
        this.guard -= toGuard;
        const toHealth = effect.amount - toGuard;
        this.health = Math.max(0, this.health - toHealth);
        if (this.health === 0) this.deadUntil = now + RESPAWN_DELAY_MS;
        break;
      }
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
      case "teleport":
        // Efeito posicional — quem aplica é o Engine (tem a posição do
        // jogador), não a runtime (só sabe vida/energia/status).
        break;
    }
  }

  isStunned(now: number): boolean {
    return now < this.stunnedUntil;
  }

  getSpeedFactor(now: number): number {
    return now < this.speedFactorUntil ? this.speedFactor : 1;
  }

  isDead(now: number): boolean {
    return now < this.deadUntil;
  }

  respawnCountdownMs(now: number): number {
    return Math.max(0, this.deadUntil - now);
  }

  // Chamar todo frame; retorna true só no frame exato em que o respawn
  // acontece, pra quem chama saber a hora de teleportar de volta ao spawn.
  respawnIfReady(now: number): boolean {
    if (this.deadUntil === 0 || now < this.deadUntil) return false;
    this.health = this.maxHealth;
    this.energy = this.maxEnergy;
    this.guard = this.maxGuard;
    this.blockHeld = false;
    this.invulnerableUntil = 0;
    this.deadUntil = 0;
    this.stunnedUntil = 0;
    this.speedFactorUntil = 0;
    return true;
  }
}
