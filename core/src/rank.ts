'use strict';

import { LEVELS } from './cpm.js';
import { computeCp, statProduct } from './stats.js';
import {
  IV_MAX,
  IV_MIN,
  ivSum,
  speciesKey,
  type Iv,
  type Level,
  type ScanRecord,
  type Species,
} from './types.js';

export interface OwnedRank {
  readonly record: ScanRecord;
  // 같은 종 안에서의 순위. 1부터 시작하고 동점은 같은 순위
  readonly rank: number;
  // 같은 종을 몇 마리 가졌는지
  readonly total: number;
}

function compareIv(a: Iv, b: Iv): number {
  return ivSum(b) - ivSum(a) || b.atk - a.atk || b.def - a.def || b.sta - a.sta;
}

// 내가 가진 포켓몬을 종별로 묶어 IV 합 기준으로 순위를 매긴다
export function rankOwned(records: readonly ScanRecord[]): OwnedRank[] {
  const groups = new Map<string, ScanRecord[]>();
  for (const record of records) {
    const key = speciesKey(record.speciesId, record.form);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }

  const out: OwnedRank[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => compareIv(a.iv, b.iv));
    let rank = 0;
    let previous: Iv | undefined;
    sorted.forEach((record, index) => {
      if (!previous || compareIv(previous, record.iv) !== 0) rank = index + 1;
      previous = record.iv;
      out.push({ record, rank, total: sorted.length });
    });
  }
  return out;
}

export const LEAGUE_CP_CAP = {
  great: 1500,
  ultra: 2500,
} as const;

export type League = keyof typeof LEAGUE_CP_CAP;

export interface PvpEntry {
  readonly iv: Iv;
  readonly level: Level;
  readonly cp: number;
  readonly product: number;
  // 4096개 조합 중 순위. 1이 최고
  readonly rank: number;
  // 1위 대비 스탯 곱 비율(0~100)
  readonly percent: number;
}

export interface PvpOptions {
  readonly maxLevel?: Level;
}

const DEFAULT_MAX_LEVEL: Level = 51;

function bestLevelUnderCap(
  species: Species,
  iv: Iv,
  cap: number,
  maxLevel: Level,
): { level: Level; cp: number } | undefined {
  let best: { level: Level; cp: number } | undefined;
  for (const level of LEVELS) {
    if (level > maxLevel) break;
    const cp = computeCp(species, iv, level);
    if (cp > cap) break;
    best = { level, cp };
  }
  return best;
}

const pvpCache = new Map<string, readonly PvpEntry[]>();

function ivIndex(iv: Iv): number {
  return iv.atk * 256 + iv.def * 16 + iv.sta;
}

// 한 종의 4096개 IV 조합 전부를 리그 기준으로 순위 매긴다
export function pvpTable(
  species: Species,
  league: League,
  options: PvpOptions = {},
): readonly PvpEntry[] {
  const maxLevel = options.maxLevel ?? DEFAULT_MAX_LEVEL;
  const cacheKey = `${speciesKey(species.id, species.form)}|${league}|${maxLevel}`;
  const cached = pvpCache.get(cacheKey);
  if (cached) return cached;

  const cap = LEAGUE_CP_CAP[league];
  const rows: Omit<PvpEntry, 'rank' | 'percent'>[] = [];
  for (let atk = IV_MIN; atk <= IV_MAX; atk += 1) {
    for (let def = IV_MIN; def <= IV_MAX; def += 1) {
      for (let sta = IV_MIN; sta <= IV_MAX; sta += 1) {
        const iv: Iv = { atk, def, sta };
        const best = bestLevelUnderCap(species, iv, cap, maxLevel);
        if (!best) continue;
        rows.push({ iv, level: best.level, cp: best.cp, product: statProduct(species, iv, best.level) });
      }
    }
  }

  rows.sort((a, b) => b.product - a.product || b.cp - a.cp || ivIndex(b.iv) - ivIndex(a.iv));
  const top = rows[0]?.product ?? 0;
  const table: PvpEntry[] = rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    percent: top === 0 ? 0 : Math.round((row.product / top) * 1000) / 10,
  }));
  pvpCache.set(cacheKey, table);
  return table;
}

export function pvpRankOf(
  species: Species,
  iv: Iv,
  league: League,
  options: PvpOptions = {},
): PvpEntry | undefined {
  const target = ivIndex(iv);
  return pvpTable(species, league, options).find((entry) => ivIndex(entry.iv) === target);
}
