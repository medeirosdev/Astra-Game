import type { AbilityRuntime } from "../game/AbilityRuntime";
import { ABILITIES } from "../abilities/abilities";
import type { CharacterDef } from "../characters/types";
import { LOCAL_SCORE_KEY, type MatchState } from "../game/match";
import type { SurvivalState } from "../game/survival";
import { MOB_TYPES } from "../game/mobs";
import { CARD_COLOR, ITEM_COLOR, ITEM_LABEL, type ItemKind } from "../game/cards";

// Ícones de status (ver Hud.updateEffects) — mesmo estilo simples currentColor
// dos ícones de personagem em menu.ts, só que esses vivem só aqui (não são
// "dado de personagem", são efeito temporário de combate).
const STATUS_ICONS: Record<string, string> = {
  stun: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 14 9 21 9 15 13 17 21 12 16 7 21 9 13 3 9 10 9Z"/></svg>`,
  slow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 6 12 12 18 6"/><polyline points="6 14 12 20 18 14"/></svg>`,
  haste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 18 12 12 18 18"/><polyline points="6 10 12 4 18 10"/></svg>`,
  damageBuff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 19 15 9"/><path d="M13 5 19 11"/><path d="M15 3 21 9"/><path d="M3 21 6 18"/></svg>`,
  invisible: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12C4.8 6.5 8.2 4 12 4s7.2 2.5 10 8c-2.8 5.5-6.2 8-10 8S4.8 17.5 2 12Z"/><path d="M3 3 21 21"/></svg>`,
  giant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>`,
};

const ITEM_ICONS: Record<ItemKind, string> = {
  potion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4M10 2v5l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V2"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 9 4.6-0.5 8-4 8-9V5l-8-3Z"/></svg>`,
};

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly healthFill: HTMLDivElement;
  private readonly energyFill: HTMLDivElement;
  private readonly guardFill: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly cooldownEls: HTMLDivElement[] = [];
  private readonly peerCountEl: HTMLDivElement;
  private readonly matchTimerEl: HTMLDivElement;
  private readonly scoreboardEl: HTMLDivElement;
  private readonly deathOverlayEl: HTMLDivElement;
  private readonly endScreenEl: HTMLDivElement;
  private readonly damageFlashEl: HTMLDivElement;
  private readonly waveEl: HTMLDivElement;
  private readonly bossBarEl: HTMLDivElement;
  private readonly bossBarFillEl: HTMLDivElement;
  private readonly cardsEl: HTMLDivElement;
  private lastCardCount = 0;
  private readonly itemEl: HTMLDivElement;
  private lastHeldItem: ItemKind | null = null;
  private readonly effectsEl: HTMLDivElement;
  private readonly effectIconEls: Record<string, HTMLDivElement> = {};

  constructor(container: HTMLElement, character: CharacterDef) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    const bars = document.createElement("div");
    bars.className = "hud-bars";

    this.effectsEl = document.createElement("div");
    this.effectsEl.className = "status-effects";
    for (const key of Object.keys(STATUS_ICONS)) {
      const icon = document.createElement("div");
      icon.className = `status-icon status-${key}`;
      icon.innerHTML = STATUS_ICONS[key];
      icon.style.display = "none";
      this.effectsEl.appendChild(icon);
      this.effectIconEls[key] = icon;
    }
    bars.appendChild(this.effectsEl);

    this.healthFill = document.createElement("div");
    this.healthFill.className = "bar-fill health";
    const healthBar = document.createElement("div");
    healthBar.className = "bar";
    healthBar.appendChild(this.healthFill);

    this.energyFill = document.createElement("div");
    this.energyFill.className = "bar-fill energy";
    const energyBar = document.createElement("div");
    energyBar.className = "bar";
    energyBar.appendChild(this.energyFill);

    this.guardFill = document.createElement("div");
    this.guardFill.className = "bar-fill guard";
    const guardBar = document.createElement("div");
    guardBar.className = "bar bar-guard";
    guardBar.appendChild(this.guardFill);

    bars.append(healthBar, energyBar, guardBar);

    this.cardsEl = document.createElement("div");
    this.cardsEl.className = "cards-info";
    bars.appendChild(this.cardsEl);

    this.itemEl = document.createElement("div");
    this.itemEl.className = "item-info";
    bars.appendChild(this.itemEl);

    const slots = document.createElement("div");
    slots.className = "hud-slots";
    const runtimeSlots = [
      character.loadout.common[0],
      character.loadout.common[1],
      character.loadout.strong[0],
      character.loadout.strong[1],
      character.loadout.super,
    ];
    runtimeSlots.forEach((abilityId, i) => {
      const ability = ABILITIES[abilityId];
      const slotEl = document.createElement("div");
      slotEl.className = `hud-slot tier-${ability.tier}`;
      slotEl.style.setProperty("--accent", ability.vfx.color);

      const keyEl = document.createElement("span");
      keyEl.className = "key";
      keyEl.textContent = String(i + 1);

      const nameEl = document.createElement("span");
      nameEl.className = "name";
      nameEl.textContent = ability.name;

      const cooldownEl = document.createElement("div");
      cooldownEl.className = "cooldown";

      slotEl.append(keyEl, nameEl, cooldownEl);
      slots.appendChild(slotEl);
      this.slotEls.push(slotEl);
      this.cooldownEls.push(cooldownEl);
    });

    this.peerCountEl = document.createElement("div");
    this.peerCountEl.className = "peer-count";

    this.matchTimerEl = document.createElement("div");
    this.matchTimerEl.className = "match-timer";

    this.scoreboardEl = document.createElement("div");
    this.scoreboardEl.className = "scoreboard";

    this.deathOverlayEl = document.createElement("div");
    this.deathOverlayEl.className = "death-overlay";

    this.endScreenEl = document.createElement("div");
    this.endScreenEl.className = "end-screen";

    this.damageFlashEl = document.createElement("div");
    this.damageFlashEl.className = "damage-flash";

    this.waveEl = document.createElement("div");
    this.waveEl.className = "wave-info";

    this.bossBarFillEl = document.createElement("div");
    this.bossBarFillEl.className = "bar-fill boss";
    this.bossBarEl = document.createElement("div");
    this.bossBarEl.className = "boss-bar";
    this.bossBarEl.appendChild(this.bossBarFillEl);

    this.root.append(
      bars,
      slots,
      this.peerCountEl,
      this.matchTimerEl,
      this.scoreboardEl,
      this.deathOverlayEl,
      this.endScreenEl,
      this.damageFlashEl,
      this.waveEl,
      this.bossBarEl,
    );
    container.appendChild(this.root);
    this.setPeerCount(0);
  }

  setPeerCount(count: number) {
    this.peerCountEl.textContent = count === 0 ? "Sozinho na sala" : `${count} amigo(s) conectado(s)`;
  }

  // Pulso vermelho na tela — chamado quando o jogador local apanha de um
  // soco/golpe básico (ver main.ts). Reinicia a animação removendo e
  // recolocando a classe, senão apanhar duas vezes rápido só reanima a
  // primeira (CSS não reinicia uma animação já em andamento sozinho).
  flashDamage() {
    this.damageFlashEl.classList.remove("active");
    void this.damageFlashEl.offsetWidth; // força reflow antes de reaplicar
    this.damageFlashEl.classList.add("active");
  }

  update(runtime: AbilityRuntime, now: number) {
    const healthPct = (Math.max(0, runtime.health) / runtime.maxHealth) * 100;
    const energyPct = (Math.max(0, runtime.energy) / runtime.maxEnergy) * 100;
    const guardPct = (Math.max(0, runtime.guard) / runtime.maxGuard) * 100;
    this.healthFill.style.width = `${Math.min(100, healthPct)}%`;
    this.energyFill.style.width = `${Math.min(100, energyPct)}%`;
    this.guardFill.style.width = `${Math.min(100, guardPct)}%`;
    this.guardFill.parentElement?.classList.toggle("active", runtime.isBlocking());

    runtime.slots.forEach(({ abilityId }, i) => {
      const ability = ABILITIES[abilityId];
      const remaining = runtime.cooldownRemaining(abilityId, now);
      const pct = remaining / ability.cooldownMs;
      this.cooldownEls[i].style.height = `${Math.max(0, pct) * 100}%`;
      this.slotEls[i].classList.toggle("ready", remaining === 0);
    });

    if (runtime.isDead(now)) {
      const secondsLeft = Math.ceil(runtime.respawnCountdownMs(now) / 1000);
      this.deathOverlayEl.textContent = `Você morreu — respawn em ${secondsLeft}s`;
      this.deathOverlayEl.style.display = "flex";
    } else {
      this.deathOverlayEl.style.display = "none";
    }

    this.updateCards(runtime);
    this.updateItem(runtime);
    this.updateEffects(runtime, now);
  }

  // Item segurado (ver AbilityRuntime.useHeldItem) — mostra qual é e o
  // lembrete de tecla, some quando não tem nenhum.
  private updateItem(runtime: AbilityRuntime) {
    const item = runtime.getHeldItem();
    if (item === this.lastHeldItem) return;
    this.lastHeldItem = item;
    this.itemEl.replaceChildren();
    if (!item) {
      this.itemEl.style.display = "none";
      return;
    }
    this.itemEl.style.display = "flex";
    this.itemEl.style.color = ITEM_COLOR[item];
    const icon = document.createElement("span");
    icon.className = "item-icon";
    icon.innerHTML = ITEM_ICONS[item];
    const label = document.createElement("span");
    label.textContent = `${ITEM_LABEL[item]} (F)`;
    this.itemEl.append(icon, label);
  }

  // Ícones de status (stun/lento/rápido/buff de dano/invisível/gigante) —
  // cada um só aparece enquanto o efeito correspondente tá ativo.
  private updateEffects(runtime: AbilityRuntime, now: number) {
    const speedFactor = runtime.getSpeedFactor(now);
    const active: Record<string, boolean> = {
      stun: runtime.isStunned(now),
      slow: speedFactor < 1,
      haste: speedFactor > 1,
      damageBuff: runtime.isDamageBuffed(now),
      invisible: runtime.isInvisible(now),
      giant: runtime.getScaleFactor(now) > 1,
    };
    for (const [key, el] of Object.entries(this.effectIconEls)) {
      el.style.display = active[key] ? "flex" : "none";
    }
  }

  // Cartas de baú (ver Engine.openChest/cards.ts) — uma bolinha colorida
  // por carta (cor = raridade) e o bônus total, com um pulso rápido quando
  // ganha uma nova (ou zera tudo ao morrer, ver AbilityRuntime).
  private updateCards(runtime: AbilityRuntime) {
    const cards = runtime.getCards();
    if (cards.length === this.lastCardCount) return;
    const grew = cards.length > this.lastCardCount;
    this.lastCardCount = cards.length;

    this.cardsEl.replaceChildren();
    if (cards.length === 0) {
      this.cardsEl.style.display = "none";
      return;
    }
    this.cardsEl.style.display = "flex";
    const bonusPct = Math.round(runtime.getCardBonus() * 100);
    const label = document.createElement("span");
    label.textContent = `+${bonusPct}% dano`;
    this.cardsEl.appendChild(label);
    const dots = document.createElement("div");
    dots.className = "card-dots";
    for (const rarity of cards) {
      const dot = document.createElement("span");
      dot.className = "card-dot";
      dot.style.background = CARD_COLOR[rarity];
      dots.appendChild(dot);
    }
    this.cardsEl.appendChild(dots);
    if (grew) {
      this.cardsEl.classList.remove("pulse");
      void this.cardsEl.offsetWidth;
      this.cardsEl.classList.add("pulse");
    }
  }

  updateMatch(match: MatchState, now: number) {
    this.matchTimerEl.textContent = formatTime(match.remainingMs(now));

    const rows = match.scoreboard.map(([key, kills]) => {
      const row = document.createElement("div");
      row.className = "scoreboard-row";
      const nameEl = document.createElement("span");
      nameEl.textContent = key === LOCAL_SCORE_KEY ? "Você" : key.slice(0, 6);
      const killsEl = document.createElement("span");
      killsEl.textContent = String(kills);
      row.append(nameEl, killsEl);
      return row;
    });
    this.scoreboardEl.replaceChildren(...rows);

    if (!match.isOver(now)) {
      this.endScreenEl.style.display = "none";
      return;
    }

    const board = match.scoreboard;
    const topKills = board[0]?.[1] ?? 0;
    const winners = board.filter(([, kills]) => kills === topKills);
    let resultText: string;
    if (topKills === 0) {
      resultText = "Ninguém marcou um abate.";
    } else if (winners.length > 1) {
      resultText = "Empate!";
    } else {
      const [winnerKey] = winners[0];
      resultText = winnerKey === LOCAL_SCORE_KEY ? "Você venceu!" : `${winnerKey.slice(0, 6)} venceu!`;
    }

    this.endScreenEl.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = "Partida encerrada";
    const result = document.createElement("p");
    result.textContent = resultText;
    this.endScreenEl.append(title, result);
    this.endScreenEl.style.display = "flex";
  }

  updateSurvival(state: SurvivalState) {
    if (state.phase === "victory") {
      this.waveEl.style.display = "none";
      this.bossBarEl.style.display = "none";
      this.endScreenEl.replaceChildren();
      const title = document.createElement("h2");
      title.textContent = "Vitória!";
      const result = document.createElement("p");
      result.textContent = "O chefe caiu. Vocês sobreviveram.";
      this.endScreenEl.append(title, result);
      this.endScreenEl.style.display = "flex";
      return;
    }
    this.endScreenEl.style.display = "none";

    const waveLabel = state.wave < 0 ? "Preparando..." : `Onda ${state.wave + 1} de ${state.totalWaves}`;
    this.waveEl.textContent = state.phase === "resting" ? `${waveLabel} — próxima onda chegando...` : waveLabel;
    this.waveEl.style.display = "block";

    const boss = state.isBossWave ? state.mobs.find((m) => MOB_TYPES[m.typeId]?.isBoss && m.alive) : undefined;
    if (boss) {
      this.bossBarEl.style.display = "block";
      this.bossBarFillEl.style.width = `${Math.max(0, (boss.health / boss.maxHealth) * 100)}%`;
    } else {
      this.bossBarEl.style.display = "none";
    }
  }
}
