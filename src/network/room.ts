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
//
// A URL usa a MESMA origem da página (protocolo + host), não uma porta fixa
// — o Vite faz proxy de /signal pra porta 8787 (ver vite.config.ts). Isso é
// o que permite expor o jogo por um túnel só (ngrok/cloudflared): a porta
// 8787 nunca precisa ficar acessível de fora, só a 5173.
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const SIGNAL_URL = `${wsProtocol}//${window.location.host}/signal`;

export function connectToRoom(code: string): WebrtcRoom {
  return connectSignalingRoom(SIGNAL_URL, code);
}

export type GameRoom = WebrtcRoom;
