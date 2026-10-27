'use strict';

import { renderNickname } from './nickname.js';
import { rankOwned, type OwnedRank } from './rank.js';
import type { ScanRecord, Species } from './types.js';
import { speciesKey } from './types.js';

export interface RenameSuggestion extends OwnedRank {
  readonly suggestedNickname: string;
  readonly changed: boolean;
}

// 확정된 스캔 전체를 받아 종과 폼별 순위 및 이름 미리보기를 함께 계산한다
export function suggestOwnedNicknames(
  records: readonly ScanRecord[],
  species: readonly Species[],
  template = '{rank}/{total} {iv}',
): RenameSuggestion[] {
  const ids = new Set<string>();
  for (const record of records) {
    if (!record.id || ids.has(record.id)) throw new Error('scan IDs must be unique');
    ids.add(record.id);
  }
  const names = new Map(species.map((entry) => [speciesKey(entry.id, entry.form), entry.name]));
  return rankOwned(records).map((entry) => {
    const record = entry.record;
    const name = names.get(speciesKey(record.speciesId, record.form));
    if (name === undefined) throw new Error(`unknown species: ${record.speciesId}`);
    const suggestedNickname = renderNickname(template, {
      speciesName: name,
      iv: record.iv,
      level: record.level,
      ownedRank: entry.rank,
      ownedTotal: entry.total,
    });
    return { ...entry, suggestedNickname, changed: record.nickname !== suggestedNickname };
  });
}
