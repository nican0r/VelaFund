'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  Plus,
  Rocket,
  Users,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useFundingRound,
  useOpenFundingRound,
  useCloseFundingRound,
  useCancelFundingRound,
  useRoundCommitments,
  useAddCommitment,
  useConfirmPayment,
  useCancelCommitment,
  useRoundProForma,
} from '@/hooks/use-funding-rounds';
import { useShareholders } from '@/hooks/use-shareholders';
import type { FundingRoundDetail, RoundCommitment, FundingRoundStatus } from '@/types/company';

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

function formatPercentage(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

// --- Badge helpers ---

function getStatusBadge(status: FundingRoundStatus, t: (key: string) => string) {
  const statusMap: Record<FundingRoundStatus, { label: string; className: string }> = {
    DRAFT: { label: t('status.draft'), className: 'bg-gray-100 text-gray-600' },
    OPEN: { label: t('status.open'), className: 'bg-green-100 text-green-700' },
    CLOSING: { label: t('status.closing'), className: 'bg-cream-100 text-cream-700' },
    CLOSED: { label: t('status.closed'), className: 'bg-blue-50 text-ocean-600' },
    CANCELLED: { label: t('status.cancelled'), className: 'bg-gray-100 text-gray-500' },
  };
  return statusMap[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

function getTypeBadge(type: string, t: (key: string) => string) {
  const typeMap: Record<string, { label: string; className: string }> = {
    PRE_SEED: { label: t('type.preSeed'), className: 'bg-gray-100 text-gray-600' },
    SEED: { label: t('type.seed'), className: 'bg-green-100 text-green-700' },
    SERIES_A: { label: t('type.seriesA'), className: 'bg-ocean-50 text-ocean-600' },
    SERIES_B: { label: t('type.seriesB'), className: 'bg-ocean-50 text-ocean-600' },
    SERIES_C: { label: t('type.seriesC'), className: 'bg-ocean-50 text-ocean-600' },
    BRIDGE: { label: t('type.bridge'), className: 'bg-cream-100 text-cream-700' },
    OTHER: { label: t('type.other'), className: 'bg-gray-100 text-gray-600' },
  };
  return typeMap[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
}

function getPaymentBadge(status: string, t: (key: string) => string) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: t('detail.paymentStatusPending'), className: 'bg-cream-100 text-cream-700' },
    RECEIVED: { label: t('detail.paymentStatusReceived'), className: 'bg-blue-50 text-ocean-600' },
    CONFIRMED: { label: t('detail.paymentStatusConfirmed'), className: 'bg-green-100 text-green-700' },
    CANCELLED: { label: t('detail.paymentStatusCancelled'), className: 'bg-gray-100 text-gray-500' },
  };
  return map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
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

// --- Build timeline steps from round data ---

function buildTimelineSteps(round: FundingRoundDetail, t: (key: string) => string): TimelineStep[] {
  const steps: TimelineStep[] = [];

  // Step 1: Created (always present)
  steps.push({
    label: t('detail.timelineCreated'),
    date: round.createdAt,
    status: 'completed',
    icon: FileText,
  });

  // Step 2: Opened
  const isOpen = ['OPEN', 'CLOSING', 'CLOSED'].includes(round.status);
  const isDraft = round.status === 'DRAFT';
  steps.push({
    label: t('detail.timelineOpened'),
    date: round.openedAt,
    status: isOpen ? 'completed' : isDraft ? 'pending' : 'pending',
    icon: Rocket,
  });

  // Step 3: Closed
  if (round.status === 'CLOSED') {
    steps.push({
      label: t('detail.timelineClosed'),
      date: round.closedAt,
      status: 'completed',
      icon: CheckCircle2,
    });
  } else if (round.status === 'CANCELLED') {
    steps.push({
      label: t('detail.timelineCancelled'),
      date: round.cancelledAt,
      status: 'error',
      icon: XCircle,
    });
  } else if (round.status === 'OPEN') {
    steps.push({
      label: t('detail.timelineClosed'),
      date: null,
      status: 'pending',
      icon: Lock,
    });
  }

  return steps;
}

// --- Progress Bar ---

function ProgressBar({
  current,
  target,
  minimum,
  hardCap,
  t,
}: {
  current: number;
  target: number;
  minimum: number | null;
  hardCap: number | null;
  t: (key: string) => string;
}) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const minimumPct = minimum && target > 0 ? (minimum / target) * 100 : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{t('detail.progress')}</span>
        <span className="text-gray-500">
          {formatCurrency(current)} / {formatCurrency(target)} ({formatPercentage(percentage)}%)
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            percentage >= 100 ? 'bg-green-500' : 'bg-ocean-600',
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {/* Minimum close marker */}
        {minimumPct !== null && minimumPct > 0 && minimumPct < 100 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-cream-700"
            style={{ left: `${minimumPct}%` }}
            title={`${t('detail.minimumClose')}: ${formatCurrency(minimum!)}`}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>R$ 0</span>
        {minimumPct !== null && minimumPct > 0 && minimumPct < 100 && (
          <span className="text-cream-700">{t('detail.minimumClose')}: {formatCurrency(minimum!)}</span>
        )}
        <span>{formatCurrency(target)}</span>
      </div>
    </div>
  );
}

// --- Add Commitment Modal ---

function AddCommitmentModal({
  open,
  onClose,
  onSubmit,
  loading,
  shareholders,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { shareholderId: string; committedAmount: string; hasSideLetter: boolean; notes: string }) => void;
  loading: boolean;
  shareholders: { id: string; name: string; type: string }[];
  t: (key: string) => string;
}) {
  const [shareholderId, setShareholderId] = useState('');
  const [amount, setAmount] = useState('');
  const [hasSideLetter, setHasSideLetter] = useState(false);
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!shareholderId || !amount) return;
    onSubmit({ shareholderId, committedAmount: amount, hasSideLetter, notes });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-navy-900/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800">{t('detail.addCommitmentTitle')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('detail.addCommitmentDescription')}</p>

        <div className="mt-4 space-y-4">
          {/* Investor select */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('detail.investor')}</label>
            <select
              value={shareholderId}
              onChange={(e) => setShareholderId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            >
              <option value="">{t('detail.selectInvestor')}</option>
              {shareholders.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('detail.amount')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('detail.amountPlaceholder')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>

          {/* Side letter */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sideLetter"
              checked={hasSideLetter}
              onChange={(e) => setHasSideLetter(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-600"
            />
            <label htmlFor="sideLetter" className="text-sm text-gray-700">{t('detail.sideLetter')}</label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('detail.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('detail.notesPlaceholder')}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !shareholderId || !amount}
            className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('detail.addCommitment')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Stat Card ---

function StatCard({
  label,
  value,
  icon: Icon,
  active = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-5',
        active
          ? 'border-transparent bg-ocean-600 text-white shadow-md'
          : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            active ? 'bg-white/20' : 'bg-gray-100',
          )}
        >
          <Icon className={cn('h-5 w-5', active ? 'text-white' : 'text-gray-500')} />
        </div>
        <div>
          <p className={cn('text-xs font-medium', active ? 'text-white/80' : 'text-gray-500')}>
            {label}
          </p>
          <p className={cn('text-lg font-bold', active ? 'text-white' : 'text-navy-900')}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-lg bg-gray-200" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-48 animate-pulse rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

// --- Main Page ---

export default function FundingRoundDetailPage() {
  const params = useParams();
  const roundId = params.id as string;
  const t = useTranslations('fundingRounds');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  // Fetch round detail
  const { data: round, isLoading, error } = useFundingRound(companyId, roundId);

  // Fetch commitments
  const [commitmentPage, setCommitmentPage] = useState(1);
  const { data: commitmentsData, isLoading: commitmentsLoading } = useRoundCommitments(
    companyId,
    roundId,
    { page: commitmentPage, limit: 20 },
  );

  // Fetch pro-forma (lazy, only when tab is active)
  const [activeTab, setActiveTab] = useState<'commitments' | 'details' | 'proforma'>('commitments');
  const { data: proForma, isLoading: proFormaLoading } = useRoundProForma(
    activeTab === 'proforma' ? companyId : undefined,
    activeTab === 'proforma' ? roundId : undefined,
  );

  // Fetch shareholders for add commitment modal
  const { data: shareholdersData } = useShareholders(companyId, { limit: 100 });

  // Mutations
  const openMutation = useOpenFundingRound(companyId);
  const closeMutation = useCloseFundingRound(companyId);
  const cancelMutation = useCancelFundingRound(companyId);
  const addCommitmentMutation = useAddCommitment(companyId, roundId);
  const confirmPaymentMutation = useConfirmPayment(companyId, roundId);
  const cancelCommitmentMutation = useCancelCommitment(companyId, roundId);

  // Dialog states
  const [dialogType, setDialogType] = useState<'open' | 'close' | 'cancel' | null>(null);
  const [commitmentDialog, setCommitmentDialog] = useState<'add' | 'cancelCommitment' | 'confirmPayment' | 'markReceived' | null>(null);
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleRoundAction = async () => {
    if (!round || !dialogType) return;
    try {
      switch (dialogType) {
        case 'open':
          await openMutation.mutateAsync(round.id);
          break;
        case 'close':
          await closeMutation.mutateAsync(round.id);
          break;
        case 'cancel':
          await cancelMutation.mutateAsync(round.id);
          break;
      }
      setDialogType(null);
    } catch {
      // Error handled by TanStack Query / API error toast
    }
  };

  const handleCommitmentAction = async () => {
    if (!selectedCommitmentId || !commitmentDialog) return;
    try {
      switch (commitmentDialog) {
        case 'cancelCommitment':
          await cancelCommitmentMutation.mutateAsync(selectedCommitmentId);
          break;
        case 'confirmPayment':
          await confirmPaymentMutation.mutateAsync({
            commitmentId: selectedCommitmentId,
            paymentStatus: 'CONFIRMED',
          });
          break;
        case 'markReceived':
          await confirmPaymentMutation.mutateAsync({
            commitmentId: selectedCommitmentId,
            paymentStatus: 'RECEIVED',
          });
          break;
      }
      setCommitmentDialog(null);
      setSelectedCommitmentId(null);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const handleAddCommitment = async (data: { shareholderId: string; committedAmount: string; hasSideLetter: boolean; notes: string }) => {
    try {
      await addCommitmentMutation.mutateAsync(data);
      setShowAddModal(false);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const actionLoading =
    openMutation.isPending ||
    closeMutation.isPending ||
    cancelMutation.isPending;

  const commitmentActionLoading =
    cancelCommitmentMutation.isPending ||
    confirmPaymentMutation.isPending;

  // --- States ---

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

  if (companyLoading || isLoading) {
    return <DetailSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/funding-rounds"
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

  if (!round) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/funding-rounds"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ocean-600 hover:text-ocean-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center">
          <Banknote className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gray-700">{t('detail.notFound')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('detail.notFoundDescription')}</p>
        </div>
      </div>
    );
  }

  // --- Happy path ---

  const statusBadge = getStatusBadge(round.status, t);
  const typeBadge = getTypeBadge(round.roundType, t);
  const timelineSteps = buildTimelineSteps(round, t);
  const currentAmount = parseFloat(round.currentAmount || '0');
  const targetAmount = parseFloat(round.targetAmount);
  const minimumClose = round.minimumCloseAmount ? parseFloat(round.minimumCloseAmount) : null;
  const hardCap = round.hardCap ? parseFloat(round.hardCap) : null;
  const commitments = commitmentsData?.data ?? [];
  const commitmentsMeta = commitmentsData?.meta;
  const shareholders = shareholdersData?.data ?? [];

  const canOpen = round.status === 'DRAFT';
  const canClose = round.status === 'OPEN';
  const canCancel = ['DRAFT', 'OPEN'].includes(round.status);
  const canAddCommitment = round.status === 'OPEN';

  // Dialog config for round actions
  const getDialogConfig = () => {
    switch (dialogType) {
      case 'open':
        return {
          title: t('detail.openTitle'),
          description: t('detail.openDescription'),
          confirmLabel: t('detail.openButton'),
          variant: 'primary' as const,
        };
      case 'close':
        return {
          title: t('detail.closeTitle'),
          description: t('detail.closeDescription'),
          confirmLabel: t('detail.closeButton'),
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

  const getCommitmentDialogConfig = () => {
    switch (commitmentDialog) {
      case 'cancelCommitment':
        return {
          title: t('detail.cancelCommitmentTitle'),
          description: t('detail.cancelCommitmentDescription'),
          confirmLabel: t('detail.cancelCommitment'),
          variant: 'destructive' as const,
        };
      case 'confirmPayment':
        return {
          title: t('detail.confirmPayment'),
          description: t('detail.closeDescription'),
          confirmLabel: t('detail.confirmPayment'),
          variant: 'primary' as const,
        };
      case 'markReceived':
        return {
          title: t('detail.markReceived'),
          description: t('detail.openDescription'),
          confirmLabel: t('detail.markReceived'),
          variant: 'primary' as const,
        };
      default:
        return null;
    }
  };

  const roundDialogConfig = getDialogConfig();
  const commitmentDialogConfig = getCommitmentDialogConfig();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/funding-rounds"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ocean-600 hover:text-ocean-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
            <Banknote className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-navy-900">
              {round.name}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', typeBadge.className)}>
                {typeBadge.label}
              </span>
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusBadge.className)}>
                {statusBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {canOpen && (
            <button
              type="button"
              onClick={() => setDialogType('open')}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <Rocket className="h-4 w-4" />
              {t('detail.openButton')}
            </button>
          )}
          {canAddCommitment && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
            >
              <Plus className="h-4 w-4" />
              {t('detail.addCommitment')}
            </button>
          )}
          {canClose && (
            <button
              type="button"
              onClick={() => setDialogType('close')}
              className="inline-flex items-center gap-2 rounded-md border border-ocean-600 bg-white px-4 py-2 text-sm font-medium text-ocean-600 shadow-sm transition-colors hover:bg-ocean-50"
            >
              <Lock className="h-4 w-4" />
              {t('detail.closeButton')}
            </button>
          )}
          {canCancel && (
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={t('detail.statsTarget')}
          value={formatCurrency(round.targetAmount)}
          icon={DollarSign}
          active
        />
        <StatCard
          label={t('detail.statsRaised')}
          value={formatCurrency(currentAmount)}
          icon={Banknote}
        />
        <StatCard
          label={t('detail.statsInvestors')}
          value={String(round.commitmentCount)}
          icon={Users}
        />
        <StatCard
          label={t('detail.statsPricePerShare')}
          value={formatCurrency(round.pricePerShare)}
          icon={DollarSign}
        />
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <ProgressBar
          current={currentAmount}
          target={targetAmount}
          minimum={minimumClose}
          hardCap={hardCap}
          t={t}
        />
      </div>

      {/* Content: Tabs + Timeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab bar */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6">
              {(['commitments', 'details', 'proforma'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors',
                    activeTab === tab
                      ? 'border-ocean-600 text-ocean-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                  )}
                >
                  {t(`detail.${tab}Tab`)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content: Commitments */}
          {activeTab === 'commitments' && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              {commitmentsLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : commitments.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <Users className="h-10 w-10 text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">{t('detail.commitmentsEmpty')}</p>
                  {canAddCommitment && (
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
                    >
                      <Plus className="h-4 w-4" />
                      {t('detail.addCommitment')}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('detail.investor')}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('detail.amount')}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('detail.sharesAllocated')}</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">{t('detail.paymentStatus')}</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">{t('detail.hasSideLetter')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('detail.commitmentDate')}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commitments.map((c: RoundCommitment) => {
                          const paymentBadge = getPaymentBadge(c.paymentStatus, t);
                          return (
                            <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.shareholder.name}</td>
                              <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">{formatCurrency(c.amount)}</td>
                              <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                                {c.sharesAllocated ? formatNumber(c.sharesAllocated) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', paymentBadge.className)}>
                                  {paymentBadge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">
                                {c.hasSideLetter ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" /> : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(c.createdAt)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  {c.paymentStatus === 'PENDING' && round.status === 'OPEN' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCommitmentId(c.id);
                                        setCommitmentDialog('markReceived');
                                      }}
                                      className="rounded px-2 py-1 text-xs font-medium text-ocean-600 hover:bg-ocean-50"
                                      title={t('detail.markReceived')}
                                    >
                                      {t('detail.markReceived')}
                                    </button>
                                  )}
                                  {(c.paymentStatus === 'PENDING' || c.paymentStatus === 'RECEIVED') && round.status === 'OPEN' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCommitmentId(c.id);
                                        setCommitmentDialog('confirmPayment');
                                      }}
                                      className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                                      title={t('detail.confirmPayment')}
                                    >
                                      {t('detail.confirmPayment')}
                                    </button>
                                  )}
                                  {c.paymentStatus !== 'CANCELLED' && c.paymentStatus !== 'CONFIRMED' && round.status === 'OPEN' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCommitmentId(c.id);
                                        setCommitmentDialog('cancelCommitment');
                                      }}
                                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                      title={t('detail.cancelCommitment')}
                                    >
                                      {t('detail.cancelCommitment')}
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
                  {/* Pagination */}
                  {commitmentsMeta && commitmentsMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                      <p className="text-sm text-gray-500">
                        {t('pagination.page')} {commitmentsMeta.page} {t('pagination.of')} {commitmentsMeta.totalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCommitmentPage(Math.max(1, commitmentPage - 1))}
                          disabled={commitmentPage <= 1}
                          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {t('pagination.previous')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommitmentPage(commitmentPage + 1)}
                          disabled={commitmentPage >= commitmentsMeta.totalPages}
                          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {t('pagination.next')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab content: Details */}
          {activeTab === 'details' && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <InfoRow label={t('detail.name')} value={round.name} />
              <InfoRow label={t('detail.roundType')} value={typeBadge.label} />
              <InfoRow label={t('detail.shareClass')} value={round.shareClass.className} />
              <InfoRow label={t('detail.statsTarget')} value={formatCurrency(round.targetAmount)} />
              {round.minimumCloseAmount && (
                <InfoRow label={t('detail.minimumClose')} value={formatCurrency(round.minimumCloseAmount)} />
              )}
              {round.hardCap && (
                <InfoRow label={t('detail.hardCap')} value={formatCurrency(round.hardCap)} />
              )}
              <InfoRow label={t('detail.preMoney')} value={formatCurrency(round.preMoneyValuation)} />
              <InfoRow label={t('detail.postMoney')} value={formatCurrency(round.postMoneyValuation)} />
              <InfoRow label={t('detail.pricePerShare')} value={formatCurrency(round.pricePerShare)} />
              {round.targetCloseDate && (
                <InfoRow label={t('detail.targetCloseDate')} value={formatDate(round.targetCloseDate)} />
              )}
              {round.notes && (
                <InfoRow label={t('detail.notes')} value={round.notes} />
              )}
              <InfoRow label={t('detail.createdAt')} value={formatDateTime(round.createdAt)} />
              {round.openedAt && (
                <InfoRow label={t('detail.openedAt')} value={formatDateTime(round.openedAt)} />
              )}
              {round.closedAt && (
                <InfoRow label={t('detail.closedAt')} value={formatDateTime(round.closedAt)} />
              )}
              {round.cancelledAt && (
                <InfoRow label={t('detail.cancelledAt')} value={formatDateTime(round.cancelledAt)} />
              )}
            </div>
          )}

          {/* Tab content: Pro-Forma */}
          {activeTab === 'proforma' && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              {proFormaLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : !proForma ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <FileText className="h-10 w-10 text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">{t('detail.proFormaEmpty')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('detail.proFormaShareholder')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('detail.proFormaBefore')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('detail.proFormaAfter')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('detail.proFormaChange')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proForma.afterRound.shareholders.map((sh) => {
                        const dilution = proForma.dilution[sh.name];
                        const beforePct = dilution?.before ?? '0';
                        const afterPct = dilution?.after ?? sh.percentage;
                        const change = dilution?.change ?? '0';
                        const changeNum = parseFloat(change);
                        return (
                          <tr key={sh.shareholderId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{sh.name}</td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                              {formatPercentage(parseFloat(beforePct))}%
                            </td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                              {formatPercentage(parseFloat(afterPct))}%
                            </td>
                            <td className={cn(
                              'px-4 py-3 text-right text-sm tabular-nums font-medium',
                              changeNum < 0 ? 'text-red-600' : changeNum > 0 ? 'text-green-700' : 'text-gray-500',
                            )}>
                              {changeNum > 0 ? '+' : ''}{formatPercentage(changeNum)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-medium">
                        <td className="px-4 py-3 text-sm text-gray-700">{t('detail.proFormaTotalShares')}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                          {formatNumber(proForma.beforeRound.totalShares)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-700">
                          {formatNumber(proForma.afterRound.totalShares)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-500">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
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

      {/* Round action dialog */}
      {roundDialogConfig && (
        <ConfirmDialog
          open={!!dialogType}
          onClose={() => setDialogType(null)}
          onConfirm={handleRoundAction}
          loading={actionLoading}
          title={roundDialogConfig.title}
          description={roundDialogConfig.description}
          confirmLabel={roundDialogConfig.confirmLabel}
          variant={roundDialogConfig.variant}
        />
      )}

      {/* Commitment action dialog */}
      {commitmentDialogConfig && (
        <ConfirmDialog
          open={!!commitmentDialog}
          onClose={() => {
            setCommitmentDialog(null);
            setSelectedCommitmentId(null);
          }}
          onConfirm={handleCommitmentAction}
          loading={commitmentActionLoading}
          title={commitmentDialogConfig.title}
          description={commitmentDialogConfig.description}
          confirmLabel={commitmentDialogConfig.confirmLabel}
          variant={commitmentDialogConfig.variant}
        />
      )}

      {/* Add commitment modal */}
      <AddCommitmentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddCommitment}
        loading={addCommitmentMutation.isPending}
        shareholders={shareholders}
        t={t}
      />
    </div>
  );
}
