import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '../common/filters/app-exception';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  userNotificationPreferences: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
};

const USER_ID = 'user-uuid-1';
const NOTIFICATION_ID = 'notif-uuid-1';

const mockNotification = {
  id: NOTIFICATION_ID,
  userId: USER_ID,
  channel: 'IN_APP',
  notificationType: 'SHARES_ISSUED',
  subject: '10.000 ações ON emitidas',
  body: 'Suas ações foram emitidas com sucesso.',
  status: 'PENDING',
  readAt: null,
  sentAt: null,
  failedAt: null,
  failureReason: null,
  metadata: {
    relatedEntityType: 'Transaction',
    relatedEntityId: 'txn-uuid-1',
    companyId: 'company-uuid-1',
    companyName: 'Acme Ltda.',
  },
  createdAt: new Date('2026-02-25T10:00:00.000Z'),
};

const mockReadNotification = {
  ...mockNotification,
  id: 'notif-uuid-2',
  readAt: new Date('2026-02-25T12:00:00.000Z'),
};

const mockPreferences = {
  id: 'pref-uuid-1',
  userId: USER_ID,
  transactions: true,
  documents: true,
  options: true,
  fundingRounds: true,
  security: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-25T10:00:00.000Z'),
};

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: typeof mockPrisma;
  let queue: typeof mockQueue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('notification'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get(PrismaService) as any;
    queue = module.get(getQueueToken('notification'));
  });

  // ==========================================================================
  // create (queue notification)
  // ==========================================================================

  describe('create', () => {
    const payload = {
      userId: USER_ID,
      notificationType: 'SHARES_ISSUED',
      subject: 'Shares issued',
      body: 'Your shares have been issued.',
      relatedEntityType: 'Transaction',
      relatedEntityId: 'txn-uuid-1',
      companyId: 'company-uuid-1',
      companyName: 'Acme Ltda.',
    };

    it('should queue a notification when preferences allow it', async () => {
      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue(
        mockPreferences,
      );

      await service.create(payload);

      expect(queue.add).toHaveBeenCalledWith(
        'create-notification',
        payload,
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should queue a notification when no preferences exist (defaults to enabled)', async () => {
      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue(null);

      await service.create(payload);

      expect(queue.add).toHaveBeenCalledWith(
        'create-notification',
        payload,
        expect.any(Object),
      );
    });

    it('should skip notification when category is disabled', async () => {
      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue({
        ...mockPreferences,
        transactions: false,
      });

      await service.create(payload);

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should always queue critical notifications even if category disabled', async () => {
      const criticalPayload = {
        ...payload,
        notificationType: 'KYC_COMPLETED',
      };

      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue({
        ...mockPreferences,
        security: false, // Even if somehow false, critical notifications go through
      });

      await service.create(criticalPayload);

      expect(queue.add).toHaveBeenCalledWith(
        'create-notification',
        criticalPayload,
        expect.any(Object),
      );
    });

    it('should skip funding round notification when category disabled', async () => {
      const roundPayload = {
        ...payload,
        notificationType: 'ROUND_INVITATION',
      };

      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue({
        ...mockPreferences,
        fundingRounds: false,
      });

      await service.create(roundPayload);

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should skip option notification when category disabled', async () => {
      const optionPayload = {
        ...payload,
        notificationType: 'OPTION_GRANTED',
      };

      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue({
        ...mockPreferences,
        options: false,
      });

      await service.create(optionPayload);

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should queue notification for unknown type (no category mapping)', async () => {
      const unknownPayload = {
        ...payload,
        notificationType: 'CUSTOM_EVENT',
      };

      await service.create(unknownPayload);

      expect(queue.add).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // persistNotification
  // ==========================================================================

  describe('persistNotification', () => {
    it('should persist notification with metadata', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      await service.persistNotification({
        userId: USER_ID,
        notificationType: 'SHARES_ISSUED',
        subject: 'Shares issued',
        body: 'Your shares have been issued.',
        relatedEntityType: 'Transaction',
        relatedEntityId: 'txn-uuid-1',
        companyId: 'company-uuid-1',
        companyName: 'Acme Ltda.',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          channel: 'IN_APP',
          notificationType: 'SHARES_ISSUED',
          subject: 'Shares issued',
          body: 'Your shares have been issued.',
          status: 'PENDING',
          metadata: {
            relatedEntityType: 'Transaction',
            relatedEntityId: 'txn-uuid-1',
            companyId: 'company-uuid-1',
            companyName: 'Acme Ltda.',
          },
        },
      });
    });

    it('should persist notification without metadata when none provided', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      await service.persistNotification({
        userId: USER_ID,
        notificationType: 'KYC_COMPLETED',
        subject: 'KYC approved',
        body: 'Your KYC verification has been approved.',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          channel: 'IN_APP',
          notificationType: 'KYC_COMPLETED',
          subject: 'KYC approved',
          body: 'Your KYC verification has been approved.',
          status: 'PENDING',
          metadata: undefined,
        },
      });
    });
  });

  // ==========================================================================
  // findAll
  // ==========================================================================

  describe('findAll', () => {
    it('should return paginated notifications with defaults', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: NOTIFICATION_ID,
          notificationType: 'SHARES_ISSUED',
          read: false,
          companyName: 'Acme Ltda.',
        }),
      );
    });

    it('should filter by unread notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { page: 1, limit: 20, read: 'false' });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, readAt: null },
        }),
      );
    });

    it('should filter by read notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { page: 1, limit: 20, read: 'true' });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, readAt: { not: null } },
        }),
      );
    });

    it('should filter by notification type', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.findAll(USER_ID, {
        page: 1,
        limit: 20,
        notificationType: 'SHARES_ISSUED',
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, notificationType: 'SHARES_ISSUED' },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(50);

      await service.findAll(USER_ID, { page: 3, limit: 10 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should sort by createdAt descending by default', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { page: 1, limit: 20 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }],
        }),
      );
    });

    it('should sort by notificationType ascending when specified', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.findAll(USER_ID, {
        page: 1,
        limit: 20,
        sort: 'notificationType',
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ notificationType: 'asc' }],
        }),
      );
    });

    it('should transform notification metadata correctly', async () => {
      const noMetadata = {
        ...mockNotification,
        metadata: null,
      };
      mockPrisma.notification.findMany.mockResolvedValue([noMetadata]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, { page: 1, limit: 20 });

      expect(result.items[0].relatedEntityType).toBeNull();
      expect(result.items[0].relatedEntityId).toBeNull();
      expect(result.items[0].companyId).toBeNull();
      expect(result.items[0].companyName).toBeNull();
    });
  });

  // ==========================================================================
  // findById
  // ==========================================================================

  describe('findById', () => {
    it('should return notification detail', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockNotification);

      const result = await service.findById(USER_ID, NOTIFICATION_ID);

      expect(result).toEqual(
        expect.objectContaining({
          id: NOTIFICATION_ID,
          notificationType: 'SHARES_ISSUED',
          body: mockNotification.body,
          read: false,
          readAt: null,
        }),
      );
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.findById(USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return read notification with readAt timestamp', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockReadNotification);

      const result = await service.findById(USER_ID, mockReadNotification.id);

      expect(result.read).toBe(true);
      expect(result.readAt).toBe('2026-02-25T12:00:00.000Z');
    });
  });

  // ==========================================================================
  // getUnreadCount
  // ==========================================================================

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: USER_ID, readAt: null },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toBe(0);
    });
  });

  // ==========================================================================
  // markAsRead
  // ==========================================================================

  describe('markAsRead', () => {
    it('should mark an unread notification as read', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockNotification);
      const readAt = new Date('2026-02-25T14:00:00.000Z');
      mockPrisma.notification.update.mockResolvedValue({
        ...mockNotification,
        readAt,
      });

      const result = await service.markAsRead(USER_ID, NOTIFICATION_ID);

      expect(result.id).toBe(NOTIFICATION_ID);
      expect(result.read).toBe(true);
      expect(result.readAt).toBe(readAt.toISOString());
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should return existing readAt when already read', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockReadNotification);

      const result = await service.markAsRead(USER_ID, mockReadNotification.id);

      expect(result.read).toBe(true);
      expect(result.readAt).toBe('2026-02-25T12:00:00.000Z');
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead(USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // markAllAsRead
  // ==========================================================================

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 7 });

      const result = await service.markAllAsRead(USER_ID);

      expect(result).toEqual({ updatedCount: 7 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead(USER_ID);

      expect(result).toEqual({ updatedCount: 0 });
    });
  });

  // ==========================================================================
  // getPreferences
  // ==========================================================================

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getPreferences(USER_ID);

      expect(result).toEqual({
        categories: {
          transactions: true,
          documents: true,
          options: true,
          fundingRounds: true,
          security: true,
        },
        updatedAt: mockPreferences.updatedAt.toISOString(),
      });
    });

    it('should create default preferences when none exist', async () => {
      mockPrisma.userNotificationPreferences.findUnique.mockResolvedValue(null);
      mockPrisma.userNotificationPreferences.create.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getPreferences(USER_ID);

      expect(prisma.userNotificationPreferences.create).toHaveBeenCalledWith({
        data: { userId: USER_ID },
      });
      expect(result.categories.transactions).toBe(true);
    });
  });

  // ==========================================================================
  // updatePreferences
  // ==========================================================================

  describe('updatePreferences', () => {
    it('should update preferences and enforce security=true', async () => {
      const updatedPrefs = {
        ...mockPreferences,
        documents: false,
      };
      mockPrisma.userNotificationPreferences.upsert.mockResolvedValue(
        updatedPrefs,
      );

      const result = await service.updatePreferences(USER_ID, {
        documents: false,
      });

      expect(prisma.userNotificationPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        create: expect.objectContaining({
          userId: USER_ID,
          documents: false,
          security: true,
        }),
        update: expect.objectContaining({
          documents: false,
          security: true,
        }),
      });
      expect(result.categories.documents).toBe(false);
    });

    it('should ignore security=false in input and enforce true', async () => {
      mockPrisma.userNotificationPreferences.upsert.mockResolvedValue(
        mockPreferences,
      );

      await service.updatePreferences(USER_ID, {
        transactions: false,
      } as any);

      expect(prisma.userNotificationPreferences.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ security: true }),
        }),
      );
    });

    it('should update multiple categories at once', async () => {
      const updatedPrefs = {
        ...mockPreferences,
        transactions: false,
        options: false,
        fundingRounds: false,
      };
      mockPrisma.userNotificationPreferences.upsert.mockResolvedValue(
        updatedPrefs,
      );

      const result = await service.updatePreferences(USER_ID, {
        transactions: false,
        options: false,
        fundingRounds: false,
      });

      expect(result.categories.transactions).toBe(false);
      expect(result.categories.options).toBe(false);
      expect(result.categories.fundingRounds).toBe(false);
      expect(result.categories.security).toBe(true);
    });

    it('should create preferences via upsert when they do not exist', async () => {
      mockPrisma.userNotificationPreferences.upsert.mockResolvedValue(
        mockPreferences,
      );

      await service.updatePreferences(USER_ID, { documents: true });

      expect(prisma.userNotificationPreferences.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          create: expect.objectContaining({ userId: USER_ID }),
        }),
      );
    });
  });

  // ==========================================================================
  // delete
  // ==========================================================================

  describe('delete', () => {
    it('should delete a notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrisma.notification.delete.mockResolvedValue(mockNotification);

      await service.delete(USER_ID, NOTIFICATION_ID);

      expect(prisma.notification.delete).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
