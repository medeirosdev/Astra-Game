export interface CharacterStats {
  health: number;
  energy: number;
  energyRegenPerSec: number;
  moveSpeed: number;
}

// Loadout fixo: 2 comuns, 2 fortes, 1 super (definitiva).
export interface CharacterLoadout {
  common: [string, string];
  strong: [string, string];
  super: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  color: string;
  stats: CharacterStats;
  loadout: CharacterLoadout;
}
