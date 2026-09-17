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
- [x] Scaffold Vite + TypeScript + Three.js + WebRTC (rede)
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
- [x] Regra de acerto revisada: em vez de host autoritativo, cada cliente decide se FOI atingido por um cast recebido e aplica o efeito em si mesmo (`src/game/combat.ts`) — mais simples que eleger/manter um host árbitro, sem ponto único de falha, mesma garantia contra a disputa "eu acertei"/"não acertou" (ver `about.md` e skill `review`)
- [x] Trocado Trystero (trackers públicos do WebTorrent) por servidor de sinalização próprio (`server/index.js`) — os trackers padrão se mostraram frágeis demais na prática (metade fora do ar); testado localmente (2 navegadores automatizados) com handshake WebRTC completo (`iceConnectionState: connected`)
- [x] Testar com você e uma pessoa de verdade em dispositivos diferentes — funcionou

## Fase 3 — Combate de verdade
- [x] Sistema de alvo/hitbox: instant/area checam distância até o alvo; projétil simula a trajetória e checa o segmento percorrido a cada tick (evita "atravessar" o alvo entre checagens — bug real encontrado e corrigido num teste automatizado)
- [x] Aplicar o `effect` da habilidade no alvo (dano, cura, stun, slow, speedBuff) — `AbilityRuntime.applyEffect`, verificado ponta a ponta (dois navegadores reais, vida caindo de 100% pra 88%/75% conforme a habilidade)
- [ ] Morte/respawn de jogador (hoje a vida vai a 0 e para; não acontece nada especial)

## Fase 4 — Modo Sobrevivência
- [ ] Spawn de mobs em ondas
- [ ] Boss ao fim de X ondas
- [ ] Estado de partida: lobby → partida → fim (vitória/derrota)

## Fase 5 — Modo Mata-mata (arena)
- [ ] Mapa fixo, respawn ao morrer
- [ ] Placar por abates, partida com timer
- [ ] Tela de fim de partida com resultado

## Fase 6 — Conteúdo
- [x] Tela de seleção de personagem (menu já deixa escolher entre Testador e Guardião antes de criar/entrar na sala)
- [x] Segundo personagem de teste com loadout/estilo diferente (Guardião: tanque, cura/controle) e mais poderes na receita (`rajadaDeGelo`, `curaRapida`, `toqueEletrico`, `investidaFeroz`, `domoDeProtecao`, `meteoro`, `tempestadeDeGelo`)
- [ ] Primeiro personagem de poder de anime de verdade (ex: baseado no Gojo Satoru)
- [ ] Mais mapas/arenas

## Fase 7 — Polimento
- [ ] Modelo/animação de personagem de verdade (hoje é uma cápsula colorida)
- [ ] Variedade no chão voxel (hoje é um bloco só repetido)
- [ ] Som (vfx.sound já existe nas receitas, falta tocar de verdade)
- [ ] Menu/HUD com mais identidade visual

## Backlog (decidido para depois, não bloqueia nada)
- [ ] Migração de host se quem criou a sala sair
- [ ] Servidor TURN para conexões que falham por NAT/firewall (o signaling próprio resolve "se encontrar", mas não substitui TURN se a rede de alguém bloquear o WebRTC direto)
- [ ] Hospedar `server/index.js` publicamente (hoje só funciona se todo mundo alcançar a máquina que roda ele — ok pra rede local, não pra amigos em redes diferentes)
- [ ] Caminho para servidor real (Colyseus) se algum dia escalar além de "eu e meus amigos"
