# Security Specification

## Overview

This specification consolidates the security requirements for the Navia platform. It covers application-level security, LGPD compliance, encryption standards, and platform security guidelines. It complements:

- `api-standards.md` — rate limiting, request validation, common headers
- `error-handling.md` — PII redaction in logs, Sentry configuration
- `authentication.md` — Privy JWT verification, session management
- `user-permissions.md` — RBAC roles and permission matrix

**Scope**: Application-level security with platform guidelines for Railway, Vercel, and AWS. Infrastructure-level details (WAF rules, VPC configuration, IDS/IPS) are out of scope for the MVP.

---

## Table of Contents

1. [LGPD Compliance](#lgpd-compliance)
2. [Encryption Standards](#encryption-standards)
3. [Security Headers](#security-headers)
4. [CORS Configuration](#cors-configuration)
5. [CSRF Protection](#csrf-protection)
6. [Input Validation and Sanitization](#input-validation-and-sanitization)
7. [Authentication Security](#authentication-security)
8. [Authorization Security](#authorization-security)
9. [Secret Management](#secret-management)
10. [File Upload Security](#file-upload-security)
11. [Data Breach Incident Response](#data-breach-incident-response)
12. [Platform Security Guidelines](#platform-security-guidelines)
13. [Dependency Security](#dependency-security)
14. [NestJS Implementation](#nestjs-implementation)
15. [Success Criteria](#success-criteria)

---

## LGPD Compliance

The Navia platform must comply with Brazil's Lei Geral de Proteção de Dados (LGPD — Law 13.709/2018). This section defines the technical implementation of data subject rights, consent management, data processing records, and retention policies.

### Data Subject Rights

Users exercise their LGPD rights via self-service API endpoints. All data subject requests are audit-logged.

#### Right to Access (Art. 18, II)

Users can view all personal data the platform holds about them.

**Endpoint**: `GET /api/v1/users/me/data`

**Response includes**:
- Profile data (name, email, phone)
- KYC verification status and submission dates (not raw documents)
- Company memberships and roles
- Shareholdings across companies (only their own)
- Option grants (only their own)
- Notification preferences
- Consent records
- Login history (last 90 days)

**Response excludes**:
- Company-owned data (cap table, other shareholders, transactions created by others)
- Audit logs created by other users
- Raw KYC documents (available via separate secure download)

#### Right to Rectification (Art. 18, III)

Users can correct their personal data.

**Endpoint**: `PUT /api/v1/users/me`

**Editable fields**: name, email, phone, notification preferences, locale.

**Non-editable fields** (require support request): CPF (linked to KYC), wallet address (managed by Privy).

Changes are audit-logged with before/after values.

#### Right to Deletion (Art. 18, VI)

Users can request account deletion.

**Endpoint**: `DELETE /api/v1/users/me`

**Deletion flow**:
1. User confirms deletion via the API.
2. Account enters a 30-day grace period (soft delete). User can cancel during this period.
3. After 30 days, a background job anonymizes the data:
   - Name → `[Deleted User]`
   - Email → `deleted-{uuid}@navia.placeholder`
   - CPF → Encrypted value deleted, blind index retained for uniqueness
   - Phone → null
   - KYC documents → Deleted from S3
   - Profile photo → Deleted from S3
4. Records that must be retained for legal/compliance purposes are kept but anonymized:
   - Audit logs (5-year retention — LGPD Art. 16, I)
   - Transaction records (10-year retention — Brazilian corporate law)
   - Shareholding history (retained as company data, shareholder name anonymized)

**Blocking conditions**: Deletion is blocked if the user is the last ADMIN of any active company. They must transfer the ADMIN role first.

#### Right to Portability (Art. 18, V)

Users can download their personal data in a machine-readable format.

**Endpoint**: `GET /api/v1/users/me/export`

**Format**: JSON file download.

**Contents**: Same scope as Right to Access. File is generated asynchronously via Bull job and available for download for 24 hours. User receives an email notification when ready.

**Rate limit**: 1 export request per 24 hours.

### Consent Management

#### Consent Types

| Consent | Required | When Collected | Can Withdraw |
|---------|----------|---------------|-------------|
| Terms of Service | Yes | Registration | No (must delete account) |
| Privacy Policy | Yes | Registration | No (must delete account) |
| KYC data collection | Yes (for KYC) | KYC start | Yes (blocks KYC features) |
| Email notifications | No | Registration (opt-in) | Yes |
| Marketing communications | No | Settings (opt-in) | Yes |

#### Consent Recording

```typescript
interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt: Date;
  revokedAt: Date | null;
  ipAddress: string;        // Stored for proof, redacted in /24 in logs
  userAgent: string;
  version: string;           // Version of the terms/policy consented to
}
```

Every consent grant or revocation is immutable — new records are created rather than updating existing ones.

#### Consent Withdrawal

`PUT /api/v1/users/me/consents/:consentType` with `{ "granted": false }`.

Withdrawing KYC consent triggers deletion of KYC documents from S3 within 72 hours.

### Data Processing Record (Art. 37)

The platform maintains a record of all data processing activities:

| Data Category | Purpose | Legal Basis | Retention | Third Parties |
|--------------|---------|-------------|-----------|--------------|
| Name, email | Account management | Contract (Art. 7, V) | Account lifetime + 30 days | Privy (auth) |
| CPF | Identity verification | Legal obligation (Art. 7, II) | 5 years post-deletion | Verifik (KYC) |
| CNPJ | Company verification | Legal obligation (Art. 7, II) | Company lifetime | Verifik (KYC) |
| KYC documents | Identity verification | Consent (Art. 7, I) | 5 years or until consent withdrawn | Verifik (KYC), AWS S3 (storage) |
| Facial biometrics | Liveness check | Consent (Art. 7, I) | 90 days after verification | Verifik (processing only) |
| Shareholding data | Cap table management | Contract (Art. 7, V) | Company lifetime + 10 years | AWS (storage) |
| Transaction history | Audit trail | Legal obligation (Art. 7, II) | 10 years | AWS (storage), Base Network (blockchain) |
| IP address | Security logging | Legitimate interest (Art. 7, IX) | 90 days | — |
| Email content | Notifications | Consent (Art. 7, I) | 90 days | AWS SES (delivery) |
| Wallet address | Blockchain identity | Contract (Art. 7, V) | Account lifetime | Base Network (public blockchain) |

### Data Retention Policies

| Data Type | Active Retention | Post-Deletion Retention | Destruction Method |
|-----------|-----------------|------------------------|-------------------|
| User profile | Account lifetime | 30-day grace + anonymization | Field-level anonymization |
| KYC documents | 5 years from verification | Delete from S3 | S3 object deletion |
| KYC biometric hashes | 90 days from verification | Auto-delete | Database deletion |
| Audit logs | 5 years | 5 years (immutable) | Auto-archive to cold storage |
| Transaction records | Company lifetime | 10 years | Archive to cold storage |
| Consent records | Indefinite (proof) | Indefinite | Never deleted |
| Session/auth logs | 90 days | Auto-delete | Database deletion |
| Email notification logs | 90 days | Auto-delete | Database deletion |

---

## Encryption Standards

### In Transit

| Requirement | Configuration |
|-------------|--------------|
| Protocol | TLS 1.3 (minimum TLS 1.2) |
| HTTPS | Enforced on all endpoints. HTTP redirects to HTTPS. |
| Certificate | Managed by platform (Vercel auto-SSL, Railway auto-SSL) |
| Internal services | TLS between backend and PostgreSQL (Railway enforced), backend and Redis (Railway enforced) |
| S3 connections | HTTPS only via AWS SDK default |
| Blockchain RPC | HTTPS RPC endpoints only |

### At Rest — Database Level

| Layer | Encryption | Managed By |
|-------|-----------|-----------|
| PostgreSQL | AES-256 transparent data encryption | Railway (managed) |
| Redis | AES-256 at rest | Railway (managed) |
| S3 buckets | AES-256 server-side encryption (SSE-S3) | AWS |
| S3 KYC bucket | AES-256 with AWS KMS customer-managed key (SSE-KMS) | Application via AWS KMS |

### At Rest — Application-Level Encryption

High-sensitivity fields are encrypted at the application level using AWS KMS before storage. This provides defense-in-depth beyond database-level encryption.

#### Fields Encrypted at Application Level

| Field | Entity | Encryption | Searchable |
|-------|--------|-----------|-----------|
| CPF | User / Shareholder | AES-256-GCM via AWS KMS | Yes (blind index) |
| Bank account number | Shareholder | AES-256-GCM via AWS KMS | No |
| Bank routing number | Shareholder | AES-256-GCM via AWS KMS | No |
| KYC document S3 URLs | KYCVerification | AES-256-GCM via AWS KMS | No |
| KYC biometric hashes | KYCVerification | AES-256-GCM via AWS KMS | No |

#### Fields NOT Encrypted at Application Level (DB-at-rest only)

| Field | Reason |
|-------|--------|
| Name, email, phone | Need to be searchable and displayable. Protected by DB encryption + TLS. |
| CNPJ | Needs to be searchable with unique constraint. Public registry data. |
| Wallet addresses | Public by nature (on-chain). |
| Company data | Not PII. Company-owned. |
| Transaction amounts | Not PII. Need aggregation queries. |

#### Blind Index for Encrypted Searchable Fields

To search on encrypted fields (e.g., find user by CPF), use a blind index:

```typescript
import { createHmac } from 'crypto';

function createBlindIndex(value: string, key: string): string {
  return createHmac('sha256', key)
    .update(value.replace(/\D/g, '')) // Normalize: digits only
    .digest('hex')
    .slice(0, 32); // Truncate for storage
}

// Schema
model User {
  cpfEncrypted   Bytes?   @map("cpf_encrypted")   // AES-256-GCM ciphertext
  cpfBlindIndex  String?  @map("cpf_blind_index")  // HMAC-SHA256 for lookup
  // ...
  @@index([cpfBlindIndex])
}

// Search by CPF
const blindIndex = createBlindIndex(cpf, process.env.BLIND_INDEX_KEY);
const user = await prisma.user.findFirst({
  where: { cpfBlindIndex: blindIndex },
});
```

#### Key Rotation

| Key Type | Rotation Frequency | Procedure |
|----------|-------------------|-----------|
| AWS KMS CMK (data encryption) | Annual (automatic via AWS) | AWS handles. No application change needed. |
| Blind index HMAC key | Never rotate (would invalidate all indexes) | If compromised: re-index all records in maintenance window. |
| Privy signing keys | Managed by Privy | No application action needed. |
| JWT secrets | Managed by Privy | No application action needed. |

---

## Security Headers

The backend sets the following security headers on all responses. Vercel and Railway add additional platform-level headers.

### Required Headers

```typescript
// NestJS middleware or helmet configuration
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-DNS-Prefetch-Control': 'off',
};
```

### Content Security Policy (CSP)

The frontend (Next.js on Vercel) sets the CSP header via `next.config.js`:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://*.amazonaws.com;
  font-src 'self';
  connect-src 'self' https://api.navia.com.br https://auth.privy.io https://*.base.org;
  frame-src https://auth.privy.io;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
```

**Notes**:
- `unsafe-inline` for scripts is required by Privy SDK. Tighten with nonces if Privy supports it in the future.
- `unsafe-eval` is required by some Next.js development features. Remove in production if possible.
- `connect-src` includes Privy auth and Base Network RPC endpoints.
- `frame-src` allows Privy's auth modal iframe.

### Headers to Remove

```typescript
// Remove headers that leak server information
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  next();
});
```

---

## CORS Configuration

### Backend CORS Settings

```typescript
import { NestFactory } from '@nestjs/core';

const app = await NestFactory.create(AppModule);

app.enableCors({
  origin: [
    process.env.FRONTEND_URL,                    // e.g., https://app.navia.com.br
    ...(process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000']
      : []),
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept-Language',
    'X-Request-Id',
  ],
  exposedHeaders: [
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  credentials: true,
  maxAge: 3600, // Cache preflight for 1 hour
});
```

### Rules

- **No wildcard origins** (`*`) in production.
- `credentials: true` is required for HTTP-only cookie auth.
- Only the Vercel frontend URL is allowed as an origin in production.
- `localhost:3000` is allowed only in development.

---

## CSRF Protection

Since the platform uses HTTP-only cookies for session tokens (per `authentication.md`), CSRF protection is required.

### Strategy: Double Submit Cookie

1. On login, the backend sets a CSRF token in a non-HTTP-only cookie (`navia-csrf`).
2. The frontend reads this cookie and includes it as the `X-CSRF-Token` header on all state-changing requests (POST, PUT, PATCH, DELETE).
3. The backend validates that the header matches the cookie value.

### NestJS Implementation

```typescript
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Set CSRF token on GET requests (readable by frontend JS)
    if (req.method === 'GET') {
      const token = randomBytes(32).toString('hex');
      res.cookie('navia-csrf', token, {
        httpOnly: false, // Must be readable by JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      req['csrfToken'] = token;
    }

    // Validate CSRF on state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const cookieToken = req.cookies['navia-csrf'];
      const headerToken = req.headers['x-csrf-token'];

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    }

    next();
  }
}
```

### Frontend Integration

```typescript
function getCsrfToken(): string | null {
  const match = document.cookie.match(/navia-csrf=([^;]+)/);
  return match ? match[1] : null;
}

// Add to API client headers
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};
const csrf = getCsrfToken();
if (csrf) headers['X-CSRF-Token'] = csrf;
```

---

## Input Validation and Sanitization

### Validation Layers

Input is validated at three layers:

1. **API gateway** — NestJS `ValidationPipe` with `class-validator` rejects malformed requests (400).
2. **Business logic** — Services validate business rules (422).
3. **Database** — Prisma schema constraints (unique, not null, enums) as final safety net.

### SQL Injection Prevention

Prisma ORM uses parameterized queries by default. Raw queries are prohibited unless approved in code review.

```typescript
// SAFE — Prisma parameterized query
const user = await prisma.user.findUnique({ where: { id: userId } });

// FORBIDDEN — Raw SQL with string interpolation
// await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = '${userId}'`);

// ALLOWED ONLY WITH PARAMETERIZATION — Rare cases needing raw SQL
// await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;
```

### XSS Prevention

- All API responses use `Content-Type: application/json`. No HTML is served by the backend.
- The frontend uses React, which auto-escapes JSX output by default.
- `dangerouslySetInnerHTML` is prohibited unless rendering sanitized Markdown (e.g., document templates).
- User-generated content rendered as Markdown must be sanitized with `DOMPurify` before rendering.
- The CSP header blocks inline scripts from untrusted sources.

### Path Traversal Prevention

S3 object keys are generated server-side using UUIDs. User-provided file names are sanitized:

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Remove special chars
    .replace(/\.{2,}/g, '.')            // Remove path traversal
    .slice(0, 255);                      // Limit length
}
```

### Request Size Limits

| Endpoint Type | Max Body Size |
|--------------|---------------|
| JSON API (default) | 1 MB |
| File upload (multipart) | 10 MB |
| Bulk operations | 5 MB |

Configured via NestJS:

```typescript
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));
```

Multer is configured per-route for file uploads with a 10 MB limit.

---

## Authentication Security

This section supplements `authentication.md` with security-specific requirements.

### Token Security

| Aspect | Requirement |
|--------|------------|
| Storage | HTTP-only, Secure, SameSite=Strict cookie. Never localStorage. |
| Session timeout | 2 hours inactivity, 7 days absolute |
| Token verification | Always on the backend via Privy Server SDK. Never trust frontend claims. |
| Failed attempts | 5 failures in 15 minutes → 15-minute lock per IP |
| Concurrent sessions | Allowed (user may use multiple devices) |
| Logout | Invalidates session on backend. Clears cookies on frontend. |

### Session Invalidation Triggers

- User clicks logout
- Password change (if applicable)
- Account deletion request
- Admin removes user from company (invalidates company-scoped session context, not auth session)
- 7-day absolute expiry reached

### Privy Token Verification

The backend **must** verify every Privy JWT on every request. The verification flow:

1. Extract JWT from `Authorization: Bearer` header or HTTP-only cookie.
2. Call `privy.verifyAuthToken(token)` via Privy Server SDK.
3. On success: extract `userId`, look up or create user in database.
4. On failure: return 401 with `AUTH_INVALID_TOKEN`.

**Never cache verification results.** Each request must be independently verified to detect revoked sessions.

---

## Authorization Security

This section supplements `user-permissions.md` with security enforcement details.

### Company Scoping Enforcement

Every company-scoped request is validated:

1. Extract `companyId` from URL path parameter.
2. Verify the authenticated user is an ACTIVE member of that company.
3. If not a member: return `404 Not Found` (not 403, to prevent enumeration).
4. If member: attach the user's role and permissions to the request context.

### Row-Level Security via Prisma Middleware

```typescript
import { Prisma } from '@prisma/client';

// Prisma middleware that injects companyId filtering
prisma.$use(async (params, next) => {
  const companyId = getCompanyIdFromContext(); // From AsyncLocalStorage

  if (!companyId) return next(params);

  const companyModels = [
    'Shareholder', 'ShareClass', 'Shareholding', 'Transaction',
    'FundingRound', 'OptionPlan', 'OptionGrant', 'Document',
    'AuditLog', // read-only scoping
  ];

  if (companyModels.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, companyId };
    }
    if (params.action === 'create') {
      params.args.data = { ...params.args.data, companyId };
    }
    if (params.action === 'update' || params.action === 'delete') {
      params.args.where = { ...params.args.where, companyId };
    }
  }

  return next(params);
});
```

### Permission Denial Logging

All permission denials are logged with:
- User ID, requested resource, required permission, user's actual role
- Logged at `warn` level (not `error` — this is expected behavior)
- Repeated denials from the same user (>10 in 5 minutes) trigger a WARNING alert

---

## Secret Management

### Environment Variables

All secrets are stored as environment variables. No secrets in the codebase.

| Secret | Service | Env Variable | Rotation |
|--------|---------|-------------|----------|
| Privy App ID | Privy | `PRIVY_APP_ID` | Never (identifier) |
| Privy App Secret | Privy | `PRIVY_APP_SECRET` | Annually |
| Verifik API Token | Verifik | `VERIFIK_API_TOKEN` | Annually |
| AWS Access Key ID | AWS | `AWS_ACCESS_KEY_ID` | 90 days |
| AWS Secret Access Key | AWS | `AWS_SECRET_ACCESS_KEY` | 90 days |
| AWS KMS Key ARN | AWS KMS | `AWS_KMS_KEY_ARN` | Auto-rotated by AWS |
| Blind Index Key | App | `BLIND_INDEX_KEY` | Never (would invalidate indexes) |
| Database URL | PostgreSQL | `DATABASE_URL` | On credential rotation |
| Redis URL | Redis | `REDIS_URL` | On credential rotation |
| Sentry DSN | Sentry | `SENTRY_DSN` | Never (identifier) |

### Rules

- Never commit secrets to Git. Use `.env.example` with placeholder values.
- Never log secrets. The PII redaction utility (see `error-handling.md`) strips all known secret field names.
- Never expose secrets to the frontend. Only `NEXT_PUBLIC_*` variables are available client-side.
- Use platform-managed secrets (Railway, Vercel) for production. No `.env` files on servers.

### Secret Rotation Procedure

1. Generate the new secret in the service provider (AWS IAM, Privy dashboard, Verifik dashboard).
2. Update the environment variable in Railway/Vercel.
3. Trigger a deployment to pick up the new value.
4. Verify the service is working with the new secret.
5. Revoke the old secret in the service provider.
6. Log the rotation event in the audit log.

### CI/CD Secret Scanning

GitHub Actions runs secret scanning on every push:
- GitHub native secret scanning (enabled on the repository)
- `gitleaks` in CI pipeline to catch accidental commits
- Pre-commit hook via Husky runs a local secret scan

---

## File Upload Security

### Allowed File Types

| Context | Allowed Types | Max Size |
|---------|--------------|----------|
| KYC documents | PDF, PNG, JPG, JPEG | 10 MB |
| KYC selfie | PNG, JPG, JPEG | 5 MB |
| Side letters | PDF | 10 MB |
| Company logo | PNG, JPG, JPEG, SVG | 2 MB |

### Validation Steps

1. **MIME type check**: Validate `Content-Type` header matches allowed types.
2. **Magic bytes check**: Read the first bytes of the file to confirm actual file type matches extension. Do not trust the file extension alone.
3. **File size check**: Reject before reading the full body if `Content-Length` exceeds the limit.
4. **Filename sanitization**: Strip special characters, path traversal sequences, and limit length.
5. **Virus scanning**: Scan with ClamAV (self-hosted) before persisting to S3. Quarantine infected files.

### S3 Storage Security

```typescript
// S3 bucket policy: no public access
const bucketPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'DenyPublicAccess',
      Effect: 'Deny',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: 'arn:aws:s3:::navia-documents/*',
      Condition: {
        Bool: { 'aws:SecureTransport': 'false' },
      },
    },
  ],
};
```

- All S3 buckets have `BlockPublicAccess` enabled.
- Documents are accessed via **pre-signed URLs** with 15-minute expiry.
- KYC documents use a separate bucket with SSE-KMS encryption.
- S3 access logging is enabled for the KYC bucket.

### Metadata Stripping

EXIF data is stripped from all uploaded images before storage:

```typescript
import sharp from 'sharp';

async function stripMetadata(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Apply EXIF rotation before stripping
    .withMetadata({}) // Remove all metadata
    .toBuffer();
}
```

---

## Data Breach Incident Response

### Severity Classification

| Level | Definition | Examples | Response Time |
|-------|-----------|----------|--------------|
| **P1 — Critical** | Confirmed data exfiltration or unauthorized access to PII | Database breach, S3 bucket exposed, admin account compromised | Immediate containment. ANPD notification within 72 hours. User notification within 72 hours. |
| **P2 — High** | Unauthorized access detected, no confirmed exfiltration | Suspicious login patterns, unauthorized API access, privilege escalation attempt | Internal investigation within 24 hours. ANPD notification if PII was accessed. |
| **P3 — Medium** | Vulnerability discovered that could lead to a breach | Unpatched CVE, misconfigured security header, exposed debug endpoint | Patch within 48 hours. No external notification. |
| **P4 — Low** | Security misconfiguration with no immediate risk | Missing rate limit on non-sensitive endpoint, verbose error message | Fix in next release cycle. |

### Incident Response Procedure

#### Phase 1: Detection and Containment (0–4 hours)

1. **Detect**: Incident identified via Sentry alert, log analysis, user report, or automated monitoring.
2. **Classify**: Assign severity level (P1–P4).
3. **Contain**: For P1/P2:
   - Revoke compromised credentials immediately.
   - Block suspicious IP addresses.
   - Disable affected user accounts if necessary.
   - Isolate affected systems (e.g., rotate database credentials).
4. **Preserve evidence**: Snapshot logs, database state, and network activity before remediation.

#### Phase 2: Assessment (4–24 hours)

1. **Scope**: Determine what data was accessed/exfiltrated.
2. **Impact**: Identify affected users and data categories.
3. **Root cause**: Identify the vulnerability or vector.
4. **Document**: Record all findings in an incident report.

#### Phase 3: Notification (Within 72 hours for P1)

**ANPD Notification** (required by LGPD Art. 48):
- What happened (description of the incident)
- What data was affected (categories)
- Who was affected (number of data subjects)
- What measures were taken (containment and remediation)
- Contact information for the Data Protection Officer (DPO)
- Recommendations for affected users

**User Notification** (required for P1):
- Plain language description of the incident
- What data of theirs may have been affected
- Steps they should take (e.g., monitor accounts)
- Contact information for questions
- Sent via email in both PT-BR and EN

#### Phase 4: Remediation (24–72 hours)

1. **Fix**: Patch the vulnerability.
2. **Verify**: Confirm the fix addresses the root cause.
3. **Deploy**: Roll out the fix to production.
4. **Monitor**: Enhanced monitoring for 30 days post-incident.

#### Phase 5: Post-Mortem (Within 7 days)

1. **Timeline**: Detailed timeline of events.
2. **Root cause analysis**: Why the incident occurred.
3. **Lessons learned**: What could prevent similar incidents.
4. **Action items**: Specific improvements with owners and deadlines.
5. **Share**: Distribute post-mortem to the team (redacted of sensitive details).

---

## Platform Security Guidelines

### Vercel (Frontend)

| Feature | Configuration |
|---------|--------------|
| HTTPS | Automatic SSL. Force HTTPS redirect. |
| DDoS protection | Built-in via Vercel Edge Network. |
| Environment variables | Use Vercel dashboard. Never commit to Git. |
| Serverless functions | Not used. Frontend is static + client-side only. |
| Headers | Set security headers via `next.config.js` `headers()` function. |

### Railway (Backend)

| Feature | Configuration |
|---------|--------------|
| HTTPS | Automatic SSL on custom domains. |
| Database | Private networking. No public exposure. Access via internal Railway URL. |
| Redis | Private networking. No public exposure. |
| Environment variables | Use Railway dashboard. |
| Deployments | From GitHub. No direct SSH access. |
| Logging | Railway built-in logs. Forward to Sentry for errors. |

### AWS (S3, SES, KMS)

| Feature | Configuration |
|---------|--------------|
| IAM | Least-privilege IAM user for the backend. No root access. |
| S3 | BlockPublicAccess on all buckets. SSE-S3 default, SSE-KMS for KYC. |
| SES | Verified domain identity. DKIM and SPF configured. |
| KMS | Customer-managed key for KYC encryption. Auto-rotation enabled. |
| Region | `sa-east-1` (São Paulo) for all services. |
| CloudTrail | Enabled for S3 and KMS API calls. |

#### IAM Policy (Least Privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3DocumentAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::navia-documents",
        "arn:aws:s3:::navia-documents/*",
        "arn:aws:s3:::navia-kyc",
        "arn:aws:s3:::navia-kyc/*"
      ]
    },
    {
      "Sid": "SESEmailSending",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "arn:aws:ses:sa-east-1:*:identity/navia.com.br"
    },
    {
      "Sid": "KMSEncryption",
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:sa-east-1:*:key/<kms-key-id>"
    }
  ]
}
```

---

## Dependency Security

### Automated Vulnerability Scanning

- **GitHub Dependabot**: Enabled for both frontend and backend. Automatically creates PRs for vulnerable dependencies.
- **npm audit**: Run in CI pipeline on every build. Build fails on `critical` or `high` severity vulnerabilities.
- **Snyk** (optional): For deeper dependency analysis.

### Dependency Update Policy

| Severity | Response Time | Action |
|----------|-------------|--------|
| Critical CVE | 24 hours | Patch immediately, emergency deploy |
| High CVE | 48 hours | Patch and deploy in next release |
| Medium CVE | 1 week | Include in next planned release |
| Low CVE | Next sprint | Batch with other updates |

### Rules

- Pin exact versions in `package.json` (no `^` or `~` in production).
- Review `package-lock.json` changes in PRs.
- Limit direct dependencies. Prefer well-maintained packages with active security response.
- Audit new dependencies before adding: check npm download stats, GitHub activity, known vulnerabilities.

---

## NestJS Implementation

### Helmet Integration

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: false, // CSP set by frontend (Next.js)
    crossOriginEmbedderPolicy: false, // Breaks Privy iframe
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
    dnsPrefetchControl: { allow: false },
  }),
);
```

### Security Module

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { CsrfMiddleware } from './middleware/csrf.middleware';

@Module({})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('*');

    consumer
      .apply(CsrfMiddleware)
      .forRoutes('*');
  }
}
```

### Encryption Service

```typescript
import { Injectable } from '@nestjs/common';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

@Injectable()
export class EncryptionService {
  private kms: KMSClient;
  private keyId: string;

  constructor() {
    this.kms = new KMSClient({ region: 'sa-east-1' });
    this.keyId = process.env.AWS_KMS_KEY_ARN;
  }

  async encrypt(plaintext: string): Promise<Buffer> {
    const command = new EncryptCommand({
      KeyId: this.keyId,
      Plaintext: Buffer.from(plaintext),
    });
    const response = await this.kms.send(command);
    return Buffer.from(response.CiphertextBlob);
  }

  async decrypt(ciphertext: Buffer): Promise<string> {
    const command = new DecryptCommand({
      CiphertextBlob: ciphertext,
    });
    const response = await this.kms.send(command);
    return Buffer.from(response.Plaintext).toString();
  }
}
```

---

## Success Criteria

- [ ] All LGPD data subject rights endpoints implemented and tested
- [ ] Consent records created for every consent event
- [ ] Application-level encryption active for CPF, bank details, and KYC document URLs
- [ ] Blind index enables CPF search without decryption
- [ ] All security headers present on every response (verified by securityheaders.com score A+)
- [ ] CORS restricts origins to Vercel frontend URL only in production
- [ ] CSRF token validated on all state-changing requests
- [ ] No raw SQL queries in codebase (Prisma parameterized only)
- [ ] All file uploads scanned for malware before S3 persistence
- [ ] EXIF metadata stripped from all uploaded images
- [ ] All secrets stored in environment variables, none in codebase
- [ ] `gitleaks` runs in CI and blocks commits with secrets
- [ ] Dependabot enabled and critical CVEs patched within 24 hours
- [ ] Incident response plan documented and team trained
- [ ] AWS IAM follows least-privilege principle
- [ ] S3 buckets have BlockPublicAccess enabled
- [ ] Pre-signed URLs used for all document access (15-minute expiry)
- [ ] Data deletion anonymizes PII after 30-day grace period
- [ ] Audit logs retained for 5 years minimum
