#!/usr/bin/env bash
# Sobe o jogo (Vite + servidor de sinalização) e expõe pra internet com um
# túnel do Cloudflare — pra jogar com alguém fora da sua rede. Roda esse
# script, espera o link aparecer no terminal e manda pro seu amigo.
# Ctrl+C encerra tudo (jogo, sinalização e túnel).
set -e

cd "$(dirname "$0")"

CLOUDFLARED="$HOME/.local/bin/cloudflared"
if [ ! -x "$CLOUDFLARED" ]; then
  echo "cloudflared não encontrado — baixando (só na primeira vez)..."
  mkdir -p "$HOME/.local/bin"
  curl -fL -o "$CLOUDFLARED" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$CLOUDFLARED"
fi

# Libera as portas caso tenha ficado algo pendurado de uma vez anterior.
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null || true
lsof -ti:8787 -sTCP:LISTEN | xargs -r kill 2>/dev/null || true
sleep 1

LOGDIR=$(mktemp -d)
echo "Logs em: $LOGDIR"

npm run dev > "$LOGDIR/vite.log" 2>&1 &
VITE_PID=$!
npm run server > "$LOGDIR/signal.log" 2>&1 &
SERVER_PID=$!
TUNNEL_PID=""

cleanup() {
  echo ""
  echo "Encerrando..."
  kill "$VITE_PID" "$SERVER_PID" "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Esperando o jogo subir..."
until curl -sf http://localhost:5173 >/dev/null 2>&1; do sleep 1; done

"$CLOUDFLARED" tunnel --url http://localhost:5173 > "$LOGDIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!

echo "Esperando o link público..."
URL=""
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOGDIR/tunnel.log" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Não consegui pegar o link do túnel a tempo. Confere o log: $LOGDIR/tunnel.log"
  exit 1
fi

echo ""
echo "================================================================"
echo " Jogo no ar! Manda esse link pro seu amigo:"
echo ""
echo " $URL"
echo ""
echo " (Ctrl+C aqui encerra tudo)"
echo "================================================================"
echo ""

wait
