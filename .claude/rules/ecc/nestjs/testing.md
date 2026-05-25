---
paths:
  - "services/api/src/**/*.spec.ts"
  - "services/api/test/**/*.ts"
---
# NestJS Testing

> This file extends [common/testing.md](../common/testing.md) and [typescript/testing.md](../typescript/testing.md) with NestJS 11 specific content.
>
> Project-specific test layout details live in [services/api/CLAUDE.md §"테스트 파일 위치"](../../../../services/api/CLAUDE.md).

## File Placement

- `*.spec.ts` lives **next to** its implementation file (same folder)
- E2E tests live under `services/api/test/` and are named `*.e2e-spec.ts`
- Shared test helpers are exposed via `@terab/test` (path alias to `services/api/src/test/`)

```
src/
  folder/
    folder.repository.ts
    folder.repository.spec.ts   ← unit, beside implementation
    folder.service.ts
    folder.service.spec.ts
test/
  app.e2e-spec.ts               ← e2e, separate folder
```

## TestingModule Setup

Use `Test.createTestingModule` to wire DI. Override providers explicitly — never reach into private fields to swap collaborators.

```typescript
beforeEach(async () => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      FolderService,
      { provide: FolderRepository, useValue: createFolderRepositoryMock() },
      { provide: FileRepository, useValue: createFileRepositoryMock() },
    ],
  }).compile()

  service = moduleRef.get(FolderService)
})
```

## Mocking Strategy

| Collaborator type | Mock approach |
|---|---|
| Repository | Plain object with jest mock functions, returned by a factory in `@terab/test` |
| Other domain service | Same as repository — pass a typed mock via `useValue` |
| `DatabaseService` (raw Drizzle) | **Do not** mock at this level in service tests — mock the repository above it. Repository tests can use a real test database container or a transactional rollback wrapper |
| `PinoLogger` | Provide a no-op mock via `getLoggerToken(ClassName.name)` |
| External clients (MinIO, BullMQ queue) | Mock the client interface, not the underlying SDK |

```typescript
// CORRECT: typed mock with jest.fn() for each method
function createFolderRepositoryMock(): jest.Mocked<FolderRepository> {
  return {
    findByUserId: jest.fn(),
    findChildren: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as jest.Mocked<FolderRepository>
}
```

## ServiceCore Descendants

Auto-trace is wired through `ServiceCore`. In unit tests:

- Do not assert on the trace logs themselves — they are infrastructure
- Do assert on **business event logs** (anything you wrote with `logger.info` explicitly)
- When testing a `ServiceCore` descendant, you do not need to call `super()` manually — the DI container handles it

## Coverage Target

- Common 80 % minimum applies
- Critical paths (auth, permission, payment-adjacent logic) — aim higher and add explicit edge-case tests
- Repository tests should cover at least: happy path, empty result, constraint violation

## Forbidden Test Patterns

| Forbidden | Reason |
|---|---|
| Calling lifecycle hooks (`onModuleInit`, `onApplicationBootstrap`) by hand in specs | Couples test to framework internals; if logic needs to run, refactor it out of the lifecycle hook |
| Hitting the real database from service-layer specs | Use repository mocks; reserve real-DB hits for repository specs and e2e |
| Asserting on auto-traced log lines | Infrastructure noise; assert on explicit `logger.info(...)` calls instead |
| `as any` casts to access private fields | Either widen the field's visibility intentionally or expose a test seam |
| Shared mutable state between `describe` blocks | Each `describe` rebuilds its `TestingModule` in `beforeEach` |
| Snapshot tests against full response bodies | Use targeted assertions on the fields under test |

## E2E Shape

```typescript
describe('FolderController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 401 without bearer token', async () => {
    await request(app.getHttpServer()).get('/folders').expect(401)
  })
})
```

- E2E tests boot the real `AppModule` — guards, filters, pipes are exercised
- Authenticate by issuing a test JWT via `@terab/security`, not by skipping the guard
