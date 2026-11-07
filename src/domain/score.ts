export interface ScoreInput {
  wavesCleared: number;
  kills: number;
  integrity: number;
  crystals: number;
  victory: boolean;
}

export function computeScore(input: ScoreInput): number {
  return (
    Math.max(0, input.wavesCleared) * 100 +
    Math.max(0, input.kills) * 10 +
    Math.max(0, input.integrity) * 50 +
    Math.max(0, input.crystals) * 2 +
    (input.victory ? 1000 : 0)
  );
}
