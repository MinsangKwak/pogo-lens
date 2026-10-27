'use strict';

import { LEVELS, levelsBetween } from './cpm.js';
import { levelRangeForStardust } from './stardust.js';
import { computeCp, computeHp } from './stats.js';
import { IV_MAX, IV_MIN, ivSum, type Iv, type Level, type Species } from './types.js';

// 팀 리더 평가 화면의 별 개수. IV 합 구간으로 변환된다
export type AppraisalStars = 0 | 1 | 2 | 3;

const STAR_SUM_RANGE: Readonly<Record<AppraisalStars, readonly [number, number]>> = {
  0: [0, 22],
  1: [23, 29],
  2: [30, 36],
  3: [37, 45],
};

export interface IvQuery {
  readonly species: Species;
  readonly cp: number;
  readonly hp: number;
  // 아크에서 읽은 정확한 레벨. 있으면 stardust보다 우선한다
  readonly level?: Level;
  // 강화 비용. 레벨 후보 범위를 좁힌다
  readonly stardust?: number;
  readonly stars?: AppraisalStars;
  // 평가 화면의 바에서 읽은 IV. 일부만 알아도 된다
  readonly known?: Partial<Iv>;
}

export interface IvCandidate {
  readonly iv: Iv;
  readonly level: Level;
}

function candidateLevels(query: IvQuery): readonly Level[] {
  if (query.level !== undefined) return [query.level];
  if (query.stardust !== undefined) {
    const range = levelRangeForStardust(query.stardust);
    if (range) return levelsBetween(range.from, range.to);
  }
  return LEVELS;
}

function valuesFor(known: number | undefined): readonly number[] {
  if (known !== undefined) return [known];
  const out: number[] = [];
  for (let v = IV_MIN; v <= IV_MAX; v += 1) out.push(v);
  return out;
}

// 화면에서 읽은 값과 일치하는 (IV, 레벨) 조합을 모두 돌려준다
export function solveIv(query: IvQuery): IvCandidate[] {
  const result: IvCandidate[] = [];
  const sumRange = query.stars === undefined ? undefined : STAR_SUM_RANGE[query.stars];
  const atks = valuesFor(query.known?.atk);
  const defs = valuesFor(query.known?.def);
  const stas = valuesFor(query.known?.sta);

  for (const level of candidateLevels(query)) {
    for (const sta of stas) {
      // HP는 sta와 레벨만으로 정해지므로 먼저 걸러낸다
      const hp = computeHp(query.species, { atk: 0, def: 0, sta }, level);
      if (hp !== query.hp) continue;
      for (const atk of atks) {
        for (const def of defs) {
          const iv: Iv = { atk, def, sta };
          if (sumRange) {
            const sum = ivSum(iv);
            if (sum < sumRange[0] || sum > sumRange[1]) continue;
          }
          if (computeCp(query.species, iv, level) !== query.cp) continue;
          result.push({ iv, level });
        }
      }
    }
  }
  return result;
}

// 후보가 하나로 좁혀졌을 때만 값을 돌려준다
export function uniqueIv(candidates: readonly IvCandidate[]): IvCandidate | undefined {
  return candidates.length === 1 ? candidates[0] : undefined;
}
