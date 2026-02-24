import { Module } from '@nestjs/common';
import { ShareholderController } from './shareholder.controller';
import { ShareholderService } from './shareholder.service';

@Module({
  controllers: [ShareholderController],
  providers: [ShareholderService],
  exports: [ShareholderService],
})
export class ShareholderModule {}
