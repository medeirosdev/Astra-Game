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

// Ações da sala: posição do jogador e cast de habilidade, replicadas pra
// todo peer conectado. Dano real (ver about.md) ainda depende de um dono da
// partida decidir o resultado — aqui só propaga o que já foi decidido localmente.
export function setupSync(room: GameRoom) {
  const [sendPosition, onPosition] = room.makeAction<PositionPayload>("pos");
  const [sendCast, onCast] = room.makeAction<CastPayload>("cast");
  return { sendPosition, onPosition, sendCast, onCast };
}

// Cor estável por peer, só pra distinguir jogadores remotos até existir
// seleção de personagem de verdade (ver ROADMAP.md, Fase 6).
export function colorForPeer(peerId: string): string {
  let hash = 0;
  for (let i = 0; i < peerId.length; i++) {
    hash = (hash * 31 + peerId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}
