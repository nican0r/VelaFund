'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  PublicProfile,
  PublicProfileDocument,
  PublicProfileLitigation,
  PublicProfileMetric,
  PublicProfileTeamMember,
  DocumentCategory,
} from '@/types/company';
import {
  Building2,
  Calendar,
  MapPin,
  Globe,
  FileText,
  Download,
  ExternalLink,
  Linkedin,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Lock,
  Mail,
  Eye,
  DollarSign,
  Percent,
  Hash,
  BarChart3,
} from 'lucide-react';

// ---------- Types ----------

type PageState =
  | { kind: 'loading' }
  | { kind: 'profile'; data: PublicProfile }
  | { kind: 'email_gate' }
  | { kind: 'password_gate' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

// ---------- Metric Formatting ----------

function formatMetricValue(value: string, format: string): string {
  const num = parseFloat(value);

  switch (format) {
    case 'CURRENCY_BRL':
      if (isNaN(num)) return value;
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(num);
    case 'CURRENCY_USD':
      if (isNaN(num)) return value;
      return `US$ ${new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num)}`;
    case 'PERCENTAGE':
      if (isNaN(num)) return value;
      return `${new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(num)}%`;
    case 'NUMBER':
      if (isNaN(num)) return value;
      return new Intl.NumberFormat('pt-BR').format(num);
    default:
      return value;
  }
}

function getMetricIcon(format: string) {
  switch (format) {
    case 'CURRENCY_BRL':
    case 'CURRENCY_USD':
      return <DollarSign className="h-5 w-5 text-ocean-600" />;
    case 'PERCENTAGE':
      return <Percent className="h-5 w-5 text-ocean-600" />;
    case 'NUMBER':
      return <Hash className="h-5 w-5 text-ocean-600" />;
    default:
      return <BarChart3 className="h-5 w-5 text-ocean-600" />;
  }
}

// ---------- File Size Formatting ----------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------- Category Labels ----------

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  PITCH_DECK: 'Pitch Deck',
  FINANCIALS: 'Financials',
  LEGAL: 'Legal',
  PRODUCT: 'Product',
  TEAM: 'Team',
  OTHER: 'Other',
};

// ---------- Sector Labels ----------

const SECTOR_LABELS: Record<string, string> = {
  FINTECH: 'Fintech',
  SAAS: 'SaaS',
  BLOCKCHAIN_WEB3: 'Blockchain / Web3',
  AI_ML: 'AI / ML',
  HEALTHTECH: 'HealthTech',
  EDTECH: 'EdTech',
  ECOMMERCE: 'E-Commerce',
  MARKETPLACE: 'Marketplace',
  LOGISTICS: 'Logistics',
  AGRITECH: 'AgriTech',
  PROPTECH: 'PropTech',
  INSURTECH: 'InsurTech',
  LEGALTECH: 'LegalTech',
  HRTECH: 'HRTech',
  GOVTECH: 'GovTech',
  CLEANTECH: 'CleanTech',
  BIOTECH: 'BioTech',
  FOODTECH: 'FoodTech',
  RETAILTECH: 'RetailTech',
  SPORTTECH: 'SportTech',
  TRAVELTECH: 'TravelTech',
  REGTECH: 'RegTech',
  CYBERSECURITY: 'Cybersecurity',
  IOT: 'IoT',
  SOCIAL_IMPACT: 'Social Impact',
  OTHER: 'Other',
};

// ---------- Litigation Risk Colors ----------

function getRiskBadgeClass(riskLevel: string): string {
  switch (riskLevel) {
    case 'LOW':
      return 'bg-green-100 text-green-700';
    case 'MEDIUM':
      return 'bg-cream-100 text-cream-700';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700';
    case 'CRITICAL':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

// ---------- Sub-Components ----------

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}

function NotFoundView({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Building2 className="h-16 w-16 text-gray-300" />
      <h1 className="mt-4 text-xl font-semibold text-gray-800">
        {t('notFound.title')}
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-gray-500">
        {t('notFound.description')}
      </p>
    </div>
  );
}

function EmailGateView({
  onSubmit,
  t,
}: {
  onSubmit: (email: string) => Promise<void>;
  t: (key: string) => string;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(email);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('error.generic'),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ocean-50">
            <Mail className="h-7 w-7 text-ocean-600" />
          </div>
        </div>
        <h2 className="text-center text-lg font-semibold text-navy-900">
          {t('emailGate.title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          {t('emailGate.description')}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            type="email"
            placeholder={t('emailGate.placeholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            required
            autoFocus
            aria-label={t('emailGate.placeholder')}
          />
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !email.trim()}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {t('emailGate.button')}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">
          {t('emailGate.disclaimer')}
        </p>
      </div>
    </div>
  );
}

function PasswordGateView({
  onSubmit,
  t,
}: {
  onSubmit: (password: string) => Promise<void>;
  t: (key: string) => string;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('error.generic'),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ocean-50">
            <Lock className="h-7 w-7 text-ocean-600" />
          </div>
        </div>
        <h2 className="text-center text-lg font-semibold text-navy-900">
          {t('passwordGate.title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          {t('passwordGate.description')}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            type="password"
            placeholder={t('passwordGate.placeholder')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            required
            autoFocus
            aria-label={t('passwordGate.placeholder')}
          />
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !password.trim()}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {t('passwordGate.button')}
          </Button>
        </form>
      </div>
    </div>
  );
}

function MetricsSection({
  metrics,
  t,
}: {
  metrics: PublicProfileMetric[];
  t: (key: string) => string;
}) {
  if (metrics.length === 0) return null;
  return (
    <section aria-labelledby="metrics-heading">
      <h2 id="metrics-heading" className="text-lg font-semibold text-navy-900">
        {t('sections.metrics')}
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.id}>
            <CardContent className="flex items-start gap-3 p-5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ocean-50">
                {getMetricIcon(metric.format)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {metric.label}
                </p>
                <p className="mt-1 text-xl font-bold text-navy-900">
                  {formatMetricValue(metric.value, metric.format)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function TeamSection({
  team,
  t,
}: {
  team: PublicProfileTeamMember[];
  t: (key: string) => string;
}) {
  if (team.length === 0) return null;
  return (
    <section aria-labelledby="team-heading">
      <h2 id="team-heading" className="text-lg font-semibold text-navy-900">
        {t('sections.team')}
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((member) => (
          <Card key={member.id}>
            <CardContent className="flex items-center gap-4 p-5">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-sm font-semibold text-white">
                  {member.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-800">
                  {member.name}
                </p>
                <p className="truncate text-sm text-gray-500">
                  {member.title}
                </p>
                {member.linkedinUrl && (
                  <a
                    href={member.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-700"
                    aria-label={`LinkedIn - ${member.name}`}
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function DocumentsSection({
  documents,
  slug,
  t,
}: {
  documents: PublicProfileDocument[];
  slug: string;
  t: (key: string) => string;
}) {
  if (documents.length === 0) return null;

  const handleDownload = async (doc: PublicProfileDocument) => {
    try {
      const data = await api.get<{ downloadUrl: string }>(
        `/api/v1/profiles/${slug}/documents/${doc.id}/download`,
      );
      window.open(data.downloadUrl, '_blank');
    } catch {
      // Download errors are non-critical for the public page
    }
  };

  return (
    <section aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="text-lg font-semibold text-navy-900">
        {t('sections.documents')}
      </h2>
      <div className="mt-4 space-y-2">
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <FileText className="h-5 w-5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORY_LABELS[doc.category] || doc.category}
                    </Badge>
                    <span>{formatFileSize(doc.fileSize)}</span>
                    {doc.pageCount && (
                      <span>
                        {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(doc)}
                aria-label={`${t('documents.download')} ${doc.name}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function LitigationSection({
  litigation,
  t,
}: {
  litigation: PublicProfileLitigation;
  t: (key: string) => string;
}) {
  if (litigation.status === 'PENDING') {
    return (
      <section aria-labelledby="litigation-heading">
        <h2 id="litigation-heading" className="text-lg font-semibold text-navy-900">
          {t('sections.litigation')}
        </h2>
        <Card className="mt-4">
          <CardContent className="flex items-center gap-3 p-5">
            <Loader2 className="h-5 w-5 animate-spin text-ocean-600" />
            <p className="text-sm text-gray-500">{t('litigation.pending')}</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (litigation.status === 'FAILED') {
    return (
      <section aria-labelledby="litigation-heading">
        <h2 id="litigation-heading" className="text-lg font-semibold text-navy-900">
          {t('sections.litigation')}
        </h2>
        <Card className="mt-4">
          <CardContent className="flex items-center gap-3 p-5">
            <AlertTriangle className="h-5 w-5 text-cream-700" />
            <p className="text-sm text-gray-500">{t('litigation.failed')}</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const summary = litigation.summary;
  if (!summary) return null;

  return (
    <section aria-labelledby="litigation-heading">
      <h2 id="litigation-heading" className="text-lg font-semibold text-navy-900">
        {t('sections.litigation')}
      </h2>
      <Card className="mt-4">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            {summary.riskLevel === 'LOW' ? (
              <ShieldCheck className="h-6 w-6 text-green-600" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-orange-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">
                  {t('litigation.riskLevel')}
                </span>
                <Badge className={getRiskBadgeClass(summary.riskLevel)}>
                  {summary.riskLevel}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {summary.activeLawsuits > 0
                  ? `${summary.activeLawsuits} ${t('litigation.activeLawsuits')}` +
                    (summary.totalValueInDispute !== '0' &&
                    summary.totalValueInDispute !== '0.00'
                      ? ` · ${new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(parseFloat(summary.totalValueInDispute))}`
                      : '')
                  : t('litigation.noActive')}
              </p>
            </div>
          </div>
          {litigation.fetchedAt && (
            <p className="mt-3 text-xs text-gray-400">
              {t('litigation.fetchedAt')}{' '}
              {new Intl.DateTimeFormat('pt-BR').format(new Date(litigation.fetchedAt))}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function PublicHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="text-lg font-bold tracking-tight text-navy-900">
          Navia
        </span>
        <span className="text-xs text-gray-400">Investor-ready profiles</span>
      </div>
    </header>
  );
}

// ---------- Main Component ----------

export default function PublicProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations('publicProfile');

  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const fetchedRef = useRef(false);

  // Initial fetch on mount — determines gate type or loads profile
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function loadProfile() {
      try {
        const data = await api.get<PublicProfile>(`/api/v1/profiles/${slug}`);
        setPageState({ kind: 'profile', data });
      } catch (err) {
        if (err instanceof ApiError) {
          if (
            err.code === 'PROFILE_EMAIL_REQUIRED' ||
            err.messageKey === 'errors.profile.emailRequired'
          ) {
            setPageState({ kind: 'email_gate' });
            return;
          }
          if (
            err.statusCode === 401 ||
            err.messageKey === 'errors.profile.passwordRequired'
          ) {
            setPageState({ kind: 'password_gate' });
            return;
          }
          if (err.statusCode === 404) {
            setPageState({ kind: 'not_found' });
            return;
          }
        }
        setPageState({ kind: 'not_found' });
      }
    }

    loadProfile();
  }, [slug]);

  const handleEmailSubmit = useCallback(
    async (email: string) => {
      const data = await api.get<PublicProfile>(
        `/api/v1/profiles/${slug}?email=${encodeURIComponent(email)}`,
      );
      setPageState({ kind: 'profile', data });
    },
    [slug],
  );

  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      try {
        const data = await api.get<PublicProfile>(
          `/api/v1/profiles/${slug}?password=${encodeURIComponent(password)}`,
        );
        setPageState({ kind: 'profile', data });
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.statusCode === 401 ||
            err.messageKey === 'errors.profile.invalidPassword')
        ) {
          throw new Error(t('passwordGate.error'));
        }
        throw err;
      }
    },
    [slug, t],
  );

  return (
    <>
      <PublicHeader />
      {pageState.kind === 'loading' && <ProfileSkeleton />}
      {pageState.kind === 'not_found' && <NotFoundView t={t} />}
      {pageState.kind === 'email_gate' && (
        <EmailGateView onSubmit={handleEmailSubmit} t={t} />
      )}
      {pageState.kind === 'password_gate' && (
        <PasswordGateView onSubmit={handlePasswordSubmit} t={t} />
      )}
      {pageState.kind === 'profile' && (
        <ProfileContent profile={pageState.data} slug={slug} t={t} />
      )}
    </>
  );
}

function ProfileContent({
  profile,
  slug,
  t,
}: {
  profile: PublicProfile;
  slug: string;
  t: (key: string) => string;
}) {
  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            {profile.companyLogo ? (
              <img
                src={profile.companyLogo}
                alt={profile.companyName}
                className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-ocean-600 text-xl font-bold text-white shadow-sm">
                {profile.companyName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
                {profile.companyName}
              </h1>
              {profile.headline && (
                <p className="mt-1 text-base text-gray-600">{profile.headline}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {profile.sector && (
                  <Badge variant="secondary">
                    {SECTOR_LABELS[profile.sector] || profile.sector}
                  </Badge>
                )}
                {profile.foundedYear && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {profile.foundedYear}
                  </span>
                )}
                {profile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a
                    href={
                      profile.website.startsWith('http')
                        ? profile.website
                        : `https://${profile.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-ocean-600 hover:text-ocean-700"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {t('header.website')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </header>

          {/* Description */}
          {profile.description && (
            <section aria-labelledby="description-heading">
              <h2
                id="description-heading"
                className="text-lg font-semibold text-navy-900"
              >
                {t('sections.about')}
              </h2>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {profile.description}
              </div>
            </section>
          )}

          <MetricsSection metrics={profile.metrics} t={t} />
          <TeamSection team={profile.team} t={t} />
          <DocumentsSection documents={profile.documents} slug={slug} t={t} />
          {profile.litigation && (
            <LitigationSection litigation={profile.litigation} t={t} />
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center">
        <p className="text-xs text-gray-400">
          {t('footer.poweredBy')}{' '}
          <span className="font-semibold text-navy-900">Navia</span>
        </p>
      </footer>
    </>
  );
}
