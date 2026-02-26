'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  FileText,
  Users,
  BookOpen,
  Award,
  Gift,
  Handshake,
  ArrowLeft,
  ChevronRight,
  Building2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import {
  useDocumentTemplates,
  useDocumentTemplate,
  useCreateDocument,
  useCreateDraft,
} from '@/hooks/use-documents';
import { useErrorToast } from '@/lib/use-error-toast';
import { toast } from 'sonner';
import type { DocumentTemplate, DocumentTemplateType } from '@/types/company';

// --- Template card icons ---

const TEMPLATE_ICONS: Record<DocumentTemplateType, React.ElementType> = {
  SHAREHOLDER_AGREEMENT: Users,
  MEETING_MINUTES: BookOpen,
  SHARE_CERTIFICATE: Award,
  OPTION_LETTER: Gift,
  INVESTMENT_AGREEMENT: Handshake,
};

const TEMPLATE_COLORS: Record<DocumentTemplateType, string> = {
  SHAREHOLDER_AGREEMENT: 'text-ocean-600',
  MEETING_MINUTES: 'text-navy-700',
  SHARE_CERTIFICATE: 'text-green-600',
  OPTION_LETTER: 'text-cream-700',
  INVESTMENT_AGREEMENT: 'text-ocean-600',
};

// --- Form field rendering ---

interface FormFieldSchema {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  fields?: FormFieldSchema[];
}

function DynamicFormField({
  field,
  value,
  onChange,
  t,
}: {
  field: FormFieldSchema;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  t: (key: string) => string;
}) {
  const baseClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600';

  switch (field.type) {
    case 'text':
    case 'string':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={cn('mt-1', baseClass)}
          />
        </div>
      );
    case 'number':
    case 'currency':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="number"
            value={(value as string) || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={cn('mt-1', baseClass)}
          />
        </div>
      );
    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={cn('mt-1', baseClass)}
          />
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(field.name, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-ocean-600 focus:ring-ocean-600"
          />
          <label className="text-sm font-medium text-gray-700">
            {field.label}
          </label>
        </div>
      );
    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={cn('mt-1', baseClass)}
          >
            <option value="">—</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            rows={4}
            className={cn('mt-1', baseClass)}
          />
        </div>
      );
    default:
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
          </label>
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={cn('mt-1', baseClass)}
          />
        </div>
      );
  }
}

// --- Main Page Component ---

export default function NewDocumentPage() {
  const t = useTranslations('documents');
  const router = useRouter();
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const { showError } = useErrorToast();

  const companyId = selectedCompany?.id;

  // Wizard state
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Data fetching
  const { data: templatesData, isLoading: templatesLoading } = useDocumentTemplates(companyId, {
    limit: 100,
  });
  const { data: templateDetail } = useDocumentTemplate(
    companyId,
    selectedTemplateId || undefined,
  );

  const createMutation = useCreateDocument(companyId);
  const draftMutation = useCreateDraft(companyId);

  const templates = templatesData?.data ?? [];

  // Parse form schema from template
  const formFields = useMemo((): FormFieldSchema[] => {
    if (!templateDetail?.formSchema) return [];
    const schema = templateDetail.formSchema as { fields?: FormFieldSchema[] };
    return schema.fields ?? [];
  }, [templateDetail]);

  // Form data handler
  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Select template and go to step 2
  const handleSelectTemplate = (template: DocumentTemplate) => {
    setSelectedTemplateId(template.id);
    setTitle('');
    setFormData({});
    setStep(2);
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!selectedTemplateId || !title.trim()) return;
    try {
      const result = await draftMutation.mutateAsync({
        templateId: selectedTemplateId,
        title: title.trim(),
        formData,
      });
      toast.success(t('wizard.draftSuccess'));
      router.push(`/dashboard/documents/${result.id}`);
    } catch (err) {
      showError(err);
    }
  };

  // Generate PDF
  const handleGenerate = async () => {
    if (!selectedTemplateId || !title.trim()) return;
    try {
      const result = await createMutation.mutateAsync({
        templateId: selectedTemplateId,
        title: title.trim(),
        formData,
      });
      toast.success(t('wizard.generateSuccess'));
      router.push(`/dashboard/documents/${result.id}`);
    } catch (err) {
      showError(err);
    }
  };

  // No company state
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

  const isSaving = draftMutation.isPending || createMutation.isPending;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <Link
          href="/dashboard/documents"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </Link>
        <h1 className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] text-navy-900">
          {t('wizard.title')}
        </h1>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-4">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
              step >= 1
                ? 'bg-ocean-600 text-white'
                : 'bg-gray-100 text-gray-500',
            )}
          >
            <span>1</span>
            <span>{t('wizard.step1')}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
              step >= 2
                ? 'bg-ocean-600 text-white'
                : 'bg-gray-100 text-gray-500',
            )}
          >
            <span>2</span>
            <span>{t('wizard.step2')}</span>
          </div>
        </div>
      </div>

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {t('wizard.selectTemplate')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('wizard.selectTemplateDescription')}
          </p>

          {templatesLoading ? (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-lg border border-gray-200 bg-gray-50"
                />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">{t('wizard.noTemplates')}</p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {templates.map((tmpl) => {
                const Icon = TEMPLATE_ICONS[tmpl.documentType] || FileText;
                const iconColor = TEMPLATE_COLORS[tmpl.documentType] || 'text-gray-400';

                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-ocean-600 hover:shadow-md"
                  >
                    <div className={cn('rounded-lg bg-gray-50 p-3', iconColor)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">
                        {tmpl.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {t(`type.${tmpl.documentType}`)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Form + Preview */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Form */}
          <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">
              {t('wizard.formFields')}
            </h2>

            {/* Title field */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('wizard.formTitle')}
                <span className="text-red-500"> *</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('wizard.formTitlePlaceholder')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-ocean-600 focus:outline-none focus:ring-1 focus:ring-ocean-600"
              />
            </div>

            {/* Dynamic form fields */}
            {formFields.map((field) => (
              <DynamicFormField
                key={field.name}
                field={field}
                value={formData[field.name]}
                onChange={handleFieldChange}
                t={t}
              />
            ))}

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-gray-200 pt-6">
              <button
                onClick={() => setStep(1)}
                disabled={isSaving}
                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t('wizard.back')}
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isSaving || !title.trim()}
                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {draftMutation.isPending ? t('wizard.saving') : t('wizard.saveDraft')}
              </button>
              <button
                onClick={handleGenerate}
                disabled={isSaving || !title.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-ocean-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ocean-500 disabled:opacity-50"
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {createMutation.isPending
                  ? t('wizard.generating')
                  : t('wizard.generatePdf')}
              </button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {t('wizard.preview')}
            </h2>
            <div className="min-h-[400px] rounded-lg bg-white p-8 shadow-inner">
              {title ? (
                <div>
                  <h3 className="text-center text-xl font-bold text-gray-800">
                    {title}
                  </h3>
                  {formFields.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-gray-400">
                      {t('wizard.previewEmpty')}
                    </p>
                  ) : (
                    <div className="mt-6 space-y-3">
                      {formFields.map((field) => {
                        const val = formData[field.name];
                        return (
                          <div key={field.name} className="text-sm text-gray-600">
                            <span className="font-medium">{field.label}:</span>{' '}
                            {val ? (
                              String(val)
                            ) : (
                              <span className="text-gray-400">
                                {`{{${field.name}}}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400">
                  {t('wizard.previewEmpty')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
