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
11. [Success Criteria](#success-criteria)
12. [Open Questions](#open-questions)
13. [Future Enhancements](#future-enhancements)
14. [Related Specifications](#related-specifications)

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
