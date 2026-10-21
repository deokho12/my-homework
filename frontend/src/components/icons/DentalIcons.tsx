import type { ReactNode } from 'react';

/**
 * 손으로 그린 치아 글리프 3종 — 임플란트·교정·사랑니/발치.
 *
 * lucide-react v0.475 에는 치아 글리프가 아예 없어서(`tooth`/`dental`/`molar` 로 전수 확인)
 * 직접 그린다. 도형은 요청서 13 의 SVG 를 **그대로** 옮긴 것이다 — 다시 그리지 않는다
 * (`DentalIcons.test.tsx` 가 path 문자열을 고정한다).
 *
 * 겉모습은 lucide 와 같은 계약이다: `size`(기본 24)·`color`(기본 currentColor) 를 받고,
 * `viewBox="0 0 24 24"` 에 `fill="none"`, 둥근 캡/조인으로 그린다. 그래야 카테고리 아이콘 표
 * (`utils/procedureIcons.tsx`)에서 lucide 아이콘과 섞여 같은 자리에 꽂힌다.
 *
 * `aria-hidden` 은 붙이지 않는다 — lucide v0.475 도 붙이지 않기 때문이다
 * (`node_modules/lucide-react/dist/esm/defaultAttributes.js`). 한쪽만 붙이면 같은 격자의
 * 9칸이 보조기술에 서로 다르게 노출된다. 아이콘은 전부 이름이 붙은 요소 안에서만 쓰인다
 * (`CategoryCard` 의 `accessibilityLabel` 등).
 */

/** 격자에서 선 굵기가 섞여 보이지 않게 9칸이 공유하는 값 (요청서 13). */
export const ICON_STROKE_WIDTH = 1.75;

export interface DentalIconProps {
  size?: number;
  color?: string;
}

function DentalIcon({
  size = 24,
  color = 'currentColor',
  children,
}: DentalIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** 임플란트 — 크라운 + 어버트먼트 + 픽스처(나사산). */
export function ImplantIcon(props: DentalIconProps) {
  return (
    <DentalIcon {...props}>
      <path d="M7.4 2.9c1.5-.8 3.1-.4 4.6.3 1.5-.7 3.1-1.1 4.6-.3 1.6.9 2 3 1.3 4.6L17.2 9H6.8l-.7-1.5c-.7-1.6-.3-3.7 1.3-4.6z" />
      <path d="M10.2 9v2.4h3.6V9" />
      <path d="M9.4 11.4h5.2l-1.1 8.4a1.5 1.5 0 0 1-3 0z" />
      <path d="M9.8 14.4l4.5-.9M10.2 17.3l3.8-.8" />
    </DentalIcon>
  );
}
ImplantIcon.displayName = 'ImplantIcon';

/** 교정 — 치아 + 브라켓 + 와이어. */
export function OrthodonticsIcon(props: DentalIconProps) {
  return (
    <DentalIcon {...props}>
      <path d="M7 3c1.7-.6 3.3-.2 5 .5 1.7-.7 3.3-1.1 5-.5 2 .8 2.6 3 2.2 5.5-.5 3-1.2 5.2-1.7 8-.4 2.3-.9 4.5-2.1 4.5-1.4 0-1.6-2.6-2-4.3-.3-1.3-.8-2.2-1.4-2.2s-1.1.9-1.4 2.2c-.4 1.7-.6 4.3-2 4.3-1.2 0-1.7-2.2-2.1-4.5-.5-2.8-1.2-5-1.7-8C4.4 6 5 3.8 7 3z" />
      <rect x="10" y="7.5" width="4" height="4" rx=".8" />
      <path d="M1.5 9.5H10M14 9.5h8.5" />
    </DentalIcon>
  );
}
OrthodonticsIcon.displayName = 'OrthodonticsIcon';

/** 사랑니·발치 — 치아 + 빼는 화살표. */
export function ExtractionIcon(props: DentalIconProps) {
  return (
    <DentalIcon {...props}>
      <path d="M12 1.5v5M9.5 4L12 1.5 14.5 4" />
      <path d="M8.3 9c1.2-.4 2.4-.1 3.7.4 1.3-.5 2.5-.8 3.7-.4 1.5.6 1.9 2.2 1.6 4-.4 2.2-.9 3.8-1.2 5.8-.3 1.7-.7 3.2-1.6 3.2-1 0-1.2-1.9-1.5-3.1-.2-.9-.6-1.6-1-1.6s-.8.7-1 1.6c-.3 1.2-.5 3.1-1.5 3.1-.9 0-1.3-1.5-1.6-3.2-.3-2-.8-3.6-1.2-5.8-.3-1.8.1-3.4 1.6-4z" />
    </DentalIcon>
  );
}
ExtractionIcon.displayName = 'ExtractionIcon';
