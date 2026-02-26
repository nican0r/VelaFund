import { Module } from '@nestjs/common';
import { OptionPlanController } from './option-plan.controller';
import { OptionPlanService } from './option-plan.service';
import { CapTableModule } from '../cap-table/cap-table.module';

@Module({
  imports: [CapTableModule],
  controllers: [OptionPlanController],
  providers: [OptionPlanService],
  exports: [OptionPlanService],
})
export class OptionPlanModule {}
