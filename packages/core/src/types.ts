'use strict';

// 종(포켓몬) 기본 스탯. 게임 마스터 데이터에서 가져온다
export interface Species {
  readonly id: number;
  readonly name: string;
  readonly form?: string;
  readonly baseAtk: number;
  readonly baseDef: number;
  readonly baseSta: number;
}

// 개체값. 각 항목은 0~15
export interface Iv {
  readonly atk: number;
  readonly def: number;
  readonly sta: number;
}

// 레벨은 1~51, 0.5 단위
export type Level = number;

// 한 번의 스캔으로 확정된 포켓몬 한 마리
export interface ScanRecord {
  readonly id: string;
  readonly speciesId: number;
  readonly form?: string;
  readonly cp: number;
  readonly hp: number;
  readonly level: Level;
  readonly iv: Iv;
  readonly scannedAt: number;
  readonly nickname?: string;
}

export const IV_MIN = 0;
export const IV_MAX = 15;
export const IV_SUM_MAX = 45;

export function ivSum(iv: Iv): number {
  return iv.atk + iv.def + iv.sta;
}

export function ivPercent(iv: Iv): number {
  return Math.round((ivSum(iv) / IV_SUM_MAX) * 100);
}

export function isValidIv(iv: Iv): boolean {
  return [iv.atk, iv.def, iv.sta].every(
    (v) => Number.isInteger(v) && v >= IV_MIN && v <= IV_MAX,
  );
}

export function speciesKey(speciesId: number, form?: string): string {
  return form ? `${speciesId}:${form}` : `${speciesId}`;
}
