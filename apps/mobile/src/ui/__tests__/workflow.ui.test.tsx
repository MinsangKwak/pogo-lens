import React from 'react';
import { Alert, Platform, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AZUMARILL } from '../../../../../packages/core/src/data/fixtures';
import { CandidateEditor } from '../CandidateEditor';
import { RenameDialog } from '../RenameDialog';
import { SettingsScreen } from '../../screens/SettingsScreen';
import type { LensController } from '../types';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const empty = {
  schemaVersion: 1,
  revision: 0,
  records: [],
  observations: [],
  nicknameApplications: [],
};
const candidate = {
  id: 'manual-1',
  capturedAt: 1,
  source: 'manual',
  verification: 'unverified',
  fields: {},
};
function controller(overrides: Record<string, unknown> = {}): LensController {
  return {
    ready: true,
    storageBlocked: false,
    busy: false,
    error: null,
    species: [AZUMARILL],
    collection: empty,
    candidate,
    pendingRename: null,
    renameChanges: [],
    pendingScans: [],
    capture: {
      protocolVersion: 1,
      platform: 'android',
      supportsOverlay: true,
      liveCaptureAvailable: true,
      status: 'stopped',
      requiresSetup: false,
      overlayGranted: true,
    },
    clearError: jest.fn(),
    refresh: jest.fn().mockResolvedValue(undefined),
    confirmCandidate: jest.fn().mockResolvedValue(undefined),
    cancelCandidate: jest.fn(),
    prepareName: jest.fn(),
    copyPreparedName: jest.fn().mockResolvedValue(undefined),
    confirmNameApplied: jest.fn().mockResolvedValue(undefined),
    clearName: jest.fn(),
    setProtection: jest.fn().mockResolvedValue(undefined),
    resetCollection: jest.fn().mockResolvedValue(undefined),
    exportCollection: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as LensController;
}

function button(tree: ReactTestRenderer, label: string) {
  return tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0]!;
}
async function mount(element: React.ReactElement) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(element);
  });
  return tree;
}
async function press(tree: ReactTestRenderer, label: string) {
  await act(async () => {
    await button(tree, label).props.onPress();
  });
}
async function type(tree: ReactTestRenderer, label: string, value: string) {
  await act(async () => {
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === label)!
      .props.onChangeText(value);
  });
}
async function fillIv(tree: ReactTestRenderer, atk = '15') {
  await press(tree, '마릴리');
  await type(tree, '공격 개체값', atk);
  await type(tree, '방어 개체값', '15');
  await type(tree, '체력 개체값', '15');
}

test('미확인 값과 IV 16은 저장하지 않고, 확인한 0~15 정수만 신규 저장한다', async () => {
  const service = controller();
  const saved = jest.fn();
  const tree = await mount(
    <CandidateEditor controller={service} onSaved={saved} />,
  );
  expect(
    tree.root
      .findAllByType(TextInput)
      .slice(0, 3)
      .map(node => node.props.value),
  ).toEqual(['', '', '']);
  await press(tree, '확인하고 보유 목록에 저장');
  expect(service.confirmCandidate).not.toHaveBeenCalled();
  await fillIv(tree, '16');
  await press(tree, '확인하고 보유 목록에 저장');
  expect(service.confirmCandidate).not.toHaveBeenCalled();
  await type(tree, '공격 개체값', '0');
  await press(tree, '확인하고 보유 목록에 저장');
  expect(service.confirmCandidate).toHaveBeenCalledWith(
    { speciesId: 184, iv: { atk: 0, def: 15, sta: 15 } },
    { kind: 'new', recordId: 'record-manual-1' },
  );
  expect(saved).toHaveBeenCalledTimes(1);
  await act(async () => {
    tree.unmount();
  });
});

test.each([
  ['기존 개체 1 업데이트', 'update', 'existing-1'],
  ['다른 개체예요 · 새로 추가', 'new', 'record-manual-1'],
])(
  '동일 IV는 명시적으로 %s 선택 전까지 합치거나 추가하지 않는다',
  async (label, kind, recordId) => {
    const service = controller({
      collection: {
        ...empty,
        records: [
          {
            id: 'existing-1',
            speciesId: 184,
            iv: { atk: 15, def: 15, sta: 15 },
            scannedAt: 1,
          },
        ],
      },
    });
    const tree = await mount(
      <CandidateEditor controller={service} onSaved={jest.fn()} />,
    );
    await fillIv(tree);
    await press(tree, '확인하고 보유 목록에 저장');
    expect(service.confirmCandidate).not.toHaveBeenCalled();
    await press(tree, label);
    await press(tree, '확인하고 보유 목록에 저장');
    expect(service.confirmCandidate).toHaveBeenCalledWith(expect.any(Object), {
      kind,
      recordId,
    });
    await act(async () => {
      tree.unmount();
    });
  },
);

test('복사는 적용 확인을 호출하지 않으며, 수정한 이름은 재검토 전 복사할 수 없다', async () => {
  const service = controller({
    pendingRename: {
      recordId: 'one',
      nextName: '1/1 FFF',
      status: 'pending',
      template: '{rank}/{total} {iv}',
    },
  });
  const tree = await mount(<RenameDialog controller={service} />);
  await press(tree, '이름 복사');
  expect(service.copyPreparedName).toHaveBeenCalledTimes(1);
  expect(service.confirmNameApplied).not.toHaveBeenCalled();
  await type(tree, '검토할 포켓몬 이름', '내 마릴리');
  expect(button(tree, '이름 복사').props.disabled).toBe(true);
  await press(tree, '수정한 이름 검토');
  expect(service.prepareName).toHaveBeenCalledWith(
    'one',
    '내 마릴리',
    '{rank}/{total} {iv}',
  );
  await act(async () => {
    tree.unmount();
  });
});

test('게임 적용은 별도 확인 행동이며 13자 이름 제안은 거부한다', async () => {
  const service = controller({
    pendingRename: {
      recordId: 'one',
      nextName: '1/1 FFF',
      status: 'pending',
      template: 'template',
    },
  });
  const tree = await mount(<RenameDialog controller={service} />);
  await press(tree, '게임에서 적용했어요');
  expect(service.confirmNameApplied).toHaveBeenCalledTimes(1);
  await type(tree, '검토할 포켓몬 이름', '1234567890123');
  await press(tree, '수정한 이름 검토');
  expect(service.prepareName).not.toHaveBeenCalled();
  expect(button(tree, '게임에서 적용했어요').props.disabled).toBe(true);
  await act(async () => {
    tree.unmount();
  });
});

test('손상 원본은 내보낼 수 있고 전체 삭제는 명시적 Alert 확인을 거친다', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const service = controller({ storageBlocked: true });
  const tree = await mount(<SettingsScreen controller={service} />);
  await press(tree, '읽지 못한 원본 JSON 내보내기');
  expect(service.exportCollection).toHaveBeenCalledTimes(1);
  await press(tree, '이 기기의 보유 기록 전체 삭제');
  expect(service.resetCollection).not.toHaveBeenCalled();
  const actions = alert.mock.calls[0]![2]!;
  expect(actions[0]!.style).toBe('cancel');
  expect(actions[1]!.style).toBe('destructive');
  await act(async () => {
    actions[1]!.onPress?.();
  });
  expect(service.resetCollection).toHaveBeenCalledTimes(1);
  alert.mockRestore();
  await act(async () => {
    tree.unmount();
  });
});

test('웹 이름 연습은 비어 있거나 다른 입력을 거부하고, 보호 선택을 명시적으로 전달한다', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  const service = controller({
    nameProtectionRecommended: true,
    pendingRename: {
      recordId: 'one',
      nextName: '내 마릴리',
      status: 'pending',
      template: 'template',
    },
  });
  const tree = await mount(<RenameDialog controller={service} />);
  try {
    await press(tree, '웹에서 적용 연습');
    expect(service.confirmNameApplied).not.toHaveBeenCalled();
    await type(tree, '웹 연습용 이름 입력', '다른 이름');
    await press(tree, '웹에서 적용 연습');
    expect(service.confirmNameApplied).not.toHaveBeenCalled();
    await press(tree, '연습용 입력란에 제안 채우기');
    await press(tree, '웹에서 적용 연습');
    expect(service.confirmNameApplied).toHaveBeenCalledWith(true);
  } finally {
    await act(async () => {
      tree.unmount();
    });
    platform.restore();
  }
});

test('보호 중인 이름은 복사와 적용 확인 버튼이 비활성 상태다', async () => {
  const service = controller({
    pendingRename: {
      recordId: 'one',
      nextName: '보호 이름',
      status: 'locked',
      template: 'template',
    },
  });
  const tree = await mount(<RenameDialog controller={service} />);
  expect(button(tree, '이름 복사').props.disabled).toBe(true);
  expect(button(tree, '게임에서 적용했어요').props.disabled).toBe(true);
  expect(service.copyPreparedName).not.toHaveBeenCalled();
  expect(service.confirmNameApplied).not.toHaveBeenCalled();
  await act(async () => {
    tree.unmount();
  });
});
