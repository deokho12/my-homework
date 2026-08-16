# 상담·찜·알림 도메인 API — 설계 (조각 2)

**목표:** 계약의 상담·찜·알림 오퍼레이션 **15개**를 NestJS 로 구현하고, 프론트엔드의 해당
데이터 계층을 브라우저 저장(zustand `persist`)에서 서버로 옮긴다.

**선행:** 조각 1(`2026-08-13-hospital-doctor-domain-api`)이 끝나 있어야 한다. 이 조각은
그 조각이 만든 인가 3층·페이지네이션·투영 패턴을 그대로 복제한다.

**계약:** `docs/api/openapi.yaml` (아래 모든 필드·에러 코드의 권위)
**스키마:** `backend/prisma/schema.prisma` — 필요한 5개 모델이 **이미 있다. 마이그레이션이 없다.**

---

## 1. 범위

| 묶음 | 오퍼레이션 | 경로 |
|---|---|---|
| 찜 3 | `listMyFavorites` `addFavorite` `removeFavorite` | `GET/PUT/DELETE /me/favorites` |
| 알림 4 | `listNotifications` `getUnreadNotificationCount` `markNotificationAsRead` `markAllNotificationsAsRead` | `/notifications*` |
| 상담(신청자) 3 | `createConsultRequest` `listMyConsultRequests` `getMyConsultRequest` | `POST /consult-requests`, `GET /me/consult-requests` |
| 상담(관리자) 5 | `listConsultRequests` `getConsultRequest` `getConsultSummary` `updateConsultStatus` `addConsultMemo` | `/consult-requests*` |

### 왜 관리자 상담(원래 조각 3)을 함께 가져오는가

`useConsultStore` 하나를 **사용자 화면과 관리자 화면이 함께** 쓴다. 사용자 쪽만 서버로 옮기면
서버에 접수된 상담이 브라우저 저장을 읽는 관리자 화면에 보이지 않는다 —
`docs/features/known-issues.md` 의 개발자 메모가 "조심하라" 고 적어 둔 저장소 갈라짐이 그대로
재현된다. 상담은 **통째로** 옮긴다.

---

## 2. 백엔드 구조

조각 1 의 모듈 패턴(module + controller + service + repository + `*.projection.ts` + zod)을 복제한다.

| 파일 | 책임 |
|---|---|
| `src/favorite/favorite.module.ts` · `.controller.ts` · `.service.ts` · `.repository.ts` | 찜 3개 |
| `src/notification/notification.module.ts` · `.controller.ts` · `.service.ts` · `.repository.ts` | 알림 4개 |
| `src/notification/notification.projection.ts` | DB 행 + 내 수신자 행 → 계약 `AppNotification` |
| `src/notification/notification.write.ts` | ★ 알림 행 생성 헬퍼 (아래 D1) |
| `src/consult/consult.module.ts` · `.controller.ts` · `.service.ts` · `.repository.ts` | 상담 8개 |
| `src/consult/consult.projection.ts` | 관리자 시야 / 신청자 시야 두 함수 |
| `src/consult/masking.ts` | 이름·전화 마스킹 (순수 함수) |
| `src/consult/consult.schemas.ts` | zod |

`ConsultSummary` 의 달 경계는 조각 1 의 `hospital/sponsorship.ts` 에 있는 `seoulToday()` 를
재사용한다. 같은 규칙을 두 번 만들지 않는다.

---

## 3. 결정

### D1. 알림 쓰기는 트랜잭션 클라이언트를 받는 헬퍼 하나로 공유한다

지금 `doctor.repository.ts` 의 `decide()` 가 **검수 이력과 같은 트랜잭션 안에서** 알림 행과
수신자 행을 직접 만든다. 상담 접수·상태 변경도 똑같은 것이 필요하다.

서비스로 빼내 `NotificationService.emit()` 을 부르게 하면 **트랜잭션이 갈라진다** — 검수 결정은
남았는데 알림은 실패하거나 그 반대가 될 수 있다.

→ `notification/notification.write.ts` 에 순수 헬퍼를 둔다:

```ts
createNotificationWithRecipients(tx, { audience, type, title, message, relatedType, relatedId, hospitalId, recipientUserIds }, now)
```

`tx` 는 Prisma 트랜잭션 클라이언트다. **행 모양은 한 곳, 트랜잭션은 각 호출자가 자기 것을 연다.**
기존 `doctor.repository.ts` 의 인라인 생성도 이 헬퍼를 부르도록 바꾼다 — 같은 판정을 두 곳에
두지 않는다(`AGENTS.md`).

### D2. 개인정보 마스킹은 순수 함수이고 서버에서만 일어난다

계약이 표로 못 박았다: `hospital_admin`(담당 병원) → 원본, `operator` → `박*영` / `010-****-5678`,
그리고 `piiMasked` 를 **응답에 명시**한다.

`masking.ts` 는 DB 도 요청도 모른다 — 문자열과 역할만 받는다. 경계(두 글자 이름 `박*`,
네 글자 이상 `남궁민수` → `남**수`)를 DB 없이 테스트하기 위해서다.

**클라이언트가 역할로 추론하게 두지 않는다.** 추론은 인가 규칙을 클라이언트에 복제하는 것이고,
마스킹 정책이 바뀌면 두 곳을 고쳐야 한다.

### D3. 상담 투영은 둘이다 — 구조가 다르기 때문이다

`ConsultRequest`(관리자)에는 `memos` 와 `statusHistory[].changedByName` 이 있고
`MyConsultRequest`(신청자)에는 **없다.** 필드 집합이 다르므로 투영을 나눈다.

반대로 마스킹은 **값 변환**이라 스키마를 나누지 않는다(계약이 그 이유를 적어 두었다). 이
기준 — "구조가 다를 때만 나눈다" — 을 두 경우에 일관되게 적용한다.

**`memos` 가 신청자 응답에 절대 섞이지 않는 것**을 테스트로 고정한다. 내부 공유용 메모다.

### D4. 찜 목록은 기본이 id 배열이고, 병원 본문은 `expand=hospital` 일 때만 싣는다

계약의 `FavoriteList` 는 `hospitalIds` 가 필수이고 `hospitals` 는 선택이다. 찜 여부만 필요한
화면(하트 아이콘)이 병원 11곳 본문을 받지 않게 한다. 목록 화면만 `expand` 를 붙인다.

`PUT` · `DELETE` 는 **멱등**이다. 이미 찜한 병원에 `PUT` 을 다시 불러도 성공이고 행이 늘지 않는다
(`@@unique([userId, hospitalId])`). 없는 찜을 `DELETE` 해도 성공이다 — 하트를 두 번 누른 것이
에러가 될 이유가 없다.

### D5. 알림은 부수효과로만 생긴다 — 생성 엔드포인트가 없다

계약 명시. 프론트의 `services/notifications.ts`(`notifyUser`/`notifyAdmin`)는 **삭제**된다.

| 계기 | 수신자 | audience |
|---|---|---|
| 상담 접수 | 그 병원 담당자 전원 | `admin` |
| 상담 상태 변경 | 신청자 | `user` |
| 전문의 검수 결정 (조각 1 이 이미 만든다) | 그 병원 담당자 전원 | `admin` |

### D6. 같은 상태를 다시 지정하면 아무 일도 일어나지 않는다

지금은 이미 `예약완료` 인 상담에 `예약완료` 를 다시 눌러도 이력이 쌓이고 알림이 또 간다
(known-issues 🟡). 서버로 옮기는 김에 닫는다 — **상태가 같으면 이력도 알림도 만들지 않고**
현재 상태를 그대로 돌려준다(멱등). 에러가 아니다: 목록의 빠른 버튼 오탭이 실패로 보일 이유가 없다.

### D7. `relatedResource` 는 DB 의 `relatedType` 에서 투영한다

계약이 새로 넣은 필드다. DB 에 이미 `Notification.relatedType` 이 있으므로 **마이그레이션이 없다.**
이 필드가 있어야 알림함이 "상담이면 상담 상세, 전문의면 전문의" 로 보낼 수 있다 — 지금 관리자
알림함은 `relatedId` 만 보고 무조건 상담 상세로 보낸다(개발자 메모).

### D8. 브라우저에 남은 기존 데이터는 이관하지 않는다

`localStorage` 의 상담·알림·찜을 서버로 올려 주는 마이그레이션을 만들지 않는다. 개발 단계의
샘플 데이터이고, 올리려면 **인증되지 않은 클라이언트 데이터를 신뢰**해야 한다(남의 상담을
자기 것으로 올릴 수 있다). 부팅 시 그 키들을 지우는 것으로 끝낸다 — 조각 1 의
`purgeLegacyMockAuthStorage()` 와 같은 방식이다.

### D9. 상담 마감인 병원은 서버가 거절한다

지금은 화면이 버튼만 막고, 주소로 직접 들어가면 접수된다(known-issues 🟠). 서버가
`hospital.consultAvailable` 을 검사하고 **`409 CONSULT_CLOSED`** 로 거절한다(카탈로그에 이미 있다).
화면 검사는 남기되 **권위는 서버**다.

### D10. 에러 코드 2개를 카탈로그에 먼저 추가한다

계약의 `createConsultRequest` 가 쓰는 두 코드가 `common/errors/api-error.ts` 의
`ERROR_CATALOG` 에 **없다.** 구현보다 먼저 추가한다 — 카탈로그에 없는 코드는 던질 수 없다는
것이 조각 1 의 전역 규칙이다.

| 코드 | 상태 | 언제 |
|---|---|---|
| `DOCTOR_NOT_AT_HOSPITAL` | 422 | `doctorId` 가 그 병원 소속이 아님 |
| `PROCEDURE_NOT_OFFERED` | 422 | `procedureId` 를 그 병원이 취급하지 않음 |

두 값 모두 계약이 `422` 로 명시했다. 문구는 카탈로그의 다른 항목과 같은 결(사용자용 한국어,
마침표 없음)로 쓴다. 나머지(`CONSULT_CLOSED` 409 · `CONSULT_REQUEST_NOT_FOUND` 404)는 이미 있다.

---

## 4. 프론트엔드 구조

조각 1 의 이관 패턴을 그대로 쓴다 — `features/*/api` 만 HTTP 로 바꾸고 화면 시그니처는 유지.

| 신설 | 삭제 |
|---|---|
| `features/favorite/{api,hooks}` | `store/useFavoritesStore.ts` |
| `features/notification/{api,hooks}` | `store/useNotificationStore.ts` |
| `features/consult/{api,hooks}` | `store/useConsultStore.ts` · `services/notifications.ts` |
| `screens/me/consult-requests` (신규 화면) | `mocks/db.ts` · `mocks/db.test.ts` (이미 고아 — 소비자 0) |

**새 화면이 하나 있다:** 사용자 상담 내역. 마이페이지와 로그인 화면이 "상담 신청 내역을 확인할
수 있어요" 라고 안내하는데 그 화면이 없다(known-issues 🟠). `GET /me/consult-requests` 가 생기면
비로소 만들 수 있다. 화면 작업이므로 **designer 를 먼저 태운다**(`CLAUDE.md` 규칙 1).

---

## 5. 순서

```
백엔드 (화면과 겹치지 않는다)
  1  마스킹 순수 함수
  2  알림 쓰기 헬퍼 + doctor.repository 통합
  3  알림 조회 4개
  4  찜 3개
  5  상담 투영 2개 (관리자/신청자)
  6  상담 신청 + 내 내역 3개
  7  관리자 상담 5개 (목록·상세·요약·상태·메모)

프론트엔드
  8  favorite feature 이관 + 스토어 삭제
  9  notification feature 이관 + 스토어 삭제
  10 consult feature 이관 (사용자·관리자 동시) + 스토어 삭제
  11 사용자 상담 내역 화면 (designer → frontend-engineer)
  12 mocks/db.ts 삭제, 문서 갱신, QA
```

10 을 사용자·관리자 동시에 하는 이유는 §1 과 같다 — 나누면 그 사이에 저장소가 갈라진다.

---

## 6. 이 조각이 닫는 알려진 문제

| | 어떻게 |
|---|---|
| 🔴 다른 사람의 알림이 보입니다 | 서버가 `NotificationRecipient` 로 거른다 |
| 🟠 어느 전문의를 지목했는지 저장되지 않습니다 | `ConsultRequest.doctorId` 를 받아 저장 |
| 🟠 상담 마감인 병원도 접수됩니다 | D9 |
| 🟠 상담 신청 내역 화면이 없습니다 | 새 화면 + `GET /me/consult-requests` |
| 🟡 같은 상태를 다시 눌러도 처리됩니다 | D6 |
| 🟡 이번 달 신규 상담이 항상 0입니다 | 서버가 `Asia/Seoul` 로 계산 (`getConsultSummary`) |
| 🟡 검수 결과가 병원에 통보되지 않습니다 (절반) | 알림함이 서버 알림을 읽으면 완성된다 |
| 메모: 관리자 알림 이동이 종류를 구분하지 않음 | D7 |

---

## 7. 이 조각이 하지 않는 것

- **커뮤니티·콘텐츠·검색** — 조각 4. `community` 5 · `content` 4 · `search` 4 · `geo` 1
- **병원 담당자 지정 · 입점 문의 · 소셜 로그인** — `operator` 3 · `support` 4 · `auth` 1
- **요청 한도(429) · 감사 로그 HTTP 배선 · 비밀번호 찾기** — 계약에 있고 구현이 없는 기반 항목.
  특히 **상담 상세 열람 감사 기록**(결정 3)은 이 조각이 만드는 `getConsultRequest` 가 바로 그
  배선 지점이다. 넣을지 여부를 계획 단계에서 정한다
- **`preferredTime` 을 코드 기반 enum 으로 교체** — 계약이 미결로 남긴 항목. 기존 데이터·타입을 보존한다
- **메모에 적힌 연락처가 마스킹을 우회하는 문제** — 계약이 "화면 안내가 필요하다(미결)" 로 남겼다.
  자유 텍스트라 서버가 막을 수 없다
