import React, { useState } from 'react';
import { Platform, ScrollView, Text } from 'react-native';
import { Button, Card, InfoRow, Notice, ScreenHeading } from '../ui/components';
import { confirmAction } from '../ui/confirm';
import { layout } from '../ui/theme';
import type { LensController } from '../ui/types';

export function SettingsScreen({ controller }: { controller: LensController }) {
  const web = Platform.OS === 'web';
  const [exportError, setExportError] = useState('');
  const run = (action: () => Promise<void>) => {
    action().catch(() => {});
  };
  async function exportData() {
    setExportError('');
    try {
      await controller.exportCollection();
    } catch {
      setExportError(
        '기록을 내보내지 못했어요. 공유 앱과 저장된 원본을 확인해 주세요.',
      );
    }
  }
  function reset() {
    confirmAction(
      '보유 기록을 모두 삭제할까요?',
      `${
        web ? '이 탭의' : '이 기기에 저장한'
      } 보유 목록, 확인 기록, 이름 적용 이력을 삭제합니다. 삭제한 기록은 되돌릴 수 없어요.`,
      () => run(controller.resetCollection),
      { confirmLabel: '모두 삭제', destructive: true },
    );
  }
  return (
    <ScrollView contentContainerStyle={layout.page}>
      <ScreenHeading
        eyebrow="SETTINGS · 내 기기와 데이터"
        title="상태는 분명하게."
        description="캡처 권한과 저장 상태를 확인하고, 내가 저장한 기록을 관리해요."
      />
      {controller.storageBlocked && (
        <Notice
          error
          text="저장된 데이터를 읽지 못해 저장을 멈췄어요. 기존 데이터를 덮어쓰지 않습니다. 앱을 다시 열어 확인하거나, 아래에서 직접 전체 삭제를 선택할 수 있어요."
        />
      )}
      <Card>
        <Text accessibilityRole="header" style={layout.heading}>
          기기 상태
        </Text>
        <InfoRow
          label="플랫폼"
          value={
            web
              ? 'Web · 수동 입력 체험'
              : Platform.OS === 'ios'
              ? 'iOS · 화면 방송'
              : 'Android · 플로팅 캡처'
          }
        />
        <InfoRow
          label="실시간 캡처"
          value={
            web
              ? '웹에서 사용하지 않음'
              : controller.capture.liveCaptureAvailable
              ? '사용 가능'
              : '설정 필요'
          }
        />
        <InfoRow
          label="저장 상태"
          value={
            web
              ? '탭 메모리 · 새로고침 시 초기화'
              : controller.storageBlocked
              ? '읽기 오류 · 저장 중단'
              : controller.ready
              ? '기기 저장 사용 중'
              : '확인 중'
          }
        />
        <InfoRow
          label="저장된 개체"
          value={`${controller.collection.records.length}개`}
        />
        <InfoRow
          label={web ? '웹 이름 입력 연습' : '사용자 이름 적용 확인'}
          value={`${controller.collection.nicknameApplications.length}회`}
        />
        {!web && controller.capture.hint && (
          <Notice text={controller.capture.hint} />
        )}
        <Button
          label="권한과 캡처 상태 다시 확인"
          secondary
          disabled={controller.busy}
          onPress={() => run(controller.refresh)}
        />
      </Card>
      <Card>
        <Text accessibilityRole="header" style={layout.heading}>
          보유 기록 관리
        </Text>
        <Text style={layout.body}>
          {web
            ? '이 탭의 메모리에서만 보유 기록을 유지합니다. 새로고침하면 초기화돼요. 필요한 기록은 JSON으로 다운로드해 주세요.'
            : '보유 기록은 기기에 저장됩니다. 내보내기를 선택하면 JSON 기록을 시스템 공유 화면으로 전달해요.'}
        </Text>
        {controller.storageBlocked && (
          <Text style={layout.small}>
            읽지 못한 저장 원본을 그대로 내보내 보관할 수 있어요. 내보내기는
            원본을 수정하거나 복구하지 않습니다.
          </Text>
        )}
        {exportError ? <Notice text={exportError} error /> : null}
        <Button
          label={
            web
              ? '보유 기록 JSON 다운로드'
              : controller.storageBlocked
              ? '읽지 못한 원본 JSON 내보내기'
              : '보유 기록 JSON 내보내기'
          }
          secondary
          disabled={controller.busy || !controller.ready}
          onPress={() => {
            exportData();
          }}
        />
        <Button
          label="이 기기의 보유 기록 전체 삭제"
          danger
          disabled={controller.busy || !controller.ready}
          onPress={reset}
        />
      </Card>
      <Card>
        <Text accessibilityRole="header" style={layout.heading}>
          알아 두기
        </Text>
        <Text style={layout.body}>
          현재는 샘플 종 4종의 데이터로 보유 IV 순위를 계산합니다. 전체 포켓몬
          데이터와 배틀 리그 순위를 제공하는 버전은 아닙니다.
        </Text>
        <Text style={layout.body}>
          {web
            ? '입력한 값은 확인해야 보유 목록에 반영됩니다. 웹 이름 입력 연습은 이 탭의 기록만 바꾸며 실제 게임 적용 기록으로 저장하지 않습니다.'
            : '캡처 후보는 직접 확인해야 저장됩니다. 이름은 복사한 뒤 게임에서 직접 붙여 넣고, 적용 확인을 눌러야 기록이 바뀝니다.'}
        </Text>
        <Text style={layout.body}>
          자동 탭, 자동 이름 변경, 자동 교환은 지원하지 않아요. 다른 앱의
          비밀번호나 계정 연결을 요구하지 않습니다.
        </Text>
        <Text style={layout.small}>PoGo Lens · 개인 개발 프로젝트</Text>
      </Card>
    </ScrollView>
  );
}
