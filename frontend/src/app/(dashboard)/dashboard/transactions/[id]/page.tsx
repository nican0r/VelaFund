'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useTransaction,
  useSubmitTransaction,
  useApproveTransaction,
  useConfirmTransaction,
  useCancelTransaction,
} from '@/hooks/use-transactions';
import type { Transaction } from '@/types/company';

// --- Brazilian formatting helpers (per i18n rules: always pt-BR format) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// --- Badge helpers ---

type TransactionType = Transaction['type'];
type TransactionStatus = Transaction['status'];

function getTypeBadge(type: TransactionType, t: (key: string) => string) {
  const typeMap: Record<TransactionType, { label: string; className: string }> = {
    ISSUANCE: { label: t('type.issuance'), className: 'bg-green-100 text-green-700' },
    TRANSFER: { label: t('type.transfer'), className: 'bg-blue-50 text-ocean-600' },
    CONVERSION: { label: t('type.conversion'), className: 'bg-cream-100 text-cream-700' },
    CANCELLATION: { label: t('type.cancellation'), className: 'bg-red-50 text-[#991B1B]' },
    SPLIT: { label: t('type.split'), className: 'bg-gray-100 text-gray-600' },
  };
  return typeMap[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
}

function getStatusBadge(status: TransactionStatus, t: (key: string) => string) {
  const statusMap: Record<TransactionStatus, { label: string; className: string }> = {
    DRAFT: { label: t('status.draft'), className: 'bg-gray-100 text-gray-600' },
    PENDING_APPROVAL: { label: t('status.pendingApproval'), className: 'bg-cream-100 text-cream-700' },
    SUBMITTED: { label: t('status.submitted'), className: 'bg-blue-50 text-ocean-600' },
    CONFIRMED: { label: t('status.confirmed'), className: 'bg-green-100 text-green-700' },
    FAILED: { label: t('status.failed'), className: 'bg-red-50 text-[#991B1B]' },
    CANCELLED: { label: t('status.cancelled'), className: 'bg-gray-100 text-gray-500' },
  };
  return statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

function getTypeIcon(type: TransactionType) {
  const icons: Record<TransactionType, React.ElementType> = {
    ISSUANCE: Plus,
    TRANSFER: ArrowLeftRight,
    CONVERSION: RefreshCw,
    CANCELLATION: XCircle,
    SPLIT: GitBranch,
  };
  return icons[type] ?? ArrowLeftRight;
}

// --- Helper: can this transaction be cancelled? ---

function isCancellable(status: TransactionStatus): boolean {
  return ['DRAFT', 'PENDING_APPROVAL', 'SUBMITTED', 'FAILED'].includes(status);
}

// --- Info Row component ---

function InfoRow({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={cn('flex justify-between py-3 border-b border-gray-100 last:border-0', className)}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

// --- Confirmation Dialog ---

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
  title,
  description,
  confirmLabel,
  variant = 'primary',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'primary' | 'destructive';
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-navy-900/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            {/* Use cancel from common */}
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50',
              variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-ocean-600 hover:bg-ocean-500',
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Status Timeline ---

interface TimelineStep {
  label: string;
  date: string | null;
  status: 'completed' | 'active' | 'pending' | 'error';
  icon: React.ElementType;
}

function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <li key={idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className={cn(
                      'absolute left-4 top-4 -ml-px h-full w-0.5',
                      step.status === 'completed' ? 'bg-green-300' :
                      step.status === 'error' ? 'bg-red-300' :
                      'bg-gray-200',
                    )}
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      step.status === 'completed' ? 'bg-green-100' :
                      step.status === 'active' ? 'bg-ocean-50 ring-2 ring-ocean-600' :
                      step.status === 'error' ? 'bg-red-100' :
                      'bg-gray-100',
                    )}
                  >
                    <step.icon
                      className={cn(
                        'h-4 w-4',
                        step.status === 'completed' ? 'text-green-700' :
                        step.status === 'active' ? 'text-ocean-600' :
                        step.status === 'error' ? 'text-red-600' :
                        'text-gray-400',
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        step.status === 'completed' ? 'text-green-700' :
                        step.status === 'active' ? 'text-ocean-600' :
                        step.status === 'error' ? 'text-red-600' :
                        'text-gray-500',
                      )}
                    >
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {formatDateTime(step.date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- Build timeline steps from transaction data ---

function buildTimelineSteps(tx: Transaction, t: (key: string) => string): TimelineStep[] {
  const steps: TimelineStep[] = [];

  // Step 1: Created (always present)
  steps.push({
    label: t('detail.timelineCreated'),
    date: tx.createdAt,
    status: 'completed',
    icon: FileText,
  });

  // Step 2: Pending approval (if requiresBoardApproval and went through PENDING_APPROVAL)
  if (tx.requiresBoardApproval) {
    const isPending = tx.status === 'PENDING_APPROVAL';
    const pastPending = ['SUBMITTED', 'CONFIRMED', 'FAILED'].includes(tx.status);
    steps.push({
      label: t('detail.timelinePending'),
      date: isPending ? null : pastPending ? tx.approvedAt : null,
      status: isPending ? 'active' : pastPending ? 'completed' : 'pending',
      icon: Clock,
    });
  }

  // Step 3: Approved / Submitted
  const isSubmitted = tx.status === 'SUBMITTED';
  const pastSubmitted = ['CONFIRMED', 'FAILED'].includes(tx.status);
  if (tx.approvedBy) {
    steps.push({
      label: t('detail.timelineApproved'),
      date: tx.approvedAt,
      status: isSubmitted || pastSubmitted ? 'completed' : 'pending',
      icon: ShieldCheck,
    });
  }

  if (tx.status !== 'DRAFT') {
    steps.push({
      label: t('detail.timelineSubmitted'),
      date: isSubmitted || pastSubmitted ? tx.approvedAt || tx.updatedAt : null,
      status: isSubmitted ? 'active' : pastSubmitted ? 'completed' : 'pending',
      icon: Send,
    });
  }

  // Step 4: Terminal states
  if (tx.status === 'CONFIRMED') {
    steps.push({
      label: t('detail.timelineConfirmed'),
      date: tx.confirmedAt,
      status: 'completed',
      icon: CheckCircle2,
    });
  } else if (tx.status === 'FAILED') {
    steps.push({
      label: t('detail.timelineFailed'),
      date: tx.updatedAt,
      status: 'error',
      icon: XCircle,
    });
  } else if (tx.status === 'CANCELLED') {
    steps.push({
      label: t('detail.timelineCancelled'),
      date: tx.cancelledAt,
      status: 'error',
      icon: XCircle,
    });
  }

  return steps;
}

// --- Loading Skeleton ---

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-3">
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="space-y-6">
          <div className="h-48 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

// --- Parse notes to extract user notes ---

function parseNotes(notes: string | null): { userNotes: string | null; toShareClassId?: string; splitRatio?: string } {
  if (!notes) return { userNotes: null };
  try {
    const parsed = JSON.parse(notes);
    return {
      userNotes: parsed.userNotes || null,
      toShareClassId: parsed.toShareClassId,
      splitRatio: parsed.splitRatio,
    };
  } catch {
    // If notes is plain text, treat as user notes
    return { userNotes: notes };
  }
}

// --- Main Transaction Detail Page ---

export default function TransactionDetailPage() {
  const params = useParams();
  const transactionId = params.id as string;
  const t = useTranslations('transactions');
  const commonT = useTranslations('common');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Fetch transaction
  const {
    data: transaction,
    isLoading,
    error,
  } = useTransaction(companyId, transactionId);

  // Mutations
  const submitMutation = useSubmitTransaction(companyId);
  const approveMutation = useApproveTransaction(companyId);
  const confirmMutation = useConfirmTransaction(companyId);
  const cancelMutation = useCancelTransaction(companyId);

  // Dialog states
  const [dialogType, setDialogType] = useState<'submit' | 'approve' | 'confirm' | 'retry' | 'cancel' | null>(null);

  const handleAction = async () => {
    if (!transaction || !dialogType) return;
    try {
      switch (dialogType) {
        case 'submit':
          await submitMutation.mutateAsync(transaction.id);
          break;
        case 'approve':
          await approveMutation.mutateAsync(transaction.id);
          break;
        case 'confirm':
        case 'retry':
          await confirmMutation.mutateAsync(transaction.id);
          break;
        case 'cancel':
          await cancelMutation.mutateAsync(transaction.id);
          break;
      }
      setDialogType(null);
    } catch {
      // Error handled by TanStack Query / API error toast
    }
  };

  const actionLoading =
    submitMutation.isPending ||
    approveMutation.isPending ||
    confirmMutation.isPending ||
    cancelMutation.isPending;

  // --- States ---

  // No company
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">{t('empty')}</h2>
        </div>
      </div>
    );
  }

  // Loading
  if (companyLoading || isLoading) {
    return <DetailSkeleton />;
  }

  // Error
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ocean-600 hover:text-ocean-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <div className="mt-8 flex min-h-[200px] items-center justify-center">
          <p className="text-sm text-red-600">{t('detail.error')}</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!transaction) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ocean-600 hover:text-ocean-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center">
          <ArrowLeftRight className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gray-700">{t('detail.notFound')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('detail.notFoundDescription')}</p>
        </div>
      </div>
    );
  }

  // --- Happy path: render detail ---

  const tx = transaction;
  const typeBadge = getTypeBadge(tx.type, t);
  const statusBadge = getStatusBadge(tx.status, t);
  const TypeIcon = getTypeIcon(tx.type);
  const timelineSteps = buildTimelineSteps(tx, t);
  const notesData = parseNotes(tx.notes);

  // Get dialog config
  const getDialogConfig = () => {
    switch (dialogType) {
      case 'submit':
        return {
          title: t('detail.submitTitle'),
          description: t('detail.submitDescription'),
          confirmLabel: t('detail.submitButton'),
          variant: 'primary' as const,
        };
      case 'approve':
        return {
          title: t('detail.approveTitle'),
          description: t('detail.approveDescription'),
          confirmLabel: t('detail.approveButton'),
          variant: 'primary' as const,
        };
      case 'confirm':
        return {
          title: t('detail.confirmTitle'),
          description: t('detail.confirmDescription'),
          confirmLabel: t('detail.confirmButton'),
          variant: 'primary' as const,
        };
      case 'retry':
        return {
          title: t('detail.retryTitle'),
          description: t('detail.retryDescription'),
          confirmLabel: t('detail.retryButton'),
          variant: 'primary' as const,
        };
      case 'cancel':
        return {
          title: t('detail.cancelTitle'),
          description: t('detail.cancelDescription'),
          confirmLabel: t('detail.cancelButton'),
          variant: 'destructive' as const,
        };
      default:
        return null;
    }
  };

  const dialogConfig = getDialogConfig();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/transactions"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ocean-600 hover:text-ocean-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
            <TypeIcon className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-navy-900">
              {t('detail.title')}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  typeBadge.className,
                )}
              >
                {typeBadge.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusBadge.className,
                )}
              >
                {statusBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {tx.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => setDialogType('submit')}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <Send className="h-4 w-4" />
              {t('detail.submitButton')}
            </button>
          )}
          {tx.status === 'PENDING_APPROVAL' && (
            <button
              type="button"
              onClick={() => setDialogType('approve')}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <ShieldCheck className="h-4 w-4" />
              {t('detail.approveButton')}
            </button>
          )}
          {tx.status === 'SUBMITTED' && (
            <button
              type="button"
              onClick={() => setDialogType('confirm')}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('detail.confirmButton')}
            </button>
          )}
          {tx.status === 'FAILED' && (
            <button
              type="button"
              onClick={() => setDialogType('retry')}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <RefreshCw className="h-4 w-4" />
              {t('detail.retryButton')}
            </button>
          )}
          {isCancellable(tx.status) && (
            <button
              type="button"
              onClick={() => setDialogType('cancel')}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              {t('detail.cancelButton')}
            </button>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Summary Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800">
              {t('detail.summary')}
            </h2>
            <div className="mt-4">
              <InfoRow label={t('detail.type')} value={typeBadge.label} />

              {/* Type-specific fields */}
              {tx.type === 'ISSUANCE' && (
                <>
                  <InfoRow
                    label={t('detail.toShareholder')}
                    value={tx.toShareholder?.name}
                  />
                  <InfoRow
                    label={t('detail.shareClass')}
                    value={tx.shareClass.className}
                  />
                  <InfoRow
                    label={t('detail.quantity')}
                    value={formatNumber(tx.quantity)}
                  />
                  {tx.pricePerShare && (
                    <InfoRow
                      label={t('detail.pricePerShare')}
                      value={formatCurrency(tx.pricePerShare)}
                    />
                  )}
                  {tx.totalValue && (
                    <InfoRow
                      label={t('detail.totalValue')}
                      value={formatCurrency(tx.totalValue)}
                    />
                  )}
                </>
              )}

              {tx.type === 'TRANSFER' && (
                <>
                  <InfoRow
                    label={t('detail.fromShareholder')}
                    value={tx.fromShareholder?.name}
                  />
                  <InfoRow
                    label={t('detail.toShareholder')}
                    value={tx.toShareholder?.name}
                  />
                  <InfoRow
                    label={t('detail.shareClass')}
                    value={tx.shareClass.className}
                  />
                  <InfoRow
                    label={t('detail.quantity')}
                    value={formatNumber(tx.quantity)}
                  />
                  {tx.pricePerShare && (
                    <InfoRow
                      label={t('detail.pricePerShare')}
                      value={formatCurrency(tx.pricePerShare)}
                    />
                  )}
                  {tx.totalValue && (
                    <InfoRow
                      label={t('detail.totalValue')}
                      value={formatCurrency(tx.totalValue)}
                    />
                  )}
                </>
              )}

              {tx.type === 'CONVERSION' && (
                <>
                  <InfoRow
                    label={t('detail.fromShareholder')}
                    value={tx.fromShareholder?.name}
                  />
                  <InfoRow
                    label={t('detail.shareClass')}
                    value={tx.shareClass.className}
                  />
                  {notesData.toShareClassId && (
                    <InfoRow
                      label={t('detail.targetShareClass')}
                      value={notesData.toShareClassId}
                    />
                  )}
                  <InfoRow
                    label={t('detail.quantity')}
                    value={formatNumber(tx.quantity)}
                  />
                </>
              )}

              {tx.type === 'CANCELLATION' && (
                <>
                  <InfoRow
                    label={t('detail.fromShareholder')}
                    value={tx.fromShareholder?.name}
                  />
                  <InfoRow
                    label={t('detail.shareClass')}
                    value={tx.shareClass.className}
                  />
                  <InfoRow
                    label={t('detail.quantity')}
                    value={formatNumber(tx.quantity)}
                  />
                  {tx.pricePerShare && (
                    <InfoRow
                      label={t('detail.pricePerShare')}
                      value={formatCurrency(tx.pricePerShare)}
                    />
                  )}
                  {tx.totalValue && (
                    <InfoRow
                      label={t('detail.totalValue')}
                      value={formatCurrency(tx.totalValue)}
                    />
                  )}
                </>
              )}

              {tx.type === 'SPLIT' && (
                <>
                  <InfoRow
                    label={t('detail.shareClass')}
                    value={tx.shareClass.className}
                  />
                  {notesData.splitRatio && (
                    <InfoRow
                      label={t('detail.splitRatio')}
                      value={`${notesData.splitRatio}:1`}
                    />
                  )}
                  <InfoRow
                    label={t('detail.quantity')}
                    value={formatNumber(tx.quantity)}
                  />
                </>
              )}

              {/* Board approval */}
              <InfoRow
                label={t('detail.boardApproval')}
                value={tx.requiresBoardApproval ? t('detail.boardRequired') : t('detail.boardNotRequired')}
              />

              {/* Notes */}
              {notesData.userNotes && (
                <InfoRow
                  label={t('detail.notes')}
                  value={notesData.userNotes}
                />
              )}
            </div>
          </div>

          {/* Metadata Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-0">
              <InfoRow label={t('detail.createdAt')} value={formatDateTime(tx.createdAt)} />
              {tx.approvedBy && (
                <InfoRow label={t('detail.approvedAt')} value={tx.approvedAt ? formatDateTime(tx.approvedAt) : null} />
              )}
              {tx.confirmedAt && (
                <InfoRow label={t('detail.confirmedAt')} value={formatDateTime(tx.confirmedAt)} />
              )}
              {tx.cancelledAt && (
                <InfoRow label={t('detail.cancelledAt')} value={formatDateTime(tx.cancelledAt)} />
              )}
            </div>
          </div>
        </div>

        {/* Right column: Timeline */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('detail.timeline')}
            </h2>
            <StatusTimeline steps={timelineSteps} />
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {dialogConfig && (
        <ConfirmDialog
          open={!!dialogType}
          onClose={() => setDialogType(null)}
          onConfirm={handleAction}
          loading={actionLoading}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={dialogConfig.confirmLabel}
          variant={dialogConfig.variant}
        />
      )}
    </div>
  );
}
