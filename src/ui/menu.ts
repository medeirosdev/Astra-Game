import { generateRoomCode, modeFromCode, type GameMode } from "../network/room";
import { CHARACTERS, type CharacterId } from "../characters/characters";
import type { CharacterIcon } from "../characters/types";

export interface MenuResult {
  code: string;
  characterId: CharacterId;
  mode: GameMode;
}

// Um ícone simples por arquétipo (não é o modelo 3D — isso é só a tela de
// seleção). currentColor pra herdar a cor do personagem via CSS.
const ICONS: Record<CharacterIcon, string> = {
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    <path d="M2 12C4.8 6.5 8.2 4 12 4s7.2 2.5 10 8c-2.8 5.5-6.2 8-10 8S4.8 17.5 2 12Z"/>
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
  </svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="13,2 4,14 11,14 9,22 20,9 12,9"/>
  </svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2 4 5v6c0 5 3.4 8.5 8 9 4.6-0.5 8-4 8-9V5l-8-3Z"/>
  </svg>`,
  // Portal/vazio — anéis concêntricos, pro mago de vazio/espaço/tempo.
  void: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/>
  </svg>`,
  // Montanha rachada — terremoto/choque sísmico, pro brigão.
  quake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="12,3 22,20 2,20"/>
    <polyline points="12,9 9,14 13,15 10,20"/>
  </svg>`,
  // Mira/retículo — laser e explosivos teleguiados, pro especialista em
  // artilharia (raio contínuo, bomba, ataque orbital).
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
    <circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>
    <path stroke-linecap="round" d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>
  </svg>`,
};

export function showMenu(container: HTMLElement): Promise<MenuResult> {
  return new Promise((resolve) => {
    const characterIds = Object.keys(CHARACTERS) as CharacterId[];
    let selected: CharacterId = characterIds[0];

    let mode: GameMode = "arena";

    const el = document.createElement("div");
    el.className = "menu";
    el.innerHTML = `
      <div class="menu-card">
        <h1>ASTRA</h1>
        <div class="character-picker"></div>
        <div class="mode-picker">
          <button type="button" class="mode-btn selected" data-mode="arena">Mata-mata</button>
          <button type="button" class="mode-btn" data-mode="survival">Sobrevivência</button>
        </div>
        <button id="create-btn">Criar sala</button>
        <div class="menu-divider">ou</div>
        <form id="join-form">
          <input id="join-code" maxlength="5" placeholder="CÓDIGO" autocomplete="off" />
          <button type="submit">Entrar</button>
        </form>
        <p class="menu-hint">Entrar numa sala usa o modo de quem criou ela.</p>
      </div>
    `;
    container.appendChild(el);

    const modeButtons = el.querySelectorAll<HTMLButtonElement>(".mode-btn");
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode as GameMode;
        modeButtons.forEach((b) => b.classList.toggle("selected", b === btn));
      });
    });

    const picker = el.querySelector(".character-picker")!;
    const cards = new Map<CharacterId, HTMLButtonElement>();
    characterIds.forEach((id) => {
      const character = CHARACTERS[id];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "character-card";
      card.style.setProperty("--character-color", character.color);
      card.innerHTML = `
        <span class="badge">${ICONS[character.icon]}</span>
        <span class="char-name">${character.name}</span>
        <span class="char-tagline">${character.tagline}</span>
      `;
      card.addEventListener("click", () => {
        selected = id;
        cards.forEach((c, cId) => c.classList.toggle("selected", cId === id));
      });
      picker.appendChild(card);
      cards.set(id, card);
    });
    cards.get(selected)?.classList.add("selected");

    el.querySelector("#create-btn")!.addEventListener("click", () => {
      el.remove();
      resolve({ code: generateRoomCode(mode), characterId: selected, mode });
    });

    el.querySelector("#join-form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = el.querySelector("#join-code") as HTMLInputElement;
      const code = input.value.trim().toUpperCase();
      if (code.length === 0) return;
      el.remove();
      resolve({ code, characterId: selected, mode: modeFromCode(code) });
    });
  });
}

export function showRoomCode(container: HTMLElement, code: string) {
  const el = document.createElement("div");
  el.className = "room-code";
  el.textContent = `Sala: ${code}`;
  container.appendChild(el);
}
