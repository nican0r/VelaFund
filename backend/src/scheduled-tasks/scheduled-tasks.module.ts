import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { ConvertibleModule } from '../convertible/convertible.module';
import { OptionPlanModule } from '../option-plan/option-plan.module';

@Module({
  imports: [ScheduleModule.forRoot(), ConvertibleModule, OptionPlanModule],
  providers: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
