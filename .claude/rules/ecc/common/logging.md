# Logging

> Common logging principles applicable to every service. Service-specific trace policies live in each service's CLAUDE.md (e.g., NestJS `ServiceCore` auto-trace in [services/api/CLAUDE.md §"로거 사용"](../../../../services/api/CLAUDE.md)).

## Goals

- Logs should answer "what happened, to whom, with what context" without leaking secrets
- Logs should be greppable and machine-parseable (structured), not narrative
- A log line should survive a `kubectl logs | jq` pipeline — no ANSI codes, no multi-line prose

## Log Levels

| Level | Use for | Examples |
|---|---|---|
| `error` | A request / job failed in a way that requires investigation | Unhandled exception, external API 5xx, data integrity violation |
| `warn` | Recoverable degradation or suspicious-but-not-broken behavior | Retry triggered, rate-limit hit, deprecated path used |
| `info` | Business-meaningful events worth keeping in production | User logged in, file uploaded, payment succeeded |
| `debug` | Detail useful only when actively debugging — off in production by default | Variable values, branch decisions, retry counts |

Anything below `debug` (e.g., `trace`) is reserved for framework auto-trace, not application code.

## Structured, Not String-Interpolated

```typescript
// WRONG: opaque message, no greppable fields
logger.info(`user ${userId} uploaded file ${fileId}`)

// CORRECT: structured object + short message
logger.info({ userId, fileId }, 'file uploaded')
```

The structured form lets log aggregation tools index `userId` and `fileId` independently. The string form forces regex extraction.

## Never Log

| Category | Examples |
|---|---|
| Secrets | API keys, JWT bearer tokens, refresh tokens, OAuth client secrets, database passwords |
| Credentials | User passwords (even hashed — risk leak via diff), TOTP codes, backup codes, 2FA challenge codes |
| PII beyond identifier | Email body content, full names + birthdate combinations, government ID numbers |
| Raw user input | Logged un-sanitized strings can poison log search and aid log injection — sanitize or truncate before logging |

When a request contains sensitive headers, log the **presence** (`hasAuthHeader: true`) rather than the value.

## `console.log` Is Banned

Production code uses the project's logger (e.g., `pino` in services/api, the browser-side equivalent in services/web). `console.log` is for ad-hoc local debugging — strip it before commit.

```typescript
// WRONG
console.log('user', user)

// CORRECT
logger.debug({ userId: user.id }, 'evaluating user permissions')
```

## Where to Inject the Logger

Each service exposes one canonical way to obtain a logger. Use that — do not import logger libraries directly in feature code.

- **services/api** (NestJS, pino): `@InjectPinoLogger(ClassName.name)` constructor injection. See [services/api/CLAUDE.md §"로거 사용"](../../../../services/api/CLAUDE.md) for the auto-trace policy on `ServiceCore` descendants.
- **services/web**: an axios interceptor handles request-cycle logging; component-level UX events use the in-app analytics layer, not direct `console.*` calls.

## Forbidden Patterns

| Forbidden | Replace with |
|---|---|
| `console.log(...)` in committed code | Inject the project logger |
| `console.error(err)` to "log" an exception | `logger.error({ err }, 'short message')` — pino serializes `err` cleanly |
| Logging the full request object | Whitelist the fields you actually need |
| Token / secret values in logs | Log presence or a short hash, not the value |
| Multi-line log messages with embedded newlines | One log call per event; structured fields for the data |
| Logging inside hot loops without aggregation | Aggregate (count + sample) before logging |
