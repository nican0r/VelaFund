# Navia MVP - Specifications Index

This directory contains detailed specification documents for each topic of concern in the Navia MVP platform.

## JTBD (Job to be Done)
**"Help Brazilian companies manage their cap table with on-chain record-keeping and regulatory compliance"**

---

## Specification Files

### Authentication & Identity (2 specs)

1. **[authentication.md](./authentication.md)** - User authentication and wallet management via Privy
   - Email/social login with embedded wallet creation
   - Session management and security
   - JWT token verification

2. **[kyc-verification.md](./kyc-verification.md)** - Identity verification using Verifik
   - CPF/CNPJ validation against Receita Federal
   - Document upload and facial recognition
   - AML screening and compliance
   - KYC gating by user type (admin, investor, employee)

### Company Management (1 spec)

3. **[company-management.md](./company-management.md)** - Company creation, membership, and lifecycle management
   - Brazilian entity types (Ltda. and S.A.)
   - CNPJ validation via Verifik (async with Bull job)
   - CompanyMember: merged role, permissions, and invitation entity
   - Multi-company support with X-Company-Id header
   - Company lifecycle: DRAFT → ACTIVE → INACTIVE → DISSOLVED
   - Creator's embedded wallet as smart contract admin

### Core Cap Table (4 specs)

4. **[shareholder-registry.md](./shareholder-registry.md)** - Shareholder management and equity tracking
   - Individual and corporate shareholders
   - Foreign shareholder tracking
   - Beneficial ownership (UBO)
   - Shareholder access control

5. **[cap-table-management.md](./cap-table-management.md)** - Cap table operations and ownership tracking
   - Real-time automatic recalculation
   - Fully-diluted views
   - Historical snapshots
   - OCT format export
   - Blockchain reconciliation

6. **[share-classes.md](./share-classes.md)** - Brazilian share class structures
   - Ltda. quotas support
   - S.A. common and preferred shares
   - Voting rights and liquidation preferences
   - Brazilian corporate law compliance

7. **[transactions.md](./transactions.md)** - Share issuances, transfers, conversions
   - Share issuance with dilution impact
   - Transfer validation (lock-ups, right of first refusal)
   - Admin-initiated transfers per Brazilian law
   - Automatic cap table updates

### Blockchain Infrastructure (1 spec)

8. **[blockchain-integration.md](./blockchain-integration.md)** - On-chain recording using OCP smart contracts
   - Base Network (L2) deployment
   - Creator's embedded wallet as smart contract admin (no separate AdminWallet entity)
   - Privy gas sponsorship (gasless transactions)
   - Real-time event monitoring and sync
   - Transaction confirmation tracking

### Investment Features (2 specs)

9. **[funding-rounds.md](./funding-rounds.md)** - Investment round management
   - Round creation (Seed, Series A, B, C)
   - Pro-forma cap table modeling
   - Investor commitment tracking
   - Round closing mechanics

10. **[convertible-instruments.md](./convertible-instruments.md)** - Mútuo Conversível, Investimento-Anjo, MISTO/MAIS
    - Brazilian convertible instruments
    - Conversion scenario modeling
    - Valuation cap and discount rate application
    - Automatic conversion execution

### Employee Equity (2 specs)

11. **[option-plans.md](./option-plans.md)** - Employee stock option plan management
    - Option pool creation and tracking
    - Option grants with vesting schedules
    - Cliff and linear vesting calculations
    - Termination policy configuration

12. **[option-exercises.md](./option-exercises.md)** - Option exercise requests and payment confirmation
    - Employee exercise requests
    - Strike price payment via bank transfer
    - Admin payment confirmation
    - Automatic on-chain share issuance

### Document Management (2 specs)

13. **[document-generation.md](./document-generation.md)** - Template-based legal document creation
    - Database-stored templates (editable without deployment)
    - Structured form generation from schema
    - Real-time HTML preview
    - PDF generation via Puppeteer
    - Brazilian corporate document support

14. **[document-signatures.md](./document-signatures.md)** - Ethereum wallet signatures (EIP-712)
    - Signature request workflow
    - EIP-712 typed data signatures via Privy
    - Cryptographic signature verification
    - On-chain document hash anchoring

### Reporting & Communication (3 specs)

15. **[reports-analytics.md](./reports-analytics.md)** - Cap table reports and exports
    - Current and fully-diluted cap tables
    - Ownership and dilution analysis
    - Exit waterfall modeling (M&A scenarios)
    - Due diligence packages
    - OCT JSON export

16. **[notifications.md](./notifications.md)** - Email notification system
    - Event-triggered notifications (signatures, transactions, vesting)
    - AWS SES integration
    - User notification preferences
    - Background job processing (Bull queue)

17. **[user-permissions.md](./user-permissions.md)** - Role-based access control (RBAC)
    - Roles: Admin, Finance, Legal, Investor, Employee
    - Company-specific role assignment
    - Permission matrix and enforcement
    - Role audit logging

---

## Spec File Structure

Each specification file follows this structure:

- **Topic of Concern**: One-sentence description
- **Overview**: Context and purpose
- **User Stories**: As a [role], I want to [action] so that [benefit]
- **Functional Requirements**: What the system must do
- **Data Models**: TypeScript entity definitions
- **API Endpoints**: REST endpoints with request/response examples
- **Business Rules**: Validation and constraints
- **User Flows**: Step-by-step interaction flows
- **Edge Cases & Error Handling**: Exception scenarios
- **Dependencies**: Internal and external dependencies
- **Technical Implementation**: Code examples
- **Security Considerations**: Security requirements
- **Success Criteria**: Performance and accuracy metrics

---

## Technology Decisions

Based on user answers during spec creation:

- **Cap Table**: Automatic real-time recalculation after transactions
- **Blockchain**: Base Network (Coinbase L2) for low fees and Privy support
- **Transaction Signatures**: Admin-initiated transfers (Brazilian law compliance)
- **Document Templates**: Database-stored (editable via UI without deployment)
- **Option Payments**: Employee pays via bank transfer, admin confirms
- **Convertible Instruments**: Brazilian instruments only (no US SAFE)
- **Exit Modeling**: M&A scenarios only (no IPO modeling in MVP)
- **Vesting Termination**: Configurable per option plan (flexible policy)

---

## Key Brazilian Compliance Features

- **KYC**: Verifik integration for CPF/CNPJ validation (BCB Circular 3.978/2020)
- **Corporate Structures**: Full Ltda. and S.A. support
- **Share Classes**: Quotas, ações ordinárias, ações preferenciais
- **Transfer Restrictions**: Direito de preferência (right of first refusal)
- **Foreign Shareholders**: RDE-IED tracking (Law 4.131/62)
- **Investment Instruments**: Mútuo conversível, Investimento-Anjo (Law 155/2016), MISTO/MAIS
- **Documents**: Brazilian corporate documents (atas, contratos sociais, etc.)
- **LGPD**: Data protection and privacy compliance

---

## Next Steps

1. ✅ Specifications complete
2. Review and validate specs with stakeholders
3. Create Prisma database schema from data models
4. Implement NestJS backend modules
5. Implement Next.js frontend pages
6. Deploy OCP smart contracts to Base Network testnet
7. Integrate Privy, Verifik, and AWS services
8. End-to-end testing
9. Deploy to production (Vercel + Railway)

---

## Relationship to Other Documents

- **[requirements.md](../requirements.md)**: High-level product requirements
- **[ARCHITECTURE.md](../ARCHITECTURE.md)**: System architecture and technical design
- **[specs/](.)**: This directory - detailed specifications per topic

---

## Entity Glossary

Canonical entity names used across all specifications. Always use these names in code and documentation.

| Entity | Description | Spec Reference |
|--------|-------------|----------------|
| User | Platform user account | authentication.md |
| Company | Brazilian company (Ltda. or S.A.) with CNPJ, lifecycle status, and embedded settings | company-management.md |
| CompanyMember | User's role, permissions, and invitation status within a company (merged entity) | company-management.md |
| InvitationToken | Cryptographic token for company membership invitation acceptance | company-management.md |
| Shareholder | Equity holder in a company | shareholder-registry.md |
| ShareClass | Type of shares (quotas, ON, PN) | share-classes.md |
| Shareholding | A shareholder's position in a share class | cap-table-management.md |
| Transaction | Equity event (issue, transfer, convert, cancel) | transactions.md |
| BlockchainTransaction | On-chain transaction record | blockchain-integration.md |
| FundingRound | Investment round | funding-rounds.md |
| RoundCommitment | Investor commitment to a round | funding-rounds.md |
| RoundClose | A close event within a round | funding-rounds.md |
| ConvertibleInstrument | Mutuo conversivel, Investimento-Anjo, etc. | convertible-instruments.md |
| OptionPlan | Employee stock option pool | option-plans.md |
| OptionGrant | Individual option grant to an employee | option-plans.md |
| VestingSchedule | Vesting terms for a grant | option-plans.md |
| OptionExerciseRequest | Employee exercise request | option-exercises.md |
| Document | Generated legal document | document-generation.md |
| DocumentTemplate | Template for document generation | document-generation.md |
| DocumentSigner | Signature record for a document | document-signatures.md |
| Notification | User notification (email or in-app) | notifications.md |
| AuditLog | Immutable audit trail record | audit-logging.md |
| KYCVerification | KYC verification record and audit trail | kyc-verification.md |
| CapTableSnapshot | Point-in-time cap table snapshot | cap-table-management.md |

---

## Total Specification Count

**18 specification files** covering all aspects of the Navia MVP platform.
