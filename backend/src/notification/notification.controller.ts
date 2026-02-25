import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/helpers/paginate';
import { NotificationService } from './notification.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@ApiTags('Notifications')
@Controller('api/v1/users/me/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Paginated list of notifications' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsDto,
  ) {
    const { items, total } = await this.notificationService.findAll(userId, query);
    return paginate(items, total, query.page ?? 1, query.limit ?? 20);
  }

  @Get('unread-count')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Get('preferences')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({ status: 200, description: 'User notification preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationService.getPreferences(userId);
  }

  @Put('preferences')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationService.updatePreferences(userId, dto);
  }

  @Put('read-all')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'Count of updated notifications' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Get(':id')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get a single notification' })
  @ApiResponse({ status: 200, description: 'Notification detail' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationService.findById(userId, id);
  }

  @Put(':id/read')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationService.markAsRead(userId, id);
  }

  @Delete(':id')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 204, description: 'Notification deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.notificationService.delete(userId, id);
  }
}
