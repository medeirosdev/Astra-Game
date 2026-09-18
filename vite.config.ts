import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    host: true, // escuta em todas as interfaces, não só localhost — precisa pra túnel/rede
    // Vite recusa por padrão Host headers que não reconhece (proteção contra
    // DNS rebinding) — um túnel público chega com um domínio novo a cada
    // vez, então libera qualquer subdomínio do trycloudflare.com em vez de
    // travar num hostname fixo que muda toda hora.
    allowedHosts: [".trycloudflare.com"],
    // Sinalização (server/index.js) roda numa porta própria (8787); um túnel
    // só expõe uma porta de cada vez, então o front acessa ela através desse
    // proxy de WebSocket em vez de bater direto na porta 8787 (ver
    // src/network/room.ts — a URL é derivada do host da página, não mais
    // hardcoded com a porta).
    proxy: {
      "/signal": {
        target: "ws://localhost:8787",
        ws: true,
      },
    },
  },
});
