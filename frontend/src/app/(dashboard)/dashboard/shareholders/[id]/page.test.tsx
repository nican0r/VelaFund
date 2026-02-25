import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareholderDetailPage from './page';

// --- Mocks ---

const shareholdersTranslations: Record<string, string> = {
  empty: 'Nenhum acionista cadastrado.',
  foreign: 'Estrangeiro',
  'detail.back': 'Voltar para Acionistas',
  'detail.overview': 'Visão Geral',
  'detail.holdings': 'Participações',
  'detail.transactions': 'Transações',
  'detail.compliance': 'Compliance',
  'detail.personalInfo': 'Informações Pessoais',
  'detail.contactInfo': 'Informações de Contato',
  'detail.totalShares': 'Total de Ações',
  'detail.ownershipPercentage': 'Participação (%)',
  'detail.votingPower': 'Poder de Voto',
  'detail.shareClass': 'Classe',
  'detail.shareClassType': 'Tipo da Classe',
  'detail.quantity': 'Quantidade',
  'detail.ownershipPct': '% da Classe',
  'detail.votingPowerPct': '% Voto',
  'detail.cpfCnpj': 'CPF/CNPJ',
  'detail.email': 'E-mail',
  'detail.phone': 'Telefone',
  'detail.nationality': 'Nacionalidade',
  'detail.taxResidency': 'Residência Fiscal',
  'detail.isForeign': 'Estrangeiro',
  'detail.yes': 'Sim',
  'detail.no': 'Não',
  'detail.holdingsEmpty': 'Nenhuma participação registrada.',
  'detail.transactionsEmpty': 'Nenhuma transação encontrada para este acionista.',
  'detail.error': 'Erro ao carregar dados do acionista.',
  'detail.notFound': 'Acionista não encontrado.',
  'detail.foreignInfo': 'Informações de Estrangeiro',
  'detail.rdeIedNumber': 'Número RDE-IED',
  'detail.rdeIedDate': 'Data do RDE-IED',
  'detail.beneficialOwners': 'Beneficiários Finais',
  'detail.beneficialOwnersEmpty': 'Nenhum beneficiário final cadastrado.',
  'detail.beneficialOwnersNote': 'Beneficiários finais são obrigatórios.',
  'table.name': 'Nome',
  'table.type': 'Tipo',
  'type.founder': 'Fundador(a)',
  'type.investor': 'Investidor(a)',
  'type.employee': 'Funcionário(a)',
  'type.advisor': 'Consultor(a)',
  'type.corporate': 'Pessoa Jurídica',
  'status.active': 'Ativo',
  'status.inactive': 'Inativo',
  'status.pending': 'Pendente',
  'form.addressStreet': 'Endereço',
  'form.addressCity': 'Cidade',
  'form.addressCountry': 'País',
  'form.addressPostalCode': 'CEP',
  'pagination.showing': 'Mostrando {from} a {to} de {total}',
  'pagination.previous': 'Anterior',
  'pagination.next': 'Próxima',
  'pagination.page': 'Página',
  'pagination.of': 'de',
};

const transactionsTranslations: Record<string, string> = {
  'table.date': 'Data',
  'table.type': 'Tipo',
  'table.from': 'De',
  'table.to': 'Para',
  'table.quantity': 'Quantidade',
  'table.value': 'Valor',
  'table.status': 'Status',
  'type.issuance': 'Emissão',
  'type.transfer': 'Transferência',
  'type.conversion': 'Conversão',
  'type.cancellation': 'Cancelamento',
  'type.split': 'Desdobramento',
  'status.draft': 'Rascunho',
  'status.pendingApproval': 'Pendente',
  'status.submitted': 'Enviado',
  'status.confirmed': 'Confirmado',
  'status.failed': 'Falhou',
  'status.cancelled': 'Cancelado',
};

const commonTranslations: Record<string, string> = {
  back: 'Voltar',
  edit: 'Editar',
  delete: 'Excluir',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const maps: Record<string, Record<string, string>> = {
      shareholders: shareholdersTranslations,
      transactions: transactionsTranslations,
      common: commonTranslations,
    };
    return (key: string, params?: Record<string, unknown>) => {
      const map = maps[namespace || ''] || {};
      let result = map[key] ?? `${namespace}.${key}`;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    };
  },
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'sh-1' }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

const mockUseCompany = jest.fn();
jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

const mockUseShareholder = jest.fn();
jest.mock('@/hooks/use-shareholders', () => ({
  useShareholder: (...args: unknown[]) => mockUseShareholder(...args),
}));

const mockUseTransactions = jest.fn();
jest.mock('@/hooks/use-transactions', () => ({
  useTransactions: (...args: unknown[]) => mockUseTransactions(...args),
}));

// --- Test data ---

const mockShareholder = {
  id: 'sh-1',
  companyId: 'c-1',
  userId: null,
  name: 'João da Silva',
  email: 'joao@example.com',
  phone: '+55 11 98765-4321',
  type: 'INVESTOR' as const,
  status: 'ACTIVE' as const,
  cpfCnpj: '12345678901',
  walletAddress: null,
  nationality: 'BR',
  taxResidency: 'BR',
  isForeign: false,
  address: {
    street: 'Av. Paulista, 1000',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    postalCode: '01310-100',
  },
  rdeIedNumber: null,
  rdeIedDate: null,
  createdAt: '2025-06-15T10:00:00.000Z',
  updatedAt: '2026-01-20T10:00:00.000Z',
  shareholdings: [
    {
      id: 'hold-1',
      shareClassId: 'sc-1',
      quantity: '10000',
      ownershipPct: '25.00',
      votingPowerPct: '25.00',
      shareClass: {
        id: 'sc-1',
        className: 'Ações Ordinárias',
        type: 'COMMON_SHARES',
        votesPerShare: '1',
      },
    },
    {
      id: 'hold-2',
      shareClassId: 'sc-2',
      quantity: '5000',
      ownershipPct: '12.50',
      votingPowerPct: '0.00',
      shareClass: {
        id: 'sc-2',
        className: 'Ações Preferenciais',
        type: 'PREFERRED_SHARES',
        votesPerShare: '0',
      },
    },
  ],
  beneficialOwners: [],
};

const mockCorporateShareholder = {
  ...mockShareholder,
  id: 'sh-2',
  name: 'Fundo XYZ',
  type: 'CORPORATE' as const,
  cpfCnpj: '12345678000190',
  beneficialOwners: [
    {
      id: 'bo-1',
      shareholderId: 'sh-2',
      name: 'Maria Santos',
      cpf: '98765432100',
      ownershipPct: '60.00',
    },
    {
      id: 'bo-2',
      shareholderId: 'sh-2',
      name: 'Pedro Alves',
      cpf: '11122233344',
      ownershipPct: '40.00',
    },
  ],
};

const mockForeignShareholder = {
  ...mockShareholder,
  id: 'sh-3',
  name: 'John Smith',
  type: 'INVESTOR' as const,
  isForeign: true,
  nationality: 'US',
  taxResidency: 'US',
  rdeIedNumber: 'RDE-2024-001',
  rdeIedDate: '2024-03-15T00:00:00.000Z',
};

const mockTransactions = {
  data: [
    {
      id: 'txn-1',
      companyId: 'c-1',
      type: 'ISSUANCE',
      status: 'CONFIRMED',
      fromShareholder: null,
      toShareholder: { id: 'sh-1', name: 'João da Silva', type: 'INVESTOR' },
      shareClass: { id: 'sc-1', className: 'ON', type: 'COMMON_SHARES' },
      quantity: '10000',
      pricePerShare: '1.00',
      totalValue: '10000.00',
      notes: null,
      requiresBoardApproval: false,
      approvedBy: null,
      approvedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      confirmedAt: '2025-06-15T10:00:00.000Z',
      createdBy: 'user-1',
      createdAt: '2025-06-15T10:00:00.000Z',
      updatedAt: '2025-06-15T10:00:00.000Z',
    },
    {
      id: 'txn-2',
      companyId: 'c-1',
      type: 'TRANSFER',
      status: 'CONFIRMED',
      fromShareholder: { id: 'sh-4', name: 'Carlos Souza', type: 'FOUNDER' },
      toShareholder: { id: 'sh-1', name: 'João da Silva', type: 'INVESTOR' },
      shareClass: { id: 'sc-2', className: 'PN', type: 'PREFERRED_SHARES' },
      quantity: '5000',
      pricePerShare: '2.00',
      totalValue: '10000.00',
      notes: null,
      requiresBoardApproval: false,
      approvedBy: null,
      approvedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      confirmedAt: '2025-07-01T10:00:00.000Z',
      createdBy: 'user-1',
      createdAt: '2025-07-01T10:00:00.000Z',
      updatedAt: '2025-07-01T10:00:00.000Z',
    },
  ],
  meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
};

const defaultCompany = {
  companies: [{ id: 'c-1', name: 'Acme', status: 'ACTIVE' }],
  selectedCompany: { id: 'c-1', name: 'Acme', status: 'ACTIVE' },
  setSelectedCompanyId: jest.fn(),
  isLoading: false,
  error: null,
};

// --- Tests ---

describe('ShareholderDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCompany.mockReturnValue(defaultCompany);
    mockUseShareholder.mockReturnValue({
      data: mockShareholder,
      isLoading: false,
      error: null,
    });
    mockUseTransactions.mockReturnValue({
      data: mockTransactions,
      isLoading: false,
      error: null,
    });
  });

  // --- Rendering ---

  it('renders shareholder name and badges', () => {
    render(<ShareholderDetailPage />);
    // Name appears in h1 and in InfoRow
    expect(screen.getAllByText('João da Silva').length).toBeGreaterThanOrEqual(1);
    // Type label appears in header badge and in InfoRow value
    expect(screen.getAllByText('Investidor(a)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('renders avatar with initials', () => {
    render(<ShareholderDetailPage />);
    // "João da Silva" → skips 'da' → 'J' + 'S' = 'JS'
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('renders back link', () => {
    render(<ShareholderDetailPage />);
    const backLink = screen.getByText('Voltar para Acionistas');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/shareholders');
  });

  it('renders stat cards with computed totals', () => {
    render(<ShareholderDetailPage />);
    // Total shares: 10000 + 5000 = 15000
    expect(screen.getByText('15.000')).toBeInTheDocument();
    expect(screen.getByText('Total de Ações')).toBeInTheDocument();
    expect(screen.getByText('Participação (%)')).toBeInTheDocument();
    expect(screen.getByText('Poder de Voto')).toBeInTheDocument();
  });

  it('renders four tab triggers', () => {
    render(<ShareholderDetailPage />);
    expect(screen.getByText('Visão Geral')).toBeInTheDocument();
    expect(screen.getByText('Participações')).toBeInTheDocument();
    // "Transações" appears in tab and possibly elsewhere
    expect(screen.getAllByText('Transações').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Compliance')).toBeInTheDocument();
  });

  // --- Overview Tab ---

  it('renders personal info in overview tab', () => {
    render(<ShareholderDetailPage />);
    expect(screen.getByText('Informações Pessoais')).toBeInTheDocument();
    expect(screen.getByText('123.***.***-01')).toBeInTheDocument();
    // 'BR' appears in nationality, taxResidency, and address country
    expect(screen.getAllByText('BR').length).toBeGreaterThanOrEqual(1);
  });

  it('renders contact info in overview tab', () => {
    render(<ShareholderDetailPage />);
    expect(screen.getByText('Informações de Contato')).toBeInTheDocument();
    expect(screen.getByText('joao@example.com')).toBeInTheDocument();
    expect(screen.getByText('+55 11 98765-4321')).toBeInTheDocument();
  });

  it('renders address fields', () => {
    render(<ShareholderDetailPage />);
    expect(screen.getByText('Av. Paulista, 1000')).toBeInTheDocument();
    expect(screen.getByText('São Paulo, SP')).toBeInTheDocument();
    expect(screen.getByText('01310-100')).toBeInTheDocument();
  });

  // --- Holdings Tab ---

  it('renders holdings table when switching to holdings tab', async () => {
    const user = userEvent.setup();
    render(<ShareholderDetailPage />);
    await user.click(screen.getByText('Participações'));
    expect(screen.getByText('Ações Ordinárias')).toBeInTheDocument();
    expect(screen.getByText('Ações Preferenciais')).toBeInTheDocument();
    expect(screen.getByText('10.000')).toBeInTheDocument();
    expect(screen.getByText('5.000')).toBeInTheDocument();
  });

  it('shows empty state for holdings when no shareholdings', async () => {
    const user = userEvent.setup();
    mockUseShareholder.mockReturnValue({
      data: { ...mockShareholder, shareholdings: [] },
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    await user.click(screen.getByText('Participações'));
    expect(screen.getByText('Nenhuma participação registrada.')).toBeInTheDocument();
  });

  // --- Transactions Tab ---

  it('renders transactions table when switching to transactions tab', async () => {
    const user = userEvent.setup();
    render(<ShareholderDetailPage />);
    await user.click(screen.getAllByText('Transações')[0]);
    expect(screen.getByText('Emissão')).toBeInTheDocument();
    expect(screen.getByText('Transferência')).toBeInTheDocument();
    expect(screen.getAllByText('Confirmado').length).toBeGreaterThanOrEqual(1);
  });

  it('shows from/to shareholder names in transactions', async () => {
    const user = userEvent.setup();
    render(<ShareholderDetailPage />);
    await user.click(screen.getAllByText('Transações')[0]);
    expect(screen.getByText('Carlos Souza')).toBeInTheDocument();
  });

  it('shows formatted currency in transactions', async () => {
    const user = userEvent.setup();
    render(<ShareholderDetailPage />);
    await user.click(screen.getAllByText('Transações')[0]);
    // R$ 10.000,00 should appear (formatted)
    const cells = screen.getAllByText(/R\$\s*10\.000,00/);
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state for transactions', async () => {
    const user = userEvent.setup();
    mockUseTransactions.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } },
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    await user.click(screen.getAllByText('Transações')[0]);
    expect(
      screen.getByText('Nenhuma transação encontrada para este acionista.'),
    ).toBeInTheDocument();
  });

  it('shows transaction loading state', async () => {
    const user = userEvent.setup();
    mockUseTransactions.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    render(<ShareholderDetailPage />);
    await user.click(screen.getAllByText('Transações')[0]);
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  // --- Compliance Tab ---

  it('renders compliance for non-foreign, non-corporate shareholder', async () => {
    const user = userEvent.setup();
    render(<ShareholderDetailPage />);
    await user.click(screen.getByText('Compliance'));
    expect(screen.getByText('Não')).toBeInTheDocument();
  });

  it('renders foreign info for foreign shareholder', async () => {
    const user = userEvent.setup();
    mockUseShareholder.mockReturnValue({
      data: mockForeignShareholder,
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    // Check foreign badge in header - 'Estrangeiro' also appears in overview InfoRow
    expect(screen.getAllByText('Estrangeiro').length).toBeGreaterThanOrEqual(1);
    // Switch to compliance
    await user.click(screen.getByText('Compliance'));
    expect(screen.getByText('Informações de Estrangeiro')).toBeInTheDocument();
    expect(screen.getByText('RDE-2024-001')).toBeInTheDocument();
  });

  it('renders beneficial owners for corporate shareholder', async () => {
    const user = userEvent.setup();
    mockUseShareholder.mockReturnValue({
      data: mockCorporateShareholder,
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    await user.click(screen.getByText('Compliance'));
    expect(screen.getByText('Beneficiários Finais')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Pedro Alves')).toBeInTheDocument();
  });

  it('renders empty beneficial owners for corporate with no owners', async () => {
    const user = userEvent.setup();
    mockUseShareholder.mockReturnValue({
      data: { ...mockCorporateShareholder, beneficialOwners: [] },
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    await user.click(screen.getByText('Compliance'));
    expect(screen.getByText('Nenhum beneficiário final cadastrado.')).toBeInTheDocument();
  });

  // --- CPF/CNPJ Masking ---

  it('masks CPF correctly (11 digits)', () => {
    render(<ShareholderDetailPage />);
    expect(screen.getByText('123.***.***-01')).toBeInTheDocument();
  });

  it('masks CNPJ correctly (14 digits) for corporate', () => {
    mockUseShareholder.mockReturnValue({
      data: mockCorporateShareholder,
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    expect(screen.getByText('12.***.***/0001-90')).toBeInTheDocument();
  });

  // --- Loading State ---

  it('renders loading skeleton when data is loading', () => {
    mockUseCompany.mockReturnValue({ ...defaultCompany, isLoading: true });
    render(<ShareholderDetailPage />);
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders loading skeleton when shareholder is loading', () => {
    mockUseShareholder.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    render(<ShareholderDetailPage />);
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  // --- Error State ---

  it('renders error state', () => {
    mockUseShareholder.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    });
    render(<ShareholderDetailPage />);
    expect(screen.getByText('Erro ao carregar dados do acionista.')).toBeInTheDocument();
    expect(screen.getByText('Voltar para Acionistas')).toBeInTheDocument();
  });

  // --- Not Found State ---

  it('renders not found state when shareholder is null', () => {
    mockUseShareholder.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    expect(screen.getByText('Acionista não encontrado.')).toBeInTheDocument();
  });

  // --- No Company ---

  it('renders empty state when no company selected', () => {
    mockUseCompany.mockReturnValue({
      ...defaultCompany,
      selectedCompany: null,
      isLoading: false,
    });
    render(<ShareholderDetailPage />);
    expect(screen.getByText('Nenhum acionista cadastrado.')).toBeInTheDocument();
  });

  // --- Hook Calls ---

  it('calls useShareholder with correct args', () => {
    render(<ShareholderDetailPage />);
    expect(mockUseShareholder).toHaveBeenCalledWith('c-1', 'sh-1');
  });

  it('calls useTransactions with shareholderId filter', () => {
    render(<ShareholderDetailPage />);
    expect(mockUseTransactions).toHaveBeenCalledWith('c-1', {
      shareholderId: 'sh-1',
      page: 1,
      limit: 10,
      sort: '-createdAt',
    });
  });

  // --- Transaction Pagination ---

  it('does not show pagination for single page', async () => {
    const user = userEvent.setup();
    render(<ShareholderDetailPage />);
    await user.click(screen.getAllByText('Transações')[0]);
    // meta.totalPages = 1, so pagination should not appear
    expect(screen.queryByText('Anterior')).not.toBeInTheDocument();
  });

  it('shows pagination when multiple pages exist', async () => {
    const user = userEvent.setup();
    mockUseTransactions.mockReturnValue({
      data: {
        data: mockTransactions.data,
        meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
      },
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    await user.click(screen.getAllByText('Transações')[0]);
    expect(screen.getByText('Anterior')).toBeInTheDocument();
    expect(screen.getByText('Próxima')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 a 10 de 25')).toBeInTheDocument();
  });

  // --- Shareholder without holdings ---

  it('computes zero totals when no holdings', () => {
    mockUseShareholder.mockReturnValue({
      data: { ...mockShareholder, shareholdings: [] },
      isLoading: false,
      error: null,
    });
    render(<ShareholderDetailPage />);
    // Total shares should be 0
    const statValues = screen.getAllByText('0');
    expect(statValues.length).toBeGreaterThanOrEqual(1);
  });
});
