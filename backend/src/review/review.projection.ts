import type { Prisma } from '@prisma/client';

/**
 * 이 투영이 읽는 Prisma 행의 모양. `REVIEW_INCLUDE` 로 조회한 결과와 같다.
 *
 * Prisma 가 만든 타입을 그대로 쓰지 않고 여기서 다시 선언하는 이유: 투영을
 * 순수 함수로 테스트하려면 DB 없이 행을 만들 수 있어야 한다.
 */
export interface ReviewRow {
  id: string;
  hospitalId: string;
  procedureId: string;
  authorName: string;
  rating: number;
  content: string;
  createdAt: Date;
  photos: { url: string; sortOrder: number }[];
}

export const REVIEW_INCLUDE = {
  // sortOrder 에 유니크 제약이 없어 동점이 가능하다 — id tiebreaker 로 결정성을 만든다.
  photos: { select: { url: true, sortOrder: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ReviewInclude;

export interface ReviewResponse {
  id: string;
  hospitalId: string;
  procedureId: string;
  authorName: string;
  rating: number;
  content: string;
  /** `YYYY-MM-DD`. openapi 공통 규약이 `format: date` 로 명시한 예외 필드다. */
  createdAt: string;
  /** 사진이 없으면 필드 자체를 비운다 (`hospital.projection.ts` 의 `distanceKm?` 과 같은 패턴). */
  photos?: string[];
}

/**
 * DB 행 → 계약 `Review`.
 *
 * `createdAt` 은 `DateTime` 컬럼을 날짜만 남긴다. `toISOString().slice(0, 10)` 을 쓰는
 * 이유는 로컬 타임존 포매팅(`toLocaleDateString` 등)이 서버 타임존에 따라 하루 어긋날 수
 * 있기 때문이다.
 */
export function projectReview(row: ReviewRow): ReviewResponse {
  const response: ReviewResponse = {
    id: row.id,
    hospitalId: row.hospitalId,
    procedureId: row.procedureId,
    authorName: row.authorName,
    rating: row.rating,
    content: row.content,
    createdAt: row.createdAt.toISOString().slice(0, 10),
  };

  if (row.photos.length > 0) {
    response.photos = row.photos.map((photo) => photo.url);
  }

  return response;
}
