import type { AbilityRuntime } from "../game/AbilityRuntime";
import { ABILITIES } from "../abilities/abilities";
import type { CharacterDef } from "../characters/types";
import { LOCAL_SCORE_KEY, type MatchState } from "../game/match";
import type { SurvivalState } from "../game/survival";
import { MOB_TYPES } from "../game/mobs";

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

    this.guardFill = document.createElement("div");
    this.guardFill.className = "bar-fill guard";
    const guardBar = document.createElement("div");
    guardBar.className = "bar bar-guard";
    guardBar.appendChild(this.guardFill);

    bars.append(healthBar, energyBar, guardBar);

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
