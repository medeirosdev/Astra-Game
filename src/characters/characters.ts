import type { CharacterDef } from "./types";

// Personagem de teste — valida o loadout de 5 poderes antes de desenhar
// qualquer personagem de anime de verdade.
export const CHARACTERS: Record<string, CharacterDef> = {
  testador: {
    id: "testador",
    name: "Testador",
    color: "#4fa3ff",
    stats: { health: 100, energy: 100, energyRegenPerSec: 8, moveSpeed: 6 },
    loadout: {
      common: ["bolaDeEnergia", "golpeRapido"],
      strong: ["ondaDeChoque", "passoRapido"],
      super: "explosaoDefinitiva",
    },
  },
};
