import { parseCaptureState, parsePendingScans } from '../src/native/capture';

const state = {
  protocolVersion: 1,
  platform: 'ios',
  supportsOverlay: false,
  liveCaptureAvailable: true,
  status: 'running',
  requiresSetup: false,
};
const scan = {
  id: 'frame-1',
  source: 'ios-broadcast',
  capturedAt: 1000,
  text: 'CP 123',
  width: 720,
  height: 1280,
};

test('capture state accepts the native protocol and rejects unknown versions', () => {
  expect(parseCaptureState(JSON.stringify(state))).toEqual(state);
  expect(() =>
    parseCaptureState(JSON.stringify({ ...state, protocolVersion: 2 })),
  ).toThrow();
  expect(() =>
    parseCaptureState(JSON.stringify({ ...state, status: 'anything' })),
  ).toThrow();
});

test('native scan inbox validates bounds and identities before exposing candidates', () => {
  expect(
    parsePendingScans(JSON.stringify({ protocolVersion: 1, scans: [scan] })),
  ).toEqual([scan]);
  expect(() =>
    parsePendingScans(
      JSON.stringify({ protocolVersion: 1, scans: [scan, scan] }),
    ),
  ).toThrow();
  expect(() =>
    parsePendingScans(
      JSON.stringify({
        protocolVersion: 1,
        scans: [{ ...scan, text: 'x'.repeat(2001) }],
      }),
    ),
  ).toThrow();
  expect(() =>
    parsePendingScans(
      JSON.stringify({ protocolVersion: 1, scans: [{ ...scan, width: -1 }] }),
    ),
  ).toThrow();
});
