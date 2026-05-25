---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---
# TypeScript/JavaScript Patterns

> This file extends [common/patterns.md](../common/patterns.md) with TypeScript/JavaScript specific content.

## API Response Format Options

Pick **one** response shape and apply it consistently across the project. Mixing the two below produces drift and breaks codegen / client narrowing.

### Option A — Envelope

Useful when the same endpoint can return success / partial-failure / structured-error in a single 2xx response, or when you need pagination metadata woven into every response.

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}
```

### Option B — NestJS standard (`throw` + `ApiException`)

Controllers return the domain object directly. Errors are thrown via a domain exception type (`ApiException` in this codebase) and an exception filter maps them to a uniform error body. The `@nestjs/swagger` plugin synthesizes response types into OpenAPI without an envelope.

```typescript
// Controller
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<FolderDto> {
  return this.folderService.findById(id)  // returns FolderDto on success
}

// Service
async findById(id: string): Promise<FolderDto> {
  const folder = await this.repository.findById(id)
  if (!folder) throw new ApiException('FOLDER_NOT_FOUND')
  return folder
}
```

See [nestjs/patterns.md §"ApiException + ErrorCode"](../nestjs/patterns.md) for the full NestJS treatment.

### Choosing

| If your project... | Use |
|---|---|
| Uses NestJS with `@nestjs/swagger` + OpenAPI codegen | Option B — Swagger plugin auto-synthesizes the response type; an envelope would duplicate that |
| Has no global exception filter and needs to express partial-success in one response | Option A |
| Mixes both | Pick one and migrate — clients will eventually depend on a single shape |

## Custom Hooks Pattern

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

## Repository Pattern

```typescript
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```
