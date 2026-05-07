# API Logger 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** nestjs-pino 기반 전역 로거를 구축해 dev 환경에서는 컬러 터미널 출력, prod 환경에서는 JSON 파일 로테이션 저장을 제공하고, 모든 로그에 requestId를 자동 포함한다.

**Architecture:** `LoggerModule`(@Global)이 `nestjs-pino`의 `LoggerModule.forRootAsync()`를 감싸 환경별 pino 옵션을 주입한다. `logger.config.ts`의 `buildLoggerParams()` 팩토리 함수가 dev/prod 분기 로직을 담당하며, `app.useLogger()`로 NestJS 내장 `ConsoleLogger`를 교체한다.

**Tech Stack:** nestjs-pino, pino-roll, pino-pretty(devDep), ConfigService(@nestjs/config), Node 24 내장 `crypto.randomUUID()`

---

## 파일 구조

| 경로 | 역할 |
| ---- | ---- |
| `services/api/src/logger/logger.config.ts` | **신규** — `buildLoggerParams(env, logMaxFiles)` 팩토리: dev/prod pino 옵션 반환 |
| `services/api/src/logger/logger.config.spec.ts` | **신규** — `buildLoggerParams` 단위 테스트 |
| `services/api/src/logger/logger.module.ts` | **신규** — `@Global()` LoggerModule, `nestjs-pino` 등록 |
| `services/api/src/app.module.ts` | **수정** — `LoggerModule` import 추가 |
| `services/api/src/main.ts` | **수정** — `ConsoleLogger` 제거, `bufferLogs + app.useLogger()` 적용 |
| `api.env.example` (루트) | **수정** — `LOG_MAX_FILES` 환경변수 추가 |

---

## Task 1: 패키지 설치

**Files:**
- Modify: `services/api/package.json` (npm이 자동 갱신)

- [ ] **Step 1: 패키지 설치**

```bash
cd services/api
npm install nestjs-pino pino pino-http pino-roll
npm install -D pino-pretty
```

- [ ] **Step 2: 설치 확인**

```bash
cd services/api
node -e "require('nestjs-pino'); require('pino-roll'); require('pino-pretty'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: 커밋**

```bash
git add services/api/package.json services/api/package-lock.json
git commit -m "chore: nestjs-pino, pino-roll, pino-pretty 패키지 추가"
```

---

## Task 2: logger.config.ts 구현 (TDD)

**Files:**
- Create: `services/api/src/logger/logger.config.spec.ts`
- Create: `services/api/src/logger/logger.config.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/logger.config.spec.ts` 파일 생성:

```ts
import type { IncomingMessage } from 'http';
import { buildLoggerParams } from './logger.config';

describe('buildLoggerParams', () => {
  it('인스턴스가 생성된다', () => {
    expect(buildLoggerParams('dev', 30)).toBeDefined();
  });

  describe('dev 환경', () => {
    let pinoHttp: Record<string, any>;

    beforeEach(() => {
      pinoHttp = buildLoggerParams('dev', 30).pinoHttp as Record<string, any>;
    });

    it('level이 debug이다', () => {
      expect(pinoHttp.level).toBe('debug');
    });

    it('autoLogging이 false이다', () => {
      expect(pinoHttp.autoLogging).toBe(false);
    });

    it('transport target이 pino-pretty이다', () => {
      expect(pinoHttp.transport.target).toBe('pino-pretty');
    });
  });

  describe('prod 환경', () => {
    let pinoHttp: Record<string, any>;

    beforeEach(() => {
      pinoHttp = buildLoggerParams('prod', 30).pinoHttp as Record<string, any>;
    });

    it('level이 warn이다', () => {
      expect(pinoHttp.level).toBe('warn');
    });

    it('autoLogging이 false이다', () => {
      expect(pinoHttp.autoLogging).toBe(false);
    });

    it('transport target이 pino-roll이다', () => {
      expect(pinoHttp.transport.target).toBe('pino-roll');
    });

    it('LOG_MAX_FILES가 limit.count에 반영된다', () => {
      const ph = buildLoggerParams('prod', 14).pinoHttp as Record<string, any>;
      expect(ph.transport.options.limit.count).toBe(14);
    });
  });

  describe('genReqId', () => {
    let genReqId: (req: any) => string;

    beforeEach(() => {
      const pinoHttp = buildLoggerParams('dev', 30).pinoHttp as Record<string, any>;
      genReqId = pinoHttp.genReqId;
    });

    it('X-Request-Id 헤더가 있으면 해당 값을 반환한다', () => {
      expect(genReqId({ headers: { 'x-request-id': 'test-id-123' } })).toBe('test-id-123');
    });

    it('X-Request-Id 헤더가 없으면 UUID 형식 문자열을 반환한다', () => {
      const id = genReqId({ headers: {} });
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api
npm test -- --testPathPattern=logger.config
```

Expected: FAIL — `Cannot find module './logger.config'`

- [ ] **Step 3: logger.config.ts 구현**

`services/api/src/logger/logger.config.ts` 파일 생성:

```ts
import type { IncomingMessage } from 'http';
import type { Params } from 'nestjs-pino';

export function buildLoggerParams(env: string, logMaxFiles: number): Params {
  const isDev = env === 'dev';

  return {
    pinoHttp: {
      level: isDev ? 'debug' : 'warn',
      autoLogging: false,
      genReqId: (req: IncomingMessage) => {
        const existing = req.headers['x-request-id'];
        if (typeof existing === 'string' && existing) return existing;
        return crypto.randomUUID();
      },
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: false },
          }
        : {
            target: 'pino-roll',
            options: {
              file: '/app/logs/app.log',
              frequency: 'daily',
              mkdir: true,
              limit: { count: logMaxFiles },
            },
          },
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api
npm test -- --testPathPattern=logger.config
```

Expected: PASS — 9개 테스트 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/logger.config.ts services/api/src/logger/logger.config.spec.ts
git commit -m "feat: buildLoggerParams 팩토리 구현 (dev/prod pino 옵션 분기)"
```

---

## Task 3: logger.module.ts 구현

**Files:**
- Create: `services/api/src/logger/logger.module.ts`

- [ ] **Step 1: logger.module.ts 구현**

`services/api/src/logger/logger.module.ts` 파일 생성:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { buildLoggerParams } from './logger.config';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV') ?? 'prod';
        const logMaxFiles = config.get<number>('LOG_MAX_FILES') ?? 30;
        return buildLoggerParams(env, logMaxFiles);
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
```

- [ ] **Step 2: 빌드 확인 (타입 오류 없음)**

```bash
cd services/api
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/logger/logger.module.ts
git commit -m "feat: LoggerModule 구현 (nestjs-pino 전역 등록)"
```

---

## Task 4: AppModule + main.ts 전역 연결

**Files:**
- Modify: `services/api/src/app.module.ts`
- Modify: `services/api/src/main.ts`

- [ ] **Step 1: AppModule에 LoggerModule 추가**

`services/api/src/app.module.ts`의 import 목록 상단에 추가:

```ts
import { LoggerModule } from './logger/logger.module';
```

`imports` 배열에서 `DatabaseModule` 바로 앞에 삽입:

```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  LoggerModule,          // ← 추가 (ConfigModule 다음, 나머지 모듈 앞)
  ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  // ... 기존 나머지 import
],
```

- [ ] **Step 2: main.ts 수정**

`services/api/src/main.ts`를 아래와 같이 수정한다.

**변경 전:**
```ts
import { ConsoleLogger, Logger } from '@nestjs/common';
// ...
const app = await NestFactory.create(AppModule, {
  logger: new ConsoleLogger({
    logLevels: ['error', 'warn'],
  }),
});
// ...
await app.listen(port, host);
Logger.log(`Application is running on: ${await app.getUrl()}`);
```

**변경 후:**
```ts
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
// ...
const app = await NestFactory.create(AppModule, { bufferLogs: true });
const pinoLogger = app.get(PinoLogger);
app.useLogger(pinoLogger);
// ...
await app.listen(port, host);
pinoLogger.log(`Application is running on: ${await app.getUrl()}`);
```

> `bufferLogs: true`는 모듈 초기화 중 발생하는 로그를 버퍼링했다가 `app.useLogger()` 호출 후 pino를 통해 한꺼번에 출력한다. 기존 `Logger` import(`@nestjs/common`)는 catch 블록의 `Logger.error` 정적 호출에 필요하므로 유지한다.

최종 `main.ts` 전체:

```ts
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const pinoLogger = app.get(PinoLogger);
  app.useLogger(pinoLogger);

  const configService = app.get(ConfigService);
  const host = configService.get<string>('HOST') || '0.0.0.0';
  const port = configService.get<string>('PORT') || '3000';

  // ───── Settings ──────────────────────────────
  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigins = configService
    .getOrThrow<string>('CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // ───── Swagger ─────────────────────────
  // 모든 Route 주소 확인용 (개발용)
  if (process.env.NODE_ENV === 'dev') {
    const config = new DocumentBuilder().setTitle('API Docs').build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document, {}); // http://localhost:3000/swagger 로 접속
  }

  // ───── Listen ─────────────────────────
  await app.listen(port, host);
  pinoLogger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((err: unknown) => {
  Logger.error('Application failed to start', err);
  process.exit(1);
});
```

- [ ] **Step 3: 빌드 확인**

```bash
cd services/api
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: 개발 서버 스모크 테스트**

```bash
cd services/api
npm run start:dev
```

Expected: 서버 기동 로그가 pino-pretty 포맷(컬러, 타임스탬프)으로 출력됨.
예시: `[12:00:00.000] INFO (NestFactory): Starting Nest application...`

Ctrl+C로 종료.

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/app.module.ts services/api/src/main.ts
git commit -m "feat: LoggerModule 전역 연결 및 ConsoleLogger를 pino로 교체"
```

---

## Task 5: api.env.example 업데이트

**Files:**
- Modify: `api.env.example` (루트)

- [ ] **Step 1: LOG_MAX_FILES 항목 추가**

`api.env.example` 파일 하단 `# MinIO` 섹션 앞에 추가:

```dotenv
# Logger
LOG_MAX_FILES=30
```

- [ ] **Step 2: 커밋**

```bash
git add api.env.example
git commit -m "chore: LOG_MAX_FILES 환경변수 예시 추가"
```

---

## Task 6: 전체 테스트 통과 확인

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd services/api
npm test
```

Expected: 기존 테스트 포함 전체 PASS (새 테스트 9개 추가)

- [ ] **Step 2: 빌드 확인**

```bash
cd services/api
npm run build
```

Expected: 오류 없이 `dist/` 생성
