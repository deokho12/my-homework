import { useEffect, useState } from 'react';

/**
 * `flag` 가 `delayMs` 동안 끊기지 않고 true 로 유지될 때만 true 를 돌려준다.
 *
 * 목 백엔드의 인위적 지연이 180ms 라서, 200ms 임계값이면 스피너가 목 환경에서
 * 사실상 노출되지 않는다 — 즉 로딩이 순식간에 끝나는 경우의 깜빡임을 막는다.
 * 실제 네트워크가 붙어 응답이 느려지면 그때부터 스피너가 나타난다.
 */
export function useDelayedFlag(flag: boolean, delayMs = 200): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!flag) return;

    const timer = setTimeout(() => setShow(true), delayMs);

    // 리셋을 cleanup 에 두면 effect 본문에서 동기로 setState 하지 않게 되고
    // (react-hooks/set-state-in-effect), flag 가 꺼지는 순간 즉시 false 가 된다.
    return () => {
      clearTimeout(timer);
      setShow(false);
    };
  }, [flag, delayMs]);

  return flag && show;
}
