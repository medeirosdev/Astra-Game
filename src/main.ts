import "./style.css";
import { Engine } from "./game/Engine";
import { Hud } from "./ui/hud";
import { showMenu, showRoomCode } from "./ui/menu";
import { connectToRoom } from "./network/room";
import { setupSync, PLACEHOLDER_COLOR } from "./network/sync";
import { CHARACTERS, isCharacterId } from "./characters/characters";
import { ABILITIES, isAbilityId } from "./abilities/abilities";

const POSITION_SYNC_HZ = 15;

async function main() {
  const app = document.getElementById("app")!;
  const { code, characterId } = await showMenu(app);
  showRoomCode(app, code);

  const room = connectToRoom(code);
  const sync = setupSync(room);
  const character = CHARACTERS[characterId];

  const hud = new Hud(app, character);
  const engine = new Engine(app, character, (runtime) => hud.update(runtime, performance.now()));

  let peerCount = 0;
  room.onPeerJoin((peerId) => {
    hud.setPeerCount(++peerCount);
    engine.spawnRemotePlayer(peerId, PLACEHOLDER_COLOR);
    sync.sendHello({ characterId }, peerId);
  });
  room.onPeerLeave((peerId) => {
    hud.setPeerCount(--peerCount);
    engine.removeRemotePlayer(peerId);
  });

  sync.onHello(({ characterId: remoteCharacterId }, peerId) => {
    if (!isCharacterId(remoteCharacterId)) return;
    engine.setRemotePlayerColor(peerId, CHARACTERS[remoteCharacterId].color);
  });
  sync.onPosition((position, peerId) => engine.updateRemotePlayer(peerId, position));
  sync.onCast(({ abilityId, x, y, z }) => {
    if (!isAbilityId(abilityId)) return;
    engine.castAbilityAt(ABILITIES[abilityId], { x, y, z });
  });

  setInterval(() => sync.sendPosition(engine.getLocalPosition()), 1000 / POSITION_SYNC_HZ);

  window.addEventListener("keydown", (e) => {
    const slot = engine.runtime.slots.find((s) => s.key === e.key);
    if (!slot) return;
    const cast = engine.runtime.tryCast(slot.abilityId, performance.now());
    if (!cast) return;
    engine.castAbility(ABILITIES[slot.abilityId]);
    sync.sendCast({ abilityId: slot.abilityId, ...engine.getLocalPosition() });
  });

  engine.start();
}

main();
