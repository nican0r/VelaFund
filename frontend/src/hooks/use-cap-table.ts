import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { CapTable } from '@/types/company';

export function useCapTable(companyId: string | undefined) {
  return useQuery({
    queryKey: ['cap-table', companyId],
    queryFn: () =>
      api.get<CapTable>(`/api/v1/companies/${companyId}/cap-table`),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}
