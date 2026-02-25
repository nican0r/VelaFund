import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReportsController } from './reports.controller';
import { PortfolioController } from './portfolio.controller';
import { ReportsService } from './reports.service';
import { ReportExportProcessor } from './reports.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'report-export' })],
  controllers: [ReportsController, PortfolioController],
  providers: [ReportsService, ReportExportProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
