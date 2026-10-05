export type SpreadConfig = {
  minimumSpread: number;
  spreadPerShot: number;
  maxSpread: number;
  range: number;
  minCircleSize: number;
  maxCircleSize: number;
};

export function calculateSpread(recentShots: number, distance: number, config: SpreadConfig): number {
  const baseSpread = Math.min(config.minimumSpread + recentShots * config.spreadPerShot, config.maxSpread);
  const distanceScale = Math.min(Math.max(distance / config.range, config.minCircleSize), config.maxCircleSize);
  return baseSpread * distanceScale;
}
