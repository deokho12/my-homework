import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';

/** 화면의 고정 3지선다를 그대로 값으로 쓴다 (기존 데이터·타입 보존, 계약 명시). */
export const preferredTimeSchema = z.enum(['평일 오전', '평일 오후', '주말']);

export const consultStatusSchema = z.enum(['new', 'contacted', 'booked', 'cancelled']);

export type ConsultStatusValue = z.infer<typeof consultStatusSchema>;

/**
 * 상담 신청.
 *
 * **전화번호 형식을 서버가 검사한다.** 지금은 `1` 한 글자도, `없음` 도 통과한다 —
 * 화면에만 검사가 있어서 주소로 직접 들어가면 그대로 저장된다.
 */
export const createConsultRequestSchema = z.object({
  hospitalId: z.string().min(1),
  doctorId: z.string().min(1).nullish(),
  procedureId: z.string().min(1).nullish(),
  name: z.string().trim().min(1).max(50),
  phone: z
    .string()
    .trim()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '연락처 형식이 올바르지 않아요'),
  preferredTime: preferredTimeSchema,
  message: z.string().max(2000).optional().default(''),
});

export type CreateConsultRequestDto = z.infer<typeof createConsultRequestSchema>;

export const listConsultRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  /** `전체` 는 이 파라미터를 보내지 않는 것이다 (계약). */
  status: consultStatusSchema.optional(),
  hospitalId: z.string().min(1).optional(),
});

export type ListConsultRequestsQuery = z.infer<typeof listConsultRequestsQuerySchema>;

export const listMyConsultRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: consultStatusSchema.optional(),
});

export type ListMyConsultRequestsQuery = z.infer<typeof listMyConsultRequestsQuerySchema>;

export const updateConsultStatusSchema = z.object({ status: consultStatusSchema });

export type UpdateConsultStatusDto = z.infer<typeof updateConsultStatusSchema>;

export const createConsultMemoSchema = z.object({ content: z.string().trim().min(1).max(2000) });

export type CreateConsultMemoDto = z.infer<typeof createConsultMemoSchema>;
