import { Bolt, Braces, Droplets, HeartPulse, Scissors, Shield, ShieldCheck, Sparkles, Syringe } from 'lucide-react';
import type { ComponentType } from 'react';

import type { CategoryId } from '@/features/procedure/taxonomy';

export type IconComponent = ComponentType<{ size?: number; color?: string }>;

/**
 * 시술 **대분류 9개**의 아이콘 (`features/procedure/taxonomy.ts` 의 `CATEGORY_IDS`).
 * 홈 격자·탐색 탭·카테고리 헤더·관리자 폼 섹션이 모두 이 표 하나를 본다.
 *
 * 전부 lucide-react v0.475 에 실존하는 이름이고(`node_modules/lucide-react/dist/esm/icons/`),
 * 서로 겹치지 않는다 — 격자에서 두 칸이 같은 그림이면 구분이 안 된다. lucide 에는 치아
 * 글리프가 아예 없어서(`tooth`/`dental`/`molar` 로 전수 확인) 발치는 가위로 대신한다.
 *
 * 서버 시술 13종마다 아이콘을 두던 옛 표는 삭제했다 — 화면이 전부 대분류로 넘어가
 * 소비자가 0개가 됐다.
 */
export const CATEGORY_ICONS: Record<CategoryId, IconComponent> = {
  /** 나사/볼트 — 식립 나사. 번개(`Zap`)가 아니라 육각 볼트 머리 글리프다 */
  implant: Bolt,
  /** 물방울 — 세정 */
  prevention: Droplets,
  /** 중괄호 — 교정 장치 */
  orthodontics: Braces,
  /** 방패+체크 — "치료 끝" (경고가 아니라 해결) */
  cavity: ShieldCheck,
  /** 반짝임 — 심미. 탐색 "추천" 탭이 쓰던 아이콘을 넘겨받는다(추천은 `Star` 로) */
  aesthetic: Sparkles,
  gum: HeartPulse,
  /** 방패 — 장치/보호 */
  tmj: Shield,
  botox: Syringe,
  /** 가위 — 발치. 기존 `Frown`(찡그린 얼굴) 임시 아이콘을 대체한다 */
  extraction: Scissors,
};
