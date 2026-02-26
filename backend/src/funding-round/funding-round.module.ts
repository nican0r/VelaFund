import { Module } from '@nestjs/common';
import { FundingRoundController } from './funding-round.controller';
import { FundingRoundService } from './funding-round.service';
import { CapTableModule } from '../cap-table/cap-table.module';

@Module({
  imports: [CapTableModule],
  controllers: [FundingRoundController],
  providers: [FundingRoundService],
  exports: [FundingRoundService],
})
export class FundingRoundModule {}
