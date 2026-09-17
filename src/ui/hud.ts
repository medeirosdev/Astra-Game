import type { AbilityRuntime } from "../game/AbilityRuntime";
import { ABILITIES } from "../abilities/abilities";
import type { CharacterDef } from "../characters/types";
import { LOCAL_SCORE_KEY, type MatchState } from "../game/match";

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
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly cooldownEls: HTMLDivElement[] = [];
  private readonly peerCountEl: HTMLDivElement;
  private readonly matchTimerEl: HTMLDivElement;
  private readonly scoreboardEl: HTMLDivElement;
  private readonly deathOverlayEl: HTMLDivElement;
  private readonly endScreenEl: HTMLDivElement;

  constructor(container: HTMLElement, character: CharacterDef) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    const bars = document.createElement("div");
    bars.className = "hud-bars";
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

    bars.append(healthBar, energyBar);

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

    this.root.append(
      bars,
      slots,
      this.peerCountEl,
      this.matchTimerEl,
      this.scoreboardEl,
      this.deathOverlayEl,
      this.endScreenEl,
    );
    container.appendChild(this.root);
    this.setPeerCount(0);
  }

  setPeerCount(count: number) {
    this.peerCountEl.textContent = count === 0 ? "Sozinho na sala" : `${count} amigo(s) conectado(s)`;
  }

  update(runtime: AbilityRuntime, now: number) {
    const healthPct = (Math.max(0, runtime.health) / runtime.maxHealth) * 100;
    const energyPct = (Math.max(0, runtime.energy) / runtime.maxEnergy) * 100;
    this.healthFill.style.width = `${Math.min(100, healthPct)}%`;
    this.energyFill.style.width = `${Math.min(100, energyPct)}%`;

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
}
