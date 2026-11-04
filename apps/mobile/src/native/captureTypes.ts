export interface CaptureState {
  readonly protocolVersion: 1;
  readonly platform: 'android' | 'ios' | 'web';
  readonly supportsOverlay: boolean;
  readonly liveCaptureAvailable: boolean;
  readonly status: 'stopped' | 'starting' | 'running' | 'paused' | 'unavailable';
  readonly requiresSetup: boolean;
  readonly hint?: string;
  readonly overlayGranted?: boolean;
}

export interface NativeScan {
  readonly id: string;
  readonly source: 'android-capture' | 'ios-broadcast';
  readonly capturedAt: number;
  readonly text: string;
  readonly width: number;
  readonly height: number;
}
