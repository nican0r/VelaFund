import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationService } from './notification.service';
import { CreateNotificationPayload } from './dto/create-notification.dto';

@Processor('notification')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Process('create-notification')
  async handleCreateNotification(job: Job<CreateNotificationPayload>) {
    const payload = job.data;
    this.logger.debug(
      `Processing notification job ${job.id}: type=${payload.notificationType} user=${payload.userId}`,
    );

    await this.notificationService.persistNotification(payload);

    this.logger.debug(`Notification job ${job.id} completed`);
  }
}
