'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Layers,
  Vote,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useCreateShareClass } from '@/hooks/use-share-classes';
import { useErrorToast } from '@/lib/use-error-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ShareClassType } from '@/types/company';

// --- Type card data ---

interface TypeOption {
  value: ShareClassType;
  labelKey: string;
  descriptionKey: string;
  iconColor: string;
  bgColor: string;
  textColor: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: 'QUOTA',
    labelKey: 'type.quota',
    descriptionKey: 'form.typeQuotaDescription',
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
    textColor: 'text-ocean-700',
  },
  {
    value: 'COMMON_SHARES',
    labelKey: 'type.commonShares',
    descriptionKey: 'form.typeCommonDescription',
    iconColor: 'text-celadon-700',
    bgColor: 'bg-celadon-50',
    textColor: 'text-celadon-700',
  },
  {
    value: 'PREFERRED_SHARES',
    labelKey: 'type.preferredShares',
    descriptionKey: 'form.typePreferredDescription',
    iconColor: 'text-cream-700',
    bgColor: 'bg-cream-50',
    textColor: 'text-cream-700',
  },
];

// --- Helpers ---

function getAvailableTypes(entityType: string | undefined): ShareClassType[] {
  if (entityType === 'LTDA') return ['QUOTA'];
  // S.A. types (SA_CAPITAL_FECHADO, SA_CAPITAL_ABERTO)
  return ['COMMON_SHARES', 'PREFERRED_SHARES'];
}

function getDefaultVotesPerShare(type: ShareClassType): number {
  if (type === 'PREFERRED_SHARES') return 0;
  return 1;
}

// --- Form State ---

interface FormState {
  className: string;
  type: ShareClassType;
  totalAuthorized: string;
  votesPerShare: string;
  liquidationPreferenceMultiple: string;
  participatingRights: boolean;
  rightOfFirstRefusal: boolean;
  lockUpPeriodMonths: string;
  tagAlongPercentage: string;
}

interface FormErrors {
  className?: string;
  totalAuthorized?: string;
  votesPerShare?: string;
  liquidationPreferenceMultiple?: string;
  lockUpPeriodMonths?: string;
  tagAlongPercentage?: string;
}

function validateForm(form: FormState, t: (key: string) => string): FormErrors {
  const errors: FormErrors = {};

  if (!form.className.trim()) {
    errors.className = t('errors.val.required');
  } else if (form.className.length > 100) {
    errors.className = t('errors.val.maxLength');
  }

  if (!form.totalAuthorized.trim()) {
    errors.totalAuthorized = t('errors.val.required');
  } else {
    const num = parseFloat(form.totalAuthorized);
    if (isNaN(num) || num < 0) {
      errors.totalAuthorized = t('errors.val.mustBePositive');
    }
  }

  if (form.type !== 'PREFERRED_SHARES') {
    const votes = parseInt(form.votesPerShare, 10);
    if (isNaN(votes) || votes < 0) {
      errors.votesPerShare = t('errors.val.mustBePositive');
    } else if (form.type === 'COMMON_SHARES' && votes < 1) {
      errors.votesPerShare = t('errors.val.mustBePositive');
    } else if (votes > 100) {
      errors.votesPerShare = t('errors.val.maxValue');
    }
  }

  if (form.type === 'PREFERRED_SHARES' && form.liquidationPreferenceMultiple.trim()) {
    const val = parseFloat(form.liquidationPreferenceMultiple);
    if (isNaN(val) || val < 1) {
      errors.liquidationPreferenceMultiple = t('errors.val.mustBePositive');
    }
  }

  if (form.lockUpPeriodMonths.trim()) {
    const val = parseInt(form.lockUpPeriodMonths, 10);
    if (isNaN(val) || val < 0) {
      errors.lockUpPeriodMonths = t('errors.val.mustBePositive');
    } else if (val > 120) {
      errors.lockUpPeriodMonths = t('errors.val.maxValue');
    }
  }

  if (form.tagAlongPercentage.trim()) {
    const val = parseFloat(form.tagAlongPercentage);
    if (isNaN(val) || val < 0 || val > 100) {
      errors.tagAlongPercentage = t('errors.val.mustBePositive');
    }
  }

  return errors;
}

// --- Main Component ---

export default function CreateShareClassPage() {
  const t = useTranslations('shareClasses');
  const commonT = useTranslations('common');
  const errorsT = useTranslations();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const createMutation = useCreateShareClass(selectedCompany?.id);
  const showErrorToast = useErrorToast();

  const availableTypes = getAvailableTypes(selectedCompany?.entityType);
  const isLtda = selectedCompany?.entityType === 'LTDA';

  const [form, setForm] = useState<FormState>({
    className: '',
    type: availableTypes[0],
    totalAuthorized: '',
    votesPerShare: String(getDefaultVotesPerShare(availableTypes[0])),
    liquidationPreferenceMultiple: '',
    participatingRights: false,
    rightOfFirstRefusal: true,
    lockUpPeriodMonths: '',
    tagAlongPercentage: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const isPreferred = form.type === 'PREFERRED_SHARES';
  const isCommon = form.type === 'COMMON_SHARES';

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function selectType(type: ShareClassType) {
    setForm((prev) => ({
      ...prev,
      type,
      votesPerShare: String(getDefaultVotesPerShare(type)),
      liquidationPreferenceMultiple: type === 'PREFERRED_SHARES' ? prev.liquidationPreferenceMultiple : '',
      participatingRights: type === 'PREFERRED_SHARES' ? prev.participatingRights : false,
    }));
    if (submitted) {
      setErrors({});
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);

    const validationErrors = validateForm(form, errorsT);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await createMutation.mutateAsync({
        className: form.className.trim(),
        type: form.type,
        totalAuthorized: form.totalAuthorized.trim(),
        votesPerShare: isPreferred ? 0 : parseInt(form.votesPerShare, 10),
        liquidationPreferenceMultiple:
          isPreferred && form.liquidationPreferenceMultiple.trim()
            ? parseFloat(form.liquidationPreferenceMultiple)
            : null,
        participatingRights: isPreferred ? form.participatingRights : false,
        rightOfFirstRefusal: form.rightOfFirstRefusal,
        lockUpPeriodMonths: form.lockUpPeriodMonths.trim()
          ? parseInt(form.lockUpPeriodMonths, 10)
          : null,
        tagAlongPercentage: form.tagAlongPercentage.trim()
          ? parseFloat(form.tagAlongPercentage)
          : null,
      });
      toast.success(t('success.created'));
      router.push('/dashboard/share-classes');
    } catch (error) {
      showErrorToast(error);
    }
  }

  // --- No company selected state ---
  if (!selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Layers className="mx-auto h-12 w-12 text-gray-300" />
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
          href="/dashboard/share-classes"
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

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Type Selection */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('form.sectionType')}
          </h2>

          {isLtda && (
            <div className="mb-3 flex items-start gap-2 rounded-md bg-ocean-50 p-3 text-sm text-ocean-700">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {t('form.typeLtdaNote')}
            </div>
          )}

          <div className={cn('grid gap-3', availableTypes.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {availableTypes.map((typeVal) => {
              const opt = TYPE_OPTIONS.find((o) => o.value === typeVal)!;
              const isSelected = form.type === typeVal;

              return (
                <button
                  key={typeVal}
                  type="button"
                  onClick={() => selectType(typeVal)}
                  className={cn(
                    'rounded-lg border-2 p-4 text-left transition-colors',
                    isSelected
                      ? 'border-ocean-600 bg-ocean-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                  )}
                  data-testid={`type-card-${typeVal}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md',
                        opt.bgColor,
                      )}
                    >
                      <Layers className={cn('h-4 w-4', opt.iconColor)} />
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

        {/* Basic Info */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('form.sectionBasicInfo')}
          </h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="className">{t('form.className')}</Label>
              <Input
                id="className"
                value={form.className}
                onChange={(e) => updateField('className', e.target.value)}
                placeholder={t('form.classNamePlaceholder')}
                maxLength={100}
                className={cn('mt-1', errors.className && 'border-red-500')}
                data-testid="input-className"
              />
              {errors.className && (
                <p className="mt-1 text-xs text-red-600">{errors.className}</p>
              )}
            </div>

            <div>
              <Label htmlFor="totalAuthorized">{t('form.totalAuthorized')}</Label>
              <Input
                id="totalAuthorized"
                type="number"
                min="0"
                step="any"
                value={form.totalAuthorized}
                onChange={(e) => updateField('totalAuthorized', e.target.value)}
                placeholder={t('form.totalAuthorizedPlaceholder')}
                className={cn('mt-1', errors.totalAuthorized && 'border-red-500')}
                data-testid="input-totalAuthorized"
              />
              {errors.totalAuthorized && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.totalAuthorized}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Voting Rights */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            <Vote className="mr-2 inline h-4 w-4" />
            {t('form.sectionVoting')}
          </h2>

          {isPreferred && (
            <div className="mb-3 flex items-start gap-2 rounded-md bg-cream-50 p-3 text-sm text-cream-700">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {t('form.preferredNote')}
            </div>
          )}

          <div>
            <Label htmlFor="votesPerShare">{t('form.votesPerShare')}</Label>
            <Input
              id="votesPerShare"
              type="number"
              min={isCommon ? '1' : '0'}
              max="100"
              step="1"
              value={isPreferred ? '0' : form.votesPerShare}
              onChange={(e) => updateField('votesPerShare', e.target.value)}
              placeholder={t('form.votesPerSharePlaceholder')}
              disabled={isPreferred}
              className={cn(
                'mt-1',
                errors.votesPerShare && 'border-red-500',
                isPreferred && 'bg-gray-100 text-gray-400',
              )}
              data-testid="input-votesPerShare"
            />
            {errors.votesPerShare && (
              <p className="mt-1 text-xs text-red-600">
                {errors.votesPerShare}
              </p>
            )}
          </div>
        </section>

        {/* Liquidation Preferences (PREFERRED_SHARES only) */}
        {isPreferred && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              <ShieldCheck className="mr-2 inline h-4 w-4" />
              {t('form.sectionPreferences')}
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="liquidationMultiple">
                  {t('form.liquidationMultiple')}
                </Label>
                <Input
                  id="liquidationMultiple"
                  type="number"
                  min="1"
                  step="0.1"
                  value={form.liquidationPreferenceMultiple}
                  onChange={(e) =>
                    updateField('liquidationPreferenceMultiple', e.target.value)
                  }
                  placeholder={t('form.liquidationMultiplePlaceholder')}
                  className={cn(
                    'mt-1',
                    errors.liquidationPreferenceMultiple && 'border-red-500',
                  )}
                  data-testid="input-liquidationMultiple"
                />
                {errors.liquidationPreferenceMultiple && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.liquidationPreferenceMultiple}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3">
                <input
                  id="participatingRights"
                  type="checkbox"
                  checked={form.participatingRights}
                  onChange={(e) =>
                    updateField('participatingRights', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500"
                  data-testid="input-participatingRights"
                />
                <div>
                  <Label htmlFor="participatingRights" className="cursor-pointer">
                    {t('form.participatingRights')}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {t('form.participatingRightsDescription')}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Transfer Restrictions */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('form.sectionRestrictions')}
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                id="rightOfFirstRefusal"
                type="checkbox"
                checked={form.rightOfFirstRefusal}
                onChange={(e) =>
                  updateField('rightOfFirstRefusal', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500"
                data-testid="input-rightOfFirstRefusal"
              />
              <div>
                <Label htmlFor="rightOfFirstRefusal" className="cursor-pointer">
                  {t('form.rightOfFirstRefusal')}
                </Label>
                <p className="text-xs text-gray-500">
                  {t('form.rightOfFirstRefusalDescription')}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="lockUpMonths">{t('form.lockUpMonths')}</Label>
              <Input
                id="lockUpMonths"
                type="number"
                min="0"
                max="120"
                step="1"
                value={form.lockUpPeriodMonths}
                onChange={(e) =>
                  updateField('lockUpPeriodMonths', e.target.value)
                }
                placeholder={t('form.lockUpMonthsPlaceholder')}
                className={cn(
                  'mt-1',
                  errors.lockUpPeriodMonths && 'border-red-500',
                )}
                data-testid="input-lockUpMonths"
              />
              {errors.lockUpPeriodMonths && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.lockUpPeriodMonths}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="tagAlong">{t('form.tagAlong')}</Label>
              <Input
                id="tagAlong"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.tagAlongPercentage}
                onChange={(e) =>
                  updateField('tagAlongPercentage', e.target.value)
                }
                placeholder={t('form.tagAlongPlaceholder')}
                className={cn(
                  'mt-1',
                  errors.tagAlongPercentage && 'border-red-500',
                )}
                data-testid="input-tagAlong"
              />
              {errors.tagAlongPercentage && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.tagAlongPercentage}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
          <Link
            href="/dashboard/share-classes"
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            {commonT('cancel')}
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ocean-500 disabled:opacity-50"
            data-testid="submit-button"
          >
            {createMutation.isPending ? '...' : commonT('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
