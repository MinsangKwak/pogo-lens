import type { useLensController } from '../controller/useLensController';

export type LensController = ReturnType<typeof useLensController>;
export type Tab = 'capture' | 'collection' | 'settings';
export const DEFAULT_TEMPLATE = '{rank}/{total} {iv}';
