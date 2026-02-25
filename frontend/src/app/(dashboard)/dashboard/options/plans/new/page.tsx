'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  FileText,
  Shield,
  Zap,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useCreateOptionPlan } from '@/hooks/use-option-plans';
import { useShareClasses } from '@/hooks/use-share-classes';
import { useErrorToast } from '@/lib/use-error-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// --- Types ---

type TerminationPolicy = 'FORFEITURE' | 'ACCELERATION' | 'PRO_RATA';

type Step = 'details' | 'review';

interface FormState {
  name: string;
  shareClassId: string;
  totalPoolSize: string;
  boardApprovalDate: string;
  terminationPolicy: TerminationPolicy;
  exerciseWindowDays: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  shareClassId?: string;
  totalPoolSize?: string;
  exerciseWindowDays?: string;
}

interface TerminationOption {
  value: TerminationPolicy;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}

// --- Static data ---

const TERMINATION_OPTIONS: TerminationOption[] = [
  {
    value: 'FORFEITURE',
    labelKey: 'terminationPolicy.forfeiture',
    descriptionKey: 'form.forfeitureDescription',
    icon: Shield,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    value: 'ACCELERATION',
    labelKey: 'terminationPolicy.acceleration',
    descriptionKey: 'form.accelerationDescription',
    icon: Zap,
    iconColor: 'text-celadon-700',
    bgColor: 'bg-celadon-50',
  },
  {
    value: 'PRO_RATA',
    labelKey: 'terminationPolicy.proRata',
    descriptionKey: 'form.proRataDescription',
    icon: Percent,
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
  },
];

const INITIAL_FORM: FormState = {
  name: '',
  shareClassId: '',
  totalPoolSize: '',
  boardApprovalDate: '',
  terminationPolicy: 'FORFEITURE',
  exerciseWindowDays: '90',
  notes: '',
};

// --- Formatting helpers ---

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

// --- Validation ---

function validateForm(
  form: FormState,
  errorsT: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = errorsT('errors.val.required');
  }

  if (!form.shareClassId) {
    errors.shareClassId = errorsT('errors.val.required');
  }

  if (!form.totalPoolSize.trim()) {
    errors.totalPoolSize = errorsT('errors.val.required');
  } else {
    const num = parseFloat(form.totalPoolSize);
    if (isNaN(num) || num <= 0) {
      errors.totalPoolSize = errorsT('errors.val.mustBePositive');
    }
  }

  if (form.exerciseWindowDays.trim()) {
    const days = parseInt(form.exerciseWindowDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      errors.exerciseWindowDays = errorsT('errors.val.maxValue');
    }
  }

  return errors;
}

// --- Component ---

export default function CreateOptionPlanPage() {
  const t = useTranslations('optionPlans');
  const commonT = useTranslations('common');
  const errorsT = useTranslations();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const createMutation = useCreateOptionPlan(selectedCompany?.id);
  const showErrorToast = useErrorToast();

  const { data: shareClassesData } = useShareClasses(selectedCompany?.id, {
    limit: 100,
  });
  const shareClasses = shareClassesData?.data ?? [];

  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Computed values
  const selectedShareClass = useMemo(
    () => shareClasses.find((sc) => sc.id === form.shareClassId),
    [shareClasses, form.shareClassId],
  );

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

  function selectTerminationPolicy(policy: TerminationPolicy) {
    setForm((prev) => ({ ...prev, terminationPolicy: policy }));
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
      name: form.name.trim(),
      shareClassId: form.shareClassId,
      totalPoolSize: form.totalPoolSize.trim(),
      terminationPolicy: form.terminationPolicy,
    };

    if (form.boardApprovalDate.trim()) {
      payload.boardApprovalDate = form.boardApprovalDate.trim();
    }

    const exerciseDays = parseInt(form.exerciseWindowDays, 10);
    if (!isNaN(exerciseDays) && exerciseDays > 0) {
      payload.exerciseWindowDays = exerciseDays;
    }

    if (form.notes.trim()) {
      payload.notes = form.notes.trim();
    }

    try {
      await createMutation.mutateAsync(
        payload as Parameters<typeof createMutation.mutateAsync>[0],
      );
      toast.success(t('success.created'));
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
          {t('createTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('createDescription')}</p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3" data-testid="step-indicator">
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
          {t('form.stepDetails')}
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
          {t('form.stepReview')}
        </div>
      </div>

      {/* Step 1: Details */}
      {step === 'details' && (
        <div className="space-y-8">
          {/* Plan Details Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {t('form.sectionDetails')}
            </h2>
            <div className="space-y-4">
              {/* Plan Name */}
              <div>
                <Label htmlFor="name">{t('form.name')}</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                  className={cn('mt-1', errors.name && 'border-red-500')}
                  maxLength={200}
                  data-testid="input-name"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                )}
              </div>

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
                  <option value="">{t('form.shareClassPlaceholder')}</option>
                  {shareClasses.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.className}
                    </option>
                  ))}
                </select>
                {errors.shareClassId && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.shareClassId}
                  </p>
                )}
              </div>

              {/* Total Pool Size */}
              <div>
                <Label htmlFor="totalPoolSize">
                  {t('form.totalPoolSize')}
                </Label>
                <Input
                  id="totalPoolSize"
                  type="number"
                  min="1"
                  value={form.totalPoolSize}
                  onChange={(e) =>
                    updateField('totalPoolSize', e.target.value)
                  }
                  placeholder={t('form.totalPoolSizePlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.totalPoolSize && 'border-red-500',
                  )}
                  data-testid="input-totalPoolSize"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('form.totalPoolSizeHelp')}
                </p>
                {errors.totalPoolSize && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.totalPoolSize}
                  </p>
                )}
              </div>

              {/* Board Approval Date */}
              <div>
                <Label htmlFor="boardApprovalDate">
                  {t('form.boardApprovalDate')}
                </Label>
                <Input
                  id="boardApprovalDate"
                  type="date"
                  value={form.boardApprovalDate}
                  onChange={(e) =>
                    updateField('boardApprovalDate', e.target.value)
                  }
                  className="mt-1"
                  data-testid="input-boardApprovalDate"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('form.boardApprovalDateHelp')}
                </p>
              </div>
            </div>
          </section>

          {/* Plan Terms Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {t('form.sectionTerms')}
            </h2>
            <div className="space-y-4">
              {/* Termination Policy Cards */}
              <div>
                <Label>{t('form.terminationPolicy')}</Label>
                <p className="mb-2 text-xs text-gray-500">
                  {t('form.terminationPolicyHelp')}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {TERMINATION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected =
                      form.terminationPolicy === opt.value;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => selectTerminationPolicy(opt.value)}
                        className={cn(
                          'rounded-lg border-2 p-4 text-left transition-colors',
                          isSelected
                            ? 'border-ocean-600 bg-ocean-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                        )}
                        data-testid={`policy-card-${opt.value}`}
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
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exercise Window Days */}
              <div>
                <Label htmlFor="exerciseWindowDays">
                  {t('form.exerciseWindowDays')}
                </Label>
                <Input
                  id="exerciseWindowDays"
                  type="number"
                  min="1"
                  max="365"
                  value={form.exerciseWindowDays}
                  onChange={(e) =>
                    updateField('exerciseWindowDays', e.target.value)
                  }
                  className={cn(
                    'mt-1',
                    errors.exerciseWindowDays && 'border-red-500',
                  )}
                  data-testid="input-exerciseWindowDays"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('form.exerciseWindowDaysHelp')}
                </p>
                {errors.exerciseWindowDays && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.exerciseWindowDays}
                  </p>
                )}
              </div>

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
          <div className="rounded-lg border border-gray-200 bg-white">
            <dl className="divide-y divide-gray-100">
              {/* Plan Name */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('form.reviewName')}
                </dt>
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
                  {selectedShareClass?.className ?? form.shareClassId}
                </dd>
              </div>

              {/* Total Pool Size */}
              <div className="flex justify-between bg-gray-50 px-4 py-3">
                <dt className="text-sm font-medium text-gray-700">
                  {t('form.reviewTotalPoolSize')}
                </dt>
                <dd
                  className="text-sm font-bold text-navy-900"
                  data-testid="review-totalPoolSize"
                >
                  {formatNumber(form.totalPoolSize)}
                </dd>
              </div>

              {/* Termination Policy */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('form.reviewTerminationPolicy')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-terminationPolicy"
                >
                  {t(`terminationPolicy.${form.terminationPolicy === 'FORFEITURE' ? 'forfeiture' : form.terminationPolicy === 'ACCELERATION' ? 'acceleration' : 'proRata'}`)}
                </dd>
              </div>

              {/* Exercise Window */}
              <div className="flex justify-between px-4 py-3">
                <dt className="text-sm text-gray-500">
                  {t('form.reviewExerciseWindowDays')}
                </dt>
                <dd
                  className="text-sm font-medium text-gray-900"
                  data-testid="review-exerciseWindowDays"
                >
                  {form.exerciseWindowDays} {t('form.reviewExerciseWindowDaysSuffix')}
                </dd>
              </div>

              {/* Board Approval Date (optional) */}
              {form.boardApprovalDate.trim() && (
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-sm text-gray-500">
                    {t('form.reviewBoardApprovalDate')}
                  </dt>
                  <dd
                    className="text-sm font-medium text-gray-900"
                    data-testid="review-boardApprovalDate"
                  >
                    {formatDate(form.boardApprovalDate)}
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
