// Company profile types returned by GET /api/v1/companies/:id/profile
export type ProfileStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ProfileAccessType = 'PUBLIC' | 'PASSWORD' | 'EMAIL_GATED';

export interface ProfileMetric {
  id: string;
  label: string;
  value: string;
  format: 'NUMBER' | 'CURRENCY_BRL' | 'CURRENCY_USD' | 'PERCENTAGE' | 'TEXT';
  icon: string | null;
  order: number;
}

export interface ProfileTeamMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
  linkedinUrl: string | null;
  order: number;
}

export type DocumentCategory =
  | 'PITCH_DECK'
  | 'FINANCIALS'
  | 'LEGAL'
  | 'PRODUCT'
  | 'TEAM'
  | 'OTHER';

export interface ProfileDocument {
  id: string;
  profileId: string;
  name: string;
  category: DocumentCategory;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  pageCount: number | null;
  thumbnailKey: string | null;
  order: number;
  uploadedById: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  documents: ProfileDocument[];
  totalStorage: number;
  maxStorage: number;
}

export interface DocumentDownloadResponse {
  downloadUrl: string;
  expiresIn: number;
}

export interface CompanyProfile {
  id: string;
  companyId: string;
  slug: string;
  headline: string | null;
  description: string | null;
  sector: string | null;
  foundedYear: number | null;
  website: string | null;
  location: string | null;
  status: ProfileStatus;
  accessType: ProfileAccessType;
  publishedAt: string | null;
  archivedAt: string | null;
  viewCount: number;
  shareUrl: string;
  company: { name: string; logoUrl: string | null };
  metrics: ProfileMetric[];
  team: ProfileTeamMember[];
  documents: ProfileDocument[];
  litigation: {
    status: string | null;
    riskLevel: string | null;
    data: unknown | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// Public profile types returned by GET /api/v1/profiles/:slug
export interface PublicProfileMetric {
  id: string;
  label: string;
  value: string;
  format: 'NUMBER' | 'CURRENCY_BRL' | 'CURRENCY_USD' | 'PERCENTAGE' | 'TEXT';
  icon: string | null;
  order: number;
}

export interface PublicProfileTeamMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
  linkedinUrl: string | null;
  order: number;
}

export interface PublicProfileDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  fileSize: number;
  mimeType: string;
  pageCount: number | null;
  order: number;
}

export interface LitigationSummary {
  activeLawsuits: number;
  historicalLawsuits: number;
  activeAdministrative: number;
  protests: number;
  totalValueInDispute: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PublicProfileLitigation {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  fetchedAt: string | null;
  summary: LitigationSummary | null;
  lawsuits?: Array<{
    processId: string;
    court: string;
    type: string;
    value: string;
    filingDate: string;
    status: string;
  }>;
  protestData?: {
    totalProtests: number;
    protests: Array<unknown>;
  };
  error?: string;
}

export interface PublicProfile {
  id: string;
  slug: string;
  companyName: string;
  companyLogo: string | null;
  headline: string | null;
  description: string | null;
  sector: string | null;
  foundedYear: number | null;
  website: string | null;
  location: string | null;
  metrics: PublicProfileMetric[];
  team: PublicProfileTeamMember[];
  documents: PublicProfileDocument[];
  viewCount: number;
  shareUrl: string;
  publishedAt: string | null;
  litigation: PublicProfileLitigation | null;
}

// Company types returned by GET /api/v1/companies
export interface CompanyListItem {
  id: string;
  name: string;
  entityType: 'LTDA' | 'SA_CAPITAL_FECHADO' | 'SA_CAPITAL_ABERTO';
  cnpj: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  logoUrl: string | null;
  role: string;
  memberCount: number;
  createdAt: string;
}

// Company detail type for settings page
export interface CompanyDetail {
  id: string;
  name: string;
  entityType: 'LTDA' | 'SA_CAPITAL_FECHADO' | 'SA_CAPITAL_ABERTO';
  cnpj: string;
  description: string | null;
  logoUrl: string | null;
  foundedDate: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  cnpjValidatedAt: string | null;
  defaultCurrency: string;
  fiscalYearEnd: string;
  timezone: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

// Company member types returned by GET /api/v1/companies/:id/members
export type MemberRole = 'ADMIN' | 'FINANCE' | 'LEGAL' | 'INVESTOR' | 'EMPLOYEE';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REMOVED';

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string | null;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  permissions: Record<string, boolean> | null;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  removedAt: string | null;
  removedBy: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profilePictureUrl: string | null;
    walletAddress: string | null;
  } | null;
}

// Notification types returned by GET /api/v1/users/me/notifications
export type NotificationType =
  | 'SIGNATURE_REQUEST'
  | 'DOCUMENT_SIGNED'
  | 'DOCUMENT_FULLY_SIGNED'
  | 'DOCUMENT_DECLINED'
  | 'SHARES_ISSUED'
  | 'SHARES_TRANSFERRED'
  | 'TRANSACTION_FAILED'
  | 'SHAREHOLDER_ADDED'
  | 'SHAREHOLDER_REMOVED'
  | 'DILUTION_EVENT'
  | 'OPTION_GRANTED'
  | 'VESTING_MILESTONE'
  | 'OPTION_EXERCISE_REQUESTED'
  | 'OPTION_EXERCISE_COMPLETED'
  | 'OPTIONS_EXPIRING'
  | 'ROUND_INVITATION'
  | 'ROUND_CLOSING_SOON'
  | 'ROUND_CLOSED'
  | 'KYC_COMPLETED'
  | 'KYC_REJECTED'
  | 'KYC_RESUBMISSION';

export type NotificationCategory =
  | 'documents'
  | 'transactions'
  | 'options'
  | 'fundingRounds'
  | 'security';

export interface Notification {
  id: string;
  notificationType: NotificationType;
  subject: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED';
  read: boolean;
  readAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  categories: {
    transactions: boolean;
    documents: boolean;
    options: boolean;
    fundingRounds: boolean;
    security: boolean;
  };
  updatedAt: string;
}

// Report types returned by GET /api/v1/companies/:id/reports/*
// NOTE: OwnershipReport and DilutionReport are cap-table era types.
// They will be removed when the Reports module is rewritten in Phase 1 (P2.5).
export interface OwnershipReportShareholder {
  shareholderId: string;
  name: string;
  shareClassId: string;
  shareClassName: string;
  shares: string;
  percentage: string;
  fullyDilutedPercentage: string;
}

export interface OptionPoolSummary {
  totalPool: string;
  granted: string;
  exercised: string;
  vestedUnexercised: string;
  unvested: string;
  available: string;
}

export interface OwnershipReport {
  companyId: string;
  companyName: string;
  generatedAt: string;
  totalShares: string;
  totalFullyDiluted: string;
  shareholders: OwnershipReportShareholder[];
  optionPoolSummary: OptionPoolSummary | null;
}

export interface DilutionDataPoint {
  date: string;
  totalShares: string;
  fullyDilutedShares: string;
  shareClasses: Array<{
    shareClassId: string;
    name: string;
    shares: string;
    percentage: string;
  }>;
}

export interface DilutionReport {
  companyId: string;
  generatedAt: string;
  dataPoints: DilutionDataPoint[];
  giniCoefficient: string;
  foreignOwnershipPercentage: string;
}

export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'oct';
export type ExportJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ExportJob {
  jobId: string;
  status: ExportJobStatus;
  format: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
}
