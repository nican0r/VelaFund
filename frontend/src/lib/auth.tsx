'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api-client';
import { setOnUnauthorized } from '@/lib/api-client';

interface User {
  id: string;
  privyUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  walletAddress: string | null;
  kycStatus: string;
  locale: string;
}

interface AuthContextValue {
  /** Privy SDK has finished loading */
  isReady: boolean;
  /** User is authenticated with both Privy and backend */
  isAuthenticated: boolean;
  /** Whether initial login is in progress */
  isLoggingIn: boolean;
  /** Current backend user profile */
  user: User | null;
  /** Whether this user was just created (first login) */
  isNewUser: boolean;
  /** Whether the user needs to complete onboarding */
  needsOnboarding: boolean;
  /** Trigger Privy login modal */
  login: () => void;
  /** Logout from backend + Privy */
  logout: () => Promise<void>;
  /** Refresh user profile from backend */
  refreshUser: () => Promise<void>;
  /** Mark onboarding as complete (clears needsOnboarding) */
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    ready,
    authenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hasBackendSession, setHasBackendSession] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // When Privy authenticates, create a backend session.
  // Uses a ref guard instead of a cancelled flag to avoid the cleanup race condition
  // where React re-runs the effect (due to isLoggingIn state change) before the async
  // work completes, which would leave isLoggingIn permanently stuck at true.
  const isLoggingInRef = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || hasBackendSession || isLoggingInRef.current) return;

    isLoggingInRef.current = true;
    setIsLoggingIn(true);

    async function createBackendSession() {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const result = await api.post<{ user: User; isNewUser: boolean }>(
          '/api/v1/auth/login',
          { privyAccessToken: token },
        );

        setUser(result.user);
        setHasBackendSession(true);
        setIsNewUser(result.isNewUser);

        // Detect if onboarding is needed:
        // - New user without firstName (needs personal info + company)
        // - Existing user without firstName (incomplete onboarding)
        if (result.isNewUser || !result.user.firstName) {
          setNeedsOnboarding(true);
        }

        // Set locale cookie for next-intl
        if (result.user.locale) {
          document.cookie = `navia-locale=${result.user.locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=strict`;
        }
      } catch {
        // If backend login fails, log out of Privy too
        await privyLogout();
        setHasBackendSession(false);
      } finally {
        isLoggingInRef.current = false;
        setIsLoggingIn(false);
      }
    }

    createBackendSession();
  }, [ready, authenticated, hasBackendSession, getAccessToken, privyLogout]);

  // Load user profile if we have a session but no user data (e.g., page refresh)
  useEffect(() => {
    if (!ready || !authenticated || user || isLoggingIn) return;

    let cancelled = false;

    async function fetchProfile() {
      try {
        const profile = await api.get<User>('/api/v1/auth/me');
        if (!cancelled) {
          setUser(profile);
          setHasBackendSession(true);

          // Check onboarding state on page refresh too
          if (!profile.firstName) {
            setNeedsOnboarding(true);
          }
        }
      } catch {
        // Session invalid — will be handled on next request
      }
    }

    // Only try /me if we haven't started the login flow
    if (hasBackendSession) {
      fetchProfile();
    }

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user, isLoggingIn, hasBackendSession]);

  // Redirect logic: auth pages, dashboard, and onboarding
  useEffect(() => {
    if (!ready) return;
    const isAuthPage = pathname.startsWith('/login');
    const isDashboardPage = pathname.startsWith('/dashboard');
    const isOnboardingPage = pathname.startsWith('/onboarding');

    if (!authenticated && (isDashboardPage || isOnboardingPage)) {
      router.replace('/login');
    } else if (authenticated && hasBackendSession) {
      if (needsOnboarding && !isOnboardingPage) {
        router.replace('/onboarding');
      } else if (!needsOnboarding && (isAuthPage || isOnboardingPage)) {
        router.replace('/dashboard');
      }
    }
  }, [ready, authenticated, hasBackendSession, needsOnboarding, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Best effort — continue with Privy logout
    }
    await privyLogout();
    setUser(null);
    setHasBackendSession(false);
    setIsNewUser(false);
    setNeedsOnboarding(false);
    router.replace('/login');
  }, [privyLogout, router]);

  // Wire the API client's 401 handler to trigger logout
  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
    return () => setOnUnauthorized(null);
  }, [logout]);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await api.get<User>('/api/v1/auth/me');
      setUser(profile);
    } catch {
      // If refresh fails, stay with current data
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    setIsNewUser(false);
  }, []);

  const value: AuthContextValue = {
    isReady: ready,
    isAuthenticated: ready && authenticated && hasBackendSession,
    isLoggingIn,
    user,
    isNewUser,
    needsOnboarding,
    login: privyLogin,
    logout,
    refreshUser,
    completeOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
