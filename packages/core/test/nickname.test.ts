'use strict';

import { describe, expect, it } from 'vitest';
import { DEFAULT_NICKNAME_TEMPLATE, NICKNAME_MAX_LENGTH, renderNickname } from '../src/nickname.js';

const ctx = {
  speciesName: '마릴리',
  iv: { atk: 8, def: 15, sta: 15 },
  level: 25,
  ownedRank: 2,
  ownedTotal: 7,
  greatRank: 1,
  ultraRank: 312,
};

describe('renderNickname', () => {
  it('fills every token', () => {
    expect(renderNickname('{rank}/{total} {pct}% {name}', ctx)).toBe('2/7 84% 마릴리');
    expect(renderNickname('{a}.{d}.{s} {iv}', ctx)).toBe('8.15.15 8FF');
    expect(renderNickname('G{gl} U{ul} L{lv}', ctx)).toBe('G1 U312 L25');
    expect(renderNickname('{sum}', ctx)).toBe('38');
  });

  it('drops missing optional values to empty strings', () => {
    expect(renderNickname('{rank}|{gl}', { speciesName: 'x', iv: ctx.iv })).toBe('|');
  });

  it('trims the species name first to stay within 12 characters', () => {
    const out = renderNickname('{rank}/{total} {pct}% {name}', { ...ctx, speciesName: '아주긴이름의포켓몬' });
    expect(Array.from(out).length).toBe(NICKNAME_MAX_LENGTH);
    expect(out).toBe('2/7 84% 아주긴이');
  });

  it('hard-cuts when fixed tokens alone exceed the limit', () => {
    const out = renderNickname('{a}.{d}.{s} GL{gl} UL{ul} {sum}', ctx);
    expect(Array.from(out).length).toBe(NICKNAME_MAX_LENGTH);
  });

  it('counts Korean characters as single code points', () => {
    expect(Array.from(renderNickname(DEFAULT_NICKNAME_TEMPLATE, ctx)).length).toBeLessThanOrEqual(12);
  });
});
