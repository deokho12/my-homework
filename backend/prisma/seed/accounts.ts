import * as bcrypt from 'bcryptjs';

/**
 * 시드가 만드는 **개발용 계정** 정의 (docs/database/README.md §8.3).
 *
 * fixture 에는 사용자가 없다. 그리고 브라우저 localStorage 에 남아 있던
 * 평문 비밀번호 계정은 **이전하지 않는다** (docs §7.4). 대신 여기서
 * 역할별 계정을 새로 만들고, 비밀번호는 `SEED_PASSWORD` 를 bcrypt 로 해시한다.
 */

/** bcrypt cost. docs §5.9 가 요구하는 하한(≥12). */
export const BCRYPT_COST = 12;

/** 모든 시드 계정의 이메일 도메인. `.example` 은 예약 도메인이라 메일이 나갈 수 없다. */
export const SEED_EMAIL_DOMAIN = 'molarmolar.example';

export type SeedRole = 'user' | 'hospital_admin' | 'operator';

export interface SeedAccount {
  id: string;
  email: string;
  name: string;
  role: SeedRole;
  /** hospital_admin 이면 담당 병원 id */
  hospitalId?: string;
}

/** 운영자 1명 — 전문의 인증 검수(`/admin/specialists`) 담당. */
export const OPERATOR: SeedAccount = {
  id: 'u-operator',
  email: `ops@${SEED_EMAIL_DOMAIN}`,
  name: '몰라몰라 운영자',
  role: 'operator',
};

/** 병원 담당자 — 병원 1곳당 1명. `hospital_admins` 에 (user, hospital) 1행씩. */
export function hospitalAdminAccount(hospitalId: string, hospitalName: string): SeedAccount {
  return {
    id: `u-admin-${hospitalId}`,
    email: `admin-${hospitalId}@${SEED_EMAIL_DOMAIN}`,
    name: `${hospitalName} 담당자`,
    role: 'hospital_admin',
    hospitalId,
  };
}

/** 일반 사용자 — 상담 신청자 7명. 이름은 상담 fixture 의 신청자 이름을 쓴다. */
export function userAccount(index: number, name: string): SeedAccount {
  return {
    id: `u-seed-${index}`,
    email: `seed-${index}@${SEED_EMAIL_DOMAIN}`,
    name,
    role: 'user',
  };
}

/**
 * `SEED_PASSWORD` 를 읽어 해시를 만든다.
 *
 * - 값이 없으면 **시드를 중단**한다. 해시를 코드에 하드코딩하지 않는다(docs §8.3).
 * - 해시는 **한 번만** 계산해서 모든 계정이 공유한다. 계정 19개를 각각
 *   bcrypt(12) 하면 시드가 20초 이상 느려지고, 어차피 전부 같은 개발용
 *   비밀번호이므로 salt 를 나눠서 얻는 것이 없다. (운영 가입 경로는 당연히
 *   계정마다 새로 해시한다)
 */
export async function resolvePasswordHash(rawPassword: string | undefined): Promise<string> {
  const password = rawPassword?.trim();

  if (!password) {
    throw new Error(
      'SEED_PASSWORD 가 비어 있습니다. `.env` 에 개발용 비밀번호를 넣고 다시 실행하세요 ' +
        '(.env.example 참고). 시드는 비밀번호 해시를 추측하지 않습니다.',
    );
  }

  if (password.length < 6) {
    // 애플리케이션 규칙과 같은 하한 (docs §5.9)
    throw new Error('SEED_PASSWORD 는 6자 이상이어야 합니다.');
  }

  return bcrypt.hash(password, BCRYPT_COST);
}
