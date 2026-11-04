'use strict';

import {
  COLLECTION_SCHEMA_VERSION,
  NICKNAME_MAX_LENGTH,
  OWNED_RANK_POLICY_VERSION,
  isValidLevel,
  type Iv,
  type LinkedObservation,
  type NicknameApplication,
  type ObservationFields,
  type ScanObservation,
  type ScanRecord,
} from '@pogo-lens/core';
import type { CandidateFields, CollectionState, ScanCandidate } from './types.js';

export const MAX_RECORDS = 10_000;
export const MAX_OBSERVATIONS = 50_000;
export const MAX_NICKNAME_APPLICATIONS = 50_000;
export const MAX_COLLECTION_JSON_LENGTH = 8_000_000;
export const MAX_CANDIDATE_TEXT_LENGTH = 2_000;

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 128, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error(`invalid ${label}`);
  return value;
}

function safeInteger(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`invalid ${label}`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`invalid ${label}`);
  return value;
}

function nickname(value: unknown, label: string): string {
  const result = text(value, label, NICKNAME_MAX_LENGTH * 2);
  if (Array.from(result).length > NICKNAME_MAX_LENGTH || /[\p{Cc}\p{Cf}]/u.test(result)) throw new Error(`invalid ${label}`);
  return result;
}

function source(value: unknown): ScanObservation['source'] {
  if (value !== 'manual' && value !== 'ocr' && value !== 'sample') throw new Error('invalid observation source');
  return value;
}

function iv(value: unknown): Iv {
  const entry = object(value, 'IV');
  const result = {
    atk: safeInteger(entry.atk, 'attack'),
    def: safeInteger(entry.def, 'defense'),
    sta: safeInteger(entry.sta, 'stamina'),
  };
  if ([result.atk, result.def, result.sta].some((part) => part > 15)) throw new Error('IV must be from 0 to 15');
  return Object.freeze(result);
}

// 임시값으로 빠진 항목을 채우지 않고 실제로 있는 항목만 남긴다
export function validateObservationFields(value: unknown): ObservationFields {
  const entry = object(value, 'observation fields');
  const level = entry.level === undefined ? undefined : finite(entry.level, 'level');
  if (level !== undefined && !isValidLevel(level)) throw new Error('invalid level');
  return Object.freeze({
    speciesId: safeInteger(entry.speciesId, 'species ID', 1),
    ...(entry.form === undefined ? {} : { form: text(entry.form, 'form', 128, true) }),
    iv: iv(entry.iv),
    ...(entry.cp === undefined ? {} : { cp: safeInteger(entry.cp, 'CP', 1) }),
    ...(entry.hp === undefined ? {} : { hp: safeInteger(entry.hp, 'HP', 1) }),
    ...(level === undefined ? {} : { level }),
  });
}

function candidateFields(value: unknown): CandidateFields {
  const entry = object(value, 'candidate fields');
  const reading = entry.iv === undefined ? undefined : object(entry.iv, 'candidate IV');
  return Object.freeze({
    ...(entry.speciesId === undefined ? {} : { speciesId: finite(entry.speciesId, 'candidate species ID') }),
    ...(entry.form === undefined ? {} : { form: text(entry.form, 'candidate form', 128, true) }),
    ...(reading === undefined ? {} : {
      iv: Object.freeze({
        ...(reading.atk === undefined ? {} : { atk: finite(reading.atk, 'candidate attack') }),
        ...(reading.def === undefined ? {} : { def: finite(reading.def, 'candidate defense') }),
        ...(reading.sta === undefined ? {} : { sta: finite(reading.sta, 'candidate stamina') }),
      }),
    }),
    ...(entry.cp === undefined ? {} : { cp: finite(entry.cp, 'candidate CP') }),
    ...(entry.hp === undefined ? {} : { hp: finite(entry.hp, 'candidate HP') }),
    ...(entry.level === undefined ? {} : { level: finite(entry.level, 'candidate level') }),
  });
}

// 숫자가 잘못 읽힌 후보는 검토할 수 있지만 확정된 기록으로 가장할 수 없다
export function validateScanCandidate(value: unknown): ScanCandidate {
  const entry = object(value, 'scan candidate');
  if (entry.verification !== 'unverified') throw new Error('candidate must remain unverified until user confirmation');
  const confidence = entry.confidence === undefined ? undefined : finite(entry.confidence, 'confidence');
  if (confidence !== undefined && (confidence < 0 || confidence > 1)) throw new Error('confidence must be from 0 to 1');
  return Object.freeze({
    id: text(entry.id, 'candidate ID'),
    capturedAt: safeInteger(entry.capturedAt, 'capture time'),
    source: source(entry.source),
    verification: 'unverified',
    fields: candidateFields(entry.fields),
    ...(confidence === undefined ? {} : { confidence }),
    ...(entry.rawText === undefined ? {} : { rawText: text(entry.rawText, 'raw text', MAX_CANDIDATE_TEXT_LENGTH, true) }),
  });
}

function record(value: unknown): ScanRecord {
  const entry = object(value, 'record');
  if (entry.nicknameLocked !== undefined && typeof entry.nicknameLocked !== 'boolean') throw new Error('invalid nickname protection');
  return Object.freeze({
    id: text(entry.id, 'record ID'),
    ...validateObservationFields(entry),
    scannedAt: safeInteger(entry.scannedAt, 'scan time'),
    ...(entry.nickname === undefined ? {} : { nickname: nickname(entry.nickname, 'nickname') }),
    ...(entry.nicknameLocked === undefined ? {} : { nicknameLocked: entry.nicknameLocked }),
  });
}

function observation(value: unknown): LinkedObservation {
  const entry = object(value, 'observation');
  if (entry.verification !== 'confirmed') throw new Error('stored observation must be confirmed');
  return Object.freeze({
    id: text(entry.id, 'observation ID'),
    recordId: text(entry.recordId, 'observation record ID'),
    capturedAt: safeInteger(entry.capturedAt, 'observation time'),
    source: source(entry.source),
    verification: 'confirmed',
    fields: validateObservationFields(entry.fields),
  });
}

function application(value: unknown): NicknameApplication {
  const entry = object(value, 'nickname application');
  if (entry.source !== 'user-confirmed' && entry.source !== 'web-simulation') throw new Error('invalid nickname application source');
  if (entry.policyVersion !== OWNED_RANK_POLICY_VERSION) throw new Error('unsupported nickname policy version');
  return Object.freeze({
    recordId: text(entry.recordId, 'nickname record ID'),
    ...(entry.previousName === undefined ? {} : { previousName: nickname(entry.previousName, 'previous nickname') }),
    nextName: nickname(entry.nextName, 'next nickname'),
    appliedAt: safeInteger(entry.appliedAt, 'nickname application time'),
    source: entry.source,
    policyVersion: OWNED_RANK_POLICY_VERSION,
    template: text(entry.template, 'nickname template', 512),
    dataVersion: text(entry.dataVersion, 'species data version'),
  });
}

function list(value: unknown, label: string, maximum: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} exceeds limits or is not an array`);
  return value as unknown[];
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} IDs must be unique`);
}

// 버전 불일치나 손상은 오류로 돌려주며 빈 목록으로 덮어쓰지 않는다
export function deserializeCollection(value: unknown): CollectionState {
  let decoded = value;
  if (typeof decoded === 'string') {
    if (decoded.length > MAX_COLLECTION_JSON_LENGTH) throw new Error('collection JSON exceeds limits');
    try {
      decoded = JSON.parse(decoded) as unknown;
    } catch {
      throw new Error('collection JSON is corrupt');
    }
  }
  const entry = object(decoded, 'collection');
  if (entry.schemaVersion !== COLLECTION_SCHEMA_VERSION) throw new Error('unsupported collection schema version');
  const records = list(entry.records, 'records', MAX_RECORDS).map(record);
  const observations = list(entry.observations, 'observations', MAX_OBSERVATIONS).map(observation);
  const nicknameApplications = list(entry.nicknameApplications, 'nickname applications', MAX_NICKNAME_APPLICATIONS).map(application);
  assertUnique(records.map((row) => row.id), 'record');
  assertUnique(observations.map((row) => row.id), 'observation');
  const ids = new Set(records.map((row) => row.id));
  if (observations.some((row) => !ids.has(row.recordId)) || nicknameApplications.some((row) => !ids.has(row.recordId))) {
    throw new Error('observation or nickname history references an unknown record');
  }
  const byId = new Map(records.map((row) => [row.id, row]));
  if (observations.some((row) => {
    const target = byId.get(row.recordId);
    return !target || target.speciesId !== row.fields.speciesId ||
      (row.fields.form !== undefined && (target.form ?? '') !== row.fields.form);
  })) throw new Error('observation species or form conflicts with its linked record');
  const revision = safeInteger(entry.revision, 'collection revision');
  if (revision < observations.length + nicknameApplications.length) throw new Error('collection revision is inconsistent with history');
  return Object.freeze({
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    revision,
    records: Object.freeze(records),
    observations: Object.freeze(observations),
    nicknameApplications: Object.freeze(nicknameApplications),
  });
}

// 영구 데이터만 직렬화하며 캡처 원문과 후보 및 제안은 제외한다
export function serializeCollection(collection: CollectionState): string {
  const result = JSON.stringify(deserializeCollection(collection));
  if (result.length > MAX_COLLECTION_JSON_LENGTH) throw new Error('collection JSON exceeds limits');
  return result;
}
