import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ScheduledTasksService } from './scheduled-tasks.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Register all Bull queues for DLQ monitoring
    BullModule.registerQueue(
      { name: 'audit-log' },
      { name: 'notification' },
      { name: 'company-setup' },
      { name: 'report-export' },
      { name: 'kyc-aml' },
      { name: 'profile-litigation' },
    ),
  ],
  providers: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
