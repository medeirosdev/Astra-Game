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
  };
}
