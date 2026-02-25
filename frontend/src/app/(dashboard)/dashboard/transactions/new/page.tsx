'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  Check,
  GitBranch,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useCreateTransaction } from '@/hooks/use-transactions';
import { useShareholders } from '@/hooks/use-shareholders';
import { useShareClasses } from '@/hooks/use-share-classes';
import { useErrorToast } from '@/lib/use-error-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// --- Transaction type definitions ---

type TransactionType = 'ISSUANCE' | 'TRANSFER' | 'CONVERSION' | 'CANCELLATION' | 'SPLIT';

interface TypeOption {
  value: TransactionType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: 'ISSUANCE',
    labelKey: 'type.issuance',
    descriptionKey: 'form.issuanceDescription',
    icon: Plus,
    iconColor: 'text-celadon-700',
    bgColor: 'bg-celadon-50',
  },
  {
    value: 'TRANSFER',
    labelKey: 'type.transfer',
    descriptionKey: 'form.transferDescription',
    icon: ArrowLeftRight,
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
  },
  {
    value: 'CONVERSION',
    labelKey: 'type.conversion',
    descriptionKey: 'form.conversionDescription',
    icon: RefreshCw,
    iconColor: 'text-cream-700',
    bgColor: 'bg-cream-50',
  },
  {
    value: 'CANCELLATION',
    labelKey: 'type.cancellation',
    descriptionKey: 'form.cancellationDescription',
    icon: XCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    value: 'SPLIT',
    labelKey: 'type.split',
    descriptionKey: 'form.splitDescription',
    icon: GitBranch,
    iconColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
];

// --- Formatting helpers (always pt-BR per i18n rules) ---

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

// --- Form state ---

interface FormState {
  type: TransactionType;
  shareClassId: string;
  toShareClassId: string;
  fromShareholderId: string;
  toShareholderId: string;
  quantity: string;
  pricePerShare: string;
  splitRatio: string;
  notes: string;
  requiresBoardApproval: boolean;
}

interface FormErrors {
  shareClassId?: string;
  toShareClassId?: string;
  fromShareholderId?: string;
  toShareholderId?: string;
  quantity?: string;
  pricePerShare?: string;
  splitRatio?: string;
}

// --- Validation ---

function validateForm(form: FormState, t: (key: string) => string): FormErrors {
  const errors: FormErrors = {};

  // Share class is always required
  if (!form.shareClassId) {
    errors.shareClassId = t('errors.val.required');
  }

  // Type-specific validations
  switch (form.type) {
    case 'ISSUANCE':
      if (!form.toShareholderId) {
        errors.toShareholderId = t('errors.val.required');
      }
      if (!form.quantity.trim()) {
        errors.quantity = t('errors.val.required');
      } else {
        const num = parseFloat(form.quantity);
        if (isNaN(num) || num <= 0) {
          errors.quantity = t('errors.val.mustBePositive');
        }
      }
      if (form.pricePerShare.trim()) {
        const price = parseFloat(form.pricePerShare);
        if (isNaN(price) || price < 0) {
          errors.pricePerShare = t('errors.val.mustBePositive');
        }
      }
      break;

    case 'TRANSFER':
      if (!form.fromShareholderId) {
        errors.fromShareholderId = t('errors.val.required');
      }
      if (!form.toShareholderId) {
        errors.toShareholderId = t('errors.val.required');
      }
      if (form.fromShareholderId && form.toShareholderId && form.fromShareholderId === form.toShareholderId) {
        errors.toShareholderId = t('errors.txn.sameShareholder');
      }
      if (!form.quantity.trim()) {
        errors.quantity = t('errors.val.required');
      } else {
        const num = parseFloat(form.quantity);
        if (isNaN(num) || num <= 0) {
          errors.quantity = t('errors.val.mustBePositive');
        }
      }
      if (form.pricePerShare.trim()) {
        const price = parseFloat(form.pricePerShare);
        if (isNaN(price) || price < 0) {
          errors.pricePerShare = t('errors.val.mustBePositive');
        }
      }
      break;

    case 'CONVERSION':
      if (!form.fromShareholderId) {
        errors.fromShareholderId = t('errors.val.required');
      }
      if (!form.toShareClassId) {
        errors.toShareClassId = t('errors.val.required');
      }
      if (!form.quantity.trim()) {
        errors.quantity = t('errors.val.required');
      } else {
        const num = parseFloat(form.quantity);
        if (isNaN(num) || num <= 0) {
          errors.quantity = t('errors.val.mustBePositive');
        }
      }
      break;

    case 'CANCELLATION':
      if (!form.fromShareholderId) {
        errors.fromShareholderId = t('errors.val.required');
      }
      if (!form.quantity.trim()) {
        errors.quantity = t('errors.val.required');
      } else {
        const num = parseFloat(form.quantity);
        if (isNaN(num) || num <= 0) {
          errors.quantity = t('errors.val.mustBePositive');
        }
      }
      if (form.pricePerShare.trim()) {
        const price = parseFloat(form.pricePerShare);
        if (isNaN(price) || price < 0) {
          errors.pricePerShare = t('errors.val.mustBePositive');
        }
      }
      break;

    case 'SPLIT':
      if (!form.splitRatio.trim()) {
        errors.splitRatio = t('errors.val.required');
      } else {
        const ratio = parseFloat(form.splitRatio);
        if (isNaN(ratio) || ratio <= 0) {
          errors.splitRatio = t('errors.val.mustBePositive');
        }
      }
      break;
  }

  return errors;
}

// --- Field visibility helpers ---

function needsFromShareholder(type: TransactionType): boolean {
  return type === 'TRANSFER' || type === 'CONVERSION' || type === 'CANCELLATION';
}

function needsToShareholder(type: TransactionType): boolean {
  return type === 'ISSUANCE' || type === 'TRANSFER';
}

function needsQuantity(type: TransactionType): boolean {
  return type !== 'SPLIT';
}

function needsPricePerShare(type: TransactionType): boolean {
  return type === 'ISSUANCE' || type === 'TRANSFER' || type === 'CANCELLATION';
}

function needsToShareClass(type: TransactionType): boolean {
  return type === 'CONVERSION';
}

function needsSplitRatio(type: TransactionType): boolean {
  return type === 'SPLIT';
}

// --- Steps ---

type Step = 'details' | 'review';

// --- Main Component ---

export default function CreateTransactionPage() {
  const t = useTranslations('transactions');
  const commonT = useTranslations('common');
  const errorsT = useTranslations();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const createMutation = useCreateTransaction(selectedCompany?.id);
  const showErrorToast = useErrorToast();

  // Fetch shareholders and share classes for dropdowns
  const { data: shareholdersData } = useShareholders(selectedCompany?.id, {
    limit: 100,
    status: 'ACTIVE',
  });
  const { data: shareClassesData } = useShareClasses(selectedCompany?.id, {
    limit: 100,
  });

  const shareholders = shareholdersData?.data ?? [];
  const shareClasses = shareClassesData?.data ?? [];

  const [step, setStep] = useState<Step>('details');

  const [form, setForm] = useState<FormState>({
    type: 'ISSUANCE',
    shareClassId: '',
    toShareClassId: '',
    fromShareholderId: '',
    toShareholderId: '',
    quantity: '',
    pricePerShare: '',
    splitRatio: '',
    notes: '',
    requiresBoardApproval: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Computed values
  const totalValue = useMemo(() => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.pricePerShare);
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      return qty * price;
    }
    return null;
  }, [form.quantity, form.pricePerShare]);

  const selectedShareClass = useMemo(
    () => shareClasses.find((sc) => sc.id === form.shareClassId),
    [shareClasses, form.shareClassId],
  );

  const targetShareClass = useMemo(
    () => shareClasses.find((sc) => sc.id === form.toShareClassId),
    [shareClasses, form.toShareClassId],
  );

  const fromShareholder = useMemo(
    () => shareholders.find((sh) => sh.id === form.fromShareholderId),
    [shareholders, form.fromShareholderId],
  );

  const toShareholder = useMemo(
    () => shareholders.find((sh) => sh.id === form.toShareholderId),
    [shareholders, form.toShareholderId],
  );

  // --- Handlers ---

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function selectType(type: TransactionType) {
    setForm((prev) => ({
      ...prev,
      type,
      // Reset type-dependent fields
      fromShareholderId: '',
      toShareholderId: '',
      toShareClassId: '',
      quantity: '',
      pricePerShare: '',
      splitRatio: '',
    }));
    if (submitted) {
      setErrors({});
    }
  }

  function handleNext() {
    setSubmitted(true);
    const validationErrors = validateForm(form, errorsT);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setStep('review');
  }

  function handleBack() {
    setStep('details');
  }

  async function handleSubmit() {
    const payload: Record<string, unknown> = {
      type: form.type,
      shareClassId: form.shareClassId,
    };

    if (needsQuantity(form.type)) {
      payload.quantity = form.quantity.trim();
    }

    if (needsFromShareholder(form.type) && form.fromShareholderId) {
      payload.fromShareholderId = form.fromShareholderId;
    }

    if (needsToShareholder(form.type) && form.toShareholderId) {
      payload.toShareholderId = form.toShareholderId;
    }

    if (needsPricePerShare(form.type) && form.pricePerShare.trim()) {
      payload.pricePerShare = form.pricePerShare.trim();
    }

    if (needsToShareClass(form.type) && form.toShareClassId) {
      payload.toShareClassId = form.toShareClassId;
    }

    if (needsSplitRatio(form.type) && form.splitRatio.trim()) {
      payload.splitRatio = form.splitRatio.trim();
    }

    if (form.notes.trim()) {
      payload.notes = form.notes.trim();
    }

    if (form.requiresBoardApproval) {
      payload.requiresBoardApproval = true;
    }

    try {
      await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0]);
      toast.success(t('success.created'));
      router.push('/dashboard/transactions');
    } catch (error) {
      showErrorToast(error);
    }
  }

  // --- No company guard ---
  if (!selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <ArrowLeftRight className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            {t('empty')}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/transactions"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('title')}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          {t('createTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('createDescription')}</p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-4" data-testid="step-indicator">
        <div
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
            step === 'details'
              ? 'bg-ocean-600 text-white'
              : 'bg-celadon-50 text-celadon-700',
          )}
        >
          {step === 'review' ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <span className="text-xs">1</span>
          )}
          {t('form.stepDetails')}
        </div>
        <div className="h-px flex-1 bg-gray-200" />
        <div
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
            step === 'review'
              ? 'bg-ocean-600 text-white'
              : 'bg-gray-100 text-gray-400',
          )}
        >
          <span className="text-xs">2</span>
          {t('form.stepReview')}
        </div>
      </div>

      {/* Step 1: Details */}
      {step === 'details' && (
        <div className="space-y-8">
          {/* Type Selection */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionType')}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = form.type === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectType(opt.value)}
                    className={cn(
                      'rounded-lg border-2 p-4 text-left transition-colors',
                      isSelected
                        ? 'border-ocean-600 bg-ocean-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                    )}
                    data-testid={`type-card-${opt.value}`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-md',
                          opt.bgColor,
                        )}
                      >
                        <Icon className={cn('h-4 w-4', opt.iconColor)} />
                      </div>
                      <span className="font-medium text-gray-800">
                        {t(opt.labelKey)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {t(opt.descriptionKey)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Transaction Details */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionDetails')}
            </h2>
            <div className="space-y-4">
              {/* Share Class */}
              <div>
                <Label htmlFor="shareClassId">{t('form.shareClass')}</Label>
                <select
                  id="shareClassId"
                  value={form.shareClassId}
                  onChange={(e) => updateField('shareClassId', e.target.value)}
                  className={cn(
                    'mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                    errors.shareClassId ? 'border-red-500' : 'border-gray-300',
                  )}
                  data-testid="select-shareClassId"
                >
                  <option value="">{t('form.selectShareClass')}</option>
                  {shareClasses.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.className} ({sc.type}) — {formatNumber(sc.totalAuthorized)} {t('form.availableShares', { available: formatNumber(String(parseFloat(sc.totalAuthorized) - parseFloat(sc.totalIssued))) })}
                    </option>
                  ))}
                </select>
                {errors.shareClassId && (
                  <p className="mt-1 text-xs text-red-600">{errors.shareClassId}</p>
                )}
              </div>

              {/* Target Share Class (CONVERSION only) */}
              {needsToShareClass(form.type) && (
                <div>
                  <Label htmlFor="toShareClassId">{t('form.toShareClass')}</Label>
                  <select
                    id="toShareClassId"
                    value={form.toShareClassId}
                    onChange={(e) => updateField('toShareClassId', e.target.value)}
                    className={cn(
                      'mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                      errors.toShareClassId ? 'border-red-500' : 'border-gray-300',
                    )}
                    data-testid="select-toShareClassId"
                  >
                    <option value="">{t('form.selectTargetShareClass')}</option>
                    {shareClasses
                      .filter((sc) => sc.id !== form.shareClassId)
                      .map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.className} ({sc.type})
                        </option>
                      ))}
                  </select>
                  {errors.toShareClassId && (
                    <p className="mt-1 text-xs text-red-600">{errors.toShareClassId}</p>
                  )}
                </div>
              )}

              {/* From Shareholder */}
              {needsFromShareholder(form.type) && (
                <div>
                  <Label htmlFor="fromShareholderId">{t('form.fromShareholder')}</Label>
                  <select
                    id="fromShareholderId"
                    value={form.fromShareholderId}
                    onChange={(e) => updateField('fromShareholderId', e.target.value)}
                    className={cn(
                      'mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                      errors.fromShareholderId ? 'border-red-500' : 'border-gray-300',
                    )}
                    data-testid="select-fromShareholderId"
                  >
                    <option value="">{t('form.selectShareholder')}</option>
                    {shareholders.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name} ({sh.type})
                      </option>
                    ))}
                  </select>
                  {errors.fromShareholderId && (
                    <p className="mt-1 text-xs text-red-600">{errors.fromShareholderId}</p>
                  )}
                </div>
              )}

              {/* To Shareholder */}
              {needsToShareholder(form.type) && (
                <div>
                  <Label htmlFor="toShareholderId">{t('form.toShareholder')}</Label>
                  <select
                    id="toShareholderId"
                    value={form.toShareholderId}
                    onChange={(e) => updateField('toShareholderId', e.target.value)}
                    className={cn(
                      'mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                      errors.toShareholderId ? 'border-red-500' : 'border-gray-300',
                    )}
                    data-testid="select-toShareholderId"
                  >
                    <option value="">{t('form.selectShareholder')}</option>
                    {shareholders
                      .filter((sh) => sh.id !== form.fromShareholderId)
                      .map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.name} ({sh.type})
                        </option>
                      ))}
                  </select>
                  {errors.toShareholderId && (
                    <p className="mt-1 text-xs text-red-600">{errors.toShareholderId}</p>
                  )}
                </div>
              )}

              {/* Quantity */}
              {needsQuantity(form.type) && (
                <div>
                  <Label htmlFor="quantity">{t('form.quantity')}</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => updateField('quantity', e.target.value)}
                    placeholder={t('form.quantityPlaceholder')}
                    className={cn('mt-1', errors.quantity && 'border-red-500')}
                    data-testid="input-quantity"
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>
                  )}
                </div>
              )}

              {/* Price per Share */}
              {needsPricePerShare(form.type) && (
                <div>
                  <Label htmlFor="pricePerShare">{t('form.pricePerShare')}</Label>
                  <Input
                    id="pricePerShare"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pricePerShare}
                    onChange={(e) => updateField('pricePerShare', e.target.value)}
                    placeholder={t('form.pricePerSharePlaceholder')}
                    className={cn('mt-1', errors.pricePerShare && 'border-red-500')}
                    data-testid="input-pricePerShare"
                  />
                  {errors.pricePerShare && (
                    <p className="mt-1 text-xs text-red-600">{errors.pricePerShare}</p>
                  )}
                  {totalValue !== null && (
                    <p className="mt-1 text-xs text-gray-500">
                      {t('form.totalValue')}: {formatCurrency(totalValue)}
                    </p>
                  )}
                </div>
              )}

              {/* Split Ratio */}
              {needsSplitRatio(form.type) && (
                <div>
                  <Label htmlFor="splitRatio">{t('form.splitRatio')}</Label>
                  <Input
                    id="splitRatio"
                    type="number"
                    min="0"
                    step="any"
                    value={form.splitRatio}
                    onChange={(e) => updateField('splitRatio', e.target.value)}
                    placeholder={t('form.splitRatioPlaceholder')}
                    className={cn('mt-1', errors.splitRatio && 'border-red-500')}
                    data-testid="input-splitRatio"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('form.splitRatioHelp')}
                  </p>
                  {errors.splitRatio && (
                    <p className="mt-1 text-xs text-red-600">{errors.splitRatio}</p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <Label htmlFor="notes">{t('form.notes')}</Label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder={t('form.notesPlaceholder')}
                  maxLength={2000}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
                  data-testid="input-notes"
                />
              </div>

              {/* Board Approval */}
              <div className="flex items-start gap-3">
                <input
                  id="requiresBoardApproval"
                  type="checkbox"
                  checked={form.requiresBoardApproval}
                  onChange={(e) => updateField('requiresBoardApproval', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500"
                  data-testid="input-boardApproval"
                />
                <div>
                  <Label htmlFor="requiresBoardApproval" className="cursor-pointer">
                    {t('form.boardApproval')}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {t('form.boardApprovalDescription')}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Details step actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
            <Link
              href="/dashboard/transactions"
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              {commonT('cancel')}
            </Link>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500"
              data-testid="next-button"
            >
              {commonT('next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.reviewTitle')}
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white">
              <dl className="divide-y divide-gray-100">
                {/* Type */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">{t('form.reviewType')}</dt>
                  <dd className="text-sm font-medium text-gray-900" data-testid="review-type">
                    {t(`type.${form.type.toLowerCase()}`)}
                  </dd>
                </div>

                {/* Share Class */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">{t('form.reviewShareClass')}</dt>
                  <dd className="text-sm font-medium text-gray-900" data-testid="review-shareClass">
                    {selectedShareClass?.className ?? '—'}
                  </dd>
                </div>

                {/* Target Share Class (CONVERSION) */}
                {needsToShareClass(form.type) && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">{t('form.reviewTargetShareClass')}</dt>
                    <dd className="text-sm font-medium text-gray-900" data-testid="review-toShareClass">
                      {targetShareClass?.className ?? '—'}
                    </dd>
                  </div>
                )}

                {/* From Shareholder */}
                {needsFromShareholder(form.type) && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">{t('form.reviewSourceShareholder')}</dt>
                    <dd className="text-sm font-medium text-gray-900" data-testid="review-fromShareholder">
                      {fromShareholder?.name ?? '—'}
                    </dd>
                  </div>
                )}

                {/* To Shareholder */}
                {needsToShareholder(form.type) && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {form.type === 'ISSUANCE'
                        ? t('form.reviewShareholder')
                        : t('form.reviewTargetShareholder')}
                    </dt>
                    <dd className="text-sm font-medium text-gray-900" data-testid="review-toShareholder">
                      {toShareholder?.name ?? '—'}
                    </dd>
                  </div>
                )}

                {/* Quantity */}
                {needsQuantity(form.type) && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">{t('form.reviewQuantity')}</dt>
                    <dd className="text-sm font-medium text-gray-900" data-testid="review-quantity">
                      {formatNumber(form.quantity)}
                    </dd>
                  </div>
                )}

                {/* Price per Share */}
                {needsPricePerShare(form.type) && form.pricePerShare.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">{t('form.reviewPricePerShare')}</dt>
                    <dd className="text-sm font-medium text-gray-900" data-testid="review-pricePerShare">
                      {formatCurrency(form.pricePerShare)}
                    </dd>
                  </div>
                )}

                {/* Total Value */}
                {totalValue !== null && (
                  <div className="flex justify-between px-4 py-3 bg-gray-50">
                    <dt className="text-sm font-medium text-gray-700">{t('form.reviewTotalValue')}</dt>
                    <dd className="text-sm font-bold text-navy-900" data-testid="review-totalValue">
                      {formatCurrency(totalValue)}
                    </dd>
                  </div>
                )}

                {/* Split Ratio */}
                {needsSplitRatio(form.type) && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">{t('form.reviewSplitRatio')}</dt>
                    <dd className="text-sm font-medium text-gray-900" data-testid="review-splitRatio">
                      {form.splitRatio}:1
                    </dd>
                  </div>
                )}

                {/* Notes */}
                {form.notes.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">{t('form.reviewNotes')}</dt>
                    <dd className="text-sm text-gray-900" data-testid="review-notes">
                      {form.notes}
                    </dd>
                  </div>
                )}

                {/* Board Approval */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">{t('form.reviewBoardApproval')}</dt>
                  <dd className="text-sm font-medium text-gray-900" data-testid="review-boardApproval">
                    {form.requiresBoardApproval
                      ? t('form.reviewBoardRequired')
                      : t('form.reviewBoardNotRequired')}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Review step actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              data-testid="back-button"
            >
              {commonT('back')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500 disabled:opacity-50"
              data-testid="submit-button"
            >
              {createMutation.isPending ? commonT('loading') : commonT('confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
