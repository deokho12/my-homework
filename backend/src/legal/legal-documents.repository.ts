import { Injectable } from '@nestjs/common';

// 생성자 주입용 값 import (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';

/** 약관 문서 한 버전. 본문(`content`)은 가입 경로에서 필요하지 않아 싣지 않는다. */
export interface LegalDocumentVersion {
  id: string;
  slug: string;
  version: string;
  requiresAgreement: boolean;
  effectiveAt: Date;
}

/** `{slug, version}` 요청 항목. openapi `SignUpRequest.agreedTermsVersions[]` 와 같은 모양. */
export interface LegalDocumentRef {
  slug: string;
  version: string;
}

/**
 * `legal_documents` 조회.
 *
 * ☆ **행은 불변이다** (docs/database/README.md §11.3). 본문을 고치면 같은 `slug` 의 새 버전
 *   행을 만든다 — `user_agreements` 가 `legal_documents.id` 를 가리키므로, 행을 고치면
 *   과거 동의의 대상이 소급 변경되어 동의 기록이 증빙 능력을 잃는다.
 *   그래서 이 리포지토리에도 `update` 가 없다. 새 버전은 시드/마이그레이션이 넣는다
 *   (편집 화면은 없다 — §11.8-9).
 */
@Injectable()
export class LegalDocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `(slug, version)` 쌍으로 문서를 찾는다. **유니크 인덱스 `(slug, version)` 를 그대로 쓴다.**
   *
   * 없는 버전은 결과에 없다 — 호출부가 "요청한 것 전부를 찾았는가" 를 보고 422 를 낸다.
   */
  async findByRefs(refs: LegalDocumentRef[]): Promise<LegalDocumentVersion[]> {
    if (refs.length === 0) {
      return [];
    }

    return this.prisma.legalDocument.findMany({
      where: { OR: refs.map((ref) => ({ slug: ref.slug, version: ref.version })) },
      select: { id: true, slug: true, version: true, requiresAgreement: true, effectiveAt: true },
    });
  }

  /**
   * "지금 유효한 버전". `version` 문자열로 정렬하지 않는다 — `'1.10' < '1.9'` 가 되기 때문이고,
   * 순서는 항상 `effective_at` 이 정한다 (§11.3). 같은 시각의 타이브레이커는 `created_at`.
   */
  async findCurrent(slug: string, now: Date = new Date()): Promise<LegalDocumentVersion | null> {
    return this.prisma.legalDocument.findFirst({
      where: { slug, effectiveAt: { lte: now } },
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, slug: true, version: true, requiresAgreement: true, effectiveAt: true },
    });
  }
}
