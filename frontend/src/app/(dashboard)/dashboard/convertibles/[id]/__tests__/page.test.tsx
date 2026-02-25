import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConvertibleDetailPage from '../page';

// --- Translation mocks ---

const convertiblesTranslations: Record<string, string> = {
  'instrumentType.mutuoConversivel': 'Mútuo Conversível',
  'instrumentType.investimentoAnjo': 'Investimento Anjo',
  'instrumentType.misto': 'Misto',
  'instrumentType.mais': 'MAIS',
  'status.outstanding': 'Em Aberto',
  'status.converted': 'Convertido',
  'status.redeemed': 'Resgatado',
  'status.matured': 'Vencido',
  'status.cancelled': 'Cancelado',
  'interestType.simple': 'Simples',
  'interestType.compound': 'Composto',
  'conversionTriggerType.qualifiedFinancing': 'Financiamento Qualificado',
  'conversionTriggerType.maturity': 'Vencimento',
  'conversionTriggerType.changeOfControl': 'Mudança de Controle',
  'conversionTriggerType.investorOption': 'Opção do Investidor',
  'detail.back': 'Voltar para Conversíveis',
  'detail.title': 'Detalhe do Instrumento',
  'detail.error': 'Erro ao carregar instrumento',
  'detail.notFound': 'Instrumento não encontrado',
  'detail.notFoundDescription': 'O instrumento solicitado não existe ou foi removido.',
  'detail.summary': 'Resumo',
  'detail.investor': 'Investidor',
  'detail.type': 'Tipo de Instrumento',
  'detail.status': 'Status',
  'detail.principalAmount': 'Valor Principal',
  'detail.interestRate': 'Taxa de Juros',
  'detail.interestType': 'Tipo de Juros',
  'detail.issueDate': 'Data de Emissão',
  'detail.maturityDate': 'Data de Vencimento',
  'detail.notes': 'Observações',
  'detail.conversionTerms': 'Termos de Conversão',
  'detail.discountRate': 'Taxa de Desconto',
  'detail.valuationCap': 'Valuation Cap',
  'detail.qualifiedFinancing': 'Financiamento Qualificado',
  'detail.conversionTrigger': 'Gatilho de Conversão',
  'detail.targetShareClass': 'Classe de Ações Alvo',
  'detail.autoConvert': 'Conversão Automática',
  'detail.mfnClause': 'Cláusula MFN',
  'detail.metadata': 'Informações',
  'detail.createdAt': 'Criado em',
  'detail.convertedAt': 'Convertido em',
  'detail.redeemedAt': 'Resgatado em',
  'detail.cancelledAt': 'Cancelado em',
  'detail.conversionData': 'Dados da Conversão',
  'detail.conversionAmount': 'Valor da Conversão',
  'detail.conversionPrice': 'Preço de Conversão',
  'detail.sharesIssued': 'Ações Emitidas',
  'detail.methodUsed': 'Método Utilizado',
  'detail.maturityWarning': 'Este instrumento vence em {days} dias ({date})',
  'detail.maturityExpired': 'Este instrumento venceu em {date}',
  'detail.detailsTab': 'Detalhes',
  'detail.interestTab': 'Juros',
  'detail.scenariosTab': 'Cenários',
  'detail.cancelButton': 'Cancelar Instrumento',
  'detail.cancelTitle': 'Cancelar Instrumento',
  'detail.cancelDescription': 'Tem certeza que deseja cancelar este instrumento? Esta ação não pode ser desfeita.',
  'detail.redeemButton': 'Resgatar',
  'detail.redeemTitle': 'Resgatar Instrumento',
  'detail.redeemDescription': 'Registre o resgate deste instrumento conversível.',
  'detail.redemptionAmount': 'Valor do Resgate (R$)',
  'detail.redemptionAmountPlaceholder': '0,00',
  'detail.paymentReference': 'Referência de Pagamento',
  'detail.paymentReferencePlaceholder': 'Ex: TED 12345',
  'detail.statsPrincipal': 'Principal',
  'detail.statsInterest': 'Juros Acumulados',
  'detail.statsTotal': 'Valor Total',
  'detail.statsMaturity': 'Dias p/ Vencimento',
  'detail.interestTitle': 'Evolução dos Juros',
  'detail.interestPeriod': 'Período',
  'detail.interestDays': 'Dias',
  'detail.interestAccrued': 'Juros no Período',
  'detail.interestCumulative': 'Total Acumulado',
  'detail.interestDaysElapsed': 'Dias Decorridos',
  'detail.interestCalculationDate': 'Data do Cálculo',
  'detail.interestEmpty': 'Nenhum dado de juros disponível.',
  'detail.scenariosDescription': 'Simule a conversão em diferentes valuations para entender o impacto na diluição.',
  'detail.scenariosValuation': 'Valuation',
  'detail.scenariosRoundPrice': 'Preço da Rodada',
  'detail.scenariosDiscount': 'Método Desconto',
  'detail.scenariosCap': 'Método Cap',
  'detail.scenariosBestMethod': 'Melhor Método',
  'detail.scenariosShares': 'Ações',
  'detail.scenariosOwnership': 'Participação',
  'detail.scenariosDilution': 'Diluição',
  'detail.scenariosConversionAmount': 'Valor para Conversão',
  'detail.scenariosCapTrigger': 'Cap é melhor acima de',
  'detail.scenariosEmpty': 'Nenhum cenário disponível.',
  'detail.yes': 'Sim',
  'detail.no': 'Não',
  'detail.expired': 'Vencido',
  'detail.days': '{count} dias',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const translations: Record<string, Record<string, string>> = {
      convertibles: convertiblesTranslations,
    };
    return (key: string, params?: Record<string, unknown>) => {
      let result = translations[namespace]?.[key] ?? `${namespace}.${key}`;
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

const mockParams = { id: 'conv-123' };
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

// --- Company context mock ---

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

// --- Error toast mock ---

const mockShowErrorToast = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => mockShowErrorToast,
}));

// --- Convertible hooks mock ---

// Set maturity far in the future so no warning shows by default
const futureMaturity = new Date();
futureMaturity.setFullYear(futureMaturity.getFullYear() + 2);

const mockInstrument = {
  id: 'conv-123',
  companyId: 'company-1',
  shareholderId: 'sh-1',
  instrumentType: 'MUTUO_CONVERSIVEL' as const,
  status: 'OUTSTANDING' as const,
  principalAmount: '500000',
  interestRate: '0.08',
  interestType: 'SIMPLE' as const,
  accruedInterest: '12500.50',
  valuationCap: '10000000',
  discountRate: '0.20',
  qualifiedFinancingThreshold: '1000000',
  conversionTrigger: 'QUALIFIED_FINANCING' as const,
  targetShareClassId: 'sc-1',
  autoConvert: true,
  mfnClause: false,
  issueDate: '2025-06-15T00:00:00.000Z',
  maturityDate: futureMaturity.toISOString(),
  convertedAt: null,
  redeemedAt: null,
  cancelledAt: null,
  conversionData: null,
  notes: 'Test notes here',
  createdBy: 'user-1',
  createdAt: '2025-06-15T10:00:00.000Z',
  updatedAt: '2026-02-20T12:00:00.000Z',
  shareholder: { id: 'sh-1', name: 'João Investidor', type: 'INVESTOR' },
  targetShareClass: { id: 'sc-1', className: 'Ordinária', type: 'COMMON_SHARES' },
};

const mockInterest = {
  convertibleId: 'conv-123',
  principalAmount: '500000',
  interestRate: '0.08',
  interestType: 'SIMPLE',
  issueDate: '2025-06-15T00:00:00.000Z',
  calculationDate: '2026-02-25T12:00:00.000Z',
  daysElapsed: 255,
  accruedInterest: '27945.21',
  totalValue: '527945.21',
  interestBreakdown: [
    { period: '2025-H2', days: 169, interestAccrued: '18520.55' },
    { period: '2026-H1', days: 86, interestAccrued: '9424.66' },
  ],
};

const mockScenarios = {
  convertibleId: 'conv-123',
  currentConversionAmount: '527945.21',
  summary: {
    valuationCap: '10000000',
    discountRate: '0.20',
    capTriggersAbove: '12500000',
  },
  scenarios: [
    {
      hypotheticalValuation: '8000000',
      preMoneyShares: 1000000,
      roundPricePerShare: '8.00',
      discountMethod: { conversionPrice: '6.40', sharesIssued: '82491', ownershipPercentage: '7.62' },
      capMethod: { conversionPrice: '10.00', sharesIssued: '52795', ownershipPercentage: '5.01' },
      bestMethod: 'DISCOUNT' as const,
      finalConversionPrice: '6.40',
      finalSharesIssued: '82491',
      finalOwnershipPercentage: '7.62%',
      dilutionToExisting: '7.08%',
    },
    {
      hypotheticalValuation: '15000000',
      preMoneyShares: 1000000,
      roundPricePerShare: '15.00',
      discountMethod: { conversionPrice: '12.00', sharesIssued: '43996', ownershipPercentage: '4.21' },
      capMethod: { conversionPrice: '10.00', sharesIssued: '52795', ownershipPercentage: '5.01' },
      bestMethod: 'CAP' as const,
      finalConversionPrice: '10.00',
      finalSharesIssued: '52795',
      finalOwnershipPercentage: '5.01%',
      dilutionToExisting: '5.01%',
    },
  ],
};

let mockUseConvertible = jest.fn(() => ({
  data: mockInstrument,
  isLoading: false,
  error: null,
}));

let mockUseConvertibleInterest = jest.fn(() => ({
  data: mockInterest,
  isLoading: false,
  error: null,
}));

let mockUseConvertibleScenarios = jest.fn(() => ({
  data: mockScenarios,
  isLoading: false,
  error: null,
}));

const mockCancelMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};

const mockRedeemMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};

jest.mock('@/hooks/use-convertibles', () => ({
  useConvertible: (...args: unknown[]) => mockUseConvertible(...args),
  useConvertibleInterest: (...args: unknown[]) => mockUseConvertibleInterest(...args),
  useConvertibleScenarios: (...args: unknown[]) => mockUseConvertibleScenarios(...args),
  useCancelConvertible: () => mockCancelMutation,
  useRedeemConvertible: () => mockRedeemMutation,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}));

// --- Test helpers ---

function renderPage() {
  return render(<ConvertibleDetailPage />);
}

// --- Tests ---

describe('ConvertibleDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCompany = jest.fn(() => ({
      selectedCompany: mockCompany,
      isLoading: false,
      companies: [mockCompany],
      selectCompany: jest.fn(),
    }));
    mockUseConvertible = jest.fn(() => ({
      data: mockInstrument,
      isLoading: false,
      error: null,
    }));
    mockUseConvertibleInterest = jest.fn(() => ({
      data: mockInterest,
      isLoading: false,
      error: null,
    }));
    mockUseConvertibleScenarios = jest.fn(() => ({
      data: mockScenarios,
      isLoading: false,
      error: null,
    }));
    mockCancelMutation.mutateAsync.mockResolvedValue({});
    mockCancelMutation.isPending = false;
    mockRedeemMutation.mutateAsync.mockResolvedValue({});
    mockRedeemMutation.isPending = false;
  });

  // --- State tests ---

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

  it('renders loading skeleton when no company selected', () => {
    mockUseCompany = jest.fn(() => ({
      selectedCompany: null,
      isLoading: false,
      companies: [],
      selectCompany: jest.fn(),
    }));
    renderPage();
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseConvertible = jest.fn(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }));
    renderPage();
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders error state on fetch error', () => {
    mockUseConvertible = jest.fn(() => ({
      data: undefined,
      isLoading: false,
      error: new Error('Fetch failed'),
    }));
    renderPage();
    expect(screen.getByText('Erro ao carregar instrumento')).toBeInTheDocument();
    expect(screen.getByText('Voltar para Conversíveis')).toBeInTheDocument();
  });

  it('renders not-found state when instrument is null', () => {
    mockUseConvertible = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Instrumento não encontrado')).toBeInTheDocument();
    expect(screen.getByText('O instrumento solicitado não existe ou foi removido.')).toBeInTheDocument();
  });

  // --- Happy path rendering ---

  it('renders page title and badges', () => {
    renderPage();
    expect(screen.getByText('Detalhe do Instrumento')).toBeInTheDocument();
    // Type badge appears in header + details tab InfoRow
    expect(screen.getAllByText('Mútuo Conversível').length).toBeGreaterThanOrEqual(1);
    // Status badge appears in header + details tab InfoRow
    expect(screen.getAllByText('Em Aberto').length).toBeGreaterThanOrEqual(1);
  });

  it('renders investor name below title', () => {
    renderPage();
    // Investor name appears below title + in InfoRow
    expect(screen.getAllByText('João Investidor').length).toBeGreaterThanOrEqual(1);
  });

  it('renders back link to convertibles list', () => {
    renderPage();
    const backLink = screen.getByText('Voltar para Conversíveis');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/convertibles');
  });

  it('renders stat cards with correct labels', () => {
    renderPage();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getAllByText('Juros Acumulados').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Valor Total').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dias p/ Vencimento')).toBeInTheDocument();
  });

  it('renders principal amount in BRL format', () => {
    renderPage();
    const body = document.body.textContent ?? '';
    // principalAmount = 500000 → R$ 500.000,00
    expect(body).toMatch(/R\$\s*500\.000,00/);
  });

  it('renders three tab buttons', () => {
    renderPage();
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
    expect(screen.getByText('Juros')).toBeInTheDocument();
    expect(screen.getByText('Cenários')).toBeInTheDocument();
  });

  // --- Details tab content ---

  it('renders summary section with investor and instrument details', () => {
    renderPage();
    expect(screen.getByText('Resumo')).toBeInTheDocument();
    expect(screen.getByText('Investidor')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Instrumento')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Valor Principal')).toBeInTheDocument();
    expect(screen.getByText('Taxa de Juros')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Juros')).toBeInTheDocument();
    expect(screen.getByText('Data de Emissão')).toBeInTheDocument();
    expect(screen.getByText('Data de Vencimento')).toBeInTheDocument();
  });

  it('renders notes when present', () => {
    renderPage();
    expect(screen.getByText('Test notes here')).toBeInTheDocument();
  });

  it('renders conversion terms when available', () => {
    renderPage();
    expect(screen.getByText('Termos de Conversão')).toBeInTheDocument();
    expect(screen.getByText('Taxa de Desconto')).toBeInTheDocument();
    expect(screen.getByText('Valuation Cap')).toBeInTheDocument();
    // "Financiamento Qualificado" appears as both the label and the trigger value
    expect(screen.getAllByText('Financiamento Qualificado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Gatilho de Conversão')).toBeInTheDocument();
    expect(screen.getByText('Classe de Ações Alvo')).toBeInTheDocument();
    expect(screen.getByText('Ordinária')).toBeInTheDocument();
  });

  it('renders auto convert and MFN clause values', () => {
    renderPage();
    expect(screen.getByText('Conversão Automática')).toBeInTheDocument();
    expect(screen.getByText('Cláusula MFN')).toBeInTheDocument();
    // autoConvert=true → Sim, mfnClause=false → Não
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
  });

  it('renders metadata section with createdAt', () => {
    renderPage();
    expect(screen.getByText('Informações')).toBeInTheDocument();
    expect(screen.getByText('Criado em')).toBeInTheDocument();
  });

  it('renders interest type labels', () => {
    renderPage();
    expect(screen.getByText('Simples')).toBeInTheDocument();
  });

  it('does not render conversion terms when not set', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        discountRate: null,
        valuationCap: null,
        conversionTrigger: null,
        qualifiedFinancingThreshold: null,
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Termos de Conversão')).not.toBeInTheDocument();
  });

  // --- Action buttons by status ---

  it('shows Cancel and Redeem buttons for OUTSTANDING status', () => {
    renderPage();
    expect(screen.getByText('Cancelar Instrumento')).toBeInTheDocument();
    expect(screen.getByText('Resgatar')).toBeInTheDocument();
  });

  it('shows Cancel and Redeem buttons for MATURED status', () => {
    const maturedDate = new Date();
    maturedDate.setFullYear(maturedDate.getFullYear() - 1);
    mockUseConvertible = jest.fn(() => ({
      data: { ...mockInstrument, status: 'MATURED' as const, maturityDate: maturedDate.toISOString() },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Cancelar Instrumento')).toBeInTheDocument();
    expect(screen.getByText('Resgatar')).toBeInTheDocument();
  });

  it('does not show action buttons for CONVERTED status', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'CONVERTED' as const,
        convertedAt: '2026-02-20T10:00:00.000Z',
        conversionData: {
          conversionAmount: '527945.21',
          conversionPricePerShare: '6.40',
          sharesIssued: 82491,
          methodUsed: 'DISCOUNT',
        },
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Cancelar Instrumento')).not.toBeInTheDocument();
    expect(screen.queryByText('Resgatar')).not.toBeInTheDocument();
  });

  it('does not show action buttons for CANCELLED status', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'CANCELLED' as const,
        cancelledAt: '2026-02-20T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Cancelar Instrumento')).not.toBeInTheDocument();
    expect(screen.queryByText('Resgatar')).not.toBeInTheDocument();
  });

  it('does not show action buttons for REDEEMED status', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'REDEEMED' as const,
        redeemedAt: '2026-02-20T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Cancelar Instrumento')).not.toBeInTheDocument();
    expect(screen.queryByText('Resgatar')).not.toBeInTheDocument();
  });

  // --- Cancel action flow ---

  it('opens cancel dialog and calls cancel mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cancelar Instrumento'));

    // Dialog appears
    expect(screen.getByText('Tem certeza que deseja cancelar este instrumento? Esta ação não pode ser desfeita.')).toBeInTheDocument();

    // Click confirm button in dialog
    const confirmButtons = screen.getAllByText('Cancelar Instrumento');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(mockCancelMutation.mutateAsync).toHaveBeenCalledWith('conv-123');
  });

  it('closes cancel dialog when Cancelar button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cancelar Instrumento'));
    expect(screen.getByText('Tem certeza que deseja cancelar este instrumento? Esta ação não pode ser desfeita.')).toBeInTheDocument();

    // Click Cancel (dismiss) button in dialog
    await user.click(screen.getByText('Cancelar'));

    expect(screen.queryByText('Tem certeza que deseja cancelar este instrumento? Esta ação não pode ser desfeita.')).not.toBeInTheDocument();
  });

  it('calls showErrorToast when cancel mutation fails', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Cancel failed');
    mockCancelMutation.mutateAsync.mockRejectedValueOnce(mockError);
    renderPage();

    await user.click(screen.getByText('Cancelar Instrumento'));
    const confirmButtons = screen.getAllByText('Cancelar Instrumento');
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
  });

  // --- Redeem action flow ---

  it('opens redeem dialog with input fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Resgatar'));

    expect(screen.getByText('Resgatar Instrumento')).toBeInTheDocument();
    expect(screen.getByText('Registre o resgate deste instrumento conversível.')).toBeInTheDocument();
    expect(screen.getByText('Valor do Resgate (R$)')).toBeInTheDocument();
    expect(screen.getByText('Referência de Pagamento')).toBeInTheDocument();
  });

  it('calls redeem mutation with entered values', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Resgatar'));

    // Fill in amount
    const amountInput = screen.getByPlaceholderText('0,00');
    await user.clear(amountInput);
    await user.type(amountInput, '500000');

    // Fill in reference
    const refInput = screen.getByPlaceholderText('Ex: TED 12345');
    await user.type(refInput, 'TED-999');

    // Click confirm (the "Resgatar" button inside the dialog)
    const dialogRedeemButtons = screen.getAllByText('Resgatar');
    await user.click(dialogRedeemButtons[dialogRedeemButtons.length - 1]);

    expect(mockRedeemMutation.mutateAsync).toHaveBeenCalledWith({
      convertibleId: 'conv-123',
      data: { redemptionAmount: '500000', paymentReference: 'TED-999' },
    });
  });

  it('disables redeem confirm button when amount is empty', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Resgatar'));

    // The confirm button in dialog should be disabled (amount empty)
    const dialogRedeemButtons = screen.getAllByText('Resgatar');
    const confirmBtn = dialogRedeemButtons[dialogRedeemButtons.length - 1];
    expect(confirmBtn).toBeDisabled();
  });

  it('calls showErrorToast when redeem mutation fails', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Redeem failed');
    mockRedeemMutation.mutateAsync.mockRejectedValueOnce(mockError);
    renderPage();

    await user.click(screen.getByText('Resgatar'));
    const amountInput = screen.getByPlaceholderText('0,00');
    await user.type(amountInput, '500000');

    const dialogRedeemButtons = screen.getAllByText('Resgatar');
    await user.click(dialogRedeemButtons[dialogRedeemButtons.length - 1]);

    expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
  });

  // --- CONVERTED status shows conversion data ---

  it('renders conversion data section for CONVERTED instrument', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'CONVERTED' as const,
        convertedAt: '2026-02-20T10:00:00.000Z',
        conversionData: {
          conversionAmount: '527945.21',
          conversionPricePerShare: '6.40',
          sharesIssued: 82491,
          methodUsed: 'DISCOUNT',
        },
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Dados da Conversão')).toBeInTheDocument();
    expect(screen.getByText('Valor da Conversão')).toBeInTheDocument();
    expect(screen.getByText('Preço de Conversão')).toBeInTheDocument();
    expect(screen.getByText('Ações Emitidas')).toBeInTheDocument();
    expect(screen.getByText('Método Utilizado')).toBeInTheDocument();
    expect(screen.getByText('DISCOUNT')).toBeInTheDocument();
  });

  it('renders convertedAt timestamp in metadata for CONVERTED instrument', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'CONVERTED' as const,
        convertedAt: '2026-02-20T10:00:00.000Z',
        conversionData: { conversionAmount: '500000' },
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Convertido em')).toBeInTheDocument();
  });

  it('renders redeemedAt timestamp for REDEEMED instrument', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'REDEEMED' as const,
        redeemedAt: '2026-02-20T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Resgatado em')).toBeInTheDocument();
  });

  it('renders cancelledAt timestamp for CANCELLED instrument', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'CANCELLED' as const,
        cancelledAt: '2026-02-20T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Cancelado em')).toBeInTheDocument();
  });

  // --- Interest tab ---

  it('switches to Interest tab and shows interest data', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Juros'));

    expect(screen.getByText('Dias Decorridos')).toBeInTheDocument();
    expect(screen.getByText('255')).toBeInTheDocument();
    expect(screen.getByText('Evolução dos Juros')).toBeInTheDocument();
  });

  it('renders interest breakdown table with periods', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Juros'));

    expect(screen.getByText('Período')).toBeInTheDocument();
    expect(screen.getByText('Dias')).toBeInTheDocument();
    expect(screen.getByText('Juros no Período')).toBeInTheDocument();
    expect(screen.getByText('Total Acumulado')).toBeInTheDocument();
    expect(screen.getByText('2025-H2')).toBeInTheDocument();
    expect(screen.getByText('2026-H1')).toBeInTheDocument();
    expect(screen.getByText('169')).toBeInTheDocument();
    expect(screen.getByText('86')).toBeInTheDocument();
  });

  it('renders interest tab loading state', async () => {
    mockUseConvertibleInterest = jest.fn(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Juros'));

    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders interest tab error/empty state', async () => {
    mockUseConvertibleInterest = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: new Error('Interest error'),
    }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Juros'));

    expect(screen.getByText('Nenhum dado de juros disponível.')).toBeInTheDocument();
  });

  // --- Scenarios tab ---

  it('switches to Scenarios tab and shows scenario data', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cenários'));

    expect(screen.getByText('Valor para Conversão')).toBeInTheDocument();
    expect(screen.getByText('Cap é melhor acima de')).toBeInTheDocument();
    expect(screen.getByText('Simule a conversão em diferentes valuations para entender o impacto na diluição.')).toBeInTheDocument();
  });

  it('renders scenarios table with valuation rows', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cenários'));

    expect(screen.getByText('Valuation')).toBeInTheDocument();
    expect(screen.getByText('Preço da Rodada')).toBeInTheDocument();
    expect(screen.getByText('Método Desconto')).toBeInTheDocument();
    expect(screen.getByText('Método Cap')).toBeInTheDocument();
    expect(screen.getByText('Melhor Método')).toBeInTheDocument();
    expect(screen.getByText('Ações')).toBeInTheDocument();
    expect(screen.getByText('Participação')).toBeInTheDocument();
    expect(screen.getByText('Diluição')).toBeInTheDocument();
  });

  it('renders best method badges in scenarios', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cenários'));

    expect(screen.getByText('DISCOUNT')).toBeInTheDocument();
    expect(screen.getByText('CAP')).toBeInTheDocument();
  });

  it('renders scenarios tab loading state', async () => {
    mockUseConvertibleScenarios = jest.fn(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cenários'));

    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders scenarios tab empty state', async () => {
    mockUseConvertibleScenarios = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: new Error('Scenarios error'),
    }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cenários'));

    expect(screen.getByText('Nenhum cenário disponível.')).toBeInTheDocument();
  });

  // --- Maturity warning ---

  it('renders maturity warning when near maturity', () => {
    const nearMaturity = new Date();
    nearMaturity.setDate(nearMaturity.getDate() + 15);
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        maturityDate: nearMaturity.toISOString(),
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Este instrumento vence em/);
  });

  it('renders expired warning when maturity date has passed for OUTSTANDING', () => {
    const pastMaturity = new Date();
    pastMaturity.setDate(pastMaturity.getDate() - 5);
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'OUTSTANDING' as const,
        maturityDate: pastMaturity.toISOString(),
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Este instrumento venceu em/);
  });

  it('does not render maturity warning when far from maturity', () => {
    renderPage();
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/Este instrumento vence em/);
    expect(body).not.toMatch(/Este instrumento venceu em/);
  });

  // --- Status badges ---

  it('renders INVESTIMENTO_ANJO type badge', () => {
    mockUseConvertible = jest.fn(() => ({
      data: { ...mockInstrument, instrumentType: 'INVESTIMENTO_ANJO' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // Appears in header badge + details tab InfoRow
    expect(screen.getAllByText('Investimento Anjo').length).toBeGreaterThanOrEqual(1);
  });

  it('renders MISTO type badge', () => {
    mockUseConvertible = jest.fn(() => ({
      data: { ...mockInstrument, instrumentType: 'MISTO' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // Appears in header badge + details tab InfoRow
    expect(screen.getAllByText('Misto').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Convertido status badge', () => {
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        status: 'CONVERTED' as const,
        convertedAt: '2026-02-20T10:00:00.000Z',
        conversionData: {},
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // Appears in header badge + details tab InfoRow
    expect(screen.getAllByText('Convertido').length).toBeGreaterThanOrEqual(1);
  });

  // --- Hook calls ---

  it('passes correct params to useConvertible hook', () => {
    renderPage();
    expect(mockUseConvertible).toHaveBeenCalledWith('company-1', 'conv-123');
  });

  // --- Error/not-found back link hrefs ---

  it('renders error state back link with correct href', () => {
    mockUseConvertible = jest.fn(() => ({
      data: undefined,
      isLoading: false,
      error: new Error('Error'),
    }));
    renderPage();
    const backLink = screen.getByText('Voltar para Conversíveis');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/convertibles');
  });

  it('renders not-found state back link with correct href', () => {
    mockUseConvertible = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    }));
    renderPage();
    const backLink = screen.getByText('Voltar para Conversíveis');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/convertibles');
  });

  // --- Conversion trigger labels ---

  it('renders CHANGE_OF_CONTROL trigger label', () => {
    mockUseConvertible = jest.fn(() => ({
      data: { ...mockInstrument, conversionTrigger: 'CHANGE_OF_CONTROL' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Mudança de Controle')).toBeInTheDocument();
  });

  it('renders INVESTOR_OPTION trigger label', () => {
    mockUseConvertible = jest.fn(() => ({
      data: { ...mockInstrument, conversionTrigger: 'INVESTOR_OPTION' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Opção do Investidor')).toBeInTheDocument();
  });

  it('renders MATURITY trigger label', () => {
    mockUseConvertible = jest.fn(() => ({
      data: { ...mockInstrument, conversionTrigger: 'MATURITY' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Vencimento')).toBeInTheDocument();
  });

  // --- Days to maturity stat card ---

  it('renders expired label when instrument maturity has passed', () => {
    const pastMaturity = new Date();
    pastMaturity.setDate(pastMaturity.getDate() - 5);
    mockUseConvertible = jest.fn(() => ({
      data: {
        ...mockInstrument,
        maturityDate: pastMaturity.toISOString(),
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // The stat card should show "Vencido"
    const statCards = document.body.textContent ?? '';
    expect(statCards).toMatch(/Vencido/);
  });
});
