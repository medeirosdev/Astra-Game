import type { AbilityRuntime } from "../game/AbilityRuntime";
import { ABILITIES } from "../abilities/abilities";
import type { CharacterDef } from "../characters/types";

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly healthFill: HTMLDivElement;
  private readonly energyFill: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly peerCountEl: HTMLDivElement;

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
      slotEl.innerHTML = `<span class="key">${i + 1}</span><span class="name">${ability.name}</span><div class="cooldown"></div>`;
      slots.appendChild(slotEl);
      this.slotEls.push(slotEl);
    });

    this.peerCountEl = document.createElement("div");
    this.peerCountEl.className = "peer-count";

    this.root.append(bars, slots, this.peerCountEl);
    container.appendChild(this.root);
  }

  setPeerCount(count: number) {
    this.peerCountEl.textContent = count === 0 ? "Sozinho na sala" : `${count} amigo(s) conectado(s)`;
  }

  update(runtime: AbilityRuntime, now: number) {
    this.healthFill.style.width = `${Math.max(0, runtime.health)}%`;
    this.energyFill.style.width = `${(runtime.energy / 100) * 100}%`;

    runtime.slots.forEach(({ abilityId }, i) => {
      const ability = ABILITIES[abilityId];
      const remaining = runtime.cooldownRemaining(abilityId, now);
      const pct = remaining / ability.cooldownMs;
      const cd = this.slotEls[i].querySelector(".cooldown") as HTMLDivElement;
      cd.style.height = `${Math.max(0, pct) * 100}%`;
      this.slotEls[i].classList.toggle("ready", remaining === 0);
    });
  }
}
