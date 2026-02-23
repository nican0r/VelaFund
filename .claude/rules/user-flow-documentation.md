# User Flow Documentation Rules

## Mandatory Requirements
- Create or update a `docs/user-flows/{feature-name}.md` file for every feature implemented
- Document ALL possible paths a user can take — happy paths, error paths, edge cases, and permission-gated branches
- Update the flow index at `docs/user-flows/README.md` when adding a new flow document
- Review existing flows that may be affected by the new feature and update cross-references

## File Structure

```
docs/
  user-flows/
    README.md                    # Index of all flows with cross-references
    authentication.md
    company-creation.md
    member-invitation.md
    share-issuance.md
    ...
```

## Flow Document Template

Every flow document must follow this structure:

```markdown
# {Feature Name} — User Flows

**Feature**: One-sentence description
**Actors**: Which roles interact with this feature
**Preconditions**: What must be true before the flow starts
**Related Flows**: Links to flows that feed into or follow from this one

---

## Flow Map

(ASCII diagram showing all paths at a glance — see format below)

---

## Flows

### Happy Path: {Primary Flow Name}
(Step-by-step)

### Alternative Path: {Variant Name}
(Step-by-step)

### Error Path: {Error Scenario}
(Step-by-step)

---

## Decision Points

(Table of all branching points)

---

## State Transitions

(What entity states change during this flow)
```

## Flow Map (Required)

Every flow document must start with an ASCII flow map that shows ALL paths at a glance. This is the most important section — a reader should understand every possible outcome without reading the detailed steps.

Format:

```
User Action
  │
  ├─ [condition A] ─→ Outcome A
  │     │
  │     ├─ [sub-condition] ─→ Outcome A1
  │     └─ [sub-condition] ─→ Outcome A2
  │
  ├─ [condition B] ─→ Outcome B
  │
  └─ [error condition] ─→ Error Outcome
```

Example:

```
User clicks "Create Company"
  │
  ├─ [valid form data] ─→ POST /api/v1/companies
  │     │
  │     ├─ [CNPJ unique + valid] ─→ Company created (DRAFT)
  │     │     │
  │     │     ├─ [CNPJ validation succeeds] ─→ Company → ACTIVE
  │     │     └─ [CNPJ validation fails] ─→ Company stays DRAFT, user notified to retry
  │     │
  │     ├─ [CNPJ duplicate] ─→ 409 Conflict, form shows error on CNPJ field
  │     └─ [CNPJ format invalid] ─→ 400 Bad Request, form shows validation error
  │
  └─ [invalid form data] ─→ Client-side validation prevents submission
```

## Step-by-Step Flow Format

Each flow uses numbered steps with clear actor labels and explicit system boundaries:

```
PRECONDITION: {what must be true}
ACTOR: {who performs this flow}
TRIGGER: {what initiates the flow}

1. [UI] User navigates to {page/section}
2. [UI] User fills in {fields}
3. [UI] User clicks "{Button Label}"
4. [Frontend] Validates input client-side
   → IF invalid: show field-level errors, STOP
5. [Frontend] Sends {METHOD} {endpoint}
6. [Backend] Validates authentication
   → IF unauthenticated: return 401, frontend redirects to login
7. [Backend] Validates authorization (role: {ROLE})
   → IF unauthorized: return 404 (prevent enumeration)
8. [Backend] Validates request body
   → IF invalid: return 400 with validationErrors
9. [Backend] Executes business logic
   → IF business rule violated: return 422 with error code
10. [Backend] Persists data
11. [Backend] Queues async side effects (audit log, email, blockchain)
12. [Backend] Returns {status code} with response
13. [UI] Shows success toast: "{message}"
14. [UI] Navigates to {destination}

POSTCONDITION: {what is now true}
SIDE EFFECTS: {audit log, email, notification, blockchain tx}
```

Rules for steps:
- Prefix every step with `[UI]`, `[Frontend]`, `[Backend]`, or `[System]` to show where it happens
- Every branching point uses `→ IF {condition}: {outcome}` inline
- Mark async operations explicitly (emails, blockchain, audit logs)
- End with POSTCONDITION and SIDE EFFECTS

## Decision Points Table (Required)

Summarize every branching point in the flow as a table:

```markdown
| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 4 | Client validation | Form invalid | Error | Field-level errors shown |
| 6 | Auth check | No valid token | Error | Redirect to login |
| 7 | Role check | Not ADMIN | Error | 404 Not Found |
| 8 | Input validation | CNPJ format bad | Error | 400 + validation errors |
| 9 | Business rule | CNPJ duplicate | Error | 409 Conflict |
| 9 | Business rule | CNPJ valid + unique | Happy | Company created |
```

## State Transitions (Required for Stateful Entities)

When a flow changes entity state, document the transitions:

```markdown
| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Company | status | — | DRAFT | Company created |
| Company | status | DRAFT | ACTIVE | CNPJ validation succeeds |
| CompanyMember | — | — | ACTIVE (created) | Creator auto-assigned as ADMIN |
```

## Cross-Feature References

When a flow depends on or triggers another flow, link explicitly:

```markdown
**Feeds into**: [Member Invitation](./member-invitation.md) — after company is ACTIVE, admin can invite members
**Depends on**: [Authentication](./authentication.md) — user must be logged in
**Triggers**: [Blockchain Contract Deployment](./blockchain-admin.md) — async, after company reaches ACTIVE
```

## Permission Branches

For features accessible by multiple roles with different capabilities, document each role's path:

```markdown
### By Role

| Step | ADMIN | FINANCE | INVESTOR |
|------|-------|---------|----------|
| View list | All shareholders | All shareholders | Own holdings only |
| Create | Yes | No (403) | No (403) |
| Edit | Yes | No (403) | No (403) |
| Export | CSV, PDF, XLSX | CSV, PDF, XLSX | PDF only |
```

## What to Document

- **Every user-initiated action**: button clicks, form submissions, navigation
- **Every system-initiated trigger**: scheduled jobs, webhooks, async completions
- **Every error the user can encounter**: validation, authorization, business rules, external service failures
- **Every email/notification sent**: who receives it, when, what it contains
- **Every state change**: entity status transitions, field updates
- **Async flows**: what happens in the background and how the user is notified of completion/failure

## What NOT to Document

- Internal implementation details (which service class, which Prisma query)
- Database schema — that belongs in specs
- API request/response shapes — that belongs in specs
- Code examples — that belongs in specs or inline code comments

## Naming Conventions
- File names: `kebab-case.md` matching the feature name
- Flow names: descriptive, starting with an action verb ("Create Company", "Accept Invitation")
- Use the same terminology as the UI (button labels, page names)

## Maintenance
- When modifying a feature, update the corresponding flow document in the same PR
- When removing a feature, archive the flow document (move to `docs/user-flows/archived/`)
- Review flow documents during PR review — flow changes are as important as code changes
