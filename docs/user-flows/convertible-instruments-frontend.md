# Convertible Instruments List Page — Frontend User Flows

**Feature**: Display, filter, and cancel convertible instruments from the `/dashboard/convertibles` list page
**Actors**: ADMIN (full access including cancel), FINANCE (read-only), LEGAL (read-only)
**Preconditions**: User is authenticated, an active session cookie is present, and a company has been selected via `CompanyProvider`
**Related Flows**: [Convertible Instruments (backend)](./convertible-instruments.md), [Funding Rounds](./funding-rounds.md)

---

## Flow Map

```
User navigates to /dashboard/convertibles
  │
  ├─ [no company selected] ─→ No-company state (Building2 icon + t('empty'))
  │
  ├─ [company loading / data fetching] ─→ Stat card skeletons + TableSkeleton (5 animated rows)
  │
  ├─ [API error] ─→ Inline error message in table area
  │
  └─ [company selected + data loaded]
        │
        ├─ Stat cards rendered (Total, Outstanding, Total Principal, Accrued Interest)
        │
        ├─ Filter bar rendered (Type dropdown + Status dropdown)
        │     │
        │     ├─ [user changes Type filter] ─→ client-side filter on instruments array (no API call)
        │     │     └─ page resets to 1
        │     │
        │     └─ [user changes Status filter] ─→ re-fetches GET /convertibles?status=...&page=1
        │           └─ page resets to 1
        │
        ├─ [filteredInstruments.length === 0] ─→ Empty state (Repeat icon + t('empty'))
        │
        └─ [filteredInstruments.length > 0] ─→ Data table (9 columns)
              │
              ├─ [user clicks Eye icon on any row] ─→ Navigate to /dashboard/convertibles/:id
              │
              ├─ [instrument.status === 'OUTSTANDING'] ─→ XCircle cancel button visible
              │     │
              │     └─ [user clicks XCircle]
              │           │
              │           ├─ CancelDialog opens (confirm/dismiss)
              │           │     │
              │           │     ├─ [user clicks dismiss / overlay] ─→ Dialog closes, no action
              │           │     │
              │           │     └─ [user clicks "Cancelar Instrumento"]
              │           │           │
              │           │           ├─ POST /convertibles/:id/cancel
              │           │           │     │
              │           │           │     ├─ [200 OK] ─→ Dialog closes, query cache invalidated,
              │           │           │     │               table row reflects CANCELLED status
              │           │           │     │
              │           │           │     └─ [4xx/5xx] ─→ Error toast, dialog stays open
              │           │           │
              │           │           └─ Loading state: buttons disabled, spinner on confirm
              │
              ├─ [instrument.status !== 'OUTSTANDING'] ─→ XCircle button hidden for that row
              │
              └─ [totalPages > 1] ─→ Pagination bar (Previous / Page N of M / Next)
                    │
                    ├─ [page <= 1] ─→ Previous button disabled
                    ├─ [page >= totalPages] ─→ Next button disabled
                    └─ [user clicks Previous or Next] ─→ page state updates, re-fetches API
```

---

## Flows

### Happy Path: View Convertible Instruments List

PRECONDITION: User is authenticated. A company is selected via CompanyProvider.
ACTOR: ADMIN, FINANCE, or LEGAL
TRIGGER: User navigates to `/dashboard/convertibles` (sidebar link or direct URL)

1. [UI] Page mounts; `useCompany()` resolves `selectedCompany`
2. [Frontend] `useConvertibles(companyId, { page: 1, limit: 20, sort: '-createdAt' })` fires
   → IF `companyId` is undefined: query is disabled, no-company state renders
3. [Frontend] While loading: stat card skeleton (gray pulsing rectangles) and `TableSkeleton` (5 animated rows) render
4. [Backend] `GET /api/v1/companies/:companyId/convertibles?page=1&limit=20&sort=-createdAt`
   → IF 401: frontend 401 handler calls `logout()`, redirects to `/login?expired=true`
   → IF 404: error state renders in table area
5. [Backend] Returns `{ success: true, data: [...], meta: { total, page, limit, totalPages, summary: { totalOutstanding, totalPrincipal, totalAccruedInterest, totalValue } } }`
6. [UI] Stat cards populate:
   - "Total de Instrumentos" (active/ocean-600 background) — `meta.total`
   - "Vigentes" — `summary.totalOutstanding`
   - "Principal Total" — `summary.totalPrincipal` formatted as BRL (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`)
   - "Juros Acumulados" — `summary.totalAccruedInterest` formatted as BRL
7. [UI] Filter bar renders with "Todos os tipos" and "Todos os status" as default options
8. [UI] Table renders with 9 columns: Data Emissão, Investidor, Tipo, Principal, Taxa de Juros, Juros Acum., Vencimento, Status, Ações
   - Issue date and maturity date formatted as `dd/MM/yyyy` via `Intl.DateTimeFormat('pt-BR')`
   - Interest rate formatted as percentage with 1–2 decimal places via `Intl.NumberFormat('pt-BR', { style: 'percent' })`
   - Principal and accrued interest formatted as BRL currency
   - Type badge: pill with color per type (MUTUO_CONVERSIVEL = blue, INVESTIMENTO_ANJO = green, MISTO = cream, MAIS = gray)
   - Status badge: pill with color per status (OUTSTANDING = green, CONVERTED = blue, REDEEMED = cream, MATURED = gray, CANCELLED = gray/muted)
   - Actions column: Eye icon (always), XCircle cancel icon (only for OUTSTANDING)

POSTCONDITION: Table displays up to 20 instruments sorted by most recently created
SIDE EFFECTS: None

---

### Happy Path: Filter by Instrument Type (Client-Side)

PRECONDITION: List page is loaded with at least one instrument visible.
ACTOR: ADMIN, FINANCE, or LEGAL
TRIGGER: User selects an instrument type from the "Todos os tipos" dropdown

1. [UI] User opens the Type filter dropdown and selects one of:
   - "Mútuo Conversível" (`MUTUO_CONVERSIVEL`)
   - "Investimento Anjo" (`INVESTIMENTO_ANJO`)
   - "Misto" (`MISTO`)
   - "MAIS" (`MAIS`)
2. [Frontend] `typeFilter` state updates; `page` resets to 1
3. [Frontend] `filteredInstruments` is recomputed via `useMemo` — no new API call:
   - Returns only instruments where `instrument.instrumentType === typeFilter`
4. [UI] Table re-renders with filtered rows immediately
   → IF no rows match: empty state (Repeat icon + `t('empty')`) renders
5. [UI] Stat cards remain unchanged (they reflect the full page, not the filtered view)

POSTCONDITION: Table shows only instruments of the selected type. No network request made.
SIDE EFFECTS: None

---

### Happy Path: Filter by Status (Server-Side)

PRECONDITION: List page is loaded.
ACTOR: ADMIN, FINANCE, or LEGAL
TRIGGER: User selects a status from the "Todos os status" dropdown

1. [UI] User opens the Status filter dropdown and selects one of:
   - "Vigente" (`OUTSTANDING`)
   - "Convertido" (`CONVERTED`)
   - "Resgatado" (`REDEEMED`)
   - "Vencido" (`MATURED`)
   - "Cancelado" (`CANCELLED`)
2. [Frontend] `statusFilter` state updates; `page` resets to 1
3. [Frontend] `useConvertibles` query key changes, triggering a new fetch:
   `GET /api/v1/companies/:companyId/convertibles?status=OUTSTANDING&page=1&limit=20&sort=-createdAt`
4. [UI] While refetching: `TableSkeleton` renders in the table area
5. [Backend] Returns filtered list with updated `meta.total`
6. [UI] Table re-renders with the filtered results; pagination updates to reflect new total
   → IF no rows match: empty state renders

POSTCONDITION: Table shows only instruments of the selected status. `meta.total` reflects filtered count.
SIDE EFFECTS: None

---

### Happy Path: Cancel a Convertible Instrument

PRECONDITION: At least one instrument with status `OUTSTANDING` is visible in the table.
ACTOR: ADMIN only (cancel button is rendered for all roles but backend enforces ADMIN-only)
TRIGGER: User clicks the XCircle icon on an OUTSTANDING instrument row

1. [UI] XCircle button is visible only for rows where `instrument.status === 'OUTSTANDING'`
2. [UI] User clicks XCircle; `cancelTarget` state is set to `instrument.id`
3. [UI] `CancelDialog` renders:
   - Overlay: `navy-900/50` background (`fixed inset-0 z-50`)
   - Modal: white card, max-w-md, shadow-xl
   - Title: `t('confirm.cancelTitle')` — "Cancelar Instrumento"
   - Description: `t('confirm.cancelDescription')` — warning that the action cannot be undone
   - Buttons: "Anterior" (dismiss, secondary) and "Cancelar Instrumento" (confirm, red destructive)
4. [UI] User clicks "Cancelar Instrumento" (confirm)
5. [Frontend] `cancelMutation.mutateAsync(cancelTarget)` fires
6. [Frontend] Confirm and dismiss buttons enter disabled state during mutation
7. [Backend] `POST /api/v1/companies/:companyId/convertibles/:convertibleId/cancel`
   → IF 200: proceed to step 8
   → IF 401: logout + redirect to login
   → IF 404: error toast shown, dialog remains open
   → IF 422 (not OUTSTANDING/MATURED): error toast shown, dialog remains open
8. [Frontend] `queryClient.invalidateQueries({ queryKey: ['convertibles', companyId] })` — list refetches
9. [UI] Dialog closes (`cancelTarget` reset to `null`)
10. [UI] Table re-renders; the cancelled instrument now shows CANCELLED status badge

POSTCONDITION: Instrument status transitions from OUTSTANDING to CANCELLED. Table reflects the new status.
SIDE EFFECTS: Audit log event queued by backend (CONVERTIBLE_CANCELLED)

---

### Alternative Path: Dismiss Cancel Dialog

PRECONDITION: CancelDialog is open.
ACTOR: ADMIN, FINANCE, or LEGAL
TRIGGER: User clicks the "Anterior" button or the overlay backdrop

1. [UI] User clicks "Anterior" (dismiss button) or the `navy-900/50` overlay
2. [Frontend] `cancelTarget` state resets to `null`
3. [UI] CancelDialog unmounts (`if (!open) return null`)

POSTCONDITION: No changes to instrument status. No API call made.
SIDE EFFECTS: None

---

### Happy Path: Navigate to Instrument Detail

PRECONDITION: List page is loaded with at least one instrument row.
ACTOR: ADMIN, FINANCE, or LEGAL
TRIGGER: User clicks the Eye icon on any instrument row

1. [UI] Eye icon link (`<Link href="/dashboard/convertibles/:id">`) is present on every row
2. [UI] User clicks the Eye icon
3. [Frontend] Next.js router navigates to `/dashboard/convertibles/:id`

POSTCONDITION: User is on the instrument detail page.
SIDE EFFECTS: None

---

### Happy Path: Paginate Results

PRECONDITION: There are more than 20 instruments matching the current filters (`totalPages > 1`).
ACTOR: ADMIN, FINANCE, or LEGAL
TRIGGER: User clicks "Próxima" or "Anterior" in the pagination bar

1. [UI] Pagination bar renders below the table when `meta.totalPages > 1`:
   - Left: `t('pagination.showing', { from, to, total })` — e.g., "Mostrando 1 a 20 de 47"
   - Center: "Anterior" button (disabled when `page <= 1`), "Página N de M" text, "Próxima" button (disabled when `page >= totalPages`)
2. [UI] User clicks "Próxima"
3. [Frontend] `page` state increments; `useConvertibles` query key updates
4. [Backend] `GET /api/v1/companies/:companyId/convertibles?page=2&limit=20&...`
5. [UI] While refetching: `TableSkeleton` renders
6. [UI] Table re-renders with the next page of results; pagination text updates

POSTCONDITION: Table shows the next page of instruments. `page` state incremented.
SIDE EFFECTS: None

---

### Error Path: API Error

PRECONDITION: User is on the convertibles list page; a network or server error occurs.
ACTOR: Any
TRIGGER: `useConvertibles` query returns an error

1. [Frontend] TanStack Query catches the error (retries server errors up to 2 times per `error-handling.md` rules; does not retry 401/422)
2. [UI] Skeleton disappears; error message renders in the table area:
   - If `error instanceof Error`: displays `error.message`
   - Otherwise: displays hardcoded fallback `'Error loading convertible instruments'`
3. [UI] Stat cards retain their skeleton or last cached values

POSTCONDITION: No instruments displayed. User can refresh the page to retry.
SIDE EFFECTS: None

---

### Error Path: No Company Selected

PRECONDITION: User navigates to `/dashboard/convertibles` but no company is selected (e.g., first login with no companies).
ACTOR: Any
TRIGGER: `useCompany()` returns `selectedCompany = undefined` and `isLoading = false`

1. [UI] Page renders the no-company state:
   - `Building2` icon (h-12 w-12, gray-300)
   - Caption: `t('empty')` — "Nenhum instrumento conversível encontrado..."
2. [Frontend] `useConvertibles` query is disabled (`enabled: !!companyId` is false); no API call made
3. [UI] No stat cards, no filters, no table are rendered

POSTCONDITION: User sees a prompt to select or create a company.
SIDE EFFECTS: None

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 1 | Company selected | `companyId` is undefined | No-company state | Building2 empty state, no API calls |
| 2 | Data loading | `isLoading || companyLoading` is true | Loading state | Skeleton cards + TableSkeleton |
| 3 | API error | `useConvertibles` returns error | Error state | Inline error message in table area |
| 4 | Empty results | `filteredInstruments.length === 0` | Empty state | Repeat icon + `t('empty')` |
| 5 | Type filter changed | `typeFilter !== ''` | Client-side filter | `useMemo` re-filters current page data, no API call |
| 6 | Status filter changed | `statusFilter !== ''` | Server-side filter | New API call with `?status=...`, page resets to 1 |
| 7 | Cancel button visibility | `instrument.status === 'OUTSTANDING'` | XCircle visible | Cancel flow available for this row |
| 7a | Cancel button visibility | `instrument.status !== 'OUTSTANDING'` | XCircle hidden | No cancel action for this row |
| 8 | Cancel confirmed | User clicks "Cancelar Instrumento" | API call | `POST /convertibles/:id/cancel` |
| 9 | Cancel API success | 200 OK | Success | Cache invalidated, dialog closes, table updates |
| 10 | Cancel API error | 4xx/5xx | Error | Error toast shown, dialog stays open |
| 11 | Pagination visible | `meta.totalPages > 1` | Pagination bar | Previous/Next controls rendered below table |
| 12 | Previous disabled | `page <= 1` | Button disabled | Cannot navigate before first page |
| 13 | Next disabled | `page >= totalPages` | Button disabled | Cannot navigate past last page |

---

## State Transitions

| Component | State Field | Before | After | Trigger |
|-----------|-------------|--------|-------|---------|
| ConvertiblesPage | `page` | any | `1` | Type filter or Status filter changed |
| ConvertiblesPage | `page` | N | N + 1 | User clicks "Próxima" |
| ConvertiblesPage | `page` | N | N - 1 | User clicks "Anterior" |
| ConvertiblesPage | `typeFilter` | any | selected value | Type dropdown changed |
| ConvertiblesPage | `statusFilter` | any | selected value | Status dropdown changed |
| ConvertiblesPage | `cancelTarget` | `null` | `instrument.id` | User clicks XCircle |
| ConvertiblesPage | `cancelTarget` | `instrument.id` | `null` | Dialog dismissed or cancel confirmed |
| ConvertibleInstrument | `status` | `OUTSTANDING` | `CANCELLED` | Cancel confirmed (backend) |
| TanStack Query cache | `['convertibles', companyId]` | stale | invalidated | Cancel mutation succeeds |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL |
|--------|-------|---------|-------|
| View list page | Yes | Yes | Yes |
| View stat cards | Yes | Yes | Yes |
| Filter by type (client-side) | Yes | Yes | Yes |
| Filter by status (server-side) | Yes | Yes | Yes |
| Paginate results | Yes | Yes | Yes |
| View Eye (detail link) | Yes | Yes | Yes |
| See XCircle cancel button | Yes (for OUTSTANDING rows) | Yes (rendered, but backend returns 404) | Yes (rendered, but backend returns 404) |
| Confirm cancel in dialog | Yes (200 OK) | No (backend 404) | No (backend 404) |
| Navigate to instrument detail | Yes | Yes | Yes |

Note: The cancel button is rendered client-side for all roles whenever `status === 'OUTSTANDING'`. Role enforcement is server-side; FINANCE and LEGAL roles will receive a 404 from the backend and see an error toast.

---

## Component Architecture

| Component | File | Responsibility |
|-----------|------|---------------|
| `ConvertiblesPage` | `src/app/(dashboard)/dashboard/convertibles/page.tsx` | Page root; orchestrates state, queries, and layout |
| `StatCard` | Inline in page file | Displays a single stat with label, value, icon, and active/inactive style |
| `CancelDialog` | Inline in page file | Confirmation modal for cancel action |
| `TableSkeleton` | Inline in page file | Loading placeholder for the table body |
| `getTypeBadge()` | Inline in page file | Maps `InstrumentType` enum to badge label + Tailwind className |
| `getStatusBadge()` | Inline in page file | Maps `ConvertibleStatus` enum to badge label + Tailwind className |
| `isCancellable()` | Inline in page file | Returns `true` only for `OUTSTANDING` status |
| `useConvertibles` | `src/hooks/use-convertibles.ts` | TanStack Query hook for paginated + filtered list |
| `useConvertible` | `src/hooks/use-convertibles.ts` | TanStack Query hook for single instrument detail |
| `useCancelConvertible` | `src/hooks/use-convertibles.ts` | TanStack Query mutation for cancel; invalidates list cache on success |

---

## i18n Keys Used (namespace: `convertibles`)

| Key | PT-BR | EN |
|-----|-------|----|
| `title` | "Instrumentos Conversíveis" | "Convertible Instruments" |
| `description` | "Visualize e gerencie instrumentos conversíveis..." | "View and manage convertible instruments..." |
| `create` | "Novo Conversível" | "New Convertible" |
| `empty` | "Nenhum instrumento conversível encontrado..." | "No convertible instruments found..." |
| `actions` | "Ações" | "Actions" |
| `stats.total` | "Total de Instrumentos" | "Total Instruments" |
| `stats.outstanding` | "Vigentes" | "Outstanding" |
| `stats.totalPrincipal` | "Principal Total" | "Total Principal" |
| `stats.accruedInterest` | "Juros Acumulados" | "Accrued Interest" |
| `filter.allTypes` | "Todos os tipos" | "All types" |
| `filter.allStatuses` | "Todos os status" | "All statuses" |
| `instrumentType.mutuoConversivel` | "Mútuo Conversível" | "Convertible Loan" |
| `instrumentType.investimentoAnjo` | "Investimento Anjo" | "Angel Investment" |
| `instrumentType.misto` | "Misto" | "Mixed" |
| `instrumentType.mais` | "MAIS" | "MAIS" |
| `status.outstanding` | "Vigente" | "Outstanding" |
| `status.converted` | "Convertido" | "Converted" |
| `status.redeemed` | "Resgatado" | "Redeemed" |
| `status.matured` | "Vencido" | "Matured" |
| `status.cancelled` | "Cancelado" | "Cancelled" |
| `confirm.cancelTitle` | "Cancelar Instrumento" | "Cancel Instrument" |
| `confirm.cancelDescription` | "Tem certeza que deseja cancelar..." | "Are you sure you want to cancel..." |
| `confirm.cancel` | "Cancelar Instrumento" | "Cancel Instrument" |
| `pagination.showing` | "Mostrando {from} a {to} de {total}" | "Showing {from} to {to} of {total}" |
| `pagination.previous` | "Anterior" | "Previous" |
| `pagination.next` | "Próxima" | "Next" |
| `pagination.page` | "Página" | "Page" |
| `pagination.of` | "de" | "of" |

---

## Cross-References

**Depends on**: [Authentication](./authentication.md) — user must be authenticated; 401 triggers logout and redirect
**Depends on**: [Convertible Instruments (backend)](./convertible-instruments.md) — API contract, status transitions, cancel rules
**Feeds into**: `/dashboard/convertibles/:id` — Eye icon navigates to instrument detail page (not yet built)
**Related**: [Funding Rounds](./funding-rounds.md) — parallel list page with the same filter + cancel dialog pattern
**Related**: [Transactions](./transactions.md) — cancel confirmation dialog pattern is identical
