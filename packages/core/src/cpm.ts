'use strict';

import type { Level } from './types.js';

export const MIN_LEVEL: Level = 1;
export const MAX_LEVEL: Level = 51;
export const LEVEL_STEP = 0.5;

// 레벨 1부터 0.5 단위로 51까지의 CP 배수(CPM)
// 출처: 게임 마스터 데이터. 값이 바뀌면 여기만 갱신한다
const CPM_TABLE: readonly number[] = [
  0.094, 0.1351374318, 0.16639787, 0.192650919, 0.21573247, 0.2365726613,
  0.25572005, 0.2735303812, 0.29024988, 0.3060573775, 0.3210876, 0.3354450362,
  0.34921268, 0.3624577511, 0.3752356, 0.387592416, 0.39956728, 0.4111935514,
  0.4225, 0.4329264091, 0.44310755, 0.4530599591, 0.4627984, 0.472336093,
  0.48168495, 0.4908558003, 0.49985844, 0.508701765, 0.51739395, 0.5259425113,
  0.5343543, 0.5426357375, 0.5507927, 0.5588305862, 0.5667545, 0.5745691333,
  0.5822789, 0.5898879072, 0.5974, 0.6048236651, 0.6121573, 0.6194041216,
  0.6265671, 0.6336491432, 0.64065295, 0.6475809666, 0.65443563, 0.6612192524,
  0.667934, 0.6745818959, 0.6811649, 0.6876849038, 0.69414365, 0.70054287,
  0.7069307, 0.7132650775, 0.7195521, 0.7257931563, 0.7319939, 0.7350634207,
  0.7381152, 0.7411494857, 0.7441663, 0.7471660289, 0.7501488, 0.7531145698,
  0.7560636, 0.7589961745, 0.7619123, 0.7648122894, 0.7676961, 0.7705640458,
  0.7734161, 0.7762524529, 0.7790733, 0.7818788528, 0.7846691, 0.7874445,
  0.7903, 0.7928, 0.7953, 0.7978, 0.8003, 0.8028, 0.8053, 0.8078, 0.8103,
  0.8128, 0.8153, 0.8178, 0.8203, 0.8228, 0.8253, 0.8278, 0.8303, 0.8328,
  0.8353, 0.8378, 0.8403, 0.8428, 0.8453,
];

export const LEVELS: readonly Level[] = CPM_TABLE.map(
  (_, i) => MIN_LEVEL + i * LEVEL_STEP,
);

export function isValidLevel(level: Level): boolean {
  if (level < MIN_LEVEL || level > MAX_LEVEL) return false;
  return Number.isInteger((level - MIN_LEVEL) / LEVEL_STEP);
}

export function cpmOf(level: Level): number {
  if (!isValidLevel(level)) {
    throw new RangeError(`invalid level: ${level}`);
  }
  const index = (level - MIN_LEVEL) / LEVEL_STEP;
  const cpm = CPM_TABLE[index];
  if (cpm === undefined) {
    throw new RangeError(`no CPM for level: ${level}`);
  }
  return cpm;
}

// 두 레벨 사이(양 끝 포함)의 레벨 목록
export function levelsBetween(from: Level, to: Level): Level[] {
  return LEVELS.filter((lv) => lv >= from && lv <= to);
}
