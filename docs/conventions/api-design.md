# API 설계 규칙

[Google API Improvement Proposals (AIP)](https://google.aip.dev/)와
[Google Cloud API Design Guide](https://cloud.google.com/apis/design)의 원칙을 이 저장소의 REST API 에 맞게 옮겼다.

**이 문서는 계약을 정하지 않는다.** 정본은 `docs/api/openapi.yaml` 과 `docs/api/README.md` 다.
이 문서는 **새 엔드포인트를 설계할 때** 무엇을 기준으로 고르는지를 적는다. 이미 확정된 계약이 Google 과
다르면 계약을 따른다 ([README.md](README.md#google-과-다르게-정한-것)의 표).

## 순서 — 계약 먼저

1. 화면 문서(`docs/features/*.md`)가 무엇을 요구하는지 확인한다. **소비하는 화면이 없으면 만들지 않는다.**
2. `db-master` 가 스키마를, `interface-master` 가 계약(`openapi.yaml` + `README.md` 의 설계 판단)을 확정한다.
3. 그다음에 서버와 화면을 구현한다. 구현하다가 계약이 틀렸다는 것을 알게 되면 코드를 계약에서 벗어나게
   두지 말고 **계약을 먼저 고친다.**

## 자원 중심 설계

Google API 는 동사가 아니라 **명사(자원)** 로 설계하고, 자원마다 정해진 표준 메서드를 쓴다 (AIP-121).

| 표준 메서드 | HTTP | 예 | 성공 응답 |
|---|---|---|---|
| List | `GET /<컬렉션>` | `GET /hospitals` | `200` + `{ items, meta }` |
| Get | `GET /<컬렉션>/{id}` | `GET /hospitals/{hospitalId}` | `200` + 자원 |
| Create | `POST /<컬렉션>` | `POST /consult-requests` | `201` + 만든 자원 |
| Update | `PATCH /<컬렉션>/{id}` | `PATCH /hospitals/{hospitalId}` | `200` + 바뀐 자원. **보낸 필드만** 바꾼다 |
| Delete | `DELETE /<컬렉션>/{id}` | | 계약의 해당 오퍼레이션을 따른다 |

- 표준 메서드로 표현하기 어려운 동작은 Google 은 `POST /자원:동사` 로 쓴다. 이 저장소는
  **하위 경로**로 쓴다 — `PATCH /consult-requests/{consultRequestId}/status`,
  `POST /notifications/read-all`. 새로 만들 때도 같은 모양을 따른다.
- 한 사용자의 것만 보는 목록은 `/me/` 아래에 둔다 (`GET /me/consult-requests`).
- 모든 경로는 `/api/v1` 아래다. 헬스체크(`GET /health`)만 예외다.

## 이름

| 무엇 | 형식 | 예 |
|---|---|---|
| 경로의 컬렉션 | `kebab-case`, 복수형 | `/consult-requests` |
| 경로 매개변수 | `lowerCamelCase` + `Id` | `{consultRequestId}` |
| JSON 필드·쿼리 매개변수 | `lowerCamelCase` | `pageSize`, `consultAvailable` |
| 상태·종류 값 | 소문자 문자열 | `'booked'`, `'cancelled'` |
| 에러 코드 | `UPPER_SNAKE_CASE` | `CONSULT_CLOSED` |
| 시각 필드 | `~At` + ISO 8601 UTC 문자열 | `createdAt: "2026-10-09T05:00:00.000Z"` |
| 달력 날짜 | `'YYYY-MM-DD'` 문자열 (KST) | `"2026-10-22"` |
| id | 문자열 | `"h1"`, cuid2 |

- **쿼리 매개변수 이름은 응답 필드 이름과 맞춘다** (`?procedureId=` ↔ `procedureId`).
- 화면 라벨이 실제 동작과 다르면 **동작을 따라** 이름 짓는다. 칩 이름은 `진료시간` 이지만 실제로는
  야간 상담 필터라 `nightConsult` 다 (`docs/api/README.md` §5).
- 새 필드는 같은 자원의 이웃 필드 형식을 따른다. 한 자원 안에서 `isXxx` 와 `xxx` 불리언이 섞이지 않게 한다.

## 목록 — 페이지네이션·필터·정렬

`docs/api/README.md` §5 가 정본이다. 요점:

- 요청 `?page=1&pageSize=20` (1부터, 기본 20, 최대 100), 응답 `{ items, meta: { page, pageSize, totalItems, totalPages } }`.
- 건수가 구조적으로 작고 고정인 목록만 배열을 그대로 준다. 새로 그렇게 하려면 근거를 계약에 적는다.
- 필터는 쿼리 매개변수이고 **AND** 로 결합한다. 불리언 필터는 `true` 만 의미가 있다.
- **정렬의 마지막 기준은 언제나 `id` 오름차순**이다. 그래야 페이지 사이에서 항목이 겹치거나 빠지지 않는다.

## 에러

`docs/api/README.md` §11 이 정본이다. Google 의 에러 모델(AIP-193)처럼 모든 에러가 한 형태다.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "입력값을 확인해주세요",
    "details": [{ "field": "phone", "code": "INVALID_PHONE_FORMAT", "message": "..." }],
    "requestId": "01J9X8V0Q3"
  }
}
```

상태 코드는 이렇게 고른다:

| 상황 | 상태 |
|---|---|
| JSON 이 아니거나 매개변수 타입이 깨짐 | `400` |
| 로그인 안 됨·토큰 만료 | `401` |
| 역할이 모자람, 공개 자원의 담당 범위 밖 | `403` |
| 자원 없음, **또는 존재 자체를 숨겨야 하는 남의 자원** | `404` |
| 현재 상태와 충돌 (중복 이메일, 상담 마감) | `409` |
| 형식은 맞지만 규칙에 어긋남 | `422` |

- 화면이 "어느 칸을 가리킬지" 정해야 하는 규칙 위반은 `VALIDATION_FAILED` 로 뭉뚱그리지 않고 전용 코드를 준다.
- 새 코드는 계약과 `ERROR_CATALOG` 에 함께 추가한다 ([backend.md](backend.md#에러)).

## 하위 호환

Google 은 같은 메이저 버전 안에서 기존 클라이언트를 깨지 않는다 (AIP-180).
이 저장소의 기준은 `docs/api/README.md` §15 다.

| `v1` 안에서 해도 되는 것 | `v2` 가 필요한 것 |
|---|---|
| 응답 필드 추가, 선택 매개변수 추가, 새 엔드포인트, enum 값 추가, `details` 항목 추가 | 필드 삭제·이름 변경·타입 변경, 필수 매개변수 추가, 응답 구조 변경, 기본값 변경으로 결과가 달라짐, 상태 코드 의미 변경, enum 값 삭제 |

- enum 값을 추가할 때는 클라이언트가 **모르는 값을 만나도 죽지 않는지** 먼저 확인한다.
- 계약 버전(`openapi.yaml` 의 `info.version`)을 올리고 무엇이 바뀌었는지 기록한다.

## 응답에 넣지 않는 것

- 소비하는 화면이 없는 필드. 넣는 순간 지워도 되는지 아무도 모르는 약속이 된다.
- 서버 내부 사정(테이블 이름, 내부 상태 플래그, 스택).
- 마스킹 규칙을 거치지 않은 개인정보. 마스킹 여부는 `piiMasked` 처럼 응답이 직접 알린다 (`docs/api/README.md` §4).

## 새 엔드포인트 체크리스트

- [ ] 이것을 부르는 화면이 `docs/features/` 에 있다
- [ ] 표준 메서드(List/Get/Create/Update)로 표현했다. 아니면 하위 경로로 표현한 이유가 있다
- [ ] 경로·필드·매개변수 이름이 위 표를 따르고, 이웃 엔드포인트와 같은 형식이다
- [ ] 목록이면 `{ items, meta }` 이고 정렬 마지막이 `id` 다
- [ ] 역할(`x-role`)과 담당 범위 규칙을 계약에 적었다
- [ ] 가능한 에러 코드를 전부 계약에 적었다
- [ ] 개인정보가 있으면 마스킹·감사 로그 규칙을 정했다
- [ ] 기존 클라이언트를 깨지 않는다 (깨면 `v2`)
- [ ] `openapi.yaml`, `docs/api/README.md`, 프론트의 api 함수 매핑표(§12)를 함께 고쳤다
