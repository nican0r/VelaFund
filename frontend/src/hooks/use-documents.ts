import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  ProfileDocument,
  DocumentCategory,
  DocumentListResponse,
  DocumentDownloadResponse,
} from '@/types/company';

// --- List documents with optional category filter ---

export function useDocuments(
  companyId: string | undefined,
  category?: DocumentCategory,
) {
  const qs = category ? `?category=${category}` : '';

  return useQuery({
    queryKey: ['documents', companyId, category],
    queryFn: () =>
      api.get<DocumentListResponse>(
        `/api/v1/companies/${companyId}/profile/documents${qs}`,
      ),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

// --- Upload document ---

export function useUploadDocument(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      category,
      name,
    }: {
      file: File;
      category: DocumentCategory;
      name?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      if (name) {
        formData.append('name', name);
      }

      return api.uploadFile<ProfileDocument>(
        `/api/v1/companies/${companyId}/profile/documents`,
        formData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
      // Also refresh company profile (updates document count for completeness)
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Delete document ---

export function useDeleteDocument(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      api.delete(
        `/api/v1/companies/${companyId}/profile/documents/${documentId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
    },
  });
}

// --- Reorder documents ---

export function useReorderDocuments(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documents: Array<{ id: string; order: number }>) =>
      api.put<ProfileDocument[]>(
        `/api/v1/companies/${companyId}/profile/documents/order`,
        { documents },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', companyId] });
    },
  });
}

// --- Get download URL ---

export function useDocumentDownload(companyId: string | undefined) {
  return useMutation({
    mutationFn: (documentId: string) =>
      api.get<DocumentDownloadResponse>(
        `/api/v1/companies/${companyId}/profile/documents/${documentId}/download`,
      ),
  });
}
