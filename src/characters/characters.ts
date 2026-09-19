import type { CharacterDef } from "./types";

// Personagens de teste — validam o loadout de 5 poderes e dão variedade
// de jogo antes de desenhar qualquer personagem de anime de verdade.
export const CHARACTERS = {
  sensei: {
    id: "sensei",
    name: "Sensei",
    color: "#7b5cff",
    modelUrl: "/models/superhero-female.glb",
    outfitUrl: "/models/outfits/Female_Ranger.glb",
    tagline: "Mobilidade e explosão",
    icon: "eye",
    // Inspirado no Gojo Satoru (ver about.md/ROADMAP.md) — vida mais baixa,
    // energia alta, muita mobilidade e dano de explosão em vez de tanque.
    // Guarda baixa (esquiva mais que bloqueia) mas regenera rápido; socos
    // rápidos e fracos, de propósito — mobilidade é o forte dele.
    stats: { health: 90, energy: 120, energyRegenPerSec: 9, moveSpeed: 6.5, guard: 60, guardRegenPerSec: 18 },
    loadout: {
      common: ["toqueVazio", "infinito"],
      strong: ["efluvioRoxo", "piscar"],
      super: "dominioVazio",
    },
    basicAttackId: "senseiSoco",
    // Rajada rápida — 3 golpes curtos alternados, cooldown baixo (ver
    // abilities.ts) já faz o ritmo parecer uma sequência veloz de socos.
    comboAnims: ["Punch_Jab", "Punch_Jab", "Melee_Hook"],
  },
  testador: {
    id: "testador",
    name: "Testador",
    color: "#4fa3ff",
    modelUrl: "/models/superhero-male.glb",
    outfitUrl: "/models/outfits/Male_Peasant.glb",
    tagline: "Equilibrado",
    icon: "bolt",
    stats: { health: 100, energy: 100, energyRegenPerSec: 8, moveSpeed: 6, guard: 80, guardRegenPerSec: 14 },
    loadout: {
      common: ["bolaDeEnergia", "golpeRapido"],
      strong: ["ondaDeChoque", "teleporte"],
      super: "explosaoDefinitiva",
    },
    basicAttackId: "testadorSoco",
    // Jab-jab-cruzado-gancho — combo clássico de boxe, 4 golpes.
    comboAnims: ["Punch_Jab", "Punch_Jab", "Punch_Cross", "Melee_Hook"],
  },
  guardiao: {
    id: "guardiao",
    name: "Guardião",
    color: "#7dffb3",
    modelUrl: "/models/superhero-male.glb",
    outfitUrl: "/models/outfits/Male_Ranger.glb",
    tagline: "Tanque e controle",
    icon: "shield",
    // Guarda alta e regenera devagar — é o tanque, segurar o bloqueio
    // compensa mais nele que nos outros dois.
    stats: { health: 140, energy: 90, energyRegenPerSec: 7, moveSpeed: 5, guard: 130, guardRegenPerSec: 10 },
    loadout: {
      common: ["toqueEletrico", "curaRapida"],
      strong: ["domoDeProtecao", "investidaFeroz"],
      super: "tempestadeDeGelo",
    },
    basicAttackId: "guardiaoSoco",
    // 3 cortes de espada em sequência (A/B/C, cada um um ângulo diferente)
    // fechando com um golpe de cima pra baixo, pesado — combina com o
    // cooldown mais lento dele.
    comboAnims: ["Sword_Regular_A", "Sword_Regular_B", "Sword_Regular_C", "OverhandThrow"],
  },
  johnKaisen: {
    id: "johnKaisen",
    name: "John Kaisen",
    color: "#5b2a8c",
    modelUrl: "/models/superhero-male.glb",
    outfitUrl: "/models/outfits/Male_Ranger.glb",
    tagline: "Vazio, espaço e tempo",
    icon: "void",
    // Mago de controle à distância — não quer chegar perto: puxa o
    // inimigo pra ele (Ruptura do Espaço) em vez de ir até ele, fica
    // invisível pra escapar/reposicionar (Passo Fantasma) e ganha
    // velocidade no meio do próprio dano em área (Ruptura do Tempo).
    stats: { health: 95, energy: 115, energyRegenPerSec: 8, moveSpeed: 6.2, guard: 70, guardRegenPerSec: 15 },
    loadout: {
      common: ["rupturaDoVazio", "passoFantasma"],
      strong: ["rupturaDoEspaco", "rupturaDoTempo"],
      super: "expansaoDeDominio",
    },
    basicAttackId: "johnKaisenSoco",
    comboAnims: ["Sword_Regular_B", "Melee_Hook", "Sword_Regular_A"],
  },
  ronnie: {
    id: "ronnie",
    name: "Ronnie",
    color: "#c94b2b",
    modelUrl: "/models/superhero-male.glb",
    outfitUrl: "/models/outfits/Male_Peasant.glb",
    tagline: "Fúria e terremotos",
    icon: "quake",
    // Brigão bruto — nada de magia sofisticada: dano físico alto, uma
    // fúria que aumenta dano E velocidade juntos, e dois jeitos de sacudir
    // o chão (terremoto em área, choque sísmico que empurra todo mundo).
    stats: { health: 120, energy: 95, energyRegenPerSec: 7.5, moveSpeed: 5.5, guard: 100, guardRegenPerSec: 11 },
    loadout: {
      common: ["ronnieAtaqueBasico", "ativaRage"],
      strong: ["superTerremoto", "puloMortal"],
      super: "choqueSismico",
    },
    basicAttackId: "ronnieSoco",
    comboAnims: ["Melee_Hook", "Punch_Cross", "OverhandThrow"],
  },
  johnDoe: {
    id: "johnDoe",
    name: "John Doe",
    color: "#ff4d1a",
    modelUrl: "/models/superhero-male.glb",
    outfitUrl: "/models/outfits/Male_Ranger.glb",
    tagline: "Laser e demolição",
    icon: "target",
    // Artilheiro puro — nada de corpo a corpo de verdade, o kit inteiro é
    // colocar dano à distância no chão (raio contínuo, bomba, lava, ataque
    // orbital) e só entrar em risco perto de alguém no Modo Titã, quando já
    // bate mais forte também (damageBuff junto do giant, ver abilities.ts).
    stats: { health: 95, energy: 120, energyRegenPerSec: 8, moveSpeed: 5.8, guard: 75, guardRegenPerSec: 13 },
    loadout: {
      common: ["raioLaserContinuo", "bombaRelogio"],
      strong: ["caixaDeLava", "raioOrbital"],
      super: "modoTitan",
    },
    basicAttackId: "johnDoeTiro",
    // Gesto de atirar (a "arma" é o próprio raio saindo da mão) em vez de
    // soco — combina com o resto do kit ser tudo à distância.
    comboAnims: ["Pistol_Shoot", "Pistol_Shoot"],
  },
} satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;

// Mesma lógica de isAbilityId: id de personagem vindo de outro peer não é confiável.
export function isCharacterId(value: string): value is CharacterId {
  return value in CHARACTERS;
}
