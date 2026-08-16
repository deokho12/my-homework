import { seoulToday } from '../hospital/sponsorship';

/**
 * `이번 달 신규 상담` 의 달 경계.
 *
 * **기기 시계도 서버 로컬 타임존도 쓰지 않는다.** 화면이 세는 "이번 달" 은 한국 달력
 * 기준이고(계약이 `timezone: Asia/Seoul` 을 응답에 명시하라고 한다), 서버는 UTC 로 돈다.
 * 9시간 차이 때문에 매달 1일 0~9시 사이에 접수된 상담이 지난달로 새는 것을 막는다.
 *
 * `seoulToday()` 로 "서울 기준 오늘" 을 얻어 그 달의 1일을 KST 자정으로 만든다 —
 * 오늘이 무슨 날인지 판정하는 곳을 하나로 유지한다.
 */
export function seoulMonthStart(now: Date = new Date()): Date {
  const [year, month] = seoulToday(now).split('-');

  return new Date(`${year}-${month}-01T00:00:00+09:00`);
}

/** 화면 표기. 알림 문구가 이 라벨을 쓴다 (`상담 상태가 '예약완료'(으)로 변경되었어요`). */
export const CONSULT_STATUS_LABEL: Record<string, string> = {
  new: '신규',
  contacted: '연락중',
  booked: '예약완료',
  cancelled: '취소',
};
