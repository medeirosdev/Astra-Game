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
  console.log(`[astra] entrando na sala "${code}" como ${character.name}`);

  const hud = new Hud(app, character);
  const engine = new Engine(app, character, (runtime) => hud.update(runtime, performance.now()));

  let peerCount = 0;
  room.onPeerJoin((peerId) => {
    console.log("[astra] peer conectou:", peerId);
    hud.setPeerCount(++peerCount);
    engine.spawnRemotePlayer(peerId, PLACEHOLDER_COLOR);
    sync.sendHello({ characterId }, peerId);
  });
  room.onPeerLeave((peerId) => {
    console.log("[astra] peer saiu:", peerId);
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

  // Diagnóstico: RTCPeerConnection pode existir (sinalização encontrou o outro
  // peer) mesmo sem nunca conectar de fato (ICE falhou — ex: rede bloqueando
  // WebRTC ou isolamento de cliente no Wi-Fi). Ajuda a distinguir os dois casos.
  setInterval(() => {
    const peers = room.getPeers();
    const states = Object.entries(peers).map(([id, pc]) => `${id.slice(0, 6)}:${pc.iceConnectionState}`);
    console.log("[astra] conexões WebRTC:", states.length === 0 ? "nenhuma ainda" : states.join(", "));
  }, 5000);

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
