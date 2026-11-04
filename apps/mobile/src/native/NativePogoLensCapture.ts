import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getState(): Promise<string>;
  requestOverlayPermission(): Promise<void>;
  startCapture(): Promise<void>;
  stopCapture(): Promise<void>;
  getPendingScans(): Promise<string>;
  clearPendingScans(): Promise<void>;
  copyName(name: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('PogoLensCapture');
