# Convertible Instruments Specification

**Topic of Concern**: Mútuo Conversível, Investimento-Anjo, MISTO/MAIS instruments

**One-Sentence Description**: The system tracks Brazilian convertible instruments and automates conversion to equity based on trigger events.

---

## Overview

Convertible instruments are debt or hybrid securities that convert to equity under specific conditions. VelaFund supports three Brazilian instruments specifically designed for early-stage startup financing:

1. **Mútuo Conversível**: Convertible loan agreement with interest accrual, valuation cap, and discount rate. Most commonly used by Brazilian startups for pre-seed and seed financing.

2. **Investimento-Anjo (Angel Investment)**: Regulated by Complementary Law 155/2016, this structure provides tax benefits for angel investors. Features mandatory minimum holding period, optional conversion rights, and specific remuneration structures compliant with Brazilian law.

3. **MISTO/MAIS**: Standardized convertible note templates developed by Brazilian VC community (Movimento MAIS). Pre-configured terms following market best practices with customizable fields for deal-specific adjustments.

The system handles the complete lifecycle: creation with configurable terms, automatic interest calculation, conversion scenario modeling, and automated conversion execution when trigger events occur. All conversions are recorded on-chain via the blockchain integration module, ensuring immutable proof of ownership transfer.

**Key Features**:
- Support for three Brazilian-specific convertible structures
- Automatic interest accrual (simple or compound)
- Conversion scenario modeling at multiple valuations
- Valuation cap and discount rate application
- Most Favorable Nation (MFN) clause enforcement
- Automated conversion execution linked to funding rounds
- Pro-forma cap table impact visualization

---

## User Stories

### US-1: Create Mútuo Conversível
**As an** admin user
**I want to** create a convertible loan with conversion terms
**So that** I can track early-stage investments that convert later

### US-2: Model Conversion Scenarios
**As an** admin or investor
**I want to** model conversion at different valuations
**So that** I can understand dilution under various scenarios

### US-3: Execute Conversion
**As an** admin user
**I want to** convert a mútuo to equity when trigger event occurs
**So that** the investor receives shares per agreed terms

### US-4: Track Accrued Interest
**As an** admin user
**I want to** view current principal and accrued interest for all convertibles
**So that** I know the total conversion amount at any point in time

### US-5: Investimento-Anjo Management
**As an** admin user
**I want to** create an Investimento-Anjo structure with minimum holding period
**So that** I can leverage tax benefits for angel investors per Law 155/2016

### US-6: View Outstanding Convertibles
**As an** investor
**I want to** see my convertible investments and their potential equity outcomes
**So that** I can understand my position in different exit scenarios

### US-7: Conversion Trigger Notification
**As an** admin user
**I want to** be notified when conversion triggers are met
**So that** I can execute conversions promptly per agreement terms

### US-8: Generate Conversion Documents
**As an** admin user
**I want to** automatically generate conversion documents
**So that** I have legal documentation for the equity conversion

---

## Functional Requirements

### FR-1: Mútuo Conversível Support
- System MUST support creation of Mútuo Conversível with principal amount, interest rate, maturity date
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

### FR-4: Conversion Calculation
- System MUST calculate conversion amount = principal + accrued interest
- System MUST apply discount rate if specified: conversion price = round price × (1 - discount)
- System MUST apply valuation cap if round valuation exceeds cap
- System MUST implement Most Favorable Nation (MFN) clause: choose best of discount OR cap
- System MUST calculate shares issued: conversion amount / conversion price
- System MUST support pro-rata allocation if round is oversubscribed

### FR-5: Conversion Scenario Modeling
- System MUST allow modeling conversion at multiple hypothetical valuations
- System MUST calculate resulting ownership percentage for each scenario
- System MUST show dilution impact on existing shareholders
- System MUST display side-by-side comparison of discount vs. cap outcomes
- System MUST update pro-forma cap table in real-time during modeling

### FR-6: Conversion Execution
- System MUST validate conversion trigger has occurred before execution
- System MUST calculate final conversion amount including all accrued interest
- System MUST create share issuance transaction automatically
- System MUST update shareholder equity holdings
- System MUST record conversion on blockchain via admin wallet
- System MUST update convertible status to "CONVERTED"
- System MUST link convertible to resulting transaction for audit trail

### FR-7: Status Tracking
- System MUST track convertible status: OUTSTANDING, CONVERTED, REDEEMED, MATURED, CANCELLED
- System MUST calculate days remaining until maturity
- System MUST flag convertibles approaching maturity (30 days warning)
- System MUST alert admin when conversion triggers are met
- System MUST track partial conversions if agreement allows

### FR-8: Interest Management
- System MUST support both simple and compound interest calculation
- System MUST allow interest payment schedule configuration (monthly, quarterly, at conversion)
- System MUST track interest payments made (if any)
- System MUST adjust accrued interest after payments
- System MUST support interest capitalization (adding to principal)

### FR-9: Document Integration
- System MUST generate convertible note document from template
- System MUST support document signature workflow
- System MUST generate conversion certificate upon execution
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

  // Conversion Details (after conversion)
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

### ConversionScenario (Computed, Not Stored)

```typescript
interface ConversionScenario {
  hypothetical_valuation: number;
  pre_money_shares: number;
  round_price_per_share: number;

  // Discount Method
  discount_conversion_price: number;   // Round price × (1 - discount)
  discount_shares_issued: number;
  discount_ownership_percentage: number;

  // Cap Method
  cap_conversion_price: number;        // Cap / pre-money shares
  cap_shares_issued: number;
  cap_ownership_percentage: number;

  // Best Method (MFN)
  best_method: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE';
  final_conversion_price: number;
  final_shares_issued: number;
  final_ownership_percentage: number;

  // Impact
  dilution_to_existing_shareholders: number;
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

### GET /api/v1/companies/:companyId/convertibles/:convertibleId/scenarios
**Description**: Model conversion scenarios at various valuations

**Query Parameters**:
- `valuations` (optional): Comma-separated list of valuations to model (default: 5 scenarios from 2M to 10M)

**Response** (200 OK):
```json
{
  "convertible_id": "uuid",
  "current_conversion_amount": 108000.00,
  "scenarios": [
    {
      "hypothetical_valuation": 5000000,
      "pre_money_shares": 1000000,
      "round_price_per_share": 5.00,
      "discount_method": {
        "conversion_price": 4.00,
        "shares_issued": 27000,
        "ownership_percentage": 2.63
      },
      "cap_method": {
        "conversion_price": 5.00,
        "shares_issued": 21600,
        "ownership_percentage": 2.11
      },
      "best_method": "discount",
      "final_conversion_price": 4.00,
      "final_shares_issued": 27000,
      "final_ownership_percentage": 2.63,
      "dilution_to_existing": 2.70
    },
    {
      "hypothetical_valuation": 10000000,
      "pre_money_shares": 1000000,
      "round_price_per_share": 10.00,
      "discount_method": {
        "conversion_price": 8.00,
        "shares_issued": 13500,
        "ownership_percentage": 1.33
      },
      "cap_method": {
        "conversion_price": 5.00,
        "shares_issued": 21600,
        "ownership_percentage": 2.11
      },
      "best_method": "cap",
      "final_conversion_price": 5.00,
      "final_shares_issued": 21600,
      "final_ownership_percentage": 2.11,
      "dilution_to_existing": 2.16
    }
  ],
  "summary": {
    "valuation_cap": 5000000,
    "discount_rate": 0.20,
    "cap_triggers_above": 6250000
  }
}
```

---

### POST /api/v1/companies/:companyId/convertibles/:convertibleId/convert
**Description**: Execute conversion to equity

**Request**:
```json
{
  "funding_round_id": "uuid",
  "round_valuation": 10000000,
  "share_class_id": "uuid",
  "notes": "Series A conversion"
}
```

**Response** (200 OK):
```json
{
  "convertible_id": "uuid",
  "conversion_status": "completed",
  "conversion_data": {
    "conversion_amount": 108000.00,
    "conversion_price_per_share": 5.00,
    "shares_issued": 21600,
    "method_used": "cap",
    "round_valuation": 10000000,
    "executed_at": "2024-07-15T14:30:00Z"
  },
  "transaction_id": "uuid",
  "blockchain_tx_hash": "0x..."
}
```

**Error Responses**:
- `400 Bad Request` - Conversion trigger not met or invalid round parameters
- `404 Not Found` - Convertible or funding round not found
- `409 Conflict` - Convertible already converted

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

## Business Rules

### BR-1: Interest Accrual
- Interest MUST accrue daily from issue date using exact day count (actual/365)
- Simple interest formula: I = P × r × (days / 365)
- Compound interest formula: A = P × (1 + r/365)^days
- Interest calculation job MUST run daily at midnight UTC
- Accrued interest MUST be included in final conversion amount
- Interest payments (if any) MUST reduce accrued interest balance

### BR-2: Valuation Cap Application
- Valuation cap applies when round valuation > cap
- Conversion price with cap = valuation cap / pre-money shares
- Cap provides investor better price (more shares) than round price
- If no cap specified, use discount method or round price

### BR-3: Discount Application
- Discount applies to round price per share
- Conversion price with discount = round price × (1 - discount rate)
- Typical discount rates: 15-30% in Brazilian market
- Discount provides investor reward for early capital commitment

### BR-4: Most Favorable Nation (MFN)
- Investor MUST receive best of: discount OR valuation cap OR round price
- System MUST calculate all three methods
- System MUST select method that gives investor most shares
- MFN calculation example:
  - Discount method: 27,000 shares
  - Cap method: 21,600 shares
  - Result: Use discount method (more favorable)

### BR-5: Qualified Financing Threshold
- Conversion only triggers if funding round amount ≥ qualified financing threshold
- Bridge rounds or small raises may not trigger conversion
- Threshold prevents conversion on small funding rounds
- If threshold not met, convertible remains outstanding

### BR-6: Automatic vs Manual Conversion
- If `auto_convert_on_qualified_financing = true`, system triggers conversion automatically
- Otherwise, admin must manually execute conversion
- System MUST send notification when trigger conditions are met
- Investor CANNOT block automatic conversion if agreed in terms

### BR-7: Maturity Handling
- At maturity, if not converted:
  - Investor may demand repayment (principal + accrued interest)
  - OR company may extend maturity by mutual agreement
  - OR investor may choose to convert at current valuation
- System MUST flag matured convertibles for action

### BR-8: Investimento-Anjo Compliance
- Minimum holding period MUST be enforced per Complementary Law 155/2016
- Tax benefit eligibility MUST be tracked for reporting
- Remuneration cap MUST not exceed legal limits
- Redemption terms MUST comply with law requirements
- System MUST generate tax documentation for investors

### BR-9: Share Class Selection
- Convertibles MUST specify target share class for conversion
- If not specified, default to same class as last funding round
- Cannot convert into founder shares (typically)
- Preferred shares common for venture-backed conversions

### BR-10: Partial Conversion
- Partial conversions NOT supported in MVP
- All principal + interest converts in single transaction
- Future enhancement: Allow multiple conversion tranches

### BR-11: Post-Conversion Audit Trail
- System MUST link convertible to resulting transaction
- System MUST preserve all conversion calculation details
- System MUST record method used (discount/cap/round)
- Blockchain transaction hash MUST be stored
- Documents MUST be generated and stored

### BR-12: Update Restrictions
- Cannot update convertible after conversion (status = converted)
- Cannot update principal_amount after issuance
- Can update maturity date by mutual agreement
- Can update discount/cap terms only if agreement allows

---

## User Flows

### Flow 1: Create Mútuo Conversível

```
PRECONDITION: Admin user has created shareholder record for investor

1. Admin navigates to company dashboard
2. Admin clicks "Convertibles" tab
3. Admin clicks "Create Convertible Instrument"
4. System displays form with instrument type selection
5. Admin selects "Mútuo Conversível"
6. System displays Mútuo Conversível-specific form with sections:
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
   - Triggers: ✓ Qualified Financing, ✓ Maturity
   - Auto-convert: ✓ Yes
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

### Flow 2: Model Conversion Scenarios

```
PRECONDITION: Convertible exists with status = outstanding, 6 months have passed

1. Admin viewing convertible detail page
2. System displays current status:
   - Principal: R$ 100,000
   - Accrued Interest: R$ 4,000 (6 months at 8%)
   - Total Conversion Amount: R$ 104,000
3. Admin clicks "Model Conversion Scenarios"
4. System displays scenario modeling tool
5. System auto-generates 5 scenarios at different valuations:
   - R$ 3M, R$ 5M, R$ 7.5M, R$ 10M, R$ 15M
6. For each scenario, system calculates:
   - Round price per share
   - Discount method result
   - Cap method result
   - Best method (MFN)
   - Resulting ownership %
7. System displays interactive table:

   | Valuation | Round Price | Discount Method | Cap Method | Best Method | Shares | Ownership % |
   |-----------|-------------|-----------------|------------|-------------|--------|-------------|
   | R$ 3M     | R$ 3.00     | R$ 2.40         | R$ 3.00    | Discount    | 43,333 | 4.15%       |
   | R$ 5M     | R$ 5.00     | R$ 4.00         | R$ 5.00    | Discount    | 26,000 | 2.53%       |
   | R$ 10M    | R$ 10.00    | R$ 8.00         | R$ 5.00    | Cap         | 20,800 | 2.04%       |
   | R$ 15M    | R$ 15.00    | R$ 12.00        | R$ 5.00    | Cap         | 20,800 | 1.37%       |

8. System highlights when cap becomes favorable (at R$ 6.25M+)
9. Admin can add custom valuation to model
10. Admin enters custom valuation: R$ 8M
11. System calculates and adds row to table
12. Admin can export scenarios to PDF for investor review
13. Admin clicks "Export Scenarios"
14. System generates PDF with all scenarios
15. Admin shares with investor

POSTCONDITION: Admin understands conversion economics at various valuations
```

### Flow 3: Execute Conversion (Automatic)

```
PRECONDITION: Company closes Series A at R$ 10M valuation (≥ R$ 500K threshold)

1. Admin creates funding round: Series A, R$ 2M raised, R$ 10M valuation
2. Admin begins closing round process
3. System detects funding_round.target_amount (R$ 2M) ≥ convertible.qualified_financing_threshold (R$ 500K)
4. System checks convertible.auto_convert_on_qualified_financing = true
5. System queues automatic conversion job
6. Background job executes conversion:
   a. Calculate current accrued interest: R$ 8,000 (1 year elapsed)
   b. Total conversion amount: R$ 108,000
   c. Round valuation: R$ 10M
   d. Pre-money shares: 1,000,000
   e. Round price per share: R$ 10.00
   f. Calculate discount method: 108,000 / (10.00 × 0.80) = 13,500 shares
   g. Calculate cap method: 108,000 / (5,000,000 / 1,000,000) = 21,600 shares
   h. MFN: Cap method gives more shares → Use cap
   i. Final: 21,600 shares at R$ 5.00 per share
7. System creates share issuance transaction:
   - Shareholder: Investor ABC
   - Share Class: Preferred Series A
   - Quantity: 21,600 shares
   - Price per share: R$ 5.00
   - Transaction type: CONVERTIBLE_CONVERSION
8. System submits transaction to blockchain via admin wallet
9. System waits for blockchain confirmation
10. System updates convertible:
    - status = "CONVERTED"
    - converted_at = now
    - conversion_transaction_id = transaction.id
    - conversion_data = { calculation details }
11. System updates cap table automatically
12. System sends notification emails:
    - To admin: "Convertible note converted successfully"
    - To investor: "Your convertible note has converted to 21,600 shares"
13. System generates conversion certificate document
14. Admin views updated cap table:
    - Investor ABC now shows 21,600 shares (2.04% ownership)
15. Admin can view conversion details on convertible page

POSTCONDITION: Convertible converted to equity, cap table updated, documents generated
```

### Flow 4: Track Accrued Interest

```
PRECONDITION: Convertible outstanding for 6 months

1. Investor logs into platform
2. Investor navigates to "My Investments"
3. System displays investor's holdings including convertibles
4. System shows:
   - Active Equity: 50,000 shares (Startup XYZ)
   - Convertible Notes: 1 outstanding
5. Investor clicks on convertible note
6. System displays convertible dashboard:
   - Instrument Type: Mútuo Conversível
   - Principal: R$ 100,000.00
   - Interest Rate: 8% per year (Simple)
   - Issue Date: Jan 15, 2024
   - Maturity Date: Jan 15, 2026
   - Days Elapsed: 182 days
   - Days to Maturity: 548 days
7. System displays interest calculation:
   - Daily Interest Rate: 0.0219% (8% / 365)
   - Accrued Interest to Date: R$ 3,986.30
   - Total Value: R$ 103,986.30
8. System shows interest accrual chart (line graph over time)
9. System displays conversion readiness:
   - ✓ Ready to Convert
   - Qualified Financing Threshold: R$ 500,000
   - Auto-Convert: Yes (will convert automatically on Series A)
10. System shows projected scenarios:
    - If Series A at R$ 5M → ~26,000 shares (~2.5%)
    - If Series A at R$ 10M → ~21,600 shares (~2.0%)
11. Investor can download investment summary (PDF)

POSTCONDITION: Investor has full visibility into convertible status and projections
```

### Flow 5: Handle Maturity Without Conversion

```
PRECONDITION: Convertible reaches maturity date, no qualified financing occurred

1. System daily job detects convertible.maturity_date = today
2. System checks convertible.status = "outstanding"
3. System updates status = "MATURED"
4. System sends notification to admin:
   - Subject: "⚠️ Convertible Note Matured - Action Required"
   - Body: "Convertible note from Investor ABC has reached maturity.
           Principal + Interest = R$ 116,000. Options:
           1. Negotiate extension
           2. Process redemption
           3. Convert at current valuation"
5. System sends notification to investor:
   - Subject: "Your Convertible Note Has Matured"
   - Body: "Your note has matured. Please contact company to discuss repayment or conversion."
6. Admin logs in and views matured convertibles dashboard
7. Admin contacts investor to negotiate
8. Option A: Extension
   a. Admin and investor agree to extend 1 year
   b. Admin clicks "Extend Maturity"
   c. Admin enters new maturity date: Jan 15, 2027
   d. System updates maturity_date
   e. System resets status = "OUTSTANDING"
9. Option B: Redemption
   a. Company pays investor R$ 116,000
   b. Admin clicks "Redeem"
   c. Admin enters payment reference
   d. System sets status = "REDEEMED"
   e. System removes from outstanding obligations
10. Option C: Convert at Current Valuation
    a. Admin determines current fair market value
    b. Admin executes manual conversion
    c. System converts using current valuation

POSTCONDITION: Matured convertible resolved through extension, redemption, or conversion
```

### Flow 6: Create Investimento-Anjo

```
PRECONDITION: Admin creating convertible for angel investor

1. Admin clicks "Create Convertible Instrument"
2. Admin selects "Investimento-Anjo"
3. System displays warning banner:
   "⚠️ Investimento-Anjo has specific legal requirements per Law 155/2016.
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
   - ✓ Company is eligible (startup < 10 years, annual revenue < limit)
   - ✓ Investment amount within legal limits
   - ✓ Remuneration terms comply with law
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

## Edge Cases & Error Handling

### EC-1: Conversion Attempt Before Trigger Condition Met
**Scenario**: Admin tries to convert when funding round is R$ 300K but threshold is R$ 500K
**Handling**:
- Return 400 Bad Request
- Error message: "Conversion trigger not met. Funding round (R$ 300,000) is below qualified financing threshold (R$ 500,000)."
- Suggest: "Wait for larger round or manually convert at current valuation."

### EC-2: Negative Accrued Interest Due to Calculation Error
**Scenario**: Bug in interest calculation causes negative accrued_interest
**Handling**:
- Daily job detects negative value
- Log critical error with convertible details
- Alert engineering team immediately
- Reset to last known good value
- Prevent conversion until resolved
- Manual review required

### EC-3: Conversion During Blockchain Network Outage
**Scenario**: Admin executes conversion but Base Network RPC is down
**Handling**:
- Backend attempts blockchain transaction
- RPC timeout after 30 seconds
- Backend does NOT update convertible status
- Backend queues retry job (up to 3 attempts)
- Display to admin: "Conversion initiated but blockchain confirmation pending. You will be notified."
- Once blockchain confirms, complete conversion flow
- If all retries fail, alert admin for manual intervention

### EC-4: Valuation Cap Below Current Valuation
**Scenario**: Convertible has R$ 5M cap, company already valued at R$ 8M
**Handling**:
- Allow creation (investor gets beneficial terms)
- Display warning during creation: "⚠️ Valuation cap is below company's current valuation. This convertible will likely convert using the cap."
- Admin confirms understanding
- Scenario modeling shows cap method always wins

### EC-5: Interest Rate Exceeds Market Norms
**Scenario**: Admin enters 50% annual interest rate (unusual)
**Handling**:
- System validates interest_rate <= 0.30 (30% max)
- If exceeded, show warning: "Interest rate of 50% is unusually high. Typical range: 6-12%. Confirm this is correct?"
- Require explicit confirmation
- Log high-interest convertibles for compliance review

### EC-6: Maturity Date Before Issue Date
**Scenario**: Admin enters maturity_date = 2023-01-01, issue_date = 2024-01-01
**Handling**:
- Client-side validation prevents submission
- If bypassed, backend returns 400 Bad Request
- Error: "Maturity date must be after issue date"

### EC-7: Investor Requests Redemption Before Maturity
**Scenario**: Investor wants money back after 1 year, but maturity is 2 years
**Handling**:
- Check agreement for early redemption clause
- If not allowed: Admin explains to investor, no system action
- If allowed: Admin uses "Redeem" function, enters notes
- System confirms redemption request sent
- Awaits mutual agreement before finalizing

### EC-8: Multiple Convertibles Converting Simultaneously
**Scenario**: Company has 3 convertibles, all with auto-convert enabled, Series A closes
**Handling**:
- System detects all 3 meet conversion criteria
- Process conversions sequentially (not parallel) to avoid race conditions
- Lock cap table during conversion batch
- Create separate transaction for each convertible
- Update cap table after all conversions complete
- Send batch notification: "3 convertible notes converted to equity"

### EC-9: Discount + Cap Both Favor Investor Differently
**Scenario**: At R$ 10M valuation, discount gives 27,000 shares but cap gives 21,600
**Handling**:
- System calculates both methods
- MFN clause: Select method with more shares
- Result: Use discount method (27,000 > 21,600)
- Display in conversion summary: "Method used: Discount (MFN)"
- Store method_used = "DISCOUNT" in conversion_data

### EC-10: Shareholder Deleted Before Conversion
**Scenario**: Investor shareholder record deleted but convertible exists
**Handling**:
- System enforces foreign key constraint (cannot delete)
- If somehow occurs: Conversion fails
- Error: "Cannot convert: Shareholder record not found"
- Admin must restore shareholder or create new record
- Link convertible to restored shareholder

### EC-11: Zero Pre-Money Shares at Conversion
**Scenario**: Bug causes pre_money_shares = 0 during conversion calculation
**Handling**:
- Division by zero error in conversion price calculation
- Backend catches exception
- Log critical error: "Pre-money shares cannot be zero"
- Abort conversion
- Return 500 Internal Server Error
- Alert engineering team
- Admin must manually verify cap table before retrying

### EC-12: Investimento-Anjo Converted Before Minimum Holding Period
**Scenario**: Admin tries to convert Investimento-Anjo after 1 year but minimum is 2 years
**Handling**:
- System checks if instrument_type = "INVESTIMENTO_ANJO"
- Validates: today >= minimum_holding_period_end
- If not met, return 400 Bad Request
- Error: "Cannot convert Investimento-Anjo before minimum holding period ends (Jan 15, 2026)"
- Display days remaining until eligible

---

## Dependencies

### Internal Dependencies
- **Shareholders**: Convertibles reference shareholder (investor) records
- **Funding Rounds**: Conversions triggered by funding round closings
- **Transactions**: Conversion creates share issuance transaction
- **Cap Table**: Conversion updates cap table automatically
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

## Technical Implementation

### Convertible Service

```typescript
// /backend/src/convertibles/convertibles.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import Decimal from 'decimal.js';

@Injectable()
export class ConvertiblesService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

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
      // Simple Interest: I = P × r × (days / 365)
      accruedInterest = new Decimal(convertible.principal_amount)
        .mul(convertible.interest_rate)
        .mul(daysElapsed)
        .div(365)
        .toDecimalPlaces(2)
        .toNumber();
    } else {
      // Compound Interest: A = P × (1 + r/365)^days
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

  async modelConversionScenarios(
    convertibleId: string,
    valuations: number[],
  ): Promise<ConversionScenario[]> {
    const convertible = await this.prisma.convertibleInstrument.findUnique({
      where: { id: convertibleId },
    });

    const accruedInterest = await this.calculateAccruedInterest(convertibleId);
    const conversionAmount = convertible.principal_amount + accruedInterest;

    // Get current pre-money shares from cap table
    const capTable = await this.prisma.capTable.findUnique({
      where: { company_id: convertible.company_id },
    });
    const preMoneyShares = capTable.total_shares;

    const scenarios: ConversionScenario[] = [];

    for (const valuation of valuations) {
      const roundPricePerShare = new Decimal(valuation).div(preMoneyShares).toNumber();

      // Method 1: Discount
      const discountPrice = convertible.discount_rate
        ? new Decimal(roundPricePerShare)
            .mul(1 - convertible.discount_rate)
            .toDecimalPlaces(2)
            .toNumber()
        : roundPricePerShare;
      const discountShares = Math.floor(conversionAmount / discountPrice);
      const discountOwnership = new Decimal(discountShares)
        .div(preMoneyShares + discountShares)
        .mul(100)
        .toDecimalPlaces(2)
        .toNumber();

      // Method 2: Cap
      const capPrice = convertible.valuation_cap
        ? new Decimal(convertible.valuation_cap).div(preMoneyShares).toNumber()
        : roundPricePerShare;
      const capShares = Math.floor(conversionAmount / capPrice);
      const capOwnership = new Decimal(capShares)
        .div(preMoneyShares + capShares)
        .mul(100)
        .toDecimalPlaces(2)
        .toNumber();

      // MFN: Choose method with more shares
      let bestMethod: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE';
      let finalShares: number;
      let finalPrice: number;

      if (discountShares >= capShares && convertible.discount_rate) {
        bestMethod = 'DISCOUNT';
        finalShares = discountShares;
        finalPrice = discountPrice;
      } else if (convertible.valuation_cap) {
        bestMethod = 'CAP';
        finalShares = capShares;
        finalPrice = capPrice;
      } else {
        bestMethod = 'ROUND_PRICE';
        finalShares = Math.floor(conversionAmount / roundPricePerShare);
        finalPrice = roundPricePerShare;
      }

      const finalOwnership = new Decimal(finalShares)
        .div(preMoneyShares + finalShares)
        .mul(100)
        .toDecimalPlaces(2)
        .toNumber();

      scenarios.push({
        hypothetical_valuation: valuation,
        pre_money_shares: preMoneyShares,
        round_price_per_share: roundPricePerShare,
        discount_conversion_price: discountPrice,
        discount_shares_issued: discountShares,
        discount_ownership_percentage: discountOwnership,
        cap_conversion_price: capPrice,
        cap_shares_issued: capShares,
        cap_ownership_percentage: capOwnership,
        best_method: bestMethod,
        final_conversion_price: finalPrice,
        final_shares_issued: finalShares,
        final_ownership_percentage: finalOwnership,
        dilution_to_existing_shareholders: new Decimal(finalShares)
          .div(preMoneyShares)
          .mul(100)
          .toDecimalPlaces(2)
          .toNumber(),
      });
    }

    return scenarios;
  }

  async executeConversion(
    convertibleId: string,
    fundingRoundId: string,
    shareClassId: string,
  ) {
    const convertible = await this.prisma.convertibleInstrument.findUnique({
      where: { id: convertibleId },
      include: { shareholder: true },
    });

    if (convertible.status !== 'OUTSTANDING') {
      throw new BadRequestException('Convertible already converted or cancelled');
    }

    // Get funding round details
    const round = await this.prisma.fundingRound.findUnique({
      where: { id: fundingRoundId },
    });

    // Validate qualified financing threshold
    if (round.target_amount < convertible.conversion_terms.qualified_financing_threshold) {
      throw new BadRequestException('Funding round does not meet qualified financing threshold');
    }

    // Calculate conversion
    const accruedInterest = await this.calculateAccruedInterest(convertibleId);
    const conversionAmount = convertible.principal_amount + accruedInterest;

    const capTable = await this.prisma.capTable.findUnique({
      where: { company_id: convertible.company_id },
    });
    const preMoneyShares = capTable.total_shares;
    const roundPrice = new Decimal(round.pre_money_valuation).div(preMoneyShares).toNumber();

    // Calculate best method (MFN)
    const discountPrice = convertible.discount_rate
      ? roundPrice * (1 - convertible.discount_rate)
      : roundPrice;
    const capPrice = convertible.valuation_cap
      ? convertible.valuation_cap / preMoneyShares
      : roundPrice;

    const discountShares = Math.floor(conversionAmount / discountPrice);
    const capShares = Math.floor(conversionAmount / capPrice);

    let finalShares: number;
    let finalPrice: number;
    let methodUsed: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE';

    if (discountShares >= capShares && convertible.discount_rate) {
      finalShares = discountShares;
      finalPrice = discountPrice;
      methodUsed = 'DISCOUNT';
    } else if (convertible.valuation_cap) {
      finalShares = capShares;
      finalPrice = capPrice;
      methodUsed = 'CAP';
    } else {
      finalShares = Math.floor(conversionAmount / roundPrice);
      finalPrice = roundPrice;
      methodUsed = 'ROUND_PRICE';
    }

    // Create transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        company_id: convertible.company_id,
        from_shareholder_id: null,
        to_shareholder_id: convertible.shareholder_id,
        share_class_id: shareClassId,
        quantity: finalShares,
        price_per_share: finalPrice,
        transaction_type: 'ISSUANCE',
        transaction_subtype: 'CONVERTIBLE_CONVERSION',
        occurred_at: new Date(),
        status: 'PENDING',
      },
    });

    // Submit to blockchain
    const txHash = await this.blockchainService.issueShares(
      convertible.company_id,
      convertible.shareholder.wallet_address,
      shareClassId,
      finalShares,
      { convertible_id: convertibleId },
    );

    // Update transaction with blockchain hash
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        blockchain_tx_hash: txHash,
        status: 'SUBMITTED',
      },
    });

    // Update convertible
    await this.prisma.convertibleInstrument.update({
      where: { id: convertibleId },
      data: {
        status: 'CONVERTED',
        converted_at: new Date(),
        conversion_transaction_id: transaction.id,
        conversion_share_class_id: shareClassId,
        conversion_data: {
          conversion_amount: conversionAmount,
          conversion_price_per_share: finalPrice,
          shares_issued: finalShares,
          round_valuation: round.pre_money_valuation,
          method_used: methodUsed,
          executed_by: 'current_user_id', // TODO: Get from context
        },
      },
    });

    return {
      convertible_id: convertibleId,
      transaction_id: transaction.id,
      blockchain_tx_hash: txHash,
      shares_issued: finalShares,
      conversion_price: finalPrice,
      method_used: methodUsed,
    };
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

### Frontend Component

```typescript
// /frontend/src/app/(dashboard)/companies/[id]/convertibles/[convertibleId]/scenarios/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function ConversionScenariosPage() {
  const params = useParams();
  const { id: companyId, convertibleId } = params;
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScenarios();
  }, [convertibleId]);

  const fetchScenarios = async () => {
    // Default valuations: 3M, 5M, 7.5M, 10M, 15M
    const valuations = [3000000, 5000000, 7500000, 10000000, 15000000];
    const response = await fetch(
      `/api/v1/companies/${companyId}/convertibles/${convertibleId}/scenarios?valuations=${valuations.join(',')}`,
    );
    const data = await response.json();
    setScenarios(data.scenarios);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="scenarios-page">
      <h1>Conversion Scenarios</h1>
      <p>Model how this convertible will convert at various valuations</p>

      {loading ? (
        <div>Loading scenarios...</div>
      ) : (
        <table className="scenarios-table">
          <thead>
            <tr>
              <th>Valuation</th>
              <th>Round Price</th>
              <th>Discount Method</th>
              <th>Cap Method</th>
              <th>Best Method</th>
              <th>Shares Issued</th>
              <th>Ownership %</th>
              <th>Dilution</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario, index) => (
              <tr key={index}>
                <td>{formatCurrency(scenario.hypothetical_valuation)}</td>
                <td>{formatCurrency(scenario.round_price_per_share)}</td>
                <td>
                  {formatCurrency(scenario.discount_conversion_price)}
                  <br />
                  <small>{scenario.discount_shares_issued.toLocaleString()} shares</small>
                </td>
                <td>
                  {formatCurrency(scenario.cap_conversion_price)}
                  <br />
                  <small>{scenario.cap_shares_issued.toLocaleString()} shares</small>
                </td>
                <td>
                  <strong>{scenario.best_method}</strong>
                </td>
                <td>{scenario.final_shares_issued.toLocaleString()}</td>
                <td>{formatPercentage(scenario.final_ownership_percentage)}</td>
                <td>{formatPercentage(scenario.dilution_to_existing_shareholders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="scenarios-summary">
        <h3>Key Insights</h3>
        <ul>
          <li>
            <strong>Valuation Cap Triggers:</strong> Cap method becomes favorable above{' '}
            {formatCurrency(scenarios[0]?.cap_triggers_above || 0)}
          </li>
          <li>
            <strong>Best Case (for investor):</strong> Lowest valuation scenario yields highest
            ownership %
          </li>
          <li>
            <strong>Worst Case (for investor):</strong> Highest valuation scenario yields lowest
            ownership %
          </li>
        </ul>
      </div>

      <button onClick={() => window.print()}>Export to PDF</button>
    </div>
  );
}
```

---

## Security Considerations

### SEC-1: Conversion Authorization
- Only admin and finance roles can create convertibles
- Only admin role can execute conversions
- Investor cannot self-convert (except if agreement allows)
- Log all conversion executions with user ID

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

### SEC-4: Conversion Data Immutability
- Once converted, convertible record becomes read-only
- Conversion data (method used, price, shares) permanently stored
- Blockchain transaction hash provides tamper-proof record
- Audit trail links convertible → transaction → blockchain

### SEC-5: Document Security
- Encrypt convertible note documents in S3
- Only authorized users can download documents
- Watermark documents with user info and timestamp
- Log all document access events

### SEC-6: Rate Limiting
- Limit conversion API calls: 10 per hour per company
- Prevent spam scenario modeling: 100 per day per user
- Detect and block automated scraping attempts

---

## Success Criteria

### Performance
- Conversion scenario modeling completes in < 2 seconds for 10 scenarios
- Interest calculation job processes 1000 convertibles in < 5 minutes
- Conversion execution (including blockchain) completes in < 30 seconds
- Dashboard loads convertible list in < 1 second

### Accuracy
- Interest calculations accurate to 2 decimal places (100%)
- Zero rounding errors in conversion calculations
- MFN clause correctly identifies best method (100%)
- Conversion amount matches formula: principal + accrued interest (100%)

### Reliability
- Daily interest calculation job runs successfully (99.9% uptime)
- Zero failed conversions due to calculation errors
- Blockchain transactions confirmed within 30 seconds (95%+ of time)
- Automatic retry on transient failures (3 attempts)

### User Experience
- Investors can view convertible status and projections without admin help
- Conversion scenarios visualized clearly for decision-making
- Maturity notifications sent 30 days in advance
- Conversion completion notifications sent immediately

### Compliance
- 100% of Investimento-Anjo instruments track tax compliance
- Minimum holding periods enforced automatically
- All conversions recorded on blockchain for audit trail
- Document generation includes all legally required terms

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
