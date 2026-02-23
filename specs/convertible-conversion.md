# Convertible Instrument Conversion Specification

**Topic of Concern**: Conversion calculation, scenario modeling, MFN enforcement, and conversion execution

**One-Sentence Description**: The system calculates, models, and executes conversion of Brazilian convertible instruments to equity based on trigger events, applying MFN logic to select the most favorable conversion method for investors.

---

## Overview

When a convertible instrument (Mutuo Conversivel, Investimento-Anjo, or MISTO/MAIS) reaches a trigger event, it converts into equity shares. This specification covers the entire conversion lifecycle: scenario modeling at hypothetical valuations, conversion price calculation using discount and valuation cap methods, Most Favorable Nation (MFN) enforcement, qualified financing trigger validation, conversion execution with blockchain recording, and post-conversion audit trail.

Conversion is tightly coupled with the funding round module (qualified financing triggers), the cap table module (share issuance and dilution), and the blockchain integration module (on-chain recording). For instrument creation, interest accrual, and status management, see `convertible-instruments.md`.

**Key Features**:
- Conversion scenario modeling at multiple valuations
- Valuation cap and discount rate application
- Most Favorable Nation (MFN) clause enforcement
- Automated conversion execution linked to funding rounds
- Pro-forma cap table impact visualization
- Sequential batch conversion for multiple instruments
- Blockchain-recorded conversion transactions

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
9. [Security Considerations](#security-considerations)
10. [Success Criteria](#success-criteria)
11. [Related Specifications](#related-specifications)

---

## User Stories

### US-1: Model Conversion Scenarios
**As an** admin or investor
**I want to** model conversion at different valuations
**So that** I can understand dilution under various scenarios

### US-2: Execute Conversion
**As an** admin user
**I want to** convert a mutuo to equity when trigger event occurs
**So that** the investor receives shares per agreed terms

### US-3: View Conversion Outcomes
**As an** investor
**I want to** see my convertible investments and their potential equity outcomes
**So that** I can understand my position in different exit scenarios

### US-4: Conversion Trigger Notification
**As an** admin user
**I want to** be notified when conversion triggers are met
**So that** I can execute conversions promptly per agreement terms

### US-5: Generate Conversion Documents
**As an** admin user
**I want to** automatically generate conversion documents
**So that** I have legal documentation for the equity conversion

---

## Functional Requirements

### FR-1: Conversion Calculation
- System MUST calculate conversion amount = principal + accrued interest
- System MUST apply discount rate if specified: conversion price = round price x (1 - discount)
- System MUST apply valuation cap if round valuation exceeds cap
- System MUST implement Most Favorable Nation (MFN) clause: choose best of discount OR cap
- System MUST calculate shares issued: conversion amount / conversion price
- System MUST support pro-rata allocation if round is oversubscribed

### FR-2: Conversion Scenario Modeling
- System MUST allow modeling conversion at multiple hypothetical valuations
- System MUST calculate resulting ownership percentage for each scenario
- System MUST show dilution impact on existing shareholders
- System MUST display side-by-side comparison of discount vs. cap outcomes
- System MUST update pro-forma cap table in real-time during modeling

### FR-3: Conversion Execution
- System MUST validate conversion trigger has occurred before execution
- System MUST calculate final conversion amount including all accrued interest
- System MUST create share issuance transaction automatically
- System MUST update shareholder equity holdings
- System MUST record conversion on blockchain via admin wallet
- System MUST update convertible status to "CONVERTED"
- System MUST link convertible to resulting transaction for audit trail

### FR-4: Conversion Triggers
- System MUST support three conversion triggers: qualified financing, maturity, change of control
- System MUST detect when a funding round meets the qualified financing threshold
- System MUST support automatic conversion when `auto_convert_on_qualified_financing = true`
- System MUST send notifications when trigger conditions are met
- System MUST support investor-initiated conversion (if agreement allows)

### FR-5: Document Integration
- System MUST generate conversion certificate upon execution
- System MUST store all documents with blockchain anchoring
- System MUST link conversion documents to the convertible and transaction records

---

## Data Models

### ConversionScenario (Computed, Not Stored)

```typescript
interface ConversionScenario {
  hypothetical_valuation: number;
  pre_money_shares: number;
  round_price_per_share: number;

  // Discount Method
  discount_conversion_price: number;   // Round price x (1 - discount)
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

### ConversionData (Stored on ConvertibleInstrument after conversion)

```typescript
interface ConversionData {
  conversion_amount: number;         // Principal + accrued interest
  conversion_price_per_share: number;
  shares_issued: number;
  round_valuation: number;
  method_used: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE';
  executed_by: string;               // User ID who executed conversion
}
```

### ConversionTrigger Enum

```typescript
enum ConversionTrigger {
  QUALIFIED_FINANCING = 'qualified_financing',
  MATURITY = 'maturity',
  CHANGE_OF_CONTROL = 'change_of_control',
  INVESTOR_OPTION = 'investor_option'
}
```

For the full `ConvertibleInstrument` entity model including conversion-related fields (`conversion_terms`, `conversion_data`, `converted_at`, `conversion_transaction_id`, `conversion_share_class_id`), see `convertible-instruments.md`.

---

## API Endpoints

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

## Business Rules

### BR-1: Valuation Cap Application
- Valuation cap applies when round valuation > cap
- Conversion price with cap = valuation cap / pre-money shares
- Cap provides investor better price (more shares) than round price
- If no cap specified, use discount method or round price

### BR-2: Discount Application
- Discount applies to round price per share
- Conversion price with discount = round price x (1 - discount rate)
- Typical discount rates: 15-30% in Brazilian market
- Discount provides investor reward for early capital commitment

### BR-3: Most Favorable Nation (MFN)
- Investor MUST receive best of: discount OR valuation cap OR round price
- System MUST calculate all three methods
- System MUST select method that gives investor most shares
- MFN calculation example:
  - Discount method: 27,000 shares
  - Cap method: 21,600 shares
  - Result: Use discount method (more favorable)

### BR-4: Qualified Financing Threshold
- Conversion only triggers if funding round amount >= qualified financing threshold
- Bridge rounds or small raises may not trigger conversion
- Threshold prevents conversion on small funding rounds
- If threshold not met, convertible remains outstanding

### BR-5: Automatic vs Manual Conversion
- If `auto_convert_on_qualified_financing = true`, system triggers conversion automatically
- Otherwise, admin must manually execute conversion
- System MUST send notification when trigger conditions are met
- Investor CANNOT block automatic conversion if agreed in terms

### BR-6: Maturity Handling
- At maturity, if not converted:
  - Investor may demand repayment (principal + accrued interest)
  - OR company may extend maturity by mutual agreement
  - OR investor may choose to convert at current valuation
- System MUST flag matured convertibles for action

### BR-7: Share Class Selection
- Convertibles MUST specify target share class for conversion
- If not specified, default to same class as last funding round
- Cannot convert into founder shares (typically)
- Preferred shares common for venture-backed conversions

### BR-8: Partial Conversion
- Partial conversions NOT supported in MVP
- All principal + interest converts in single transaction
- Future enhancement: Allow multiple conversion tranches

### BR-9: Post-Conversion Audit Trail
- System MUST link convertible to resulting transaction
- System MUST preserve all conversion calculation details
- System MUST record method used (discount/cap/round)
- Blockchain transaction hash MUST be stored
- Documents MUST be generated and stored

### BR-10: Batch Conversion (Multiple Instruments)
- When a funding round triggers multiple convertibles, process conversions sequentially (not parallel) to avoid race conditions
- Lock cap table during conversion batch
- Create separate transaction for each convertible
- Update cap table after all conversions complete
- Send batch notification: "N convertible notes converted to equity"

### BR-11: Investimento-Anjo Conversion Restrictions
- Minimum holding period MUST be enforced before conversion per Complementary Law 155/2016
- System checks `today >= minimum_holding_period_end` before allowing conversion
- If not met, return error with days remaining until eligible

---

## User Flows

### Flow 1: Model Conversion Scenarios

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

### Flow 2: Execute Conversion (Automatic)

```
PRECONDITION: Company closes Series A at R$ 10M valuation (>= R$ 500K threshold)

1. Admin creates funding round: Series A, R$ 2M raised, R$ 10M valuation
2. Admin begins closing round process
3. System detects funding_round.target_amount (R$ 2M) >= convertible.qualified_financing_threshold (R$ 500K)
4. System checks convertible.auto_convert_on_qualified_financing = true
5. System queues automatic conversion job
6. Background job executes conversion:
   a. Calculate current accrued interest: R$ 8,000 (1 year elapsed)
   b. Total conversion amount: R$ 108,000
   c. Round valuation: R$ 10M
   d. Pre-money shares: 1,000,000
   e. Round price per share: R$ 10.00
   f. Calculate discount method: 108,000 / (10.00 x 0.80) = 13,500 shares
   g. Calculate cap method: 108,000 / (5,000,000 / 1,000,000) = 21,600 shares
   h. MFN: Cap method gives more shares -> Use cap
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

### Flow 3: View Conversion Outcomes (Investor)

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
   - Instrument Type: Mutuo Conversivel
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
   - Ready to Convert
   - Qualified Financing Threshold: R$ 500,000
   - Auto-Convert: Yes (will convert automatically on Series A)
10. System shows projected scenarios:
    - If Series A at R$ 5M -> ~26,000 shares (~2.5%)
    - If Series A at R$ 10M -> ~21,600 shares (~2.0%)
11. Investor can download investment summary (PDF)

POSTCONDITION: Investor has full visibility into convertible status and projections
```

### Flow 4: Handle Maturity Without Conversion

```
PRECONDITION: Convertible reaches maturity date, no qualified financing occurred

1. System daily job detects convertible.maturity_date = today
2. System checks convertible.status = "outstanding"
3. System updates status = "MATURED"
4. System sends notification to admin:
   - Subject: "Convertible Note Matured - Action Required"
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

---

## Technical Implementation

### Conversion Scenario Modeling Service

```typescript
// /backend/src/convertibles/conversion-scenario.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class ConversionScenarioService {
  constructor(private prisma: PrismaService) {}

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
}
```

### Conversion Execution Service

```typescript
// /backend/src/convertibles/conversion-execution.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import Decimal from 'decimal.js';

@Injectable()
export class ConversionExecutionService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

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

    // Validate Investimento-Anjo minimum holding period
    if (convertible.instrument_type === 'INVESTIMENTO_ANJO') {
      if (convertible.minimum_holding_period_end && new Date() < convertible.minimum_holding_period_end) {
        throw new BadRequestException(
          `Cannot convert Investimento-Anjo before minimum holding period ends (${convertible.minimum_holding_period_end.toISOString().split('T')[0]})`,
        );
      }
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

    if (preMoneyShares === 0) {
      throw new InternalServerErrorException('Pre-money shares cannot be zero');
    }

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

### Frontend Scenario Modeling Component

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

## Edge Cases & Error Handling

### EC-1: Conversion Attempt Before Trigger Condition Met
**Scenario**: Admin tries to convert when funding round is R$ 300K but threshold is R$ 500K
**Handling**:
- Return 400 Bad Request
- Error message: "Conversion trigger not met. Funding round (R$ 300,000) is below qualified financing threshold (R$ 500,000)."
- Suggest: "Wait for larger round or manually convert at current valuation."

### EC-2: Conversion During Blockchain Network Outage
**Scenario**: Admin executes conversion but Base Network RPC is down
**Handling**:
- Backend attempts blockchain transaction
- RPC timeout after 30 seconds
- Backend does NOT update convertible status
- Backend queues retry job (up to 3 attempts)
- Display to admin: "Conversion initiated but blockchain confirmation pending. You will be notified."
- Once blockchain confirms, complete conversion flow
- If all retries fail, alert admin for manual intervention

### EC-3: Valuation Cap Below Current Valuation
**Scenario**: Convertible has R$ 5M cap, company already valued at R$ 8M
**Handling**:
- Allow creation (investor gets beneficial terms)
- Display warning during creation: "Valuation cap is below company's current valuation. This convertible will likely convert using the cap."
- Admin confirms understanding
- Scenario modeling shows cap method always wins

### EC-4: Multiple Convertibles Converting Simultaneously
**Scenario**: Company has 3 convertibles, all with auto-convert enabled, Series A closes
**Handling**:
- System detects all 3 meet conversion criteria
- Process conversions sequentially (not parallel) to avoid race conditions
- Lock cap table during conversion batch
- Create separate transaction for each convertible
- Update cap table after all conversions complete
- Send batch notification: "3 convertible notes converted to equity"

### EC-5: Discount + Cap Both Favor Investor Differently
**Scenario**: At R$ 10M valuation, discount gives 27,000 shares but cap gives 21,600
**Handling**:
- System calculates both methods
- MFN clause: Select method with more shares
- Result: Use discount method (27,000 > 21,600)
- Display in conversion summary: "Method used: Discount (MFN)"
- Store method_used = "DISCOUNT" in conversion_data

### EC-6: Shareholder Deleted Before Conversion
**Scenario**: Investor shareholder record deleted but convertible exists
**Handling**:
- System enforces foreign key constraint (cannot delete)
- If somehow occurs: Conversion fails
- Error: "Cannot convert: Shareholder record not found"
- Admin must restore shareholder or create new record
- Link convertible to restored shareholder

### EC-7: Zero Pre-Money Shares at Conversion
**Scenario**: Bug causes pre_money_shares = 0 during conversion calculation
**Handling**:
- Division by zero error in conversion price calculation
- Backend catches exception
- Log critical error: "Pre-money shares cannot be zero"
- Abort conversion
- Return 500 Internal Server Error
- Alert engineering team
- Admin must manually verify cap table before retrying

### EC-8: Investimento-Anjo Converted Before Minimum Holding Period
**Scenario**: Admin tries to convert Investimento-Anjo after 1 year but minimum is 2 years
**Handling**:
- System checks if instrument_type = "INVESTIMENTO_ANJO"
- Validates: today >= minimum_holding_period_end
- If not met, return 400 Bad Request
- Error: "Cannot convert Investimento-Anjo before minimum holding period ends (Jan 15, 2026)"
- Display days remaining until eligible

---

## Security Considerations

### SEC-1: Conversion Authorization
- Only admin and finance roles can view conversion scenarios
- Only admin role can execute conversions
- Investor cannot self-convert (except if agreement allows)
- Log all conversion executions with user ID

### SEC-2: Conversion Data Immutability
- Once converted, convertible record becomes read-only
- Conversion data (method used, price, shares) permanently stored
- Blockchain transaction hash provides tamper-proof record
- Audit trail links convertible -> transaction -> blockchain

### SEC-3: Rate Limiting
- Limit conversion API calls: 10 per hour per company
- Prevent spam scenario modeling: 100 per day per user
- Detect and block automated scraping attempts

---

## Success Criteria

### Performance
- Conversion scenario modeling completes in < 2 seconds for 10 scenarios
- Conversion execution (including blockchain) completes in < 30 seconds

### Accuracy
- Zero rounding errors in conversion calculations
- MFN clause correctly identifies best method (100%)
- Conversion amount matches formula: principal + accrued interest (100%)

### Reliability
- Zero failed conversions due to calculation errors
- Blockchain transactions confirmed within 30 seconds (95%+ of time)
- Automatic retry on transient failures (3 attempts)
- Sequential batch conversion handles multiple instruments without race conditions

### User Experience
- Investors can view conversion projections without admin help
- Conversion scenarios visualized clearly for decision-making
- Conversion completion notifications sent immediately

### Compliance
- Investimento-Anjo minimum holding periods enforced before conversion
- All conversions recorded on blockchain for audit trail
- Conversion documents generated and stored for legal compliance

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [convertible-instruments.md](./convertible-instruments.md) | Parent spec: instrument creation, interest accrual, status management, and CRUD operations |
| [cap-table-management.md](./cap-table-management.md) | Conversion creates new shareholdings that affect cap table and trigger snapshots |
| [transactions.md](./transactions.md) | Each conversion creates a share issuance transaction |
| [share-classes.md](./share-classes.md) | Convertibles convert into a specific share class |
| [funding-rounds.md](./funding-rounds.md) | Qualified financing round triggers automatic conversion |
| [shareholder-registry.md](./shareholder-registry.md) | Conversion creates new shareholdings for convertible holders |
| [blockchain-integration.md](./blockchain-integration.md) | On-chain recording of share issuance from conversion |
| [document-generation.md](./document-generation.md) | Conversion certificate and document template generation |
| [notifications.md](./notifications.md) | Email notifications for conversion triggers and completion |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, and URL conventions for conversion endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes for conversion operations (validation, business rules) |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events for conversion execution and status changes |
