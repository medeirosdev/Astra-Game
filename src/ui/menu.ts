import { generateRoomCode } from "../network/room";
import { CHARACTERS, type CharacterId } from "../characters/characters";
import type { CharacterIcon } from "../characters/types";

export interface MenuResult {
  code: string;
  characterId: CharacterId;
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
};

export function showMenu(container: HTMLElement): Promise<MenuResult> {
  return new Promise((resolve) => {
    const characterIds = Object.keys(CHARACTERS) as CharacterId[];
    let selected: CharacterId = characterIds[0];

    const el = document.createElement("div");
    el.className = "menu";
    el.innerHTML = `
      <div class="menu-card">
        <h1>ASTRA</h1>
        <div class="character-picker"></div>
        <button id="create-btn">Criar sala</button>
        <div class="menu-divider">ou</div>
        <form id="join-form">
          <input id="join-code" maxlength="5" placeholder="CÓDIGO" autocomplete="off" />
          <button type="submit">Entrar</button>
        </form>
      </div>
    `;
    container.appendChild(el);

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
      resolve({ code: generateRoomCode(), characterId: selected });
    });

    el.querySelector("#join-form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = el.querySelector("#join-code") as HTMLInputElement;
      const code = input.value.trim().toUpperCase();
      if (code.length === 0) return;
      el.remove();
      resolve({ code, characterId: selected });
    });
  });
}

export function showRoomCode(container: HTMLElement, code: string) {
  const el = document.createElement("div");
  el.className = "room-code";
  el.textContent = `Sala: ${code}`;
  container.appendChild(el);
}
