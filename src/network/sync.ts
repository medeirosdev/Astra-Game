import type { GameRoom } from "./room";

export interface PositionPayload {
  x: number;
  y: number;
  z: number;
  yaw: number;
  alive: boolean;
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
  };
}
