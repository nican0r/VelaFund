import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

/**
 * Global module providing application-level encryption services.
 *
 * Depends on AwsModule (KmsService) which is also @Global.
 * Provides EncryptionService for:
 * - KMS-based encrypt/decrypt for PII fields
 * - HMAC-SHA256 blind indexes for searchable encrypted fields
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
