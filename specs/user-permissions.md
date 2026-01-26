# User Permissions Specification

**Topic of Concern**: Role-based access control (RBAC)

**One-Sentence Description**: The system enforces role-based permissions determining what actions users can perform based on their assigned role within a company.

---

## Overview

VelaFund uses role-based access control (RBAC) to manage user permissions. Each user has one or more roles per company, and each role grants specific permissions. The system enforces permissions at the API level using NestJS guards.

---

## Roles

### Admin
- Full access to all features
- Can manage shareholders, transactions, cap table
- Can create/edit documents
- Can confirm option exercise payments
- Can manage other users' roles

### Finance
- View and edit cap table
- Create/approve transactions
- Generate financial reports
- Cannot manage users or legal documents

### Legal
- View cap table (read-only)
- Manage documents and templates
- Request and track signatures
- Cannot create transactions

### Investor
- View own shareholdings (read-only)
- View company cap table (if permitted in shareholder agreement)
- Download own reports
- Cannot edit anything

### Employee
- View own option grants and vesting (read-only)
- Request option exercises
- Cannot view full cap table

---

## Functional Requirements

### FR-1: Company-Specific Roles
- User can have different roles in different companies
- User can have multiple roles in same company
- Role assignment is per-company, not global

### FR-2: Permission Checking
- All API endpoints protected by role guards
- Frontend hides UI elements based on permissions
- Backend always enforces permissions (never trust frontend)

### FR-3: Role Management
- Admin can assign/remove roles
- Admin cannot remove own admin role (prevent lockout)
- Audit log tracks role changes

---

## Data Models

```typescript
interface CompanyRole {
  id: string;
  user_id: string;
  company_id: string;
  role: 'ADMIN' | 'FINANCE' | 'LEGAL' | 'INVESTOR' | 'EMPLOYEE';
  
  // Optional: Fine-grained permissions override
  permissions: {
    cap_table_read: boolean;
    cap_table_write: boolean;
    transactions_create: boolean;
    documents_create: boolean;
    users_manage: boolean;
  } | null;

  assigned_by: string;               // User ID who assigned this role
  assigned_at: Date;
}
```

---

## Permission Matrix

| Action | Admin | Finance | Legal | Investor | Employee |
|--------|-------|---------|-------|----------|----------|
| View cap table | ✓ | ✓ | ✓ | ✓* | ✗ |
| Edit cap table | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create transaction | ✓ | ✓ | ✗ | ✗ | ✗ |
| View documents | ✓ | ✓ | ✓ | ✓** | ✗ |
| Create documents | ✓ | ✗ | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✗ | ✗ | ✗ | ✗ |
| View own options | ✓ | ✓ | ✗ | ✗ | ✓ |
| Confirm payment | ✓ | ✓ | ✗ | ✗ | ✗ |

*If permitted in shareholder agreement  
**Only documents they signed

---

## API Endpoints

### POST /api/v1/companies/:companyId/roles
Assign role to user

### DELETE /api/v1/companies/:companyId/roles/:roleId
Remove user's role

### GET /api/v1/companies/:companyId/roles
List all users and their roles in company

---

## Business Rules

### BR-1: Admin Protection
- Cannot remove last admin from company
- Cannot remove own admin role

### BR-2: Self-Assignment
- Users cannot assign roles to themselves
- Must be assigned by existing admin

### BR-3: Investor Auto-Role
- When shareholder added, if they have user account, auto-assign INVESTOR role

---

## Success Criteria

- Zero unauthorized access incidents
- 100% of API endpoints protected
- Role assignment completes in < 1 second
- Audit log captures all role changes
