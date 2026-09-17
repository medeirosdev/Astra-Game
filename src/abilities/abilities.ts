import type { Ability } from "./types";

// Poderes de teste (personagem genérico) — só pra validar o sistema.
// Poderes de anime de verdade entram aqui depois, como novas receitas.
export const ABILITIES = {
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
  rajadaDeGelo: {
    id: "rajadaDeGelo",
    name: "Rajada de Gelo",
    tier: "common",
    cost: 15,
    cooldownMs: 4000,
    target: { kind: "projectile", speed: 20 },
    effect: { kind: "slow", factor: 0.5, durationMs: 2000 },
    vfx: { color: "#8fe8ff", particle: "frost", sound: "chill" },
  },
  curaRapida: {
    id: "curaRapida",
    name: "Cura Rápida",
    tier: "common",
    cost: 25,
    cooldownMs: 5000,
    target: { kind: "self" },
    effect: { kind: "heal", amount: 20 },
    vfx: { color: "#7dffb3", particle: "glow", sound: "chime" },
  },
  toqueEletrico: {
    id: "toqueEletrico",
    name: "Toque Elétrico",
    tier: "common",
    cost: 15,
    cooldownMs: 4000,
    target: { kind: "instant" },
    effect: { kind: "stun", durationMs: 700 },
    vfx: { color: "#f7ff5c", particle: "spark", sound: "zap" },
  },
  investidaFeroz: {
    id: "investidaFeroz",
    name: "Investida Feroz",
    tier: "strong",
    cost: 30,
    cooldownMs: 7000,
    target: { kind: "self" },
    effect: { kind: "speedBuff", factor: 2, durationMs: 1500 },
    vfx: { color: "#ff9d4f", particle: "trail", sound: "dash" },
  },
  domoDeProtecao: {
    id: "domoDeProtecao",
    name: "Domo de Proteção",
    tier: "strong",
    cost: 45,
    cooldownMs: 10000,
    target: { kind: "self" },
    effect: { kind: "heal", amount: 45 },
    vfx: { color: "#9ad1ff", particle: "shield", sound: "hum" },
  },
  meteoro: {
    id: "meteoro",
    name: "Meteoro",
    tier: "super",
    cost: 90,
    cooldownMs: 40000,
    target: { kind: "projectile", speed: 18 },
    effect: { kind: "damage", amount: 90 },
    vfx: { color: "#ff6b3b", particle: "nova", sound: "boom" },
  },
  tempestadeDeGelo: {
    id: "tempestadeDeGelo",
    name: "Tempestade de Gelo",
    tier: "super",
    cost: 85,
    cooldownMs: 40000,
    target: { kind: "area", radius: 8 },
    effect: { kind: "slow", factor: 0.3, durationMs: 4000 },
    vfx: { color: "#c9f2ff", particle: "frost", sound: "windgust" },
  },
} satisfies Record<string, Ability>;

export type AbilityId = keyof typeof ABILITIES;

// Dados vindos de outro peer não são confiáveis — usar antes de indexar ABILITIES
// com um abilityId recebido pela rede (ver skill "review", seção DOM e segurança).
export function isAbilityId(value: string): value is AbilityId {
  return value in ABILITIES;
}
