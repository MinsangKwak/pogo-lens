import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ivPercent, speciesKey, suggestOwnedNicknames } from '@pogo-lens/core';
import {
  Badge,
  Button,
  Card,
  InfoRow,
  Notice,
  ScreenHeading,
} from '../ui/components';
import { confirmAction } from '../ui/confirm';
import { colors, layout } from '../ui/theme';
import { DEFAULT_TEMPLATE, type LensController } from '../ui/types';

export function CollectionScreen({
  controller,
  onAdd,
}: {
  controller: LensController;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const { records } = controller.collection;
  const result = useMemo(() => {
    try {
      return {
        suggestions: suggestOwnedNicknames(
          records,
          controller.species,
          DEFAULT_TEMPLATE,
        ),
        error: '',
      };
    } catch {
      return {
        suggestions: [],
        error:
          '이 목록을 계산할 수 없어요. 종 데이터와 보유 기록을 확인해 주세요.',
      };
    }
  }, [records, controller.species]);
  const protectedCount = records.filter(record => record.nicknameLocked).length;
  const visible = result.suggestions.filter(
    entry =>
      filter === 'all' ||
      speciesKey(entry.record.speciesId, entry.record.form) === filter,
  );
  const run = (action: () => Promise<void>) => {
    action().catch(() => {});
  };

  function setProtection(id: string, locked: boolean) {
    if (locked) {
      run(() => controller.setProtection(id, true));
      return;
    }
    confirmAction(
      '이름 보호를 해제할까요?',
      '보호를 해제해도 게임 이름은 바뀌지 않아요. 이후 이름 제안을 직접 검토할 수 있습니다.',
      () => run(() => controller.setProtection(id, false)),
      { cancelLabel: '보호 유지', confirmLabel: '보호 해제' },
    );
  }

  function review(id: string, name: string) {
    try {
      controller.prepareName(id, name, DEFAULT_TEMPLATE);
    } catch {
      // 검토 오류는 공통 오류 영역에 표시한다
    }
  }

  return (
    <ScrollView contentContainerStyle={layout.page}>
      <ScreenHeading
        eyebrow="COLLECTION · 내 보유 목록"
        title="내 기준으로 순위 매기기."
        description="같은 종·폼끼리 IV 합을 비교해요. 같으면 공격 → 방어 → 체력 순이며, 완전히 같은 IV는 동순위입니다."
      />
      <View style={styles.stats}>
        <Stat label="확인한 개체" value={records.length} />
        <Stat label="이름 제안" value={controller.renameChanges.length} />
        <Stat label="이름 보호" value={protectedCount} />
      </View>
      <Notice text="이 순위는 내가 저장한 개체 안에서의 IV 순위예요. 배틀 리그 성능 순위와는 별도로 계산합니다." />
      {records.length === 0 ? (
        <Card>
          <Text style={layout.heading}>아직 확인한 개체가 없어요.</Text>
          <Text style={layout.body}>
            평가 화면의 값을 직접 입력하거나 캡처 후보를 확인해 첫 개체를 추가해
            보세요.
          </Text>
          <Button
            label="첫 개체 입력하기"
            onPress={onAdd}
            disabled={controller.busy || controller.storageBlocked}
          />
        </Card>
      ) : (
        <>
          {controller.renameChanges.length > 0 && (
            <Card>
              <Text accessibilityRole="header" style={layout.heading}>
                검토할 이름 변경 {controller.renameChanges.length}개
              </Text>
              <Text style={layout.small}>
                새 개체를 추가하면 기존 개체의 순위·이름 제안도 바뀔 수 있어요.
                제안만으로 저장된 이름을 바꾸지 않습니다.
              </Text>
              {controller.renameChanges.map(change => {
                const record = records.find(
                  entry => entry.id === change.recordId,
                );
                const species = controller.species.find(
                  entry =>
                    entry.id === record?.speciesId &&
                    (entry.form ?? '') === (record?.form ?? ''),
                );
                return (
                  <View key={change.recordId} style={styles.pendingRow}>
                    <View style={layout.flex}>
                      <Text style={layout.strong}>
                        {species?.name ?? `종 ${record?.speciesId ?? '?'}`}
                      </Text>
                      <Text style={layout.small}>
                        {change.currentName || '이름 미기록'} →{' '}
                        <Text style={layout.accent}>{change.nextName}</Text>
                      </Text>
                    </View>
                    <Badge
                      label={
                        change.status === 'locked' ? '보호 중' : '확인 대기'
                      }
                      warning={change.status === 'locked'}
                    />
                  </View>
                );
              })}
            </Card>
          )}
          <Text accessibilityRole="header" style={layout.heading}>
            같은 종끼리 비교
          </Text>
          <View style={layout.wrap}>
            <Filter
              label="전체"
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            {controller.species.map(species => (
              <Filter
                key={speciesKey(species.id, species.form)}
                label={species.name}
                selected={filter === speciesKey(species.id, species.form)}
                onPress={() => setFilter(speciesKey(species.id, species.form))}
              />
            ))}
          </View>
          {result.error ? <Notice text={result.error} error /> : null}
          {!result.error && !visible.length && (
            <Notice text="선택한 종의 보유 기록이 없어요." />
          )}
          {visible.map(entry => {
            const record = entry.record;
            const species = controller.species.find(
              item =>
                speciesKey(item.id, item.form) ===
                speciesKey(record.speciesId, record.form),
            );
            const history = controller.collection.nicknameApplications.filter(
              item => item.recordId === record.id,
            );
            return (
              <Card key={record.id}>
                <View style={layout.row}>
                  <Text
                    accessibilityLabel={`보유 ${entry.total}마리 중 ${entry.rank}위`}
                    style={styles.rank}
                  >
                    {entry.rank}
                    <Text style={layout.small}> / {entry.total}</Text>
                  </Text>
                  <View style={layout.flex}>
                    <Text style={layout.heading}>
                      {species?.name ?? '알 수 없는 종'}
                    </Text>
                    <Text style={layout.small}>
                      {record.iv.atk} / {record.iv.def} / {record.iv.sta} ·{' '}
                      {ivPercent(record.iv)}%
                    </Text>
                  </View>
                  {record.nicknameLocked && <Badge label="보호 중" />}
                </View>
                <InfoRow
                  label="기록된 이름"
                  value={record.nickname || '아직 기록하지 않음'}
                />
                <InfoRow
                  label="현재 이름 제안"
                  value={entry.suggestedNickname}
                />
                <Text style={layout.small}>
                  {Platform.OS === 'web'
                    ? `웹 입력 연습 ${
                        history.filter(item => item.source === 'web-simulation')
                          .length
                      }회 · 게임 이름을 변경하지 않아요.`
                    : history.filter(item => item.source === 'user-confirmed')
                        .length
                    ? `게임에서 적용했다고 확인한 기록 ${
                        history.filter(item => item.source === 'user-confirmed')
                          .length
                      }회 · 게임 상태를 자동으로 읽지는 않아요.`
                    : '게임 적용 확인 기록 없음 · 게임 상태를 자동으로 읽지는 않아요.'}
                </Text>
                <Button
                  label={`${species?.name ?? '개체'} ${record.iv.atk}/${
                    record.iv.def
                  }/${record.iv.sta} 이름 검토`}
                  disabled={
                    controller.busy ||
                    controller.storageBlocked ||
                    record.nicknameLocked ||
                    !entry.changed
                  }
                  onPress={() => review(record.id, entry.suggestedNickname)}
                />
                {!entry.changed && (
                  <Text style={layout.small}>
                    현재 제안과 기록된 이름이 같아요.
                  </Text>
                )}
                <Button
                  label={
                    record.nicknameLocked
                      ? '이 개체 이름 보호 해제'
                      : '이 개체 이름 보호하기'
                  }
                  secondary
                  disabled={controller.busy || controller.storageBlocked}
                  onPress={() =>
                    setProtection(record.id, !record.nicknameLocked)
                  }
                />
              </Card>
            );
          })}
          <Button
            label="다른 개체 추가하기"
            secondary
            onPress={onAdd}
            disabled={controller.busy || controller.storageBlocked}
          />
        </>
      )}
      <Text style={layout.small}>
        계산 데이터: 샘플 종 4종 · 기기에 저장한 확인 완료 기록만 비교합니다.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={layout.small}>{label}</Text>
    </View>
  );
}

function Filter({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 보기`}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      style={[styles.filter, selected && styles.filterSelected]}
    >
      <Text style={[layout.small, selected && layout.accent]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: 90,
    padding: 16,
    backgroundColor: colors.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  statValue: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  rank: {
    fontSize: 34,
    fontWeight: '500',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  filter: {
    minHeight: 46,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  filterSelected: { borderColor: colors.accent, backgroundColor: '#A0E4EF0D' },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
});
