import { describe, expect, it } from 'vitest';

// 백엔드의 **import 0 순수 모듈**을 상대 경로로 읽는다 (`backend/src/consult/transition.ts`
// 머리말의 ★ 제약). 별칭(`@/…`)이나 `@nestjs/*` 가 하나라도 들어오면 프런트 쪽 해석기가
// 그것을 풀 수 없다. 앱 번들에는 들어가지 않는다 — 이 파일은 테스트 전용이고
// `npm run build` 의 진입점에서 도달할 수 없다 (`procedure/taxonomy.sync.test.ts` 와 같은 수법).
import {
  CONSULT_CANCEL_REASONS as SERVER_CANCEL_REASONS,
  CONSULT_STATUSES as SERVER_STATUSES,
  cancelReasonOf as serverCancelReasonOf,
  classifyEvent as serverClassifyEvent,
  isConsultCancelReason as serverIsCancelReason,
  nextVisitAt as serverNextVisitAt,
  periodRange as serverPeriodRange,
  requiredInputs as serverRequiredInputs,
  seoulDateKey as serverSeoulDateKey,
  truncateToMinute as serverTruncateToMinute,
  type ConsultPeriod as ServerPeriod,
  type ConsultStatus as ServerStatus,
} from '../../../../backend/src/consult/transition';
import {
  CONSULT_STATUS_LABEL as SERVER_STATUS_LABEL,
  formatVisitAt as serverFormatVisitAt,
} from '../../../../backend/src/consult/notification-text';

import { formatVisitAt } from '@/features/consult/consultDisplay';
import {
  cancelReasonOf,
  classifyEvent,
  nextVisitAt,
  periodRange,
  requiredInputs,
  truncateToMinute,
  seoulDateKey,
  type ConsultPeriod,
} from '@/features/consult/lib/transition';
import {
  CONSULT_CANCEL_REASONS,
  CONSULT_STATUSES,
  CONSULT_STATUS_LABEL,
  isConsultCancelReason,
  type ConsultCancelReason,
  type ConsultStatus,
  type ConsultStatusChange,
} from '@/types/domain';

/**
 * **같은 판정이 두 곳에 있는 이유를 지키는 테스트다** (AGENTS.md "같은 판정을 두 곳에 두지
 * 않는다"). 여기서 대조하는 것은 **화면이 런타임에 실제로 쓰는 규칙**뿐이다 — 상태 전이
 * (상태 폼이 "저장할 수 있다" 고 판정한 요청을 서버가 `422` 로 막으면 안 된다), 일시 표기
 * (`consultDisplay.formatVisitAt` — 마이페이지·상담 상세가 쓴다), 상태 라벨 다섯.
 *
 * **알림 문구는 서버만 만든다** (`backend/src/consult/notification-text.ts`, 그쪽
 * `backend/test/consult-notification-text.spec.ts` 가 문구를 고정한다). 화면은 서버가 저장해
 * 둔 `title`/`message` 를 그대로 그리므로 프런트에 비교할 사본이 없다 — 2026-10-22(요청서 15)에
 * 프런트 사본(`consultNotificationText.ts`·`lib/josa.ts`)을 지웠다.
 *
 * 사본이 둘이면 언젠가 갈라진다. 그 갈라짐을 **운영이 아니라 여기서** 멈춘다.
 */

/** 경계값 표 — 읽을 수 없는 값·초 자릿수·자정·월말이 모두 들어 있다. */
const VISIT_AT_CASES: (string | null)[] = [
  null,
  '',
  'not-a-date',
  '2026-10-09T05:00:00.000Z', // 10/9(금) 14:00 KST
  '2026-10-09T05:00:45.123Z', // 분 아래가 잘린다
  '2026-10-12T15:00:00.000Z', // 10/13(화) 00:00 KST — 자정은 24:00 이 아니다
  '2026-10-31T15:00:00.000Z', // 11/1(일) 00:00 KST — 달·요일 경계
  '2026-12-31T15:30:00.000Z', // 1/1(금) 00:30 KST — 해 경계
];

/** 서울 달력 경계가 걸리는 시각들. 자정 직전·직후, 월·해 넘김, 월요일/일요일. */
const NOW_CASES: string[] = [
  '2026-10-12T14:59:59.999Z', // 10/12(월) 23:59:59.999 KST
  '2026-10-12T15:00:00.000Z', // 10/13(화) 00:00 KST
  '2026-10-18T13:00:00.000Z', // 10/18(일) 22:00 KST — 주의 마지막 날
  '2026-10-18T15:00:00.000Z', // 10/19(월) 00:00 KST — 새 주의 첫 순간
  '2026-10-31T16:00:00.000Z', // 11/1(일) 01:00 KST — 달 경계 + 일요일
  '2026-12-31T15:00:00.000Z', // 2027-01-01(금) 00:00 KST — 해 경계
  '2026-03-01T00:00:00.000Z',
];

const PERIODS: ConsultPeriod[] = ['today', 'thisWeek', 'thisMonth', 'last30'];

describe('상담 전이 규칙 ↔ 서버 transition.ts', () => {
  it('상태 5개와 취소 사유 5개의 값·순서가 같다', () => {
    expect([...SERVER_STATUSES]).toEqual([...CONSULT_STATUSES]);
    expect([...SERVER_CANCEL_REASONS]).toEqual([...CONSULT_CANCEL_REASONS]);
  });

  it('필수 입력 판정이 모든 상태에서 같다', () => {
    for (const status of CONSULT_STATUSES) {
      expect([...serverRequiredInputs(status as ServerStatus)]).toEqual([...requiredInputs(status)]);
    }
  });

  it('분 아래 자르기가 같다 (읽을 수 없는 값 포함)', () => {
    for (const iso of VISIT_AT_CASES) {
      expect(serverTruncateToMinute(iso)).toBe(truncateToMinute(iso));
    }
    expect(serverTruncateToMinute(undefined)).toBe(truncateToMinute(undefined));
  });

  it('결과 일시 판정이 상태 × 현재값 × 요청값 전부에서 같다', () => {
    for (const status of CONSULT_STATUSES) {
      for (const current of VISIT_AT_CASES) {
        for (const requested of [...VISIT_AT_CASES, undefined]) {
          expect(serverNextVisitAt(status as ServerStatus, current, requested)).toBe(
            nextVisitAt(status, current, requested)
          );
        }
      }
    }
  });

  it('이벤트 종류(no-op 포함) 판정이 같다', () => {
    for (const from of CONSULT_STATUSES) {
      for (const to of CONSULT_STATUSES) {
        for (const currentVisit of VISIT_AT_CASES) {
          for (const nextVisit of VISIT_AT_CASES) {
            const current = { status: from, visitAt: currentVisit, cancelReason: null };
            const requested = { status: to, visitAt: nextVisit, cancelReason: null };

            expect(
              serverClassifyEvent(
                { ...current, status: from as ServerStatus },
                { ...requested, status: to as ServerStatus }
              )
            ).toBe(classifyEvent(current, requested));
          }
        }
      }
    }
  });

  it('기간 경계가 서울 달력의 자정·주·달·해 넘김에서 같다', () => {
    for (const iso of NOW_CASES) {
      const now = new Date(iso);

      expect(serverSeoulDateKey(now)).toBe(seoulDateKey(now));

      for (const period of PERIODS) {
        const [serverFrom, serverTo] = serverPeriodRange(period as ServerPeriod, now);
        const [from, to] = periodRange(period, now);

        expect(serverFrom.toISOString()).toBe(from.toISOString());
        expect(serverTo.toISOString()).toBe(to.toISOString());
      }
    }
  });

  it('파생 취소 사유가 이력 모양·모르는 코드에서 같다', () => {
    const histories: ConsultStatusChange[][] = [
      [],
      [{ status: 'new', changedAt: '2026-10-01T00:00:00.000Z' }],
      [
        { status: 'cancelled', changedAt: '2026-10-01T00:00:00.000Z', cancelReason: 'no_answer' as const },
        { status: 'contacted', changedAt: '2026-10-02T00:00:00.000Z' },
        { status: 'cancelled', changedAt: '2026-10-03T00:00:00.000Z', cancelReason: 'duplicate' as const },
      ],
      // 사유 없이 취소된 행 (계약 확장 이전)
      [{ status: 'cancelled', changedAt: '2026-10-01T00:00:00.000Z' }],
      // 우리가 모르는 코드 — 두 구현 모두 거르지 않고 그대로 돌려준다
      [{ status: 'cancelled', changedAt: '2026-10-01T00:00:00.000Z', cancelReason: 'nope' as ConsultCancelReason }],
    ];

    for (const status of CONSULT_STATUSES) {
      for (const history of histories) {
        expect(serverCancelReasonOf(status, history)).toBe(cancelReasonOf(status, history));
      }
    }
  });

  it('취소 사유 코드 판정이 같다 (빈 값·모르는 값 포함)', () => {
    for (const value of [...CONSULT_CANCEL_REASONS, 'nope', '', null, undefined]) {
      expect(serverIsCancelReason(value)).toBe(isConsultCancelReason(value as string | null | undefined));
    }
  });
});

/**
 * 알림 **문구** 는 여기서 대조하지 않는다 — 만드는 곳이 서버 하나뿐이라 비교할 상대가 없다
 * (`backend/src/consult/notification-text.ts`, `backend/test/consult-notification-text.spec.ts`).
 * 그 파일에서 가져오는 것은 **화면도 런타임에 쓰는 두 가지**, 상태 라벨과 일시 표기뿐이다.
 */
describe('상태 라벨·일시 표기 ↔ 서버 notification-text.ts', () => {
  it('상태 라벨 다섯이 같다', () => {
    for (const status of CONSULT_STATUSES) {
      expect(SERVER_STATUS_LABEL[status as ServerStatus]).toBe(CONSULT_STATUS_LABEL[status as ConsultStatus]);
    }
  });

  it('일시 표기가 자정·월말·읽을 수 없는 값에서 같다', () => {
    for (const iso of [...VISIT_AT_CASES, undefined]) {
      expect(serverFormatVisitAt(iso)).toBe(formatVisitAt(iso));
    }
  });

});
