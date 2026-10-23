# 테스트 규칙

[*Software Engineering at Google*](https://abseil.io/resources/swe-book) 11~14장(테스트 개요·단위 테스트·
테스트 대역·큰 테스트)과 Google Testing Blog 의 *Testing on the Toilet* 시리즈를 기준으로 했다.

> **"좋아했다면 테스트를 달아 뒀어야지."** (Google 의 Beyoncé 규칙)
> 깨지면 안 되는 동작이 있으면 테스트로 고정한다. 다른 변경이 그것을 깨뜨렸을 때 책임은 테스트를
> 달지 않은 쪽에 있다.

## 테스트 크기

Google 은 테스트를 **무엇을 쓰는가**로 나눈다. 크기가 작을수록 빠르고, 결과가 늘 같다.

| 크기 | Google 의 정의 | 이 저장소에서 | 위치 |
|---|---|---|---|
| small | 한 프로세스. 파일·네트워크·DB·`sleep` 없음 | 순수 규칙(`transition`, `distance`, `sponsorship`), projection, zod 스키마, 컴포넌트 렌더(jsdom) | 프론트: 대상 옆 `*.test.ts(x)` / 백엔드: `test/<대상>.spec.ts` |
| medium | 한 기기. localhost 네트워크·DB 허용 | 백엔드 e2e — Nest 앱 + 테스트 DB(`prisma/test.db`) + supertest | `test/<대상>.e2e.spec.ts` |
| large | 여러 프로세스·실제 외부 시스템 | `qa-master` 가 서버와 화면을 실제로 띄워 확인하는 것 | 자동화 없음 |

- 비율은 Google 이 권하는 대략 **small 80% · medium 15% · large 5%** 를 목표로 한다.
  판정 규칙을 순수 함수로 떼는 이유가 여기 있다 — 경계값을 small 테스트로 싸게 고정할 수 있다.
- 백엔드 테스트는 **전용 DB** 를 쓴다. 실행할 때마다 다시 만들고, 개발 DB 는 건드리지 않는다
  (`docs/database/README.md` §8.7).

## 좋은 테스트의 조건

### 공개 API 로 테스트한다

사용자(다른 모듈, 화면, HTTP 클라이언트)가 부르는 방식 그대로 부른다. private 함수를 꺼내 테스트하거나
내부 상태를 들여다보지 않는다. **리팩터링했는데 테스트가 깨졌다면 테스트가 구현에 붙어 있던 것이다.**

### 메서드가 아니라 동작을 테스트한다

메서드 하나에 테스트 하나가 아니라, **동작 하나에 테스트 하나**다. 이름도 동작으로 짓는다.

```ts
// 나쁨 — 무엇을 보장하는지 이름에 없다
it('requiredInputs test', () => { ... });

// 좋음 — 실패하면 이름만 보고 무엇이 깨졌는지 안다
describe('requiredInputs — 전이는 전부 허용하고 입력만 본다', () => {
  it('예약확정은 확정 일시를 요구한다', () => {
    expect(requiredInputs('booked')).toEqual(['visitAt']);
  });
});
```

- `describe` 에는 대상과 한 줄 요약, `it` 에는 **한국어 문장으로 된 동작**을 쓴다.
- 경계와 예외를 각각의 `it` 으로 나눈다: "비었거나 읽을 수 없으면 null — 틀린 날짜를 지어내지 않는다".

### 준비 · 실행 · 확인을 나눈다

given / when / then 을 빈 줄로 나눈다. 실행은 한 번만 한다.

```ts
it('취소된 상담에는 취소 사유가 남는다', async () => {
  const consult = await createConsult({ status: 'booked' });

  await updateStatus(consult.id, { status: 'cancelled', cancelReason: 'patient_request' });

  expect(await getConsult(consult.id)).toMatchObject({ status: 'cancelled', cancelReason: 'patient_request' });
});
```

### 테스트에 로직을 넣지 않는다

`for`·`if`·문자열 조합으로 기대값을 계산하지 않는다. 테스트의 계산이 틀리면 버그를 그대로 통과시킨다.
**기대값은 리터럴로 쓴다.**

```ts
// 나쁨 — 구현과 같은 계산을 테스트가 반복한다. 구현이 틀리면 테스트도 똑같이 틀린다
expect(formatWon(amount)).toBe(`${new Intl.NumberFormat('ko-KR').format(amount)}원`);

// 좋음
expect(formatWon(1500000)).toBe('1,500,000원');
```

### DRY 보다 DAMP

테스트 코드는 중복을 줄이는 것보다 **읽는 사람이 그 자리에서 이해하는 것**(Descriptive And Meaningful
Phrases)이 중요하다. 공통 준비 함수(`beforeEach`, 헬퍼)에 핵심 값을 숨기지 않는다. 테스트가 확인하는 값은
테스트 본문에 보여야 한다.

### 실패 메시지가 원인을 말하게 한다

`expect(x).toBe(true)` 보다 `expect(list).toContain('h1')`, `toMatchObject` 처럼 실패할 때 차이를 보여주는
matcher 를 쓴다.

## 테스트 대역 (mock·stub·fake)

Google 은 **진짜 구현을 먼저** 쓰고, 그다음 fake, stub, 마지막으로 mock(호출 검증)을 쓴다.

| 선호 순서 | 무엇 | 이 저장소의 예 |
|---|---|---|
| 1. 진짜 구현 | 실제 객체·실제 DB | 백엔드 e2e 의 실제 Nest 앱 + SQLite 테스트 DB |
| 2. fake | 가볍지만 진짜처럼 동작하는 구현 | 메모리 저장소, `localCollection` |
| 3. stub | 정해진 값을 돌려주기만 함 | 지도 SDK 가 없을 때의 고정 응답 |
| 4. mock | "몇 번, 무엇으로 불렸나" 를 검증 | 외부로 나가는 호출처럼 결과가 상태로 남지 않는 것만 |

- **상호작용보다 상태를 확인한다.** "저장 함수가 한 번 불렸다" 보다 "저장 후 다시 읽으면 값이 있다" 가 낫다.
  호출 횟수를 검증하는 테스트는 구현을 바꿀 때마다 깨진다.
- **내가 소유하지 않은 타입은 mock 하지 않는다** (Testing on the Toilet). Prisma·Kakao SDK 를 통째로 흉내 내면
  라이브러리가 바뀌어도 테스트는 통과한다. 경계에 얇은 어댑터를 두고 그것을 바꿔 끼운다.

## 결과가 늘 같은 테스트

- **현재 시각과 난수를 주입한다.** 규칙 함수는 `now` 를 인자로 받는다. 시드 날짜는 실행일 기준
  상대값이다 (`backend/README.md` "시드 날짜 정책").
- `sleep`·`setTimeout` 으로 기다리지 않는다. 가짜 타이머(`vi.useFakeTimers`)나 `findBy*`·`waitFor` 를 쓴다.
- 테스트끼리 순서에 기대지 않는다. 각 테스트가 자기 데이터를 만든다.
- **불안정한 테스트는 버그다.** 재실행으로 넘기지 않고 원인을 고친다. 고칠 때까지는 `known-issues.md` 에 적는다.

## 프론트엔드 테스트

- Testing Library 로 **사용자가 보는 것**으로 찾는다: `getByRole('button', { name: '상담 신청' })`,
  `getByLabelText`, `getByText`. CSS 클래스·컴포넌트 내부 상태로 찾지 않는다.
- 입력은 `fireEvent` 보다 `userEvent` 로 한다. 실제 키보드·마우스 순서를 재현한다.
- 화면 상태 4가지(로딩·빈 결과·에러·정상)를 각각 확인한다.
- api 함수 테스트는 요청 모양(경로·쿼리·본문)과 에러 파싱을 고정한다.

## 동기화 테스트 — 같은 규칙이 두 곳에 있을 때

같은 판정은 한 곳에 두는 것이 원칙이다. 프론트와 서버처럼 코드를 공유할 수 없어 두 곳에 둘 때는
**두 구현이 같은 답을 내는지 테스트로 묶는다** (`frontend/src/features/consult/consultServerRules.sync.test.ts`).
서버 쪽 테스트는 경계값을, 동기화 테스트는 "두 구현이 같은가" 를 고정한다.

## 버그를 고칠 때

1. 버그를 재현하는 **실패하는 테스트를 먼저** 쓴다.
2. 고친다. 테스트가 통과한다.
3. 그 테스트가 회귀 방지로 남는다.

백엔드 기능은 테스트를 먼저 쓴다 (`CLAUDE.md` "서버를 바꾸는 작업의 순서" 3).

## 커버리지

커버리지는 **목표가 아니라 지표**다. Google 은 대략 60% 를 수용 가능, 75% 를 칭찬할 만함, 90% 를 모범으로
보지만, 숫자를 맞추려고 아무것도 확인하지 않는 테스트를 쓰는 것을 가장 경계한다. 커버리지 보고서는 **테스트가
닿지 않은 중요한 경로**를 찾는 데 쓴다.

## 실행

커밋 전 완료 게이트는 **프론트와 백엔드 둘 다** 돌린다. 바꾸지 않은 쪽도 돌린다 (`CLAUDE.md` 안전장치 1).

```bash
(cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build)
(cd backend  && npm run lint && npm run typecheck && npm run test:run && npm run build)
```
