# Navia MVP - Specifications Index

This directory contains detailed specification documents for the Navia platform.

## JTBD (Job to be Done)
**"Help Brazilian startups raise investment by providing investor-ready company profiles, data rooms, and due diligence tools"**

---

## Active Specs (17)

### Authentication & Identity

1. **[authentication.md](./authentication.md)** - User authentication and wallet management via Privy
   - Email/social login with embedded wallet creation
   - Session management and security
   - JWT token verification

2. **[kyc-verification.md](./kyc-verification.md)** - CPF identity verification using Verifik
   - CPF validation against Receita Federal
   - Document upload and facial recognition
   - AML screening and compliance

### Company Management

3. **[company-management.md](./company-management.md)** - Company creation, lifecycle management, and multi-company support
   - Brazilian entity types (Ltda., S.A., and SAS)
   - Company lifecycle: DRAFT -> ACTIVE -> INACTIVE -> DISSOLVED
   - Multi-company support with company context switching

4. **[company-membership.md](./company-membership.md)** - Member invitation, roles, and access management
   - CompanyMember entity with merged role, permissions, and invitation status
   - Member invitation and acceptance workflow
   - Role management business rules (last admin protection)

5. **[company-cnpj-validation.md](./company-cnpj-validation.md)** - Async CNPJ validation via Verifik
   - Bull background job for CNPJ validation against Receita Federal
   - Setup status tracking and retry logic

6. **[company-profile.md](./company-profile.md)** - Public company profile, metrics, and sharing
   - Shareable company profile page (description, sector, founding year)
   - Key metrics cards (employees, ARR, MRR, etc.)
   - Founding team members with photos
   - Share link with access controls (public, password, email-gated)

7. **[company-dataroom.md](./company-dataroom.md)** - Company dataroom document management
   - Document uploads (pitch deck, financials, legal)
   - File validation and thumbnail generation
   - Public and authenticated document downloads

8. **[company-data-enrichment.md](./company-data-enrichment.md)** - Company CNPJ data enrichment via BigDataCorp
   - Registered address, CNAE codes, founding date, legal representatives
   - Capital social, employee count, RF status
   - Auto-triggered on profile creation, manual refresh

9. **[company-litigation-verification.md](./company-litigation-verification.md)** - Automatic litigation check via BigDataCorp
   - Litigation data fetching and risk assessment
   - Background job processing with circuit breaker

### AI & Intelligence

10. **[ai-document-intelligence.md](./ai-document-intelligence.md)** - AI-powered document processing and embedding
    - Text extraction from PDF, DOCX, XLSX, images via Claude API
    - Semantic chunking and pgvector embeddings
    - Cost tracking and budget enforcement

11. **[investor-qa.md](./investor-qa.md)** - RAG-based investor Q&A chat
    - SSE streaming responses grounded in company documents
    - Citation links to source documents
    - Conversation history per investor per company

### Open Finance

12. **[open-finance.md](./open-finance.md)** - Brazilian Open Finance API integration
    - OAuth PKCE bank connection flow
    - Transaction ingestion and AI categorization
    - Financial snapshots (burn rate, runway, MRR)

### Investor Portal

13. **[investor-portal.md](./investor-portal.md)** - Tiered investor access and portfolio
    - Three permission tiers: VIEW, VIEW_FINANCIALS, FULL
    - Company updates feed
    - Portfolio dashboard for investors

### Reporting & Communication

14. **[reports-analytics.md](./reports-analytics.md)** - Reports, analytics, and exports
    - AI-generated company reports (summary, financial, risk)
    - Profile analytics (views, visitors, downloads)
    - PDF, Excel, CSV export

15. **[notifications.md](./notifications.md)** - Notification system
    - Event-triggered in-app and email notifications
    - AWS SES integration
    - User notification preferences
    - Background job processing (Bull queue)

16. **[user-permissions.md](./user-permissions.md)** - Role-based access control (RBAC)
    - Roles: Admin, Finance, Legal, Investor, Employee
    - Company-specific role assignment
    - Fine-grained permission overrides

### Frontend Architecture

17. **[frontend-restructure.md](./frontend-restructure.md)** - Dual-experience frontend architecture
    - Founder dashboard (sidebar-navigated, company page builder)
    - Investor portal (top-nav, portfolio view)
    - Public profile page (/p/[slug])

---

## Archived Specs

The `archived/` directory contains 15 specs from the original cap-table-era design. These features (blockchain integration, share classes, transactions, funding rounds, convertible instruments, option plans, document generation/signatures, exit waterfall, etc.) are no longer in scope for the current MVP but are preserved for future reference.

Archived specs: `blockchain-integration.md`, `cap-table-management.md`, `cap-table-reconciliation.md`, `company-blockchain-admin.md`, `convertible-conversion.md`, `convertible-instruments.md`, `document-generation.md`, `document-signatures.md`, `exit-waterfall.md`, `funding-rounds.md`, `option-exercises.md`, `option-plans.md`, `share-classes.md`, `shareholder-registry.md`, `transactions.md`

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

## Relationship to Other Documents

- **[.claude/rules/](../.claude/rules/)**: API standards, error handling, security, audit logging, i18n, design system, testing rules
- **[specs/](.)**: This directory - detailed specifications per topic
