import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Transaction } from '@/types/company';

export function useRecentTransactions(companyId: string | undefined) {
  return useQuery({
    queryKey: ['transactions', companyId, 'recent'],
    queryFn: () =>
      api.getList<Transaction>(
        `/api/v1/companies/${companyId}/transactions?limit=5&sort=-createdAt`,
      ),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}
