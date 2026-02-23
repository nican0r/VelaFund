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

## Success Criteria

- Vesting calculations 100% accurate
- Support standard 4-year, 1-year cliff structure
- Real-time vesting status updates
- < 1 second vesting calculation per grant
