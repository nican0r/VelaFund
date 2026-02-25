'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  Check,
  FileText,
  HandCoins,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useCreateConvertible } from '@/hooks/use-convertibles';
import { useShareholders } from '@/hooks/use-shareholders';
import { useShareClasses } from '@/hooks/use-share-classes';
import { useErrorToast } from '@/lib/use-error-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { InstrumentType, InterestType, ConversionTrigger } from '@/types/company';

// --- Instrument type definitions ---

interface TypeOption {
  value: InstrumentType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: 'MUTUO_CONVERSIVEL',
    labelKey: 'form.typeCardMutuoConversivel',
    descriptionKey: 'form.typeCardMutuoConversivelDesc',
    icon: FileText,
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
  },
  {
    value: 'INVESTIMENTO_ANJO',
    labelKey: 'form.typeCardInvestimentoAnjo',
    descriptionKey: 'form.typeCardInvestimentoAnjoDesc',
    icon: HandCoins,
    iconColor: 'text-celadon-700',
    bgColor: 'bg-celadon-50',
  },
  {
    value: 'MISTO',
    labelKey: 'form.typeCardMisto',
    descriptionKey: 'form.typeCardMistoDesc',
    icon: Layers,
    iconColor: 'text-cream-700',
    bgColor: 'bg-cream-50',
  },
  {
    value: 'MAIS',
    labelKey: 'form.typeCardMais',
    descriptionKey: 'form.typeCardMaisDesc',
    icon: Sparkles,
    iconColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
];

const CONVERSION_TRIGGERS: { value: ConversionTrigger; labelKey: string }[] = [
  { value: 'QUALIFIED_FINANCING', labelKey: 'conversionTriggerType.qualifiedFinancing' },
  { value: 'MATURITY', labelKey: 'conversionTriggerType.maturity' },
  { value: 'CHANGE_OF_CONTROL', labelKey: 'conversionTriggerType.changeOfControl' },
  { value: 'INVESTOR_OPTION', labelKey: 'conversionTriggerType.investorOption' },
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

function formatPercent(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(num / 100);
}

// --- Form state ---

interface FormState {
  instrumentType: InstrumentType;
  shareholderId: string;
  principalAmount: string;
  interestRate: string;
  interestType: InterestType;
  discountRate: string;
  valuationCap: string;
  qualifiedFinancingThreshold: string;
  conversionTrigger: string;
  targetShareClassId: string;
  autoConvert: boolean;
  mfnClause: boolean;
  issueDate: string;
  maturityDate: string;
  notes: string;
}

interface FormErrors {
  shareholderId?: string;
  principalAmount?: string;
  interestRate?: string;
  discountRate?: string;
  valuationCap?: string;
  qualifiedFinancingThreshold?: string;
  issueDate?: string;
  maturityDate?: string;
}

const INITIAL_FORM: FormState = {
  instrumentType: 'MUTUO_CONVERSIVEL',
  shareholderId: '',
  principalAmount: '',
  interestRate: '',
  interestType: 'SIMPLE',
  discountRate: '',
  valuationCap: '',
  qualifiedFinancingThreshold: '',
  conversionTrigger: '',
  targetShareClassId: '',
  autoConvert: false,
  mfnClause: false,
  issueDate: '',
  maturityDate: '',
  notes: '',
};

// --- Validation ---

function validateForm(
  form: FormState,
  errorsT: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  if (!form.shareholderId) {
    errors.shareholderId = errorsT('errors.val.required');
  }

  if (!form.principalAmount.trim()) {
    errors.principalAmount = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.principalAmount);
    if (isNaN(num) || num <= 0) {
      errors.principalAmount = errorsT('errors.val.mustBePositive');
    }
  }

  if (!form.interestRate.trim()) {
    errors.interestRate = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.interestRate);
    if (isNaN(num) || num < 0) {
      errors.interestRate = errorsT('errors.val.mustBePositive');
    }
    if (num > 100) {
      errors.interestRate = errorsT('errors.val.mustBePositive');
    }
  }

  if (form.discountRate.trim()) {
    const num = parseFloat(form.discountRate);
    if (isNaN(num) || num < 0 || num > 100) {
      errors.discountRate = errorsT('errors.val.mustBePositive');
    }
  }

  if (form.valuationCap.trim()) {
    const num = parseFloat(form.valuationCap);
    if (isNaN(num) || num <= 0) {
      errors.valuationCap = errorsT('errors.val.mustBePositive');
    }
  }

  if (form.qualifiedFinancingThreshold.trim()) {
    const num = parseFloat(form.qualifiedFinancingThreshold);
    if (isNaN(num) || num <= 0) {
      errors.qualifiedFinancingThreshold = errorsT('errors.val.mustBePositive');
    }
  }

  if (!form.issueDate) {
    errors.issueDate = errorsT('errors.val.required');
  }

  if (!form.maturityDate) {
    errors.maturityDate = errorsT('errors.val.required');
  } else if (form.issueDate && form.maturityDate <= form.issueDate) {
    errors.maturityDate = errorsT('errors.val.mustBePositive');
  }

  return errors;
}

// --- Steps ---

type Step = 'details' | 'review';

// --- Main Component ---

export default function CreateConvertiblePage() {
  const t = useTranslations('convertibles');
  const commonT = useTranslations('common');
  const errorsT = useTranslations();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const createMutation = useCreateConvertible(selectedCompany?.id);
  const showErrorToast = useErrorToast();

  // Fetch shareholders for investor dropdown
  const { data: shareholdersData } = useShareholders(selectedCompany?.id, {
    limit: 100,
  });
  const shareholders = shareholdersData?.data ?? [];

  // Fetch share classes for target share class dropdown
  const { data: shareClassesData } = useShareClasses(selectedCompany?.id, {
    limit: 100,
  });
  const shareClasses = shareClassesData?.data ?? [];

  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Lookups for review display
  const selectedShareholder = useMemo(
    () => shareholders.find((sh) => sh.id === form.shareholderId),
    [shareholders, form.shareholderId],
  );

  const selectedShareClass = useMemo(
    () => shareClasses.find((sc) => sc.id === form.targetShareClassId),
    [shareClasses, form.targetShareClassId],
  );

  const selectedTrigger = useMemo(
    () => CONVERSION_TRIGGERS.find((ct) => ct.value === form.conversionTrigger),
    [form.conversionTrigger],
  );

  // --- Handlers ---

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function selectType(instrumentType: InstrumentType) {
    setForm((prev) => ({
      ...prev,
      instrumentType,
      // Reset conversion-specific fields when changing type
      discountRate: '',
      valuationCap: '',
      qualifiedFinancingThreshold: '',
      conversionTrigger: '',
      autoConvert: false,
      mfnClause: false,
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
    // Build payload — backend expects interestRate as decimal (0.08 for 8%)
    const interestRateDecimal = (parseFloat(form.interestRate) / 100).toString();

    const payload: Record<string, unknown> = {
      shareholderId: form.shareholderId,
      instrumentType: form.instrumentType,
      principalAmount: form.principalAmount.trim(),
      interestRate: interestRateDecimal,
      interestType: form.interestType,
      issueDate: form.issueDate,
      maturityDate: form.maturityDate,
    };

    if (form.discountRate.trim()) {
      payload.discountRate = (parseFloat(form.discountRate) / 100).toString();
    }

    if (form.valuationCap.trim()) {
      payload.valuationCap = form.valuationCap.trim();
    }

    if (form.qualifiedFinancingThreshold.trim()) {
      payload.qualifiedFinancingThreshold = form.qualifiedFinancingThreshold.trim();
    }

    if (form.conversionTrigger) {
      payload.conversionTrigger = form.conversionTrigger;
    }

    if (form.targetShareClassId) {
      payload.targetShareClassId = form.targetShareClassId;
    }

    if (form.autoConvert) {
      payload.autoConvert = true;
    }

    if (form.mfnClause) {
      payload.mfnClause = true;
    }

    if (form.notes.trim()) {
      payload.notes = form.notes.trim();
    }

    try {
      await createMutation.mutateAsync(
        payload as unknown as Parameters<typeof createMutation.mutateAsync>[0],
      );
      toast.success(t('success.created'));
      router.push('/dashboard/convertibles');
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
          href="/dashboard/convertibles"
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
          {/* Instrument Type Selection */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionType')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = form.instrumentType === opt.value;

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

          {/* Financial Details */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionDetails')}
            </h2>
            <div className="space-y-4">
              {/* Investor (Shareholder) */}
              <div>
                <Label htmlFor="shareholderId">{t('form.investor')}</Label>
                <select
                  id="shareholderId"
                  value={form.shareholderId}
                  onChange={(e) => updateField('shareholderId', e.target.value)}
                  className={cn(
                    'mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                    errors.shareholderId ? 'border-red-500' : 'border-gray-300',
                  )}
                  data-testid="select-shareholderId"
                >
                  <option value="">{t('form.investorPlaceholder')}</option>
                  {shareholders.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.type})
                    </option>
                  ))}
                </select>
                {errors.shareholderId && (
                  <p className="mt-1 text-xs text-red-600">{errors.shareholderId}</p>
                )}
              </div>

              {/* Principal Amount */}
              <div>
                <Label htmlFor="principalAmount">{t('form.principalAmount')}</Label>
                <Input
                  id="principalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.principalAmount}
                  onChange={(e) => updateField('principalAmount', e.target.value)}
                  placeholder={t('form.principalAmountPlaceholder')}
                  className={cn('mt-1', errors.principalAmount && 'border-red-500')}
                  data-testid="input-principalAmount"
                />
                {errors.principalAmount && (
                  <p className="mt-1 text-xs text-red-600">{errors.principalAmount}</p>
                )}
              </div>

              {/* Interest Rate */}
              <div>
                <Label htmlFor="interestRate">{t('form.interestRate')}</Label>
                <Input
                  id="interestRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.interestRate}
                  onChange={(e) => updateField('interestRate', e.target.value)}
                  placeholder={t('form.interestRatePlaceholder')}
                  className={cn('mt-1', errors.interestRate && 'border-red-500')}
                  data-testid="input-interestRate"
                />
                {errors.interestRate && (
                  <p className="mt-1 text-xs text-red-600">{errors.interestRate}</p>
                )}
              </div>

              {/* Interest Type */}
              <div>
                <Label htmlFor="interestType">{t('form.interestType')}</Label>
                <select
                  id="interestType"
                  value={form.interestType}
                  onChange={(e) => updateField('interestType', e.target.value as InterestType)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
                  data-testid="select-interestType"
                >
                  <option value="SIMPLE">{t('interestType.simple')}</option>
                  <option value="COMPOUND">{t('interestType.compound')}</option>
                </select>
              </div>

              {/* Issue Date */}
              <div>
                <Label htmlFor="issueDate">{t('form.issueDate')}</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => updateField('issueDate', e.target.value)}
                  className={cn('mt-1', errors.issueDate && 'border-red-500')}
                  data-testid="input-issueDate"
                />
                {errors.issueDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.issueDate}</p>
                )}
              </div>

              {/* Maturity Date */}
              <div>
                <Label htmlFor="maturityDate">{t('form.maturityDate')}</Label>
                <Input
                  id="maturityDate"
                  type="date"
                  value={form.maturityDate}
                  onChange={(e) => updateField('maturityDate', e.target.value)}
                  className={cn('mt-1', errors.maturityDate && 'border-red-500')}
                  data-testid="input-maturityDate"
                />
                {errors.maturityDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.maturityDate}</p>
                )}
              </div>
            </div>
          </section>

          {/* Conversion Terms */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              {t('form.sectionConversion')}
            </h2>
            <div className="space-y-4">
              {/* Discount Rate */}
              <div>
                <Label htmlFor="discountRate">{t('form.discountRate')}</Label>
                <Input
                  id="discountRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.discountRate}
                  onChange={(e) => updateField('discountRate', e.target.value)}
                  placeholder={t('form.discountRatePlaceholder')}
                  className={cn('mt-1', errors.discountRate && 'border-red-500')}
                  data-testid="input-discountRate"
                />
                {errors.discountRate && (
                  <p className="mt-1 text-xs text-red-600">{errors.discountRate}</p>
                )}
              </div>

              {/* Valuation Cap */}
              <div>
                <Label htmlFor="valuationCap">{t('form.valuationCap')}</Label>
                <Input
                  id="valuationCap"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valuationCap}
                  onChange={(e) => updateField('valuationCap', e.target.value)}
                  placeholder={t('form.valuationCapPlaceholder')}
                  className={cn('mt-1', errors.valuationCap && 'border-red-500')}
                  data-testid="input-valuationCap"
                />
                {errors.valuationCap && (
                  <p className="mt-1 text-xs text-red-600">{errors.valuationCap}</p>
                )}
              </div>

              {/* Qualified Financing Threshold */}
              <div>
                <Label htmlFor="qualifiedFinancingThreshold">
                  {t('form.qualifiedFinancingThreshold')}
                </Label>
                <Input
                  id="qualifiedFinancingThreshold"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.qualifiedFinancingThreshold}
                  onChange={(e) =>
                    updateField('qualifiedFinancingThreshold', e.target.value)
                  }
                  placeholder={t('form.qualifiedFinancingThresholdPlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.qualifiedFinancingThreshold && 'border-red-500',
                  )}
                  data-testid="input-qualifiedFinancingThreshold"
                />
                {errors.qualifiedFinancingThreshold && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.qualifiedFinancingThreshold}
                  </p>
                )}
              </div>

              {/* Conversion Trigger */}
              <div>
                <Label htmlFor="conversionTrigger">
                  {t('form.conversionTrigger')}
                </Label>
                <select
                  id="conversionTrigger"
                  value={form.conversionTrigger}
                  onChange={(e) => updateField('conversionTrigger', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
                  data-testid="select-conversionTrigger"
                >
                  <option value="">{t('form.conversionTriggerPlaceholder')}</option>
                  {CONVERSION_TRIGGERS.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {t(ct.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Share Class */}
              <div>
                <Label htmlFor="targetShareClassId">{t('form.shareClass')}</Label>
                <select
                  id="targetShareClassId"
                  value={form.targetShareClassId}
                  onChange={(e) => updateField('targetShareClassId', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
                  data-testid="select-targetShareClassId"
                >
                  <option value="">{t('form.shareClassPlaceholder')}</option>
                  {shareClasses.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.className} ({sc.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-convert checkbox */}
              <div className="flex items-start gap-3">
                <input
                  id="autoConvert"
                  type="checkbox"
                  checked={form.autoConvert}
                  onChange={(e) => updateField('autoConvert', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-600"
                  data-testid="checkbox-autoConvert"
                />
                <div>
                  <Label htmlFor="autoConvert">{t('form.autoConvert')}</Label>
                  <p className="text-xs text-gray-500">
                    {t('form.autoConvertHelp')}
                  </p>
                </div>
              </div>

              {/* MFN Clause checkbox */}
              <div className="flex items-start gap-3">
                <input
                  id="mfnClause"
                  type="checkbox"
                  checked={form.mfnClause}
                  onChange={(e) => updateField('mfnClause', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-600"
                  data-testid="checkbox-mfnClause"
                />
                <div>
                  <Label htmlFor="mfnClause">{t('form.mfnClause')}</Label>
                  <p className="text-xs text-gray-500">
                    {t('form.mfnClauseHelp')}
                  </p>
                </div>
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
              href="/dashboard/convertibles"
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
                    {t(`instrumentType.${form.instrumentType === 'MUTUO_CONVERSIVEL' ? 'mutuoConversivel' : form.instrumentType === 'INVESTIMENTO_ANJO' ? 'investimentoAnjo' : form.instrumentType.toLowerCase()}`)}
                  </dd>
                </div>

                {/* Investor */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewInvestor')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-investor"
                  >
                    {selectedShareholder?.name ?? '—'}
                  </dd>
                </div>

                {/* Principal Amount */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewPrincipalAmount')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-principalAmount"
                  >
                    {formatCurrency(form.principalAmount)}
                  </dd>
                </div>

                {/* Interest Rate */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewInterestRate')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-interestRate"
                  >
                    {formatPercent(form.interestRate)}
                  </dd>
                </div>

                {/* Interest Type */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewInterestType')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-interestType"
                  >
                    {t(`interestType.${form.interestType.toLowerCase()}`)}
                  </dd>
                </div>

                {/* Issue Date */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewIssueDate')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-issueDate"
                  >
                    {formatDate(form.issueDate)}
                  </dd>
                </div>

                {/* Maturity Date */}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewMaturityDate')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-maturityDate"
                  >
                    {formatDate(form.maturityDate)}
                  </dd>
                </div>

                {/* Discount Rate (optional) */}
                {form.discountRate.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewDiscountRate')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-discountRate"
                    >
                      {formatPercent(form.discountRate)}
                    </dd>
                  </div>
                )}

                {/* Valuation Cap (optional) */}
                {form.valuationCap.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewValuationCap')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-valuationCap"
                    >
                      {formatCurrency(form.valuationCap)}
                    </dd>
                  </div>
                )}

                {/* Qualified Financing (optional) */}
                {form.qualifiedFinancingThreshold.trim() && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewQualifiedFinancing')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-qualifiedFinancing"
                    >
                      {formatCurrency(form.qualifiedFinancingThreshold)}
                    </dd>
                  </div>
                )}

                {/* Conversion Trigger (optional) */}
                {form.conversionTrigger && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewConversionTrigger')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-conversionTrigger"
                    >
                      {selectedTrigger ? t(selectedTrigger.labelKey) : '—'}
                    </dd>
                  </div>
                )}

                {/* Target Share Class (optional) */}
                {form.targetShareClassId && (
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
                )}

                {/* Auto-Convert */}
                {form.autoConvert && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewAutoConvert')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-autoConvert"
                    >
                      {commonT('yes')}
                    </dd>
                  </div>
                )}

                {/* MFN Clause */}
                {form.mfnClause && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-gray-500">
                      {t('form.reviewMfnClause')}
                    </dt>
                    <dd
                      className="text-sm font-medium text-gray-900"
                      data-testid="review-mfnClause"
                    >
                      {commonT('yes')}
                    </dd>
                  </div>
                )}

                {/* Notes (optional) */}
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
