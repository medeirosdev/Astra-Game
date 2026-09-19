// Sistema de cartas — baú dá uma carta de raridade aleatória, cada carta
// soma um % de dano permanente (acumula com outras) até você morrer, hora
// que perde todas de uma vez (ver AbilityRuntime.applyCard/clearCards).
export type CardRarity = "comum" | "rara" | "mitica" | "lendaria";

export const CARD_BONUS: Record<CardRarity, number> = {
  comum: 0.05,
  rara: 0.1,
  mitica: 0.15,
  lendaria: 0.2,
};

export const CARD_COLOR: Record<CardRarity, string> = {
  comum: "#c9c9c9",
  rara: "#4fa3ff",
  mitica: "#b455ff",
  lendaria: "#ffb84d",
};

export const CARD_LABEL: Record<CardRarity, string> = {
  comum: "Comum",
  rara: "Rara",
  mitica: "Mítica",
  lendaria: "Lendária",
};

// Peso relativo pro sorteio ao abrir um baú — soma 100, então dá pra ler
// direto como "55% de chance" etc.
const CARD_WEIGHTS: [CardRarity, number][] = [
  ["comum", 55],
  ["rara", 30],
  ["mitica", 12],
  ["lendaria", 3],
];

export function rollCardRarity(): CardRarity {
  const total = CARD_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of CARD_WEIGHTS) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return "comum";
}
