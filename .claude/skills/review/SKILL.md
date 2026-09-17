---
name: review
description: Revisa mudanças no código do Astra antes de aceitar uma contribuição ou PR. Use sempre que for revisar um diff, uma branch ou uma pull request neste repositório.
---

# Review — Astra

Checklist de revisão para este projeto (jogo 3D, voxel, multiplayer P2P por sala+código). Como é open source, qualquer contribuição externa passa por isso antes de ser aceita.

## 1. Build e tipos primeiro

Sempre rode antes de avaliar o código manualmente:

```
npm run build
npx tsc -b --noEmit
```

Se algum dos dois falhar, isso já é motivo de bloqueio — não continue a revisão de estilo até o build passar.

## 2. Poderes e personagens são dados, não lógica

O sistema de habilidades (ver `about.md`, seção "sistema de habilidades") é *data-driven* de propósito: cada poder é uma "receita" em `src/abilities/abilities.ts` (custo, cooldown, alvo, efeito, vfx), não uma função especial. Rejeite/questione mudanças que:

- Criam um `if (ability.id === "...")` especial em `Engine.ts` ou em qualquer lugar do runtime para dar comportamento único a um poder específico, em vez de expressar isso via campos do tipo `Ability`.
- Adicionam um personagem sem passar pelos 5 slots do loadout (2 `common`, 2 `strong`, 1 `super` — ver `src/characters/types.ts`).
- Colocam valores de gameplay (dano, cooldown, custo) direto no código de renderização/VFX em vez de em `abilities.ts`.

Se uma ideia realmente não cabe no formato atual de `Ability`, isso é sinal para propor uma extensão do tipo (`AbilityEffect`/`AbilityTargetType`), não para abrir uma exceção pontual.

## 3. Quem decide um acerto é o alvo, não quem atacou

A regra combinada no design (`about.md`, `AbilityRuntime.ts`) mudou de "host decide" pra **auto-autoritativo**: cada cliente decide, pra si mesmo, se um cast recebido de outro peer o atingiu (`src/game/combat.ts`), e só então aplica o efeito na própria `AbilityRuntime`. Ninguém aplica dano/stun/slow em outro peer diretamente — o cast é só um broadcast do que aconteceu do lado de quem atacou (posição, habilidade usada); quem foi "atingido" ou não é sempre decisão de quem recebeu. Efeitos com alvo `self` (cura, buff) são a exceção: aplicam na hora, no próprio cliente que castou, sem depender de ninguém.

Ao revisar qualquer código de combate/rede, sinalize: cliente aplicando efeito em OUTRO peer diretamente (deveria só mandar o cast e deixar o alvo decidir), ou um host/árbitro central sendo reintroduzido sem necessidade — o modelo atual dispensa isso de propósito (mais simples, sem eleição de host, sem ponto único de falha).

## 4. Three.js — vazamento de recursos

Toda `THREE.Mesh`/`BufferGeometry`/`Material` criada dinamicamente (projéteis, efeitos, partículas) precisa ser removida da cena **e** ter `geometry.dispose()` / `material.dispose()` chamados quando deixa de ser usada. Sinalize qualquer `scene.add(...)` sem um caminho de limpeza correspondente.

## 5. DOM e segurança

- Nunca usar `innerHTML` com texto que venha de dados de personagem/habilidade ou de outro jogador (nome, chat, etc.) — usar `textContent` ou criar elementos via `createElement`. `innerHTML` só é aceitável para markup estático fixo no próprio arquivo.
- Código de rede (`src/network/`) deve tratar tudo que vem de outro peer como não confiável.

## 6. Estilo do projeto

- Sem comentários explicando o óbvio; comentário só quando explica um "porquê" não óbvio (ver convenção já usada em `AbilityRuntime.ts`).
- Sem abstração prematura: se uma mudança generaliza algo que só tem um caso de uso real, questione se é cedo demais.
- Nomes de habilidades/personagens em português (`bolaDeEnergia`, `ondaDeChoque`), consistente com o que já existe — não misturar idioma dentro do mesmo tipo de dado.

## 7. Saída

Reporte os achados divididos em **bloqueadores** (build quebrado, regra de "quem decide o acerto" violada, vazamento de recurso, XSS) e **sugestões** (estilo, nomeação, oportunidade de simplificar). Não aprove uma contribuição com bloqueador pendente.
