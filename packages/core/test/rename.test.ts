'use strict';

import { describe, expect, it } from 'vitest';
import { suggestOwnedNicknames } from '../src/rename.js';
import { solveIv } from '../src/iv.js';
import { renderNickname } from '../src/nickname.js';
import { pvpRankOf, pvpTable } from '../src/rank.js';
import { AZUMARILL } from '../src/data/fixtures.js';
import type { ScanRecord } from '../src/types.js';

const scan = (id: string, atk: number, form?: string): ScanRecord => ({
  id, speciesId: AZUMARILL.id, ...(form === undefined ? {} : { form }), cp: 500, hp: 100, level: 20,
  iv: { atk, def: 15, sta: 15 }, scannedAt: 0,
});

describe('owned nickname workflow', () => {
  it('recalculates older names when a better scan is added without mutating records', () => {
    const first = { ...scan('a', 10), nickname: '1/1 AFF' };
    const result = suggestOwnedNicknames([first, scan('b', 15)], [AZUMARILL]);
    expect(result.map((entry) => entry.suggestedNickname)).toEqual(['1/2 FFF', '2/2 AFF']);
    expect(result.every((entry) => entry.changed)).toBe(true);
    expect(first.nickname).toBe('1/1 AFF');
  });
  it('shares identical-IV ranks and keeps forms separate', () => {
    const result = suggestOwnedNicknames(
      [scan('a', 15), scan('b', 15), scan('c', 10, 'special')],
      [AZUMARILL, { ...AZUMARILL, form: 'special' }],
    );
    expect(result.map((entry) => [entry.rank, entry.total])).toEqual([[1, 2], [1, 2], [1, 1]]);
  });
  it('rejects duplicate scan IDs and unknown species', () => {
    expect(() => suggestOwnedNicknames([scan('a', 15), scan('a', 15)], [AZUMARILL])).toThrow();
    expect(() => suggestOwnedNicknames([scan('a', 15)], [])).toThrow();
  });
  it('preserves the suffix when a name token occurs twice', () => {
    expect(renderNickname('{name}{name}FFF', { speciesName: '가나다라마바', iv: { atk: 15, def: 15, sta: 15 } })).toBe('가나다라가나다라FFF');
  });
});

describe('scan validation and ranking cache', () => {
  it('rejects impossible OCR values instead of computing plausible names', () => {
    const query = { species: AZUMARILL, cp: 500, hp: 100 };
    expect(() => solveIv({ ...query, known: { atk: 16 } })).toThrow(RangeError);
    expect(() => solveIv({ ...query, hp: NaN })).toThrow(RangeError);
    expect(() => solveIv({ ...query, stardust: 123 })).toThrow(RangeError);
    expect(() => solveIv({ ...query, level: 20.2 })).toThrow(RangeError);
    expect(() => pvpRankOf(AZUMARILL, { atk: -1, def: 15, sta: 15 }, 'great')).toThrow(RangeError);
    expect(() => pvpTable(AZUMARILL, 'great', { maxLevel: NaN })).toThrow(RangeError);
  });
  it('invalidates a species cache when its base stats change', () => {
    const original = pvpTable(AZUMARILL, 'great');
    const updated = pvpTable({ ...AZUMARILL, baseAtk: AZUMARILL.baseAtk + 1 }, 'great');
    expect(updated).not.toBe(original);
    expect(updated[0]?.product).not.toBe(original[0]?.product);
  });
});
