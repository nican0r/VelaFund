import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { FundingRound, FundingRoundDetail, RoundCommitment, ProFormaCapTable } from '@/types/company';

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

// --- Open funding round ---

export function useOpenFundingRound(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roundId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/open`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-rounds', companyId] });
    },
  });
}

// --- Close funding round ---

export function useCloseFundingRound(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roundId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/close`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-rounds', companyId] });
      queryClient.invalidateQueries({ queryKey: ['cap-table', companyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shareholders', companyId] });
    },
  });
}

// --- Round commitments ---

export interface CommitmentsParams {
  page?: number;
  limit?: number;
  paymentStatus?: string;
  sort?: string;
}

export function useRoundCommitments(
  companyId: string | undefined,
  roundId: string | undefined,
  params?: CommitmentsParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.paymentStatus) query.set('paymentStatus', params.paymentStatus);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();

  return useQuery({
    queryKey: ['commitments', companyId, roundId, params],
    queryFn: () =>
      api.getList<RoundCommitment>(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/commitments${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId && !!roundId,
    staleTime: 30 * 1000,
  });
}

// --- Add commitment ---

export interface AddCommitmentData {
  shareholderId: string;
  committedAmount: string;
  hasSideLetter?: boolean;
  notes?: string;
}

export function useAddCommitment(
  companyId: string | undefined,
  roundId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddCommitmentData) =>
      api.post<RoundCommitment>(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/commitments`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments', companyId, roundId] });
      queryClient.invalidateQueries({ queryKey: ['funding-rounds', companyId] });
    },
  });
}

// --- Confirm payment ---

export function useConfirmPayment(
  companyId: string | undefined,
  roundId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commitmentId, paymentStatus, notes }: { commitmentId: string; paymentStatus: string; notes?: string }) =>
      api.put(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/commitments/${commitmentId}/payment`,
        { paymentStatus, notes },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments', companyId, roundId] });
      queryClient.invalidateQueries({ queryKey: ['funding-rounds', companyId] });
    },
  });
}

// --- Cancel commitment ---

export function useCancelCommitment(
  companyId: string | undefined,
  roundId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commitmentId: string) =>
      api.delete(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/commitments/${commitmentId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments', companyId, roundId] });
      queryClient.invalidateQueries({ queryKey: ['funding-rounds', companyId] });
    },
  });
}

// --- Pro-forma cap table ---

export function useRoundProForma(
  companyId: string | undefined,
  roundId: string | undefined,
) {
  return useQuery({
    queryKey: ['proforma', companyId, roundId],
    queryFn: () =>
      api.get<ProFormaCapTable>(
        `/api/v1/companies/${companyId}/funding-rounds/${roundId}/proforma`,
      ),
    enabled: !!companyId && !!roundId,
    staleTime: 60 * 1000,
  });
}
