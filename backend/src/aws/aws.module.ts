import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './s3.service';
import { SesService } from './ses.service';
import { KmsService } from './kms.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [S3Service, SesService, KmsService],
  exports: [S3Service, SesService, KmsService],
})
export class AwsModule {}
