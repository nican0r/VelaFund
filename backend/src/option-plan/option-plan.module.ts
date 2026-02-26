import { Module } from '@nestjs/common';
import { OptionPlanController } from './option-plan.controller';
import { OptionPlanService } from './option-plan.service';
import { CapTableModule } from '../cap-table/cap-table.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [CapTableModule, AuditLogModule],
  controllers: [OptionPlanController],
  providers: [OptionPlanService],
  exports: [OptionPlanService],
})
export class OptionPlanModule {}
