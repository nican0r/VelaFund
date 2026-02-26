# Open Finance Integration Specification

**Topic of Concern**: Brazilian Open Finance API integration for automated bank account connectivity, financial data ingestion, AI-assisted transaction categorization, and investor-ready financial reporting

**One-Sentence Description**: The system connects company bank accounts via Brazilian Open Finance (Phase 3a/3b) APIs, regulated by the Central Bank of Brazil (BCB), to automatically ingest financial data for AI analysis, burn rate computation, runway estimation, and investor reporting.

**Complements**:
- `api-standards.md` — response envelope, pagination, export content types
- `audit-logging.md` — audit events for connection lifecycle and data sync
- `error-handling.md` — error codes for Open Finance failures
- `security.md` — KMS encryption for tokens, PII handling for bank data
- `user-permissions.md` — role-based access to financial data
- `notifications.md` — consent expiry and sync failure notifications
- `company-profile.md` — financial highlights surfaced from snapshots

---

## Table of Contents

1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Functional Requirements](#functional-requirements)
4. [Data Models](#data-models)
5. [Connection OAuth Flow](#connection-oauth-flow)
6. [Data Sync Process](#data-sync-process)
7. [Financial Metrics Computation](#financial-metrics-computation)
8. [AI-Assisted Transaction Categorization](#ai-assisted-transaction-categorization)
9. [Scheduled Tasks](#scheduled-tasks)
10. [API Endpoints](#api-endpoints)
11. [Error Codes](#error-codes)
12. [Frontend Specification](#frontend-specification)
13. [Backend Module Structure](#backend-module-structure)
14. [Security Considerations](#security-considerations)
15. [Audit Events](#audit-events)
16. [Edge Cases](#edge-cases)
17. [Dependencies](#dependencies)
18. [Success Criteria](#success-criteria)
19. [Related Specifications](#related-specifications)

---

## Overview

Brazilian Open Finance (formerly Open Banking) is a regulatory initiative by the Central Bank of Brazil (BCB) that mandates financial institutions to share customer data via standardized APIs upon customer consent. The initiative is structured in phases:

- **Phase 3a**: Account data sharing (balances, statements)
- **Phase 3b**: Credit operations, financing, investments

Navia integrates with Phase 3a/3b APIs to provide founders with:
- Automated bank account connectivity (no manual CSV uploads)
- Real-time balance tracking across multiple bank accounts
- AI-categorized transaction history for expense analysis
- Computed financial metrics: burn rate, runway, MRR estimates
- Investor-ready financial dashboards and reports

The integration uses the OAuth 2.0 consent flow defined by BCB's Open Finance specification. Tokens are encrypted at rest using AWS KMS. Data syncs run asynchronously via Bull queue to avoid blocking API requests.

**Regulatory references**:
- Resolução Conjunta BCB/CMN n. 1 (Open Finance framework)
- Resolução BCB n. 32 (API specifications)
- [Open Finance Brasil API Documentation](https://openfinancebrasil.atlassian.net/wiki/spaces/OF)

---

## User Stories

### US-1: Connect Bank Account
**As a** company admin
**I want to** connect my company's bank account via Open Finance
**So that** financial data is automatically imported without manual data entry

**Acceptance Criteria**:
- Select from a list of supported Brazilian banks
- Complete OAuth consent flow at the bank's website
- See connection status after returning to Navia
- Initial data sync begins automatically after connection

### US-2: View Financial Dashboard
**As a** company admin or finance user
**I want to** see a dashboard with key financial metrics (balance, revenue, expenses, burn rate, runway)
**So that** I can understand the company's financial health at a glance

**Acceptance Criteria**:
- Summary cards showing total balance, monthly revenue, monthly expenses, burn rate, and runway
- Revenue vs. expenses chart over the last 12 months
- Expense breakdown by category (pie chart)
- All amounts displayed in Brazilian format (R$ 1.234,56)

### US-3: Browse Categorized Transactions
**As a** company admin or finance user
**I want to** view a list of bank transactions with AI-assigned categories
**So that** I can understand spending patterns and verify categorization

**Acceptance Criteria**:
- Transaction list with date, description, amount, category, and counterparty
- Filter by date range, category, and transaction type (credit/debit)
- Category badges with confidence indicator
- Search by description or counterparty

### US-4: Manage Bank Connections
**As a** company admin
**I want to** view, sync, and disconnect bank connections
**So that** I maintain control over which accounts share data with Navia

**Acceptance Criteria**:
- List of connected banks with status, last sync time, and consent expiry
- Manual "Sync Now" button for on-demand data refresh
- Disconnect button with confirmation dialog
- Warning when consent is about to expire

### US-5: Receive Consent Expiry Alerts
**As a** company admin
**I want to** be notified when a bank consent is about to expire
**So that** I can renew the connection before data sync stops

**Acceptance Criteria**:
- In-app notification 7 days before consent expiration
- Notification includes a direct link to reconnect

### US-6: View Financial Metrics for Due Diligence
**As an** investor viewing the company profile
**I want to** see verified financial metrics (burn rate, runway, MRR)
**So that** I can assess the company's financial health during due diligence

**Acceptance Criteria**:
- Financial highlights section on the company profile (opt-in by founder)
- Metrics sourced from the latest FinancialSnapshot
- "Verified via Open Finance" badge when data comes from bank integration

---

## Functional Requirements

### FR-1: Bank Connection Management
- The system MUST support connecting to Brazilian banks via the Open Finance API
- The system MUST implement the full OAuth 2.0 FAPI (Financial-grade API) consent flow
- The system MUST allow multiple bank connections per company
- The system MUST NOT allow duplicate connections to the same bank for the same company
- The system MUST allow revoking connections at any time
- The system MUST encrypt access and refresh tokens using AWS KMS before storage

### FR-2: Data Synchronization
- The system MUST perform an initial sync (last 90 days) upon successful connection
- The system MUST sync incrementally on subsequent runs (only new transactions since last sync)
- The system MUST deduplicate transactions using the bank's external transaction ID
- The system MUST normalize transaction data to the BankTransaction model
- The system MUST process syncs asynchronously via Bull queue
- The system MUST retry failed syncs up to 3 times with exponential backoff

### FR-3: AI Transaction Categorization
- The system MUST categorize transactions into predefined categories using AI (Claude)
- The system MUST store a confidence score for each categorization
- The system MUST allow manual category override (future: out of MVP scope)
- Categories: REVENUE, PAYROLL, RENT, MARKETING, SOFTWARE, TAXES, LEGAL, UTILITIES, TRAVEL, OTHER

### FR-4: Financial Snapshot Computation
- The system MUST compute monthly FinancialSnapshots after each sync
- The system MUST calculate burn rate as the average of the last 3 months' total expenses
- The system MUST calculate runway as total balance / burn rate (in months)
- The system MUST estimate MRR from recurring credit transactions (same amount +/- 5%, same counterparty, monthly frequency)
- The system MUST store the top expense and revenue categories per snapshot

### FR-5: Scheduled Operations
- The system MUST sync ACTIVE connections daily via a Bull repeatable job
- The system MUST check for consent expiry 7 days in advance and send notifications
- The system MUST automatically refresh expired access tokens using refresh tokens
- The system MUST compute a monthly snapshot on the 1st of each month

### FR-6: Data Isolation
- All bank data MUST be scoped to the company that owns the connection
- Tokens and account numbers MUST be encrypted at the application level (KMS)
- Raw bank API responses MUST NOT be logged (may contain PII)
- Investors can only see aggregated snapshot data, never raw transactions

---

## Data Models

### Prisma Schema

```prisma
model OpenFinanceConnection {
  id               String              @id @default(uuid())
  companyId        String              @map("company_id")
  bankName         String              @map("bank_name")
  bankCode         String              @map("bank_code") // ISPB code
  consentId        String?             @map("consent_id") // Open Finance consent ID
  accessToken      Bytes?              @map("access_token") // KMS encrypted
  refreshToken     Bytes?              @map("refresh_token") // KMS encrypted
  tokenExpiresAt   DateTime?           @map("token_expires_at")
  consentExpiresAt DateTime?           @map("consent_expires_at")
  status           OFConnectionStatus  @default(PENDING_CONSENT)
  syncFrequency    OFSyncFrequency     @default(DAILY) @map("sync_frequency")
  lastSyncAt       DateTime?           @map("last_sync_at")
  lastSyncError    String?             @map("last_sync_error")
  createdAt        DateTime            @default(now()) @map("created_at")
  updatedAt        DateTime            @updatedAt @map("updated_at")

  company  Company       @relation(fields: [companyId], references: [id])
  accounts BankAccount[]

  @@index([companyId])
  @@index([status])
  @@map("open_finance_connections")
}

enum OFConnectionStatus {
  PENDING_CONSENT
  ACTIVE
  EXPIRED
  REVOKED
  ERROR
}

enum OFSyncFrequency {
  DAILY
  WEEKLY
  MANUAL
}

model BankAccount {
  id               String    @id @default(uuid())
  connectionId     String    @map("connection_id")
  companyId        String    @map("company_id")
  accountNumber    Bytes     @map("account_number") // KMS encrypted
  branchCode       String?   @map("branch_code")
  accountType      String    @map("account_type") // CHECKING, SAVINGS
  currency         String    @default("BRL")
  currentBalance   Decimal?  @map("current_balance")
  balanceUpdatedAt DateTime? @map("balance_updated_at")
  createdAt        DateTime  @default(now()) @map("created_at")

  connection   OpenFinanceConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  company      Company               @relation(fields: [companyId], references: [id])
  transactions BankTransaction[]

  @@index([companyId])
  @@map("bank_accounts")
}

model BankTransaction {
  id                 String   @id @default(uuid())
  accountId          String   @map("account_id")
  companyId          String   @map("company_id")
  externalId         String   @map("external_id") // Bank's transaction ID
  date               DateTime
  amount             Decimal
  type               String   // CREDIT, DEBIT
  description        String
  category           String?  // AI-categorized
  categoryConfidence Float?   @map("category_confidence")
  counterparty       String?
  rawData            Json?    @map("raw_data")
  createdAt          DateTime @default(now()) @map("created_at")

  account BankAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  company Company     @relation(fields: [companyId], references: [id])

  @@unique([accountId, externalId])
  @@index([companyId, date])
  @@index([accountId, date])
  @@map("bank_transactions")
}

model FinancialSnapshot {
  id                   String   @id @default(uuid())
  companyId            String   @map("company_id")
  period               String   // "2026-01", "2026-02" (YYYY-MM)
  totalBalance         Decimal  @map("total_balance")
  monthlyRevenue       Decimal  @map("monthly_revenue")
  monthlyExpenses      Decimal  @map("monthly_expenses")
  netCashFlow          Decimal  @map("net_cash_flow")
  burnRate             Decimal  @map("burn_rate") // Avg monthly expenses (last 3 months)
  runway               Int?     // Months of runway at current burn rate
  mrrEstimate          Decimal? @map("mrr_estimate") // Estimated MRR from recurring credits
  transactionCount     Int      @map("transaction_count")
  topExpenseCategories Json?    @map("top_expense_categories") // [{ category, total, percentage }]
  topRevenueCategories Json?    @map("top_revenue_categories") // [{ category, total, percentage }]
  computedAt           DateTime @default(now()) @map("computed_at")

  company Company @relation(fields: [companyId], references: [id])

  @@unique([companyId, period])
  @@index([companyId, period])
  @@map("financial_snapshots")
}
```

### Enum Descriptions

**OFConnectionStatus**:

| Value | Description |
|-------|-------------|
| `PENDING_CONSENT` | Connection initiated, awaiting bank OAuth consent |
| `ACTIVE` | Consent granted, tokens valid, syncing enabled |
| `EXPIRED` | Consent or tokens expired, needs renewal |
| `REVOKED` | User revoked the connection |
| `ERROR` | Connection in error state (e.g., repeated sync failures) |

**OFSyncFrequency**:

| Value | Description |
|-------|-------------|
| `DAILY` | Automatic daily sync (default) |
| `WEEKLY` | Automatic weekly sync |
| `MANUAL` | No automatic sync, manual trigger only |

### Transaction Categories

| Category | Description | Examples |
|----------|-------------|---------|
| `REVENUE` | Revenue / sales income | Customer payments, subscription fees |
| `PAYROLL` | Employee compensation | Salaries, benefits, contractor payments |
| `RENT` | Facilities and office costs | Office rent, coworking fees |
| `MARKETING` | Marketing and advertising | Ad spend, events, PR |
| `SOFTWARE` | Software and tools | SaaS subscriptions, hosting |
| `TAXES` | Tax payments | Municipal, state, federal taxes |
| `LEGAL` | Legal and compliance | Law firm fees, registrations |
| `UTILITIES` | Utilities and services | Internet, phone, electricity |
| `TRAVEL` | Travel and transportation | Flights, hotels, ride-sharing |
| `OTHER` | Uncategorized | Anything not matching above categories |

### Top Categories JSON Structure

```typescript
interface CategoryBreakdown {
  category: string;   // e.g., "PAYROLL"
  total: string;      // Decimal as string, e.g., "45000.00"
  percentage: number;  // e.g., 35.2
}
```

Example `topExpenseCategories`:
```json
[
  { "category": "PAYROLL", "total": "45000.00", "percentage": 45.0 },
  { "category": "SOFTWARE", "total": "12000.00", "percentage": 12.0 },
  { "category": "RENT", "total": "8000.00", "percentage": 8.0 },
  { "category": "MARKETING", "total": "6500.00", "percentage": 6.5 },
  { "category": "OTHER", "total": "28500.00", "percentage": 28.5 }
]
```

---

## Connection OAuth Flow

### Flow Diagram

```
Founder clicks "Connect Bank"
  │
  ├─ [selects bank from list] ─→ POST /api/v1/companies/:companyId/open-finance/connections
  │     │
  │     ├─ [bank not already connected] ─→ Backend registers consent request with bank API
  │     │     │
  │     │     ├─ [consent request accepted] ─→ Return bank authorization URL
  │     │     │     │
  │     │     │     └─ Frontend redirects founder to bank auth page
  │     │     │           │
  │     │     │           ├─ [founder grants consent] ─→ Bank redirects to callback URL
  │     │     │           │     │
  │     │     │           │     ├─ [valid callback] ─→ Exchange code for tokens
  │     │     │           │     │     │
  │     │     │           │     │     ├─ [token exchange success] ─→ Store encrypted tokens
  │     │     │           │     │     │     │
  │     │     │           │     │     │     ├─ Connection → ACTIVE
  │     │     │           │     │     │     └─ Queue initial sync job
  │     │     │           │     │     │
  │     │     │           │     │     └─ [token exchange fails] ─→ Connection → ERROR
  │     │     │           │     │
  │     │     │           │     └─ [invalid callback params] ─→ 400 OF_INVALID_CALLBACK
  │     │     │           │
  │     │     │           └─ [founder denies consent] ─→ Bank redirects with error
  │     │     │                 └─ Connection deleted
  │     │     │
  │     │     └─ [bank API unavailable] ─→ 502 OF_BANK_UNAVAILABLE
  │     │
  │     └─ [bank already connected] ─→ 409 OF_ALREADY_CONNECTED
  │
  └─ [no bank selected] ─→ Client-side validation prevents submission
```

### Step-by-Step Flow

```
PRECONDITION: User is authenticated, has ADMIN role in the company
ACTOR: Company admin (founder)
TRIGGER: User clicks "Connect Bank" button

1. [UI] User navigates to Open Finance connections page
2. [UI] User clicks "Connect Bank" button
3. [UI] Bank selection dialog opens with supported banks list
4. [UI] User selects a bank from the list
5. [Frontend] Sends POST /api/v1/companies/:companyId/open-finance/connections
   Body: { "bankCode": "00000000" }
6. [Backend] Validates authentication
   → IF unauthenticated: return 401
7. [Backend] Validates authorization (role: ADMIN)
   → IF unauthorized: return 404
8. [Backend] Checks for existing ACTIVE connection to same bank
   → IF already connected: return 409 OF_ALREADY_CONNECTED
9. [Backend] Creates OpenFinanceConnection record (status: PENDING_CONSENT)
10. [Backend] Registers consent request with bank's Open Finance API
    → IF bank API unavailable: return 502 OF_BANK_UNAVAILABLE
11. [Backend] Returns 201 with { authorizationUrl, connectionId }
12. [Frontend] Redirects user to bank's authorization URL
13. [Bank] User authenticates at bank and reviews consent request
14. [Bank] User grants consent
15. [Bank] Redirects to callback URL: GET /api/v1/open-finance/callback?code=...&state=...
16. [Backend] Validates state parameter matches stored connection
    → IF invalid: return 400 OF_INVALID_CALLBACK
17. [Backend] Exchanges authorization code for access/refresh tokens
    → IF exchange fails: mark connection as ERROR, redirect to error page
18. [Backend] Encrypts tokens with KMS and stores in database
19. [Backend] Updates connection status to ACTIVE
20. [Backend] Queues initial sync job via Bull
21. [Backend] Redirects user to connections page with success parameter
22. [UI] Shows success toast: "Banco conectado com sucesso"
23. [System] Bull worker processes initial sync (fetches accounts and transactions)
24. [System] Sends OPEN_FINANCE_SYNC_COMPLETE notification when done

POSTCONDITION: Connection is ACTIVE, initial transaction data is being synced
SIDE EFFECTS: Audit log (OF_CONNECTION_CREATED, OF_CONSENT_GRANTED), initial sync job queued
```

### OAuth Technical Details

The Open Finance Brasil specification mandates Financial-grade API (FAPI) security:

- **Authorization**: OAuth 2.0 Authorization Code Flow with PKCE
- **Token endpoint**: mTLS client authentication
- **ID Tokens**: Signed JWTs verified against bank's JWKS
- **Consent duration**: Typically 12 months (bank-dependent)
- **Scopes**: `accounts` (read account data), `transactions` (read transaction history)
- **State parameter**: UUID linked to the OpenFinanceConnection record, used to validate callbacks and prevent CSRF

---

## Data Sync Process

### Sync Flow (Bull Queue)

```
Sync Job Triggered (manual, scheduled, or initial)
  │
  ├─ 1. Validate connection status is ACTIVE
  │     → IF not ACTIVE: skip, log warning
  │
  ├─ 2. Check token expiry
  │     │
  │     ├─ [token expired] ─→ Refresh token via bank API
  │     │     │
  │     │     ├─ [refresh success] ─→ Update stored tokens, continue
  │     │     └─ [refresh fails] ─→ Mark connection EXPIRED, send notification, STOP
  │     │
  │     └─ [token valid] ─→ Continue
  │
  ├─ 3. Fetch accounts from bank API
  │     │
  │     ├─ [success] ─→ Upsert BankAccount records
  │     └─ [failure] ─→ Retry (up to 3x), then mark sync failed
  │
  ├─ 4. For each account: fetch transactions
  │     │
  │     ├─ [initial sync] ─→ Fetch last 90 days
  │     └─ [incremental sync] ─→ Fetch since lastSyncAt
  │
  ├─ 5. Normalize and deduplicate transactions
  │     │
  │     └─ Upsert using (accountId, externalId) unique constraint
  │
  ├─ 6. AI-assisted categorization (batch)
  │     │
  │     └─ Send uncategorized transactions to Claude for category assignment
  │
  ├─ 7. Update account balances
  │
  ├─ 8. Compute/update FinancialSnapshot for affected months
  │
  └─ 9. Update connection lastSyncAt, clear lastSyncError
```

### Bull Queue Configuration

```typescript
const OPEN_FINANCE_SYNC_QUEUE_CONFIG = {
  name: 'open-finance-sync',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 300000, // 5 minutes max per sync job
  },
};
```

### Sync Job Types

| Job Type | Trigger | Data Range |
|----------|---------|------------|
| `initial-sync` | After OAuth callback success | Last 90 days |
| `scheduled-sync` | Daily repeatable job | Since lastSyncAt |
| `manual-sync` | User clicks "Sync Now" | Since lastSyncAt |
| `token-refresh` | Before sync if token expired | N/A (token only) |

---

## Financial Metrics Computation

### Metric Definitions

| Metric | Formula | Description |
|--------|---------|-------------|
| **Total Balance** | Sum of `currentBalance` across all BankAccounts | Current total cash position |
| **Monthly Revenue** | Sum of CREDIT transactions categorized as REVENUE for the month | Total inflows classified as revenue |
| **Monthly Expenses** | Sum of absolute values of DEBIT transactions for the month | Total outflows |
| **Net Cash Flow** | Monthly Revenue - Monthly Expenses | Net change in cash |
| **Burn Rate** | Average of Monthly Expenses for the last 3 months | Average monthly spending rate |
| **Runway** | Total Balance / Burn Rate | Months until cash reaches zero |
| **MRR Estimate** | Sum of recurring CREDIT amounts (see below) | Estimated monthly recurring revenue |

### MRR Estimation Algorithm

```typescript
function estimateMRR(transactions: BankTransaction[], months: number = 3): Decimal {
  // 1. Group CREDIT transactions by counterparty
  // 2. For each counterparty, identify transactions appearing in at least
  //    (months - 1) of the last `months` months
  // 3. Amounts must be within +/- 5% to count as "recurring"
  // 4. MRR = sum of the most recent recurring transaction amount per counterparty

  const recurring = identifyRecurringCredits(transactions, months);
  return recurring.reduce((sum, r) => sum.add(r.lastAmount), new Decimal(0));
}
```

Recurring credit identification:
1. Group all CREDIT transactions by normalized counterparty name (lowercase, trimmed)
2. For each group, check if transactions appear in at least 2 of the last 3 months
3. For qualifying groups, verify that the amounts are within +/- 5% of each other (allowing for minor variations in subscription fees, exchange rates, etc.)
4. Sum the most recent transaction amount from each qualifying group

### Snapshot Computation Trigger

FinancialSnapshots are recomputed:
- After every successful data sync (for affected months)
- On the 1st of each month (scheduled job, for the previous month)
- The snapshot is an **upsert** on `(companyId, period)` to avoid duplicates

---

## AI-Assisted Transaction Categorization

### Approach

Uncategorized transactions are sent to Claude in batches for category assignment. The prompt includes the transaction description, amount, type, and counterparty (if available).

### Batch Processing

```typescript
interface CategorizationRequest {
  transactionId: string;
  description: string;
  amount: string;     // Decimal as string
  type: 'CREDIT' | 'DEBIT';
  counterparty: string | null;
}

interface CategorizationResult {
  transactionId: string;
  category: string;
  confidence: number; // 0.0 to 1.0
}
```

### Categorization Rules

- Batch size: up to 50 transactions per AI call
- Confidence threshold: categories with confidence < 0.5 are marked as `OTHER`
- PII in descriptions is NOT sent to the AI (bank names, account numbers are stripped)
- Counterparty names are sent (they are business names, not PII)
- Results are stored on the BankTransaction record (`category`, `categoryConfidence`)

### Prompt Strategy

The categorization prompt includes:
- The list of valid categories with descriptions
- Transaction data (description, amount, type, counterparty)
- Instruction to return a JSON array of `{ transactionId, category, confidence }`
- Context that these are Brazilian business transactions (Portuguese descriptions expected)

### Fallback

If the AI service is unavailable:
- Transactions remain uncategorized (`category = null`)
- Snapshot computation proceeds using uncategorized transactions (assigned to `OTHER` in breakdowns)
- Categorization is retried on the next sync cycle

---

## Scheduled Tasks

### Daily Sync Job

Runs at 06:00 UTC (03:00 BRT) daily:

```typescript
const dailySyncJob = {
  name: 'daily-sync',
  repeat: { cron: '0 6 * * *' }, // 06:00 UTC daily
  handler: async () => {
    const activeConnections = await prisma.openFinanceConnection.findMany({
      where: {
        status: 'ACTIVE',
        syncFrequency: { in: ['DAILY'] },
      },
    });

    for (const connection of activeConnections) {
      await syncQueue.add('scheduled-sync', {
        connectionId: connection.id,
        companyId: connection.companyId,
      });
    }
  },
};
```

### Weekly Sync Job

Runs at 06:00 UTC every Monday:

```typescript
const weeklySyncJob = {
  name: 'weekly-sync',
  repeat: { cron: '0 6 * * 1' }, // 06:00 UTC every Monday
  handler: async () => {
    const weeklyConnections = await prisma.openFinanceConnection.findMany({
      where: {
        status: 'ACTIVE',
        syncFrequency: 'WEEKLY',
      },
    });
    // Queue sync for each
  },
};
```

### Consent Expiry Check

Runs daily at 09:00 UTC:

```typescript
const consentExpiryCheck = {
  name: 'consent-expiry-check',
  repeat: { cron: '0 9 * * *' },
  handler: async () => {
    const sevenDaysFromNow = addDays(new Date(), 7);

    const expiring = await prisma.openFinanceConnection.findMany({
      where: {
        status: 'ACTIVE',
        consentExpiresAt: { lte: sevenDaysFromNow },
      },
    });

    for (const connection of expiring) {
      // Send OPEN_FINANCE_CONSENT_EXPIRING notification to company admins
    }
  },
};
```

### Monthly Snapshot Generation

Runs on the 1st of each month at 08:00 UTC:

```typescript
const monthlySnapshot = {
  name: 'monthly-snapshot',
  repeat: { cron: '0 8 1 * *' },
  handler: async () => {
    const previousMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

    const companiesWithConnections = await prisma.openFinanceConnection.findMany({
      where: { status: 'ACTIVE' },
      select: { companyId: true },
      distinct: ['companyId'],
    });

    for (const { companyId } of companiesWithConnections) {
      await snapshotService.computeSnapshot(companyId, previousMonth);
    }
  },
};
```

### Token Refresh

Handled inline during sync: before each sync job, the worker checks if the access token has expired. If expired, it attempts to refresh using the refresh token. If the refresh fails, the connection is marked as `EXPIRED` and a notification is sent.

---

## API Endpoints

### Initiate Bank Connection

```
POST /api/v1/companies/:companyId/open-finance/connections
```

**Roles**: ADMIN

**Request Body**:
```json
{
  "bankCode": "00000000"
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid",
    "bankName": "Banco do Brasil",
    "bankCode": "00000000",
    "status": "PENDING_CONSENT",
    "authorizationUrl": "https://auth.bb.com.br/openfinance/consent?..."
  }
}
```

**Error Responses**:
- `409 Conflict` — `OF_ALREADY_CONNECTED` — bank already connected for this company
- `502 Bad Gateway` — `OF_BANK_UNAVAILABLE` — bank API unreachable

### OAuth Callback

```
GET /api/v1/open-finance/callback?code=...&state=...
```

**Notes**:
- This is a global endpoint (not company-scoped) because the bank redirects here
- The `state` parameter maps to the `connectionId`, which links to the company
- On success: redirects to `/companies/:companyId/open-finance?connected=true`
- On failure: redirects to `/companies/:companyId/open-finance?error=connection_failed`

**Error Response** (rendered as redirect):
- `400 Bad Request` — `OF_INVALID_CALLBACK` — missing or invalid state/code parameters

### List Connections

```
GET /api/v1/companies/:companyId/open-finance/connections
```

**Roles**: ADMIN, FINANCE

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "bankName": "Banco do Brasil",
      "bankCode": "00000000",
      "status": "ACTIVE",
      "syncFrequency": "DAILY",
      "lastSyncAt": "2026-02-25T06:00:00.000Z",
      "lastSyncError": null,
      "consentExpiresAt": "2027-02-25T00:00:00.000Z",
      "accountCount": 2,
      "createdAt": "2026-02-01T10:00:00.000Z"
    }
  ]
}
```

**Notes**:
- Does NOT return tokens (never exposed to frontend)
- Includes `accountCount` as a computed field for display

### Revoke Connection

```
DELETE /api/v1/companies/:companyId/open-finance/connections/:id
```

**Roles**: ADMIN

**Behavior**:
1. Revoke consent at the bank's API (best effort)
2. Delete encrypted tokens from database
3. Mark connection as `REVOKED`
4. Cascade delete associated BankAccounts and BankTransactions

**Response**: `204 No Content`

### Trigger Manual Sync

```
POST /api/v1/companies/:companyId/open-finance/connections/:id/sync
```

**Roles**: ADMIN, FINANCE

**Validation**:
- Connection must be in `ACTIVE` status
- Rate limited: maximum 1 manual sync per connection per hour

**Response** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "jobId": "bull-job-uuid",
    "message": "Sync queued successfully"
  }
}
```

**Error Responses**:
- `422 Unprocessable Entity` — connection not in ACTIVE status
- `429 Too Many Requests` — manual sync rate limit exceeded

### List Financial Snapshots

```
GET /api/v1/companies/:companyId/open-finance/snapshots
```

**Roles**: ADMIN, FINANCE

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 12 | Items per page (max 24) |
| `sort` | string | `-period` | Sort by period |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "period": "2026-02",
      "totalBalance": "250000.00",
      "monthlyRevenue": "85000.00",
      "monthlyExpenses": "62000.00",
      "netCashFlow": "23000.00",
      "burnRate": "58000.00",
      "runway": 4,
      "mrrEstimate": "72000.00",
      "transactionCount": 145,
      "topExpenseCategories": [...],
      "topRevenueCategories": [...],
      "computedAt": "2026-02-25T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 6,
    "page": 1,
    "limit": 12,
    "totalPages": 1
  }
}
```

### Get Latest Snapshot

```
GET /api/v1/companies/:companyId/open-finance/snapshots/latest
```

**Roles**: ADMIN, FINANCE, INVESTOR (INVESTOR sees limited fields)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "period": "2026-02",
    "totalBalance": "250000.00",
    "monthlyRevenue": "85000.00",
    "monthlyExpenses": "62000.00",
    "netCashFlow": "23000.00",
    "burnRate": "58000.00",
    "runway": 4,
    "mrrEstimate": "72000.00",
    "transactionCount": 145,
    "topExpenseCategories": [...],
    "topRevenueCategories": [...],
    "computedAt": "2026-02-25T08:00:00.000Z"
  }
}
```

**INVESTOR Role Response** (limited fields):
```json
{
  "success": true,
  "data": {
    "period": "2026-02",
    "monthlyRevenue": "85000.00",
    "burnRate": "58000.00",
    "runway": 4,
    "mrrEstimate": "72000.00"
  }
}
```

### List Transactions

```
GET /api/v1/companies/:companyId/open-finance/transactions
```

**Roles**: ADMIN, FINANCE

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `dateFrom` | ISO 8601 date | — | Transactions after this date |
| `dateTo` | ISO 8601 date | — | Transactions before this date |
| `category` | string | — | Filter by category (e.g., `PAYROLL`) |
| `type` | string | — | Filter by type (`CREDIT` or `DEBIT`) |
| `search` | string | — | Search description or counterparty |
| `accountId` | UUID | — | Filter by specific bank account |
| `sort` | string | `-date` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "accountId": "uuid",
      "date": "2026-02-24T00:00:00.000Z",
      "amount": "-4500.00",
      "type": "DEBIT",
      "description": "PAGAMENTO FOLHA - FEV/2026",
      "category": "PAYROLL",
      "categoryConfidence": 0.95,
      "counterparty": "GUSTO PAGAMENTOS LTDA"
    }
  ],
  "meta": {
    "total": 145,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

## Error Codes

| Code | HTTP Status | Message Key | Description |
|------|-------------|-------------|-------------|
| `OF_CONNECTION_FAILED` | 502 | `errors.openFinance.connectionFailed` | Failed to establish connection with bank |
| `OF_CONSENT_EXPIRED` | 422 | `errors.openFinance.consentExpired` | Bank consent has expired, needs renewal |
| `OF_SYNC_FAILED` | 500 | `errors.openFinance.syncFailed` | Data synchronization failed after retries |
| `OF_BANK_UNAVAILABLE` | 502 | `errors.openFinance.bankUnavailable` | Bank's Open Finance API is unreachable |
| `OF_INVALID_CALLBACK` | 400 | `errors.openFinance.invalidCallback` | Invalid or missing OAuth callback parameters |
| `OF_ALREADY_CONNECTED` | 409 | `errors.openFinance.alreadyConnected` | Bank already connected for this company |
| `OF_TOKEN_REFRESH_FAILED` | 502 | `errors.openFinance.tokenRefreshFailed` | Failed to refresh expired access token |
| `OF_CONNECTION_NOT_FOUND` | 404 | `errors.openFinance.connectionNotFound` | Connection does not exist or is not accessible |
| `OF_SYNC_RATE_LIMITED` | 429 | `errors.openFinance.syncRateLimited` | Manual sync rate limit exceeded (max 1/hour) |

### i18n Translations

**PT-BR** (`messages/pt-BR.json`):
```json
{
  "errors": {
    "openFinance": {
      "connectionFailed": "Falha ao conectar com o banco. Tente novamente.",
      "consentExpired": "O consentimento do banco expirou. Reconecte sua conta.",
      "syncFailed": "Falha na sincronizacao dos dados financeiros.",
      "bankUnavailable": "O banco esta temporariamente indisponivel. Tente mais tarde.",
      "invalidCallback": "Parametros de retorno do banco invalidos.",
      "alreadyConnected": "Este banco ja esta conectado para esta empresa.",
      "tokenRefreshFailed": "Falha ao renovar o acesso ao banco. Reconecte sua conta.",
      "connectionNotFound": "Conexao bancaria nao encontrada.",
      "syncRateLimited": "Sincronizacao manual limitada a 1 vez por hora."
    }
  }
}
```

**EN** (`messages/en.json`):
```json
{
  "errors": {
    "openFinance": {
      "connectionFailed": "Failed to connect with bank. Please try again.",
      "consentExpired": "Bank consent has expired. Please reconnect your account.",
      "syncFailed": "Financial data synchronization failed.",
      "bankUnavailable": "Bank is temporarily unavailable. Please try later.",
      "invalidCallback": "Invalid bank callback parameters.",
      "alreadyConnected": "This bank is already connected for this company.",
      "tokenRefreshFailed": "Failed to refresh bank access. Please reconnect your account.",
      "connectionNotFound": "Bank connection not found.",
      "syncRateLimited": "Manual sync limited to once per hour."
    }
  }
}
```

---

## Frontend Specification

### Page Routing

| Route | Component | Description |
|-------|-----------|-------------|
| `/companies/:companyId/open-finance` | `OpenFinancePage` | Bank connections management + financial dashboard |
| `/companies/:companyId/open-finance/transactions` | `TransactionsPage` | Full transaction list with filters |

### Bank Connection Management Section

```
┌─────────────────────────────────────────────────────────┐
│  h1: Open Finance                  [+ Connect Bank]     │
│  body-sm: Conecte suas contas bancarias para analise    │
│           financeira automatica                          │
├─────────────────────────────────────────────────────────┤
│  Tabs: [Connections] [Financial Dashboard] [Transactions]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Connected Banks                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [Bank Logo] │ Banco do Brasil      │ [Active]     │ │
│  │             │ Ultima sync: 25/02   │ Exp: 02/2027 │ │
│  │             │                      │ [Sync] [X]   │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [Bank Logo] │ Itau Unibanco       │ [Expired]     │ │
│  │             │ Consentimento expirou│              │ │
│  │             │                      │ [Reconectar] │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Empty State (no connections):                           │
│  "Nenhum banco conectado"                                │
│  "Conecte sua conta para ver dados financeiros"          │
│  [+ Connect Bank]                                        │
└─────────────────────────────────────────────────────────┘
```

**Connection card details**:
- Bank logo/icon (32px) with bank name
- Status badge: Active = green, Expired = yellow/cream, Error = red, Pending = gray
- Last sync timestamp in Brazilian format (dd/MM/yyyy HH:mm)
- Consent expiry date
- "Sync Now" button (ghost variant, only for ACTIVE connections)
- Disconnect button (ghost destructive, opens confirmation dialog)
- "Reconnect" button shown for EXPIRED connections

### Bank Selection Dialog

```
┌────────────────────────────────────────┐
│  Connect Bank                      [X] │
├────────────────────────────────────────┤
│  Search: [Search banks...]             │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ [Logo] Banco do Brasil           │  │
│  │ [Logo] Bradesco                  │  │
│  │ [Logo] Itau Unibanco             │  │
│  │ [Logo] Santander Brasil          │  │
│  │ [Logo] Nubank                    │  │
│  │ [Logo] Inter                     │  │
│  │ [Logo] BTG Pactual               │  │
│  │ [Logo] Caixa Economica Federal   │  │
│  └──────────────────────────────────┘  │
│                                         │
│  [Cancel]                   [Connect]  │
└────────────────────────────────────────┘
```

**Dialog behavior**:
1. Fetch supported banks list from backend (or static list)
2. User searches/selects a bank
3. "Connect" button sends POST request
4. On success: browser navigates to bank's authorization URL
5. After bank auth: user is redirected back to the connections page

### Financial Dashboard Section

```
┌─────────────────────────────────────────────────────────┐
│  Financial Dashboard                                     │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐│
│  │ Total  │ │Monthly │ │Monthly │ │ Burn   │ │Runway ││
│  │Balance │ │Revenue │ │Expenses│ │ Rate   │ │       ││
│  │        │ │        │ │        │ │        │ │       ││
│  │R$250k  │ │R$85k   │ │R$62k   │ │R$58k   │ │4 meses││
│  │        │ │+12%    │ │-3%     │ │-5%     │ │       ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └───────┘│
│                                                          │
│  ┌──────────────────────────┐ ┌────────────────────────┐│
│  │ Revenue vs Expenses      │ │ Expense Breakdown      ││
│  │ (Line Chart, 12 months)  │ │ (Pie Chart)            ││
│  │                          │ │                         ││
│  │  $                       │ │    ┌────┐              ││
│  │  |    /\   /\            │ │   /      \   PAYROLL   ││
│  │  |   /  \ /  \  Revenue  │ │  | 45%    |  SOFTWARE ││
│  │  |  /    X    \          │ │  |        |  RENT     ││
│  │  | /   /  \    Expenses  │ │   \      /   OTHER   ││
│  │  |/   /    \             │ │    └────┘              ││
│  │  └────────────────       │ │                         ││
│  │    J F M A M J J A S O N │ │                         ││
│  └──────────────────────────┘ └────────────────────────┘│
│                                                          │
│  MRR Estimate: R$ 72.000,00                              │
│  body-sm: Baseado em transacoes recorrentes dos          │
│           ultimos 3 meses                                │
└─────────────────────────────────────────────────────────┘
```

**Dashboard details**:
- 5 stat cards across the top (same pattern as design-system.md A.1)
- Revenue card highlighted (blue-600 bg) if positive net cash flow
- Percentage change compared to previous month
- Line chart: Revenue (blue-600) and Expenses (red) lines, 12-month range
- Pie chart: Expense breakdown by category using the chart color palette
- MRR estimate shown below charts with explanatory text
- All amounts formatted as `R$ 1.234,56` (Brazilian format)

### Transaction List Section

```
┌─────────────────────────────────────────────────────────┐
│  Transactions                          [Export CSV]      │
│                                                          │
│  Filters:                                                │
│  [Date From] [Date To] [Category ▾] [Type ▾] [Search]   │
├─────────────────────────────────────────────────────────┤
│  Date       │ Description          │ Category  │ Amount  │
├─────────────────────────────────────────────────────────┤
│  24/02/2026 │ PAGAMENTO FOLHA FEV  │ [Payroll] │-R$4.500│
│  23/02/2026 │ PIX CLIENTE ABC LTDA │ [Revenue] │+R$8.200│
│  22/02/2026 │ FATURA AWS           │ [Software]│-R$1.350│
│  21/02/2026 │ ALUGUEL FEV          │ [Rent]    │-R$3.000│
│  ...                                                     │
├─────────────────────────────────────────────────────────┤
│  Showing 1-20 of 145                  < 1 2 3 4 5 6 7 > │
└─────────────────────────────────────────────────────────┘
```

**Transaction list details**:
- Standard data table pattern (design-system.md Section 6.3)
- Date column: `dd/MM/yyyy` format
- Description: truncated with ellipsis if too long
- Category: colored pill badge (same style as status badges)
- Amount: right-aligned, green text for credits (prefixed with +), red for debits (prefixed with -)
- All amounts in Brazilian format (`R$ 1.234,56`)
- Filters: date range picker, category dropdown (multi-select), type toggle (Credit/Debit/All), text search
- Pagination: standard pagination with page size selector (20, 50, 100)
- Export CSV button (triggers download)

### Category Badge Colors

| Category | Background | Text |
|----------|-----------|------|
| REVENUE | `green-100` | `green-700` |
| PAYROLL | `blue-50` | `blue-600` |
| RENT | `cream-100` | `cream-700` |
| MARKETING | `orange-50` | `orange-600` |
| SOFTWARE | `purple-50` | `purple-600` |
| TAXES | `red-50` | `red-600` |
| LEGAL | `gray-100` | `gray-700` |
| UTILITIES | `teal-50` | `teal-600` |
| TRAVEL | `indigo-50` | `indigo-600` |
| OTHER | `gray-100` | `gray-500` |

### i18n Keys

Namespace: `openFinance.*`

```json
{
  "openFinance": {
    "title": "Open Finance",
    "description": "Conecte suas contas bancarias para analise financeira automatica",
    "connectBank": "Conectar Banco",
    "selectBank": "Selecione um banco",
    "searchBanks": "Buscar bancos...",
    "connections": "Conexoes",
    "financialDashboard": "Painel Financeiro",
    "transactions": "Transacoes",
    "noConnections": "Nenhum banco conectado",
    "noConnectionsDescription": "Conecte sua conta para ver dados financeiros",
    "syncNow": "Sincronizar Agora",
    "syncQueued": "Sincronizacao iniciada",
    "disconnect": "Desconectar",
    "disconnectConfirm": "Tem certeza que deseja desconectar este banco? Todos os dados financeiros associados serao removidos.",
    "reconnect": "Reconectar",
    "lastSync": "Ultima sincronizacao",
    "consentExpires": "Consentimento expira em",
    "consentExpired": "Consentimento expirado",
    "totalBalance": "Saldo Total",
    "monthlyRevenue": "Receita Mensal",
    "monthlyExpenses": "Despesas Mensais",
    "burnRate": "Burn Rate",
    "runway": "Runway",
    "runwayMonths": "{count} meses",
    "mrrEstimate": "MRR Estimado",
    "mrrDescription": "Baseado em transacoes recorrentes dos ultimos 3 meses",
    "revenueVsExpenses": "Receita vs Despesas",
    "expenseBreakdown": "Composicao de Despesas",
    "revenueBreakdown": "Composicao de Receita",
    "exportCsv": "Exportar CSV",
    "noTransactions": "Nenhuma transacao encontrada",
    "filterByCategory": "Filtrar por categoria",
    "filterByType": "Filtrar por tipo",
    "dateFrom": "Data inicio",
    "dateTo": "Data fim",
    "credit": "Credito",
    "debit": "Debito",
    "syncStatus": {
      "ACTIVE": "Ativo",
      "PENDING_CONSENT": "Aguardando consentimento",
      "EXPIRED": "Expirado",
      "REVOKED": "Revogado",
      "ERROR": "Erro"
    },
    "categories": {
      "REVENUE": "Receita",
      "PAYROLL": "Folha de Pagamento",
      "RENT": "Aluguel",
      "MARKETING": "Marketing",
      "SOFTWARE": "Software",
      "TAXES": "Impostos",
      "LEGAL": "Juridico",
      "UTILITIES": "Utilidades",
      "TRAVEL": "Viagens",
      "OTHER": "Outros"
    },
    "notifications": {
      "syncComplete": "Sincronizacao financeira concluida",
      "consentExpiring": "Consentimento bancario expira em 7 dias"
    }
  }
}
```

---

## Backend Module Structure

```
backend/src/open-finance/
  open-finance.module.ts               # Module registration, Bull queue, imports
  open-finance.controller.ts           # REST endpoints for connections, snapshots, transactions
  services/
    connection.service.ts              # Manage bank connections (create, list, revoke)
    oauth.service.ts                   # Handle OAuth flows with banks (consent, callback, token exchange)
    sync.service.ts                    # Fetch and normalize financial data from bank APIs
    snapshot.service.ts                # Compute financial metrics and FinancialSnapshot records
    categorization.service.ts          # AI-assisted transaction categorization via Claude
  processors/
    sync.processor.ts                  # Bull queue processor for async sync jobs
  dto/
    create-connection.dto.ts           # { bankCode: string }
    list-transactions-query.dto.ts     # Pagination + filters (dateFrom, dateTo, category, type, search)
    list-snapshots-query.dto.ts        # Pagination + sort
  guards/
    sync-rate-limit.guard.ts           # Rate limit manual sync to 1/hour per connection
```

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OpenFinanceController } from './open-finance.controller';
import { ConnectionService } from './services/connection.service';
import { OAuthService } from './services/oauth.service';
import { SyncService } from './services/sync.service';
import { SnapshotService } from './services/snapshot.service';
import { CategorizationService } from './services/categorization.service';
import { SyncProcessor } from './processors/sync.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'open-finance-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [OpenFinanceController],
  providers: [
    ConnectionService,
    OAuthService,
    SyncService,
    SnapshotService,
    CategorizationService,
    SyncProcessor,
  ],
  exports: [SnapshotService], // Exported for company-profile module to access latest snapshot
})
export class OpenFinanceModule {}
```

---

## Security Considerations

### Token Security

| Aspect | Requirement |
|--------|------------|
| Access token storage | AES-256-GCM encrypted via AWS KMS before database persistence |
| Refresh token storage | AES-256-GCM encrypted via AWS KMS before database persistence |
| Token exposure | Tokens are NEVER returned in API responses to the frontend |
| Token decryption | Only decrypted in-memory during sync operations, immediately discarded after use |
| Token rotation | Access tokens refreshed automatically when expired; refresh tokens replaced on each use if the bank provides a new one |

### Data Security

| Aspect | Requirement |
|--------|------------|
| Account numbers | KMS encrypted at application level (`accountNumber` field is `Bytes`) |
| Transaction data | Stored in plaintext (descriptions, amounts are not PII; counterparty names are business names) |
| Raw bank responses | Stored in `rawData` JSON field for debugging; stripped of PII (account holder names, CPF references) |
| Company isolation | All queries include `companyId` filter; Prisma middleware enforces scoping |
| Bank API communication | mTLS required per Open Finance Brasil specification |
| Consent scope | Read-only: `accounts` (balance) and `transactions` (statement) scopes only |

### API Security

| Aspect | Requirement |
|--------|------------|
| Callback validation | `state` parameter verified against stored connection record to prevent CSRF |
| PKCE | Authorization Code Flow with PKCE to prevent code interception |
| Rate limiting | Manual sync: 1 request per connection per hour |
| Role restrictions | Connection management: ADMIN only. Data viewing: ADMIN, FINANCE. Aggregated snapshots: ADMIN, FINANCE, INVESTOR (limited) |

### Audit Trail

All connection lifecycle events and data access are audit-logged (see [Audit Events](#audit-events)).

---

## Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `OF_CONNECTION_CREATED` | OpenFinanceConnection | USER | Connection initiated (PENDING_CONSENT) |
| `OF_CONSENT_GRANTED` | OpenFinanceConnection | USER | OAuth callback successful, consent received |
| `OF_CONNECTION_REVOKED` | OpenFinanceConnection | USER | User disconnects a bank |
| `OF_CONNECTION_EXPIRED` | OpenFinanceConnection | SYSTEM | Consent or tokens expired |
| `OF_SYNC_STARTED` | OpenFinanceConnection | SYSTEM | Sync job begins |
| `OF_SYNC_COMPLETED` | OpenFinanceConnection | SYSTEM | Sync job finishes successfully |
| `OF_SYNC_FAILED` | OpenFinanceConnection | SYSTEM | Sync job fails after retries |
| `OF_TOKEN_REFRESHED` | OpenFinanceConnection | SYSTEM | Access token successfully refreshed |
| `OF_TOKEN_REFRESH_FAILED` | OpenFinanceConnection | SYSTEM | Token refresh failed |
| `OF_MANUAL_SYNC_TRIGGERED` | OpenFinanceConnection | USER | User clicks "Sync Now" |
| `OF_TRANSACTIONS_EXPORTED` | BankTransaction | USER | User exports transaction data |
| `OF_SNAPSHOT_COMPUTED` | FinancialSnapshot | SYSTEM | Monthly snapshot generated |

**Payload for `OF_SYNC_COMPLETED`**:
```json
{
  "changes": null,
  "metadata": {
    "source": "system",
    "connectionId": "uuid",
    "bankCode": "00000000",
    "accountsSynced": 2,
    "transactionsAdded": 45,
    "transactionsUpdated": 3,
    "syncDurationMs": 12500
  }
}
```

---

## Edge Cases

### Connection Edge Cases

| Scenario | Handling |
|----------|---------|
| User denies consent at bank | Bank redirects with error parameter; connection record deleted |
| Bank API times out during consent | Return 502 OF_BANK_UNAVAILABLE; user can retry |
| Duplicate connection attempt | Return 409 OF_ALREADY_CONNECTED |
| Connection in ERROR state | Allow reconnection (new OAuth flow replaces old tokens) |
| Company has no connections | Financial dashboard shows empty state with "Connect Bank" CTA |

### Sync Edge Cases

| Scenario | Handling |
|----------|---------|
| Token expired, refresh succeeds | Continue sync normally; update stored tokens |
| Token expired, refresh fails | Mark connection EXPIRED; send notification; skip sync |
| Bank returns partial data | Store what was received; log warning; retry on next cycle |
| Duplicate transaction IDs | Upsert using `(accountId, externalId)` unique constraint |
| Transaction amount changes (bank correction) | Upsert overwrites the previous record; snapshot recomputed |
| Sync takes longer than 5 minutes | Job times out; marked as failed; retried |
| No transactions in date range | Valid response; no new records created; lastSyncAt updated |

### Financial Metric Edge Cases

| Scenario | Handling |
|----------|---------|
| Less than 3 months of data | Burn rate uses available months (1 or 2 month average) |
| Zero expenses | Burn rate = 0; runway = null (infinite) |
| No recurring credits found | MRR estimate = null (displayed as "Nao estimado") |
| Multiple bank accounts | Total balance = sum across all accounts |
| Mixed currencies (rare) | Only BRL accounts included in metrics; USD accounts shown separately |
| Balance goes negative | Valid scenario (overdraft); runway calculation still uses absolute burn rate |

### AI Categorization Edge Cases

| Scenario | Handling |
|----------|---------|
| AI service unavailable | Transactions stored without category; retry on next sync |
| Low confidence score (<0.5) | Category set to OTHER with the confidence value stored |
| Description is empty | Category set to OTHER with confidence 0.0 |
| Transaction in foreign language | AI prompt includes instruction to handle Portuguese and English |
| Extremely short description | Include amount and counterparty as additional context for AI |

---

## Dependencies

### Internal Dependencies

| Dependency | Purpose |
|-----------|---------|
| `EncryptionService` (from security module) | KMS encrypt/decrypt for tokens and account numbers |
| `AuditService` (from audit module) | Log connection lifecycle and sync events |
| `NotificationService` (from notifications module) | Send consent expiry and sync completion notifications |
| `CompanyProfile` (from company-profile module) | Update financial highlights with latest snapshot data |
| Bull queue infrastructure | Async job processing for syncs |

### External Dependencies

| Service | Purpose | Failure Handling |
|---------|---------|-----------------|
| Open Finance Brasil API (per bank) | OAuth consent, account data, transaction history | Circuit breaker: 5 failures open, 60s half-open. Retry 3x with exponential backoff. |
| AWS KMS | Token and account number encryption/decryption | Retry 3x. If KMS unavailable, sync cannot proceed (tokens cannot be decrypted). |
| Claude API (Anthropic) | Transaction categorization | Fallback to uncategorized. Retry on next sync cycle. |

### Supported Banks (Initial Launch)

| Bank | ISPB Code | Open Finance Status |
|------|-----------|-------------------|
| Banco do Brasil | 00000000 | Phase 3a/3b active |
| Bradesco | 60746948 | Phase 3a/3b active |
| Itau Unibanco | 60701190 | Phase 3a/3b active |
| Santander Brasil | 90400888 | Phase 3a/3b active |
| Nubank | 18236120 | Phase 3a/3b active |
| Inter | 00416968 | Phase 3a/3b active |
| BTG Pactual | 30306294 | Phase 3a/3b active |
| Caixa Economica Federal | 00360305 | Phase 3a/3b active |

---

## Success Criteria

- [ ] OAuth flow completes successfully with at least one major Brazilian bank
- [ ] Consent registration and token exchange follow FAPI security requirements
- [ ] Access and refresh tokens encrypted with KMS before database storage
- [ ] Tokens are never exposed in API responses or logs
- [ ] Initial sync fetches last 90 days of transactions
- [ ] Incremental syncs fetch only new transactions since last sync
- [ ] Transactions deduplicated using `(accountId, externalId)` unique constraint
- [ ] AI categorization assigns categories with confidence scores to transactions
- [ ] Categorization gracefully falls back when AI service is unavailable
- [ ] FinancialSnapshot computed monthly with accurate metrics
- [ ] Burn rate calculated as 3-month average of expenses
- [ ] Runway calculated as total balance / burn rate
- [ ] MRR estimated from recurring credit transactions (same counterparty, +/- 5% amount, monthly)
- [ ] Daily sync job runs for all ACTIVE connections
- [ ] Consent expiry alerts sent 7 days in advance
- [ ] Expired tokens automatically refreshed using refresh tokens
- [ ] Connection revocation deletes tokens and cascades to accounts/transactions
- [ ] All data scoped to companyId with no cross-company data leakage
- [ ] ADMIN-only access for connection management
- [ ] ADMIN + FINANCE access for transaction data
- [ ] INVESTOR access limited to aggregated snapshot metrics
- [ ] All connection lifecycle events audit-logged
- [ ] Frontend displays bank connections with status badges
- [ ] Financial dashboard shows summary cards, charts, and MRR estimate
- [ ] Transaction list supports filtering by date, category, and type
- [ ] All financial amounts formatted in Brazilian format (R$ 1.234,56)
- [ ] All dates formatted in Brazilian format (dd/MM/yyyy)
- [ ] PT-BR and EN translations complete for all user-facing strings
- [ ] Manual sync rate limited to 1 per connection per hour
- [ ] Sync failures retry 3x with exponential backoff before marking as failed
- [ ] Bull dead letter queue monitored for failed sync jobs

---

## Related Specifications

- **[company-profile.md](./company-profile.md)** — Financial highlights from snapshots surfaced on the company profile
- **[reports-analytics.md](./reports-analytics.md)** — Financial data included in due diligence packages
- **[notifications.md](./notifications.md)** — Consent expiry and sync completion notifications
- **[user-permissions.md](./user-permissions.md)** — Role-based access matrix for financial data
