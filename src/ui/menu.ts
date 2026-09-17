import { generateRoomCode } from "../network/room";
import { CHARACTERS, type CharacterId } from "../characters/characters";

export interface MenuResult {
  code: string;
  characterId: CharacterId;
}

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
      card.innerHTML = `<span class="dot"></span><span>${character.name}</span>`;
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
