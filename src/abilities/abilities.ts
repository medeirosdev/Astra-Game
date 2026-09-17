import type { Ability } from "./types";

// Poderes de teste (personagem genérico) — só pra validar o sistema.
// Poderes de anime de verdade entram aqui depois, como novas receitas.
export const ABILITIES: Record<string, Ability> = {
  bolaDeEnergia: {
    id: "bolaDeEnergia",
    name: "Bola de Energia",
    tier: "common",
    cost: 20,
    cooldownMs: 3000,
    target: { kind: "projectile", speed: 25 },
    effect: { kind: "damage", amount: 25 },
    vfx: { color: "#4fa3ff", particle: "spark", sound: "whoosh" },
  },
  golpeRapido: {
    id: "golpeRapido",
    name: "Golpe Rápido",
    tier: "common",
    cost: 10,
    cooldownMs: 1500,
    target: { kind: "instant" },
    effect: { kind: "damage", amount: 12 },
    vfx: { color: "#ffffff", sound: "hit" },
  },
  ondaDeChoque: {
    id: "ondaDeChoque",
    name: "Onda de Choque",
    tier: "strong",
    cost: 40,
    cooldownMs: 8000,
    target: { kind: "area", radius: 5 },
    effect: { kind: "stun", durationMs: 1200 },
    vfx: { color: "#ffb347", particle: "shock" },
  },
  passoRapido: {
    id: "passoRapido",
    name: "Passo Rápido",
    tier: "strong",
    cost: 15,
    cooldownMs: 6000,
    target: { kind: "self" },
    effect: { kind: "speedBuff", factor: 1.5, durationMs: 2000 },
    vfx: { color: "#7dffb3", particle: "trail" },
  },
  explosaoDefinitiva: {
    id: "explosaoDefinitiva",
    name: "Explosão Definitiva",
    tier: "super",
    cost: 100,
    cooldownMs: 45000,
    target: { kind: "area", radius: 10 },
    effect: { kind: "damage", amount: 80 },
    vfx: { color: "#ff3b3b", particle: "nova", sound: "boom" },
  },
};
