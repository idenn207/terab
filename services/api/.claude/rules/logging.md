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
