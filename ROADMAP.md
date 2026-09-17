# Roadmap — Astra

Passo a passo do projeto, do brainstorm (`about.md`) até um jogo jogável. Marcar `[x]` conforme for concluindo.

## Fase 0 — Decisões de design
- [x] Escopo de rede: P2P (host + código de sala), não MMO
- [x] Dois modos: sobrevivência (ondas contra mobs/bosses) e mata-mata (arena/deathmatch)
- [x] Estilo visual: voxel "bonito" (iluminação suave, bloom, personagem mais detalhado que o cenário)
- [x] Sistema de poderes: data-driven, 5 slots por personagem (2 comuns, 2 fortes, 1 super)
- [x] Nome do jogo: Astra

## Fase 1 — Fundação técnica
- [x] Repositório criado e publicado (`medeirosdev/Astra-Game`)
- [x] Scaffold Vite + TypeScript + Three.js + Trystero
- [x] Menu de criar/entrar em sala por código
- [x] Cena 3D: chão voxel, luz + bloom, personagem de teste com movimento (WASD)
- [x] Sistema de habilidades como dados (`src/abilities`) + runtime de cooldown/energia
- [x] Personagem de teste com loadout completo (5 poderes) + HUD (vida, energia, cooldowns)
- [x] Skills de projeto (`review`, `create-content`) para revisão e criação de conteúdo consistentes
- [x] Primeira leva de bugs revisada e corrigida (tipos de ability id, vazamento de recursos Three.js, XSS via innerHTML, barras de HUD com max hardcoded)

## Fase 2 — Multiplayer de verdade
- [x] Ao entrar na sala, jogadores se veem no mundo (spawn de personagem remoto por peer)
- [x] Sincronizar posição entre peers (15hz, com lerp no destino pra suavizar)
- [ ] Sincronizar rotação/direção do personagem (hoje o personagem remoto não vira pro lado que anda)
- [x] Sincronizar cast de habilidade (todo mundo vê o efeito visual, não só quem usou)
- [ ] Host autoritativo decide dano/acerto real (ver regra em `about.md`) — ainda não existe aplicação de dano nenhuma (ver Fase 3)
- [ ] Testar com 2 navegadores/abas em redes diferentes (checar NAT/TURN na prática) — ainda não verificado manualmente

## Fase 3 — Combate de verdade
- [ ] Sistema de alvo/hitbox: projétil e área realmente acertam outro jogador (ou mob)
- [ ] Aplicar o `effect` da habilidade no alvo (dano, cura, stun, slow, speedBuff) — hoje é só visual
- [ ] Morte/respawn de jogador

## Fase 4 — Modo Sobrevivência
- [ ] Spawn de mobs em ondas
- [ ] Boss ao fim de X ondas
- [ ] Estado de partida: lobby → partida → fim (vitória/derrota)

## Fase 5 — Modo Mata-mata (arena)
- [ ] Mapa fixo, respawn ao morrer
- [ ] Placar por abates, partida com timer
- [ ] Tela de fim de partida com resultado

## Fase 6 — Conteúdo
- [ ] Tela de seleção de personagem (hoje é só 1 personagem fixo: "Testador")
- [ ] Primeiro personagem de poder de anime de verdade (ex: baseado no Gojo Satoru)
- [ ] Mais mapas/arenas

## Fase 7 — Polimento
- [ ] Modelo/animação de personagem de verdade (hoje é uma cápsula colorida)
- [ ] Variedade no chão voxel (hoje é um bloco só repetido)
- [ ] Som (vfx.sound já existe nas receitas, falta tocar de verdade)
- [ ] Menu/HUD com mais identidade visual

## Backlog (decidido para depois, não bloqueia nada)
- [ ] Migração de host se quem criou a sala sair
- [ ] Servidor TURN para conexões que falham por NAT/firewall
- [ ] Caminho para servidor real (Colyseus) se algum dia escalar além de "eu e meus amigos"
