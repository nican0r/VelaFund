# Convertible Instruments Specification

**Topic of Concern**: Mutuo Conversivel, Investimento-Anjo, MISTO/MAIS instrument creation, tracking, and interest accrual

**One-Sentence Description**: The system tracks Brazilian convertible instruments with configurable terms, automatic interest accrual, and lifecycle status management.

---

## Overview

Convertible instruments are debt or hybrid securities that convert to equity under specific conditions. Navia supports three Brazilian instruments specifically designed for early-stage startup financing:

1. **Mutuo Conversivel**: Convertible loan agreement with interest accrual, valuation cap, and discount rate. Most commonly used by Brazilian startups for pre-seed and seed financing.

2. **Investimento-Anjo (Angel Investment)**: Regulated by Complementary Law 155/2016, this structure provides tax benefits for angel investors. Features mandatory minimum holding period, optional conversion rights, and specific remuneration structures compliant with Brazilian law.

3. **MISTO/MAIS**: Standardized convertible note templates developed by Brazilian VC community (Movimento MAIS). Pre-configured terms following market best practices with customizable fields for deal-specific adjustments.

This specification covers instrument creation, configuration, interest accrual, status management, and CRUD operations. For conversion calculation, scenario modeling, MFN enforcement, and conversion execution, see `convertible-conversion.md`.

**Key Features**:
- Support for three Brazilian-specific convertible structures
- Automatic interest accrual (simple or compound)
- Daily interest calculation background job
- Instrument lifecycle status tracking
- MISTO/MAIS template management
- Investimento-Anjo legal compliance tracking
- Document generation for convertible notes

---

## Table of Contents

1. [User Stories](#user-stories)
2. [Functional Requirements](#functional-requirements)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Business Rules](#business-rules)
6. [User Flows](#user-flows)
7. [Technical Implementation](#technical-implementation)
8. [Edge Cases & Error Handling](#edge-cases--error-handling)
9. [Dependencies](#dependencies)
10. [Security Considerations](#security-considerations)
11. [Frontend Implementation](#frontend-implementation)
12. [Success Criteria](#success-criteria)
13. [Open Questions](#open-questions)
14. [Future Enhancements](#future-enhancements)
15. [Related Specifications](#related-specifications)

---

## User Stories

### US-1: Create Mutuo Conversivel
**As an** admin user
**I want to** create a convertible loan with conversion terms
**So that** I can track early-stage investments that convert later

### US-2: Track Accrued Interest
**As an** admin user
**I want to** view current principal and accrued interest for all convertibles
**So that** I know the total conversion amount at any point in time

### US-3: Investimento-Anjo Management
**As an** admin user
**I want to** create an Investimento-Anjo structure with minimum holding period
**So that** I can leverage tax benefits for angel investors per Law 155/2016

### US-4: View Outstanding Convertibles
**As an** investor
**I want to** see my convertible investments and their current status
**So that** I can track my position and accrued interest over time

### US-5: Generate Convertible Note Documents
**As an** admin user
**I want to** automatically generate convertible note documents
**So that** I have legal documentation for each instrument

---

## Functional Requirements

### FR-1: Mutuo Conversivel Support
- System MUST support creation of Mutuo Conversivel with principal amount, interest rate, maturity date
- System MUST support three conversion triggers: qualified financing, maturity, change of control
- System MUST allow discount rate configuration (typically 20-30%)
- System MUST allow valuation cap configuration
- System MUST automatically calculate accrued interest daily (simple or compound)
- System MUST track interest accrual from issue date to conversion date
- System MUST support optional early conversion clause

### FR-2: Investimento-Anjo Support
- System MUST support Investimento-Anjo creation per Complementary Law 155/2016
- System MUST enforce minimum holding period (as defined in agreement, typically 2-5 years)
- System MUST track conversion rights eligibility after minimum period
- System MUST support redemption mechanics (investor buyback option)
- System MUST calculate remuneration structure per law requirements
- System MUST flag Investimento-Anjo for tax reporting purposes
- System MUST validate that company is eligible for Investimento-Anjo program

### FR-3: MISTO/MAIS Templates
- System MUST provide pre-configured templates matching standard MISTO/MAIS structures
- System MUST allow customization of deal-specific fields within templates
- System MUST validate that customizations don't violate template constraints
- System MUST automatically populate conversion terms based on template selection
- System MUST maintain template versioning for historical reference

### FR-4: Status Tracking
- System MUST track convertible status: OUTSTANDING, CONVERTED, REDEEMED, MATURED, CANCELLED
- System MUST calculate days remaining until maturity
- System MUST flag convertibles approaching maturity (30 days warning)
- System MUST alert admin when conversion triggers are met
- System MUST track partial conversions if agreement allows

### FR-5: Interest Management
- System MUST support both simple and compound interest calculation
- System MUST allow interest payment schedule configuration (monthly, quarterly, at conversion)
- System MUST track interest payments made (if any)
- System MUST adjust accrued interest after payments
- System MUST support interest capitalization (adding to principal)

### FR-6: Document Integration
- System MUST generate convertible note document from template
- System MUST support document signature workflow
- System MUST store all documents with blockchain anchoring

---

## Data Models

### ConvertibleInstrument Entity

```typescript
interface ConvertibleInstrument {
  id: string;                          // UUID
  company_id: string;                  // Foreign key to Company
  funding_round_id: string | null;     // If part of a round
  shareholder_id: string;              // Foreign key to Shareholder (investor)

  instrument_type: InstrumentType;     // MUTUO_CONVERSIVEL | INVESTIMENTO_ANJO | MISTO | MAIS

  // Financial Terms
  principal_amount: number;            // Original investment amount
  interest_rate: number;               // Annual rate (e.g., 0.08 for 8%)
  interest_type: 'SIMPLE' | 'COMPOUND';
  discount_rate: number | null;        // Conversion discount (e.g., 0.20 for 20%)
  valuation_cap: number | null;        // Maximum valuation for conversion calculation

  // Dates
  issue_date: Date;                    // When convertible was issued
  maturity_date: Date;                 // When principal + interest is due
  minimum_holding_period_end: Date | null;  // For Investimento-Anjo

  // Conversion Terms
  conversion_terms: {
    qualified_financing_threshold: number;  // Minimum round size to trigger conversion
    triggers: ConversionTrigger[];     // Array of trigger types
    auto_convert_on_qualified_financing: boolean;
    investor_can_force_conversion: boolean;
  };

  // Investimento-Anjo Specific
  investimento_anjo_data: {
    tax_benefit_year: number | null;
    remuneration_cap: number | null;
    redemption_terms: string | null;
  } | null;

  // Interest Tracking
  accrued_interest: number;            // Current accrued interest (updated daily)
  last_interest_calculation: Date;     // Last time interest was calculated
  interest_payments: {                 // Track any interest payments made
    payment_date: Date;
    amount: number;
    payment_reference: string;
  }[];

  // Status
  status: ConvertibleStatus;           // OUTSTANDING | CONVERTED | REDEEMED | MATURED | CANCELLED
  converted_at: Date | null;
  conversion_transaction_id: string | null;  // Link to resulting share issuance
  conversion_share_class_id: string | null;  // Which class shares were issued into

  // Conversion Details (populated after conversion — see convertible-conversion.md)
  conversion_data: {
    conversion_amount: number;         // Principal + accrued interest
    conversion_price_per_share: number;
    shares_issued: number;
    round_valuation: number;
    method_used: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE';
    executed_by: string;               // User ID who executed conversion
  } | null;

  // Documents
  convertible_note_document_id: string | null;
  conversion_certificate_id: string | null;

  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: string;                  // User ID who created
}

enum InstrumentType {
  MUTUO_CONVERSIVEL = 'mutuo_conversivel',
  INVESTIMENTO_ANJO = 'investimento_anjo',
  MISTO = 'misto',
  MAIS = 'mais'
}

enum ConversionTrigger {
  QUALIFIED_FINANCING = 'qualified_financing',
  MATURITY = 'maturity',
  CHANGE_OF_CONTROL = 'change_of_control',
  INVESTOR_OPTION = 'investor_option'
}

enum ConvertibleStatus {
  OUTSTANDING = 'outstanding',
  CONVERTED = 'converted',
  REDEEMED = 'redeemed',
  MATURED = 'matured',
  CANCELLED = 'cancelled'
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/convertibles
**Description**: Create new convertible instrument

**Request**:
```json
{
  "shareholder_id": "uuid",
  "instrument_type": "mutuo_conversivel",
  "principal_amount": 100000.00,
  "interest_rate": 0.08,
  "interest_type": "simple",
  "discount_rate": 0.20,
  "valuation_cap": 5000000,
  "issue_date": "2024-01-15",
  "maturity_date": "2026-01-15",
  "conversion_terms": {
    "qualified_financing_threshold": 500000,
    "triggers": ["qualified_financing", "maturity"],
    "auto_convert_on_qualified_financing": true,
    "investor_can_force_conversion": false
  }
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "company_id": "uuid",
  "shareholder_id": "uuid",
  "instrument_type": "mutuo_conversivel",
  "principal_amount": 100000.00,
  "interest_rate": 0.08,
  "discount_rate": 0.20,
  "valuation_cap": 5000000,
  "status": "outstanding",
  "accrued_interest": 0,
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid financial terms or missing required fields
- `404 Not Found` - Shareholder not found
- `403 Forbidden` - User lacks permission to create convertibles

---

### GET /api/v1/companies/:companyId/convertibles
**Description**: List all convertible instruments for a company

**Query Parameters**:
- `status` (optional): Filter by status (outstanding, converted, etc.)
- `shareholder_id` (optional): Filter by specific investor

**Response** (200 OK):
```json
{
  "convertibles": [
    {
      "id": "uuid",
      "shareholder_name": "Investor ABC",
      "instrument_type": "mutuo_conversivel",
      "principal_amount": 100000.00,
      "accrued_interest": 8000.00,
      "total_value": 108000.00,
      "status": "outstanding",
      "issue_date": "2024-01-15",
      "maturity_date": "2026-01-15",
      "days_to_maturity": 365
    }
  ],
  "summary": {
    "total_outstanding": 2,
    "total_principal": 250000.00,
    "total_accrued_interest": 20000.00,
    "total_value": 270000.00
  }
}
```

---

### GET /api/v1/companies/:companyId/convertibles/:convertibleId
**Description**: Get detailed information for a convertible instrument

**Response** (200 OK):
```json
{
  "id": "uuid",
  "company_id": "uuid",
  "shareholder_id": "uuid",
  "shareholder_name": "Investor ABC",
  "instrument_type": "mutuo_conversivel",
  "principal_amount": 100000.00,
  "interest_rate": 0.08,
  "interest_type": "simple",
  "discount_rate": 0.20,
  "valuation_cap": 5000000,
  "issue_date": "2024-01-15",
  "maturity_date": "2026-01-15",
  "days_to_maturity": 365,
  "accrued_interest": 8000.00,
  "total_conversion_amount": 108000.00,
  "conversion_terms": {
    "qualified_financing_threshold": 500000,
    "triggers": ["qualified_financing", "maturity"],
    "auto_convert_on_qualified_financing": true
  },
  "status": "outstanding",
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

### GET /api/v1/companies/:companyId/convertibles/:convertibleId/interest
**Description**: Get detailed interest calculation breakdown

**Response** (200 OK):
```json
{
  "convertible_id": "uuid",
  "principal_amount": 100000.00,
  "interest_rate": 0.08,
  "interest_type": "simple",
  "issue_date": "2024-01-15",
  "calculation_date": "2024-07-15",
  "days_elapsed": 182,
  "accrued_interest": 4000.00,
  "total_value": 104000.00,
  "interest_breakdown": [
    {
      "period": "2024-01-15 to 2024-02-15",
      "days": 31,
      "interest_accrued": 678.08
    }
  ],
  "interest_payments": []
}
```

---

### PUT /api/v1/companies/:companyId/convertibles/:convertibleId
**Description**: Update convertible instrument (only allowed if status = outstanding)

**Request**:
```json
{
  "maturity_date": "2027-01-15",
  "discount_rate": 0.25,
  "valuation_cap": 6000000
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "maturity_date": "2027-01-15",
  "discount_rate": 0.25,
  "valuation_cap": 6000000,
  "updated_at": "2024-07-15T10:00:00Z"
}
```

**Business Rule**: Only specific fields can be updated, and only before conversion.

---

### POST /api/v1/companies/:companyId/convertibles/:convertibleId/redeem
**Description**: Redeem convertible (investor buyback)

**Request**:
```json
{
  "redemption_amount": 108000.00,
  "redemption_date": "2024-07-15",
  "payment_reference": "Wire transfer confirmation #12345"
}
```

**Response** (200 OK):
```json
{
  "convertible_id": "uuid",
  "status": "redeemed",
  "redemption_amount": 108000.00,
  "redeemed_at": "2024-07-15T14:00:00Z"
}
```

---

### POST /api/v1/companies/:companyId/convertibles/:convertibleId/cancel
**Description**: Cancel convertible (by mutual agreement)

**Request**:
```json
{
  "cancellation_reason": "Investor withdrew commitment",
  "cancelled_by": "uuid"
}
```

**Response** (200 OK):
```json
{
  "convertible_id": "uuid",
  "status": "cancelled",
  "cancelled_at": "2024-07-15T14:00:00Z"
}
```

---

**Note**: For conversion scenario modeling and conversion execution endpoints, see `convertible-conversion.md`.

---

## Business Rules

### BR-1: Interest Accrual
- Interest MUST accrue daily from issue date using exact day count (actual/365)
- Simple interest formula: I = P x r x (days / 365)
- Compound interest formula: A = P x (1 + r/365)^days
- Interest calculation job MUST run daily at midnight UTC
- Accrued interest MUST be included in final conversion amount
- Interest payments (if any) MUST reduce accrued interest balance

### BR-2: Investimento-Anjo Compliance
- Minimum holding period MUST be enforced per Complementary Law 155/2016
- Tax benefit eligibility MUST be tracked for reporting
- Remuneration cap MUST not exceed legal limits
- Redemption terms MUST comply with law requirements
- System MUST generate tax documentation for investors

### BR-3: Update Restrictions
- Cannot update convertible after conversion (status = converted)
- Cannot update principal_amount after issuance
- Can update maturity date by mutual agreement
- Can update discount/cap terms only if agreement allows

### BR-4: MISTO/MAIS Template Constraints
- Templates MUST have version tracking for historical reference
- Customizations MUST NOT violate template constraints
- Conversion terms auto-populated from template selection

### BR-5: Status Transitions
- Valid transitions: OUTSTANDING -> CONVERTED, OUTSTANDING -> REDEEMED, OUTSTANDING -> MATURED, OUTSTANDING -> CANCELLED
- MATURED -> OUTSTANDING (via maturity extension)
- MATURED -> CONVERTED (via manual conversion at maturity)
- MATURED -> REDEEMED (via redemption at maturity)
- CONVERTED, REDEEMED, CANCELLED are terminal states

### BR-6: Maturity Notifications
- System MUST flag convertibles approaching maturity (30 days warning)
- System MUST send notification to admin and investor at maturity
- System MUST update status to MATURED on maturity date if still outstanding

---

## User Flows

### Flow 1: Create Mutuo Conversivel

```
PRECONDITION: Admin user has created shareholder record for investor

1. Admin navigates to company dashboard
2. Admin clicks "Convertibles" tab
3. Admin clicks "Create Convertible Instrument"
4. System displays form with instrument type selection
5. Admin selects "Mutuo Conversivel"
6. System displays Mutuo Conversivel-specific form with sections:
   - Investor Information (dropdown to select shareholder)
   - Financial Terms (principal, interest rate, interest type)
   - Conversion Terms (discount, cap, threshold)
   - Dates (issue date, maturity date)
   - Triggers (checkboxes for trigger types)
7. Admin fills form:
   - Shareholder: "Investor ABC"
   - Principal: R$ 100,000.00
   - Interest Rate: 8% per year
   - Interest Type: Simple
   - Discount Rate: 20%
   - Valuation Cap: R$ 5,000,000
   - Issue Date: 2024-01-15
   - Maturity Date: 2026-01-15 (2 years)
   - Qualified Financing Threshold: R$ 500,000
   - Triggers: Qualified Financing, Maturity
   - Auto-convert: Yes
8. System validates all fields
9. System calculates and displays summary:
   - Total maturity value (if no conversion): R$ 116,000
   - Days to maturity: 730 days
10. Admin clicks "Create Convertible"
11. System calls POST /api/v1/companies/:id/convertibles
12. Backend creates ConvertibleInstrument record
13. Backend schedules daily interest calculation job
14. System displays success message
15. System redirects to convertible detail page
16. Admin can click "Generate Document" to create note

POSTCONDITION: Convertible created with status = "outstanding", interest accruing daily
```

### Flow 2: Create Investimento-Anjo

```
PRECONDITION: Admin creating convertible for angel investor

1. Admin clicks "Create Convertible Instrument"
2. Admin selects "Investimento-Anjo"
3. System displays warning banner:
   "Investimento-Anjo has specific legal requirements per Law 155/2016.
   Ensure your company qualifies and investor meets eligibility criteria."
4. System displays Investimento-Anjo specific form:
   - Investor Information
   - Investment Amount
   - Minimum Holding Period (dropdown: 2, 3, 5 years)
   - Remuneration Type (fixed return, profit sharing, conversion)
   - Conversion Rights (optional after minimum period)
   - Tax Benefit Year (for investor reporting)
5. Admin fills form:
   - Investor: "Angel Investor Maria"
   - Amount: R$ 50,000
   - Minimum Holding: 2 years
   - Remuneration: Optional conversion after 2 years + 5% annual return
   - Issue Date: 2024-01-15
   - Minimum Holding End: 2026-01-15
6. System validates:
   - Company is eligible (startup < 10 years, annual revenue < limit)
   - Investment amount within legal limits
   - Remuneration terms comply with law
7. Admin clicks "Create"
8. System creates convertible with special flags:
   - instrument_type = "INVESTIMENTO_ANJO"
   - investimento_anjo_data populated
   - minimum_holding_period_end set
9. System generates Investimento-Anjo contract from template
10. System marks for tax reporting
11. Admin sends contract for signatures

POSTCONDITION: Investimento-Anjo created with legal compliance tracking
```

---

## Technical Implementation

### Convertible Service (Creation & Interest)

```typescript
// /backend/src/convertibles/convertibles.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class ConvertiblesService {
  constructor(private prisma: PrismaService) {}

  async createConvertible(companyId: string, createDto: CreateConvertibleDto) {
    // Validate shareholder exists
    const shareholder = await this.prisma.shareholder.findUnique({
      where: { id: createDto.shareholder_id },
    });

    if (!shareholder) {
      throw new NotFoundException('Shareholder not found');
    }

    // Validate dates
    if (createDto.maturity_date <= createDto.issue_date) {
      throw new BadRequestException('Maturity date must be after issue date');
    }

    // Validate interest rate
    if (createDto.interest_rate > 0.30) {
      // Warn but allow
      this.logger.warn(`High interest rate (${createDto.interest_rate}) for convertible`);
    }

    // Create convertible
    const convertible = await this.prisma.convertibleInstrument.create({
      data: {
        company_id: companyId,
        shareholder_id: createDto.shareholder_id,
        instrument_type: createDto.instrument_type,
        principal_amount: createDto.principal_amount,
        interest_rate: createDto.interest_rate,
        interest_type: createDto.interest_type || 'SIMPLE',
        discount_rate: createDto.discount_rate,
        valuation_cap: createDto.valuation_cap,
        issue_date: createDto.issue_date,
        maturity_date: createDto.maturity_date,
        conversion_terms: createDto.conversion_terms,
        accrued_interest: 0,
        last_interest_calculation: createDto.issue_date,
        status: 'OUTSTANDING',
      },
    });

    return convertible;
  }

  async calculateAccruedInterest(convertibleId: string): Promise<number> {
    const convertible = await this.prisma.convertibleInstrument.findUnique({
      where: { id: convertibleId },
    });

    const today = new Date();
    const issueDate = new Date(convertible.issue_date);
    const daysElapsed = Math.floor(
      (today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let accruedInterest: number;

    if (convertible.interest_type === 'SIMPLE') {
      // Simple Interest: I = P x r x (days / 365)
      accruedInterest = new Decimal(convertible.principal_amount)
        .mul(convertible.interest_rate)
        .mul(daysElapsed)
        .div(365)
        .toDecimalPlaces(2)
        .toNumber();
    } else {
      // Compound Interest: A = P x (1 + r/365)^days
      const compoundFactor = new Decimal(1)
        .add(new Decimal(convertible.interest_rate).div(365))
        .pow(daysElapsed);
      const totalAmount = new Decimal(convertible.principal_amount).mul(compoundFactor);
      accruedInterest = totalAmount
        .sub(convertible.principal_amount)
        .toDecimalPlaces(2)
        .toNumber();
    }

    // Subtract any interest payments made
    const totalPayments = convertible.interest_payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    return Math.max(0, accruedInterest - totalPayments);
  }
}
```

### Daily Interest Calculation Job

```typescript
// /backend/src/convertibles/jobs/interest-calculation.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ConvertiblesService } from '../convertibles.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('convertibles')
export class InterestCalculationProcessor {
  constructor(
    private convertiblesService: ConvertiblesService,
    private prisma: PrismaService,
  ) {}

  @Process('calculate-daily-interest')
  async handleDailyInterest(job: Job) {
    // Get all outstanding convertibles
    const convertibles = await this.prisma.convertibleInstrument.findMany({
      where: { status: 'OUTSTANDING' },
    });

    for (const convertible of convertibles) {
      try {
        // Calculate current accrued interest
        const accruedInterest = await this.convertiblesService.calculateAccruedInterest(
          convertible.id,
        );

        // Update database
        await this.prisma.convertibleInstrument.update({
          where: { id: convertible.id },
          data: {
            accrued_interest: accruedInterest,
            last_interest_calculation: new Date(),
          },
        });

        // Check if maturity reached
        const today = new Date();
        if (today >= convertible.maturity_date && convertible.status === 'OUTSTANDING') {
          await this.prisma.convertibleInstrument.update({
            where: { id: convertible.id },
            data: { status: 'MATURED' },
          });

          // Send notification
          // TODO: Implement notification service
        }
      } catch (error) {
        this.logger.error(`Failed to calculate interest for convertible ${convertible.id}`, error);
      }
    }

    return { processed: convertibles.length };
  }
}
```

---

## Edge Cases & Error Handling

### EC-1: Negative Accrued Interest Due to Calculation Error
**Scenario**: Bug in interest calculation causes negative accrued_interest
**Handling**:
- Daily job detects negative value
- Log critical error with convertible details
- Alert engineering team immediately
- Reset to last known good value
- Prevent conversion until resolved
- Manual review required

### EC-2: Interest Rate Exceeds Market Norms
**Scenario**: Admin enters 50% annual interest rate (unusual)
**Handling**:
- System validates interest_rate <= 0.30 (30% max)
- If exceeded, show warning: "Interest rate of 50% is unusually high. Typical range: 6-12%. Confirm this is correct?"
- Require explicit confirmation
- Log high-interest convertibles for compliance review

### EC-3: Maturity Date Before Issue Date
**Scenario**: Admin enters maturity_date = 2023-01-01, issue_date = 2024-01-01
**Handling**:
- Client-side validation prevents submission
- If bypassed, backend returns 400 Bad Request
- Error: "Maturity date must be after issue date"

### EC-4: Investor Requests Redemption Before Maturity
**Scenario**: Investor wants money back after 1 year, but maturity is 2 years
**Handling**:
- Check agreement for early redemption clause
- If not allowed: Admin explains to investor, no system action
- If allowed: Admin uses "Redeem" function, enters notes
- System confirms redemption request sent
- Awaits mutual agreement before finalizing

**Note**: For conversion-specific edge cases (trigger validation, blockchain outage during conversion, multiple simultaneous conversions, MFN selection, etc.), see `convertible-conversion.md`.

---

## Dependencies

### Internal Dependencies
- **Shareholders**: Convertibles reference shareholder (investor) records
- **Funding Rounds**: Conversions triggered by funding round closings (see `convertible-conversion.md`)
- **Transactions**: Conversion creates share issuance transaction (see `convertible-conversion.md`)
- **Cap Table**: Conversion updates cap table automatically (see `convertible-conversion.md`)
- **Share Classes**: Conversion targets specific share class
- **Blockchain Integration**: All conversions recorded on-chain
- **Document Generation**: Convertible notes and conversion certificates generated from templates
- **Notifications**: Email alerts for maturity, conversion triggers, and status changes

### External Dependencies
- **Base Network**: Blockchain for recording conversions
- **Privy**: Admin wallet for submitting conversion transactions
- **AWS S3**: Document storage (convertible notes, certificates)
- **Bull Queue**: Background job processing for daily interest calculations
- **PostgreSQL**: Transactional database for convertible records

---

## Security Considerations

### SEC-1: Instrument Authorization
- Only admin and finance roles can create convertibles
- Only admin role can update, redeem, or cancel convertibles
- Investor can view their own convertibles only
- Log all instrument creation and modification with user ID

### SEC-2: Financial Data Validation
- Validate principal_amount > 0
- Validate interest_rate >= 0 and <= 1.0 (100%)
- Validate discount_rate >= 0 and <= 1.0
- Validate valuation_cap > 0
- Prevent manipulation via input sanitization

### SEC-3: Interest Calculation Integrity
- Use Decimal library for precise calculations (avoid float errors)
- Store interest calculation history for audit
- Detect and alert on anomalous interest values
- Daily job runs at consistent time (midnight UTC)

### SEC-4: Document Security
- Encrypt convertible note documents in S3
- Only authorized users can download documents
- Watermark documents with user info and timestamp
- Log all document access events

**Note**: For conversion-specific security (conversion authorization, conversion data immutability, conversion rate limiting), see `convertible-conversion.md`.

---

## Frontend Implementation

### FE-1: Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard/investments` | InvestmentsPage | Shared tab container — "Convertibles" tab |
| `/dashboard/investments/convertibles/new` | CreateConvertiblePage | Type-adaptive creation form |
| `/dashboard/investments/convertibles/[convertibleId]` | ConvertibleDetailPage | Detail with interest, scenarios, actions |
| `/dashboard/investments/convertibles/[convertibleId]/edit` | EditConvertiblePage | Edit convertible (OUTSTANDING status only) |

**Navigation**: Shared with Funding Rounds under "Investments" sidebar item. Convertibles is the second tab.

### FE-2: Page Layouts

#### Convertibles List (within InvestmentsPage, "Convertibles" tab)

```
┌─────────────────────────────────────────────────────────┐
│  [Rounds] [Convertibles]  ← Tab bar (active)           │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Outstanding│ │Total     │ │Total     │ │Total     │  │
│  │Count     │ │Principal │ │Accrued   │ │Value     │  │
│  │  5       │ │R$ 2.1M   │ │R$ 84K    │ │R$ 2.18M  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  Filters: [Status ▼] [Type ▼] [Investor ▼]  🔍 Search  │
├─────────────────────────────────────────────────────────┤
│  Convertibles Table (paginated)                         │
│  ...                                                    │
│  ═══════════════════════════════════════════════════════ │
│  TOTAL: R$ 2.1M principal | R$ 84K interest | R$ 2.18M │
├─────────────────────────────────────────────────────────┤
│  Showing 1-10 of 15                    < 1 2 >          │
└─────────────────────────────────────────────────────────┘
```

#### Convertible Detail Page

```
┌─────────────────────────────────────────────────────────┐
│  ← Back    TypeBadge  StatusBadge    [Edit] [Actions ▼] │
│  h1: Mutuo Conversivel — Fund ABC                       │
│  body-sm: Created 10/01/2026 · Maturity 10/01/2028     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Principal │ │Accrued   │ │Total     │ │Days to   │  │
│  │R$ 500K   │ │Interest  │ │Value     │ │Maturity  │  │
│  │          │ │R$ 22.4K  │ │R$ 522.4K │ │  342     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  ⚠️ MaturityWarning (if <=30 days to maturity)          │
├─────────────────────────────────────────────────────────┤
│  [Details/Terms] [Interest] [Scenarios] [Documents]     │
│  ...tab content...                                      │
└─────────────────────────────────────────────────────────┘
```

### FE-3: Components

| Component | Description | Props |
|-----------|-------------|-------|
| `ConvertibleInstrumentTable` | Paginated table of convertible instruments with summary footer | `companyId: string`, `filters?: ConvertibleFilters` |
| `ConvertibleSummaryCards` | 4 stat cards for convertible metrics | `companyId: string` |
| `ConvertibleDetailHeader` | Header with type/status badges, back link, actions menu | `convertible: ConvertibleInstrument` |
| `InterestBreakdownTable` | Period-by-period interest calculation display | `convertibleId: string` |
| `InterestAccrualChart` | Line chart showing interest accrual over time (Recharts) | `interestHistory: InterestEntry[]` |
| `ConvertibleTermsCard` | Card displaying conversion terms (cap, discount, trigger) | `convertible: ConvertibleInstrument` |
| `InvestimentoAnjoWarning` | Compliance alert for Investimento-Anjo specific requirements | `holdingPeriodEnd: Date`, `isInHoldingPeriod: boolean` |
| `MaturityWarning` | Yellow banner displayed when <= 30 days to maturity | `maturityDate: Date`, `daysRemaining: number` |
| `InstrumentTypeBadge` | Badge showing instrument type with appropriate color | `type: InstrumentType` |
| `ConvertibleStatusBadge` | Status pill badge for convertible status | `status: ConvertibleStatus` |
| `RedeemModal` | Modal form for redeeming a convertible | `convertibleId: string`, `onSuccess: () => void` |
| `CancelConvertibleModal` | Destructive confirmation modal for cancellation | `convertibleId: string`, `onSuccess: () => void` |

### FE-4: Tables

#### Convertibles Table

| Column | Field | Type | Sortable | Alignment |
|--------|-------|------|----------|-----------|
| Investor | `investor.name` | text with avatar | Yes | Left |
| Type | `instrumentType` | instrument type badge | Yes | Left |
| Principal | `principalAmount` | currency (BRL) | Yes | Right |
| Accrued Interest | `accruedInterest` | currency (BRL) | Yes | Right |
| Total Value | computed (principal + interest) | currency (BRL) | Yes | Right |
| Status | `status` | status badge | Yes | Center |
| Maturity Date | `maturityDate` | date (dd/MM/yyyy) | Yes | Left |
| Days Remaining | computed | number (red if <= 30) | Yes | Right |

- Default sort: `-createdAt`
- Summary footer row: Total principal, total accrued interest, total value (bold, `gray-800`)
- Empty state: "Nenhum instrumento conversivel" + "Criar instrumento" CTA

#### Interest Breakdown Table

| Column | Field | Type | Alignment |
|--------|-------|------|-----------|
| Period | `periodLabel` | text (e.g., "Jan 2026") | Left |
| Days | `daysInPeriod` | number | Right |
| Interest Accrued | `interestAmount` | currency (BRL) | Right |

- No pagination (all periods displayed)
- Cumulative total row at bottom

### FE-5: Forms

#### Create/Edit Convertible Form

The form adapts based on the selected instrument type, showing/hiding fields as appropriate.

**Section 1: Instrument Type**

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `instrumentType` | Tipo de Instrumento | radio group (MUTUO_CONVERSIVEL, INVESTIMENTO_ANJO, MISTO, MAIS) | must select one | Yes |

**Section 2: Investor**

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `shareholderId` | Investidor | searchable select (shareholders) | must exist | Yes |

**Section 3: Financial Terms**

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `principalAmount` | Valor Principal | currency input (BRL) | > 0 | Yes |
| `interestRate` | Taxa de Juros (% a.a.) | percentage input | >= 0, <= 100 | Yes |
| `interestType` | Tipo de Juros | select (SIMPLE, COMPOUND) | must select | Yes |
| `dayCountConvention` | Convencao de Dias | select (ACTUAL_360, ACTUAL_365, BUSINESS_252) | must select | Yes |
| `issueDate` | Data de Emissao | date picker | <= today | Yes |
| `maturityDate` | Data de Vencimento | date picker | > issueDate | Yes |
| `maturityMonths` | Prazo (meses) | number input | auto-calculated from dates | No |

**Section 4: Conversion Terms**

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `valuationCap` | Valuation Cap | currency input (BRL) | > 0 if provided | No |
| `discountRate` | Taxa de Desconto (%) | percentage input | 0-100 | No |
| `qualifiedFinancingThreshold` | Financiamento Qualificado Minimo | currency input (BRL) | > 0 if provided | No |
| `hasMfnClause` | Clausula MFN (Nacao Mais Favorecida) | toggle | — | No |

**Section 5: Investimento-Anjo Specific** (shown only when `instrumentType === 'INVESTIMENTO_ANJO'`)

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `minimumHoldingPeriod` | Periodo Minimo de Retencao (meses) | number input | >= 24 (legal minimum) | Yes |
| `maximumHoldingPeriod` | Periodo Maximo de Retencao (meses) | number input | >= minimumHoldingPeriod | Yes |
| `remunerationRate` | Taxa de Remuneracao (% a.a.) | percentage input | >= 0 | No |
| `participationInProfits` | Participacao nos Lucros | toggle | — | No |

- **Live preview**: Maturity value calculated as: principal x (1 + rate)^years for compound, or principal x (1 + rate x years) for simple. Displayed in a side card.
- **Layout**: Multi-section vertical form with collapsible sections. Submit: "Criar Instrumento" / "Salvar Alteracoes"

### FE-6: Visualizations

#### Interest Accrual Chart

- **Type**: Area line chart (Recharts `AreaChart`)
- **X-axis**: Months (from issue date to maturity)
- **Y-axis**: Value in BRL
- **Line 1**: Total value (principal + interest) — `ocean-600`, solid, filled area below
- **Line 2**: Principal (constant) — `gray-300`, dashed
- **Fill**: Gradient area between Line 1 and Line 2 in `ocean-100` opacity
- **Today marker**: Vertical dashed line in `navy-900` with "Hoje" label
- **Tooltip**: Shows date, principal, accrued interest, total value
- **Container**: White card, title "Evolucao dos Juros"

### FE-7: Modals & Dialogs

| Modal | Size | Type | Key Elements |
|-------|------|------|--------------|
| RedeemModal | Medium (560px) | Form | 3 fields: redemption amount (pre-filled with total value), redemption date, notes. Summary card showing principal + interest breakdown. Submit: "Resgatar Instrumento" |
| CancelConvertibleModal | Small (400px) | Destructive | Warning text, cancellation reason textarea (required), red "Cancelar Instrumento" button |

### FE-8: Status Badges

#### Convertible Status

| Status | Background | Text Color | Label (PT-BR) | Label (EN) |
|--------|-----------|------------|----------------|------------|
| `OUTSTANDING` | `blue-50` | `blue-600` | Vigente | Outstanding |
| `CONVERTED` | `green-100` | `green-700` | Convertido | Converted |
| `REDEEMED` | `cream-100` | `cream-700` | Resgatado | Redeemed |
| `MATURED` | `#FEE2E2` | `#991B1B` | Vencido | Matured |
| `CANCELLED` | `gray-100` | `gray-600` | Cancelado | Cancelled |

#### Instrument Type

| Type | Background | Text Color | Label (PT-BR) | Label (EN) |
|------|-----------|------------|----------------|------------|
| `MUTUO_CONVERSIVEL` | `navy-100` | `navy-700` | Mutuo Conversivel | Convertible Loan |
| `INVESTIMENTO_ANJO` | `cream-100` | `cream-700` | Investimento-Anjo | Angel Investment |
| `MISTO` | `blue-50` | `blue-600` | MISTO | MISTO |
| `MAIS` | `green-100` | `green-700` | MAIS | MAIS |

### FE-9: Role-Based UI

| Action | ADMIN | FINANCE | LEGAL | INVESTOR |
|--------|-------|---------|-------|----------|
| View convertibles list | All | All | All | Own instruments only |
| View convertible detail | Full detail | Full detail | Full detail | Own instrument only |
| Create convertible | Yes | No | No | No |
| Edit convertible | Yes (OUTSTANDING) | No | No | No |
| Convert to equity | Yes | Yes | No | No |
| Redeem | Yes | No | No | No |
| Cancel | Yes | No | No | No |
| View interest breakdown | Yes | Yes | Yes | Own only |
| View scenarios | Yes | Yes | Yes | No |

- **INVESTOR view**: Filtered list showing only their instruments. Detail page shows terms and interest but not conversion scenarios.
- **Hidden actions**: Buttons not shown for unauthorized roles.

### FE-10: API Integration (TanStack Query)

```typescript
// Query key factory
const convertibleKeys = {
  all: (companyId: string) => ['convertibles', companyId] as const,
  list: (companyId: string, filters?: ConvertibleFilters) => [...convertibleKeys.all(companyId), 'list', filters] as const,
  detail: (companyId: string, convertibleId: string) => [...convertibleKeys.all(companyId), convertibleId] as const,
  interest: (companyId: string, convertibleId: string) => [...convertibleKeys.detail(companyId, convertibleId), 'interest'] as const,
  scenarios: (companyId: string, convertibleId: string) => [...convertibleKeys.detail(companyId, convertibleId), 'scenarios'] as const,
};

// Hooks
function useConvertibles(companyId: string, filters?: ConvertibleFilters);
function useConvertible(companyId: string, convertibleId: string);
function useConvertibleInterest(companyId: string, convertibleId: string);
function useCreateConvertible(companyId: string);          // POST mutation
function useUpdateConvertible(companyId: string);          // PUT mutation
function useRedeemConvertible(companyId: string);          // POST mutation
function useCancelConvertible(companyId: string);          // POST mutation
function useConvertToEquity(companyId: string);            // POST mutation (see convertible-conversion.md)
```

**Cache invalidation on convert to equity**:
- Invalidate `convertibleKeys.all` (status changes to CONVERTED)
- Invalidate `['cap-table', companyId]` (new shares issued)
- Invalidate `['transactions', companyId]` (conversion transaction created)
- Invalidate `['shareholders', companyId]` (shareholder may gain new holdings)

### FE-11: i18n Keys

Namespace: `convertibles`

```
convertibles.title = "Instrumentos Conversiveis" / "Convertible Instruments"
convertibles.subtitle = "Gerencie mutuo conversivel, investimento-anjo e instrumentos MISTO/MAIS" / "Manage convertible loans, angel investments, and MISTO/MAIS instruments"
convertibles.new = "Novo Instrumento" / "New Instrument"
convertibles.edit = "Editar Instrumento" / "Edit Instrument"

convertibles.form.instrumentType = "Tipo de Instrumento" / "Instrument Type"
convertibles.form.investor = "Investidor" / "Investor"
convertibles.form.principalAmount = "Valor Principal" / "Principal Amount"
convertibles.form.interestRate = "Taxa de Juros (% a.a.)" / "Interest Rate (% p.a.)"
convertibles.form.interestType = "Tipo de Juros" / "Interest Type"
convertibles.form.interestTypeSimple = "Simples" / "Simple"
convertibles.form.interestTypeCompound = "Composto" / "Compound"
convertibles.form.dayCountConvention = "Convencao de Dias" / "Day Count Convention"
convertibles.form.issueDate = "Data de Emissao" / "Issue Date"
convertibles.form.maturityDate = "Data de Vencimento" / "Maturity Date"
convertibles.form.maturityMonths = "Prazo (meses)" / "Term (months)"
convertibles.form.valuationCap = "Valuation Cap" / "Valuation Cap"
convertibles.form.discountRate = "Taxa de Desconto (%)" / "Discount Rate (%)"
convertibles.form.qualifiedFinancing = "Financiamento Qualificado Minimo" / "Qualified Financing Threshold"
convertibles.form.mfnClause = "Clausula MFN (Nacao Mais Favorecida)" / "MFN Clause (Most Favored Nation)"
convertibles.form.create = "Criar Instrumento" / "Create Instrument"
convertibles.form.save = "Salvar Alteracoes" / "Save Changes"

convertibles.form.anjoSection = "Termos Investimento-Anjo" / "Angel Investment Terms"
convertibles.form.minimumHolding = "Periodo Minimo de Retencao (meses)" / "Minimum Holding Period (months)"
convertibles.form.maximumHolding = "Periodo Maximo de Retencao (meses)" / "Maximum Holding Period (months)"
convertibles.form.remunerationRate = "Taxa de Remuneracao (% a.a.)" / "Remuneration Rate (% p.a.)"
convertibles.form.profitParticipation = "Participacao nos Lucros" / "Profit Participation"

convertibles.stats.outstandingCount = "Instrumentos Vigentes" / "Outstanding Instruments"
convertibles.stats.totalPrincipal = "Total Principal" / "Total Principal"
convertibles.stats.totalAccruedInterest = "Total Juros Acumulados" / "Total Accrued Interest"
convertibles.stats.totalValue = "Valor Total" / "Total Value"

convertibles.table.investor = "Investidor" / "Investor"
convertibles.table.type = "Tipo" / "Type"
convertibles.table.principal = "Principal" / "Principal"
convertibles.table.accruedInterest = "Juros Acumulados" / "Accrued Interest"
convertibles.table.totalValue = "Valor Total" / "Total Value"
convertibles.table.status = "Status" / "Status"
convertibles.table.maturityDate = "Vencimento" / "Maturity"
convertibles.table.daysRemaining = "Dias Restantes" / "Days Remaining"
convertibles.table.empty = "Nenhum instrumento conversivel" / "No convertible instruments"
convertibles.table.emptyCta = "Criar instrumento" / "Create instrument"

convertibles.status.outstanding = "Vigente" / "Outstanding"
convertibles.status.converted = "Convertido" / "Converted"
convertibles.status.redeemed = "Resgatado" / "Redeemed"
convertibles.status.matured = "Vencido" / "Matured"
convertibles.status.cancelled = "Cancelado" / "Cancelled"

convertibles.type.mutuoConversivel = "Mutuo Conversivel" / "Convertible Loan"
convertibles.type.investimentoAnjo = "Investimento-Anjo" / "Angel Investment"
convertibles.type.misto = "MISTO" / "MISTO"
convertibles.type.mais = "MAIS" / "MAIS"

convertibles.interest.title = "Evolucao dos Juros" / "Interest Accrual"
convertibles.interest.period = "Periodo" / "Period"
convertibles.interest.days = "Dias" / "Days"
convertibles.interest.amount = "Juros no Periodo" / "Period Interest"
convertibles.interest.cumulative = "Total Acumulado" / "Cumulative Total"

convertibles.maturityWarning = "Este instrumento vence em {days} dias ({date})" / "This instrument matures in {days} days ({date})"
convertibles.anjoWarning = "Instrumento em periodo de retencao obrigatoria ate {date}. Conversao nao permitida durante este periodo." / "Instrument in mandatory holding period until {date}. Conversion not permitted during this period."
convertibles.livePreview = "Valor na Maturidade" / "Value at Maturity"

convertibles.redeem.title = "Resgatar Instrumento" / "Redeem Instrument"
convertibles.redeem.amount = "Valor de Resgate" / "Redemption Amount"
convertibles.redeem.date = "Data de Resgate" / "Redemption Date"
convertibles.redeem.notes = "Observacoes" / "Notes"
convertibles.redeem.submit = "Resgatar Instrumento" / "Redeem Instrument"

convertibles.cancel.title = "Cancelar Instrumento" / "Cancel Instrument"
convertibles.cancel.warning = "Esta acao cancelara o instrumento conversivel permanentemente" / "This will permanently cancel the convertible instrument"
convertibles.cancel.reason = "Motivo do Cancelamento" / "Cancellation Reason"
convertibles.cancel.confirm = "Cancelar Instrumento" / "Cancel Instrument"
```

### FE-12: Error Handling UI

| Error Code | HTTP Status | UI Behavior |
|------------|-------------|-------------|
| `CONVERTIBLE_NOT_FOUND` | 404 | Redirect to convertibles list with toast "Instrumento nao encontrado" |
| `CONVERTIBLE_NOT_OUTSTANDING` | 422 | Toast warning "Instrumento nao esta vigente" |
| `CONVERTIBLE_ALREADY_CONVERTED` | 422 | Toast info "Este instrumento ja foi convertido" + refresh detail |
| `CONVERTIBLE_HOLDING_PERIOD` | 422 | Toast warning with holding period end date from `details.holdingPeriodEnd` |
| `CONVERTIBLE_MATURED` | 422 | Toast error "Este instrumento esta vencido" |
| `VAL_INVALID_INPUT` | 400 | Map `validationErrors` to form field errors via `applyServerErrors()` |
| `SYS_RATE_LIMITED` | 429 | Toast warning with retry countdown |

**Maturity warning**: Persistent yellow banner on detail page when `daysRemaining <= 30`. Uses `MaturityWarning` component with `cream-100` background, `cream-700` text.

**Loading states**:
- Convertibles list: skeleton table rows (5 rows) + skeleton stat cards
- Convertible detail: skeleton header + skeleton stat cards + skeleton tabs
- Interest chart: skeleton rectangle matching chart dimensions

---

## Success Criteria

### Performance
- Interest calculation job processes 1000 convertibles in < 5 minutes
- Dashboard loads convertible list in < 1 second
- Convertible detail page loads in < 1 second

### Accuracy
- Interest calculations accurate to 2 decimal places (100%)
- Zero rounding errors in interest calculations (Decimal.js used throughout)
- Maturity date calculations correct for all day-count conventions

### Reliability
- Daily interest calculation job runs successfully (99.9% uptime)
- Zero data loss on convertible creation or update
- Automatic retry on transient failures (3 attempts)

### User Experience
- Investors can view convertible status and accrued interest without admin help
- Maturity notifications sent 30 days in advance
- Clear display of instrument terms and current values

### Compliance
- 100% of Investimento-Anjo instruments track tax compliance
- Minimum holding periods tracked automatically
- Document generation includes all legally required terms
- MISTO/MAIS templates maintain version history

---

## Open Questions

1. Should we support partial conversions (converting portion of principal)?
2. What happens if investor has multiple convertibles in same company?
3. Should we allow convertible-to-convertible refinancing?
4. How do we handle foreign currency convertibles (USD)?
5. Should we support automated valuation cap adjustments based on milestones?

---

## Future Enhancements

- **Convertible Note Marketplace**: Secondary trading of convertibles
- **Multi-Currency Support**: USD, EUR convertibles with FX conversion
- **Milestone-Based Caps**: Automatic cap adjustments upon hitting milestones
- **Synthetic Equity**: Phantom stock and profit interest instruments
- **Y Combinator SAFE**: Support US-style SAFE notes for international startups
- **Convertible Pooling**: Bundle multiple small convertibles into single conversion
- **Tax Optimization**: Automatic tax strategy recommendations for investors
- **Convertible Analytics**: Historical conversion data and market benchmarks

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [convertible-conversion.md](./convertible-conversion.md) | Conversion calculation logic, scenario modeling, MFN enforcement, and conversion execution |
| [funding-rounds.md](./funding-rounds.md) | Funding round lifecycle and qualified financing trigger events for conversion |
| [shareholder-registry.md](./shareholder-registry.md) | Convertible holders are shareholders; conversion creates new shareholdings |
| [share-classes.md](./share-classes.md) | Convertibles convert into a specific share class |
| [company-management.md](./company-management.md) | Convertibles are scoped to a company; company must be ACTIVE |
| [document-generation.md](./document-generation.md) | Convertible agreement document generation |
| [notifications.md](./notifications.md) | Email notifications for maturity approaching, status changes, and conversion events |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, and URL conventions for convertible endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes for convertible operations (validation, business rules) |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events for convertible creation, updates, and status changes |
