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

### POST /api/v1/companies/:id/members/invite
**Description**: Invite a new member by email. Creates a pending CompanyMember and sends an invitation email.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

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

### POST /api/v1/companies/:id/members/:memberId/resend-invitation
**Description**: Re-send an invitation email. Generates a new token and invalidates the old one.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

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

### GET /api/v1/companies/:id/members
**Description**: List all members of a company, including pending invitations.

**Auth**: Required. `X-Company-Id` header required.

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
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

### PUT /api/v1/companies/:id/members/:memberId
**Description**: Update a member's role or permissions.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

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

### DELETE /api/v1/companies/:id/members/:memberId
**Description**: Remove a member from the company. Sets member status to REMOVED.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

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
4. Frontend sends POST /api/v1/companies/:id/members/invite
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
- Backend returns `409 Conflict` with error code `COMPANY_MEMBER_EXISTS`
- Error message: "This email is already an active member of this company"
- Admin can update the existing member's role instead

### EC-2: User Tries to Accept Expired Invitation
**Scenario**: User clicks invitation link after 7-day expiry.
**Handling**:
- GET /api/v1/invitations/:token returns `410 Gone`
- Frontend shows: "This invitation has expired. Please ask the admin to re-send it."
- Provides company name and admin email for convenience

### EC-3: Last ADMIN Tries to Leave Company
**Scenario**: The only ADMIN tries to change their role or remove themselves.
**Handling**:
- Backend returns `422 Unprocessable Entity` with error code `COMPANY_LAST_ADMIN`
- Error message: "Cannot remove the last admin. Assign another admin first."
- Frontend disables the role change / remove button for the last admin

### EC-4: Concurrent Invitations to Same Email
**Scenario**: Two admins simultaneously try to invite the same email.
**Handling**:
- Database unique constraint on (companyId, email) WHERE status = 'PENDING' prevents duplicate
- Second request fails with `409 Conflict`
- Error message: "An invitation for this email is already pending"

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
import { Injectable, ConflictException, GoneException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { randomBytes } from 'crypto';

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
      throw new ConflictException('This email is already an active member of this company');
    }

    // Check for existing pending invitation
    const existingPending = await this.prisma.companyMember.findFirst({
      where: { companyId, email: dto.email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException('An invitation for this email is already pending');
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
      throw new NotFoundException('Invitation not found or already used');
    }

    if (invitation.expiresAt < new Date()) {
      throw new GoneException('Invitation has expired');
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
      throw new ConflictException('You are already an active member of this company');
    }

    // Check 20-company membership limit
    const membershipCount = await this.prisma.companyMember.count({
      where: { userId, status: { in: ['PENDING', 'ACTIVE'] } },
    });
    if (membershipCount >= 20) {
      throw new UnprocessableEntityException('Maximum of 20 company memberships reached');
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
