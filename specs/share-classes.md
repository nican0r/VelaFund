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
- Support for voto múltiplo (multiple voting) quotas

### FR-2: S.A. Support (Shares)
- Ações Ordinárias (common shares): Always have voting rights
- Ações Preferenciais (preferred shares): Can be non-voting or limited voting
- Tag-along rights (direito de tag-along)
- Maximum 50% of capital in preferred shares (Brazilian law)

### FR-3: Share Class Properties
- Name, type, votes per share
- Liquidation preference multiple
- Participating vs. non-participating
- Right of first refusal (direito de preferência)
- Redemption rights
- Conversion rights

---

## Data Models

```typescript
interface ShareClass {
  id: string;
  company_id: string;
  name: string;
  type: 'QUOTA' | 'COMMON_SHARES' | 'PREFERRED_SHARES';
  
  // Voting
  votes_per_share: number;           // 0 for non-voting preferred

  // Liquidation
  liquidation_preference_multiple: number;  // 1.0, 1.5, 2.0, etc.
  participating_rights: boolean;     // True = participating preferred

  // Transfer Restrictions
  right_of_first_refusal: boolean;
  lock_up_period_months: number | null;

  // Brazilian Specific
  tag_along_percentage: number | null;  // 80%, 100% for tag-along rights

  // Blockchain
  blockchain_token_id: string | null;

  // OCT Compliance
  oct_data: object;

  created_at: Date;
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/share-classes
Create new share class

### GET /api/v1/companies/:companyId/share-classes
List all share classes

### PUT /api/v1/companies/:companyId/share-classes/:classId
Update share class (limited fields)

---

## Business Rules

### BR-1: Ltda. Default
- Ltda. companies start with one "Quotas Ordinárias" class
- All quotas have equal rights by default

### BR-2: S.A. Common Shares Required
- S.A. companies MUST have at least one common share class
- Common shares MUST have voting rights (votes_per_share ≥ 1)

### BR-3: Preferred Share Limit
- Preferred shares cannot exceed 50% of total authorized capital
- System warns if approaching limit

### BR-4: Share Class Immutability
- Cannot change share class type after issuance
- Cannot reduce rights (e.g., remove voting) after issuance
- Can only update descriptive fields

---

## Success Criteria

- Support both Ltda. and S.A. structures
- Enforce Brazilian corporate law limits
- 100% OCT compliance for share classes
