import { Module } from '@nestjs/common';
import { OptionPlanController } from './option-plan.controller';
import { OptionPlanService } from './option-plan.service';

@Module({
  controllers: [OptionPlanController],
  providers: [OptionPlanService],
  exports: [OptionPlanService],
})
export class OptionPlanModule {}
