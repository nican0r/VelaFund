# API Standards Specification

## Overview

This specification defines the API standards for the Navia platform. All backend endpoints **must** conform to these conventions to ensure consistency across the platform and simplify frontend integration.

**Applies to**: All `/api/v1/*` endpoints in the NestJS backend.

---

## Table of Contents

1. [URL Conventions](#url-conventions)
2. [Response Envelope](#response-envelope)
3. [Pagination](#pagination)
4. [Filtering and Sorting](#filtering-and-sorting)
5. [HTTP Status Codes](#http-status-codes)
6. [Common Headers](#common-headers)
7. [Rate Limiting](#rate-limiting)
8. [Internationalization (i18n)](#internationalization-i18n)
9. [Naming Conventions](#naming-conventions)
10. [Content Types](#content-types)
11. [API Versioning](#api-versioning)
12. [Request Validation](#request-validation)
13. [NestJS Implementation](#nestjs-implementation)

---

## URL Conventions

### Base Path

All API endpoints start with `/api/v1/`.

### Company-Scoped Resources

Resources that belong to a company use nested paths with the company ID in the URL:

```
GET    /api/v1/companies/:companyId/shareholders
POST   /api/v1/companies/:companyId/shareholders
GET    /api/v1/companies/:companyId/shareholders/:id
PUT    /api/v1/companies/:companyId/shareholders/:id
DELETE /api/v1/companies/:companyId/shareholders/:id
```

### User-Scoped Resources

Resources scoped to the authenticated user:

```
GET  /api/v1/users/me
GET  /api/v1/users/me/companies
GET  /api/v1/users/me/notifications
PUT  /api/v1/users/me/settings
```

### Global Resources

Resources not scoped to a company or user:

```
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/kyc/verify-cpf
GET  /api/v1/invitations/:token
```

### Resource Naming Rules

- **Plural nouns** for collections: `/shareholders`, `/transactions`, `/share-classes`
- **kebab-case** for multi-word resources: `/share-classes`, `/funding-rounds`, `/option-plans`, `/option-grants`, `/audit-logs`, `/cap-table`
- **No verbs** in paths — use HTTP methods to express actions
- **Singular** for singleton resources: `/cap-table`, `/users/me`

### Action Endpoints

For operations that don't map cleanly to CRUD, use a verb suffix:

```
POST /api/v1/companies/:companyId/cap-table/export
POST /api/v1/companies/:companyId/transactions/:id/approve
POST /api/v1/companies/:companyId/option-grants/:id/exercise
```

### Complete Resource Path Reference

| Resource | Path | Scoping |
|----------|------|---------|
| Auth | `/api/v1/auth/*` | Global |
| KYC | `/api/v1/kyc/*` | Global |
| Users | `/api/v1/users/me/*` | User |
| Companies | `/api/v1/companies` | User (list) |
| Company detail | `/api/v1/companies/:companyId` | Company |
| Members | `/api/v1/companies/:companyId/members` | Company |
| Shareholders | `/api/v1/companies/:companyId/shareholders` | Company |
| Share Classes | `/api/v1/companies/:companyId/share-classes` | Company |
| Cap Table | `/api/v1/companies/:companyId/cap-table` | Company |
| Transactions | `/api/v1/companies/:companyId/transactions` | Company |
| Funding Rounds | `/api/v1/companies/:companyId/funding-rounds` | Company |
| Commitments | `/api/v1/companies/:companyId/funding-rounds/:roundId/commitments` | Company |
| Convertibles | `/api/v1/companies/:companyId/convertibles` | Company |
| Option Plans | `/api/v1/companies/:companyId/option-plans` | Company |
| Option Grants | `/api/v1/companies/:companyId/option-grants` | Company |
| Documents | `/api/v1/companies/:companyId/documents` | Company |
| Notifications | `/api/v1/users/me/notifications` | User |
| Audit Logs | `/api/v1/companies/:companyId/audit-logs` | Company |
| Reports | `/api/v1/companies/:companyId/reports/*` | Company |

---

## Response Envelope

All API responses use a consistent envelope format.

### Success Response (Single Resource)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Ltda.",
    "cnpj": "12.345.678/0001-90",
    "status": "ACTIVE",
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
}
```

### Success Response (List)

```json
{
  "success": true,
  "data": [
    { "id": "uuid-1", "name": "Shareholder A" },
    { "id": "uuid-2", "name": "Shareholder B" }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### Success Response (No Content)

For `DELETE` operations and other actions that produce no response body, return HTTP `204 No Content` with an empty body.

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "CAP_INSUFFICIENT_SHARES",
    "message": "Ações insuficientes para completar a transferência",
    "messageKey": "errors.cap.insufficientShares",
    "details": {
      "available": 1000,
      "requested": 1500,
      "shareholderId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### Validation Error Response

Validation errors include a `validationErrors` array with per-field details:

```json
{
  "success": false,
  "error": {
    "code": "VAL_INVALID_INPUT",
    "message": "Dados de entrada inválidos",
    "messageKey": "errors.val.invalidInput",
    "validationErrors": [
      {
        "field": "cnpj",
        "message": "CNPJ inválido",
        "messageKey": "errors.val.invalidCnpj"
      },
      {
        "field": "capitalSocial",
        "message": "Deve ser maior que zero",
        "messageKey": "errors.val.mustBePositive"
      }
    ]
  }
}
```

### TypeScript Types

```typescript
// Success response for a single resource
interface ApiResponse<T> {
  success: true;
  data: T;
}

// Success response for a paginated list
interface PaginatedApiResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Error response
interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

interface ApiError {
  code: string;
  message: string;
  messageKey: string;
  details?: Record<string, unknown>;
  validationErrors?: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  messageKey: string;
}
```

---

## Pagination

All list endpoints support offset-based pagination.

### Query Parameters

| Parameter | Type | Default | Constraints | Description |
|-----------|------|---------|-------------|-------------|
| `page` | integer | `1` | min: 1 | Page number (1-indexed) |
| `limit` | integer | `20` | min: 1, max: 100 | Items per page |

### Example Request

```
GET /api/v1/companies/:companyId/shareholders?page=2&limit=10
```

### Example Response

```json
{
  "success": true,
  "data": [
    { "id": "uuid-11", "name": "Shareholder K" },
    { "id": "uuid-12", "name": "Shareholder L" }
  ],
  "meta": {
    "total": 50,
    "page": 2,
    "limit": 10,
    "totalPages": 5
  }
}
```

### Rules

- If `page` exceeds `totalPages`, return an empty `data` array with correct `meta`.
- `total` reflects the count **after** filters are applied.
- Default `limit` is 20. Maximum is 100.
- Endpoints that return unbounded data (audit logs, transaction history) **must** enforce pagination — bare requests without `page`/`limit` use the defaults.

---

## Filtering and Sorting

### Filtering

List endpoints support flat query parameters for filtering:

```
GET /api/v1/companies/:companyId/shareholders?status=active&type=individual
```

#### Supported Filter Parameters (per resource)

Each resource defines its own filterable fields in its specification. Common patterns:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status enum value |
| `type` | string | Filter by type enum value |
| `search` | string | Full-text search on name/email fields |
| `createdAfter` | ISO 8601 date | Items created after this date |
| `createdBefore` | ISO 8601 date | Items created before this date |

#### Filter Rules

- Unknown filter parameters are **ignored** (not rejected).
- Filters are combined with AND logic.
- String filters are case-insensitive.
- Date filters use ISO 8601 format: `2026-01-15` or `2026-01-15T10:30:00.000Z`.
- Enum filters accept the exact enum value (case-sensitive): `?status=ACTIVE`.

### Sorting

Use the `sort` query parameter:

```
GET /api/v1/companies/:companyId/shareholders?sort=-createdAt
```

| Syntax | Meaning |
|--------|---------|
| `sort=createdAt` | Ascending by `createdAt` |
| `sort=-createdAt` | Descending by `createdAt` (prefix `-`) |
| `sort=-createdAt,name` | Descending by `createdAt`, then ascending by `name` |

#### Sort Rules

- Default sort is `-createdAt` (newest first) unless the resource spec defines otherwise.
- Only fields declared as sortable in the resource spec can be used.
- Invalid sort fields are **ignored** and the default sort is used.
- Maximum 3 sort fields per request.

---

## HTTP Status Codes

### Success Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| `200 OK` | Successful read or update | GET, PUT, PATCH responses |
| `201 Created` | Resource created | POST that creates a resource |
| `204 No Content` | Success, no body | DELETE, or actions with no return value |

### Client Error Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| `400 Bad Request` | Malformed request | Invalid JSON, missing required fields |
| `401 Unauthorized` | Not authenticated | Missing or invalid Bearer token |
| `403 Forbidden` | Not authorized | Valid token but insufficient permissions |
| `404 Not Found` | Resource not found | Entity doesn't exist or not in company scope |
| `409 Conflict` | Resource conflict | Duplicate CNPJ, duplicate email, etc. |
| `422 Unprocessable Entity` | Business rule violation | Insufficient shares, lockup active, etc. |
| `429 Too Many Requests` | Rate limited | Exceeded rate limit |

### Server Error Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| `500 Internal Server Error` | Unexpected error | Unhandled exceptions |
| `502 Bad Gateway` | Upstream error | Privy, Verifik, or blockchain service down |
| `503 Service Unavailable` | Maintenance | Planned downtime |

### Rules

- Never return `200` with an error body. Use the appropriate error status code.
- `404` is returned both for missing resources and for resources the user doesn't have access to (to prevent enumeration).
- `422` is used for business rule violations (valid syntax but semantically invalid).
- `400` is used for syntactic issues (invalid JSON, wrong types).

---

## Common Headers

### Request Headers

| Header | Required | Description | Example |
|--------|----------|-------------|---------|
| `Authorization` | Yes (except public endpoints) | Bearer token from Privy | `Bearer eyJhbGc...` |
| `Content-Type` | Yes (for request bodies) | Request body format | `application/json` |
| `Accept-Language` | No | Preferred language for messages | `pt-BR` (default), `en` |
| `X-Request-Id` | No | Client-generated request ID for tracing | `550e8400-e29b-...` |

### Response Headers

| Header | Always Present | Description | Example |
|--------|---------------|-------------|---------|
| `Content-Type` | Yes | Response body format | `application/json` |
| `X-Request-Id` | Yes | Echo or server-generated request ID | `550e8400-e29b-...` |
| `X-RateLimit-Limit` | Yes | Max requests in window | `100` |
| `X-RateLimit-Remaining` | Yes | Remaining requests in window | `97` |
| `X-RateLimit-Reset` | Yes | Window reset time (Unix timestamp) | `1706000000` |

### Notes

- If the client does not send `X-Request-Id`, the server generates one (UUIDv4) and returns it.
- `Accept-Language` defaults to `pt-BR` if not provided.
- `Authorization` is not required for endpoints decorated with `@Public()`.

---

## Rate Limiting

### Rate Limit Tiers

Rate limits are applied **per authenticated user** (or per IP for unauthenticated endpoints).

| Category | Limit | Window | Applies To |
|----------|-------|--------|------------|
| Auth | 10 requests | 1 minute | `POST /api/v1/auth/*` |
| Read | 100 requests | 1 minute | All `GET` endpoints |
| Write | 30 requests | 1 minute | All `POST`, `PUT`, `PATCH`, `DELETE` endpoints |
| File upload | 10 requests | 1 minute | Endpoints accepting `multipart/form-data` |
| Blockchain tx | 10 requests | 1 minute | Endpoints that trigger on-chain transactions |

### Rate Limit Response

When a rate limit is exceeded, the API returns:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706000060
Retry-After: 45
```

```json
{
  "success": false,
  "error": {
    "code": "SYS_RATE_LIMITED",
    "message": "Limite de requisições excedido. Tente novamente em 45 segundos.",
    "messageKey": "errors.sys.rateLimited",
    "details": {
      "retryAfter": 45,
      "limit": 30,
      "window": "1m"
    }
  }
}
```

### Rules

- Rate limits use a sliding window algorithm.
- `X-RateLimit-*` headers are included on **every** response (not just 429).
- The `Retry-After` header is included only on `429` responses (value in seconds).
- Unauthenticated rate limiting is per IP address.
- Authenticated rate limiting is per user ID.

---

## Internationalization (i18n)

### Request Language

The client specifies preferred language via the `Accept-Language` header:

```
Accept-Language: pt-BR
Accept-Language: en
```

**Supported languages**: `pt-BR` (default), `en`.

### Response Behavior

- The `message` field in error responses is returned in the requested language.
- The `messageKey` field is always included for frontend i18n lookup as a fallback.
- If the requested language is not supported, `pt-BR` is used.
- Success response data (entity fields) is **not** translated — data is stored and returned as-is.

### Example

**Request**:
```
GET /api/v1/companies/invalid-uuid/shareholders
Accept-Language: en
```

**Response**:
```json
{
  "success": false,
  "error": {
    "code": "COMPANY_NOT_FOUND",
    "message": "Company not found",
    "messageKey": "errors.company.notFound"
  }
}
```

**Same request with `pt-BR`**:
```json
{
  "success": false,
  "error": {
    "code": "COMPANY_NOT_FOUND",
    "message": "Empresa não encontrada",
    "messageKey": "errors.company.notFound"
  }
}
```

---

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| URL paths | kebab-case | `/share-classes`, `/funding-rounds` |
| URL path parameters | camelCase | `:companyId`, `:shareholderId` |
| Query parameters | camelCase | `?createdAfter=`, `?shareClassId=` |
| JSON request/response fields | camelCase | `capitalSocial`, `createdAt`, `shareholderId` |
| Database columns | snake_case | `capital_social`, `created_at`, `shareholder_id` |
| TypeScript types/interfaces | PascalCase | `Company`, `ShareClass`, `ApiResponse` |
| TypeScript enums | PascalCase + UPPER_SNAKE values | `TransactionType.SHARE_ISSUANCE` |
| Error codes | UPPER_SNAKE_CASE with prefix | `CAP_INSUFFICIENT_SHARES` |

### Prisma Mapping

Use Prisma `@map` and `@@map` to bridge camelCase TypeScript with snake_case database columns:

```prisma
model ShareClass {
  id             String   @id @default(uuid())
  companyId      String   @map("company_id")
  className      String   @map("class_name")
  totalAuthorized Decimal @map("total_authorized")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@map("share_classes")
}
```

---

## Content Types

### Request Content Types

| Content-Type | When Used |
|-------------|-----------|
| `application/json` | Default for all API requests |
| `multipart/form-data` | File uploads (KYC documents, side letters) |

### Response Content Types

| Content-Type | When Used |
|-------------|-----------|
| `application/json` | Default for all API responses |
| `application/pdf` | PDF report exports |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Excel exports |
| `text/csv` | CSV exports |
| `application/zip` | Due diligence packages |

### Export Requests

Export endpoints accept a `format` query parameter:

```
GET /api/v1/companies/:companyId/reports/cap-table/export?format=pdf
GET /api/v1/companies/:companyId/reports/cap-table/export?format=xlsx
GET /api/v1/companies/:companyId/reports/cap-table/export?format=csv
```

Export responses set appropriate `Content-Type` and `Content-Disposition` headers:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="cap-table-2026-01-15.pdf"
```

---

## API Versioning

### Strategy

URL path versioning: all endpoints are prefixed with `/api/v1/`.

### Rules

- Breaking changes require a new version (`/api/v2/`).
- Non-breaking changes (adding optional fields, new endpoints) can be added to the current version.
- Deprecated endpoints return a `Deprecation` header with the sunset date.
- Both versions run in parallel during transition periods.

### What Constitutes a Breaking Change

- Removing a field from a response
- Changing the type of a field
- Renaming a field
- Removing an endpoint
- Changing required fields in a request
- Changing the meaning of a status code for an endpoint

### What Is Not a Breaking Change

- Adding an optional field to a response
- Adding a new endpoint
- Adding an optional query parameter
- Adding a new enum value (when clients handle unknown values)

---

## Request Validation

All request bodies are validated on the server using `class-validator` decorators with `class-transformer`.

### Validation Rules

- **All inputs are validated server-side**, even if the frontend validates first.
- Invalid requests return `400 Bad Request` with `validationErrors`.
- Validation runs before any business logic.
- UUIDs are validated for format.
- Enums are validated against allowed values.
- Numeric fields for financial data use `Decimal` (never floating point).

### Validation Error Format

```json
{
  "success": false,
  "error": {
    "code": "VAL_INVALID_INPUT",
    "message": "Dados de entrada inválidos",
    "messageKey": "errors.val.invalidInput",
    "validationErrors": [
      {
        "field": "name",
        "message": "Nome é obrigatório",
        "messageKey": "errors.val.required"
      },
      {
        "field": "cnpj",
        "message": "Formato de CNPJ inválido",
        "messageKey": "errors.val.invalidFormat"
      }
    ]
  }
}
```

---

## NestJS Implementation

### Response Interceptor

Wraps all successful responses in the standard envelope:

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from './types';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the handler already returned an envelope, pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return {
          success: true as const,
          data,
        };
      }),
    );
  }
}
```

### Pagination DTO

Reusable DTO for paginated list endpoints:

```typescript
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

### Paginated Response Helper

```typescript
import { PaginationMeta } from './types';

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  const meta: PaginationMeta = {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  return { success: true as const, data, meta };
}
```

### Sort Query DTO

```typescript
import { IsOptional, IsString, Matches } from 'class-validator';

export class SortQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^-?[a-zA-Z]+(,-?[a-zA-Z]+){0,2}$/, {
    message: 'Invalid sort format. Use: field, -field, or comma-separated.',
  })
  sort?: string;
}
```

### Sort Parser Utility

```typescript
export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

export function parseSort(
  sort: string | undefined,
  allowedFields: string[],
  defaultSort: SortField = { field: 'createdAt', direction: 'desc' },
): SortField[] {
  if (!sort) return [defaultSort];

  const fields = sort.split(',').slice(0, 3);
  const parsed: SortField[] = [];

  for (const f of fields) {
    const descending = f.startsWith('-');
    const fieldName = descending ? f.slice(1) : f;

    if (allowedFields.includes(fieldName)) {
      parsed.push({
        field: fieldName,
        direction: descending ? 'desc' : 'asc',
      });
    }
  }

  return parsed.length > 0 ? parsed : [defaultSort];
}
```

### Global Exception Filter

Catches all exceptions and formats them as standard error responses:

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { I18nService } from './i18n.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const lang = request.headers['accept-language'] || 'pt-BR';

    if (exception instanceof AppException) {
      return response.status(exception.statusCode).json({
        success: false,
        error: {
          code: exception.code,
          message: this.i18n.translate(exception.messageKey, lang),
          messageKey: exception.messageKey,
          details: exception.details,
          validationErrors: exception.validationErrors,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response.status(status).json({
        success: false,
        error: {
          code: 'SYS_HTTP_ERROR',
          message: typeof body === 'string' ? body : (body as any).message,
          messageKey: 'errors.sys.httpError',
        },
      });
    }

    // Unhandled exception
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'SYS_INTERNAL_ERROR',
        message: this.i18n.translate('errors.sys.internalError', lang),
        messageKey: 'errors.sys.internalError',
      },
    });
  }
}
```

### Custom AppException Class

Base class for all application-specific exceptions:

```typescript
import { HttpStatus } from '@nestjs/common';
import { ValidationError } from './types';

export class AppException extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly statusCode: number = HttpStatus.UNPROCESSABLE_ENTITY,
    public readonly details?: Record<string, unknown>,
    public readonly validationErrors?: ValidationError[],
  ) {
    super(messageKey);
  }
}

// Convenience subclasses
export class NotFoundException extends AppException {
  constructor(resource: string, id: string) {
    super(
      `${resource.toUpperCase()}_NOT_FOUND`,
      `errors.${resource.toLowerCase()}.notFound`,
      HttpStatus.NOT_FOUND,
      { id },
    );
  }
}

export class ConflictException extends AppException {
  constructor(code: string, messageKey: string, details?: Record<string, unknown>) {
    super(code, messageKey, HttpStatus.CONFLICT, details);
  }
}

export class BusinessRuleException extends AppException {
  constructor(code: string, messageKey: string, details?: Record<string, unknown>) {
    super(code, messageKey, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class ValidationException extends AppException {
  constructor(errors: ValidationError[]) {
    super(
      'VAL_INVALID_INPUT',
      'errors.val.invalidInput',
      HttpStatus.BAD_REQUEST,
      undefined,
      errors,
    );
  }
}
```

### Request ID Middleware

Ensures every request has a unique ID for tracing:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
```

### Rate Limiting Configuration

Using `@nestjs/throttler`:

```typescript
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'auth', ttl: 60000, limit: 10 },
      { name: 'read', ttl: 60000, limit: 100 },
      { name: 'write', ttl: 60000, limit: 30 },
      { name: 'upload', ttl: 60000, limit: 10 },
      { name: 'blockchain', ttl: 60000, limit: 10 },
    ]),
  ],
})
export class AppModule {}
```

Apply specific tiers with decorators:

```typescript
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller('api/v1/auth')
export class AuthController {
  @Post('login')
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async login(@Body() dto: LoginDto) { /* ... */ }
}

@Controller('api/v1/companies/:companyId/shareholders')
export class ShareholderController {
  @Get()
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  async list(@Query() query: PaginationQueryDto) { /* ... */ }

  @Post()
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  async create(@Body() dto: CreateShareholderDto) { /* ... */ }
}
```

### Controller Usage Example

Putting it all together in a controller:

```typescript
import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { RequireAuth } from '../auth/decorators/require-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/helpers/paginate';

@Controller('api/v1/companies/:companyId/shareholders')
@RequireAuth()
export class ShareholderController {
  constructor(private readonly shareholderService: ShareholderService) {}

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  async list(
    @Param('companyId') companyId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const { items, total } = await this.shareholderService.findAll(companyId, {
      page: pagination.page,
      limit: pagination.limit,
      status,
      search,
      sort,
    });

    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateShareholderDto,
  ) {
    return this.shareholderService.create(companyId, dto);
  }
}
```

---

## Frontend API Client Pattern

### Typed API Client

```typescript
import { ApiResponse, PaginatedApiResponse, ApiErrorResponse } from '@shared/types';

class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL;

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getCurrentLocale(),
        ...options?.headers,
      },
    });

    const body = await res.json();

    if (!body.success) {
      throw new ApiError(body.error);
    }

    return body.data;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async getList<T>(path: string): Promise<{ data: T[]; meta: PaginationMeta }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getCurrentLocale(),
      },
    });
    const body = await res.json();
    if (!body.success) throw new ApiError(body.error);
    return { data: body.data, meta: body.meta };
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(path: string): Promise<void> {
    await fetch(`${this.baseUrl}${path}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
```

### TanStack Query Integration

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useShareholders(companyId: string, params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.sort) query.set('sort', params.sort);

  const path = `/api/v1/companies/${companyId}/shareholders?${query}`;

  return useQuery({
    queryKey: ['shareholders', companyId, params],
    queryFn: () => api.getList<Shareholder>(path),
  });
}
```

---

## Success Criteria

- [ ] All endpoints return the standard response envelope
- [ ] All list endpoints support pagination with `page` and `limit` params
- [ ] All list endpoints support at least one filter and sorting
- [ ] All error responses use the standard error format with `code`, `message`, and `messageKey`
- [ ] Rate limit headers are present on every response
- [ ] Error messages are returned in the language specified by `Accept-Language`
- [ ] URL paths use kebab-case, JSON uses camelCase, DB uses snake_case
- [ ] Request validation returns structured `validationErrors`
- [ ] Every request has an `X-Request-Id` for tracing
