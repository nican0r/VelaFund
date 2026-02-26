import { Module } from '@nestjs/common';
import { ConvertibleController } from './convertible.controller';
import { ConvertibleService } from './convertible.service';
import { CapTableModule } from '../cap-table/cap-table.module';

@Module({
  imports: [CapTableModule],
  controllers: [ConvertibleController],
  providers: [ConvertibleService],
  exports: [ConvertibleService],
})
export class ConvertibleModule {}
