import { Module } from '@nestjs/common';
import { CapTableController } from './cap-table.controller';
import { CapTableService } from './cap-table.service';

@Module({
  controllers: [CapTableController],
  providers: [CapTableService],
  exports: [CapTableService],
})
export class CapTableModule {}
