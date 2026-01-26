# Authentication Specification

**Topic of Concern**: User authentication and wallet management via Privy

**One-Sentence Description**: The system provides secure user authentication with embedded wallet creation through Privy.

---

## Overview

VelaFund uses Privy as the authentication provider to enable seamless user login with automatic embedded wallet creation. Users can authenticate via email, Google OAuth, or Apple OAuth without needing crypto knowledge. Each user receives a non-custodial embedded wallet managed by Privy for blockchain identity and document signing.

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
- The system MUST store: privy_user_id, email, wallet_address
- The system SHOULD store: first_name, last_name, profile_picture_url
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
  privy_user_id: string;         // Unique Privy user identifier
  email: string;                 // Primary email (unique)
  wallet_address: string;        // Ethereum wallet address (unique)
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;

  // KYC fields
  kyc_status: KYCStatus;         // not_started | in_progress | approved | rejected
  verification_level: VerificationLevel; // none | basic | standard | enhanced

  // Metadata
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}
```

### Session Data (stored in Context/Redis)

```typescript
interface AuthSession {
  user_id: string;
  privy_access_token: string;
  wallet_address: string;
  expires_at: Date;
  last_activity_at: Date;
}
```

---

## API Endpoints

### POST /api/v1/auth/login
**Description**: Authenticate user with Privy token and create/sync user profile

**Request**:
```json
{
  "privy_access_token": "string"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "wallet_address": "0x...",
    "first_name": "John",
    "last_name": "Doe",
    "kyc_status": "not_started"
  },
  "session": {
    "expires_at": "2024-01-30T12:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized` - Invalid or expired Privy token
- `500 Internal Server Error` - Failed to create user or verify token

---

### POST /api/v1/auth/logout
**Description**: Invalidate current user session

**Request**: No body (uses session cookie/token)

**Response** (200 OK):
```json
{
  "message": "Successfully logged out"
}
```

---

### GET /api/v1/auth/me
**Description**: Get current authenticated user profile

**Request**: No body (uses session cookie/token)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "wallet_address": "0x...",
  "first_name": "John",
  "last_name": "Doe",
  "kyc_status": "approved",
  "verification_level": "standard",
  "created_at": "2024-01-01T12:00:00Z"
}
```

**Error Responses**:
- `401 Unauthorized` - No valid session

---

### POST /api/v1/auth/refresh
**Description**: Refresh access token without re-login

**Request**:
```json
{
  "refresh_token": "string"
}
```

**Response** (200 OK):
```json
{
  "access_token": "string",
  "expires_at": "2024-01-30T12:00:00Z"
}
```

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
1. User visits VelaFund landing page
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
1. User visits VelaFund and clicks "Login"
2. Privy modal appears
3. User authenticates (email/Google/Apple)
4. Privy returns Access Token
5. Frontend sends POST /api/v1/auth/login
6. Backend verifies token
7. Backend fetches existing user record
8. Backend updates last_login_at timestamp
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
**Handling**: Show user-friendly error: "Authentication service temporarily unavailable. Please try again in a few minutes."

### EC-2: Network Interruption During Login
**Scenario**: User loses internet connection mid-authentication
**Handling**: Frontend shows reconnection prompt and retries token verification

### EC-3: Duplicate Wallet Address
**Scenario**: Privy returns a wallet address already in database (edge case)
**Handling**: Backend rejects registration and logs error for investigation

### EC-4: Token Verification Failure
**Scenario**: Privy token is invalid or expired
**Handling**: Return 401 with message "Invalid authentication token. Please log in again."

### EC-5: User Deleted During Session
**Scenario**: User account deleted while session is active
**Handling**: Next API call returns 401 Unauthorized; prompt user to contact support

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
import { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }) {
  const { user: privyUser, authenticated, login, logout } = usePrivy();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (authenticated && privyUser) {
      // Sync with backend
      syncUserProfile(privyUser.id);
    }
  }, [authenticated, privyUser]);

  const syncUserProfile = async (privyUserId: string) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privy_access_token: await getAccessToken() }),
    });
    const data = await response.json();
    setUser(data.user);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: authenticated, isLoading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Backend (NestJS)

```typescript
// /backend/src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private privyClient: PrivyClient;

  constructor(private prisma: PrismaService) {
    this.privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET,
    );
  }

  async verifyAndSyncUser(privyAccessToken: string) {
    // Verify token with Privy
    const verifiedClaims = await this.privyClient.verifyAuthToken(privyAccessToken);

    // Get or create user
    const user = await this.prisma.user.upsert({
      where: { privy_user_id: verifiedClaims.userId },
      update: { last_login_at: new Date() },
      create: {
        privy_user_id: verifiedClaims.userId,
        email: verifiedClaims.email,
        wallet_address: verifiedClaims.wallet?.address,
        kyc_status: 'NOT_STARTED',
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
