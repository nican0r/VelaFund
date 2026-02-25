import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionDetailPage from './page';

// --- Mocks ---

const transactionsTranslations: Record<string, string> = {
  empty: 'Nenhuma transação registrada.',
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
  'detail.back': 'Voltar para Transações',
  'detail.title': 'Detalhe da Transação',
  'detail.summary': 'Resumo da Transação',
  'detail.type': 'Tipo',
  'detail.fromShareholder': 'De (Acionista)',
  'detail.toShareholder': 'Para (Acionista)',
  'detail.shareClass': 'Classe de Ações',
  'detail.targetShareClass': 'Classe de Destino',
  'detail.quantity': 'Quantidade',
  'detail.pricePerShare': 'Preço por Ação',
  'detail.totalValue': 'Valor Total',
  'detail.splitRatio': 'Proporção do Desdobramento',
  'detail.boardApproval': 'Aprovação do Conselho',
  'detail.boardRequired': 'Necessária',
  'detail.boardNotRequired': 'Não necessária',
  'detail.notes': 'Observações',
  'detail.createdAt': 'Criado em',
  'detail.approvedAt': 'Aprovado em',
  'detail.confirmedAt': 'Confirmado em',
  'detail.cancelledAt': 'Cancelado em',
  'detail.timeline': 'Histórico de Status',
  'detail.timelineCreated': 'Transação criada',
  'detail.timelinePending': 'Aguardando aprovação',
  'detail.timelineSubmitted': 'Transação enviada',
  'detail.timelineApproved': 'Transação aprovada',
  'detail.timelineConfirmed': 'Transação confirmada',
  'detail.timelineFailed': 'Execução falhou',
  'detail.timelineCancelled': 'Transação cancelada',
  'detail.submitButton': 'Enviar para Processamento',
  'detail.submitTitle': 'Enviar Transação',
  'detail.submitDescription': 'Ao enviar, a transação será submetida.',
  'detail.approveButton': 'Aprovar',
  'detail.approveTitle': 'Aprovar Transação',
  'detail.approveDescription': 'Ao aprovar, a transação ficará pronta.',
  'detail.confirmButton': 'Confirmar e Executar',
  'detail.confirmTitle': 'Confirmar Transação',
  'detail.confirmDescription': 'Ao confirmar, o cap table será atualizado.',
  'detail.retryButton': 'Tentar Novamente',
  'detail.retryTitle': 'Tentar Novamente',
  'detail.retryDescription': 'A execução anterior falhou.',
  'detail.cancelButton': 'Cancelar Transação',
  'detail.cancelTitle': 'Cancelar Transação',
  'detail.cancelDescription': 'Esta ação não pode ser desfeita.',
  'detail.error': 'Erro ao carregar transação',
  'detail.notFound': 'Transação não encontrada',
  'detail.notFoundDescription': 'A transação solicitada não existe.',
  'detail.loading': 'Carregando transação...',
};

const commonTranslations: Record<string, string> = {
  cancel: 'Cancelar',
  save: 'Salvar',
  edit: 'Editar',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const translations: Record<string, Record<string, string>> = {
      transactions: transactionsTranslations,
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

const mockParams = { id: 'txn-123' };
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

// Transaction hooks mock
const mockTransaction = {
  id: 'txn-123',
  companyId: 'company-1',
  type: 'ISSUANCE' as const,
  status: 'DRAFT' as const,
  fromShareholder: null,
  toShareholder: { id: 'sh-1', name: 'João Silva', type: 'INDIVIDUAL' },
  shareClass: { id: 'sc-1', className: 'Ordinária', type: 'COMMON' },
  quantity: '10000',
  pricePerShare: '1.50',
  totalValue: '15000',
  notes: null,
  requiresBoardApproval: false,
  approvedBy: null,
  approvedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  confirmedAt: null,
  createdBy: 'user-1',
  createdAt: '2026-02-20T14:30:00.000Z',
  updatedAt: '2026-02-20T14:30:00.000Z',
};

let mockUseTransaction = jest.fn(() => ({
  data: mockTransaction,
  isLoading: false,
  error: null,
}));

const mockSubmitMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockApproveMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockConfirmMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};
const mockCancelMutation = {
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
};

jest.mock('@/hooks/use-transactions', () => ({
  useTransaction: (...args: unknown[]) => mockUseTransaction(...args),
  useSubmitTransaction: () => mockSubmitMutation,
  useApproveTransaction: () => mockApproveMutation,
  useConfirmTransaction: () => mockConfirmMutation,
  useCancelTransaction: () => mockCancelMutation,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}));

// --- Test helpers ---

function renderPage() {
  return render(<TransactionDetailPage />);
}

// --- Tests ---

describe('TransactionDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCompany = jest.fn(() => ({
      selectedCompany: mockCompany,
      isLoading: false,
      companies: [mockCompany],
      selectCompany: jest.fn(),
    }));
    mockUseTransaction = jest.fn(() => ({
      data: mockTransaction,
      isLoading: false,
      error: null,
    }));
    mockSubmitMutation.mutateAsync.mockResolvedValue({});
    mockApproveMutation.mutateAsync.mockResolvedValue({});
    mockConfirmMutation.mutateAsync.mockResolvedValue({});
    mockCancelMutation.mutateAsync.mockResolvedValue({});
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
    expect(screen.getByText('Nenhuma transação registrada.')).toBeInTheDocument();
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseTransaction = jest.fn(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }));
    renderPage();
    // Skeleton has animated pulse elements
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders error state on fetch error', () => {
    mockUseTransaction = jest.fn(() => ({
      data: undefined,
      isLoading: false,
      error: new Error('Fetch failed'),
    }));
    renderPage();
    expect(screen.getByText('Erro ao carregar transação')).toBeInTheDocument();
    expect(screen.getByText('Voltar para Transações')).toBeInTheDocument();
  });

  it('renders not-found state when transaction is null', () => {
    mockUseTransaction = jest.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Transação não encontrada')).toBeInTheDocument();
    expect(screen.getByText('A transação solicitada não existe.')).toBeInTheDocument();
  });

  // --- Happy path rendering ---

  it('renders transaction detail for ISSUANCE', () => {
    renderPage();
    expect(screen.getByText('Detalhe da Transação')).toBeInTheDocument();
    // Type label appears in badge + InfoRow
    expect(screen.getAllByText('Emissão').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Resumo da Transação')).toBeInTheDocument();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Ordinária')).toBeInTheDocument();
  });

  it('renders back link to transactions list', () => {
    renderPage();
    const backLink = screen.getByText('Voltar para Transações');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/transactions');
  });

  it('renders type and status badges', () => {
    renderPage();
    const badges = screen.getAllByText('Emissão');
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('renders quantity formatted as pt-BR', () => {
    renderPage();
    // 10000 formatted as pt-BR = 10.000
    expect(screen.getByText('10.000')).toBeInTheDocument();
  });

  it('renders currency formatted as BRL', () => {
    renderPage();
    // pricePerShare = 1.50 → R$ 1,50 (space may be \u00a0 or \u202f depending on Intl impl)
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/R\$\s*1,50/);
    // totalValue = 15000 → R$ 15.000,00
    expect(body).toMatch(/R\$\s*15\.000,00/);
  });

  it('renders board approval as not required', () => {
    renderPage();
    expect(screen.getByText('Aprovação do Conselho')).toBeInTheDocument();
    expect(screen.getByText('Não necessária')).toBeInTheDocument();
  });

  it('renders board approval as required when true', () => {
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, requiresBoardApproval: true },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Necessária')).toBeInTheDocument();
  });

  it('renders timeline section', () => {
    renderPage();
    expect(screen.getByText('Histórico de Status')).toBeInTheDocument();
    expect(screen.getByText('Transação criada')).toBeInTheDocument();
  });

  it('renders metadata timestamps', () => {
    renderPage();
    expect(screen.getByText('Criado em')).toBeInTheDocument();
  });

  // --- TRANSFER type rendering ---

  it('renders TRANSFER with from and to shareholders', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        type: 'TRANSFER' as const,
        fromShareholder: { id: 'sh-2', name: 'Maria Santos', type: 'INDIVIDUAL' },
        toShareholder: { id: 'sh-1', name: 'João Silva', type: 'INDIVIDUAL' },
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    // Type label appears in badge + InfoRow
    expect(screen.getAllByText('Transferência').length).toBeGreaterThanOrEqual(1);
  });

  // --- CANCELLATION type rendering ---

  it('renders CANCELLATION with from shareholder', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        type: 'CANCELLATION' as const,
        fromShareholder: { id: 'sh-1', name: 'João Silva', type: 'INDIVIDUAL' },
        toShareholder: null,
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // Type label appears in badge + InfoRow
    expect(screen.getAllByText('Cancelamento').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('João Silva')).toBeInTheDocument();
  });

  // --- SPLIT type rendering ---

  it('renders SPLIT with ratio from notes', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        type: 'SPLIT' as const,
        fromShareholder: null,
        toShareholder: null,
        pricePerShare: null,
        totalValue: null,
        notes: JSON.stringify({ splitRatio: '2', userNotes: 'Stock split' }),
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // Type label appears in badge + InfoRow
    expect(screen.getAllByText('Desdobramento').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2:1')).toBeInTheDocument();
    expect(screen.getByText('Stock split')).toBeInTheDocument();
  });

  // --- CONVERSION type rendering ---

  it('renders CONVERSION with share classes', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        type: 'CONVERSION' as const,
        fromShareholder: { id: 'sh-1', name: 'João Silva', type: 'INDIVIDUAL' },
        toShareholder: null,
        pricePerShare: null,
        totalValue: null,
        notes: JSON.stringify({ toShareClassId: 'sc-2', userNotes: null }),
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    // Type label appears in badge + InfoRow
    expect(screen.getAllByText('Conversão').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('João Silva')).toBeInTheDocument();
  });

  // --- Notes rendering ---

  it('renders plain text notes', () => {
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, notes: 'Test note here' },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Test note here')).toBeInTheDocument();
  });

  it('renders JSON userNotes', () => {
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, notes: JSON.stringify({ userNotes: 'Series A' }) },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Series A')).toBeInTheDocument();
  });

  // --- Action buttons by status ---

  it('shows Submit button for DRAFT status', () => {
    renderPage();
    expect(screen.getByText('Enviar para Processamento')).toBeInTheDocument();
    expect(screen.getByText('Cancelar Transação')).toBeInTheDocument();
  });

  it('shows Approve button for PENDING_APPROVAL status', () => {
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, status: 'PENDING_APPROVAL' as const, requiresBoardApproval: true },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Aprovar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar Transação')).toBeInTheDocument();
  });

  it('shows Confirm button for SUBMITTED status', () => {
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, status: 'SUBMITTED' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Confirmar e Executar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar Transação')).toBeInTheDocument();
  });

  it('shows Retry button for FAILED status', () => {
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, status: 'FAILED' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Tentar Novamente')).toBeInTheDocument();
    expect(screen.getByText('Cancelar Transação')).toBeInTheDocument();
  });

  it('shows no action buttons for CONFIRMED status', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        status: 'CONFIRMED' as const,
        confirmedAt: '2026-02-20T15:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Enviar para Processamento')).not.toBeInTheDocument();
    expect(screen.queryByText('Aprovar')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirmar e Executar')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar Transação')).not.toBeInTheDocument();
  });

  it('shows no action buttons for CANCELLED status', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        status: 'CANCELLED' as const,
        cancelledBy: 'user-1',
        cancelledAt: '2026-02-20T15:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.queryByText('Enviar para Processamento')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar Transação')).not.toBeInTheDocument();
  });

  // --- Submit action flow ---

  it('opens submit dialog and calls submit mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    // Click submit button
    await user.click(screen.getByText('Enviar para Processamento'));

    // Dialog should appear
    expect(screen.getByText('Enviar Transação')).toBeInTheDocument();
    expect(screen.getByText('Ao enviar, a transação será submetida.')).toBeInTheDocument();

    // Confirm action in dialog - find the button inside the dialog
    const dialogButtons = screen.getAllByText('Enviar para Processamento');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockSubmitMutation.mutateAsync).toHaveBeenCalledWith('txn-123');
  });

  // --- Approve action flow ---

  it('opens approve dialog and calls approve mutation', async () => {
    const user = userEvent.setup();
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, status: 'PENDING_APPROVAL' as const, requiresBoardApproval: true },
      isLoading: false,
      error: null,
    }));
    renderPage();

    await user.click(screen.getByText('Aprovar'));

    expect(screen.getByText('Aprovar Transação')).toBeInTheDocument();

    const dialogButtons = screen.getAllByText('Aprovar');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockApproveMutation.mutateAsync).toHaveBeenCalledWith('txn-123');
  });

  // --- Confirm action flow ---

  it('opens confirm dialog and calls confirm mutation', async () => {
    const user = userEvent.setup();
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, status: 'SUBMITTED' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();

    await user.click(screen.getByText('Confirmar e Executar'));

    expect(screen.getByText('Confirmar Transação')).toBeInTheDocument();

    const dialogButtons = screen.getAllByText('Confirmar e Executar');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockConfirmMutation.mutateAsync).toHaveBeenCalledWith('txn-123');
  });

  // --- Retry action flow ---

  it('opens retry dialog and calls confirm mutation for retry', async () => {
    const user = userEvent.setup();
    mockUseTransaction = jest.fn(() => ({
      data: { ...mockTransaction, status: 'FAILED' as const },
      isLoading: false,
      error: null,
    }));
    renderPage();

    await user.click(screen.getByText('Tentar Novamente'));

    // After opening dialog, button + dialog title both show "Tentar Novamente"
    expect(screen.getAllByText('Tentar Novamente').length).toBeGreaterThanOrEqual(2);

    const dialogButtons = screen.getAllByText('Tentar Novamente');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockConfirmMutation.mutateAsync).toHaveBeenCalledWith('txn-123');
  });

  // --- Cancel action flow ---

  it('opens cancel dialog and calls cancel mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Cancelar Transação'));

    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();

    const dialogButtons = screen.getAllByText('Cancelar Transação');
    await user.click(dialogButtons[dialogButtons.length - 1]);

    expect(mockCancelMutation.mutateAsync).toHaveBeenCalledWith('txn-123');
  });

  it('closes dialog when Cancel button in dialog is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open cancel dialog
    await user.click(screen.getByText('Cancelar Transação'));
    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();

    // Click Cancel button (not confirm) in dialog
    await user.click(screen.getByText('Cancel'));

    // Dialog should be closed
    expect(screen.queryByText('Esta ação não pode ser desfeita.')).not.toBeInTheDocument();
  });

  // --- Timeline rendering ---

  it('renders timeline for CONFIRMED transaction', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        status: 'CONFIRMED' as const,
        approvedBy: 'user-1',
        approvedAt: '2026-02-20T14:45:00.000Z',
        confirmedAt: '2026-02-20T15:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Transação criada')).toBeInTheDocument();
    expect(screen.getByText('Transação aprovada')).toBeInTheDocument();
    expect(screen.getByText('Transação enviada')).toBeInTheDocument();
    expect(screen.getByText('Transação confirmada')).toBeInTheDocument();
  });

  it('renders timeline for CANCELLED transaction', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        status: 'CANCELLED' as const,
        cancelledBy: 'user-1',
        cancelledAt: '2026-02-20T15:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Transação criada')).toBeInTheDocument();
    expect(screen.getByText('Transação cancelada')).toBeInTheDocument();
  });

  it('renders timeline with pending approval step when board approval required', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        status: 'PENDING_APPROVAL' as const,
        requiresBoardApproval: true,
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Transação criada')).toBeInTheDocument();
    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
  });

  // --- Confirmed transaction metadata ---

  it('renders confirmed timestamp for CONFIRMED transaction', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        status: 'CONFIRMED' as const,
        confirmedAt: '2026-02-20T15:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Confirmado em')).toBeInTheDocument();
  });

  it('renders cancelled timestamp for CANCELLED transaction', () => {
    mockUseTransaction = jest.fn(() => ({
      data: {
        ...mockTransaction,
        status: 'CANCELLED' as const,
        cancelledBy: 'user-1',
        cancelledAt: '2026-02-20T15:00:00.000Z',
      },
      isLoading: false,
      error: null,
    }));
    renderPage();
    expect(screen.getByText('Cancelado em')).toBeInTheDocument();
  });

  // --- Uses correct transactionId from params ---

  it('passes correct transactionId to useTransaction hook', () => {
    renderPage();
    expect(mockUseTransaction).toHaveBeenCalledWith('company-1', 'txn-123');
  });
});
