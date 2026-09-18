import type { AbilityId } from "../abilities/abilities";

export interface CharacterStats {
  health: number;
  energy: number;
  energyRegenPerSec: number;
  moveSpeed: number;
  // Barra de defesa — absorve dano enquanto o jogador segura o botão
  // direito do mouse (bloqueio), regenera quando solta (ver AbilityRuntime).
  guard: number;
  guardRegenPerSec: number;
}

// Loadout fixo: 2 comuns, 2 fortes, 1 super (definitiva).
export interface CharacterLoadout {
  common: [AbilityId, AbilityId];
  strong: [AbilityId, AbilityId];
  super: AbilityId;
}

// Puramente visual (tela de seleção de personagem) — qual ícone/frase
// aparece no card. Fica em CharacterDef porque é "dado do personagem", mas
// o desenho do ícone em si é responsabilidade da UI (src/ui/menu.ts).
export type CharacterIcon = "eye" | "bolt" | "shield";

export interface CharacterDef {
  id: string;
  name: string;
  color: string;
  modelUrl: string;
  tagline: string;
  icon: CharacterIcon;
  stats: CharacterStats;
  loadout: CharacterLoadout;
  // Soco/golpe do botão esquerdo do mouse — é só mais uma receita de
  // habilidade (tier "basic", custo 0), fora dos 5 slots.
  basicAttackId: AbilityId;
  // Ciclo de animações do combo do soco básico — nomes de clipe da
  // biblioteca de animação (ver public/models/CREDITS.txt). Cada
  // personagem tem o próprio estilo (socos rápidos, golpe pesado, etc);
  // sem VFX de poder nele de propósito, é ataque físico, não mágico.
  comboAnims: string[];
}
