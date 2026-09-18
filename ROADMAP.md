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
- [x] Câmera de verdade: clique pra travar o mouse, orbital ao redor do personagem (yaw/pitch), movimento e direção dos poderes relativos à câmera — não fixos em -Z
- [x] Sistema de habilidades como dados (`src/abilities`) + runtime de cooldown/energia
- [x] Personagem de teste com loadout completo (5 poderes) + HUD (vida, energia, cooldowns)
- [x] Skills de projeto (`review`, `create-content`) para revisão e criação de conteúdo consistentes
- [x] Primeira leva de bugs revisada e corrigida (tipos de ability id, vazamento de recursos Three.js, XSS via innerHTML, barras de HUD com max hardcoded)

## Fase 2 — Multiplayer de verdade
- [x] Ao entrar na sala, jogadores se veem no mundo (spawn de personagem remoto por peer)
- [x] Sincronizar posição entre peers (15hz, com lerp no destino pra suavizar)
- [x] Sincronizar rotação/direção do personagem (yaw vai junto na posição; personagem remoto vira pro lado certo)
- [x] Sincronizar cast de habilidade (todo mundo vê o efeito visual, não só quem usou)
- [x] Regra de acerto revisada: em vez de host autoritativo, cada cliente decide se FOI atingido por um cast recebido e aplica o efeito em si mesmo (`src/game/combat.ts`) — mais simples que eleger/manter um host árbitro, sem ponto único de falha, mesma garantia contra a disputa "eu acertei"/"não acertou" (ver `about.md` e skill `review`)
- [x] Trocado Trystero (trackers públicos do WebTorrent) por servidor de sinalização próprio (`server/index.js`) — os trackers padrão se mostraram frágeis demais na prática (metade fora do ar); testado localmente (2 navegadores automatizados) com handshake WebRTC completo (`iceConnectionState: connected`)
- [x] Testar com você e uma pessoa de verdade em dispositivos diferentes — funcionou

## Fase 3 — Combate de verdade
- [x] Sistema de alvo/hitbox: instant/area checam distância até o alvo; projétil simula a trajetória e checa o segmento percorrido a cada tick (evita "atravessar" o alvo entre checagens — bug real encontrado e corrigido num teste automatizado)
- [x] Aplicar o `effect` da habilidade no alvo (dano, cura, stun, slow, speedBuff) — `AbilityRuntime.applyEffect`, verificado ponta a ponta (dois navegadores reais, vida caindo de 100% pra 88%/75% conforme a habilidade)
- [x] Morte/respawn de jogador: vida a 0 trava input/movimento, esconde o personagem, e respawna sozinho depois de 3s no ponto de spawn com vida/energia cheias — verificado ponta a ponta (dois navegadores, snapshot síncrono confirmando overlay + contagem regressiva)

## Fase 4 — Modo Sobrevivência
- [ ] Spawn de mobs em ondas
- [ ] Boss ao fim de X ondas
- [ ] Estado de partida: lobby → partida → fim (vitória/derrota)

## Fase 5 — Modo Mata-mata (arena)
- [x] Mapa fixo, respawn ao morrer (reusa o respawn da Fase 3; mapa é o mesmo por enquanto — mapas dedicados ficam pra Fase 6)
- [x] Placar por abates, partida com timer — quem mata credita o abate via rede (`sync.ts`, ações `kill`/`score`), timer configurável (`?matchSeconds=`, 3min por padrão)
- [x] Tela de fim de partida com resultado (vencedor/empate) — congela movimento e cast quando acaba; verificado ponta a ponta com partida de 3s

## Fase 6 — Conteúdo
- [x] Tela de seleção de personagem (menu já deixa escolher entre Testador e Guardião antes de criar/entrar na sala)
- [x] Segundo personagem de teste com loadout/estilo diferente (Guardião: tanque, cura/controle) e mais poderes na receita (`rajadaDeGelo`, `curaRapida`, `toqueEletrico`, `investidaFeroz`, `domoDeProtecao`, `meteoro`, `tempestadeDeGelo`)
- [x] Nova habilidade "Teleporte" (self, desloca 8 unidades na direção que o personagem olha) — trocou o lugar de `passoRapido` no loadout forte do Testador (`passoRapido` continua na receita, só não é mais usado por ele)
- [x] Primeiro personagem de poder de anime de verdade — **Sensei**, inspirado no Gojo Satoru (não usa o nome pra evitar colar direto na marca): vida baixa, energia alta, kit de mobilidade/explosão (`toqueVazio`, `infinito`, `efluvioRoxo`, `piscar`, `dominioVazio` — "Domínio: Vazio Infinito" como super). Modelo novo (character-q da Kenney, terno preto) — por coincidência a textura tem os olhos bem claros/brilhantes, que com o bloom lembra os "Seis Olhos" do personagem original sem ter sido planejado
- [x] Mais mapas/arenas — 3 temas (`src/game/mapPresets.ts`: Abismo Noturno, Deserto Crestado, Gelo Eterno) escolhidos deterministicamente a partir do código da sala, então os dois peers sempre caem no mesmo mapa sem precisar trocar mensagem pra combinar

## Fase 7 — Polimento
- [x] Modelo/animação de personagem de verdade (hoje é uma cápsula colorida) — Testador e Guardião agora usam modelos reais (Kenney "Blocky Characters", CC0, ver `public/models/CREDITS.txt`), com idle/walk/sprint e uma animação de ataque/conjuração ao castar, local e pros peers remotos (`src/game/CharacterModel.ts`)
- [x] Mapa 10x maior (240x240, era 24x24), com muro no perímetro, chão em xadrez e ~140 obstáculos espalhados — e **cenário destrutível**: golpes/poderes com efeito de dano quebram obstáculos de verdade (vida própria por objeto, mesma lógica "cada peer resolve o próprio cast" do combate contra jogadores, sem precisar de mensagem de rede extra). Achei e corrigi uma regressão de performance real nesse processo: o chão em blocos de 1 unidade virou 57600 instâncias projetando sombra nelas mesmas (sem sentido, chão não precisa disso) — trocado por blocos de 3 unidades sem `castShadow`, e o sol passou a acompanhar o jogador em vez de um frustum de sombra fixo (não dava mais pra cobrir o mapa inteiro sem perder resolução)
- [x] Variedade no chão voxel — xadrez de duas cores (feito junto com o mapa maior acima)
- [x] Som — efeitos reais tocando (Kenney "Digital Audio" + "Impact Sounds", CC0, ver `public/audio/CREDITS.txt`): cada `vfx.sound` das receitas mapeado pra um arquivo de verdade (`src/game/sound.ts`), toca em todo cast (local e remoto) e ao destruir um obstáculo — verificado que o som dispara de fato (não só que o código não quebra)
- [x] Menu/HUD com mais identidade visual — fonte Rajdhani, logo "ASTRA" com glow pulsante, campo de estrelas animado no menu (o jogo se chama Astra, afinal), HUD com brilho por habilidade usando a cor do próprio `vfx.color` dela (além da cor por tier que já existia)

## Backlog (decidido para depois, não bloqueia nada)
- [ ] Migração de host se quem criou a sala sair
- [ ] Servidor TURN para conexões que falham por NAT/firewall (o signaling próprio resolve "se encontrar", mas não substitui TURN se a rede de alguém bloquear o WebRTC direto)
- [ ] Hospedar `server/index.js` publicamente (hoje só funciona se todo mundo alcançar a máquina que roda ele — ok pra rede local, não pra amigos em redes diferentes)
- [ ] Caminho para servidor real (Colyseus) se algum dia escalar além de "eu e meus amigos"
