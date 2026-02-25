# User Flow Documentation Index

This directory contains user flow documentation for every feature in the Navia platform.
Each document follows the template defined in `.claude/rules/user-flow-documentation.md`.

## Flows

| Flow | Actors | Status |
|------|--------|--------|
| [Authentication](./authentication.md) | Unauthenticated user, Authenticated user | Backend complete, Frontend spec complete |
| [Company Management](./company-management.md) | Authenticated user, ADMIN member | Backend complete, Frontend spec complete |
| [Member Invitation](./member-invitation.md) | ADMIN member, any company member, authenticated user, unauthenticated user | Backend complete, Frontend spec complete |
| [Share Class Management](./share-class-management.md) | ADMIN (full CRUD), FINANCE/LEGAL/INVESTOR (read-only) | Backend complete |
| [Shareholder Management](./shareholder-management.md) | ADMIN (full CRUD + UBO), FINANCE/LEGAL (read-only), ADMIN/LEGAL (foreign view) | Backend complete |
| [Cap Table Management](./cap-table-management.md) | ADMIN/FINANCE (full access + write/export), LEGAL (read-only) | Backend complete |
| [Transactions](./transactions.md) | ADMIN (full lifecycle + approve/confirm), FINANCE (create/submit/cancel), LEGAL (read-only) | Backend complete |
| [Funding Rounds](./funding-rounds.md) | ADMIN (full lifecycle + commitments), FINANCE (read + payment updates), LEGAL (read-only) | Backend complete |
| [Option Plans, Grants & Exercises](./option-plans.md) | ADMIN (full CRUD + close/cancel + exercise confirm/cancel), FINANCE/LEGAL (read-only) | Backend complete |
| [Convertible Instruments](./convertible-instruments.md) | ADMIN (full CRUD + convert/redeem/cancel), FINANCE (read + scenarios), LEGAL (read-only) | Backend complete |
| [KYC Verification](./kyc-verification.md) | Authenticated user (all roles), System (Verifik, AML screening), Compliance team | Backend complete |
| [User Permissions](./user-permissions.md) | All roles (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE) | Frontend spec complete |
| [Notifications](./notifications.md) | All authenticated users (any role) | Backend complete |
| [Audit Logging](./audit-logging.md) | ADMIN (full access), LEGAL (full access), System (event capture + hash chain) | Backend complete |
| [Company CNPJ Validation](./company-cnpj-validation.md) | ADMIN (creator), System (Bull queue, Verifik API) | Backend complete |

## Cross-References

Flow documents link to each other via **Feeds into**, **Depends on**, and **Triggers** sections.
When adding a new flow, check existing flows for necessary cross-reference updates.
