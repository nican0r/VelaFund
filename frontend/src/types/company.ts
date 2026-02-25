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
