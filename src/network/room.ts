import { connectSignalingRoom, type WebrtcRoom } from "./webrtcRoom";

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Servidor de sinalização próprio (server/index.js) — os trackers públicos do
// WebTorrent (usados antes via Trystero) se mostraram frágeis demais na
// prática (metade fora do ar) pra depender deles. O jogo em si continua P2P
// direto por WebRTC; só a etapa de "se encontrar" passa por aqui agora.
const SIGNAL_PORT = 8787;
const SIGNAL_URL = `ws://${window.location.hostname}:${SIGNAL_PORT}`;

export function connectToRoom(code: string): WebrtcRoom {
  return connectSignalingRoom(SIGNAL_URL, code);
}

export type GameRoom = WebrtcRoom;
