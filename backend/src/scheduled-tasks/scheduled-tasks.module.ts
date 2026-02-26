import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { ConvertibleModule } from '../convertible/convertible.module';
import { OptionPlanModule } from '../option-plan/option-plan.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConvertibleModule,
    OptionPlanModule,
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
