---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---
# TypeScript/JavaScript Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with TypeScript/JavaScript specific content.

## Types and Interfaces

Use types to make public APIs, shared models, and component props explicit, readable, and reusable.

### Public APIs

- Add parameter and return types to exported functions, shared utilities, and public class methods
- Let TypeScript infer obvious local variable types
- Extract repeated inline object shapes into named types or interfaces

```typescript
// WRONG: Exported function without explicit types
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}

// CORRECT: Explicit types on public APIs
interface User {
  firstName: string
  lastName: string
}

export function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

### Interfaces vs. Type Aliases

- Use `interface` for object shapes that may be extended or implemented
- Use `type` for unions, intersections, tuples, mapped types, and utility types
- Prefer string literal unions over `enum` unless an `enum` is required for interoperability

```typescript
interface User {
  id: string
  email: string
}

type UserRole = 'admin' | 'member'
type UserWithRole = User & {
  role: UserRole
}
```

### Avoid `any`

- Avoid `any` in application code
- Use `unknown` for external or untrusted input, then narrow it safely
- Use generics when a value's type depends on the caller

```typescript
// WRONG: any removes type safety
function getErrorMessage(error: any) {
  return error.message
}

// CORRECT: unknown forces safe narrowing
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}
```

### React Props

- Define component props with a named `interface` or `type`
- Type callback props explicitly
- Do not use `React.FC` unless there is a specific reason to do so

```typescript
interface User {
  id: string
  email: string
}

interface UserCardProps {
  user: User
  onSelect: (id: string) => void
}

function UserCard({ user, onSelect }: UserCardProps) {
  return <button onClick={() => onSelect(user.id)}>{user.email}</button>
}
```

### JavaScript Files

- In `.js` and `.jsx` files, use JSDoc when types improve clarity and a TypeScript migration is not practical
- Keep JSDoc aligned with runtime behavior

```javascript
/**
 * @param {{ firstName: string, lastName: string }} user
 * @returns {string}
 */
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}
```

## Immutability

Use spread operator for immutable updates:

```typescript
interface User {
  id: string
  name: string
}

// WRONG: Mutation
function updateUser(user: User, name: string): User {
  user.name = name // MUTATION!
  return user
}

// CORRECT: Immutability
function updateUser(user: Readonly<User>, name: string): User {
  return {
    ...user,
    name
  }
}
```

## Error Handling

Use async/await with try-catch and narrow unknown errors safely:

```typescript
interface User {
  id: string
  email: string
}

declare function riskyOperation(userId: string): Promise<User>

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

const logger = {
  error: (message: string, error: unknown) => {
    // Replace with your production logger (for example, pino or winston).
  }
}

async function loadUser(userId: string): Promise<User> {
  try {
    const result = await riskyOperation(userId)
    return result
  } catch (error: unknown) {
    logger.error('Operation failed', error)
    throw new Error(getErrorMessage(error))
  }
}
```

## Input Validation

Use schema-based validation at every system boundary. The choice of library depends on the runtime context.

| Context | Library | Why |
|---|---|---|
| NestJS request DTO | `class-validator` + `class-transformer` | NestJS `ValidationPipe` standard; `@nestjs/swagger` plugin's `classValidatorShim` auto-synthesizes OpenAPI metadata from the validators |
| Browser forms | React Hook Form `register()` options, or Zod when complex shapes are needed | RHF native integration; avoids a second resolver layer for simple field rules |
| Generic external input (scripts, utils, edge handlers, server-only validators) | Zod | Strong type inference, no framework coupling |

Whichever library is in use, the principle is the same: **never trust external data**, fail fast, and produce a clear error.

### Zod example (generic external input)

```typescript
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

type UserInput = z.infer<typeof userSchema>

const validated: UserInput = userSchema.parse(input)
```

### class-validator example (NestJS request DTO)

```typescript
import { IsEmail, IsInt, Max, Min } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  email!: string

  @IsInt()
  @Min(0)
  @Max(150)
  age!: number
}
```

### React Hook Form example (browser form)

```typescript
const { register, handleSubmit } = useForm<CreateUserDto>()

<input
  {...register('email', {
    required: true,
    pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  })}
/>
```

## Console.log

- No `console.log` statements in production code
- Use proper logging libraries instead
- See hooks for automatic detection
