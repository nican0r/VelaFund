'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Upload,
  Trash2,
  Download,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/company-context';
import { useErrorToast } from '@/lib/use-error-toast';
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useDocumentDownload,
} from '@/hooks/use-documents';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DocumentCategory, ProfileDocument } from '@/types/company';

// --- Constants ---

const CATEGORIES: DocumentCategory[] = [
  'PITCH_DECK',
  'FINANCIALS',
  'LEGAL',
  'PRODUCT',
  'TEAM',
  'OTHER',
];

const CATEGORY_KEY_MAP: Record<DocumentCategory, string> = {
  PITCH_DECK: 'pitchDeck',
  FINANCIALS: 'financials',
  LEGAL: 'legal',
  PRODUCT: 'product',
  TEAM: 'team',
  OTHER: 'other',
};

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// --- Helpers ---

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return FileImage;
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  )
    return FileSpreadsheet;
  return File;
}

function getFileIconColor(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'text-red-500';
  if (mimeType.startsWith('image/')) return 'text-blue-500';
  if (mimeType.includes('spreadsheet')) return 'text-green-600';
  if (mimeType.includes('presentation')) return 'text-orange-500';
  if (mimeType.includes('word')) return 'text-blue-600';
  return 'text-gray-400';
}

// --- Storage Bar ---

function StorageBar({
  used,
  max,
  t,
}: {
  used: number;
  max: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const percentage = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const isNearLimit = percentage >= 90;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {t('storage.label', {
            used: formatFileSize(used),
            max: formatFileSize(max),
          })}
        </span>
        <span
          className={cn(
            'text-xs font-medium',
            isNearLimit ? 'text-red-600' : 'text-gray-400',
          )}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isNearLimit ? 'bg-red-500' : 'bg-ocean-600',
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {isNearLimit && (
        <p className="mt-1 text-xs text-red-600">{t('storage.limit')}</p>
      )}
    </div>
  );
}

// --- Upload Dialog ---

function UploadDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}) {
  const t = useTranslations('dataroom');
  const tc = useTranslations('common');
  const showError = useErrorToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [displayName, setDisplayName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadDocument(companyId);

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setCategory('');
    setDisplayName('');
    setIsDragging(false);
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm],
  );

  const handleFileSelect = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported file type');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File exceeds 25 MB limit');
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !category) return;

    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        category: category as DocumentCategory,
        name: displayName || undefined,
      });
      toast.success(t('upload.success'));
      handleClose(false);
    } catch (error) {
      showError(error);
    }
  }, [selectedFile, category, displayName, uploadMutation, t, handleClose, showError]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('upload.title')}</DialogTitle>
          <DialogDescription>{t('upload.formats')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
              isDragging
                ? 'border-ocean-600 bg-ocean-50'
                : selectedFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleInputChange}
              data-testid="file-input"
            />
            {selectedFile ? (
              <div className="text-center">
                <FileText className="mx-auto h-8 w-8 text-green-600" />
                <p className="mt-2 text-sm font-medium text-gray-700">
                  {t('upload.fileSelected', { name: selectedFile.name })}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  {t('upload.dragDrop')}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {t('upload.formats')}
                </p>
              </div>
            )}
          </div>

          {/* Category select */}
          <div className="space-y-1.5">
            <Label htmlFor="category">{t('upload.category')}</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as DocumentCategory)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder={t('upload.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`category.${CATEGORY_KEY_MAP[cat]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional display name */}
          <div className="space-y-1.5">
            <Label htmlFor="display-name">{t('upload.name')}</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('upload.namePlaceholder')}
              maxLength={255}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {tc('cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !category || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? t('upload.uploading') : t('upload.button')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Delete Dialog ---

function DeleteDialog({
  open,
  onOpenChange,
  document,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: ProfileDocument | null;
  companyId: string;
}) {
  const t = useTranslations('dataroom');
  const tc = useTranslations('common');
  const showError = useErrorToast();

  const deleteMutation = useDeleteDocument(companyId);

  const handleDelete = useCallback(async () => {
    if (!document) return;
    try {
      await deleteMutation.mutateAsync(document.id);
      toast.success(t('delete.success'));
      onOpenChange(false);
    } catch (error) {
      showError(error);
    }
  }, [document, deleteMutation, t, onOpenChange, showError]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('delete.title')}</DialogTitle>
          <DialogDescription>
            {t('delete.confirm', { name: document?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? '...' : tc('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Document Row ---

function DocumentRow({
  doc,
  companyId,
  onDelete,
}: {
  doc: ProfileDocument;
  companyId: string;
  onDelete: (doc: ProfileDocument) => void;
}) {
  const t = useTranslations('dataroom');
  const downloadMutation = useDocumentDownload(companyId);
  const showError = useErrorToast();
  const IconComponent = getFileIcon(doc.mimeType);
  const iconColor = getFileIconColor(doc.mimeType);

  const handleDownload = useCallback(async () => {
    try {
      const result = await downloadMutation.mutateAsync(doc.id);
      window.open(result.downloadUrl, '_blank');
    } catch (error) {
      showError(error);
    }
  }, [doc.id, downloadMutation, showError]);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm">
      {/* File icon */}
      <div className={cn('flex-shrink-0', iconColor)}>
        <IconComponent className="h-8 w-8" />
      </div>

      {/* File info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">
          {doc.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{formatFileSize(doc.fileSize)}</span>
          {doc.pageCount !== null && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>{t('document.pages', { count: doc.pageCount })}</span>
            </>
          )}
          <span aria-hidden="true">&middot;</span>
          <span>
            {t('document.uploaded', {
              date: formatDate(doc.uploadedAt || doc.createdAt),
            })}
          </span>
        </div>
      </div>

      {/* Category badge */}
      <Badge
        variant="secondary"
        className="hidden flex-shrink-0 sm:inline-flex"
      >
        {t(`category.${CATEGORY_KEY_MAP[doc.category]}`)}
      </Badge>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={downloadMutation.isPending}
          title={t('document.download')}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(doc)}
          title={t('document.delete')}
          className="text-gray-500 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function DataroomPage() {
  const t = useTranslations('dataroom');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  const [activeCategory, setActiveCategory] = useState<
    DocumentCategory | 'ALL'
  >('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<ProfileDocument | null>(null);

  const { data, isLoading: docsLoading } = useDocuments(
    companyId,
    activeCategory === 'ALL' ? undefined : activeCategory,
  );

  const documents = data?.documents ?? [];
  const totalStorage = data?.totalStorage ?? 0;
  const maxStorage = data?.maxStorage ?? 0;
  const isLoading = companyLoading || (!!companyId && docsLoading);

  // No company state
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            No company found
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} disabled={!companyId}>
          <Upload className="mr-2 h-4 w-4" />
          {t('upload.button')}
        </Button>
      </div>

      {/* Storage bar */}
      {!isLoading && companyId && (
        <StorageBar used={totalStorage} max={maxStorage} t={t} />
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('ALL')}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            activeCategory === 'ALL'
              ? 'bg-ocean-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          {t('category.all')}
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              activeCategory === cat
                ? 'bg-ocean-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {t(`category.${CATEGORY_KEY_MAP[cat]}`)}
          </button>
        ))}
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <FolderOpen className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-700">
            {activeCategory === 'ALL'
              ? t('empty.title')
              : t('empty.filtered')}
          </h3>
          {activeCategory === 'ALL' && (
            <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
              {t('empty.description')}
            </p>
          )}
          {activeCategory === 'ALL' && (
            <Button
              className="mt-4"
              onClick={() => setUploadOpen(true)}
              disabled={!companyId}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('upload.button')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              companyId={companyId!}
              onDelete={setDeleteDoc}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      {companyId && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          companyId={companyId}
        />
      )}

      {/* Delete confirmation dialog */}
      {companyId && (
        <DeleteDialog
          open={!!deleteDoc}
          onOpenChange={(open) => {
            if (!open) setDeleteDoc(null);
          }}
          document={deleteDoc}
          companyId={companyId}
        />
      )}
    </div>
  );
}
