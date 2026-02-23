# User Permissions Specification

**Topic of Concern**: Role-based access control (RBAC)

**One-Sentence Description**: The system enforces role-based permissions determining what actions users can perform based on their assigned role within a company, with optional fine-grained overrides per member.

---

## Table of Contents

1. [Overview](#overview)
2. [Roles](#roles)
3. [Functional Requirements](#functional-requirements)
4. [Data Models](#data-models)
5. [Permission Matrix](#permission-matrix)
6. [Fine-Grained Permission Overrides](#fine-grained-permission-overrides)
7. [API Endpoints](#api-endpoints)
8. [Business Rules](#business-rules)
9. [NestJS Guard Implementation](#nestjs-guard-implementation)
10. [Permission Resolution Service](#permission-resolution-service)
11. [Error Handling](#error-handling)
12. [Edge Cases](#edge-cases)
13. [Security Considerations](#security-considerations)
14. [Dependencies](#dependencies)
15. [Success Criteria](#success-criteria)
16. [Related Specifications](#related-specifications)

---

## Overview

Navia uses role-based access control (RBAC) to manage user permissions. Each user has exactly one role per company, and each role grants specific permissions. The system enforces permissions at the API level using NestJS guards.

Key characteristics:

- **Company-scoped**: Roles are assigned per company. A user can be ADMIN in one company and INVESTOR in another.
- **Single role per company**: Each CompanyMember record has exactly one role. No multi-role assignment.
- **Override-capable**: Fine-grained permission overrides on the CompanyMember record can grant or restrict individual permissions beyond the role default.
- **Backend-enforced**: The backend always validates permissions. The frontend hides UI elements as a convenience but is never trusted.

---

## Roles

### Admin

- Full access to all features within the company
- Can manage shareholders, transactions, and the cap table
- Can create/edit documents and manage templates
- Can confirm option exercise payments
- Can manage other users' roles and permissions
- Can view audit logs and export reports

### Finance

- View and edit cap table
- Create and approve transactions
- Generate and export financial reports
- View funding rounds and commitments
- View option plans and grants (no creation)
- Cannot manage users, legal documents, or audit logs

### Legal

- View cap table (read-only)
- Manage documents and templates (create, edit, upload)
- Request and track signatures
- View audit logs (full access, same as Admin)
- Cannot create transactions or manage users

### Investor

- View own shareholdings (read-only)
- View company cap table (if permitted by shareholder agreement)
- View own funding round commitments
- Download own reports and documents they signed
- Cannot edit anything

### Employee

- View own option grants and vesting schedule (read-only)
- Request option exercises
- View own documents (grant letters, exercise confirmations)
- Cannot view full cap table or other shareholders' data

---

## Functional Requirements

### FR-1: Company-Specific Roles

- User can have different roles in different companies
- Each CompanyMember record has exactly one role
- Role assignment is per-company, not global

### FR-2: Permission Checking

- All API endpoints protected by role guards and/or permission guards
- Frontend hides UI elements based on permissions (convenience only)
- Backend always enforces permissions (never trust frontend)
- Permission checks happen after authentication but before business logic

### FR-3: Role Management

- Admin can assign/remove roles via member management endpoints
- Admin cannot remove or demote the last ADMIN in a company (prevents lockout)
- Admin cannot modify their own role (prevents self-demotion)
- All role changes are captured in the audit log (`COMPANY_ROLE_CHANGED`)

### FR-4: Permission Overrides

- Admin can set fine-grained permission overrides on any CompanyMember
- Overrides can grant permissions not included in the role default
- Overrides can restrict permissions that the role default would allow
- Override changes are captured in the audit log (`PERMISSION_CHANGED`)

---

## Data Models

> **Note**: The role and permissions entity is the **CompanyMember** table defined in `company-management.md`. CompanyMember is a merged entity that combines role, permissions, and invitation workflow in one table.

```typescript
// See company-management.md for the full CompanyMember entity definition.
// Key fields relevant to permissions:
interface CompanyMember {
  id: string;
  companyId: string;
  userId: string | null;               // null for pending invitations
  email: string;
  role: 'ADMIN' | 'FINANCE' | 'LEGAL' | 'INVESTOR' | 'EMPLOYEE';

  // Fine-grained permission overrides (JSONB column)
  // null means "use role defaults only, no overrides"
  permissions: Record<string, boolean> | null;

  status: 'PENDING' | 'ACTIVE' | 'REMOVED';
  invitedBy: string;                   // User ID who assigned this role
  invitedAt: Date;
  acceptedAt: Date | null;
}
```

### Permission Key Format

Permission keys use the pattern `resource:action`:

```typescript
type PermissionKey =
  | 'capTable:read'
  | 'capTable:write'
  | 'capTable:export'
  | 'shareholders:read'
  | 'shareholders:create'
  | 'shareholders:edit'
  | 'shareholders:delete'
  | 'transactions:read'
  | 'transactions:create'
  | 'transactions:approve'
  | 'documents:read'
  | 'documents:create'
  | 'documents:sign'
  | 'users:manage'
  | 'reports:view'
  | 'reports:export'
  | 'auditLogs:view'
  | 'auditLogs:export'
  | 'fundingRounds:read'
  | 'fundingRounds:create'
  | 'fundingRounds:close'
  | 'fundingRounds:cancel'
  | 'convertibles:read'
  | 'convertibles:create'
  | 'convertibles:convert'
  | 'optionPlans:read'
  | 'optionPlans:create'
  | 'optionPlans:modify'
  | 'optionGrants:read'
  | 'optionGrants:create'
  | 'optionGrants:approveExercise'
  | 'companySettings:read'
  | 'companySettings:modify'
  | 'capTableSnapshots:read'
  | 'capTableSnapshots:export';
```

---

## Permission Matrix

The following matrix defines the default permissions for each role. Rows marked with footnotes have conditional access.

| Resource / Action | Admin | Finance | Legal | Investor | Employee |
|---|---|---|---|---|---|
| **Cap Table** | | | | | |
| View cap table | Yes | Yes | Yes | Yes* | No |
| Edit cap table | Yes | Yes | No | No | No |
| Export cap table | Yes | Yes | No | No | No |
| **Cap Table Snapshots** | | | | | |
| View snapshots | Yes | Yes | Yes | No | No |
| Export snapshots | Yes | Yes | No | No | No |
| **Shareholders** | | | | | |
| View shareholders | Yes | Yes | Yes | No | No |
| Create shareholder | Yes | No | No | No | No |
| Edit shareholder | Yes | No | No | No | No |
| Delete shareholder | Yes | No | No | No | No |
| **Transactions** | | | | | |
| View transactions | Yes | Yes | Yes | No | No |
| Create transaction | Yes | Yes | No | No | No |
| Approve transaction | Yes | Yes | No | No | No |
| **Funding Rounds** | | | | | |
| View funding rounds | Yes | Yes | Yes | Yes** | No |
| Create funding round | Yes | Yes | No | No | No |
| Close funding round | Yes | Yes | No | No | No |
| Cancel funding round | Yes | No | No | No | No |
| **Convertible Instruments** | | | | | |
| View convertibles | Yes | Yes | Yes | Yes** | No |
| Create convertible | Yes | Yes | No | No | No |
| Convert convertible | Yes | Yes | No | No | No |
| **Option Plans** | | | | | |
| View option plans | Yes | Yes | No | No | No |
| Create option plan | Yes | No | No | No | No |
| Modify option plan | Yes | No | No | No | No |
| **Option Grants** | | | | | |
| View option grants | Yes | Yes | No | No | Yes*** |
| Create option grant | Yes | No | No | No | No |
| Approve exercise | Yes | Yes | No | No | No |
| **Documents** | | | | | |
| View documents | Yes | Yes | Yes | Yes**** | Yes**** |
| Create documents | Yes | No | Yes | No | No |
| Sign documents | Yes | Yes | Yes | Yes | Yes |
| **Audit Logs** | | | | | |
| View audit logs | Yes | No | Yes | No | No |
| Export audit logs | Yes | No | Yes | No | No |
| **Reports** | | | | | |
| View reports | Yes | Yes | Yes | No | No |
| Export reports | Yes | Yes | No | No | No |
| **Company Settings** | | | | | |
| View settings | Yes | Yes | Yes | No | No |
| Modify settings | Yes | No | No | No | No |
| **User Management** | | | | | |
| Manage members | Yes | No | No | No | No |

**Footnotes:**

\* Investor can view cap table only if permitted by their shareholder agreement.
\** Investor can view only funding rounds and convertibles related to their own commitments.
\*** Employee can view only their own option grants and vesting schedule.
\**** Investor and Employee can view only documents they are a signer on.

---

## Fine-Grained Permission Overrides

### How Overrides Work

The `permissions` JSON field on CompanyMember allows Admins to override any individual permission for a specific member. This provides flexibility without creating custom roles.

### Override Format

```json
{
  "shareholders:create": true,
  "transactions:approve": false
}
```

- Keys are permission keys from the `PermissionKey` type.
- Values are booleans: `true` grants the permission, `false` denies it.
- Only overridden permissions need to be present. Missing keys fall back to the role default.

### Resolution Order

Permission resolution follows a strict priority:

1. **Check override**: If the permission key exists in the member's `permissions` JSON, use that value.
2. **Check role default**: If no override exists, use the default from the permission matrix above.

```
resolved = override[key] ?? roleDefault[key] ?? false
```

### Example Scenarios

**Scenario 1: Finance user needs to create shareholders**

The FINANCE role does not include `shareholders:create` by default. An Admin sets:

```json
{ "shareholders:create": true }
```

Now this Finance member can create shareholders while retaining all other Finance defaults.

**Scenario 2: Admin user should not approve transactions**

A company wants one Admin to handle setup but not approve transactions (segregation of duties):

```json
{ "transactions:approve": false }
```

This Admin can still do everything else but cannot approve transactions.

**Scenario 3: Legal user needs report export access**

```json
{ "reports:export": true }
```

The Legal member gains export capability while keeping all other Legal defaults.

### Constraints

- Only ADMIN members can set overrides on other members.
- Overrides cannot grant `users:manage` to non-ADMIN roles (this is a protected permission).
- Setting `permissions` to `null` clears all overrides and reverts to role defaults.
- Override changes are audit-logged as `PERMISSION_CHANGED` events.

---

## API Endpoints

> **Note**: Role management is handled through the CompanyMember endpoints defined in `company-management.md`. The primary endpoints are:

### POST /api/v1/companies/:companyId/members/invite

Invite a user and assign a role (creates a PENDING CompanyMember).

### PUT /api/v1/companies/:companyId/members/:memberId

Update a member's role or permissions. Request body:

```json
{
  "role": "FINANCE",
  "permissions": {
    "shareholders:create": true
  }
}
```

### DELETE /api/v1/companies/:companyId/members/:memberId

Remove a member (sets status to REMOVED). Returns `422` with `COMPANY_LAST_ADMIN` if this is the only Admin.

### GET /api/v1/companies/:companyId/members

List all members and their roles in the company. Returns the role and resolved permissions for each member.

### GET /api/v1/companies/:companyId/members/:memberId/permissions

Returns the fully resolved permission set for a specific member (role defaults merged with overrides).

---

## Business Rules

### BR-1: Admin Protection

- Cannot remove the last ADMIN from a company (`COMPANY_LAST_ADMIN` error)
- Cannot demote the last ADMIN to another role
- Admin cannot modify their own role (prevents accidental self-demotion)

### BR-2: Self-Assignment

- Users cannot assign roles to themselves
- Must be assigned by an existing ADMIN

### BR-3: Investor Auto-Role

- When a shareholder is added and they have an existing user account, auto-assign the INVESTOR role
- If the user already has a higher role (ADMIN, FINANCE, LEGAL), do not downgrade

### BR-4: Protected Permissions

- The `users:manage` permission cannot be granted via overrides to non-ADMIN roles
- This ensures only Admins can manage company membership

### BR-5: Role Change Immediacy

- Role and permission changes take effect immediately on the next API request
- No caching of resolved permissions between requests
- Active sessions are not invalidated, but the next permission check uses the updated role

---

## NestJS Guard Implementation

### @Roles() Decorator

Declares which roles are allowed to access a controller method:

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### RolesGuard

Checks the authenticated user's role against the required roles:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role restriction
    }

    const request = context.switchToHttp().getRequest();
    const member = request.companyMember; // Set by CompanyScopeGuard

    if (!member) return false;

    return requiredRoles.includes(member.role);
  }
}
```

### @RequirePermission() Decorator

For fine-grained permission checks that account for overrides:

```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
```

### PermissionGuard

Resolves the effective permission considering role defaults and overrides:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionService } from './permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const member = request.companyMember;

    if (!member) return false;

    return this.permissionService.hasPermission(
      member.role,
      member.permissions,
      requiredPermission,
    );
  }
}
```

### Controller Usage Example

```typescript
@Controller('api/v1/companies/:companyId/shareholders')
@RequireAuth()
@UseGuards(CompanyScopeGuard)
export class ShareholderController {
  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  async list(@Param('companyId') companyId: string) {
    // Role check via RolesGuard
  }

  @Post()
  @RequirePermission('shareholders:create')
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateShareholderDto,
  ) {
    // Fine-grained check via PermissionGuard
    // Allows ADMIN by default, or any role with override
  }
}
```

---

## Permission Resolution Service

```typescript
import { Injectable } from '@nestjs/common';

// Default permission matrix — derived from the Permission Matrix table above.
// Each role maps to its set of granted permissions. Unlisted keys default to false.
// Full matrix: ADMIN has all permissions, others as defined in the table.
const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  ADMIN: {
    // All permissions set to true (all PermissionKey values)
    'capTable:read': true, 'capTable:write': true, 'capTable:export': true,
    'shareholders:read': true, 'shareholders:create': true, /* ... all true */
    'users:manage': true, // Protected: only ADMIN has this by default
  },
  FINANCE: {
    'capTable:read': true, 'capTable:write': true, 'capTable:export': true,
    'transactions:read': true, 'transactions:create': true,
    'transactions:approve': true, 'reports:view': true, 'reports:export': true,
    // See Permission Matrix for complete list
  },
  LEGAL: {
    'capTable:read': true, 'documents:read': true, 'documents:create': true,
    'auditLogs:view': true, 'auditLogs:export': true, 'reports:view': true,
    // See Permission Matrix for complete list
  },
  INVESTOR: { 'documents:sign': true },
  EMPLOYEE: { 'documents:sign': true },
};

// Protected permissions that cannot be granted via overrides
const PROTECTED_PERMISSIONS = ['users:manage'];

@Injectable()
export class PermissionService {
  /**
   * Resolves whether a member has a specific permission.
   * Priority: override > role default > false.
   */
  hasPermission(
    role: string,
    overrides: Record<string, boolean> | null,
    permission: string,
  ): boolean {
    // Check override first
    if (overrides && permission in overrides) {
      return overrides[permission];
    }

    // Fall back to role default
    const defaults = ROLE_DEFAULTS[role] || {};
    return defaults[permission] ?? false;
  }

  /**
   * Returns the full resolved permission set for a member.
   * Used by the GET /members/:id/permissions endpoint.
   */
  resolveAll(
    role: string,
    overrides: Record<string, boolean> | null,
  ): Record<string, boolean> {
    const defaults = ROLE_DEFAULTS[role] || {};
    return { ...defaults, ...overrides };
  }

  /**
   * Validates that an override payload does not grant protected permissions
   * to non-ADMIN roles.
   */
  validateOverrides(
    role: string,
    overrides: Record<string, boolean>,
  ): string[] {
    const errors: string[] = [];
    if (role !== 'ADMIN') {
      for (const key of PROTECTED_PERMISSIONS) {
        if (overrides[key] === true) {
          errors.push(`Cannot grant '${key}' to ${role} role via override`);
        }
      }
    }
    return errors;
  }
}
```

---

## Error Handling

Permission-related operations use the standard error envelope defined in `api-standards.md`.

### Relevant Error Codes

| HTTP Status | Error Code | When Triggered |
|---|---|---|
| 401 | `AUTH_INVALID_TOKEN` | Missing or invalid JWT. User is not authenticated. |
| 401 | `AUTH_TOKEN_EXPIRED` | JWT has expired. User must re-authenticate. |
| 403 | (standard HTTP) | User is authenticated but lacks the required role or permission. No specific error code; use the standard 403 response. |
| 404 | `COMPANY_NOT_FOUND` | Company does not exist or user is not a member. Returns 404 instead of 403 to prevent enumeration. |
| 422 | `COMPANY_LAST_ADMIN` | Cannot remove or demote the only ADMIN in a company. |
| 422 | `COMPANY_MEMBER_NOT_FOUND` | Target member does not exist in this company. |

### 403 Response Format

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FORBIDDEN",
    "message": "Você não tem permissão para realizar esta ação",
    "messageKey": "errors.auth.forbidden"
  }
}
```

### 422 Response for Last Admin

```json
{
  "success": false,
  "error": {
    "code": "COMPANY_LAST_ADMIN",
    "message": "Não é possível remover ou rebaixar o único administrador",
    "messageKey": "errors.company.lastAdmin"
  }
}
```

---

## Edge Cases

### EC-1: Cross-Company Role Isolation

A user is ADMIN in Company A but INVESTOR in Company B. When they access Company B's API endpoints, they must only have INVESTOR permissions. The `CompanyScopeGuard` extracts the `companyId` from the URL, looks up the user's membership for that specific company, and attaches the correct role to the request context.

### EC-2: Last Admin Demotion or Removal

When an Admin attempts to remove or demote another Admin, the system counts remaining ACTIVE members with `role = 'ADMIN'` in that company. If the count would drop to zero, the operation is rejected with `COMPANY_LAST_ADMIN` (HTTP 422). This check also applies to self-removal requests.

### EC-3: Override Grants More Than Role Default

A FINANCE member receives `{ "shareholders:create": true }` via override. The `PermissionGuard` resolves this correctly because overrides take priority over role defaults. The `@RequirePermission('shareholders:create')` check will pass even though FINANCE does not include this permission by default.

### EC-4: User Removed Mid-Session

If a user is removed from a company (`status = 'REMOVED'`) while they have an active session, their next API request to that company will fail. The `CompanyScopeGuard` checks membership status on every request and rejects REMOVED members with a 404 (preventing company enumeration). No session invalidation is needed because permissions are checked per-request.

### EC-5: Role Change Immediate Effect

When an Admin changes a member's role from FINANCE to INVESTOR, the change is persisted immediately. The member's very next API request will be evaluated against INVESTOR permissions. There is no permission caching layer. The `CompanyScopeGuard` fetches the member record from the database on each request.

---

## Security Considerations

### Enumeration Prevention

When a user requests a company-scoped resource and they are not a member of that company, the API returns `404 Not Found` rather than `403 Forbidden`. This prevents attackers from discovering valid company IDs by probing the API. See `security.md` for the full company scoping enforcement flow.

### Permission Denial Logging

All permission denials are logged at `warn` level with the following context:

- User ID
- Requested resource and action
- Required permission or role
- User's actual role and overrides
- Company ID

Repeated denials from the same user (>10 in 5 minutes) trigger a WARNING alert to Slack, as this may indicate a compromised account or unauthorized access attempt.

### Row-Level Security

Company-scoped queries are filtered via Prisma middleware that injects `companyId` into all queries. This ensures that even if a guard is misconfigured, data from other companies cannot be returned. See `security.md` for the Prisma middleware implementation.

### Token Verification

Every request verifies the Privy JWT independently. Permission results are never cached across requests. This ensures that role changes, member removal, and account locks take effect immediately.

---

## Dependencies

| Dependency | Purpose |
|---|---|
| `authentication.md` | JWT verification and session management (runs before permission checks) |
| `company-management.md` | CompanyMember entity definition, invitation workflow, member CRUD endpoints |
| `security.md` | Company scoping enforcement, row-level security, permission denial logging |
| `error-handling.md` | Error codes (`COMPANY_LAST_ADMIN`, `AUTH_INVALID_TOKEN`), standard error envelope |
| `api-standards.md` | Response format, HTTP status codes, rate limiting |
| `audit-logging.md` | `COMPANY_ROLE_CHANGED` and `PERMISSION_CHANGED` audit events |

---

## Success Criteria

- [ ] All API endpoints enforce role-based or permission-based access control
- [ ] Zero unauthorized access incidents in production
- [ ] Permission checks execute in <5ms per request (no external calls)
- [ ] Fine-grained overrides resolve correctly (override > role default > false)
- [ ] `users:manage` cannot be granted to non-ADMIN roles via overrides
- [ ] Last ADMIN protection prevents removal and demotion (returns `COMPANY_LAST_ADMIN`)
- [ ] Role changes take effect immediately on the next API request
- [ ] Non-members receive 404 (not 403) for company-scoped requests
- [ ] All role changes and permission overrides are audit-logged
- [ ] Permission denial logging fires for all rejected requests
- [ ] Repeated denial alerts trigger at >10 denials per user in 5 minutes
- [ ] Role assignment completes in <1 second

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-membership.md](./company-membership.md) | Roles are assigned per company membership; invitation flow assigns initial role |
| [company-management.md](./company-management.md) | Company-scoped authorization; all resource access gated by company membership |
| [authentication.md](./authentication.md) | Authentication precedes authorization; Privy JWT verification provides user identity |
| [shareholder-registry.md](./shareholder-registry.md) | Permission matrix defines which roles can view/create/edit/delete shareholders |
| [cap-table-management.md](./cap-table-management.md) | View and export permissions for cap table data are role-based |
| [reports-analytics.md](./reports-analytics.md) | Report access is restricted by role: ADMIN, FINANCE, LEGAL have different access levels |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, HTTP status codes (403 Forbidden, 404 for non-members) |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: COMPANY_LAST_ADMIN; permission denial handling and logging |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: COMPANY_ROLE_CHANGED, PERMISSION_CHANGED |
| [security.md](../.claude/rules/security.md) | Authorization enforcement, company scoping, row-level security via Prisma middleware |
