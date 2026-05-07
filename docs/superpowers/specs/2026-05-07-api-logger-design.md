# API Logger 설계

**날짜:** 2026-05-07
**대상 서비스:** `services/api`
**브랜치:** `feat/file-management`

---

## 목표

- 개발 환경: 컬러 터미널 출력으로 빠른 디버깅
- 운영 환경: JSON 파일 저장으로 추후 개인 로그 분석 서비스 연동
- 요청 단위 Correlation ID로 오류 발생 시점 추적
- 전역 수준 제어 (환경 기반 자동 분기)

---

## 패키지

```
dependencies:    nestjs-pino, pino-roll
devDependencies: pino-pretty
```

- `nestjs-pino`: NestJS LoggerService 교체, pino-http 포함
- `pino-roll`: prod 파일 로테이션 transport
- `pino-pretty`: dev 전용 컬러 출력 (prod 이미지 미포함)

---

## 디렉토리 구조

```
services/api/src/logger/
  logger.module.ts    — LoggerModule.forRootAsync() @Global 등록
  logger.config.ts    — 환경별 pino 옵션 팩토리
```

---

## 환경 분기

| 환경 (`NODE_ENV`) | transport    | level  | 출력                                    |
| ----------------- | ------------ | ------ | --------------------------------------- |
| `dev`             | `pino-pretty` | `debug` | 컬러 터미널                             |
| `prod` (기타)     | `pino-roll`  | `warn` | `/app/logs/app.YYYY-MM-DD.log` (JSON)  |

---

## Correlation ID

### 동작 방식

1. 요청 수신 시 `pino-http`의 `genReqId` 실행
2. `X-Request-Id` 헤더가 있으면 그 값을 사용 (Nginx 포워딩)
3. 없으면 `crypto.randomUUID()`로 UUID v4 생성 (Node 24 내장, 별도 패키지 불필요)
4. 이후 모든 로그에 `requestId` 자동 포함

### Nginx 연동 (선택)

```nginx
proxy_set_header X-Request-Id $request_id;
```

추가 시 Nginx 액세스 로그 ↔ API 로그를 `requestId`로 교차 조회 가능.

### 로그 출력 예시

**prod (JSON):**

```json
{
  "level": "error",
  "time": "2026-05-07T12:00:00.000Z",
  "requestId": "abc-123",
  "msg": "예상치 못한 오류",
  "stack": "Error: ..."
}
```

**dev (pretty):**

```
ERROR [ApiExceptionFilter] 예상치 못한 오류  requestId=abc-123
```

---

## 파일 로테이션 (prod)

| 항목          | 값                                          |
| ------------- | ------------------------------------------- |
| 저장 경로     | `/app/logs/app.YYYY-MM-DD.log`              |
| 로테이션 주기 | 일별 (`1d`)                                 |
| 최대 보관     | `LOG_MAX_FILES` 환경변수 (기본 30일)        |

`pino-roll`의 `limit.count` 옵션에 `LOG_MAX_FILES` 값이 매핑됨.

### Docker 볼륨 마운트

```yaml
volumes:
  - /nas/terab/logs:/app/logs
```

---

## 전역 연결

### AppModule

`LoggerModule`을 `imports` 배열에 추가.

### main.ts

```ts
app.useLogger(app.get(Logger));
```

NestJS 내장 `ConsoleLogger`를 pino로 교체.

### ApiExceptionFilter

코드 변경 없음. `new Logger(ApiExceptionFilter.name)` 호출이 자동으로 pino 인스턴스를 반환.

---

## HTTP 자동 로깅

`autoLogging: false`

Nginx가 HTTP 요청/응답 로그를 담당하므로 `pino-http`의 자동 로깅은 비활성화. Correlation ID 컨텍스트 주입 기능만 사용.

---

## 환경변수 추가

| 변수            | 기본값 | 설명                       |
| --------------- | ------ | -------------------------- |
| `LOG_MAX_FILES` | `30`   | prod 파일 최대 보관 일수   |

`api.env.example`에 추가 필요.

---

## 구현 범위 밖

- HTTP 요청/응답 로깅 (Nginx 담당)
- 로그 수준 런타임 변경
- 외부 로그 수집기 연동 (추후 transport 추가로 확장)
