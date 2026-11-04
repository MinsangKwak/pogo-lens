import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useLensController } from './src/controller/useLensController';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Button, Notice } from './src/ui/components';
import { RenameDialog } from './src/ui/RenameDialog';
import { colors, layout } from './src/ui/theme';
import type { Tab } from './src/ui/types';

const tabs: { id: Tab; label: string; number: string }[] = [
  { id: 'capture', label: '관측하기', number: '01' },
  { id: 'collection', label: '내 보유 목록', number: '02' },
  { id: 'settings', label: '설정', number: '03' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <LensApp />
    </SafeAreaProvider>
  );
}

function LensApp() {
  const controller = useLensController();
  const [tab, setTab] = useState<Tab>('capture');
  const insets = useSafeAreaInsets();
  function addRecord() {
    if (controller.candidate) {
      setTab('capture');
      return;
    }
    controller.beginManual();
    setTab('capture');
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.app, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.lens}>
            <View style={styles.lensInner}>
              <View style={styles.lensDot} />
            </View>
          </View>
          <Text style={styles.wordmark}>PoGo Lens</Text>
        </View>
        <Text style={styles.environment}>
          {Platform.OS === 'web'
            ? '웹 체험 · 게임 연결 없음'
            : `${Platform.OS === 'ios' ? 'iOS' : 'Android'} · 개발 버전`}
        </Text>
      </View>
      {controller.error && (
        <View style={styles.errorArea}>
          <Notice text={controller.error} error />
          <Button
            label="오류 알림 닫기"
            secondary
            onPress={controller.clearError}
          />
        </View>
      )}
      {!controller.ready ? (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={layout.body}>
            기기의 기록과 캡처 상태를 확인하고 있어요.
          </Text>
        </View>
      ) : (
        <View style={layout.flex}>
          {controller.storageBlocked && tab !== 'settings' && (
            <View style={styles.blocked}>
              <Notice
                error
                text="보유 데이터를 읽지 못해 저장을 멈췄어요. 설정에서 저장 상태를 확인해 주세요."
              />
              <Button
                label="저장 상태 확인"
                secondary
                onPress={() => setTab('settings')}
              />
            </View>
          )}
          <View
            style={[layout.flex, tab !== 'capture' && styles.hidden]}
            accessibilityElementsHidden={tab !== 'capture'}
            importantForAccessibility={
              tab !== 'capture' ? 'no-hide-descendants' : 'auto'
            }
          >
            <CaptureScreen
              controller={controller}
              onSaved={() => setTab('collection')}
            />
          </View>
          <View
            style={[layout.flex, tab !== 'collection' && styles.hidden]}
            accessibilityElementsHidden={tab !== 'collection'}
            importantForAccessibility={
              tab !== 'collection' ? 'no-hide-descendants' : 'auto'
            }
          >
            <CollectionScreen controller={controller} onAdd={addRecord} />
          </View>
          <View
            style={[layout.flex, tab !== 'settings' && styles.hidden]}
            accessibilityElementsHidden={tab !== 'settings'}
            importantForAccessibility={
              tab !== 'settings' ? 'no-hide-descendants' : 'auto'
            }
          >
            <SettingsScreen controller={controller} />
          </View>
        </View>
      )}
      <View
        accessibilityRole="tablist"
        style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      >
        {tabs.map(item => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: tab === item.id }}
            aria-selected={tab === item.id}
            onPress={() => setTab(item.id)}
            style={({ pressed }) => [
              styles.tab,
              tab === item.id && styles.tabSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabNumber, tab === item.id && layout.accent]}>
              {item.number}
            </Text>
            <Text style={[styles.tabLabel, tab === item.id && layout.accent]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {controller.pendingRename && (
        <RenameDialog
          key={`${controller.pendingRename.recordId}:${controller.pendingRename.nextName}:${controller.pendingRename.snapshotKey}`}
          controller={controller}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  hidden: { display: 'none' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  wordmark: { fontSize: 21, fontWeight: '600', color: colors.text },
  environment: { fontSize: 12, color: colors.muted },
  lens: {
    width: 31,
    height: 31,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensInner: {
    width: 19,
    height: 19,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    borderRadius: 15,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  tabSelected: { backgroundColor: '#A0E4EF0C' },
  tabNumber: {
    color: colors.muted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  pressed: { opacity: 0.7 },
  loading: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorArea: { padding: 16, gap: 8 },
  blocked: { padding: 16, gap: 8 },
});
