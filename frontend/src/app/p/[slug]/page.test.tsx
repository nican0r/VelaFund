import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PublicProfilePage from './page';
import type { PublicProfile } from '@/types/company';

// ---------- Mocks ----------

// Mock next-intl
const i18nKeys: Record<string, string> = {
  'publicProfile.notFound.title': 'Profile not found',
  'publicProfile.notFound.description':
    'This profile does not exist or has been removed.',
  'publicProfile.emailGate.title': 'Enter your email to continue',
  'publicProfile.emailGate.description':
    'The company requires your email to access this profile.',
  'publicProfile.emailGate.placeholder': 'name@company.com',
  'publicProfile.emailGate.button': 'View profile',
  'publicProfile.emailGate.disclaimer':
    'Your email will be shared with the company.',
  'publicProfile.passwordGate.title': 'This profile is protected',
  'publicProfile.passwordGate.description':
    'Enter the password shared with you.',
  'publicProfile.passwordGate.placeholder': 'Password',
  'publicProfile.passwordGate.button': 'Unlock profile',
  'publicProfile.passwordGate.error': 'Incorrect password. Please try again.',
  'publicProfile.sections.about': 'About',
  'publicProfile.sections.metrics': 'Key Metrics',
  'publicProfile.sections.team': 'Team',
  'publicProfile.sections.documents': 'Documents',
  'publicProfile.sections.litigation': 'Legal Due Diligence',
  'publicProfile.header.website': 'Website',
  'publicProfile.footer.poweredBy': 'Powered by',
  'publicProfile.error.generic': 'Something went wrong. Please try again.',
  'publicProfile.documents.download': 'Download',
  'publicProfile.litigation.pending': 'Litigation check in progress…',
  'publicProfile.litigation.failed': 'Litigation data unavailable.',
  'publicProfile.litigation.riskLevel': 'Risk Level',
  'publicProfile.litigation.activeLawsuits': 'active lawsuits',
  'publicProfile.litigation.noActive': 'No active lawsuits found.',
  'publicProfile.litigation.fetchedAt': 'Last checked:',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      const fullKey = `${namespace}.${key}`;
      if (params) {
        let translated = i18nKeys[fullKey] ?? key;
        for (const [k, v] of Object.entries(params)) {
          translated = translated.replace(`{${k}}`, String(v));
        }
        return translated;
      }
      return i18nKeys[fullKey] ?? key;
    };
  },
}));

// Mock next/navigation
const mockSlug = 'acme-ltda';
jest.mock('next/navigation', () => ({
  useParams: () => ({ slug: mockSlug }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock api client
const mockGet = jest.fn();

jest.mock('@/lib/api-client', () => {
  class MockApiError extends Error {
    code: string;
    messageKey: string;
    statusCode: number;
    details?: Record<string, unknown>;
    constructor(
      code: string,
      messageKey: string,
      statusCode: number,
      details?: Record<string, unknown>,
    ) {
      super(messageKey);
      this.name = 'ApiError';
      this.code = code;
      this.messageKey = messageKey;
      this.statusCode = statusCode;
      this.details = details;
    }
  }
  return {
    api: { get: (...args: unknown[]) => mockGet(...args) },
    ApiError: MockApiError,
  };
});

// ---------- Test Data ----------

const mockProfile: PublicProfile = {
  id: 'p1',
  slug: 'acme-ltda',
  companyName: 'Acme Ltda.',
  companyLogo: null,
  headline: 'Revolutionizing logistics in Brazil',
  description: 'We are building the next-gen logistics platform for Brazilian SMBs.',
  sector: 'LOGISTICS',
  foundedYear: 2022,
  website: 'https://acme.com.br',
  location: 'São Paulo, SP',
  metrics: [
    {
      id: 'm1',
      label: 'ARR',
      value: '1200000',
      format: 'CURRENCY_BRL',
      order: 0,
    },
    {
      id: 'm2',
      label: 'Customers',
      value: '350',
      format: 'NUMBER',
      order: 1,
    },
    {
      id: 'm3',
      label: 'Growth',
      value: '45.5',
      format: 'PERCENTAGE',
      order: 2,
    },
  ],
  team: [
    {
      id: 't1',
      name: 'João Silva',
      title: 'CEO',
      photoUrl: null,
      linkedinUrl: 'https://linkedin.com/in/joaosilva',
      order: 0,
    },
    {
      id: 't2',
      name: 'Maria Santos',
      title: 'CTO',
      photoUrl: 'https://example.com/maria.jpg',
      linkedinUrl: null,
      order: 1,
    },
  ],
  documents: [
    {
      id: 'd1',
      name: 'Pitch Deck Q1 2026.pdf',
      category: 'PITCH_DECK',
      fileSize: 2500000,
      mimeType: 'application/pdf',
      pageCount: 15,
    },
  ],
  viewCount: 42,
  shareUrl: 'https://app.navia.com.br/p/acme-ltda',
  publishedAt: '2026-02-20T10:00:00.000Z',
  litigation: {
    status: 'COMPLETED',
    fetchedAt: '2026-02-19T12:00:00.000Z',
    summary: {
      activeLawsuits: 0,
      historicalLawsuits: 2,
      activeAdministrative: 0,
      protests: 0,
      totalValueInDispute: '0',
      riskLevel: 'LOW',
    },
  },
};

function createApiError(
  code: string,
  messageKey: string,
  statusCode: number,
) {
  // Access the mock class via jest.requireMock to avoid TDZ issues with jest.mock hoisting
  const { ApiError } = jest.requireMock<{ ApiError: new (...args: unknown[]) => Error }>(
    '@/lib/api-client',
  );
  return new ApiError(code, messageKey, statusCode);
}

// ---------- Tests ----------

describe('PublicProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders loading skeleton on mount', () => {
      // Never resolve the API call — stays in loading
      mockGet.mockReturnValue(new Promise(() => {}));
      render(<PublicProfilePage />);

      // Header is always visible
      expect(screen.getByText('Navia')).toBeInTheDocument();
      expect(screen.getByText('Investor-ready profiles')).toBeInTheDocument();
    });
  });

  describe('profile view (happy path)', () => {
    it('renders full profile after successful load', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
      });

      // Headline
      expect(
        screen.getByText('Revolutionizing logistics in Brazil'),
      ).toBeInTheDocument();

      // Sector badge
      expect(screen.getByText('Logistics')).toBeInTheDocument();

      // Founded year
      expect(screen.getByText('2022')).toBeInTheDocument();

      // Location
      expect(screen.getByText('São Paulo, SP')).toBeInTheDocument();

      // Website link
      expect(screen.getByText('Website')).toBeInTheDocument();
    });

    it('renders description section', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });
      expect(
        screen.getByText(
          'We are building the next-gen logistics platform for Brazilian SMBs.',
        ),
      ).toBeInTheDocument();
    });

    it('renders metrics with Brazilian formatting', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Key Metrics')).toBeInTheDocument();
      });

      // Metric labels
      expect(screen.getByText('ARR')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Growth')).toBeInTheDocument();

      // BRL currency formatted (Intl may use different whitespace between R$ and digits)
      expect(screen.getByText((text) => /R\$\s*1\.200\.000,00/.test(text))).toBeInTheDocument();

      // Number formatted
      expect(screen.getByText('350')).toBeInTheDocument();

      // Percentage formatted
      expect(screen.getByText('45,5%')).toBeInTheDocument();
    });

    it('renders team members', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Team')).toBeInTheDocument();
      });

      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('CEO')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('CTO')).toBeInTheDocument();

      // João has initials (no photo)
      expect(screen.getByText('JS')).toBeInTheDocument();

      // Maria has photo
      const mariaImg = screen.getByAltText('Maria Santos');
      expect(mariaImg).toHaveAttribute('src', 'https://example.com/maria.jpg');

      // João has LinkedIn link
      expect(screen.getByLabelText('LinkedIn - João Silva')).toHaveAttribute(
        'href',
        'https://linkedin.com/in/joaosilva',
      );
    });

    it('renders documents with file info', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Documents')).toBeInTheDocument();
      });

      expect(screen.getByText('Pitch Deck Q1 2026.pdf')).toBeInTheDocument();
      expect(screen.getByText('Pitch Deck')).toBeInTheDocument();
      expect(screen.getByText('2.4 MB')).toBeInTheDocument();
      expect(screen.getByText('15 pages')).toBeInTheDocument();
    });

    it('renders litigation section with low risk', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Legal Due Diligence')).toBeInTheDocument();
      });

      expect(screen.getByText('Risk Level')).toBeInTheDocument();
      expect(screen.getByText('LOW')).toBeInTheDocument();
      expect(screen.getByText('No active lawsuits found.')).toBeInTheDocument();
    });

    it('renders footer with Navia branding', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Powered by')).toBeInTheDocument();
      });
    });

    it('renders company logo initial when no logo provided', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('A')).toBeInTheDocument(); // First letter of "Acme"
      });
    });

    it('renders company logo image when provided', async () => {
      mockGet.mockResolvedValueOnce({
        ...mockProfile,
        companyLogo: 'https://example.com/logo.png',
      });
      render(<PublicProfilePage />);

      await waitFor(() => {
        const logo = screen.getByAltText('Acme Ltda.');
        expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
      });
    });

    it('hides sections when data is empty', async () => {
      mockGet.mockResolvedValueOnce({
        ...mockProfile,
        metrics: [],
        team: [],
        documents: [],
        litigation: null,
        description: null,
      });
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
      });

      expect(screen.queryByText('Key Metrics')).not.toBeInTheDocument();
      expect(screen.queryByText('Team')).not.toBeInTheDocument();
      expect(screen.queryByText('Documents')).not.toBeInTheDocument();
      expect(screen.queryByText('Legal Due Diligence')).not.toBeInTheDocument();
      expect(screen.queryByText('About')).not.toBeInTheDocument();
    });
  });

  describe('not found state', () => {
    it('renders not found when API returns 404', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError('PROFILE_NOT_FOUND', 'errors.profile.notFound', 404),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile not found')).toBeInTheDocument();
      });
      expect(
        screen.getByText('This profile does not exist or has been removed.'),
      ).toBeInTheDocument();
    });

    it('renders not found for generic errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Profile not found')).toBeInTheDocument();
      });
    });
  });

  describe('email gate', () => {
    it('shows email form when profile requires email', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_EMAIL_REQUIRED',
          'errors.profile.emailRequired',
          403,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByText('Enter your email to continue'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          'The company requires your email to access this profile.',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('name@company.com'),
      ).toBeInTheDocument();
      expect(screen.getByText('View profile')).toBeInTheDocument();
    });

    it('submits email and loads profile', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_EMAIL_REQUIRED',
          'errors.profile.emailRequired',
          403,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('name@company.com'),
        ).toBeInTheDocument();
      });

      // Mock the second call (with email) to succeed
      mockGet.mockResolvedValueOnce(mockProfile);

      const user = userEvent.setup();
      const emailInput = screen.getByPlaceholderText('name@company.com');
      await user.type(emailInput, 'investor@fund.com');
      await user.click(screen.getByText('View profile'));

      await waitFor(() => {
        expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledWith(
        `/api/v1/profiles/${mockSlug}?email=investor%40fund.com`,
      );
    });

    it('shows error when email submission fails', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_EMAIL_REQUIRED',
          'errors.profile.emailRequired',
          403,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('name@company.com'),
        ).toBeInTheDocument();
      });

      // Mock the second call to fail
      mockGet.mockRejectedValueOnce(new Error('Server error'));

      const user = userEvent.setup();
      await user.type(
        screen.getByPlaceholderText('name@company.com'),
        'bad@email.com',
      );
      await user.click(screen.getByText('View profile'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('disables submit button when email is empty', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_EMAIL_REQUIRED',
          'errors.profile.emailRequired',
          403,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('View profile')).toBeDisabled();
      });
    });
  });

  describe('password gate', () => {
    it('shows password form when profile requires password', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_PASSWORD_REQUIRED',
          'errors.profile.passwordRequired',
          401,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByText('This profile is protected'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText('Enter the password shared with you.'),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      expect(screen.getByText('Unlock profile')).toBeInTheDocument();
    });

    it('submits password and loads profile', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_PASSWORD_REQUIRED',
          'errors.profile.passwordRequired',
          401,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      });

      // Mock the second call (with password) to succeed
      mockGet.mockResolvedValueOnce(mockProfile);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Password'), 'secret123');
      await user.click(screen.getByText('Unlock profile'));

      await waitFor(() => {
        expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
      });

      expect(mockGet).toHaveBeenCalledWith(
        `/api/v1/profiles/${mockSlug}?password=secret123`,
      );
    });

    it('shows error for incorrect password', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_PASSWORD_REQUIRED',
          'errors.profile.passwordRequired',
          401,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      });

      // Mock the second call to return invalid password
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_INVALID_PASSWORD',
          'errors.profile.invalidPassword',
          401,
        ),
      );

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Password'), 'wrong');
      await user.click(screen.getByText('Unlock profile'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Incorrect password. Please try again.',
        );
      });
    });

    it('disables submit button when password is empty', async () => {
      mockGet.mockRejectedValueOnce(
        createApiError(
          'PROFILE_PASSWORD_REQUIRED',
          'errors.profile.passwordRequired',
          401,
        ),
      );
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Unlock profile')).toBeDisabled();
      });
    });
  });

  describe('litigation states', () => {
    it('renders pending litigation state', async () => {
      mockGet.mockResolvedValueOnce({
        ...mockProfile,
        litigation: {
          status: 'PENDING',
          fetchedAt: null,
          summary: null,
        },
      });
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByText('Litigation check in progress…'),
        ).toBeInTheDocument();
      });
    });

    it('renders failed litigation state', async () => {
      mockGet.mockResolvedValueOnce({
        ...mockProfile,
        litigation: {
          status: 'FAILED',
          fetchedAt: null,
          summary: null,
          error: 'BigDataCorp unavailable',
        },
      });
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByText('Litigation data unavailable.'),
        ).toBeInTheDocument();
      });
    });

    it('renders litigation with active lawsuits and value', async () => {
      mockGet.mockResolvedValueOnce({
        ...mockProfile,
        litigation: {
          status: 'COMPLETED',
          fetchedAt: '2026-02-19T12:00:00.000Z',
          summary: {
            activeLawsuits: 3,
            historicalLawsuits: 5,
            activeAdministrative: 1,
            protests: 0,
            totalValueInDispute: '150000.00',
            riskLevel: 'HIGH',
          },
        },
      });
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      });
      expect(screen.getByText(/3 active lawsuits/)).toBeInTheDocument();
    });
  });

  describe('API call', () => {
    it('calls the correct API endpoint on mount', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      render(<PublicProfilePage />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          `/api/v1/profiles/${mockSlug}`,
        );
      });
    });

    it('only fetches once even on re-render', async () => {
      mockGet.mockResolvedValueOnce(mockProfile);
      const { rerender } = render(<PublicProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Ltda.')).toBeInTheDocument();
      });

      rerender(<PublicProfilePage />);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });
});
