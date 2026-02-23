# Error Handling Rules

## Error Codes

- Pattern: `PREFIX_DESCRIPTION` in `UPPER_SNAKE_CASE`
- Prefixes: `AUTH`, `KYC`, `COMPANY`, `CAP`, `TXN`, `ROUND`, `OPT`, `DOC`, `CHAIN`, `VAL`, `SYS`
- Every error code needs a `messageKey` using dot notation: `errors.<prefix>.<description>` (e.g., `CAP_INSUFFICIENT_SHARES` → `errors.cap.insufficientShares`)
- Every error code needs PT-BR and EN translations in `messages/pt-BR.json` and `messages/en.json`
- Full error code catalog is in `specs/error-codes.md`

## HTTP Status Mapping

| Status | When to Use |
|--------|-------------|
| **400** | `VAL_*` — validation failures, malformed input |
| **401** | Auth failures (invalid/expired token, no session) |
| **403** | Authorization failures (missing wallet, insufficient role) |
| **404** | `*_NOT_FOUND` — also used instead of 403 to prevent enumeration |
| **409** | Duplicate resources (`*_DUPLICATE`, `*_EXISTS`) |
| **422** | Business rule violations (`CAP_*`, `TXN_*`, `ROUND_*`, `OPT_*`, `DOC_*`, `KYC_*`) |
| **429** | Rate/attempt limits (`SYS_RATE_LIMITED`, `AUTH_ACCOUNT_LOCKED`) |
| **500** | Unhandled server errors (`SYS_INTERNAL_ERROR`, `SYS_DATABASE_ERROR`) |
| **502** | Upstream service failures (`*_UNAVAILABLE`, `SYS_EXTERNAL_SERVICE_ERROR`) |
| **503** | `SYS_MAINTENANCE` |

## Backend: Throwing Errors

Use the `AppException` class hierarchy defined in `api-standards.md`:

```typescript
// Not found
throw new NotFoundException('company', id);

// Conflict
throw new ConflictException('COMPANY_CNPJ_DUPLICATE', 'errors.company.cnpjDuplicate', { cnpj });

// Business rule violation (422)
throw new BusinessRuleException('CAP_INSUFFICIENT_SHARES', 'errors.cap.insufficientShares', { available, requested });

// Validation (400)
throw new ValidationException([{ field: 'cnpj', message: 'Invalid', messageKey: 'errors.val.invalidFormat' }]);
```

## Backend: External Service Calls

All external services (Privy, Verifik, Base RPC, S3, SES) must use:
- **Timeouts**: 10-30s depending on service
- **Retries with exponential backoff**: 3-5 attempts
- **Circuit breaker**: Open after 5 consecutive failures, half-open after 30-60s
- **Never retry**: 400, 401, 403, 404, 422 (client errors are definitive)
- **Always retry**: Network errors, 502, 503, 504

## Backend: PII Redaction (LGPD)

**Always redact PII before logging.** Use the `redactPii()` utility:

| Field | Redaction |
|-------|-----------|
| CPF | `***.***.***-XX` (keep last 2) |
| CNPJ | `**.***.****/****-XX` (keep last 2) |
| Email | `n***@domain.com` (keep first char) |
| Wallet | `0x1234...abcd` (first 6 + last 4) |
| IP | Truncate to /24 |
| Tokens/passwords | `[REDACTED]` — never log |

## Backend: Sentry

- Send 5xx errors at `error` level with `errorCode` tag
- Send unhandled exceptions at `fatal` level
- 4xx errors are breadcrumbs only — do not report
- Always redact PII from Sentry events via `beforeSend`

## Frontend: Error Handling

- Parse API errors into `ApiError` class with `code`, `messageKey`, `statusCode`, `details`, `validationErrors`
- **401** → call `logout()`, redirect to `/login?expired=true`
- **Validation errors (400)** → map `validationErrors` to React Hook Form field errors via `applyServerErrors()`
- **Business/server errors** → show toast via `useErrorToast()` using `messageKey` for i18n lookup
- **Rate limited (429)** → show warning toast with `retryAfter` from `details`
- **TanStack Query**: Don't retry auth, validation, or 422 errors. Retry server errors up to 2 times.
- **Error boundary**: Wrap pages to catch unhandled rendering errors with fallback UI
