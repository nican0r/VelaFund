import { Module } from '@nestjs/common';
import { ShareClassController } from './share-class.controller';
import { ShareClassService } from './share-class.service';

@Module({
  controllers: [ShareClassController],
  providers: [ShareClassService],
  exports: [ShareClassService],
})
export class ShareClassModule {}
