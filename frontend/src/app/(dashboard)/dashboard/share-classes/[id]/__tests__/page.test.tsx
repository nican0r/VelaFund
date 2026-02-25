import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareClassDetailPage from '../page';

// --- Mocks ---

const mockPush = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      shareClasses: {
        'type.quota': 'Quotas',
        'type.commonShares': 'Ações Ordinárias',
        'type.preferredShares': 'Ações Preferenciais',
        'detail.backToList': 'Voltar para Classes de Ações',
        'detail.title': 'Detalhes da Classe de Ações',
        'detail.authorized': 'Autorizadas',
        'detail.issued': 'Emitidas',
        'detail.available': 'Disponíveis',
        'detail.issuedPct': '% Emitido',
        'detail.tabHolders': 'Detentores',
        'detail.tabDetails': 'Detalhes',
        'detail.holdersEmpty': 'Nenhum acionista detém ações desta classe.',
        'detail.holdersTable.name': 'Acionista',
        'detail.holdersTable.type': 'Tipo',
        'detail.holdersTable.shares': 'Ações',
        'detail.holdersTable.ownershipPct': '% Propriedade',
        'detail.holdersTable.votingPct': '% Voto',
        'detail.information': 'Informações da Classe',
        'detail.className': 'Nome',
        'detail.type': 'Tipo',
        'detail.createdAt': 'Criado em',
        'detail.updatedAt': 'Atualizado em',
        'detail.votingRights': 'Direitos de Voto',
        'detail.votesPerShare': 'Votos por Ação',
        'detail.antiDilution': 'Proteção Anti-diluição',
        'detail.antiDilutionType.fullRatchet': 'Full Ratchet',
        'detail.antiDilutionType.weightedAverage': 'Média Ponderada',
        'detail.conversionRatio': 'Razão de Conversão',
        'detail.none': 'Nenhum',
        'detail.preferences': 'Preferências de Liquidação',
        'detail.liquidationMultiple': 'Múltiplo de Liquidação',
        'detail.participatingRights': 'Direitos de Participação',
        'detail.participationCap': 'Limite de Participação',
        'detail.seniority': 'Senioridade',
        'detail.restrictions': 'Restrições de Transferência',
        'detail.rightOfFirstRefusal': 'Direito de Preferência',
        'detail.lockUpPeriod': 'Período de Lock-up',
        'detail.lockUpMonths': '{months} meses',
        'detail.noLockUp': 'Sem lock-up',
        'detail.tagAlong': 'Tag-along',
        'detail.yes': 'Sim',
        'detail.no': 'Não',
        'detail.error': 'Erro ao carregar classe de ações. Tente novamente.',
        'detail.notFound': 'Classe de ações não encontrada.',
        'confirm.deleteTitle': 'Excluir Classe de Ações',
        'confirm.deleteDescription': 'Só é possível excluir classes sem ações emitidas.',
        'empty': 'Nenhuma classe de ações cadastrada.',
      },
      common: {
        cancel: 'Cancelar',
        delete: 'Excluir',
        edit: 'Editar',
      },
    };
    return (key: string, params?: Record<string, unknown>) => {
      let value = keys[ns]?.[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    };
  },
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'sc-1' }),
  useRouter: () => ({ push: mockPush }),
}));

const mockCompany = {
  id: 'company-1',
  name: 'Test Company',
  entityType: 'SA_CAPITAL_FECHADO' as const,
  cnpj: '12.345.678/0001-90',
  status: 'ACTIVE' as const,
  logoUrl: null,
  role: 'ADMIN',
  memberCount: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const defaultCompanyCtx = {
  selectedCompany: mockCompany,
  companies: [mockCompany],
  isLoading: false,
  error: null,
  setSelectedCompanyId: jest.fn(),
};

jest.mock('@/lib/company-context', () => ({
  useCompany: () => defaultCompanyCtx,
}));

const mockShareClass = {
  id: 'sc-1',
  companyId: 'company-1',
  className: 'Ações Ordinárias',
  type: 'COMMON_SHARES' as const,
  totalAuthorized: '1000000',
  totalIssued: '500000',
  votesPerShare: 1,
  liquidationPreferenceMultiple: null,
  participatingRights: false,
  participationCap: null,
  seniority: 0,
  rightOfFirstRefusal: true,
  lockUpPeriodMonths: 12,
  tagAlongPercentage: '80.00',
  conversionRatio: null,
  antiDilutionType: null,
  createdAt: '2026-01-15T10:30:00.000Z',
  updatedAt: '2026-02-20T14:00:00.000Z',
};

const mockPreferredClass = {
  ...mockShareClass,
  id: 'sc-2',
  className: 'Ações Preferenciais',
  type: 'PREFERRED_SHARES' as const,
  totalAuthorized: '250000',
  totalIssued: '100000',
  votesPerShare: 0,
  liquidationPreferenceMultiple: '1.5000',
  participatingRights: true,
  participationCap: '20.00',
  seniority: 1,
  antiDilutionType: 'WEIGHTED_AVERAGE' as const,
  conversionRatio: '1.000000',
};

const mockEmptyClass = {
  ...mockShareClass,
  id: 'sc-3',
  className: 'Classe Vazia',
  totalIssued: '0',
};

const mockCapTableEntries = [
  {
    shareholderId: 'sh-1',
    shareholderName: 'João Silva',
    shareholderType: 'FOUNDER',
    shareClassId: 'sc-1',
    shareClassName: 'Ações Ordinárias',
    shareClassType: 'COMMON_SHARES',
    shares: '300000',
    ownershipPercentage: '30.0',
    votingPower: '300000',
    votingPercentage: '60.0',
  },
  {
    shareholderId: 'sh-2',
    shareholderName: 'Fund ABC',
    shareholderType: 'INVESTOR',
    shareClassId: 'sc-1',
    shareClassName: 'Ações Ordinárias',
    shareClassType: 'COMMON_SHARES',
    shares: '200000',
    ownershipPercentage: '20.0',
    votingPower: '200000',
    votingPercentage: '40.0',
  },
  {
    shareholderId: 'sh-3',
    shareholderName: 'Maria Santos',
    shareholderType: 'EMPLOYEE',
    shareClassId: 'sc-2',
    shareClassName: 'Ações Preferenciais',
    shareClassType: 'PREFERRED_SHARES',
    shares: '100000',
    ownershipPercentage: '10.0',
    votingPower: '0',
    votingPercentage: '0.0',
  },
];

const mockCapTable = {
  company: { id: 'company-1', name: 'Test Company', entityType: 'SA_CAPITAL_FECHADO' },
  summary: { totalShares: '600000', totalShareholders: 3, totalShareClasses: 2, lastUpdated: '2026-02-20T14:00:00.000Z' },
  entries: mockCapTableEntries,
};

// Default hook return values
let useShareClassReturn: { data: typeof mockShareClass | undefined; isLoading: boolean; error: Error | null } = {
  data: mockShareClass,
  isLoading: false,
  error: null,
};

let useCapTableReturn: { data: typeof mockCapTable | undefined; isLoading: boolean } = {
  data: mockCapTable,
  isLoading: false,
};

const mockDeleteMutateAsync = jest.fn().mockResolvedValue(undefined);
let useDeleteShareClassReturn = {
  mutateAsync: mockDeleteMutateAsync,
  isPending: false,
};

jest.mock('@/hooks/use-share-classes', () => ({
  useShareClass: () => useShareClassReturn,
  useDeleteShareClass: () => useDeleteShareClassReturn,
}));

jest.mock('@/hooks/use-cap-table', () => ({
  useCapTable: () => useCapTableReturn,
}));

// --- Tests ---

describe('ShareClassDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useShareClassReturn = { data: mockShareClass, isLoading: false, error: null };
    useCapTableReturn = { data: mockCapTable, isLoading: false };
    useDeleteShareClassReturn = { mutateAsync: mockDeleteMutateAsync, isPending: false };
    defaultCompanyCtx.selectedCompany = mockCompany;
    defaultCompanyCtx.isLoading = false;
  });

  // --- Rendering ---

  it('renders the share class name and type badge', () => {
    render(<ShareClassDetailPage />);
    // Name appears as h1 heading and also as the type badge label (both "Ações Ordinárias")
    const matches = screen.getAllByText('Ações Ordinárias');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('renders back link to share classes list', () => {
    render(<ShareClassDetailPage />);
    const backLink = screen.getByText('Voltar para Classes de Ações');
    expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard/share-classes');
  });

  it('renders page subtitle', () => {
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Detalhes da Classe de Ações')).toBeInTheDocument();
  });

  // --- Stat Cards ---

  it('renders 4 stat cards with correct values', () => {
    render(<ShareClassDetailPage />);
    // Authorized (active card): 1.000.000
    expect(screen.getByText('1.000.000')).toBeInTheDocument();
    // Issued and Available are both 500.000 - use getAllByText
    const halfMillion = screen.getAllByText('500.000');
    expect(halfMillion).toHaveLength(2); // Issued + Available
    // % Issued: 50.0%
    expect(screen.getByText('50,0%')).toBeInTheDocument();
  });

  it('renders stat card labels', () => {
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Autorizadas')).toBeInTheDocument();
    expect(screen.getByText('Emitidas')).toBeInTheDocument();
    expect(screen.getByText('Disponíveis')).toBeInTheDocument();
    expect(screen.getByText('% Emitido')).toBeInTheDocument();
  });

  // --- Tabs ---

  it('renders Holders and Details tabs', () => {
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Detentores')).toBeInTheDocument();
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
  });

  it('shows holders count badge', () => {
    render(<ShareClassDetailPage />);
    // sc-1 has 2 holders (João Silva and Fund ABC)
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  // --- Holders Tab ---

  it('renders holders table with shareholders of this class', () => {
    render(<ShareClassDetailPage />);
    // Only sc-1 holders should show (not Maria Santos who holds sc-2)
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Fund ABC')).toBeInTheDocument();
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
  });

  it('renders holder type badges', () => {
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Founder')).toBeInTheDocument();
    expect(screen.getByText('Investor')).toBeInTheDocument();
  });

  it('renders holder shares and percentages', () => {
    render(<ShareClassDetailPage />);
    expect(screen.getByText('300.000')).toBeInTheDocument();
    expect(screen.getByText('200.000')).toBeInTheDocument();
    expect(screen.getByText('30,0%')).toBeInTheDocument();
    expect(screen.getByText('20,0%')).toBeInTheDocument();
  });

  it('renders shareholder names as links', () => {
    render(<ShareClassDetailPage />);
    const shareholderLink = screen.getByText('João Silva').closest('a');
    expect(shareholderLink).toHaveAttribute('href', '/dashboard/shareholders/sh-1');
  });

  it('renders holders table headers', () => {
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Acionista')).toBeInTheDocument();
    expect(screen.getByText('Ações')).toBeInTheDocument();
    expect(screen.getByText('% Propriedade')).toBeInTheDocument();
    expect(screen.getByText('% Voto')).toBeInTheDocument();
  });

  it('shows empty state when no holders', () => {
    useCapTableReturn = {
      data: {
        ...mockCapTable,
        entries: mockCapTableEntries.filter((e) => e.shareClassId !== 'sc-1'),
      },
      isLoading: false,
    };
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Nenhum acionista detém ações desta classe.')).toBeInTheDocument();
  });

  // --- Details Tab ---

  it('renders details tab content when clicked', async () => {
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    const detailsTab = screen.getByText('Detalhes');
    await user.click(detailsTab);

    expect(screen.getByText('Informações da Classe')).toBeInTheDocument();
    expect(screen.getByText('Direitos de Voto')).toBeInTheDocument();
    expect(screen.getByText('Restrições de Transferência')).toBeInTheDocument();
  });

  it('renders share class information in details tab', async () => {
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Detalhes'));

    expect(screen.getByText('Nome')).toBeInTheDocument();
    // Voting rights
    expect(screen.getByText('Votos por Ação')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    // Transfer restrictions
    expect(screen.getByText('Direito de Preferência')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Período de Lock-up')).toBeInTheDocument();
    expect(screen.getByText('12 meses')).toBeInTheDocument();
    expect(screen.getByText('Tag-along')).toBeInTheDocument();
    expect(screen.getByText('80,0%')).toBeInTheDocument();
  });

  it('does NOT render liquidation preferences for non-preferred classes', async () => {
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Detalhes'));

    expect(screen.queryByText('Preferências de Liquidação')).not.toBeInTheDocument();
  });

  it('renders liquidation preferences for preferred share class', async () => {
    useShareClassReturn = { data: mockPreferredClass, isLoading: false, error: null };
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Detalhes'));

    expect(screen.getByText('Preferências de Liquidação')).toBeInTheDocument();
    expect(screen.getByText('Múltiplo de Liquidação')).toBeInTheDocument();
    expect(screen.getByText('Direitos de Participação')).toBeInTheDocument();
    expect(screen.getByText('Limite de Participação')).toBeInTheDocument();
    expect(screen.getByText('Senioridade')).toBeInTheDocument();
  });

  it('renders anti-dilution type when present', async () => {
    useShareClassReturn = { data: mockPreferredClass, isLoading: false, error: null };
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Detalhes'));

    expect(screen.getByText('Proteção Anti-diluição')).toBeInTheDocument();
    expect(screen.getByText('Média Ponderada')).toBeInTheDocument();
  });

  it('renders conversion ratio when present', async () => {
    useShareClassReturn = { data: mockPreferredClass, isLoading: false, error: null };
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Detalhes'));

    expect(screen.getByText('Razão de Conversão')).toBeInTheDocument();
  });

  it('renders "Nenhum" for null anti-dilution and conversion ratio', async () => {
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Detalhes'));

    // Both should show "Nenhum" for common shares
    const noneTexts = screen.getAllByText('Nenhum');
    expect(noneTexts.length).toBeGreaterThanOrEqual(2);
  });

  // --- Delete ---

  it('shows delete button when no shares issued', () => {
    useShareClassReturn = { data: mockEmptyClass, isLoading: false, error: null };
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Excluir')).toBeInTheDocument();
  });

  it('hides delete button when shares are issued', () => {
    render(<ShareClassDetailPage />);
    // mockShareClass has totalIssued = 500000, so delete should be hidden
    const buttons = screen.queryAllByText('Excluir');
    expect(buttons).toHaveLength(0);
  });

  it('shows delete confirmation dialog when delete button clicked', async () => {
    useShareClassReturn = { data: mockEmptyClass, isLoading: false, error: null };
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Excluir'));
    expect(screen.getByText('Excluir Classe de Ações')).toBeInTheDocument();
    expect(screen.getByText('Só é possível excluir classes sem ações emitidas.')).toBeInTheDocument();
  });

  it('calls delete mutation and redirects on confirm', async () => {
    useShareClassReturn = { data: mockEmptyClass, isLoading: false, error: null };
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Excluir'));
    // Click the confirm delete button in the dialog (second "Excluir")
    const deleteButtons = screen.getAllByText('Excluir');
    // The last one is the dialog confirm button
    await user.click(deleteButtons[deleteButtons.length - 1]);

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith('sc-1');
    expect(mockPush).toHaveBeenCalledWith('/dashboard/share-classes');
  });

  it('closes delete dialog on cancel', async () => {
    useShareClassReturn = { data: mockEmptyClass, isLoading: false, error: null };
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    await user.click(screen.getByText('Excluir'));
    expect(screen.getByText('Excluir Classe de Ações')).toBeInTheDocument();

    await user.click(screen.getByText('Cancelar'));
    expect(screen.queryByText('Excluir Classe de Ações')).not.toBeInTheDocument();
  });

  // --- Loading states ---

  it('shows skeleton while loading', () => {
    useShareClassReturn = { data: undefined, isLoading: true, error: null };
    const { container } = render(<ShareClassDetailPage />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows skeleton while company is loading', () => {
    defaultCompanyCtx.isLoading = true;
    const { container } = render(<ShareClassDetailPage />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // --- Error states ---

  it('shows error message on fetch error', () => {
    useShareClassReturn = { data: undefined, isLoading: false, error: new Error('Failed') };
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Erro ao carregar classe de ações. Tente novamente.')).toBeInTheDocument();
    expect(screen.getByText('Voltar para Classes de Ações')).toBeInTheDocument();
  });

  it('shows not found message when data is undefined', () => {
    useShareClassReturn = { data: undefined, isLoading: false, error: null };
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Classe de ações não encontrada.')).toBeInTheDocument();
  });

  // --- No company ---

  it('shows empty state when no company selected', () => {
    defaultCompanyCtx.selectedCompany = null as unknown as typeof mockCompany;
    render(<ShareClassDetailPage />);
    expect(screen.getByText('Nenhuma classe de ações cadastrada.')).toBeInTheDocument();
  });

  // --- Type badge rendering ---

  it('renders common shares type badge', () => {
    render(<ShareClassDetailPage />);
    // The type badge in the header
    const badges = screen.getAllByText('Ações Ordinárias');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders preferred shares type badge', () => {
    useShareClassReturn = { data: mockPreferredClass, isLoading: false, error: null };
    render(<ShareClassDetailPage />);
    const badges = screen.getAllByText('Ações Preferenciais');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  // --- Tab switching ---

  it('switches between holders and details tabs', async () => {
    const user = userEvent.setup();
    render(<ShareClassDetailPage />);

    // Holders tab is active by default
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByText('Informações da Classe')).not.toBeInTheDocument();

    // Switch to Details
    await user.click(screen.getByText('Detalhes'));
    expect(screen.getByText('Informações da Classe')).toBeInTheDocument();
    expect(screen.queryByText('João Silva')).not.toBeInTheDocument();

    // Switch back to Holders
    await user.click(screen.getByText('Detentores'));
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByText('Informações da Classe')).not.toBeInTheDocument();
  });

  // --- Holders loading state ---

  it('shows holders loading state while cap table loads', () => {
    useCapTableReturn = { data: undefined, isLoading: true };
    const { container } = render(<ShareClassDetailPage />);
    // The holders tab should show skeleton inside
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
