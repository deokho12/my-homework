import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';

// 생성자 주입은 런타임 값이 필요하다 (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { isUserRole } from './auth.types';
import type { UserRole } from './auth.types';

/** 계정 조회 결과. **`passwordHash` 를 여기 담지 않는다** — 필요한 곳에서만 따로 읽는다. */
export interface AccountRecord {
  id: string;
  email: string;
  name: string;
  provider: string;
  role: UserRole;
}

/** 비밀번호 검증에만 쓰는 확장. 이 타입이 서비스 밖으로 나가지 않게 한다. */
export interface AccountWithSecret extends AccountRecord {
  passwordHash: string | null;
}

/**
 * `users` / `hospital_admins` 조회. 인증·인가가 필요한 DB 접근을 한곳에 모은다.
 *
 * **soft delete 규칙**: 탈퇴 계정(`deleted_at IS NOT NULL`)은 어떤 조회에도 잡히지 않는다.
 * 그래서 탈퇴 계정으로 로그인하면 "계정 없음" 과 같은 응답(`INVALID_CREDENTIALS`)이 되고,
 * 탈퇴 전 발급된 액세스 토큰은 `AuthGuard` 에서 401 이 된다.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 이메일은 항상 정규화(trim+lower)해서 비교한다 (docs/database/README.md §3.9). */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findByEmailWithSecret(email: string): Promise<AccountWithSecret | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: UsersRepository.normalizeEmail(email), deletedAt: null },
      select: { id: true, email: true, name: true, provider: true, role: true, passwordHash: true },
    });

    return row ? { ...row, role: toRole(row.role) } : null;
  }

  async findById(id: string): Promise<AccountRecord | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, name: true, provider: true, role: true },
    });

    return row ? { ...row, role: toRole(row.role) } : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    // 탈퇴 계정도 포함해서 본다: users.email 이 unique 라 탈퇴 계정 이메일로는
    // 재가입할 수 없다(그러면 INSERT 가 제약 위반으로 500 이 된다).
    const row = await this.prisma.user.findUnique({
      where: { email: UsersRepository.normalizeEmail(email) },
      select: { id: true },
    });

    return row !== null;
  }

  /**
   * 계정 생성 + 약관 동의 기록.
   *
   * ☆ **한 트랜잭션이다** (docs/database/README.md §11.3 "가입 시 처리"). 계정만 만들어지고
   *   동의 행이 없으면 그 계정은 **동의 없이 가입된 계정**이 되고, 동의 기록은 사후에
   *   재구성할 방법이 없다(누가 무엇에 동의했는지 추정할 근거가 없다).
   *
   * `userAgreement` 를 `createMany` 가 아니라 루프로 넣는 이유: 건수가 3 이하이고,
   * `createMany` 는 provider 별 지원 차이가 있어 이식성 규칙(§3)의 "두 DB 에서 같은 코드" 를
   * 지키는 편이 이득이 크다.
   */
  async create(input: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    now: Date;
    /** `legal_documents.id` 목록. 빈 배열이면 동의 행을 만들지 않는다 */
    agreedLegalDocumentIds?: string[];
  }): Promise<AccountRecord> {
    const data = {
      id: input.id,
      email: UsersRepository.normalizeEmail(input.email),
      name: input.name,
      provider: 'email',
      // 가입은 항상 일반 사용자다. 역할 승격 경로는 HTTP 에 존재하지 않는다
      // (docs/decisions/0001-roles-and-pii.md 결정 4).
      role: 'user',
      passwordHash: input.passwordHash,
      passwordSalt: null,
      createdAt: input.now,
      updatedAt: input.now,
    };
    const select = { id: true, email: true, name: true, provider: true, role: true } as const;
    const documentIds = input.agreedLegalDocumentIds ?? [];

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data, select });

      for (const legalDocumentId of documentIds) {
        await tx.userAgreement.create({
          data: { id: createId(), userId: created.id, legalDocumentId, agreedAt: input.now },
        });
      }

      return created;
    });

    return { ...row, role: toRole(row.role) };
  }

  /**
   * 담당 병원 id 목록.
   *
   * `operator` 도 이 목록은 **빈 배열**이다 — 운영자는 전 병원에 접근하지만 특정 병원의
   * "담당자" 는 아니다 (openapi `User.managedHospitalIds` 설명). 그래서 여기서 역할을
   * 보지 않고 `hospital_admins` 행만 읽는다. 운영자에게는 행이 없다.
   */
  async findManagedHospitalIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.hospitalAdmin.findMany({
      where: { userId },
      select: { hospitalId: true },
      orderBy: { hospitalId: 'asc' },
    });

    return rows.map((row) => row.hospitalId);
  }

  /** 담당 병원인지. 목록 전체를 가져오지 않는 단건 검사(관리 병원이 많은 계정 대비). */
  async isManagingHospital(userId: string, hospitalId: string): Promise<boolean> {
    const row = await this.prisma.hospitalAdmin.findUnique({
      where: { userId_hospitalId: { userId, hospitalId } },
      select: { id: true },
    });

    return row !== null;
  }
}

/**
 * DB 의 `role` 문자열 → 애플리케이션 타입.
 *
 * 알 수 없는 값이면 **가장 낮은 권한(`user`)으로 낮춘다.** 던지지 않는 이유: 오타나
 * 수동 UPDATE 로 이상한 값이 들어갔을 때 500 이 나면 원인을 찾기 어렵고, 무엇보다
 * "알 수 없는 역할" 을 권한으로 해석하면 안 된다.
 */
function toRole(value: string): UserRole {
  return isUserRole(value) ? value : 'user';
}
