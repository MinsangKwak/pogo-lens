'use strict';

import type { Level } from './types.js';

export interface LevelRange {
  readonly from: Level;
  readonly to: Level;
}

// 강화 비용(모래) → 현재 레벨 범위. 각 구간은 레벨 4개(0.5 단위)
const STARDUST_LEVELS: ReadonlyMap<number, LevelRange> = new Map([
  [200, { from: 1, to: 2.5 }],
  [400, { from: 3, to: 4.5 }],
  [600, { from: 5, to: 6.5 }],
  [800, { from: 7, to: 8.5 }],
  [1000, { from: 9, to: 10.5 }],
  [1300, { from: 11, to: 12.5 }],
  [1600, { from: 13, to: 14.5 }],
  [1900, { from: 15, to: 16.5 }],
  [2200, { from: 17, to: 18.5 }],
  [2500, { from: 19, to: 20.5 }],
  [3000, { from: 21, to: 22.5 }],
  [3500, { from: 23, to: 24.5 }],
  [4000, { from: 25, to: 26.5 }],
  [4500, { from: 27, to: 28.5 }],
  [5000, { from: 29, to: 30.5 }],
  [6000, { from: 31, to: 32.5 }],
  [7000, { from: 33, to: 34.5 }],
  [8000, { from: 35, to: 36.5 }],
  [9000, { from: 37, to: 38.5 }],
  [10000, { from: 39, to: 40.5 }],
  [11000, { from: 41, to: 42.5 }],
  [12000, { from: 43, to: 44.5 }],
  [13000, { from: 45, to: 46.5 }],
  [14000, { from: 47, to: 48.5 }],
  [15000, { from: 49, to: 50.5 }],
]);

export function levelRangeForStardust(stardust: number): LevelRange | undefined {
  return STARDUST_LEVELS.get(stardust);
}

export const KNOWN_STARDUST_COSTS: readonly number[] = [...STARDUST_LEVELS.keys()];
