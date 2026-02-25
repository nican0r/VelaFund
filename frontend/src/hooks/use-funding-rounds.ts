import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { FundingRound, FundingRoundDetail } from '@/types/company';

export interface FundingRoundsParams {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
}

export function useFundingRounds(
  companyId: string | undefined,
  params?: FundingRoundsParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();

  return useQuery({
    queryKey: ['funding-rounds', companyId, params],
    queryFn: () =>
      api.getList<FundingRound>(
        `/api/v1/companies/${companyId}/funding-rounds${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useFundingRound(
  companyId: string | undefined,
  roundId: string | undefined,
) {
  return useQuery({
    queryKey: ['funding-rounds', companyId, roundId],
    queryFn: () =>
      api.get<FundingRoundDetail>(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}`,
      ),
    enabled: !!companyId && !!roundId,
    staleTime: 30 * 1000,
  });
}

// --- Create funding round ---

export interface CreateFundingRoundData {
  name: string;
  roundType: 'PRE_SEED' | 'SEED' | 'SERIES_A' | 'SERIES_B' | 'SERIES_C' | 'BRIDGE' | 'OTHER';
  shareClassId: string;
  targetAmount: string;
  minimumCloseAmount?: string;
  hardCap?: string;
  preMoneyValuation: string;
  pricePerShare: string;
  targetCloseDate?: string;
  notes?: string;
}

export function useCreateFundingRound(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFundingRoundData) =>
      api.post<FundingRound>(
        `/api/v1/companies/${companyId}/funding-rounds`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-rounds', companyId] });
    },
  });
}

// --- Cancel funding round ---

export function useCancelFundingRound(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roundId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/cancel`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-rounds', companyId] });
    },
  });
}
