import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api-client';
import type { CompanyProfile } from '@/types/company';

/**
 * Fetch the company profile for the dashboard.
 * Returns null data (not error) when profile doesn't exist (404),
 * since a missing profile is a normal state — the founder hasn't created one yet.
 */
export function useCompanyProfile(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-profile', companyId],
    queryFn: async () => {
      try {
        return await api.get<CompanyProfile>(
          `/api/v1/companies/${companyId}/profile`,
        );
      } catch (error) {
        // 404 means no profile exists yet — not an error state
        if (error instanceof ApiError && error.statusCode === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}
