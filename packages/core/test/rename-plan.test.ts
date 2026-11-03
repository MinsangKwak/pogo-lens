'use strict';

import { describe, expect, it } from 'vitest';
import {
  applyOwnedRename, createOwnedRenameProposal, planOwnedRenames,
  type RenameApplicationContext,
} from '../src/rename-plan.js';
import { AZUMARILL } from '../src/data/fixtures.js';
import type { ScanRecord } from '../src/types.js';

const context = { template: '{rank}/{total} {iv}', dataVersion: 'fixture-v1' };
const application: RenameApplicationContext = {
  ...context, species: [AZUMARILL], appliedAt: 200, source: 'web-simulation',
};
const low: ScanRecord = {
  id: 'low', speciesId: AZUMARILL.id, iv: { atk: 8, def: 15, sta: 15 },
  scannedAt: 10, nickname: '1/1 8FF',
};
const high: ScanRecord = {
  id: 'high', speciesId: AZUMARILL.id, iv: { atk: 15, def: 15, sta: 15 }, scannedAt: 20,
};

describe('owned rename plans', () => {
  it('includes existing names affected by a new higher ranked individual without applying them', () => {
    const records = [low, high];
    const before = records.map((record) => ({ ...record, iv: { ...record.iv } }));
    const plan = planOwnedRenames(records, [AZUMARILL], context);
    expect(plan.map((entry) => [entry.recordId, entry.currentName, entry.nextName, entry.status])).toEqual([
      ['high', undefined, '1/2 FFF', 'pending'],
      ['low', '1/1 8FF', '2/2 8FF', 'pending'],
    ]);
    expect(records).toEqual(before);
  });

  it('excludes unchanged names from the automatic pending list', () => {
    expect(planOwnedRenames([low], [AZUMARILL], context)).toEqual([]);
  });

  it('applies only the selected individual and records that the operation was a web simulation', () => {
    const proposal = planOwnedRenames([low, high], [AZUMARILL], context).find((entry) => entry.recordId === low.id);
    if (!proposal) throw new Error('missing fixture proposal');
    const result = applyOwnedRename([low, high], proposal, application);
    expect(result.records[0]?.nickname).toBe('2/2 8FF');
    expect(result.records[1]).toEqual(high);
    expect(result.history).toEqual({
      recordId: 'low', previousName: '1/1 8FF', nextName: '2/2 8FF', appliedAt: 200,
      source: 'web-simulation', policyVersion: 'owned-iv-v1', ...context,
    });
    expect(low.nickname).toBe('1/1 8FF');
  });

  it('revalidates collection contents, template, source data and current names before applying', () => {
    const records = [low, high];
    const proposal = createOwnedRenameProposal(records, [AZUMARILL], context, { recordId: low.id, nextName: '내 마릴리' });
    expect(() => applyOwnedRename([...records, { ...high, id: 'third' }], proposal, application)).toThrow(/stale/);
    expect(() => applyOwnedRename([{ ...low, nickname: '직접 수정' }, high], proposal, application)).toThrow(/stale/);
    expect(() => applyOwnedRename(records, proposal, { ...application, template: '{name}' })).toThrow(/stale/);
    expect(() => applyOwnedRename(records, proposal, { ...application, dataVersion: 'fixture-v2' })).toThrow(/stale/);
    expect(() => applyOwnedRename(records, proposal, { ...application, species: [{ ...AZUMARILL, name: '새 이름' }] })).toThrow(/stale/);
  });

  it('keeps a manually protected name in the plan and blocks both automatic and manual replacement', () => {
    const protectedLow = { ...low, nicknameLocked: true };
    const proposal = planOwnedRenames([protectedLow, high], [AZUMARILL], context).find((entry) => entry.recordId === low.id);
    if (!proposal) throw new Error('missing protected fixture proposal');
    expect(proposal.status).toBe('locked');
    expect(() => applyOwnedRename([protectedLow, high], proposal, application)).toThrow(/locked/);
    const manual = createOwnedRenameProposal([protectedLow], [AZUMARILL], context, { recordId: low.id, nextName: '다른 이름' });
    expect(() => applyOwnedRename([protectedLow], manual, application)).toThrow(/locked/);
    expect(() => applyOwnedRename([protectedLow], { ...manual, status: 'pending' }, application)).toThrow(/locked/);
  });

  it('detects a protection toggle after confirmation even when the requested name has not changed', () => {
    const proposal = createOwnedRenameProposal([low], [AZUMARILL], context, { recordId: low.id, nextName: '직접 이름' });
    expect(() => applyOwnedRename([{ ...low, nicknameLocked: true }], proposal, application)).toThrow(/stale/);
  });

  it('supports a user-edited name with the same snapshot safeguards and separate history', () => {
    const proposal = createOwnedRenameProposal([low], [AZUMARILL], context, { recordId: low.id, nextName: '내 마릴리' });
    const result = applyOwnedRename([low], proposal, { ...application, source: 'user-confirmed' });
    expect(result.records[0]?.nickname).toBe('내 마릴리');
    expect(result.history.previousName).toBe('1/1 8FF');
    expect(result.history.source).toBe('user-confirmed');
  });

  it('rejects invalid manual names and rechecks a tampered proposal at application time', () => {
    for (const nextName of ['', '   ', '1234567890123', 'abc\n', 'abc\u202E']) {
      expect(() => createOwnedRenameProposal([low], [AZUMARILL], context, { recordId: low.id, nextName })).toThrow(/1 to 12/);
    }
    const proposal = createOwnedRenameProposal([low], [AZUMARILL], context, { recordId: low.id, nextName: '직접 이름' });
    expect(() => applyOwnedRename([low], { ...proposal, nextName: '1234567890123' }, application)).toThrow(/1 to 12/);
    expect(() => createOwnedRenameProposal([low], [AZUMARILL], context, { recordId: 'missing', nextName: '이름' })).toThrow(/does not exist/);
  });

  it('treats input array order as irrelevant while rejecting changed numeric evidence', () => {
    const proposal = createOwnedRenameProposal([low, high], [AZUMARILL], context, { recordId: low.id, nextName: '직접 이름' });
    expect(applyOwnedRename([high, low], proposal, application).records.find((entry) => entry.id === low.id)?.nickname).toBe('직접 이름');
    expect(() => applyOwnedRename([{ ...low, iv: { atk: 9, def: 15, sta: 15 } }, high], proposal, application)).toThrow(/stale/);
  });
});
