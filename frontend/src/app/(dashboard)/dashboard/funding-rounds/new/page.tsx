'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  Check,
  CircleDollarSign,
  Rocket,
  Sprout,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useCreateFundingRound } from '@/hooks/use-funding-rounds';
import { useShareClasses } from '@/hooks/use-share-classes';
import { useErrorToast } from '@/lib/use-error-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RoundType } from '@/types/company';

// --- Round type definitions ---

interface TypeOption {
  value: RoundType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: 'PRE_SEED',
    labelKey: 'type.preSeed',
    descriptionKey: 'form.typePreSeedDescription',
    icon: Sprout,
    iconColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  {
    value: 'SEED',
    labelKey: 'type.seed',
    descriptionKey: 'form.typeSeedDescription',
    icon: Rocket,
    iconColor: 'text-celadon-700',
    bgColor: 'bg-celadon-50',
  },
  {
    value: 'SERIES_A',
    labelKey: 'type.seriesA',
    descriptionKey: 'form.typeSeriesADescription',
    icon: TrendingUp,
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
  },
  {
    value: 'SERIES_B',
    labelKey: 'type.seriesB',
    descriptionKey: 'form.typeSeriesBDescription',
    icon: TrendingUp,
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
  },
  {
    value: 'SERIES_C',
    labelKey: 'type.seriesC',
    descriptionKey: 'form.typeSeriesCDescription',
    icon: TrendingUp,
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
  },
  {
    value: 'BRIDGE',
    labelKey: 'type.bridge',
    descriptionKey: 'form.typeBridgeDescription',
    icon: Zap,
    iconColor: 'text-cream-700',
    bgColor: 'bg-cream-50',
  },
  {
    value: 'OTHER',
    labelKey: 'type.other',
    descriptionKey: 'form.typeOtherDescription',
    icon: CircleDollarSign,
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
];

// --- Formatting helpers (always pt-BR per i18n rules) ---

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

// --- Form state ---

interface FormState {
  roundType: RoundType;
  name: string;
  shareClassId: string;
  targetAmount: string;
  minimumCloseAmount: string;
  hardCap: string;
  preMoneyValuation: string;
  pricePerShare: string;
  targetCloseDate: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  shareClassId?: string;
  targetAmount?: string;
  minimumCloseAmount?: string;
  hardCap?: string;
  preMoneyValuation?: string;
  pricePerShare?: string;
}

const INITIAL_FORM: FormState = {
  roundType: 'SEED',
  name: '',
  shareClassId: '',
  targetAmount: '',
  minimumCloseAmount: '',
  hardCap: '',
  preMoneyValuation: '',
  pricePerShare: '',
  targetCloseDate: '',
  notes: '',
};

// --- Validation ---

function validateForm(
  form: FormState,
  errorsT: (key: string) => string,
  t: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = errorsT('errors.val.required');
  }

  if (!form.shareClassId) {
    errors.shareClassId = errorsT('errors.val.required');
  }

  if (!form.targetAmount.trim()) {
    errors.targetAmount = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.targetAmount);
    if (isNaN(num) || num <= 0) {
      errors.targetAmount = errorsT('errors.val.mustBePositive');
    }
  }

  if (!form.preMoneyValuation.trim()) {
    errors.preMoneyValuation = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.preMoneyValuation);
    if (isNaN(num) || num <= 0) {
      errors.preMoneyValuation = errorsT('errors.val.mustBePositive');
    }
  }

  if (!form.pricePerShare.trim()) {
    errors.pricePerShare = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.pricePerShare);
    if (isNaN(num) || num <= 0) {
      errors.pricePerShare = errorsT('errors.val.mustBePositive');
    }
  }

  // Cross-field validations
  if (form.minimumCloseAmount.trim()) {
    const min = parseFloat(form.minimumCloseAmount);
    const target = parseFloat(form.targetAmount);
    if (isNaN(min) || min <= 0) {
      errors.minimumCloseAmount = errorsT('errors.val.mustBePositive');
    } else if (!isNaN(target) && min > target) {
      errors.minimumCloseAmount = t('form.errorMinExceedsTarget');
    }
  }

  if (form.hardCap.trim()) {
    const cap = parseFloat(form.hardCap);
    const target = parseFloat(form.targetAmount);
    if (isNaN(cap) || cap <= 0) {
      errors.hardCap = errorsT('errors.val.mustBePositive');
    } else if (!isNaN(target) && cap < target) {
      errors.hardCap = t('form.errorHardCapBelowTarget');
    }
  }

  return errors;
}

// --- Steps ---

type Step = 'details' | 'review';

// --- Main Component ---

export default function CreateFundingRoundPage() {
  const t = useTranslations('fundingRounds');
  const commonT = useTranslations('common');
  const errorsT = useTranslations();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const createMutation = useCreateFundingRound(selectedCompany?.id);
  const showErrorToast = useErrorToast();

  // Fetch share classes for dropdown
  const { data: shareClassesData } = useShareClasses(selectedCompany?.id, {
    limit: 100,
  });

  const shareClasses = shareClassesData?.data ?? [];

  const [step, setStep] = useState<Step>('details');

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Computed values
  const postMoneyValuation = useMemo(() => {
    const preMoney = parseFloat(form.preMoneyValuation);
    const target = parseFloat(form.targetAmount);
    if (!isNaN(preMoney) && !isNaN(target) && preMoney > 0 && target > 0) {
      return preMoney + target;
    }
    return null;
  }, [form.preMoneyValuation, form.targetAmount]);

  const selectedShareClass = useMemo(
    () => shareClasses.find((sc) => sc.id === form.shareClassId),
    [shareClasses, form.shareClassId],
  );

  // --- Handlers ---

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function selectType(roundType: RoundType) {
    setForm((prev) => ({ ...prev, roundType }));
    if (submitted) {
      setErrors({});
    }
  }

  function handleNext() {
    setSubmitted(true);
    const validationErrors = validateForm(form, errorsT, t);
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
      name: form.name.trim(),
      roundType: form.roundType,
      shareClassId: form.shareClassId,
      targetAmount: form.targetAmount.trim(),
      preMoneyValuation: form.preMoneyValuation.trim(),
      pricePerShare: form.pricePerShare.trim(),
    };

    if (form.minimumCloseAmount.trim()) {
      payload.minimumCloseAmount = form.minimumCloseAmount.trim();
    }

    if (form.hardCap.trim()) {
      payload.hardCap = form.hardCap.trim();
    }

    if (form.targetCloseDate) {
      payload.targetCloseDate = form.targetCloseDate;
    }

    if (form.notes.trim()) {
      payload.notes = form.notes.trim();
    }

    try {
      await createMutation.mutateAsync(
        payload as Parameters<typeof createMutation.mutateAsync>[0],
      );
      toast.success(t('success.created'));
      router.push('/dashboard/funding-rounds');
    } catch (error) {
      showErrorToast(error);
    }
  }

  // --- No company guard ---
  if (!selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Banknote className="mx-auto h-12 w-12 text-gray-300" />
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
          href="/dashboard/funding-rounds"
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
                const isSelected = form.roundType === opt.value;

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

          {/* Round Information */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionInfo')}
            </h2>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <Label htmlFor="name">{t('form.name')}</Label>
                <Input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                  maxLength={200}
                  className={cn('mt-1', errors.name && 'border-red-500')}
                  data-testid="input-name"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                )}
              </div>
            </div>
          </section>

          {/* Financial Terms */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionFinancial')}
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
                      {sc.className} ({sc.type})
                    </option>
                  ))}
                </select>
                {errors.shareClassId && (
                  <p className="mt-1 text-xs text-red-600">{errors.shareClassId}</p>
                )}
              </div>

              {/* Target Amount */}
              <div>
                <Label htmlFor="targetAmount">{t('form.targetAmount')}</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={(e) => updateField('targetAmount', e.target.value)}
                  placeholder={t('form.targetAmountPlaceholder')}
                  className={cn('mt-1', errors.targetAmount && 'border-red-500')}
                  data-testid="input-targetAmount"
                />
                {errors.targetAmount && (
                  <p className="mt-1 text-xs text-red-600">{errors.targetAmount}</p>
                )}
              </div>

              {/* Minimum Close Amount */}
              <div>
                <Label htmlFor="minimumCloseAmount">
                  {t('form.minimumCloseAmount')}
                </Label>
                <Input
                  id="minimumCloseAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumCloseAmount}
                  onChange={(e) => updateField('minimumCloseAmount', e.target.value)}
                  placeholder={t('form.minimumCloseAmountPlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.minimumCloseAmount && 'border-red-500',
                  )}
                  data-testid="input-minimumCloseAmount"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('form.minimumCloseAmountHelp')}
                </p>
                {errors.minimumCloseAmount && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.minimumCloseAmount}
                  </p>
                )}
              </div>

              {/* Hard Cap */}
              <div>
                <Label htmlFor="hardCap">{t('form.hardCap')}</Label>
                <Input
                  id="hardCap"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hardCap}
                  onChange={(e) => updateField('hardCap', e.target.value)}
                  placeholder={t('form.hardCapPlaceholder')}
                  className={cn('mt-1', errors.hardCap && 'border-red-500')}
                  data-testid="input-hardCap"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('form.hardCapHelp')}
                </p>
                {errors.hardCap && (
                  <p className="mt-1 text-xs text-red-600">{errors.hardCap}</p>
                )}
              </div>

              {/* Pre-Money Valuation */}
              <div>
                <Label htmlFor="preMoneyValuation">
                  {t('form.preMoneyValuation')}
                </Label>
                <Input
                  id="preMoneyValuation"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.preMoneyValuation}
                  onChange={(e) => updateField('preMoneyValuation', e.target.value)}
                  placeholder={t('form.preMoneyValuationPlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.preMoneyValuation && 'border-red-500',
                  )}
                  data-testid="input-preMoneyValuation"
                />
                {errors.preMoneyValuation && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.preMoneyValuation}
                  </p>
                )}
              </div>

              {/* Price per Share */}
              <div>
                <Label htmlFor="pricePerShare">{t('form.pricePerShare')}</Label>
                <Input
                  id="pricePerShare"
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.pricePerShare}
                  onChange={(e) => updateField('pricePerShare', e.target.value)}
                  placeholder={t('form.pricePerSharePlaceholder')}
                  className={cn('mt-1', errors.pricePerShare && 'border-red-500')}
                  data-testid="input-pricePerShare"
                />
                {errors.pricePerShare && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.pricePerShare}
                  </p>
                )}
              </div>

              {/* Post-Money Valuation (calculated, read-only) */}
              {postMoneyValuation !== null && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {t('form.postMoneyValuation')}
                    </span>
                    <span
                      className="text-sm font-semibold text-navy-900"
                      data-testid="calculated-postMoney"
                    >
                      {formatCurrency(postMoneyValuation)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Dates */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionDates')}
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="targetCloseDate">{t('form.targetCloseDate')}</Label>
                <Input
                  id="targetCloseDate"
                  type="date"
                  value={form.targetCloseDate}
                  onChange={(e) => updateField('targetCloseDate', e.target.value)}
                  className="mt-1"
                  data-testid="input-targetCloseDate"
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
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
          </section>

          {/* Details step actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
            <Link
              href="/dashboard/funding-rounds"
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
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-type"
                  >
                    {t(`type.${form.roundType === 'PRE_SEED' ? 'preSeed' : form.roundType === 'SERIES_A' ? 'seriesA' : form.roundType === 'SERIES_B' ? 'seriesB' : form.roundType === 'SERIES_C' ? 'seriesC' : form.roundType.toLowerCase()}`)}
                  </dd>
                </div>

                {/* Name */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">{t('form.reviewName')}</dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-name"
                  >
                    {form.name}
                  </dd>
                </div>

                {/* Share Class */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewShareClass')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-shareClass"
                  >
                    {selectedShareClass?.className ?? '—'}
                  </dd>
                </div>

                {/* Target Amount */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewTargetAmount')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-targetAmount"
                  >
                    {formatCurrency(form.targetAmount)}
                  </dd>
                </div>

                {/* Minimum Close Amount */}
                {form.minimumCloseAmount.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewMinClose')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-minClose"
                    >
                      {formatCurrency(form.minimumCloseAmount)}
                    </dd>
                  </div>
                )}

                {/* Hard Cap */}
                {form.hardCap.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewHardCap')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-hardCap"
                    >
                      {formatCurrency(form.hardCap)}
                    </dd>
                  </div>
                )}

                {/* Pre-Money Valuation */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewPreMoney')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-preMoney"
                  >
                    {formatCurrency(form.preMoneyValuation)}
                  </dd>
                </div>

                {/* Price per Share */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewPricePerShare')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-pricePerShare"
                  >
                    {formatCurrency(form.pricePerShare)}
                  </dd>
                </div>

                {/* Post-Money Valuation (calculated) */}
                {postMoneyValuation !== null && (
                  <div className="flex justify-between bg-gray-50 px-4 py-3">
                    <dt className="text-sm font-medium text-gray-700">
                      {t('form.reviewPostMoney')}
                    </dt>
                    <dd
                      className="text-sm font-bold text-navy-900"
                      data-testid="review-postMoney"
                    >
                      {formatCurrency(postMoneyValuation)}
                    </dd>
                  </div>
                )}

                {/* Target Close Date */}
                {form.targetCloseDate && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewTargetCloseDate')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-closeDate"
                    >
                      {formatDate(form.targetCloseDate)}
                    </dd>
                  </div>
                )}

                {/* Notes */}
                {form.notes.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewNotes')}
                    </dt>
                    <dd
                      className="max-w-xs text-right text-sm text-gray-900"
                      data-testid="review-notes"
                    >
                      {form.notes}
                    </dd>
                  </div>
                )}
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
