# Shareholder Registry Specification

**Topic of Concern**: Shareholder management and equity tracking

**One-Sentence Description**: The system maintains comprehensive shareholder records including personal information, ownership details, and historical equity positions.

---

## Overview

The shareholder registry is the central database of all equity holders in a company's cap table. It tracks both individual shareholders (pessoa física) and corporate shareholders (pessoa jurídica), maintaining complete records of their identity, contact information, ownership percentages, share class breakdown, and acquisition history. The registry integrates with KYC verification to ensure all shareholders have validated identities, and serves as the foundation for all equity transactions and cap table calculations.

---

## User Stories

### US-1: Add New Shareholder
**As an** admin user
**I want to** add a new shareholder to the cap table
**So that** I can track their ownership and prepare for share issuance

### US-2: View Shareholder Details
**As an** admin or finance user
**I want to** view complete shareholder information including ownership breakdown
**So that** I can understand their equity position and contact them if needed

### US-3: Update Shareholder Information
**As an** admin user
**I want to** update shareholder contact information or tax details
**So that** records remain current and accurate

### US-4: Track Foreign Shareholders
**As an** admin user
**I want to** identify and track foreign shareholders (non-Brazilian residents)
**So that** I can comply with foreign capital reporting requirements (Law 4.131/62)

### US-5: View Shareholder History
**As an** admin user
**I want to** see a shareholder's complete transaction history
**So that** I can understand how their ownership position evolved over time

### US-6: Beneficial Ownership Tracking
**As an** admin user
**I want to** identify and track beneficial owners behind corporate shareholders
**So that** I can comply with UBO (Ultimate Beneficial Owner) requirements

### US-7: Shareholder Self-Service
**As a** shareholder (investor role)
**I want to** view my own ownership details and transaction history
**So that** I can track my investment without contacting the company

### US-8: Export Shareholder List
**As an** admin user
**I want to** export a complete shareholder list with contact information
**So that** I can send communications or prepare for shareholder meetings

---

## Functional Requirements

### FR-1: Shareholder Types
- System MUST support individual shareholders (pessoa física with CPF)
- System MUST support corporate shareholders (pessoa jurídica with CNPJ)
- System MUST distinguish between Brazilian and foreign shareholders
- System MUST track shareholder type: FOUNDER, INVESTOR, EMPLOYEE, ADVISOR, CORPORATE

### FR-2: Required Shareholder Information
- System MUST require: legal name, CPF/CNPJ, email
- System MUST require: nationality, tax residency
- System SHOULD collect: contact information (phone), physical address
- System MUST link shareholder to verified KYC record (if available)
- System MUST NOT require a wallet address on shareholder creation — the wallet address is derived from the shareholder's `User.walletAddress` once they sign up and receive a Privy embedded wallet

### FR-3: Ownership Tracking
- System MUST calculate total shares owned across all share classes
- System MUST calculate ownership percentage of company
- System MUST calculate voting power based on share class voting rights
- System MUST track fully-diluted ownership (including unvested options)

### FR-4: Share Class Breakdown
- System MUST track shares owned per share class
- System MUST display acquisition date per share class holding
- System MUST track cost basis per holding

### FR-5: Foreign Shareholder Compliance
- System MUST flag foreign shareholders (non-Brazilian tax residency)
- System MUST track foreign investment registration (RDE-IED) status
- System MUST support foreign capital reporting requirements

### FR-6: Beneficial Ownership (UBO)
- System MUST allow linking beneficial owners to corporate shareholders
- System MUST track ownership chain (A owns B, B owns Company)
- System MUST calculate ultimate beneficial ownership percentages

### FR-7: Shareholder Status
- System MUST track shareholder status: ACTIVE, INACTIVE, PENDING
- System MUST support shareholder removal (only if no historical transactions)
- System MUST maintain inactive shareholders in historical records

### FR-8: Access Control
- Admin/Finance users: Full access to all shareholder records
- Legal users: Read access to all shareholder records
- Investor users: Read access to own shareholder record only
- Employee users: Read access to own shareholder record only

---

## Data Models

### Shareholder Entity

```typescript
interface Shareholder {
  id: string;                          // UUID
  company_id: string;                  // Foreign key to Company
  user_id: string | null;              // Foreign key to User (if shareholder has platform account)

  // Identity Information
  legal_name: string;                  // Full legal name
  cpf_cnpj: string;                    // CPF (individuals) or CNPJ (companies)
  shareholder_type: ShareholderType;   // FOUNDER | INVESTOR | EMPLOYEE | ADVISOR | CORPORATE

  // Wallet Address (derived, not manually set)
  // Populated automatically from User.walletAddress when the shareholder signs up
  // Null until the shareholder creates a platform account and receives a Privy embedded wallet
  wallet_address: string | null;

  // Contact Information
  email: string | null;
  phone: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  } | null;

  // Tax & Residency
  nationality: string;                 // ISO country code (BR, US, etc.)
  tax_residency: string;               // ISO country code
  is_foreign: boolean;                 // Computed: tax_residency !== 'BR'

  // Foreign Capital Compliance
  rde_ied_number: string | null;       // Foreign investment registration number
  rde_ied_date: Date | null;

  // Beneficial Ownership
  is_beneficial_owner: boolean;        // True if this is a corporate shareholder
  beneficial_owners: {
    name: string;
    cpf: string;
    ownership_percentage: number;
  }[] | null;

  // Status
  status: ShareholderStatus;           // ACTIVE | INACTIVE | PENDING

  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: string;                  // User ID who created this record
}

enum ShareholderType {
  FOUNDER = 'founder',
  INVESTOR = 'investor',
  EMPLOYEE = 'employee',
  ADVISOR = 'advisor',
  CORPORATE = 'corporate'
}

enum ShareholderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}
```

### Shareholder Ownership Summary (Computed View)

```typescript
interface ShareholderOwnership {
  shareholder_id: string;
  shareholder_name: string;

  // Total Ownership
  total_shares: number;                // Sum across all share classes
  ownership_percentage: number;        // Percentage of company
  voting_power: number;                // Total votes (shares × voting rights per class)
  voting_percentage: number;           // Percentage of total votes

  // Share Class Breakdown
  holdings: {
    share_class_id: string;
    share_class_name: string;
    shares: number;
    percentage_of_class: number;
    acquisition_date: Date;
    cost_basis: number;                // Price per share paid
  }[];

  // Fully-Diluted
  fully_diluted_shares: number;        // Includes unvested options
  fully_diluted_percentage: number;
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/shareholders
**Description**: Add new shareholder to company. Wallet address is never provided manually — it is automatically populated from `User.walletAddress` when the shareholder signs up on the platform and receives a Privy embedded wallet.

**Request**:
```json
{
  "legal_name": "João da Silva",
  "cpf_cnpj": "012.345.678-01",
  "shareholder_type": "investor",
  "email": "joao@example.com",
  "phone": "+55 11 98765-4321",
  "address": {
    "street": "Av. Paulista, 1000",
    "city": "São Paulo",
    "state": "SP",
    "country": "BR",
    "postal_code": "01310-100"
  },
  "nationality": "BR",
  "tax_residency": "BR"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "legal_name": "João da Silva",
  "cpf_cnpj": "012.345.678-01",
  "wallet_address": null,
  "shareholder_type": "investor",
  "is_foreign": false,
  "status": "active",
  "created_at": "2024-01-20T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid CPF/CNPJ format or missing required fields
- `409 Conflict` - Shareholder with this CPF/CNPJ already exists in company
- `403 Forbidden` - User lacks permission to add shareholders

---

### GET /api/v1/companies/:companyId/shareholders
**Description**: List all shareholders for a company

**Query Parameters**:
- `status` (optional): Filter by status (active, inactive, pending)
- `shareholder_type` (optional): Filter by type (founder, investor, employee)
- `is_foreign` (optional): Filter foreign shareholders (true/false)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50, max: 100)

**Response** (200 OK):
```json
{
  "shareholders": [
    {
      "id": "uuid",
      "legal_name": "João da Silva",
      "cpf_cnpj": "012.345.678-01",
      "shareholder_type": "investor",
      "is_foreign": false,
      "ownership_percentage": 15.5,
      "total_shares": 155000,
      "status": "active"
    },
    {
      "id": "uuid",
      "legal_name": "ABC Investimentos LTDA",
      "cpf_cnpj": "12.345.678/0001-90",
      "shareholder_type": "corporate",
      "is_foreign": false,
      "ownership_percentage": 25.0,
      "total_shares": 250000,
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "total_pages": 1
  }
}
```

---

### GET /api/v1/companies/:companyId/shareholders/:shareholderId
**Description**: Get detailed shareholder information

**Response** (200 OK):
```json
{
  "id": "uuid",
  "company_id": "uuid",
  "legal_name": "João da Silva",
  "cpf_cnpj": "012.345.678-01",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "shareholder_type": "investor",
  "email": "joao@example.com",
  "phone": "+55 11 98765-4321",
  "address": {
    "street": "Av. Paulista, 1000",
    "city": "São Paulo",
    "state": "SP",
    "country": "BR",
    "postal_code": "01310-100"
  },
  "nationality": "BR",
  "tax_residency": "BR",
  "is_foreign": false,
  "has_platform_account": true,
  "status": "active",
  "ownership": {
    "total_shares": 155000,
    "ownership_percentage": 15.5,
    "voting_power": 155000,
    "voting_percentage": 15.5,
    "holdings": [
      {
        "share_class_id": "uuid",
        "share_class_name": "Ações Preferenciais Classe A",
        "shares": 155000,
        "percentage_of_class": 77.5,
        "acquisition_date": "2023-06-15",
        "cost_basis": 10.00
      }
    ]
  },
  "created_at": "2023-06-15T10:00:00Z",
  "updated_at": "2024-01-20T10:00:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Shareholder not found
- `403 Forbidden` - User lacks permission to view this shareholder

---

### PUT /api/v1/companies/:companyId/shareholders/:shareholderId
**Description**: Update shareholder information

**Request**:
```json
{
  "email": "joao.new@example.com",
  "phone": "+55 11 91234-5678",
  "address": {
    "street": "Av. Brigadeiro Faria Lima, 2000",
    "city": "São Paulo",
    "state": "SP",
    "country": "BR",
    "postal_code": "01452-000"
  }
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "legal_name": "João da Silva",
  "email": "joao.new@example.com",
  "phone": "+55 11 91234-5678",
  "updated_at": "2024-01-20T11:00:00Z"
}
```

**Business Rules**:
- Cannot update: legal_name, cpf_cnpj (immutable after creation)
- Cannot update: wallet_address (system-managed, derived from User.walletAddress)
- Can update: contact information, address, tax residency, RDE-IED information

---

### DELETE /api/v1/companies/:companyId/shareholders/:shareholderId
**Description**: Remove shareholder (only if no transaction history)

**Response** (200 OK):
```json
{
  "message": "Shareholder removed successfully"
}
```

**Error Responses**:
- `400 Bad Request` - Cannot delete shareholder with transaction history
- `404 Not Found` - Shareholder not found

**Business Rule**: Shareholders can only be deleted if they have zero shares and no historical transactions. Otherwise, set status to "inactive".

---

### GET /api/v1/companies/:companyId/shareholders/:shareholderId/transactions
**Description**: Get transaction history for a specific shareholder

**Response** (200 OK):
```json
{
  "shareholder_id": "uuid",
  "shareholder_name": "João da Silva",
  "transactions": [
    {
      "id": "uuid",
      "transaction_type": "issuance",
      "share_class_name": "Ações Preferenciais Classe A",
      "quantity": 155000,
      "price_per_share": 10.00,
      "total_value": 1550000.00,
      "occurred_at": "2023-06-15T10:00:00Z",
      "blockchain_tx_hash": "0x..."
    }
  ]
}
```

---

### GET /api/v1/companies/:companyId/shareholders/foreign
**Description**: List all foreign shareholders for compliance reporting

**Response** (200 OK):
```json
{
  "foreign_shareholders": [
    {
      "id": "uuid",
      "legal_name": "John Smith",
      "cpf_cnpj": "foreign-id-123",
      "nationality": "US",
      "tax_residency": "US",
      "ownership_percentage": 5.0,
      "total_investment_brl": 500000.00,
      "rde_ied_number": "123456789",
      "rde_ied_date": "2023-06-01"
    }
  ],
  "summary": {
    "total_foreign_shareholders": 3,
    "total_foreign_ownership_percentage": 12.5,
    "total_foreign_capital_brl": 1250000.00
  }
}
```

---

### POST /api/v1/companies/:companyId/shareholders/:shareholderId/beneficial-owners
**Description**: Add beneficial owner information for corporate shareholder

**Request**:
```json
{
  "beneficial_owners": [
    {
      "name": "Maria Santos",
      "cpf": "987.654.321-00",
      "ownership_percentage": 60.0
    },
    {
      "name": "Pedro Lima",
      "cpf": "111.222.333-44",
      "ownership_percentage": 40.0
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "shareholder_id": "uuid",
  "beneficial_owners": [
    {
      "name": "Maria Santos",
      "cpf": "987.654.321-00",
      "ownership_percentage": 60.0
    },
    {
      "name": "Pedro Lima",
      "cpf": "111.222.333-44",
      "ownership_percentage": 40.0
    }
  ]
}
```

---

### GET /api/v1/shareholders/me
**Description**: Get current user's shareholder information (investor/employee view)

**Response** (200 OK):
```json
{
  "companies": [
    {
      "company_id": "uuid",
      "company_name": "Startup XYZ Ltda.",
      "shareholder_id": "uuid",
      "ownership": {
        "total_shares": 50000,
        "ownership_percentage": 5.0,
        "holdings": [
          {
            "share_class_name": "Quotas",
            "shares": 50000,
            "acquisition_date": "2022-01-15"
          }
        ]
      }
    }
  ]
}
```

---

## Business Rules

### BR-1: CPF/CNPJ Uniqueness Per Company
- One CPF/CNPJ can only have one shareholder record per company
- Same CPF/CNPJ can be shareholder in multiple companies
- Attempting to add duplicate CPF/CNPJ returns `409 Conflict`

### BR-2: Wallet Address Derivation
- Wallet address is NEVER manually provided — it is always derived from `User.walletAddress`
- When a shareholder signs up on the platform (creating a User record with a Privy embedded wallet), the system links the User to the Shareholder record via matching email or CPF/CNPJ
- On linkage, `Shareholder.wallet_address` is populated from `User.walletAddress` and `Shareholder.user_id` is set
- Until the shareholder creates a platform account, `wallet_address` is null
- On-chain transactions involving shareholders without a wallet address are deferred until the shareholder signs up

### BR-3: Shareholder Type Validation
- FOUNDER: Can only be assigned during company creation or by admin
- EMPLOYEE: Typically receives shares through option exercises
- INVESTOR: Receives shares through funding rounds
- CORPORATE: Must have CNPJ (not CPF)

### BR-4: Foreign Shareholder Identification
- is_foreign flag automatically set to true if tax_residency !== 'BR'
- Foreign shareholders trigger RDE-IED registration requirement warning

### BR-5: Beneficial Owner Requirements
- Corporate shareholders (CNPJ) SHOULD have beneficial owners identified
- Beneficial owner percentages MUST sum to ≤ 100%
- At least one beneficial owner must have ≥ 25% ownership (Brazilian AML rule)

### BR-6: Shareholder Removal Restrictions
- Shareholders with current ownership (shares > 0) CANNOT be deleted
- Shareholders with transaction history CANNOT be deleted
- Instead, set status = "inactive" to hide from active lists

### BR-7: Ownership Calculation
- Ownership percentage = (shareholder total shares / company total shares) × 100
- Voting percentage = (shareholder voting power / company total voting power) × 100
- Fully-diluted includes unvested options allocated to shareholder

### BR-8: KYC Integration
- If shareholder has user_id, link to User.kyc_status
- Display KYC badge on shareholder profile (Verified ✓ or Pending)
- Shareholders without platform accounts show KYC status as "N/A"

---

## User Flows

### Flow 1: Add New Shareholder (Admin)

```
PRECONDITION: Admin user is logged in, viewing company cap table

1. Admin clicks "Add Shareholder" button
2. System displays shareholder form with tabs:
   - Personal Information
   - Contact Information
   - Tax & Compliance
3. Admin selects shareholder type: Individual or Corporate
4. If Individual:
   - Admin enters: legal_name, CPF, email
5. If Corporate:
   - Admin enters: legal_name, CNPJ, email
   - System prompts for beneficial owner information
6. Admin enters nationality and tax residency
7. System automatically sets is_foreign flag
8. If is_foreign = true:
   - System displays RDE-IED fields
   - System shows compliance warning
9. Admin enters additional contact information (phone, address)
10. Admin clicks "Save Shareholder"
11. System validates all required fields
12. System checks for duplicate CPF/CNPJ in company
13. System calls POST /api/v1/companies/:id/shareholders
14. Backend creates shareholder record (wallet_address = null)
15. Backend checks if a User with matching email exists:
    - If yes: links User to Shareholder, populates wallet_address from User.walletAddress
    - If no: shareholder remains unlinked until they sign up
16. System displays success message
17. System redirects to shareholder detail page
18. Shareholder appears in shareholders list

POSTCONDITION: New shareholder created with status = "active", zero shares, wallet linked if user exists
```

### Flow 2: View Shareholder Details

```
PRECONDITION: Admin user viewing shareholders list

1. Admin clicks on shareholder name "João da Silva"
2. System calls GET /api/v1/companies/:id/shareholders/:shareholderId
3. System displays shareholder profile with sections:
   - Personal Information (name, CPF, type, wallet)
   - Contact Information (email, phone, address)
   - Ownership Summary (total shares, percentage, voting power)
   - Share Class Breakdown (table of holdings)
   - Transaction History (chronological list)
   - Compliance Status (KYC badge, RDE-IED if foreign)
4. Admin can click "Edit" to update information
5. Admin can click "View Transactions" to see detailed history
6. Admin can export shareholder certificate (PDF)

POSTCONDITION: Admin has complete view of shareholder information
```

### Flow 3: Update Shareholder Contact Information

```
PRECONDITION: Admin viewing shareholder detail page

1. Admin clicks "Edit" button
2. System displays editable form with current data pre-filled
3. Admin updates email from "joao@old.com" to "joao@new.com"
4. Admin updates phone number
5. Admin clicks "Save Changes"
6. System validates email format and phone format
7. System calls PUT /api/v1/companies/:id/shareholders/:shareholderId
8. Backend updates shareholder record
9. Backend logs change in audit trail
10. System displays success message
11. System refreshes shareholder detail page with updated data

POSTCONDITION: Shareholder contact information updated, change logged
```

### Flow 4: Investor Views Own Shareholding

```
PRECONDITION: Investor user is logged in

1. Investor navigates to "My Investments" page
2. System calls GET /api/v1/shareholders/me
3. System displays list of companies where user is shareholder
4. Investor clicks on "Startup XYZ Ltda."
5. System displays ownership summary:
   - Total shares owned
   - Ownership percentage
   - Share class breakdown
   - Current valuation (if available)
   - Cost basis and ROI
6. Investor can view transaction history (read-only)
7. Investor can download ownership certificate (PDF)
8. Investor CANNOT edit any information

POSTCONDITION: Investor has visibility into their ownership position
```

### Flow 5: Add Beneficial Owners to Corporate Shareholder

```
PRECONDITION: Admin created corporate shareholder "ABC Investimentos LTDA"

1. Admin viewing corporate shareholder detail page
2. System displays "Beneficial Owners" section (empty)
3. Admin clicks "Add Beneficial Owners"
4. System displays form with fields:
   - Beneficial Owner 1: Name, CPF, Ownership %
   - Beneficial Owner 2: Name, CPF, Ownership %
   - [Add More] button
5. Admin enters:
   - Name: "Maria Santos", CPF: "987.654.321-00", Ownership: 60%
   - Name: "Pedro Lima", CPF: "111.222.333-44", Ownership: 40%
6. System validates:
   - Total percentage = 100% ✓
   - At least one owner ≥ 25% ✓
7. Admin clicks "Save"
8. System calls POST /api/v1/companies/:id/shareholders/:id/beneficial-owners
9. Backend stores beneficial owner data
10. System displays beneficial owners in shareholder profile
11. System marks UBO requirement as complete ✓

POSTCONDITION: Corporate shareholder has complete UBO information
```

### Flow 6: Export Shareholder List

```
PRECONDITION: Admin viewing shareholders page

1. Admin clicks "Export" button
2. System displays export options:
   - Format: CSV or Excel
   - Include: All shareholders or Active only
   - Fields: Standard or Custom selection
3. Admin selects:
   - Format: Excel
   - Include: Active only
   - Fields: Name, CPF/CNPJ, Email, Ownership %, Total Shares
4. Admin clicks "Export"
5. System generates Excel file with selected data
6. System triggers download
7. Admin receives file: "shareholders_StartupXYZ_2024-01-20.xlsx"

POSTCONDITION: Admin has shareholder list for external use
```

---

## Edge Cases & Error Handling

### EC-1: Duplicate CPF/CNPJ
**Scenario**: Admin tries to add shareholder with CPF already in company
**Handling**:
- Return 409 Conflict
- Display error: "A shareholder with this CPF already exists. View existing shareholder?"
- Provide link to existing shareholder record

### EC-2: Shareholder Signs Up — Auto-Links Wallet
**Scenario**: A shareholder record exists with `wallet_address = null`, then the person signs up on the platform
**Handling**:
- On user creation (signup), the system checks if any Shareholder records match the new user's email
- If a match is found, the system links the Shareholder to the User: sets `user_id` and populates `wallet_address` from `User.walletAddress`
- Any deferred on-chain operations for this shareholder can now proceed
- Admin is notified: "Shareholder João da Silva has joined the platform"

### EC-3: Foreign Shareholder Without RDE-IED
**Scenario**: Foreign shareholder created without RDE-IED number
**Handling**:
- Allow creation but display warning banner
- Show: "⚠️ RDE-IED registration required for foreign shareholders. Complete within 30 days."
- Remind admin via email notification

### EC-4: Beneficial Owner Percentages Don't Sum to 100%
**Scenario**: Admin enters UBO percentages that sum to 95%
**Handling**:
- Display validation error: "Beneficial owner percentages must sum to 100% (currently 95%)"
- Highlight percentage fields in red
- Prevent save until corrected

### EC-5: Attempt to Delete Shareholder with Shares
**Scenario**: Admin tries to delete shareholder who owns 10,000 shares
**Handling**:
- Return 400 Bad Request
- Display error: "Cannot delete shareholder with active ownership. Transfer shares first or set status to inactive."
- Provide "Set Inactive" button as alternative

### EC-6: Corporate Shareholder Without CNPJ
**Scenario**: Admin selects shareholder_type = "corporate" but enters CPF
**Handling**:
- Validate document type matches shareholder type
- Return error: "Corporate shareholders must have CNPJ, not CPF"
- Switch shareholder type to "individual" or prompt for CNPJ

### EC-7: User Tries to View Another User's Shareholder Record
**Scenario**: Investor user tries to access GET /shareholders/:otherId
**Handling**:
- Check user_id matches shareholder.user_id or user has admin role
- Return 403 Forbidden: "You can only view your own shareholder information"

### EC-8: Email Already in Use by Another Shareholder
**Scenario**: Admin enters email "investor@example.com" already used by another shareholder in different company
**Handling**:
- Allow (same person can be shareholder in multiple companies)
- Display info message: "ℹ️ This email is associated with shareholdings in 2 companies"

---

## Dependencies

### Internal Dependencies
- **KYC Verification**: Display KYC verification status badge on shareholder profiles
- **Cap Table Management**: Shareholders are core entities in cap table
- **Transactions**: All share transactions reference shareholder records
- **User Management**: Shareholders with platform accounts link to User table
- **Companies**: Each shareholder belongs to one company
- **Share Classes**: Ownership breakdown requires share class definitions

### External Dependencies
- **Verifik (indirectly)**: KYC-verified shareholders link to KYCVerification records
- **Blockchain**: Wallet addresses stored for on-chain identity linkage
- **Receita Federal (indirectly)**: CPF/CNPJ validation happens through KYC

---

## Technical Implementation

### Backend Service

```typescript
// /backend/src/shareholders/shareholders.service.ts

import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShareholdersService {
  constructor(private prisma: PrismaService) {}

  async createShareholder(companyId: string, createDto: CreateShareholderDto) {
    // Check for duplicate CPF/CNPJ in this company
    const existing = await this.prisma.shareholder.findFirst({
      where: {
        company_id: companyId,
        cpf_cnpj: createDto.cpf_cnpj,
      },
    });

    if (existing) {
      throw new ConflictException('Shareholder with this CPF/CNPJ already exists in company');
    }

    // Set is_foreign flag
    const isForeign = createDto.tax_residency !== 'BR';

    // Check if a User with matching email already exists on the platform
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createDto.email },
    });

    // Create shareholder — wallet_address derived from User if they exist
    const shareholder = await this.prisma.shareholder.create({
      data: {
        company_id: companyId,
        legal_name: createDto.legal_name,
        cpf_cnpj: createDto.cpf_cnpj,
        wallet_address: existingUser?.walletAddress ?? null,
        user_id: existingUser?.id ?? null,
        shareholder_type: createDto.shareholder_type,
        email: createDto.email,
        phone: createDto.phone,
        address: createDto.address,
        nationality: createDto.nationality,
        tax_residency: createDto.tax_residency,
        is_foreign: isForeign,
        status: 'ACTIVE',
      },
    });

    return shareholder;
  }

  /**
   * Called during user signup to auto-link any existing Shareholder records
   * to the newly created User (by matching email).
   */
  async linkUserToShareholders(userId: string, email: string, walletAddress: string) {
    await this.prisma.shareholder.updateMany({
      where: {
        email,
        user_id: null,
      },
      data: {
        user_id: userId,
        wallet_address: walletAddress,
      },
    });
  }

  async getShareholderWithOwnership(companyId: string, shareholderId: string) {
    const shareholder = await this.prisma.shareholder.findFirst({
      where: {
        id: shareholderId,
        company_id: companyId,
      },
      include: {
        cap_table_entries: {
          include: {
            share_class: true,
          },
        },
      },
    });

    if (!shareholder) {
      throw new NotFoundException('Shareholder not found');
    }

    // Calculate ownership summary
    const ownership = this.calculateOwnership(shareholder);

    return {
      ...shareholder,
      ownership,
    };
  }

  private calculateOwnership(shareholder: any) {
    // Sum shares across all classes
    const totalShares = shareholder.cap_table_entries.reduce(
      (sum, entry) => sum + entry.shares,
      0,
    );

    // Calculate voting power
    const votingPower = shareholder.cap_table_entries.reduce(
      (sum, entry) => sum + entry.shares * entry.share_class.votes_per_share,
      0,
    );

    // Get holdings breakdown
    const holdings = shareholder.cap_table_entries.map((entry) => ({
      share_class_id: entry.share_class.id,
      share_class_name: entry.share_class.name,
      shares: entry.shares,
      percentage_of_class: entry.percentage,
      acquisition_date: entry.acquired_at,
      cost_basis: entry.cost_basis || 0,
    }));

    return {
      total_shares: totalShares,
      ownership_percentage: shareholder.cap_table_entries[0]?.percentage || 0,
      voting_power: votingPower,
      voting_percentage: 0, // TODO: Calculate from company total
      holdings,
    };
  }

}
```

### Frontend Component

```typescript
// /frontend/src/app/(dashboard)/companies/[id]/shareholders/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Shareholder {
  id: string;
  legal_name: string;
  cpf_cnpj: string;
  shareholder_type: string;
  ownership_percentage: number;
  total_shares: number;
  is_foreign: boolean;
  status: string;
}

export default function ShareholdersPage() {
  const params = useParams();
  const companyId = params.id as string;
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShareholders();
  }, [companyId]);

  const fetchShareholders = async () => {
    const response = await fetch(`/api/v1/companies/${companyId}/shareholders`);
    const data = await response.json();
    setShareholders(data.shareholders);
    setLoading(false);
  };

  return (
    <div className="shareholders-page">
      <div className="header">
        <h1>Shareholders</h1>
        <button onClick={() => openAddShareholderModal()}>Add Shareholder</button>
      </div>

      <table className="shareholders-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>CPF/CNPJ</th>
            <th>Type</th>
            <th>Ownership %</th>
            <th>Shares</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {shareholders.map((shareholder) => (
            <tr key={shareholder.id}>
              <td>
                {shareholder.legal_name}
                {shareholder.is_foreign && <span className="badge">Foreign</span>}
              </td>
              <td>{maskCPFCNPJ(shareholder.cpf_cnpj)}</td>
              <td>{shareholder.shareholder_type}</td>
              <td>{shareholder.ownership_percentage.toFixed(2)}%</td>
              <td>{shareholder.total_shares.toLocaleString()}</td>
              <td><span className={`status-${shareholder.status}`}>{shareholder.status}</span></td>
              <td>
                <button onClick={() => viewShareholder(shareholder.id)}>View</button>
                <button onClick={() => editShareholder(shareholder.id)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function maskCPFCNPJ(value: string): string {
  // Mask middle digits for privacy
  if (value.length === 14) {
    // CPF: XXX.XXX.XXX-XX
    return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
  } else {
    // CNPJ: XX.XXX.XXX/XXXX-XX
    return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.***.***/****-$5');
  }
}
```

---

## Security Considerations

### SEC-1: CPF/CNPJ Privacy
- Mask CPF/CNPJ in list views (show only first 3 and last 2 digits)
- Full CPF/CNPJ only visible in detail view for authorized users
- Implement field-level access control

### SEC-2: Role-Based Access
- Admin/Finance: Full CRUD on shareholders
- Legal: Read-only access
- Investors/Employees: Only view own shareholder record
- Enforce permissions at API level (guards)

### SEC-3: Audit Logging
- Log all shareholder creation events
- Log all shareholder updates (with field-level changes)
- Log all shareholder deletions/inactivations
- Retain logs for 5 years (compliance)

### SEC-4: PII Protection
- Encrypt sensitive fields at rest (address, phone)
- Use HTTPS for all API calls
- Implement rate limiting on shareholder endpoints
- Sanitize inputs to prevent SQL injection

### SEC-5: Export Security
- Require admin/finance role to export shareholder data
- Log all export events (who, when, what)
- Watermark exported files with user info and timestamp
- Limit export frequency (max 10 per day per user)

---

## Success Criteria

### Data Accuracy
- 100% of shareholders have valid CPF/CNPJ
- Zero duplicate CPF/CNPJ within a company
- 100% of wallet addresses derived from User records (never manually entered)

### Performance
- Shareholder list loads in < 2 seconds for 500 shareholders
- Shareholder detail page loads in < 1 second
- Ownership calculations complete in < 500ms

### User Experience
- Shareholder creation completes in < 5 minutes
- Ownership summary updates in real-time after transactions
- Investors can view their holdings without admin assistance

### Compliance
- 100% of foreign shareholders flagged correctly
- Corporate shareholders have UBO information (when required)
- All shareholder changes logged in audit trail
