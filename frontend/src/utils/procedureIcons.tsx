import { Droplets, HeartPulse, Moon, ShieldCheck, Sparkles, Syringe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

import {
  ExtractionIcon,
  ICON_STROKE_WIDTH,
  ImplantIcon,
  OrthodonticsIcon,
} from '@/components/icons/DentalIcons';
import type { CategoryId } from '@/features/procedure/taxonomy';

export type IconComponent = ComponentType<{ size?: number; color?: string }>;

/**
 * lucide 아이콘을 **선 굵기만 1.75 로 고정해** 넘긴다. `size`·`color` 는 그대로 통과한다.
 * lucide 기본값이 2 라서, 감싸지 않으면 손으로 그린 치아 글리프(1.75)와 같은 격자에서
 * 굵기가 섞여 보인다.
 *
 * 대분류 9개 밖의 아이콘이 **같은 줄에** 설 때도 이 함수를 쓴다 — 탐색 탭의 `추천`(`Star`)이
 * 그렇다. 그래서 내보낸다.
 */
export function thin(Icon: LucideIcon, displayName: string): IconComponent {
  const Thin = ({ size, color }: { size?: number; color?: string }) => (
    <Icon size={size} color={color} strokeWidth={ICON_STROKE_WIDTH} />
  );
  Thin.displayName = displayName;
  return Thin;
}

/**
 * 시술 **대분류 9개**의 아이콘 (`features/procedure/taxonomy.ts` 의 `CATEGORY_IDS`).
 * 홈 격자·탐색 탭·카테고리 헤더·관리자 폼 섹션·검색 추천 줄이 모두 이 표 하나를 본다.
 *
 * 9개는 서로 겹치지 않는다 — 격자에서 두 칸이 같은 그림이면 구분이 안 된다.
 *
 * lucide 에는 치아 글리프가 아예 없어서(`tooth`/`dental`/`molar` 로 전수 확인) 치과에서만
 * 쓰는 세 가지는 직접 그렸다(`components/icons/DentalIcons.tsx`) — 임플란트는 크라운+
 * 어버트먼트+픽스처, 교정은 치아+브라켓+와이어, 발치는 치아+빼는 화살표다. 나머지는
 * lucide 를 쓰되 **9개 전부 선 굵기 1.75** 로 맞춘다(`thin`) — 격자에서 굵기가 섞이면
 * 아이콘 묶음이 아니라 짜깁기처럼 보인다.
 *
 * 서버 시술 13종마다 아이콘을 두던 옛 표는 삭제했다 — 화면이 전부 대분류로 넘어가
 * 소비자가 0개가 됐다.
 */
export const CATEGORY_ICONS: Record<CategoryId, IconComponent> = {
  /** 크라운+어버트먼트+픽스처 — 뼈에 심는 구조 그대로 (직접 그림) */
  implant: ImplantIcon,
  /** 물방울 — 세정 */
  prevention: thin(Droplets, 'PreventionIcon'),
  /** 치아+브라켓+와이어 — 장치가 붙은 앞니 (직접 그림) */
  orthodontics: OrthodonticsIcon,
  /** 방패+체크 — "치료 끝" (경고가 아니라 해결) */
  cavity: thin(ShieldCheck, 'CavityIcon'),
  /** 반짝임 — 심미. 탐색 "추천" 탭이 쓰던 아이콘을 넘겨받는다(추천은 `Star` 로) */
  aesthetic: thin(Sparkles, 'AestheticIcon'),
  gum: thin(HeartPulse, 'GumIcon'),
  /** 달 — 이갈이·코골이 장치는 밤에 쓴다. 충치치료의 방패와 헷갈리지 않는다 */
  tmj: thin(Moon, 'TmjIcon'),
  botox: thin(Syringe, 'BotoxIcon'),
  /** 치아+빼는 화살표 — 위로 빼내는 동작 (직접 그림) */
  extraction: ExtractionIcon,
};
