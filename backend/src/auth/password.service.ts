import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

/**
 * bcrypt cost. **시드(prisma/seed/accounts.ts BCRYPT_COST)와 같은 값이어야 한다** —
 * 다르면 시드 계정과 가입 계정의 해시 강도가 갈린다. docs/database/README.md §5.9 하한은 12.
 */
export const BCRYPT_COST = 12;

/**
 * 존재하지 않는 계정으로 로그인했을 때 비교에 쓰는 더미 해시.
 *
 * 없으면 "계정 없음" 은 bcrypt 를 건너뛰어 즉시 응답하고, "비밀번호 틀림" 은
 * cost 12 만큼(수십~수백 ms) 걸린다. 응답 코드·문구를 같게 맞춰도 **응답 시간으로
 * 계정 존재 여부가 새어 나간다.** 그래서 계정이 없을 때도 같은 비용을 지불한다.
 * (cost 12 로 'x' 를 해시한 고정 값 — 비밀 정보가 아니다)
 */
const DUMMY_HASH = '$2b$12$e3AQGTHDYjp2K5.ThFvmp.qbkxyyvLK1rVSoNUp3xkIxLCUwJvqIC';

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  /**
   * 해시와 비교한다. `storedHash` 가 없는 계정(소셜 로그인 계정)은 **항상 실패**하되
   * 더미 해시로 같은 시간을 쓴다.
   */
  async verify(plain: string, storedHash: string | null): Promise<boolean> {
    if (!storedHash) {
      await bcrypt.compare(plain, DUMMY_HASH);

      return false;
    }

    return bcrypt.compare(plain, storedHash);
  }

  /** 계정 자체가 없을 때 호출한다. 결과는 언제나 false 이고 목적은 시간 소비다. */
  async burnTime(plain: string): Promise<void> {
    await bcrypt.compare(plain, DUMMY_HASH);
  }
}
