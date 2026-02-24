# Option Plans Specification

**Topic of Concern**: Employee stock option plan management

**One-Sentence Description**: The system manages option pools, tracks individual grants with vesting schedules, and calculates vested vs unvested options.

---

## Overview

Option plans (Planos de Opção de Compra de Ações) allow companies to grant employees the right to purchase shares at a predetermined price (strike price). The system creates option pools, grants options to employees with vesting schedules, tracks vesting progress over time, and handles termination scenarios.

---

## User Stories

### US-1: Create Option Pool
**As an** admin user
**I want to** create an option pool of 150,000 shares
**So that** I can reserve equity for employee grants

### US-2: Grant Options to Employee
**As an** admin user
**I want to** grant 10,000 options with a 4-year vesting schedule
**So that** the employee earns equity over time

### US-3: Track Vesting Progress
**As an** employee
**I want to** see my vesting schedule and vested options
**So that** I know how much equity I've earned

---

## Functional Requirements

### FR-1: Option Pool Management
- Create multiple option pools per company
- Set total options, options granted, exercised, available
- Track pool utilization percentage
- Alert when pool nearly depleted

### FR-2: Option Grants
- Grant options to specific users (employees)
- Set strike price (fair market value at grant date)
- Define vesting schedule: cliff, duration, frequency
- Set expiration date (typically 10 years from grant)

### FR-3: Vesting Calculations
- Calculate vested options at any given date
- Support: monthly, quarterly, annual vesting
- Support cliff period (typically 1 year)
- Support acceleration (single/double trigger)

### FR-4: Termination Handling
- Configurable per plan: forfeiture, acceleration, pro-rata
- Track post-termination exercise window (typically 90 days)
- Unvested options return to pool

---

## Data Models

```typescript
interface OptionPlan {
  id: string;
  company_id: string;
  name: string;                      // "2024 Employee Option Plan"

  // Pool Size
  total_options: number;             // Total pool size
  options_granted: number;           // Granted to employees
  options_exercised: number;         // Exercised (now shares)
  options_cancelled: number;         // Cancelled/forfeited
  options_available: number;         // Remaining in pool

  // Share Class
  share_class_id: string;           // Which share class options convert to

  // Vesting Defaults
  default_cliff_months: number;     // Default cliff for new grants
  default_vesting_months: number;   // Default vesting duration
  default_vesting_frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

  // Termination Policy
  termination_policy: 'FORFEITURE' | 'ACCELERATION' | 'PRO_RATA';

  status: 'ACTIVE' | 'CLOSED';
  created_at: Date;
}

interface OptionGrant {
  id: string;
  option_plan_id: string;
  shareholder_id: string;            // Employee receiving grant (as shareholder)

  // Grant Terms
  quantity: number;
  strike_price: number;              // Exercise price per share
  grant_date: Date;
  expiration_date: Date;             // Typically 10 years

  // Vesting
  vesting_schedule_id: string;

  // Status
  status: 'ACTIVE' | 'EXERCISED' | 'CANCELLED' | 'EXPIRED';

  created_at: Date;
}

interface VestingSchedule {
  id: string;
  option_grant_id: string;

  // Schedule Parameters
  vesting_start_date: Date;
  cliff_months: number;              // Typically 12 months
  vesting_months: number;            // Typically 48 months
  vesting_frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

  // Acceleration
  single_trigger_acceleration: boolean;
  double_trigger_acceleration: boolean;

  // Custom Schedule (if not linear)
  custom_schedule: {
    month: number;
    percentage: number;
  }[] | null;

  created_at: Date;
}
```

---

## API Endpoints

### Option Plans

#### POST /api/v1/companies/:companyId/option-plans

Create a new option plan.

**Request**:
```json
{
  "name": "2026 Employee Option Plan",
  "totalPoolSize": 150000,
  "shareClassId": "550e8400-e29b-41d4-a716-446655440000",
  "vestingDefaults": {
    "cliffMonths": 12,
    "vestingMonths": 48,
    "vestingFrequency": "MONTHLY"
  },
  "terminationPolicy": "FORFEITURE"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "companyId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "2026 Employee Option Plan",
    "totalOptions": 150000,
    "optionsGranted": 0,
    "optionsExercised": 0,
    "optionsCancelled": 0,
    "optionsAvailable": 150000,
    "shareClassId": "550e8400-e29b-41d4-a716-446655440000",
    "defaultCliffMonths": 12,
    "defaultVestingMonths": 48,
    "defaultVestingFrequency": "MONTHLY",
    "terminationPolicy": "FORFEITURE",
    "status": "ACTIVE",
    "createdAt": "2026-02-23T10:00:00.000Z",
    "updatedAt": "2026-02-23T10:00:00.000Z"
  }
}
```

#### GET /api/v1/companies/:companyId/option-plans

List option plans for a company with pagination.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | — | Filter by status: `ACTIVE`, `CLOSED` |
| `sort` | string | `-createdAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "2026 Employee Option Plan",
      "totalOptions": 150000,
      "optionsGranted": 45000,
      "optionsAvailable": 105000,
      "status": "ACTIVE",
      "createdAt": "2026-02-23T10:00:00.000Z"
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

#### GET /api/v1/companies/:companyId/option-plans/:planId

Get option plan detail.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "companyId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "2026 Employee Option Plan",
    "totalOptions": 150000,
    "optionsGranted": 45000,
    "optionsExercised": 5000,
    "optionsCancelled": 2000,
    "optionsAvailable": 98000,
    "shareClassId": "550e8400-e29b-41d4-a716-446655440000",
    "defaultCliffMonths": 12,
    "defaultVestingMonths": 48,
    "defaultVestingFrequency": "MONTHLY",
    "terminationPolicy": "FORFEITURE",
    "status": "ACTIVE",
    "createdAt": "2026-02-23T10:00:00.000Z",
    "updatedAt": "2026-02-23T10:00:00.000Z"
  }
}
```

#### PUT /api/v1/companies/:companyId/option-plans/:planId

Update an option plan. Only allowed while status is `ACTIVE`.

**Request**:
```json
{
  "name": "2026 Employee Option Plan - Updated",
  "vestingDefaults": {
    "cliffMonths": 12,
    "vestingMonths": 36,
    "vestingFrequency": "QUARTERLY"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "2026 Employee Option Plan - Updated",
    "defaultCliffMonths": 12,
    "defaultVestingMonths": 36,
    "defaultVestingFrequency": "QUARTERLY",
    "status": "ACTIVE",
    "updatedAt": "2026-02-24T14:00:00.000Z"
  }
}
```

### Option Grants

#### POST /api/v1/companies/:companyId/option-grants

Grant options to an employee.

**Request**:
```json
{
  "optionPlanId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "shareholderId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "quantity": 10000,
  "strikePrice": "5.00",
  "grantDate": "2026-01-15",
  "expirationDate": "2036-01-15",
  "vestingSchedule": {
    "vestingStartDate": "2026-01-15",
    "cliffMonths": 12,
    "vestingMonths": 48,
    "vestingFrequency": "MONTHLY",
    "singleTriggerAcceleration": false,
    "doubleTriggerAcceleration": true
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "optionPlanId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "shareholderId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "quantity": 10000,
    "strikePrice": "5.00",
    "grantDate": "2026-01-15",
    "expirationDate": "2036-01-15",
    "vestingSchedule": {
      "vestingStartDate": "2026-01-15",
      "cliffMonths": 12,
      "vestingMonths": 48,
      "vestingFrequency": "MONTHLY",
      "singleTriggerAcceleration": false,
      "doubleTriggerAcceleration": true
    },
    "status": "ACTIVE",
    "createdAt": "2026-02-23T10:00:00.000Z"
  }
}
```

#### GET /api/v1/companies/:companyId/option-grants

List all option grants for a company with pagination.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | — | Filter: `ACTIVE`, `EXERCISED`, `CANCELLED`, `EXPIRED` |
| `optionPlanId` | UUID | — | Filter by option plan |
| `shareholderId` | UUID | — | Filter by shareholder |
| `sort` | string | `-grantDate` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "optionPlanId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "shareholderId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "shareholderName": "Maria Silva",
      "quantity": 10000,
      "strikePrice": "5.00",
      "grantDate": "2026-01-15",
      "status": "ACTIVE",
      "vestedQuantity": 2500,
      "unvestedQuantity": 7500,
      "vestingPercentage": 25.0
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### GET /api/v1/companies/:companyId/option-grants/:grantId

Get option grant detail including vesting status.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "optionPlanId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "shareholderId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "shareholderName": "Maria Silva",
    "quantity": 10000,
    "strikePrice": "5.00",
    "grantDate": "2026-01-15",
    "expirationDate": "2036-01-15",
    "vestingSchedule": {
      "vestingStartDate": "2026-01-15",
      "cliffMonths": 12,
      "vestingMonths": 48,
      "vestingFrequency": "MONTHLY",
      "singleTriggerAcceleration": false,
      "doubleTriggerAcceleration": true
    },
    "status": "ACTIVE",
    "vesting": {
      "vestedQuantity": 2500,
      "unvestedQuantity": 7500,
      "exercisedQuantity": 0,
      "exercisableQuantity": 2500,
      "vestingPercentage": 25.0,
      "nextVestingDate": "2027-02-15",
      "nextVestingAmount": 208
    },
    "createdAt": "2026-02-23T10:00:00.000Z",
    "updatedAt": "2026-02-23T10:00:00.000Z"
  }
}
```

#### GET /api/v1/companies/:companyId/option-grants/:grantId/vesting

Get detailed vesting status for a specific grant.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "grantId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "shareholderName": "Maria Silva",
    "totalOptions": 10000,
    "vestedOptions": 2500,
    "unvestedOptions": 7500,
    "exercisedOptions": 0,
    "exercisableOptions": 2500,
    "vestingPercentage": 25.0,
    "nextVestingDate": "2027-02-15",
    "nextVestingAmount": 208,
    "cliffDate": "2027-01-15",
    "cliffMet": true,
    "schedule": [
      { "date": "2027-01-15", "quantity": 2500, "cumulative": 2500, "type": "CLIFF" },
      { "date": "2027-02-15", "quantity": 208, "cumulative": 2708, "type": "MONTHLY" },
      { "date": "2027-03-15", "quantity": 208, "cumulative": 2916, "type": "MONTHLY" }
    ]
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description | messageKey |
|------|-------------|-------------|------------|
| `OPT_PLAN_NOT_FOUND` | 404 | Option plan does not exist or is not accessible | `errors.opt.planNotFound` |
| `OPT_PLAN_EXHAUSTED` | 422 | Option plan has no remaining shares in pool for this grant | `errors.opt.planExhausted` |
| `OPT_GRANT_NOT_FOUND` | 404 | Option grant does not exist or is not accessible | `errors.opt.grantNotFound` |
| `OPT_INSUFFICIENT_VESTED` | 422 | Not enough vested options to exercise the requested quantity | `errors.opt.insufficientVested` |
| `OPT_GRANT_TERMINATED` | 422 | Option grant has been terminated; no further actions allowed | `errors.opt.grantTerminated` |
| `CAP_SHARE_CLASS_NOT_FOUND` | 404 | The specified share class does not exist | `errors.cap.shareClassNotFound` |
| `VAL_INVALID_INPUT` | 400 | One or more request fields failed validation | `errors.val.invalidInput` |

**Error Response Example**:
```json
{
  "success": false,
  "error": {
    "code": "OPT_PLAN_EXHAUSTED",
    "message": "Plano de opções não possui mais ações disponíveis",
    "messageKey": "errors.opt.planExhausted",
    "details": {
      "optionsAvailable": 5000,
      "quantityRequested": 10000
    }
  }
}
```

---

## Business Rules

### BR-1: Pool Depletion Warning
- Alert admin when pool < 10% available
- Prevent grants if pool exhausted

### BR-2: Strike Price Fair Market Value
- Strike price MUST be >= fair market value at grant date
- Prevents tax issues for employees

### BR-3: Cliff Vesting
- ZERO options vest before cliff date
- On cliff date, all cliff period options vest at once
- Example: 12-month cliff -> 25% vests on month 12

### BR-4: Linear Vesting After Cliff
- Options vest pro-rata after cliff
- Monthly vesting: total / 48 months
- Example: 10,000 options / 48 = 208.33 per month

### BR-5: Termination Policy Application
- Policy set at plan level applies to all grants
- Configurable: forfeiture, acceleration, pro-rata

---

## Edge Cases

### EC-1: Grant Exceeds Available Pool
**Scenario**: Admin attempts to grant 20,000 options but only 5,000 are available in the pool.
**Handling**: Return `OPT_PLAN_EXHAUSTED` (422) with `optionsAvailable` and `quantityRequested` in the error details. The admin must either reduce the grant quantity or increase the pool size.

### EC-2: Employee Termination Mid-Vesting
**Scenario**: An employee with 10,000 options (2,500 vested) is terminated.
**Handling**: Apply the plan's termination policy:
- **FORFEITURE**: 7,500 unvested options are cancelled and returned to the pool. The employee has 90 days to exercise the 2,500 vested options.
- **ACCELERATION**: All 10,000 options vest immediately. The employee has 90 days to exercise.
- **PRO_RATA**: Options vest proportionally up to the termination date. Remaining unvested are cancelled.

### EC-3: Grant on Closed Plan
**Scenario**: Admin attempts to create a new grant on an option plan with status `CLOSED`.
**Handling**: Return 422 with a message indicating the plan is closed and cannot accept new grants. The admin must create a new option plan.

### EC-4: Vesting Calculation on Leap Year
**Scenario**: A vesting schedule spans February 29 in a leap year.
**Handling**: Monthly vesting dates that fall on the 29th, 30th, or 31st of a month are adjusted to the last day of that month if the day does not exist. This ensures consistent monthly intervals.

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [option-exercises.md](./option-exercises.md) | Employees exercise vested options from grants to receive shares |
| [share-classes.md](./share-classes.md) | Options reference a share class for conversion upon exercise |
| [cap-table-management.md](./cap-table-management.md) | Fully-diluted cap table includes option pool; exercised options become shareholdings |
| [shareholder-registry.md](./shareholder-registry.md) | Grantees must exist as shareholders (type INDIVIDUAL); exercise creates shareholdings |
| [company-management.md](./company-management.md) | Option plans are scoped to a company; company must be ACTIVE |
| [user-permissions.md](./user-permissions.md) | ADMIN role required to create/manage plans and grants |
| [notifications.md](./notifications.md) | Vesting milestone notifications, grant creation emails |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, and URL conventions for option plan endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: OPT_PLAN_NOT_FOUND, OPT_PLAN_EXHAUSTED, OPT_GRANT_NOT_FOUND, OPT_GRANT_TERMINATED |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: OPTION_PLAN_CREATED, OPTION_PLAN_UPDATED, OPTION_GRANTED, OPTION_GRANT_UPDATED, OPTION_FORFEITED, OPTION_VESTING_MILESTONE |

---

## Frontend Implementation

### FE-1: Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard/options` | OptionsPage | Tab container with Plans, Grants, and Exercises tabs |
| `/dashboard/options/plans/new` | CreatePlanPage | Create option plan form |
| `/dashboard/options/plans/[planId]` | PlanDetailPage | Plan detail with pool bar, grants list |
| `/dashboard/options/plans/[planId]/edit` | EditPlanPage | Edit plan (ACTIVE status only) |
| `/dashboard/options/grants/new` | CreateGrantPage | Create grant form with vesting preview |
| `/dashboard/options/grants/[grantId]` | GrantDetailPage | Grant detail with vesting timeline |
| `/dashboard/options/my-options` | MyOptionsPage | Employee self-service view of own grants |

**Navigation**: Sidebar item "Options" under main navigation. "My Options" appears for EMPLOYEE role users as a separate navigation item or within the Options page.

### FE-2: Page Layouts

#### Plans List (within OptionsPage, "Plans" tab)

```
┌─────────────────────────────────────────────────────────┐
│  h1: Opções                        [+ Novo Plano]       │
│  body-sm: Gerencie planos e concessões de opções        │
├─────────────────────────────────────────────────────────┤
│  [Plans] [Grants] [Exercises]  ← Tab bar                │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Total Pool│ │Granted   │ │Exercised │ │Available │  │
│  │ 150.000  │ │  85.000  │ │  20.000  │ │  45.000  │  │
│  │          │ │56,7%     │ │13,3%     │ │30,0%     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  Plans Table (paginated)                                │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  Showing 1-5 of 5                                       │
└─────────────────────────────────────────────────────────┘
```

#### Grants List (within OptionsPage, "Grants" tab)

```
┌─────────────────────────────────────────────────────────┐
│  [Plans] [Grants ←active] [Exercises]                   │
├─────────────────────────────────────────────────────────┤
│  Filters: [Plan ▼] [Status ▼]  🔍 Search               │
├─────────────────────────────────────────────────────────┤
│  Grants Table (paginated)                               │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  Showing 1-10 of 32                    < 1 2 3 4 >     │
└─────────────────────────────────────────────────────────┘
```

#### Plan Detail Page

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Plans    StatusBadge    [Edit] [Actions ▼]   │
│  h1: Employee Stock Option Plan 2026                    │
│  body-sm: Created 01/01/2026                            │
├─────────────────────────────────────────────────────────┤
│  Pool Utilization Bar (segmented)                       │
│  ████████████████▓▓▓▓▓▓░░░░░░░░░ ─ ─ ─ ─ ─ ─          │
│  Granted (56.7%) | Exercised (13.3%) | Cancelled (2%)   │
│  | Available (28%)                                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Pool Total│ │Granted   │ │Exercised │ │Available │  │
│  │ 150.000  │ │  85.000  │ │  20.000  │ │  42.000  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  ⚠️ PoolDepletionWarning (if available < 10% of pool)   │
├─────────────────────────────────────────────────────────┤
│  Plan Grants Table (filtered to this plan)              │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

#### Grant Detail Page

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Grants    StatusBadge    [Actions ▼]         │
│  h1: Grant — João Silva                                 │
│  body-sm: Plan: ESOP 2026 · Granted 01/03/2026         │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Total     │ │Vested    │ │Unvested  │ │Exercis-  │  │
│  │ 10.000   │ │  2.500   │ │  7.500   │ │able      │  │
│  │          │ │25%       │ │75%       │ │  2.500   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  VestingTimeline (horizontal bar with cliff + progress) │
│  |▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░|                  │
│  Grant    Cliff    Today          Expiration            │
├─────────────────────────────────────────────────────────┤
│  [Vesting Schedule] [Details] [Exercises]  ← Tabs       │
│  ...tab content...                                      │
└─────────────────────────────────────────────────────────┘
```

#### My Options Page (Employee Self-Service)

```
┌─────────────────────────────────────────────────────────┐
│  h1: Minhas Opções                                      │
│  body-sm: Visualize suas concessões e opções            │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Total     │ │Vested    │ │Exercised │ │Exercis-  │  │
│  │Options   │ │          │ │          │ │able      │  │
│  │ 10.000   │ │  5.000   │ │  1.000   │ │  4.000   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  OptionGrantCard (one per grant)                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ESOP 2026 · 10,000 options · R$ 1.50 strike       │ │
│  │ VestingProgressRing 50%  [Exercise Options]        │ │
│  │ 5,000 vested · 4,000 exercisable                   │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  Active Exercise Requests                               │
│  ExerciseStatusTracker (if any pending exercises)       │
└─────────────────────────────────────────────────────────┘
```

### FE-3: Components

| Component | Description | Props |
|-----------|-------------|-------|
| `PoolUtilizationBar` | Segmented horizontal bar showing granted/exercised/cancelled/available | `granted: number`, `exercised: number`, `cancelled: number`, `total: number` |
| `VestingTimeline` | Horizontal timeline with cliff marker, monthly dots, today marker, progress fill | `grantDate: Date`, `cliffDate: Date`, `endDate: Date`, `expirationDate: Date`, `vestedPercent: number` |
| `VestingScheduleTable` | Table showing all vesting milestones with dates, quantities, and status | `vestingSchedule: VestingMilestone[]` |
| `VestingProgressRing` | Circular progress indicator for vesting percentage | `percent: number`, `size?: 'sm' \| 'md' \| 'lg'` |
| `OptionGrantCard` | Employee-facing card with grant summary, vesting progress, exercise button | `grant: OptionGrant` |
| `ExerciseStatusTracker` | Horizontal 5-step indicator (Requested → Pending Payment → Confirmed → Shares Issued → Completed) | `status: ExerciseStatus` |
| `BankDetailsCard` | Card displaying bank details for payment with copyable fields | `bankDetails: BankDetails`, `referenceCode: string` |
| `PoolDepletionWarning` | Yellow alert banner when pool available < 10% of total | `available: number`, `total: number` |
| `PlanStatusBadge` | Status pill badge for plan status | `status: PlanStatus` |
| `GrantStatusBadge` | Status pill badge for grant status | `status: GrantStatus` |
| `VestingFrequencyBadge` | Info badge showing vesting frequency | `frequency: VestingFrequency` |
| `TerminationPolicyBadge` | Info badge showing termination policy | `policy: TerminationPolicy` |
| `ClosePlanModal` | Warning modal for closing a plan | `planId: string`, `hasActiveGrants: boolean`, `onSuccess: () => void` |
| `CancelGrantModal` | Destructive confirmation modal for cancelling a grant | `grantId: string`, `onSuccess: () => void` |

### FE-4: Tables

#### Plans Table

| Column | Field | Type | Sortable | Alignment |
|--------|-------|------|----------|-----------|
| Name | `name` | text link (navigates to detail) | Yes | Left |
| Pool Total | `totalPoolSize` | number | Yes | Right |
| Granted | `totalGranted` | number | Yes | Right |
| Available | computed (`totalPoolSize - totalGranted`) | number | No | Right |
| Utilization | computed | mini horizontal bar (inline) + percentage | Yes | Left |
| Frequency | `vestingFrequency` | VestingFrequencyBadge | Yes | Center |
| Status | `status` | PlanStatusBadge | Yes | Center |
| Created | `createdAt` | date (dd/MM/yyyy) | Yes | Left |

- Default sort: `-createdAt`
- Empty state: "Nenhum plano de opções" + "Criar plano" CTA

#### Grants Table

| Column | Field | Type | Sortable | Alignment |
|--------|-------|------|----------|-----------|
| Employee | `shareholder.name` | text with avatar | Yes | Left |
| Plan | `optionPlan.name` | text link | Yes | Left |
| Quantity | `quantity` | number | Yes | Right |
| Strike Price | `strikePrice` | currency (BRL) | Yes | Right |
| Vested | `vestedQuantity` | number | Yes | Right |
| Vesting % | computed | mini progress bar + percentage | Yes | Left |
| Status | `status` | GrantStatusBadge | Yes | Center |
| Grant Date | `grantDate` | date (dd/MM/yyyy) | Yes | Left |

- Default sort: `-grantDate`
- Empty state: "Nenhuma concessão de opções" + "Criar concessão" CTA

#### Vesting Schedule Table

| Column | Field | Type | Alignment |
|--------|-------|------|-----------|
| Date | `vestingDate` | date (dd/MM/yyyy) | Left |
| Type | `type` | badge (CLIFF / MONTHLY / QUARTERLY / ANNUALLY) | Center |
| Quantity | `quantity` | number | Right |
| Cumulative | `cumulativeQuantity` | number | Right |
| % | `cumulativePercent` | percentage | Right |
| Status | `status` | badge (Vested green / Pending gray / Upcoming blue) | Center |

- No pagination (full schedule displayed)
- Today row highlighted with `blue-50` background
- Past rows: regular text. Future rows: `gray-400` text

### FE-5: Forms

#### Create/Edit Plan Form

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `name` | Nome do Plano | text input | min 3, max 100 chars | Yes |
| `totalPoolSize` | Tamanho Total do Pool | number input | > 0, integer | Yes |
| `shareClassId` | Classe de Ações | searchable select (from company share classes) | must exist | Yes |
| `cliffMonths` | Cliff (meses) | number input | >= 0, integer | Yes |
| `vestingMonths` | Período de Vesting (meses) | number input | > cliffMonths, integer | Yes |
| `vestingFrequency` | Frequência de Vesting | select (MONTHLY, QUARTERLY, ANNUALLY) | must select | Yes |
| `terminationPolicy` | Política de Rescisão | select (FORFEITURE, ACCELERATION, PRO_RATA) | must select | Yes |

- **Layout**: Single column, grouped: "Informações do Plano", "Termos de Vesting", "Políticas"
- **Submit**: "Criar Plano" / "Salvar Alterações"

#### Create Grant Form

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `planId` | Plano de Opções | select (active plans) | must exist | Yes |
| `shareholderId` | Funcionário | searchable select (shareholders, type INDIVIDUAL) | must exist | Yes |
| `quantity` | Quantidade de Opções | number input | > 0, <= plan available | Yes |
| `strikePrice` | Preço de Exercício | currency input (BRL) | > 0, decimal(18,6) | Yes |
| `grantDate` | Data de Concessão | date picker | <= today | Yes |
| `expirationDate` | Data de Expiração | date picker | > grantDate | Yes |
| `vestingStartDate` | Início do Vesting | date picker | >= grantDate | Yes |
| `cliffMonths` | Cliff (meses) | number input | >= 0 | Yes |
| `vestingMonths` | Período de Vesting (meses) | number input | > cliffMonths | Yes |
| `vestingFrequency` | Frequência | select (MONTHLY, QUARTERLY, ANNUALLY) | must select | Yes |
| `singleTriggerAcceleration` | Aceleração Single Trigger | toggle + percentage input | 0-100 if enabled | No |
| `doubleTriggerAcceleration` | Aceleração Double Trigger | toggle + percentage input | 0-100 if enabled | No |

- **Pre-fill from plan**: When `planId` is selected, cliff, vesting months, vesting frequency, and strike price pre-fill from plan defaults. User can override.
- **Live vesting preview**: Right side panel shows a simplified vesting schedule table updating as form values change. Shows cliff date, vesting milestones, and total vested per year.
- **Available validation**: Shows "X opções disponíveis no plano" below quantity field. Error if quantity > available.
- **Layout**: Two-column on desktop — form on left, vesting preview on right.
- **Submit**: "Criar Concessão"

### FE-6: Visualizations

#### Vesting Timeline

- **Type**: Custom horizontal bar (SVG or CSS)
- **Structure**: Horizontal bar from grant date to expiration date
  - Cliff segment: `gray-200` (from grant date to cliff end)
  - Vested segment: `celadon-600` (from cliff end to today or full vesting date)
  - Unvested segment: `gray-200` (from today to full vesting date)
  - Expired segment: `gray-100` (from full vesting to expiration, if applicable)
- **Markers**:
  - Grant date: left edge label
  - Cliff end: vertical dashed line with "Cliff" label
  - Today: vertical solid line in `navy-900` with "Hoje" label
  - Full vesting: vertical dashed line
  - Expiration: right edge label
- **Milestone dots**: Small circles at each vesting event (monthly/quarterly/annually)
- **Height**: 48px bar + 24px labels

#### Pool Utilization Bar

- **Type**: Segmented horizontal stacked bar
- **Segments** (left to right):
  - Granted (not exercised): `ocean-600`
  - Exercised: `celadon-600`
  - Cancelled: `gray-300`
  - Available: `gray-100` with dashed border
- **Labels**: Percentage labels inside segments (if wide enough) or above
- **Below**: Legend with color dots + labels + absolute numbers
- **Height**: 32px bar + 24px legend

### FE-7: Modals & Dialogs

| Modal | Size | Type | Key Elements |
|-------|------|------|--------------|
| ClosePlanModal | Small (400px) | Warning | Warning about active grants if any: "Este plano possui {count} concessões ativas. Fechar o plano impedirá novas concessões." Checkbox: "Eu entendo" + "Fechar Plano" button |
| CancelGrantModal | Small (400px) | Destructive | Warning text: "Cancelar esta concessão resultará na perda de {unvested} opções não adquiridas." Red "Cancelar Concessão" button |

### FE-8: Status Badges

#### Plan Status

| Status | Background | Text Color | Label (PT-BR) | Label (EN) |
|--------|-----------|------------|----------------|------------|
| `ACTIVE` | `green-100` | `green-700` | Ativo | Active |
| `CLOSED` | `gray-100` | `gray-600` | Fechado | Closed |

#### Grant Status

| Status | Background | Text Color | Label (PT-BR) | Label (EN) |
|--------|-----------|------------|----------------|------------|
| `ACTIVE` | `green-100` | `green-700` | Ativa | Active |
| `EXERCISED` | `blue-50` | `blue-600` | Exercida | Exercised |
| `CANCELLED` | `gray-100` | `gray-600` | Cancelada | Cancelled |
| `EXPIRED` | `#FEE2E2` | `#991B1B` | Expirada | Expired |

#### Vesting Frequency

| Frequency | Background | Text Color | Label (PT-BR) | Label (EN) |
|-----------|-----------|------------|----------------|------------|
| `MONTHLY` | `blue-50` | `blue-600` | Mensal | Monthly |
| `QUARTERLY` | `blue-50` | `blue-600` | Trimestral | Quarterly |
| `ANNUALLY` | `blue-50` | `blue-600` | Anual | Annually |

#### Termination Policy

| Policy | Background | Text Color | Label (PT-BR) | Label (EN) |
|--------|-----------|------------|----------------|------------|
| `FORFEITURE` | `#FEE2E2` | `#991B1B` | Perda Total | Forfeiture |
| `ACCELERATION` | `green-100` | `green-700` | Aceleração | Acceleration |
| `PRO_RATA` | `cream-100` | `cream-700` | Pro-Rata | Pro-Rata |

### FE-9: Role-Based UI

| Action | ADMIN | FINANCE | LEGAL | EMPLOYEE |
|--------|-------|---------|-------|----------|
| View Plans tab | Yes | Yes | Yes | No |
| View Grants tab | Yes | Yes | Yes | No |
| View Exercises tab | Yes | Yes | No | No |
| Create plan | Yes | No | No | No |
| Edit plan | Yes (ACTIVE) | No | No | No |
| Close plan | Yes | No | No | No |
| Create grant | Yes | No | No | No |
| Cancel grant | Yes | No | No | No |
| View grant detail | Yes | Yes | Yes | Own grants only |
| View My Options | No | No | No | Yes |
| Request exercise | No | No | No | Yes (from My Options) |

- **EMPLOYEE role**: Only sees "My Options" page. Cannot access Plans or Grants tabs. Navigates to `/dashboard/options/my-options`.
- **FINANCE role**: Read-only access to Plans and Grants tabs. Can view Exercises tab for payment confirmation (see option-exercises.md).
- **Hidden elements**: Tabs and action buttons not shown for unauthorized roles.

### FE-10: API Integration (TanStack Query)

```typescript
// Query key factory
const optionKeys = {
  plans: {
    all: (companyId: string) => ['option-plans', companyId] as const,
    list: (companyId: string, filters?: PlanFilters) => [...optionKeys.plans.all(companyId), 'list', filters] as const,
    detail: (companyId: string, planId: string) => [...optionKeys.plans.all(companyId), planId] as const,
  },
  grants: {
    all: (companyId: string) => ['option-grants', companyId] as const,
    list: (companyId: string, filters?: GrantFilters) => [...optionKeys.grants.all(companyId), 'list', filters] as const,
    detail: (companyId: string, grantId: string) => [...optionKeys.grants.all(companyId), grantId] as const,
    vesting: (companyId: string, grantId: string) => [...optionKeys.grants.detail(companyId, grantId), 'vesting'] as const,
    myGrants: (companyId: string) => [...optionKeys.grants.all(companyId), 'my'] as const,
  },
};

// Plan hooks
function useOptionPlans(companyId: string, filters?: PlanFilters);
function useOptionPlan(companyId: string, planId: string);
function useCreateOptionPlan(companyId: string);         // POST mutation
function useUpdateOptionPlan(companyId: string);         // PUT mutation
function useCloseOptionPlan(companyId: string);          // POST mutation

// Grant hooks
function useOptionGrants(companyId: string, filters?: GrantFilters);
function useOptionGrant(companyId: string, grantId: string);
function useGrantVestingSchedule(companyId: string, grantId: string);
function useCreateOptionGrant(companyId: string);        // POST mutation
function useCancelOptionGrant(companyId: string);        // POST mutation
function useMyOptionGrants(companyId: string);           // GET for employee self-service
```

**Cache invalidation on grant creation**: Invalidate `optionKeys.plans.detail` (pool utilization changes) and `optionKeys.grants.all`.

### FE-11: i18n Keys

Namespace: `options.plans` and `options.grants`

```
options.title = "Opções" / "Options"
options.subtitle = "Gerencie planos e concessões de opções de compra" / "Manage stock option plans and grants"

options.plans.title = "Planos de Opções" / "Option Plans"
options.plans.new = "Novo Plano" / "New Plan"
options.plans.edit = "Editar Plano" / "Edit Plan"
options.plans.form.name = "Nome do Plano" / "Plan Name"
options.plans.form.poolSize = "Tamanho Total do Pool" / "Total Pool Size"
options.plans.form.shareClass = "Classe de Ações" / "Share Class"
options.plans.form.cliffMonths = "Cliff (meses)" / "Cliff (months)"
options.plans.form.vestingMonths = "Período de Vesting (meses)" / "Vesting Period (months)"
options.plans.form.vestingFrequency = "Frequência de Vesting" / "Vesting Frequency"
options.plans.form.terminationPolicy = "Política de Rescisão" / "Termination Policy"
options.plans.form.create = "Criar Plano" / "Create Plan"
options.plans.form.save = "Salvar Alterações" / "Save Changes"

options.plans.stats.totalPool = "Pool Total" / "Total Pool"
options.plans.stats.granted = "Concedido" / "Granted"
options.plans.stats.exercised = "Exercido" / "Exercised"
options.plans.stats.available = "Disponível" / "Available"

options.plans.table.name = "Nome" / "Name"
options.plans.table.poolTotal = "Pool Total" / "Pool Total"
options.plans.table.granted = "Concedido" / "Granted"
options.plans.table.available = "Disponível" / "Available"
options.plans.table.utilization = "Utilização" / "Utilization"
options.plans.table.frequency = "Frequência" / "Frequency"
options.plans.table.status = "Status" / "Status"
options.plans.table.created = "Criado em" / "Created"
options.plans.table.empty = "Nenhum plano de opções" / "No option plans"
options.plans.table.emptyCta = "Criar plano" / "Create plan"

options.plans.status.active = "Ativo" / "Active"
options.plans.status.closed = "Fechado" / "Closed"

options.plans.close.title = "Fechar Plano" / "Close Plan"
options.plans.close.warning = "Fechar o plano impedirá novas concessões" / "Closing the plan will prevent new grants"
options.plans.close.activeGrants = "Este plano possui {count} concessões ativas" / "This plan has {count} active grants"
options.plans.close.confirm = "Fechar Plano" / "Close Plan"

options.plans.poolWarning = "Pool quase esgotado: apenas {available} opções disponíveis ({percent}%)" / "Pool nearly depleted: only {available} options available ({percent}%)"

options.grants.title = "Concessões" / "Grants"
options.grants.new = "Nova Concessão" / "New Grant"
options.grants.form.plan = "Plano de Opções" / "Option Plan"
options.grants.form.employee = "Funcionário" / "Employee"
options.grants.form.quantity = "Quantidade de Opções" / "Option Quantity"
options.grants.form.strikePrice = "Preço de Exercício" / "Strike Price"
options.grants.form.grantDate = "Data de Concessão" / "Grant Date"
options.grants.form.expirationDate = "Data de Expiração" / "Expiration Date"
options.grants.form.vestingStartDate = "Início do Vesting" / "Vesting Start Date"
options.grants.form.cliffMonths = "Cliff (meses)" / "Cliff (months)"
options.grants.form.vestingMonths = "Período de Vesting (meses)" / "Vesting Period (months)"
options.grants.form.frequency = "Frequência" / "Frequency"
options.grants.form.singleTrigger = "Aceleração Single Trigger" / "Single Trigger Acceleration"
options.grants.form.doubleTrigger = "Aceleração Double Trigger" / "Double Trigger Acceleration"
options.grants.form.availableInPlan = "{count} opções disponíveis no plano" / "{count} options available in plan"
options.grants.form.create = "Criar Concessão" / "Create Grant"
options.grants.form.vestingPreview = "Prévia do Vesting" / "Vesting Preview"

options.grants.table.employee = "Funcionário" / "Employee"
options.grants.table.plan = "Plano" / "Plan"
options.grants.table.quantity = "Quantidade" / "Quantity"
options.grants.table.strikePrice = "Preço de Exercício" / "Strike Price"
options.grants.table.vested = "Adquirido" / "Vested"
options.grants.table.vestingPercent = "% Vesting" / "Vesting %"
options.grants.table.status = "Status" / "Status"
options.grants.table.grantDate = "Data de Concessão" / "Grant Date"
options.grants.table.empty = "Nenhuma concessão de opções" / "No option grants"
options.grants.table.emptyCta = "Criar concessão" / "Create grant"

options.grants.detail.total = "Total" / "Total"
options.grants.detail.vested = "Adquirido" / "Vested"
options.grants.detail.unvested = "Não Adquirido" / "Unvested"
options.grants.detail.exercisable = "Exercível" / "Exercisable"

options.grants.status.active = "Ativa" / "Active"
options.grants.status.exercised = "Exercida" / "Exercised"
options.grants.status.cancelled = "Cancelada" / "Cancelled"
options.grants.status.expired = "Expirada" / "Expired"

options.grants.frequency.monthly = "Mensal" / "Monthly"
options.grants.frequency.quarterly = "Trimestral" / "Quarterly"
options.grants.frequency.annually = "Anual" / "Annually"

options.grants.termination.forfeiture = "Perda Total" / "Forfeiture"
options.grants.termination.acceleration = "Aceleração" / "Acceleration"
options.grants.termination.proRata = "Pro-Rata" / "Pro-Rata"

options.grants.cancel.title = "Cancelar Concessão" / "Cancel Grant"
options.grants.cancel.warning = "Cancelar esta concessão resultará na perda de {unvested} opções não adquiridas" / "Cancelling this grant will forfeit {unvested} unvested options"
options.grants.cancel.confirm = "Cancelar Concessão" / "Cancel Grant"

options.grants.vesting.title = "Cronograma de Vesting" / "Vesting Schedule"
options.grants.vesting.date = "Data" / "Date"
options.grants.vesting.type = "Tipo" / "Type"
options.grants.vesting.quantity = "Quantidade" / "Quantity"
options.grants.vesting.cumulative = "Acumulado" / "Cumulative"
options.grants.vesting.percent = "%" / "%"
options.grants.vesting.status = "Status" / "Status"
options.grants.vesting.vested = "Adquirido" / "Vested"
options.grants.vesting.pending = "Pendente" / "Pending"
options.grants.vesting.upcoming = "Futuro" / "Upcoming"

options.myOptions.title = "Minhas Opções" / "My Options"
options.myOptions.subtitle = "Visualize suas concessões e opções de compra" / "View your grants and stock options"
options.myOptions.totalOptions = "Total de Opções" / "Total Options"
options.myOptions.vested = "Adquiridas" / "Vested"
options.myOptions.exercised = "Exercidas" / "Exercised"
options.myOptions.exercisable = "Exercíveis" / "Exercisable"
options.myOptions.exerciseButton = "Exercer Opções" / "Exercise Options"
```

### FE-12: Error Handling UI

| Error Code | HTTP Status | UI Behavior |
|------------|-------------|-------------|
| `OPT_PLAN_NOT_FOUND` | 404 | Redirect to plans list with toast "Plano não encontrado" |
| `OPT_PLAN_EXHAUSTED` | 422 | Show on grant form: inline error below quantity field with "Pool esgotado. Disponível: {available}, Solicitado: {requested}" |
| `OPT_PLAN_CLOSED` | 422 | Toast warning "Este plano está fechado. Não é possível criar novas concessões." |
| `OPT_GRANT_NOT_FOUND` | 404 | Redirect to grants list with toast "Concessão não encontrada" |
| `OPT_GRANT_TERMINATED` | 422 | Toast warning "Esta concessão foi cancelada ou expirada" |
| `OPT_INSUFFICIENT_VESTED` | 422 | Show on exercise form: inline error "Opções insuficientes. Exercível: {exercisable}, Solicitado: {requested}" |
| `OPT_EXERCISE_PENDING` | 422 | Toast info "Já existe uma solicitação de exercício pendente" with link to existing request |
| `VAL_INVALID_INPUT` | 400 | Map `validationErrors` to form field errors |
| `SYS_RATE_LIMITED` | 429 | Toast warning with retry countdown |

**Pool depletion warning**: Persistent `cream-100` banner on plan detail when available < 10% of total pool. Uses `PoolDepletionWarning` component.

**Loading states**:
- Plans list: skeleton stat cards + skeleton table (3 rows)
- Plan detail: skeleton pool bar + skeleton stat cards + skeleton table
- Grant detail: skeleton stat cards + skeleton vesting timeline + skeleton table
- My Options: skeleton stat cards + skeleton grant cards (2 cards)

---

## Success Criteria

- Vesting calculations 100% accurate
- Support standard 4-year, 1-year cliff structure
- Real-time vesting status updates
- < 1 second vesting calculation per grant
