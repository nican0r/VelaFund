import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationsPage from '../page';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => {
    const translations: Record<string, string> = {
      title: 'Notifications',
      description: 'View and manage your notifications.',
      empty: 'No notifications yet',
      emptyDescription: 'You will see your notifications here.',
      emptyFiltered: 'No notifications match your filters',
      loadError: 'Failed to load notifications',
      retry: 'Try again',
      markAllRead: 'Mark all as read',
      markAllReadSuccess: 'All notifications marked as read',
      clearFilters: 'Clear filters',
      deleteSuccess: 'Notification deleted',
      viewAll: 'View all notifications',
      'filters.all': 'All',
      'filters.unreadOnly': 'Unread only',
      'filters.readOnly': 'Read only',
      'filters.allTypes': 'All types',
      'filters.transactions': 'Transactions',
      'filters.documents': 'Documents',
      'filters.options': 'Options',
      'filters.fundingRounds': 'Funding Rounds',
      'filters.security': 'Security',
      'preferences.title': 'Preferences',
      'preferences.description': 'Choose which notifications you want to receive.',
      'preferences.security': 'Security',
      'preferences.transactions': 'Transactions',
      'preferences.documents': 'Documents',
      'preferences.options': 'Options',
      'preferences.fundingRounds': 'Funding Rounds',
      'preferences.securityLocked': 'Security notifications cannot be disabled.',
      'preferences.transactionsDescription': 'Share issuances, transfers, and shareholder changes.',
      'preferences.documentsDescription': 'Document signatures and approvals.',
      'preferences.optionsDescription': 'Option grants, vesting, and exercises.',
      'preferences.fundingRoundsDescription': 'Round invitations and closings.',
      'preferences.save': 'Save preferences',
      'preferences.saveSuccess': 'Preferences saved',
      'types.SHARES_ISSUED': 'Shares Issued',
      'types.DOCUMENT_SIGNED': 'Document Signed',
      'types.KYC_COMPLETED': 'KYC Completed',
      'types.OPTION_GRANTED': 'Option Granted',
      'types.ROUND_CLOSED': 'Round Closed',
    };
    return (key: string, params?: Record<string, unknown>) => {
      if (key.startsWith('time.')) {
        if (key === 'time.now') return 'Just now';
        if (key === 'time.minutesAgo') return `${params?.count}m ago`;
        if (key === 'time.hoursAgo') return `${params?.count}h ago`;
        if (key === 'time.daysAgo') return `${params?.count}d ago`;
      }
      return translations[key] ?? key;
    };
  },
}));

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock error toast
jest.mock('@/lib/use-error-toast', () => ({
  useErrorToast: () => jest.fn(),
}));

// Mock hooks
const mockMarkAsReadMutate = jest.fn();
const mockMarkAllAsReadMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockUpdatePrefsMutate = jest.fn();

jest.mock('@/hooks/use-notifications', () => ({
  useNotifications: jest.fn(),
  useMarkAsRead: jest.fn(() => ({
    mutate: mockMarkAsReadMutate,
    isPending: false,
  })),
  useMarkAllAsRead: jest.fn(() => ({
    mutate: mockMarkAllAsReadMutate,
    isPending: false,
  })),
  useDeleteNotification: jest.fn(() => ({
    mutate: mockDeleteMutate,
    isPending: false,
  })),
  useNotificationPreferences: jest.fn(),
  useUpdatePreferences: jest.fn(() => ({
    mutate: mockUpdatePrefsMutate,
    isPending: false,
  })),
}));

import { toast } from 'sonner';
import {
  useNotifications,
  useNotificationPreferences,
} from '@/hooks/use-notifications';

const mockNotifications = [
  {
    id: 'n1',
    notificationType: 'SHARES_ISSUED' as const,
    subject: '1000 shares issued to João',
    body: 'Shares issued for Acme',
    status: 'SENT' as const,
    read: false,
    readAt: null,
    relatedEntityType: 'Transaction',
    relatedEntityId: 'tx1',
    companyId: 'c1',
    companyName: 'Acme Ltda',
    createdAt: '2026-02-20T14:30:00.000Z',
  },
  {
    id: 'n2',
    notificationType: 'DOCUMENT_SIGNED' as const,
    subject: 'Document signed by Maria',
    body: 'Agreement signed',
    status: 'SENT' as const,
    read: true,
    readAt: '2026-02-20T16:00:00.000Z',
    relatedEntityType: 'Document',
    relatedEntityId: 'doc1',
    companyId: 'c1',
    companyName: 'Acme Ltda',
    createdAt: '2026-02-20T12:00:00.000Z',
  },
  {
    id: 'n3',
    notificationType: 'OPTION_GRANTED' as const,
    subject: 'Options granted to Carlos',
    body: '5000 options granted',
    status: 'SENT' as const,
    read: false,
    readAt: null,
    relatedEntityType: 'OptionGrant',
    relatedEntityId: 'og1',
    companyId: 'c1',
    companyName: 'Acme Ltda',
    createdAt: '2026-02-19T10:00:00.000Z',
  },
];

const mockPreferences = {
  categories: {
    transactions: true,
    documents: true,
    options: true,
    fundingRounds: true,
    security: true,
  },
  updatedAt: '2026-02-20T10:00:00.000Z',
};

function setupMocks(overrides?: {
  notifications?: unknown;
  preferences?: unknown;
}) {
  (useNotifications as jest.Mock).mockReturnValue({
    data: {
      data: mockNotifications,
      meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
    },
    isLoading: false,
    error: null,
    ...overrides?.notifications,
  });

  (useNotificationPreferences as jest.Mock).mockReturnValue({
    data: mockPreferences,
    isLoading: false,
    error: null,
    ...overrides?.preferences,
  });
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  // --- Page Header ---

  describe('Page Header', () => {
    it('renders page title', () => {
      render(<NotificationsPage />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Notifications');
    });

    it('renders page description', () => {
      render(<NotificationsPage />);
      expect(screen.getByText('View and manage your notifications.')).toBeInTheDocument();
    });
  });

  // --- Tab Navigation ---

  describe('Tab Navigation', () => {
    it('renders both tabs', () => {
      render(<NotificationsPage />);
      // Title + tab both say "Notifications", so use getAllByText
      const notifTexts = screen.getAllByText('Notifications');
      expect(notifTexts.length).toBeGreaterThanOrEqual(2); // h1 + tab
      expect(screen.getByText('Preferences')).toBeInTheDocument();
    });

    it('shows All tab content by default', () => {
      render(<NotificationsPage />);
      // Notifications should be visible
      expect(screen.getByText('1000 shares issued to João')).toBeInTheDocument();
    });

    it('switches to Preferences tab when clicked', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      expect(screen.getByText('Choose which notifications you want to receive.')).toBeInTheDocument();
    });
  });

  // --- All Notifications Tab ---

  describe('All Notifications Tab', () => {
    it('renders notification items', () => {
      render(<NotificationsPage />);
      expect(screen.getByText('1000 shares issued to João')).toBeInTheDocument();
      expect(screen.getByText('Document signed by Maria')).toBeInTheDocument();
      expect(screen.getByText('Options granted to Carlos')).toBeInTheDocument();
    });

    it('shows notification body text', () => {
      render(<NotificationsPage />);
      expect(screen.getByText('Shares issued for Acme')).toBeInTheDocument();
    });

    it('shows company name', () => {
      render(<NotificationsPage />);
      expect(screen.getAllByText('Acme Ltda').length).toBe(3);
    });

    it('shows notification type badges', () => {
      render(<NotificationsPage />);
      expect(screen.getByText('Shares Issued')).toBeInTheDocument();
      expect(screen.getByText('Document Signed')).toBeInTheDocument();
      expect(screen.getByText('Option Granted')).toBeInTheDocument();
    });

    it('shows loading skeletons while fetching', () => {
      setupMocks({ notifications: { data: undefined, isLoading: true } });
      render(<NotificationsPage />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state', () => {
      setupMocks({
        notifications: {
          data: undefined,
          isLoading: false,
          error: new Error('Network error'),
        },
      });
      render(<NotificationsPage />);
      expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('shows empty state when no notifications', () => {
      setupMocks({
        notifications: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
        },
      });
      render(<NotificationsPage />);
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    });

    it('shows filtered empty state when filters active and no results', () => {
      setupMocks({
        notifications: {
          data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
          isLoading: false,
        },
      });
      render(<NotificationsPage />);
      // Select unread filter
      const readSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(readSelect, { target: { value: 'false' } });
      expect(screen.getByText('No notifications match your filters')).toBeInTheDocument();
    });
  });

  // --- Filters ---

  describe('Filters', () => {
    it('renders read status filter', () => {
      render(<NotificationsPage />);
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBe(2);
    });

    it('renders category filter', () => {
      render(<NotificationsPage />);
      const selects = screen.getAllByRole('combobox');
      expect(selects[1]).toBeInTheDocument();
    });

    it('filters by category client-side', () => {
      render(<NotificationsPage />);
      const categorySelect = screen.getAllByRole('combobox')[1];
      // Filter to "documents" category — only n2 (DOCUMENT_SIGNED) should show
      fireEvent.change(categorySelect, { target: { value: 'documents' } });
      expect(screen.getByText('Document signed by Maria')).toBeInTheDocument();
      expect(screen.queryByText('1000 shares issued to João')).not.toBeInTheDocument();
      expect(screen.queryByText('Options granted to Carlos')).not.toBeInTheDocument();
    });

    it('shows clear filters button when filters are active', () => {
      render(<NotificationsPage />);
      const readSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(readSelect, { target: { value: 'false' } });
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('does not show clear filters button when no filters active', () => {
      render(<NotificationsPage />);
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    });

    it('clears filters when clear button is clicked', () => {
      render(<NotificationsPage />);
      const categorySelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(categorySelect, { target: { value: 'documents' } });
      expect(screen.queryByText('1000 shares issued to João')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Clear filters'));
      // All notifications should be visible again
      expect(screen.getByText('1000 shares issued to João')).toBeInTheDocument();
      expect(screen.getByText('Options granted to Carlos')).toBeInTheDocument();
    });
  });

  // --- Actions ---

  describe('Actions', () => {
    it('shows mark all as read button when there are unread notifications', () => {
      render(<NotificationsPage />);
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });

    it('hides mark all as read when all notifications are read', () => {
      const allRead = mockNotifications.map((n) => ({ ...n, read: true }));
      setupMocks({
        notifications: {
          data: { data: allRead, meta: { total: 3, page: 1, limit: 20, totalPages: 1 } },
          isLoading: false,
        },
      });
      render(<NotificationsPage />);
      expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument();
    });

    it('calls markAllAsRead mutation when button clicked', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Mark all as read'));
      expect(mockMarkAllAsReadMutate).toHaveBeenCalled();
    });

    it('shows mark as read button for unread notifications only', () => {
      render(<NotificationsPage />);
      const markAsReadButtons = screen.getAllByTitle('Mark as read');
      // n1 and n3 are unread
      expect(markAsReadButtons).toHaveLength(2);
    });

    it('calls markAsRead when clicking mark as read button', () => {
      render(<NotificationsPage />);
      const markAsReadButtons = screen.getAllByTitle('Mark as read');
      fireEvent.click(markAsReadButtons[0]);
      expect(mockMarkAsReadMutate).toHaveBeenCalledWith('n1');
    });

    it('shows delete button for each notification', () => {
      render(<NotificationsPage />);
      const deleteButtons = screen.getAllByTitle('Delete');
      expect(deleteButtons).toHaveLength(3);
    });

    it('opens delete confirmation dialog when delete is clicked', () => {
      render(<NotificationsPage />);
      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);
      // Dialog should appear with confirmation text
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('closes delete confirmation dialog when cancel is clicked', () => {
      render(<NotificationsPage />);
      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);
      fireEvent.click(screen.getByText('Cancel'));
      // Dialog should close - notification subjects still visible but no dialog buttons
      // The "Delete" button title should still exist (on icon buttons) but not the dialog's "Delete" text button
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('calls delete mutation when confirming delete', () => {
      render(<NotificationsPage />);
      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);
      // Click the "Delete" button in the confirmation dialog
      const dialogDeleteBtn = screen.getAllByText('Delete').find(
        (el) => el.tagName === 'BUTTON' && el.closest('.fixed'),
      );
      expect(dialogDeleteBtn).toBeInTheDocument();
      fireEvent.click(dialogDeleteBtn!);
      expect(mockDeleteMutate).toHaveBeenCalled();
    });
  });

  // --- Pagination ---

  describe('Pagination', () => {
    it('does not show pagination when only one page', () => {
      render(<NotificationsPage />);
      // Single page — no pagination controls
      const prevButtons = screen.queryAllByRole('button').filter((btn) =>
        btn.querySelector('svg') && btn.classList.contains('disabled:opacity-40'),
      );
      // With totalPages=1, pagination section is not rendered
      expect(screen.queryByText('1–3 / 3')).not.toBeInTheDocument();
    });

    it('shows pagination when multiple pages', () => {
      setupMocks({
        notifications: {
          data: {
            data: mockNotifications,
            meta: { total: 45, page: 1, limit: 20, totalPages: 3 },
          },
          isLoading: false,
        },
      });
      render(<NotificationsPage />);
      expect(screen.getByText('1–20 / 45')).toBeInTheDocument();
    });
  });

  // --- Preferences Tab ---

  describe('Preferences Tab', () => {
    it('shows preferences content when tab is clicked', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      expect(screen.getByText('Choose which notifications you want to receive.')).toBeInTheDocument();
    });

    it('renders all category toggles', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(5);
    });

    it('shows loading skeletons for preferences', () => {
      setupMocks({ preferences: { data: undefined, isLoading: true } });
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows category labels', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Options')).toBeInTheDocument();
      expect(screen.getByText('Funding Rounds')).toBeInTheDocument();
    });

    it('shows security category as locked', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      expect(screen.getByText('Security notifications cannot be disabled.')).toBeInTheDocument();
    });

    it('security toggle is disabled', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      const switches = screen.getAllByRole('switch');
      // Security is first in the list
      expect(switches[0]).toBeDisabled();
    });

    it('shows save button after toggling a preference', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      // Initially no save button
      expect(screen.queryByText('Save preferences')).not.toBeInTheDocument();
      // Toggle transactions (second switch, index 1)
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[1]); // Transactions toggle
      expect(screen.getByText('Save preferences')).toBeInTheDocument();
    });

    it('does not show save button when toggling security (locked)', () => {
      render(<NotificationsPage />);
      fireEvent.click(screen.getByText('Preferences'));
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]); // Security toggle (disabled)
      expect(screen.queryByText('Save preferences')).not.toBeInTheDocument();
    });
  });
});
