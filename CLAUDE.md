@AGENTS.md

## 개발 워크플로 규칙

1. 새 화면/컴포넌트가 필요하면 → designer 에이전트 먼저 사용
2. 디자인이 나오면 → frontend-engineer 에이전트가 실제 기능(상태관리,
   로직, API 연동)을 붙임. 서버 쪽은 backend-engineer
3. 데이터 구조가 필요하면 → db-master 가 스키마를, interface-master 가
   API 규약을 먼저 확정한다
4. 구현이 끝나면 → code-reviewer 로 명세 부합을 검토
5. 그다음 → 반드시 qa-master 에이전트를 호출해서 실제 동작을 검증
6. qa-master가 "QA 통과"라고 확인하기 전까지는 해당 기능을
   완료된 것으로 간주하지 않는다
7. 특히 아래 항목은 QA에서 반드시 실제 동작까지 확인한다:
   - 로그인/로그아웃 (상태 변경 + 화면 반영 확인)
   - 상담신청, 찜하기 (데이터 저장 확인)
   - 필터/검색 (실제 리스트 변경 확인)
   - 폼 제출 (유효성 검사 + 제출 후 처리 확인)

이 규칙은 앞으로 모든 기능 작업에 항상 적용한다.

## 혼자 개발 체제 (2026-10-21 부터)

협업자가 떠나 요청자(안덕호)가 혼자 Claude Code 로 개발한다. 그 전에는 서버(`backend/`)를
협업자 영역으로 보고 계약·설계까지만 했지만, **이제 서버도 이 저장소에서 직접 만든다.**

- **협업자 확인을 기다리는 단계는 없다.** 문서에 남은 "협업자 확인 대기" 는 그때의 기록이다
- **제품 결정이 필요하면 요청자에게 묻는다.** 요청서에 답이 적혀 있으면 그대로 따른다
- **리뷰해 줄 사람이 없다.** 아래 안전장치가 그 자리를 대신한다 — 건너뛰지 않는다

### 서버를 바꾸는 작업의 순서

**계약 먼저** 원칙은 그대로다. 서버 변경이 있으면 이 순서로 간다:

1. `db-master` — 스키마·데이터 설계 (`docs/database/README.md`, `backend/prisma/schema.prisma` 설계)
2. `interface-master` — API 계약 (`docs/api/openapi.yaml`, `docs/api/README.md`)
3. `backend-engineer` — 서버 구현 (테스트 먼저)
4. 화면이 바뀌면 `designer` → `frontend-engineer` (위 워크플로 1·2)
5. `code-reviewer` → `qa-master` (위 워크플로 4~7). QA 는 서버를 실제로 띄워 확인한다

### 혼자 개발할 때의 안전장치 3가지

1. **커밋 전 완료 게이트를 프론트와 백엔드 둘 다 돌린다.** 바꾸지 않은 쪽도 돌린다
   (계약·타입을 공유하므로 한쪽 변경이 다른 쪽을 깨뜨릴 수 있다). lint 는 0 errors.
   **백엔드 테스트는 개발 DB(`backend/.env` 의 `DATABASE_URL`)를 그대로 쓴다** — 돌리기 전에 안전장치 2 로 백업한다
   ```bash
   (cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build)
   (cd backend  && npm run lint && npm run typecheck && npm run test:run && npm run build)
   ```
2. **서버 데이터 구조를 바꾸기 전에 개발 DB 를 백업한다.** `prisma migrate`·`prisma:reset`·
   시드 변경처럼 `backend/prisma/dev.db` 를 다시 만들거나 고치는 작업 전에:
   ```bash
   cp backend/prisma/dev.db "backend/prisma/dev.backup-$(date +%Y%m%d-%H%M).db"
   ```
   (`backend/.gitignore` 의 `prisma/*.db` 가 백업 파일도 커밋에서 뺀다 — 확인하고 진행)
3. **커밋 전에 비밀 키가 들어가지 않았는지 확인한다.** 저장소가 아직 **Public** 이다.
   - `git check-ignore backend/.env frontend/.env` 가 두 파일을 모두 출력하는지 (`.env.example` 만 커밋된다)
   - 올라갈 변경에 `.env`·`*.pem`·`*.key` 같은 파일이 없는지
   - 올라갈 변경의 추가된 줄에 키처럼 보이는 문자열이 없는지 — 알려진 토큰 형식
     (`AKIA…`, `ghp_…`, `sk-…`, `-----BEGIN … PRIVATE KEY`, JWT `eyJ….….`)과
     **실제 `.env` 값**(DB 주소·비밀번호·JWT 키·서비스키)이 그대로 들어갔는지. 값을 화면에 찍지 말고
     변수 이름만 보고한다
   - 키를 채팅에 붙여 넣게 하지 않는다. 요청자가 `.env` 에 직접 넣는다

### 커밋과 브랜치

- 요청서 하나가 **QA 를 통과하면 `main` 에 커밋하고 push 한다.** 혼자라 PR 리뷰 단계는 없다
- push 전에 `git fetch` 로 원격 `main` 이 앞서 있지 않은지 확인한다 (다른 기기에서 올린 커밋)
- 커밋 메시지 끝에는 이 세션이 안내하는 Co-Authored-By 줄을 붙인다
