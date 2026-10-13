import { useRef, type KeyboardEvent } from 'react';

/**
 * APG 탭 패턴의 키보드 처리 — **화살표는 순환하고, 이동과 동시에 그 탭이 열린다**
 * (automatic activation). `Home`/`End` 는 양 끝으로 간다.
 *
 * 관리자 화면 두 곳(문의·상담 예약)이 같은 탭 줄을 쓴다. 각자 복사해 두면 한쪽만 고쳐져
 * 같은 생김새의 탭이 다르게 움직인다 — 키 처리를 한 곳에 둔다.
 */
export function useRovingTabs<K extends string>(keys: readonly K[], onSelect: (key: K) => void) {
  const refs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});

  const setRef = (key: K) => (node: HTMLButtonElement | null) => {
    refs.current[key] = node;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = keys.length - 1;
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % keys.length
        : event.key === 'ArrowLeft'
          ? (index + last) % keys.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextKey = keys[nextIndex];
    onSelect(nextKey);
    // 포커스는 이동한 탭을 따라간다 — 선택만 바뀌고 포커스가 남으면 다음 화살표가 제자리를 돈다.
    refs.current[nextKey]?.focus();
  };

  return { setRef, onKeyDown };
}
