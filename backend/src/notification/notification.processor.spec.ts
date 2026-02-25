import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProcessor } from './notification.processor';
import { NotificationService } from './notification.service';

const mockService = {
  persistNotification: jest.fn(),
};

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: NotificationService, useValue: mockService },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
  });

  describe('handleCreateNotification', () => {
    it('should call persistNotification with job data', async () => {
      const payload = {
        userId: 'user-uuid-1',
        notificationType: 'SHARES_ISSUED',
        subject: 'Shares issued',
        body: 'Your shares have been issued.',
        relatedEntityType: 'Transaction',
        relatedEntityId: 'txn-uuid-1',
        companyId: 'company-uuid-1',
        companyName: 'Acme Ltda.',
      };

      const mockJob = {
        id: 'job-1',
        data: payload,
      };

      mockService.persistNotification.mockResolvedValue(undefined);

      await processor.handleCreateNotification(mockJob as any);

      expect(mockService.persistNotification).toHaveBeenCalledWith(payload);
    });

    it('should propagate errors from persistNotification', async () => {
      const mockJob = {
        id: 'job-2',
        data: {
          userId: 'user-uuid-1',
          notificationType: 'KYC_COMPLETED',
          subject: 'KYC approved',
          body: 'Your KYC has been approved.',
        },
      };

      const error = new Error('Database error');
      mockService.persistNotification.mockRejectedValue(error);

      await expect(
        processor.handleCreateNotification(mockJob as any),
      ).rejects.toThrow('Database error');
    });
  });
});
