import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Transaction } from '@/types/company';
import type { PaginationMeta } from '@/types/api';

// --- List transactions (paginated) ---

export interface TransactionsParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  shareholderId?: string;
  shareClassId?: string;
  createdAfter?: string;
  createdBefore?: string;
  sort?: string;
}

export function useTransactions(
  companyId: string | undefined,
  params?: TransactionsParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.type) query.set('type', params.type);
  if (params?.status) query.set('status', params.status);
  if (params?.shareholderId) query.set('shareholderId', params.shareholderId);
  if (params?.shareClassId) query.set('shareClassId', params.shareClassId);
  if (params?.createdAfter) query.set('createdAfter', params.createdAfter);
  if (params?.createdBefore) query.set('createdBefore', params.createdBefore);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();

  return useQuery({
    queryKey: ['transactions', companyId, params],
    queryFn: () =>
      api.getList<Transaction>(
        `/api/v1/companies/${companyId}/transactions${qs ? `?${qs}` : ''}`,
      ) as Promise<{ data: Transaction[]; meta: PaginationMeta }>,
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

// --- Recent transactions (dashboard) ---

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

// --- Get single transaction ---

export function useTransaction(
  companyId: string | undefined,
  transactionId: string | undefined,
) {
  return useQuery({
    queryKey: ['transactions', companyId, transactionId],
    queryFn: () =>
      api.get<Transaction>(
        `/api/v1/companies/${companyId}/transactions/${transactionId}`,
      ),
    enabled: !!companyId && !!transactionId,
    staleTime: 30 * 1000,
  });
}

// --- Create transaction ---

export interface CreateTransactionData {
  type: 'ISSUANCE' | 'TRANSFER' | 'CONVERSION' | 'CANCELLATION' | 'SPLIT';
  shareClassId: string;
  quantity: string;
  fromShareholderId?: string;
  toShareholderId?: string;
  pricePerShare?: string;
  notes?: string;
  requiresBoardApproval?: boolean;
  toShareClassId?: string;
  splitRatio?: string;
}

export function useCreateTransaction(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionData) =>
      api.post<Transaction>(
        `/api/v1/companies/${companyId}/transactions`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['cap-table', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shareClasses', companyId] });
    },
  });
}

// --- Submit transaction ---

export function useSubmitTransaction(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      api.post<Transaction>(
        `/api/v1/companies/${companyId}/transactions/${transactionId}/submit`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
    },
  });
}

// --- Approve transaction ---

export function useApproveTransaction(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      api.post<Transaction>(
        `/api/v1/companies/${companyId}/transactions/${transactionId}/approve`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
    },
  });
}

// --- Confirm transaction ---

export function useConfirmTransaction(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      api.post<Transaction>(
        `/api/v1/companies/${companyId}/transactions/${transactionId}/confirm`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['cap-table', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shareClasses', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shareholders', companyId] });
    },
  });
}

// --- Cancel transaction ---

export function useCancelTransaction(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      api.post(
        `/api/v1/companies/${companyId}/transactions/${transactionId}/cancel`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['cap-table', companyId] });
    },
  });
}
