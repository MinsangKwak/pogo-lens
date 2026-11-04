import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { shareCollectionJSON } from '../platform/shareCollection';
import {
  acceptScanCandidate,
  cancelCandidate as cancelWorkflowCandidate,
  clearPreparedNickname,
  confirmNicknameApplied,
  confirmScanCandidate,
  createWorkflowState,
  getRenamePlan,
  prepareNickname,
  serializeCollection,
  simulateNicknameApplication,
  setNicknameProtection,
  type WorkflowState,
} from '@pogo-lens/workflow';
import {
  createOwnedRenameProposal,
  suggestOwnedNicknames,
  type ObservationFields,
  type ObservationResolution,
  type RenamePlanContext,
} from '@pogo-lens/core';
import {
  AZUMARILL,
  MEWTWO,
  MEDICHAM,
  BULBASAUR,
} from '../../../../packages/core/src/data/fixtures';
import {
  captureClient,
  unavailableCapture,
  type CaptureState,
  type NativeScan,
} from '../native/capture';
import {
  deleteCollection,
  loadCollection,
  readCollectionJSON,
  saveCollection,
} from '../storage/collection';

const species = [AZUMARILL, MEWTWO, MEDICHAM, BULBASAUR];
const defaultContext: RenamePlanContext = {
  template: '{rank}/{total} {iv}',
  dataVersion: 'fixture-v1',
};
let manualSequence = 0;

export function useLensController() {
  const [workflow, setWorkflow] = useState(createWorkflowState);
  const workflowRef = useRef(workflow);
  const [ready, setReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const storageBlockedRef = useRef(true);
  const [capture, setCapture] = useState<CaptureState>(unavailableCapture);
  const [pendingScans, setPendingScans] = useState<readonly NativeScan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const refreshId = useRef(0);

  const update = useCallback((next: WorkflowState) => {
    workflowRef.current = next;
    if (mounted.current) setWorkflow(next);
  }, []);

  const refresh = useCallback(async () => {
    const request = ++refreshId.current;
    try {
      const [status, scans] = await Promise.all([
        captureClient.getState(),
        captureClient.getPendingScans(),
      ]);
      if (!mounted.current || request !== refreshId.current) return;
      const confirmed = new Set(
        workflowRef.current.collection.observations.map(row => row.id),
      );
      setCapture(status);
      setPendingScans(scans.filter(scan => !confirmed.has(scan.id)));
    } catch {
      if (mounted.current && request === refreshId.current) {
        setError(
          '캡처 상태를 읽지 못했어요. 권한과 기기 설정을 확인해 주세요.',
        );
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void loadCollection()
      .then(collection => {
        if (cancelled) return;
        update(createWorkflowState(collection));
        const confirmed = new Set(collection.observations.map(row => row.id));
        setPendingScans(current =>
          current.filter(scan => !confirmed.has(scan.id)),
        );
        storageBlockedRef.current = false;
      })
      .catch(() => {
        if (cancelled) return;
        storageBlockedRef.current = true;
        setStorageBlocked(true);
        setError(
          '저장된 데이터의 버전이 다르거나 손상되어 열지 못했어요. 원본을 보존하고 저장을 중지했어요. 설정에서 내보내거나 초기화할 수 있어요.',
        );
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    void refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      refreshId.current += 1;
      subscription.remove();
    };
  }, [refresh, update]);

  const transact = useCallback(
    async (action: (state: WorkflowState) => WorkflowState) => {
      if (storageBlockedRef.current)
        throw new Error('저장된 데이터를 먼저 확인해 주세요.');
      if (busyRef.current)
        throw new Error('진행 중인 작업이 끝난 뒤 다시 시도해 주세요.');
      busyRef.current = true;
      setBusy(true);
      try {
        const next = action(workflowRef.current);
        await saveCollection(next.collection);
        update(next);
        setError(null);
      } catch (failure) {
        setError(
          '저장하지 못했어요. 입력값과 이름 보호 상태를 확인해 주세요. 이전 보유 기록은 유지했어요.',
        );
        throw failure;
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [update],
  );

  const nativeAction = useCallback(
    async (action: () => Promise<void>) => {
      if (busyRef.current)
        throw new Error('진행 중인 작업이 끝난 뒤 다시 시도해 주세요.');
      busyRef.current = true;
      setBusy(true);
      try {
        await action();
        setError(null);
        await refresh();
      } catch (failure) {
        setError(
          '기기에서 작업을 완료하지 못했어요. 캡처 권한과 이름을 확인해 주세요.',
        );
        throw failure;
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [refresh],
  );

  const selectScan = useCallback(
    (scan: NativeScan) => {
      if (storageBlockedRef.current || busyRef.current) return;
      const current = workflowRef.current;
      if (current.collection.observations.some(row => row.id === scan.id)) {
        setPendingScans(scans => scans.filter(row => row.id !== scan.id));
        setError('이미 확인한 캡처예요. 새 캡처를 선택해 주세요.');
        return;
      }
      try {
        update(
          acceptScanCandidate(current, {
            id: scan.id,
            capturedAt: scan.capturedAt,
            source: scan.text ? 'ocr' : 'manual',
            verification: 'unverified',
            fields: {},
            ...(scan.text ? { rawText: scan.text } : {}),
          }),
        );
      } catch {
        setError(
          '캡처 후보를 열지 못했어요. 목록을 새로고침한 뒤 다시 선택해 주세요.',
        );
      }
    },
    [update],
  );

  const beginManual = useCallback(() => {
    if (storageBlockedRef.current || busyRef.current) return;
    update(
      acceptScanCandidate(workflowRef.current, {
        id: `manual-${Date.now()}-${++manualSequence}`,
        capturedAt: Date.now(),
        source: 'manual',
        verification: 'unverified',
        fields: {},
      }),
    );
  }, [update]);

  const confirmCandidate = useCallback(
    async (fields: ObservationFields, resolution: ObservationResolution) => {
      const candidateId = workflowRef.current.candidate?.id;
      await transact(state => confirmScanCandidate(state, fields, resolution));
      setPendingScans(current =>
        current.filter(scan => scan.id !== candidateId),
      );
    },
    [transact],
  );

  const prepareName = useCallback(
    (recordId: string, nextName: string, template: string) => {
      if (storageBlockedRef.current || busyRef.current) return;
      try {
        update(
          prepareNickname(
            workflowRef.current,
            species,
            { ...defaultContext, template },
            { recordId, nextName },
          ),
        );
        setError(null);
      } catch (failure) {
        setError('이름을 보이는 문자 1~12자로 확인해 주세요.');
        throw failure;
      }
    },
    [update],
  );

  const copyPreparedName = useCallback(async () => {
    const state = workflowRef.current;
    const proposal = state.pendingRename;
    if (!proposal) throw new Error('이름 제안을 먼저 검토해 주세요.');
    const latest = createOwnedRenameProposal(
      state.collection.records,
      species,
      { ...defaultContext, template: proposal.template },
      { recordId: proposal.recordId, nextName: proposal.nextName },
    );
    const record = state.collection.records.find(
      row => row.id === proposal.recordId,
    );
    if (!record || record.nicknameLocked || proposal.status === 'locked')
      throw new Error('이름 보호를 먼저 해제해 주세요.');
    if (
      latest.snapshotKey !== proposal.snapshotKey ||
      latest.policyVersion !== proposal.policyVersion ||
      latest.dataVersion !== proposal.dataVersion
    ) {
      update(clearPreparedNickname(state));
      throw new Error(
        '보유 목록이 바뀌었어요. 이름 제안을 다시 검토해 주세요.',
      );
    }
    await nativeAction(() => captureClient.copyName(proposal.nextName));
  }, [nativeAction, update]);

  const confirmNameApplied = useCallback(
    async (protectName?: boolean) => {
      await transact(state => {
        if (!state.pendingRename)
          throw new Error('이름 제안을 먼저 검토해 주세요.');
        const proposal = state.pendingRename;
        const automatic = suggestOwnedNicknames(
          state.collection.records,
          species,
          proposal.template,
        ).find(row => row.record.id === proposal.recordId)?.suggestedNickname;
        const protect = protectName ?? proposal.nextName !== automatic;
        const next =
          Platform.OS === 'web'
            ? simulateNicknameApplication(state, species, proposal, {
                appliedAt: Date.now(),
              })
            : confirmNicknameApplied(state, species, proposal, {
                appliedAt: Date.now(),
                evidence: 'user-confirmed-in-game',
              });
        return protect
          ? setNicknameProtection(next, proposal.recordId, true)
          : next;
      });
    },
    [transact],
  );

  const resetCollection = useCallback(async () => {
    if (busyRef.current)
      throw new Error('진행 중인 작업이 끝난 뒤 다시 시도해 주세요.');
    busyRef.current = true;
    setBusy(true);
    try {
      if (
        capture.status === 'running' ||
        capture.status === 'paused' ||
        capture.status === 'starting'
      ) {
        await captureClient.stopCapture();
      }
      if (capture.status !== 'unavailable')
        await captureClient.clearPendingScans();
      await deleteCollection();
      update(createWorkflowState());
      storageBlockedRef.current = false;
      setStorageBlocked(false);
      setPendingScans([]);
      setError(null);
      await refresh();
    } catch (failure) {
      setError(
        '초기화를 완료하지 못했어요. 캡처를 중지한 뒤 다시 시도해 주세요.',
      );
      throw failure;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [capture.status, refresh, update]);

  const renameChanges = useMemo(() => {
    try {
      return getRenamePlan(workflow.collection, species, defaultContext);
    } catch {
      return [];
    }
  }, [workflow.collection]);

  return {
    ready,
    storageBlocked,
    busy,
    error,
    capture,
    pendingScans,
    species,
    renameChanges,
    collection: workflow.collection,
    candidate: workflow.candidate,
    pendingRename: workflow.pendingRename,
    nameProtectionRecommended:
      !!workflow.pendingRename &&
      workflow.pendingRename.nextName !==
        suggestOwnedNicknames(
          workflow.collection.records,
          species,
          workflow.pendingRename.template,
        ).find(row => row.record.id === workflow.pendingRename?.recordId)
          ?.suggestedNickname,
    clearError: () => setError(null),
    refresh,
    startCapture: () => nativeAction(() => captureClient.startCapture()),
    stopCapture: () => nativeAction(() => captureClient.stopCapture()),
    requestOverlayPermission: () =>
      nativeAction(() => captureClient.requestOverlayPermission()),
    selectScan,
    beginManual,
    confirmCandidate,
    prepareName,
    copyPreparedName,
    confirmNameApplied,
    cancelCandidate: () => update(cancelWorkflowCandidate(workflowRef.current)),
    clearName: () => update(clearPreparedNickname(workflowRef.current)),
    setProtection: (id: string, locked: boolean) =>
      transact(state => setNicknameProtection(state, id, locked)),
    resetCollection,
    async exportCollection(): Promise<void> {
      if (!ready) throw new Error('보유 기록을 불러오는 중이에요.');
      const raw = storageBlockedRef.current
        ? await readCollectionJSON()
        : serializeCollection(workflowRef.current.collection);
      if (raw === null) throw new Error('내보낼 저장 기록이 없어요.');
      await shareCollectionJSON(raw);
    },
  };
}
