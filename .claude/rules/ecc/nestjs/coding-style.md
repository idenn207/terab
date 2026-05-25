---
paths:
  - "services/api/src/**/*.ts"
---
# NestJS Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) and [typescript/coding-style.md](../typescript/coding-style.md) with NestJS 11 specific content.
>
> Detailed Terab-specific conventions live in [services/api/CLAUDE.md](../../../../services/api/CLAUDE.md). This rule encodes the cross-project NestJS principles; the project file owns the per-domain decisions.

## Layer Responsibilities (3-tier)

NestJS REST services use a `Controller → Service → Repository` separation. Each layer has a fixed responsibility set; spilling logic across layers is a code smell.

| Layer | Owns | Must NOT |
|---|---|---|
| Controller | HTTP shape — route decorators, DTO validation entry, Swagger metadata, status code, `@RequirePermission` / `@Public` guards | Business logic, direct repository access, transaction control, error formatting |
| Service | Business logic, orchestration of repositories, transactions, throwing domain `ApiException` | Reading from `Request` / `Response` directly, route-specific concerns, raw SQL strings in-line |
| Repository | Persistence — Drizzle queries, schema-typed return values | HTTP concerns, business rule branching, throwing domain exceptions (return `null` / empty arrays instead) |

```typescript
// WRONG: controller reaches into the database directly
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.db.select().from(folders).where(eq(folders.id, id))
}

// CORRECT: controller delegates to service; service delegates to repository
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<FolderDto> {
  return this.folderService.findById(id)
}
```

## Dependency Injection

- Constructor injection only — no `@Inject` on properties, no manual `new Service(...)` in production code
- Every injectable class is decorated with `@Injectable()`
- Provide concrete classes by default; use `useFactory` / `useValue` only when the implementation is decided at runtime
- For polymorphic strategies, use multi-provider DI with an injection token (`@Inject(TWOFA_STRATEGY_TOKEN)` style — see ADR-0002)

```typescript
// CORRECT: constructor injection with a typed parameter
@Injectable()
export class FolderService extends ServiceCore {
  constructor(
    private readonly folderRepository: FolderRepository,
    private readonly fileRepository: FileRepository,
  ) {
    super()
  }
}
```

## Module Boundaries

- Each domain owns a `{name}.module.ts` with explicit `imports`, `providers`, `exports`
- `@Global()` is reserved for infrastructure-style modules whose providers are needed everywhere (`DatabaseModule`, `SecurityModule`, `LoggerModule`, `MinioModule`)
- Domain modules must not declare `@Global()` — cross-domain dependencies are made explicit via `imports`
- Circular module dependency is a refactor signal, not a `forwardRef()` candidate

## `src/common/` vs Domain Folder

The placement rule for shared building blocks:

```
Does the new code introduce an @Module() class?
├── Yes → place under `src/{name}/` and register in AppModule
└── No  → place under `src/common/{category}/` (guards, filters, decorators, pipes, interceptors, exceptions)
```

Examples from the project (delegated detail in services/api/CLAUDE.md):

- `JwtAuthGuard`, `PermissionGuard` → `src/common/guards/`
- `ApiExceptionFilter` → `src/common/filters/`
- `@Public()`, `@RequirePermission()` → `src/common/decorators/`
- `DatabaseModule` (has `@Module`) → `src/database/`, **not** `src/common/`

## Error Surface — `ApiException` Only

Domain code throws `ApiException` with an `ErrorCode` key. Avoid throwing raw `HttpException`, `Error`, or framework exceptions from domain logic; convert at the boundary if necessary.

```typescript
// WRONG: leaks framework exception out of the service layer
if (!folder) throw new NotFoundException('Folder not found')

// CORRECT: domain exception with an ErrorCode key
if (!folder) throw new ApiException('FOLDER_NOT_FOUND')
```

The mapping `ErrorCode → { message, status }` lives in `src/common/exceptions/error-code.enum.ts` — single source of truth for HTTP status and user-facing message.

## Naming

- Files: kebab-case + role suffix — `folder.controller.ts`, `folder.service.ts`, `folder.repository.ts`, `folder.module.ts`
- Classes: PascalCase + role suffix — `FolderController`, `FolderService`, `FolderRepository`
- DTOs: `{action}.dto.ts` / `{Action}Dto` — `create-folder.dto.ts` / `CreateFolderDto`
- Spec files: sibling to implementation, suffix `.spec.ts`

## Function & File Limits (NestJS context)

The common limits (function < 50 lines, file < 800 lines, nesting < 4) apply. Project guidance:

- A controller method usually fits in 5–15 lines — heavier logic belongs in the service
- A service method that exceeds 50 lines is a split signal: extract private helpers or move to a dedicated collaborator
- A repository file growing past 400 lines often hides a missing sub-feature — consider splitting (e.g., `folder.repository.ts` + `folder-tree.repository.ts`)

## Forbidden Patterns

| Forbidden | Replace with |
|---|---|
| `throw new HttpException(...)` from a service | `throw new ApiException('ERROR_KEY')` |
| Direct `Request` / `Response` injection in controllers | Decorators (`@Body`, `@Query`, `@Param`, `@CurrentUser`) |
| Re-implementing `DatabaseService` per module | Inject the global `DatabaseService` from `@terab/db` |
| `forwardRef()` to break circular deps | Refactor the dependency graph; lift shared logic upward |
| `console.log` in controllers/services | Inject `PinoLogger` (see [common/logging.md](../common/logging.md)) |
| `any` in public service signatures | Concrete domain type, generic, or `unknown` + narrow |
