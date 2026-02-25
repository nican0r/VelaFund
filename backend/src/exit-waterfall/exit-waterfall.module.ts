import { Module } from '@nestjs/common';
import { ExitWaterfallController } from './exit-waterfall.controller';
import { ExitWaterfallService } from './exit-waterfall.service';

@Module({
  controllers: [ExitWaterfallController],
  providers: [ExitWaterfallService],
  exports: [ExitWaterfallService],
})
export class ExitWaterfallModule {}
