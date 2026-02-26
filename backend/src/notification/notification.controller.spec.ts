import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotFoundException } from '../common/filters/app-exception';

const USER_ID = 'user-uuid-1';
const NOTIFICATION_ID = 'notif-uuid-1';

const mockNotification = {
  id: NOTIFICATION_ID,
  notificationType: 'SHARES_ISSUED',
  subject: '10.000 ações ON emitidas',
  status: 'PENDING',
  read: false,
  relatedEntityType: 'Transaction',
  relatedEntityId: 'txn-uuid-1',
  companyId: 'company-uuid-1',
  companyName: 'Acme Ltda.',
  createdAt: '2026-02-25T10:00:00.000Z',
};

const mockNotificationDetail = {
  ...mockNotification,
  body: 'Suas ações foram emitidas com sucesso.',
  readAt: null,
};

const mockPreferences = {
  categories: {
    transactions: true,
    documents: true,
    options: true,
    fundingRounds: true,
    security: true,
  },
  updatedAt: '2026-02-25T10:00:00.000Z',
};

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  delete: jest.fn(),
};

describe('NotificationController', () => {
  let controller: NotificationController;
  let _service: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: mockService }],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    _service = module.get(NotificationService) as jest.Mocked<NotificationService>;
  });

  // ==========================================================================
  // GET /api/v1/users/me/notifications
  // ==========================================================================

  describe('list', () => {
    it('should return paginated notifications', async () => {
      mockService.findAll.mockResolvedValue({
        items: [mockNotification],
        total: 1,
      });

      const result = await controller.list(USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockNotification],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
      expect(mockService.findAll).toHaveBeenCalledWith(USER_ID, {
        page: 1,
        limit: 20,
      });
    });

    it('should pass query filters to service', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.list(USER_ID, {
        page: 2,
        limit: 10,
        read: 'false',
        notificationType: 'SHARES_ISSUED',
        sort: '-createdAt',
      });

      expect(mockService.findAll).toHaveBeenCalledWith(USER_ID, {
        page: 2,
        limit: 10,
        read: 'false',
        notificationType: 'SHARES_ISSUED',
        sort: '-createdAt',
      });
    });

    it('should return empty list when no notifications', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.list(USER_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ==========================================================================
  // GET /api/v1/users/me/notifications/unread-count
  // ==========================================================================

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockService.getUnreadCount.mockResolvedValue(3);

      const result = await controller.getUnreadCount(USER_ID);

      expect(result).toEqual({ count: 3 });
    });

    it('should return 0 when no unread', async () => {
      mockService.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(USER_ID);

      expect(result).toEqual({ count: 0 });
    });
  });

  // ==========================================================================
  // GET /api/v1/users/me/notifications/preferences
  // ==========================================================================

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      mockService.getPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferences(USER_ID);

      expect(result).toEqual(mockPreferences);
      expect(mockService.getPreferences).toHaveBeenCalledWith(USER_ID);
    });
  });

  // ==========================================================================
  // PUT /api/v1/users/me/notifications/preferences
  // ==========================================================================

  describe('updatePreferences', () => {
    it('should update preferences', async () => {
      const updated = {
        ...mockPreferences,
        categories: { ...mockPreferences.categories, documents: false },
      };
      mockService.updatePreferences.mockResolvedValue(updated);

      const result = await controller.updatePreferences(USER_ID, {
        documents: false,
      });

      expect(result.categories.documents).toBe(false);
      expect(mockService.updatePreferences).toHaveBeenCalledWith(USER_ID, {
        documents: false,
      });
    });
  });

  // ==========================================================================
  // PUT /api/v1/users/me/notifications/read-all
  // ==========================================================================

  describe('markAllAsRead', () => {
    it('should mark all as read and return count', async () => {
      mockService.markAllAsRead.mockResolvedValue({ updatedCount: 5 });

      const result = await controller.markAllAsRead(USER_ID);

      expect(result).toEqual({ updatedCount: 5 });
      expect(mockService.markAllAsRead).toHaveBeenCalledWith(USER_ID);
    });
  });

  // ==========================================================================
  // GET /api/v1/users/me/notifications/:id
  // ==========================================================================

  describe('getOne', () => {
    it('should return notification detail', async () => {
      mockService.findById.mockResolvedValue(mockNotificationDetail);

      const result = await controller.getOne(USER_ID, NOTIFICATION_ID);

      expect(result).toEqual(mockNotificationDetail);
      expect(mockService.findById).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException('notification', 'nonexistent'));

      await expect(controller.getOne(USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // PUT /api/v1/users/me/notifications/:id/read
  // ==========================================================================

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const readResult = {
        id: NOTIFICATION_ID,
        read: true,
        readAt: '2026-02-25T14:00:00.000Z',
      };
      mockService.markAsRead.mockResolvedValue(readResult);

      const result = await controller.markAsRead(USER_ID, NOTIFICATION_ID);

      expect(result).toEqual(readResult);
      expect(mockService.markAsRead).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
    });

    it('should propagate NotFoundException', async () => {
      mockService.markAsRead.mockRejectedValue(
        new NotFoundException('notification', 'nonexistent'),
      );

      await expect(controller.markAsRead(USER_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================================================
  // DELETE /api/v1/users/me/notifications/:id
  // ==========================================================================

  describe('delete', () => {
    it('should delete a notification', async () => {
      mockService.delete.mockResolvedValue(undefined);

      await controller.delete(USER_ID, NOTIFICATION_ID);

      expect(mockService.delete).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
    });

    it('should propagate NotFoundException', async () => {
      mockService.delete.mockRejectedValue(new NotFoundException('notification', 'nonexistent'));

      await expect(controller.delete(USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
