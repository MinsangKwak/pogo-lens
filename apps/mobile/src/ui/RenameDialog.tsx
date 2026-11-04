import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, InfoRow, Notice } from './components';
import { colors, layout } from './theme';
import type { LensController } from './types';

export function RenameDialog({ controller }: { controller: LensController }) {
  const proposal = controller.pendingRename!;
  const [name, setName] = useState(proposal.nextName);
  const [attempted, setAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [practiceName, setPracticeName] = useState('');
  const [practiceError, setPracticeError] = useState('');
  const [protectAfterApply, setProtectAfterApply] = useState(
    !!controller.nameProtectionRecommended,
  );
  const web = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const length = Array.from(name).length;
  const invalid = !name.trim() || length > 12 || /[\p{Cc}\p{Cf}]/u.test(name);
  const changed = name !== proposal.nextName;
  const locked = proposal.status === 'locked';

  function review() {
    setAttempted(true);
    if (invalid) return;
    try {
      controller.prepareName(proposal.recordId, name.trim(), proposal.template);
    } catch {
      // 검토 오류는 공통 오류 영역에 표시한다
    }
  }

  async function copy() {
    try {
      await controller.copyPreparedName();
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function confirm() {
    if (web && practiceName !== proposal.nextName) {
      setPracticeError(
        practiceName
          ? '검토한 이름과 일치하도록 입력해 주세요.'
          : '연습용 입력란에 검토한 이름을 입력해 주세요.',
      );
      return;
    }
    try {
      await controller.confirmNameApplied(protectAfterApply);
    } catch {
      // 실제 적용 여부는 사용자가 확인하고 저장 오류는 공통 영역에 표시한다
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={controller.clearName}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View accessibilityViewIsModal style={styles.dialog}>
            <Card>
              <Text style={layout.label}>
                {web ? '이름 검토 · 웹 입력 연습' : '이름 검토 · 직접 적용'}
              </Text>
              <Text accessibilityRole="header" style={layout.heading}>
                {web
                  ? '이름을 확인하고 입력을 연습해요.'
                  : '복사와 게임 적용은 달라요.'}
              </Text>
              {controller.error && <Notice error text={controller.error} />}
              <InfoRow
                label="현재 기록된 이름"
                value={proposal.currentName || '이름 미기록'}
              />
              <Text style={layout.small}>
                이름 제안 · 직접 수정할 수 있어요.
              </Text>
              <TextInput
                autoFocus
                accessibilityLabel="검토할 포켓몬 이름"
                value={name}
                editable={!controller.busy && !locked}
                onChangeText={value => {
                  setName(value);
                  setCopied(false);
                }}
                autoCorrect={false}
                autoCapitalize="none"
                style={[
                  layout.input,
                  styles.nameInput,
                  attempted && invalid && styles.invalid,
                ]}
              />
              <Text style={layout.small}>
                {length} / 12자 · 보이지 않는 제어 문자는 사용할 수 없어요.
              </Text>
              {attempted && invalid && (
                <Notice
                  error
                  text="이름은 보이는 문자 1~12자로 입력해 주세요. 공백만 있는 이름은 사용할 수 없어요."
                />
              )}
              {locked && (
                <Notice
                  error
                  text="이름이 보호되어 있어요. 보유 목록에서 직접 보호를 해제한 뒤 다시 검토해 주세요."
                />
              )}
              {changed && (
                <Button
                  label="수정한 이름 검토"
                  disabled={
                    controller.busy || locked || controller.storageBlocked
                  }
                  onPress={review}
                />
              )}
              <View style={layout.divider} />
              <Text style={layout.strong}>
                {web ? '1. 제안 이름 복사' : '1. 복사한 뒤 게임에 붙여 넣기'}
              </Text>
              <Text style={layout.body}>
                {web
                  ? '실제로 클립보드에 복사할 수 있어요. 복사한 이름은 게임으로 전달되지 않습니다.'
                  : '게임에서 해당 개체를 열고 이름 변경 화면에 직접 붙여 넣어 주세요.'}
              </Text>
              <Button
                label={copied ? '이름 다시 복사' : '이름 복사'}
                disabled={
                  controller.busy ||
                  changed ||
                  locked ||
                  controller.storageBlocked
                }
                onPress={() => {
                  copy();
                }}
              />
              {copied && (
                <Notice
                  text={
                    web
                      ? '클립보드에 복사했어요. 아래 연습용 입력란에 붙여 넣을 수 있어요.'
                      : '이름을 클립보드에 복사했어요. 게임의 저장까지 직접 완료해 주세요.'
                  }
                />
              )}
              <Text style={layout.strong}>
                {web ? '2. 웹 입력 연습' : '2. 게임 저장 후 적용 확인'}
              </Text>
              <Text style={layout.body}>
                {web
                  ? '아래 입력란은 웹 체험용입니다. 연습 결과는 이 탭의 기록에만 남고 게임의 이름을 바꾸지 않아요.'
                  : '아래 버튼은 게임을 조작하지 않아요. 직접 적용했다고 확인한 사실만 내 보유 기록에 저장합니다.'}
              </Text>
              {web && (
                <View style={layout.stack}>
                  <TextInput
                    accessibilityLabel="웹 연습용 이름 입력"
                    value={practiceName}
                    editable={!controller.busy}
                    onChangeText={value => {
                      setPracticeName(value);
                      setPracticeError('');
                    }}
                    placeholder="검토한 이름을 붙여 넣어 보세요"
                    placeholderTextColor={colors.muted}
                    autoCorrect={false}
                    autoCapitalize="none"
                    style={layout.input}
                  />
                  <Button
                    label="연습용 입력란에 제안 채우기"
                    secondary
                    disabled={controller.busy || changed}
                    onPress={() => {
                      setPracticeName(proposal.nextName);
                      setPracticeError('');
                    }}
                  />
                  {practiceError ? <Notice error text={practiceError} /> : null}
                </View>
              )}
              <View style={layout.row}>
                <View style={layout.flex}>
                  <Text style={layout.strong}>적용 후 이 이름 보호</Text>
                  <Text style={layout.small}>
                    직접 고친 이름은 보호를 권장해요. 순위가 바뀌어도 직접
                    해제하기 전에는 변경하지 않습니다.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="적용 후 이 이름 보호"
                  value={protectAfterApply}
                  disabled={controller.busy || locked}
                  onValueChange={setProtectAfterApply}
                  trackColor={{ false: colors.border, true: '#4C8995' }}
                  thumbColor={colors.accent}
                />
              </View>
              <Button
                label={web ? '웹에서 적용 연습' : '게임에서 적용했어요'}
                secondary
                disabled={
                  controller.busy ||
                  changed ||
                  locked ||
                  controller.storageBlocked
                }
                hint={
                  web
                    ? '웹 연습 기록만 변경합니다.'
                    : '게임에서 직접 이름을 저장한 경우에만 누르세요.'
                }
                onPress={() => {
                  confirm();
                }}
              />
              <Text style={layout.small}>
                목록이나 계산 조건이 달라진 오래된 제안은 다시 검토해야 합니다.
              </Text>
              <Button
                label="지금은 닫기"
                secondary
                disabled={controller.busy}
                onPress={controller.clearName}
              />
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#020D16E8' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  dialog: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  nameInput: { fontSize: 25, lineHeight: 35, color: colors.accent },
  invalid: { borderColor: colors.danger },
});
