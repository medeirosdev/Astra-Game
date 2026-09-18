export interface MapPreset {
  name: string;
  groundColorA: number;
  groundColorB: number;
  wallColor: number;
  obstacleColor: number;
  backgroundColor: number;
}

export const MAP_PRESETS: MapPreset[] = [
  {
    name: "Abismo Noturno",
    groundColorA: 0x2b3a55,
    groundColorB: 0x24314a,
    wallColor: 0x1b2338,
    obstacleColor: 0x4a3728,
    backgroundColor: 0x0a0a12,
  },
  {
    name: "Deserto Crestado",
    groundColorA: 0x6b4a2b,
    groundColorB: 0x5c3f24,
    wallColor: 0x3a2818,
    obstacleColor: 0x8a6a3a,
    backgroundColor: 0x1c130a,
  },
  {
    name: "Gelo Eterno",
    groundColorA: 0x3a5a6b,
    groundColorB: 0x2f4a58,
    wallColor: 0x1f3540,
    obstacleColor: 0x5a7a8a,
    backgroundColor: 0x0a1418,
  },
];

// Cada sala precisa do mesmo mapa nos dois lados sem trocar mensagem pra
// isso — o código da sala já é compartilhado (é como as duas pontas se
// encontram, ver network/room.ts), então derivar o mapa dele garante que
// host e convidado cheguem sozinhos na mesma escolha.
export function pickMapPreset(roomCode: string): MapPreset {
  let hash = 0;
  for (let i = 0; i < roomCode.length; i++) hash = (hash * 31 + roomCode.charCodeAt(i)) >>> 0;
  return MAP_PRESETS[hash % MAP_PRESETS.length];
}
