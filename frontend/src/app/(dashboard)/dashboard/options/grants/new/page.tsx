'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useCreateOptionGrant,
  useOptionPlans,
} from '@/hooks/use-option-plans';
import { useShareholders } from '@/hooks/use-shareholders';
import { useErrorToast } from '@/lib/use-error-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OptionPlan } from '@/types/company';

// --- Types ---

type VestingFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

type Step = 'details' | 'review';

interface FormState {
  optionPlanId: string;
  employeeName: string;
  employeeEmail: string;
  quantity: string;
  strikePrice: string;
  grantDate: string;
  expirationDate: string;
  cliffMonths: string;
  vestingDurationMonths: string;
  vestingFrequency: VestingFrequency;
  accelerationOnCoc: boolean;
  shareholderId: string;
  notes: string;
}

interface FormErrors {
  optionPlanId?: string;
  employeeName?: string;
  employeeEmail?: string;
  quantity?: string;
  strikePrice?: string;
  grantDate?: string;
  expirationDate?: string;
  cliffMonths?: string;
  vestingDurationMonths?: string;
}

const INITIAL_FORM: FormState = {
  optionPlanId: '',
  employeeName: '',
  employeeEmail: '',
  quantity: '',
  strikePrice: '',
  grantDate: '',
  expirationDate: '',
  cliffMonths: '12',
  vestingDurationMonths: '48',
  vestingFrequency: 'MONTHLY',
  accelerationOnCoc: false,
  shareholderId: '',
  notes: '',
};

// --- Formatting helpers ---

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatDate(date: string): string {
  if (!date) return '';
  const d = new Date(date + 'T00:00:00');
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

// --- Helpers ---

function getAvailableOptions(plan: OptionPlan | undefined): number {
  if (!plan) return 0;
  const total = parseFloat(String(plan.totalPoolSize)) || 0;
  const granted = parseFloat(String(plan.totalGranted)) || 0;
  return Math.max(0, total - granted);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Validation ---

function validateForm(
  form: FormState,
  errorsT: (key: string) => string,
  selectedPlan: OptionPlan | undefined,
): FormErrors {
  const errors: FormErrors = {};

  if (!form.optionPlanId) {
    errors.optionPlanId = errorsT('errors.val.required');
  }

  if (!form.employeeName.trim()) {
    errors.employeeName = errorsT('errors.val.required');
  }

  if (!form.employeeEmail.trim()) {
    errors.employeeEmail = errorsT('errors.val.required');
  } else if (!EMAIL_REGEX.test(form.employeeEmail.trim())) {
    errors.employeeEmail = errorsT('errors.val.invalidEmail');
  }

  if (!form.quantity.trim()) {
    errors.quantity = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.quantity);
    if (isNaN(num) || num <= 0) {
      errors.quantity = errorsT('errors.val.mustBePositive');
    } else if (selectedPlan) {
      const available = getAvailableOptions(selectedPlan);
      if (num > available) {
        errors.quantity = errorsT('errors.val.maxValue');
      }
    }
  }

  if (!form.strikePrice.trim()) {
    errors.strikePrice = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.strikePrice);
    if (isNaN(num) || num <= 0) {
      errors.strikePrice = errorsT('errors.val.mustBePositive');
    }
  }

  if (!form.grantDate.trim()) {
    errors.grantDate = errorsT('errors.val.required');
  }

  if (!form.expirationDate.trim()) {
    errors.expirationDate = errorsT('errors.val.required');
  } else if (form.grantDate.trim()) {
    if (form.expirationDate <= form.grantDate) {
      errors.expirationDate = errorsT('errors.val.mustBePositive');
    }
  }

  if (!form.cliffMonths.trim()) {
    errors.cliffMonths = errorsT('errors.val.required');
  } else {
    const cliff = parseInt(form.cliffMonths, 10);
    if (isNaN(cliff) || cliff < 0) {
      errors.cliffMonths = errorsT('errors.val.mustBePositive');
    } else if (form.vestingDurationMonths.trim()) {
      const vesting = parseInt(form.vestingDurationMonths, 10);
      if (!isNaN(vesting) && cliff > vesting) {
        errors.cliffMonths = errorsT('errors.val.maxValue');
      }
    }
  }

  if (!form.vestingDurationMonths.trim()) {
    errors.vestingDurationMonths = errorsT('errors.val.required');
  } else {
    const num = parseInt(form.vestingDurationMonths, 10);
    if (isNaN(num) || num <= 0) {
      errors.vestingDurationMonths = errorsT('errors.val.mustBePositive');
    }
  }

  return errors;
}

// --- Component ---

export default function CreateOptionGrantPage() {
  const t = useTranslations('optionPlans');
  const commonT = useTranslations('common');
  const errorsT = useTranslations();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const createMutation = useCreateOptionGrant(selectedCompany?.id);
  const showErrorToast = useErrorToast();

  // Fetch active plans for dropdown
  const { data: plansData } = useOptionPlans(selectedCompany?.id, {
    limit: 100,
    status: 'ACTIVE',
  });
  const plans = useMemo(() => plansData?.data ?? [], [plansData]);

  // Fetch shareholders for optional linking
  const { data: shareholdersData } = useShareholders(selectedCompany?.id, {
    limit: 100,
  });
  const shareholders = useMemo(
    () => shareholdersData?.data ?? [],
    [shareholdersData],
  );

  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Computed values
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === form.optionPlanId),
    [plans, form.optionPlanId],
  );

  const availableOptions = useMemo(
    () => getAvailableOptions(selectedPlan),
    [selectedPlan],
  );

  const selectedShareholder = useMemo(
    () => shareholders.find((s) => s.id === form.shareholderId),
    [shareholders, form.shareholderId],
  );

  const totalValue = useMemo(() => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.strikePrice);
    if (isNaN(qty) || isNaN(price)) return 0;
    return qty * price;
  }, [form.quantity, form.strikePrice]);

  // Handlers
  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function selectPlan(planId: string) {
    const plan = plans.find((p) => p.id === planId);
    setForm((prev) => ({
      ...prev,
      optionPlanId: planId,
      // Pre-fill defaults from plan when selected
      ...(plan
        ? {
            cliffMonths: '12',
            vestingDurationMonths: '48',
            vestingFrequency: 'MONTHLY' as VestingFrequency,
          }
        : {}),
    }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, optionPlanId: undefined }));
    }
  }

  function handleNext() {
    setSubmitted(true);
    const validationErrors = validateForm(form, errorsT, selectedPlan);
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
      optionPlanId: form.optionPlanId,
      employeeName: form.employeeName.trim(),
      employeeEmail: form.employeeEmail.trim(),
      quantity: form.quantity.trim(),
      strikePrice: form.strikePrice.trim(),
      grantDate: form.grantDate.trim(),
      expirationDate: form.expirationDate.trim(),
      cliffMonths: parseInt(form.cliffMonths, 10),
      vestingDurationMonths: parseInt(form.vestingDurationMonths, 10),
      vestingFrequency: form.vestingFrequency,
    };

    if (form.accelerationOnCoc) {
      payload.accelerationOnCoc = true;
    }

    if (form.shareholderId) {
      payload.shareholderId = form.shareholderId;
    }

    if (form.notes.trim()) {
      payload.notes = form.notes.trim();
    }

    try {
      await createMutation.mutateAsync(
        payload as unknown as Parameters<
          typeof createMutation.mutateAsync
        >[0],
      );
      toast.success(t('success.grantCreated'));
      router.push('/dashboard/options');
    } catch (error) {
      showErrorToast(error);
    }
  }

  // No company guard
  if (!selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
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
          href="/dashboard/options"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('title')}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">
          {t('grantForm.createTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('grantForm.createDescription')}
        </p>
      </div>

      {/* Step indicator */}
      <div
        className="mb-8 flex items-center gap-3"
        data-testid="step-indicator"
      >
        <div
          className={cn(
            'flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium',
            step === 'details'
              ? 'bg-ocean-600 text-white'
              : 'bg-celadon-50 text-celadon-700',
          )}
        >
          {step === 'review' ? (
            <Check className="h-4 w-4" />
          ) : (
            <span>1</span>
          )}
          {t('grantForm.stepDetails')}
        </div>
        <div className="h-px flex-1 bg-gray-200" />
        <div
          className={cn(
            'flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium',
            step === 'review'
              ? 'bg-ocean-600 text-white'
              : 'bg-gray-100 text-gray-400',
          )}
        >
          <span>2</span>
          {t('grantForm.stepReview')}
        </div>
      </div>

      {/* Step 1: Details */}
      {step === 'details' && (
        <div className="space-y-8">
          {/* Employee Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {t('grantForm.sectionEmployee')}
            </h2>
            <div className="space-y-4">
              {/* Employee Name */}
              <div>
                <Label htmlFor="employeeName">
                  {t('grantForm.employeeName')}
                </Label>
                <Input
                  id="employeeName"
                  value={form.employeeName}
                  onChange={(e) =>
                    updateField('employeeName', e.target.value)
                  }
                  placeholder={t('grantForm.employeeNamePlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.employeeName && 'border-red-500',
                  )}
                  maxLength={200}
                  data-testid="input-employeeName"
                />
                {errors.employeeName && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.employeeName}
                  </p>
                )}
              </div>

              {/* Employee Email */}
              <div>
                <Label htmlFor="employeeEmail">
                  {t('grantForm.employeeEmail')}
                </Label>
                <Input
                  id="employeeEmail"
                  type="email"
                  value={form.employeeEmail}
                  onChange={(e) =>
                    updateField('employeeEmail', e.target.value)
                  }
                  placeholder={t('grantForm.employeeEmailPlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.employeeEmail && 'border-red-500',
                  )}
                  maxLength={255}
                  data-testid="input-employeeEmail"
                />
                {errors.employeeEmail && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.employeeEmail}
                  </p>
                )}
              </div>

              {/* Linked Shareholder (optional) */}
              <div>
                <Label htmlFor="shareholderId">
                  {t('grantForm.shareholder')}
                </Label>
                <select
                  id="shareholderId"
                  value={form.shareholderId}
                  onChange={(e) =>
                    updateField('shareholderId', e.target.value)
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
                  data-testid="select-shareholderId"
                >
                  <option value="">
                    {t('grantForm.shareholderNone')}
                  </option>
                  {shareholders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {t('grantForm.shareholderHelp')}
                </p>
              </div>
            </div>
          </section>

          {/* Grant Terms Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {t('grantForm.sectionTerms')}
            </h2>
            <div className="space-y-4">
              {/* Option Plan */}
              <div>
                <Label htmlFor="optionPlanId">
                  {t('grantForm.optionPlan')}
                </Label>
                <select
                  id="optionPlanId"
                  value={form.optionPlanId}
                  onChange={(e) => selectPlan(e.target.value)}
                  className={cn(
                    'mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                    errors.optionPlanId
                      ? 'border-red-500'
                      : 'border-gray-300',
                  )}
                  data-testid="select-optionPlanId"
                >
                  <option value="">
                    {t('grantForm.optionPlanPlaceholder')}
                  </option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
                {errors.optionPlanId && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.optionPlanId}
                  </p>
                )}
                {selectedPlan && (
                  <p
                    className="mt-1 text-xs text-ocean-600"
                    data-testid="available-options"
                  >
                    {t('grantForm.availableOptions', {
                      count: formatNumber(availableOptions),
                    })}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">
                  {t('grantForm.quantity')}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) =>
                    updateField('quantity', e.target.value)
                  }
                  placeholder={t('grantForm.quantityPlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.quantity && 'border-red-500',
                  )}
                  data-testid="input-quantity"
                />
                {errors.quantity && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.quantity}
                  </p>
                )}
              </div>

              {/* Strike Price */}
              <div>
                <Label htmlFor="strikePrice">
                  {t('grantForm.strikePrice')}
                </Label>
                <Input
                  id="strikePrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.strikePrice}
                  onChange={(e) =>
                    updateField('strikePrice', e.target.value)
                  }
                  placeholder={t('grantForm.strikePricePlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.strikePrice && 'border-red-500',
                  )}
                  data-testid="input-strikePrice"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('grantForm.strikePriceHelp')}
                </p>
                {errors.strikePrice && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.strikePrice}
                  </p>
                )}
              </div>

              {/* Total Value (calculated) */}
              {totalValue > 0 && (
                <div
                  className="rounded-md bg-gray-50 px-4 py-3"
                  data-testid="calculated-totalValue"
                >
                  <span className="text-sm text-gray-500">
                    {t('grantForm.reviewTotalValue')}:{' '}
                  </span>
                  <span className="text-sm font-bold text-navy-900">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              )}

              {/* Grant Date */}
              <div>
                <Label htmlFor="grantDate">
                  {t('grantForm.grantDate')}
                </Label>
                <Input
                  id="grantDate"
                  type="date"
                  value={form.grantDate}
                  onChange={(e) =>
                    updateField('grantDate', e.target.value)
                  }
                  className={cn(
                    'mt-1',
                    errors.grantDate && 'border-red-500',
                  )}
                  data-testid="input-grantDate"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('grantForm.grantDateHelp')}
                </p>
                {errors.grantDate && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.grantDate}
                  </p>
                )}
              </div>

              {/* Expiration Date */}
              <div>
                <Label htmlFor="expirationDate">
                  {t('grantForm.expirationDate')}
                </Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={form.expirationDate}
                  onChange={(e) =>
                    updateField('expirationDate', e.target.value)
                  }
                  className={cn(
                    'mt-1',
                    errors.expirationDate && 'border-red-500',
                  )}
                  data-testid="input-expirationDate"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('grantForm.expirationDateHelp')}
                </p>
                {errors.expirationDate && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.expirationDate}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Vesting Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {t('grantForm.sectionVesting')}
            </h2>
            <div className="space-y-4">
              {/* Cliff Months */}
              <div>
                <Label htmlFor="cliffMonths">
                  {t('grantForm.cliffMonths')}
                </Label>
                <Input
                  id="cliffMonths"
                  type="number"
                  min="0"
                  max="60"
                  value={form.cliffMonths}
                  onChange={(e) =>
                    updateField('cliffMonths', e.target.value)
                  }
                  placeholder={t('grantForm.cliffMonthsPlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.cliffMonths && 'border-red-500',
                  )}
                  data-testid="input-cliffMonths"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('grantForm.cliffMonthsHelp')}
                </p>
                {errors.cliffMonths && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.cliffMonths}
                  </p>
                )}
              </div>

              {/* Vesting Duration Months */}
              <div>
                <Label htmlFor="vestingDurationMonths">
                  {t('grantForm.vestingDurationMonths')}
                </Label>
                <Input
                  id="vestingDurationMonths"
                  type="number"
                  min="1"
                  max="120"
                  value={form.vestingDurationMonths}
                  onChange={(e) =>
                    updateField('vestingDurationMonths', e.target.value)
                  }
                  placeholder={t(
                    'grantForm.vestingDurationMonthsPlaceholder',
                  )}
                  className={cn(
                    'mt-1',
                    errors.vestingDurationMonths && 'border-red-500',
                  )}
                  data-testid="input-vestingDurationMonths"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('grantForm.vestingDurationMonthsHelp')}
                </p>
                {errors.vestingDurationMonths && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.vestingDurationMonths}
                  </p>
                )}
              </div>

              {/* Vesting Frequency */}
              <div>
                <Label htmlFor="vestingFrequency">
                  {t('grantForm.vestingFrequency')}
                </Label>
                <select
                  id="vestingFrequency"
                  value={form.vestingFrequency}
                  onChange={(e) =>
                    updateField(
                      'vestingFrequency',
                      e.target.value as VestingFrequency,
                    )
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
                  data-testid="select-vestingFrequency"
                >
                  <option value="MONTHLY">
                    {t('frequency.monthly')}
                  </option>
                  <option value="QUARTERLY">
                    {t('frequency.quarterly')}
                  </option>
                  <option value="ANNUALLY">
                    {t('frequency.annually')}
                  </option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {t('grantForm.vestingFrequencyHelp')}
                </p>
              </div>

              {/* Acceleration on Change of Control */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="accelerationOnCoc"
                  checked={form.accelerationOnCoc}
                  onChange={(e) =>
                    updateField('accelerationOnCoc', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-600"
                  data-testid="checkbox-accelerationOnCoc"
                />
                <div>
                  <Label htmlFor="accelerationOnCoc">
                    {t('grantForm.accelerationOnCoc')}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {t('grantForm.accelerationOnCocHelp')}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">{t('grantForm.notes')}</Label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder={t('grantForm.notesPlaceholder')}
                  maxLength={2000}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
                  data-testid="input-notes"
                />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
            <Link
              href="/dashboard/options"
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
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {t('grantForm.reviewTitle')}
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white">
            <dl className="divide-y divide-gray-100">
              {/* Employee Name */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewEmployeeName')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-employeeName"
                >
                  {form.employeeName}
                </dd>
              </div>

              {/* Employee Email */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewEmployeeEmail')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-employeeEmail"
                >
                  {form.employeeEmail}
                </dd>
              </div>

              {/* Linked Shareholder (optional) */}
              {form.shareholderId && (
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('grantForm.reviewShareholder')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-shareholder"
                  >
                    {selectedShareholder?.name ?? form.shareholderId}
                  </dd>
                </div>
              )}

              {/* Option Plan */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewOptionPlan')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-optionPlan"
                >
                  {selectedPlan?.name ?? form.optionPlanId}
                </dd>
              </div>

              {/* Quantity */}
              <div className="flex justify-between bg-gray-50 px-4 py-3">
                <dt className="text-sm font-medium text-gray-700">
                  {t('grantForm.reviewQuantity')}
                </dt>
                <dd
                  className="text-sm font-bold text-navy-900"
                  data-testid="review-quantity"
                >
                  {formatNumber(form.quantity)}
                </dd>
              </div>

              {/* Strike Price */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewStrikePrice')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-strikePrice"
                >
                  {formatCurrency(form.strikePrice)}
                </dd>
              </div>

              {/* Total Value */}
              <div className="flex justify-between bg-gray-50 px-4 py-3">
                <dt className="text-sm font-medium text-gray-700">
                  {t('grantForm.reviewTotalValue')}
                </dt>
                <dd
                  className="text-sm font-bold text-navy-900"
                  data-testid="review-totalValue"
                >
                  {formatCurrency(totalValue)}
                </dd>
              </div>

              {/* Grant Date */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewGrantDate')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-grantDate"
                >
                  {formatDate(form.grantDate)}
                </dd>
              </div>

              {/* Expiration Date */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewExpirationDate')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-expirationDate"
                >
                  {formatDate(form.expirationDate)}
                </dd>
              </div>

              {/* Cliff */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewCliffMonths')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-cliffMonths"
                >
                  {form.cliffMonths}{' '}
                  {t('grantForm.reviewCliffMonthsSuffix')}
                </dd>
              </div>

              {/* Vesting Duration */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewVestingDuration')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-vestingDuration"
                >
                  {form.vestingDurationMonths}{' '}
                  {t('grantForm.reviewVestingDurationSuffix')}
                </dd>
              </div>

              {/* Vesting Frequency */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('grantForm.reviewVestingFrequency')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-vestingFrequency"
                >
                  {t(
                    `frequency.${form.vestingFrequency === 'MONTHLY' ? 'monthly' : form.vestingFrequency === 'QUARTERLY' ? 'quarterly' : 'annually'}`,
                  )}
                </dd>
              </div>

              {/* Acceleration on CoC (optional) */}
              {form.accelerationOnCoc && (
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('grantForm.reviewAccelerationOnCoc')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-accelerationOnCoc"
                  >
                    {commonT('yes')}
                  </dd>
                </div>
              )}

              {/* Notes (optional) */}
              {form.notes.trim() && (
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('grantForm.reviewNotes')}
                  </dt>
                  <dd
                    className="max-w-xs text-right text-sm font-medium text-gray-900"
                    data-testid="review-notes"
                  >
                    {form.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
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
              {createMutation.isPending
                ? commonT('loading')
                : commonT('confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
