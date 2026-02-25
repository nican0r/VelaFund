'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ConvertibleInstrument } from '@/types/company';

export interface ConvertibleSummary {
  totalOutstanding: number;
  totalPrincipal: string;
  totalAccruedInterest: string;
  totalValue: string;
}

export interface ConvertiblesParams {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
}

export function useConvertibles(
  companyId: string | undefined,
  params?: ConvertiblesParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();

  return useQuery({
    queryKey: ['convertibles', companyId, params],
    queryFn: () =>
      api.getList<ConvertibleInstrument>(
        `/api/v1/companies/${companyId}/convertibles${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useConvertible(
  companyId: string | undefined,
  convertibleId: string | undefined,
) {
  return useQuery({
    queryKey: ['convertibles', companyId, convertibleId],
    queryFn: () =>
      api.get<ConvertibleInstrument>(
        `/api/v1/companies/${companyId}/convertibles/${convertibleId}`,
      ),
    enabled: !!companyId && !!convertibleId,
    staleTime: 30 * 1000,
  });
}

export function useCancelConvertible(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (convertibleId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/convertibles/${convertibleId}/cancel`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convertibles', companyId] });
    },
  });
}
