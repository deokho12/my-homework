/**
 * 시술 분야 9개 — **서버가 갖는 원본** (docs/database/README.md §17.4).
 *
 * 이 파일은 **import 가 하나도 없다.** 프론트엔드의 동기화 테스트
 * (`frontend/src/features/procedure/taxonomy.sync.test.ts`)가 이 파일을 **상대 경로로**
 * 읽기 때문이다 — `@/…` 별칭이 하나라도 있으면 프론트 쪽 해석기가 그것을 풀 수 없다
 * (docs/database/README.md §17.8). 타입 선언과 배열 리터럴만 둔다.
 *
 * 이름·설명·순서는 `frontend/src/features/procedure/taxonomy.ts` 의 `CATEGORIES` 와
 * 같아야 하고, 갈라지면 그 동기화 테스트가 먼저 깨진다. 화면이 첫 프레임에 9개 격자를
 * 그려야 해서(네트워크를 기다리면 격자가 깜빡인다) 사본이 둘인 것이고, 분야 목록
 * 엔드포인트는 만들지 않았다 (docs/api/README.md §22.4).
 */

export interface ProcedureCategorySeedRow {
  /** implant | prevention | orthodontics | cavity | aesthetic | gum | tmj | botox | extraction */
  id: string;
  name: string;
  /** 홈 격자 카드의 한 줄 설명 */
  description: string;
}

/** `sort_order` 는 이 배열의 인덱스다 (시드가 넣는다). */
export const procedureCategories: ProcedureCategorySeedRow[] = [
  { id: 'implant', name: '임플란트', description: '상실된 치아를 인공 치근으로 대체해요' },
  { id: 'prevention', name: '스케일링·예방', description: '치석 제거부터 충치 예방까지' },
  { id: 'orthodontics', name: '교정', description: '치열과 교합을 가지런히' },
  { id: 'cavity', name: '충치치료', description: '초기 충치부터 신경치료·보철까지' },
  { id: 'aesthetic', name: '심미', description: '치아 색과 모양을 아름답게' },
  { id: 'gum', name: '잇몸치료', description: '잇몸 염증과 치주 질환 관리' },
  { id: 'tmj', name: '턱관절·스플린트', description: '턱 통증·이갈이·코골이 장치' },
  { id: 'botox', name: '보톡스', description: '이갈이 완화와 사각턱 개선' },
  { id: 'extraction', name: '사랑니·발치', description: '사랑니와 보존이 어려운 치아 발치' },
];
