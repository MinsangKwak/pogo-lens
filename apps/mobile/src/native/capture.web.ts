import type {CaptureState, NativeScan} from './captureTypes';

export type {CaptureState, NativeScan} from './captureTypes';

export const unavailableCapture: CaptureState = Object.freeze({
  protocolVersion: 1,
  platform: 'web',
  supportsOverlay: false,
  liveCaptureAvailable: false,
  status: 'unavailable',
  requiresSetup: false,
  hint: '웹에서는 실시간 화면 캡처와 오버레이를 실행하지 않아요. 개체값을 직접 입력해 실제 순위와 이름 계산을 테스트할 수 있어요.',
});

async function unsupported(): Promise<void> {
  throw new Error('실시간 화면 캡처와 오버레이는 설치한 Android 또는 iOS 앱에서 사용할 수 있어요. 웹에서는 개체값 직접 입력을 선택해 주세요.');
}

export const captureClient = {
  async getState(): Promise<CaptureState> { return unavailableCapture; },
  async getPendingScans(): Promise<readonly NativeScan[]> { return []; },
  requestOverlayPermission: unsupported,
  startCapture: unsupported,
  stopCapture: unsupported,
  async clearPendingScans(): Promise<void> {},
  async copyName(name: string): Promise<void> {
    if (!name.trim() || Array.from(name).length > 12 || /[\p{Cc}\p{Cf}]/u.test(name)) {
      throw new Error('이름을 보이는 문자 1~12자로 확인해 주세요.');
    }
    if (!navigator.clipboard?.writeText) throw new Error('이 브라우저에서는 클립보드 복사가 제한돼요. 이름을 직접 선택해 복사해 주세요.');
    await navigator.clipboard.writeText(name);
  },
};
