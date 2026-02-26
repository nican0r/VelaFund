import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { CapTableModule } from '../cap-table/cap-table.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [CapTableModule, AuditLogModule],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
