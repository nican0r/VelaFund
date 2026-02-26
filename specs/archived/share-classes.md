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
- Support for voto multiplo (multiple voting) quotas

### FR-2: S.A. Support (Shares)
- Ações Ordinárias (common shares): Always have voting rights
- Ações Preferenciais (preferred shares): Can be non-voting or limited voting
- Tag-along rights (direito de tag-along)
- Maximum 2/3 of capital in preferred shares (Brazilian Corporation Law, Art. 15 §2)

### FR-3: Share Class Properties
- Name, type, votes per share
- Liquidation preference multiple
- Participating vs. non-participating
- Right of first refusal (direito de preferência)
- Redemption rights
- Conversion rights

---

## Data Model

```typescript
interface ShareClass {
  id: string;
  companyId: string;
  className: string;
  type: 'QUOTA' | 'COMMON_SHARES' | 'PREFERRED_SHARES';

  // Authorized and issued tracking
  totalAuthorized: string;        // Decimal as string — max shares authorized
  totalIssued: string;            // Decimal as string — currently issued shares

  // Voting
  votesPerShare: number;          // 0 for non-voting preferred

  // Liquidation
  liquidationPreferenceMultiple: number;  // 1.0, 1.5, 2.0, etc.
  participatingRights: boolean;           // True = participating preferred

  // Transfer Restrictions
  rightOfFirstRefusal: boolean;
  lockUpPeriodMonths: number | null;

  // Brazilian Specific
  tagAlongPercentage: number | null;  // 80%, 100% for tag-along rights

  // Blockchain
  blockchainTokenId: string | null;

  // OCT Compliance
  octData: object;

  createdAt: Date;
  updatedAt: Date;
}
```

### Prisma Schema

```prisma
model ShareClass {
  id                           String   @id @default(uuid())
  companyId                    String   @map("company_id")
  className                    String   @map("class_name")
  type                         ShareClassType
  totalAuthorized              Decimal  @default(0) @map("total_authorized")
  totalIssued                  Decimal  @default(0) @map("total_issued")
  votesPerShare                Int      @default(1) @map("votes_per_share")
  liquidationPreferenceMultiple Decimal @default(1.0) @map("liquidation_preference_multiple")
  participatingRights          Boolean  @default(false) @map("participating_rights")
  rightOfFirstRefusal          Boolean  @default(true) @map("right_of_first_refusal")
  lockUpPeriodMonths           Int?     @map("lock_up_period_months")
  tagAlongPercentage           Decimal? @map("tag_along_percentage")
  blockchainTokenId            String?  @map("blockchain_token_id")
  octData                      Json?    @map("oct_data")
  createdAt                    DateTime @default(now()) @map("created_at")
  updatedAt                    DateTime @updatedAt @map("updated_at")

  company      Company       @relation(fields: [companyId], references: [id])
  shareholdings Shareholding[]

  @@unique([companyId, className])
  @@index([companyId])
  @@map("share_classes")
}

enum ShareClassType {
  QUOTA
  COMMON_SHARES
  PREFERRED_SHARES
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/share-classes

Create a new share class.

**Request Body:**

```json
{
  "className": "Ações Preferenciais Classe A",
  "type": "PREFERRED_SHARES",
  "totalAuthorized": "100000",
  "votesPerShare": 0,
  "liquidationPreferenceMultiple": "1.5",
  "participatingRights": true,
  "rightOfFirstRefusal": true,
  "lockUpPeriodMonths": 12,
  "tagAlongPercentage": "100"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "companyId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "className": "Ações Preferenciais Classe A",
    "type": "PREFERRED_SHARES",
    "totalAuthorized": "100000",
    "totalIssued": "0",
    "votesPerShare": 0,
    "liquidationPreferenceMultiple": "1.5",
    "participatingRights": true,
    "rightOfFirstRefusal": true,
    "lockUpPeriodMonths": 12,
    "tagAlongPercentage": "100",
    "blockchainTokenId": null,
    "createdAt": "2026-02-23T14:30:00.000Z",
    "updatedAt": "2026-02-23T14:30:00.000Z"
  }
}
```

All responses use the standard `{ "success": true, "data": {...} }` envelope per api-standards.md.

### GET /api/v1/companies/:companyId/share-classes

List all share classes for a company with pagination.

**Query Parameters:** `page`, `limit`, `sort`, `type` (filter by ShareClassType)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "className": "Ações Ordinárias",
      "type": "COMMON_SHARES",
      "totalAuthorized": "500000",
      "totalIssued": "250000",
      "votesPerShare": 1,
      "liquidationPreferenceMultiple": "1.0",
      "participatingRights": false,
      "rightOfFirstRefusal": true,
      "lockUpPeriodMonths": null,
      "tagAlongPercentage": "100",
      "blockchainTokenId": "0x1a2b...3c4d",
      "createdAt": "2026-01-10T09:00:00.000Z",
      "updatedAt": "2026-01-10T09:00:00.000Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### GET /api/v1/companies/:companyId/share-classes/:id

Get a single share class by ID. Response uses the same `{ "success": true, "data": {...} }` envelope as the create endpoint, with all fields including `octData`.

### PUT /api/v1/companies/:companyId/share-classes/:id

Update a share class. Only mutable fields may be changed (see BR-4).

**Request Body:**

```json
{
  "totalAuthorized": "750000",
  "lockUpPeriodMonths": 6,
  "tagAlongPercentage": "80"
}
```

**Response (200 OK):** Standard `{ "success": true, "data": {...} }` envelope with all share class fields. The `updatedAt` field reflects the modification timestamp.

### DELETE /api/v1/companies/:companyId/share-classes/:id

Delete a share class. Only allowed if no shares have been issued (totalIssued = 0).

**Response (204 No Content):** Empty body.

---

## Business Rules

### BR-1: Ltda. Default
- Ltda. companies start with one "Quotas Ordinárias" class
- All quotas have equal rights by default

### BR-2: S.A. Common Shares Required
- S.A. companies MUST have at least one common share class
- Common shares MUST have voting rights (votesPerShare >= 1)

### BR-3: Preferred Share Limit
- Preferred shares cannot exceed 2/3 of total authorized capital (Brazilian Corporation Law, Art. 15 §2)
- System warns if approaching the limit at 60%

### BR-4: Share Class Immutability After Issuance
- Cannot change `className`, `type`, `votesPerShare`, or `liquidationPreferenceMultiple` after shares are issued (totalIssued > 0)
- Can always update: `totalAuthorized` (increase only), `lockUpPeriodMonths`, `tagAlongPercentage`, `rightOfFirstRefusal`
- Cannot reduce `totalAuthorized` below `totalIssued`

---

## Edge Cases

### EC-1: Preferred Share Limit Enforcement
S.A. companies are limited to 2/3 preferred shares by Brazilian Corporation Law (Art. 15 §2). The system must validate this limit when creating a new preferred share class or issuing shares into an existing one. If a create or issuance would breach the limit, return `422` with a business rule error.

### EC-2: Delete Share Class With Existing Holdings
If a user attempts to delete a share class that has `totalIssued > 0` or active shareholdings, the system must reject the request with `CAP_SHARE_CLASS_IN_USE`. All shares must be transferred or cancelled before the class can be removed.

### EC-3: Immutable Fields After Issuance
Once shares have been issued into a class (`totalIssued > 0`), certain fields become immutable: `className`, `type`, `votesPerShare`, `liquidationPreferenceMultiple`, and `participatingRights`. Attempts to modify these fields must return `422` with a descriptive error indicating which fields are locked.

### EC-4: Share Class With Zero Authorized Shares
Creating a share class with `totalAuthorized = 0` is allowed (placeholder class). However, no shares can be issued into it until `totalAuthorized` is increased via an update. Issuance attempts against a zero-authorized class return `CAP_INSUFFICIENT_SHARES`.

### EC-5: Duplicate Class Name Within Same Company
The `className` must be unique within a company (enforced by the `@@unique([companyId, className])` constraint). Attempts to create a duplicate return `409 Conflict` with error code `COMPANY_SHARE_CLASS_DUPLICATE`.

---

## Frontend Implementation

### Routes

| Route | Page | Access |
|-------|------|--------|
| `/companies/[companyId]/share-classes` | Share class list | ADMIN, FINANCE, LEGAL, INVESTOR |
| `/companies/[companyId]/share-classes/new` | Create share class form | ADMIN |
| `/companies/[companyId]/share-classes/[id]` | Share class detail | ADMIN, FINANCE, LEGAL, INVESTOR |
| `/companies/[companyId]/share-classes/[id]/edit` | Edit share class form | ADMIN |

All routes are nested under `app/(dashboard)/companies/[companyId]/share-classes/`.

### List Page

```
┌─────────────────────────────────────────────────────────────────┐
│  h1: Classes de Ações              [+ Nova Classe] (ADMIN only) │
│  body-sm: Gerencie as classes de ações da empresa               │
├─────────────────────────────────────────────────────────────────┤
│  Filters: [Type ▼] [Search...]                    [Sort ▼]     │
├─────────────────────────────────────────────────────────────────┤
│  Nome         │ Tipo        │ Autorizadas │ Emitidas  │ Ações  │
│───────────────┼─────────────┼─────────────┼───────────┼────────│
│  Quotas Ord.  │ QUOTA       │ 500.000     │ 250.000   │ ⋯     │
│  Ações ON     │ COMMON      │ 300.000     │ 100.000   │ ⋯     │
│  Ações PN-A   │ PREFERRED   │ 200.000     │ 0         │ ⋯     │
├─────────────────────────────────────────────────────────────────┤
│  Mostrando 1-3 de 3                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Table Columns:**

| Column | Field | Format | Alignment |
|--------|-------|--------|-----------|
| Nome | `className` | Text, link to detail page | Left |
| Tipo | `type` | Badge (see below) | Left |
| Votos/Ação | `votesPerShare` | Integer | Right |
| Autorizadas | `totalAuthorized` | `Intl.NumberFormat('pt-BR')` | Right |
| Emitidas | `totalIssued` | `Intl.NumberFormat('pt-BR')` | Right |
| % Emitido | `totalIssued / totalAuthorized * 100` | `XX,X%` | Right |
| Lock-up | `lockUpPeriodMonths` | `X meses` or `—` | Right |
| Ações | Action menu (View, Edit, Delete) | Icon buttons | Right |

**Type Badge Colors:**

| Type | Label (PT-BR) | Background | Text |
|------|---------------|------------|------|
| `QUOTA` | Quota | `blue-50` | `blue-600` |
| `COMMON_SHARES` | Ordinária | `green-100` | `green-700` |
| `PREFERRED_SHARES` | Preferencial | `cream-100` | `cream-700` |

**Empty State:** Centered illustration + "Nenhuma classe de ações cadastrada" + "Crie a primeira classe de ações para começar a emitir participações." + Primary CTA button "Criar Classe de Ações".

### Create Form Page

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Voltar    h2: Nova Classe de Ações                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tipo de Classe *                                               │
│  ┌──────────┐ ┌───────────────┐ ┌──────────────────┐          │
│  │  Quota   │ │ Ação Ordinária│ │ Ação Preferencial │          │
│  └──────────┘ └───────────────┘ └──────────────────┘          │
│  (Card selection — one active with blue-600 border)            │
│                                                                 │
│  Nome da Classe *         [________________________]            │
│  Total Autorizado *       [________________________]            │
│                                                                 │
│  ── Direitos de Voto ──────────────────────────────            │
│  Votos por Ação *         [___1___]                            │
│  (disabled if type=PREFERRED_SHARES, value forced to 0)        │
│                                                                 │
│  ── Preferências de Liquidação ────────────────────            │
│  (visible only if type=PREFERRED_SHARES)                       │
│  Múltiplo de Preferência  [___1.0___]                          │
│  Participação nos Lucros  [ ] (checkbox)                       │
│                                                                 │
│  ── Restrições de Transferência ───────────────────            │
│  Direito de Preferência   [x] (checkbox, default checked)      │
│  Período de Lock-up       [______] meses (optional)            │
│  Tag-along                [______] % (optional)                │
│                                                                 │
│  ┌────────────┐  ┌─────────────────┐                          │
│  │  Cancelar  │  │  Criar Classe   │                          │
│  └────────────┘  └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

**Conditional Form Logic:**

| Condition | Effect |
|-----------|--------|
| Company type is `LTDA` | Only `QUOTA` type available; hide type selector |
| Company type is `SA` | Show `COMMON_SHARES` and `PREFERRED_SHARES` options |
| Type = `PREFERRED_SHARES` | Show liquidation preference fields; `votesPerShare` defaults to 0 |
| Type = `COMMON_SHARES` | Hide liquidation preference; `votesPerShare` min = 1 |
| Type = `QUOTA` | Hide liquidation preference; `votesPerShare` defaults to 1 |

### Detail Page

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Voltar    h2: Ações Preferenciais Classe A                  │
│              Badge: PREFERRED_SHARES                [Editar]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Autorizadas  │ │ Emitidas     │ │ Disponíveis  │           │
│  │ 100.000      │ │ 75.000       │ │ 25.000       │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│  ── Detalhes ──────────────────────────────────────            │
│  Tipo:                Ação Preferencial                        │
│  Votos por Ação:      0 (Sem voto)                             │
│  Pref. Liquidação:    1,5x                                     │
│  Participação:        Sim                                      │
│  Dir. Preferência:    Sim                                      │
│  Lock-up:             12 meses                                 │
│  Tag-along:           100%                                     │
│                                                                 │
│  ── Blockchain ────────────────────────────────────            │
│  Token ID:            0x1a2b...3c4d (link to explorer)         │
│  (or "Não implantado" if blockchainTokenId is null)            │
│                                                                 │
│  ── Acionistas com esta Classe ────────────────────            │
│  (Table of shareholders holding this share class,              │
│   linked from cap table data. Read-only.)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Edit Page (Preference Editor)

Only mutable fields are editable. Immutable fields are shown as read-only with a lock icon and tooltip explaining why they are locked.

**Mutable fields** (always editable): `totalAuthorized`, `lockUpPeriodMonths`, `tagAlongPercentage`, `rightOfFirstRefusal`.

**Immutable fields after issuance** (`totalIssued > 0`): `className`, `type`, `votesPerShare`, `liquidationPreferenceMultiple`, `participatingRights`. These are rendered as disabled inputs with a lock icon and tooltip: "Este campo não pode ser alterado após a emissão de ações."

**Validation on `totalAuthorized`**: Cannot be reduced below `totalIssued`. Show error: "Total autorizado não pode ser menor que o total emitido ({totalIssued})."

### Form Validation (Zod Schema)

```typescript
import { z } from 'zod';

export const createShareClassSchema = z.object({
  className: z.string().min(1).max(100),
  type: z.enum(['QUOTA', 'COMMON_SHARES', 'PREFERRED_SHARES']),
  totalAuthorized: z.string().regex(/^\d+(\.\d+)?$/).refine(v => parseFloat(v) >= 0),
  votesPerShare: z.number().int().min(0).max(100),
  liquidationPreferenceMultiple: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  participatingRights: z.boolean().optional(),
  rightOfFirstRefusal: z.boolean(),
  lockUpPeriodMonths: z.number().int().min(0).max(120).nullable().optional(),
  tagAlongPercentage: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),
});

export const updateShareClassSchema = z.object({
  totalAuthorized: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  lockUpPeriodMonths: z.number().int().min(0).max(120).nullable().optional(),
  tagAlongPercentage: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),
  rightOfFirstRefusal: z.boolean().optional(),
});
```

### TanStack Query Hooks

```typescript
// hooks/use-share-classes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useShareClasses(companyId: string, params?: {
  page?: number; limit?: number; type?: string; sort?: string;
}) {
  return useQuery({
    queryKey: ['share-classes', companyId, params],
    queryFn: () => api.getList<ShareClass>(
      `/api/v1/companies/${companyId}/share-classes`,
      params,
    ),
  });
}

export function useShareClass(companyId: string, id: string) {
  return useQuery({
    queryKey: ['share-classes', companyId, id],
    queryFn: () => api.get<ShareClass>(
      `/api/v1/companies/${companyId}/share-classes/${id}`,
    ),
    enabled: !!id,
  });
}

export function useCreateShareClass(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateShareClassInput) =>
      api.post<ShareClass>(
        `/api/v1/companies/${companyId}/share-classes`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-classes', companyId] });
    },
  });
}

export function useUpdateShareClass(companyId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateShareClassInput) =>
      api.put<ShareClass>(
        `/api/v1/companies/${companyId}/share-classes/${id}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-classes', companyId] });
    },
  });
}

export function useDeleteShareClass(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/companies/${companyId}/share-classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-classes', companyId] });
    },
  });
}
```

### Component Hierarchy

```
share-classes/
├── page.tsx                          # List page
│   ├── ShareClassFilters             # Type filter dropdown + search
│   ├── ShareClassTable               # Data table with columns above
│   │   ├── ShareClassTypeBadge       # Color-coded type badge
│   │   └── ShareClassRowActions      # View/Edit/Delete dropdown
│   ├── Pagination                    # Shared pagination component
│   └── EmptyState                    # When no share classes exist
├── new/
│   └── page.tsx                      # Create form
│       └── ShareClassForm            # Reusable form component
│           ├── TypeSelector          # Card-based type selection
│           ├── VotingRightsSection   # Conditional voting fields
│           ├── LiquidationSection    # Conditional pref fields
│           └── TransferRestrictions  # Lock-up, tag-along, ROFR
├── [id]/
│   ├── page.tsx                      # Detail page
│   │   ├── ShareClassStatCards       # Authorized/Issued/Available
│   │   ├── ShareClassDetails         # Key-value details section
│   │   ├── BlockchainStatus          # Token ID or "not deployed"
│   │   └── ShareClassHolders         # Table of shareholders
│   └── edit/
│       └── page.tsx                  # Edit page (preference editor)
│           └── ShareClassForm        # Reused form, mutable fields only
```

### i18n Keys

Add to `messages/pt-BR.json`:

```json
{
  "shareClasses": {
    "title": "Classes de Ações",
    "description": "Gerencie as classes de ações da empresa",
    "create": "Nova Classe de Ações",
    "edit": "Editar Classe",
    "delete": "Excluir Classe",
    "table": {
      "name": "Nome",
      "type": "Tipo",
      "votesPerShare": "Votos/Ação",
      "totalAuthorized": "Autorizadas",
      "totalIssued": "Emitidas",
      "percentIssued": "% Emitido",
      "lockUp": "Lock-up",
      "actions": "Ações",
      "empty": "Nenhuma classe de ações cadastrada",
      "emptyDescription": "Crie a primeira classe de ações para começar a emitir participações."
    },
    "form": {
      "type": "Tipo de Classe",
      "className": "Nome da Classe",
      "totalAuthorized": "Total Autorizado",
      "votesPerShare": "Votos por Ação",
      "liquidationPreference": "Múltiplo de Preferência de Liquidação",
      "participatingRights": "Participação nos Lucros",
      "rightOfFirstRefusal": "Direito de Preferência",
      "lockUpPeriodMonths": "Período de Lock-up (meses)",
      "tagAlongPercentage": "Tag-along (%)",
      "submit": "Criar Classe",
      "update": "Salvar Alterações",
      "cancel": "Cancelar"
    },
    "type": {
      "QUOTA": "Quota",
      "COMMON_SHARES": "Ação Ordinária",
      "PREFERRED_SHARES": "Ação Preferencial"
    },
    "detail": {
      "authorized": "Autorizadas",
      "issued": "Emitidas",
      "available": "Disponíveis",
      "details": "Detalhes",
      "voting": "Sem voto",
      "blockchain": "Blockchain",
      "tokenId": "Token ID",
      "notDeployed": "Não implantado",
      "holders": "Acionistas com esta Classe",
      "lockedField": "Este campo não pode ser alterado após a emissão de ações."
    },
    "success": {
      "created": "Classe de ações criada com sucesso",
      "updated": "Classe de ações atualizada com sucesso",
      "deleted": "Classe de ações excluída com sucesso"
    },
    "confirm": {
      "delete": "Tem certeza que deseja excluir esta classe de ações?",
      "deleteDescription": "Esta ação não pode ser desfeita. Somente classes sem ações emitidas podem ser excluídas."
    }
  }
}
```

Add equivalent English keys to `messages/en.json`:

```json
{
  "shareClasses": {
    "title": "Share Classes",
    "description": "Manage company share classes",
    "create": "New Share Class",
    "edit": "Edit Class",
    "delete": "Delete Class",
    "table": {
      "name": "Name",
      "type": "Type",
      "votesPerShare": "Votes/Share",
      "totalAuthorized": "Authorized",
      "totalIssued": "Issued",
      "percentIssued": "% Issued",
      "lockUp": "Lock-up",
      "actions": "Actions",
      "empty": "No share classes registered",
      "emptyDescription": "Create the first share class to start issuing equity."
    },
    "form": {
      "type": "Class Type",
      "className": "Class Name",
      "totalAuthorized": "Total Authorized",
      "votesPerShare": "Votes per Share",
      "liquidationPreference": "Liquidation Preference Multiple",
      "participatingRights": "Participating Rights",
      "rightOfFirstRefusal": "Right of First Refusal",
      "lockUpPeriodMonths": "Lock-up Period (months)",
      "tagAlongPercentage": "Tag-along (%)",
      "submit": "Create Class",
      "update": "Save Changes",
      "cancel": "Cancel"
    },
    "type": {
      "QUOTA": "Quota",
      "COMMON_SHARES": "Common Shares",
      "PREFERRED_SHARES": "Preferred Shares"
    },
    "detail": {
      "authorized": "Authorized",
      "issued": "Issued",
      "available": "Available",
      "details": "Details",
      "voting": "Non-voting",
      "blockchain": "Blockchain",
      "tokenId": "Token ID",
      "notDeployed": "Not deployed",
      "holders": "Shareholders in this Class",
      "lockedField": "This field cannot be changed after shares have been issued."
    },
    "success": {
      "created": "Share class created successfully",
      "updated": "Share class updated successfully",
      "deleted": "Share class deleted successfully"
    },
    "confirm": {
      "delete": "Are you sure you want to delete this share class?",
      "deleteDescription": "This action cannot be undone. Only classes with no issued shares can be deleted."
    }
  }
}
```

---

## Error Codes

Error codes for share class operations, per the platform error handling specification.

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `CAP_SHARE_CLASS_NOT_FOUND` | 404 | `errors.cap.shareClassNotFound` | Share class does not exist in this company |
| `CAP_SHARE_CLASS_IN_USE` | 422 | `errors.cap.shareClassInUse` | Cannot delete share class with existing holdings |
| `CAP_INSUFFICIENT_SHARES` | 422 | `errors.cap.insufficientShares` | Issuance exceeds totalAuthorized for the class |
| `COMPANY_SHARE_CLASS_DUPLICATE` | 409 | `errors.company.shareClassDuplicate` | Class name already exists in this company |
| `VAL_INVALID_INPUT` | 400 | `errors.val.invalidInput` | Request body fails validation |

---

## Security Considerations

### Role-Based Access

| Action | Allowed Roles |
|--------|--------------|
| List share classes | ADMIN, FINANCE, LEGAL, INVESTOR (read-only) |
| View share class detail | ADMIN, FINANCE, LEGAL, INVESTOR (read-only) |
| Create share class | ADMIN |
| Update share class | ADMIN |
| Delete share class | ADMIN |

- All endpoints are company-scoped. The authenticated user must be an active member of the company.
- Non-members receive `404 Not Found` (not `403`) to prevent company enumeration.
- All create, update, and delete operations are audit-logged via the `@Auditable()` decorator.

---

## Technical Implementation

### ShareClassService Skeleton

```typescript
@Injectable()
export class ShareClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(companyId: string, dto: CreateShareClassDto): Promise<ShareClass> {
    // 1. Validate company exists and is ACTIVE
    // 2. Check for duplicate className within company
    // 3. Validate preferred share limit for S.A. companies (BR-3)
    // 4. Create share class with totalIssued = 0
    // 5. Return created entity
  }

  async findAll(companyId: string, query: ListShareClassesDto): Promise<PaginatedResult<ShareClass>> {
    // 1. Query with companyId filter
    // 2. Apply optional type filter
    // 3. Apply sort (default: -createdAt)
    // 4. Return paginated result
  }

  async findOne(companyId: string, id: string): Promise<ShareClass> {
    // 1. Find by id AND companyId
    // 2. Throw CAP_SHARE_CLASS_NOT_FOUND if missing
  }

  async update(companyId: string, id: string, dto: UpdateShareClassDto): Promise<ShareClass> {
    // 1. Find existing share class
    // 2. If totalIssued > 0, reject changes to immutable fields (BR-4)
    // 3. Validate totalAuthorized >= totalIssued
    // 4. Update and return
  }

  async remove(companyId: string, id: string): Promise<void> {
    // 1. Find existing share class
    // 2. If totalIssued > 0, throw CAP_SHARE_CLASS_IN_USE
    // 3. Check no active shareholdings reference this class
    // 4. Delete
  }
}
```

---

## Dependencies

### Internal Specifications
- **company-management.md** — Company entity type (Ltda. vs S.A.) determines allowed share class types
- **cap-table-management.md** — Cap table reads share classes to compute ownership breakdown
- **transactions.md** — Share issuance, transfer, and cancellation transactions reference a share class
- **audit-logging.md** — All mutations are audit-logged as `SHAREHOLDER_*` or custom share class events

### External Dependencies
- **PostgreSQL** — Unique constraint enforcement, decimal precision for share counts
- **Base Network (blockchain)** — `blockchainTokenId` links the class to an on-chain token after contract deployment

---

## Success Criteria

- Support both Ltda. and S.A. structures
- Enforce Brazilian corporate law limits (2/3 preferred share cap)
- Immutable fields locked after first issuance
- All CRUD endpoints return standard response envelope
- Pagination, filtering, and sorting on list endpoint
- 100% OCT compliance for share classes
- Audit trail for all share class mutations

---

## Related Specifications

- [Company Management](./company-management.md)
- [Cap Table Management](./cap-table-management.md)
- [Transactions](./transactions.md)
- [Audit Logging](../.claude/rules/audit-logging.md)
- [API Standards](../.claude/rules/api-standards.md)
- [Error Handling](../.claude/rules/error-handling.md)
