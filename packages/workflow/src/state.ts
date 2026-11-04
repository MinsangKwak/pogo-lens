'use strict';

import {
  COLLECTION_SCHEMA_VERSION,
  applyOwnedRename,
  confirmObservation,
  createOwnedRenameProposal,
  planOwnedRenames,
  speciesKey,
  type NicknameApplication,
  type ObservationFields,
  type ObservationResolution,
  type OwnedRenameProposal,
  type RenamePlanContext,
  type ScanRecord,
  type Species,
} from '@pogo-lens/core';
import {
  MAX_NICKNAME_APPLICATIONS,
  MAX_OBSERVATIONS,
  MAX_RECORDS,
  deserializeCollection,
  validateObservationFields,
  validateScanCandidate,
} from './serialization.js';
import type { CollectionState, ScanCandidate, WorkflowState } from './types.js';

export function createCollection(): CollectionState {
  return Object.freeze({
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    revision: 0,
    records: Object.freeze([]),
    observations: Object.freeze([]),
    nicknameApplications: Object.freeze([]),
  });
}

export function createWorkflowState(collection: CollectionState = createCollection()): WorkflowState {
  return Object.freeze({ collection: deserializeCollection(collection), candidate: null, pendingRename: null });
}

function nextRevision(collection: CollectionState): number {
  if (!Number.isSafeInteger(collection.revision) || collection.revision < 0 || collection.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('collection revision exhausted or corrupt');
  }
  return collection.revision + 1;
}

function updateCollection(
  state: WorkflowState,
  updates: Partial<Pick<CollectionState, 'records' | 'observations' | 'nicknameApplications'>>,
): CollectionState {
  return Object.freeze({
    ...state.collection,
    ...updates,
    revision: nextRevision(state.collection),
  });
}

// 새 후보가 도착해도 사용자가 확인하기 전에는 보유 목록과 적용 이력을 바꾸지 않는다
export function acceptScanCandidate(state: WorkflowState, candidate: ScanCandidate): WorkflowState {
  const next = validateScanCandidate(candidate);
  if (state.collection.observations.some((entry) => entry.id === next.id)) throw new Error('observation ID was already confirmed');
  return Object.freeze({ ...state, candidate: next, pendingRename: null });
}

export function cancelCandidate(state: WorkflowState): WorkflowState {
  return Object.freeze({ ...state, candidate: null, pendingRename: null });
}

export function getDuplicateCandidates(collection: CollectionState, fields: ObservationFields): readonly ScanRecord[] {
  const checked = validateObservationFields(fields);
  return collection.records.filter((record) =>
    speciesKey(record.speciesId, record.form) === speciesKey(checked.speciesId, checked.form) &&
    record.iv.atk === checked.iv.atk && record.iv.def === checked.iv.def && record.iv.sta === checked.iv.sta);
}

// 사용자 확인과 새 개체 또는 기존 개체 선택을 한 번의 동기 변경으로 처리한다
export function confirmScanCandidate(
  state: WorkflowState,
  confirmedFields: ObservationFields,
  resolution: ObservationResolution,
): WorkflowState {
  if (!state.candidate) throw new Error('no scan candidate to confirm');
  const candidate = validateScanCandidate(state.candidate);
  const fields = validateObservationFields(confirmedFields);
  if (state.collection.observations.some((entry) => entry.id === candidate.id)) throw new Error('observation ID was already confirmed');
  if (state.collection.observations.length >= MAX_OBSERVATIONS) throw new Error('observation limit reached');
  if (resolution.kind === 'new' && state.collection.records.length >= MAX_RECORDS) throw new Error('record limit reached');
  const previous = state.collection.records.find((record) => record.id === resolution.recordId);
  if (resolution.kind === 'update' && previous && candidate.capturedAt < previous.scannedAt) {
    throw new Error('scan candidate is older than the current record');
  }
  const result = confirmObservation(state.collection.records, {
    id: candidate.id,
    capturedAt: candidate.capturedAt,
    source: candidate.source,
    verification: 'confirmed',
    fields,
  }, resolution);
  const collection = updateCollection(state, {
    records: Object.freeze([...result.records]),
    observations: Object.freeze([...state.collection.observations, result.observation]),
  });
  return Object.freeze({ collection, candidate: null, pendingRename: null });
}

export function getRenamePlan(
  collection: CollectionState,
  species: readonly Species[],
  context: RenamePlanContext,
): readonly OwnedRenameProposal[] {
  return planOwnedRenames(collection.records, species, context);
}

export function prepareNickname(
  state: WorkflowState,
  species: readonly Species[],
  context: RenamePlanContext,
  requested: { readonly recordId: string; readonly nextName: string },
): WorkflowState {
  return Object.freeze({
    ...state,
    pendingRename: createOwnedRenameProposal(state.collection.records, species, context, requested),
  });
}

export function clearPreparedNickname(state: WorkflowState): WorkflowState {
  return Object.freeze({ ...state, pendingRename: null });
}

function applyPreparedNickname(
  state: WorkflowState,
  species: readonly Species[],
  context: RenamePlanContext,
  appliedAt: number,
  source: NicknameApplication['source'],
): WorkflowState {
  if (!state.pendingRename) throw new Error('no reviewed nickname proposal');
  if (!Number.isSafeInteger(appliedAt) || appliedAt < 0) throw new Error('invalid nickname application time');
  if (state.collection.nicknameApplications.length >= MAX_NICKNAME_APPLICATIONS) throw new Error('nickname history limit reached');
  const result = applyOwnedRename(state.collection.records, state.pendingRename, {
    ...context, species, appliedAt, source,
  });
  const collection = updateCollection(state, {
    records: Object.freeze(result.records.map((record) => Object.freeze(record))),
    nicknameApplications: Object.freeze([...state.collection.nicknameApplications, result.history]),
  });
  return Object.freeze({ ...state, collection, pendingRename: null });
}

// 복사나 키보드 전송은 적용 증거가 아니며 게임에서 바뀐 값을 사용자가 확인해야 한다
export function confirmNicknameApplied(
  state: WorkflowState,
  species: readonly Species[],
  context: RenamePlanContext,
  confirmation: { readonly appliedAt: number; readonly evidence: 'user-confirmed-in-game' },
): WorkflowState {
  if (confirmation.evidence !== 'user-confirmed-in-game') throw new Error('explicit in-game user confirmation is required');
  return applyPreparedNickname(state, species, context, confirmation.appliedAt, 'user-confirmed');
}

// 웹 연습의 이력은 실제 게임 적용 이력과 출처를 구분한다
export function simulateNicknameApplication(
  state: WorkflowState,
  species: readonly Species[],
  context: RenamePlanContext,
  simulation: { readonly appliedAt: number },
): WorkflowState {
  return applyPreparedNickname(state, species, context, simulation.appliedAt, 'web-simulation');
}

export function setNicknameProtection(state: WorkflowState, recordId: string, locked: boolean): WorkflowState {
  if (typeof locked !== 'boolean') throw new Error('invalid nickname protection');
  const target = state.collection.records.find((record) => record.id === recordId);
  if (!target) throw new Error('nickname protection record does not exist');
  if ((target.nicknameLocked ?? false) === locked) return state;
  const records = state.collection.records.map((record) => record.id === recordId ? Object.freeze({ ...record, nicknameLocked: locked }) : record);
  return Object.freeze({
    ...state,
    collection: updateCollection(state, { records: Object.freeze(records) }),
    pendingRename: null,
  });
}
