import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvitationAcceptPage from './page';

// --- Mocks ---

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockToken = 'abc123def456';

jest.mock('next/navigation', () => ({
  useParams: () => ({ token: mockToken }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const translations: Record<string, string> = {
      'invitations.title': 'Convite de empresa',
      'invitations.description': 'Você foi convidado(a) para participar de uma empresa na plataforma Navia.',
      'invitations.loading': 'Carregando convite...',
      'invitations.accept': 'Aceitar convite',
      'invitations.acceptSuccess': 'Bem-vindo!',
      'invitations.signIn': 'Entrar',
      'invitations.signInDescription': 'Entre na sua conta para aceitar o convite.',
      'invitations.signUpDescription': 'Crie uma conta para aceitar o convite.',
      'invitations.createAccount': 'Criar conta',
      'invitations.expired': 'Este convite expirou.',
      'invitations.expiredDescription': 'Solicite ao administrador da empresa que envie um novo convite.',
      'invitations.notFound': 'Convite não encontrado ou já utilizado.',
      'invitations.notFoundDescription': 'Verifique o link do convite ou solicite um novo ao administrador.',
      'invitations.invitedAs': 'Convidado(a) como',
      'invitations.invitedBy': 'Convidado(a) por',
      'invitations.invitedOn': 'Convidado(a) em',
      'invitations.expiresAt': 'Expira em',
      'invitations.role.admin': 'Administrador',
      'invitations.role.finance': 'Financeiro',
      'invitations.role.legal': 'Jurídico',
      'invitations.role.investor': 'Investidor(a)',
      'invitations.role.employee': 'Funcionário(a)',
      'common.loading': 'Carregando...',
    };
    const t = (key: string) => translations[key] || key;
    return t;
  },
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// Auth mock
const mockLogin = jest.fn();
const mockLogout = jest.fn();
let mockAuthState = {
  isReady: true,
  isAuthenticated: false,
  isLoggingIn: false,
  user: null as { id: string; email: string } | null,
  login: mockLogin,
  logout: mockLogout,
  refreshUser: jest.fn(),
};

jest.mock('@/lib/auth', () => ({
  useAuth: () => mockAuthState,
}));

// Error toast mock
const mockShowErrorToast = jest.fn();
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => mockShowErrorToast,
}));

// Invitation hooks mocks
const mockAcceptMutateAsync = jest.fn();
let mockInvitationData: Record<string, unknown> | null = null;
let mockInvitationLoading = false;
let mockInvitationError: Error | null = null;
let mockAcceptPending = false;

jest.mock('@/hooks/use-invitations', () => ({
  useInvitationDetails: () => ({
    data: mockInvitationData,
    isLoading: mockInvitationLoading,
    error: mockInvitationError,
  }),
  useAcceptInvitation: () => ({
    mutateAsync: mockAcceptMutateAsync,
    isPending: mockAcceptPending,
  }),
}));

jest.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    code: string;
    messageKey: string;
    statusCode: number;
    constructor(code: string, messageKey: string, statusCode: number) {
      super(messageKey);
      this.code = code;
      this.messageKey = messageKey;
      this.statusCode = statusCode;
    }
  },
}));

// --- Helpers ---

const baseInvitation = {
  companyName: 'Acme Ltda.',
  companyLogoUrl: null,
  role: 'INVESTOR',
  invitedByName: 'Nelson Pereira',
  invitedAt: '2026-02-20T10:00:00.000Z',
  expiresAt: '2026-02-27T10:00:00.000Z',
  email: 'invitee@example.com',
  hasExistingAccount: false,
};

function resetMocks() {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockLogin.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockShowErrorToast.mockReset();
  mockAcceptMutateAsync.mockReset();

  mockAuthState = {
    isReady: true,
    isAuthenticated: false,
    isLoggingIn: false,
    user: null,
    login: mockLogin,
    logout: mockLogout,
    refreshUser: jest.fn(),
  };
  mockInvitationData = null;
  mockInvitationLoading = false;
  mockInvitationError = null;
  mockAcceptPending = false;
}

// --- Tests ---

describe('InvitationAcceptPage', () => {
  beforeEach(resetMocks);

  describe('Loading state', () => {
    it('shows loading spinner while Privy SDK initializes', () => {
      mockAuthState.isReady = false;
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Carregando convite...')).toBeInTheDocument();
    });

    it('shows loading spinner while invitation details load', () => {
      mockInvitationLoading = true;
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Carregando convite...')).toBeInTheDocument();
    });
  });

  describe('Error states', () => {
    it('shows not found message for 404 error', () => {
      mockInvitationError = new Error('Not found');
      render(<InvitationAcceptPage />);
      expect(
        screen.getByText('Convite não encontrado ou já utilizado.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Verifique o link do convite ou solicite um novo ao administrador.',
        ),
      ).toBeInTheDocument();
    });

    it('shows expired message for 410 error', () => {
      const { ApiError } = jest.requireMock('@/lib/api-client');
      mockInvitationError = new ApiError(
        'INVITATION_EXPIRED',
        'errors.member.invitationExpired',
        410,
      );
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Este convite expirou.')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Solicite ao administrador da empresa que envie um novo convite.',
        ),
      ).toBeInTheDocument();
    });

    it('shows sign in button on error pages', () => {
      mockInvitationError = new Error('Not found');
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Entrar')).toBeInTheDocument();
    });

    it('navigates to login when clicking sign in on error page', async () => {
      const user = userEvent.setup();
      mockInvitationError = new Error('Not found');
      render(<InvitationAcceptPage />);
      await user.click(screen.getByText('Entrar'));
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  describe('Unauthenticated user', () => {
    beforeEach(() => {
      mockInvitationData = { ...baseInvitation };
    });

    it('renders invitation details', () => {
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Convite de empresa')).toBeInTheDocument();
      expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
      expect(screen.getByText('Investidor(a)')).toBeInTheDocument();
      expect(screen.getByText('Nelson Pereira')).toBeInTheDocument();
      expect(screen.getByText('invitee@example.com')).toBeInTheDocument();
    });

    it('shows dates in Brazilian format', () => {
      render(<InvitationAcceptPage />);
      expect(screen.getByText('20/02/2026')).toBeInTheDocument();
      expect(screen.getByText('27/02/2026')).toBeInTheDocument();
    });

    it('shows "Create account" button for new users', () => {
      mockInvitationData = { ...baseInvitation, hasExistingAccount: false };
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Criar conta')).toBeInTheDocument();
      expect(
        screen.getByText('Crie uma conta para aceitar o convite.'),
      ).toBeInTheDocument();
    });

    it('shows "Sign in" button for existing users', () => {
      mockInvitationData = { ...baseInvitation, hasExistingAccount: true };
      render(<InvitationAcceptPage />);
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
      expect(
        screen.getByText('Entre na sua conta para aceitar o convite.'),
      ).toBeInTheDocument();
    });

    it('triggers Privy login when clicking login button', async () => {
      const user = userEvent.setup();
      mockInvitationData = { ...baseInvitation, hasExistingAccount: true };
      render(<InvitationAcceptPage />);
      await user.click(screen.getByRole('button', { name: 'Entrar' }));
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('triggers Privy login when clicking create account button', async () => {
      const user = userEvent.setup();
      render(<InvitationAcceptPage />);
      await user.click(screen.getByText('Criar conta'));
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('shows all role badges correctly', () => {
      const roles = [
        { role: 'ADMIN', label: 'Administrador' },
        { role: 'FINANCE', label: 'Financeiro' },
        { role: 'LEGAL', label: 'Jurídico' },
        { role: 'EMPLOYEE', label: 'Funcionário(a)' },
      ];

      for (const { role, label } of roles) {
        mockInvitationData = { ...baseInvitation, role };
        const { unmount } = render(<InvitationAcceptPage />);
        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('Authenticated user', () => {
    beforeEach(() => {
      mockAuthState.isReady = true;
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: 'user-1', email: 'user@example.com' };
      mockInvitationData = { ...baseInvitation };
    });

    it('shows accept button when authenticated', () => {
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Aceitar convite')).toBeInTheDocument();
    });

    it('does not show login/signup buttons when authenticated', () => {
      render(<InvitationAcceptPage />);
      expect(screen.queryByText('Criar conta')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Entre na sua conta para aceitar o convite.'),
      ).not.toBeInTheDocument();
    });

    it('calls accept mutation when clicking accept', async () => {
      const user = userEvent.setup();
      mockAcceptMutateAsync.mockResolvedValue({
        memberId: 'member-1',
        companyId: 'company-1',
        companyName: 'Acme Ltda.',
        role: 'INVESTOR',
        status: 'ACTIVE',
        acceptedAt: '2026-02-25T14:30:00.000Z',
      });
      render(<InvitationAcceptPage />);
      await user.click(screen.getByText('Aceitar convite'));
      expect(mockAcceptMutateAsync).toHaveBeenCalledWith(mockToken);
    });

    it('shows success toast and redirects to dashboard on accept', async () => {
      const user = userEvent.setup();
      mockAcceptMutateAsync.mockResolvedValue({
        memberId: 'member-1',
        companyId: 'company-1',
        companyName: 'Acme Ltda.',
        role: 'INVESTOR',
        status: 'ACTIVE',
        acceptedAt: '2026-02-25T14:30:00.000Z',
      });
      render(<InvitationAcceptPage />);
      await user.click(screen.getByText('Aceitar convite'));
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Bem-vindo!');
      });
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    it('shows error toast on accept failure', async () => {
      const user = userEvent.setup();
      const error = new Error('Already a member');
      mockAcceptMutateAsync.mockRejectedValue(error);
      render(<InvitationAcceptPage />);
      await user.click(screen.getByText('Aceitar convite'));
      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('disables accept button while mutation is pending', () => {
      mockAcceptPending = true;
      render(<InvitationAcceptPage />);
      const buttons = screen.getAllByRole('button');
      const acceptButton = buttons.find((btn) => btn.closest('div.space-y-3'));
      expect(acceptButton).toBeDisabled();
    });
  });

  describe('Logging in state', () => {
    it('shows loading when user is logging in', () => {
      mockAuthState.isLoggingIn = true;
      mockInvitationData = { ...baseInvitation };
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });
  });

  describe('Invitation without inviter name', () => {
    it('does not show inviter section when invitedByName is null', () => {
      mockInvitationData = { ...baseInvitation, invitedByName: null };
      render(<InvitationAcceptPage />);
      expect(screen.queryByText('Convidado(a) por')).not.toBeInTheDocument();
      // Other info should still be visible
      expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
    });
  });

  describe('Meta info rendering', () => {
    it('renders all meta info fields', () => {
      mockInvitationData = { ...baseInvitation };
      render(<InvitationAcceptPage />);
      expect(screen.getByText('Convidado(a) como')).toBeInTheDocument();
      expect(screen.getByText('Convidado(a) por')).toBeInTheDocument();
      expect(screen.getByText('Convidado(a) em')).toBeInTheDocument();
      expect(screen.getByText('Expira em')).toBeInTheDocument();
    });
  });
});
