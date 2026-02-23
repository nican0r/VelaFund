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

### Company Management (5 specs)

3. **[company-management.md](./company-management.md)** - Company creation, lifecycle management, and multi-company support
   - Brazilian entity types (Ltda. and S.A.)
   - Company lifecycle: DRAFT → ACTIVE → INACTIVE → DISSOLVED
   - Multi-company support with company context switching
   - Company CRUD operations and dissolution flow

4. **[company-membership.md](./company-membership.md)** - Member invitation, roles, and access management
   - CompanyMember entity with merged role, permissions, and invitation status
   - Member invitation and acceptance workflow
   - InvitationToken entity and validation
   - Role management business rules (last admin protection)

5. **[company-cnpj-validation.md](./company-cnpj-validation.md)** - Async CNPJ validation via Verifik
   - Bull background job for CNPJ validation against Receita Federal
   - Setup status tracking and retry logic
   - CNPJ-specific edge cases and error handling

6. **[company-blockchain-admin.md](./company-blockchain-admin.md)** - Creator wallet as smart contract admin
   - OCP smart contract deployment per company
   - Creator's embedded wallet as on-chain admin
   - Admin transfer logic and resolved design decisions

7. **[company-profile.md](./company-profile.md)** - Public company profile and document dataroom
   - Shareable company profile page (description, sector, founding year)
   - Key metrics cards (employees, ARR, MRR, etc.)
   - Founding team members with photos
   - Dataroom document uploads (pitch deck, financials, legal)
   - Share link with access controls (public, password, email-gated)
   - View analytics and document download tracking

### Core Cap Table (4 specs)

8. **[shareholder-registry.md](./shareholder-registry.md)** - Shareholder management and equity tracking
   - Individual and corporate shareholders
   - Foreign shareholder tracking
   - Beneficial ownership (UBO)
   - Shareholder access control

9. **[cap-table-management.md](./cap-table-management.md)** - Cap table operations and ownership tracking
   - Real-time automatic recalculation
   - Fully-diluted views
   - Historical snapshots
   - OCT format export
   - Blockchain reconciliation

10. **[share-classes.md](./share-classes.md)** - Brazilian share class structures
    - Ltda. quotas support
    - S.A. common and preferred shares
    - Voting rights and liquidation preferences
    - Brazilian corporate law compliance

11. **[transactions.md](./transactions.md)** - Share issuances, transfers, conversions
    - Share issuance with dilution impact
    - Transfer validation (lock-ups, right of first refusal)
    - Admin-initiated transfers per Brazilian law
    - Automatic cap table updates

### Blockchain Infrastructure (1 spec)

12. **[blockchain-integration.md](./blockchain-integration.md)** - On-chain recording using OCP smart contracts
    - Base Network (L2) deployment
    - Creator's embedded wallet as smart contract admin
    - Privy gas sponsorship (gasless transactions)
    - Real-time event monitoring and sync
    - Transaction confirmation tracking

### Investment Features (3 specs)

13. **[funding-rounds.md](./funding-rounds.md)** - Investment round management
    - Round creation (Seed, Series A, B, C)
    - Pro-forma cap table modeling
    - Investor commitment tracking
    - Round closing mechanics

14. **[convertible-instruments.md](./convertible-instruments.md)** - Mútuo Conversível, Investimento-Anjo, MISTO/MAIS
    - Brazilian convertible instrument creation and tracking
    - Interest accrual and status management
    - Daily interest calculation job

15. **[convertible-conversion.md](./convertible-conversion.md)** - Convertible instrument conversion logic
    - Conversion calculation engine (valuation cap, discount, MFN)
    - Scenario modeling and simulation
    - Qualified financing triggers
    - Conversion execution flow

### Employee Equity (2 specs)

16. **[option-plans.md](./option-plans.md)** - Employee stock option plan management
    - Option pool creation and tracking
    - Option grants with vesting schedules
    - Cliff and linear vesting calculations
    - Termination policy configuration

17. **[option-exercises.md](./option-exercises.md)** - Option exercise requests and payment confirmation
    - Employee exercise requests
    - Strike price payment via bank transfer
    - Admin payment confirmation
    - Automatic on-chain share issuance

### Document Management (2 specs)

18. **[document-generation.md](./document-generation.md)** - Template-based legal document creation
    - Database-stored templates (editable without deployment)
    - Structured form generation from schema
    - Real-time HTML preview
    - PDF generation via Puppeteer
    - Brazilian corporate document support

19. **[document-signatures.md](./document-signatures.md)** - Ethereum wallet signatures (EIP-712)
    - Signature request workflow
    - EIP-712 typed data signatures via Privy
    - Cryptographic signature verification
    - On-chain document hash anchoring

### Reporting & Communication (3 specs)

20. **[reports-analytics.md](./reports-analytics.md)** - Cap table reports, analytics, and exports
    - Current and fully-diluted cap tables
    - Ownership and dilution analysis
    - Exit waterfall modeling (M&A scenarios)
    - Due diligence packages
    - PDF, Excel, CSV, and OCT JSON export

21. **[notifications.md](./notifications.md)** - Email notification system
    - Event-triggered notifications (signatures, transactions, vesting)
    - AWS SES integration
    - User notification preferences
    - Background job processing (Bull queue)

22. **[user-permissions.md](./user-permissions.md)** - Role-based access control (RBAC)
    - Roles: Admin, Finance, Legal, Investor, Employee
    - Company-specific role assignment
    - Fine-grained permission overrides
    - Permission matrix and enforcement

---

## Spec File Structure

Each specification file follows this structure:

- **Topic of Concern**: One-sentence description
- **Overview**: Context and purpose
- **User Stories**: As a [role], I want to [action] so that [benefit]
- **Functional Requirements**: What the system must do
- **Data Models**: TypeScript entity definitions
- **API Endpoints**: REST endpoints with request/response examples in envelope format
- **Business Rules**: Validation and constraints
- **User Flows**: Step-by-step interaction flows
- **Edge Cases & Error Handling**: Exception scenarios with error codes
- **Dependencies**: Internal and external dependencies
- **Technical Implementation**: Code examples
- **Security Considerations**: Security requirements
- **Success Criteria**: Performance and accuracy metrics
- **Related Specifications**: Cross-references to related specs

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
- **[.claude/rules/](../.claude/rules/)**: API standards, error handling, security, audit logging, i18n, design system, testing rules
- **[specs/](.)**: This directory - detailed specifications per topic

---

## Entity Glossary

Canonical entity names used across all specifications. Always use these names in code and documentation.

| Entity | Description | Spec Reference |
|--------|-------------|----------------|
| User | Platform user account | authentication.md |
| Company | Brazilian company (Ltda. or S.A.) with CNPJ, lifecycle status, and embedded settings | company-management.md |
| CompanyMember | User's role, permissions, and invitation status within a company (merged entity) | company-membership.md |
| InvitationToken | Cryptographic token for company membership invitation acceptance | company-membership.md |
| CompanyProfile | Public-facing company profile with shareable link | company-profile.md |
| ProfileMetric | Key metric displayed on company profile (ARR, employees, etc.) | company-profile.md |
| ProfileTeamMember | Founding team member displayed on company profile | company-profile.md |
| ProfileDocument | Document uploaded to company dataroom | company-profile.md |
| ProfileView | View tracking record for shared profile | company-profile.md |
| ProfileDocumentDownload | Download tracking record for dataroom documents | company-profile.md |
| Shareholder | Equity holder in a company | shareholder-registry.md |
| ShareClass | Type of shares (quotas, ON, PN) | share-classes.md |
| Shareholding | A shareholder's position in a share class | cap-table-management.md |
| Transaction | Equity event (issue, transfer, convert, cancel) | transactions.md |
| BlockchainTransaction | On-chain transaction record | blockchain-integration.md |
| FundingRound | Investment round | funding-rounds.md |
| RoundCommitment | Investor commitment to a round | funding-rounds.md |
| RoundClose | A close event within a round | funding-rounds.md |
| ConvertibleInstrument | Mútuo conversível, Investimento-Anjo, etc. | convertible-instruments.md |
| ConvertibleConversion | Conversion calculation and execution record | convertible-conversion.md |
| OptionPlan | Employee stock option pool | option-plans.md |
| OptionGrant | Individual option grant to an employee | option-plans.md |
| VestingSchedule | Vesting terms for a grant | option-plans.md |
| OptionExerciseRequest | Employee exercise request | option-exercises.md |
| Document | Generated legal document | document-generation.md |
| DocumentTemplate | Template for document generation | document-generation.md |
| DocumentSigner | Signature record for a document | document-signatures.md |
| Notification | User notification (email or in-app) | notifications.md |
| AuditLog | Immutable audit trail record | audit-logging.md (rules) |
| KYCVerification | KYC verification record and audit trail | kyc-verification.md |
| CapTableSnapshot | Point-in-time cap table snapshot | cap-table-management.md |

---

## Total Specification Count

**22 specification files** covering all aspects of the Navia MVP platform.
