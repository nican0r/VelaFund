'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Building2,
  Globe,
  UserCheck,
  Briefcase,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useCreateShareholder } from '@/hooks/use-shareholders';
import { useErrorToast } from '@/lib/use-error-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ShareholderType } from '@/types/company';

// --- CPF/CNPJ formatting and validation ---

function formatCpf(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCnpj(digits: string): string {
  const d = digits.slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function validateCpfChecksum(digits: string): boolean {
  if (digits.length !== 11) return false;
  // Reject all-same-digit patterns
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9], 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10], 10);
}

function validateCnpjChecksum(digits: string): boolean {
  if (digits.length !== 14) return false;
  // Reject all-same-digit patterns
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // First check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (d1 !== parseInt(digits[12], 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  return d2 === parseInt(digits[13], 10);
}

// --- Type card data ---

interface TypeOption {
  value: ShareholderType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: 'FOUNDER',
    labelKey: 'type.founder',
    descriptionKey: 'form.typeFounderDescription',
    icon: UserCheck,
    iconColor: 'text-navy-700',
    bgColor: 'bg-navy-50',
  },
  {
    value: 'INVESTOR',
    labelKey: 'type.investor',
    descriptionKey: 'form.typeInvestorDescription',
    icon: Briefcase,
    iconColor: 'text-ocean-600',
    bgColor: 'bg-ocean-50',
  },
  {
    value: 'EMPLOYEE',
    labelKey: 'type.employee',
    descriptionKey: 'form.typeEmployeeDescription',
    icon: Users,
    iconColor: 'text-celadon-700',
    bgColor: 'bg-celadon-50',
  },
  {
    value: 'ADVISOR',
    labelKey: 'type.advisor',
    descriptionKey: 'form.typeAdvisorDescription',
    icon: UserCheck,
    iconColor: 'text-cream-700',
    bgColor: 'bg-cream-50',
  },
  {
    value: 'CORPORATE',
    labelKey: 'type.corporate',
    descriptionKey: 'form.typeCorporateDescription',
    icon: Building2,
    iconColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
];

// --- Country options ---

const COUNTRY_OPTIONS = [
  { code: 'BR', label: 'Brasil' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'DE', label: 'Alemanha' },
  { code: 'FR', label: 'França' },
  { code: 'PT', label: 'Portugal' },
  { code: 'ES', label: 'Espanha' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CL', label: 'Chile' },
  { code: 'CO', label: 'Colômbia' },
  { code: 'MX', label: 'México' },
  { code: 'UY', label: 'Uruguai' },
  { code: 'CN', label: 'China' },
  { code: 'JP', label: 'Japão' },
  { code: 'KR', label: 'Coreia do Sul' },
  { code: 'IL', label: 'Israel' },
  { code: 'SG', label: 'Singapura' },
  { code: 'CA', label: 'Canadá' },
  { code: 'CH', label: 'Suíça' },
  { code: 'NL', label: 'Países Baixos' },
];

// --- Form State ---

interface FormState {
  name: string;
  type: ShareholderType;
  cpfCnpj: string;
  email: string;
  phone: string;
  nationality: string;
  taxResidency: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  addressPostalCode: string;
  rdeIedNumber: string;
  rdeIedDate: string;
}

interface FormErrors {
  name?: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  taxResidency?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressCountry?: string;
  rdeIedDate?: string;
}

function validateForm(
  form: FormState,
  t: (key: string) => string,
): FormErrors {
  const errors: FormErrors = {};

  // Name: required, 2-300 chars
  if (!form.name.trim()) {
    errors.name = t('errors.val.required');
  } else if (form.name.trim().length < 2) {
    errors.name = t('errors.val.minLength');
  } else if (form.name.trim().length > 300) {
    errors.name = t('errors.val.maxLength');
  }

  // CPF/CNPJ validation
  const docDigits = form.cpfCnpj.replace(/\D/g, '');
  const isCorporate = form.type === 'CORPORATE';

  if (!docDigits) {
    // Optional at DTO level but recommended
  } else if (isCorporate) {
    // CORPORATE must use CNPJ (14 digits)
    if (docDigits.length !== 14) {
      errors.cpfCnpj = t('shareholders.form.errorCorporateNeedsCnpj');
    } else if (!validateCnpjChecksum(docDigits)) {
      errors.cpfCnpj = t('shareholders.form.errorInvalidCnpj');
    }
  } else {
    // Non-corporate must use CPF (11 digits)
    if (docDigits.length !== 11) {
      errors.cpfCnpj = t('shareholders.form.errorIndividualNeedsCpf');
    } else if (!validateCpfChecksum(docDigits)) {
      errors.cpfCnpj = t('shareholders.form.errorInvalidCpf');
    }
  }

  // Email: optional but must be valid if provided
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = t('errors.val.invalidEmail');
  }

  // Phone: optional, max 30 chars
  if (form.phone.trim().length > 30) {
    errors.phone = t('errors.val.maxLength');
  }

  // Nationality: must be 2 uppercase letters
  if (form.nationality && !/^[A-Z]{2}$/.test(form.nationality)) {
    errors.nationality = t('errors.val.invalidFormat');
  }

  // Tax Residency: must be 2 uppercase letters
  if (form.taxResidency && !/^[A-Z]{2}$/.test(form.taxResidency)) {
    errors.taxResidency = t('errors.val.invalidFormat');
  }

  // Address: if any text address field is filled, street+city+state+country are required
  // Exclude addressCountry from trigger since it's always pre-filled via dropdown
  const hasAddress =
    form.addressStreet.trim() ||
    form.addressCity.trim() ||
    form.addressState.trim() ||
    form.addressPostalCode.trim();

  if (hasAddress) {
    if (!form.addressStreet.trim()) errors.addressStreet = t('errors.val.required');
    if (!form.addressCity.trim()) errors.addressCity = t('errors.val.required');
    if (!form.addressState.trim()) errors.addressState = t('errors.val.required');
    if (!form.addressCountry.trim()) errors.addressCountry = t('errors.val.required');
  }

  // RDE-IED date: if provided, must be a valid date
  if (form.rdeIedDate.trim()) {
    const date = new Date(form.rdeIedDate);
    if (isNaN(date.getTime())) {
      errors.rdeIedDate = t('errors.val.invalidFormat');
    }
  }

  return errors;
}

// --- Main Component ---

export default function CreateShareholderPage() {
  const t = useTranslations('shareholders');
  const commonT = useTranslations('common');
  const errorsT = useTranslations();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const createMutation = useCreateShareholder(selectedCompany?.id);
  const showErrorToast = useErrorToast();

  const [form, setForm] = useState<FormState>({
    name: '',
    type: 'FOUNDER',
    cpfCnpj: '',
    email: '',
    phone: '',
    nationality: 'BR',
    taxResidency: 'BR',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressCountry: 'BR',
    addressPostalCode: '',
    rdeIedNumber: '',
    rdeIedDate: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  const isCorporate = form.type === 'CORPORATE';
  const isForeign = form.taxResidency !== 'BR';

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function selectType(type: ShareholderType) {
    setForm((prev) => ({
      ...prev,
      type,
      cpfCnpj: '', // Clear document when type changes
    }));
    if (submitted) {
      setErrors({});
    }
  }

  function handleDocumentChange(rawValue: string) {
    const digits = rawValue.replace(/\D/g, '');
    const formatted = isCorporate
      ? formatCnpj(digits)
      : formatCpf(digits);
    updateField('cpfCnpj', formatted);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);

    const validationErrors = validateForm(form, errorsT);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Build address object only if at least one text field is filled
    const hasAddress =
      form.addressStreet.trim() ||
      form.addressCity.trim() ||
      form.addressState.trim() ||
      form.addressPostalCode.trim();

    const address = hasAddress
      ? {
          street: form.addressStreet.trim(),
          city: form.addressCity.trim(),
          state: form.addressState.trim(),
          country: form.addressCountry.trim(),
          postalCode: form.addressPostalCode.trim() || undefined,
        }
      : undefined;

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type,
      ...(form.cpfCnpj.trim() && { cpfCnpj: form.cpfCnpj.trim() }),
      ...(form.email.trim() && { email: form.email.trim() }),
      ...(form.phone.trim() && { phone: form.phone.trim() }),
      nationality: form.nationality || 'BR',
      taxResidency: form.taxResidency || 'BR',
      ...(address && { address }),
      ...(form.rdeIedNumber.trim() && { rdeIedNumber: form.rdeIedNumber.trim() }),
      ...(form.rdeIedDate.trim() && { rdeIedDate: form.rdeIedDate.trim() }),
    };

    try {
      await createMutation.mutateAsync(payload);
      toast.success(t('success.created'));
      router.push('/dashboard/shareholders');
    } catch (error) {
      showErrorToast(error);
    }
  }

  // No company selected state
  if (!selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
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
          href="/dashboard/shareholders"
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPE_OPTIONS.map((opt) => {
              const isSelected = form.type === opt.value;
              const IconComp = opt.icon;

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
                      <IconComp className={cn('h-4 w-4', opt.iconColor)} />
                    </div>
                    <span className="text-sm font-medium text-gray-800">
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

        {/* Identity Section */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('form.sectionIdentity')}
          </h2>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">{t('form.name')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={t('form.namePlaceholder')}
                maxLength={300}
                className={cn('mt-1', errors.name && 'border-red-500')}
                data-testid="input-name"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* CPF/CNPJ */}
            <div>
              <Label htmlFor="cpfCnpj">
                {isCorporate ? t('form.cnpj') : t('form.cpf')}
              </Label>
              <Input
                id="cpfCnpj"
                value={form.cpfCnpj}
                onChange={(e) => handleDocumentChange(e.target.value)}
                placeholder={
                  isCorporate
                    ? t('form.cnpjPlaceholder')
                    : t('form.cpfPlaceholder')
                }
                maxLength={isCorporate ? 18 : 14}
                className={cn('mt-1 font-mono', errors.cpfCnpj && 'border-red-500')}
                data-testid="input-cpfCnpj"
              />
              {errors.cpfCnpj && (
                <p className="mt-1 text-xs text-red-600">{errors.cpfCnpj}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">{t('form.email')}</Label>
              <Input
                id="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder={t('form.emailPlaceholder')}
                className={cn('mt-1', errors.email && 'border-red-500')}
                data-testid="input-email"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('form.sectionContact')}
          </h2>
          <div className="space-y-4">
            {/* Phone */}
            <div>
              <Label htmlFor="phone">{t('form.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder={t('form.phonePlaceholder')}
                maxLength={30}
                className={cn('mt-1', errors.phone && 'border-red-500')}
                data-testid="input-phone"
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* Address (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowAddress(!showAddress)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ocean-600 hover:text-ocean-700"
                data-testid="toggle-address"
              >
                {showAddress ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {t('form.sectionAddress')}
              </button>

              {showAddress && (
                <div className="mt-3 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <Label htmlFor="addressStreet">{t('form.addressStreet')}</Label>
                    <Input
                      id="addressStreet"
                      value={form.addressStreet}
                      onChange={(e) => updateField('addressStreet', e.target.value)}
                      placeholder={t('form.addressStreetPlaceholder')}
                      maxLength={500}
                      className={cn('mt-1', errors.addressStreet && 'border-red-500')}
                      data-testid="input-addressStreet"
                    />
                    {errors.addressStreet && (
                      <p className="mt-1 text-xs text-red-600">{errors.addressStreet}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="addressCity">{t('form.addressCity')}</Label>
                      <Input
                        id="addressCity"
                        value={form.addressCity}
                        onChange={(e) => updateField('addressCity', e.target.value)}
                        placeholder={t('form.addressCityPlaceholder')}
                        maxLength={200}
                        className={cn('mt-1', errors.addressCity && 'border-red-500')}
                        data-testid="input-addressCity"
                      />
                      {errors.addressCity && (
                        <p className="mt-1 text-xs text-red-600">{errors.addressCity}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="addressState">{t('form.addressState')}</Label>
                      <Input
                        id="addressState"
                        value={form.addressState}
                        onChange={(e) => updateField('addressState', e.target.value)}
                        placeholder={t('form.addressStatePlaceholder')}
                        maxLength={100}
                        className={cn('mt-1', errors.addressState && 'border-red-500')}
                        data-testid="input-addressState"
                      />
                      {errors.addressState && (
                        <p className="mt-1 text-xs text-red-600">{errors.addressState}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="addressCountry">{t('form.addressCountry')}</Label>
                      <select
                        id="addressCountry"
                        value={form.addressCountry}
                        onChange={(e) => updateField('addressCountry', e.target.value)}
                        className={cn(
                          'mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                          errors.addressCountry ? 'border-red-500' : 'border-gray-300',
                        )}
                        data-testid="input-addressCountry"
                      >
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      {errors.addressCountry && (
                        <p className="mt-1 text-xs text-red-600">{errors.addressCountry}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="addressPostalCode">{t('form.addressPostalCode')}</Label>
                      <Input
                        id="addressPostalCode"
                        value={form.addressPostalCode}
                        onChange={(e) => updateField('addressPostalCode', e.target.value)}
                        placeholder={t('form.addressPostalCodePlaceholder')}
                        maxLength={20}
                        className="mt-1"
                        data-testid="input-addressPostalCode"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Compliance Section */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            {t('form.sectionCompliance')}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Nationality */}
              <div>
                <Label htmlFor="nationality">{t('form.nationality')}</Label>
                <select
                  id="nationality"
                  value={form.nationality}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  className={cn(
                    'mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                    errors.nationality ? 'border-red-500' : 'border-gray-300',
                  )}
                  data-testid="input-nationality"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.nationality && (
                  <p className="mt-1 text-xs text-red-600">{errors.nationality}</p>
                )}
              </div>

              {/* Tax Residency */}
              <div>
                <Label htmlFor="taxResidency">{t('form.taxResidency')}</Label>
                <select
                  id="taxResidency"
                  value={form.taxResidency}
                  onChange={(e) => updateField('taxResidency', e.target.value)}
                  className={cn(
                    'mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600',
                    errors.taxResidency ? 'border-red-500' : 'border-gray-300',
                  )}
                  data-testid="input-taxResidency"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.taxResidency && (
                  <p className="mt-1 text-xs text-red-600">{errors.taxResidency}</p>
                )}
              </div>
            </div>

            {/* Foreign Warning + RDE-IED fields */}
            {isForeign && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md bg-cream-50 p-3 text-sm text-cream-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {t('form.foreignWarning')}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rdeIedNumber">{t('form.rdeIedNumber')}</Label>
                    <Input
                      id="rdeIedNumber"
                      value={form.rdeIedNumber}
                      onChange={(e) => updateField('rdeIedNumber', e.target.value)}
                      placeholder={t('form.rdeIedNumberPlaceholder')}
                      maxLength={50}
                      className="mt-1"
                      data-testid="input-rdeIedNumber"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rdeIedDate">{t('form.rdeIedDate')}</Label>
                    <Input
                      id="rdeIedDate"
                      type="date"
                      value={form.rdeIedDate}
                      onChange={(e) => updateField('rdeIedDate', e.target.value)}
                      className={cn('mt-1', errors.rdeIedDate && 'border-red-500')}
                      data-testid="input-rdeIedDate"
                    />
                    {errors.rdeIedDate && (
                      <p className="mt-1 text-xs text-red-600">{errors.rdeIedDate}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Corporate info note */}
            {isCorporate && (
              <div className="flex items-start gap-2 rounded-md bg-ocean-50 p-3 text-sm text-ocean-700">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {t('form.corporateNote')}
              </div>
            )}
          </div>
        </section>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
          <Link
            href="/dashboard/shareholders"
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
