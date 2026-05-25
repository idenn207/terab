# API Core / Logging 일관성 정리 설계

- **작성일**: 2026-05-14
- **대상 서비스**: `services/api`
- **상태**: Draft (사용자 리뷰 대기)

---

## 0. 배경과 목표

`services/api`에는 `ServiceCore` / `RepositoryCore` 패턴과 `nestjs-pino` 기반 로깅이 이미 도입되어 있지만, 도입 시점 이전에 작성된 서비스/리포지토리가 여전히 옛 패턴을 유지하고 있다. 또한 `@LogReplay` 운영 재현 자료 수집은 단 한 곳(`MinioService.putObject`)에만 부착돼 있어 실사용 가치가 제한적이다. BullMQ 경로는 pino가 거의 깔리지 않아 큐 publish/worker 흐름이 운영 가시성 사각지대로 남아 있다.

본 설계는 다음을 달성한다.

1. Repository와 연결된 모든 Service에 `ServiceCore`를 적용해 트랜잭션 전파와 자동 trace 커버리지를 확보한다.
2. 모든 Repository를 `RepositoryCore`로 통일해 `this.conn` 기반 tx 전파를 보장한다.
3. `AuthRepository.registerUser`처럼 규칙 도입 이전 패턴으로 작성된 cross-domain 트랜잭션을 Service 계층으로 끌어올린다.
4. 외부 시스템 경계와 보안·감사 민감 흐름에 `@LogReplay`를 부착해 운영 사고 재현성을 높인다.
5. BullMQ publisher / worker 경로에 pino 로깅을 추가하여 비요청 컨텍스트에서도 운영 가시성을 확보한다.

## 1. 작업 범위 요약

### 1.1 Repository → `RepositoryCore`

| Repository                | 작업                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `DeviceRepository`        | `extends RepositoryCore`, `this.database.db` → `this.conn` |
| `TrustedDeviceRepository` | 동일                                                       |
| `TwoFaRepository`         | 동일                                                       |
| `InvitationRepository`    | 동일 + `consume(token, userId)` 메서드 신설                |
| `AuthRepository`          | 동일 + `registerUser` 메서드 제거 (책임 이관)              |

### 1.2 Service → `ServiceCore` / `@AutoTrace`

| Service                | 적용           | 비고                              |
| ---------------------- | -------------- | --------------------------------- |
| `AuthService`          | `ServiceCore`  | `register()`를 `runInTx()`로 분해 |
| `InvitationService`    | `ServiceCore`  | `consume(token, userId)` 신설     |
| `TwoFaService`         | `ServiceCore`  |                                   |
| `DeviceService`        | `ServiceCore`  |                                   |
| `TrustedDeviceService` | `ServiceCore`  |                                   |
| `TokenService`         | `@AutoTrace()` | Repository 없음, 데코레이터만     |

분기 기준: **Repository와 연결된 Service는 `ServiceCore`, Repository 없는 service는 `@AutoTrace()`** ([logging.md](../../../services/api/.claude/rules/logging.md) 명시).

### 1.3 `@LogReplay` 부착 범위

운영 재현 가치 vs trace payload 비용을 고려해 다음 두 범주만 적용한다.

**A. 외부 시스템 경계**

- `MinioService`: `copyObject`, `removeObject`, `removeObjects`, `createMultipartUpload`, `completeMultipartUpload`, `abortMultipartUpload` (기존 `putObject` 유지)
- `PushChallengePublisher.publish`

**B. 보안·감사 민감 흐름**

- `AuthService.register`, `login`, `refresh`, `logout` (`login`·`refresh`는 `{ captureResult: true }`)
- `TwoFaService` challenge/consume 메서드
- `DeviceService.register`, `TrustedDeviceService.trust`
- `InvitationService.create`, `consume`

일반 도메인 mutate 메서드(File/Folder/Trash/UploadSession)는 자동 trace로 호출 기록이 이미 남으므로 `@LogReplay`를 추가하지 않는다. 데코레이터를 *signal*로 운영한다.

### 1.4 BullMQ 로깅

- `PushChallengePublisher`: pino 주입, `@AutoTrace()` 부착, `publish()` try/catch + `info` 성공 / `error` 실패 로그
- `UploadSessionCleanupWorker`: pino 주입, `process()`에 명시 `info` 시작/완료 로그(건수 포함), `onApplicationBootstrap`에서 `worker.on('failed' | 'error')` 핸들러 등록하여 최종 실패만 `error` 한 줄로 기록
- `ApiExceptionFilter`: **의도적 미적용** — 결정 노트 §5 참조

## 2. `AuthService.register` 분해

가장 큰 구조 변경. 현재 `AuthRepository.registerUser`가 `db.transaction()` 안에서 users / userRoles / backupCodes / invitations 4개 테이블을 직접 다룬다. cross-domain(invitations)을 포함하므로 Service 계층의 `runInTx()`로 이관하고, invitations 처리는 InvitationService에 위임한다.

### 2.1 변경 후 구조

```ts
// AuthService.register
async register(input: RegisterInput): Promise<{ id: string }> {
  const roleRow = await this.authRepository.findRoleByName('USER');
  if (!roleRow) throw new ApiException('ROLE_NOT_FOUND');

  return this.runInTx(async () => {
    const { id } = await this.authRepository.insertUser({ username, nickname, password });
    await this.authRepository.insertUserRole(id, roleRow.id);
    await this.authRepository.insertBackupCodes(id, codeHashes);
    await this.invitationService.consume(invitationToken, id);
    return { id };
  });
}
```

### 2.2 Repository / Service 변경 상세

```ts
// AuthRepository
- registerUser(...)
+ insertUser / insertUserRole / insertBackupCodes  // 이미 존재 — this.conn 전환만

// InvitationRepository
+ consume(token: string, userId: string): Promise<{ id: string } | null>
   // UPDATE invitations SET used_at=NOW(), used_by=$userId
   // WHERE token=$token AND used_at IS NULL RETURNING id

// InvitationService
+ async consume(token: string, userId: string): Promise<void> {
    const row = await this.invitationRepository.consume(token, userId);
    if (!row) throw new ApiException('INVITATION_ALREADY_USED');
  }
```

### 2.3 모듈 의존 변경

- `AuthModule`이 `InvitationModule`을 import (`InvitationService` 주입을 위해)
- `InvitationModule`은 `InvitationService`를 export
- 순환 의존 없음 확인 (Invitation → Auth 방향 의존 없음)

### 2.4 ErrorCode

- `ROLE_NOT_FOUND` — `error-code.enum.ts`에 신규 추가 (`HttpStatus.INTERNAL_SERVER_ERROR`)
- `INVITATION_ALREADY_USED` — 이미 [error-code.enum.ts:78](../../../services/api/src/common/exceptions/error-code.enum.ts#L78)에 존재, 재사용

### 2.5 트랜잭션 의미 변화

| 항목                  | Before                                               | After                                      |
| --------------------- | ---------------------------------------------------- | ------------------------------------------ |
| tx 시작               | Repository 내부                                      | Service `runInTx()`                        |
| invitations 처리 위치 | AuthRepository (도메인 위반)                         | InvitationService.consume                  |
| 원자성                | Repository tx 하나                                   | Service runInTx — 모든 repo가 동일 tx 참여 |
| 예외 클래스           | `ConflictException` / `InternalServerErrorException` | `ApiException` 일관                        |

## 3. `@LogReplay` 적용 상세

### 3.1 데코레이터 옵션

- 기본값(`captureResult: false`): 입력 args만 캡처
- `login`·`refresh`: `{ captureResult: true }` — 반환된 토큰 식별자(jti 등)가 사고 추적에 결정적
- 민감 키(password 등)는 `PiiMasker.MASK_KEYS`로 자동 마스킹됨

### 3.2 부착 위치 검증 기준

각 메서드에 부착 시 다음을 확인:

- 해당 메서드가 자동 trace 대상인가 (`ServiceCore` extends 또는 `@AutoTrace()` 부착)
- 부착 후 trace.detail에 args가 캡처되는지 e2e 또는 단위 테스트로 확인 필요한 보안 민감 메서드는 `password` 등 마스킹 동작 확인

## 4. BullMQ 로깅 구체 형태

### 4.1 PushChallengePublisher

```ts
@Injectable()
@AutoTrace()
export class PushChallengePublisher {
  constructor(
    @InjectQueue(PUSH_CHALLENGE_QUEUE) private readonly queue: Queue<PushChallengeJob>,
    @InjectPinoLogger(PushChallengePublisher.name) private readonly logger: PinoLogger,
  ) {}

  @LogReplay()
  async publish(job: PushChallengeJob): Promise<void> {
    try {
      const added = await this.queue.add('send', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      this.logger.info({ jobId: added.id, queue: PUSH_CHALLENGE_QUEUE }, '푸시 챌린지 enqueue 완료');
    } catch (err) {
      this.logger.error({ err, queue: PUSH_CHALLENGE_QUEUE }, '푸시 챌린지 enqueue 실패');
      throw err;
    }
  }
}
```

`info` 메시지에는 `jobId`만 — `@LogReplay`가 args(전체 job 페이로드)를 trace span에 캡처하므로 중복하지 않는다.

### 4.2 UploadSessionCleanupWorker

```ts
@Processor('upload-session-cleanup')
export class UploadSessionCleanupWorker extends WorkerHost implements OnApplicationBootstrap {
  private readonly TICK_JOB_ID = 'upload-session-cleanup-tick';
  private readonly TICK_INTERVAL_MS = 15 * 60 * 1000;
  private readonly BATCH_SIZE = 500;

  constructor(
    @InjectQueue('upload-session-cleanup') private readonly queue: Queue,
    private readonly uploadSessionService: UploadSessionService,
    @InjectPinoLogger(UploadSessionCleanupWorker.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.removeJobScheduler(this.TICK_JOB_ID).catch(() => undefined);
    await this.queue.add(
      this.TICK_JOB_ID,
      {},
      {
        jobId: this.TICK_JOB_ID,
        repeat: { every: this.TICK_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.worker.on('failed', (job, err) => {
      if (!job) return;
      const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
      if (exhausted) {
        this.logger.error(
          { err, jobId: job.id, attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
          'upload-session-cleanup 최종 실패 — 재시도 소진',
        );
      }
    });
    this.worker.on('error', (err) => {
      this.logger.error({ err }, 'upload-session-cleanup worker 내부 오류');
    });

    this.logger.info({ intervalMs: this.TICK_INTERVAL_MS, batchSize: this.BATCH_SIZE }, 'upload-session-cleanup 스케줄러 등록 완료');
  }

  async process(_job: Job): Promise<void> {
    const start = Date.now();
    const stats = await this.uploadSessionService.cleanupExpired(this.BATCH_SIZE);
    this.logger.info({ ...stats, durationMs: Date.now() - start, batchSize: this.BATCH_SIZE }, '업로드 세션 정리 tick 완료');
  }
}
```

**`@AutoTrace()` 미적용 결정**: Worker는 HTTP 요청 컨텍스트 밖에서 BullMQ 스케줄러로 호출된다. `RequestTraceContext`가 존재하지 않아 `@AutoTrace`가 메서드를 wrap해 span을 누적해도 _flush 시점이 없어 어디로도 기록되지 않는다._ 즉 데드 코드가 된다. 명시 pino 로깅이 trace의 *대체*이지 보완이 아니다 — 미래에 누가 "@AutoTrace 있으니 됐겠지" 하고 지나치지 않도록 worker에는 의도적으로 부착하지 않는다.

**최종 실패 한 번만 기록**: `process()` throw는 BullMQ retry attempts마다 발생한다. 거기에 `error` 로그를 박으면 정상 retry 흐름이라도 attempts번 같은 에러가 찍혀 false alarm이 된다. `worker.on('failed')`에서 `attemptsMade >= maxAttempts` 가드로 최종 실패만 한 번 기록한다.

### 4.3 UploadSessionService.cleanupExpired 반환 시그니처

worker 로그를 위해 통계 반환 필요. 현재 시그니처가 stats를 반환하지 않으면 다음 형태로 변경:

```ts
async cleanupExpired(batchSize: number): Promise<{
  scannedCount: number;
  abortedCount: number;
  removedCount: number;
}>
```

기존 호출처가 worker 하나뿐이라 시그니처 변경 영향 범위 작다.

## 5. 결정 노트: `ApiExceptionFilter`는 pino를 주입하지 않는다

요청 단위 오류 로깅은 [`TraceFlusher.flushError`](../../../services/api/src/logger/trace.flusher.ts)가 권위적으로 담당한다. `TraceInterceptor`의 RxJS error path가 filter보다 먼저 호출되며, 4xx ApiException은 `trace.meta` info로, 5xx와 unhandled는 `trace.detail` error로 stack과 모든 span을 포함해 기록한다.

filter에 별도 로깅을 추가하면 동일 예외가 두 record로 분리 기록되어 reqId로 손수 묶어야 하는 분석 부담이 생긴다. 따라서 filter는 응답 직렬화만 담당한다.

_(과거 4e62b7c에서 filter에 logger를 추가했다가 이 중복 문제로 롤백된 이력 있음 — 동일 변경을 재도입하지 않을 것.)_

## 6. 테스트 전략

### 6.1 Repository

- 기존 spec은 `mockDatabaseService` + `setupMockDbSelectChain` 패턴을 그대로 사용 (RepositoryCore 호환)
- `AuthRepository.registerUser` 삭제 → 해당 describe 블록 삭제
- `InvitationRepository.consume` 신설 → 신규 describe:
  - 성공 (returning row 반환)
  - 이미 used (빈 배열 → null)

### 6.2 Service

- ServiceCore 적용 후 생성자 시그니처 변경 → 기존 spec module setup에 `TransactionContext` provider 추가(`mockTransactionContext`가 [src/test/mocks/transaction-context.mock.ts](../../../services/api/src/test/mocks/transaction-context.mock.ts)에 이미 존재 — 그대로 사용)
- `AuthService.register`:
  - `runInTx` 안 호출 순서 검증 (insertUser → insertUserRole → insertBackupCodes → invitationService.consume)
  - `invitationService.consume`이 `INVITATION_ALREADY_USED` throw → 예외 전파 검증
  - `findRoleByName` → null 시 `ROLE_NOT_FOUND` 케이스
- `InvitationService.consume`: 성공 / already used 두 케이스
- 그 외 Service는 ServiceCore 상속만 추가 → spec은 module setup만 수정

### 6.3 Pino 로깅

- [logging.md](../../../services/api/.claude/rules/logging.md) 원칙대로 로거 호출 자체는 검증 안 함
- 예외: `PushChallengePublisher.publish`의 try/catch 동작은 throw 전파로 검증
- `worker.on('failed')` 핸들러의 `attemptsMade >= maxAttempts` 가드는 핸들러 직접 호출 단위 테스트 1건

### 6.4 e2e

- 기존 trace logging e2e (217817e)는 그대로 통과해야 함 (filter 변경 없음 + ApiException 흐름 동일)
- 회원가입 e2e: 이미 사용된 invitation 토큰으로 register 시도 → 실패 응답 + users 테이블에 row 생성 안 됨 확인 (롤백 검증)

## 7. 마이그레이션 순서

PR 단위로 분할하여 리뷰 부담을 분산한다.

1. **RepositoryCore 마이그레이션 (registerUser 제외 4개 + AuthRepository 단순 메서드)** — 기계적 변경, 리뷰 부담 최소
2. **AuthService.register 분해 + InvitationService.consume 신설** — 가장 큰 구조 변경, e2e + spec 갱신 동반
3. **ServiceCore 적용 (6개) + TokenService `@AutoTrace`** — 생성자 시그니처 변경, 일괄 spec 수정
4. **`@LogReplay` 일괄 부착 (A + B 범위)** — 데코레이터만, 리뷰 가볍게
5. **BullMQ 로깅 + ApiExceptionFilter 결정 노트** — 인프라성 로그 추가

각 PR은 1→2→3→4→5 순으로 의존. 1이 먼저 들어가야 2의 Service-level `this.conn` 호출이 자연스럽다.

## 8. 리스크 & 검증

| 리스크                                                                          | 검증                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| AuthService.register 분해 후 invitation consume 실패 시 user 생성도 롤백되는가  | e2e: 이미 사용된 invitation으로 register → 실패 + users 테이블 row 없음 확인       |
| `worker.on('failed')`가 등록 시점 이후 이벤트만 받는가                          | 단위 테스트로 핸들러 직접 호출 검증                                                |
| Service 생성자 시그니처 변경이 다른 모듈 inject 호출에 영향 주는가              | TS strict 컴파일로 모두 잡힘 — build 통과 확인                                     |
| `mockDatabaseService`가 `this.conn`을 처음 사용하는 Repository에서도 동작하는가 | `setupMockDbSelectChain`이 두 경로 모두에 mock 부여하는지 `src/test` 확인          |
| BullMQ Worker의 `this.worker` 접근 시점                                         | `onApplicationBootstrap`에서 등록 — `OnModuleInit`에서는 worker 인스턴스 아직 없음 |

## 9. 비범위 (Out of Scope)

- `DatabaseService` / `MinioService`는 인프라성 코드로 `ServiceCore` 대상이 아님 (변경 없음)
- 일반 도메인 mutate 메서드의 `@LogReplay` 부착 (File/Folder/Trash/UploadSession)
- BullMQ 큐 health metric (큐 길이/지연) — 별도 health 영역
- `ApiExceptionFilter` pino 주입 — §5 결정에 따라 영구 미적용
- 다른 서비스 (mq, web) — 본 spec은 `services/api`만 다룬다

