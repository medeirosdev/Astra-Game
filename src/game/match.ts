export const LOCAL_SCORE_KEY = "me";

// Placar do mata-mata. "me" é uma chave especial pro placar do jogador
// local — não colide com peerId de verdade (que são UUIDs). Cada cliente só
// sabe suas próprias mortes/abates de primeira mão; o placar dos outros vem
// de score broadcasts (ver src/network/sync.ts, ação "score").
export class MatchState {
  readonly startedAt: number;
  private kills = new Map<string, number>();

  constructor(private readonly durationMs: number, now: number) {
    this.startedAt = now;
  }

  registerLocalKill() {
    this.setKills(LOCAL_SCORE_KEY, this.getKills(LOCAL_SCORE_KEY) + 1);
  }

  setKills(peerKey: string, value: number) {
    this.kills.set(peerKey, value);
  }

  getKills(peerKey: string): number {
    return this.kills.get(peerKey) ?? 0;
  }

  get scoreboard(): [string, number][] {
    return [...this.kills.entries()].sort((a, b) => b[1] - a[1]);
  }

  remainingMs(now: number): number {
    return Math.max(0, this.startedAt + this.durationMs - now);
  }

  isOver(now: number): boolean {
    return this.remainingMs(now) <= 0;
  }
}
