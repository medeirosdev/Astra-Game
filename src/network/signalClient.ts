type IncomingMessage =
  | { type: "joined"; selfId: string; peers: string[] }
  | { type: "peer-joined"; peerId: string }
  | { type: "peer-left"; peerId: string }
  | { type: "signal"; from: string; data: unknown };

// Fala com o servidor de sinalização próprio (server/index.js). Só troca
// offer/answer/ICE entre peers da mesma sala — não carrega o jogo em si.
export class SignalClient {
  private readonly ws: WebSocket;

  onJoined: (selfId: string, existingPeers: string[]) => void = () => {};
  onPeerJoined: (peerId: string) => void = () => {};
  onPeerLeft: (peerId: string) => void = () => {};
  onSignal: (fromPeerId: string, data: unknown) => void = () => {};

  constructor(url: string, roomCode: string) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener("open", () => {
      this.ws.send(JSON.stringify({ type: "join", room: roomCode }));
    });
    this.ws.addEventListener("message", (event) => {
      let msg: IncomingMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "joined") this.onJoined(msg.selfId, msg.peers);
      else if (msg.type === "peer-joined") this.onPeerJoined(msg.peerId);
      else if (msg.type === "peer-left") this.onPeerLeft(msg.peerId);
      else if (msg.type === "signal") this.onSignal(msg.from, msg.data);
    });
  }

  sendSignal(to: string, data: unknown) {
    this.ws.send(JSON.stringify({ type: "signal", to, data }));
  }
}
