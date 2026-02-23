# Share Classes Specification

**Topic of Concern**: Brazilian share class structures (Ltda. quotas and S.A. shares)

**One-Sentence Description**: The system manages different share classes with configurable rights, preferences, and restrictions specific to Brazilian corporate structures.

---

## Overview

Share classes define different types of equity with varying rights and preferences. Brazilian companies have specific structures: **Sociedade Limitada (Ltda.)** uses quotas (cotas), while **Sociedade Anônima (S.A.)** uses common shares (ações ordinárias) and preferred shares (ações preferenciais). Each share class can have different voting rights, liquidation preferences, participation rights, and transfer restrictions.

---

## User Stories

### US-1: Create Share Class
**As an** admin user
**I want to** create a new share class with specific rights
**So that** I can issue different types of equity with different terms

### US-2: Configure Voting Rights
**As an** admin user
**I want to** set votes per share for each class
**So that** I can implement structures like non-voting preferred shares

### US-3: Set Liquidation Preference
**As an** admin user
**I want to** configure liquidation preference multiples (1x, 2x)
**So that** I can protect investor downside in exit scenarios

---

## Functional Requirements

### FR-1: Ltda. Support (Quotas)
- Single quota class OR multiple quota classes with different rights
- All quotas typically have equal voting rights
- Support for voto multiplo (multiple voting) quotas

### FR-2: S.A. Support (Shares)
- Ações Ordinárias (common shares): Always have voting rights
- Ações Preferenciais (preferred shares): Can be non-voting or limited voting
- Tag-along rights (direito de tag-along)
- Maximum 2/3 of capital in preferred shares (Brazilian Corporation Law, Art. 15 §2)

### FR-3: Share Class Properties
- Name, type, votes per share
- Liquidation preference multiple
- Participating vs. non-participating
- Right of first refusal (direito de preferência)
- Redemption rights
- Conversion rights

---

## Data Model

```typescript
interface ShareClass {
  id: string;
  companyId: string;
  className: string;
  type: 'QUOTA' | 'COMMON_SHARES' | 'PREFERRED_SHARES';

  // Authorized and issued tracking
  totalAuthorized: string;        // Decimal as string — max shares authorized
  totalIssued: string;            // Decimal as string — currently issued shares

  // Voting
  votesPerShare: number;          // 0 for non-voting preferred

  // Liquidation
  liquidationPreferenceMultiple: number;  // 1.0, 1.5, 2.0, etc.
  participatingRights: boolean;           // True = participating preferred

  // Transfer Restrictions
  rightOfFirstRefusal: boolean;
  lockUpPeriodMonths: number | null;

  // Brazilian Specific
  tagAlongPercentage: number | null;  // 80%, 100% for tag-along rights

  // Blockchain
  blockchainTokenId: string | null;

  // OCT Compliance
  octData: object;

  createdAt: Date;
  updatedAt: Date;
}
```

### Prisma Schema

```prisma
model ShareClass {
  id                           String   @id @default(uuid())
  companyId                    String   @map("company_id")
  className                    String   @map("class_name")
  type                         ShareClassType
  totalAuthorized              Decimal  @default(0) @map("total_authorized")
  totalIssued                  Decimal  @default(0) @map("total_issued")
  votesPerShare                Int      @default(1) @map("votes_per_share")
  liquidationPreferenceMultiple Decimal @default(1.0) @map("liquidation_preference_multiple")
  participatingRights          Boolean  @default(false) @map("participating_rights")
  rightOfFirstRefusal          Boolean  @default(true) @map("right_of_first_refusal")
  lockUpPeriodMonths           Int?     @map("lock_up_period_months")
  tagAlongPercentage           Decimal? @map("tag_along_percentage")
  blockchainTokenId            String?  @map("blockchain_token_id")
  octData                      Json?    @map("oct_data")
  createdAt                    DateTime @default(now()) @map("created_at")
  updatedAt                    DateTime @updatedAt @map("updated_at")

  company      Company       @relation(fields: [companyId], references: [id])
  shareholdings Shareholding[]

  @@unique([companyId, className])
  @@index([companyId])
  @@map("share_classes")
}

enum ShareClassType {
  QUOTA
  COMMON_SHARES
  PREFERRED_SHARES
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/share-classes

Create a new share class.

**Request Body:**

```json
{
  "className": "Ações Preferenciais Classe A",
  "type": "PREFERRED_SHARES",
  "totalAuthorized": "100000",
  "votesPerShare": 0,
  "liquidationPreferenceMultiple": "1.5",
  "participatingRights": true,
  "rightOfFirstRefusal": true,
  "lockUpPeriodMonths": 12,
  "tagAlongPercentage": "100"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "companyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "className": "Ações Preferenciais Classe A",
    "type": "PREFERRED_SHARES",
    "totalAuthorized": "100000",
    "totalIssued": "0",
    "votesPerShare": 0,
    "liquidationPreferenceMultiple": "1.5",
    "participatingRights": true,
    "rightOfFirstRefusal": true,
    "lockUpPeriodMonths": 12,
    "tagAlongPercentage": "100",
    "blockchainTokenId": null,
    "createdAt": "2026-02-23T14:30:00.000Z",
    "updatedAt": "2026-02-23T14:30:00.000Z"
  }
}
```

All responses use the standard `{ "success": true, "data": {...} }` envelope per api-standards.md.

### GET /api/v1/companies/:companyId/share-classes

List all share classes for a company with pagination.

**Query Parameters:** `page`, `limit`, `sort`, `type` (filter by ShareClassType)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "className": "Ações Ordinárias",
      "type": "COMMON_SHARES",
      "totalAuthorized": "500000",
      "totalIssued": "250000",
      "votesPerShare": 1,
      "liquidationPreferenceMultiple": "1.0",
      "participatingRights": false,
      "rightOfFirstRefusal": true,
      "lockUpPeriodMonths": null,
      "tagAlongPercentage": "100",
      "blockchainTokenId": "0x1a2b...3c4d",
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### GET /api/v1/companies/:companyId/share-classes/:id

Get a single share class by ID. Response uses the same `{ "success": true, "data": {...} }` envelope as the create endpoint, with all fields including `octData`.

### PUT /api/v1/companies/:companyId/share-classes/:id

Update a share class. Only mutable fields may be changed (see BR-4).

**Request Body:**

```json
{
  "totalAuthorized": "750000",
  "lockUpPeriodMonths": 6,
  "tagAlongPercentage": "80"
}
```

**Response (200 OK):** Standard `{ "success": true, "data": {...} }` envelope with all share class fields. The `updatedAt` field reflects the modification timestamp.

### DELETE /api/v1/companies/:companyId/share-classes/:id

Delete a share class. Only allowed if no shares have been issued (totalIssued = 0).

**Response (204 No Content):** Empty body.

---

## Business Rules

### BR-1: Ltda. Default
- Ltda. companies start with one "Quotas Ordinárias" class
- All quotas have equal rights by default

### BR-2: S.A. Common Shares Required
- S.A. companies MUST have at least one common share class
- Common shares MUST have voting rights (votesPerShare >= 1)

### BR-3: Preferred Share Limit
- Preferred shares cannot exceed 2/3 of total authorized capital (Brazilian Corporation Law, Art. 15 §2)
- System warns if approaching the limit at 60%

### BR-4: Share Class Immutability After Issuance
- Cannot change `className`, `type`, `votesPerShare`, or `liquidationPreferenceMultiple` after shares are issued (totalIssued > 0)
- Can always update: `totalAuthorized` (increase only), `lockUpPeriodMonths`, `tagAlongPercentage`, `rightOfFirstRefusal`
- Cannot reduce `totalAuthorized` below `totalIssued`

---

## Edge Cases

### EC-1: Preferred Share Limit Enforcement
S.A. companies are limited to 2/3 preferred shares by Brazilian Corporation Law (Art. 15 §2). The system must validate this limit when creating a new preferred share class or issuing shares into an existing one. If a create or issuance would breach the limit, return `422` with a business rule error.

### EC-2: Delete Share Class With Existing Holdings
If a user attempts to delete a share class that has `totalIssued > 0` or active shareholdings, the system must reject the request with `CAP_SHARE_CLASS_IN_USE`. All shares must be transferred or cancelled before the class can be removed.

### EC-3: Immutable Fields After Issuance
Once shares have been issued into a class (`totalIssued > 0`), certain fields become immutable: `className`, `type`, `votesPerShare`, `liquidationPreferenceMultiple`, and `participatingRights`. Attempts to modify these fields must return `422` with a descriptive error indicating which fields are locked.

### EC-4: Share Class With Zero Authorized Shares
Creating a share class with `totalAuthorized = 0` is allowed (placeholder class). However, no shares can be issued into it until `totalAuthorized` is increased via an update. Issuance attempts against a zero-authorized class return `CAP_INSUFFICIENT_SHARES`.

### EC-5: Duplicate Class Name Within Same Company
The `className` must be unique within a company (enforced by the `@@unique([companyId, className])` constraint). Attempts to create a duplicate return `409 Conflict` with error code `COMPANY_SHARE_CLASS_DUPLICATE`.

---

## Error Codes

Error codes for share class operations, per the platform error handling specification.

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `CAP_SHARE_CLASS_NOT_FOUND` | 404 | `errors.cap.shareClassNotFound` | Share class does not exist in this company |
| `CAP_SHARE_CLASS_IN_USE` | 422 | `errors.cap.shareClassInUse` | Cannot delete share class with existing holdings |
| `CAP_INSUFFICIENT_SHARES` | 422 | `errors.cap.insufficientShares` | Issuance exceeds totalAuthorized for the class |
| `COMPANY_SHARE_CLASS_DUPLICATE` | 409 | `errors.company.shareClassDuplicate` | Class name already exists in this company |
| `VAL_INVALID_INPUT` | 400 | `errors.val.invalidInput` | Request body fails validation |

---

## Security Considerations

### Role-Based Access

| Action | Allowed Roles |
|--------|--------------|
| List share classes | ADMIN, FINANCE, LEGAL, INVESTOR (read-only) |
| View share class detail | ADMIN, FINANCE, LEGAL, INVESTOR (read-only) |
| Create share class | ADMIN |
| Update share class | ADMIN |
| Delete share class | ADMIN |

- All endpoints are company-scoped. The authenticated user must be an active member of the company.
- Non-members receive `404 Not Found` (not `403`) to prevent company enumeration.
- All create, update, and delete operations are audit-logged via the `@Auditable()` decorator.

---

## Technical Implementation

### ShareClassService Skeleton

```typescript
@Injectable()
export class ShareClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(companyId: string, dto: CreateShareClassDto): Promise<ShareClass> {
    // 1. Validate company exists and is ACTIVE
    // 2. Check for duplicate className within company
    // 3. Validate preferred share limit for S.A. companies (BR-3)
    // 4. Create share class with totalIssued = 0
    // 5. Return created entity
  }

  async findAll(companyId: string, query: ListShareClassesDto): Promise<PaginatedResult<ShareClass>> {
    // 1. Query with companyId filter
    // 2. Apply optional type filter
    // 3. Apply sort (default: -createdAt)
    // 4. Return paginated result
  }

  async findOne(companyId: string, id: string): Promise<ShareClass> {
    // 1. Find by id AND companyId
    // 2. Throw CAP_SHARE_CLASS_NOT_FOUND if missing
  }

  async update(companyId: string, id: string, dto: UpdateShareClassDto): Promise<ShareClass> {
    // 1. Find existing share class
    // 2. If totalIssued > 0, reject changes to immutable fields (BR-4)
    // 3. Validate totalAuthorized >= totalIssued
    // 4. Update and return
  }

  async remove(companyId: string, id: string): Promise<void> {
    // 1. Find existing share class
    // 2. If totalIssued > 0, throw CAP_SHARE_CLASS_IN_USE
    // 3. Check no active shareholdings reference this class
    // 4. Delete
  }
}
```

---

## Dependencies

### Internal Specifications
- **company-management.md** — Company entity type (Ltda. vs S.A.) determines allowed share class types
- **cap-table-management.md** — Cap table reads share classes to compute ownership breakdown
- **transactions.md** — Share issuance, transfer, and cancellation transactions reference a share class
- **audit-logging.md** — All mutations are audit-logged as `SHAREHOLDER_*` or custom share class events

### External Dependencies
- **PostgreSQL** — Unique constraint enforcement, decimal precision for share counts
- **Base Network (blockchain)** — `blockchainTokenId` links the class to an on-chain token after contract deployment

---

## Success Criteria

- Support both Ltda. and S.A. structures
- Enforce Brazilian corporate law limits (2/3 preferred share cap)
- Immutable fields locked after first issuance
- All CRUD endpoints return standard response envelope
- Pagination, filtering, and sorting on list endpoint
- 100% OCT compliance for share classes
- Audit trail for all share class mutations

---

## Related Specifications

- [Company Management](./company-management.md)
- [Cap Table Management](./cap-table-management.md)
- [Transactions](./transactions.md)
- [Audit Logging](../.claude/rules/audit-logging.md)
- [API Standards](../.claude/rules/api-standards.md)
- [Error Handling](../.claude/rules/error-handling.md)
