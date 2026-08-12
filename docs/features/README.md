# 화면별 기능 문서

몰라몰라 앱의 **모든 화면이 지금 실제로 무엇을 할 수 있는지** 정리한 문서입니다.
개발을 몰라도 읽을 수 있게 썼습니다. 이걸 읽고 "이 화면의 이 기능을 이렇게 바꿔주세요" 라고 요청하시면 됩니다.

---

## 먼저 이것만 알아주세요

**이 앱은 아직 서버가 없습니다.** 그래서:

- 병원·의사·후기·이벤트는 전부 **샘플 데이터**입니다. 실제 병원이 아닙니다.
- 회원가입·상담신청·찜하기는 동작하지만 **브라우저 안에만 저장**됩니다. 다른 컴퓨터나 다른 브라우저에서는 안 보입니다.
- 상담을 신청해도 **실제로 병원에 연락이 가지 않습니다.** 신청 내용이 관리자 화면에 나타나기만 합니다.

"안 되는 것 같다" 싶을 때는 먼저 아래 [알려진 문제](known-issues.md)를 확인해 주세요. 이미 알고 있는 것일 수 있습니다.

---

## 상태 표시 읽는 법

각 문서의 기능 표에 붙는 표시입니다.

| 표시 | 뜻 | 요청할 때 |
|---|---|---|
| ✅ | 실제로 동작하고 저장까지 됩니다 | 이미 있는 기능입니다. 부족한 점을 구체적으로 알려주세요 |
| 🟡 | 화면은 되지만 데이터가 샘플입니다 | 기능은 있습니다. 실제 데이터를 넣는 건 서버가 필요합니다 |
| 🚧 | 버튼·영역만 있고 아직 아무 일도 안 일어납니다 | 실제로 만드는 작업입니다 |
| 🔒 | 로그인해야 쓸 수 있습니다 | |

---

## 화면 목록

### 사용자 화면

| 화면 | 주소 | 문서 |
|---|---|---|
| 홈 | `/` | [home.md](home.md) |
| 병원 탐색 | `/explore` | [explore.md](explore.md) |
| 커뮤니티 | `/community` | [community.md](community.md) |
| 마이페이지 | `/mypage` | [mypage.md](mypage.md) |
| 검색 | `/search` | [search.md](search.md) |
| 병원 상세 | `/hospital/:id` | [hospital-detail.md](hospital-detail.md) |
| 전문의 상세 | `/doctor/:id` | [doctor-detail.md](doctor-detail.md) |
| 상담 신청 | `/consult/:hospitalId` | [consult-request.md](consult-request.md) |
| 커뮤니티 글 상세 | `/community/:id` | [community-post.md](community-post.md) |
| 커뮤니티 글 작성 | `/community/new` | [community-new.md](community-new.md) |
| 시술 꿀팁 상세 | `/tips/:id` | [tip-detail.md](tip-detail.md) |
| 이벤트 | `/events` | [events.md](events.md) |
| 알림 | `/notifications` | [notifications.md](notifications.md) |
| 로그인 | `/auth/login` | [login.md](login.md) |
| 회원가입 | `/auth/signup` | [signup.md](signup.md) |

### 병원 관리자 화면

> ⚠️ **지금 관리자 화면에는 로그인 검사가 전혀 없습니다.** 주소만 알면 누구나 들어와 고객 실명·전화번호를 보고 데이터를 수정할 수 있습니다. **이 주소들을 외부에 공유하지 마세요.** 막는 작업이 예정되어 있습니다.

| 화면 | 주소 | 문서 |
|---|---|---|
| 관리자 홈 (병원 목록) | `/admin` | [admin-home.md](admin-home.md) |
| 병원 등록 | `/admin/hospital/new` | [admin-hospital-new.md](admin-hospital-new.md) |
| 병원 정보 수정 | `/admin/hospital/:id` | [admin-hospital-edit.md](admin-hospital-edit.md) |
| 전문의 인증 검수 | `/admin/specialists` | [admin-specialists.md](admin-specialists.md) |
| 상담 관리 | `/admin/consultations` | [admin-consultations.md](admin-consultations.md) |
| 상담 상세 | `/admin/consultations/:id` | [admin-consultation-detail.md](admin-consultation-detail.md) |
| 관리자 알림 | `/admin/notifications` | [admin-notifications.md](admin-notifications.md) |

### 안내 화면

> 아래 5개는 전부 `준비중입니다` 문구만 있는 빈 화면입니다. 약관 전문이나 소개 내용이 어디에도 없습니다.

| 화면 | 주소 | 문서 |
|---|---|---|
| 몰라몰라 알아보기 | `/about` | [about.md](about.md) |
| 병원 입점 문의 | `/partner-inquiry` | [partner-inquiry.md](partner-inquiry.md) |
| 서비스 이용약관 | `/legal/terms` | [legal-terms.md](legal-terms.md) |
| 개인정보 처리방침 | `/legal/privacy` | [legal-privacy.md](legal-privacy.md) |
| 위치기반 서비스 이용약관 | `/legal/location` | [legal-location.md](legal-location.md) |

---

## 요청하는 방법

### 방법 1 — 채팅으로 (간단한 요청)

채팅창에 이렇게 입력하세요.

```
/feature-request 병원 탐색 화면에 야간진료 필터를 추가해주세요
```

화면 이름과 원하는 것을 같이 적어주시면 됩니다. 부족한 정보는 되물어봅니다.

### 방법 2 — 요청서로 (정리해서 남기고 싶을 때)

1. `requests/_TEMPLATE.md` 를 복사합니다
2. `requests/2026-08-20-야간진료-필터.md` 처럼 날짜와 제목을 붙여 저장합니다
3. 내용을 채웁니다
4. 채팅창에 `/feature-request` 만 입력하면 대기 중인 요청서를 찾아 처리합니다

여러 사람이 요청을 내거나, 나중에 무엇을 왜 요청했는지 남겨야 할 때 이 방법이 좋습니다.

### 요청할 때 도움이 되는 것

- **하고 싶은 것**을 사용자 입장에서 써주세요. 어떻게 만들지는 몰라도 됩니다
- **왜 필요한지** 한 줄이라도 적어주세요. 더 나은 방법을 제안할 수 있습니다
- **대상 화면 문서를 먼저 훑어보세요.** 이미 있는 기능일 수 있고, 있는데 샘플 데이터라서 안 되는 것처럼 보였을 수 있습니다
- **어떻게 확인할지** 적어주세요. "이렇게 하면 이렇게 되어야 한다" 형태가 가장 좋습니다

---

## 문서가 코드와 안 맞을 때

이 문서는 사람이 갱신하는 것이라 코드가 바뀌면 뒤처질 수 있습니다.
문서와 실제 화면이 다르면 그 자체가 문제이니 알려주세요. 또는 개발 쪽에서 아래를 실행합니다.

```
/feature-docs-sync
```

---

## 개발자용 참고

- 새 화면 문서는 [`_TEMPLATE.md`](_TEMPLATE.md) 를 기준으로 만듭니다
- 품질 기준 예시는 [`hospital-detail.md`](hospital-detail.md) 입니다
- 코드를 바꾸면 **해당 화면 문서의 기능 표와 "알아두실 것"을 함께 갱신합니다.** 문서가 거짓이면 비개발자는 그걸 확인할 방법이 없습니다
- 진행 중인 구조 개편: [`../superpowers/plans/2026-08-12-frontend-stack-alignment.md`](../superpowers/plans/2026-08-12-frontend-stack-alignment.md)
