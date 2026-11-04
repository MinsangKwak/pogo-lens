'use strict';

import { describe, expect, it } from 'vitest';
import {
  acceptScanCandidate, cancelCandidate, clearPreparedNickname, confirmNicknameApplied,
  confirmScanCandidate, createCollection, createWorkflowState, deserializeCollection,
  prepareNickname, serializeCollection, setNicknameProtection, simulateNicknameApplication,
  MAX_RECORDS,
} from '../src/index.js';

const AZUMARILL = { id: 184, name: '마릴리', baseAtk: 112, baseDef: 152, baseSta: 225 };
const fields = { speciesId: AZUMARILL.id, iv: { atk: 8, def: 15, sta: 15 } };
const context = { template: '{rank}/{total} {iv}', dataVersion: 'fixture-v1' };

function candidate(id = 'capture-1') {
  return {
    id, capturedAt: 100, source: 'ocr' as const, verification: 'unverified' as const,
    fields: { speciesId: AZUMARILL.id, iv: { atk: 16 } }, confidence: 0.4,
  };
}

function ownedState() {
  const unverified = acceptScanCandidate(createWorkflowState(), candidate());
  return confirmScanCandidate(unverified, fields, { kind: 'new', recordId: 'pokemon-1' });
}

function preparedState() {
  return prepareNickname(ownedState(), [AZUMARILL], context, { recordId: 'pokemon-1', nextName: '내 마릴리' });
}

describe('scan confirmation workflow', () => {
  it('keeps incomplete and invalid OCR values as an unverified candidate until the user corrects them', () => {
    const initial = createWorkflowState();
    const reading = acceptScanCandidate(initial, candidate());
    expect(reading.candidate?.fields.iv?.atk).toBe(16);
    expect(reading.candidate?.fields.iv?.def).toBeUndefined();
    expect(reading.collection).toEqual(createCollection());
    expect(initial.candidate).toBeNull();
    const confirmed = confirmScanCandidate(reading, fields, { kind: 'new', recordId: 'pokemon-1' });
    expect(confirmed.candidate).toBeNull();
    expect(confirmed.collection.revision).toBe(1);
    expect(confirmed.collection.records[0]?.iv).toEqual(fields.iv);
    expect(confirmed.collection.records[0]).not.toHaveProperty('cp');
    expect(confirmed.collection.observations[0]).toMatchObject({
      id: 'capture-1', source: 'ocr', verification: 'confirmed', recordId: 'pokemon-1',
    });
  });

  it('does not commit an invalid manual correction or change the input state on failure', () => {
    const reading = acceptScanCandidate(createWorkflowState(), candidate());
    const before = JSON.stringify(reading);
    expect(() => confirmScanCandidate(reading, { ...fields, iv: { atk: 16, def: 15, sta: 15 } }, { kind: 'new', recordId: 'pokemon-1' })).toThrow();
    expect(JSON.stringify(reading)).toBe(before);
  });

  it('requires an active candidate and rejects reuse of an already committed observation ID', () => {
    const initial = createWorkflowState();
    expect(() => confirmScanCandidate(initial, fields, { kind: 'new', recordId: 'pokemon-1' })).toThrow();
    const owned = ownedState();
    expect(() => {
      const replay = acceptScanCandidate(owned, candidate());
      confirmScanCandidate(replay, fields, { kind: 'update', recordId: 'pokemon-1' });
    }).toThrow();
    expect(owned.collection.observations).toHaveLength(1);
    expect(owned.collection.revision).toBe(1);
  });

  it('creates a separate individual with identical IV when the user explicitly chooses a new ID', () => {
    const reading = acceptScanCandidate(ownedState(), candidate('capture-2'));
    const confirmed = confirmScanCandidate(reading, fields, { kind: 'new', recordId: 'pokemon-2' });
    expect(confirmed.collection.records.map((record) => record.id)).toEqual(['pokemon-1', 'pokemon-2']);
    expect(confirmed.collection.observations.map((observation) => observation.recordId)).toEqual(['pokemon-1', 'pokemon-2']);
    expect(confirmed.collection.revision).toBe(2);
  });

  it('preserves known CP, HP and level when a later observation only confirms IV', () => {
    const first = confirmScanCandidate(
      acceptScanCandidate(createWorkflowState(), candidate()),
      { ...fields, cp: 900, hp: 140, level: 25 },
      { kind: 'new', recordId: 'pokemon-1' },
    );
    const updated = confirmScanCandidate(
      acceptScanCandidate(first, candidate('capture-2')), fields,
      { kind: 'update', recordId: 'pokemon-1' },
    );
    expect(updated.collection.records).toHaveLength(1);
    expect(updated.collection.records[0]).toMatchObject({ cp: 900, hp: 140, level: 25 });
    expect(updated.collection.observations).toHaveLength(2);
    expect(updated.collection.observations[1]?.fields).not.toHaveProperty('cp');
  });

  it('cancels transient work without discarding the confirmed collection', () => {
    const owned = ownedState();
    const reading = acceptScanCandidate(owned, candidate('capture-2'));
    const cancelled = cancelCandidate(reading);
    expect(cancelled.candidate).toBeNull();
    expect(cancelled.collection).toEqual(owned.collection);
    expect(cancelled.collection.revision).toBe(1);
  });
});

describe('nickname application workflow', () => {
  it('prepares a name without marking it applied, even if it is ready to copy', () => {
    const prepared = preparedState();
    expect(prepared.pendingRename?.nextName).toBe('내 마릴리');
    expect(prepared.collection.records[0]?.nickname).toBeUndefined();
    expect(prepared.collection.nicknameApplications).toEqual([]);
    expect(prepared.collection.revision).toBe(1);
    expect(clearPreparedNickname(prepared).pendingRename).toBeNull();
    expect(clearPreparedNickname(prepared).collection).toEqual(prepared.collection);
  });

  it('requires explicit game confirmation evidence before recording a real application', () => {
    const prepared = preparedState();
    const before = JSON.stringify(prepared);
    expect(() => confirmNicknameApplied(prepared, [AZUMARILL], context, {
      appliedAt: 200, evidence: 'copied-to-clipboard',
    } as unknown as Parameters<typeof confirmNicknameApplied>[3])).toThrow();
    expect(JSON.stringify(prepared)).toBe(before);
    const confirmed = confirmNicknameApplied(prepared, [AZUMARILL], context, {
      appliedAt: 200, evidence: 'user-confirmed-in-game',
    });
    expect(confirmed.collection.records[0]?.nickname).toBe('내 마릴리');
    expect(confirmed.collection.nicknameApplications[0]).toMatchObject({ recordId: 'pokemon-1', nextName: '내 마릴리', source: 'user-confirmed' });
    expect(confirmed.pendingRename).toBeNull();
    expect(confirmed.collection.revision).toBe(2);
  });

  it('records browser simulation separately from a real game confirmation', () => {
    const simulated = simulateNicknameApplication(preparedState(), [AZUMARILL], context, { appliedAt: 200 });
    expect(simulated.collection.nicknameApplications[0]?.source).toBe('web-simulation');
    expect(simulated.collection.records[0]?.nickname).toBe('내 마릴리');
    expect(simulated.pendingRename).toBeNull();
  });

  it('rejects an older proposal after another individual changes the collection', () => {
    const prepared = preparedState();
    const updated = confirmScanCandidate(
      acceptScanCandidate(prepared, candidate('capture-2')),
      { ...fields, iv: { atk: 15, def: 15, sta: 15 } },
      { kind: 'new', recordId: 'pokemon-2' },
    );
    const stale = { ...updated, pendingRename: prepared.pendingRename };
    expect(() => confirmNicknameApplied(stale, [AZUMARILL], context, { appliedAt: 300, evidence: 'user-confirmed-in-game' })).toThrow();
    expect(updated.collection.records.every((record) => record.nickname === undefined)).toBe(true);
    expect(updated.collection.nicknameApplications).toEqual([]);
  });

  it('prevents overwriting a protected name and invalidates an already prepared proposal', () => {
    const prepared = preparedState();
    const protectedState = setNicknameProtection(prepared, 'pokemon-1', true);
    expect(protectedState.collection.records[0]?.nicknameLocked).toBe(true);
    const stale = { ...protectedState, pendingRename: prepared.pendingRename };
    expect(() => simulateNicknameApplication(stale, [AZUMARILL], context, { appliedAt: 200 })).toThrow();
    expect(protectedState.collection.nicknameApplications).toEqual([]);
  });
});

describe('durable collection serialization', () => {
  it('round trips confirmed records and history without persisting candidates or pending proposals', () => {
    const simulated = simulateNicknameApplication(preparedState(), [AZUMARILL], context, { appliedAt: 200 });
    const transient = acceptScanCandidate(simulated, candidate('capture-2'));
    const serialized = serializeCollection(transient.collection);
    const restored = deserializeCollection(serialized);
    expect(restored).toEqual(simulated.collection);
    expect(serialized).not.toContain('capture-2');
    expect(serialized).not.toContain('candidate');
    expect(serialized).not.toContain('pendingRename');
    expect(createWorkflowState(restored).candidate).toBeNull();
    expect(createWorkflowState(restored).pendingRename).toBeNull();
  });

  it('rejects future schema versions and corrupted numeric data', () => {
    const collection = ownedState().collection;
    expect(() => deserializeCollection({ ...collection, schemaVersion: 2 })).toThrow();
    expect(() => deserializeCollection({ ...collection, revision: -1 })).toThrow();
    expect(() => deserializeCollection({
      ...collection, records: collection.records.map((record) => ({ ...record, iv: { atk: 16, def: 15, sta: 15 } })),
    })).toThrow();
  });

  it('rejects duplicate IDs and observation or application links to missing individuals', () => {
    const collection = ownedState().collection;
    expect(() => deserializeCollection({ ...collection, records: [...collection.records, ...collection.records] })).toThrow();
    expect(() => deserializeCollection({ ...collection, observations: [...collection.observations, ...collection.observations] })).toThrow();
    expect(() => deserializeCollection({
      ...collection, observations: collection.observations.map((observation) => ({ ...observation, recordId: 'missing' })),
    })).toThrow();
    const applied = simulateNicknameApplication(preparedState(), [AZUMARILL], context, { appliedAt: 200 }).collection;
    expect(() => deserializeCollection({
      ...applied, nicknameApplications: applied.nicknameApplications.map((entry) => ({ ...entry, recordId: 'missing' })),
    })).toThrow();
  });

  it('strips unknown capture text and screenshot fields instead of persisting private capture material', () => {
    const collection = ownedState().collection;
    const contaminated = {
      ...collection,
      candidate: { rawText: 'PRIVATE-CAPTURE-TEXT' },
      pendingRename: { nextName: 'PRIVATE-PENDING-NAME' },
      records: collection.records.map((record) => ({ ...record, screenshotUri: 'PRIVATE-SCREENSHOT-URI' })),
      observations: collection.observations.map((observation) => ({ ...observation, rawText: 'PRIVATE-OCR-TEXT' })),
    };
    const serialized = serializeCollection(contaminated);
    expect(serialized).not.toContain('PRIVATE-');
    expect(deserializeCollection(serialized)).toEqual(collection);
  });

  it('reports malformed JSON and oversized collections instead of silently resetting to an empty collection', () => {
    const collection = ownedState().collection;
    expect(() => deserializeCollection('{ broken JSON')).toThrow(/corrupt/);
    expect(() => deserializeCollection({
      ...collection, records: Array.from({ length: MAX_RECORDS + 1 }, () => collection.records[0]),
    })).toThrow(/limits/);
    expect(collection.records).toHaveLength(1);
  });
});
