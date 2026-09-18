export interface MapPreset {
  name: string;
  // Prefixo em public/textures/ (ver CREDITS.txt) pro material do chão.
  groundTexture: string;
  wallColor: number;
  obstacleColor: number;
  backgroundColor: number;
}

export const MAP_PRESETS: MapPreset[] = [
  {
    name: "Abismo Noturno",
    groundTexture: "abyss",
    wallColor: 0x1b2338,
    obstacleColor: 0x4a3728,
    backgroundColor: 0x0a0a12,
  },
  {
    name: "Deserto Crestado",
    groundTexture: "desert",
    wallColor: 0x3a2818,
    obstacleColor: 0x8a6a3a,
    backgroundColor: 0x1c130a,
  },
  {
    name: "Gelo Eterno",
    groundTexture: "ice",
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
