'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Download,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  Clock,
  Hash,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useDocument,
  useDocumentPreview,
  useDocumentDownloadUrl,
  useGenerateFromDraft,
  useDeleteDocument,
} from '@/hooks/use-documents';
import { useErrorToast } from '@/lib/use-error-toast';
import { toast } from 'sonner';
import type { DocumentItem, DocumentStatus, DocumentTemplateType } from '@/types/company';

// ── Formatting helpers (always pt-BR per i18n rules) ─────────────────────

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// ── Badge helpers ────────────────────────────────────────────────────────

function getStatusBadge(
  status: DocumentStatus,
  t: (key: string) => string,
): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    DRAFT: {
      label: t('status.DRAFT'),
      className: 'bg-gray-100 text-gray-600',
    },
    GENERATED: {
      label: t('status.GENERATED'),
      className: 'bg-blue-50 text-ocean-600',
    },
    PENDING_SIGNATURES: {
      label: t('status.PENDING_SIGNATURES'),
      className: 'bg-cream-100 text-cream-700',
    },
    PARTIALLY_SIGNED: {
      label: t('status.PARTIALLY_SIGNED'),
      className: 'bg-cream-100 text-cream-700',
    },
    FULLY_SIGNED: {
      label: t('status.FULLY_SIGNED'),
      className: 'bg-green-100 text-green-700',
    },
  };
  return map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

// ── Reusable sub-components ──────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined | React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={cn(
          'text-sm font-medium text-gray-900 text-right max-w-[60%] break-all',
          mono && 'font-mono text-xs',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
  title,
  description,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title: string;
  description: string;
  confirmLabel: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-navy-900/50"
        onClick={onClose}
        data-testid="dialog-overlay"
      />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            {/* Use hardcoded since this is a generic dialog */}
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700',
              loading && 'opacity-60',
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-5 w-40 rounded bg-gray-200" />
      <div className="h-8 w-64 rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-96 rounded-xl border border-gray-200 bg-white" />
        <div className="space-y-4">
          <div className="h-48 rounded-xl border border-gray-200 bg-white" />
          <div className="h-32 rounded-xl border border-gray-200 bg-white" />
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const t = useTranslations('documents');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const { showError } = useErrorToast();

  const companyId = selectedCompany?.id;

  const { data: doc, isLoading, error } = useDocument(companyId, documentId);

  const isGenerated = doc?.status !== 'DRAFT';
  const { data: previewHtml, isLoading: previewLoading } = useDocumentPreview(
    companyId,
    documentId,
    isGenerated,
  );
  const { refetch: fetchDownloadUrl } = useDocumentDownloadUrl(companyId, documentId);

  const generateMutation = useGenerateFromDraft(companyId);
  const deleteMutation = useDeleteDocument(companyId);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── Guards ─────────────────────────────────────────────────────────

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

  if (companyLoading || isLoading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <p className="text-sm text-red-600">{t('detail.error')}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <div className="text-center py-16">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-semibold text-gray-700">
            {t('detail.notFound')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('detail.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  // ── Computed values ────────────────────────────────────────────────

  const statusBadge = getStatusBadge(doc.status, t);
  const isDraft = doc.status === 'DRAFT';
  const formData = doc.formData as Record<string, unknown> | null;
  const hasFormData = formData && Object.keys(formData).length > 0;

  // ── Action handlers ────────────────────────────────────────────────

  const handleDownload = async () => {
    try {
      const result = await fetchDownloadUrl();
      if (result.data?.url) {
        window.open(result.data.url, '_blank');
      } else {
        toast.error(t('detail.downloadError'));
      }
    } catch (err) {
      showError(err);
    }
  };

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync(documentId);
      toast.success(t('detail.generateSuccess'));
    } catch (err) {
      showError(err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(documentId);
      toast.success(t('detail.deleteSuccess'));
      router.push('/dashboard/documents');
    } catch (err) {
      showError(err);
      setShowDeleteDialog(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/dashboard/documents"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] text-navy-900">
              {doc.title}
            </h1>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                statusBadge.className,
              )}
            >
              {statusBadge.label}
            </span>
          </div>
          {doc.template && (
            <p className="mt-1 text-sm text-gray-500">
              {t(`type.${doc.template.documentType as DocumentTemplateType}`)} — {doc.template.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Link
                href={`/dashboard/documents/${doc.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4" />
                {t('detail.editDraft')}
              </Link>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-ocean-600 px-3 py-2 text-sm font-medium text-white hover:bg-ocean-500 disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {generateMutation.isPending
                  ? t('detail.generating')
                  : t('detail.generateFromDraft')}
              </button>
            </>
          )}
          {!isDraft && doc.s3Key && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-md bg-ocean-600 px-3 py-2 text-sm font-medium text-white hover:bg-ocean-500"
            >
              <Download className="h-4 w-4" />
              {t('detail.download')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            {t('detail.delete')}
          </button>
        </div>
      </div>

      {/* Content: Preview + Metadata */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Preview */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-800">
              {t('detail.previewTitle')}
            </h2>
          </div>
          <div className="p-6">
            {isDraft ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  {t('detail.noPreview')}
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-500 disabled:opacity-50"
                >
                  {generateMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t('detail.generateFromDraft')}
                </button>
              </div>
            ) : previewLoading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-ocean-600" />
              </div>
            ) : previewHtml ? (
              <div
                className="prose max-w-none min-h-[400px]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  {t('detail.noPreview')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metadata + Form Data */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800">
              {t('detail.metadata')}
            </h2>
            <div className="mt-4">
              <InfoRow
                label={t('detail.status')}
                value={
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      statusBadge.className,
                    )}
                  >
                    {statusBadge.label}
                  </span>
                }
              />
              {doc.template && (
                <InfoRow
                  label={t('detail.template')}
                  value={doc.template.name}
                />
              )}
              <InfoRow
                label={t('detail.locale')}
                value={doc.locale === 'pt-BR' ? 'Português (BR)' : 'English'}
              />
              <InfoRow
                label={t('detail.createdAt')}
                value={formatDateTime(doc.createdAt)}
              />
              {doc.generatedAt && (
                <InfoRow
                  label={t('detail.generatedAt')}
                  value={formatDateTime(doc.generatedAt)}
                />
              )}
              <InfoRow
                label={t('detail.updatedAt')}
                value={formatDateTime(doc.updatedAt)}
              />
              {doc.contentHash && (
                <InfoRow
                  label={t('detail.contentHash')}
                  value={doc.contentHash.slice(0, 16) + '...'}
                  mono
                />
              )}
              {doc.blockchainTxHash && (
                <InfoRow
                  label={t('detail.blockchainTxHash')}
                  value={doc.blockchainTxHash.slice(0, 16) + '...'}
                  mono
                />
              )}
            </div>
          </div>

          {/* Form Data Card */}
          {hasFormData && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800">
                {t('detail.formData')}
              </h2>
              <div className="mt-4">
                {Object.entries(formData!).map(([key, val]) => (
                  <InfoRow
                    key={key}
                    label={key}
                    value={val != null ? String(val) : null}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description')}
        confirmLabel={t('deleteDialog.confirm')}
      />
    </div>
  );
}
