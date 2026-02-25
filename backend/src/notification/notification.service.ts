import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '../common/filters/app-exception';
import { parseSort } from '../common/helpers/sort-parser';
import {
  CreateNotificationPayload,
  NOTIFICATION_TYPE_CATEGORY,
  CRITICAL_NOTIFICATION_TYPES,
} from './dto/create-notification.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';

const SORTABLE_FIELDS = ['createdAt', 'notificationType'];

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
  ) {}

  /**
   * Queue a notification for async creation via Bull.
   * Checks user preferences before queuing — skips if the category is disabled
   * (unless the notification type is critical).
   */
  async create(payload: CreateNotificationPayload): Promise<void> {
    const { userId, notificationType } = payload;

    // Critical notifications always get through
    if (!CRITICAL_NOTIFICATION_TYPES.has(notificationType)) {
      const category = NOTIFICATION_TYPE_CATEGORY[notificationType];
      if (category && category !== 'security') {
        const prefs = await this.prisma.userNotificationPreferences.findUnique({
          where: { userId },
        });

        // If preferences exist and the category is disabled, skip
        if (prefs && !prefs[category as keyof typeof prefs]) {
          this.logger.debug(
            `Skipping notification ${notificationType} for user ${userId}: category ${category} disabled`,
          );
          return;
        }
      }
    }

    await this.notificationQueue.add('create-notification', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  /**
   * Persist a notification to the database.
   * Called by the Bull processor after dequeuing.
   */
  async persistNotification(payload: CreateNotificationPayload): Promise<void> {
    const metadata: Record<string, string> = {};
    if (payload.relatedEntityType) metadata.relatedEntityType = payload.relatedEntityType;
    if (payload.relatedEntityId) metadata.relatedEntityId = payload.relatedEntityId;
    if (payload.companyId) metadata.companyId = payload.companyId;
    if (payload.companyName) metadata.companyName = payload.companyName;

    const hasMetadata = Object.keys(metadata).length > 0;

    await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        channel: 'IN_APP',
        notificationType: payload.notificationType,
        subject: payload.subject,
        body: payload.body,
        status: 'PENDING',
        metadata: hasMetadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  /**
   * List notifications for a user with pagination, filtering, and sorting.
   */
  async findAll(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<{ items: any[]; total: number }> {
    const { page = 1, limit = 20, read, notificationType, sort } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    // Filter by read status
    if (read === 'true') {
      where.readAt = { not: null };
    } else if (read === 'false') {
      where.readAt = null;
    }

    // Filter by notification type
    if (notificationType) {
      where.notificationType = notificationType;
    }

    // Parse sorting
    const sortFields = parseSort(sort, SORTABLE_FIELDS);
    const orderBy = sortFields.map((f) => ({ [f.field]: f.direction }));

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          notificationType: true,
          subject: true,
          status: true,
          readAt: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    // Transform for API response
    const transformed = items.map((item) => this.transformNotification(item));
    return { items: transformed, total };
  }

  /**
   * Get a single notification by ID, scoped to the authenticated user.
   */
  async findById(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('notification', notificationId);
    }

    return this.transformNotificationDetail(notification);
  }

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('notification', notificationId);
    }

    // Already read — return as-is
    if (notification.readAt) {
      return {
        id: notification.id,
        read: true,
        readAt: notification.readAt.toISOString(),
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return {
      id: updated.id,
      read: true,
      readAt: updated.readAt!.toISOString(),
    };
  }

  /**
   * Mark all unread notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count };
  }

  /**
   * Get notification preferences for a user. Creates defaults if none exist.
   */
  async getPreferences(userId: string) {
    let prefs = await this.prisma.userNotificationPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.userNotificationPreferences.create({
        data: { userId },
      });
    }

    return {
      categories: {
        transactions: prefs.transactions,
        documents: prefs.documents,
        options: prefs.options,
        fundingRounds: prefs.fundingRounds,
        security: prefs.security,
      },
      updatedAt: prefs.updatedAt.toISOString(),
    };
  }

  /**
   * Update notification preferences for a user.
   * Security category is forced to true regardless of input.
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const data: any = {};
    if (dto.transactions !== undefined) data.transactions = dto.transactions;
    if (dto.documents !== undefined) data.documents = dto.documents;
    if (dto.options !== undefined) data.options = dto.options;
    if (dto.fundingRounds !== undefined) data.fundingRounds = dto.fundingRounds;
    // Security is always true — enforce at write time
    data.security = true;

    const prefs = await this.prisma.userNotificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });

    return {
      categories: {
        transactions: prefs.transactions,
        documents: prefs.documents,
        options: prefs.options,
        fundingRounds: prefs.fundingRounds,
        security: prefs.security,
      },
      updatedAt: prefs.updatedAt.toISOString(),
    };
  }

  /**
   * Delete a notification, scoped to the authenticated user.
   */
  async delete(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('notification', notificationId);
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Transform a notification from DB row to API list response shape.
   */
  private transformNotification(notification: any) {
    const metadata = (notification.metadata as Record<string, unknown>) || {};
    return {
      id: notification.id,
      notificationType: notification.notificationType,
      subject: notification.subject,
      status: notification.status,
      read: notification.readAt !== null,
      relatedEntityType: (metadata.relatedEntityType as string) || null,
      relatedEntityId: (metadata.relatedEntityId as string) || null,
      companyId: (metadata.companyId as string) || null,
      companyName: (metadata.companyName as string) || null,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  /**
   * Transform a notification from DB row to API detail response shape.
   */
  private transformNotificationDetail(notification: any) {
    const metadata = (notification.metadata as Record<string, unknown>) || {};
    return {
      id: notification.id,
      notificationType: notification.notificationType,
      subject: notification.subject,
      body: notification.body,
      status: notification.status,
      read: notification.readAt !== null,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      relatedEntityType: (metadata.relatedEntityType as string) || null,
      relatedEntityId: (metadata.relatedEntityId as string) || null,
      companyId: (metadata.companyId as string) || null,
      companyName: (metadata.companyName as string) || null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
