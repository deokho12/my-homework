import type { INestApplication } from '@nestjs/common';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/http/request-id';

/**
 * HTTP 레벨 설정을 **한 곳에** 모은다. `main.ts` 와 e2e 테스트가 같은 함수를 호출한다.
 *
 * 이렇게 두는 이유: 예전에는 테스트가 `setGlobalPrefix` 를 직접 흉내내고 있었다.
 * 전역 필터나 미들웨어를 하나 추가하면 테스트가 조용히 다른 앱을 검증하게 되고,
 * "테스트는 통과하는데 운영에서 404/500" 이 나온다. 특히 인가 응답 형태(에러 본문)를
 * 검증하는 테스트에서 이 어긋남은 치명적이다.
 *
 * 미들웨어를 `AppModule.configure()` 대신 `app.use()` 로 붙인 것은 Express 5 의
 * 경로 문법(`'*'` 가 더 이상 유효한 패턴이 아니다) 때문이다. 모든 요청에 붙는
 * 미들웨어라 경로 매칭이 필요 없다.
 */
export function configureApp(app: INestApplication): void {
  // 요청 id 는 예외 필터보다 먼저 붙어야 한다 (에러 본문이 이 값을 쓴다)
  app.use(requestIdMiddleware);

  // 모든 라우트에 `/api/v1` 접두어. `docs/api/openapi.yaml` 의 `servers` 와 같은 값이고,
  // 프론트엔드는 `VITE_API_BASE_URL` 로, Flutter 앱은 같은 base URL 로 이 경로를 가리킨다.
  // 버전을 경로에 둔 이유: 클라이언트가 웹 하나가 아니라(모바일 앱이 붙는다) 구버전 앱을
  // 살려 두면서 응답 형태를 바꿀 방법이 필요하다.
  //
  // 헬스체크는 예외로 둔다 — 로드밸런서·컨테이너 프로브가 접두어도 **버전도** 알 필요가
  // 없어야 한다. `/api/v2` 를 붙이는 날 프로브 설정을 함께 고치는 상황을 만들지 않는다.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.useGlobalFilters(new AllExceptionsFilter());
}
