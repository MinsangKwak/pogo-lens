'use strict';

import { cpmOf } from './cpm.js';
import type { Iv, Level, Species } from './types.js';

export function computeCp(species: Species, iv: Iv, level: Level): number {
  const cpm = cpmOf(level);
  const atk = species.baseAtk + iv.atk;
  const def = species.baseDef + iv.def;
  const sta = species.baseSta + iv.sta;
  const raw = (atk * Math.sqrt(def) * Math.sqrt(sta) * cpm * cpm) / 10;
  return Math.max(10, Math.floor(raw));
}

export function computeHp(species: Species, iv: Iv, level: Level): number {
  const raw = (species.baseSta + iv.sta) * cpmOf(level);
  return Math.max(10, Math.floor(raw));
}

// PvP 순위 계산에 쓰는 스탯 곱. HP는 내림한 정수를 쓴다
export function statProduct(species: Species, iv: Iv, level: Level): number {
  const cpm = cpmOf(level);
  const atk = (species.baseAtk + iv.atk) * cpm;
  const def = (species.baseDef + iv.def) * cpm;
  const hp = Math.floor((species.baseSta + iv.sta) * cpm);
  return atk * def * hp;
}
