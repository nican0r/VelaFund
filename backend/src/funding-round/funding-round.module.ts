import { Module } from '@nestjs/common';
import { FundingRoundController } from './funding-round.controller';
import { FundingRoundService } from './funding-round.service';

@Module({
  controllers: [FundingRoundController],
  providers: [FundingRoundService],
  exports: [FundingRoundService],
})
export class FundingRoundModule {}
