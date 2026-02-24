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
import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { AppException } from '../common/exceptions/app.exception';

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

    if (!member || !requiredRoles.includes(member.role)) {
      throw new AppException(
        'AUTH_FORBIDDEN',
        'errors.auth.forbidden',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
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
import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './require-permission.decorator';
import { PermissionService } from './permission.service';
import { AppException } from '../common/exceptions/app.exception';

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

    if (!member) {
      throw new AppException(
        'AUTH_FORBIDDEN',
        'errors.auth.forbidden',
        HttpStatus.FORBIDDEN,
      );
    }

    const hasPermission = this.permissionService.hasPermission(
      member.role,
      member.permissions,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new AppException(
        'AUTH_FORBIDDEN',
        'errors.auth.forbidden',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
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
import { ValidationError } from '../common/types';

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
   * to non-ADMIN roles. Returns validation errors with messageKeys for i18n.
   */
  validateOverrides(
    role: string,
    overrides: Record<string, boolean>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    if (role !== 'ADMIN') {
      for (const key of PROTECTED_PERMISSIONS) {
        if (overrides[key] === true) {
          errors.push({
            field: `permissions.${key}`,
            message: `Cannot grant '${key}' to ${role} role via override`,
            messageKey: 'errors.permission.protectedOverride',
          });
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
| 401 | `AUTH_INVALID_TOKEN` | Missing or invalid JWT. User is not authenticated. Uses `messageKey: errors.auth.invalidToken`. |
| 401 | `AUTH_TOKEN_EXPIRED` | JWT has expired. User must re-authenticate. Uses `messageKey: errors.auth.tokenExpired`. |
| 403 | `AUTH_FORBIDDEN` | User is authenticated but lacks the required role or permission. Uses `messageKey: errors.auth.forbidden`. |
| 404 | `COMPANY_NOT_FOUND` | Company does not exist or user is not a member. Uses `messageKey: errors.company.notFound`. Returns 404 instead of 403 to prevent enumeration. |
| 422 | `COMPANY_LAST_ADMIN` | Cannot remove or demote the only ADMIN in a company. Uses `messageKey: errors.company.lastAdmin`. |
| 404 | `COMPANY_MEMBER_NOT_FOUND` | Target member does not exist in this company. Uses `messageKey: errors.companyMember.notFound`. Returns 404 instead of 403 to prevent enumeration. |

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

---

# Frontend Specification

> Everything above this line describes backend RBAC enforcement. The sections below define how the frontend **consumes and enforces** permissions in the UI layer.
>
> **Core Principle**: Unauthorized elements are **completely hidden** (not disabled or grayed out). If a user lacks permission, the element does not render in the DOM at all.

---

## Table of Contents (Frontend)

17. [Frontend Architecture](#frontend-architecture)
18. [PermissionContext](#permissioncontext)
19. [usePermissions Hook](#usepermissions-hook)
20. [PermissionGate Component](#permissiongate-component)
21. [ProtectedRoute Component](#protectedroute-component)
22. [Navigation Filtering](#navigation-filtering)
23. [Frontend Permission Matrix](#frontend-permission-matrix)
24. [Frontend Permission Enforcement Patterns](#frontend-permission-enforcement-patterns)
25. [Frontend User Flows](#frontend-user-flows)
26. [UI States and Error Handling](#ui-states-and-error-handling)
27. [i18n Keys](#i18n-keys)
28. [Component Specifications](#component-specifications)
29. [Frontend Success Criteria](#frontend-success-criteria)

---

## Frontend Architecture

**No dedicated page routes** — permissions are enforced across all pages, not on a separate permissions page. There is no `/dashboard/permissions` route.

**Key design decisions**:
- **HIDDEN, not disabled**: Unauthorized UI elements are not rendered at all. No grayed-out buttons, no locked icons, no "you need permission" tooltips. If you cannot use it, you cannot see it.
- **Backend is the source of truth**: The frontend permission layer is a UX convenience. The backend always validates permissions independently on every request.
- **One company per user for MVP**: The permission context loads for the user's single active company. No company-switching logic is needed.
- **Permissions fetched once, refreshed on events**: The user's resolved permissions are fetched on initial load and cached in React context. They refresh on window refocus and when a role change notification is received.

**Component hierarchy**:
```
<AuthProvider>                          // from authentication.md
  <PermissionProvider companyId={id}>   // fetches role + permissions
    <DashboardLayout>                   // sidebar uses usePermissions()
      <ProtectedRoute permission="..."> // page-level guard
        <PageContent>                   // uses PermissionGate for element-level
        </PageContent>
      </ProtectedRoute>
    </DashboardLayout>
  </PermissionProvider>
</AuthProvider>
```

---

## PermissionContext

**File**: `frontend/src/contexts/permission-context.tsx`

React context that provides the authenticated user's role and resolved permissions for the current company.

### Context Shape

```typescript
interface PermissionContextValue {
  role: Role | null;
  permissions: string[];
  isLoading: boolean;
  error: Error | null;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: Role | Role[]) => boolean;
  canAccess: (resource: string, action: string) => boolean;
  refetch: () => Promise<void>;
}

type Role = 'ADMIN' | 'FINANCE' | 'LEGAL' | 'INVESTOR' | 'EMPLOYEE';
```

### Data Source

Fetches from: `GET /api/v1/companies/:companyId/members/me`

Response shape:
```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "userId": "user-uuid",
    "role": "FINANCE",
    "permissions": ["capTable:read", "capTable:write", "capTable:export", "transactions:read", "..."],
    "status": "ACTIVE"
  }
}
```

The `permissions` array contains the **fully resolved** permission set (role defaults merged with overrides, computed server-side).

### Provider Implementation

```typescript
import { createContext, useContext, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

interface PermissionProviderProps {
  companyId: string;
  children: React.ReactNode;
}

export function PermissionProvider({ companyId, children }: PermissionProviderProps) {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['member-permissions', companyId, user?.id],
    queryFn: () => api.get<MemberPermissionsResponse>(
      `/api/v1/companies/${companyId}/members/me`
    ),
    enabled: !!companyId && !!user?.id,
    staleTime: 5 * 60 * 1000,       // 5 minutes
    refetchOnWindowFocus: true,       // Refresh on tab focus
    retry: 2,
  });

  const role = data?.role ?? null;
  const permissions = data?.permissions ?? [];

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const hasRole = useCallback(
    (target: Role | Role[]) => {
      if (!role) return false;
      return Array.isArray(target) ? target.includes(role) : role === target;
    },
    [role],
  );

  const canAccess = useCallback(
    (resource: string, action: string) => hasPermission(`${resource}:${action}`),
    [hasPermission],
  );

  const value = useMemo<PermissionContextValue>(
    () => ({
      role,
      permissions,
      isLoading,
      error: error as Error | null,
      hasPermission,
      hasRole,
      canAccess,
      refetch,
    }),
    [role, permissions, isLoading, error, hasPermission, hasRole, canAccess, refetch],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return context;
}
```

### Refresh Triggers

| Trigger | Mechanism |
|---------|-----------|
| Initial page load | TanStack Query `queryFn` executes on mount |
| Window refocus (tab switch back) | `refetchOnWindowFocus: true` |
| Role change notification | Call `refetch()` from notification handler |
| Manual refresh | Call `refetch()` from any component |

### Error Behavior

When the permissions fetch fails:
- `isLoading` becomes `false`, `error` is set
- `role` is `null`, `permissions` is `[]`
- All `hasPermission()` calls return `false` (most restrictive fallback)
- An error toast is shown: `errors.auth.permissionLoadFailed`
- The user sees a degraded UI where no gated content appears

---

## usePermissions Hook

**File**: `frontend/src/hooks/use-permissions.ts`

Convenience hook that wraps `usePermissionContext()`. Components use this instead of consuming the context directly.

```typescript
import { usePermissionContext } from '@/contexts/permission-context';

export interface UsePermissionsReturn {
  role: Role | null;
  permissions: string[];
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: Role | Role[]) => boolean;
  canAccess: (resource: string, action: string) => boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { role, permissions, isLoading, hasPermission, hasRole, canAccess } =
    usePermissionContext();

  return { role, permissions, isLoading, hasPermission, hasRole, canAccess };
}
```

### Usage Examples

```tsx
// Check a specific permission
const { hasPermission } = usePermissions();
if (hasPermission('shareholders:create')) { /* show create button */ }

// Check by role
const { hasRole } = usePermissions();
if (hasRole(['ADMIN', 'FINANCE'])) { /* show finance section */ }

// Resource + action shorthand
const { canAccess } = usePermissions();
if (canAccess('capTable', 'export')) { /* show export button */ }
```

---

## PermissionGate Component

**File**: `frontend/src/components/auth/permission-gate.tsx`

Wrapper component that conditionally renders children based on the user's permissions.

### Props

```typescript
interface PermissionGateProps {
  /** Permission key to check (e.g., 'shareholders:create') */
  permission?: string;
  /** Alternative: check by role instead of specific permission */
  role?: Role | Role[];
  /** Optional fallback when permission denied (defaults to null — hidden) */
  fallback?: React.ReactNode;
  /** Content to render when permission is granted */
  children: React.ReactNode;
}
```

### Implementation

```tsx
import { usePermissions } from '@/hooks/use-permissions';

export function PermissionGate({
  permission,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasRole, isLoading } = usePermissions();

  // While permissions are loading, render nothing (prevents flash of unauthorized content)
  if (isLoading) return null;

  // Check permission if provided
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check role if provided
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  // If neither permission nor role is specified, always render
  if (!permission && !role) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
```

### Behavior

| Scenario | Renders |
|----------|---------|
| `permission` provided, user has it | `children` |
| `permission` provided, user lacks it | `fallback` (default: `null` — nothing) |
| `role` provided, user matches | `children` |
| `role` provided, user does not match | `fallback` (default: `null` — nothing) |
| Neither `permission` nor `role` provided | `children` (always) |
| Permissions loading | `null` (nothing — prevents flash) |

### Usage

```tsx
// Hide a button for non-ADMIN users
<PermissionGate permission="shareholders:create">
  <Button>Adicionar Acionista</Button>
</PermissionGate>

// Gate by role with a custom fallback
<PermissionGate role={['ADMIN', 'FINANCE']} fallback={<ReadOnlyBanner />}>
  <EditableForm />
</PermissionGate>

// Multiple gates can be nested
<PermissionGate permission="transactions:read">
  <TransactionsTable />
  <PermissionGate permission="transactions:create">
    <Button>Nova Transacao</Button>
  </PermissionGate>
</PermissionGate>
```

---

## ProtectedRoute Component

**File**: `frontend/src/components/auth/protected-route.tsx`

Route-level permission guard that protects entire pages. Unlike `PermissionGate` (which silently hides elements), `ProtectedRoute` **redirects** unauthorized users and shows a toast.

### Props

```typescript
interface ProtectedRouteProps {
  /** Permission key required to access this page */
  permission?: string;
  /** Alternative: role required to access this page */
  role?: Role | Role[];
  /** Page content */
  children: React.ReactNode;
}
```

### Implementation

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

export function ProtectedRoute({
  permission,
  role,
  children,
}: ProtectedRouteProps) {
  const { hasPermission, hasRole, isLoading } = usePermissions();
  const router = useRouter();
  const t = useTranslations('permissions');

  const isAuthorized =
    (!permission || hasPermission(permission)) &&
    (!role || hasRole(role));

  useEffect(() => {
    if (!isLoading && !isAuthorized) {
      toast.error(t('noAccess'));
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthorized, router, t]);

  // Loading state: centered spinner on gray-50 background
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <Spinner className="h-5 w-5 text-ocean-600" />
      </div>
    );
  }

  // Unauthorized: render nothing (redirect is happening via useEffect)
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
```

### Behavior

| State | Visual | Action |
|-------|--------|--------|
| Loading | Centered spinner (ocean-600, 20px) on gray-50 background | Wait for permissions |
| Authorized | Renders `children` | None |
| Unauthorized | Nothing rendered | Redirect to `/dashboard` + error toast |

### Difference from PermissionGate

| Aspect | PermissionGate | ProtectedRoute |
|--------|---------------|----------------|
| Scope | Element-level (button, section) | Page-level (entire route) |
| Unauthorized behavior | Silently hides (renders `null`) | Redirects + toast notification |
| Loading behavior | Renders `null` | Shows spinner |
| Use case | Hiding buttons, columns, sections | Guarding `/dashboard/*` pages |

### Usage in Page Components

```tsx
// app/dashboard/shareholders/page.tsx
export default function ShareholdersPage() {
  return (
    <ProtectedRoute permission="shareholders:read">
      <ShareholdersContent />
    </ProtectedRoute>
  );
}

// app/dashboard/members/page.tsx
export default function MembersPage() {
  return (
    <ProtectedRoute permission="members:manage">
      <MembersContent />
    </ProtectedRoute>
  );
}
```

---

## Navigation Filtering

The sidebar navigation is filtered based on the user's role. Unauthorized items are **completely hidden** (not disabled, not grayed out).

### Navigation Configuration

```typescript
// frontend/src/config/navigation.ts
import {
  LayoutDashboard,
  PieChart,
  Users,
  ArrowLeftRight,
  TrendingUp,
  Target,
  FileText,
  UserPlus,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;           // i18n key
  href: string;
  icon: LucideIcon;
  permission: string;      // Permission required to see this item
}

export const navConfig: NavItem[] = [
  { label: 'dashboard.nav.dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
  { label: 'dashboard.nav.capTable', href: '/dashboard/cap-table', icon: PieChart, permission: 'capTable:read' },
  { label: 'dashboard.nav.shareholders', href: '/dashboard/shareholders', icon: Users, permission: 'shareholders:read' },
  { label: 'dashboard.nav.transactions', href: '/dashboard/transactions', icon: ArrowLeftRight, permission: 'transactions:read' },
  { label: 'dashboard.nav.investments', href: '/dashboard/investments', icon: TrendingUp, permission: 'fundingRounds:read' },
  { label: 'dashboard.nav.options', href: '/dashboard/options', icon: Target, permission: 'optionPlans:read' },
  { label: 'dashboard.nav.documents', href: '/dashboard/documents', icon: FileText, permission: 'documents:read' },
  { label: 'dashboard.nav.members', href: '/dashboard/members', icon: UserPlus, permission: 'members:manage' },
  { label: 'dashboard.nav.settings', href: '/dashboard/settings', icon: Settings, permission: 'settings:manage' },
];
```

### Visibility per Role

| Nav Item | Route | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|----------|-------|-------|---------|-------|----------|----------|
| Dashboard | `/dashboard` | Yes | Yes | Yes | Yes | Yes |
| Cap Table | `/dashboard/cap-table` | Yes | Yes | Yes | Yes (own holdings) | No |
| Shareholders | `/dashboard/shareholders` | Yes | Yes | Yes | No | No |
| Transactions | `/dashboard/transactions` | Yes | Yes | Yes | No | No |
| Investments | `/dashboard/investments` | Yes | Yes | Yes | Yes (own) | No |
| Options | `/dashboard/options` | Yes | Yes | No | No | Yes (own) |
| Documents | `/dashboard/documents` | Yes | Yes | Yes | Yes (own) | Yes (own) |
| Members | `/dashboard/members` | Yes | No | No | No | No |
| Settings | `/dashboard/settings` | Yes | No | No | No | No |

"Own" means the user can see the nav item but the backend filters results to only their own data. The frontend shows the navigation link; the backend enforces data scoping.

### Sidebar Filtering Implementation

```tsx
// In Sidebar component
import { navConfig } from '@/config/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslations } from 'next-intl';

function SidebarNav() {
  const { hasPermission } = usePermissions();
  const t = useTranslations();

  const visibleItems = navConfig.filter(item => hasPermission(item.permission));

  return (
    <nav>
      {visibleItems.map(item => (
        <NavItem key={item.href} {...item} label={t(item.label)} />
      ))}
    </nav>
  );
}
```

Sidebar visual styling follows design-system.md section 5.2:
- Active: navy-800 bg, white text, 3px ocean-600 left border
- Inactive: white/70% text, transparent background
- Hover: navy-950 bg, white/90% text
- No "locked" or "disabled" nav item style exists

---

## Frontend Permission Matrix

Complete mapping of frontend permission keys to roles. This mirrors the backend permission matrix but uses the frontend permission key format (`resource:action`) for UI gating.

| Permission | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|-----------|-------|---------|-------|----------|----------|
| `dashboard:read` | Yes | Yes | Yes | Yes | Yes |
| `capTable:read` | Yes | Yes | Yes | Own | No |
| `capTable:write` | Yes | Yes | No | No | No |
| `capTable:export` | Yes | Yes | No | No | No |
| `capTableSnapshots:read` | Yes | Yes | Yes | No | No |
| `capTableSnapshots:export` | Yes | Yes | No | No | No |
| `shareholders:read` | Yes | Yes | Yes | No | No |
| `shareholders:create` | Yes | No | No | No | No |
| `shareholders:edit` | Yes | No | No | No | No |
| `shareholders:delete` | Yes | No | No | No | No |
| `transactions:read` | Yes | Yes | Yes | No | No |
| `transactions:create` | Yes | Yes | No | No | No |
| `transactions:approve` | Yes | Yes | No | No | No |
| `fundingRounds:read` | Yes | Yes | Yes | Own | No |
| `fundingRounds:create` | Yes | Yes | No | No | No |
| `fundingRounds:close` | Yes | Yes | No | No | No |
| `fundingRounds:cancel` | Yes | No | No | No | No |
| `convertibles:read` | Yes | Yes | Yes | Own | No |
| `convertibles:create` | Yes | Yes | No | No | No |
| `convertibles:convert` | Yes | Yes | No | No | No |
| `optionPlans:read` | Yes | Yes | No | No | No |
| `optionPlans:create` | Yes | No | No | No | No |
| `optionPlans:modify` | Yes | No | No | No | No |
| `optionGrants:read` | Yes | Yes | No | No | Own |
| `optionGrants:create` | Yes | No | No | No | No |
| `optionGrants:approveExercise` | Yes | Yes | No | No | No |
| `documents:read` | Yes | Yes | Yes | Own | Own |
| `documents:create` | Yes | No | Yes | No | No |
| `documents:sign` | Yes | Yes | Yes | Yes | Yes |
| `auditLogs:read` | Yes | No | Yes | No | No |
| `auditLogs:export` | Yes | No | Yes | No | No |
| `reports:view` | Yes | Yes | Yes | No | No |
| `reports:export` | Yes | Yes | No | No | No |
| `companySettings:read` | Yes | Yes | Yes | No | No |
| `companySettings:modify` | Yes | No | No | No | No |
| `members:manage` | Yes | No | No | No | No |
| `members:read` | Yes | Yes | Yes | Yes | Yes |
| `settings:manage` | Yes | No | No | No | No |

**"Own" means**: The frontend shows the navigation item and page structure, but the backend filters query results to only return the user's own records. The frontend does not need to implement this filtering — it is enforced server-side.

---

## Frontend Permission Enforcement Patterns

Five standard patterns are used throughout the application. Every UI element that depends on permissions must use one of these patterns.

### Pattern 1: Hide Navigation Items

```tsx
// In Sidebar component
{navConfig.filter(item => hasPermission(item.permission)).map(item => (
  <NavItem key={item.href} {...item} />
))}
```

### Pattern 2: Hide Action Buttons

```tsx
// In ShareholdersPage toolbar
<PermissionGate permission="shareholders:create">
  <Button onClick={openCreateModal}>
    {t('shareholders.actions.add')}
  </Button>
</PermissionGate>
```

### Pattern 3: Protect Entire Pages

```tsx
// In page component
export default function ShareholdersPage() {
  return (
    <ProtectedRoute permission="shareholders:read">
      <ShareholdersContent />
    </ProtectedRoute>
  );
}
```

### Pattern 4: Conditional Table Columns

```tsx
// In table definition
const { hasPermission } = usePermissions();

const columns = [
  nameColumn,
  emailColumn,
  roleColumn,
  ...(hasPermission('shareholders:edit') ? [actionsColumn] : []),
];
```

### Pattern 5: Read-Only vs Editable Forms

```tsx
// In settings form
const { hasPermission } = usePermissions();
const isEditable = hasPermission('companySettings:modify');

<Input
  disabled={!isEditable}
  value={company.name}
  onChange={isEditable ? handleChange : undefined}
/>
```

**Note on Pattern 5**: This is the one exception to the "hidden, not disabled" rule. Settings pages where a user has `companySettings:read` but not `companySettings:modify` show the form in a read-only/disabled state. This is intentional because the user needs to see the current values even if they cannot edit them.

---

## Frontend User Flows

### Flow 1: Permission Check on Page Load

```
User navigates to any dashboard page
  |
  +-- [PermissionContext loaded] --> check route permission
  |     |
  |     +-- [has permission] --> render page content
  |     |     |
  |     |     +-- [within page] --> PermissionGate hides unauthorized elements
  |     |
  |     +-- [no permission] --> redirect to /dashboard
  |           +-- toast: "Voce nao tem acesso a esta pagina"
  |
  +-- [PermissionContext loading] --> show page skeleton / spinner
```

Step-by-step:

```
PRECONDITION: User is authenticated, PermissionProvider wraps dashboard layout
ACTOR: Any authenticated user
TRIGGER: Navigation to a /dashboard/* page

1. [Frontend] PermissionContext checks if permissions are loaded
   -> IF loading: show full-page skeleton (spinner centered, ocean-600)
2. [Frontend] ProtectedRoute evaluates hasPermission(routePermission)
   -> IF false: redirect to /dashboard + toast "Voce nao tem acesso a esta pagina"
3. [UI] Page content renders
4. [Frontend] Within page, PermissionGate components evaluate their permissions
5. [UI] Authorized elements render; unauthorized elements are completely absent from DOM
6. [Frontend] Table columns filtered by hasPermission() for action columns
7. [UI] User sees only the actions they are authorized to perform

POSTCONDITION: Page shows only authorized content
SIDE EFFECTS: None (read-only permission check, no audit log)
```

### Flow 2: Unauthorized Direct URL Access

```
User types URL directly or uses bookmark to a page they cannot access
  |
  +-- [e.g., EMPLOYEE navigates to /dashboard/members]
  |     |
  |     +-- [ProtectedRoute checks permission 'members:manage']
  |     |     |
  |     |     +-- [EMPLOYEE lacks 'members:manage'] --> redirect to /dashboard
  |     |           +-- toast: "Voce nao tem acesso a esta pagina"
  |     |
  |     +-- [permission granted] --> render page (normal flow)
```

Step-by-step:

```
PRECONDITION: User is authenticated with EMPLOYEE role
ACTOR: EMPLOYEE user
TRIGGER: Direct navigation to /dashboard/members (bookmark, typed URL, shared link)

1. [Frontend] Next.js App Router loads the members page component
2. [Frontend] ProtectedRoute evaluates hasPermission('members:manage')
3. [Frontend] EMPLOYEE does not have 'members:manage' -> isAuthorized = false
4. [Frontend] useEffect fires: router.replace('/dashboard')
5. [UI] Toast notification: "Voce nao tem acesso a esta pagina" (error variant)
6. [UI] User lands on /dashboard, which they can access

POSTCONDITION: User is on /dashboard; they never saw the members page content
SIDE EFFECTS: None on frontend. Backend would return 403/404 if an API call had been made.
```

### Flow 3: Role Change Takes Effect

```
Admin changes user X's role from FINANCE to INVESTOR
  |
  +-- [Backend updates role] --> X's permissions change server-side
  |     |
  |     +-- [X switches tabs / refocuses window]
  |     |     +-- [PermissionContext refetches GET /members/me]
  |     |     +-- [new role: INVESTOR with reduced permissions]
  |     |     +-- [sidebar re-filters: fewer nav items visible]
  |     |
  |     +-- [X is currently on /dashboard/shareholders (now unauthorized)]
  |           +-- [next navigation triggers ProtectedRoute check]
  |           +-- [redirect to /dashboard + toast]
  |
  +-- [X makes an API call before refetch]
        +-- [backend enforces new INVESTOR role]
        +-- [403/404 returned]
        +-- [frontend error handler shows toast]
```

Step-by-step:

```
PRECONDITION: Admin changes user X's role from FINANCE to INVESTOR
ACTOR: User X (affected), Admin (initiator)
TRIGGER: PUT /api/v1/companies/:companyId/members/:memberId { role: 'INVESTOR' }

1. [Backend] Updates X's role in database
2. [Admin UI] Toast: "Papel alterado com sucesso"
3. [User X Frontend] On next window refocus or page navigation:
   - PermissionContext refetches GET /api/v1/companies/:companyId/members/me
   - Returns new role: INVESTOR, reduced permissions array
4. [User X UI] Sidebar re-renders with filtered navConfig
   - Shareholders, Transactions, Options, Members, Settings: HIDDEN
   - Dashboard, Cap Table (own), Investments (own), Documents (own): VISIBLE
5. [User X] If currently on a now-unauthorized page (e.g., /dashboard/shareholders):
   - Page remains visible until next navigation (we do not force-redirect mid-session)
   - Next navigation triggers ProtectedRoute which redirects to /dashboard
6. [User X] If they make an API call before the frontend refetches:
   - Backend returns 403 AUTH_FORBIDDEN (or 404 for enumeration prevention)
   - Frontend error handler shows toast: "Voce nao tem permissao para acessar este recurso"

POSTCONDITION: User X sees INVESTOR-level navigation and content
SIDE EFFECTS: COMPANY_ROLE_CHANGED audit log (from the admin's action)
```

### Flow 4: Permission Override Applied

```
Admin grants 'shareholders:create' to FINANCE member Y
  |
  +-- [Backend updates Y's permissions JSON]
  |     |
  |     +-- [Y refocuses window / navigates]
  |     |     +-- [PermissionContext refetches]
  |     |     +-- [permissions array now includes 'shareholders:create']
  |     |
  |     +-- [Y visits /dashboard/shareholders]
  |           +-- [PermissionGate for 'shareholders:create' now passes]
  |           +-- ["Adicionar Acionista" button is now visible]
```

Step-by-step:

```
PRECONDITION: Admin sets override { "shareholders:create": true } on FINANCE member Y
ACTOR: Admin (initiator), User Y (affected)
TRIGGER: PUT /api/v1/companies/:companyId/members/:memberId { permissions: { "shareholders:create": true } }

1. [Backend] Updates Y's CompanyMember.permissions JSON
2. [Backend] Permission resolution: override['shareholders:create'] = true
3. [Admin UI] Toast: "Permissoes atualizadas com sucesso"
4. [User Y Frontend] On refetch:
   - GET /api/v1/companies/:companyId/members/me returns updated permissions array
   - Array now includes 'shareholders:create'
5. [User Y UI] On /dashboard/shareholders:
   - PermissionGate with permission="shareholders:create" evaluates to true
   - "Adicionar Acionista" button renders in the toolbar
6. [User Y] Clicks "Adicionar Acionista"
   - Backend validates: override grants 'shareholders:create' -> allowed
   - Shareholder creation proceeds normally

POSTCONDITION: FINANCE member Y can see and use the "Adicionar Acionista" button
SIDE EFFECTS: PERMISSION_CHANGED audit log (from admin's action)
```

---

## UI States and Error Handling

### PermissionContext States

| State | Visual | Behavior |
|-------|--------|----------|
| Loading | Full-page skeleton / spinner | All PermissionGates render `null`; ProtectedRoutes show spinner |
| Loaded | Normal rendering with permission filtering | `hasPermission()` evaluates against cached permissions array |
| Error | Fallback to most restrictive (all permissions denied) + error toast | Toast: `errors.auth.permissionLoadFailed`; sidebar shows only Dashboard |

### ProtectedRoute States

| State | Visual | Behavior |
|-------|--------|----------|
| Checking | Centered spinner (ocean-600, 20px) on gray-50 background | No content rendered yet |
| Authorized | Renders page content (`children`) | Normal page rendering |
| Unauthorized | Nothing rendered (blank) | Redirect to `/dashboard` + error toast |

### Error Code to UI Mapping

| Error Code | HTTP | Frontend Behavior |
|------------|------|-------------------|
| `AUTH_FORBIDDEN` | 403 | Redirect to /dashboard + toast: `errors.auth.forbidden` |
| `AUTH_INVALID_TOKEN` | 401 | Call `logout()`, redirect to `/login?expired=true` |
| `AUTH_TOKEN_EXPIRED` | 401 | Call `logout()`, redirect to `/login?expired=true` |
| `COMPANY_NOT_FOUND` | 404 | Same behavior as 403 (enumeration prevention) |
| `COMPANY_MEMBER_NOT_FOUND` | 404 | Same behavior as 403 (enumeration prevention) |

### TanStack Query Error Handling

```typescript
// In API client or query configuration
function handleApiError(error: ApiError) {
  if (error.statusCode === 401) {
    // Auth errors: logout and redirect
    logout();
    router.push('/login?expired=true');
    return;
  }

  if (error.statusCode === 403 || error.statusCode === 404) {
    // Permission errors: redirect to dashboard
    toast.error(t(error.messageKey));
    router.push('/dashboard');
    return;
  }

  // Other errors: show toast
  toast.error(t(error.messageKey));
}
```

TanStack Query retry policy for permission errors:
- **Do not retry** 401, 403, 404 (these are definitive)
- **Retry** 500, 502, 503 up to 2 times with exponential backoff

---

## i18n Keys

All user-facing strings for the permission system. These must be added to both `frontend/messages/pt-BR.json` and `frontend/messages/en.json`.

### Permission Messages

| Key | PT-BR | EN |
|-----|-------|-----|
| `permissions.noAccess` | Voce nao tem acesso a esta pagina | You don't have access to this page |
| `permissions.loading` | Verificando permissoes... | Checking permissions... |

### Error Messages

| Key | PT-BR | EN |
|-----|-------|-----|
| `errors.auth.forbidden` | Voce nao tem permissao para realizar esta acao | You don't have permission to perform this action |
| `errors.auth.insufficientPermissions` | Voce nao tem permissao para acessar este recurso | You don't have permission to access this resource |
| `errors.auth.permissionLoadFailed` | Erro ao carregar permissoes. Tente recarregar a pagina. | Failed to load permissions. Try refreshing the page. |

### Navigation Labels

| Key | PT-BR | EN |
|-----|-------|-----|
| `dashboard.nav.dashboard` | Dashboard | Dashboard |
| `dashboard.nav.capTable` | Cap Table | Cap Table |
| `dashboard.nav.shareholders` | Acionistas | Shareholders |
| `dashboard.nav.transactions` | Transacoes | Transactions |
| `dashboard.nav.investments` | Investimentos | Investments |
| `dashboard.nav.options` | Opcoes | Options |
| `dashboard.nav.documents` | Documentos | Documents |
| `dashboard.nav.members` | Membros | Members |
| `dashboard.nav.settings` | Configuracoes | Settings |

---

## Component Specifications

### PermissionGate — Visual Spec

- **No visual representation**: This is a logic-only wrapper component
- When permission denied: renders `null` (or optional `fallback`)
- No loading state of its own (relies on parent `PermissionContext` being loaded first)
- No border, background, padding, or any visual footprint
- When hidden: the element is completely absent from the DOM, not `display: none`

### Sidebar Navigation — Visual Spec

Per design-system.md section 5.2:

- Only `<NavItem>` elements the user has permission for are rendered
- Active state: `navy-800` bg, white text, 3px `ocean-600` left border accent
- Inactive state: transparent bg, white/70% text
- Hover state: `navy-950` bg, white/90% text
- **No "locked", "disabled", or "coming soon" indicators** — items simply do not appear
- Navigation items: 40px height, 12px horizontal padding, 8px border-radius, 6px icon-to-text gap

### ProtectedRoute — Visual Spec

- **Checking state**: Centered `<Spinner>` component
  - Color: `ocean-600` (#1B6B93)
  - Size: 20px
  - Container: `flex h-full items-center justify-center bg-gray-50`
- **Unauthorized state**: Nothing rendered (redirect is in progress)
  - No error page, no "access denied" screen — user is immediately redirected
- **Authorized state**: Renders children with no wrapper elements (fragment only)

### Permission Error Toast — Visual Spec

Per design-system.md section 6.7:

- Position: top-right, 16px from edges
- Container: white bg, shadow-lg, radius-lg
- Width: 360px
- Left border accent: 3px in destructive red (#DC2626)
- Icon: red warning icon (Lucide `ShieldAlert` or `Ban`)
- Text: `body` (14px), gray-700
- Auto-dismiss: persistent (error toasts do not auto-dismiss)
- Close button: ghost X button

---

## Frontend Success Criteria

- [ ] `PermissionContext` fetches and caches user permissions on dashboard load
- [ ] `PermissionContext` refreshes on window refocus and role change notifications
- [ ] `PermissionContext` error state falls back to most restrictive (deny all)
- [ ] `usePermissions()` hook provides `hasPermission()`, `hasRole()`, and `canAccess()`
- [ ] `PermissionGate` hides unauthorized elements (not disabled — completely absent from DOM)
- [ ] `PermissionGate` renders `null` while permissions are loading (no flash of unauthorized content)
- [ ] `ProtectedRoute` redirects unauthorized users to `/dashboard` with error toast
- [ ] `ProtectedRoute` shows spinner during permission check
- [ ] Sidebar navigation filters items based on user permissions
- [ ] ADMIN sees all 9 nav items; EMPLOYEE sees only Dashboard, Options, Documents
- [ ] Table action columns are conditionally rendered based on permissions
- [ ] Settings form is read-only for non-ADMIN users who have `companySettings:read`
- [ ] Direct URL access to unauthorized pages triggers redirect + toast
- [ ] Role change takes effect on next window refocus or navigation
- [ ] API 403/404 errors trigger redirect to `/dashboard` with error toast
- [ ] API 401 errors trigger logout + redirect to `/login?expired=true`
- [ ] All permission-related strings use i18n keys (no hardcoded strings)
- [ ] Both `pt-BR.json` and `en.json` contain all permission i18n keys
- [ ] Permission components have unit tests with 80%+ coverage
- [ ] PermissionGate, ProtectedRoute, and usePermissions are tested for all role variants
