'use strict';

import { describe, expect, it } from 'vitest';
import { solveIv, uniqueIv } from '../src/iv.js';
import { computeCp, computeHp } from '../src/stats.js';
import { AZUMARILL, MEWTWO } from '../src/data/fixtures.js';
import { levelRangeForStardust } from '../src/stardust.js';

describe('solveIv', () => {
  const iv = { atk: 8, def: 15, sta: 15 };
  const level = 25;
  const cp = computeCp(AZUMARILL, iv, level);
  const hp = computeHp(AZUMARILL, iv, level);

  it('includes the true IV when the level is known', () => {
    const found = solveIv({ species: AZUMARILL, cp, hp, level });
    expect(found).toContainEqual({ iv, level });
  });

  it('narrows levels with stardust and still finds the true IV', () => {
    const found = solveIv({ species: AZUMARILL, cp, hp, stardust: 4000 });
    expect(found).toContainEqual({ iv, level });
    expect(found.every((c) => c.level >= 25 && c.level <= 26.5)).toBe(true);
  });

  it('resolves to a single candidate when appraisal bars are known', () => {
    const found = solveIv({ species: AZUMARILL, cp, hp, level, known: iv });
    expect(uniqueIv(found)).toEqual({ iv, level });
  });

  it('filters by star rating', () => {
    const found = solveIv({ species: AZUMARILL, cp, hp, level, stars: 0 });
    expect(found).toHaveLength(0);
  });

  it('rejects CP and HP below the game minimum', () => {
    expect(() => solveIv({ species: MEWTWO, cp: 1, hp: 1, level: 40 })).toThrow(RangeError);
  });
});

describe('stardust', () => {
  it('maps a cost to a four-level window', () => {
    expect(levelRangeForStardust(10000)).toEqual({ from: 39, to: 40.5 });
    expect(levelRangeForStardust(123)).toBeUndefined();
  });
});

