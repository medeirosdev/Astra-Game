import "./style.css";
import { Engine } from "./game/Engine";
import { Hud } from "./ui/hud";
import { showMenu, showRoomCode } from "./ui/menu";
import { connectToRoom } from "./network/room";
import { setupSync, PLACEHOLDER_COLOR } from "./network/sync";
import { CHARACTERS, isCharacterId } from "./characters/characters";
import { ABILITIES, isAbilityId } from "./abilities/abilities";
import { resolveIncomingCast } from "./game/combat";

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
  sync.onPosition((transform, peerId) => engine.updateRemotePlayer(peerId, transform));
  sync.onCast(({ abilityId, x, y, z, yaw }) => {
    if (!isAbilityId(abilityId)) return;
    const ability = ABILITIES[abilityId];
    engine.castAbilityAt(ability, { x, y, z }, yaw);
    resolveIncomingCast(ability, { x, y, z }, yaw, () => engine.getLocalTransform(), () =>
      engine.runtime.applyEffect(ability.effect, performance.now()),
    );
  });

  setInterval(() => sync.sendPosition(engine.getLocalTransform()), 1000 / POSITION_SYNC_HZ);

  // Diagnóstico: RTCPeerConnection pode existir (sinalização encontrou o outro
  // peer) mesmo sem nunca conectar de fato (ICE falhou — ex: rede bloqueando
  // WebRTC ou isolamento de cliente no Wi-Fi). Ajuda a distinguir os dois casos.
  setInterval(() => {
    const peers = room.getPeers();
    const states = Object.entries(peers).map(([id, pc]) => `${id.slice(0, 6)}:${pc.iceConnectionState}`);
    console.log("[astra] conexões WebRTC:", states.length === 0 ? "nenhuma ainda" : states.join(", "));
  }, 5000);

  window.addEventListener("keydown", (e) => {
    const now = performance.now();
    if (engine.runtime.isStunned(now)) return;
    const slot = engine.runtime.slots.find((s) => s.key === e.key);
    if (!slot) return;
    const cast = engine.runtime.tryCast(slot.abilityId, now);
    if (!cast) return;
    const ability = ABILITIES[slot.abilityId];
    engine.castAbility(ability);
    if (ability.target.kind === "self") engine.runtime.applyEffect(ability.effect, now);
    sync.sendCast({ abilityId: slot.abilityId, ...engine.getLocalTransform() });
  });

  engine.start();
}

main();
