# Company Membership Specification

**Topic of Concern**: Member invitation, acceptance, role management, and membership lifecycle

**One-Sentence Description**: The system manages company team membership through email-based invitations with token-based acceptance, role-based access control (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE), and enforcement of membership constraints including the last-admin rule and per-user company limits.

---

## Overview

Every company on Navia has a set of members, each assigned a role that determines their platform-level permissions. Members are added via email invitation and must accept before gaining access. The membership system supports both existing users (who log in and accept) and new users (who sign up through the invitation link and are auto-associated).

Key constraints:
- Every company must have at least one ADMIN at all times.
- A user can belong to at most **20 companies** (PENDING + ACTIVE memberships).
- Invitation tokens are single-use and expire after 7 days.
- Email match is NOT required for acceptance — any authenticated user with a valid token can accept (see RD-6 in `company-management.md`).

**Related specifications**:
- `company-management.md` — Company entity, lifecycle state machine, creation flow
- `user-permissions.md` — Role definitions and full permission matrix
- `authentication.md` — User entity, Privy JWT, embedded wallets
- `company-blockchain-admin.md` — On-chain ownership transfer when ADMIN role changes

---

## Table of Contents

1. [User Stories](#user-stories)
2. [Functional Requirements](#functional-requirements)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [User Flows](#user-flows)
6. [Business Rules](#business-rules)
7. [Edge Cases & Error Handling](#edge-cases--error-handling)
8. [Security Considerations](#security-considerations)
9. [Technical Implementation](#technical-implementation)
10. [Success Criteria](#success-criteria)

---

## User Stories

### US-1: Invite a Team Member
**As an** admin user
**I want to** invite team members by email with a specific role
**So that** they can access and collaborate on the company's cap table

### US-2: Accept Invitation (Existing Account)
**As a** user with an existing Navia account
**I want to** accept a company invitation via the link in my email
**So that** I can access the company's data with my assigned role

### US-3: Accept Invitation (New User)
**As a** person without a Navia account
**I want to** sign up through the invitation link and automatically join the company
**So that** I can access the company without a separate invitation step after registration

### US-4: Change a Member's Role
**As an** admin user
**I want to** change a team member's role within the company
**So that** their permissions match their current responsibilities

### US-5: Remove a Member
**As an** admin user
**I want to** remove a team member from the company
**So that** they can no longer access company data

---

## Functional Requirements

### FR-1: Member Invitation with Token-Based Acceptance
- System MUST allow ADMIN users to invite members by email address
- System MUST generate a cryptographically random invitation token (32 bytes, hex-encoded)
- System MUST create a `CompanyMember` record with status `PENDING` and the invited email
- System MUST send an invitation email via AWS SES with a signup/accept link containing the token
- If the invited email belongs to an existing user, the email links to login + auto-accept
- If the invited email does not belong to an existing user, the email links to signup + auto-accept
- Invitation tokens MUST expire after 7 days
- System MUST support re-sending an invitation (generates a new token, invalidates the old one)

### FR-2: Role-Based Membership
- System MUST support the following roles: `ADMIN`, `FINANCE`, `LEGAL`, `INVESTOR`, `EMPLOYEE`
- Role definitions and permission matrices are defined in `user-permissions.md`
- System MUST allow ADMIN users to change any member's role
- System MUST enforce that at least one ADMIN exists per company at all times
- System MUST allow a member to hold exactly one role per company (not multiple roles)
- System MUST support optional fine-grained permission overrides per member (JSON field)

### FR-3: Maximum Companies Per User
- A user can be a member of at most **20 companies** (PENDING + ACTIVE memberships)
- Company creation and invitation acceptance MUST check this limit
- REMOVED memberships do not count toward the limit
- Exceeding the limit returns `422 Unprocessable Entity` with error code `COMPANY_MEMBER_LIMIT_REACHED`

---

## Data Models

### CompanyMember Entity

```typescript
interface CompanyMember {
  id: string;                          // UUID, primary key
  companyId: string;                   // Foreign key to Company
  userId: string | null;               // Foreign key to User (null for pending invitations)
  email: string;                       // Invitation email (used for matching on acceptance)
  role: CompanyMemberRole;             // ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE

  // Optional fine-grained permission overrides
  permissions: {
    capTableRead?: boolean;
    capTableWrite?: boolean;
    transactionsCreate?: boolean;
    transactionsApprove?: boolean;
    documentsCreate?: boolean;
    documentsSign?: boolean;
    usersManage?: boolean;
    reportsView?: boolean;
    reportsExport?: boolean;
    auditView?: boolean;
  } | null;

  // Membership lifecycle
  status: CompanyMemberStatus;         // PENDING | ACTIVE | REMOVED

  // Invitation tracking
  invitedBy: string;                   // User ID of the inviter
  invitedAt: Date;                     // When invitation was sent
  acceptedAt: Date | null;             // When invitation was accepted
  removedAt: Date | null;              // When member was removed
  removedBy: string | null;            // User ID who removed the member

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

enum CompanyMemberRole {
  ADMIN = 'ADMIN',
  FINANCE = 'FINANCE',
  LEGAL = 'LEGAL',
  INVESTOR = 'INVESTOR',
  EMPLOYEE = 'EMPLOYEE',
}

enum CompanyMemberStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED',
}

// Unique constraints:
// - (companyId, userId) WHERE status = 'ACTIVE' — one active membership per user per company
// - (companyId, email) WHERE status = 'PENDING' — one pending invitation per email per company
```

### InvitationToken Entity

```typescript
interface InvitationToken {
  id: string;                          // UUID, primary key
  companyMemberId: string;             // Foreign key to CompanyMember
  token: string;                       // Cryptographic random token (32 bytes hex, unique)
  expiresAt: Date;                     // Token expiration (7 days from creation)
  usedAt: Date | null;                 // Set when token is used to accept invitation
  createdAt: Date;
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/members/invite
**Description**: Invite a new member by email. Creates a pending CompanyMember and sends an invitation email.

**Auth**: Required. User must be an active member of the company (`:companyId` in URL path). User must be ADMIN.

**Request**:
```json
{
  "email": "maria@example.com",
  "role": "FINANCE",
  "message": "Ola Maria, junte-se a nossa empresa para gerenciar o cap table."
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "member_abc123",
    "companyId": "comp_abc123",
    "email": "maria@example.com",
    "role": "FINANCE",
    "status": "PENDING",
    "invitedBy": "user_xyz789",
    "invitedAt": "2026-02-23T10:00:00Z",
    "expiresAt": "2026-03-02T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid email format or role
- `403 Forbidden` — User is not ADMIN
- `409 Conflict` — Email already has an active membership in this company
- `409 Conflict` — Email already has a pending invitation (use re-send instead)

---

### POST /api/v1/companies/:companyId/members/:memberId/resend-invitation
**Description**: Re-send an invitation email. Generates a new token and invalidates the old one.

**Auth**: Required. User must be an active member of the company (`:companyId` in URL path). User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "member_abc123",
    "email": "maria@example.com",
    "status": "PENDING",
    "newExpiresAt": "2026-03-02T11:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Member not found
- `422 Unprocessable Entity` — Member is not in PENDING status

---

### GET /api/v1/companies/:companyId/members
**Description**: List all members of a company, including pending invitations.

**Auth**: Required. User must be an active member of the company (`:companyId` in URL path).

**Query Parameters**:
- `status` (optional): Filter by member status (`PENDING`, `ACTIVE`, `REMOVED`)
- `role` (optional): Filter by role
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "member_001",
      "userId": "user_xyz789",
      "email": "admin@acme.com",
      "role": "ADMIN",
      "status": "ACTIVE",
      "user": {
        "id": "user_xyz789",
        "firstName": "Joao",
        "lastName": "Silva",
        "profilePictureUrl": "https://...",
        "walletAddress": "0x742d35..."
      },
      "invitedAt": "2026-02-23T10:00:00Z",
      "acceptedAt": "2026-02-23T10:00:00Z"
    },
    {
      "id": "member_002",
      "userId": null,
      "email": "maria@example.com",
      "role": "FINANCE",
      "status": "PENDING",
      "user": null,
      "invitedAt": "2026-02-23T10:30:00Z",
      "acceptedAt": null
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### PUT /api/v1/companies/:companyId/members/:memberId
**Description**: Update a member's role or permissions.

**Auth**: Required. User must be an active member of the company (`:companyId` in URL path). User must be ADMIN.

**Request**:
```json
{
  "role": "LEGAL",
  "permissions": {
    "documentsCreate": true,
    "reportsView": true
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "member_002",
    "role": "LEGAL",
    "permissions": {
      "documentsCreate": true,
      "reportsView": true
    },
    "updatedAt": "2026-02-23T12:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Member not found
- `422 Unprocessable Entity` — Cannot change role of the last ADMIN (see BR-1)

---

### DELETE /api/v1/companies/:companyId/members/:memberId
**Description**: Remove a member from the company. Sets member status to REMOVED.

**Auth**: Required. User must be an active member of the company (`:companyId` in URL path). User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "member_002",
    "status": "REMOVED",
    "removedAt": "2026-02-23T13:00:00Z",
    "removedBy": "user_xyz789"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Member not found
- `422 Unprocessable Entity` — Cannot remove the last ADMIN (see BR-1)
- `422 Unprocessable Entity` — Cannot remove self if last ADMIN

---

### GET /api/v1/invitations/:token
**Description**: Get invitation details. Public endpoint — no authentication required. Used by the invitation link to show company name and role before the user decides to accept.

**Auth**: None required.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "companyName": "Acme Tecnologia",
    "companyLogoUrl": "https://s3.amazonaws.com/navia/logos/acme.png",
    "role": "FINANCE",
    "invitedByName": "Joao Silva",
    "invitedAt": "2026-02-23T10:00:00Z",
    "expiresAt": "2026-03-02T10:00:00Z",
    "email": "maria@example.com",
    "hasExistingAccount": true
  }
}
```

**Error Responses**:
- `404 Not Found` — Token does not exist or has been used
- `410 Gone` — Token has expired

---

### POST /api/v1/invitations/:token/accept
**Description**: Accept an invitation. Associates the authenticated user with the pending CompanyMember record.

**Auth**: Required (user must be logged in). Any authenticated user with the token can accept (email match not required).

**Request**: No body required.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "memberId": "member_002",
    "companyId": "comp_abc123",
    "companyName": "Acme Tecnologia",
    "role": "FINANCE",
    "status": "ACTIVE",
    "acceptedAt": "2026-02-23T14:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized` — User not authenticated
- `404 Not Found` — Token does not exist or has been used
- `409 Conflict` — User is already an active member of this company
- `410 Gone` — Token has expired
- `422 Unprocessable Entity` — User has reached the 20-company membership limit

---

## User Flows

### Flow 1: Member Invitation

```
PRECONDITION: Company is ACTIVE, user is ADMIN

1. Admin navigates to "Team" -> "Invite Member"
2. Admin enters:
   - Invitee email
   - Role (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE)
   - Optional: personal message
3. Admin clicks "Send Invitation"
4. Frontend sends POST /api/v1/companies/:companyId/members/invite
5. Backend validates:
   - Email is not already an active member
   - Email does not have a pending invitation
   - Role is valid
6. Backend creates CompanyMember (status: PENDING, userId: null)
7. Backend generates InvitationToken (32 bytes hex, 7-day expiry)
8. Backend sends invitation email via AWS SES:
   - Subject: "Voce foi convidado para [Company Name] no Navia"
   - Body: Company name, role, personal message, accept link
   - Accept link: https://app.navia.com/invitations/{token}
9. Backend returns pending member record
10. Frontend shows "Invitation sent to maria@example.com"

--- Invitee with existing account ---
11. Invitee clicks link in email
12. Browser opens https://app.navia.com/invitations/{token}
13. Frontend calls GET /api/v1/invitations/{token}
14. Frontend displays: company name, role, invited by, "Accept Invitation" button
15. Invitee clicks "Accept Invitation"
16. If not logged in: Privy login modal appears -> invitee logs in
17. Frontend sends POST /api/v1/invitations/{token}/accept
18. Backend validates token validity (email match NOT required)
19. Backend updates CompanyMember: userId = invitee's ID, email = invitee's email, status = ACTIVE
20. Backend marks InvitationToken as used
21. Frontend redirects to company dashboard

--- Invitee without account ---
11. Invitee clicks link in email
12. Browser opens https://app.navia.com/invitations/{token}
13. Frontend calls GET /api/v1/invitations/{token} (hasExistingAccount: false)
14. Frontend displays: company info, "Sign up to join" button
15. Invitee clicks "Sign up to join"
16. Privy signup modal appears -> invitee creates account (email/Google/Apple)
17. Backend creates User record (via auth login flow)
18. Frontend automatically calls POST /api/v1/invitations/{token}/accept
19. Backend associates new user with CompanyMember
20. Frontend redirects to KYC flow (if required) or company dashboard

POSTCONDITION: New member has ACTIVE status, can access company data per role
```

---

## Business Rules

### BR-1: Minimum One ADMIN Per Company
- Every company MUST have at least one member with ADMIN role at all times
- An ADMIN cannot remove their own ADMIN role if they are the last ADMIN
- An ADMIN cannot be removed from the company if they are the last ADMIN
- An ADMIN cannot change their own role to non-ADMIN if they are the last ADMIN

### BR-2: Admin Self-Protection
- An ADMIN can remove other ADMINs only if at least one ADMIN remains
- System MUST check the admin count before processing any role change or removal

### BR-3: Invitation Token Expiry
- Invitation tokens expire after 7 days from creation
- Expired tokens return `410 Gone` when accessed
- Expired invitations can be re-sent by an ADMIN (generates a new token)

### BR-4: Duplicate Invitation Prevention
- If an email already has a PENDING invitation for the same company, a new invite is rejected
- The ADMIN must re-send the existing invitation or cancel it first
- If an email already has an ACTIVE membership, the invitation is rejected with `409 Conflict`

### BR-5: Company Creator Auto-Assignment
- The user who creates a company is automatically assigned the ADMIN role
- A CompanyMember record with status `ACTIVE` is created during company creation
- The creator's `invitedBy` field references their own user ID

### BR-6: Invitation Email Mismatch — ALLOWED
- Users CAN accept an invitation with a different email than it was sent to
- This supports the common case where an invitee signs up with their preferred email (e.g., personal vs work email) or forwards the invitation to a colleague
- The acceptance endpoint does NOT check email match — any authenticated user with a valid token can accept
- The CompanyMember record is updated with the accepting user's ID and email
- An audit log entry records the original invitation email and the accepting user's email for traceability

---

## Edge Cases & Error Handling

### EC-1: Invitation Sent to Email Already a Member
**Scenario**: Admin tries to invite maria@example.com, but she is already an ACTIVE member.
**Handling**:
- Backend returns `409 Conflict` with error code `COMPANY_MEMBER_EXISTS` and messageKey `errors.company.memberExists`
- Frontend resolves the messageKey to display the localized error message
- Admin can update the existing member's role instead

### EC-2: User Tries to Accept Expired Invitation
**Scenario**: User clicks invitation link after 7-day expiry.
**Handling**:
- GET /api/v1/invitations/:token returns `410 Gone` with error code `COMPANY_INVITATION_EXPIRED` and messageKey `errors.company.invitationExpired`
- Frontend resolves the messageKey to display the localized expiration message
- Provides company name and admin email for convenience

### EC-3: Last ADMIN Tries to Leave Company
**Scenario**: The only ADMIN tries to change their role or remove themselves.
**Handling**:
- Backend returns `422 Unprocessable Entity` with error code `COMPANY_LAST_ADMIN` and messageKey `errors.company.lastAdmin`
- Frontend resolves the messageKey to display the localized error message
- Frontend disables the role change / remove button for the last admin

### EC-4: Concurrent Invitations to Same Email
**Scenario**: Two admins simultaneously try to invite the same email.
**Handling**:
- Database unique constraint on (companyId, email) WHERE status = 'PENDING' prevents duplicate
- Second request fails with `409 Conflict` with error code `COMPANY_INVITATION_PENDING` and messageKey `errors.company.invitationPending`
- Frontend resolves the messageKey to display the localized error message

### EC-5: User Accepts Invitation With Different Email
**Scenario**: User logs in with a different email than the invitation was sent to (e.g., invitation sent to work email, user signs up with personal email).
**Handling**:
- Acceptance is allowed — email match is NOT required (see BR-6)
- Backend updates CompanyMember with the accepting user's ID and actual email
- Audit log records both the original invitation email and the accepting user's email
- If the accepting user is already an active member, returns `409 Conflict`

---

## Security Considerations

### SEC-1: Invitation Token Security
- Tokens MUST be generated using `crypto.randomBytes(32)` (256-bit entropy)
- Tokens MUST be single-use (marked as used after acceptance)
- Tokens MUST expire after 7 days
- Token lookup MUST use constant-time comparison to prevent timing attacks
- Expired and used tokens MUST be retained for audit trail (not deleted)

### SEC-2: Admin Role Security
- Admin role changes MUST be audit-logged with before/after state
- Only existing ADMIN members can assign or change roles
- The last ADMIN constraint MUST be enforced at the database level (not just application level)
- Consider adding a database trigger or constraint for additional safety

### SEC-3: Invitation Email Security
- Invitation emails MUST NOT contain sensitive company data beyond name and role
- The invitation link domain MUST match the platform domain
- Emails MUST use SPF, DKIM, and DMARC to prevent spoofing
- Rate limit invitation sending to prevent abuse (max 50 invitations per company per day)

---

## Technical Implementation

### CompanyMemberService — Invitation Flow

```typescript
// /backend/src/company/company-member.service.ts
import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { randomBytes } from 'crypto';
import {
  AppException,
  ConflictException,
  BusinessRuleException,
  NotFoundException,
} from '../common/exceptions/app.exception';

@Injectable()
export class CompanyMemberService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async invite(companyId: string, inviterId: string, dto: InviteMemberDto) {
    // Check for existing active member
    const existingActive = await this.prisma.companyMember.findFirst({
      where: { companyId, email: dto.email, status: 'ACTIVE' },
    });
    if (existingActive) {
      throw new ConflictException(
        'COMPANY_MEMBER_EXISTS',
        'errors.company.memberExists',
        { email: dto.email },
      );
    }

    // Check for existing pending invitation
    const existingPending = await this.prisma.companyMember.findFirst({
      where: { companyId, email: dto.email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException(
        'COMPANY_INVITATION_PENDING',
        'errors.company.invitationPending',
        { email: dto.email },
      );
    }

    // Create member + invitation token in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.companyMember.create({
        data: {
          companyId,
          email: dto.email,
          role: dto.role,
          status: 'PENDING',
          invitedBy: inviterId,
          invitedAt: new Date(),
        },
      });

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await tx.invitationToken.create({
        data: {
          companyMemberId: member.id,
          token,
          expiresAt,
        },
      });

      return { member, token, expiresAt };
    });

    // Send invitation email
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });

    await this.emailService.sendInvitation({
      to: dto.email,
      companyName: company.name,
      role: dto.role,
      inviterName: await this.getInviterName(inviterId),
      token: result.token,
      message: dto.message,
    });

    return result.member;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token },
      include: { companyMember: true },
    });

    if (!invitation || invitation.usedAt) {
      throw new NotFoundException('invitation', token);
    }

    if (invitation.expiresAt < new Date()) {
      throw new AppException(
        'COMPANY_INVITATION_EXPIRED',
        'errors.company.invitationExpired',
        HttpStatus.GONE,
      );
    }

    // Check user is not already an active member
    const existingMember = await this.prisma.companyMember.findFirst({
      where: {
        companyId: invitation.companyMember.companyId,
        userId,
        status: 'ACTIVE',
      },
    });
    if (existingMember) {
      throw new ConflictException(
        'COMPANY_MEMBER_EXISTS',
        'errors.company.memberExists',
      );
    }

    // Check 20-company membership limit
    const membershipCount = await this.prisma.companyMember.count({
      where: { userId, status: { in: ['PENDING', 'ACTIVE'] } },
    });
    if (membershipCount >= 20) {
      throw new BusinessRuleException(
        'COMPANY_MEMBER_LIMIT_REACHED',
        'errors.company.memberLimitReached',
        { limit: 20, current: membershipCount },
      );
    }

    // Accept invitation (email match NOT required)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.companyMember.update({
        where: { id: invitation.companyMemberId },
        data: {
          userId,
          email: user.email, // Update to accepting user's actual email
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });

      await tx.invitationToken.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
    });
  }
}
```

---

## Success Criteria

### Performance
- Member invitation (email sent): < 5 seconds
- Invitation acceptance: < 1 second

### Accuracy
- Zero orphan companies (every company has at least one ADMIN)

### User Experience
- Invitation acceptance: < 3 clicks

---

## Dependencies

### Internal Dependencies
- **company-management.md**: Company entity and lifecycle — membership is scoped to a company
- **user-permissions.md**: Role definitions (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE) and permission matrix
- **authentication.md**: User entity with email and walletAddress fields
- **company-blockchain-admin.md**: On-chain ownership transfer triggered by ADMIN role transfer
- **notifications.md**: Email templates for invitations and member notifications

### External Dependencies
- **AWS SES**: Invitation emails and status notification emails
  - Region: sa-east-1 (Sao Paulo)
  - Templates: company_invitation

---

## Related Specifications

*Cross-references to be completed in Phase 5 of the spec alignment project.*

---

## Frontend Architecture

### Page Routes

| Route | Auth | Layout | Description |
|-------|------|--------|-------------|
| `/dashboard/members` | Required (ADMIN only) | Dashboard shell | Members list page |
| `/invitations/:token` | Public (view), Required (accept) | Auth layout (centered card) | Invitation acceptance page |

**Note**: One company per user for the MVP -- no company switcher is needed.

### Component Tree

```
MembersPage
  +-- PageHeader ("Membros" + "Convidar Membro" button)
  +-- MembersTable
  |     +-- RoleBadge (per row)
  |     +-- StatusBadge (per row)
  |     +-- RoleChangeDropdown (ADMIN only, per row)
  |     +-- ResendInvitationButton (PENDING rows only)
  |     +-- MemberRemoveConfirmation (triggered from actions)
  +-- InviteMemberModal (triggered from header button)

InvitationAcceptPage
  +-- InvitationExpiredPage (error state)
  +-- InvitationEmailMismatch (error state)
  +-- PersonalInfoForm (inline, for new users after Privy signup)
```

---

## Frontend Components

### 1. MembersPage

**File**: `app/(dashboard)/members/page.tsx`

**Description**: Main members list page. Only accessible by ADMIN users. Other roles are redirected to `/dashboard`.

**Layout**: Dashboard shell with full content width.

**Structure**:
- Page header: h1 "Membros" (`navy-900`) with "Convidar Membro" primary button (right-aligned, ADMIN only)
- Description: body-sm, `gray-500`, "Gerencie os membros e permissoes da sua empresa"
- Below header: `MembersTable` component

**Permission**: Route-level guard redirects non-ADMIN users to `/dashboard`.

**Data Fetching**: Uses TanStack Query to fetch `GET /api/v1/companies/:companyId/members`.

```typescript
// hooks/use-members.ts
import { useQuery } from '@tanstack/react-query';

export function useMembers(companyId: string, params?: {
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  search?: string;
  sort?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.role) query.set('role', params.role);
  if (params?.search) query.set('search', params.search);
  if (params?.sort) query.set('sort', params.sort);

  const path = `/api/v1/companies/${companyId}/members?${query}`;

  return useQuery({
    queryKey: ['members', companyId, params],
    queryFn: () => api.getList<CompanyMember>(path),
  });
}
```

---

### 2. MembersTable

**File**: `components/members/members-table.tsx`

**Description**: Data table displaying company members with inline actions.

**Columns**:

| Column | Content | Width | Alignment |
|--------|---------|-------|-----------|
| Nome | Avatar (32px circle) + full name (or email for PENDING) | flex | Left |
| E-mail | Member email | 200px | Left |
| Papel | `RoleBadge` component | 120px | Left |
| Status | `StatusBadge` component | 100px | Left |
| Data de Entrada | `acceptedAt` formatted as `dd/MM/yyyy` (Brazilian format) | 140px | Left |
| Acoes | Action buttons (ADMIN only) | 120px | Right |

**Actions Column** (ADMIN only, per row):
- `RoleChangeDropdown`: Triggered by clicking the `RoleBadge` in the role column. Not shown for the current user's own row.
- Remove button: Trash icon (ghost variant). Not shown for the current user's own row.
- `ResendInvitationButton`: Shown only for PENDING members.

**Visual Spec**:
- Container: white bg, `radius-lg` (12px), `1px solid gray-200`, overflow hidden
- Header row: `gray-50` bg, `gray-500` text, caption (12px), weight 500, uppercase
- Row: 52px height, body (14px), `gray-700`, `1px solid gray-100` bottom border
- Row hover: `gray-50` bg
- Numeric / date cells: `tabular-nums` font feature
- Pagination: standard pagination below table (20 items per page)

**States**:

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton rows (pulsing `gray-200` rectangles matching layout) | Initial load |
| Data | Populated table with pagination | Data loaded |
| Empty | Centered illustration + "Nenhum membro encontrado" + "Convide membros para colaborar na gestao da empresa" + "Convidar Membro" CTA button | No members found |
| Error | Error message + "Tentar novamente" retry button | API error |

---

### 3. InviteMemberModal

**File**: `components/members/invite-member-modal.tsx`

**Description**: Modal dialog for inviting a new member to the company. Triggered by the "Convidar Membro" button on MembersPage.

**Visual Spec**:
- Modal: medium size (560px max-width)
- Overlay: `navy-900` at 50% opacity
- Header: h3 "Convidar Membro" + X close button
- Body: 24px padding, 20px gap between fields
- Footer: `gray-100` bg strip, 16px padding, "Cancelar" (secondary) + "Enviar Convite" (primary) right-aligned

**Fields**:

| Field | Type | Label | Placeholder | Validation | Required |
|-------|------|-------|-------------|------------|----------|
| `email` | email input | E-mail do membro | nome@empresa.com | Valid email format | Yes |
| `role` | select dropdown | Papel | -- | Must be valid role enum | Yes (default: EMPLOYEE) |
| `message` | textarea (3 rows) | Mensagem (opcional) | Mensagem opcional para o convite | Max 500 characters | No |

**Role Dropdown Options** (each with description visible in dropdown):

| Value | Label (PT-BR) | Description (PT-BR) |
|-------|---------------|---------------------|
| `ADMIN` | Administrador | Acesso total a empresa e configuracoes |
| `FINANCE` | Financeiro | Gestao financeira e relatorios |
| `LEGAL` | Juridico | Documentos legais e compliance |
| `INVESTOR` | Investidor | Visualizacao de investimentos proprios |
| `EMPLOYEE` | Colaborador | Visualizacao de opcoes e documentos proprios |

**Submit**: `POST /api/v1/companies/:companyId/members/invite` with `{ email, role, message }`.

**Mutation**:

```typescript
// hooks/use-invite-member.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useInviteMember(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: string; message?: string }) =>
      api.post(`/api/v1/companies/${companyId}/members/invite`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', companyId] });
    },
  });
}
```

**States**:

| State | Visual | Trigger |
|-------|--------|---------|
| Idle | Form with empty fields (role defaults to EMPLOYEE) | Modal opens |
| Submitting | "Enviar Convite" button shows spinner, all fields disabled | Submit clicked |
| Success | Modal closes, success toast: "Convite enviado para {email}" | 201 response |
| Email Duplicate | Inline error on email field: "Este e-mail ja e membro da empresa" | 409 COMPANY_MEMBER_EXISTS |
| Pending Duplicate | Inline error on email field: "Ja existe um convite pendente para este e-mail" | 409 COMPANY_INVITATION_PENDING |
| Validation Error | Field-level error messages mapped from `validationErrors` | 400 VAL_INVALID_INPUT |
| Server Error | Error toast, form re-enabled | 500 |

---

### 4. RoleBadge

**File**: `components/members/role-badge.tsx`

**Description**: Colored pill badge displaying the member's role.

**Visual Spec**: Pill badge with `radius-full`, caption (12px), weight 500, padding `2px 8px`.

**Colors**:

| Role | Background | Text |
|------|-----------|------|
| ADMIN | `navy-100` (#D6E4F0) | `navy-700` (#134170) |
| FINANCE | `blue-50` (#EAF5FA) | `blue-600` (#1B6B93) |
| LEGAL | `green-100` (#E8F5E4) | `green-700` (#6BAF5E) |
| INVESTOR | `cream-100` (#FAF4E3) | `cream-700` (#C4A44E) |
| EMPLOYEE | `gray-100` (#F3F4F6) | `gray-600` (#4B5563) |

**Props**:

```typescript
interface RoleBadgeProps {
  role: 'ADMIN' | 'FINANCE' | 'LEGAL' | 'INVESTOR' | 'EMPLOYEE';
}
```

---

### 5. RoleChangeDropdown

**File**: `components/members/role-change-dropdown.tsx`

**Description**: Inline dropdown for changing a member's role. Only visible to ADMIN users. Triggered by clicking the `RoleBadge` in the table.

**Behavior**:
- Trigger: Clicking the `RoleBadge` in the table row (only when current user is ADMIN and target is not self)
- Dropdown shows all 5 roles with descriptions (same as InviteMemberModal role dropdown)
- On select: Confirmation dialog opens before submitting

**Confirmation Dialog**:
- Title: "Alterar Papel"
- Message: "Alterar o papel de {name} de {oldRole} para {newRole}?"
- Buttons: "Cancelar" (secondary) + "Confirmar" (primary)

**Submit**: `PUT /api/v1/companies/:companyId/members/:memberId` with `{ role }`.

**Constraints**:
- Cannot change own role (current user's row shows a static RoleBadge without dropdown trigger)
- Cannot demote the last ADMIN (backend enforces, frontend shows error toast)

**Mutation**:

```typescript
// hooks/use-update-member.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateMember(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { role?: string } }) =>
      api.put(`/api/v1/companies/${companyId}/members/${memberId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', companyId] });
    },
  });
}
```

---

### 6. MemberRemoveConfirmation

**File**: `components/members/member-remove-confirmation.tsx`

**Description**: Destructive confirmation dialog for removing a member from the company.

**Trigger**: Remove (trash icon) button in the actions column of MembersTable.

**Visual Spec**:
- Modal: small size (400px max-width)
- Overlay: `navy-900` at 50% opacity
- Icon: Destructive icon (red trash or warning icon)
- Title: h3 "Remover Membro"
- Message: body, `gray-600`, "Remover {name} da empresa? Esta acao nao pode ser desfeita."
- Buttons: "Cancelar" (secondary) + "Remover" (destructive variant, red)

**Constraints**:
- Cannot remove self (button hidden for current user's own row)
- Cannot remove last ADMIN (backend enforces with 422 COMPANY_LAST_ADMIN)

**Submit**: `DELETE /api/v1/companies/:companyId/members/:memberId`.

**Mutation**:

```typescript
// hooks/use-remove-member.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRemoveMember(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/api/v1/companies/${companyId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', companyId] });
    },
  });
}
```

---

### 7. ResendInvitationButton

**File**: `components/members/resend-invitation-button.tsx`

**Description**: Button to resend an invitation email for pending members.

**Visual Spec**:
- Button: ghost variant, "Reenviar convite" text
- Size: sm (32px height, 13px font)
- Only rendered for members with status `PENDING`

**Behavior**:
- On click: `POST /api/v1/companies/:companyId/members/:memberId/resend-invitation`
- On success: toast "Convite reenviado"
- After sending: button disabled for 60 seconds (local cooldown timer)
- Loading: button shows spinner while request is in flight

**Mutation**:

```typescript
// hooks/use-resend-invitation.ts
import { useMutation } from '@tanstack/react-query';

export function useResendInvitation(companyId: string) {
  return useMutation({
    mutationFn: (memberId: string) =>
      api.post(`/api/v1/companies/${companyId}/members/${memberId}/resend-invitation`, {}),
  });
}
```

---

### 8. InvitationAcceptPage

**File**: `app/(public)/invitations/[token]/page.tsx`

**Description**: Public invitation acceptance page. No auth required to view, auth required to accept.

**Layout**: Auth layout (centered card on `gray-50` background, no sidebar or top bar).

**Visual Spec**:
- Card: max-w 480px, white bg, `shadow-lg`, `radius-xl` (16px), padding 32px
- Company logo: 48px, centered (or placeholder circle with company initial on `blue-600` bg)
- Company name: h2, `navy-900`, centered
- Role: `RoleBadge`, centered below company name
- Invited by: body-sm, `gray-500`, centered, "Convidado por {name}"
- Divider: `1px solid gray-200`, margin-y 24px
- Action buttons: Primary variant, full width, size lg
- Alternative link: ghost text link below the primary button

**Flow**:

1. On mount: `GET /api/v1/invitations/:token` to validate token
2. Render based on token validity and auth state:

| Token State | Auth State | UI |
|-------------|-----------|-----|
| Valid | Not logged in | Company info + "Criar Conta" (primary) + "Ja tenho conta" (ghost link) |
| Valid | Logged in | Company info + "Aceitar Convite" (primary) |
| Valid, new user just signed up | Logged in, `isNew: true` | Company info + inline PersonalInfoForm |
| Expired | Any | `InvitationExpiredPage` |
| Invalid / not found | Any | `InvitationExpiredPage` |
| Email mismatch | Logged in | `InvitationEmailMismatch` |
| Already member | Logged in | "Voce ja e membro desta empresa" + "Ir para o Dashboard" link |

**PersonalInfoForm** (inline, for new users):
- Renders inside the invitation card after Privy signup completes
- Fields: firstName (required), lastName (required), email (pre-filled from Privy/invitation, editable)
- Submit button: "Continuar"
- On submit: `PUT /api/v1/users/me` then auto-accept invitation via `POST /api/v1/invitations/:token/accept`

**Query**:

```typescript
// hooks/use-invitation.ts
import { useQuery } from '@tanstack/react-query';

export function useInvitation(token: string) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get<InvitationDetails>(`/api/v1/invitations/${token}`),
    retry: false, // Don't retry 404/410 errors
  });
}

interface InvitationDetails {
  companyName: string;
  companyLogoUrl: string | null;
  role: string;
  invitedByName: string;
  invitedAt: string;
  expiresAt: string;
  email: string;
  hasExistingAccount: boolean;
}
```

**Accept Mutation**:

```typescript
// hooks/use-accept-invitation.ts
import { useMutation } from '@tanstack/react-query';

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) =>
      api.post<AcceptInvitationResponse>(`/api/v1/invitations/${token}/accept`, {}),
  });
}

interface AcceptInvitationResponse {
  memberId: string;
  companyId: string;
  companyName: string;
  role: string;
  status: string;
  acceptedAt: string;
}
```

---

### 9. InvitationExpiredPage

**File**: Rendered as a state within `InvitationAcceptPage` (not a separate route).

**Description**: Error state shown when the invitation token is expired or invalid.

**Visual Spec**:
- Same card layout as InvitationAcceptPage
- Icon: Warning icon (48px, `gray-400`)
- Title: h2, `navy-900`, "Convite Expirado"
- Message: body, `gray-500`, "Este convite expirou ou e invalido"
- CTA: body-sm, `gray-500`, "Solicite um novo convite ao administrador da empresa"

**Triggers**: `GET /api/v1/invitations/:token` returns 404 or 410.

---

### 10. InvitationEmailMismatch

**File**: Rendered as a state within `InvitationAcceptPage` (not a separate route).

**Description**: Error state shown when the logged-in user's email does not match the invitation email. Note: per BR-6 email match is NOT required for acceptance, but this state is shown as an informational warning if the backend returns a 403 for other reasons, or can be used for UX guidance.

**Visual Spec**:
- Same card layout as InvitationAcceptPage
- Icon: Info icon (48px, `blue-600`)
- Title: h2, `navy-900`, "E-mail Incorreto"
- Message: body, `gray-500`, "Este convite foi enviado para {masked-email}. Faca login com o e-mail correto."
- CTA button: Secondary variant, full width, "Sair e entrar com outro e-mail"
- CTA behavior: Triggers logout, then opens Privy login modal

---

## Frontend User Flows

### Flow 1: Invite Member (Admin)

```
ADMIN on /dashboard/members
  |
  +-- [clicks "Convidar Membro"] --> InviteMemberModal opens
  |     |
  |     +-- [fills email + role + optional message] --> submits
  |     |     |
  |     |     +-- [201 success] --> close modal + toast "Convite enviado" + refetch table
  |     |     +-- [409 COMPANY_MEMBER_EXISTS] --> inline error: "Este e-mail ja e membro da empresa"
  |     |     +-- [409 COMPANY_INVITATION_PENDING] --> inline error: "Ja existe um convite pendente"
  |     |     +-- [400 validation] --> field-level errors
  |     |     +-- [500 error] --> error toast
  |     |
  |     +-- [clicks Cancel or outside] --> modal closes, no action
```

**Step-by-step**:

```
PRECONDITION: User is ADMIN of company
ACTOR: ADMIN
TRIGGER: Clicks "Convidar Membro" button

1. [UI] InviteMemberModal opens with overlay (animation: fade in 200ms + slide up 250ms)
2. [UI] Modal shows: email input, role dropdown (default: EMPLOYEE), optional message textarea
3. [UI] Admin fills email address
4. [UI] Admin selects role from dropdown (sees descriptions for each role)
5. [UI] Admin optionally types invitation message (max 500 chars)
6. [UI] Admin clicks "Enviar Convite"
7. [Frontend] Client-side validation (email format, role required)
   -> IF invalid: show field-level errors, STOP
8. [Frontend] POST /api/v1/companies/:companyId/members/invite with { email, role, message }
9. [Backend] Checks if email is already a member or has pending invitation
   -> IF already active member: return 409 COMPANY_MEMBER_EXISTS
   -> IF pending invitation: return 409 COMPANY_INVITATION_PENDING
10. [Backend] Creates CompanyMember in PENDING status, generates InvitationToken, sends email
11. [Backend] Returns 201 { member: { id, email, role, status: 'PENDING', expiresAt } }
12. [UI] Modal closes (animation: reverse of open)
13. [UI] Success toast: "Convite enviado para {email}" (auto-dismiss 5 seconds)
14. [Frontend] MembersTable refetches via queryClient.invalidateQueries to show new PENDING member

POSTCONDITION: New PENDING member in table, invitation email sent
SIDE EFFECTS: Audit log (COMPANY_MEMBER_INVITED), invitation email via AWS SES
```

---

### Flow 2: Invited User -- New to Platform

```
New user receives invitation email
  |
  +-- [clicks invitation link] --> /invitations/:token
  |     |
  |     +-- [token valid] --> shows company info + role + "Criar Conta" button
  |     |     |
  |     |     +-- [clicks "Criar Conta"] --> Privy signup modal
  |     |     |     |
  |     |     |     +-- [Privy signup success] --> POST /api/v1/auth/login (sync)
  |     |     |     |     |
  |     |     |     |     +-- [new user created] --> show inline PersonalInfoForm
  |     |     |     |           |
  |     |     |     |           +-- [fills name + submits] --> PUT /api/v1/users/me
  |     |     |     |           |     |
  |     |     |     |           |     +-- [success] --> auto-accept invitation
  |     |     |     |           |           |
  |     |     |     |           |           +-- POST /api/v1/invitations/:token/accept
  |     |     |     |           |           +-- [success] --> redirect to /dashboard
  |     |     |     |           |           +-- [error] --> error toast
  |     |     |     |           |
  |     |     |     |           +-- [validation error] --> field errors
  |     |     |     |
  |     |     |     +-- [Privy signup fails] --> Privy handles error display
  |     |     |
  |     |     +-- [clicks "Ja tenho conta"] --> Privy login modal
  |     |           +-- (continues as existing user flow)
  |     |
  |     +-- [token expired] --> InvitationExpiredPage
  |     +-- [token invalid] --> InvitationExpiredPage
```

**Step-by-step**:

```
PRECONDITION: User has no Navia account
ACTOR: Invited user (new)
TRIGGER: Clicks invitation link in email

1. [UI] Browser navigates to /invitations/:token
2. [Frontend] InvitationAcceptPage mounts, shows centered loading spinner
3. [Frontend] GET /api/v1/invitations/:token
4. [Backend] Validates token, returns { companyName, companyLogoUrl, role, invitedByName, email, hasExistingAccount: false }
   -> IF invalid/expired: return 404 or 410
5. [UI] Card renders: company logo (48px), company name (h2), RoleBadge, "Convidado por {name}"
6. [UI] Divider, then "Criar Conta" primary button (full width, lg) + "Ja tenho conta" ghost link
7. [UI] User clicks "Criar Conta"
8. [Frontend] Opens Privy signup modal
9. [UI] User completes Privy signup (email + verification code, or social login)
10. [Frontend] POST /api/v1/auth/login to sync with backend
11. [Backend] Creates new user, returns { user, isNew: true }
12. [UI] InvitationAcceptPage detects authenticated + isNew state
13. [UI] Card content transitions to inline PersonalInfoForm:
    - firstName input (required)
    - lastName input (required)
    - email input (pre-filled from Privy/invitation, editable)
    - "Continuar" primary button (full width)
14. [UI] User fills in name fields
15. [UI] User clicks "Continuar"
16. [Frontend] PUT /api/v1/users/me with { firstName, lastName, email }
    -> IF validation error: show field-level errors, STOP
17. [Backend] Updates user profile, returns updated user
18. [Frontend] Automatically calls POST /api/v1/invitations/:token/accept
19. [Backend] Updates CompanyMember: status -> ACTIVE, userId linked, token marked used
20. [Backend] Returns { companyId, companyName, role, status: 'ACTIVE' }
21. [Frontend] AuthContext updates: user profile, hasCompany=true, companyId set
22. [UI] Redirect to /dashboard
23. [UI] Welcome toast: "Bem-vindo a {companyName}!" (auto-dismiss 5 seconds)

POSTCONDITION: User has account + is ACTIVE member of company
SIDE EFFECTS: Audit logs (AUTH_LOGIN_SUCCESS, COMPANY_MEMBER_ACCEPTED), welcome email
```

---

### Flow 3: Invited User -- Already Has Account (Logged In)

```
PRECONDITION: User already has Navia account and is logged in
ACTOR: Existing user
TRIGGER: Clicks invitation link in email

1. [UI] Browser navigates to /invitations/:token
2. [Frontend] InvitationAcceptPage mounts, shows loading spinner
3. [Frontend] GET /api/v1/invitations/:token
4. [Backend] Returns invitation details (hasExistingAccount: true)
5. [UI] Card renders: company logo, name, RoleBadge, "Convidado por {name}"
6. [Frontend] Detects user is already authenticated
7. [UI] Shows "Aceitar Convite" primary button (full width, lg)
8. [UI] User clicks "Aceitar Convite"
9. [Frontend] POST /api/v1/invitations/:token/accept
10. [Backend] Links user to company, updates CompanyMember to ACTIVE
    -> IF email mismatch: acceptance still allowed per BR-6
    -> IF already member: return 409 COMPANY_MEMBER_EXISTS
11. [Backend] Returns { companyId, companyName, role }
12. [Frontend] AuthContext updates: hasCompany=true, companyId set
13. [UI] Redirect to /dashboard
14. [UI] Success toast: "Voce agora e membro de {companyName}!"

POSTCONDITION: User is ACTIVE member
SIDE EFFECTS: Audit log (COMPANY_MEMBER_ACCEPTED)
```

---

### Flow 4: Invited User -- Already Has Account (Not Logged In)

```
PRECONDITION: User has Navia account but not currently logged in
ACTOR: Existing user
TRIGGER: Clicks invitation link in email

1. [UI] Browser navigates to /invitations/:token
2. [Frontend] GET /api/v1/invitations/:token
3. [Backend] Returns invitation details (hasExistingAccount: true)
4. [UI] Card renders: company info + "Entrar" primary button + "Criar Conta" ghost link
5. [UI] User clicks "Entrar"
6. [Frontend] Opens Privy login modal
7. [UI] User logs in via Privy
8. [Frontend] POST /api/v1/auth/login -> existing user detected (isNew: false)
9. [UI] InvitationAcceptPage updates to show "Aceitar Convite" button
10-14. Same as Flow 3 steps 8-14

POSTCONDITION: User is ACTIVE member
SIDE EFFECTS: Audit logs (AUTH_LOGIN_SUCCESS, COMPANY_MEMBER_ACCEPTED)
```

---

### Flow 5: Change Member Role

```
PRECONDITION: User is ADMIN
ACTOR: ADMIN
TRIGGER: Clicks role badge of another member in the table

1. [UI] ADMIN clicks on a RoleBadge in another member's row
2. [UI] RoleChangeDropdown opens showing 5 role options with descriptions
3. [UI] Admin selects new role
4. [UI] Confirmation dialog: "Alterar o papel de {name} de {oldRole} para {newRole}?"
5. [UI] Admin clicks "Confirmar"
6. [Frontend] PUT /api/v1/companies/:companyId/members/:memberId with { role }
   -> IF 422 COMPANY_LAST_ADMIN: error toast "Nao e possivel alterar o papel do ultimo administrador"
7. [Backend] Updates member role
8. [Backend] Returns 200 with updated member
9. [UI] Toast: "Papel alterado com sucesso" (auto-dismiss 5 seconds)
10. [Frontend] queryClient.invalidateQueries to refetch members table

POSTCONDITION: Member has new role
SIDE EFFECTS: Audit log (COMPANY_ROLE_CHANGED)
```

---

### Flow 6: Remove Member

```
PRECONDITION: User is ADMIN, target is not self
ACTOR: ADMIN
TRIGGER: Clicks remove (trash) icon on member row

1. [UI] ADMIN clicks trash icon in actions column
2. [UI] MemberRemoveConfirmation dialog opens
3. [UI] Warning: "Remover {name} da empresa? Esta acao nao pode ser desfeita."
4. [UI] Admin clicks "Remover" (destructive red button)
5. [Frontend] DELETE /api/v1/companies/:companyId/members/:memberId
   -> IF 422 COMPANY_LAST_ADMIN: error toast
6. [Backend] Sets member status to REMOVED
7. [UI] Toast: "Membro removido" (auto-dismiss 5 seconds)
8. [Frontend] Refetch members table

POSTCONDITION: Member status is REMOVED
SIDE EFFECTS: Audit log (COMPANY_MEMBER_REMOVED)
```

---

### Flow 7: Resend Invitation

```
PRECONDITION: Member has PENDING status, user is ADMIN
ACTOR: ADMIN
TRIGGER: Clicks "Reenviar convite" button on a PENDING member row

1. [UI] ADMIN clicks "Reenviar convite" ghost button
2. [UI] Button shows loading spinner
3. [Frontend] POST /api/v1/companies/:companyId/members/:memberId/resend-invitation
4. [Backend] Generates new token, invalidates old one, resends email
5. [Backend] Returns 200 with { newExpiresAt }
6. [UI] Toast: "Convite reenviado" (auto-dismiss 5 seconds)
7. [UI] Resend button enters 60-second cooldown (disabled state with countdown or just disabled)

POSTCONDITION: New invitation token generated with fresh 7-day expiry
SIDE EFFECTS: New invitation email sent via AWS SES
```

---

### Error Flows

**Expired Invitation Token**:
```
1. [UI] User clicks invitation link from email
2. [Frontend] GET /api/v1/invitations/:token returns 410 INVITATION_EXPIRED
3. [UI] InvitationExpiredPage renders inside the card:
   - Warning icon (48px, gray-400)
   - "Convite Expirado" (h2, navy-900)
   - "Este convite expirou ou e invalido" (body, gray-500)
   - "Solicite um novo convite ao administrador da empresa" (body-sm, gray-500)
```

**Invalid/Used Invitation Token**:
```
1. [Frontend] GET /api/v1/invitations/:token returns 404 INVITATION_NOT_FOUND
2. [UI] Same InvitationExpiredPage as above (user does not need to know why the token is invalid)
```

**Email Mismatch** (informational, since BR-6 allows any user to accept):
```
1. [Frontend] POST /api/v1/invitations/:token/accept returns 403
2. [UI] InvitationEmailMismatch renders:
   - "Este convite foi enviado para {masked-email}. Faca login com o e-mail correto."
   - "Sair e entrar com outro e-mail" button (triggers logout + Privy login)
```

**Already a Member**:
```
1. [Frontend] POST /api/v1/invitations/:token/accept returns 409 COMPANY_MEMBER_EXISTS
2. [UI] Message: "Voce ja e membro desta empresa"
3. [UI] Link: "Ir para o Dashboard" -> navigates to /dashboard
```

---

## UI States & Error Handling

### MembersPage States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Page header (h1 + button) + skeleton table rows (pulsing gray-200 rectangles) | Initial load |
| Data | Header + populated MembersTable + pagination | Data loaded successfully |
| Empty | Header + centered empty state illustration + "Nenhum membro encontrado" + description + "Convidar Membro" CTA | No members returned |
| Error | Header + centered error message + "Tentar novamente" retry button | API error |

### InviteMemberModal States

| State | Visual | Trigger |
|-------|--------|---------|
| Idle | Form with empty fields, role defaults to EMPLOYEE | Modal opens |
| Submitting | "Enviar Convite" button shows spinner, all fields disabled | Submit clicked |
| Success | Modal closing (animation), toast appearing | 201 response |
| Email Duplicate | Inline error on email: "Este e-mail ja e membro da empresa" | 409 COMPANY_MEMBER_EXISTS |
| Pending Duplicate | Inline error on email: "Ja existe um convite pendente para este e-mail" | 409 COMPANY_INVITATION_PENDING |
| Validation Error | Field-level error messages from validationErrors array | 400 VAL_INVALID_INPUT |
| Server Error | Error toast, form re-enabled for retry | 500 |

### InvitationAcceptPage States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Centered spinner on gray-50 background | Token validation in progress |
| Valid (Not Logged In) | Company info card + "Criar Conta" / "Entrar" buttons | Token valid, user not authenticated |
| Valid (Logged In) | Company info card + "Aceitar Convite" button | Token valid, user authenticated |
| Collecting Info (New User) | PersonalInfoForm inline in card | New user completed Privy signup |
| Accepting | "Aceitar Convite" button shows spinner | Accept request in progress |
| Accepted | Redirect to /dashboard in progress | 200 success |
| Expired | InvitationExpiredPage (warning icon + message) | 404 or 410 response |
| Email Mismatch | InvitationEmailMismatch (info icon + message + sign-out CTA) | 403 response |
| Already Member | "Voce ja e membro desta empresa" + dashboard link | 409 COMPANY_MEMBER_EXISTS |

### Error Code to UI Mapping

| Error Code | HTTP | UI Behavior |
|------------|------|-------------|
| `COMPANY_MEMBER_EXISTS` | 409 | InviteMemberModal: inline error on email field. InvitationAcceptPage: "already member" message + dashboard link. |
| `COMPANY_INVITATION_PENDING` | 409 | InviteMemberModal: inline error on email field |
| `MEMBER_NOT_FOUND` | 404 | Toast: `errors.member.notFound` |
| `MEMBER_CANNOT_REMOVE_SELF` | 422 | Toast: `errors.member.cannotRemoveSelf` (button hidden in UI, backend enforces as safety net) |
| `COMPANY_LAST_ADMIN` | 422 | Toast: `errors.member.lastAdmin` |
| `INVITATION_NOT_FOUND` | 404 | InvitationExpiredPage |
| `INVITATION_EXPIRED` | 410 | InvitationExpiredPage |
| `INVITATION_ALREADY_ACCEPTED` | 422 | "Already member" message + dashboard link |
| `COMPANY_MEMBER_LIMIT_REACHED` | 422 | Toast: "Limite de empresas atingido" |
| `VAL_INVALID_INPUT` | 400 | Map `validationErrors` array to form fields via `applyServerErrors()` |

---

## Component Visual Specifications

### MembersPage Layout

```
+-------------------------------------------------------------+
|  h1: Membros                           [+ Convidar Membro]  |
|  body-sm: Gerencie os membros e permissoes da sua empresa    |
+-------------------------------------------------------------+
|                                                              |
|  +----------------------------------------------------------+
|  | Nome         | E-mail        | Papel  | Status | Data   | Acoes |
|  |----------------------------------------------------------|
|  | (avatar) Joao| joao@acme.com | ADMIN  | Ativo  | 15/01  | ...   |
|  | (avatar) Maria| maria@ex.com | FINANCE| Ativo  | 20/01  | [R][T]|
|  | (email icon) | new@ex.com    | LEGAL  |Pendente| --     | [RS]  |
|  +----------------------------------------------------------+
|  Showing 1-3 of 3                               < 1 >       |
|                                                              |
+-------------------------------------------------------------+

Legend: [R] = Role change, [T] = Trash/remove, [RS] = Resend
```

### InviteMemberModal Layout

```
+-------------------------------------------+
|  Convidar Membro                     [X]  |
+-------------------------------------------+
|                                           |
|  E-mail do membro                         |
|  [nome@empresa.com                    ]   |
|                                           |
|  Papel                                    |
|  [v Colaborador                       ]   |
|    -- dropdown options with descriptions: |
|    Administrador                          |
|    Acesso total a empresa e config.       |
|    Financeiro                             |
|    Gestao financeira e relatorios         |
|    ...                                    |
|                                           |
|  Mensagem (opcional)                      |
|  [                                    ]   |
|  [                                    ]   |
|  [                                    ]   |
|                                           |
+-------------------------------------------+
|              [Cancelar] [Enviar Convite]   |
+-------------------------------------------+
```

### InvitationAcceptPage Layout (Not Logged In)

```
+---------------------------------------+
|                                       |
|         [Company Logo 48px]           |
|         Acme Tecnologia               |   <- h2, navy-900, centered
|         [FINANCE badge]               |   <- RoleBadge, centered
|         Convidado por Joao Silva      |   <- body-sm, gray-500
|                                       |
|  -----------------------------------  |   <- 1px gray-200 divider
|                                       |
|  [       Criar Conta (primary)      ] |   <- full width, lg
|                                       |
|         Ja tenho conta                |   <- ghost link, centered
|                                       |
+---------------------------------------+
```

### InvitationAcceptPage Layout (New User -- PersonalInfoForm)

```
+---------------------------------------+
|                                       |
|         [Company Logo 48px]           |
|         Acme Tecnologia               |
|         [FINANCE badge]               |
|                                       |
|  -----------------------------------  |
|                                       |
|  Nome                                 |
|  [                                 ]  |
|                                       |
|  Sobrenome                            |
|  [                                 ]  |
|                                       |
|  E-mail                               |
|  [maria@example.com                ]  |  <- pre-filled
|                                       |
|  [         Continuar (primary)     ]  |  <- full width
|                                       |
+---------------------------------------+
```

### Member Status Badge Colors

| Status | Background | Text |
|--------|-----------|------|
| ACTIVE | `green-100` (#E8F5E4) | `green-700` (#6BAF5E) |
| PENDING | `cream-100` (#FAF4E3) | `cream-700` (#C4A44E) |
| SUSPENDED | `#FEE2E2` | `#991B1B` |
| REMOVED | `gray-100` (#F3F4F6) | `gray-500` (#6B7280) |

---

## i18n Keys

All user-facing strings must be added to both `messages/pt-BR.json` and `messages/en.json` per the i18n rules.

### Members Page

| Key | PT-BR | EN |
|-----|-------|-----|
| `members.title` | Membros | Members |
| `members.description` | Gerencie os membros e permissoes da sua empresa | Manage your company's members and permissions |
| `members.inviteButton` | Convidar Membro | Invite Member |
| `members.table.name` | Nome | Name |
| `members.table.email` | E-mail | Email |
| `members.table.role` | Papel | Role |
| `members.table.status` | Status | Status |
| `members.table.joinedDate` | Data de Entrada | Joined Date |
| `members.table.actions` | Acoes | Actions |
| `members.table.empty` | Nenhum membro encontrado | No members found |
| `members.table.emptyDescription` | Convide membros para colaborar na gestao da empresa | Invite members to collaborate on company management |

### Invite Modal

| Key | PT-BR | EN |
|-----|-------|-----|
| `members.invite.title` | Convidar Membro | Invite Member |
| `members.invite.email` | E-mail do membro | Member email |
| `members.invite.emailPlaceholder` | nome@empresa.com | name@company.com |
| `members.invite.role` | Papel | Role |
| `members.invite.message` | Mensagem (opcional) | Message (optional) |
| `members.invite.messagePlaceholder` | Mensagem opcional para o convite | Optional message for the invitation |
| `members.invite.submit` | Enviar Convite | Send Invitation |
| `members.invite.cancel` | Cancelar | Cancel |
| `members.invite.success` | Convite enviado para {email} | Invitation sent to {email} |

### Role Labels & Descriptions

| Key | PT-BR | EN |
|-----|-------|-----|
| `members.role.admin` | Administrador | Admin |
| `members.role.adminDescription` | Acesso total a empresa e configuracoes | Full access to company and settings |
| `members.role.finance` | Financeiro | Finance |
| `members.role.financeDescription` | Gestao financeira e relatorios | Financial management and reports |
| `members.role.legal` | Juridico | Legal |
| `members.role.legalDescription` | Documentos legais e compliance | Legal documents and compliance |
| `members.role.investor` | Investidor | Investor |
| `members.role.investorDescription` | Visualizacao de investimentos proprios | View own investments |
| `members.role.employee` | Colaborador | Employee |
| `members.role.employeeDescription` | Visualizacao de opcoes e documentos proprios | View own options and documents |

### Role Change

| Key | PT-BR | EN |
|-----|-------|-----|
| `members.changeRole.title` | Alterar Papel | Change Role |
| `members.changeRole.confirm` | Alterar o papel de {name} de {oldRole} para {newRole}? | Change {name}'s role from {oldRole} to {newRole}? |
| `members.changeRole.success` | Papel alterado com sucesso | Role changed successfully |

### Remove Member

| Key | PT-BR | EN |
|-----|-------|-----|
| `members.remove.title` | Remover Membro | Remove Member |
| `members.remove.confirm` | Remover {name} da empresa? Esta acao nao pode ser desfeita. | Remove {name} from the company? This cannot be undone. |
| `members.remove.submit` | Remover | Remove |
| `members.remove.cancel` | Cancelar | Cancel |
| `members.remove.success` | Membro removido | Member removed |

### Resend Invitation

| Key | PT-BR | EN |
|-----|-------|-----|
| `members.resend.button` | Reenviar convite | Resend invitation |
| `members.resend.success` | Convite reenviado | Invitation resent |

### Member Status

| Key | PT-BR | EN |
|-----|-------|-----|
| `members.status.active` | Ativo | Active |
| `members.status.pending` | Pendente | Pending |
| `members.status.suspended` | Suspenso | Suspended |
| `members.status.removed` | Removido | Removed |

### Invitation Accept Page

| Key | PT-BR | EN |
|-----|-------|-----|
| `invitation.title` | Convite para {companyName} | Invitation to {companyName} |
| `invitation.role` | Papel: {role} | Role: {role} |
| `invitation.invitedBy` | Convidado por {name} | Invited by {name} |
| `invitation.accept` | Aceitar Convite | Accept Invitation |
| `invitation.createAccount` | Criar Conta | Create Account |
| `invitation.signIn` | Ja tenho conta | I have an account |
| `invitation.continue` | Continuar | Continue |
| `invitation.welcome` | Bem-vindo a {companyName}! | Welcome to {companyName}! |
| `invitation.alreadyMember` | Voce ja e membro desta empresa | You are already a member of this company |
| `invitation.goToDashboard` | Ir para o Dashboard | Go to Dashboard |

### Invitation Error States

| Key | PT-BR | EN |
|-----|-------|-----|
| `invitation.expired.title` | Convite Expirado | Invitation Expired |
| `invitation.expired.message` | Este convite expirou ou e invalido | This invitation has expired or is invalid |
| `invitation.expired.cta` | Solicite um novo convite ao administrador da empresa | Request a new invitation from the company admin |
| `invitation.emailMismatch.title` | E-mail Incorreto | Wrong Email |
| `invitation.emailMismatch.message` | Este convite foi enviado para {email}. Faca login com o e-mail correto. | This invitation was sent to {email}. Sign in with the correct email. |
| `invitation.emailMismatch.cta` | Sair e entrar com outro e-mail | Sign out and sign in with another email |

### Error Messages

| Key | PT-BR | EN |
|-----|-------|-----|
| `errors.member.alreadyExists` | Este e-mail ja e membro da empresa | This email is already a member of the company |
| `errors.member.invitationPending` | Ja existe um convite pendente para este e-mail | There is already a pending invitation for this email |
| `errors.member.notFound` | Membro nao encontrado | Member not found |
| `errors.member.cannotRemoveSelf` | Voce nao pode remover a si mesmo | You cannot remove yourself |
| `errors.member.lastAdmin` | Nao e possivel alterar o papel do ultimo administrador | Cannot change the role of the last admin |
| `errors.member.limitReached` | Limite de empresas atingido | Company membership limit reached |

---

## TanStack Query Configuration

### Query Keys

| Key Pattern | Endpoint | Invalidated By |
|------------|----------|----------------|
| `['members', companyId, params]` | `GET /companies/:companyId/members` | Invite, role change, remove, resend |
| `['invitation', token]` | `GET /invitations/:token` | Accept (navigates away) |

### Retry Configuration

```typescript
// Do not retry auth, validation, or business rule errors
const shouldRetry = (failureCount: number, error: ApiError) => {
  if ([400, 401, 403, 404, 409, 410, 422].includes(error.statusCode)) {
    return false;
  }
  return failureCount < 2; // Retry server errors up to 2 times
};
```

### Optimistic Updates

Role change and member removal do NOT use optimistic updates. The table refetches after mutation success to ensure data consistency.

---

## Accessibility Requirements

- All interactive elements must have visible focus indicators (`2px solid blue-600` with 2px offset, using `focus-visible`)
- Form inputs in InviteMemberModal must have associated `<label>` elements
- RoleChangeDropdown must be keyboard-navigable (arrow keys, Enter to select, Escape to close)
- MemberRemoveConfirmation dialog traps focus while open
- Toast notifications include `role="alert"` for screen reader announcement
- Table headers use `<th>` with `scope="col"`
- Empty state and error state messages use `role="status"`
- Minimum tap target: 44x44px on mobile, 32x32px on desktop
- Color is never used alone to convey status -- always paired with text labels (RoleBadge, StatusBadge)
