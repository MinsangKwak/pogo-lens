import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ObservationFields, ScanRecord } from '@pogo-lens/core';
import { speciesKey } from '@pogo-lens/core';
import { Button, Card, Choice, Notice } from './components';
import { colors, layout } from './theme';
import type { LensController } from './types';

const labels = { atk: '공격', def: '방어', sta: '체력' } as const;
type IvField = keyof typeof labels;
const ivKeys: IvField[] = ['atk', 'def', 'sta'];
const ivError = (value: string) => !/^\d+$/.test(value) || Number(value) > 15;
const optionalNumberError = (value: string) =>
  value !== '' && (!/^\d+$/.test(value) || Number(value) < 1);

export function CandidateEditor({
  controller,
  onSaved,
}: {
  controller: LensController;
  onSaved: () => void;
}) {
  const candidate = controller.candidate!;
  const initial = controller.species.find(
    species =>
      species.id === candidate.fields.speciesId &&
      (species.form ?? '') === (candidate.fields.form ?? ''),
  );
  const [chosenSpecies, setChosenSpecies] = useState(
    initial ? speciesKey(initial.id, initial.form) : '',
  );
  const [iv, setIv] = useState<Record<IvField, string>>({
    atk: candidate.fields.iv?.atk?.toString() ?? '',
    def: candidate.fields.iv?.def?.toString() ?? '',
    sta: candidate.fields.iv?.sta?.toString() ?? '',
  });
  const [cp, setCp] = useState(candidate.fields.cp?.toString() ?? '');
  const [hp, setHp] = useState(candidate.fields.hp?.toString() ?? '');
  const [resolution, setResolution] = useState('');
  const [attempted, setAttempted] = useState(false);
  const species = controller.species.find(
    entry => speciesKey(entry.id, entry.form) === chosenSpecies,
  );
  const refs = useRef<
    Partial<Record<IvField, React.ComponentRef<typeof TextInput> | null>>
  >({});
  const duplicates = useMemo(
    () =>
      controller.collection.records.filter(
        record =>
          species &&
          speciesKey(record.speciesId, record.form) === chosenSpecies &&
          ivKeys.every(
            key => !ivError(iv[key]) && record.iv[key] === Number(iv[key]),
          ),
      ),
    [chosenSpecies, controller.collection.records, iv, species],
  );
  const invalidIv = ivKeys.find(key => ivError(iv[key]));
  const error =
    attempted &&
    (!species
      ? '종을 선택해 주세요.'
      : invalidIv
      ? `${labels[invalidIv]} 값을 0~15의 정수로 입력해 주세요.`
      : optionalNumberError(cp) || optionalNumberError(hp)
      ? 'CP와 HP는 비워 두거나 1 이상의 정수로 입력해 주세요.'
      : duplicates.length > 0 && !resolution
      ? '기존 개체인지 새 개체인지 선택해 주세요.'
      : '');

  function changeIv(key: IvField, value: string) {
    setIv(current => ({ ...current, [key]: value }));
    setResolution('');
  }

  async function confirm() {
    setAttempted(true);
    if (
      !species ||
      invalidIv ||
      optionalNumberError(cp) ||
      optionalNumberError(hp) ||
      (duplicates.length > 0 && !resolution)
    ) {
      if (invalidIv) refs.current[invalidIv]?.focus();
      return;
    }
    const fields: ObservationFields = {
      speciesId: species.id,
      ...(species.form === undefined ? {} : { form: species.form }),
      iv: { atk: Number(iv.atk), def: Number(iv.def), sta: Number(iv.sta) },
      ...(cp === '' ? {} : { cp: Number(cp) }),
      ...(hp === '' ? {} : { hp: Number(hp) }),
    };
    try {
      await controller.confirmCandidate(
        fields,
        resolution && resolution !== 'new'
          ? { kind: 'update', recordId: resolution }
          : { kind: 'new', recordId: `record-${candidate.id}` },
      );
      onSaved();
    } catch {
      // 저장 오류는 컨트롤러의 공통 오류 영역에 남긴다
    }
  }

  return (
    <Card>
      <Text style={layout.label}>2 · 값 확인</Text>
      <Text accessibilityRole="header" style={layout.heading}>
        읽은 값은 직접 확인해 주세요.
      </Text>
      <Text style={layout.body}>
        확인하기 전에는 보유 목록과 순위에 반영하지 않아요. 읽지 못한 값은
        빈칸으로 남겨 둡니다.
      </Text>
      {candidate.rawText ? (
        <View style={styles.rawBox}>
          <Text style={layout.label}>기기에서 읽은 원문</Text>
          <ScrollView style={styles.rawScroll} nestedScrollEnabled>
            <Text selectable style={layout.small}>
              {candidate.rawText}
            </Text>
          </ScrollView>
          <Text style={layout.small}>OCR 결과에는 오타가 있을 수 있어요.</Text>
        </View>
      ) : (
        <Notice text="수동 입력 · 게임에서 확인한 값을 입력해 주세요." />
      )}
      <Text style={layout.strong}>
        종 선택 <Text style={layout.small}>· 샘플 종 4종</Text>
      </Text>
      <Text style={layout.small}>
        현재는 아래 개발용 4종만 계산할 수 있어요. 게임의 전체 도감 데이터는
        포함되지 않았습니다.
      </Text>
      <View accessibilityRole="radiogroup" style={layout.stack}>
        {controller.species.map(entry => (
          <Choice
            key={speciesKey(entry.id, entry.form)}
            label={entry.name}
            selected={chosenSpecies === speciesKey(entry.id, entry.form)}
            disabled={controller.busy}
            onPress={() => {
              setChosenSpecies(speciesKey(entry.id, entry.form));
              setResolution('');
            }}
          />
        ))}
      </View>
      <Text style={layout.strong}>개체값 · 각각 0~15</Text>
      <View style={styles.ivRow}>
        {ivKeys.map(key => (
          <View key={key} style={layout.flex}>
            <Text style={layout.small}>{labels[key]}</Text>
            <TextInput
              ref={ref => {
                refs.current[key] = ref;
              }}
              accessibilityLabel={`${labels[key]} 개체값`}
              accessibilityHint="0부터 15까지 정수"
              value={iv[key]}
              keyboardType="number-pad"
              editable={!controller.busy}
              selectTextOnFocus
              onChangeText={value => changeIv(key, value)}
              placeholder="미확인"
              placeholderTextColor={colors.muted}
              style={[
                layout.input,
                styles.ivInput,
                attempted && ivError(iv[key]) && styles.invalid,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.ivRow}>
        <View style={layout.flex}>
          <Text style={layout.small}>CP · 선택</Text>
          <TextInput
            accessibilityLabel="CP 선택 입력"
            value={cp}
            onChangeText={setCp}
            keyboardType="number-pad"
            editable={!controller.busy}
            placeholder="모르면 비우기"
            placeholderTextColor={colors.muted}
            style={layout.input}
          />
        </View>
        <View style={layout.flex}>
          <Text style={layout.small}>HP · 선택</Text>
          <TextInput
            accessibilityLabel="HP 선택 입력"
            value={hp}
            onChangeText={setHp}
            keyboardType="number-pad"
            editable={!controller.busy}
            placeholder="모르면 비우기"
            placeholderTextColor={colors.muted}
            style={layout.input}
          />
        </View>
      </View>
      {species && !invalidIv && (
        <DuplicateChoices
          records={duplicates}
          selected={resolution}
          onSelect={setResolution}
          disabled={controller.busy}
        />
      )}
      {error ? <Notice error text={error} /> : null}
      <Button
        label="확인하고 보유 목록에 저장"
        onPress={() => {
          confirm();
        }}
        disabled={controller.storageBlocked}
        busy={controller.busy}
      />
      <Button
        label="이번 후보 취소"
        secondary
        disabled={controller.busy}
        onPress={controller.cancelCandidate}
      />
    </Card>
  );
}

function DuplicateChoices({
  records,
  selected,
  onSelect,
  disabled,
}: {
  records: readonly ScanRecord[];
  selected: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  if (!records.length)
    return (
      <Notice text="같은 종·IV의 기록이 없어요. 확인하면 새 개체로 저장합니다." />
    );
  return (
    <View accessibilityRole="radiogroup" style={layout.stack}>
      <Text style={layout.strong}>같은 IV의 기록 {records.length}개</Text>
      <Text style={layout.small}>
        같은 IV여도 다른 개체일 수 있어요. 자동으로 합치지 않습니다.
      </Text>
      {records.map((record, index) => (
        <Choice
          key={record.id}
          disabled={disabled}
          label={`기존 개체 ${index + 1} 업데이트`}
          detail={`${record.nickname || '이름 미기록'} · ${new Date(
            record.scannedAt,
          ).toLocaleDateString('ko-KR')}`}
          selected={selected === record.id}
          onPress={() => onSelect(record.id)}
        />
      ))}
      <Choice
        label="다른 개체예요 · 새로 추가"
        detail="기존 기록을 유지하고 보유 수를 1 늘립니다."
        selected={selected === 'new'}
        disabled={disabled}
        onPress={() => onSelect('new')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ivRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ivInput: { textAlign: 'center', fontVariant: ['tabular-nums'], marginTop: 6 },
  invalid: { borderColor: colors.danger },
  rawBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.background,
    gap: 8,
  },
  rawScroll: { maxHeight: 140 },
});
