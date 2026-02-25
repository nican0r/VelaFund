import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import OnboardingPage from './page';

// --- Mocks ---

// Mock next-intl — namespace-aware so each component gets its relative keys
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      onboarding: {
        welcome: 'Welcome to Navia',
      },
      'onboarding.stepper': {
        step1: 'Your Information',
        step2: 'Your Company',
      },
      'onboarding.personalInfo': {
        title: 'Your Information',
        description: 'We need a few details to get started',
        firstName: 'First name',
        firstNamePlaceholder: 'e.g., John',
        firstNameRequired: 'First name is required',
        lastName: 'Last name',
        lastNamePlaceholder: 'e.g., Smith',
        lastNameRequired: 'Last name is required',
        email: 'Email',
        emailPlaceholder: 'your@email.com',
        emailRequired: 'Email is required',
        emailInvalid: 'Enter a valid email address',
        emailDuplicate: 'This email is already in use',
      },
      'onboarding.companyCreation': {
        title: 'Your Company',
        description: 'Set up your company to manage the cap table',
        name: 'Company name',
        namePlaceholder: 'e.g., Acme Technologies Ltd.',
        nameRequired: 'Company name is required',
        nameTooShort: 'Company name must be at least 2 characters',
        entityType: 'Entity type',
        entityTypePlaceholder: 'Select the entity type',
        entityTypeRequired: 'Entity type is required',
        'entityTypes.LTDA': 'Ltda.',
        'entityTypes.SA_CAPITAL_FECHADO': 'S.A. Closed Capital',
        'entityTypes.SA_CAPITAL_ABERTO': 'S.A. Open Capital',
        'entityTypesDescription.LTDA': 'Limited Liability Company',
        'entityTypesDescription.SA_CAPITAL_FECHADO': 'Closed capital corporation',
        'entityTypesDescription.SA_CAPITAL_ABERTO': 'Open capital corporation',
        cnpj: 'CNPJ',
        cnpjRequired: 'CNPJ is required',
        cnpjInvalid: 'Invalid CNPJ',
        cnpjDuplicate: 'This CNPJ is already registered',
        submit: 'Create Company',
      },
      common: {
        continue: 'Continue',
        error: 'An unexpected error occurred. Please try again.',
      },
    };
    return translations[namespace]?.[key] ?? key;
  },
}));

// Mock next/navigation
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/onboarding',
}));

// Mock sonner
const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
  },
}));

// Mock auth
const mockRefreshUser = jest.fn();
const mockCompleteOnboarding = jest.fn();
const mockUseAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock onboarding hooks
const mockUpdateProfileMutateAsync = jest.fn();
const mockCreateCompanyMutateAsync = jest.fn();
let mockUpdateProfileIsPending = false;
let mockCreateCompanyIsPending = false;
jest.mock('@/hooks/use-onboarding', () => ({
  useUpdateProfile: () => ({
    mutateAsync: mockUpdateProfileMutateAsync,
    isPending: mockUpdateProfileIsPending,
  }),
  useCreateCompany: () => ({
    mutateAsync: mockCreateCompanyMutateAsync,
    isPending: mockCreateCompanyIsPending,
  }),
}));

// --- Test helpers ---

const defaultUser = {
  id: 'u1',
  privyUserId: 'privy-1',
  email: 'test@example.com',
  firstName: null as string | null,
  lastName: null as string | null,
  walletAddress: null,
  kycStatus: 'NOT_STARTED',
  locale: 'pt-BR',
};

function setupAuth(overrides?: Record<string, unknown>) {
  mockUseAuth.mockReturnValue({
    isReady: true,
    isAuthenticated: true,
    isLoggingIn: false,
    user: defaultUser,
    isNewUser: true,
    needsOnboarding: true,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: mockRefreshUser,
    completeOnboarding: mockCompleteOnboarding,
    ...overrides,
  });
}

function setupAuthWithName() {
  setupAuth({
    user: { ...defaultUser, firstName: 'John', lastName: 'Smith' },
  });
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfileIsPending = false;
    mockCreateCompanyIsPending = false;
    mockRefreshUser.mockResolvedValue(undefined);
    mockUpdateProfileMutateAsync.mockResolvedValue({
      id: 'u1',
      firstName: 'John',
      lastName: 'Smith',
      email: 'test@example.com',
    });
    mockCreateCompanyMutateAsync.mockResolvedValue({
      id: 'c1',
      name: 'Acme',
      entityType: 'LTDA',
      cnpj: '11.222.333/0001-81',
      status: 'DRAFT',
    });
  });

  // ===== Rendering =====

  it('shows loading spinner when not ready', () => {
    setupAuth({ isReady: false, isAuthenticated: false });
    const { container } = render(<OnboardingPage />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders the Navia logo and welcome text', () => {
    setupAuth();
    render(<OnboardingPage />);
    expect(screen.getByText('Navia')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Navia')).toBeInTheDocument();
  });

  it('renders step 1 (Personal Info) for new users without firstName', () => {
    setupAuth();
    render(<OnboardingPage />);
    // "Your Information" appears in stepper + form title
    const matches = screen.getAllByText('Your Information');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders step 2 (Company Creation) for users who already have a name', () => {
    setupAuthWithName();
    render(<OnboardingPage />);
    const matches = screen.getAllByText('Your Company');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Company name')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toBeInTheDocument();
  });

  // ===== Stepper =====

  it('renders the stepper with 2 steps', () => {
    setupAuth();
    render(<OnboardingPage />);
    const list = screen.getByRole('list', { name: 'Onboarding steps' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('shows stepper labels for both steps', () => {
    setupAuth();
    render(<OnboardingPage />);
    const list = screen.getByRole('list', { name: 'Onboarding steps' });
    expect(within(list).getByText('Your Information')).toBeInTheDocument();
    expect(within(list).getByText('Your Company')).toBeInTheDocument();
  });

  // ===== Personal Info Step: Validation =====

  it('shows validation errors when submitting empty personal info form', async () => {
    setupAuth({ user: { ...defaultUser, email: null } });
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(mockUpdateProfileMutateAsync).not.toHaveBeenCalled();
  });

  it('shows email invalid error for malformed email', async () => {
    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Smith');
    const emailInput = screen.getByLabelText('Email');
    await user.clear(emailInput);
    await user.type(emailInput, 'notanemail');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(mockUpdateProfileMutateAsync).not.toHaveBeenCalled();
  });

  it('clears validation error when user starts typing', async () => {
    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('First name is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('First name'), 'J');
    expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
  });

  // ===== Personal Info Step: Submission =====

  it('calls updateProfile with correct data on valid submission', async () => {
    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Smith');
    // Email is pre-filled with test@example.com
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(mockUpdateProfileMutateAsync).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Smith',
      email: 'test@example.com',
    });
  });

  it('advances to step 2 after successful profile update', async () => {
    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Smith');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Should now show company creation step
    await waitFor(() => {
      expect(screen.getByLabelText('Company name')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('CNPJ')).toBeInTheDocument();
  });

  it('shows duplicate email error from API', async () => {
    mockUpdateProfileMutateAsync.mockRejectedValue({
      messageKey: 'errors.auth.duplicateEmail',
    });

    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Smith');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText('This email is already in use')).toBeInTheDocument();
  });

  it('shows toast error for unexpected API errors on profile update', async () => {
    mockUpdateProfileMutateAsync.mockRejectedValue(new Error('Network error'));

    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Smith');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('pre-fills email from user profile', () => {
    setupAuth();
    render(<OnboardingPage />);
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    expect(emailInput.value).toBe('test@example.com');
  });

  it('refreshes user after successful profile update', async () => {
    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Smith');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  // ===== Company Creation Step: Validation =====

  it('shows validation errors when submitting empty company form', async () => {
    setupAuthWithName();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /create company/i }));

    expect(screen.getByText('Company name is required')).toBeInTheDocument();
    expect(screen.getByText('Entity type is required')).toBeInTheDocument();
    expect(screen.getByText('CNPJ is required')).toBeInTheDocument();
    expect(mockCreateCompanyMutateAsync).not.toHaveBeenCalled();
  });

  it('shows CNPJ invalid error for bad checksum', async () => {
    setupAuthWithName();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Company name'), 'Acme Ltda');
    await user.type(screen.getByLabelText('CNPJ'), '11222333000199');
    await user.click(screen.getByRole('button', { name: /create company/i }));

    expect(screen.getByText('Invalid CNPJ')).toBeInTheDocument();
  });

  it('shows name too short error', async () => {
    setupAuthWithName();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Company name'), 'A');
    await user.type(screen.getByLabelText('CNPJ'), '11222333000181');
    await user.click(screen.getByRole('button', { name: /create company/i }));

    expect(screen.getByText('Company name must be at least 2 characters')).toBeInTheDocument();
  });

  it('rejects all-same-digit CNPJ', async () => {
    setupAuthWithName();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Company name'), 'Acme Ltda');
    await user.type(screen.getByLabelText('CNPJ'), '11111111111111');
    await user.click(screen.getByRole('button', { name: /create company/i }));

    expect(screen.getByText('Invalid CNPJ')).toBeInTheDocument();
  });

  // ===== Company Creation Step: CNPJ Formatting =====

  it('formats CNPJ as user types', async () => {
    setupAuthWithName();
    render(<OnboardingPage />);

    const user = userEvent.setup();
    const cnpjInput = screen.getByLabelText('CNPJ') as HTMLInputElement;
    await user.type(cnpjInput, '11222333000181');

    expect(cnpjInput.value).toBe('11.222.333/0001-81');
  });

  // ===== Full Flow =====

  it('completes step 1 and transitions to step 2', async () => {
    setupAuth();
    render(<OnboardingPage />);

    const user = userEvent.setup();

    // Step 1: Personal Info
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Smith');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2: Company Creation
    await waitFor(() => {
      expect(screen.getByLabelText('Company name')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('CNPJ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create company/i })).toBeInTheDocument();
  });

  it('renders entity type select with placeholder', () => {
    setupAuthWithName();
    render(<OnboardingPage />);
    expect(screen.getByRole('combobox', { name: /entity type/i })).toBeInTheDocument();
  });
});
