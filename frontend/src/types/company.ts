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

// Cap Table types returned by GET /api/v1/companies/:id/cap-table
export interface CapTableEntry {
  shareholderId: string;
  shareholderName: string;
  shareholderType: string;
  shareClassId: string;
  shareClassName: string;
  shareClassType: string;
  shares: string;
  ownershipPercentage: string;
  votingPower: string;
  votingPercentage: string;
}

export interface CapTable {
  company: {
    id: string;
    name: string;
    entityType: string;
  };
  summary: {
    totalShares: string;
    totalShareholders: number;
    totalShareClasses: number;
    lastUpdated: string;
  };
  entries: CapTableEntry[];
}

// Fully-diluted cap table types returned by GET /api/v1/companies/:id/cap-table/fully-diluted
export interface FullyDilutedEntry {
  shareholderId: string;
  shareholderName: string;
  shareholderType: string;
  currentShares: string;
  currentPercentage: string;
  optionsVested: string;
  optionsUnvested: string;
  fullyDilutedShares: string;
  fullyDilutedPercentage: string;
}

export interface FullyDilutedCapTable {
  company: {
    id: string;
    name: string;
    entityType: string;
  };
  summary: {
    totalSharesOutstanding: string;
    totalOptionsOutstanding: string;
    fullyDilutedShares: string;
  };
  entries: FullyDilutedEntry[];
}

// Cap table snapshot history types
export interface CapTableHistoryItem {
  id: string;
  snapshotDate: string;
  totalShares: string;
  totalShareholders: number;
  trigger: string;
  notes: string | null;
  stateHash: string | null;
  createdAt: string;
}

// Share class summary for filtering
export interface ShareClassSummary {
  id: string;
  className: string;
  type: string;
}

// Shareholder types returned by GET /api/v1/companies/:id/shareholders
export type ShareholderType = 'FOUNDER' | 'INVESTOR' | 'EMPLOYEE' | 'ADVISOR' | 'CORPORATE';
export type ShareholderStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface Shareholder {
  id: string;
  companyId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  type: ShareholderType;
  status: ShareholderStatus;
  cpfCnpj: string | null;
  walletAddress: string | null;
  nationality: string;
  taxResidency: string;
  isForeign: boolean;
  address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
  rdeIedNumber: string | null;
  rdeIedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareholderHolding {
  id: string;
  shareClassId: string;
  quantity: string;
  ownershipPct: string;
  votingPowerPct: string;
  shareClass: {
    id: string;
    className: string;
    type: string;
    votesPerShare: string;
  };
}

export interface BeneficialOwner {
  id: string;
  shareholderId: string;
  name: string;
  cpf: string | null;
  ownershipPct: string;
}

export interface ShareholderDetail extends Shareholder {
  shareholdings: ShareholderHolding[];
  beneficialOwners: BeneficialOwner[];
}

export interface ForeignShareholdersSummary {
  shareholders: (Shareholder & { shareholdings: { quantity: string; ownershipPct: string }[] })[];
  summary: {
    totalForeignShareholders: number;
    totalForeignOwnershipPercentage: string;
  };
}

// Share class types returned by GET /api/v1/companies/:id/share-classes
export type ShareClassType = 'QUOTA' | 'COMMON_SHARES' | 'PREFERRED_SHARES';

export interface ShareClass {
  id: string;
  companyId: string;
  className: string;
  type: ShareClassType;
  totalAuthorized: string;
  totalIssued: string;
  votesPerShare: number;
  liquidationPreferenceMultiple: string | null;
  participatingRights: boolean;
  rightOfFirstRefusal: boolean;
  lockUpPeriodMonths: number | null;
  tagAlongPercentage: string | null;
  createdAt: string;
  updatedAt: string;
}

// Transaction types returned by GET /api/v1/companies/:id/transactions
export interface TransactionShareholder {
  id: string;
  name: string;
  type: string;
}

export interface TransactionShareClass {
  id: string;
  className: string;
  type: string;
}

// Funding Round types returned by GET /api/v1/companies/:id/funding-rounds
export type RoundType = 'PRE_SEED' | 'SEED' | 'SERIES_A' | 'SERIES_B' | 'SERIES_C' | 'BRIDGE' | 'OTHER';
export type FundingRoundStatus = 'DRAFT' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'CANCELLED';

export interface FundingRound {
  id: string;
  companyId: string;
  name: string;
  roundType: RoundType;
  shareClassId: string;
  targetAmount: string;
  minimumCloseAmount: string | null;
  hardCap: string | null;
  preMoneyValuation: string;
  pricePerShare: string;
  status: FundingRoundStatus;
  notes: string | null;
  targetCloseDate: string | null;
  openedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FundingRoundDetail extends FundingRound {
  currentAmount: string;
  postMoneyValuation: string;
  commitmentCount: number;
  shareClass: {
    id: string;
    className: string;
    type: string;
  };
}

// Commitment types returned by GET /api/v1/companies/:id/funding-rounds/:roundId/commitments
export type CommitmentPaymentStatus = 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'CANCELLED';

export interface RoundCommitment {
  id: string;
  roundId: string;
  shareholderId: string;
  amount: string;
  sharesAllocated: string | null;
  paymentStatus: CommitmentPaymentStatus;
  paymentConfirmedAt: string | null;
  hasSideLetter: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  shareholder: {
    id: string;
    name: string;
    type: string;
  };
}

// Pro-forma cap table types
export interface ProFormaEntry {
  shareholderId: string;
  name: string;
  shares: string;
  percentage: string;
}

export interface ProFormaCapTable {
  beforeRound: {
    totalShares: string;
    shareholders: ProFormaEntry[];
  };
  afterRound: {
    totalShares: string;
    shareholders: ProFormaEntry[];
  };
  dilution: Record<string, { before: string; after: string; change: string }>;
}

// Option Plan types returned by GET /api/v1/companies/:id/option-plans
export type OptionPlanStatus = 'ACTIVE' | 'CLOSED';
export type TerminationPolicy = 'FORFEITURE' | 'ACCELERATION' | 'PRO_RATA';
export type VestingFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type OptionGrantStatus = 'ACTIVE' | 'EXERCISED' | 'CANCELLED' | 'EXPIRED';
export type ExerciseRequestStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_CONFIRMED'
  | 'SHARES_ISSUED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OptionPlan {
  id: string;
  companyId: string;
  name: string;
  shareClassId: string;
  totalPoolSize: string;
  totalGranted: string;
  totalExercised: string;
  status: OptionPlanStatus;
  boardApprovalDate: string | null;
  terminationPolicy: TerminationPolicy;
  exerciseWindowDays: number;
  notes: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  shareClass?: {
    id: string;
    className: string;
    type: string;
  };
  // Computed fields from detail endpoint (findPlanById)
  optionsAvailable?: string;
  activeGrantCount?: number;
}

export interface OptionGrant {
  id: string;
  companyId: string;
  planId: string;
  shareholderId: string | null;
  employeeName: string;
  employeeEmail: string;
  quantity: string;
  strikePrice: string;
  exercised: string;
  status: OptionGrantStatus;
  grantDate: string;
  expirationDate: string;
  cliffMonths: number;
  vestingDurationMonths: number;
  vestingFrequency: VestingFrequency;
  cliffPercentage: string;
  accelerationOnCoc: boolean;
  terminatedAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  plan?: {
    id: string;
    name: string;
  };
}

export interface OptionExerciseRequest {
  id: string;
  grantId: string;
  quantity: string;
  totalCost: string;
  paymentReference: string;
  status: ExerciseRequestStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  blockchainTxHash: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  grant?: {
    id: string;
    employeeName: string;
    employeeEmail: string;
    strikePrice: string;
    plan?: {
      id: string;
      name: string;
    };
  };
}

// Convertible Instrument types returned by GET /api/v1/companies/:id/convertibles
export type InstrumentType = 'MUTUO_CONVERSIVEL' | 'INVESTIMENTO_ANJO' | 'MISTO' | 'MAIS';
export type ConvertibleStatus = 'OUTSTANDING' | 'CONVERTED' | 'REDEEMED' | 'MATURED' | 'CANCELLED';
export type InterestType = 'SIMPLE' | 'COMPOUND';
export type ConversionTrigger = 'QUALIFIED_FINANCING' | 'MATURITY' | 'CHANGE_OF_CONTROL' | 'INVESTOR_OPTION';

export interface ConvertibleInstrument {
  id: string;
  companyId: string;
  shareholderId: string;
  instrumentType: InstrumentType;
  status: ConvertibleStatus;
  principalAmount: string;
  interestRate: string;
  interestType: InterestType;
  accruedInterest: string;
  valuationCap: string | null;
  discountRate: string | null;
  qualifiedFinancingThreshold: string | null;
  conversionTrigger: ConversionTrigger | null;
  targetShareClassId: string | null;
  autoConvert: boolean;
  mfnClause: boolean;
  issueDate: string;
  maturityDate: string;
  convertedAt: string | null;
  redeemedAt: string | null;
  cancelledAt: string | null;
  conversionData: Record<string, unknown> | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  shareholder?: {
    id: string;
    name: string;
    type: string;
  };
  targetShareClass?: {
    id: string;
    className: string;
    type: string;
  } | null;
}

// Convertible interest breakdown returned by GET /api/v1/companies/:id/convertibles/:id/interest
export interface InterestPeriod {
  period: string;
  days: number;
  interestAccrued: string;
}

export interface InterestBreakdown {
  convertibleId: string;
  principalAmount: string;
  interestRate: string;
  interestType: string;
  issueDate: string;
  calculationDate: string;
  daysElapsed: number;
  accruedInterest: string;
  totalValue: string;
  interestBreakdown: InterestPeriod[];
}

// Convertible conversion scenarios returned by GET /api/v1/companies/:id/convertibles/:id/scenarios
export interface ConversionMethod {
  conversionPrice: string;
  sharesIssued: string;
  ownershipPercentage: string;
}

export interface ConversionScenario {
  hypotheticalValuation: string;
  preMoneyShares: number;
  roundPricePerShare: string;
  discountMethod: ConversionMethod | null;
  capMethod: ConversionMethod | null;
  bestMethod: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE';
  finalConversionPrice: string;
  finalSharesIssued: string;
  finalOwnershipPercentage: string;
  dilutionToExisting: string;
}

export interface ConversionScenarios {
  convertibleId: string;
  currentConversionAmount: string;
  summary: {
    valuationCap: string | null;
    discountRate: string | null;
    capTriggersAbove: string | null;
  };
  scenarios: ConversionScenario[];
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

export interface Transaction {
  id: string;
  companyId: string;
  type: 'ISSUANCE' | 'TRANSFER' | 'CONVERSION' | 'CANCELLATION' | 'SPLIT';
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'SUBMITTED'
    | 'CONFIRMED'
    | 'FAILED'
    | 'CANCELLED';
  fromShareholder: TransactionShareholder | null;
  toShareholder: TransactionShareholder | null;
  shareClass: TransactionShareClass;
  quantity: string;
  pricePerShare: string | null;
  totalValue: string | null;
  notes: string | null;
  requiresBoardApproval: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  confirmedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
