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
    wallColor: 0x2a3550,
    obstacleColor: 0x5a4535,
    // Continua o mais escuro dos 3 (é literalmente "noturno") mas não mais
    // preto puro — preto puro engolia toda a luz ambiente/sol (ver
    // setupLights), tava escuro DEMAIS mesmo pro tema pedir isso.
    backgroundColor: 0x1c2038,
  },
  {
    name: "Deserto Crestado",
    groundTexture: "desert",
    wallColor: 0x4a3420,
    obstacleColor: 0x9a7a4a,
    // Deserto é sol escaldante, não breu — neblina/fundo clara e quente.
    backgroundColor: 0x9c7a52,
  },
  {
    name: "Gelo Eterno",
    groundTexture: "ice",
    wallColor: 0x2a4550,
    obstacleColor: 0x6a8a9a,
    // Dia nublado claro, não noite — neblina azulada bem mais clara.
    backgroundColor: 0xa8bcc9,
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
