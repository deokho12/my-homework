import { SetMetadata } from '@nestjs/common';

export const HOSPITAL_SCOPE_METADATA_KEY = 'mola:hospital-scope';

/**
 * 담당 병원 검사의 대상 자원.
 *
 * 자원 종류가 **거부 응답 코드까지 결정한다** (docs/api/README.md §3 표):
 *
 * | 자원 | 담당 범위 밖 | 근거 |
 * |---|---|---|
 * | `hospital` | `403 HOSPITAL_NOT_MANAGED` | `GET /hospitals/{id}` 가 공개다. 존재를 숨겨 얻을 것이 없고, 원인을 알려주는 편이 낫다 |
 * | `doctor` | `403 HOSPITAL_NOT_MANAGED` | 위와 같다 |
 * | `consultRequest` | **`404 CONSULT_REQUEST_NOT_FOUND`** | 상담 id 가 고객 개인정보와 1:1 이다. 403 은 순차 대입으로 건수를 세는 열거 경로가 된다 |
 */
export type HospitalScopeResource = 'hospital' | 'doctor' | 'consultRequest';

export interface HospitalScopeOptions {
  resource: HospitalScopeResource;
  /** 자원 id 가 들어 있는 경로 파라미터 이름. 기본값은 자원별 관례(`hospitalId` 등). */
  param?: string;
}

/**
 * 3층 — 담당 범위 검사를 켠다. `AuthGuard`, `RolesGuard` 뒤에 `HospitalScopeGuard` 와 함께 쓴다.
 *
 * ```ts
 * @Patch(':hospitalId')
 * @Roles('hospital_admin', 'operator')
 * @HospitalScope({ resource: 'hospital' })
 * update(...) {}
 * ```
 */
export const HospitalScope = (options: HospitalScopeOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(HOSPITAL_SCOPE_METADATA_KEY, options);
