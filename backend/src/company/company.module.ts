import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { KycModule } from '../kyc/kyc.module';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CnpjValidationProcessor } from './processors/cnpj-validation.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'company-setup' }),
    KycModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService, CnpjValidationProcessor],
  exports: [CompanyService],
})
export class CompanyModule {}
