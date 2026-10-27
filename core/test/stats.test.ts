'use strict';

import { describe, expect, it } from 'vitest';
import { cpmOf, isValidLevel, LEVELS, levelsBetween, MAX_LEVEL } from '../src/cpm.js';
import { computeCp, computeHp } from '../src/stats.js';
import { BULBASAUR, MEWTWO } from '../src/data/fixtures.js';

describe('cpm', () => {
  it('has one entry per half level from 1 to 51', () => {
    expect(LEVELS[0]).toBe(1);
    expect(LEVELS[LEVELS.length - 1]).toBe(MAX_LEVEL);
    expect(LEVELS.length).toBe(101);
  });

  it('is strictly increasing', () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      const lo = LEVELS[i - 1];
      const hi = LEVELS[i];
      if (lo === undefined || hi === undefined) throw new Error('unreachable');
      expect(cpmOf(hi)).toBeGreaterThan(cpmOf(lo));
    }
  });

  it('rejects levels outside the table', () => {
    expect(isValidLevel(0.5)).toBe(false);
    expect(isValidLevel(1.25)).toBe(false);
    expect(isValidLevel(51.5)).toBe(false);
    expect(() => cpmOf(52)).toThrow(RangeError);
  });

  it('lists levels between bounds inclusively', () => {
    expect(levelsBetween(39, 40.5)).toEqual([39, 39.5, 40, 40.5]);
  });
});

describe('computeCp / computeHp', () => {
  it('matches the well-known Mewtwo 15/15/15 level 40 CP', () => {
    const perfect = { atk: 15, def: 15, sta: 15 };
    expect(computeCp(MEWTWO, perfect, 40)).toBe(4178);
  });

  it('never drops below 10', () => {
    const zero = { atk: 0, def: 0, sta: 0 };
    const weak = { id: 0, name: 'weak', baseAtk: 1, baseDef: 1, baseSta: 1 };
    expect(computeCp(weak, zero, 1)).toBe(10);
    expect(computeHp(weak, zero, 1)).toBe(10);
    expect(computeCp(BULBASAUR, zero, 1)).toBe(12);
    expect(computeHp(BULBASAUR, zero, 1)).toBe(12);
  });

  it('grows with level', () => {
    const iv = { atk: 10, def: 10, sta: 10 };
    expect(computeCp(BULBASAUR, iv, 20)).toBeLessThan(computeCp(BULBASAUR, iv, 30));
  });
});
