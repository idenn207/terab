---
description: nestjs-pino 기반 로거 주입·호출·레벨 기준
globs:
  - "src/**/*.ts"
alwaysApply: false
---

# 로깅 패턴

## 주입

```ts
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class ExampleService {
  constructor(
    @InjectPinoLogger(ExampleService.name) private readonly logger: PinoLogger,
  ) {}
}
```

- `LoggerModule`은 `@Global()` 선언이므로 모듈에서 별도 import 불필요

## 레벨 기준

| 레벨 | 기준 |
|---|---|
| `debug` | 내부 동작 추적 — 메서드 진입, 외부 의존성 호출 시작 등 (prod 미출력) |
| `info` | 주요 비즈니스 이벤트 — 파일 업로드 완료, 세션 생성 등 운영에서 필수 확인 대상 |
| `warn` | 예상된 오류 — 4xx ApiException, 재시도 대상 일시 오류 |
| `error` | 예상치 못한 오류 — 5xx, 외부 서비스 실패 등 즉각 대응 필요 |

## 호출 형식

```ts
// 구조화 객체를 첫 번째 인자로, 메시지를 두 번째 인자로 전달
this.logger.info({ userId, fileId }, '파일 업로드 완료');
this.logger.warn({ url: request.url, status }, exception.message);
this.logger.error({ err, bucket, key }, 'putObject 실패');

// debug는 간단한 메시지만도 허용
this.logger.debug('MinioService 초기화');
```

- `err` 키로 Error 객체를 전달하면 pino가 스택 트레이스를 자동 직렬화
- 개인정보(이메일, 비밀번호 등)는 로그 객체에 포함하지 않는다

## 자동 Trace (service 메서드)

`ServiceCore`를 extends한 service의 public 메서드는 부팅 시 자동 wrap되어, 호출/완료/예외가 `RequestTraceContext`에 span으로 누적된다. 별도 로그 호출이 필요 없다.

- `this.logger.debug('메서드 진입/완료')` 같은 수동 로그는 작성하지 않는다. 자동 trace가 대체한다.
- 비즈니스 이벤트(파일 업로드 완료, 회원 가입 완료 등)는 여전히 `this.logger.info`로 명시적으로 남긴다.
- 입력 페이로드까지 운영 재현 자료로 남기려면 메서드에 `@LogReplay()` 부착.
- 특정 메서드를 자동 wrap에서 빼려면 `@SkipTrace()`.
- `ServiceCore`를 extends하지 않는 service는 클래스에 `@AutoTrace()` 부착.
- 민감 키 추가는 `PiiMasker.MASK_KEYS`에서만 관리한다.
