'use strict';

import type {
  COLLECTION_SCHEMA_VERSION,
  LinkedObservation,
  NicknameApplication,
  OwnedRenameProposal,
  ScanObservation,
  ScanRecord,
} from '@pogo-lens/core';

export interface CollectionState {
  readonly schemaVersion: typeof COLLECTION_SCHEMA_VERSION;
  readonly revision: number;
  readonly records: readonly ScanRecord[];
  readonly observations: readonly LinkedObservation[];
  readonly nicknameApplications: readonly NicknameApplication[];
}

export interface CandidateFields {
  readonly speciesId?: number;
  readonly form?: string;
  readonly iv?: {
    readonly atk?: number;
    readonly def?: number;
    readonly sta?: number;
  };
  readonly cp?: number;
  readonly hp?: number;
  readonly level?: number;
}

// 캡처 후보는 저장된 개체와 별개이며 사용자 확인 전에는 계산에 넣지 않는다
export interface ScanCandidate {
  readonly id: string;
  readonly capturedAt: number;
  readonly source: ScanObservation['source'];
  readonly verification: 'unverified';
  readonly fields: CandidateFields;
  readonly confidence?: number;
  readonly rawText?: string;
}

// 후보와 이름 제안은 휘발성 상태로만 유지한다
export interface WorkflowState {
  readonly collection: CollectionState;
  readonly candidate: ScanCandidate | null;
  readonly pendingRename: OwnedRenameProposal | null;
}
