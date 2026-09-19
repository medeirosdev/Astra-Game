import type { GameRoom } from "./room";

export interface PositionPayload {
  x: number;
  y: number;
  z: number;
  yaw: number;
  alive: boolean;
  // "Passo Fantasma" (ver characters.ts) — invisível pros OUTROS peers,
  // esconde o avatar remoto por completo (eu mesmo ainda me vejo, semi
  // transparente, ver Engine.setLocalInvisible).
  invisible: boolean;
  // Tamanho do modelo (1 = normal) — "Modo Titã" (ver characters.ts) usa
  // isso pros OUTROS peers me verem grande também, não só eu.
  scale?: number;
}

export interface CastPayload {
  abilityId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  // Qual animação tocar — necessário pro soco básico (tier "basic"), cujo
  // clipe alterna em combo e não dá pra derivar só do abilityId. Ausente
  // pras outras habilidades, que usam a animação padrão do target.kind.
  anim?: string;
  // Multiplicador de dano de quem castou (ver "damageBuff" em
  // abilities/types.ts) — quem decide o valor final do dano é sempre quem
  // apanha, então o buff do atacante precisa viajar junto. Ausente (= 1x)
  // na maioria dos casts.
  dmgMult?: number;
}

export interface HelloPayload {
  characterId: string;
}

// Vazio de propósito — quem manda importa mais que o conteúdo. Ver
// src/main.ts: mandado pro peer que me matou, pra ele creditar o abate.
export interface KillCreditPayload {
  ack: true;
}

export interface ScorePayload {
  kills: number;
}

// Mandado (broadcast) por quem acabou de apanhar de um soco/golpe básico —
// carrega quem bateu (attackerId) e onde o acerto aconteceu, pra: (1) o
// atacante saber que conectou de verdade e mostrar o impacto físico
// (poeira/tremor/hit-stop) no lugar certo, (2) todo mundo ver a animação de
// reação de quem apanhou, não só o alvo e o atacante.
export interface HitFeedbackPayload {
  attackerId: string;
  x: number;
  y: number;
  z: number;
}

// Cor neutra usada até o "hello" do peer chegar dizendo qual personagem ele escolheu.
export const PLACEHOLDER_COLOR = "#888888";

// Modo Sobrevivência (ver src/game/survival.ts) — só o host da sala manda
// mobState (broadcast, ~10Hz) e mobAttack (mandado direto pra quem apanhou);
// qualquer peer manda mobHit direto pro host quando acha que acertou um mob.
export interface MobSnapshot {
  id: string;
  typeId: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  alive: boolean;
}

export interface SurvivalStatePayload {
  wave: number;
  totalWaves: number;
  phase: string;
  mobs: MobSnapshot[];
}

export interface MobHitPayload {
  mobId: string;
  amount: number;
}

export interface MobAttackPayload {
  amount: number;
}

// Ações da sala: posição+direção do jogador e cast de habilidade, replicadas
// pra todo peer conectado. Quem decide se um cast acertou é sempre o alvo
// (ver AbilityRuntime.ts) — aqui só propaga o que já foi decidido localmente.
export function setupSync(room: GameRoom) {
  const [sendPosition, onPosition] = room.makeAction<PositionPayload>("pos");
  const [sendCast, onCast] = room.makeAction<CastPayload>("cast");
  const [sendHello, onHello] = room.makeAction<HelloPayload>("hello");
  const [sendKillCredit, onKillCredit] = room.makeAction<KillCreditPayload>("kill");
  const [sendScore, onScore] = room.makeAction<ScorePayload>("score");
  const [sendHitFeedback, onHitFeedback] = room.makeAction<HitFeedbackPayload>("hit");
  const [sendSurvivalState, onSurvivalState] = room.makeAction<SurvivalStatePayload>("survivalState");
  const [sendMobHit, onMobHit] = room.makeAction<MobHitPayload>("mobHit");
  const [sendMobAttack, onMobAttack] = room.makeAction<MobAttackPayload>("mobAttack");
  return {
    sendPosition,
    onPosition,
    sendCast,
    onCast,
    sendHello,
    onHello,
    sendKillCredit,
    onKillCredit,
    sendScore,
    onScore,
    sendHitFeedback,
    onHitFeedback,
    sendSurvivalState,
    onSurvivalState,
    sendMobHit,
    onMobHit,
    sendMobAttack,
    onMobAttack,
  };
}
