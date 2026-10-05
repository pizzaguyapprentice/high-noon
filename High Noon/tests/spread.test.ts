import { calculateSpread } from '../src/game/scenes/spread.ts';

const config = {
  minimumSpread: 24,
  spreadPerShot: 16,
  maxSpread: 120,
  range: 200,
  minCircleSize: 0.5,
  maxCircleSize: 2.5
};

Deno.test('calculateSpread uses minimum spread at close range', () => {
  if (calculateSpread(0, 0, config) !== 12) {
    throw new Error('expected minimum spread of 12 at zero distance');
  }
});

Deno.test('calculateSpread increases with sustained shots', () => {
  if (calculateSpread(2, 200, config) !== 56) {
    throw new Error('expected spread to increase to 56 after two recent shots');
  }
});

Deno.test('calculateSpread clamps to max spread and max distance scale', () => {
  if (calculateSpread(20, 2000, config) !== 300) {
    throw new Error('expected spread to clamp to 300');
  }
});
