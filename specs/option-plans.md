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

  // Termination Policy
  termination_policy: 'FORFEITURE' | 'ACCELERATION' | 'PRO_RATA';

  status: 'ACTIVE' | 'CLOSED';
  created_at: Date;
}

interface OptionGrant {
  id: string;
  option_plan_id: string;
  user_id: string;                   // Employee receiving grant

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

### POST /api/v1/companies/:companyId/option-plans
Create option plan

### POST /api/v1/companies/:companyId/option-grants
Grant options to employee

**Request**:
```json
{
  "option_plan_id": "uuid",
  "user_id": "uuid",
  "quantity": 10000,
  "strike_price": 5.00,
  "grant_date": "2024-01-15",
  "vesting_schedule": {
    "vesting_start_date": "2024-01-15",
    "cliff_months": 12,
    "vesting_months": 48,
    "vesting_frequency": "MONTHLY"
  }
}
```

### GET /api/v1/option-grants/:grantId/vesting
Get vesting status

**Response**:
```json
{
  "grant_id": "uuid",
  "employee_name": "Maria Silva",
  "total_options": 10000,
  "vested_options": 2500,
  "unvested_options": 7500,
  "vesting_percentage": 25.0,
  "next_vesting_date": "2024-02-15",
  "next_vesting_amount": 208
}
```

---

## Business Rules

### BR-1: Pool Depletion Warning
- Alert admin when pool < 10% available
- Prevent grants if pool exhausted

### BR-2: Strike Price Fair Market Value
- Strike price MUST be ≥ fair market value at grant date
- Prevents tax issues for employees

### BR-3: Cliff Vesting
- ZERO options vest before cliff date
- On cliff date, all cliff period options vest at once
- Example: 12-month cliff → 25% vests on month 12

### BR-4: Linear Vesting After Cliff
- Options vest pro-rata after cliff
- Monthly vesting: total / 48 months
- Example: 10,000 options / 48 = 208.33 per month

### BR-5: Termination Policy Application
- Policy set at plan level applies to all grants
- Configurable: forfeiture, acceleration, pro-rata

---

## Success Criteria

- Vesting calculations 100% accurate
- Support standard 4-year, 1-year cliff structure
- Real-time vesting status updates
- < 1 second vesting calculation per grant
