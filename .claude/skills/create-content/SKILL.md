---
name: create-content
description: Cria conteúdo novo para o Astra seguindo os padrões do projeto — poder/habilidade, personagem, ou modo de jogo. Use quando o pedido for "adiciona um poder", "cria um personagem", "novo personagem baseado em X", etc.
---

# Criar conteúdo — Astra

Este projeto foi desenhado (ver `about.md`) pra que conteúdo novo seja **dado**, não código novo. Siga o padrão abaixo em vez de inventar uma estrutura nova.

## Adicionar uma habilidade

Entra em `src/abilities/abilities.ts`, seguindo o tipo `Ability` de `src/abilities/types.ts`. Toda habilidade tem:

- `tier`: `"common" | "strong" | "super"` — decide a faixa de valores, não muda a forma do objeto.
- `target`: `projectile` (viaja e acerta), `area` (raio ao redor de um ponto), `instant` (acerta na hora), `self` (buff em quem usou).
- `effect`: `damage`, `heal`, `stun`, `slow`, `speedBuff` — o que a habilidade faz de verdade.
- `vfx`: só estética (cor, partícula, som) — nunca afeta a regra.

Faixas de valor por tier (aproximado, calibrar pelo que já existe):

| tier | custo | cooldown |
|---|---|---|
| common | 10–20 | 1.5s–3s |
| strong | 30–45 | 6s–10s |
| super | 80–100+ | 40s+ |

Se o poder que você quer criar não cabe em nenhuma combinação de `target`/`effect` existente (ex: algo como Domain Expansion do Gojo, que muda a regra do combate por um tempo em vez de só causar um efeito pontual), **pare e proponha extensão do tipo `AbilityEffect`** em vez de gambiarra — isso é decisão de design, não só de conteúdo.

## Adicionar um personagem

Entra em `src/characters/characters.ts`, seguindo `CharacterDef` de `src/characters/types.ts`. Todo personagem tem:

- `stats`: `health`, `energy`, `energyRegenPerSec`, `moveSpeed`.
- `loadout`: exatamente 5 poderes — `common: [id, id]`, `strong: [id, id]`, `super: id` (ver decisão em `about.md`: "5 poderes por personagem, 2 comuns 2 fortes e 1 super"). Os `id`s referenciam habilidades de `abilities.ts` (pode reusar habilidades genéricas ou criar novas específicas do personagem).

Personagens baseados em poderes de anime (o objetivo declarado do jogo) devem, ainda assim, se encaixar nesse mesmo formato de 5 slots — a referência ao anime entra no `name`, no `vfx` de cada habilidade e na "receita" de efeito, não em lógica especial no `Engine.ts`.

## Adicionar um modo de jogo

Os dois modos já decididos (`about.md`): **sobrevivência** (ondas contra mobs/bosses, sem fome/clima) e **mata-mata** (arena, deathmatch, respawn, timer). Um modo novo, ou a implementação de um desses, deve:

- Reusar o mesmo sistema de habilidades/personagens — não criar uma versão paralela de `Ability`/`CharacterDef` para um modo específico.
- Deixar claro qual entidade decide o estado da partida (fases lobby → partida → fim para sobrevivência/mata-mata por tempo; solto/sem fases pra algo tipo arena livre) — isso é estado de sala, mora perto de `src/network/`.

## Depois de criar

Rode `npx tsc -b --noEmit`. Os ids de habilidade são tipados (`AbilityId`, derivado das chaves de `ABILITIES`), então um `abilityId` inexistente num loadout já é erro de compilação — não precisa checar na mão.
