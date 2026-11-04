import { act, renderHook } from '@testing-library/react-native';
import {
  acceptScanCandidate,
  confirmScanCandidate,
  createWorkflowState,
  type CollectionState,
} from '@pogo-lens/workflow';
import { useLensController } from '../src/controller/useLensController';
import * as storage from '../src/storage/collection';
import { captureClient, type NativeScan } from '../src/native/capture';

jest.mock('../src/storage/collection', () => ({
  loadCollection: jest.fn(),
  saveCollection: jest.fn(),
  deleteCollection: jest.fn(),
  readCollectionJSON: jest.fn(),
}));

jest.mock('../src/native/capture', () => ({
  unavailableCapture: {
    protocolVersion: 1,
    platform: 'android',
    supportsOverlay: true,
    liveCaptureAvailable: false,
    status: 'unavailable',
    requiresSetup: false,
  },
  captureClient: { getState: jest.fn(), getPendingScans: jest.fn() },
}));

const confirmedScan: NativeScan = {
  id: 'frame-confirmed',
  source: 'android-capture',
  capturedAt: 1000,
  text: '',
  width: 720,
  height: 1280,
};
const freshScan: NativeScan = {
  ...confirmedScan,
  id: 'frame-fresh',
  capturedAt: 2000,
};

function savedCollection(): CollectionState {
  return confirmScanCandidate(
    acceptScanCandidate(createWorkflowState(), {
      id: confirmedScan.id,
      capturedAt: confirmedScan.capturedAt,
      source: 'manual',
      verification: 'unverified',
      fields: {},
    }),
    { speciesId: 184, iv: { atk: 15, def: 15, sta: 15 } },
    { kind: 'new', recordId: 'pokemon-1' },
  ).collection;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(storage.loadCollection).mockReset();
  jest.mocked(captureClient.getPendingScans).mockReset();
  jest.mocked(captureClient.getState).mockResolvedValue({
    protocolVersion: 1,
    platform: 'android',
    supportsOverlay: true,
    liveCaptureAvailable: true,
    status: 'stopped',
    requiresSetup: false,
  });
});

test('hydration removes previously confirmed native scans without discarding fresh scans', async () => {
  const loading = deferred<CollectionState>();
  jest.mocked(storage.loadCollection).mockReturnValue(loading.promise);
  jest
    .mocked(captureClient.getPendingScans)
    .mockResolvedValue([confirmedScan, freshScan]);
  const hook = await renderHook(() => useLensController());
  await act(async () => {
    await Promise.resolve();
  });
  expect(hook.result.current.pendingScans).toHaveLength(2);
  expect(hook.result.current.ready).toBe(false);
  await act(async () => {
    loading.resolve(savedCollection());
  });
  expect(hook.result.current.ready).toBe(true);
  expect(hook.result.current.pendingScans.map(scan => scan.id)).toEqual([
    freshScan.id,
  ]);
  expect(storage.saveCollection).not.toHaveBeenCalled();
});

test('a stale selection callback cannot reopen an already confirmed observation or throw', async () => {
  const loading = deferred<CollectionState>();
  jest.mocked(storage.loadCollection).mockReturnValue(loading.promise);
  jest.mocked(captureClient.getPendingScans).mockResolvedValue([confirmedScan]);
  const hook = await renderHook(() => useLensController());
  await act(async () => {
    await Promise.resolve();
  });
  const staleScan = hook.result.current.pendingScans[0]!;
  await act(async () => {
    loading.resolve(savedCollection());
  });
  await act(async () => {
    expect(() => hook.result.current.selectScan(staleScan)).not.toThrow();
  });
  expect(hook.result.current.candidate).toBeNull();
  expect(hook.result.current.pendingScans).toEqual([]);
  expect(hook.result.current.error).toMatch(/이미 확인한 캡처/);
  expect(storage.saveCollection).not.toHaveBeenCalled();
});

test('a native inbox response arriving after hydration uses the loaded observation IDs', async () => {
  const inbox = deferred<readonly NativeScan[]>();
  jest.mocked(storage.loadCollection).mockResolvedValue(savedCollection());
  jest.mocked(captureClient.getPendingScans).mockReturnValue(inbox.promise);
  const hook = await renderHook(() => useLensController());
  await act(async () => {
    await Promise.resolve();
  });
  expect(hook.result.current.ready).toBe(true);
  await act(async () => {
    inbox.resolve([confirmedScan, freshScan]);
  });
  expect(hook.result.current.pendingScans.map(scan => scan.id)).toEqual([
    freshScan.id,
  ]);
});

test('malformed candidate selection reports an error instead of throwing from the UI event', async () => {
  jest.mocked(storage.loadCollection).mockResolvedValue(savedCollection());
  jest.mocked(captureClient.getPendingScans).mockResolvedValue([]);
  const hook = await renderHook(() => useLensController());
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    expect(() =>
      hook.result.current.selectScan({ ...freshScan, text: 'x'.repeat(2001) }),
    ).not.toThrow();
  });
  expect(hook.result.current.candidate).toBeNull();
  expect(hook.result.current.error).toMatch(/후보를 열지 못했어요/);
  expect(storage.saveCollection).not.toHaveBeenCalled();
});

test('failed hydration preserves the blocked state and never confirms an inbox candidate', async () => {
  const loading = deferred<CollectionState>();
  jest.mocked(storage.loadCollection).mockReturnValue(loading.promise);
  jest.mocked(captureClient.getPendingScans).mockResolvedValue([freshScan]);
  const hook = await renderHook(() => useLensController());
  await act(async () => {
    loading.reject(new Error('unsupported schema'));
  });
  await act(async () => {
    hook.result.current.selectScan(freshScan);
  });
  expect(hook.result.current.ready).toBe(true);
  expect(hook.result.current.storageBlocked).toBe(true);
  expect(hook.result.current.candidate).toBeNull();
  expect(storage.saveCollection).not.toHaveBeenCalled();
  expect(storage.deleteCollection).not.toHaveBeenCalled();
});
