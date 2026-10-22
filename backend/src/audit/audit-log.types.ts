import type { UserRole } from '../auth/auth.types';

/**
 * =============================================================================
 * 감사 로그의 허용값 — docs/api/README.md §4, docs/database/README.md §11.2
 * =============================================================================
 *
 * DB enum 을 쓰지 않기 때문에(이식성 규칙 §3.1) 허용값 검증은 애플리케이션 몫이다.
 * 그 목록이 여기 하나만 있어야 한다 — 두 곳에 흩어지면 한쪽만 늘어난다.
 */

/**
 * 허용값 12개. **이 배열이 정본이다** — `backend/prisma/schema.prisma` 의 `AuditLog` 주석과
 * `docs/api/README.md` §4 의 표가 이것을 따라간다 (2026-10-22 에 세 곳을 맞췄다).
 *
 * ☆ `user.role_grant_operator` / `user.role_revoke_operator` 는 **엔드포인트가 없다** —
 *   운영자 승격·회수 CLI 가 쓴다(결정 4 가 정한 유일한 승격 경로). 오퍼레이션 표에 줄이
 *   없는 이유는 그것이지 기록하지 않아서가 아니다.
 */
export const AUDIT_ACTIONS = [
  'consult_request.view',
  'partner_inquiry.view',
  'consult_request.status_change',
  // 같은 엔드포인트(`PATCH .../status`)지만 기록은 갈라야 한다 — before/after 에 들어가는
  // 것이 상태가 아니라 **일시**다 (`docs/api/README.md` §4, 요청서 15 가 더했다).
  'consult_request.reschedule',
  'consult_request.memo_create',
  'doctor.verify',
  'hospital_admin.assign',
  'hospital_admin.unassign',
  'hospital.create',
  'partner_inquiry.review',
  // ↓ HTTP 경로가 없는 두 값 (위 ☆ 참고)
  'user.role_grant_operator',
  'user.role_revoke_operator',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = [
  'consult_request',
  'partner_inquiry',
  'doctor',
  'hospital',
  'user',
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/**
 * 감사 로그 한 줄. **`actorRole` 과 `piiMasked` 는 스냅샷이다** — 호출부가 값을 주고,
 * 리포지토리는 `users.role` 을 조인하지 않는다 (docs/database/README.md §11.2-(2)).
 */
export interface AuditLogEntry {
  /** 행위자. `users.id` (FK Restrict — 감사 기록의 행위자는 사라질 수 없다) */
  actorUserId: string;
  /** ☆ **행위 시점의 역할 스냅샷.** 승격·해제로 바뀌는 `users.role` 을 조인하면 안 된다 */
  actorRole: UserRole;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  /** 병원 범위 행위일 때. 없으면 null */
  hospitalId?: string | null;
  /**
   * ☆ **마스킹 정책 스냅샷.**
   *   `true`  = 마스킹된 값을 봤다 (운영자)
   *   `false` = 마스킹하지 않은 개인정보를 봤다 (담당 병원 hospital_admin) ← 감사의 핵심 질문
   *   `null`  = 그 행위의 응답에 개인정보가 없다 (hospital.create, doctor.verify)
   *
   * `null` 을 빠뜨리고 `false` 를 넣으면 `WHERE pii_masked = false`("누가 원본을 봤나")가
   * 개인정보와 무관한 행위로 오염된다 (§11.2-(2)). 그래서 **선택 필드가 아니라 명시 필드**다.
   */
  piiMasked: boolean | null;
  /** 에러 응답의 `requestId` 와 같은 값. 애플리케이션 로그와의 상관관계 추적용 */
  requestId: string;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * 상태 전이형 행위의 전/후 값. 열람 행위는 둘 다 null.
   * **반려 사유·메모 본문 같은 자유 텍스트는 넣지 않는다** — 감사 로그가 개인정보 사본을
   * 하나 더 만들 이유가 없다 (§11.2-(3)).
   */
  beforeValue?: string | null;
  afterValue?: string | null;
}
