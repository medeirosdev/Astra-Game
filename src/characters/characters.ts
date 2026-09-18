import type { CharacterDef } from "./types";

// Personagens de teste — validam o loadout de 5 poderes e dão variedade
// de jogo antes de desenhar qualquer personagem de anime de verdade.
export const CHARACTERS = {
  sensei: {
    id: "sensei",
    name: "Sensei",
    color: "#7b5cff",
    modelUrl: "/models/character-q.glb",
    // Inspirado no Gojo Satoru (ver about.md/ROADMAP.md) — vida mais baixa,
    // energia alta, muita mobilidade e dano de explosão em vez de tanque.
    stats: { health: 90, energy: 120, energyRegenPerSec: 9, moveSpeed: 6.5 },
    loadout: {
      common: ["toqueVazio", "infinito"],
      strong: ["efluvioRoxo", "piscar"],
      super: "dominioVazio",
    },
  },
  testador: {
    id: "testador",
    name: "Testador",
    color: "#4fa3ff",
    modelUrl: "/models/character-j.glb",
    stats: { health: 100, energy: 100, energyRegenPerSec: 8, moveSpeed: 6 },
    loadout: {
      common: ["bolaDeEnergia", "golpeRapido"],
      strong: ["ondaDeChoque", "teleporte"],
      super: "explosaoDefinitiva",
    },
  },
  guardiao: {
    id: "guardiao",
    name: "Guardião",
    color: "#7dffb3",
    modelUrl: "/models/character-l.glb",
    stats: { health: 140, energy: 90, energyRegenPerSec: 7, moveSpeed: 5 },
    loadout: {
      common: ["toqueEletrico", "curaRapida"],
      strong: ["domoDeProtecao", "investidaFeroz"],
      super: "tempestadeDeGelo",
    },
  },
} satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;

// Mesma lógica de isAbilityId: id de personagem vindo de outro peer não é confiável.
export function isCharacterId(value: string): value is CharacterId {
  return value in CHARACTERS;
}
