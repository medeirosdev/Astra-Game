import { generateRoomCode } from "../network/room";

export interface MenuResult {
  code: string;
}

export function showMenu(container: HTMLElement): Promise<MenuResult> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "menu";
    el.innerHTML = `
      <div class="menu-card">
        <h1>ASTRA</h1>
        <button id="create-btn">Criar sala</button>
        <div class="menu-divider">ou</div>
        <form id="join-form">
          <input id="join-code" maxlength="5" placeholder="CÓDIGO" autocomplete="off" />
          <button type="submit">Entrar</button>
        </form>
      </div>
    `;
    container.appendChild(el);

    el.querySelector("#create-btn")!.addEventListener("click", () => {
      el.remove();
      resolve({ code: generateRoomCode() });
    });

    el.querySelector("#join-form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = el.querySelector("#join-code") as HTMLInputElement;
      const code = input.value.trim().toUpperCase();
      if (code.length === 0) return;
      el.remove();
      resolve({ code });
    });
  });
}

export function showRoomCode(container: HTMLElement, code: string) {
  const el = document.createElement("div");
  el.className = "room-code";
  el.textContent = `Sala: ${code}`;
  container.appendChild(el);
}
