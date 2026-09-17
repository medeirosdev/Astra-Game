import "./style.css";
import { Engine } from "./game/Engine";
import { Hud } from "./ui/hud";
import { showMenu, showRoomCode } from "./ui/menu";
import { connectToRoom } from "./network/room";
import { CHARACTERS } from "./characters/characters";
import { ABILITIES } from "./abilities/abilities";

async function main() {
  const app = document.getElementById("app")!;
  const { code } = await showMenu(app);
  showRoomCode(app, code);

  const room = connectToRoom(code);
  const character = CHARACTERS.testador;

  const hud = new Hud(app, character);
  const engine = new Engine(app, character, (runtime) => hud.update(runtime, performance.now()));

  let peerCount = 0;
  room.onPeerJoin(() => hud.setPeerCount(++peerCount));
  room.onPeerLeave(() => hud.setPeerCount(--peerCount));

  window.addEventListener("keydown", (e) => {
    const slot = engine.runtime.slots.find((s) => s.key === e.key);
    if (!slot) return;
    const cast = engine.runtime.tryCast(slot.abilityId, performance.now());
    if (cast) engine.castAbility(ABILITIES[slot.abilityId]);
  });

  engine.start();
}

main();
