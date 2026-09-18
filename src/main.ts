import "./style.css";
import { Engine } from "./game/Engine";
import { Hud } from "./ui/hud";
import { showMenu, showRoomCode } from "./ui/menu";
import { connectToRoom } from "./network/room";
import { setupSync, PLACEHOLDER_COLOR } from "./network/sync";
import { CHARACTERS, isCharacterId } from "./characters/characters";
import { ABILITIES, isAbilityId } from "./abilities/abilities";
import { resolveIncomingCast } from "./game/combat";
import { MatchState, LOCAL_SCORE_KEY } from "./game/match";

const POSITION_SYNC_HZ = 15;
const MATCH_DURATION_MS = Number(new URLSearchParams(location.search).get("matchSeconds") ?? 180) * 1000;

async function main() {
  const app = document.getElementById("app")!;
  const { code, characterId } = await showMenu(app);
  showRoomCode(app, code);

  const room = connectToRoom(code);
  const sync = setupSync(room);
  const character = CHARACTERS[characterId];
  console.log(`[astra] entrando na sala "${code}" como ${character.name}`);

  const match = new MatchState(MATCH_DURATION_MS, performance.now());
  const hud = new Hud(app, character);
  const engine = new Engine(app, character, code, (runtime) => {
    const now = performance.now();
    hud.update(runtime, now);
    hud.updateMatch(match, now);
    engine.setFrozen(match.isOver(now));
  });

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
    const remoteCharacter = CHARACTERS[remoteCharacterId];
    engine.setRemotePlayerCharacter(peerId, remoteCharacter.modelUrl, remoteCharacter.color);
  });
  sync.onPosition((transform, peerId) => engine.updateRemotePlayer(peerId, transform));
  sync.onCast(({ abilityId, x, y, z, yaw, anim }, casterId) => {
    if (!isAbilityId(abilityId)) return;
    const ability = ABILITIES[abilityId];
    engine.castAbilityAt(ability, { x, y, z }, yaw);
    engine.playRemoteAnimation(casterId, ability, anim);
    resolveIncomingCast(ability, { x, y, z }, yaw, () => engine.getLocalTransform(), () => {
      const now = performance.now();
      const wasAlive = !engine.runtime.isDead(now);
      engine.runtime.applyEffect(ability.effect, now);
      if (wasAlive && engine.runtime.isDead(now)) sync.sendKillCredit({ ack: true }, casterId);

      // Soco/golpe básico conectou em mim — recuo, tropeço, flash na tela,
      // e avisa todo mundo (o atacante quer o impacto físico no lugar
      // certo, ver onHitFeedback; os outros só a reação de quem apanhou).
      if (ability.tier === "basic") {
        if (ability.knockback) engine.applyKnockback({ x, y, z }, ability.knockback);
        engine.playLocalHitReaction();
        hud.flashDamage();
        const { x: hx, y: hy, z: hz } = engine.getLocalTransform();
        sync.sendHitFeedback({ attackerId: casterId, x: hx, y: hy, z: hz });
      }
    });
  });
  sync.onHitFeedback(({ attackerId, x, y, z }, fromPeerId) => {
    // Se o ataque era meu, é o meu soco conectando de verdade — mostra o
    // impacto físico (poeira/tremor/hit-stop) no ponto onde o alvo apanhou.
    if (attackerId === room.getSelfId()) engine.triggerImpact({ x, y, z });
    // Reação de quem apanhou (fromPeerId) — visível pra todo mundo, não só
    // pro atacante.
    engine.playRemoteHitReaction(fromPeerId);
  });
  sync.onKillCredit(() => {
    match.registerLocalKill();
    sync.sendScore({ kills: match.getKills(LOCAL_SCORE_KEY) });
  });
  sync.onScore(({ kills }, peerId) => match.setKills(peerId, kills));

  setInterval(() => sync.sendPosition({ ...engine.getLocalTransform(), alive: !engine.runtime.isDead(performance.now()) }), 1000 / POSITION_SYNC_HZ);

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
    if (match.isOver(now) || engine.runtime.isDead(now) || engine.runtime.isStunned(now)) return;

    // Espaço pula, Shift rola pra frente com i-frame (ver Engine.tryRoll).
    // Agachar não precisa de handler aqui — Engine lê "c" segurado direto
    // (ver updateMovement), igual o WASD.
    if (e.code === "Space") {
      e.preventDefault();
      engine.tryJump();
      return;
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      engine.tryRoll();
      return;
    }

    const slot = engine.runtime.slots.find((s) => s.key === e.key);
    if (!slot) return;
    const cast = engine.runtime.tryCast(slot.abilityId, now);
    if (!cast) return;
    const ability = ABILITIES[slot.abilityId];
    const anim = engine.castAbility(ability);
    if (ability.target.kind === "self") {
      if (ability.effect.kind === "teleport") engine.teleportForward(ability.effect.distance);
      else engine.runtime.applyEffect(ability.effect, now);
    }
    sync.sendCast({ abilityId: slot.abilityId, ...engine.getLocalTransform(), anim });
  });

  // Botão esquerdo: soco básico (combo, sem custo de energia, cooldown
  // curto por personagem). Botão direito: segurar bloqueia (barra de
  // defesa em AbilityRuntime). Só reage com o mouse travado (mesma trava
  // usada pro olhar em volta) — sem isso o primeiro clique pra travar o
  // mouse já dispararia um soco sem querer.
  window.addEventListener("mousedown", (e) => {
    if (!engine.isPointerLocked()) return;
    const now = performance.now();
    if (match.isOver(now) || engine.runtime.isDead(now)) return;

    if (e.button === 0) {
      if (engine.runtime.isStunned(now)) return;
      const cast = engine.runtime.tryCast(character.basicAttackId, now);
      if (!cast) return;
      const ability = ABILITIES[character.basicAttackId];
      const anim = engine.castAbility(ability);
      sync.sendCast({ abilityId: character.basicAttackId, ...engine.getLocalTransform(), anim });
    } else if (e.button === 2) {
      engine.runtime.setBlocking(true);
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) engine.runtime.setBlocking(false);
  });
  // Perder o foco da janela com o botão ainda "pressionado" (alt-tab, etc)
  // não pode deixar o bloqueio travado ligado pra sempre.
  window.addEventListener("blur", () => engine.runtime.setBlocking(false));

  engine.start();
}

main();
