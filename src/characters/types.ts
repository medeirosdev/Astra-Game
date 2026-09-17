import type { AbilityId } from "../abilities/abilities";

export interface CharacterStats {
  health: number;
  energy: number;
  energyRegenPerSec: number;
  moveSpeed: number;
}

// Loadout fixo: 2 comuns, 2 fortes, 1 super (definitiva).
export interface CharacterLoadout {
  common: [AbilityId, AbilityId];
  strong: [AbilityId, AbilityId];
  super: AbilityId;
}

export interface CharacterDef {
  id: string;
  name: string;
  color: string;
  modelUrl: string;
  stats: CharacterStats;
  loadout: CharacterLoadout;
}
