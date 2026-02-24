# User Flow Documentation Index

This directory contains user flow documentation for every feature in the Navia platform.
Each document follows the template defined in `.claude/rules/user-flow-documentation.md`.

## Flows

| Flow | Actors | Status |
|------|--------|--------|
| [Authentication](./authentication.md) | Unauthenticated user, Authenticated user | Backend complete |
| [Company Management](./company-management.md) | Authenticated user, ADMIN member | Backend complete |
| [Member Invitation](./member-invitation.md) | ADMIN member, any company member, authenticated user, unauthenticated user | Backend complete |
| [Share Class Management](./share-class-management.md) | ADMIN (full CRUD), FINANCE/LEGAL/INVESTOR (read-only) | Backend complete |

## Cross-References

Flow documents link to each other via **Feeds into**, **Depends on**, and **Triggers** sections.
When adding a new flow, check existing flows for necessary cross-reference updates.
