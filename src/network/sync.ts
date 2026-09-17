import type { GameRoom } from "./room";

export interface PositionPayload {
  x: number;
  y: number;
  z: number;
  [key: string]: number;
}

export interface CastPayload {
  abilityId: string;
  x: number;
  y: number;
  z: number;
  [key: string]: string | number;
}

export interface HelloPayload {
  characterId: string;
  [key: string]: string;
}

// Cor neutra usada até o "hello" do peer chegar dizendo qual personagem ele escolheu.
export const PLACEHOLDER_COLOR = "#888888";

// Ações da sala: posição do jogador e cast de habilidade, replicadas pra
// todo peer conectado. Dano real (ver about.md) ainda depende de um dono da
// partida decidir o resultado — aqui só propaga o que já foi decidido localmente.
export function setupSync(room: GameRoom) {
  const [sendPosition, onPosition] = room.makeAction<PositionPayload>("pos");
  const [sendCast, onCast] = room.makeAction<CastPayload>("cast");
  const [sendHello, onHello] = room.makeAction<HelloPayload>("hello");
  return { sendPosition, onPosition, sendCast, onCast, sendHello, onHello };
}
