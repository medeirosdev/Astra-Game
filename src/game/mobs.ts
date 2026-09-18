// Tipos de monstro do modo Sobrevivência — mesma filosofia de dados dos
// personagens/habilidades (ver characters.ts/abilities.ts): balancear é
// mexer nesses números, não escrever um monstro novo em código.
export interface MobType {
  id: string;
  name: string;
  health: number;
  damage: number;
  speed: number;
  attackRangeUnits: number;
  attackCooldownMs: number;
  color: string;
  scale: number;
  isBoss?: boolean;
}

export const MOB_TYPES: Record<string, MobType> = {
  sombra: {
    id: "sombra",
    name: "Sombra Rasteira",
    health: 40,
    damage: 8,
    speed: 3.2,
    attackRangeUnits: 1.6,
    attackCooldownMs: 1100,
    color: "#2a1f3d",
    scale: 0.75,
  },
  bruto: {
    id: "bruto",
    name: "Bruto Espinhoso",
    health: 95,
    damage: 15,
    speed: 2.3,
    attackRangeUnits: 2,
    attackCooldownMs: 1400,
    color: "#7a2a1a",
    scale: 1.15,
  },
  chefe: {
    id: "chefe",
    name: "Devorador",
    health: 650,
    damage: 26,
    speed: 2,
    attackRangeUnits: 2.6,
    attackCooldownMs: 1300,
    color: "#4a0a12",
    scale: 2.3,
    isBoss: true,
  },
};

export interface WaveDef {
  mobs: string[]; // ids de MOB_TYPES, um por monstro nessa onda
}

// 5 ondas crescentes de sombras/brutos, depois o chefe sozinho na 6ª.
export const WAVES: WaveDef[] = [
  { mobs: repeat("sombra", 4) },
  { mobs: [...repeat("sombra", 4), ...repeat("bruto", 2)] },
  { mobs: [...repeat("sombra", 5), ...repeat("bruto", 3)] },
  { mobs: [...repeat("sombra", 6), ...repeat("bruto", 4)] },
  { mobs: [...repeat("sombra", 6), ...repeat("bruto", 6)] },
  { mobs: ["chefe"] },
];

function repeat(id: string, count: number): string[] {
  return Array.from({ length: count }, () => id);
}
