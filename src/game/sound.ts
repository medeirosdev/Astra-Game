// Sons das habilidades (ver public/audio/CREDITS.txt). Cada nome aqui bate
// com o campo `vfx.sound` das receitas em src/abilities/abilities.ts.
const SOUND_URLS: Record<string, string> = {
  whoosh: "/audio/whoosh.ogg",
  hit: "/audio/hit.ogg",
  chill: "/audio/chill.ogg",
  zap: "/audio/zap.ogg",
  hum: "/audio/hum.ogg",
  dash: "/audio/dash.ogg",
  blink: "/audio/blink.ogg",
  chime: "/audio/chime.ogg",
  windgust: "/audio/windgust.ogg",
  boom: "/audio/boom.ogg",
  obstacleBreak: "/audio/obstacleBreak.ogg",
};

const MAX_CONCURRENT_PER_SOUND = 4;
const activeCounts = new Map<string, number>();

// new Audio() por chamada (em vez de reusar um elemento) de propósito —
// permite dois casts do mesmo som tocarem sobrepostos, comum em multiplayer
// (eu e outro peer castando a mesma habilidade quase junto).
export function playSound(name: string | undefined, volume = 0.5) {
  if (!name) return;
  const url = SOUND_URLS[name];
  if (!url) return;

  const count = activeCounts.get(name) ?? 0;
  if (count >= MAX_CONCURRENT_PER_SOUND) return;

  const audio = new Audio(url);
  audio.volume = volume;
  activeCounts.set(name, count + 1);
  const release = () => activeCounts.set(name, Math.max(0, (activeCounts.get(name) ?? 1) - 1));
  audio.addEventListener("ended", release);
  audio.addEventListener("error", release);
  audio.play().catch(() => release());
}
