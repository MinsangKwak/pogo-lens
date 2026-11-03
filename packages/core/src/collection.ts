'use strict';

import { assertIv, assertLevel } from './validation.js';
import { speciesKey, type Iv, type Level, type ScanRecord } from './types.js';

export const COLLECTION_SCHEMA_VERSION = 1;

export interface ObservationFields {
  readonly speciesId: number;
  readonly form?: string;
  readonly iv: Iv;
  readonly cp?: number;
  readonly hp?: number;
  readonly level?: Level;
}

export interface ScanObservation {
  readonly id: string;
  readonly capturedAt: number;
  readonly source: 'sample' | 'manual' | 'ocr';
  readonly verification: 'confirmed';
  readonly fields: ObservationFields;
}

export interface LinkedObservation extends ScanObservation {
  readonly recordId: string;
}

export interface ObservationResolution {
  readonly kind: 'new' | 'update';
  readonly recordId: string;
}

export interface ObservationResult {
  readonly records: readonly ScanRecord[];
  readonly observation: LinkedObservation;
}

function assertIdentifier(value: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error('ID must be nonempty');
}

// 같은 IV만으로 개체를 합치지 않고 사용자가 선택한 고정 ID에만 연결한다
export function confirmObservation(
  records: readonly ScanRecord[],
  observation: ScanObservation,
  resolution: ObservationResolution,
): ObservationResult {
  assertIdentifier(observation.id);
  assertIdentifier(resolution.recordId);
  if (observation.verification !== 'confirmed') throw new Error('observation must be user-confirmed');
  if (!['sample', 'manual', 'ocr'].includes(observation.source)) throw new Error('invalid observation source');
  if (!Number.isFinite(observation.capturedAt) || observation.capturedAt < 0) throw new RangeError('invalid capture time');
  const fields = observation.fields;
  if (!Number.isInteger(fields.speciesId) || fields.speciesId <= 0) throw new RangeError('invalid species ID');
  if (fields.form !== undefined && typeof fields.form !== 'string') throw new Error('invalid form');
  assertIv(fields.iv);
  for (const value of [fields.cp, fields.hp]) {
    if (value !== undefined && (!Number.isInteger(value) || value <= 0)) throw new RangeError('known CP and HP must be positive integers');
  }
  if (fields.level !== undefined) assertLevel(fields.level);
  const ids = new Set<string>();
  for (const record of records) {
    assertIdentifier(record.id);
    if (ids.has(record.id)) throw new Error('record IDs must be unique');
    ids.add(record.id);
  }
  const previous = records.find((record) => record.id === resolution.recordId);
  if (resolution.kind === 'new' && previous) throw new Error('new record ID already exists');
  if (resolution.kind === 'update' && !previous) throw new Error('update record does not exist');
  if (resolution.kind !== 'new' && resolution.kind !== 'update') throw new Error('explicit resolution required');
  if (previous && (previous.speciesId !== fields.speciesId ||
      (fields.form !== undefined && speciesKey(previous.speciesId, previous.form) !== speciesKey(fields.speciesId, fields.form)))) {
    throw new Error('update must refer to the same species and form');
  }
  const knownFields = {
    speciesId: fields.speciesId,
    ...(fields.form === undefined ? {} : { form: fields.form }),
    iv: Object.freeze({ ...fields.iv }),
    ...(fields.cp === undefined ? {} : { cp: fields.cp }),
    ...(fields.hp === undefined ? {} : { hp: fields.hp }),
    ...(fields.level === undefined ? {} : { level: fields.level }),
  };
  const record: ScanRecord = Object.freeze({
    ...previous,
    ...knownFields,
    id: resolution.recordId,
    scannedAt: observation.capturedAt,
  });
  const linked: LinkedObservation = Object.freeze({
    id: observation.id,
    capturedAt: observation.capturedAt,
    source: observation.source,
    verification: observation.verification,
    fields: Object.freeze({ ...knownFields, iv: Object.freeze({ ...fields.iv }) }),
    recordId: resolution.recordId,
  });
  return {
    records: previous ? records.map((entry) => entry.id === record.id ? record : entry) : [...records, record],
    observation: linked,
  };
}
