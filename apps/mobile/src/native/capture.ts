import { Platform } from 'react-native';
import bridge from './NativePogoLensCapture';
import type { CaptureState, NativeScan } from './captureTypes';

export type { CaptureState, NativeScan } from './captureTypes';

export const unavailableCapture: CaptureState = {
  protocolVersion: 1,
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  supportsOverlay: Platform.OS === 'android',
  liveCaptureAvailable: false,
  status: 'unavailable',
  requiresSetup: true,
  hint: '캡처 모듈이 포함된 기기 빌드가 필요해요. 개체값은 직접 입력할 수 있어요.',
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('잘못된 캡처 응답이에요.');
  return value as Record<string, unknown>;
}

function readJSON(value: string): Record<string, unknown> {
  if (value.length > 100_000) throw new Error('캡처 응답이 너무 커요.');
  const data = object(JSON.parse(value));
  if (data.protocolVersion !== 1)
    throw new Error('지원하지 않는 캡처 모듈 버전이에요.');
  return data;
}

export function parseCaptureState(value: string): CaptureState {
  const data = readJSON(value);
  if (
    !['android', 'ios'].includes(String(data.platform)) ||
    !['stopped', 'starting', 'running', 'paused', 'unavailable'].includes(
      String(data.status),
    ) ||
    ['supportsOverlay', 'liveCaptureAvailable', 'requiresSetup'].some(
      key => typeof data[key] !== 'boolean',
    ) ||
    (data.hint !== undefined &&
      (typeof data.hint !== 'string' || data.hint.length > 2000)) ||
    (data.overlayGranted !== undefined &&
      typeof data.overlayGranted !== 'boolean')
  ) {
    throw new Error('잘못된 캡처 상태예요.');
  }
  return data as unknown as CaptureState;
}

export function parsePendingScans(value: string): readonly NativeScan[] {
  const data = readJSON(value);
  if (!Array.isArray(data.scans) || data.scans.length > 20)
    throw new Error('잘못된 캡처 대기 목록이에요.');
  const ids = new Set<string>();
  return data.scans.map((entry: unknown) => {
    const scan = object(entry);
    if (
      typeof scan.id !== 'string' ||
      !scan.id ||
      scan.id.length > 128 ||
      ids.has(scan.id) ||
      !['android-capture', 'ios-broadcast'].includes(String(scan.source)) ||
      !Number.isSafeInteger(scan.capturedAt) ||
      Number(scan.capturedAt) < 0 ||
      typeof scan.text !== 'string' ||
      scan.text.length > 2000 ||
      !Number.isInteger(scan.width) ||
      Number(scan.width) <= 0 ||
      Number(scan.width) > 20_000 ||
      !Number.isInteger(scan.height) ||
      Number(scan.height) <= 0 ||
      Number(scan.height) > 20_000
    ) {
      throw new Error('잘못된 캡처 후보예요.');
    }
    ids.add(scan.id);
    return scan as unknown as NativeScan;
  });
}

function requireBridge() {
  if (!bridge) throw new Error(unavailableCapture.hint);
  return bridge;
}

export const captureClient = {
  async getState(): Promise<CaptureState> {
    return bridge
      ? parseCaptureState(await bridge.getState())
      : unavailableCapture;
  },
  async getPendingScans(): Promise<readonly NativeScan[]> {
    return bridge ? parsePendingScans(await bridge.getPendingScans()) : [];
  },
  async requestOverlayPermission(): Promise<void> {
    await requireBridge().requestOverlayPermission();
  },
  async startCapture(): Promise<void> {
    await requireBridge().startCapture();
  },
  async stopCapture(): Promise<void> {
    await requireBridge().stopCapture();
  },
  async clearPendingScans(): Promise<void> {
    await requireBridge().clearPendingScans();
  },
  async copyName(name: string): Promise<void> {
    if (
      !name.trim() ||
      Array.from(name).length > 12 ||
      /[\p{Cc}\p{Cf}]/u.test(name)
    ) {
      throw new Error('이름을 보이는 문자 1~12자로 확인해 주세요.');
    }
    await requireBridge().copyName(name);
  },
};
