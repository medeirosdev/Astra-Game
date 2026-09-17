import { joinRoom } from "trystero/torrent";

const APP_ID = "astra-game";

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function connectToRoom(code: string) {
  // relayRedundancy: 4 usa os 4 trackers públicos padrão do Trystero, não só os
  // 3 primeiros — um deles (tracker.btorrent.xyz) está fora do ar (testado e
  // confirmado), então por padrão 1 de cada 3 tentativas já nasce morta.
  return joinRoom({ appId: APP_ID, relayRedundancy: 4 }, code);
}

export type GameRoom = ReturnType<typeof connectToRoom>;
