'use strict';

import { ivPercent, ivSum, type Iv, type Level } from './types.js';

// 게임이 허용하는 닉네임 최대 글자 수
export const NICKNAME_MAX_LENGTH = 12;

export interface NicknameContext {
  readonly speciesName: string;
  readonly iv: Iv;
  readonly level?: Level;
  // 같은 종 안에서의 순위와 총 마릿수
  readonly ownedRank?: number;
  readonly ownedTotal?: number;
  readonly greatRank?: number;
  readonly ultraRank?: number;
}

// 템플릿 토큰
// {name} 종 이름 (길이가 넘치면 가장 먼저 잘린다)
// {rank} 보유 순위, {total} 보유 수
// {sum} IV 합, {pct} IV 퍼센트
// {a} {d} {s} 개별 IV, {iv} a/d/s 압축 표기
// {gl} {ul} 리그 순위, {lv} 레벨
// {name} 자리를 임시로 표시하는 구분자. 템플릿에 나올 일 없는 문자열을 쓴다
const NAME_SLOT = '\u{E000}';

const TOKEN = /\{(name|rank|total|sum|pct|a|d|s|iv|gl|ul|lv)\}/g;

function codePoints(text: string): string[] {
  return Array.from(text);
}

function ivCompact(iv: Iv): string {
  const hex = (v: number): string => v.toString(16).toUpperCase();
  return `${hex(iv.atk)}${hex(iv.def)}${hex(iv.sta)}`;
}

function resolve(token: string, ctx: NicknameContext): string {
  switch (token) {
    case 'name': return ctx.speciesName;
    case 'rank': return ctx.ownedRank === undefined ? '' : String(ctx.ownedRank);
    case 'total': return ctx.ownedTotal === undefined ? '' : String(ctx.ownedTotal);
    case 'sum': return String(ivSum(ctx.iv));
    case 'pct': return String(ivPercent(ctx.iv));
    case 'a': return String(ctx.iv.atk);
    case 'd': return String(ctx.iv.def);
    case 's': return String(ctx.iv.sta);
    case 'iv': return ivCompact(ctx.iv);
    case 'gl': return ctx.greatRank === undefined ? '' : String(ctx.greatRank);
    case 'ul': return ctx.ultraRank === undefined ? '' : String(ctx.ultraRank);
    case 'lv': return ctx.level === undefined ? '' : String(ctx.level);
    default: return '';
  }
}

// 템플릿을 채우고 12자 안에 맞춘다. 넘치면 {name}부터 줄이고, 그래도 넘치면 뒤를 자른다
export function renderNickname(template: string, ctx: NicknameContext): string {
  const parts = template
    .replace(TOKEN, (_, token: string) => (token === 'name' ? NAME_SLOT : resolve(token, ctx)))
    .split(NAME_SLOT);
  const fixedLength = codePoints(parts.join('')).length;
  const nameBudget = Math.max(0, NICKNAME_MAX_LENGTH - fixedLength);
  const name = codePoints(ctx.speciesName).slice(0, nameBudget).join('');
  const rendered = parts.join(name);
  return codePoints(rendered).slice(0, NICKNAME_MAX_LENGTH).join('');
}

export const DEFAULT_NICKNAME_TEMPLATE = '{rank}/{total} {pct}% {name}';
