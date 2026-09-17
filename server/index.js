import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT) || 8787;
const MAX_ROOM_CODE_LENGTH = 20;

// Sala -> Map<peerId, WebSocket>. Servidor só troca offer/answer/ICE entre
// os peers da mesma sala (sinalização) — depois disso o jogo fala direto
// peer-a-peer por WebRTC, sem passar mais por aqui (ver about.md/ROADMAP.md).
const rooms = new Map();

const wss = new WebSocketServer({ port: PORT });

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(room, message, exceptPeerId) {
  for (const [peerId, ws] of room) {
    if (peerId !== exceptPeerId) send(ws, message);
  }
}

wss.on("connection", (ws) => {
  const peerId = randomUUID();
  let roomCode = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join" && typeof msg.room === "string") {
      roomCode = msg.room.slice(0, MAX_ROOM_CODE_LENGTH).toUpperCase();
      const room = rooms.get(roomCode) ?? new Map();
      rooms.set(roomCode, room);

      const existingPeers = [...room.keys()];
      room.set(peerId, ws);

      send(ws, { type: "joined", selfId: peerId, peers: existingPeers });
      broadcast(room, { type: "peer-joined", peerId }, peerId);
      return;
    }

    if (msg.type === "signal" && roomCode && typeof msg.to === "string") {
      const room = rooms.get(roomCode);
      const target = room?.get(msg.to);
      if (target) send(target, { type: "signal", from: peerId, data: msg.data });
    }
  });

  ws.on("close", () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.delete(peerId);
    broadcast(room, { type: "peer-left", peerId }, peerId);
    if (room.size === 0) rooms.delete(roomCode);
  });
});

console.log(`[astra-signal] ouvindo na porta ${PORT}`);
