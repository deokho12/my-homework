import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * `?field=businessHours` 로 들어온 요청을 **그 입력 칸으로** 데려간다.
 *
 * 보내는 쪽이 셋이다 — 대시보드 완성도 칩, 노출 경고의 `시술 등록하러 가기`, 사이드 메뉴의
 * `의료진`. 셋 다 같은 어휘(`HOSPITAL_FIELD_KEYS` + `doctors`)를 쓰므로 **받는 쪽 코드는
 * 하나뿐**이다. 서버 `422` 의 `details[].field` 도 같은 어휘라, 언젠가 검증 오류에서
 * 점프할 때도 이 함수가 그대로 쓰인다.
 *
 * 데이터가 오기 전에는 칸이 아직 없다 — `ready` 가 true 가 된 뒤에 한 번만 움직인다.
 */

/** 강조가 남아 있는 시간. 지나면 지운다 — 영구 테두리는 "오류" 로 읽힌다. */
const HIGHLIGHT_MS = 2000;

const HIGHLIGHT_CLASSES = ['ring-2', 'ring-brand-500', 'ring-offset-2', 'rounded-xl'];

/** 폼의 각 칸을 감싼 요소의 id 규약. 한 곳에서만 만든다. */
export function fieldAnchorId(field: string): string {
  return `hospital-field-${field}`;
}

export function useFieldJump(field: string | undefined, { ready }: { ready: boolean }): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const jumped = useRef<string | null>(null);

  useEffect(() => {
    if (!field) {
      // 파라미터가 사라졌다(= 방금 지웠거나 애초에 없었다). **다음 요청을 받을 수 있게
      // 비운다** — 비우지 않으면 같은 칸으로 두 번째 점프(메뉴 `의료진` 재클릭)가 조용히
      // 무시되고 주소에 `?field=` 만 남는다.
      jumped.current = null;

      return;
    }

    if (!ready) return;
    // 같은 요청으로 두 번 움직이지 않는다 (리렌더마다 스크롤이 튀지 않게).
    if (jumped.current === field) return;

    const anchor = document.getElementById(fieldAnchorId(field));
    jumped.current = field;

    // 주소에서 파라미터를 지운다 — 새로고침·뒤로가기 때 다시 튀지 않고, 그 화면의 주소가
    // 하나로 유지된다 ("기본값은 주소에 적지 않는다" 와 같은 규칙).
    navigate(pathname, { replace: true });

    if (!anchor) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    anchor.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });

    // 섹션 전체가 아니라 **안쪽의 첫 입력 칸**에 포커스를 준다. 입력 칸이 없는 묶음
    // (시술 체크박스·의료진)은 섹션 자체가 `tabIndex={-1}` 이라 거기로 간다.
    const focusTarget = anchor.querySelector<HTMLElement>('input, textarea, select') ?? anchor;
    focusTarget.focus({ preventScroll: true });

    anchor.classList.add(...HIGHLIGHT_CLASSES);
    const timer = setTimeout(() => anchor.classList.remove(...HIGHLIGHT_CLASSES), HIGHLIGHT_MS);

    return () => clearTimeout(timer);
  }, [field, ready, navigate, pathname]);
}
