'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  FileText,
  FilePlus,
  FileCheck,
  FileClock,
  Eye,
  Download,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Building2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useDocuments, useDeleteDocument } from '@/hooks/use-documents';
import { useErrorToast } from '@/lib/use-error-toast';
import type { DocumentItem, DocumentStatus, DocumentTemplateType } from '@/types/company';

// --- Formatting helpers (always pt-BR per i18n rules) ---

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

// --- Sub-components ---

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  active?: boolean;
  loading?: boolean;
}

function StatCard({ label, value, icon: Icon, active, loading }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-6 transition-shadow',
        active
          ? 'border-transparent bg-ocean-600 text-white shadow-md'
          : 'border border-gray-200 bg-white shadow-sm',
      )}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={cn('h-5 w-5', active ? 'text-white/80' : 'text-gray-400')}
        />
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            active ? 'text-white/80' : 'text-gray-500',
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-10 w-24 animate-pulse rounded bg-gray-200" />
        ) : (
          <span
            className={cn(
              'text-stat',
              active ? 'text-white' : 'text-navy-900',
            )}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

function getStatusBadge(
  status: DocumentStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<DocumentStatus, { label: string; className: string }> = {
    DRAFT: { label: t('status.DRAFT'), className: 'bg-gray-100 text-gray-600' },
    GENERATED: { label: t('status.GENERATED'), className: 'bg-blue-50 text-ocean-600' },
    PENDING_SIGNATURES: { label: t('status.PENDING_SIGNATURES'), className: 'bg-cream-100 text-cream-700' },
    PARTIALLY_SIGNED: { label: t('status.PARTIALLY_SIGNED'), className: 'bg-cream-100 text-cream-700' },
    FULLY_SIGNED: { label: t('status.FULLY_SIGNED'), className: 'bg-green-100 text-green-700' },
  };
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
}

function getDocTypeName(
  type: DocumentTemplateType | undefined,
  t: (key: string) => string,
): string {
  if (!type) return '—';
  return t(`type.${type}`);
}

function isDeletable(status: DocumentStatus): boolean {
  return status === 'DRAFT' || status === 'GENERATED';
}

function DeleteDialog({
  open,
  onClose,
  onConfirm,
  loading,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: (key: string) => string;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-navy-900/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-navy-900">
            {t('deleteDialog.title')}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {t('deleteDialog.description')}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {t('deleteDialog.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {t('deleteDialog.confirm')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function UploadDialog({
  open,
  onClose,
  companyId,
  t,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  t: (key: string) => string;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError } = useErrorToast();

  if (!open) return null;

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setFileError('');
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFileError(t('uploadDialog.invalidType'));
      return;
    }
    if (selected.size > MAX_SIZE) {
      setFileError(t('uploadDialog.tooLarge'));
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!title.trim() || !file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('file', file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/companies/${companyId}/documents/upload`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.messageKey || 'Upload failed');
      }
      setTitle('');
      setFile(null);
      onSuccess();
      onClose();
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-navy-900/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-navy-900">
            {t('uploadDialog.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('uploadDialog.description')}
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('uploadDialog.titleLabel')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('uploadDialog.titlePlaceholder')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('uploadDialog.fileLabel')}
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 px-6 py-8 text-center transition-colors hover:border-ocean-600"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  {file ? file.name : t('uploadDialog.dropzone')}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {t('uploadDialog.dropzoneFormats')}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              {fileError && (
                <p className="mt-1 text-xs text-red-600">{fileError}</p>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={uploading}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {t('uploadDialog.cancel')}
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !title.trim() || !file}
              className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ocean-500 disabled:opacity-50"
            >
              {uploading ? t('uploadDialog.uploading') : t('uploadDialog.upload')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// --- Main Page Component ---

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const { selectedCompany, isLoading: companyLoading } = useCompany();

  const companyId = selectedCompany?.id;

  // State
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Data fetching
  const { data, isLoading, error, refetch } = useDocuments(companyId, {
    page,
    limit,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    search: searchQuery || undefined,
    sort: '-createdAt',
  });

  const deleteMutation = useDeleteDocument(companyId);

  const documents = data?.data ?? [];
  const meta = data?.meta;
  const pageLoading = companyLoading || isLoading;

  // Stats
  const stats = useMemo(() => {
    const total = meta?.total ?? 0;
    const drafts = documents.filter((d) => d.status === 'DRAFT').length;
    const generated = documents.filter((d) => d.status === 'GENERATED').length;
    const pending = documents.filter(
      (d) => d.status === 'PENDING_SIGNATURES' || d.status === 'PARTIALLY_SIGNED',
    ).length;
    return { total, drafts, generated, pending };
  }, [documents, meta]);

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      setDeleteTarget(null);
    } catch {
      // Error handled by API error toast
    }
  };

  // No company state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
        </div>
      </div>
    );
  }

  const totalPages = meta?.totalPages ?? 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] text-navy-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            {t('upload')}
          </button>
          <Link
            href="/dashboard/documents/new"
            className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
          >
            <Plus className="h-4 w-4" />
            {t('newDocument')}
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('stats.total')}
          value={String(stats.total)}
          icon={FileText}
          active
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.drafts')}
          value={String(stats.drafts)}
          icon={FilePlus}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.generated')}
          value={String(stats.generated)}
          icon={FileCheck}
          loading={pageLoading}
        />
        <StatCard
          label={t('stats.pendingSignatures')}
          value={String(stats.pending)}
          icon={FileClock}
          loading={pageLoading}
        />
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('filter.searchPlaceholder')}
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filter.allTypes')}</option>
            <option value="SHAREHOLDER_AGREEMENT">{t('type.SHAREHOLDER_AGREEMENT')}</option>
            <option value="MEETING_MINUTES">{t('type.MEETING_MINUTES')}</option>
            <option value="SHARE_CERTIFICATE">{t('type.SHARE_CERTIFICATE')}</option>
            <option value="OPTION_LETTER">{t('type.OPTION_LETTER')}</option>
            <option value="INVESTMENT_AGREEMENT">{t('type.INVESTMENT_AGREEMENT')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
          >
            <option value="">{t('filter.allStatuses')}</option>
            <option value="DRAFT">{t('status.DRAFT')}</option>
            <option value="GENERATED">{t('status.GENERATED')}</option>
            <option value="PENDING_SIGNATURES">{t('status.PENDING_SIGNATURES')}</option>
            <option value="PARTIALLY_SIGNED">{t('status.PARTIALLY_SIGNED')}</option>
            <option value="FULLY_SIGNED">{t('status.FULLY_SIGNED')}</option>
          </select>
        </div>

        {/* Table */}
        {pageLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[200px] items-center justify-center p-6">
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : 'Error loading documents'}
            </p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-6">
            <FileText className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium text-gray-700">{t('empty')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('emptyDescription')}</p>
            <Link
              href="/dashboard/documents/new"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <Plus className="h-4 w-4" />
              {t('newDocument')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.title')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.template')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.createdAt')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => {
                  const statusBadge = getStatusBadge(doc.status, t);
                  const templateType = doc.template?.documentType;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-700">
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="hover:text-ocean-600 hover:underline"
                        >
                          {doc.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {getDocTypeName(templateType, t)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusBadge.className,
                          )}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/documents/${doc.id}`}
                            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title={t('actions.view')}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {doc.s3Key && (
                            <Link
                              href={`/dashboard/documents/${doc.id}`}
                              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                              title={t('actions.download')}
                            >
                              <Download className="h-4 w-4" />
                            </Link>
                          )}
                          {isDeletable(doc.status) && (
                            <button
                              onClick={() => setDeleteTarget(doc.id)}
                              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title={t('actions.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-500">
              {t('pagination.showing', {
                from: (page - 1) * limit + 1,
                to: Math.min(page * limit, meta.total),
                total: meta.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('pagination.previous')}
              </button>
              <span className="text-sm text-gray-500">
                {t('pagination.page')} {page} {t('pagination.of')} {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <DeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        t={t}
      />

      {/* Upload Dialog */}
      {companyId && (
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          companyId={companyId}
          t={t}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
