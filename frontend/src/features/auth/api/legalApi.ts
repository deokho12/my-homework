/**
 * 회원가입 약관 동의에 필요한 **현재 약관 버전**을 받는다.
 *
 * 계약에 목록 엔드포인트가 없다 — `GET /legal-documents/{slug}` 하나뿐이고
 * `slug` 는 `terms | privacy | location | about` 이다 (`docs/api/openapi.yaml`).
 * 동의 대상 3개(`about` 은 동의 대상이 아니다)를 각각 부른다.
 *
 * **없으면 없는 대로 진행한다.** 백엔드에 아직 이 라우트가 없고(`backend/src/legal/` 에
 * 컨트롤러가 없다) `agreedTermsVersions` 는 선택 필드다. 버전을 추측해서 보내면
 * `422 UNKNOWN_TERMS_VERSION` 으로 가입 자체가 막히므로, 받은 것만 보낸다.
 * 라우트가 생기면 이 파일을 고치지 않고도 버전이 실려 나가기 시작한다.
 */
import { apiRequest } from '@/lib/apiClient';
import type { AgreedTermsVersion } from '@/features/auth/api/authApi';

export const AGREEMENT_SLUGS = ['terms', 'privacy', 'location'] as const;

export type AgreementSlug = (typeof AGREEMENT_SLUGS)[number];

export const AGREEMENT_LABEL: Record<AgreementSlug, string> = {
  terms: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  location: '위치기반 서비스 이용약관',
};

export const AGREEMENT_PATH: Record<AgreementSlug, string> = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  location: '/legal/location',
};

interface RawLegalDocument {
  slug?: unknown;
  version?: unknown;
}

async function fetchVersion(slug: AgreementSlug): Promise<AgreedTermsVersion | null> {
  try {
    const document = await apiRequest<RawLegalDocument>(`/legal-documents/${slug}`, { auth: false });

    return typeof document?.version === 'string' ? { slug, version: document.version } : null;
  } catch {
    // 404(아직 등록되지 않은 문서)·네트워크 오류 모두 "버전을 모른다" 로 취급한다.
    return null;
  }
}

export async function fetchAgreementVersions(): Promise<AgreedTermsVersion[]> {
  const results = await Promise.all(AGREEMENT_SLUGS.map(fetchVersion));

  return results.filter((version): version is AgreedTermsVersion => version !== null);
}
