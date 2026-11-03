'use strict';

import { describe, expect, it } from 'vitest';
import { confirmObservation, type ScanObservation } from '../src/collection.js';
import type { ScanRecord } from '../src/types.js';

const original: ScanRecord = {
  id: 'owned-c', speciesId: 184, cp: 900, hp: 140, level: 25,
  iv: { atk: 8, def: 15, sta: 15 }, scannedAt: 10,
  nickname: '마릴리 C', nicknameLocked: true,
};

function observation(fields: Partial<ScanObservation['fields']> = {}): ScanObservation {
  return {
    id: 'observation-1', capturedAt: 20, source: 'manual', verification: 'confirmed',
    fields: { speciesId: 184, iv: { atk: 8, def: 15, sta: 15 }, ...fields },
  };
}

describe('confirmObservation', () => {
  it('preserves known metadata and the manually protected name when a rescan only confirms IV', () => {
    const result = confirmObservation([original], observation(), { kind: 'update', recordId: original.id });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual({ ...original, scannedAt: 20 });
    expect(result.observation.recordId).toBe(original.id);
    expect(result.observation.fields).not.toHaveProperty('cp');
    expect(result.observation.fields).not.toHaveProperty('hp');
    expect(result.observation.fields).not.toHaveProperty('level');
    expect(original.scannedAt).toBe(10);
  });

  it('leaves unread metadata absent on a new record instead of storing sample values', () => {
    const result = confirmObservation([], observation(), { kind: 'new', recordId: 'pokemon-1' });
    expect(result.records[0]).toEqual({
      id: 'pokemon-1', speciesId: 184, iv: { atk: 8, def: 15, sta: 15 }, scannedAt: 20,
    });
  });

  it('adds an explicitly selected separate individual even when its IV is identical', () => {
    const result = confirmObservation([original], observation(), { kind: 'new', recordId: 'pokemon-2' });
    expect(result.records.map((record) => record.id)).toEqual(['owned-c', 'pokemon-2']);
    expect(result.records[0]).toEqual(original);
    expect(result.records[1]?.iv).toEqual(original.iv);
  });

  it('only patches supplied metadata and keeps other individuals unchanged', () => {
    const other: ScanRecord = { ...original, id: 'other' };
    const result = confirmObservation([original, other], observation({ cp: 950 }), { kind: 'update', recordId: original.id });
    expect(result.records[0]).toEqual({ ...original, cp: 950, scannedAt: 20 });
    expect(result.records[1]).toEqual(other);
    expect(original.cp).toBe(900);
  });

  it('rejects unknown update targets, reused IDs, duplicate collections and an unspecified resolution', () => {
    expect(() => confirmObservation([], observation(), { kind: 'update', recordId: original.id })).toThrow(/does not exist/);
    expect(() => confirmObservation([original], observation(), { kind: 'new', recordId: original.id })).toThrow(/already exists/);
    expect(() => confirmObservation([original, original], observation(), { kind: 'update', recordId: original.id })).toThrow(/unique/);
    expect(() => confirmObservation([original], observation(), { kind: 'automatic', recordId: 'next' } as unknown as Parameters<typeof confirmObservation>[2])).toThrow(/explicit/);
  });

  it('rejects unconfirmed and invalid readings without changing the existing collection', () => {
    const before = { ...original, iv: { ...original.iv } };
    expect(() => confirmObservation([original], { ...observation(), verification: 'unverified' } as unknown as ScanObservation, { kind: 'update', recordId: original.id })).toThrow(/confirmed/);
    expect(() => confirmObservation([original], observation({ iv: { atk: 16, def: 15, sta: 15 } }), { kind: 'update', recordId: original.id })).toThrow(RangeError);
    expect(() => confirmObservation([original], observation({ level: 24.2 }), { kind: 'update', recordId: original.id })).toThrow(RangeError);
    expect(() => confirmObservation([original], observation({ cp: -1 }), { kind: 'update', recordId: original.id })).toThrow(RangeError);
    expect(original).toEqual(before);
  });

  it('rejects an update linked to a different species or known form', () => {
    expect(() => confirmObservation([original], observation({ speciesId: 150 }), { kind: 'update', recordId: original.id })).toThrow(/same species and form/);
    expect(() => confirmObservation([original], observation({ form: 'different' }), { kind: 'update', recordId: original.id })).toThrow(/same species and form/);
  });

  it('keeps confirmed observation fields independent from mutable capture input', () => {
    const reading = observation();
    const result = confirmObservation([], reading, { kind: 'new', recordId: 'pokemon-1' });
    Object.assign(reading.fields.iv, { atk: 0 });
    expect(result.records[0]?.iv.atk).toBe(8);
    expect(result.observation.fields.iv.atk).toBe(8);
    expect(Object.isFrozen(result.observation.fields.iv)).toBe(true);
  });
});
