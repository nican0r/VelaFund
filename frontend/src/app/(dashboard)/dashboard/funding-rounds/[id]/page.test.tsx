import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundingRoundDetailPage from './page';

// --- Translation mocks ---

const fundingRoundsTranslations: Record<string, string> = {
  empty: 'Nenhuma rodada de investimento registrada.',
  'type.preSeed': 'Pré-Seed',
  'type.seed': 'Seed',
  'type.seriesA': 'Série A',
  'type.seriesB': 'Série B',
  'type.seriesC': 'Série C',
  'type.bridge': 'Bridge',
  'type.other': 'Outro',
  'status.draft': 'Rascunho',
  'status.open': 'Aberta',
  'status.closing': 'Fechando',
  'status.closed': 'Fechada',
  'status.cancelled': 'Cancelada',
  actions: 'Ações',
  'detail.back': 'Voltar para Rodadas',
  'detail.title': 'Detalhe da Rodada',
  'detail.loading': 'Carregando rodada...',
  'detail.error': 'Erro ao carregar rodada',
  'detail.notFound': 'Rodada não encontrada',
  'detail.notFoundDescription': 'A rodada solicitada não existe ou foi removida.',
  'detail.openButton': 'Abrir Rodada',
  'detail.closeButton': 'Fechar Rodada',
  'detail.cancelButton': 'Cancelar Rodada',
  'detail.addCommitment': 'Adicionar Compromisso',
  'detail.openTitle': 'Abrir Rodada',
  'detail.openDescription': 'Após abrir, investidores poderão realizar compromissos.',
  'detail.closeTitle': 'Fechar Rodada',
  'detail.closeDescription': 'Ao fechar, as ações serão emitidas para os investidores.',
  'detail.cancelTitle': 'Cancelar Rodada',
  'detail.cancelDescription': 'Esta ação cancelará a rodada permanentemente.',
  'detail.statsTarget': 'Meta',
  'detail.statsRaised': 'Captado',
  'detail.statsInvestors': 'Investidores',
  'detail.statsPricePerShare': 'Preço por Ação',
  'detail.progress': 'Progresso',
  'detail.minimumClose': 'Mínimo para fechar',
  'detail.commitmentsTab': 'Compromissos',
  'detail.detailsTab': 'Detalhes',
  'detail.proformaTab': 'Pro-Forma',
  'detail.investor': 'Investidor',
  'detail.amount': 'Valor',
  'detail.sharesAllocated': 'Ações Alocadas',
  'detail.paymentStatus': 'Status Pgto.',
  'detail.hasSideLetter': 'Side Letter',
  'detail.commitmentDate': 'Data do Compromisso',
  'detail.paymentStatusPending': 'Pendente',
  'detail.paymentStatusReceived': 'Recebido',
  'detail.paymentStatusConfirmed': 'Confirmado',
  'detail.paymentStatusCancelled': 'Cancelado',
  'detail.commitmentsEmpty': 'Nenhum compromisso registrado.',
  'detail.markReceived': 'Marcar Recebido',
  'detail.confirmPayment': 'Confirmar Pagamento',
  'detail.cancelCommitment': 'Cancelar Compromisso',
  'detail.cancelCommitmentTitle': 'Cancelar Compromisso',
  'detail.cancelCommitmentDescription': 'Esta ação cancelará o compromisso do investidor.',
  'detail.name': 'Nome da Rodada',
  'detail.roundType': 'Tipo',
  'detail.shareClass': 'Classe de Ações',
  'detail.preMoney': 'Valuation Pré-Money',
  'detail.postMoney': 'Valuation Pós-Money',
  'detail.pricePerShare': 'Preço por Ação',
  'detail.targetCloseDate': 'Data Alvo de Fechamento',
  'detail.notes': 'Observações',
  'detail.createdAt': 'Criado em',
  'detail.openedAt': 'Aberto em',
  'detail.closedAt': 'Fechado em',
  'detail.cancelledAt': 'Cancelado em',
  'detail.timelineCreated': 'Rodada criada',
  'detail.timelineOpened': 'Rodada aberta',
  'detail.timelineClosed': 'Rodada fechada',
  'detail.timelineCancelled': 'Rodada cancelada',
  'detail.proFormaShareholder': 'Acionista',
  'detail.proFormaBefore': 'Antes',
  'detail.proFormaAfter': 'Depois',
  'detail.proFormaChange': 'Variação',
  'detail.proFormaTotalShares': 'Total de Ações',
  'detail.proFormaEmpty': 'Nenhum dado pro-forma disponível.',
  'detail.addCommitmentTitle': 'Adicionar Compromisso',
  'detail.addCommitmentDescription': 'Selecione o investidor e o valor do compromisso.',
  'detail.selectInvestor': 'Selecione o investidor',
  'detail.amountPlaceholder': '0,00',
  'detail.sideLetter': 'Possui side letter',
  'detail.notesPlaceholder': 'Observações opcionais...',
  'detail.hardCap': 'Hard Cap',
  'detail.minimumCloseAmount': 'Mínimo',
  'detail.targetAmount': 'Meta',
  'detail.currentAmount': 'Atual',
};

const commonTranslations: Record<string, string> = {
  cancel: 'Cancelar',
  save: 'Salvar',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const translations: Record<string, Record<string, string>> = {
      fundingRounds: fundingRoundsTranslations,
      common: commonTranslations,
    };
    return (key: string) => translations[namespace]?.[key] ?? `${namespace}.${key}`;
  },
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

const mockParams = { id: 'round-123' };
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

// Company context mock
const mockCompany = {
  id: 'company-1',
  name: 'Acme Ltda',
  cnpj: '12.345.678/0001-90',
  entityType: 'LTDA' as const,
  status: 'ACTIVE' as const,
  description: null,
  logoUrl: null,
  foundedDate: null,
  cnpjValidatedAt: null,
  defaultCurrency: 'BRL',
  fiscalYearEnd: '12-31',
  timezone: 'America/Sao_Paulo',
  locale: 'pt-BR',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let mockUseCompany = jest.fn(() => ({
  selectedCompany: mockCompany,
  isLoading: false,
  companies: [mockCompany],
  selectCompany: jest.fn(),
}));

jest.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

// Funding round hooks mock
const mockRound = {
  id: 'round-123',
  companyId: 'company-1',
  name: 'Seed Round',
  roundType: 'SEED' as const,
  shareClassId: 'sc-1',
  targetAmount: '1000000',
  minimumCloseAmount: '500000',
  hardCap: null,
  preMoneyValuation: '5000000',
  pricePerShare: '10.00',
  status: 'OPEN' as const,
  notes: null,
  targetCloseDate: '2026-06-30T00:00:00.000Z',
  openedAt: '2026-02-15T10:00:00.000Z',
  closedAt: null,
  cancelledAt: null,
  createdBy: 'user-1',
  createdAt: '2026-02-10T14:30:00.000Z',
  updatedAt: '2026-02-15T10:00:00.000Z',
  // FundingRoundDetail fields
  currentAmount: '350000',
  postMoneyValuation: '6000000',
  commitmentCount: 3,
  shareClass: {
    id: 'sc-1',
    className: 'Ordinária',
    type: 'COMMON_SHARES',
  },
};

const mockCommitments = [
  {
    id: 'c-1',
    roundId: 'round-123',
    shareholderId: 'sh-1',
    amount: '200000',
    sharesAllocated: '20000',
    paymentStatus: 'CONFIRMED' as const,
    paymentConfirmedAt: '2026-02-20T10:00:00.000Z',
    hasSideLetter: false,
    notes: null,
    createdAt: '2026-02-16T10:00:00.000Z',
    updatedAt: '2026-02-20T10:00:00.000Z',
    shareholder: { id: 'sh-1', name: 'João Silva', type: 'INVESTOR' },
  },
  {
    id: 'c-2',
    roundId: 'round-123',
    shareholderId: 'sh-2',
    amount: '100000',
    sharesAllocated: null,
    paymentStatus: 'PENDING' as const,
    paymentConfirmedAt: null,
    hasSideLetter: true,
    notes: null,
    createdAt: '2026-02-17T10:00:00.000Z',
    updatedAt: '2026-02-17T10:00:00.000Z',
    shareholder: { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR' },
  },
  {
    id: 'c-3',
    roundId: 'round-123',
    shareholderId: 'sh-3',
    amount: '50000',
    sharesAllocated: null,
    paymentStatus: 'RECEIVED' as const,
    paymentConfirmedAt: null,
    hasSideLetter: false,
    notes: null,
    createdAt: '2026-02-18T10:00:00.000Z',
    updatedAt: '2026-02-19T10:00:00.000Z',
    shareholder: { id: 'sh-3', name: 'Fund ABC', type: 'CORPORATE' },
  },
];

let mockUseFundingRound = jest.fn(() => ({
  data: mockRound,
  isLoading: false,
  error: null,
}));

let mockUseRoundCommitments = jest.fn(() => ({
  data: { data: mockCommitments, meta: { total: 3, page: 1, limit: 20, totalPages: 1 } },
  isLoading: false,
  error: null,
}));

let mockUseRoundProForma = jest.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}));

let mockUseShareholders = jest.fn(() => ({
  data: {
    data: [
      { id: 'sh-1', name: 'João Silva', type: 'INVESTOR' },
      { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR' },
    ],
    meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
  },
  isLoading: false,
  error: null,
}));

const mockOpenMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockCloseMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockCancelMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockAddCommitmentMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockConfirmPaymentMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockCancelCommitmentMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};

jest.mock('@/hooks/use-funding-rounds', () => ({
  useFundingRound: (...args: unknown[]) => mockUseFundingRound(...args),
  useOpenFundingRound: () => mockOpenMutation,
  useCloseFundingRound: () => mockCloseMutation,
  useCancelFundingRound: () => mockCancelMutation,
  useRoundCommitments: (...args: unknown[]) => mockUseRoundCommitments(...args),
  useAddCommitment: () => mockAddCommitmentMutation,
  useConfirmPayment: () => mockConfirmPaymentMutation,
  useCancelCommitment: () => mockCancelCommitmentMutation,
  useRoundProForma: (...args: unknown[]) => mockUseRoundProForma(...args),
}));

jest.mock('@/hooks/use-shareholders', () => ({
  useShareholders: (...args: unknown[]) => mockUseShareholders(...args),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}));

// --- Test helpers ---

function renderPage() {
  return render(<FundingRoundDetailPage />);
}

// --- Tests ---

describe('FundingRoundDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCompany = jest.fn(() => ({
      selectedCompany: mockCompany,
      isLoading: false,
      companies: [mockCompany],
      selectCompany: jest.fn(),
    }));
    mockUseFundingRound = jest.fn(() => ({
      data: mockRound,
      isLoading: false,
      error: null,
    }));
    mockUseRoundCommitments = jest.fn(() => ({
      data: { data: mockCommitments, meta: { total: 3, page: 1, limit: 20, totalPages: 1 } },
      isLoading: false,
      error: null,
    }));
    mockUseRoundProForma = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    }));
    mockUseShareholders = jest.fn(() => ({
      data: {
        data: [
          { id: 'sh-1', name: 'João Silva', type: 'INVESTOR' },
          { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR' },
        ],
        meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    }));
    mockOpenMutation.mutateAsync.mockResolvedValue({});
    mockCloseMutation.mutateAsync.mockResolvedValue({});
    mockCancelMutation.mutateAsync.mockResolvedValue({});
    mockAddCommitmentMutation.mutateAsync.mockResolvedValue({});
    mockConfirmPaymentMutation.mutateAsync.mockResolvedValue({});
    mockCancelCommitmentMutation.mutateAsync.mockResolvedValue({});
  });

  // --- State tests ---

  it('renders no-company state when no company selected', () => {
    mockUseCompany = jest.fn(() => ({
      selectedCompany: null,
      isLoading: false,
      companies: [],
      selectCompany: jest.fn(),
    }));
    renderPage();
    expect(screen.getByText('Nenhuma rodada de investimento registrada.')).toBeInTheDocument();
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }));
    renderPage();
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders loading skeleton when company is loading', () => {
    mockUseCompany = jest.fn(() => ({
      selectedCompany: null,
      isLoading: true,
      companies: [],
      selectCompany: jest.fn(),
    }));
    renderPage();
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders error state on fetch error', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: undefined,
      isLoading: false,
      error: new Error('Fetch failed'),
    }));
    renderPage();
    expect(screen.getByText('Erro ao carregar rodada')).toBeInTheDocument();
    expect(screen.getByText('Voltar para Rodadas')).toBeInTheDocument();
  });

  it('renders not-found state when round is null', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Rodada não encontrada')).toBeInTheDocument();
    expect(screen.getByText('A rodada solicitada não existe ou foi removida.')).toBeInTheDocument();
  });

  // --- Happy path rendering ---

  it('renders round name and badges', () => {
    renderPage();
    expect(screen.getByText('Seed Round')).toBeInTheDocument();
    expect(screen.getByText('Seed')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
  });

  it('renders back link to funding rounds list', () => {
    renderPage();
    const backLink = screen.getByText('Voltar para Rodadas');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/funding-rounds');
  });

  it('renders stat cards with correct values', () => {
    renderPage();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('Captado')).toBeInTheDocument();
    expect(screen.getByText('Investidores')).toBeInTheDocument();
    expect(screen.getByText('Preço por Ação')).toBeInTheDocument();
    // Commitment count
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders currency values in BRL pt-BR format', () => {
    renderPage();
    const body = document.body.textContent ?? '';
    // targetAmount = 1000000 → R$ 1.000.000,00
    expect(body).toMatch(/R\$\s*1\.000\.000,00/);
    // currentAmount = 350000 → R$ 350.000,00
    expect(body).toMatch(/R\$\s*350\.000,00/);
    // pricePerShare = 10.00 → R$ 10,00
    expect(body).toMatch(/R\$\s*10,00/);
  });

  it('renders progress bar', () => {
    renderPage();
    expect(screen.getByText('Progresso')).toBeInTheDocument();
    // Progress shows current / target
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/R\$\s*350\.000,00/);
  });

  it('renders three tab buttons', () => {
    renderPage();
    expect(screen.getByText('Compromissos')).toBeInTheDocument();
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
    expect(screen.getByText('Pro-Forma')).toBeInTheDocument();
  });

  it('renders timeline section', () => {
    renderPage();
    expect(screen.getByText('Rodada criada')).toBeInTheDocument();
    expect(screen.getByText('Rodada aberta')).toBeInTheDocument();
  });

  // --- Commitments tab ---

  it('renders commitment table with investor data', () => {
    renderPage();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Fund ABC')).toBeInTheDocument();
  });

  it('renders payment status badges for commitments', () => {
    renderPage();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Recebido')).toBeInTheDocument();
  });

  it('renders commitment amounts in BRL format', () => {
    renderPage();
    const body = document.body.textContent ?? '';
    // c-1 amount = 200000 → R$ 200.000,00
    expect(body).toMatch(/R\$\s*200\.000,00/);
    // c-2 amount = 100000 → R$ 100.000,00
    expect(body).toMatch(/R\$\s*100\.000,00/);
  });

  it('renders shares allocated when present', () => {
    renderPage();
    // c-1 has 20000 shares → 20.000
    expect(screen.getByText('20.000')).toBeInTheDocument();
  });

  it('shows empty commitments state when no commitments', () => {
    mockUseRoundCommitments = jest.fn(() => ({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Nenhum compromisso registrado.')).toBeInTheDocument();
  });

  it('shows add commitment button in empty state when round is OPEN', () => {
    mockUseRoundCommitments = jest.fn(() => ({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // Two "Adicionar Compromisso" buttons: header + empty state CTA
    const addButtons = screen.getAllByText('Adicionar Compromisso');
    expect(addButtons.length).toBeGreaterThanOrEqual(2);
  });

  // --- Action buttons by status ---

  it('shows Open button for DRAFT status', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: { ...mockRound, status: 'DRAFT' as const, openedAt: null },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Abrir Rodada')).toBeInTheDocument();
    expect(screen.getByText('Cancelar Rodada')).toBeInTheDocument();
  });

  it('shows Add Commitment, Close, and Cancel buttons for OPEN status', () => {
    renderPage();
    expect(screen.getAllByText('Adicionar Compromisso').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Fechar Rodada')).toBeInTheDocument();
    expect(screen.getByText('Cancelar Rodada')).toBeInTheDocument();
  });

  it('shows no action buttons for CLOSED status', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: {
        ...mockRound,
        status: 'CLOSED' as const,
        closedAt: '2026-03-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Abrir Rodada')).not.toBeInTheDocument();
    expect(screen.queryByText('Fechar Rodada')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar Rodada')).not.toBeInTheDocument();
  });

  it('shows no action buttons for CANCELLED status', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: {
        ...mockRound,
        status: 'CANCELLED' as const,
        cancelledAt: '2026-03-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Abrir Rodada')).not.toBeInTheDocument();
    expect(screen.queryByText('Fechar Rodada')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar Rodada')).not.toBeInTheDocument();
  });

  // --- Open round action flow ---

  it('opens the open dialog and calls open mutation', async () => {
    const user = userEvent.setup();
    mockUseFundingRound = jest.fn(() => ({
      data: { ...mockRound, status: 'DRAFT' as const, openedAt: null },
      isLoading: false,
      error: null,
    }));
    renderPage();

    await user.click(screen.getByText('Abrir Rodada'));

    // Dialog should appear
    expect(screen.getByText('Após abrir, investidores poderão realizar compromissos.')).toBeInTheDocument();

    // Click confirm in dialog
    const dialogButtons = screen.getAllByText('Abrir Rodada');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockOpenMutation.mutateAsync).toHaveBeenCalledWith('round-123');
  });

  // --- Close round action flow ---

  it('opens the close dialog and calls close mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Fechar Rodada'));

    expect(screen.getByText('Ao fechar, as ações serão emitidas para os investidores.')).toBeInTheDocument();

    const dialogButtons = screen.getAllByText('Fechar Rodada');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockCloseMutation.mutateAsync).toHaveBeenCalledWith('round-123');
  });

  // --- Cancel round action flow ---

  it('opens the cancel dialog and calls cancel mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cancelar Rodada'));

    expect(screen.getByText('Esta ação cancelará a rodada permanentemente.')).toBeInTheDocument();

    const dialogButtons = screen.getAllByText('Cancelar Rodada');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockCancelMutation.mutateAsync).toHaveBeenCalledWith('round-123');
  });

  it('closes dialog when Cancel button in dialog is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cancelar Rodada'));
    expect(screen.getByText('Esta ação cancelará a rodada permanentemente.')).toBeInTheDocument();

    // Click Cancel button (not confirm) in dialog
    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Esta ação cancelará a rodada permanentemente.')).not.toBeInTheDocument();
  });

  // --- Commitment action flows ---

  it('shows Mark Received button for PENDING commitment when round is OPEN', () => {
    renderPage();
    // Maria Santos has PENDING status
    const markReceivedButtons = screen.getAllByText('Marcar Recebido');
    expect(markReceivedButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Confirm Payment button for PENDING/RECEIVED commitments when round is OPEN', () => {
    renderPage();
    const confirmButtons = screen.getAllByText('Confirmar Pagamento');
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens cancel commitment dialog and calls cancel mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    // Find a cancel commitment button (for Maria Santos, PENDING)
    const cancelButtons = screen.getAllByText('Cancelar Compromisso');
    await user.click(cancelButtons[0]);

    expect(screen.getByText('Esta ação cancelará o compromisso do investidor.')).toBeInTheDocument();

    // Confirm in dialog
    const dialogButtons = screen.getAllByText('Cancelar Compromisso');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockCancelCommitmentMutation.mutateAsync).toHaveBeenCalled();
  });

  it('opens mark received dialog and calls confirm payment mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    const markReceivedButtons = screen.getAllByText('Marcar Recebido');
    await user.click(markReceivedButtons[0]);

    // Confirm in dialog
    const dialogButtons = screen.getAllByText('Marcar Recebido');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockConfirmPaymentMutation.mutateAsync).toHaveBeenCalledWith({
      commitmentId: expect.any(String),
      paymentStatus: 'RECEIVED',
    });
  });

  it('opens confirm payment dialog and calls confirm payment mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    const confirmButtons = screen.getAllByText('Confirmar Pagamento');
    await user.click(confirmButtons[0]);

    // Confirm in dialog
    const dialogButtons = screen.getAllByText('Confirmar Pagamento');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockConfirmPaymentMutation.mutateAsync).toHaveBeenCalledWith({
      commitmentId: expect.any(String),
      paymentStatus: 'CONFIRMED',
    });
  });

  // --- Details tab ---

  it('renders details tab with round info', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Detalhes'));

    expect(screen.getByText('Nome da Rodada')).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Classe de Ações')).toBeInTheDocument();
    expect(screen.getByText('Valuation Pré-Money')).toBeInTheDocument();
    expect(screen.getByText('Ordinária')).toBeInTheDocument();
  });

  it('renders timestamps in details tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Detalhes'));

    expect(screen.getByText('Criado em')).toBeInTheDocument();
    expect(screen.getByText('Aberto em')).toBeInTheDocument();
  });

  it('renders notes when present', async () => {
    const user = userEvent.setup();
    mockUseFundingRound = jest.fn(() => ({
      data: { ...mockRound, notes: 'Investment terms apply' },
      isLoading: false,
      error: null,
    }));
    renderPage();

    await user.click(screen.getByText('Detalhes'));

    expect(screen.getByText('Investment terms apply')).toBeInTheDocument();
  });

  // --- Pro-Forma tab ---

  it('renders pro-forma empty state when no data', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Pro-Forma'));

    expect(screen.getByText('Nenhum dado pro-forma disponível.')).toBeInTheDocument();
  });

  it('renders pro-forma table with data', async () => {
    const user = userEvent.setup();
    mockUseRoundProForma = jest.fn(() => ({
      data: {
        beforeRound: {
          totalShares: '100000',
          shareholders: [
            { shareholderId: 'sh-1', name: 'João Silva', shares: '50000', percentage: '50.0' },
            { shareholderId: 'sh-2', name: 'Maria Santos', shares: '50000', percentage: '50.0' },
          ],
        },
        afterRound: {
          totalShares: '150000',
          shareholders: [
            { shareholderId: 'sh-1', name: 'João Silva', shares: '50000', percentage: '33.3' },
            { shareholderId: 'sh-2', name: 'Maria Santos', shares: '50000', percentage: '33.3' },
            { shareholderId: 'sh-3', name: 'New Investor', shares: '50000', percentage: '33.3' },
          ],
        },
        dilution: {
          'sh-1': { before: '50.0', after: '33.3', change: '-16.7' },
          'sh-2': { before: '50.0', after: '33.3', change: '-16.7' },
        },
      },
      isLoading: false,
      error: null,
    }));
    renderPage();

    await user.click(screen.getByText('Pro-Forma'));

    expect(screen.getByText('Acionista')).toBeInTheDocument();
    expect(screen.getByText('Antes')).toBeInTheDocument();
    expect(screen.getByText('Depois')).toBeInTheDocument();
    expect(screen.getByText('Variação')).toBeInTheDocument();
  });

  // --- Timeline rendering ---

  it('renders timeline for OPEN round with pending close', () => {
    renderPage();
    expect(screen.getByText('Rodada criada')).toBeInTheDocument();
    expect(screen.getByText('Rodada aberta')).toBeInTheDocument();
    // Pending close step
    expect(screen.getByText('Rodada fechada')).toBeInTheDocument();
  });

  it('renders timeline for CLOSED round', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: {
        ...mockRound,
        status: 'CLOSED' as const,
        closedAt: '2026-03-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Rodada criada')).toBeInTheDocument();
    expect(screen.getByText('Rodada aberta')).toBeInTheDocument();
    expect(screen.getByText('Rodada fechada')).toBeInTheDocument();
  });

  it('renders timeline for CANCELLED round', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: {
        ...mockRound,
        status: 'CANCELLED' as const,
        cancelledAt: '2026-03-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Rodada criada')).toBeInTheDocument();
    expect(screen.getByText('Rodada aberta')).toBeInTheDocument();
    expect(screen.getByText('Rodada cancelada')).toBeInTheDocument();
  });

  it('renders timeline for DRAFT round with pending open', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: { ...mockRound, status: 'DRAFT' as const, openedAt: null },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Rodada criada')).toBeInTheDocument();
    expect(screen.getByText('Rodada aberta')).toBeInTheDocument();
  });

  // --- Hook calls ---

  it('passes correct roundId to useFundingRound hook', () => {
    renderPage();
    expect(mockUseFundingRound).toHaveBeenCalledWith('company-1', 'round-123');
  });

  it('passes correct params to useRoundCommitments hook', () => {
    renderPage();
    expect(mockUseRoundCommitments).toHaveBeenCalledWith(
      'company-1',
      'round-123',
      { page: 1, limit: 20 },
    );
  });

  // --- Add Commitment modal ---

  it('opens add commitment modal when button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    // Click the "Adicionar Compromisso" button in the header
    const addButtons = screen.getAllByText('Adicionar Compromisso');
    await user.click(addButtons[0]);

    expect(screen.getByText('Selecione o investidor e o valor do compromisso.')).toBeInTheDocument();
    expect(screen.getByText('Selecione o investidor')).toBeInTheDocument();
  });

  it('does not show add commitment button for CLOSED round', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: {
        ...mockRound,
        status: 'CLOSED' as const,
        closedAt: '2026-03-01T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    // Empty commitments to ensure we don't get an empty-state CTA
    mockUseRoundCommitments = jest.fn(() => ({
      data: { data: mockCommitments, meta: { total: 3, page: 1, limit: 20, totalPages: 1 } },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Adicionar Compromisso')).not.toBeInTheDocument();
  });

  // --- Minimum close marker on progress bar ---

  it('renders minimum close marker when minimumCloseAmount is set', () => {
    renderPage();
    const body = document.body.textContent ?? '';
    // minimumCloseAmount = 500000 → "Mínimo para fechar: R$ 500.000,00"
    expect(body).toMatch(/Mínimo para fechar/);
    expect(body).toMatch(/R\$\s*500\.000,00/);
  });

  // --- Status badge for different round types ---

  it('renders PRE_SEED type badge', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: { ...mockRound, roundType: 'PRE_SEED' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Pré-Seed')).toBeInTheDocument();
  });

  it('renders SERIES_A type badge', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: { ...mockRound, roundType: 'SERIES_A' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Série A')).toBeInTheDocument();
  });

  it('renders BRIDGE type badge', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: { ...mockRound, roundType: 'BRIDGE' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Bridge')).toBeInTheDocument();
  });

  // --- Commitment actions not shown for CONFIRMED commitments ---

  it('does not show Mark Received for CONFIRMED commitment', () => {
    // Only CONFIRMED commitment (c-1 João Silva) — remove others
    mockUseRoundCommitments = jest.fn(() => ({
      data: {
        data: [mockCommitments[0]], // Only CONFIRMED
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Marcar Recebido')).not.toBeInTheDocument();
  });

  // --- Error link href ---

  it('renders error state back link with correct href', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: undefined,
      isLoading: false,
      error: new Error('Error'),
    }));
    renderPage();
    const backLink = screen.getByText('Voltar para Rodadas');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/funding-rounds');
  });

  // --- Not found back link ---

  it('renders not-found state back link with correct href', () => {
    mockUseFundingRound = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    }));
    renderPage();
    const backLink = screen.getByText('Voltar para Rodadas');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/funding-rounds');
  });
});
