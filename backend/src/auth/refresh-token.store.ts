import { Injectable } from '@nestjs/common';

/** `consume()` 의 결과. 호출부가 이 세 가지를 각각 다른 에러 코드로 바꾼다. */
export type RefreshConsumeResult =
  /** 정상 회전. 이 토큰은 방금 소비되어 다시 쓸 수 없다 */
  | { outcome: 'rotated'; familyId: string }
  /**
   * 쓸 수 없는 jti — 저장소에 없거나(정리 배치가 지운 만료 행), 폐기됐거나, 만료됐다
   * → REFRESH_TOKEN_INVALID
   */
  | { outcome: 'unknown' }
  /** 이미 소비된 jti 가 다시 왔다 → 계열 전체 폐기 + REFRESH_TOKEN_REUSED */
  | { outcome: 'reused'; familyId: string };

/** 세션 목록·이상 징후 확인용 스냅샷. 헤더가 없는 클라이언트면 둘 다 없다. */
export interface RefreshTokenClientInfo {
  userAgent?: string | null;
  ip?: string | null;
}

/**
 * =============================================================================
 * 리프레시 토큰 상태 저장소
 * =============================================================================
 *
 * **왜 저장소가 필요한가 (= 무상태로 갈 수 없는 이유)**
 *
 * 계약(docs/api/openapi.yaml `POST /auth/refresh`, docs/api/README.md §3)이 세 가지를 요구한다.
 *
 *   1. 회전 — 재발급마다 새 리프레시 토큰을 주고 **이전 것을 폐기**한다
 *   2. 재사용 감지 — 폐기된 토큰이 다시 오면 **계열 전체 무효화** + `REFRESH_TOKEN_REUSED`
 *   3. 역할 변경·로그아웃 시 **그 계정의 리프레시 토큰 전부 폐기**
 *
 * 세 가지 모두 "이 토큰이 아직 살아 있는가" 라는 **서버 상태**를 요구한다. JWT 서명만으로는
 * 만료 전 폐기가 불가능하다(서명은 계속 유효하다). 즉 무상태 설계로는 계약을 만족할 수 없다.
 *
 * **구현은 `PrismaRefreshTokenStore`(`refresh_tokens` 테이블) 하나다.** 이전에 있던
 * `InMemoryRefreshTokenStore` 는 지웠다 — 남겨 두면 (1) 재시작마다 전원 재로그인
 * (2) 인스턴스가 2개면 회전이 랜덤하게 실패 (3) CLI 가 세션을 폐기할 수 없음, 세 가지가
 * 그대로 살아 있고, 무엇보다 **소비·폐기를 삭제로 처리해서** 재사용 감지가 조용히 죽는
 * 구현 예시가 코드베이스에 남는다 (docs/database/README.md §11.1).
 *
 * **저장하는 것은 토큰이 아니라 `jti` 하나다.** 서명 검증은 비밀키가 하고, 이 저장소는
 * "그 jti 가 아직 살아 있는가" 만 답한다. 그래서 테이블이 유출돼도 토큰을 만들 수도,
 * 유효성을 판정할 수도 없다 (해시 컬럼도 두지 않은 이유 — §11.1).
 */
@Injectable()
export abstract class RefreshTokenStore {
  /** 발급한 토큰을 등록한다. */
  abstract register(entry: {
    jti: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    client?: RefreshTokenClientInfo;
  }): Promise<void>;

  /** 회전 시 호출. 정상이면 소비 처리하고, 재사용이면 계열을 폐기한다. */
  abstract consume(jti: string): Promise<RefreshConsumeResult>;

  /** 로그아웃 — 그 토큰 하나만 폐기한다. 없으면 아무 일도 하지 않는다(멱등). */
  abstract revoke(jti: string): Promise<void>;

  /** 역할 승격·해제, 비밀번호 변경 시 — 그 계정의 모든 리프레시 토큰을 폐기한다. */
  abstract revokeAllForUser(userId: string): Promise<number>;

  /** 그 토큰이 살아 있는지(테스트·진단용). */
  abstract isActive(jti: string): Promise<boolean>;
}
