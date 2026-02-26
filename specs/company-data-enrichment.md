# Company Data Enrichment & Litigation Verification Specification

**Topic of Concern**: Automatic company data enrichment (address, CNAE, legal representatives, capital social, employee count, RF status) and litigation/legal proceedings verification via BigDataCorp CNPJ lookup

**One-Sentence Description**: The system automatically fetches and displays comprehensive company data (registered address, economic activities, legal representatives, capital social, employee count, Receita Federal status, branch offices) and litigation data (active/historical lawsuits, administrative proceedings, notary protests, and computed risk level) from BigDataCorp when a company profile is created, storing the enrichment results as system-managed fields and the litigation results as immutable, non-editable fields.

---

## Overview

When a company profile is created (see [company-profile.md](./company-profile.md)), the system dispatches background Bull jobs to fetch two categories of data from BigDataCorp using the company's already-validated CNPJ:

1. **Company Data Enrichment**: Rich company information including registered address, CNAE codes, founding date, legal representatives, capital social, employee count, Receita Federal status, and branch offices. This data auto-populates company profile fields and provides verified context for investors.

2. **Litigation Verification**: Active/historical lawsuits, administrative proceedings, notary protest records, and a computed risk level. This provides transparency for investors reviewing the company profile.

Key design decisions:
- **Litigation data is immutable**: Litigation data is system-populated and cannot be edited, hidden, or deleted by any user role (including ADMIN). This ensures data integrity for investor due diligence.
- **Enrichment data is read-only but refreshable**: Enriched company data is system-populated and displayed as verified information. Users cannot edit enrichment fields directly, but ADMINs can trigger a manual re-enrichment (rate limited to once per 24 hours).
- **Non-blocking**: Both fetches run asynchronously via Bull. Profile creation succeeds immediately; enrichment and litigation data appear once the background jobs complete.
- **Point-in-time snapshots**: Data is fetched at profile creation. Enrichment data can be manually refreshed. Litigation data is a one-time snapshot (manual refresh is out of scope for MVP).
- **PII-safe**: Individual plaintiff names in litigation data are masked before storage. Company names in lawsuits are stored in full (public information). Enrichment data contains only publicly available corporate registry information.

### Relationship to Existing Features

- **company-profile.md**: Litigation fields live on the CompanyProfile entity. Enrichment data lives in a separate `CompanyEnrichment` entity linked to the Company. Both sections are displayed on the internal authenticated view and the public shareable profile.
- **company-cnpj-validation.md**: Both enrichment and litigation checks use the CNPJ that was already validated during company setup. No additional CNPJ validation is performed.
- **error-handling.md**: BigDataCorp retry/circuit breaker follows the existing patterns defined for external services.

---

## Table of Contents

1. [MVP Scope](#mvp-scope)
2. [User Stories](#user-stories)
3. [Frontend Specification — Company Data Enrichment](#frontend-specification--company-data-enrichment)
4. [Frontend Specification — Litigation Verification](#frontend-specification--litigation-verification)
5. [Functional Requirements](#functional-requirements)
6. [Data Models](#data-models)
7. [API Endpoints](#api-endpoints)
8. [Business Rules](#business-rules)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Dependencies](#dependencies)
11. [Technical Implementation](#technical-implementation)
12. [Error Codes](#error-codes)
13. [Security Considerations](#security-considerations)
14. [Success Criteria](#success-criteria)
15. [Related Specifications](#related-specifications)

---

## MVP Scope

### In Scope

#### Company Data Enrichment
- **Automatic BigDataCorp fetch on profile creation**: When a company profile is created, the system dispatches a Bull job to fetch company enrichment data from BigDataCorp. This happens alongside the litigation check.
- **Enrichment data display**: Show verified company data (address, CNAE, legal representatives, capital social, employee count, RF status, branch offices) on both internal and public profile views.
- **"Source: BigDataCorp" badge**: Each enriched field displays a small badge indicating the data source, distinguishing it from user-entered data.
- **Manual re-enrichment**: ADMINs can trigger a re-fetch of enrichment data (rate limited to once per 24 hours).
- **Stale data indicator**: When enrichment data is older than 90 days, display a "Data may be outdated" warning with a refresh button.
- **Pending and failed status indicators**: Show spinner with message when fetch is in progress; show warning with message when fetch has failed.

#### Litigation Verification (Existing)
- **Automatic BigDataCorp fetch on profile creation**: When a company profile is created, the system dispatches a Bull job to fetch litigation data from BigDataCorp. This is the only trigger — no manual or periodic re-fetch.
- **Risk level badge**: Display a colored pill badge (LOW/MEDIUM/HIGH) based on active lawsuit count and total value in dispute.
- **Summary statistics**: Show active lawsuit count, historical lawsuit count, total value in dispute, and protest count in a collapsed summary card.
- **Expandable lawsuit table**: "Ver detalhes" toggle reveals a full table of individual lawsuits and protest records.
- **Pending and failed status indicators**: Show spinner with message when fetch is in progress; show warning with message when fetch has failed.
- **PII masking**: Individual plaintiff names are masked before storage (e.g., "J*** S***"). Company names in lawsuits are stored in full.
- **Read-only display**: Litigation data is system-managed and displayed identically on both the internal profile editor and the public profile page. No user can edit, hide, or delete the data.

### Out of Scope (Future Enhancements)

- **Litigation manual refresh**: No ability for any user role to manually trigger a re-fetch of litigation data.
- **Periodic re-fetch**: No scheduled job to periodically update either enrichment or litigation data. Enrichment is manually refreshable; litigation is a one-time snapshot.
- **Litigation alerts/notifications**: No email, push, or in-app notifications when litigation data changes or when high-risk litigation is detected.
- **Litigation data filtering/search**: No ability to filter or search within the lawsuit table.
- **Litigation data export**: No dedicated export of litigation data (it is included in the profile data but has no standalone export).
- **Enrichment data auto-sync to Company entity**: Enrichment data is displayed on the profile but does not automatically overwrite fields on the Company entity (e.g., `Company.address`). Users can choose to copy enriched data to their company settings manually.
- **Cross-referencing enrichment with user-entered data**: No automatic comparison or conflict detection between enriched data and user-entered data on the Company entity.

---

## User Stories

### US-1: Automatic Company Data Enrichment
**As an** admin user creating a company profile
**I want** the system to automatically fetch and display verified company data (address, CNAE, legal representatives, capital social, etc.) from public records
**So that** I don't have to manually enter data that is already available in corporate registries, and investors see verified information

### US-2: Manual Data Refresh
**As an** admin user
**I want to** manually trigger a refresh of the enrichment data
**So that** I can ensure the displayed data is up-to-date before sharing the profile with investors

### US-3: Stale Data Awareness
**As an** investor viewing a shared company profile
**I want to** see when the enrichment data was last refreshed and whether it may be outdated
**So that** I can make informed decisions based on the data's freshness

### US-4: Automatic Litigation Transparency
**As an** investor viewing a shared company profile
**I want to** see the company's litigation history (lawsuits, protests, risk level) automatically fetched from public records
**So that** I can assess legal risk without relying solely on the founder's self-disclosure

### US-5: Litigation Data Integrity
**As a** platform operator
**I want** litigation data to be immutable and system-managed
**So that** founders cannot hide or manipulate their legal standing on the profile

---

## Frontend Specification — Company Data Enrichment

This section defines the complete frontend rendering of enrichment data, including component structure, layouts, states, styling, and i18n keys.

### Display Locations

Enrichment data is displayed in two locations:

1. **Internal profile editor** (`/companies/:companyId/profile`): Enrichment section in the "Informacoes" tab, displayed as a read-only card with verified data. Includes a "Fonte: BigDataCorp" badge. Visually distinct from editable sections (similar treatment as litigation section).

2. **Public profile page** (`/p/:slug`): Enrichment data displayed as part of the company overview, showing verified corporate information.

### Enrichment Section States

The `EnrichmentSection` container component renders one of four states based on `enrichmentStatus`:

#### State 1: PENDING (fetch in progress)

```
+-------------------------------------------+
|  Dados Corporativos Verificados            |
|  [Spinner] Buscando dados da empresa...    |
|  Os dados estao sendo consultados nos      |
|  registros publicos. Volte em alguns       |
|  minutos.                                  |
+-------------------------------------------+
```

- Section title: `h4` weight 600, `gray-800`
- Spinner: `blue-600` circular spinner, 20px, inline with title text
- Title text: `body` (14px), `gray-700`, bold
- Description text: `body-sm` (13px), `gray-500`
- Card: white background, `1px solid gray-200` border, `radius-lg` (12px), `24px` padding

#### State 2: FAILED (fetch failed after retries)

```
+-------------------------------------------+
|  Dados Corporativos Verificados            |
|  [WarningTriangle] Consulta indisponivel   |
|  Nao foi possivel consultar os dados da    |
|  empresa neste momento.                    |
+-------------------------------------------+
```

- Section title: `h4` weight 600, `gray-800`
- Warning icon: Lucide `AlertTriangle` icon, 20px, `cream-700` (#C4A44E) color
- Title text: `body` (14px), `gray-700`, bold
- Description text: `body-sm` (13px), `gray-500`
- Card: white background, `1px solid gray-200` border, `radius-lg` (12px), `24px` padding

#### State 3: COMPLETED (data available)

```
+-------------------------------------------------------------+
|  Dados Corporativos Verificados                              |
|  Atualizado em: 23/02/2026  [Fonte: BigDataCorp]            |
|  [Atualizar]  (button, disabled if <24h)                     |
|                                                              |
|  +------- Informacoes Gerais ------+                         |
|  | Razao Social   | Acme Tech LTDA |                        |
|  | Nome Fantasia  | Acme            |                        |
|  | Natureza Legal | 206-2 - LTDA   |                        |
|  | Data Fundacao  | 15/03/2020     |                        |
|  | Capital Social | R$ 500.000,00  |                        |
|  | Funcionarios   | 42             |                        |
|  | Status RF      | ATIVA [badge]  |                        |
|  +----------------------------------+                        |
|                                                              |
|  +------- Endereco Registrado -----+                         |
|  | Rua Exemplo, 123 - Sala 45      |                        |
|  | Sao Paulo - SP, 01234-567       |                        |
|  +----------------------------------+                        |
|                                                              |
|  +------- Atividades Economicas ---+                         |
|  | Principal: 62.01-5-01           |                        |
|  |   Desenvolvimento de software   |                        |
|  | Secundarias:                     |                        |
|  |   63.11-9-00 - Tratamento de    |                        |
|  |     dados                        |                        |
|  |   62.02-3-00 - Consultoria em   |                        |
|  |     TI                           |                        |
|  +----------------------------------+                        |
|                                                              |
|  +------- Socios / Representantes -+                         |
|  | Nome           | Qualificacao   |                        |
|  | Joao Silva     | Socio-Admin.   |                        |
|  | Maria Santos   | Socia          |                        |
|  +----------------------------------+                        |
|                                                              |
|  +------- Filiais --------------------+                      |
|  | Nenhuma filial registrada.         |  (or table of        |
|  +------------------------------------+   branch offices)    |
+-------------------------------------------------------------+
```

- Section title: `h4` weight 600, `gray-800`
- "Fonte: BigDataCorp" badge: `caption` (12px), weight 500, `blue-50` background, `blue-600` text, `radius-sm` (6px), padding `2px 8px`
- "Atualizado em" timestamp: `body-sm` (13px), `gray-500`, date formatted as `dd/MM/yyyy` using `Intl.DateTimeFormat('pt-BR')`
- "Atualizar" button: Secondary variant (white bg, `gray-200` border), `sm` size (32px height). Disabled state (`opacity: 0.5`, `cursor: not-allowed`) if less than 24 hours since last refresh. Tooltip on disabled: "Disponivel em X horas"
- Sub-section titles: `body-sm` (13px), weight 600, `gray-500`, uppercase, with horizontal rule dividers (`1px solid gray-200`)
- Field labels: `body-sm` (13px), weight 500, `gray-500`
- Field values: `body` (14px), weight 400, `gray-700`
- Layout: 2-column grid for field label/value pairs on `lg`+, single column on `sm`/`md`
- Card: white background, `1px solid gray-200` border, `radius-lg` (12px), `24px` padding

#### State 4: STALE (data older than 90 days)

Same as COMPLETED, but with an additional warning banner at the top of the card:

```
+-------------------------------------------------------------+
|  [InfoCircle] Dados podem estar desatualizados.              |
|  Ultima atualizacao ha mais de 90 dias. [Atualizar agora]   |
+-------------------------------------------------------------+
```

- Warning banner: `cream-50` (#FDFAF1) background, `1px solid cream-600` border, `radius-md` (8px), `12px` padding
- Icon: Lucide `Info` icon, 16px, `cream-700` color
- Text: `body-sm` (13px), `cream-700`
- "Atualizar agora" link: Ghost button variant, `blue-600` text, inline

### RF Status Badge Colors

| Status | Label (PT-BR) | Label (EN) | Background | Text Color |
|--------|---------------|------------|------------|------------|
| ATIVA | Ativa | Active | `green-100` (#E8F5E4) | `green-700` (#6BAF5E) |
| BAIXADA | Baixada | Closed | `gray-100` (#F3F4F6) | `gray-600` (#4B5563) |
| SUSPENSA | Suspensa | Suspended | `cream-100` (#FAF4E3) | `cream-700` (#C4A44E) |
| INAPTA | Inapta | Unfit | `#FEE2E2` | `#991B1B` |
| NULA | Nula | Null | `#FEE2E2` | `#991B1B` |

Badge styling: `radius-full` (pill), `caption` (12px), weight 500, padding `2px 8px`.

### Internal Profile Editor View

When the enrichment section is rendered inside the internal profile editor (`/companies/:companyId/profile`), the following additional rules apply:

- The entire enrichment card has a subtle visual distinction to signal it is system-managed:
  - Container: `bg-gray-50` background instead of white to visually differentiate from editable form sections.
  - A label "(dados verificados automaticamente)" is displayed below the section title in `caption` (12px), `gray-400`, italic.
- No edit buttons on individual fields. The only interactive element is the "Atualizar" (refresh) button.
- This section is placed in the "Informacoes" tab, above the litigation section and below editable company information fields, separated by a `1px solid gray-200` divider with `32px` top margin.

### Component Architecture

All enrichment components live in the frontend under an `enrichment/` feature directory. Each component is a single responsibility:

| Component | Responsibility | Props |
|-----------|---------------|-------|
| `EnrichmentSection` | Container that reads `enrichmentStatus` and renders the correct state (PENDING, FAILED, COMPLETED, STALE). Handles refresh trigger. | `enrichment: EnrichmentResponse`, `companyId: string`, `isInternalView?: boolean` |
| `EnrichmentDataCard` | Renders all enrichment sub-sections (general info, address, CNAE, representatives, branches). | `data: EnrichmentData`, `lastEnrichedAt: string` |
| `EnrichmentGeneralInfo` | Renders the general information field/value grid. | `data: EnrichmentData` |
| `EnrichmentAddress` | Renders the registered address block. | `address: EnrichmentAddress` |
| `EnrichmentCnaeList` | Renders primary and secondary CNAE codes. | `cnaeMain: CnaeCode`, `cnaeSecondary: CnaeCode[]` |
| `EnrichmentRepresentatives` | Renders the legal representatives table. | `representatives: LegalRepresentative[]` |
| `EnrichmentBranches` | Renders the branch offices table or empty state. | `branches: BranchOffice[]` |
| `EnrichmentSourceBadge` | Renders the "Fonte: BigDataCorp" pill badge. | None |
| `EnrichmentRfStatusBadge` | Renders the colored pill badge for RF status. | `status: string` |
| `EnrichmentPendingState` | Renders the spinner + pending message. | None |
| `EnrichmentFailedState` | Renders the warning icon + failure message. | None |
| `EnrichmentStaleWarning` | Renders the stale data warning banner. | `onRefresh: () => void` |

#### Component Tree

```
EnrichmentSection
  +- (if PENDING) EnrichmentPendingState
  +- (if FAILED) EnrichmentFailedState
  +- (if COMPLETED or STALE)
       +- (if STALE) EnrichmentStaleWarning
       +- EnrichmentSourceBadge
       +- EnrichmentDataCard
            +- EnrichmentGeneralInfo
            |    +- EnrichmentRfStatusBadge
            +- EnrichmentAddress
            +- EnrichmentCnaeList
            +- EnrichmentRepresentatives
            +- EnrichmentBranches
```

#### TypeScript Types (Frontend)

```typescript
// Mirrors the API response shape for the enrichment section
interface EnrichmentResponse {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'STALE';
  lastEnrichedAt: string | null;
  data: EnrichmentData | null;
  error?: string;
}

interface EnrichmentData {
  tradeName: string | null;
  legalNature: string | null;
  foundingDate: string | null;           // ISO 8601 date
  registeredAddress: EnrichmentAddress | null;
  cnaeMain: CnaeCode | null;
  cnaeSecondary: CnaeCode[];
  capitalSocial: string | null;          // Decimal as string, BRL
  employeeCount: number | null;
  legalRepresentatives: LegalRepresentative[];
  branchOffices: BranchOffice[];
  rfStatus: string | null;               // ATIVA, BAIXADA, SUSPENSA, INAPTA, NULA
}

interface EnrichmentAddress {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

interface CnaeCode {
  code: string;                           // e.g., "62.01-5-01"
  description: string;                    // e.g., "Desenvolvimento de programas de computador sob encomenda"
}

interface LegalRepresentative {
  name: string;
  qualification: string;                  // e.g., "Socio-Administrador"
  entryDate: string | null;              // ISO 8601 date
}

interface BranchOffice {
  cnpj: string;
  tradeName: string | null;
  address: EnrichmentAddress;
  status: string;                         // ATIVA, BAIXADA, etc.
}
```

### Frontend i18n Keys — Enrichment

All user-facing strings must be added to both `messages/pt-BR.json` and `messages/en.json`. Keys follow the `enrichment.*` namespace.

| Key | PT-BR | EN |
|-----|-------|-----|
| `enrichment.title` | Dados Corporativos Verificados | Verified Corporate Data |
| `enrichment.systemManaged` | Dados verificados automaticamente | Automatically verified data |
| `enrichment.source` | Fonte: BigDataCorp | Source: BigDataCorp |
| `enrichment.lastUpdated` | Atualizado em: {date} | Last updated: {date} |
| `enrichment.refresh` | Atualizar | Refresh |
| `enrichment.refreshing` | Atualizando... | Refreshing... |
| `enrichment.refreshDisabled` | Disponivel em {hours} horas | Available in {hours} hours |
| `enrichment.refreshSuccess` | Dados atualizados com sucesso | Data refreshed successfully |
| `enrichment.pending.title` | Buscando dados da empresa... | Fetching company data... |
| `enrichment.pending.message` | Os dados estao sendo consultados nos registros publicos. Volte em alguns minutos. | Company data is being fetched from public records. Please check back in a few minutes. |
| `enrichment.failed.title` | Consulta indisponivel | Lookup unavailable |
| `enrichment.failed.message` | Nao foi possivel consultar os dados da empresa neste momento. | Unable to fetch company data at this time. |
| `enrichment.stale.message` | Dados podem estar desatualizados. Ultima atualizacao ha mais de 90 dias. | Data may be outdated. Last update was more than 90 days ago. |
| `enrichment.stale.refreshNow` | Atualizar agora | Refresh now |
| `enrichment.section.general` | Informacoes Gerais | General Information |
| `enrichment.section.address` | Endereco Registrado | Registered Address |
| `enrichment.section.cnae` | Atividades Economicas | Economic Activities |
| `enrichment.section.representatives` | Socios / Representantes Legais | Partners / Legal Representatives |
| `enrichment.section.branches` | Filiais | Branch Offices |
| `enrichment.field.tradeName` | Nome Fantasia | Trade Name |
| `enrichment.field.legalNature` | Natureza Legal | Legal Nature |
| `enrichment.field.foundingDate` | Data de Fundacao | Founding Date |
| `enrichment.field.capitalSocial` | Capital Social | Registered Capital |
| `enrichment.field.employeeCount` | Funcionarios | Employees |
| `enrichment.field.rfStatus` | Status na Receita Federal | Receita Federal Status |
| `enrichment.field.cnaeMain` | Principal | Primary |
| `enrichment.field.cnaeSecondary` | Secundarias | Secondary |
| `enrichment.field.noData` | Nao disponivel | Not available |
| `enrichment.representatives.name` | Nome | Name |
| `enrichment.representatives.qualification` | Qualificacao | Qualification |
| `enrichment.representatives.entryDate` | Data de Entrada | Entry Date |
| `enrichment.representatives.empty` | Nenhum socio ou representante registrado. | No partners or representatives registered. |
| `enrichment.branches.cnpj` | CNPJ | CNPJ |
| `enrichment.branches.name` | Nome | Name |
| `enrichment.branches.address` | Endereco | Address |
| `enrichment.branches.status` | Status | Status |
| `enrichment.branches.empty` | Nenhuma filial registrada. | No branch offices registered. |
| `enrichment.rfStatus.ativa` | Ativa | Active |
| `enrichment.rfStatus.baixada` | Baixada | Closed |
| `enrichment.rfStatus.suspensa` | Suspensa | Suspended |
| `enrichment.rfStatus.inapta` | Inapta | Unfit |
| `enrichment.rfStatus.nula` | Nula | Null |

### Formatting Rules — Enrichment

All formatting follows the global rules from `i18n.md`:

- **Currency values** (capital social): Always use Brazilian format regardless of UI language. `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` produces `R$ 500.000,00`.
- **Dates** (founding date, entry date): Always use Brazilian format `dd/MM/yyyy`. `Intl.DateTimeFormat('pt-BR')` produces `15/03/2020`.
- **CNPJ** (branch offices): Display formatted with mask: `XX.XXX.XXX/XXXX-XX`.
- **CNAE codes**: Display as `XX.XX-X-XX` (the standard CNAE code format) followed by the description.
- **Employee count**: Format as integer with Brazilian thousands separator: `Intl.NumberFormat('pt-BR').format(42)` produces `42`.

### Accessibility Requirements — Enrichment

- All field label/value pairs use a `<dl>` (definition list) with `<dt>` for labels and `<dd>` for values.
- The "Atualizar" button must include `aria-label` with the full text "Atualizar dados corporativos" (or EN equivalent).
- When the refresh button is disabled, it must have `aria-disabled="true"` and `title` with the time remaining.
- RF status badge must include `aria-label` with the full status text (e.g., `aria-label="Status na Receita Federal: Ativa"`).
- Stale warning banner must use `role="alert"` so screen readers announce it.
- PENDING and FAILED states must use `role="status"` for the message area.
- Tables (representatives, branches) must use semantic `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` markup.

### Responsive Behavior — Enrichment

| Breakpoint | Layout |
|------------|--------|
| `sm` (< 640px) | Single-column layout for all field/value pairs. Representative and branch tables scroll horizontally. Sub-sections stack vertically. |
| `md` (768px+) | 2-column grid for field/value pairs. Tables fit if columns are narrow enough, otherwise horizontal scroll. |
| `lg` (1024px+) | Full layout as shown in the wireframes above. Tables fit comfortably. |

---

## Frontend Specification — Litigation Verification

This section defines the complete frontend rendering of litigation data, including component structure, layouts, states, styling, and i18n keys. An implementation agent should be able to build the entire litigation UI from this section without guessing.

### Display Locations

Litigation data is displayed in two locations:

1. **Internal profile editor** (`/companies/:companyId/profile`): Read-only litigation section at the bottom of the "Informacoes" tab. Includes a "(dados gerenciados pelo sistema)" label to explain why the section is not editable. Visually distinct from editable sections (greyed-out / reduced-opacity container to signal non-editability).

2. **Public profile page** (`/p/:slug`): Litigation section near the bottom of the page, before the "Powered by Navia" footer. Same card layout as the internal view but without the system-managed label.

### Litigation Section States

The `LitigationSection` container component renders one of three states based on `litigationStatus`:

#### State 1: PENDING (fetch in progress)

```
+-------------------------------------------+
|  Verificacao Judicial                      |
|  [Spinner] Verificacao em andamento...     |
|  Os dados judiciais estao sendo            |
|  consultados. Volte em alguns minutos.     |
+-------------------------------------------+
```

- Section title: `h4` weight 600, `gray-800`
- Spinner: `blue-600` circular spinner, 20px, inline with title text
- Title text: `body` (14px), `gray-700`, bold
- Description text: `body-sm` (13px), `gray-500`
- Card: white background, `1px solid gray-200` border, `radius-lg` (12px), `24px` padding

#### State 2: FAILED (fetch failed after retries)

```
+-------------------------------------------+
|  Verificacao Judicial                      |
|  [WarningTriangle] Verificacao             |
|  indisponivel                              |
|  Nao foi possivel consultar os dados       |
|  judiciais neste momento.                  |
+-------------------------------------------+
```

- Section title: `h4` weight 600, `gray-800`
- Warning icon: Lucide `AlertTriangle` icon, 20px, `cream-700` (#C4A44E) color
- Title text: `body` (14px), `gray-700`, bold
- Description text: `body-sm` (13px), `gray-500`
- Card: white background, `1px solid gray-200` border, `radius-lg` (12px), `24px` padding

#### State 3: COMPLETED (data available — collapsed by default)

```
+-----------------------------------------------------------+
|  Verificacao Judicial                                      |
|  +-------------------------------------------------------+|
|  | Risk Badge: [MEDIO] (cream-colored badge)             ||
|  |                                                        ||
|  | 2 processos ativos  *  5 historicos                   ||
|  | R$ 225.000,00 em disputa                              ||
|  | 0 protestos                                            ||
|  |                                                        ||
|  | Verificado em: 23/02/2026                             ||
|  |                                                        ||
|  | [> Ver detalhes]                                       ||
|  +-------------------------------------------------------+|
+-----------------------------------------------------------+
```

- Section title: `h4` weight 600, `gray-800`
- Risk badge: Pill badge (`radius-full`), `caption` (12px), weight 500, padding `2px 8px`. Colors defined in [Risk Level Badge Colors](#risk-level-badge-colors).
- Summary stats line 1: `body` (14px), `gray-700`. Active and historical counts separated by ` * ` (bullet).
- Summary stats line 2: `body` (14px), `gray-700`. Currency formatted as `R$ 225.000,00`.
- Summary stats line 3: `body` (14px), `gray-700`. Protest count.
- Verified date: `body-sm` (13px), `gray-500`. Date formatted as `dd/MM/yyyy` using `Intl.DateTimeFormat('pt-BR')`.
- Expand toggle: Ghost button variant, `blue-600` text, `body-sm` (13px). Chevron icon (Lucide `ChevronRight` when collapsed, `ChevronDown` when expanded) + text.
- Card: white background, `1px solid gray-200` border, `radius-lg` (12px), `24px` padding.

#### State 3b: COMPLETED (expanded — after clicking "Ver detalhes")

```
+-----------------------------------------------------------+
|  Verificacao Judicial                                      |
|  +-------------------------------------------------------+|
|  | Risk Badge: [MEDIO] (cream-colored badge)             ||
|  | 2 processos ativos  *  R$ 225.000,00 em disputa       ||
|  | Verificado em: 23/02/2026                             ||
|  |                                                        ||
|  | [v Ocultar detalhes]                                   ||
|  |                                                        ||
|  | -- Processos Judiciais --                              ||
|  | +----------------------------------------------------+||
|  | | Processo    | Tribunal | Tipo  | Valor    |Status  |||
|  | +----------------------------------------------------+||
|  | | 0000123-45..| TJSP     | Civel |R$150.000 |Ativo   |||
|  | | 0000456-78..| TRT-2    |Trab.  |R$ 75.000 |Ativo   |||
|  | | 0000789-01..| TJSP     | Civel |R$ 30.000 |Arq.    |||
|  | +----------------------------------------------------+||
|  |                                                        ||
|  | -- Protestos --                                        ||
|  | Nenhum protesto registrado.                           ||
|  +-------------------------------------------------------+|
+-----------------------------------------------------------+
```

- In expanded mode, the summary is condensed to a single line (active count + value in dispute) to save vertical space.
- Collapse toggle: Ghost button variant, `blue-600` text, `body-sm` (13px). Chevron icon rotated down.
- Sub-section titles ("Processos Judiciais", "Protestos"): `body-sm` (13px), weight 600, `gray-500`, uppercase, with horizontal rule dividers (`1px solid gray-200`).

**Lawsuit Table** (`LitigationDetailTable`):

| Column | Field | Width | Alignment | Format |
|--------|-------|-------|-----------|--------|
| Processo | `processId` | Auto (flexible) | Left | Full process ID string (e.g., "0000123-45.2024.8.26.0100") |
| Tribunal | `court` | Auto | Left | Plain text |
| Tipo | `caseType` | 80px | Left | Translated via i18n key (e.g., `litigation.caseType.civil` -> "Civel") |
| Valor | `valueInDispute` | 120px | Right | `R$ 150.000,00` using `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Show "---" if null. |
| Status | `status` | 80px | Left | Badge: "Ativo" uses `green-100` bg / `green-700` text; "Arquivado" / "Extinto" uses `gray-100` bg / `gray-600` text |

- Table follows design-system.md table styles: `gray-50` header, `gray-500` header text (caption size, uppercase), `52px` row height, `1px solid gray-100` row borders.
- Numeric "Valor" column: right-aligned, `tabular-nums` font feature.
- If there are no lawsuits, show empty state text: "Nenhum processo judicial registrado." (`body-sm`, `gray-500`, centered).
- On mobile (`sm` breakpoint), the table scrolls horizontally.

**Protest Table** (`LitigationProtestTable`):

| Column | Field | Width | Alignment | Format |
|--------|-------|-------|-----------|--------|
| Data | `date` | 100px | Left | `dd/MM/yyyy` using `Intl.DateTimeFormat('pt-BR')` |
| Valor | `amount` | 120px | Right | `R$ 5.000,00` using Brazilian currency format |
| Cartorio | `notaryOffice` | Auto (flexible) | Left | Plain text |
| Status | `status` | 80px | Left | Badge: "ATIVO" uses `cream-100` bg / `cream-700` text; "PAGO" uses `green-100` bg / `green-700` text; "CANCELADO" uses `gray-100` bg / `gray-600` text |

- Same table styling as lawsuit table.
- If there are no protests, show: "Nenhum protesto registrado." (`body-sm`, `gray-500`, centered).

### Risk Level Badge Colors

Following `design-system.md` badge patterns:

| Risk Level | Label (PT-BR) | Label (EN) | Background | Text Color |
|------------|---------------|------------|------------|------------|
| LOW | Baixo | Low | `green-100` (#E8F5E4) | `green-700` (#6BAF5E) |
| MEDIUM | Medio | Medium | `cream-100` (#FAF4E3) | `cream-700` (#C4A44E) |
| HIGH | Alto | High | `#FEE2E2` | `#991B1B` |

Badge styling: `radius-full` (pill), `caption` (12px), weight 500, padding `2px 8px`.

### Internal Profile Editor View — Litigation

When the litigation section is rendered inside the internal profile editor (`/companies/:companyId/profile`), the following additional rules apply:

- The entire litigation card has a subtle visual distinction to signal it is non-editable:
  - Container: `opacity: 0.85` or `bg-gray-50` background instead of white to visually differentiate from editable form sections.
  - A label "(dados gerenciados pelo sistema)" is displayed below the section title in `caption` (12px), `gray-400`, italic.
- No edit buttons, no hide toggles, no action buttons of any kind.
- The expand/collapse toggle for "Ver detalhes" still works normally (read-only does not mean non-interactive, just non-editable).
- This section is placed at the bottom of the "Informacoes" tab, after the enrichment section, separated by a `1px solid gray-200` divider with `32px` top margin.

### Litigation Component Architecture

All litigation components live in the frontend under a `litigation/` feature directory. Each component is a single responsibility:

| Component | Responsibility | Props |
|-----------|---------------|-------|
| `LitigationSection` | Container that reads `litigationStatus` and renders the correct state (PENDING, FAILED, or COMPLETED). Handles the expand/collapse state. | `litigation: LitigationResponse` (the `litigation` object from the profile API response), `isInternalView?: boolean` (defaults to `false`) |
| `LitigationSummaryCard` | Renders the risk badge, summary stats, verified date, and expand/collapse toggle. | `summary: LitigationSummary`, `fetchedAt: string`, `isExpanded: boolean`, `onToggleExpand: () => void` |
| `LitigationDetailTable` | Renders the lawsuit rows in a table. | `lawsuits: Lawsuit[]` |
| `LitigationProtestTable` | Renders the protest rows in a table. | `protests: Protest[]` |
| `LitigationRiskBadge` | Renders the colored pill badge for LOW / MEDIUM / HIGH risk level. | `riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'` |
| `LitigationPendingState` | Renders the spinner + pending message. | None |
| `LitigationFailedState` | Renders the warning icon + failure message. | None |

#### Litigation Component Tree

```
LitigationSection
  +- (if PENDING) LitigationPendingState
  +- (if FAILED) LitigationFailedState
  +- (if COMPLETED)
       +- LitigationSummaryCard
       |    +- LitigationRiskBadge
       +- (if expanded)
            +- LitigationDetailTable
            +- LitigationProtestTable
```

#### TypeScript Types (Frontend) — Litigation

```typescript
// Mirrors the API response shape for the litigation section
interface LitigationResponse {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  fetchedAt: string | null;
  summary: LitigationSummary | null;
  lawsuits?: Lawsuit[];
  protestData?: ProtestData;
  error?: string;
}

interface LitigationSummary {
  activeLawsuits: number;
  historicalLawsuits: number;
  activeAdministrative: number;
  protests: number;
  totalValueInDispute: string; // Decimal as string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface Lawsuit {
  processId: string;
  court: string;
  caseType: 'CIVIL' | 'LABOR' | 'CRIMINAL' | 'TAX' | 'ADMINISTRATIVE';
  status: string;
  filingDate: string;
  lastUpdate: string;
  valueInDispute: string | null;
  plaintiffName: string; // Already masked by backend
  defendantRole: string;
  subject: string;
}

interface ProtestData {
  totalProtests: number;
  protests: Protest[];
}

interface Protest {
  date: string;
  amount: string;
  notaryOffice: string;
  status: string;
}
```

### Litigation i18n Keys

All user-facing strings must be added to both `messages/pt-BR.json` and `messages/en.json`. Keys follow the `litigation.*` namespace.

| Key | PT-BR | EN |
|-----|-------|-----|
| `litigation.title` | Verificacao Judicial | Litigation Verification |
| `litigation.verifiedAt` | Verificado em: {date} | Verified on: {date} |
| `litigation.pending.title` | Verificacao em andamento... | Verification in progress... |
| `litigation.pending.message` | Os dados judiciais estao sendo consultados. Volte em alguns minutos. | Litigation data is being fetched. Please check back in a few minutes. |
| `litigation.failed.title` | Verificacao indisponivel | Verification unavailable |
| `litigation.failed.message` | Nao foi possivel consultar os dados judiciais neste momento. | Unable to fetch litigation data at this time. |
| `litigation.summary.activeLawsuits` | {count, plural, =0 {Nenhum processo ativo} =1 {1 processo ativo} other {# processos ativos}} | {count, plural, =0 {No active lawsuits} =1 {1 active lawsuit} other {# active lawsuits}} |
| `litigation.summary.historicalLawsuits` | {count, plural, =0 {0 historicos} =1 {1 historico} other {# historicos}} | {count, plural, =0 {0 historical} =1 {1 historical} other {# historical}} |
| `litigation.summary.valueInDispute` | {value} em disputa | {value} in dispute |
| `litigation.summary.protests` | {count, plural, =0 {0 protestos} =1 {1 protesto} other {# protestos}} | {count, plural, =0 {0 protests} =1 {1 protest} other {# protests}} |
| `litigation.summary.noProtests` | Nenhum protesto registrado | No protests registered |
| `litigation.summary.noLawsuits` | Nenhum processo judicial registrado | No lawsuits registered |
| `litigation.riskLevel.low` | Baixo | Low |
| `litigation.riskLevel.medium` | Medio | Medium |
| `litigation.riskLevel.high` | Alto | High |
| `litigation.details.show` | Ver detalhes | Show details |
| `litigation.details.hide` | Ocultar detalhes | Hide details |
| `litigation.table.processId` | Processo | Process ID |
| `litigation.table.court` | Tribunal | Court |
| `litigation.table.caseType` | Tipo | Type |
| `litigation.table.status` | Status | Status |
| `litigation.table.filingDate` | Data | Date |
| `litigation.table.value` | Valor | Value |
| `litigation.table.plaintiff` | Autor | Plaintiff |
| `litigation.table.subject` | Assunto | Subject |
| `litigation.systemManaged` | Dados gerenciados pelo sistema | System-managed data |
| `litigation.caseType.civil` | Civel | Civil |
| `litigation.caseType.labor` | Trabalhista | Labor |
| `litigation.caseType.criminal` | Criminal | Criminal |
| `litigation.caseType.tax` | Tributario | Tax |
| `litigation.caseType.administrative` | Administrativo | Administrative |
| `litigation.protestTable.date` | Data | Date |
| `litigation.protestTable.value` | Valor | Value |
| `litigation.protestTable.notaryOffice` | Cartorio | Notary Office |
| `litigation.protestTable.status` | Status | Status |
| `litigation.section.lawsuits` | Processos Judiciais | Lawsuits |
| `litigation.section.protests` | Protestos | Protests |

### Formatting Rules — Litigation

All formatting follows the global rules from `i18n.md`:

- **Currency values**: Always use Brazilian format regardless of UI language. `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` produces `R$ 225.000,00`.
- **Dates**: Always use Brazilian format `dd/MM/yyyy`. `Intl.DateTimeFormat('pt-BR')` produces `23/02/2026`.
- **Process IDs**: Display the full court case number as-is from the API (e.g., "0000123-45.2024.8.26.0100"). Do not truncate or abbreviate.
- **Percentages**: Not applicable for litigation data.

### Accessibility Requirements — Litigation

- The expand/collapse toggle must be a `<button>` element with `aria-expanded="true|false"` and `aria-controls` pointing to the detail section ID.
- The detail section (lawsuit table + protest table) must have an `id` matching the `aria-controls` value and use `role="region"` with an `aria-label`.
- Risk badge must include `aria-label` with the full risk level text (e.g., `aria-label="Nivel de risco: Medio"`).
- Tables must use semantic `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` markup.
- PENDING and FAILED states must use `role="status"` for the message area so screen readers announce the state.
- Spinner in PENDING state must have `aria-label="Carregando"` (or the EN equivalent based on locale).

### Responsive Behavior — Litigation

| Breakpoint | Layout |
|------------|--------|
| `sm` (< 640px) | Summary stats stack vertically (one stat per line). Lawsuit and protest tables scroll horizontally. Risk badge and verified date stack below the summary. |
| `md` (768px+) | Summary stats on a single line separated by bullets. Tables fit within the card width if columns are narrow enough, otherwise horizontal scroll. |
| `lg` (1024px+) | Full layout as shown in the wireframes above. Tables fit comfortably. |

---

## Functional Requirements

### FR-1: Automatic Company Data Enrichment (BigDataCorp)
- System MUST dispatch a background Bull job to fetch company enrichment data from BigDataCorp when a company profile is created (`POST /api/v1/companies/:companyId/profile`)
- The job uses the company's already-validated CNPJ (from `company-cnpj-validation.md`)
- System MUST store the enrichment data in a separate `CompanyEnrichment` entity linked to the Company
- Enrichment data is read-only in the UI but can be refreshed by ADMIN users
- If the BigDataCorp API fails after retries, the profile is still usable — the enrichment section shows a "Lookup unavailable" status
- Enrichment data is displayed on both the internal authenticated view and the public shareable profile
- Enrichment data includes: trade name, legal nature, founding date, registered address, CNAE codes (primary + secondary), capital social, employee count, legal representatives, branch offices, and Receita Federal status

### FR-2: Manual Re-Enrichment
- ADMIN users MUST be able to trigger a manual refresh of enrichment data via `POST /api/v1/companies/:companyId/enrichment/trigger`
- Manual re-enrichment is rate limited to once per 24 hours per company
- The system dispatches a new Bull job when a re-enrichment is triggered
- During re-enrichment, `enrichmentStatus` transitions to PROCESSING
- On completion, `lastEnrichedAt` is updated and status returns to COMPLETED
- On failure, status returns to the previous COMPLETED state (or FAILED if no prior data exists)

### FR-3: Stale Data Detection
- System MUST flag enrichment data as STALE when `lastEnrichedAt` is older than 90 days
- The frontend displays a warning banner suggesting a refresh
- STALE status does not affect data availability — all previously fetched data remains visible

### FR-4: Automatic Litigation Check (BigDataCorp)
- System MUST dispatch a background Bull job to fetch litigation data from BigDataCorp when a company profile is created (`POST /api/v1/companies/:companyId/profile`)
- The job uses the company's already-validated CNPJ (from `company-cnpj-validation.md`)
- System MUST store the litigation data as immutable fields on the CompanyProfile entity
- No user (including ADMIN) can edit, hide, or delete the litigation data
- If the BigDataCorp API fails after retries, the profile is still usable — the litigation section shows a "Verification pending" status
- Litigation data is displayed on both the internal authenticated view and the public shareable profile
- Litigation data includes: active/historical lawsuits, administrative proceedings, notary protest records, and a computed risk level

---

## Data Models

### CompanyEnrichment Entity (New)

```prisma
model CompanyEnrichment {
  id                   String            @id @default(uuid())
  companyId            String            @unique @map("company_id")
  cnpj                 String
  tradeName            String?           @map("trade_name")
  legalNature          String?           @map("legal_nature")
  foundingDate         DateTime?         @map("founding_date")
  registeredAddress    Json?             @map("registered_address")
  cnaeMain             String?           @map("cnae_main")
  cnaeMainDescription  String?           @map("cnae_main_description")
  cnaeSecondary        Json?             @map("cnae_secondary")        // Array of { code, description }
  capitalSocial        Decimal?          @map("capital_social")        @db.Decimal(18, 2)
  employeeCount        Int?              @map("employee_count")
  legalRepresentatives Json?             @map("legal_representatives") // Array of { name, qualification, entryDate }
  branchOffices        Json?             @map("branch_offices")        // Array of { cnpj, tradeName, address, status }
  rfStatus             String?           @map("rf_status")             // ATIVA, BAIXADA, SUSPENSA, INAPTA, NULA
  lastEnrichedAt       DateTime?         @map("last_enriched_at")
  enrichmentStatus     EnrichmentStatus  @default(PENDING) @map("enrichment_status")
  enrichmentError      String?           @map("enrichment_error")
  rawData              Json?             @map("raw_data")              // Full BigDataCorp response for audit
  createdAt            DateTime          @default(now()) @map("created_at")
  updatedAt            DateTime          @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id])

  @@index([companyId])
  @@index([cnpj])
  @@map("company_enrichments")
}

enum EnrichmentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  STALE
}
```

### Field Descriptions — CompanyEnrichment

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `companyId` | UUID | Yes | Foreign key to Company entity (unique — one enrichment per company) |
| `cnpj` | String | Yes | CNPJ used for the BigDataCorp query (digits only, no mask) |
| `tradeName` | String | No | Nome Fantasia from Receita Federal |
| `legalNature` | String | No | Natureza Juridica code and description (e.g., "206-2 - Sociedade Empresaria Limitada") |
| `foundingDate` | DateTime | No | Data de Abertura from Receita Federal |
| `registeredAddress` | JSONB | No | Structured address object (see TypeScript types) |
| `cnaeMain` | String | No | Primary CNAE code (e.g., "6201501") |
| `cnaeMainDescription` | String | No | Description of the primary CNAE activity |
| `cnaeSecondary` | JSONB | No | Array of secondary CNAE codes with descriptions |
| `capitalSocial` | Decimal(18,2) | No | Registered capital in BRL |
| `employeeCount` | Int | No | Employee count from RAIS/CAGED data |
| `legalRepresentatives` | JSONB | No | Array of partners/administrators with name, qualification, entry date |
| `branchOffices` | JSONB | No | Array of branch offices with CNPJ, name, address, status |
| `rfStatus` | String | No | Company status at Receita Federal (ATIVA, BAIXADA, SUSPENSA, INAPTA, NULA) |
| `lastEnrichedAt` | DateTime | No | When enrichment data was last successfully fetched |
| `enrichmentStatus` | Enum | Yes | Current status of the enrichment process |
| `enrichmentError` | String | No | Error message if FAILED |
| `rawData` | JSONB | No | Full BigDataCorp response stored for audit trail |
| `createdAt` | DateTime | Yes | When the enrichment record was created |
| `updatedAt` | DateTime | Yes | When the enrichment record was last updated |

### JSONB Field Structures

#### `registeredAddress`

```typescript
{
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;       // 2-letter state code (e.g., "SP")
  zipCode: string;     // 8 digits, no mask
}
```

#### `cnaeSecondary`

```typescript
Array<{
  code: string;         // e.g., "6311900"
  description: string;  // e.g., "Tratamento de dados, provedores de servicos de aplicacao e servicos de hospedagem na internet"
}>
```

#### `legalRepresentatives`

```typescript
Array<{
  name: string;         // Full name (public information from corporate registry)
  qualification: string; // e.g., "Socio-Administrador", "Socio", "Diretor"
  entryDate: string | null; // ISO 8601 date
}>
```

#### `branchOffices`

```typescript
Array<{
  cnpj: string;         // CNPJ of the branch (digits only)
  tradeName: string | null;
  address: {
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  status: string;       // ATIVA, BAIXADA, etc.
}>
```

### Litigation Fields on CompanyProfile (Existing)

The following fields are stored on the `CompanyProfile` entity (defined in [company-profile.md](./company-profile.md)). They are system-managed and immutable — no API endpoint allows direct modification.

```typescript
// These fields are part of the CompanyProfile entity
interface CompanyProfileLitigationFields {
  litigationStatus: VerificationStatus; // PENDING | COMPLETED | FAILED
  litigationData: LitigationData | null; // Full BigDataCorp response (JSONB)
  litigationFetchedAt: Date | null;     // When data was last fetched
  litigationError: string | null;       // Error message if FAILED
}

enum VerificationStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
```

### LitigationData Interface

```typescript
interface LitigationData {
  summary: {
    activeLawsuits: number;           // Count of active judicial processes
    historicalLawsuits: number;       // Count of resolved/archived processes
    activeAdministrative: number;     // Active administrative proceedings
    protests: number;                 // Notary protest records
    totalValueInDispute: string;      // Sum of all active dispute amounts (Decimal as string)
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';  // Computed from lawsuit count + amounts
  };
  lawsuits: Array<{
    processId: string;                // Court case number (e.g., "0000123-45.2024.8.26.0100")
    court: string;                    // Court name
    caseType: 'CIVIL' | 'LABOR' | 'CRIMINAL' | 'TAX' | 'ADMINISTRATIVE';
    status: string;                   // ATIVO, ARQUIVADO, EXTINTO, etc.
    filingDate: string;               // ISO 8601 date
    lastUpdate: string;               // ISO 8601 date
    valueInDispute: string | null;    // Decimal as string, BRL
    plaintiffName: string;            // Masked if individual (PII)
    defendantRole: string;            // REU, AUTOR, etc.
    subject: string;                  // Brief description of lawsuit type
  }>;
  protestData: {
    totalProtests: number;
    protests: Array<{
      date: string;
      amount: string;
      notaryOffice: string;
      status: string;                 // ATIVO, PAGO, CANCELADO
    }>;
  };
  queryDate: string;                  // ISO 8601 — when BigDataCorp was queried
}
```

### Litigation Fields in CompanyProfile Prisma Model

These fields are part of the `CompanyProfile` model defined in [company-profile.md](./company-profile.md):

```prisma
// Part of the CompanyProfile model
litigationStatus    VerificationStatus @default(PENDING) @map("litigation_status")
litigationData      Json?              @map("litigation_data")
litigationFetchedAt DateTime?          @map("litigation_fetched_at")
litigationError     String?            @map("litigation_error")
```

---

## API Endpoints

### Company Data Enrichment Endpoints

#### Trigger Enrichment

```
POST /api/v1/companies/:companyId/enrichment/trigger
```

**Authorization**: ADMIN role required.

**Rate Limit**: 1 request per 24 hours per company. Returns `429 Too Many Requests` if exceeded.

**Request Body**: None.

**Response (202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "status": "PROCESSING",
    "message": "Enrichment job dispatched"
  }
}
```

**Error Responses**:

| Status | Code | When |
|--------|------|------|
| 403 | `AUTH_INSUFFICIENT_ROLE` | User is not ADMIN |
| 404 | `COMPANY_NOT_FOUND` | Company does not exist or user is not a member |
| 429 | `ENRICHMENT_RATE_LIMITED` | Re-enrichment attempted within 24 hours |

#### Get Enrichment Data

```
GET /api/v1/companies/:companyId/enrichment
```

**Authorization**: ADMIN, FINANCE, or LEGAL roles.

**Response (200 OK) — COMPLETED**:
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "lastEnrichedAt": "2026-02-23T10:05:00Z",
    "data": {
      "tradeName": "Acme Tech",
      "legalNature": "206-2 - Sociedade Empresaria Limitada",
      "foundingDate": "2020-03-15",
      "registeredAddress": {
        "street": "Rua Exemplo",
        "number": "123",
        "complement": "Sala 45",
        "neighborhood": "Centro",
        "city": "Sao Paulo",
        "state": "SP",
        "zipCode": "01234567"
      },
      "cnaeMain": {
        "code": "62.01-5-01",
        "description": "Desenvolvimento de programas de computador sob encomenda"
      },
      "cnaeSecondary": [
        {
          "code": "63.11-9-00",
          "description": "Tratamento de dados, provedores de servicos de aplicacao e servicos de hospedagem na internet"
        },
        {
          "code": "62.02-3-00",
          "description": "Desenvolvimento e licenciamento de programas de computador customizaveis"
        }
      ],
      "capitalSocial": "500000.00",
      "employeeCount": 42,
      "legalRepresentatives": [
        {
          "name": "Joao Silva",
          "qualification": "Socio-Administrador",
          "entryDate": "2020-03-15"
        },
        {
          "name": "Maria Santos",
          "qualification": "Socia",
          "entryDate": "2020-03-15"
        }
      ],
      "branchOffices": [],
      "rfStatus": "ATIVA"
    }
  }
}
```

**Response (200 OK) — PENDING**:
```json
{
  "success": true,
  "data": {
    "status": "PENDING",
    "lastEnrichedAt": null,
    "data": null
  }
}
```

**Response (200 OK) — FAILED**:
```json
{
  "success": true,
  "data": {
    "status": "FAILED",
    "lastEnrichedAt": null,
    "data": null,
    "error": "Enrichment service temporarily unavailable"
  }
}
```

**Response (200 OK) — STALE**:
```json
{
  "success": true,
  "data": {
    "status": "STALE",
    "lastEnrichedAt": "2025-11-01T10:05:00Z",
    "data": {
      "...same structure as COMPLETED..."
    }
  }
}
```

#### Get Enrichment Status

```
GET /api/v1/companies/:companyId/enrichment/status
```

**Authorization**: ADMIN, FINANCE, or LEGAL roles.

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "lastEnrichedAt": "2026-02-23T10:05:00Z",
    "canRefresh": true,
    "nextRefreshAvailableAt": null
  }
}
```

When refresh is rate-limited:
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "lastEnrichedAt": "2026-02-25T14:30:00Z",
    "canRefresh": false,
    "nextRefreshAvailableAt": "2026-02-26T14:30:00Z"
  }
}
```

### Litigation Data Endpoints (Existing)

Litigation data is not managed through dedicated API endpoints. Instead:

1. **Triggering**: The litigation check is automatically dispatched when a profile is created via `POST /api/v1/companies/:companyId/profile` (see [company-profile.md](./company-profile.md)).

2. **Reading**: Litigation data is included in the profile response for both authenticated and public endpoints:
   - `GET /api/v1/companies/:companyId/profile` — internal view with litigation section
   - `GET /api/v1/profiles/:slug` — public view with litigation section

3. **Immutability enforcement**: The `PUT /api/v1/companies/:companyId/profile` endpoint MUST silently ignore any litigation fields (`litigationStatus`, `litigationData`, `litigationFetchedAt`, `litigationError`) in the request body.

### Litigation Response Format

**When `COMPLETED`** (data successfully fetched):
```json
"litigation": {
  "status": "COMPLETED",
  "fetchedAt": "2026-02-23T10:05:00Z",
  "summary": {
    "activeLawsuits": 2,
    "historicalLawsuits": 5,
    "activeAdministrative": 0,
    "protests": 0,
    "totalValueInDispute": "225000.00",
    "riskLevel": "MEDIUM"
  },
  "lawsuits": [
    {
      "processId": "0000123-45.2024.8.26.0100",
      "court": "TJSP - 1a Vara Civel",
      "caseType": "CIVIL",
      "status": "ATIVO",
      "filingDate": "2024-03-15",
      "lastUpdate": "2026-01-20",
      "valueInDispute": "150000.00",
      "plaintiffName": "J*** S***",
      "defendantRole": "REU",
      "subject": "Cobranca"
    }
  ],
  "protestData": {
    "totalProtests": 0,
    "protests": []
  }
}
```

**When `PENDING`** (job dispatched, not yet completed):
```json
"litigation": {
  "status": "PENDING",
  "fetchedAt": null,
  "summary": null
}
```

**When `FAILED`** (BigDataCorp fetch failed after all retries):
```json
"litigation": {
  "status": "FAILED",
  "fetchedAt": null,
  "summary": null,
  "error": "Verification service temporarily unavailable"
}
```

### Enrichment Data in Profile Response

When the profile is fetched, enrichment data is included as a separate object alongside litigation:

```json
{
  "success": true,
  "data": {
    "id": "profile-uuid",
    "...other profile fields...",
    "enrichment": {
      "status": "COMPLETED",
      "lastEnrichedAt": "2026-02-23T10:05:00Z",
      "data": { "...enrichment data..." }
    },
    "litigation": {
      "status": "COMPLETED",
      "fetchedAt": "2026-02-23T10:05:00Z",
      "summary": { "..." },
      "lawsuits": [],
      "protestData": { "..." }
    }
  }
}
```

---

## Business Rules

### BR-1: Enrichment Data Management
- Enrichment data fields are system-populated and cannot be directly edited by users
- Only the background Bull job processor and the re-enrichment trigger can write to enrichment fields
- Enrichment data is associated with the Company entity (not CompanyProfile), so it persists even if the profile is deleted and recreated
- Re-enrichment overwrites all previous enrichment data (the `rawData` field preserves the full response for audit trail)

### BR-2: Enrichment Rate Limiting
- Manual re-enrichment is rate limited to once per 24 hours per company
- The rate limit is enforced server-side based on `lastEnrichedAt`
- If `lastEnrichedAt` is less than 24 hours ago, the trigger endpoint returns `429 Too Many Requests`
- Auto-enrichment on profile creation is exempt from the rate limit

### BR-3: Stale Data Threshold
- Enrichment data is flagged as STALE when `lastEnrichedAt` is older than 90 days
- The STALE status is computed dynamically at read time (not stored in the database)
- STALE data is still fully displayed — the warning is informational only

### BR-4: Enrichment Does Not Overwrite Company Entity
- Enrichment data is stored separately in the `CompanyEnrichment` entity
- It does NOT automatically overwrite fields on the Company entity (e.g., `Company.address`, `Company.capitalSocial`)
- Users can view enriched data and manually update their Company settings if desired (future enhancement: "Apply to company" button)

### BR-5: Litigation Data Immutability (Existing)
- Litigation verification fields (`litigationStatus`, `litigationData`, `litigationFetchedAt`, `litigationError`) are system-managed
- No API endpoint allows direct modification of these fields
- The `PUT /api/v1/companies/:companyId/profile` endpoint MUST silently ignore any litigation fields in the request body
- Only the background Bull job processor (`profile-litigation` queue) can write to these fields
- Litigation data cannot be hidden, deleted, or overridden by any user role (including ADMIN)

### BR-6: Risk Level Computation (Existing)

The risk level is computed from active lawsuit count and total value in dispute:

| Active Lawsuits | Total Value in Dispute | Risk Level |
|----------------|----------------------|------------|
| 0 | Any | LOW |
| 1-2 | < R$ 100.000 | LOW |
| 1-5 | < R$ 500.000 | MEDIUM |
| >5 or high value | >= R$ 500.000 | HIGH |

---

## Edge Cases & Error Handling

### EC-1: BigDataCorp API Failure During Enrichment
**Scenario**: The BigDataCorp API is unreachable or returns errors when the enrichment Bull job runs.
**Handling**: Bull job retries 3 times with exponential backoff (30s, 60s, 120s). If all retries fail, `enrichmentStatus` is set to `FAILED` and `enrichmentError` stores a user-friendly message. The profile remains fully usable — the enrichment section displays "Lookup unavailable." An admin alert is sent via Slack. The user can trigger a manual re-enrichment later.

### EC-2: CNPJ Not Found in BigDataCorp (Enrichment)
**Scenario**: The company's CNPJ returns no results from BigDataCorp for enrichment data (e.g., very new company not yet indexed).
**Handling**: `enrichmentStatus` is set to `COMPLETED` with all enrichment fields set to `null`. The UI displays "Nao disponivel" for each field. This is a valid result — the company simply has no enrichment data available yet. The user can try re-enriching later.

### EC-3: Partial Enrichment Data
**Scenario**: BigDataCorp returns some fields but not others (e.g., address is available but employee count is not).
**Handling**: Store whatever data is available. Fields that BigDataCorp did not return are stored as `null`. The UI displays "Nao disponivel" for missing fields.

### EC-4: Re-Enrichment During PROCESSING State
**Scenario**: An ADMIN triggers re-enrichment while a previous enrichment job is still running.
**Handling**: If `enrichmentStatus` is PROCESSING, the trigger endpoint returns `409 Conflict` with error code `ENRICHMENT_ALREADY_PROCESSING`. The user must wait for the current job to complete.

### EC-5: Re-Enrichment Overwrites Previous Data
**Scenario**: A re-enrichment returns different data than the previous enrichment (e.g., company changed address).
**Handling**: All enrichment fields are overwritten with the new data. The previous `rawData` is replaced. For audit purposes, the `COMPANY_ENRICHMENT_REFRESHED` audit event captures the before/after state.

### EC-6: Enrichment for Company Without Profile
**Scenario**: The enrichment trigger endpoint is called before a company profile exists.
**Handling**: The enrichment is created as a standalone entity linked to the Company (not the CompanyProfile). If a profile is later created, it automatically includes the enrichment data in its response by joining on `companyId`.

### EC-7: BigDataCorp API Failure During Litigation Check (Existing)
**Scenario**: The BigDataCorp API is unreachable or returns errors when the litigation check Bull job runs.
**Handling**: Bull job retries 3 times with exponential backoff (30s, 60s, 120s). If all retries fail, `litigationStatus` is set to `FAILED` and `litigationError` stores a user-friendly message. The profile remains fully usable — the litigation section displays "Verification pending" or "Verification unavailable." An admin alert is sent via Slack. The job can be manually re-triggered by an admin.

### EC-8: CNPJ Not Found in BigDataCorp (Litigation) (Existing)
**Scenario**: The company's CNPJ returns no results from BigDataCorp (e.g., very new company).
**Handling**: `litigationStatus` is set to `COMPLETED` with `litigationData.summary` showing all zero counts and `riskLevel: 'LOW'`. This is a valid result — no litigation history is a positive signal.

### EC-9: BigDataCorp Returns Stale Litigation Data (Existing)
**Scenario**: Litigation data changes after the initial fetch.
**Handling**: Litigation data is fetched once at profile creation and stored as a point-in-time snapshot. The `litigationFetchedAt` timestamp is displayed to viewers so they can judge data freshness. Future enhancement: periodic re-fetch job (out of scope for MVP).

---

## Dependencies

### Internal Dependencies
- **company-profile.md**: Litigation fields are stored on the CompanyProfile entity. Enrichment data is displayed on the profile views. Both checks are triggered by profile creation.
- **company-cnpj-validation.md**: Uses the already-validated CNPJ for the BigDataCorp lookup.
- **company-management.md**: CompanyEnrichment entity is linked to the Company entity.
- **error-handling.md**: Retry strategies and circuit breaker patterns for external services.
- **audit-logging.md**: Enrichment and litigation fetch success/failure events are audit-logged.
- **security.md**: PII masking rules for individual plaintiff names in litigation data.
- **user-permissions.md**: Role-based access control for enrichment endpoints.

### External Dependencies
- **BigDataCorp**: Company data and litigation data via CNPJ lookup
  - Company data endpoints: POST with CNPJ to `/empresas` and related datasets (address, CNAE, legal representatives, capital social, employees, RF status, branches)
  - Litigation endpoints: POST with CNPJ to `/empresas/owners_lawsuits` and related datasets
  - Authentication: API Key in Authorization header
  - Rate limit: Per API key (check contract)
  - Environment variable: `BIGDATACORP_API_KEY` (rotated annually)
- **Bull (Redis-backed)**: Background job queues
  - Queue: `company-enrichment` — Retry: 3 attempts, exponential backoff (30s, 60s, 120s)
  - Queue: `profile-litigation` — Retry: 3 attempts, exponential backoff (30s, 60s, 120s)

---

## Technical Implementation

### BigDataCorpService — Company Data Enrichment

```typescript
// /backend/src/enrichment/bigdatacorp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

interface BigDataCorpCompanyResponse {
  tradeName: string | null;
  legalNature: string | null;
  foundingDate: string | null;
  registeredAddress: {
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  } | null;
  cnaeMain: {
    code: string;
    description: string;
  } | null;
  cnaeSecondary: Array<{
    code: string;
    description: string;
  }>;
  capitalSocial: string | null;
  employeeCount: number | null;
  legalRepresentatives: Array<{
    name: string;
    qualification: string;
    entryDate: string | null;
  }>;
  branchOffices: Array<{
    cnpj: string;
    tradeName: string | null;
    address: {
      street: string;
      number: string;
      complement: string | null;
      neighborhood: string;
      city: string;
      state: string;
      zipCode: string;
    };
    status: string;
  }>;
  rfStatus: string | null;
}

interface BigDataCorpLitigationResponse {
  lawsuits: Array<{
    processId: string;
    court: string;
    caseType: string;
    status: string;
    filingDate: string;
    lastUpdate: string;
    valueInDispute: string | null;
    plaintiffName: string;
    defendantRole: string;
    subject: string;
  }>;
  administrativeProceedings: Array<{
    processId: string;
    agency: string;
    status: string;
    filingDate: string;
  }>;
  protests: Array<{
    date: string;
    amount: string;
    notaryOffice: string;
    status: string;
  }>;
}

@Injectable()
export class BigDataCorpService {
  private readonly logger = new Logger(BigDataCorpService.name);
  private readonly apiUrl = 'https://api.bigdatacorp.com.br';
  private readonly timeout = 30000; // 30 seconds

  constructor(private circuitBreaker: CircuitBreakerService) {
    this.circuitBreaker.register('bigdatacorp', {
      failureThreshold: 5,
      resetTimeout: 60000, // 60s half-open
    });
  }

  async fetchCompanyData(cnpj: string): Promise<BigDataCorpCompanyResponse> {
    return this.circuitBreaker.execute('bigdatacorp', async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.apiUrl}/empresas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.BIGDATACORP_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cnpj: cnpj.replace(/\D/g, ''),
            datasets: [
              'basic_data',
              'addresses',
              'economic_activities',
              'partners',
              'employees',
              'branches',
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 404) {
            throw new BigDataCorpNotFoundError(`CNPJ ${cnpj} not found in BigDataCorp`);
          }
          throw new Error(`BigDataCorp API error: ${response.status}`);
        }

        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  async fetchLitigationData(cnpj: string): Promise<BigDataCorpLitigationResponse> {
    return this.circuitBreaker.execute('bigdatacorp', async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.apiUrl}/empresas/owners_lawsuits`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.BIGDATACORP_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, '') }),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 404) {
            throw new BigDataCorpNotFoundError(`CNPJ ${cnpj} not found in BigDataCorp`);
          }
          throw new Error(`BigDataCorp API error: ${response.status}`);
        }

        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }
}

class BigDataCorpNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BigDataCorpNotFoundError';
  }
}
```

### CompanyEnrichmentProcessor — Bull Job

```typescript
// /backend/src/enrichment/company-enrichment.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BigDataCorpService } from './bigdatacorp.service';
import { AuditService } from '../audit/audit.service';

@Processor('company-enrichment')
export class CompanyEnrichmentProcessor {
  private readonly logger = new Logger(CompanyEnrichmentProcessor.name);

  constructor(
    private prisma: PrismaService,
    private bigDataCorp: BigDataCorpService,
    private auditService: AuditService,
  ) {}

  @Process('fetch-enrichment')
  async handleFetchEnrichment(job: Job<{
    enrichmentId: string;
    companyId: string;
    cnpj: string;
    isRefresh: boolean;
  }>) {
    const { enrichmentId, companyId, cnpj, isRefresh } = job.data;

    try {
      // Update status to PROCESSING
      await this.prisma.companyEnrichment.update({
        where: { id: enrichmentId },
        data: { enrichmentStatus: 'PROCESSING' },
      });

      const response = await this.bigDataCorp.fetchCompanyData(cnpj);

      await this.prisma.companyEnrichment.update({
        where: { id: enrichmentId },
        data: {
          tradeName: response.tradeName,
          legalNature: response.legalNature,
          foundingDate: response.foundingDate
            ? new Date(response.foundingDate)
            : null,
          registeredAddress: response.registeredAddress as any,
          cnaeMain: response.cnaeMain?.code || null,
          cnaeMainDescription: response.cnaeMain?.description || null,
          cnaeSecondary: response.cnaeSecondary as any,
          capitalSocial: response.capitalSocial
            ? parseFloat(response.capitalSocial)
            : null,
          employeeCount: response.employeeCount,
          legalRepresentatives: response.legalRepresentatives as any,
          branchOffices: response.branchOffices as any,
          rfStatus: response.rfStatus,
          lastEnrichedAt: new Date(),
          enrichmentStatus: 'COMPLETED',
          enrichmentError: null,
          rawData: response as any,
        },
      });

      const auditAction = isRefresh
        ? 'COMPANY_ENRICHMENT_REFRESHED'
        : 'COMPANY_ENRICHMENT_FETCHED';

      await this.auditService.log({
        actorType: 'SYSTEM',
        action: auditAction,
        resourceType: 'CompanyEnrichment',
        resourceId: enrichmentId,
        companyId,
        changes: {
          before: isRefresh
            ? { enrichmentStatus: 'PROCESSING' }
            : { enrichmentStatus: 'PENDING' },
          after: {
            enrichmentStatus: 'COMPLETED',
            rfStatus: response.rfStatus,
            employeeCount: response.employeeCount,
          },
        },
      });

      this.logger.log(
        `Company enrichment ${isRefresh ? 'refreshed' : 'fetched'} for company ${companyId}`,
      );
    } catch (error) {
      // If this is the last attempt, mark as FAILED
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        // For refreshes, revert to COMPLETED if we had previous data
        const existing = await this.prisma.companyEnrichment.findUnique({
          where: { id: enrichmentId },
        });

        const newStatus =
          isRefresh && existing?.lastEnrichedAt ? 'COMPLETED' : 'FAILED';

        await this.prisma.companyEnrichment.update({
          where: { id: enrichmentId },
          data: {
            enrichmentStatus: newStatus,
            enrichmentError: 'Enrichment service temporarily unavailable',
          },
        });

        await this.auditService.log({
          actorType: 'SYSTEM',
          action: 'COMPANY_ENRICHMENT_FAILED',
          resourceType: 'CompanyEnrichment',
          resourceId: enrichmentId,
          companyId,
          metadata: { error: error.message, isRefresh },
        });

        this.logger.error(
          `Company enrichment failed for company ${companyId}`,
          error.stack,
        );
      }

      throw error; // Let Bull handle retry
    }
  }
}
```

### LitigationCheckProcessor — Bull Job (Existing)

```typescript
// /backend/src/profile/profile-litigation.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BigDataCorpService } from '../enrichment/bigdatacorp.service';
import { AuditService } from '../audit/audit.service';
import { redactPii } from '../common/redact-pii';
import { LitigationData } from './types';

@Processor('profile-litigation')
export class LitigationCheckProcessor {
  private readonly logger = new Logger(LitigationCheckProcessor.name);

  constructor(
    private prisma: PrismaService,
    private bigDataCorp: BigDataCorpService,
    private auditService: AuditService,
  ) {}

  @Process('fetch-litigation')
  async handleFetchLitigation(job: Job<{
    profileId: string;
    companyId: string;
    cnpj: string;
  }>) {
    const { profileId, companyId, cnpj } = job.data;

    try {
      const response = await this.bigDataCorp.fetchLitigationData(cnpj);

      // Mask individual plaintiff names (PII)
      const maskedLawsuits = response.lawsuits.map((lawsuit) => ({
        ...lawsuit,
        plaintiffName: this.maskIndividualName(lawsuit.plaintiffName),
      }));

      // Compute summary
      const activeLawsuits = maskedLawsuits.filter((l) => l.status === 'ATIVO');
      const historicalLawsuits = maskedLawsuits.filter((l) => l.status !== 'ATIVO');
      const totalValueInDispute = activeLawsuits
        .reduce((sum, l) => sum + (parseFloat(l.valueInDispute || '0') || 0), 0)
        .toFixed(2);

      const litigationData: LitigationData = {
        summary: {
          activeLawsuits: activeLawsuits.length,
          historicalLawsuits: historicalLawsuits.length,
          activeAdministrative: response.administrativeProceedings.filter(
            (a) => a.status === 'ATIVO',
          ).length,
          protests: response.protests.filter((p) => p.status === 'ATIVO').length,
          totalValueInDispute,
          riskLevel: this.computeRiskLevel(
            activeLawsuits.length,
            parseFloat(totalValueInDispute),
          ),
        },
        lawsuits: maskedLawsuits,
        protestData: {
          totalProtests: response.protests.length,
          protests: response.protests,
        },
        queryDate: new Date().toISOString(),
      };

      await this.prisma.companyProfile.update({
        where: { id: profileId },
        data: {
          litigationStatus: 'COMPLETED',
          litigationData: litigationData as any,
          litigationFetchedAt: new Date(),
          litigationError: null,
        },
      });

      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'PROFILE_LITIGATION_FETCHED',
        resourceType: 'CompanyProfile',
        resourceId: profileId,
        companyId,
        changes: {
          before: { litigationStatus: 'PENDING' },
          after: {
            litigationStatus: 'COMPLETED',
            activeLawsuits: litigationData.summary.activeLawsuits,
            riskLevel: litigationData.summary.riskLevel,
          },
        },
      });

      this.logger.log(`Litigation data fetched for profile ${profileId}`);
    } catch (error) {
      // If this is the last attempt, mark as FAILED
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await this.prisma.companyProfile.update({
          where: { id: profileId },
          data: {
            litigationStatus: 'FAILED',
            litigationError: 'Verification service temporarily unavailable',
          },
        });

        await this.auditService.log({
          actorType: 'SYSTEM',
          action: 'PROFILE_LITIGATION_FAILED',
          resourceType: 'CompanyProfile',
          resourceId: profileId,
          companyId,
          metadata: { error: error.message },
        });

        this.logger.error(`Litigation fetch failed for profile ${profileId}`, error.stack);
      }

      throw error; // Let Bull handle retry
    }
  }

  private computeRiskLevel(
    activeLawsuits: number,
    totalValue: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (activeLawsuits === 0) return 'LOW';
    if (activeLawsuits <= 2 && totalValue < 100000) return 'LOW';
    if (activeLawsuits <= 5 && totalValue < 500000) return 'MEDIUM';
    return 'HIGH';
  }

  private maskIndividualName(name: string): string {
    // Company names (containing LTDA, S.A., EIRELI, MEI, etc.) are not masked
    if (/\b(LTDA|S\.?A\.?|EIRELI|MEI|CNPJ|EMPRESA|CIA|COMPANHIA)\b/i.test(name)) {
      return name;
    }
    // Individual names: mask with first initial + *** for each part
    return name
      .split(' ')
      .map((part) => (part.length > 0 ? `${part[0]}***` : part))
      .join(' ');
  }
}
```

### Bull Queue Configurations

```typescript
// Enrichment queue
const ENRICHMENT_QUEUE_CONFIG = {
  name: 'company-enrichment',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30s, 60s, 120s
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for inspection
  },
};

// Litigation queue (existing)
const LITIGATION_QUEUE_CONFIG = {
  name: 'profile-litigation',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30s, 60s, 120s
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for inspection
  },
};
```

### Dispatching from ProfileService

Both enrichment and litigation checks are dispatched in the `ProfileService.create()` method:

```typescript
// In ProfileService.create() — after profile is created
// 1. Dispatch enrichment check
const enrichment = await this.prisma.companyEnrichment.upsert({
  where: { companyId },
  create: {
    companyId,
    cnpj: company.cnpj,
    enrichmentStatus: 'PENDING',
  },
  update: {
    enrichmentStatus: 'PENDING',
  },
});

await this.enrichmentQueue.add('fetch-enrichment', {
  enrichmentId: enrichment.id,
  companyId,
  cnpj: company.cnpj,
  isRefresh: false,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30000 },
});

// 2. Dispatch litigation check
await this.litigationCheckQueue.add('fetch-litigation', {
  profileId: profile.id,
  companyId,
  cnpj: company.cnpj,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30000 },
});
```

### EnrichmentService — Manual Re-Enrichment

```typescript
// /backend/src/enrichment/enrichment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessRuleException } from '../common/exceptions';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private readonly REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private prisma: PrismaService,
    @InjectQueue('company-enrichment') private enrichmentQueue: Queue,
  ) {}

  async triggerEnrichment(companyId: string, actorId: string): Promise<void> {
    const enrichment = await this.prisma.companyEnrichment.findUnique({
      where: { companyId },
    });

    if (!enrichment) {
      throw new BusinessRuleException(
        'ENRICHMENT_NOT_FOUND',
        'errors.enrichment.notFound',
        { companyId },
      );
    }

    // Check if currently processing
    if (enrichment.enrichmentStatus === 'PROCESSING') {
      throw new BusinessRuleException(
        'ENRICHMENT_ALREADY_PROCESSING',
        'errors.enrichment.alreadyProcessing',
        { companyId },
      );
    }

    // Check rate limit (24h cooldown)
    if (enrichment.lastEnrichedAt) {
      const timeSinceLastEnrichment =
        Date.now() - enrichment.lastEnrichedAt.getTime();
      if (timeSinceLastEnrichment < this.REFRESH_COOLDOWN_MS) {
        const nextAvailable = new Date(
          enrichment.lastEnrichedAt.getTime() + this.REFRESH_COOLDOWN_MS,
        );
        throw new BusinessRuleException(
          'ENRICHMENT_RATE_LIMITED',
          'errors.enrichment.rateLimited',
          {
            nextRefreshAvailableAt: nextAvailable.toISOString(),
            retryAfterSeconds: Math.ceil(
              (this.REFRESH_COOLDOWN_MS - timeSinceLastEnrichment) / 1000,
            ),
          },
        );
      }
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });

    await this.enrichmentQueue.add('fetch-enrichment', {
      enrichmentId: enrichment.id,
      companyId,
      cnpj: company.cnpj,
      isRefresh: true,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
    });

    this.logger.log(`Enrichment refresh triggered for company ${companyId} by user ${actorId}`);
  }

  async getEnrichment(companyId: string): Promise<any> {
    const enrichment = await this.prisma.companyEnrichment.findUnique({
      where: { companyId },
    });

    if (!enrichment) {
      return { status: 'PENDING', lastEnrichedAt: null, data: null };
    }

    // Compute STALE status dynamically
    const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
    let effectiveStatus = enrichment.enrichmentStatus;
    if (
      enrichment.enrichmentStatus === 'COMPLETED' &&
      enrichment.lastEnrichedAt &&
      Date.now() - enrichment.lastEnrichedAt.getTime() > STALE_THRESHOLD_MS
    ) {
      effectiveStatus = 'STALE';
    }

    return {
      status: effectiveStatus,
      lastEnrichedAt: enrichment.lastEnrichedAt?.toISOString() || null,
      data:
        enrichment.enrichmentStatus === 'COMPLETED' ||
        enrichment.enrichmentStatus === 'STALE'
          ? {
              tradeName: enrichment.tradeName,
              legalNature: enrichment.legalNature,
              foundingDate: enrichment.foundingDate?.toISOString() || null,
              registeredAddress: enrichment.registeredAddress,
              cnaeMain: enrichment.cnaeMain
                ? {
                    code: enrichment.cnaeMain,
                    description: enrichment.cnaeMainDescription,
                  }
                : null,
              cnaeSecondary: enrichment.cnaeSecondary || [],
              capitalSocial: enrichment.capitalSocial?.toString() || null,
              employeeCount: enrichment.employeeCount,
              legalRepresentatives: enrichment.legalRepresentatives || [],
              branchOffices: enrichment.branchOffices || [],
              rfStatus: enrichment.rfStatus,
            }
          : null,
      error: enrichment.enrichmentError || undefined,
    };
  }

  async getEnrichmentStatus(companyId: string): Promise<any> {
    const enrichment = await this.prisma.companyEnrichment.findUnique({
      where: { companyId },
    });

    if (!enrichment) {
      return {
        status: 'PENDING',
        lastEnrichedAt: null,
        canRefresh: false,
        nextRefreshAvailableAt: null,
      };
    }

    const canRefresh =
      enrichment.enrichmentStatus !== 'PROCESSING' &&
      (!enrichment.lastEnrichedAt ||
        Date.now() - enrichment.lastEnrichedAt.getTime() >=
          this.REFRESH_COOLDOWN_MS);

    const nextRefreshAvailableAt =
      !canRefresh && enrichment.lastEnrichedAt
        ? new Date(
            enrichment.lastEnrichedAt.getTime() + this.REFRESH_COOLDOWN_MS,
          ).toISOString()
        : null;

    // Compute STALE status dynamically
    const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;
    let effectiveStatus = enrichment.enrichmentStatus;
    if (
      enrichment.enrichmentStatus === 'COMPLETED' &&
      enrichment.lastEnrichedAt &&
      Date.now() - enrichment.lastEnrichedAt.getTime() > STALE_THRESHOLD_MS
    ) {
      effectiveStatus = 'STALE';
    }

    return {
      status: effectiveStatus,
      lastEnrichedAt: enrichment.lastEnrichedAt?.toISOString() || null,
      canRefresh,
      nextRefreshAvailableAt,
    };
  }
}
```

### EnrichmentController

```typescript
// /backend/src/enrichment/enrichment.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { RequireAuth } from '../auth/decorators/require-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit/auditable.decorator';
import { EnrichmentService } from './enrichment.service';

@Controller('api/v1/companies/:companyId/enrichment')
@RequireAuth()
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Post('trigger')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @Auditable({
    action: 'COMPANY_ENRICHMENT_TRIGGERED',
    resourceType: 'CompanyEnrichment',
  })
  async triggerEnrichment(
    @Param('companyId') companyId: string,
    @Req() req: any,
  ) {
    await this.enrichmentService.triggerEnrichment(companyId, req.user.id);
    return {
      status: 'PROCESSING',
      message: 'Enrichment job dispatched',
    };
  }

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  async getEnrichment(@Param('companyId') companyId: string) {
    return this.enrichmentService.getEnrichment(companyId);
  }

  @Get('status')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  async getEnrichmentStatus(@Param('companyId') companyId: string) {
    return this.enrichmentService.getEnrichmentStatus(companyId);
  }
}
```

---

## Error Codes

### ENRICHMENT — Company Data Enrichment Error Codes

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `ENRICHMENT_FAILED` | `errors.enrichment.failed` | 502 | Servico de enriquecimento de dados temporariamente indisponivel | Data enrichment service temporarily unavailable |
| `ENRICHMENT_UNAVAILABLE` | `errors.enrichment.unavailable` | 502 | Servico de consulta de dados indisponivel | Data lookup service unavailable |
| `ENRICHMENT_CNPJ_NOT_FOUND` | `errors.enrichment.cnpjNotFound` | 422 | CNPJ nao encontrado na base de dados | CNPJ not found in data registry |
| `ENRICHMENT_RATE_LIMITED` | `errors.enrichment.rateLimited` | 429 | Atualizacao disponivel apenas uma vez a cada 24 horas | Refresh available only once every 24 hours |
| `ENRICHMENT_STALE` | `errors.enrichment.stale` | 200 | Dados podem estar desatualizados. Considere atualizar. | Data may be outdated. Consider refreshing. |
| `ENRICHMENT_ALREADY_PROCESSING` | `errors.enrichment.alreadyProcessing` | 409 | Enriquecimento ja em andamento. Aguarde a conclusao. | Enrichment already in progress. Please wait for completion. |
| `ENRICHMENT_NOT_FOUND` | `errors.enrichment.notFound` | 404 | Dados de enriquecimento nao encontrados | Enrichment data not found |

### PROFILE — Litigation-Related Error Codes (Existing)

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `PROFILE_LITIGATION_UNAVAILABLE` | `errors.profile.litigationUnavailable` | 502 | Servico de verificacao judicial temporariamente indisponivel | Litigation verification service temporarily unavailable |
| `PROFILE_LITIGATION_CNPJ_NOT_FOUND` | `errors.profile.litigationCnpjNotFound` | 422 | CNPJ nao encontrado na base de dados judicial | CNPJ not found in litigation database |

### Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `COMPANY_ENRICHMENT_FETCHED` | CompanyEnrichment | SYSTEM | BigDataCorp enrichment data successfully retrieved (initial fetch) |
| `COMPANY_ENRICHMENT_REFRESHED` | CompanyEnrichment | SYSTEM | BigDataCorp enrichment data successfully retrieved (manual refresh) |
| `COMPANY_ENRICHMENT_FAILED` | CompanyEnrichment | SYSTEM | BigDataCorp enrichment fetch failed after all retries |
| `COMPANY_ENRICHMENT_TRIGGERED` | CompanyEnrichment | USER | Admin manually triggered enrichment refresh |
| `PROFILE_LITIGATION_FETCHED` | CompanyProfile | SYSTEM | BigDataCorp litigation data successfully retrieved |
| `PROFILE_LITIGATION_FAILED` | CompanyProfile | SYSTEM | BigDataCorp litigation fetch failed after all retries |

---

## Security Considerations

### SEC-1: Enrichment Data — Public Corporate Registry Information
- All enrichment data comes from public corporate registries (Receita Federal, RAIS/CAGED)
- No PII redaction is needed for enrichment data — company names, addresses, CNAE codes, and legal representative names are public information available from any CNPJ lookup service
- Enrichment data is NOT encrypted at application level (not high-sensitivity PII, follows same pattern as `cnpjData` on Company entity — DB-at-rest encryption only)
- The `rawData` JSONB field stores the complete BigDataCorp response for audit purposes but is not exposed via the API

### SEC-2: Litigation Data PII Handling (Existing)
- Individual plaintiff names (CPFs) from BigDataCorp are stored masked (`J*** S***`) — follows existing PII rules from `security.md`
- Company names (CNPJs) in lawsuit data are stored in full (public information)
- Litigation data is NOT encrypted at application level (not high-sensitivity PII, follows same pattern as `cnpjData` on Company entity — DB-at-rest encryption only)
- Lawsuit amounts and court case numbers are public information and stored in full
- The `litigationData` JSONB field never contains raw CPF numbers or personal addresses

### SEC-3: Access Control
- Enrichment trigger endpoint (`POST .../enrichment/trigger`) requires ADMIN role
- Enrichment read endpoints (`GET .../enrichment`, `GET .../enrichment/status`) require ADMIN, FINANCE, or LEGAL role
- Enrichment data is included in the public profile response (no authentication required) but only for PUBLISHED profiles
- Litigation data is included in the profile response for both authenticated and public views
- The `rawData` field is never included in API responses — it is for internal audit only

### SEC-4: Rate Limiting
- The enrichment trigger endpoint enforces a 24-hour cooldown per company to prevent abuse and excessive BigDataCorp API calls
- The rate limit is enforced server-side (not just UI-disabled) to prevent circumvention
- BigDataCorp API key usage is monitored via the circuit breaker pattern

---

## Success Criteria

### Company Data Enrichment
- BigDataCorp enrichment fetch completes within 60 seconds of profile creation (average)
- Enrichment data displayed on both internal and public profile views
- All enrichment fields (address, CNAE, representatives, capital social, employee count, RF status, branches) are populated when BigDataCorp returns data
- Manual re-enrichment rate limit enforced at 24 hours per company
- Stale data warning displayed when enrichment data is older than 90 days
- Bull job retries 3 times with exponential backoff on BigDataCorp failure
- Circuit breaker opens after 5 consecutive BigDataCorp failures, half-open after 60s
- Failed enrichment fetch does not block profile creation, editing, or publishing
- `COMPANY_ENRICHMENT_FETCHED`, `COMPANY_ENRICHMENT_REFRESHED`, `COMPANY_ENRICHMENT_FAILED`, and `COMPANY_ENRICHMENT_TRIGGERED` audit events are recorded
- Enrichment data source badge ("Fonte: BigDataCorp") displayed on all enrichment fields
- Enrichment data does not overwrite Company entity fields

### Litigation Verification (Existing)
- BigDataCorp litigation fetch completes within 60 seconds of profile creation (average)
- Litigation data displayed on both internal and public profile views
- `PUT /api/v1/companies/:companyId/profile` silently ignores litigation fields in request body
- Bull job retries 3 times with exponential backoff on BigDataCorp failure
- Circuit breaker opens after 5 consecutive BigDataCorp failures, half-open after 60s
- Failed litigation fetch does not block profile creation, editing, or publishing
- Individual plaintiff names are masked in stored litigation data
- `PROFILE_LITIGATION_FETCHED` and `PROFILE_LITIGATION_FAILED` audit events are recorded

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-profile.md](./company-profile.md) | Litigation fields are stored on CompanyProfile; enrichment data displayed in profile views; both checks triggered by profile creation |
| [company-management.md](./company-management.md) | CompanyEnrichment entity is linked to Company; enrichment data complements but does not overwrite Company fields |
| [company-cnpj-validation.md](./company-cnpj-validation.md) | Uses the already-validated CNPJ for BigDataCorp lookup |
| [company-litigation-verification.md](./company-litigation-verification.md) | **Superseded by this spec** — all litigation content is preserved here. The old file is kept for reference but this spec is the canonical source. |
| [error-handling.md](../.claude/rules/error-handling.md) | BigDataCorp retry/circuit breaker follows existing external service patterns |
| [security.md](../.claude/rules/security.md) | PII masking for individual plaintiff names follows existing rules |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Enrichment and litigation fetch success/failure events are audit-logged as SYSTEM events |
| [api-standards.md](../.claude/rules/api-standards.md) | Enrichment endpoints follow standard response envelope, pagination, and error format |
| [user-permissions.md](./user-permissions.md) | Role-based access control for enrichment endpoints (ADMIN for trigger, ADMIN/FINANCE/LEGAL for read) |
