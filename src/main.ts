import "./style.css";
import { Engine, MELEE_REACH } from "./game/Engine";
import { Hud } from "./ui/hud";
import { showMenu, showRoomCode } from "./ui/menu";
import { connectToRoom } from "./network/room";
import { setupSync, PLACEHOLDER_COLOR, type MobSnapshot } from "./network/sync";
import { CHARACTERS, isCharacterId } from "./characters/characters";
import { ABILITIES, isAbilityId, type AbilityId } from "./abilities/abilities";
import type { Ability } from "./abilities/types";
import type { CharacterDef } from "./characters/types";
import { resolveIncomingCast } from "./game/combat";
import { MatchState, LOCAL_SCORE_KEY } from "./game/match";
import { SurvivalState, type SurvivalPhase } from "./game/survival";

// Acha um efeito de um certo tipo numa lista — mesma ideia do helper em
// Engine.ts, mas esse arquivo não mexe com THREE então fica um separado.
function findEffect<T extends { kind: string }, K extends T["kind"]>(effects: T[], kind: K): Extract<T, { kind: K }> | undefined {
  return effects.find((e) => e.kind === kind) as Extract<T, { kind: K }> | undefined;
}

const POSITION_SYNC_HZ = 15;
const SURVIVAL_BROADCAST_HZ = 10;
const MATCH_DURATION_MS = Number(new URLSearchParams(location.search).get("matchSeconds") ?? 600) * 1000;

async function main() {
  const app = document.getElementById("app")!;
  const { code, characterId, mode } = await showMenu(app);
  showRoomCode(app, code);

  const room = connectToRoom(code);
  const sync = setupSync(room);
  const character = CHARACTERS[characterId];
  console.log(`[astra] entrando na sala "${code}" como ${character.name} (modo: ${mode})`);

  // Só um dos dois existe por partida — Mata-mata usa `match`, Sobrevivência
  // usa `survival` (ver network/room.ts, o modo vem embutido no código).
  const match = mode === "arena" ? new MatchState(MATCH_DURATION_MS, performance.now()) : null;
  const survival = mode === "survival" ? new SurvivalState(performance.now()) : null;
  // Posição dos OUTROS jogadores — só usada pela IA dos mobs (ver
  // survival.ts), que precisa saber quem perseguir. O host é quem lê isso
  // de verdade; os outros só mantêm atualizado à toa (barato, sem problema).
  const remotePlayers = new Map<string, { x: number; z: number; alive: boolean }>();
  let lastSurvivalTickAt = performance.now();
  let lastSurvivalBroadcastAt = 0;

  function isGameOver(now: number): boolean {
    return match ? match.isOver(now) : survival!.phase === "victory";
  }

  const hud = new Hud(app, character);
  const engine = new Engine(app, character, code, (runtime) => {
    const now = performance.now();
    hud.update(runtime, now);
    if (match) hud.updateMatch(match, now);
    engine.setFrozen(isGameOver(now));

    if (survival) {
      hud.updateSurvival(survival);
      if (room.getIsHost()) tickSurvivalHost(now);
    }
  });

  // Projétil local (isLocal, ver Engine.Projectile) acertando um mob —
  // mesma lógica de host/broadcast do reportMobHits abaixo, só que pra
  // poderes de alcance (ver Engine.updateProjectiles).
  engine.onProjectileHitMob = (mobId, amount) => {
    if (!survival) return;
    if (room.getIsHost()) survival.applyDamage(mobId, amount);
    else sync.sendMobHit({ mobId, amount });
  };

  // Só o host roda a simulação de verdade (ver survival.ts) — os outros
  // peers só recebem o resultado via broadcast (survivalState, ~10Hz).
  function tickSurvivalHost(now: number) {
    const dt = Math.min((now - lastSurvivalTickAt) / 1000, 0.2);
    lastSurvivalTickAt = now;
    const local = engine.getLocalTransform();
    const players = [
      { key: LOCAL_SCORE_KEY, x: local.x, z: local.z, alive: !engine.runtime.isDead(now) },
      ...[...remotePlayers].map(([key, p]) => ({ key, x: p.x, z: p.z, alive: p.alive })),
    ];
    survival!.update(now, dt, players, (playerKey, damage) => {
      if (playerKey === LOCAL_SCORE_KEY) engine.runtime.applyEffect([{ kind: "damage", amount: damage }], now);
      else sync.sendMobAttack({ amount: damage }, playerKey);
    });
    engine.updateMobs(survival!.mobs);

    if (now - lastSurvivalBroadcastAt >= 1000 / SURVIVAL_BROADCAST_HZ) {
      lastSurvivalBroadcastAt = now;
      const mobs: MobSnapshot[] = survival!.mobs.map((m) => ({
        id: m.id,
        typeId: m.typeId,
        x: m.x,
        y: m.y,
        z: m.z,
        health: m.health,
        maxHealth: m.maxHealth,
        alive: m.alive,
      }));
      sync.sendSurvivalState({ wave: survival!.wave, totalWaves: survival!.totalWaves, phase: survival!.phase, mobs });
    }
  }

  // Casta localmente (visual + aplica o que afeta só a mim mesmo — o
  // efeito principal se o alvo for "self", ou selfEffect se for outro
  // target, ver abilities/types.ts) e manda pra rede. Usado tanto pelos 5
  // slots quanto pelo soco básico do mouse — a única diferença entre os
  // dois é qual ability/abilityId é passado.
  function performLocalCast(abilityId: AbilityId, ability: Ability) {
    const now = performance.now();
    const anim = engine.castAbility(ability);

    const localEffects = ability.target.kind === "self" ? ability.effect : ability.selfEffect;
    if (localEffects) {
      engine.runtime.applyEffect(localEffects, now);
      const teleport = findEffect(localEffects, "teleport");
      if (teleport) engine.teleportForward(teleport.distance);
    }

    if (survival) reportMobHits(ability);

    const dmgMult = engine.runtime.getDamageFactor(now);
    sync.sendCast({ abilityId, ...engine.getLocalTransform(), anim, dmgMult: dmgMult !== 1 ? dmgMult : undefined });
  }

  // Reporta um hit em mob pro host (broadcast, mas só o host de fato age
  // nele — ver onMobHit); se eu mesmo sou o host, aplico direto, sem
  // round-trip de rede. Mesma ideia pra todo target.kind, só muda quem
  // decide "quais mobs" (ver reportMobHits).
  function applyMobDamage(mobId: string, amount: number) {
    if (room.getIsHost()) survival!.applyDamage(mobId, amount);
    else sync.sendMobHit({ mobId, amount });
  }

  // Ponto fixo à frente de quem castou — mesma conta de combat.ts/pointAhead,
  // duplicada aqui porque este arquivo não depende de THREE (ver findEffect
  // acima) e aquele não depende de engine.
  function pointAhead(origin: { x: number; y: number; z: number }, yaw: number, distance: number) {
    return { x: origin.x - Math.sin(yaw) * distance, y: origin.y, z: origin.z - Math.cos(yaw) * distance };
  }

  // Mobs (só modo Sobrevivência) atingidos por um cast local — instant/área
  // conferem na hora; beam/zone (ver abilities/types.ts) precisam repetir a
  // checagem ao longo do tempo, igual a versão pra jogador em combat.ts.
  function reportMobHits(ability: Ability) {
    const damage = findEffect(ability.effect, "damage");
    if (!damage) return;
    const origin = engine.getLocalTransform();

    if (ability.target.kind === "instant" || ability.target.kind === "area") {
      const reach = ability.target.kind === "instant" ? MELEE_REACH : ability.target.radius;
      for (const mobId of engine.findMobsInRange(origin, reach)) applyMobDamage(mobId, damage.amount);
      return;
    }

    if (ability.target.kind === "beam") {
      const { range, tickMs, durationMs } = ability.target;
      const startedAt = performance.now();
      const interval = setInterval(() => {
        if (performance.now() - startedAt > durationMs) {
          clearInterval(interval);
          return;
        }
        for (const mobId of engine.findMobsInBeam(origin, origin.yaw, range)) applyMobDamage(mobId, damage.amount);
      }, tickMs);
      return;
    }

    if (ability.target.kind === "zone") {
      const { radius, throwDistance, delayMs, tickMs, durationMs } = ability.target;
      const center = pointAhead(origin, origin.yaw, throwDistance);
      const startedAt = performance.now();
      const interval = setInterval(() => {
        const elapsed = performance.now() - startedAt;
        if (elapsed < delayMs) return;
        if (elapsed > delayMs + durationMs) {
          clearInterval(interval);
          return;
        }
        for (const mobId of engine.findMobsInRange(center, radius)) applyMobDamage(mobId, damage.amount);
        if (durationMs === 0) clearInterval(interval);
      }, tickMs);
    }
  }

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
    remotePlayers.delete(peerId);
  });

  sync.onHello(({ characterId: remoteCharacterId }, peerId) => {
    if (!isCharacterId(remoteCharacterId)) return;
    const remoteCharacter: CharacterDef = CHARACTERS[remoteCharacterId];
    engine.setRemotePlayerCharacter(peerId, remoteCharacter.modelUrl, remoteCharacter.color, remoteCharacter.skinTextureUrl, remoteCharacter.outfitUrl);
  });
  sync.onPosition((transform, peerId) => {
    engine.updateRemotePlayer(peerId, transform);
    remotePlayers.set(peerId, { x: transform.x, z: transform.z, alive: transform.alive });
  });
  sync.onCast(({ abilityId, x, y, z, yaw, anim, dmgMult }, casterId) => {
    if (!isAbilityId(abilityId)) return;
    const ability: Ability = ABILITIES[abilityId];
    engine.castAbilityAt(ability, { x, y, z }, yaw);
    engine.playRemoteAnimation(casterId, ability, anim);
    // Empurrão/puxão de "zone" (bomba/lava, ver combat.ts) precisam irradiar
    // do PONTO onde a coisa explodiu, não de onde quem castou tava parado —
    // os dois só coincidem pra instant/area, que explodem em cima de quem castou.
    const pushOrigin =
      ability.target.kind === "zone"
        ? { x: x - Math.sin(yaw) * ability.target.throwDistance, y, z: z - Math.cos(yaw) * ability.target.throwDistance }
        : { x, y, z };
    resolveIncomingCast(ability, { x, y, z }, yaw, () => engine.getLocalTransform(), () => {
      const now = performance.now();
      const wasAlive = !engine.runtime.isDead(now);
      engine.runtime.applyEffect(ability.effect, now, dmgMult ?? 1);
      if (wasAlive && engine.runtime.isDead(now) && match) sync.sendKillCredit({ ack: true }, casterId);

      // Empurrão/puxão são posicionais — resolvidos aqui (quem apanha
      // decide, igual dano), não em AbilityRuntime. Vale pra qualquer
      // habilidade que tenha, não só soco básico.
      if (ability.knockback) engine.applyKnockback(pushOrigin, ability.knockback);
      const pull = findEffect(ability.effect, "pull");
      if (pull) engine.applyPull(pushOrigin, pull.distance);

      // Flash na tela em QUALQUER acerto (antes só soco básico tinha) —
      // levar um corte/bomba/laser sem feedback nenhum além da vida caindo
      // não parecia certo pra uma habilidade que bate em vários ticks
      // (ver "beam"/"zone" em abilities/types.ts).
      hud.flashDamage();

      // Soco/golpe básico conectou em mim — tropeço, e avisa todo mundo (o
      // atacante quer o impacto físico no lugar certo, ver onHitFeedback; os
      // outros só a reação de quem apanhou). Isso aqui é só o "tempero" do
      // combate físico — poderes já têm seu próprio flash/partícula no
      // momento do cast (ver Engine.castAbilityAt).
      if (ability.tier === "basic") {
        engine.playLocalHitReaction();
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
    match?.registerLocalKill();
    if (match) sync.sendScore({ kills: match.getKills(LOCAL_SCORE_KEY) });
  });
  sync.onScore(({ kills }, peerId) => match?.setKills(peerId, kills));

  // Modo Sobrevivência — ver survival.ts pro porquê do host ser dono da
  // simulação dos mobs. Não-host só espelha o que chega; se EU sou o host,
  // ignoro meu próprio eco (já tenho o estado de verdade, ver tickSurvivalHost).
  sync.onSurvivalState(({ wave, phase, mobs }) => {
    if (!survival || room.getIsHost()) return;
    survival.wave = wave;
    survival.phase = phase as SurvivalPhase;
    survival.mobs = mobs.map((m) => ({ ...m, attackReadyAt: 0 }));
    engine.updateMobs(mobs);
  });
  sync.onMobHit(({ mobId, amount }) => {
    if (!survival || !room.getIsHost()) return;
    survival.applyDamage(mobId, amount);
  });
  sync.onMobAttack(({ amount }) => {
    engine.runtime.applyEffect([{ kind: "damage", amount }], performance.now());
  });

  setInterval(() => {
    const now = performance.now();
    sync.sendPosition({
      ...engine.getLocalTransform(),
      alive: !engine.runtime.isDead(now),
      invisible: engine.runtime.isInvisible(now),
      scale: engine.runtime.getScaleFactor(now),
    });
  }, 1000 / POSITION_SYNC_HZ);

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
    if (isGameOver(now) || engine.runtime.isDead(now) || engine.runtime.isStunned(now)) return;

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
    performLocalCast(slot.abilityId, ABILITIES[slot.abilityId]);
  });

  // Botão esquerdo: soco básico (combo, sem custo de energia, cooldown
  // curto por personagem). Botão direito: segurar bloqueia (barra de
  // defesa em AbilityRuntime). Só reage com o mouse travado (mesma trava
  // usada pro olhar em volta) — sem isso o primeiro clique pra travar o
  // mouse já dispararia um soco sem querer.
  window.addEventListener("mousedown", (e) => {
    if (!engine.isPointerLocked()) return;
    const now = performance.now();
    if (isGameOver(now) || engine.runtime.isDead(now)) return;

    if (e.button === 0) {
      if (engine.runtime.isStunned(now)) return;
      const cast = engine.runtime.tryCast(character.basicAttackId, now);
      if (!cast) return;
      performLocalCast(character.basicAttackId, ABILITIES[character.basicAttackId]);
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
