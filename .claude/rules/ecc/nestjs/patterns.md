---
paths:
  - "services/api/src/**/*.ts"
---
# NestJS Patterns

> This file extends [common/patterns.md](../common/patterns.md) and [typescript/patterns.md](../typescript/patterns.md) with NestJS 11 specific content.
>
> Project-specific details (Swagger decorator order, full `@ApiError` usage, codegen workflow) live in [services/api/CLAUDE.md §"Swagger / DTO 컨벤션"](../../../../services/api/CLAUDE.md). This rule encodes the cross-project NestJS principles.

## ApiException + ErrorCode (single source of truth)

All domain errors flow through a single exception type backed by an enum-shaped registry.

```typescript
// src/common/exceptions/error-code.enum.ts
export const ErrorCode = {
  FOLDER_NOT_FOUND: { message: '폴더를 찾을 수 없습니다.', status: HttpStatus.NOT_FOUND },
  PERMISSION_DENIED: { message: '권한이 없습니다.', status: HttpStatus.FORBIDDEN },
} as const

// usage anywhere in services
throw new ApiException('FOLDER_NOT_FOUND')
```

Rationale:
- The status code + user-facing message live next to the error key, not scattered across `throw` sites
- `ApiExceptionFilter` translates the exception into a uniform response envelope at the HTTP boundary
- Adding a new error is a one-line registry change followed by `throw new ApiException('NEW_KEY')`

| Forbidden | Replace with |
|---|---|
| `throw new NotFoundException(...)` | `throw new ApiException('XXX_NOT_FOUND')` |
| `throw new ForbiddenException(...)` | `throw new ApiException('PERMISSION_DENIED')` |
| Inline error envelope in controller (`return { success: false, ... }`) | Throw `ApiException`, let the filter format the response |

## Repository Pattern (NestJS variant)

The generic `Repository<T>` interface from [typescript/patterns.md](../typescript/patterns.md) is **not** the right shape for this project. Domain repositories use **feature-keyed method names** and may touch multiple tables in one query when the feature reads naturally that way.

```typescript
// CORRECT: feature-keyed, multi-table allowed
@Injectable()
export class FolderRepository extends ServiceCore {
  async findByUserId(userId: string): Promise<Folder[]> { ... }
  async findChildren(parentId: string): Promise<Folder[]> { ... }
  async softDelete(id: string, trashedAt: Date): Promise<void> { ... }
}
```

Forcing every repository through `findAll / findById / create / update / delete` produces leaky abstractions and pushes domain logic up into services.

> Background: project memory `project_repository_pattern` — repositories are designed per-feature, multi-table access is natural and allowed.

## Swagger Conventions (summary)

| Concern | Rule |
|---|---|
| Group tag | `@ApiTags('Domain')` — PascalCase singular |
| Path prefix | `@Controller('domain')` — kebab/singular |
| Decorator order | `@Public()/@RequirePermission()` → `@Throttle` → HTTP verb → `@HttpCode` → `@ApiOperation` → `@ApiExtraModels` → `@ApiResponse` → `@ApiError` |
| Error responses | `@ApiError('KEY1', 'KEY2')` only — do not write raw `@ApiResponse({ status: 4xx, ... })` |
| 200 on POST | `@HttpCode(HttpStatus.OK)` required (default would be 201) |
| 204 on DELETE | `@HttpCode(HttpStatus.NO_CONTENT)` required |
| Union response | `@ApiExtraModels(...)` + `oneOf` + `discriminator.mapping` — all three, or web codegen narrowing breaks |

Full table of forbidden patterns lives in [services/api/CLAUDE.md §"금지 패턴"](../../../../services/api/CLAUDE.md). Do not duplicate it here.

## ValidationPipe is the gate, not a suggestion

A global `ValidationPipe({ transform: true, whitelist: true })` is assumed. Skipping validators on a request DTO field **disables the validation gate** for that field — both a security and contract defect.

```typescript
// WRONG: literal union without validator — anything passes
export class CreateChallengeDto {
  type!: 'TOTP' | 'PUSH' | 'BACKUP_CODE'
}

// CORRECT: every field carries a validator that matches its type
export class CreateChallengeDto {
  @IsIn(['TOTP', 'PUSH', 'BACKUP_CODE'])
  type!: 'TOTP' | 'PUSH' | 'BACKUP_CODE'

  @IsUUID('4')
  userId!: string
}
```

| Field type | Required validator |
|---|---|
| UUID identifier | `@IsUUID('4')` |
| string literal union | `@IsEnum([...])` or `@IsIn([...])` |
| enum value | `@IsEnum(MyEnum)` |
| free-form text | `@IsString()` + `@MinLength` / `@MaxLength` |
| integer | `@IsInt()` + `@Min` / `@Max` |
| boolean | `@IsBoolean()` |
| email | `@IsEmail()` |
| URL | `@IsUrl()` |
| optional field | add `@IsOptional()` above the validator |
| nested object | `@ValidateNested()` + `@Type(() => SubDto)` |
| array | item-level validator + `each: true` |

## Module Patterns

### Domain Module Skeleton

```typescript
@Module({
  imports: [/* explicit cross-domain dependencies */],
  controllers: [FolderController],
  providers: [FolderService, FolderRepository],
  exports: [FolderService],
})
export class FolderModule {}
```

### Multi-Provider DI (Strategy Pattern)

When a controller routes to one of several interchangeable implementations, use multi-provider DI with an injection token. See ADR-0002 for the 2FA Strategy implementation as a worked example.

```typescript
// Module
@Module({
  providers: [
    PushStrategy,
    TotpStrategy,
    BackupCodeStrategy,
    { provide: TWOFA_STRATEGY_TOKEN, useExisting: PushStrategy, multi: true },
    { provide: TWOFA_STRATEGY_TOKEN, useExisting: TotpStrategy, multi: true },
    { provide: TWOFA_STRATEGY_TOKEN, useExisting: BackupCodeStrategy, multi: true },
    TwoFaStrategyRegistry,
  ],
})
export class TwoFaModule {}

// Registry
@Injectable()
export class TwoFaStrategyRegistry {
  private readonly map: Map<TwoFaStrategyType, TwoFaStrategy>

  constructor(@Inject(TWOFA_STRATEGY_TOKEN) strategies: TwoFaStrategy[]) {
    this.map = new Map(strategies.map((s) => [s.type, s]))
  }

  get(type: TwoFaStrategyType): TwoFaStrategy {
    const strategy = this.map.get(type)
    if (!strategy) throw new ApiException('TWOFA_STRATEGY_NOT_FOUND')
    return strategy
  }
}
```

Adding a new strategy is one provider line + one class — auth/twofa controller does not change.

## Request Lifecycle Trace

Public methods on `ServiceCore` descendants are auto-traced by the logger interceptor. Do not add per-call `logger.info('entered method ...')` — duplicate noise. Reserve explicit `@InjectPinoLogger` calls for **business events** (e.g., `logger.info({ userId, fileId }, 'file shared')`).

Detail on the trace policy: [common/logging.md](../common/logging.md) + [services/api/CLAUDE.md §"로거 사용"](../../../../services/api/CLAUDE.md).
