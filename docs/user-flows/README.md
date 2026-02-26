# User Flow Documentation Index

This directory contains user flow documentation for every feature in the Navia platform.
Each document follows the template defined in `.claude/rules/user-flow-documentation.md`.

---

## Active Flows

| Flow | Actors | Status |
|------|--------|--------|
| [Authentication](./authentication.md) | Unauthenticated user, Authenticated user | Backend complete, Frontend spec complete |
| [Onboarding](./onboarding.md) | Authenticated user (new or incomplete onboarding) | Frontend complete (2-step wizard: PersonalInfo -> CompanyCreation, 22 tests) |
| [KYC Verification](./kyc-verification.md) | Authenticated user (all roles), System (Verifik, AML screening), Compliance team | Backend complete |
| [Company Management](./company-management.md) | Authenticated user, ADMIN member | Backend complete, Frontend spec complete |
| [Company CNPJ Validation](./company-cnpj-validation.md) | ADMIN (creator), System (Bull queue, Verifik API) | Backend complete |
| [Company Profile](./company-profile.md) | ADMIN (full lifecycle + publish/archive + analytics), FINANCE (update + analytics), all members (read), public visitors (view via slug) | Backend complete |
| [Company Dataroom](./company-dataroom.md) | ADMIN/FINANCE (upload/delete/reorder), all members (read/download), public visitors (download via slug) | Backend complete |
| [Company Litigation](./company-litigation.md) | System (Bull queue, BigDataCorp API), ADMIN/FINANCE (view on profile), public visitors (view on public profile) | Backend complete |
| [Member Invitation](./member-invitation.md) | ADMIN member, any company member, authenticated user, unauthenticated user | Backend complete, Frontend invitation acceptance page complete |
| [User Permissions](./user-permissions.md) | All roles (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE) | Frontend spec complete |
| [Notifications](./notifications.md) | All authenticated users (any role) | Backend + Frontend complete |
| [Settings](./settings.md) | ADMIN (full access: edit company, invite/manage members), all members (view) | Frontend Company Info tab + Members tab complete |

---

## Archived Flows

The following flows were archived to `docs/user-flows/archived/` after the platform pivot. They document cap table management features that are no longer part of the active product scope. Retained for historical reference.

| Archived Flow | File |
|---------------|------|
| Cap Table Management | `archived/cap-table-management.md` |
| Share Class Management | `archived/share-class-management.md` |
| Shareholder Management | `archived/shareholder-management.md` |
| Transactions | `archived/transactions.md` |
| Funding Rounds | `archived/funding-rounds.md` |
| Convertible Instruments | `archived/convertible-instruments.md` |
| Convertible Instruments (Frontend) | `archived/convertible-instruments-frontend.md` |
| Option Plans, Grants & Exercises | `archived/option-plans.md` |
| Document Generation | `archived/document-generation.md` |
| Exit Waterfall | `archived/exit-waterfall.md` |
| Audit Logging | `archived/audit-logging.md` |
| Reports & Analytics | `archived/reports-analytics.md` |

---

## Planned Flows

The following flows will be added as the post-pivot features are designed and implemented:

- **AI Document Intelligence** -- Upload, OCR, and AI-powered extraction/analysis of corporate documents
- **Investor Q&A** -- AI-assisted question answering over company dataroom and documents
- **Open Finance** -- Integration with Open Finance APIs for financial data aggregation
- **Investor Portal** -- Dedicated portal for investors to access company data, documents, and analytics

---

## Cross-References

Flow documents link to each other via **Feeds into**, **Depends on**, and **Triggers** sections.
When adding a new flow, check existing flows for necessary cross-reference updates.
