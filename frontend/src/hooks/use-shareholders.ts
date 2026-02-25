import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  Shareholder,
  ShareholderDetail,
  ForeignShareholdersSummary,
} from '@/types/company';
import type { PaginationMeta } from '@/types/api';

// --- List shareholders (paginated) ---

export interface ShareholdersParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  isForeign?: string;
  search?: string;
  sort?: string;
}

export function useShareholders(
  companyId: string | undefined,
  params?: ShareholdersParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.type) query.set('type', params.type);
  if (params?.isForeign) query.set('isForeign', params.isForeign);
  if (params?.search) query.set('search', params.search);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();

  return useQuery({
    queryKey: ['shareholders', companyId, params],
    queryFn: () =>
      api.getList<Shareholder>(
        `/api/v1/companies/${companyId}/shareholders${qs ? `?${qs}` : ''}`,
      ) as Promise<{ data: Shareholder[]; meta: PaginationMeta }>,
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

// --- Get single shareholder detail ---

export function useShareholder(
  companyId: string | undefined,
  shareholderId: string | undefined,
) {
  return useQuery({
    queryKey: ['shareholders', companyId, shareholderId],
    queryFn: () =>
      api.get<ShareholderDetail>(
        `/api/v1/companies/${companyId}/shareholders/${shareholderId}`,
      ),
    enabled: !!companyId && !!shareholderId,
    staleTime: 30 * 1000,
  });
}

// --- Create shareholder ---

export function useCreateShareholder(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Shareholder>(
        `/api/v1/companies/${companyId}/shareholders`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareholders', companyId] });
    },
  });
}

// --- Update shareholder ---

export function useUpdateShareholder(
  companyId: string | undefined,
  shareholderId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<Shareholder>(
        `/api/v1/companies/${companyId}/shareholders/${shareholderId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareholders', companyId] });
    },
  });
}

// --- Delete shareholder ---

export function useDeleteShareholder(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareholderId: string) =>
      api.delete(
        `/api/v1/companies/${companyId}/shareholders/${shareholderId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareholders', companyId] });
    },
  });
}

// --- Set beneficial owners ---

export function useSetBeneficialOwners(
  companyId: string | undefined,
  shareholderId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { beneficialOwners: { name: string; cpf?: string; ownershipPercentage: string }[] }) =>
      api.post(
        `/api/v1/companies/${companyId}/shareholders/${shareholderId}/beneficial-owners`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareholders', companyId] });
    },
  });
}

// --- Foreign shareholders list ---

export function useForeignShareholders(companyId: string | undefined) {
  return useQuery({
    queryKey: ['shareholders', companyId, 'foreign'],
    queryFn: () =>
      api.get<ForeignShareholdersSummary>(
        `/api/v1/companies/${companyId}/shareholders/foreign`,
      ),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}
