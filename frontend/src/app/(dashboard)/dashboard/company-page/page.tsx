'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Globe,
  BarChart3,
  Users,
  Share2,
  Copy,
  Check,
  Plus,
  Trash2,
  MoreVertical,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { useCompany } from '@/lib/company-context';
import { useErrorToast } from '@/lib/use-error-toast';
import { useCompanyProfile } from '@/hooks/use-company-profile';
import {
  useCreateProfile,
  useUpdateProfile,
  usePublishProfile,
  useUnpublishProfile,
  useArchiveProfile,
  useUpdateSlug,
  useUpdateMetrics,
  useUpdateTeam,
  useUploadTeamPhoto,
  type UpdateProfileDto,
  type MetricItemDto,
  type TeamMemberItemDto,
} from '@/hooks/use-profile-mutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  CompanyProfile,
  ProfileMetric,
  ProfileTeamMember,
  ProfileAccessType,
} from '@/types/company';

// --- Constants ---

const SECTORS = [
  'FINTECH',
  'SAAS',
  'BLOCKCHAIN_WEB3',
  'HEALTHTECH',
  'EDTECH',
  'AGRITECH',
  'LOGISTICS',
  'ECOMMERCE',
  'MARKETPLACE',
  'PROPTECH',
  'INSURTECH',
  'LEGALTECH',
  'HRTECH',
  'CLEANTECH',
  'BIOTECH',
  'GAMING',
  'MEDIA_ENTERTAINMENT',
  'FOOD_BEVERAGE',
  'FASHION',
  'TRAVEL',
  'SOCIAL_IMPACT',
  'CYBERSECURITY',
  'AI_ML',
  'IOT',
  'HARDWARE',
  'OTHER',
] as const;

const SECTOR_KEY_MAP: Record<string, string> = {
  FINTECH: 'fintech',
  SAAS: 'saas',
  BLOCKCHAIN_WEB3: 'blockchainWeb3',
  HEALTHTECH: 'healthtech',
  EDTECH: 'edtech',
  AGRITECH: 'agritech',
  LOGISTICS: 'logistics',
  ECOMMERCE: 'ecommerce',
  MARKETPLACE: 'marketplace',
  PROPTECH: 'proptech',
  INSURTECH: 'insurtech',
  LEGALTECH: 'legaltech',
  HRTECH: 'hrtech',
  CLEANTECH: 'cleantech',
  BIOTECH: 'biotech',
  GAMING: 'gaming',
  MEDIA_ENTERTAINMENT: 'mediaEntertainment',
  FOOD_BEVERAGE: 'foodBeverage',
  FASHION: 'fashionBeauty',
  TRAVEL: 'travel',
  SOCIAL_IMPACT: 'socialImpact',
  CYBERSECURITY: 'cybersecurity',
  AI_ML: 'aiMl',
  IOT: 'iot',
  HARDWARE: 'hardware',
  OTHER: 'other',
};

const METRIC_FORMATS = [
  { value: 'NUMBER', key: 'number' },
  { value: 'CURRENCY_BRL', key: 'currencyBrl' },
  { value: 'CURRENCY_USD', key: 'currencyUsd' },
  { value: 'PERCENTAGE', key: 'percentage' },
  { value: 'TEXT', key: 'text' },
] as const;

const MAX_METRICS = 6;
const MAX_TEAM = 10;

// --- Status Badge ---

function ProfileStatusBadge({ status }: { status: CompanyProfile['status'] }) {
  const t = useTranslations('companyPage');

  const variants: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    PUBLISHED: 'bg-green-100 text-green-700',
    ARCHIVED: 'bg-cream-100 text-cream-700',
  };

  const keys: Record<string, string> = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[status] || variants.DRAFT,
      )}
    >
      {t(`status.${keys[status] || 'draft'}`)}
    </span>
  );
}

// --- Info Tab ---

function InfoTab({
  profile,
  companyId,
}: {
  profile: CompanyProfile;
  companyId: string;
}) {
  const t = useTranslations('companyPage');
  const showError = useErrorToast();
  const updateMutation = useUpdateProfile(companyId);

  const [headline, setHeadline] = useState(profile.headline || '');
  const [description, setDescription] = useState(profile.description || '');
  const [sector, setSector] = useState(profile.sector || '');
  const [foundedYear, setFoundedYear] = useState(
    profile.foundedYear?.toString() || '',
  );
  const [website, setWebsite] = useState(profile.website || '');
  const [location, setLocation] = useState(profile.location || '');

  // Sync from profile when it changes (e.g. after save)
  useEffect(() => {
    setHeadline(profile.headline || '');
    setDescription(profile.description || '');
    setSector(profile.sector || '');
    setFoundedYear(profile.foundedYear?.toString() || '');
    setWebsite(profile.website || '');
    setLocation(profile.location || '');
  }, [profile]);

  const handleSave = useCallback(async () => {
    const data: UpdateProfileDto = {
      headline: headline || undefined,
      description: description || undefined,
      sector: sector || undefined,
      foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
      website: website || undefined,
      location: location || undefined,
    };

    try {
      await updateMutation.mutateAsync(data);
      toast.success(t('info.saved'));
    } catch (error) {
      showError(error);
    }
  }, [headline, description, sector, foundedYear, website, location, updateMutation, t, showError]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Headline */}
      <div className="space-y-1.5">
        <Label htmlFor="headline">{t('info.headline')}</Label>
        <Input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder={t('info.headlinePlaceholder')}
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">{t('info.description')}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('info.descriptionPlaceholder')}
          maxLength={5000}
          rows={6}
          className="resize-y"
        />
        <p className="text-xs text-gray-400">
          {t('info.descriptionHelper', { count: description.length })}
        </p>
      </div>

      {/* Sector */}
      <div className="space-y-1.5">
        <Label htmlFor="sector">{t('info.sector')}</Label>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger id="sector">
            <SelectValue placeholder={t('info.sectorPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {SECTORS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`sectors.${SECTOR_KEY_MAP[s]}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Founded Year + Location row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="foundedYear">{t('info.foundedYear')}</Label>
          <Input
            id="foundedYear"
            type="number"
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
            placeholder={t('info.foundedYearPlaceholder')}
            min={1900}
            max={new Date().getFullYear()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">{t('info.location')}</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('info.locationPlaceholder')}
            maxLength={100}
          />
        </div>
      </div>

      {/* Website */}
      <div className="space-y-1.5">
        <Label htmlFor="website">{t('info.website')}</Label>
        <Input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t('info.websitePlaceholder')}
        />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t('info.save')}
        </Button>
      </div>
    </div>
  );
}

// --- Metrics Tab ---

function MetricsTab({
  profile,
  companyId,
}: {
  profile: CompanyProfile;
  companyId: string;
}) {
  const t = useTranslations('companyPage');
  const showError = useErrorToast();
  const updateMetrics = useUpdateMetrics(companyId);

  const [metrics, setMetrics] = useState<MetricItemDto[]>(() =>
    profile.metrics.map((m) => ({
      label: m.label,
      value: m.value,
      format: m.format,
      icon: m.icon || undefined,
      order: m.order,
    })),
  );

  useEffect(() => {
    setMetrics(
      profile.metrics.map((m) => ({
        label: m.label,
        value: m.value,
        format: m.format,
        icon: m.icon || undefined,
        order: m.order,
      })),
    );
  }, [profile.metrics]);

  const addMetric = useCallback(() => {
    if (metrics.length >= MAX_METRICS) return;
    setMetrics((prev) => [
      ...prev,
      { label: '', value: '', format: 'NUMBER', order: prev.length },
    ]);
  }, [metrics.length]);

  const removeMetric = useCallback((index: number) => {
    setMetrics((prev) =>
      prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i })),
    );
  }, []);

  const updateMetric = useCallback(
    (index: number, field: keyof MetricItemDto, value: string) => {
      setMetrics((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const metricsToSave = metrics
      .filter((m) => m.label.trim() && m.value.trim())
      .map((m, i) => ({ ...m, order: i }));

    try {
      await updateMetrics.mutateAsync(metricsToSave);
      toast.success(t('metrics.saved'));
    } catch (error) {
      showError(error);
    }
  }, [metrics, updateMetrics, t, showError]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Metrics list */}
      {metrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <BarChart3 className="h-12 w-12 text-gray-300" />
          <p className="mt-4 max-w-sm text-center text-sm text-gray-500">
            {t('metrics.empty')}
          </p>
          <Button className="mt-4" onClick={addMetric}>
            <Plus className="mr-2 h-4 w-4" />
            {t('metrics.add')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  #{index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMetric(index)}
                  className="text-gray-400 hover:text-red-600"
                  title={t('metrics.remove')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t('metrics.label')}</Label>
                  <Input
                    value={metric.label}
                    onChange={(e) =>
                      updateMetric(index, 'label', e.target.value)
                    }
                    placeholder={t('metrics.labelPlaceholder')}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('metrics.value')}</Label>
                  <Input
                    value={metric.value}
                    onChange={(e) =>
                      updateMetric(index, 'value', e.target.value)
                    }
                    placeholder={t('metrics.valuePlaceholder')}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t('metrics.format')}</Label>
                  <Select
                    value={metric.format}
                    onValueChange={(v) => updateMetric(index, 'format', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRIC_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {t(`metrics.formatOptions.${f.key}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}

          {/* Add + Save row */}
          <div className="flex items-center justify-between">
            <div>
              {metrics.length >= MAX_METRICS ? (
                <p className="text-xs text-gray-400">
                  {t('metrics.maxReached')}
                </p>
              ) : (
                <Button variant="outline" size="sm" onClick={addMetric}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('metrics.add')}
                </Button>
              )}
            </div>
            <Button onClick={handleSave} disabled={updateMetrics.isPending}>
              {updateMetrics.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('metrics.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Team Tab ---

function TeamTab({
  profile,
  companyId,
}: {
  profile: CompanyProfile;
  companyId: string;
}) {
  const t = useTranslations('companyPage');
  const showError = useErrorToast();
  const updateTeam = useUpdateTeam(companyId);
  const uploadPhoto = useUploadTeamPhoto(companyId);

  const [members, setMembers] = useState<TeamMemberItemDto[]>(() =>
    profile.team.map((m) => ({
      name: m.name,
      title: m.title,
      photoUrl: m.photoUrl,
      linkedinUrl: m.linkedinUrl,
      order: m.order,
    })),
  );

  useEffect(() => {
    setMembers(
      profile.team.map((m) => ({
        name: m.name,
        title: m.title,
        photoUrl: m.photoUrl,
        linkedinUrl: m.linkedinUrl,
        order: m.order,
      })),
    );
  }, [profile.team]);

  const addMember = useCallback(() => {
    if (members.length >= MAX_TEAM) return;
    setMembers((prev) => [
      ...prev,
      { name: '', title: '', photoUrl: null, linkedinUrl: null, order: prev.length },
    ]);
  }, [members.length]);

  const removeMember = useCallback((index: number) => {
    setMembers((prev) =>
      prev.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i })),
    );
  }, []);

  const updateMember = useCallback(
    (index: number, field: keyof TeamMemberItemDto, value: string | null) => {
      setMembers((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
      );
    },
    [],
  );

  const handlePhotoUpload = useCallback(
    async (index: number, file: File) => {
      try {
        const result = await uploadPhoto.mutateAsync(file);
        updateMember(index, 'photoUrl', result.url);
      } catch (error) {
        showError(error);
      }
    },
    [uploadPhoto, updateMember, showError],
  );

  const handleSave = useCallback(async () => {
    const membersToSave = members
      .filter((m) => m.name.trim())
      .map((m, i) => ({ ...m, order: i }));

    try {
      await updateTeam.mutateAsync(membersToSave);
      toast.success(t('team.saved'));
    } catch (error) {
      showError(error);
    }
  }, [members, updateTeam, t, showError]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-12">
          <Users className="h-12 w-12 text-gray-300" />
          <p className="mt-4 max-w-sm text-center text-sm text-gray-500">
            {t('team.empty')}
          </p>
          <Button className="mt-4" onClick={addMember}>
            <Plus className="mr-2 h-4 w-4" />
            {t('team.add')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {members.map((member, index) => (
            <TeamMemberCard
              key={index}
              member={member}
              index={index}
              onRemove={removeMember}
              onUpdate={updateMember}
              onPhotoUpload={handlePhotoUpload}
              isUploading={uploadPhoto.isPending}
              t={t}
            />
          ))}

          <div className="flex items-center justify-between">
            <div>
              {members.length >= MAX_TEAM ? (
                <p className="text-xs text-gray-400">
                  {t('team.maxReached')}
                </p>
              ) : (
                <Button variant="outline" size="sm" onClick={addMember}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('team.add')}
                </Button>
              )}
            </div>
            <Button onClick={handleSave} disabled={updateTeam.isPending}>
              {updateTeam.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('team.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamMemberCard({
  member,
  index,
  onRemove,
  onUpdate,
  onPhotoUpload,
  isUploading,
  t,
}: {
  member: TeamMemberItemDto;
  index: number;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: keyof TeamMemberItemDto, value: string | null) => void;
  onPhotoUpload: (i: number, file: File) => void;
  isUploading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Photo must be under 2 MB');
        return;
      }
      onPhotoUpload(index, file);
    },
    [index, onPhotoUpload],
  );

  const initials = member.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          #{index + 1}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-600"
          title={t('team.remove')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-4">
        {/* Photo */}
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-ocean-600 text-white transition-opacity hover:opacity-80"
            title={t('team.photoUpload')}
          >
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={member.name || 'Team member'}
                className="h-full w-full object-cover"
              />
            ) : initials ? (
              <span className="text-lg font-medium">{initials}</span>
            ) : (
              <Upload className="h-5 w-5" />
            )}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
          />
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('team.name')}</Label>
              <Input
                value={member.name}
                onChange={(e) => onUpdate(index, 'name', e.target.value)}
                placeholder={t('team.namePlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('team.titleField')}</Label>
              <Input
                value={member.title}
                onChange={(e) => onUpdate(index, 'title', e.target.value)}
                placeholder={t('team.titlePlaceholder')}
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('team.linkedin')}</Label>
            <Input
              value={member.linkedinUrl || ''}
              onChange={(e) =>
                onUpdate(index, 'linkedinUrl', e.target.value || null)
              }
              placeholder={t('team.linkedinPlaceholder')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Share Tab ---

function ShareTab({
  profile,
  companyId,
}: {
  profile: CompanyProfile;
  companyId: string;
}) {
  const t = useTranslations('companyPage');
  const showError = useErrorToast();
  const updateSlug = useUpdateSlug(companyId);
  const updateProfile = useUpdateProfile(companyId);

  const [slug, setSlug] = useState(profile.slug);
  const [slugError, setSlugError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSlug(profile.slug);
    setSlugError('');
  }, [profile.slug]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profile.shareUrl);
      setCopied(true);
      toast.success(t('share.copySuccess'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      toast.error('Failed to copy');
    }
  }, [profile.shareUrl, t]);

  const handleSlugSave = useCallback(async () => {
    setSlugError('');
    try {
      await updateSlug.mutateAsync(slug);
      toast.success(t('share.saved'));
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        setSlugError(t('share.slugError'));
      } else {
        showError(error);
      }
    }
  }, [slug, updateSlug, t, showError]);

  const handleAccessTypeChange = useCallback(
    async (accessType: string) => {
      try {
        await updateProfile.mutateAsync({
          accessType: accessType as ProfileAccessType,
        });
      } catch (error) {
        showError(error);
      }
    },
    [updateProfile, showError],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Share URL */}
      <div className="space-y-2">
        <Label>{t('share.copyUrl')}</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {profile.shareUrl}
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Custom slug */}
      <div className="space-y-2">
        <Label>{t('share.customSlug')}</Label>
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 text-sm text-gray-400">
            {t('share.urlPrefix')}
          </span>
          <Input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase());
              setSlugError('');
            }}
            className={cn(slugError && 'border-red-500')}
            maxLength={50}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSlugSave}
            disabled={updateSlug.isPending || slug === profile.slug}
          >
            {updateSlug.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('share.save')
            )}
          </Button>
        </div>
        {slugError ? (
          <p className="text-xs text-red-600">{slugError}</p>
        ) : (
          <p className="text-xs text-gray-400">{t('share.slugHelper')}</p>
        )}
      </div>

      {/* Access type */}
      <div className="space-y-3">
        <Label>{t('share.accessTypeLabel')}</Label>
        <div className="space-y-2">
          {(['PUBLIC', 'EMAIL_GATED'] as const).map((type) => (
            <label
              key={type}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                profile.accessType === type
                  ? 'border-ocean-600 bg-ocean-50'
                  : 'border-gray-200 hover:bg-gray-50',
              )}
            >
              <input
                type="radio"
                name="accessType"
                value={type}
                checked={profile.accessType === type}
                onChange={(e) => handleAccessTypeChange(e.target.value)}
                className="h-4 w-4 text-ocean-600 focus:ring-ocean-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {t(`accessType.${type === 'PUBLIC' ? 'public' : 'emailGated'}`)}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Archive Dialog ---

function ArchiveDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}) {
  const t = useTranslations('companyPage');
  const tc = useTranslations('common');
  const showError = useErrorToast();
  const archiveMutation = useArchiveProfile(companyId);

  const handleArchive = useCallback(async () => {
    try {
      await archiveMutation.mutateAsync();
      toast.success(t('archive.success'));
      onOpenChange(false);
    } catch (error) {
      showError(error);
    }
  }, [archiveMutation, t, onOpenChange, showError]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('archive.title')}</DialogTitle>
          <DialogDescription>{t('archive.confirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t('archive.title')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---

export default function CompanyPagePage() {
  const t = useTranslations('companyPage');
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const companyId = selectedCompany?.id;

  const {
    data: profile,
    isLoading: profileLoading,
  } = useCompanyProfile(companyId);

  const createProfile = useCreateProfile(companyId);
  const publishProfile = usePublishProfile(companyId);
  const unpublishProfile = useUnpublishProfile(companyId);
  const showError = useErrorToast();

  const [archiveOpen, setArchiveOpen] = useState(false);

  const isLoading = companyLoading || (!!companyId && profileLoading);

  // Handle create profile
  const handleCreate = useCallback(async () => {
    try {
      await createProfile.mutateAsync();
    } catch (error) {
      showError(error);
    }
  }, [createProfile, showError]);

  // Handle publish
  const handlePublish = useCallback(async () => {
    try {
      await publishProfile.mutateAsync();
      toast.success(t('publish.success'));
    } catch (error) {
      showError(error);
    }
  }, [publishProfile, t, showError]);

  // Handle unpublish
  const handleUnpublish = useCallback(async () => {
    try {
      await unpublishProfile.mutateAsync();
      toast.success(t('unpublish.success'));
    } catch (error) {
      showError(error);
    }
  }, [unpublishProfile, t, showError]);

  // --- No company state ---
  if (!companyLoading && !selectedCompany) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700">
            {t('empty.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t('empty.description')}</p>
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-64 w-full animate-pulse rounded-lg bg-gray-200" />
      </div>
    );
  }

  // --- No profile yet — show create CTA ---
  if (!profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-16 w-16 text-gray-300" />
          <h2 className="mt-4 text-xl font-semibold text-gray-700">
            {t('create.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            {t('create.description')}
          </p>
          <Button
            className="mt-6"
            onClick={handleCreate}
            disabled={createProfile.isPending}
          >
            {createProfile.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('create.button')}
          </Button>
        </div>
      </div>
    );
  }

  // --- Profile exists — show editor ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-navy-900">
                {t('title')}
              </h1>
              <ProfileStatusBadge status={profile.status} />
            </div>
            <p className="mt-1 text-[13px] text-gray-500">{t('subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile.status === 'DRAFT' && (
            <Button
              onClick={handlePublish}
              disabled={publishProfile.isPending}
            >
              {publishProfile.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('publish.button')}
            </Button>
          )}
          {profile.status === 'PUBLISHED' && (
            <Button
              variant="outline"
              onClick={handleUnpublish}
              disabled={unpublishProfile.isPending}
            >
              {unpublishProfile.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('unpublish.button')}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setArchiveOpen(true)}
              >
                {t('archive.title')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="info">
            <Globe className="mr-2 h-4 w-4" />
            {t('info.title')}
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <BarChart3 className="mr-2 h-4 w-4" />
            {t('metrics.title')}
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="mr-2 h-4 w-4" />
            {t('team.title')}
          </TabsTrigger>
          <TabsTrigger value="share">
            <Share2 className="mr-2 h-4 w-4" />
            {t('share.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <InfoTab profile={profile} companyId={companyId!} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <MetricsTab profile={profile} companyId={companyId!} />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TeamTab profile={profile} companyId={companyId!} />
        </TabsContent>

        <TabsContent value="share" className="mt-6">
          <ShareTab profile={profile} companyId={companyId!} />
        </TabsContent>
      </Tabs>

      {/* Archive dialog */}
      {companyId && (
        <ArchiveDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          companyId={companyId}
        />
      )}
    </div>
  );
}
