import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';

/**
 * 상담 요청·쿼리 스키마. **브랜치의 같은 이름 파일은 버리고 다시 썼다** — 2026-10-12·13 계약
 * 개정으로 상태 5개·희망 시간 4개·동의 객체·반복 파라미터·기간 프리셋이 전부 새로 생겼다.
 *
 * 값 집합의 **정본은 `./transition.ts`** 다 (import 가 0 인 순수 모듈). 여기서 enum 을 또
 * 적으면 상태가 하나 늘 때 한쪽만 고쳐진다.
 *
 * 두 가지가 일부러 **느슨하다** — 검사 순서가 계약이기 때문이다 (`docs/api/README.md` §9):
 *
 * | 필드 | 왜 zod 가 보지 않는가 |
 * |---|---|
 * | `phone` 의 형식 | 동의 검사가 **먼저**여야 한다. zod 가 먼저 돌면 동의 없는 요청이 `INVALID_PHONE_FORMAT` 으로 거절된다 — 화면이 가리킬 칸이 달라진다 |
 * | `cancelReason` 의 값 | 없을 때(`CANCEL_REASON_REQUIRED`)와 모르는 값일 때(`INVALID_CANCEL_REASON`)의 **코드가 다르다.** zod enum 은 둘을 한 코드로 뭉갠다 |
 *
 * 둘 다 서비스가 순서대로 검사하고 계약의 `details[].code` 를 직접 짚는다.
 */
import { CONSULT_STATUSES } from './transition';

const statusSchema = z.enum(CONSULT_STATUSES as [string, ...string[]]);

/** 화면의 고정 4지선다를 그대로 값으로 쓴다 (계약 `ConsultPreferredTime`). */
export const preferredTimeSchema = z.enum(['평일 오전', '평일 오후', '평일 저녁', '주말']);

/** `?status=new&status=contacted` — 하나만 보내던 기존 요청도 그대로 동작한다. */
function repeatable<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(
    (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
    z.array(item),
  );
}

/**
 * 상담 신청. **`thirdPartyConsent` 는 `agreed`/`noticeVersion` 만 본다** — 동의 여부 자체는
 * 서비스가 zod 보다 **먼저** 검사한다(위 표). 여기 오면 이미 `agreed === true` 다.
 */
export const createConsultRequestSchema = z.object({
  hospitalId: z.string().min(1),
  doctorId: z.string().min(1).nullish(),
  // 모르는 시술 id 를 422 로 막지 않는다 — 폐기된 옛 id 로 들어온 요청은 "그 병원이 취급하지
  // 않는 시술"(`PROCEDURE_NOT_OFFERED`)로 자연히 걸린다. `GET /hospitals` 의 필터와 같은 판단이다.
  procedureId: z.string().min(1).nullish(),
  name: z.string().trim().min(1).max(50),
  phone: z.string().trim().min(1),
  preferredTime: preferredTimeSchema,
  message: z.string().max(2000).optional().default(''),
  thirdPartyConsent: z.object({
    agreed: z.boolean(),
    // 서버는 버전을 **검증하지 않는다** — 서버가 모르는 문구의 버전을 판정할 근거가 없다(계약).
    noticeVersion: z.string().trim().min(1).max(32),
  }),
});

export type CreateConsultRequestDto = z.infer<typeof createConsultRequestSchema>;

export const listConsultRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  /** `전체` 는 이 파라미터를 보내지 않는 것이다 (계약 §5 — 꺼진 조건은 보내지 않는다). */
  status: repeatable(statusSchema).optional(),
  hospitalId: z.string().min(1).optional(),
  period: z.enum(['today', 'thisWeek', 'thisMonth', 'last30']).optional(),
  createdFrom: z.string().datetime({ offset: true }).optional(),
  createdTo: z.string().datetime({ offset: true }).optional(),
  procedureId: repeatable(z.string().min(1)).optional(),
  q: z.string().max(100).optional(),
});

export type ListConsultRequestsQuery = z.infer<typeof listConsultRequestsQuerySchema>;

export const listMyConsultRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: statusSchema.optional(),
});

export type ListMyConsultRequestsQuery = z.infer<typeof listMyConsultRequestsQuerySchema>;

/**
 * 상태 변경 · 예약 일시 변경. **본문은 세 필드뿐이다.**
 *
 * 계약에 없는 키(프런트 흉내 구현이 보내던 `hospitalName`)는 **조용히 버린다** — zod 를
 * `.strict()` 로 쓰지 않는 규약(`docs/api/README.md`)이 그대로 적용된다. 알림 문구의 병원
 * 이름은 서버가 `hospitals` 를 조인해 얻는다.
 */
export const updateConsultStatusSchema = z.object({
  status: statusSchema,
  visitAt: z.string().datetime({ offset: true }).nullish(),
  /** 값 검사는 서비스가 한다 (위 표 — 두 오류의 코드가 다르다). */
  cancelReason: z.string().nullish(),
});

export type UpdateConsultStatusDto = z.infer<typeof updateConsultStatusSchema>;

export const createConsultMemoSchema = z.object({ content: z.string().trim().min(1).max(2000) });

export type CreateConsultMemoDto = z.infer<typeof createConsultMemoSchema>;
