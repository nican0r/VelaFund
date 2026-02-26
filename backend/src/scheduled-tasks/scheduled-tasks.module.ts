import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { ConvertibleModule } from '../convertible/convertible.module';

@Module({
  imports: [ScheduleModule.forRoot(), ConvertibleModule],
  providers: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
