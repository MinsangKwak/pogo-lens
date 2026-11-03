'use strict';

import { NICKNAME_MAX_LENGTH } from './nickname.js';
import { suggestOwnedNicknames } from './rename.js';
import { speciesKey, type ScanRecord, type Species } from './types.js';

export const OWNED_RANK_POLICY_VERSION = 'owned-iv-v1';

export interface RenamePlanContext {
  readonly template: string;
  readonly dataVersion: string;
}

export interface OwnedRenameProposal extends RenamePlanContext {
  readonly recordId: string;
  readonly currentName?: string;
  readonly nextName: string;
  readonly status: 'pending' | 'locked';
  readonly snapshotKey: string;
  readonly policyVersion: typeof OWNED_RANK_POLICY_VERSION;
}

export interface RenameApplicationContext extends RenamePlanContext {
  readonly species: readonly Species[];
  readonly appliedAt: number;
  readonly source: 'web-simulation' | 'user-confirmed';
}

export interface NicknameApplication {
  readonly recordId: string;
  readonly previousName?: string;
  readonly nextName: string;
  readonly appliedAt: number;
  readonly source: RenameApplicationContext['source'];
  readonly policyVersion: typeof OWNED_RANK_POLICY_VERSION;
  readonly template: string;
  readonly dataVersion: string;
}

function assertContext(context: RenamePlanContext): void {
  if (typeof context.template !== 'string' || !context.template.trim() || context.template.length > 512) {
    throw new Error('nickname template must be nonempty and at most 512 characters');
  }
  if (typeof context.dataVersion !== 'string' || !context.dataVersion.trim()) throw new Error('data version is required');
}

function assertNickname(name: string): void {
  if (typeof name !== 'string' || !name.trim() || Array.from(name).length > NICKNAME_MAX_LENGTH || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new Error('nickname must contain 1 to 12 visible characters');
  }
}

function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// 서명 대신 확인 이후 보유 목록과 계산 조건이 달라졌는지 검사한다
function snapshotKey(records: readonly ScanRecord[], species: readonly Species[], context: RenamePlanContext): string {
  return JSON.stringify({
    policy: OWNED_RANK_POLICY_VERSION,
    template: context.template,
    dataVersion: context.dataVersion,
    species: [...species].sort((a, b) => compareKeys(speciesKey(a.id, a.form), speciesKey(b.id, b.form))).map((entry) => [
      entry.id, entry.form ?? null, entry.name, entry.baseAtk, entry.baseDef, entry.baseSta,
    ]),
    records: [...records].sort((a, b) => compareKeys(a.id, b.id)).map((record) => [
      record.id, record.speciesId, record.form ?? null, record.iv.atk, record.iv.def, record.iv.sta,
      record.cp ?? null, record.hp ?? null, record.level ?? null, record.scannedAt,
      record.nickname ?? null, record.nicknameLocked ?? false,
    ]),
  });
}

function proposalFor(record: ScanRecord, nextName: string, key: string, context: RenamePlanContext): OwnedRenameProposal {
  assertNickname(nextName);
  return Object.freeze({
    recordId: record.id,
    ...(record.nickname === undefined ? {} : { currentName: record.nickname }),
    nextName,
    status: record.nicknameLocked ? 'locked' : 'pending',
    snapshotKey: key,
    policyVersion: OWNED_RANK_POLICY_VERSION,
    template: context.template,
    dataVersion: context.dataVersion,
  });
}

// 순위 변화로 달라질 기존 이름도 포함하며 제안만으로 기록을 바꾸지 않는다
export function planOwnedRenames(
  records: readonly ScanRecord[],
  species: readonly Species[],
  context: RenamePlanContext,
): readonly OwnedRenameProposal[] {
  assertContext(context);
  const suggestions = suggestOwnedNicknames(records, species, context.template);
  const key = snapshotKey(records, species, context);
  return suggestions.filter((suggestion) => suggestion.changed).map((suggestion) =>
    proposalFor(suggestion.record, suggestion.suggestedNickname, key, context));
}

// 직접 고친 이름도 같은 보유 목록과 계산 조건에 연결한다
export function createOwnedRenameProposal(
  records: readonly ScanRecord[],
  species: readonly Species[],
  context: RenamePlanContext,
  requested: { readonly recordId: string; readonly nextName: string },
): OwnedRenameProposal {
  assertContext(context);
  suggestOwnedNicknames(records, species, context.template);
  const record = records.find((entry) => entry.id === requested.recordId);
  if (!record) throw new Error('rename record does not exist');
  return proposalFor(record, requested.nextName, snapshotKey(records, species, context), context);
}

// 적용 직전에 보유 목록과 계산 조건 및 이름 보호 상태를 다시 검사한다
export function applyOwnedRename(
  records: readonly ScanRecord[],
  proposal: OwnedRenameProposal,
  context: RenameApplicationContext,
): { readonly records: readonly ScanRecord[]; readonly history: NicknameApplication } {
  assertContext(context);
  assertNickname(proposal.nextName);
  if (!Number.isFinite(context.appliedAt) || context.appliedAt < 0) throw new RangeError('invalid application time');
  if (context.source !== 'web-simulation' && context.source !== 'user-confirmed') throw new Error('invalid application source');
  suggestOwnedNicknames(records, context.species, context.template);
  if (proposal.policyVersion !== OWNED_RANK_POLICY_VERSION || proposal.template !== context.template ||
      proposal.dataVersion !== context.dataVersion || proposal.snapshotKey !== snapshotKey(records, context.species, context)) {
    throw new Error('rename proposal is stale; review a new proposal');
  }
  const record = records.find((entry) => entry.id === proposal.recordId);
  if (!record || record.nickname !== proposal.currentName) throw new Error('rename record changed');
  if (record.nicknameLocked || proposal.status !== 'pending') throw new Error('nickname is locked');
  const history: NicknameApplication = Object.freeze({
    recordId: record.id,
    ...(record.nickname === undefined ? {} : { previousName: record.nickname }),
    nextName: proposal.nextName,
    appliedAt: context.appliedAt,
    source: context.source,
    policyVersion: OWNED_RANK_POLICY_VERSION,
    template: context.template,
    dataVersion: context.dataVersion,
  });
  return {
    records: records.map((entry) => entry.id === record.id ? { ...entry, nickname: proposal.nextName } : entry),
    history,
  };
}
