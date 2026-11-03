'use strict';

import { describe, expect, it } from 'vitest';
import { pvpRankOf, pvpTable, rankOwned } from '../src/rank.js';
import { AZUMARILL, MEDICHAM } from '../src/data/fixtures.js';
import type { ScanRecord } from '../src/types.js';

function record(id: string, speciesId: number, atk: number, def: number, sta: number): ScanRecord {
  return { id, speciesId, cp: 0, hp: 0, level: 20, iv: { atk, def, sta }, scannedAt: 0 };
}

describe('rankOwned', () => {
  it('ranks within species by IV sum and shares rank on ties', () => {
    const ranked = rankOwned([
      record('a', 184, 15, 15, 15),
      record('b', 184, 10, 10, 10),
      record('c', 184, 10, 10, 10),
      record('d', 308, 0, 0, 1),
    ]);
    const byId = new Map(ranked.map((r) => [r.record.id, r]));
    expect(byId.get('a')?.rank).toBe(1);
    expect(byId.get('b')?.rank).toBe(2);
    expect(byId.get('c')?.rank).toBe(2);
    expect(byId.get('a')?.total).toBe(3);
    expect(byId.get('d')?.rank).toBe(1);
    expect(byId.get('d')?.total).toBe(1);
  });

  it('breaks IV-sum ties by attack first', () => {
    const ranked = rankOwned([record('x', 1, 10, 15, 15), record('y', 1, 15, 10, 15)]);
    const byId = new Map(ranked.map((r) => [r.record.id, r]));
    expect(byId.get('y')?.rank).toBe(1);
    expect(byId.get('x')?.rank).toBe(2);
  });
});

describe('pvpTable', () => {
  it('prevents callers from corrupting a cached row, nested IV or the table array', () => {
    const table = pvpTable(AZUMARILL, 'great');
    const first = table[0];
    if (!first) throw new Error('missing fixture entry');
    const before = { ...first, iv: { ...first.iv } };
    expect(() => Object.assign(first, { rank: 999 })).toThrow(TypeError);
    expect(() => Object.assign(first.iv, { atk: 999 })).toThrow(TypeError);
    expect(() => Object.assign(table, { 0: { ...first, rank: 999 } })).toThrow(TypeError);
    expect(pvpTable(AZUMARILL, 'great')[0]).toEqual(before);
    expect(pvpRankOf(AZUMARILL, before.iv, 'great')).toEqual(before);
  });

  it('covers all 4096 combinations under the Great League cap', () => {
    const table = pvpTable(AZUMARILL, 'great');
    expect(table).toHaveLength(4096);
    expect(table[0]?.rank).toBe(1);
    expect(table[0]?.percent).toBe(100);
    expect(table.every((e) => e.cp <= 1500)).toBe(true);
  });

  it('is sorted by stat product descending', () => {
    const table = pvpTable(MEDICHAM, 'great');
    for (let i = 1; i < table.length; i += 1) {
      const prev = table[i - 1];
      const cur = table[i];
      if (!prev || !cur) throw new Error('unreachable');
      expect(prev.product).toBeGreaterThanOrEqual(cur.product);
    }
  });

  it('prefers low attack for a bulky Great League pick', () => {
    const top = pvpTable(AZUMARILL, 'great')[0];
    expect(top?.iv.atk).toBeLessThan(10);
    expect(top?.iv.def).toBeGreaterThanOrEqual(13);
    expect(top?.iv.sta).toBeGreaterThanOrEqual(13);
  });

  it('looks up a single IV', () => {
    const entry = pvpRankOf(AZUMARILL, { atk: 15, def: 15, sta: 15 }, 'great');
    expect(entry?.rank).toBeGreaterThan(1);
    expect(entry?.cp).toBeLessThanOrEqual(1500);
  });

  it('respects a lower max level', () => {
    const capped = pvpTable(AZUMARILL, 'great', { maxLevel: 40 });
    expect(capped.every((e) => e.level <= 40)).toBe(true);
  });
});

