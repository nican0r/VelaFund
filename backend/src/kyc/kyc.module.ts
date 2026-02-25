import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycProcessor } from './kyc.processor';
import { VerifikService } from './verifik/verifik.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'kyc-aml',
    }),
  ],
  controllers: [KycController],
  providers: [KycService, KycProcessor, VerifikService],
  exports: [KycService],
})
export class KycModule {}
