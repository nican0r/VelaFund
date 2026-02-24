# Authentication Specification

**Topic of Concern**: User authentication and wallet management via Privy

**One-Sentence Description**: The system provides secure user authentication with embedded wallet creation through Privy.

---

## Overview

Navia uses Privy as the authentication provider to enable seamless user login with automatic embedded wallet creation. Users can authenticate via email, Google OAuth, or Apple OAuth without needing crypto knowledge. Each user receives a non-custodial embedded wallet managed by Privy for blockchain identity and document signing.

---

## User Stories

### US-1: Email/Social Login
**As a** new user
**I want to** sign up using my email or social account (Google/Apple)
**So that** I can access the platform without managing crypto wallets manually

### US-2: Wallet Creation
**As a** registered user
**I want** an embedded wallet automatically created for me
**So that** I can sign documents and link my on-chain identity without technical knowledge

### US-3: Session Management
**As a** logged-in user
**I want** my session to remain active for a reasonable period
**So that** I don't have to re-authenticate constantly while working

### US-4: Logout
**As a** user
**I want to** securely log out
**So that** my account is protected when I'm done using the platform

### US-5: Account Recovery
**As a** user who lost access
**I want to** recover my account through Privy's recovery mechanisms
**So that** I don't lose access to my cap table data

---

## Functional Requirements

### FR-1: Authentication Methods
- The system MUST support email-based authentication
- The system MUST support Google OAuth
- The system MUST support Apple OAuth
- The system MUST NOT require users to install crypto wallets manually

### FR-2: Embedded Wallet Creation
- The system MUST create a Privy embedded wallet for each new user automatically
- The wallet MUST be non-custodial (user controls keys via Privy recovery)
- The system MUST store the user's wallet address in the database
- The wallet MUST support Ethereum signature operations (EIP-712)

### FR-3: Token Management
- The system MUST issue Privy Access Tokens upon successful authentication
- The backend MUST verify Privy Access Tokens on each API request
- Tokens MUST expire after a configured period (default: 7 days)
- The system MUST support token refresh without re-login

### FR-4: User Profile Sync
- The system MUST sync user profile data from Privy on first login
- The system MUST store: privyUserId, email, walletAddress
- The system SHOULD store: firstName, lastName, profilePictureUrl
- Profile updates in Privy SHOULD sync to the platform

### FR-5: Session Security
- The system MUST implement session timeout (default: 2 hours of inactivity)
- The system MUST support Two-Factor Authentication (2FA) via Privy
- The system MUST log authentication events for security audit

---

## Data Models

### User Entity

```typescript
interface User {
  id: string;                    // UUID
  privyUserId: string;           // Unique Privy user identifier
  email: string;                 // Primary email (unique)
  walletAddress: string;         // Ethereum wallet address (unique)
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;

  // KYC fields
  kycStatus: KYCStatus;          // not_started | in_progress | approved | rejected
  verificationLevel: VerificationLevel; // none | basic | standard | enhanced

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}
```

### Session Data (stored in Context/Redis)

```typescript
interface AuthSession {
  userId: string;
  privyAccessToken: string;
  walletAddress: string;
  expiresAt: Date;
  lastActivityAt: Date;
}
```

---

## API Endpoints

### POST /api/v1/auth/login
**Description**: Authenticate user with Privy token and create/sync user profile

**Request**:
```json
{
  "privyAccessToken": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "walletAddress": "0x...",
      "firstName": "John",
      "lastName": "Doe",
      "kycStatus": "not_started"
    },
    "session": {
      "expiresAt": "2024-01-30T12:00:00Z"
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized` — Invalid or expired Privy token (`AUTH_INVALID_TOKEN`, messageKey: `errors.auth.invalidToken`)
- `502 Bad Gateway` — Failed to verify token with Privy (`AUTH_PRIVY_UNAVAILABLE`, messageKey: `errors.auth.privyUnavailable`)

---

### POST /api/v1/auth/logout
**Description**: Invalidate current user session

**Request**: No body (uses session cookie/token)

**Response**: `204 No Content` (empty body)

---

### GET /api/v1/auth/me
**Description**: Get current authenticated user profile

**Request**: No body (uses session cookie/token)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "walletAddress": "0x...",
    "firstName": "John",
    "lastName": "Doe",
    "kycStatus": "approved",
    "verificationLevel": "standard",
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized` — No valid session (`AUTH_SESSION_NOT_FOUND`, messageKey: `errors.auth.sessionNotFound`)

---

### POST /api/v1/auth/refresh
**Description**: Refresh access token without re-login

**Request**:
```json
{
  "refreshToken": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "string",
    "expiresAt": "2024-01-30T12:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized` — Invalid or expired refresh token (`AUTH_TOKEN_EXPIRED`, messageKey: `errors.auth.tokenExpired`)

---

## Business Rules

### BR-1: Single Email Per Account
- One email address can only be associated with one user account
- Attempting to create a duplicate email returns `409 Conflict`

### BR-2: Wallet Address Uniqueness
- Each wallet address must be unique across all users
- If Privy returns a duplicate wallet, the system must reject the registration

### BR-3: Session Expiry
- Sessions expire after 2 hours of inactivity
- Absolute session expiry: 7 days from login
- Expired sessions require re-authentication

### BR-4: Failed Login Attempts
- After 5 failed login attempts, temporarily lock account (15 minutes)
- Notify user via email of suspicious login activity

### BR-5: KYC Gating
- Admin users: Can access dashboard after login, but cannot create cap table until KYC approved
- Investor/Employee users: Must complete KYC immediately after signup before platform access

---

## User Flows

### Flow 1: First-Time User Signup

```
1. User visits Navia landing page
2. User clicks "Sign Up"
3. Privy modal appears with authentication options
4. User selects authentication method:
   - Email: Enter email → Receive OTP → Enter OTP
   - Google: OAuth flow
   - Apple: OAuth flow
5. Privy creates embedded wallet for user
6. Privy returns Access Token + Wallet Address
7. Frontend sends POST /api/v1/auth/login with Privy token
8. Backend verifies token with Privy API
9. Backend creates user record in database
10. Backend returns user profile
11. User redirected based on role:
    - Admin: Dashboard (with KYC prompt banner)
    - Investor/Employee: KYC verification page
```

### Flow 2: Returning User Login

```
1. User visits Navia and clicks "Login"
2. Privy modal appears
3. User authenticates (email/Google/Apple)
4. Privy returns Access Token
5. Frontend sends POST /api/v1/auth/login
6. Backend verifies token
7. Backend fetches existing user record
8. Backend updates lastLoginAt timestamp
9. Backend returns user profile
10. User redirected to dashboard
```

### Flow 3: Session Timeout

```
1. User is idle for 2 hours
2. Frontend detects session expiry via 401 response
3. Frontend clears local auth state
4. Frontend shows "Session expired, please log in again"
5. User redirected to login page
```

### Flow 4: Logout

```
1. User clicks "Logout" button in header
2. Frontend sends POST /api/v1/auth/logout
3. Backend invalidates session
4. Frontend clears Privy auth state
5. Frontend clears local storage/cookies
6. User redirected to login page
```

---

## Edge Cases & Error Handling

### EC-1: Privy Service Unavailable
**Scenario**: Privy API is down during login attempt
**Handling**: Return `502 Bad Gateway` with error code `AUTH_PRIVY_UNAVAILABLE` and messageKey `errors.auth.privyUnavailable`. Frontend resolves the messageKey to show a localized user-friendly message.

### EC-2: Network Interruption During Login
**Scenario**: User loses internet connection mid-authentication
**Handling**: Frontend shows reconnection prompt and retries token verification.

### EC-3: Duplicate Wallet Address
**Scenario**: Privy returns a wallet address already in database (edge case)
**Handling**: Return `409 Conflict` with error code `AUTH_DUPLICATE_WALLET` and messageKey `errors.auth.duplicateWallet`. Log error for investigation.

### EC-4: Token Verification Failure
**Scenario**: Privy token is invalid or expired
**Handling**: Return `401 Unauthorized` with error code `AUTH_INVALID_TOKEN` and messageKey `errors.auth.invalidToken`. Frontend redirects to login page.

### EC-5: User Deleted During Session
**Scenario**: User account deleted while session is active
**Handling**: Return `401 Unauthorized` with error code `AUTH_SESSION_NOT_FOUND` and messageKey `errors.auth.sessionNotFound`. Frontend redirects to login page.

---

## Dependencies

### Internal Dependencies
- **KYC Verification**: Authentication gates KYC flow based on user type
- **User Permissions**: Authentication determines user role and access level
- **Audit Trail**: All login/logout events are logged

### External Dependencies
- **Privy Service**: Authentication provider (https://privy.io)
  - Required for: OAuth flows, wallet creation, token verification
  - SLA: 99.9% uptime
- **Privy Server SDK**: Backend integration for token verification
- **Privy React SDK**: Frontend authentication UI

---

## Technical Implementation

### Frontend (Next.js)

```typescript
// /frontend/src/lib/privy.ts
import { PrivyProvider } from '@privy-io/react-auth';

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  config: {
    loginMethods: ['email', 'google', 'apple'],
    appearance: {
      theme: 'light',
      accentColor: '#676FFF',
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
  },
};
```

```typescript
// /frontend/src/contexts/auth-context.tsx
import { usePrivy } from '@privy-io/react-auth';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api-client';
import { useErrorToast } from '@/hooks/use-error-toast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: privyUser, authenticated, login, logout: privyLogout, getAccessToken } = usePrivy();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showError } = useErrorToast();

  const syncUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const accessToken = await getAccessToken();
      const data = await api.post<{ user: User; session: { expiresAt: string } }>(
        '/api/v1/auth/login',
        { privyAccessToken: accessToken },
      );
      setUser(data.user);
    } catch (error) {
      showError(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, showError]);

  useEffect(() => {
    if (authenticated && privyUser) {
      syncUserProfile();
    } else {
      setUser(null);
    }
  }, [authenticated, privyUser, syncUserProfile]);

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout', {});
    } catch {
      // Proceed with client-side logout even if backend call fails
    } finally {
      setUser(null);
      await privyLogout();
    }
  }, [privyLogout]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: authenticated, isLoading, login, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Backend (NestJS)

```typescript
// /backend/src/auth/auth.module.ts — PrivyClient provider registration
import { Module } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  providers: [
    {
      provide: 'PRIVY_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new PrivyClient(
          configService.get<string>('PRIVY_APP_ID'),
          configService.get<string>('PRIVY_APP_SECRET'),
        );
      },
      inject: [ConfigService],
    },
    AuthService,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

```typescript
// /backend/src/auth/auth.service.ts
import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    @Inject('PRIVY_CLIENT') private privyClient: PrivyClient,
  ) {}

  async verifyAndSyncUser(privyAccessToken: string) {
    // Verify token with Privy
    let verifiedClaims;
    try {
      verifiedClaims = await this.privyClient.verifyAuthToken(privyAccessToken);
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new AppException(
          'AUTH_PRIVY_UNAVAILABLE',
          'errors.auth.privyUnavailable',
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw new AppException(
        'AUTH_INVALID_TOKEN',
        'errors.auth.invalidToken',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Get or create user
    const user = await this.prisma.user.upsert({
      where: { privyUserId: verifiedClaims.userId },
      update: { lastLoginAt: new Date() },
      create: {
        privyUserId: verifiedClaims.userId,
        email: verifiedClaims.email,
        walletAddress: verifiedClaims.wallet?.address,
        kycStatus: 'NOT_STARTED',
      },
    });

    return user;
  }
}
```

---

## Security Considerations

### SEC-1: Token Storage
- Access tokens MUST NOT be stored in localStorage (XSS vulnerability)
- Use HTTP-only cookies for token storage
- Implement CSRF protection for cookie-based auth

### SEC-2: HTTPS Only
- All authentication endpoints MUST use HTTPS in production
- Redirect HTTP to HTTPS automatically

### SEC-3: Rate Limiting
- Limit login attempts: 5 per 15 minutes per IP
- Limit token refresh: 10 per hour per user

### SEC-4: Privy Token Verification
- ALWAYS verify Privy tokens on the backend
- NEVER trust tokens sent from frontend without verification
- Use Privy Server SDK for verification (not client-side validation)

### SEC-5: Audit Logging
- Log all login attempts (success and failure)
- Log all logout events
- Log token refresh events
- Retain logs for 90 days minimum

---

## Success Criteria

### Performance
- Login flow completes in < 3 seconds (p95)
- Token verification completes in < 500ms (p95)
- Zero authentication-related downtime

### Security
- Zero unauthorized access incidents
- 100% of tokens verified via Privy before granting access
- All authentication events logged

### User Experience
- Login success rate > 98%
- Session timeout does not disrupt active users
- Password-less authentication eliminates password reset flows

---

## Open Questions

1. Should we implement "Remember Me" functionality for extended sessions?
2. What is the maximum session duration for admin users?
3. Should we support hardware wallet connection for advanced users in future phases?
4. How do we handle users who lose access to their email and Privy recovery method?

---

## Future Enhancements

- **Multi-factor Authentication (MFA)**: Add optional TOTP-based 2FA
- **Biometric Authentication**: Support Face ID / Touch ID on mobile
- **Hardware Wallet Support**: Allow users to connect MetaMask/Ledger
- **Passkey Support**: WebAuthn integration for passwordless auth
- **Session Management UI**: Dashboard showing active sessions with revoke capability

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [kyc-verification.md](./kyc-verification.md) | KYC verification requires authenticated user; KYC status stored on User entity |
| [company-management.md](./company-management.md) | Authenticated users create and join companies |
| [company-membership.md](./company-membership.md) | Members must be authenticated to accept invitations and access company resources |
| [company-blockchain-admin.md](./company-blockchain-admin.md) | Creator's Privy embedded wallet becomes the on-chain admin |
| [user-permissions.md](./user-permissions.md) | Authorization (roles/permissions) applied after authentication |
| [document-signatures.md](./document-signatures.md) | EIP-712 signatures use Privy embedded wallets created during auth |
| [notifications.md](./notifications.md) | Login and session events trigger notifications |
| [api-standards.md](../.claude/rules/api-standards.md) | Auth endpoints follow `/api/v1/auth/*` URL pattern, Bearer token in Authorization header |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`, `AUTH_SESSION_NOT_FOUND`, `AUTH_DUPLICATE_EMAIL`, `AUTH_NO_WALLET`, `AUTH_ACCOUNT_LOCKED`, `AUTH_PRIVY_UNAVAILABLE` |
| [security.md](../.claude/rules/security.md) | Token storage (HTTP-only cookies), session timeouts, Privy token verification, CSRF protection |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`, `AUTH_TOKEN_REFRESHED`, `AUTH_ACCOUNT_LOCKED` |

---
---

# Frontend Architecture

This section defines the frontend implementation of authentication, onboarding, and session management. It covers page routes, component hierarchy, user flows, UI states, integration details, and i18n keys. The backend specification above remains the source of truth for API contracts, business rules, and security requirements.

---

## Table of Contents (Frontend)

1. [Page Routes](#page-routes)
2. [Component Hierarchy](#component-hierarchy)
3. [Component Specifications](#component-specifications)
4. [Frontend User Flows](#frontend-user-flows)
5. [UI States & Error Handling](#ui-states--error-handling)
6. [Integration Details](#integration-details)
7. [i18n Keys](#i18n-keys)

---

## Page Routes

| Route | Layout | Auth Required | Description |
|-------|--------|---------------|-------------|
| `/login` | Auth layout (centered card, gray-50 bg) | No | Login page with Privy integration |
| `/onboarding` | Auth layout (centered card, gray-50 bg) | Yes (via Privy) | Multi-step onboarding wizard (Step 1: Personal Info, Step 2: Company Creation) |
| `/(dashboard)/*` | Dashboard shell (sidebar + top bar) | Yes + completed onboarding | All protected application routes |

### Route Protection Logic

```
User navigates to any route
  │
  ├─ /login ─→ Public. If already authenticated + has company → redirect to /dashboard
  │
  ├─ /onboarding ─→ Requires Privy auth. If already has company → redirect to /dashboard
  │
  └─ /(dashboard)/* ─→ AuthGuard evaluates:
        │
        ├─ [loading] ─→ Full-page spinner
        ├─ [not authenticated] ─→ Redirect to /login
        ├─ [authenticated, needsOnboarding] ─→ Redirect to /onboarding
        └─ [authenticated, has company] ─→ Render page
```

---

## Component Hierarchy

```
app/layout.tsx
  └─ PrivyAuthProvider (wraps entire app)
       └─ AuthContext.Provider (custom auth state)
            ├─ app/(auth)/login/page.tsx ─→ LoginPage
            │
            ├─ app/(onboarding)/onboarding/page.tsx ─→ OnboardingWizard
            │     ├─ OnboardingStepper
            │     ├─ PersonalInfoStep (Step 1)
            │     └─ CompanyCreationStep (Step 2)
            │
            └─ app/(dashboard)/layout.tsx ─→ AuthGuard
                  └─ DashboardShell (sidebar + top bar + content)
                        └─ Page components...
```

### Component Index

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `PrivyAuthProvider` | `app/layout.tsx` | Wraps entire app with Privy SDK provider and custom AuthContext |
| `AuthContext` / `useAuth()` | `contexts/auth-context.tsx` | Provides auth state and methods to all components |
| `LoginPage` | `app/(auth)/login/page.tsx` | Login UI with Privy modal trigger |
| `OnboardingWizard` | `app/(onboarding)/onboarding/page.tsx` | Multi-step onboarding container |
| `OnboardingStepper` | `components/onboarding/onboarding-stepper.tsx` | Visual progress indicator for onboarding steps |
| `PersonalInfoStep` | `components/onboarding/personal-info-step.tsx` | Step 1: user profile form |
| `CompanyCreationStep` | `components/onboarding/company-creation-step.tsx` | Step 2: company creation form |
| `AuthGuard` | `components/auth/auth-guard.tsx` | Route protection wrapper for dashboard pages |
| `SessionExpiredToast` | Via Sonner toast library | Toast notification on 401 responses |

---

## Component Specifications

### 1. PrivyAuthProvider

**File**: `app/layout.tsx`

Wraps the entire application with Privy SDK and the custom AuthContext.

**Configuration**:
```typescript
// Environment variables
NEXT_PUBLIC_PRIVY_APP_ID=<from Privy dashboard>

// PrivyProvider config
{
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  loginMethods: ['email', 'google', 'apple'],
  appearance: {
    theme: 'light',
    accentColor: '#1B6B93', // brand blue-600 (Cornflower Ocean)
    logo: '/logo.svg',
  },
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
  },
}
```

**Behavior**:
- Initializes Privy SDK on app mount
- Provides `usePrivy()` hook to all child components
- Privy handles its own loading state and modal rendering

---

### 2. AuthContext / useAuth()

**File**: `contexts/auth-context.tsx`

Provides centralized auth state and methods consumed by all components.

**TypeScript Interface**:
```typescript
interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  walletAddress: string;
  locale: 'pt-BR' | 'en';
  kycStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompany: boolean;
  needsOnboarding: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}
```

**State Derivation**:
```
isAuthenticated = Privy authenticated AND backend user synced
isLoading = Privy loading OR backend sync in progress
hasCompany = user has at least one company membership
needsOnboarding = isAuthenticated AND (!user.firstName OR !hasCompany)
```

**Behavior**:
- On mount: checks Privy auth state via `usePrivy()`
- When Privy authenticates: syncs with backend via `POST /api/v1/auth/login`
- Stores the backend user response and company membership status
- `login()`: calls `privy.login()` which opens the Privy modal
- `logout()`: calls `POST /api/v1/auth/logout`, then `privy.logout()`, clears state

---

### 3. LoginPage

**File**: `app/(auth)/login/page.tsx`

**Layout**: Auth layout (design-system.md section 5.4)
- Background: `gray-50` (#F9FAFB), full viewport height, centered content
- Card: `max-w-[420px]`, `white` background, `shadow-lg`, `radius-xl` (16px), padding `32px`

**Visual Structure**:
```
┌────────────────────────────────┐
│                                │
│         [Navia Logo]           │  ← Centered, 48px height, mb-24px
│                                │
│     Bem-vindo ao Navia         │  ← h2 (24px, weight 600), navy-900, centered
│     Faca login para continuar  │  ← body (14px), gray-500, centered, mb-32px
│                                │
│   ┌──────────────────────┐     │
│   │ [info icon] Session  │     │  ← Conditional: only if ?expired=true
│   │ expired banner       │     │     blue-50 bg, blue-600 text, radius-md, p-12px, mb-16px
│   └──────────────────────┘     │
│                                │
│   ┌──────────────────────────┐ │
│   │        Entrar            │ │  ← Primary button, full width, size lg (48px), blue-600
│   └──────────────────────────┘ │
│                                │
└────────────────────────────────┘
```

**Props**: None (page component)

**States**: See [UI States & Error Handling](#ui-states--error-handling)

**i18n Keys Used**:
- `auth.login.title` — heading text
- `auth.login.subtitle` — subheading text
- `auth.login.signIn` — button label
- `auth.login.sessionExpired` — expired session banner message

---

### 4. OnboardingWizard

**File**: `app/(onboarding)/onboarding/page.tsx`

**Layout**: Auth layout (same centered card approach as login)
- Card: `max-w-[640px]`, `white` background, `shadow-md`, `radius-lg` (12px), padding `32px`

**Visual Structure**:
```
┌──────────────────────────────────────────────┐
│                                              │
│   (1) Suas Informacoes ── (2) Sua Empresa    │  ← OnboardingStepper
│                                              │
│  ─────────────────────────────────────────── │  ← Divider (gray-200)
│                                              │
│   [Current Step Content]                     │  ← PersonalInfoStep or CompanyCreationStep
│                                              │
└──────────────────────────────────────────────┘
```

**Behavior**:
- Maintains `currentStep` state (1 or 2)
- Determines initial step on mount:
  - If `user.firstName` is null: start at Step 1
  - If `user.firstName` exists but no company: start at Step 2
- Step 1 completion advances to Step 2
- Step 2 completion redirects to `/dashboard`
- Users cannot navigate backward (completed steps are locked)

---

### 5. OnboardingStepper

**File**: `components/onboarding/onboarding-stepper.tsx`

**Props**:
```typescript
interface OnboardingStepperProps {
  currentStep: 1 | 2;
}
```

**Visual Structure**:
```
  (1) Suas Informacoes ───── (2) Sua Empresa
  ↑ circle + label            ↑ circle + label
```

**Visual Specification**:
- Container: `flex` row, centered, `gap-24px`, `mb-32px`
- Step circle: `32px` diameter, `border-2`
  - Active: `blue-600` background, `white` number text
  - Complete: `green-600` background, `white` check icon (Lucide `Check`, 16px)
  - Pending: `gray-200` border, `gray-400` number text
- Step label: `body-sm` (13px)
  - Active: `navy-900`, weight 600
  - Complete: `gray-500`, weight 400
  - Pending: `gray-400`, weight 400
- Connector line between steps: `2px` height, `40px` width
  - Complete (step 1 done): `green-600`
  - Pending: `gray-200`

**i18n Keys Used**:
- `onboarding.stepper.step1` — "Suas Informacoes" / "Your Info"
- `onboarding.stepper.step2` — "Sua Empresa" / "Your Company"

---

### 6. PersonalInfoStep (Step 1)

**File**: `components/onboarding/personal-info-step.tsx`

**Props**:
```typescript
interface PersonalInfoStepProps {
  onComplete: () => void;  // Called after successful submission
}
```

**Visual Structure**:
```
┌──────────────────────────────────────────────┐
│                                              │
│   Suas Informacoes                           │  ← h3 (20px, weight 600), navy-900
│   Precisamos de alguns dados para comecar    │  ← body (14px), gray-500, mb-24px
│                                              │
│   Nome                                       │  ← label (13px, weight 500, gray-700)
│   ┌──────────────────────────────────────┐   │
│   │ Ex: Joao                             │   │  ← Input, 40px height, gray-300 border
│   └──────────────────────────────────────┘   │
│                                              │
│   Sobrenome                                  │
│   ┌──────────────────────────────────────┐   │
│   │ Ex: Silva                            │   │
│   └──────────────────────────────────────┘   │
│                                              │
│   E-mail                                     │
│   ┌──────────────────────────────────────┐   │
│   │ joao@example.com                     │   │  ← Pre-filled from Privy, editable
│   └──────────────────────────────────────┘   │
│   Pre-preenchido da sua conta                │  ← helper text (12px, gray-500)
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │           Continuar                  │   │  ← Primary button, full width
│   └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

**Form Fields**:

| Field | Type | Required | Validation | Max Length |
|-------|------|----------|------------|-----------|
| `firstName` | text input | Yes | Non-empty after trim | 100 chars |
| `lastName` | text input | Yes | Non-empty after trim | 100 chars |
| `email` | email input | Yes | Valid email format | 254 chars |

**Behavior**:
- Email field is pre-filled from `user.email` (from Privy/backend sync)
- Client-side validation via React Hook Form + Zod
- On submit: `PUT /api/v1/users/me` with `{ firstName, lastName, email }`
- On success: updates AuthContext user, calls `onComplete()`
- On validation error (400): maps `validationErrors` to form fields via `applyServerErrors()`
- On server error (5xx): shows error toast

**i18n Keys Used**:
- `onboarding.personalInfo.title`
- `onboarding.personalInfo.subtitle`
- `onboarding.personalInfo.firstName` (label)
- `onboarding.personalInfo.firstNamePlaceholder`
- `onboarding.personalInfo.lastName` (label)
- `onboarding.personalInfo.lastNamePlaceholder`
- `onboarding.personalInfo.email` (label)
- `onboarding.personalInfo.emailHelper`
- `common.continue` (button)

---

### 7. CompanyCreationStep (Step 2)

**File**: `components/onboarding/company-creation-step.tsx`

**Props**:
```typescript
interface CompanyCreationStepProps {
  onComplete: () => void;  // Called after successful company creation
}
```

**Visual Structure**:
```
┌──────────────────────────────────────────────┐
│                                              │
│   Sua Empresa                                │  ← h3 (20px, weight 600), navy-900
│   Configure sua empresa para gerenciar       │  ← body (14px), gray-500, mb-24px
│   o cap table                                │
│                                              │
│   [Company creation form fields]             │  ← Fields per company-management.md spec
│   (name, entityType, cnpj, etc.)             │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │        Criar Empresa                 │   │  ← Primary button, full width
│   └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

**Form Fields**: Defined in [company-management.md](./company-management.md). At minimum:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | text input | Yes | Company legal name |
| `entityType` | select | Yes | `LTDA` or `SA` |
| `cnpj` | text input (masked) | Yes | Brazilian CNPJ format: `XX.XXX.XXX/XXXX-XX` |

**Behavior**:
- Client-side CNPJ checksum validation before submission
- On submit: `POST /api/v1/companies` with company data
- On success (201): updates AuthContext (`hasCompany = true`), calls `onComplete()`, redirects to `/dashboard`
- On CNPJ duplicate (409): shows inline error on CNPJ field with `errors.company.cnpjDuplicate` message
- On validation error (400): maps `validationErrors` to form fields
- On server error (5xx): shows error toast

**i18n Keys Used**:
- `onboarding.companyCreation.title`
- `onboarding.companyCreation.subtitle`
- `onboarding.companyCreation.submit` (button)
- Additional field-level keys from company-management.md

---

### 8. AuthGuard

**File**: `components/auth/auth-guard.tsx`

**Props**:
```typescript
interface AuthGuardProps {
  children: React.ReactNode;
}
```

**Behavior**:
```
Component mounts
  │
  ├─ [isLoading = true] ─→ Render full-page centered spinner (blue-600, 20px)
  │
  ├─ [isAuthenticated = false] ─→ Redirect to /login (via next/navigation)
  │
  ├─ [isAuthenticated = true, needsOnboarding = true] ─→ Redirect to /onboarding
  │
  └─ [isAuthenticated = true, needsOnboarding = false] ─→ Render children
```

**Loading State Visual**:
- Full viewport height, `gray-50` background
- Centered spinner: circular, `blue-600` stroke, 20px diameter
- No text (fast resolution expected)

---

### 9. SessionExpiredToast

Triggered by the API client 401 interceptor, not a standalone component.

**Implementation**: Uses Sonner toast library.

**Behavior**:
```
API client receives 401 response
  │
  ├─ AuthContext.logout() called (clears state, Privy logout)
  ├─ Toast shown: warning variant, left border cream-700
  │     Text: "Sua sessao expirou. Faca login novamente." (i18n: errors.auth.sessionExpired)
  │     Auto-dismiss: 5 seconds
  └─ Redirect to /login?expired=true
```

---

## Frontend User Flows

### Flow 1: Founder Signup (New User, No Invitation)

```
User visits /login
  │
  ├─ [clicks "Entrar"] ─→ Privy modal opens
  │     │
  │     ├─ [selects email] ─→ enters email → receives code → verifies code
  │     ├─ [selects Google] ─→ Google OAuth redirect flow
  │     └─ [selects Apple] ─→ Apple OAuth redirect flow
  │
  ├─ [Privy auth success] ─→ POST /api/v1/auth/login (sync with backend)
  │     │
  │     ├─ [new user created] ─→ response: { user, isNewUser: true, hasCompany: false }
  │     │     └─→ redirect to /onboarding (Step 1: Personal Info)
  │     │           │
  │     │           ├─ [fills personal info + submits] ─→ PUT /api/v1/users/me
  │     │           │     ├─ [success] ─→ advance to Step 2: Company Creation
  │     │           │     └─ [validation error] ─→ show field errors
  │     │           │
  │     │           └─ Step 2: Company Creation
  │     │                 ├─ [fills company info + submits] ─→ POST /api/v1/companies
  │     │                 │     ├─ [success] ─→ redirect to /dashboard
  │     │                 │     ├─ [CNPJ duplicate] ─→ 409, show inline error on CNPJ field
  │     │                 │     └─ [validation error] ─→ show field errors
  │     │                 └─ [user closes browser] ─→ next login resumes at incomplete step
  │     │
  │     └─ [backend sync fails] ─→ show error toast, Privy remains logged in, button re-enabled
  │
  └─ [Privy auth fails / user cancels modal] ─→ Privy shows error or modal closes, no state change
```

**Step-by-step**:

```
PRECONDITION: User has no existing Navia account
ACTOR: New user (founder)
TRIGGER: User navigates to /login

1.  [UI] User sees LoginPage with Navia logo, "Bem-vindo ao Navia" heading, and "Entrar" button
2.  [UI] User clicks "Entrar" button
3.  [Frontend] Calls privy.login() which opens the Privy authentication modal
4.  [UI] Privy modal displays login method options (email, Google, Apple)
5.  [UI] User selects a method and completes authentication within Privy modal
6.  [Frontend] Privy onSuccess callback fires with auth token
7.  [UI] Login button shows spinner with "Entrar" text replaced, fields disabled
8.  [Frontend] Sends POST /api/v1/auth/login with Privy access token
9.  [Backend] Verifies Privy token, creates new User record, sets HTTP-only session cookie
10. [Backend] Returns { user: { id, email, firstName: null, lastName: null, ... }, isNewUser: true, hasCompany: false }
11. [Frontend] AuthContext updates: isAuthenticated=true, user set, needsOnboarding=true
12. [Frontend] AuthGuard detects needsOnboarding=true, redirects to /onboarding
13. [UI] OnboardingWizard renders Step 1 (PersonalInfoStep)
    - OnboardingStepper shows: (1) Suas Informacoes [active, blue-600] ── (2) Sua Empresa [pending, gray-300]
14. [UI] User fills firstName, lastName; email is pre-filled from Privy account
15. [UI] User clicks "Continuar"
16. [Frontend] Client-side validation via React Hook Form + Zod
    → IF invalid: show field-level errors (red border, error text below field), STOP
17. [Frontend] Sends PUT /api/v1/users/me with { firstName, lastName, email }
18. [Backend] Validates input, updates user record, returns updated user
19. [Frontend] Updates AuthContext user data (firstName, lastName now populated)
20. [UI] OnboardingWizard advances to Step 2 (CompanyCreationStep)
    - OnboardingStepper shows: (1) Suas Informacoes [complete, green check] ── (2) Sua Empresa [active, blue-600]
21. [UI] User fills company name, entityType (Ltda. or S.A.), CNPJ, and optional fields
22. [UI] User clicks "Criar Empresa"
23. [Frontend] Client-side validation (including CNPJ checksum algorithm)
    → IF invalid: show field-level errors, STOP
24. [Frontend] Sends POST /api/v1/companies with company data
25. [Backend] Validates input, creates company in DRAFT status, queues async CNPJ validation job
26. [Backend] Returns 201 with { id, name, status: 'DRAFT', ... }
27. [Frontend] AuthContext updates: hasCompany=true, needsOnboarding=false
28. [Frontend] Redirects to /dashboard
29. [UI] Dashboard renders with CompanySetupProgress card showing CNPJ validation in progress

POSTCONDITION: User has profile data + company in DRAFT status
SIDE EFFECTS:
  - Audit log: AUTH_LOGIN_SUCCESS, COMPANY_CREATED
  - CNPJ validation Bull job queued
  - Blockchain contract deployment queued (triggered after CNPJ validation succeeds)
```

---

### Flow 2: Returning User Login (Has Company)

```
User visits /login
  │
  ├─ [Privy auth success] ─→ POST /api/v1/auth/login
  │     │
  │     └─ [existing user, has company] ─→ redirect to /dashboard
  │
  └─ [Privy auto-login (saved session)] ─→ Same as above, no modal needed
```

**Step-by-step**:

```
PRECONDITION: User has existing Navia account with at least one company
ACTOR: Returning user
TRIGGER: User navigates to /login

1.  [UI] User sees LoginPage
2.  [UI] User clicks "Entrar"
3.  [Frontend] Calls privy.login()
4.  [UI] User completes Privy auth (may auto-login with saved session — no modal)
5.  [Frontend] Privy callback fires with auth token
6.  [Frontend] Sends POST /api/v1/auth/login with Privy token
7.  [Backend] Verifies token, finds existing user, updates lastLoginAt, sets session cookie
8.  [Backend] Returns { user: { id, email, firstName: "Joao", ... }, isNewUser: false, hasCompany: true }
9.  [Frontend] AuthContext updates: isAuthenticated=true, hasCompany=true, needsOnboarding=false
10. [Frontend] AuthGuard allows access, renders dashboard
11. [UI] User lands on /dashboard

POSTCONDITION: User is authenticated and on dashboard
SIDE EFFECTS: Audit log (AUTH_LOGIN_SUCCESS), User.lastLoginAt updated
```

---

### Flow 3: Returning User with Incomplete Onboarding

```
User visits /login
  │
  ├─ [Privy auth success] ─→ POST /api/v1/auth/login
  │     │
  │     ├─ [user.firstName is null, no company] ─→ redirect to /onboarding Step 1
  │     └─ [user.firstName exists, no company] ─→ redirect to /onboarding Step 2
  │
  └─ [resumes onboarding from last incomplete step]
```

**Step-by-step**:

```
PRECONDITION: User created account previously but did not complete onboarding
ACTOR: Returning user
TRIGGER: User logs in

1-6. Same as Returning User Login (steps 1-6)
7.   [Backend] Returns { user: { firstName: "Joao" | null, ... }, isNewUser: false, hasCompany: false }
8.   [Frontend] AuthContext: isAuthenticated=true, needsOnboarding=true
9.   [Frontend] AuthGuard redirects to /onboarding
10.  [Frontend] OnboardingWizard determines initial step:
     → IF user.firstName is null: render Step 1 (PersonalInfoStep)
     → IF user.firstName exists: render Step 2 (CompanyCreationStep)
11.  [UI] User completes the remaining onboarding step(s)
12.  [Frontend] On company creation success: redirect to /dashboard

POSTCONDITION: User completes onboarding and reaches dashboard
```

---

### Flow 4: Session Expiry

```
User is on any protected page
  │
  ├─ [makes API call] ─→ Backend returns 401 Unauthorized
  │     │
  │     ├─ [Frontend] API client 401 interceptor catches response
  │     ├─ [Frontend] Calls authContext.logout()
  │     │     ├─ POST /api/v1/auth/logout (best-effort, ignore failure)
  │     │     ├─ privy.logout()
  │     │     └─ Clear AuthContext state (user=null, isAuthenticated=false)
  │     ├─ [UI] SessionExpiredToast shown: "Sua sessao expirou. Faca login novamente."
  │     └─ [Frontend] Redirects to /login?expired=true
  │
  └─ [LoginPage renders]
        └─ [?expired=true detected] ─→ Info banner shown above login button
              Text: "Sua sessao expirou. Faca login novamente."
              Style: blue-50 bg, blue-600 text, radius-md, padding 12px
```

**Step-by-step**:

```
PRECONDITION: User has an active session that has expired (2h inactivity or 7d absolute)
ACTOR: Authenticated user
TRIGGER: Any API call returns 401

1.  [Frontend] User performs an action that triggers an API call
2.  [Backend] AuthGuard detects expired/invalid token
3.  [Backend] Returns 401 with error code AUTH_SESSION_EXPIRED or AUTH_INVALID_TOKEN
4.  [Frontend] API client response interceptor catches 401
5.  [Frontend] Calls authContext.logout()
6.  [Frontend] POST /api/v1/auth/logout sent (best-effort, failure ignored)
7.  [Frontend] privy.logout() called to clear Privy session
8.  [Frontend] AuthContext state cleared: user=null, isAuthenticated=false
9.  [UI] Sonner toast appears (warning variant): "Sua sessao expirou. Faca login novamente."
10. [Frontend] Router navigates to /login?expired=true
11. [UI] LoginPage renders with info banner above the Sign In button

POSTCONDITION: User is logged out, session cleared, on login page
SIDE EFFECTS: None (session was already expired server-side)
```

---

### Flow 5: Logout

```
User clicks "Sair" in sidebar
  │
  ├─ [Frontend] POST /api/v1/auth/logout
  ├─ [Backend] Clears session cookie
  ├─ [Frontend] privy.logout()
  ├─ [Frontend] AuthContext state cleared
  └─ [Frontend] Redirect to /login
```

**Step-by-step**:

```
PRECONDITION: User is authenticated
ACTOR: Authenticated user
TRIGGER: User clicks "Sair" / "Logout" button in sidebar

1.  [UI] User clicks "Sair" in the sidebar bottom section
2.  [Frontend] Calls authContext.logout()
3.  [Frontend] Sends POST /api/v1/auth/logout
4.  [Backend] Clears navia-auth-token cookie, returns 200
5.  [Frontend] Calls privy.logout() to clear Privy session state
6.  [Frontend] AuthContext state set to: user=null, isAuthenticated=false
7.  [Frontend] Router navigates to /login
8.  [UI] LoginPage renders (clean state, no expired banner)

POSTCONDITION: User fully logged out (backend session + Privy session + frontend state)
SIDE EFFECTS: Audit log (AUTH_LOGOUT)
```

---

### Flow 6: Page Refresh with Valid Session

```
User refreshes browser on any protected page
  │
  ├─ [Frontend] App mounts, AuthContext initializes (isLoading=true)
  ├─ [Frontend] usePrivy() checks Privy session state
  │     │
  │     ├─ [Privy has valid session] ─→ GET /api/v1/auth/me
  │     │     │
  │     │     ├─ [200 OK] ─→ AuthContext populated, page renders normally
  │     │     └─ [401] ─→ Session expired, logout + redirect to /login
  │     │
  │     └─ [Privy has no session] ─→ AuthContext: isAuthenticated=false
  │           └─ AuthGuard redirects to /login
  │
  └─ [AuthGuard] Shows full-page spinner while isLoading=true
```

**Step-by-step**:

```
PRECONDITION: User had an active session before page refresh
ACTOR: Authenticated user
TRIGGER: Browser page refresh (F5, Cmd+R, or navigation)

1.  [Frontend] App mounts, PrivyAuthProvider initializes
2.  [Frontend] AuthContext sets isLoading=true
3.  [UI] AuthGuard renders full-page spinner (blue-600, centered)
4.  [Frontend] usePrivy() checks for existing Privy session (cookie/storage)
5.  [Frontend] If Privy session exists: sends GET /api/v1/auth/me with session cookie
6.  [Backend] AuthGuard verifies token from cookie
    → IF valid: returns 200 with full user profile + company membership data
    → IF invalid: returns 401
7a. [Frontend] On 200: AuthContext updates with user data, isLoading=false
    [UI] AuthGuard renders page children normally
7b. [Frontend] On 401: triggers logout flow (Flow 4), redirects to /login
8.  [Frontend] If no Privy session: AuthContext sets isAuthenticated=false, isLoading=false
    [Frontend] AuthGuard redirects to /login

POSTCONDITION: User either sees the page (valid session) or is redirected to login (expired)
```

---

### Post-Login Routing Logic (Consolidated)

```
User authenticates via Privy → POST /api/v1/auth/login
  │
  ├─ [new user, no profile] ─→ has invitation token in URL?
  │     ├─ [yes] ─→ /invitations/:token (invited user flow — see company-membership.md)
  │     └─ [no]  ─→ /onboarding (Step 1: Personal Info)
  │
  ├─ [existing user, has profile, no company] ─→ has invitation token?
  │     ├─ [yes] ─→ /invitations/:token
  │     └─ [no]  ─→ /onboarding (Step 2: Company Creation)
  │
  └─ [existing user, has company] ─→ /dashboard
```

---

## UI States & Error Handling

### LoginPage States

| State | Visual | Trigger |
|-------|--------|---------|
| Default | Login card with Navia logo, heading, subtitle, and "Entrar" button (blue-600, enabled) | Page load |
| Session Expired Banner | Info banner above button: blue-50 bg, blue-600 text, radius-md, p-12px | URL contains `?expired=true` |
| Privy Modal Open | Privy modal overlays the page; login button remains visible behind modal | User clicks "Entrar" |
| Syncing with Backend | Button shows spinner, text changes to syncing indicator, button disabled | Privy auth completes successfully |
| Backend Sync Error | Error toast (Sonner, destructive variant), button re-enabled | POST /api/v1/auth/login fails (5xx) |
| Account Locked | Error toast: `errors.auth.accountLocked` message | 429 response from backend |
| Privy Unavailable | Error toast: `errors.auth.privyUnavailable` + suggestion to retry | 502 response from backend |

### OnboardingWizard States

| State | Visual | Trigger |
|-------|--------|---------|
| Step 1 Idle | PersonalInfoStep form with empty firstName/lastName, pre-filled email | Initial render (no profile data) |
| Step 1 Submitting | "Continuar" button shows spinner, all form fields disabled | Form submit clicked |
| Step 1 Validation Error | Red borders on invalid fields, error text below each field (12px, #DC2626) | Client-side or server-side validation failure |
| Step 1 Server Error | Error toast (Sonner) | PUT /api/v1/users/me returns 5xx |
| Step 2 Idle | CompanyCreationStep form with empty fields | Step 1 completed or returning user |
| Step 2 Submitting | "Criar Empresa" button shows spinner, all form fields disabled | Form submit clicked |
| Step 2 CNPJ Duplicate | Inline error on CNPJ field: "CNPJ ja cadastrado" (i18n: `errors.company.cnpjDuplicate`) | 409 from POST /api/v1/companies |
| Step 2 Validation Error | Red borders on invalid fields, error text below each field | Validation failure |
| Step 2 Server Error | Error toast (Sonner) | POST /api/v1/companies returns 5xx |

### AuthGuard States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Full-page centered spinner: `gray-50` bg, `blue-600` circular spinner (20px), no text | Checking auth state (isLoading=true) |
| Authenticated | Renders children (dashboard content) | Auth verified and onboarding complete |
| Unauthenticated | Nothing rendered (redirect to /login in progress) | No valid session detected |
| Needs Onboarding | Nothing rendered (redirect to /onboarding in progress) | Auth valid but missing profile or company |

### Error Code to UI Mapping

| Error Code | HTTP Status | UI Behavior |
|------------|-------------|-------------|
| `AUTH_INVALID_TOKEN` | 401 | Logout + redirect to /login + SessionExpiredToast |
| `AUTH_SESSION_EXPIRED` | 401 | Logout + redirect to /login?expired=true + SessionExpiredToast |
| `AUTH_SESSION_NOT_FOUND` | 401 | Logout + redirect to /login + SessionExpiredToast |
| `AUTH_ACCOUNT_LOCKED` | 429 | Error toast: `errors.auth.accountLocked` — "Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos." |
| `AUTH_PRIVY_UNAVAILABLE` | 502 | Error toast: `errors.auth.privyUnavailable` — "Servico de autenticacao indisponivel. Tente novamente." |
| `AUTH_DUPLICATE_EMAIL` | 409 | Error toast: `errors.auth.duplicateEmail` |
| `AUTH_DUPLICATE_WALLET` | 409 | Error toast: `errors.auth.duplicateWallet` |
| `VAL_INVALID_INPUT` | 400 | Map `validationErrors` array to React Hook Form field errors via `applyServerErrors()` utility |
| `COMPANY_CNPJ_DUPLICATE` | 409 | Inline error on CNPJ field: `errors.company.cnpjDuplicate` |
| `SYS_INTERNAL_ERROR` | 500 | Error toast: `errors.sys.internalError` — generic server error message |
| `SYS_RATE_LIMITED` | 429 | Warning toast with `retryAfter` countdown from `details` |

### Toast Configuration

All toasts use the Sonner library with these defaults:

| Variant | Left Border Color | Icon | Auto-dismiss |
|---------|-------------------|------|-------------|
| Success | `green-600` | Check circle (Lucide) | 5 seconds |
| Error / Destructive | `#DC2626` | Alert circle (Lucide) | Persistent (manual dismiss) |
| Warning | `cream-700` | Alert triangle (Lucide) | Persistent |
| Info | `blue-600` | Info circle (Lucide) | 5 seconds |

Toast container position: top-right, 16px from viewport edges. Max width: 360px.

---

## Integration Details

### Privy SDK Configuration

```typescript
// File: app/layout.tsx (PrivyAuthProvider wrapper)

import { PrivyProvider } from '@privy-io/react-auth';

const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  config: {
    loginMethods: ['email', 'google', 'apple'],
    appearance: {
      theme: 'light' as const,
      accentColor: '#1B6B93',  // brand blue-600 (Cornflower Ocean)
      logo: '/logo.svg',       // Navia logo
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
  },
};
```

### Auth Cookie Pattern

- Backend sets HTTP-only, Secure, SameSite=Strict cookie (`navia-auth-token`) on successful `POST /api/v1/auth/login`
- Cookie max-age: 7 days (absolute session expiry)
- Frontend API client sends cookies automatically via `credentials: 'include'`
- No tokens stored in localStorage or sessionStorage (XSS prevention)
- CSRF protection via double-submit cookie pattern (see security.md)

### API Client 401 Interceptor

```typescript
// Pseudocode for API client response interceptor

async function handleResponse(response: Response): Promise<any> {
  if (response.status === 401) {
    // Avoid infinite loop: don't intercept 401 on logout endpoint
    if (!response.url.includes('/auth/logout')) {
      await authContext.logout();
      router.push('/login?expired=true');
      toast.warning(t('errors.auth.sessionExpired'));
    }
    throw new ApiError(await response.json());
  }
  // ... handle other statuses
}
```

### AuthContext Implementation Pattern

```typescript
// File: contexts/auth-context.tsx

// Key implementation notes:
//
// 1. AuthContext wraps usePrivy() and adds backend sync
// 2. On Privy auth change (authenticated → true), POST /api/v1/auth/login
// 3. On Privy auth change (authenticated → false), clear user state
// 4. GET /api/v1/auth/me used for page refresh re-hydration
// 5. hasCompany derived from login response or /auth/me response
// 6. needsOnboarding = isAuthenticated && (!user.firstName || !hasCompany)
```

### React Hook Form + Server Error Integration

```typescript
// Utility: applyServerErrors()
// Maps backend validationErrors to React Hook Form field errors

function applyServerErrors(
  errors: Array<{ field: string; messageKey: string }>,
  setError: UseFormSetError<any>,
  t: (key: string) => string,
) {
  for (const err of errors) {
    setError(err.field, {
      type: 'server',
      message: t(err.messageKey),
    });
  }
}
```

### TanStack Query Configuration for Auth

```typescript
// Auth-related queries should NOT retry on 401/403/422

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Don't retry auth errors, validation errors, or business rule errors
          if ([401, 403, 422].includes(error.statusCode)) return false;
        }
        return failureCount < 2;
      },
    },
  },
});
```

---

## i18n Keys

All user-facing strings for the authentication and onboarding features. These keys must be added to both `messages/pt-BR.json` and `messages/en.json`.

### auth namespace

| Key | PT-BR | EN |
|-----|-------|-----|
| `auth.login.title` | Bem-vindo ao Navia | Welcome to Navia |
| `auth.login.subtitle` | Faca login para continuar | Sign in to continue |
| `auth.login.signIn` | Entrar | Sign In |
| `auth.login.sessionExpired` | Sua sessao expirou. Faca login novamente. | Your session has expired. Please sign in again. |
| `auth.logout.button` | Sair | Logout |

### onboarding namespace

| Key | PT-BR | EN |
|-----|-------|-----|
| `onboarding.stepper.step1` | Suas Informacoes | Your Info |
| `onboarding.stepper.step2` | Sua Empresa | Your Company |
| `onboarding.personalInfo.title` | Suas Informacoes | Your Information |
| `onboarding.personalInfo.subtitle` | Precisamos de alguns dados para comecar | We need a few details to get started |
| `onboarding.personalInfo.firstName` | Nome | First Name |
| `onboarding.personalInfo.firstNamePlaceholder` | Ex: Joao | e.g., John |
| `onboarding.personalInfo.lastName` | Sobrenome | Last Name |
| `onboarding.personalInfo.lastNamePlaceholder` | Ex: Silva | e.g., Smith |
| `onboarding.personalInfo.email` | E-mail | Email |
| `onboarding.personalInfo.emailHelper` | Pre-preenchido da sua conta | Pre-filled from your account |
| `onboarding.companyCreation.title` | Sua Empresa | Your Company |
| `onboarding.companyCreation.subtitle` | Configure sua empresa para gerenciar o cap table | Set up your company to manage the cap table |
| `onboarding.companyCreation.submit` | Criar Empresa | Create Company |

### common namespace (shared)

| Key | PT-BR | EN |
|-----|-------|-----|
| `common.continue` | Continuar | Continue |

### errors namespace (auth-related)

| Key | PT-BR | EN |
|-----|-------|-----|
| `errors.auth.accountLocked` | Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos. | Account locked due to too many attempts. Try again in 15 minutes. |
| `errors.auth.privyUnavailable` | Servico de autenticacao indisponivel. Tente novamente. | Authentication service unavailable. Please try again. |
| `errors.auth.sessionExpired` | Sua sessao expirou. Faca login novamente. | Your session has expired. Please sign in again. |
| `errors.auth.invalidToken` | Token de autenticacao invalido. | Invalid authentication token. |
| `errors.auth.duplicateEmail` | Este e-mail ja esta associado a outra conta. | This email is already associated with another account. |
| `errors.auth.duplicateWallet` | Esta carteira ja esta associada a outra conta. | This wallet is already associated with another account. |

---

## Frontend Success Criteria

- [ ] LoginPage renders correctly with Navia branding (logo, navy/blue theme, auth layout)
- [ ] Privy modal opens on "Entrar" click with email, Google, and Apple options
- [ ] Successful Privy auth triggers backend sync (POST /api/v1/auth/login)
- [ ] New users are redirected to /onboarding Step 1
- [ ] Returning users without a company resume onboarding at the correct step
- [ ] Returning users with a company are redirected to /dashboard
- [ ] PersonalInfoStep validates and submits to PUT /api/v1/users/me
- [ ] CompanyCreationStep validates (including CNPJ checksum) and submits to POST /api/v1/companies
- [ ] CNPJ duplicate (409) shows inline field error, not just a toast
- [ ] Validation errors (400) map to individual form fields via applyServerErrors()
- [ ] AuthGuard blocks unauthenticated access to dashboard routes
- [ ] AuthGuard redirects users needing onboarding to /onboarding
- [ ] 401 API responses trigger logout + toast + redirect to /login?expired=true
- [ ] Page refresh with valid session re-hydrates AuthContext via GET /api/v1/auth/me
- [ ] Logout clears backend session, Privy session, and frontend state
- [ ] All user-facing strings use i18n keys (no hardcoded strings)
- [ ] Both PT-BR and EN translations are present for all keys
- [ ] Loading states show appropriate spinners (button-level for actions, full-page for AuthGuard)
- [ ] Error toasts follow design system spec (Sonner, positioned top-right, correct variants)
