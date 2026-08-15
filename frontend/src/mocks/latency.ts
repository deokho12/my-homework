// 실제 네트워크가 붙기 전에도 loading 상태가 실재하게 만드는 인위적 지연.
// 테스트에서는 0ms 로 떨어져 대기 없이 통과한다.
const DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 180;

export function delay(ms: number = DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
