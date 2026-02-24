import { Module } from '@nestjs/common';
import { ConvertibleController } from './convertible.controller';
import { ConvertibleService } from './convertible.service';

@Module({
  controllers: [ConvertibleController],
  providers: [ConvertibleService],
  exports: [ConvertibleService],
})
export class ConvertibleModule {}
