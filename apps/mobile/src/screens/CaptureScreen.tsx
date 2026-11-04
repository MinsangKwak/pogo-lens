import React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  InfoRow,
  Notice,
  ScreenHeading,
} from '../ui/components';
import { CandidateEditor } from '../ui/CandidateEditor';
import { confirmAction } from '../ui/confirm';
import { layout } from '../ui/theme';
import type { LensController } from '../ui/types';

const statusLabels = {
  stopped: '중지됨',
  starting: '시작 중',
  running: '캡처 실행 중',
  paused: '일시 중지',
  unavailable: '설정 필요',
} as const;

export function CaptureScreen({
  controller,
  onSaved,
}: {
  controller: LensController;
  onSaved: () => void;
}) {
  const { capture, busy, storageBlocked } = controller;
  const android = Platform.OS === 'android';
  const web = Platform.OS === 'web';
  const running =
    capture.status === 'running' ||
    capture.status === 'starting' ||
    capture.status === 'paused';
  const run = (action: () => Promise<void>) => {
    action().catch(() => {});
  };
  function selectScan(scan: LensController['pendingScans'][number]) {
    if (!controller.candidate || controller.candidate.id === scan.id) {
      controller.selectScan(scan);
      return;
    }
    confirmAction(
      '다른 캡처를 확인할까요?',
      '지금 편집 중인 후보의 저장하지 않은 입력은 사라집니다.',
      () => controller.selectScan(scan),
      { cancelLabel: '이어서 확인', confirmLabel: '다른 캡처 선택' },
    );
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={layout.page}
    >
      <ScreenHeading
        eyebrow="CAPTURE · 관측하기"
        title="확인하고, 비교하고."
        description="게임에서 읽은 개체값을 확인한 뒤, 내가 가진 같은 종끼리 순위를 비교해요."
      />
      <Card>
        <View style={layout.row}>
          <View style={layout.flex}>
            <Text style={layout.label}>1 · 캡처 준비</Text>
            <Text accessibilityRole="header" style={layout.heading}>
              {web
                ? '직접 입력하고 흐름 체험'
                : android
                ? '게임 위에 작은 렌즈'
                : '실시간 방송으로 화면 읽기'}
            </Text>
          </View>
          <Badge
            label={web ? '웹 체험' : statusLabels[capture.status]}
            warning={!web && capture.status === 'unavailable'}
          />
        </View>
        <Text style={layout.body}>
          {web
            ? '브라우저에서는 개체값 입력, 실제 순위 계산, 이름 제안을 체험할 수 있어요. 권한 요청과 화면 캡처는 기기 앱에서 사용합니다.'
            : android
            ? '플로팅 버튼을 켜고 게임의 평가 화면을 열어 주세요. 캡처 권한은 Android 시스템 창에서 직접 허용합니다.'
            : 'iOS 시스템의 화면 방송 시작 버튼에서 PoGo Lens를 선택해 주세요. 다른 앱 위에 버튼을 띄우는 방식은 지원하지 않습니다.'}
        </Text>
        <InfoRow
          label="기기의 캡처 기능"
          value={
            web
              ? '웹에서 사용하지 않음'
              : capture.liveCaptureAvailable
              ? '사용 가능'
              : '설정 필요'
          }
        />
        {android && (
          <InfoRow
            label="다른 앱 위에 표시"
            value={capture.overlayGranted ? '허용됨' : '허용 필요'}
          />
        )}
        {web ? (
          <Notice text="직접 입력한 값으로 실제 계산합니다. 웹에서는 게임 화면에 접근하지 않아요." />
        ) : (
          capture.hint && <Notice text={capture.hint} />
        )}
        {android && !capture.overlayGranted && (
          <Button
            label="다른 앱 위에 표시 권한 열기"
            secondary
            disabled={busy || storageBlocked}
            onPress={() => run(controller.requestOverlayPermission)}
          />
        )}
        {!web && (
          <Button
            label={
              running
                ? '캡처 중지'
                : android
                ? '플로팅 캡처 시작'
                : 'iOS 화면 방송 시작'
            }
            disabled={
              busy ||
              (!running && (storageBlocked || !capture.liveCaptureAvailable))
            }
            busy={capture.status === 'starting'}
            onPress={() =>
              run(running ? controller.stopCapture : controller.startCapture)
            }
          />
        )}
        <Text style={layout.small}>
          캡처 원본 이미지를 보유 목록에 저장하지 않아요. OCR로 읽은 글자는 확인
          전 후보로만 표시합니다.
        </Text>
      </Card>
      {controller.candidate ? (
        <CandidateEditor
          key={controller.candidate.id}
          controller={controller}
          onSaved={onSaved}
        />
      ) : (
        <Card>
          <Text style={layout.heading}>직접 입력해도 괜찮아요.</Text>
          <Text style={layout.body}>
            캡처를 준비하지 않아도 개체값을 직접 입력해 순위와 이름 제안을
            확인할 수 있어요.
          </Text>
          <Button
            label="개체값 직접 입력"
            secondary
            disabled={busy || storageBlocked}
            onPress={controller.beginManual}
          />
          <Text style={layout.small}>
            현재 계산 데이터: 샘플 종 4종
            {web ? ' · 기록은 새로고침하면 초기화돼요.' : ''}
          </Text>
        </Card>
      )}
      {controller.pendingScans.length > 0 && (
        <Card>
          <Text accessibilityRole="header" style={layout.heading}>
            확인할 캡처 {controller.pendingScans.length}개
          </Text>
          <Text style={layout.small}>
            읽은 글자를 확인할 후보를 선택해 주세요. 기기에서 읽은 결과이며 게임
            연동 성공을 의미하지 않습니다.
          </Text>
          {controller.pendingScans.map(scan => (
            <View key={scan.id} style={layout.stack}>
              <Text style={layout.strong}>
                {new Date(scan.capturedAt).toLocaleTimeString('ko-KR')} ·{' '}
                {scan.width} × {scan.height}
              </Text>
              <Text numberOfLines={3} style={layout.small}>
                {scan.text || '읽은 글자가 없어요.'}
              </Text>
              <Button
                label={`${new Date(scan.capturedAt).toLocaleTimeString(
                  'ko-KR',
                )} 캡처 값 확인`}
                secondary
                disabled={busy || storageBlocked}
                onPress={() => selectScan(scan)}
              />
            </View>
          ))}
        </Card>
      )}
      <Notice text="게임의 특정 화면이나 버전에 대한 인식 정확도는 기기에서 확인해야 해요. 자동 탭·자동 교환·자동 이름 변경은 수행하지 않습니다." />
    </ScrollView>
  );
}
