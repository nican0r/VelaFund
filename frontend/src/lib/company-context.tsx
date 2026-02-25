'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import type { CompanyListItem } from '@/types/company';

interface CompanyContextValue {
  /** All companies the user is a member of */
  companies: CompanyListItem[];
  /** Currently selected company */
  selectedCompany: CompanyListItem | null;
  /** Switch to a different company */
  setSelectedCompanyId: (id: string) => void;
  /** Whether company list is loading */
  isLoading: boolean;
  /** Error fetching companies */
  error: Error | null;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

const STORAGE_KEY = 'navia-selected-company';

function getPersistedCompanyId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistCompanyId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage may be unavailable
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(
    getPersistedCompanyId,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies'],
    queryFn: () =>
      api.getList<CompanyListItem>('/api/v1/companies?limit=100'),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const companies = data?.data ?? [];

  // Auto-select first active company if none selected or selection is invalid
  useEffect(() => {
    if (!companies.length) return;

    const currentSelection = companies.find((c) => c.id === selectedId);
    if (currentSelection) return;

    const active = companies.find((c) => c.status === 'ACTIVE');
    const fallback = active || companies[0];
    if (fallback) {
      setSelectedId(fallback.id);
      persistCompanyId(fallback.id);
    }
  }, [companies, selectedId]);

  const setSelectedCompanyId = useCallback((id: string) => {
    setSelectedId(id);
    persistCompanyId(id);
  }, []);

  const selectedCompany =
    companies.find((c) => c.id === selectedId) ?? null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        setSelectedCompanyId,
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
