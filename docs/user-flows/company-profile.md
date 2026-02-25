# Company Profile -- User Flows

**Feature**: Create, manage, publish, and share a public-facing company profile page with customizable metrics, team members, and access controls (public, password-protected, or email-gated)
**Actors**: ADMIN (full lifecycle + publish/unpublish/archive + analytics), FINANCE (update profile/metrics/team + analytics), all company members (read), public visitors (view via slug)
**Preconditions**: User is authenticated and a member of an ACTIVE company. For public profile access, no authentication is required.
**Related Flows**:
- **Depends on**: [Authentication](./authentication.md) -- user must be logged in for management endpoints
- **Depends on**: [Company Management](./company-management.md) -- company must exist and be ACTIVE
- **Feeds into**: Dataroom -- published profile serves as entry point for investor due diligence
- **Triggers**: Audit log events (PROFILE_CREATED, PROFILE_UPDATED, PROFILE_PUBLISHED, PROFILE_UNPUBLISHED, PROFILE_ARCHIVED)

---

## Flow Map

```
ADMIN navigates to Company Profile page
  |
  +-- Create Profile: POST /api/v1/companies/:companyId/profile
  |     |
  |     +-- [ADMIN + company ACTIVE + no existing profile] --> Profile created (DRAFT)
  |     |     |
  |     |     +-- slug auto-generated from company name (kebab-case)
  |     |
  |     +-- [company not ACTIVE] --> 422 PROFILE_COMPANY_NOT_ACTIVE
  |     +-- [profile already exists] --> 409 PROFILE_ALREADY_EXISTS
  |     +-- [not ADMIN] --> 404 (role guard)
  |
  +-- View Profile (internal): GET /api/v1/companies/:companyId/profile
  |     |
  |     +-- [any company member] --> profile data returned
  |     +-- [not member] --> 404
  |
  +-- Update Profile: PUT /api/v1/companies/:companyId/profile
  |     |
  |     +-- [ADMIN/FINANCE + valid data] --> Profile updated
  |     +-- [profile not found] --> 404
  |     +-- [not ADMIN/FINANCE] --> 404 (role guard)
  |
  +-- Update Slug: PUT /api/v1/companies/:companyId/profile/slug
  |     |
  |     +-- [ADMIN + unique slug] --> Slug updated
  |     +-- [slug already taken] --> 409 PROFILE_SLUG_DUPLICATE
  |     +-- [invalid slug format] --> 400 VAL_INVALID_INPUT
  |     +-- [not ADMIN] --> 404 (role guard)
  |
  +-- Replace Metrics: PUT /api/v1/companies/:companyId/profile/metrics
  |     |
  |     +-- [ADMIN/FINANCE + max 6 metrics] --> Metrics replaced
  |     +-- [> 6 metrics] --> 422 PROFILE_MAX_METRICS_EXCEEDED
  |     +-- [not ADMIN/FINANCE] --> 404 (role guard)
  |
  +-- Replace Team: PUT /api/v1/companies/:companyId/profile/team
  |     |
  |     +-- [ADMIN/FINANCE + max 10 members] --> Team replaced
  |     +-- [> 10 members] --> 422 PROFILE_MAX_TEAM_EXCEEDED
  |     +-- [not ADMIN/FINANCE] --> 404 (role guard)
  |
  +-- Upload Team Photo: POST /api/v1/companies/:companyId/profile/team/photo
  |     |
  |     +-- [ADMIN/FINANCE + JPEG/PNG/WebP + <= 2MB] --> photo URL returned
  |     +-- [invalid file type] --> 422 PROFILE_INVALID_PHOTO_TYPE
  |     +-- [file > 2MB] --> 422 (MaxFileSizeValidator)
  |     +-- [not ADMIN/FINANCE] --> 404 (role guard)
  |
  +-- Publish Profile: POST /api/v1/companies/:companyId/profile/publish
  |     |
  |     +-- [ADMIN + DRAFT + BR-10 met] --> Profile status --> PUBLISHED
  |     +-- [ADMIN + DRAFT + BR-10 not met] --> 422 PROFILE_INCOMPLETE { missingFields }
  |     +-- [not DRAFT] --> 422 PROFILE_INVALID_STATUS_TRANSITION
  |     +-- [not ADMIN] --> 404 (role guard)
  |
  +-- Unpublish Profile: POST /api/v1/companies/:companyId/profile/unpublish
  |     |
  |     +-- [ADMIN + PUBLISHED] --> Profile status --> DRAFT
  |     +-- [not PUBLISHED] --> 422 PROFILE_INVALID_STATUS_TRANSITION
  |     +-- [not ADMIN] --> 404 (role guard)
  |
  +-- Archive Profile: POST /api/v1/companies/:companyId/profile/archive
  |     |
  |     +-- [ADMIN + DRAFT or PUBLISHED] --> Profile status --> ARCHIVED
  |     +-- [already ARCHIVED] --> 422 PROFILE_INVALID_STATUS_TRANSITION
  |     +-- [not ADMIN] --> 404 (role guard)
  |
  +-- View Analytics: GET /api/v1/companies/:companyId/profile/analytics
  |     |
  |     +-- [ADMIN/FINANCE + period param (7d/30d/90d)] --> analytics data
  |     +-- [not ADMIN/FINANCE] --> 404 (role guard)
  |
  +-- View Public Profile: GET /api/v1/profiles/:slug (@Public)
        |
        +-- [slug not found] --> 404
        +-- [profile not PUBLISHED] --> 404
        |
        +-- [accessType = PUBLIC] --> profile data returned (no auth needed)
        |
        +-- [accessType = PASSWORD]
        |     |
        |     +-- [no password query param] --> 401 PROFILE_PASSWORD_REQUIRED
        |     +-- [wrong password (bcrypt mismatch)] --> 401 PROFILE_INVALID_PASSWORD
        |     +-- [correct password] --> profile data returned
        |
        +-- [accessType = EMAIL_GATED]
              |
              +-- [no email query param] --> 422 PROFILE_EMAIL_REQUIRED
              +-- [invalid email format] --> 400 VAL_INVALID_INPUT
              +-- [valid email] --> profile data returned, email logged for analytics
```

---

## Flows

### Happy Path: Create Profile

```
PRECONDITION: User is ADMIN of an ACTIVE company. No profile exists for this company.
ACTOR: ADMIN member
TRIGGER: User navigates to profile settings or clicks "Create Profile"

1. [UI] User navigates to /companies/:companyId/profile/settings
2. [UI] Page shows "No profile yet" empty state with "Create Profile" CTA
3. [UI] User clicks "Create Profile"
4. [Frontend] Sends POST /api/v1/companies/:companyId/profile
5. [Backend] AuthGuard verifies session/token
   -> IF unauthenticated: return 401
6. [Backend] RolesGuard checks user is ADMIN
   -> IF not ADMIN: return 404
7. [Backend] Validates company is ACTIVE
   -> IF not ACTIVE: return 422 PROFILE_COMPANY_NOT_ACTIVE
8. [Backend] Checks no existing profile for this company
   -> IF exists: return 409 PROFILE_ALREADY_EXISTS
9. [Backend] Auto-generates slug from company name (kebab-case, deduplication with suffix if needed)
10. [Backend] Creates CompanyProfile record (status: DRAFT, accessType: PUBLIC)
11. [Backend] Returns 201 with profile data including generated slug
12. [UI] Success toast: "Perfil criado com sucesso"
13. [UI] Redirects to profile editor page with DRAFT badge

POSTCONDITION: CompanyProfile exists with status DRAFT, slug assigned
SIDE EFFECTS: Audit log (PROFILE_CREATED)
```

### Happy Path: Update Profile

```
PRECONDITION: Profile exists. User is ADMIN or FINANCE.
ACTOR: ADMIN or FINANCE member
TRIGGER: User edits profile fields and saves

1. [UI] User navigates to /companies/:companyId/profile/edit
2. [Frontend] Sends GET /api/v1/companies/:companyId/profile
3. [UI] Profile editor renders with current data:
   - Headline (text, max 200 chars)
   - Description / pitch (rich text or textarea, max 5000 chars)
   - Industry / sector
   - Stage (Pre-Seed, Seed, Series A, etc.)
   - Founded date
   - Website URL
   - Social links
   - Access type selector (PUBLIC / PASSWORD / EMAIL_GATED)
   - Password field (visible only when accessType = PASSWORD)
4. [UI] User modifies fields
5. [UI] User clicks "Save"
6. [Frontend] Validates fields client-side
   -> IF invalid: show field-level errors, STOP
7. [Frontend] Sends PUT /api/v1/companies/:companyId/profile { ...updatedFields }
8. [Backend] AuthGuard + RolesGuard validate (ADMIN or FINANCE)
   -> IF not authorized: return 404
9. [Backend] Validates request body
   -> IF invalid: return 400 VAL_INVALID_INPUT
10. [Backend] Updates profile fields
    -> IF accessType changed to PASSWORD: hashes password with bcrypt
11. [Backend] Returns 200 with updated profile
12. [UI] Success toast: "Perfil atualizado com sucesso"

POSTCONDITION: Profile data updated
SIDE EFFECTS: Audit log (PROFILE_UPDATED)
```

### Happy Path: Replace Metrics

```
PRECONDITION: Profile exists. User is ADMIN or FINANCE.
ACTOR: ADMIN or FINANCE member
TRIGGER: User edits the key metrics section

1. [UI] User navigates to metrics editor tab/section
2. [UI] Current metrics displayed (up to 6 cards)
3. [UI] User adds/edits/removes metrics. Each metric has:
   - Label (e.g., "Revenue", "MRR", "Users")
   - Value (e.g., "R$ 500K", "12,000")
   - Optional icon or category
4. [UI] User clicks "Save Metrics"
5. [Frontend] Validates: max 6 metrics, each has label and value
   -> IF > 6: show error, STOP
6. [Frontend] Sends PUT /api/v1/companies/:companyId/profile/metrics { metrics: [...] }
7. [Backend] Validates ADMIN or FINANCE role
   -> IF not authorized: return 404
8. [Backend] Validates max 6 metrics
   -> IF > 6: return 422 PROFILE_MAX_METRICS_EXCEEDED
9. [Backend] Replaces all metrics atomically
10. [Backend] Returns 200 with updated metrics
11. [UI] Success toast: "Metricas atualizadas"

POSTCONDITION: Profile metrics replaced with new set (max 6)
SIDE EFFECTS: Audit log (PROFILE_UPDATED)
```

### Happy Path: Replace Team Members

```
PRECONDITION: Profile exists. User is ADMIN or FINANCE.
ACTOR: ADMIN or FINANCE member
TRIGGER: User edits the team section

1. [UI] User navigates to team editor tab/section
2. [UI] Current team members displayed (up to 10 cards with photos)
3. [UI] User adds/edits/removes team members. Each member has:
   - Name (required)
   - Role/title (required)
   - Photo URL (optional)
   - LinkedIn URL (optional)
4. [UI] User clicks "Save Team"
5. [Frontend] Validates: max 10 members, each has name and role
   -> IF > 10: show error, STOP
6. [Frontend] Sends PUT /api/v1/companies/:companyId/profile/team { members: [...] }
7. [Backend] Validates ADMIN or FINANCE role
   -> IF not authorized: return 404
8. [Backend] Validates max 10 members
   -> IF > 10: return 422 PROFILE_MAX_TEAM_EXCEEDED
9. [Backend] Replaces all team members atomically
10. [Backend] Returns 200 with updated team
11. [UI] Success toast: "Equipe atualizada"

POSTCONDITION: Profile team members replaced with new set (max 10)
SIDE EFFECTS: Audit log (PROFILE_UPDATED)
```

### Happy Path: Upload Team Photo

```
PRECONDITION: Profile exists. User is ADMIN or FINANCE.
ACTOR: ADMIN or FINANCE member
TRIGGER: User uploads a photo for a team member

1. [UI] User clicks photo upload button on a team member card
2. [UI] File picker opens (accepts JPEG, PNG, WebP)
3. [Frontend] Validates file size client-side (max 2MB)
   -> IF too large: show error, STOP
4. [Frontend] Sends POST /api/v1/companies/:companyId/profile/team/photo (multipart: file)
5. [Backend] Validates ADMIN or FINANCE role
   -> IF not authorized: return 404
6. [Backend] ParseFilePipe validates file size (MaxFileSizeValidator 2MB)
   -> IF too large: return 422
7. [Backend] Validates file type via magic bytes (JPEG, PNG, WebP)
   -> IF invalid type: return 422 PROFILE_INVALID_PHOTO_TYPE
8. [Backend] Strips EXIF metadata (if applicable)
9. [Backend] Uploads to S3 (profiles/{companyId}/team/{uuid}.{ext})
10. [Backend] Returns 200 with { photoUrl }
11. [UI] Photo preview updates with uploaded image

POSTCONDITION: Team photo stored in S3, URL available for team member assignment
SIDE EFFECTS: None (photo is associated to team member on next team save)
```

### Happy Path: Publish Profile (BR-10)

```
PRECONDITION: Profile exists in DRAFT status. User is ADMIN. Profile meets BR-10 completeness rule.
ACTOR: ADMIN member
TRIGGER: User clicks "Publish" button

1. [UI] User reviews profile content in editor/preview
2. [UI] Publish button shows current status badge (DRAFT)
3. [UI] User clicks "Publish"
4. [Frontend] Sends POST /api/v1/companies/:companyId/profile/publish
5. [Backend] AuthGuard + RolesGuard validate (ADMIN only)
   -> IF not ADMIN: return 404
6. [Backend] Validates profile status is DRAFT
   -> IF not DRAFT: return 422 PROFILE_INVALID_STATUS_TRANSITION
7. [Backend] Validates BR-10 completeness rule (minimum required fields for publishing):
   - Headline must be set
   - Description must be set
   - At least 1 team member
   - At least 1 metric
   - (other minimum content rules as defined by BR-10)
   -> IF incomplete: return 422 PROFILE_INCOMPLETE { missingFields: ["headline", "teamMembers", ...] }
8. [Backend] Updates profile status to PUBLISHED, sets publishedAt timestamp
9. [Backend] Returns 200 with updated profile
10. [UI] Success toast: "Perfil publicado com sucesso"
11. [UI] Status badge updates to PUBLISHED (green)
12. [UI] Public URL displayed with copy-to-clipboard button: https://app.navia.com.br/profiles/{slug}

POSTCONDITION: Profile status = PUBLISHED, publicly accessible via slug URL
SIDE EFFECTS: Audit log (PROFILE_PUBLISHED)
```

### Happy Path: View Public Profile (PUBLIC access)

```
PRECONDITION: Profile is PUBLISHED with accessType = PUBLIC
ACTOR: Public visitor (unauthenticated)
TRIGGER: Visitor opens profile URL

1. [UI] Visitor navigates to https://app.navia.com.br/profiles/{slug}
2. [Frontend] Sends GET /api/v1/profiles/:slug
3. [Backend] Looks up profile by slug
   -> IF not found: return 404
4. [Backend] Checks profile status is PUBLISHED
   -> IF not PUBLISHED: return 404
5. [Backend] Checks accessType = PUBLIC
6. [Backend] Records analytics event (page view, referrer, timestamp)
7. [Backend] Returns 200 with public profile data (company info, metrics, team, headline, description)
8. [UI] Renders public profile page:
   - Company header (logo, name, headline)
   - Description / pitch
   - Key metrics cards
   - Team member grid with photos and roles
   - Contact / links section

POSTCONDITION: Visitor sees the profile. Analytics view count incremented.
SIDE EFFECTS: Analytics event recorded
```

### Happy Path: View Public Profile (PASSWORD access)

```
PRECONDITION: Profile is PUBLISHED with accessType = PASSWORD
ACTOR: Public visitor with the password
TRIGGER: Visitor opens profile URL and enters password

1. [UI] Visitor navigates to https://app.navia.com.br/profiles/{slug}
2. [Frontend] Sends GET /api/v1/profiles/:slug (no password param)
3. [Backend] Returns 401 PROFILE_PASSWORD_REQUIRED
4. [UI] Renders password prompt page with input field and "Access" button
5. [UI] Visitor enters password
6. [UI] Visitor clicks "Access"
7. [Frontend] Sends GET /api/v1/profiles/:slug?password={entered_password}
8. [Backend] Looks up profile, verifies bcrypt hash
   -> IF mismatch: return 401 PROFILE_INVALID_PASSWORD
9. [Backend] Records analytics event
10. [Backend] Returns 200 with profile data
11. [UI] Renders full public profile page

POSTCONDITION: Visitor sees the profile after password authentication
SIDE EFFECTS: Analytics event recorded
```

### Happy Path: View Public Profile (EMAIL_GATED access)

```
PRECONDITION: Profile is PUBLISHED with accessType = EMAIL_GATED
ACTOR: Public visitor
TRIGGER: Visitor opens profile URL and provides email

1. [UI] Visitor navigates to https://app.navia.com.br/profiles/{slug}
2. [Frontend] Sends GET /api/v1/profiles/:slug (no email param)
3. [Backend] Returns 422 PROFILE_EMAIL_REQUIRED
4. [UI] Renders email gate page with email input and "View Profile" button
5. [UI] Visitor enters their email address
6. [Frontend] Validates email format client-side
   -> IF invalid: show inline error, STOP
7. [UI] Visitor clicks "View Profile"
8. [Frontend] Sends GET /api/v1/profiles/:slug?email={visitor_email}
9. [Backend] Validates email format
   -> IF invalid: return 400 VAL_INVALID_INPUT
10. [Backend] Records analytics event with visitor email
11. [Backend] Returns 200 with profile data
12. [UI] Renders full public profile page

POSTCONDITION: Visitor sees the profile. Visitor email logged for lead tracking.
SIDE EFFECTS: Analytics event recorded with visitor email
```

### Happy Path: View Analytics

```
PRECONDITION: Profile exists. User is ADMIN or FINANCE.
ACTOR: ADMIN or FINANCE member
TRIGGER: User navigates to profile analytics tab

1. [UI] User navigates to /companies/:companyId/profile/analytics
2. [UI] Period selector defaults to "30d"
3. [Frontend] Sends GET /api/v1/companies/:companyId/profile/analytics?period=30d
4. [Backend] Validates ADMIN or FINANCE role
   -> IF not authorized: return 404
5. [Backend] Aggregates analytics for the requested period:
   - Total views
   - Unique visitors
   - Views by day (chart data)
   - Top referrers
   - Emails collected (for EMAIL_GATED profiles)
6. [Backend] Returns 200 with analytics data
7. [UI] Renders analytics dashboard:
   - Stat cards (total views, unique visitors)
   - Line chart (views over time)
   - Referrer breakdown table
   - Email list (if EMAIL_GATED)
8. [UI] User can switch period (7d, 30d, 90d) via selector
9. [Frontend] Re-fetches analytics with new period param

POSTCONDITION: No state change (read-only)
```

### Alternative Path: Update Slug

```
PRECONDITION: Profile exists. User is ADMIN.
ACTOR: ADMIN member
TRIGGER: User wants to customize the profile URL slug

1. [UI] User navigates to profile settings section
2. [UI] Current slug displayed with URL preview: https://app.navia.com.br/profiles/{current_slug}
3. [UI] User clicks "Edit" on the slug field
4. [UI] Slug input becomes editable, shows format hint (lowercase, hyphens, no spaces)
5. [UI] User types desired slug
6. [Frontend] Validates slug format client-side (lowercase alphanumeric + hyphens, 3-50 chars)
   -> IF invalid format: show inline error, STOP
7. [UI] User clicks "Save"
8. [Frontend] Sends PUT /api/v1/companies/:companyId/profile/slug { slug: "new-slug" }
9. [Backend] Validates ADMIN role
   -> IF not ADMIN: return 404
10. [Backend] Validates slug format
    -> IF invalid: return 400 VAL_INVALID_INPUT
11. [Backend] Checks slug uniqueness
    -> IF taken: return 409 PROFILE_SLUG_DUPLICATE
12. [Backend] Updates slug
13. [Backend] Returns 200 with updated profile
14. [UI] Success toast: "URL do perfil atualizada"
15. [UI] URL preview updates with new slug

POSTCONDITION: Profile slug updated. Old slug immediately unavailable. New slug resolves to this profile.
SIDE EFFECTS: Audit log (PROFILE_UPDATED)
```

### Alternative Path: Unpublish Profile

```
PRECONDITION: Profile is PUBLISHED. User is ADMIN.
ACTOR: ADMIN member
TRIGGER: User clicks "Unpublish"

1. [UI] User views profile page with PUBLISHED status badge
2. [UI] User clicks "Unpublish" (secondary/ghost button)
3. [UI] Confirmation dialog: "The profile will no longer be publicly accessible. Continue?"
4. [UI] User confirms
5. [Frontend] Sends POST /api/v1/companies/:companyId/profile/unpublish
6. [Backend] Validates ADMIN role
   -> IF not ADMIN: return 404
7. [Backend] Validates profile is PUBLISHED
   -> IF not PUBLISHED: return 422 PROFILE_INVALID_STATUS_TRANSITION
8. [Backend] Updates status to DRAFT
9. [Backend] Returns 200 with updated profile
10. [UI] Status badge updates to DRAFT
11. [UI] Success toast: "Perfil despublicado"

POSTCONDITION: Profile status = DRAFT. Public URL returns 404 until re-published.
SIDE EFFECTS: Audit log (PROFILE_UNPUBLISHED)
```

### Alternative Path: Archive Profile

```
PRECONDITION: Profile is DRAFT or PUBLISHED. User is ADMIN.
ACTOR: ADMIN member
TRIGGER: User clicks "Archive" in profile settings

1. [UI] User navigates to profile settings
2. [UI] User clicks "Archive Profile" (destructive variant button)
3. [UI] Confirmation dialog: "Archiving will make the profile inactive. You can restore it later."
4. [UI] User confirms
5. [Frontend] Sends POST /api/v1/companies/:companyId/profile/archive
6. [Backend] Validates ADMIN role
   -> IF not ADMIN: return 404
7. [Backend] Validates profile is not already ARCHIVED
   -> IF already ARCHIVED: return 422 PROFILE_INVALID_STATUS_TRANSITION
8. [Backend] Updates status to ARCHIVED
9. [Backend] Returns 200 with updated profile
10. [UI] Status badge updates to ARCHIVED (gray)
11. [UI] Success toast: "Perfil arquivado"
12. [UI] Edit controls disabled, only "Restore" option available

POSTCONDITION: Profile status = ARCHIVED. Public URL returns 404.
SIDE EFFECTS: Audit log (PROFILE_ARCHIVED)
```

### Error Path: Create When Company Not ACTIVE

```
PRECONDITION: User is ADMIN. Company is in DRAFT, INACTIVE, or DISSOLVED status.
ACTOR: ADMIN member

1. [UI] User attempts to create a profile
2. [Frontend] Sends POST /api/v1/companies/:companyId/profile
3. [Backend] Validates company status
4. [Backend] Returns 422 PROFILE_COMPANY_NOT_ACTIVE
5. [UI] Error toast: "A empresa precisa estar ativa para criar um perfil"

POSTCONDITION: No profile created
```

### Error Path: Create Duplicate Profile

```
PRECONDITION: User is ADMIN. Company already has a profile.
ACTOR: ADMIN member

1. [UI] User attempts to create a profile (e.g., via API or race condition)
2. [Frontend] Sends POST /api/v1/companies/:companyId/profile
3. [Backend] Detects existing profile for this company
4. [Backend] Returns 409 PROFILE_ALREADY_EXISTS
5. [UI] Error toast: "Um perfil ja existe para esta empresa"

POSTCONDITION: No duplicate profile created
```

### Error Path: Publish Empty/Incomplete Profile (BR-10)

```
PRECONDITION: Profile is DRAFT but missing required content per BR-10 rule.
ACTOR: ADMIN member

1. [UI] User clicks "Publish" on an incomplete profile
2. [Frontend] Sends POST /api/v1/companies/:companyId/profile/publish
3. [Backend] Validates BR-10 completeness
4. [Backend] Returns 422 PROFILE_INCOMPLETE with { missingFields: ["headline", "description", "teamMembers"] }
5. [Frontend] Maps missingFields to user-friendly list
6. [UI] Error toast or inline alert: "Complete os seguintes campos antes de publicar: Titulo, Descricao, Equipe"
7. [UI] Missing fields highlighted in the editor

POSTCONDITION: Profile remains DRAFT
```

### Error Path: View Password-Protected Profile Without Password

```
PRECONDITION: Profile is PUBLISHED with accessType = PASSWORD
ACTOR: Public visitor

1. [UI] Visitor navigates to /profiles/{slug}
2. [Frontend] Sends GET /api/v1/profiles/:slug
3. [Backend] Returns 401 PROFILE_PASSWORD_REQUIRED
4. [UI] Renders password prompt page
5. [UI] Visitor enters wrong password
6. [Frontend] Sends GET /api/v1/profiles/:slug?password=wrong
7. [Backend] bcrypt comparison fails
8. [Backend] Returns 401 PROFILE_INVALID_PASSWORD
9. [UI] Shows error message: "Senha incorreta"
10. [UI] Password input cleared, visitor can retry

POSTCONDITION: Visitor cannot access profile without correct password
```

### Error Path: View Email-Gated Profile Without Email

```
PRECONDITION: Profile is PUBLISHED with accessType = EMAIL_GATED
ACTOR: Public visitor

1. [UI] Visitor navigates to /profiles/{slug}
2. [Frontend] Sends GET /api/v1/profiles/:slug
3. [Backend] Returns 422 PROFILE_EMAIL_REQUIRED
4. [UI] Renders email gate page
5. [UI] Visitor attempts to submit with empty or invalid email
6. [Frontend] Client-side validation catches invalid email
   -> IF empty: "Email e obrigatorio"
   -> IF invalid format: "Formato de email invalido"
7. [UI] Visitor cannot proceed until valid email is provided

POSTCONDITION: Visitor cannot access profile without providing a valid email
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 7 (create) | Company status | Not ACTIVE | Error | 422 PROFILE_COMPANY_NOT_ACTIVE |
| 8 (create) | Profile existence | Already exists | Error | 409 PROFILE_ALREADY_EXISTS |
| 6 (publish) | Profile status | Not DRAFT | Error | 422 PROFILE_INVALID_STATUS_TRANSITION |
| 7 (publish) | BR-10 completeness | Missing required fields | Error | 422 PROFILE_INCOMPLETE { missingFields } |
| 7 (unpublish) | Profile status | Not PUBLISHED | Error | 422 PROFILE_INVALID_STATUS_TRANSITION |
| 7 (archive) | Profile status | Already ARCHIVED | Error | 422 PROFILE_INVALID_STATUS_TRANSITION |
| 11 (slug) | Slug uniqueness | Already taken | Error | 409 PROFILE_SLUG_DUPLICATE |
| 8 (metrics) | Metrics count | > 6 | Error | 422 PROFILE_MAX_METRICS_EXCEEDED |
| 8 (team) | Team count | > 10 | Error | 422 PROFILE_MAX_TEAM_EXCEEDED |
| 7 (team photo) | File type | Not JPEG/PNG/WebP | Error | 422 PROFILE_INVALID_PHOTO_TYPE |
| 5 (public view) | Access type | PASSWORD, no password param | Error | 401 PROFILE_PASSWORD_REQUIRED |
| 8 (public view) | Password check | bcrypt mismatch | Error | 401 PROFILE_INVALID_PASSWORD |
| 3 (public view) | Access type | EMAIL_GATED, no email param | Error | 422 PROFILE_EMAIL_REQUIRED |
| 4 (public view) | Profile status | Not PUBLISHED | Error | 404 (profile not found) |
| - | Role check | Not member or wrong role | Error | 404 (prevents enumeration) |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| CompanyProfile | status | -- | DRAFT | Profile created |
| CompanyProfile | slug | -- | auto-generated (kebab-case) | Profile created |
| CompanyProfile | status | DRAFT | PUBLISHED | ADMIN publishes (BR-10 met) |
| CompanyProfile | publishedAt | null | now() | ADMIN publishes |
| CompanyProfile | status | PUBLISHED | DRAFT | ADMIN unpublishes |
| CompanyProfile | status | DRAFT/PUBLISHED | ARCHIVED | ADMIN archives |
| CompanyProfile | accessType | PUBLIC (default) | PASSWORD/EMAIL_GATED | ADMIN/FINANCE updates |
| CompanyProfile | passwordHash | null | bcrypt hash | accessType set to PASSWORD |

### Status State Machine

```
                    +-----------+
  create ---------> |   DRAFT   | <---- unpublish
                    +-----------+
                      |       |
             publish  |       | archive
             (BR-10)  |       |
                      v       |
                    +-----------+     archive     +------------+
                    | PUBLISHED | --------------> |  ARCHIVED  |
                    +-----------+                 +------------+
                                                       ^
                          DRAFT -------- archive ------+
```

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE | Public (unauthenticated) |
|--------|-------|---------|-------|----------|----------|--------------------------|
| Create profile | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| View profile (internal) | Yes | Yes | Yes | Yes | Yes | No (401) |
| Update profile | Yes | Yes | No (404) | No (404) | No (404) | No (401) |
| Update slug | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| Replace metrics | Yes | Yes | No (404) | No (404) | No (404) | No (401) |
| Replace team | Yes | Yes | No (404) | No (404) | No (404) | No (401) |
| Upload team photo | Yes | Yes | No (404) | No (404) | No (404) | No (401) |
| Publish | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| Unpublish | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| Archive | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| View analytics | Yes | Yes | No (404) | No (404) | No (404) | No (401) |
| View public profile | N/A | N/A | N/A | N/A | N/A | Yes (access rules apply) |

Note: Non-members receive 404 (not 403) to prevent company enumeration per security.md.

---

## API Endpoints Summary

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/v1/companies/:companyId/profile` | Required | ADMIN | Create company profile |
| GET | `/api/v1/companies/:companyId/profile` | Required | Any member | Get company profile |
| PUT | `/api/v1/companies/:companyId/profile` | Required | ADMIN, FINANCE | Update company profile |
| PUT | `/api/v1/companies/:companyId/profile/slug` | Required | ADMIN | Update profile slug |
| POST | `/api/v1/companies/:companyId/profile/publish` | Required | ADMIN | Publish profile (BR-10) |
| POST | `/api/v1/companies/:companyId/profile/unpublish` | Required | ADMIN | Unpublish profile |
| POST | `/api/v1/companies/:companyId/profile/archive` | Required | ADMIN | Archive profile |
| PUT | `/api/v1/companies/:companyId/profile/metrics` | Required | ADMIN, FINANCE | Replace profile metrics (max 6) |
| PUT | `/api/v1/companies/:companyId/profile/team` | Required | ADMIN, FINANCE | Replace team members (max 10) |
| POST | `/api/v1/companies/:companyId/profile/team/photo` | Required | ADMIN, FINANCE | Upload team member photo (2MB) |
| GET | `/api/v1/companies/:companyId/profile/analytics` | Required | ADMIN, FINANCE | View profile analytics (7d/30d/90d) |
| GET | `/api/v1/profiles/:slug` | @Public | None | View public profile (password/email params) |

---

**Depends on**: [Authentication](./authentication.md) -- user must be logged in for all management endpoints
**Depends on**: [Company Management](./company-management.md) -- company must be ACTIVE to create a profile
**Feeds into**: Dataroom -- published profile is the entry point for investor due diligence materials
**Triggers**: Audit log events for all state-changing operations
