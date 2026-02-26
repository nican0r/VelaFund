'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { DocumentItem, DocumentTemplate } from '@/types/company';

export interface DocumentsParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
  sort?: string;
}

export function useDocumentTemplates(
  companyId: string | undefined,
  params?: { page?: number; limit?: number; type?: string; search?: string },
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.type) query.set('type', params.type);
  if (params?.search) query.set('search', params.search);

  const qs = query.toString();

  return useQuery({
    queryKey: ['document-templates', companyId, params],
    queryFn: () =>
      api.getList<DocumentTemplate>(
        `/api/v1/companies/${companyId}/document-templates${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

export function useDocumentTemplate(
  companyId: string | undefined,
  templateId: string | undefined,
) {
  return useQuery({
    queryKey: ['document-templates', companyId, templateId],
    queryFn: () =>
      api.get<DocumentTemplate>(
        `/api/v1/companies/${companyId}/document-templates/${templateId}`,
      ),
    enabled: !!companyId && !!templateId,
    staleTime: 60 * 1000,
  });
}

export function useDocuments(
  companyId: string | undefined,
  params?: DocumentsParams,
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.type) query.set('type', params.type);
  if (params?.search) query.set('search', params.search);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();

  return useQuery({
    queryKey: ['documents', companyId, params],
    queryFn: () =>
      api.getList<DocumentItem>(
        `/api/v1/companies/${companyId}/documents${qs ? `?${qs}` : ''}`,
      ),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useDocument(
  companyId: string | undefined,
  documentId: string | undefined,
) {
  return useQuery({
    queryKey: ['documents', companyId, documentId],
    queryFn: () =>
      api.get<DocumentItem>(
        `/api/v1/companies/${companyId}/documents/${documentId}`,
      ),
    enabled: !!companyId && !!documentId,
    staleTime: 30 * 1000,
  });
}

export function useDocumentPreview(
  companyId: string | undefined,
  documentId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['documents', companyId, documentId, 'preview'],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/companies/${companyId}/documents/${documentId}/preview`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Preview failed');
      return res.text();
    },
    enabled: !!companyId && !!documentId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useDocumentDownloadUrl(
  companyId: string | undefined,
  documentId: string | undefined,
) {
  return useQuery({
    queryKey: ['documents', companyId, documentId, 'download'],
    queryFn: () =>
      api.get<{ url: string; expiresIn: number }>(
        `/api/v1/companies/${companyId}/documents/${documentId}/download`,
      ),
    enabled: false, // Only fetch on demand
  });
}

export interface CreateDocumentData {
  templateId: string;
  title: string;
  locale?: string;
  formData: Record<string, unknown>;
}

export function useCreateDocument(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDocumentData) =>
      api.post<DocumentItem>(
        `/api/v1/companies/${companyId}/documents`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
    },
  });
}

export function useCreateDraft(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDocumentData) =>
      api.post<DocumentItem>(
        `/api/v1/companies/${companyId}/documents/draft`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
    },
  });
}

export function useUpdateDraft(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      data,
    }: {
      documentId: string;
      data: { title?: string; formData?: Record<string, unknown> };
    }) =>
      api.put<DocumentItem>(
        `/api/v1/companies/${companyId}/documents/${documentId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
    },
  });
}

export function useGenerateFromDraft(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      api.post<DocumentItem>(
        `/api/v1/companies/${companyId}/documents/${documentId}/generate`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
    },
  });
}

export function useDeleteDocument(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      api.delete(`/api/v1/companies/${companyId}/documents/${documentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
    },
  });
}
