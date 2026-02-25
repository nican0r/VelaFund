import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadOptions {
  contentType?: string;
  serverSideEncryption?: 'AES256' | 'aws:kms';
  kmsKeyId?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null;
  private readonly documentsBucket: string | undefined;
  private readonly kycBucket: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.documentsBucket = this.configService.get<string>(
      'AWS_S3_DOCUMENTS_BUCKET',
    );
    this.kycBucket = this.configService.get<string>('AWS_S3_KYC_BUCKET');

    if (region && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`S3 client initialized (region: ${region})`);
    } else {
      this.client = null;
      this.logger.warn(
        'AWS credentials not configured. S3 operations will be unavailable.',
      );
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  getDocumentsBucket(): string | undefined {
    return this.documentsBucket;
  }

  getKycBucket(): string | undefined {
    return this.kycBucket;
  }

  async upload(
    bucket: string,
    key: string,
    body: Buffer,
    options?: UploadOptions,
  ): Promise<void> {
    this.ensureAvailable();

    await this.client!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        ServerSideEncryption: options?.serverSideEncryption,
        SSEKMSKeyId: options?.kmsKeyId,
        Metadata: options?.metadata,
      }),
    );

    this.logger.debug(`Uploaded s3://${bucket}/${key}`);
  }

  async download(bucket: string, key: string): Promise<Buffer> {
    this.ensureAvailable();

    const response = await this.client!.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    const stream = response.Body;
    if (!stream) {
      throw new Error(`Empty response body for s3://${bucket}/${key}`);
    }

    // Convert readable stream to Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(bucket: string, key: string): Promise<void> {
    this.ensureAvailable();

    await this.client!.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );

    this.logger.debug(`Deleted s3://${bucket}/${key}`);
  }

  async generatePresignedUrl(
    bucket: string,
    key: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    this.ensureAvailable();

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(this.client!, command, {
      expiresIn: expiresInSeconds,
    });

    return url;
  }

  async checkBucketHealth(bucket: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch {
      return false;
    }
  }

  private ensureAvailable(): void {
    if (!this.client) {
      throw new Error(
        'S3 client not initialized. Check AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.',
      );
    }
  }
}
