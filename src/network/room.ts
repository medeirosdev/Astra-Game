import { joinRoom } from "trystero/torrent";

const APP_ID = "astra-game";

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function connectToRoom(code: string) {
  return joinRoom({ appId: APP_ID }, code);
}

export type GameRoom = ReturnType<typeof connectToRoom>;
