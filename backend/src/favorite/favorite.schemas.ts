import { z } from 'zod';

/**
 * `expand=hospital` 일 때만 병원 본문을 함께 싣는다.
 *
 * 기본이 id 배열인 이유: 하트 아이콘만 그리는 화면(병원 카드·상세)은 "찜했는가" 만
 * 알면 되는데, 그때마다 병원 본문 N개를 받는 것은 낭비다. 목록 화면만 `expand` 를 붙인다.
 */
export const listFavoritesQuerySchema = z.object({
  expand: z.literal('hospital').optional(),
});

export type ListFavoritesQuery = z.infer<typeof listFavoritesQuerySchema>;
