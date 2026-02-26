import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { AuditLogEntry, HashChainVerification } from '@/types/company';
import type { PaginationMeta } from '@/types/api';

// --- List audit logs (paginated, filtered) ---

export interface AuditLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

export function useAuditLogs(
  companyId: string | undefined,
  params?: AuditLogsParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.action) query.set('action', params.action);
  if (params?.actorId) query.set('actorId', params.actorId);
  if (params?.resourceType) query.set('resourceType', params.resourceType);
  if (params?.resourceId) query.set('resourceId', params.resourceId);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();

  return useQuery({
    queryKey: ['audit-logs', companyId, params],
    queryFn: () =>
      api.getList<AuditLogEntry>(
        `/api/v1/companies/${companyId}/audit-logs${qs ? `?${qs}` : ''}`,
      ) as Promise<{ data: AuditLogEntry[]; meta: PaginationMeta }>,
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

// --- Get single audit log detail ---

export function useAuditLog(
  companyId: string | undefined,
  auditLogId: string | undefined,
) {
  return useQuery({
    queryKey: ['audit-logs', companyId, auditLogId],
    queryFn: () =>
      api.get<AuditLogEntry>(
        `/api/v1/companies/${companyId}/audit-logs/${auditLogId}`,
      ),
    enabled: !!companyId && !!auditLogId,
    staleTime: 60 * 1000,
  });
}

// --- Verify hash chain integrity ---

export function useVerifyHashChain(
  companyId: string | undefined,
  params?: { dateFrom?: string; dateTo?: string },
  enabled?: boolean,
) {
  const query = new URLSearchParams();
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  const qs = query.toString();

  return useQuery({
    queryKey: ['audit-logs', companyId, 'verify', params],
    queryFn: () =>
      api.get<HashChainVerification>(
        `/api/v1/companies/${companyId}/audit-logs/verify${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId && enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}
