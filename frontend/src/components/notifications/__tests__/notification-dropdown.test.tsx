import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationDropdown } from '../notification-dropdown';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => {
    const translations: Record<string, string> = {
      title: 'Notifications',
      markAllRead: 'Mark all as read',
      empty: 'No notifications yet',
      emptyDescription: 'You will see your notifications here.',
      viewAll: 'View all notifications',
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

// Mock hooks
const mockMutate = jest.fn();
const mockMutateAllRead = jest.fn();

jest.mock('@/hooks/use-notifications', () => ({
  useNotifications: jest.fn(),
  useMarkAsRead: jest.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
  useMarkAllAsRead: jest.fn(() => ({
    mutate: mockMutateAllRead,
    isPending: false,
  })),
}));

import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/hooks/use-notifications';

const mockNotifications = [
  {
    id: 'n1',
    notificationType: 'SHARES_ISSUED' as const,
    subject: '1000 shares issued to João Silva',
    body: 'Shares issued successfully',
    status: 'SENT' as const,
    read: false,
    readAt: null,
    relatedEntityType: 'Transaction',
    relatedEntityId: 'tx1',
    companyId: 'c1',
    companyName: 'Acme Ltda',
    createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
  },
  {
    id: 'n2',
    notificationType: 'DOCUMENT_SIGNED' as const,
    subject: 'Document signed by Maria Santos',
    body: 'Shareholders agreement signed',
    status: 'SENT' as const,
    read: true,
    readAt: new Date().toISOString(),
    relatedEntityType: 'Document',
    relatedEntityId: 'doc1',
    companyId: 'c1',
    companyName: 'Acme Ltda',
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  },
  {
    id: 'n3',
    notificationType: 'KYC_COMPLETED' as const,
    subject: 'KYC verification completed',
    body: 'Your identity has been verified',
    status: 'SENT' as const,
    read: true,
    readAt: new Date().toISOString(),
    relatedEntityType: null,
    relatedEntityId: null,
    companyId: null,
    companyName: null,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
  },
];

function setupMocks(overrides?: {
  notifications?: unknown;
}) {
  (useNotifications as jest.Mock).mockReturnValue({
    data: {
      data: mockNotifications,
      meta: { total: 3, page: 1, limit: 5, totalPages: 1 },
    },
    isLoading: false,
    error: null,
    ...overrides?.notifications,
  });
}

describe('NotificationDropdown', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <NotificationDropdown open={false} onClose={onClose} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dropdown when open', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows loading skeletons while fetching', () => {
    setupMocks({ notifications: { data: undefined, isLoading: true } });
    render(<NotificationDropdown open={true} onClose={onClose} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no notifications', () => {
    setupMocks({
      notifications: {
        data: { data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 0 } },
        isLoading: false,
      },
    });
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    expect(screen.getByText('You will see your notifications here.')).toBeInTheDocument();
  });

  it('renders notification items', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.getByText('1000 shares issued to João Silva')).toBeInTheDocument();
    expect(screen.getByText('Document signed by Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('KYC verification completed')).toBeInTheDocument();
  });

  it('shows company name for notifications with company', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.getAllByText('Acme Ltda').length).toBe(2);
  });

  it('shows relative time for notifications', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.getByText('2m ago')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
  });

  it('shows mark all as read button when there are unread notifications', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.getByText('Mark all as read')).toBeInTheDocument();
  });

  it('hides mark all as read button when all notifications are read', () => {
    const allRead = mockNotifications.map((n) => ({ ...n, read: true }));
    setupMocks({
      notifications: {
        data: { data: allRead, meta: { total: 3, page: 1, limit: 5, totalPages: 1 } },
        isLoading: false,
      },
    });
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument();
  });

  it('shows mark as read button for unread notification only', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    const markAsReadButtons = screen.getAllByTitle('Mark as read');
    // Only 1 unread notification (n1)
    expect(markAsReadButtons).toHaveLength(1);
  });

  it('calls markAsRead when clicking mark as read button', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    const markAsReadBtn = screen.getByTitle('Mark as read');
    fireEvent.click(markAsReadBtn);
    expect(mockMutate).toHaveBeenCalledWith('n1');
  });

  it('calls markAllAsRead when clicking mark all as read', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Mark all as read'));
    expect(mockMutateAllRead).toHaveBeenCalled();
  });

  it('renders view all link to notifications page', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    const viewAllLink = screen.getByText('View all notifications');
    expect(viewAllLink.closest('a')).toHaveAttribute('href', '/dashboard/notifications');
  });

  it('calls onClose when view all link is clicked', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('View all notifications'));
    expect(onClose).toHaveBeenCalled();
  });

  it('has correct aria-label on the menu', () => {
    render(<NotificationDropdown open={true} onClose={onClose} />);
    expect(screen.getByRole('menu')).toHaveAttribute('aria-label', 'Notifications');
  });
});
