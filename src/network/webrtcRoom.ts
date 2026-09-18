import { SignalClient } from "./signalClient";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

interface PeerLink {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  pendingCandidates: RTCIceCandidateInit[];
}

type ActionHandler = (data: unknown, peerId: string) => void;

export interface WebrtcRoom {
  onPeerJoin(fn: (peerId: string) => void): void;
  onPeerLeave(fn: (peerId: string) => void): void;
  makeAction<T>(namespace: string): [(data: T, targetPeerId?: string) => void, (handler: (data: T, peerId: string) => void) => void];
  getPeers(): Record<string, RTCPeerConnection>;
  // ID que o servidor de sinalização atribuiu a mim nessa sala — null até o
  // "joined" chegar. Usado pra distinguir "esse hit foi em mim" de "foi em
  // outro peer" quando a rede espalha um evento pra todo mundo (ver
  // main.ts, feedback de acerto de soco).
  getSelfId(): string | null;
  // Verdade se eu era o único na sala no instante em que entrei — usado pra
  // decidir quem é "dono" da simulação dos mobs no modo Sobrevivência (ver
  // src/game/survival.ts). Não é um conceito novo de host-autoritativo pro
  // jogo todo, só pros mobs — jogador contra jogador continua "quem recebe
  // decide" (ver about.md).
  getIsHost(): boolean;
}

// Sala P2P de verdade: o servidor de sinalização só serve pra trocar
// offer/answer/ICE (ver server/index.js). Uma vez conectados, os dados do
// jogo (posição, cast, hello) viajam direto entre os navegadores via
// RTCDataChannel — igual à decisão original em about.md, só sem depender
// mais de tracker público pra se encontrarem.
export function connectSignalingRoom(url: string, roomCode: string): WebrtcRoom {
  const signal = new SignalClient(url, roomCode);
  const peers = new Map<string, PeerLink>();
  const handlersByNs = new Map<string, ActionHandler[]>();
  let selfId: string | null = null;
  let isHost = false;
  signal.onJoined = (id, existingPeers) => {
    selfId = id;
    isHost = existingPeers.length === 0;
  };

  let joinListener: (peerId: string) => void = () => {};
  let leaveListener: (peerId: string) => void = () => {};

  function dispatch(ns: string, data: unknown, peerId: string) {
    handlersByNs.get(ns)?.forEach((handler) => handler(data, peerId));
  }

  function wireChannel(peerId: string, link: PeerLink, channel: RTCDataChannel) {
    link.channel = channel;
    channel.addEventListener("open", () => joinListener(peerId));
    channel.addEventListener("close", () => {
      peers.delete(peerId);
      leaveListener(peerId);
    });
    channel.addEventListener("message", (event) => {
      try {
        const { ns, data } = JSON.parse(event.data);
        dispatch(ns, data, peerId);
      } catch {
        // mensagem malformada vinda de outro peer — dado não confiável, ignora.
      }
    });
  }

  function createPeerLink(peerId: string, initiator: boolean): PeerLink {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const link: PeerLink = { pc, channel: null, pendingCandidates: [] };
    peers.set(peerId, link);

    pc.addEventListener("icecandidate", (event) => {
      if (event.candidate) signal.sendSignal(peerId, { candidate: event.candidate.toJSON() });
    });

    if (initiator) {
      wireChannel(peerId, link, pc.createDataChannel("astra"));
    } else {
      pc.addEventListener("datachannel", (event) => wireChannel(peerId, link, event.channel));
    }

    return link;
  }

  async function startOffer(peerId: string) {
    const link = createPeerLink(peerId, true);
    const offer = await link.pc.createOffer();
    await link.pc.setLocalDescription(offer);
    signal.sendSignal(peerId, { sdp: offer });
  }

  async function flushPendingCandidates(link: PeerLink) {
    for (const candidate of link.pendingCandidates) await link.pc.addIceCandidate(candidate);
    link.pendingCandidates = [];
  }

  async function handleRemoteSdp(peerId: string, sdp: RTCSessionDescriptionInit) {
    if (sdp.type === "offer") {
      const link = createPeerLink(peerId, false);
      await link.pc.setRemoteDescription(sdp);
      await flushPendingCandidates(link);
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      signal.sendSignal(peerId, { sdp: answer });
    } else if (sdp.type === "answer") {
      const link = peers.get(peerId);
      if (!link) return;
      await link.pc.setRemoteDescription(sdp);
      await flushPendingCandidates(link);
    }
  }

  function handleRemoteCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const link = peers.get(peerId);
    if (!link) return;
    if (link.pc.remoteDescription) link.pc.addIceCandidate(candidate);
    else link.pendingCandidates.push(candidate);
  }

  // Quem já estava na sala oferece pro recém-chegado; o recém-chegado só espera.
  signal.onPeerJoined = (peerId) => void startOffer(peerId);
  signal.onPeerLeft = (peerId) => {
    peers.get(peerId)?.pc.close();
    peers.delete(peerId);
    leaveListener(peerId);
  };
  signal.onSignal = (peerId, raw) => {
    const data = raw as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    if (data.sdp) void handleRemoteSdp(peerId, data.sdp);
    else if (data.candidate) handleRemoteCandidate(peerId, data.candidate);
  };

  // Sem checagem de tipo real por mensagem — o formato de cada namespace é
  // garantido por quem chama makeAction<T>, não pelo transporte em si.
  const makeAction: WebrtcRoom["makeAction"] = ((ns: string) => {
    const sendAction = (data: unknown, targetPeerId?: string) => {
      const payload = JSON.stringify({ ns, data });
      if (targetPeerId) {
        const link = peers.get(targetPeerId);
        if (link?.channel?.readyState === "open") link.channel.send(payload);
        return;
      }
      for (const link of peers.values()) {
        if (link.channel?.readyState === "open") link.channel.send(payload);
      }
    };
    const onReceive = (handler: ActionHandler) => {
      const list = handlersByNs.get(ns) ?? [];
      list.push(handler);
      handlersByNs.set(ns, list);
    };
    return [sendAction, onReceive];
  }) as WebrtcRoom["makeAction"];

  return {
    onPeerJoin: (fn) => {
      joinListener = fn;
    },
    onPeerLeave: (fn) => {
      leaveListener = fn;
    },
    makeAction,
    getPeers: () => {
      const result: Record<string, RTCPeerConnection> = {};
      for (const [id, link] of peers) result[id] = link.pc;
      return result;
    },
    getSelfId: () => selfId,
    getIsHost: () => isHost,
  };
}
