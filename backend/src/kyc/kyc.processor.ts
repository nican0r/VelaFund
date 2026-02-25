import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { KycService } from './kyc.service';

export interface AmlScreeningPayload {
  kycVerificationId: string;
  userId: string;
  fullName: string;
  cpf: string;
  nationality: string;
}

@Processor('kyc-aml')
export class KycProcessor {
  private readonly logger = new Logger(KycProcessor.name);

  constructor(private readonly kycService: KycService) {}

  @Process('screen-aml')
  async handleAmlScreening(job: Job<AmlScreeningPayload>) {
    const { kycVerificationId, userId } = job.data;
    this.logger.debug(
      `Processing AML screening job ${job.id}: kycVerificationId=${kycVerificationId} userId=${userId}`,
    );

    await this.kycService.processAmlScreening(kycVerificationId);

    this.logger.debug(`AML screening job ${job.id} completed`);
  }
}
