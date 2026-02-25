import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';

@Injectable()
export class KmsService {
  private readonly logger = new Logger(KmsService.name);
  private readonly client: KMSClient | null;
  private readonly keyArn: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.keyArn = this.configService.get<string>('AWS_KMS_KEY_ARN');

    if (region && accessKeyId && secretAccessKey) {
      this.client = new KMSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`KMS client initialized (region: ${region})`);
    } else {
      this.client = null;
      this.logger.warn(
        'AWS credentials not configured. KMS encryption will be unavailable.',
      );
    }
  }

  isAvailable(): boolean {
    return this.client !== null && this.keyArn !== undefined;
  }

  getKeyArn(): string | undefined {
    return this.keyArn;
  }

  async encrypt(plaintext: string, keyArn?: string): Promise<Buffer> {
    this.ensureAvailable();

    const resolvedKeyArn = keyArn ?? this.keyArn!;

    const command = new EncryptCommand({
      KeyId: resolvedKeyArn,
      Plaintext: Buffer.from(plaintext, 'utf-8'),
    });

    const response = await this.client!.send(command);

    if (!response.CiphertextBlob) {
      throw new Error('KMS encrypt returned empty CiphertextBlob');
    }

    return Buffer.from(response.CiphertextBlob);
  }

  async decrypt(ciphertext: Buffer): Promise<string> {
    this.ensureAvailable();

    const command = new DecryptCommand({
      CiphertextBlob: new Uint8Array(ciphertext),
    });

    const response = await this.client!.send(command);

    if (!response.Plaintext) {
      throw new Error('KMS decrypt returned empty Plaintext');
    }

    return Buffer.from(response.Plaintext).toString('utf-8');
  }

  private ensureAvailable(): void {
    if (!this.client) {
      throw new Error(
        'KMS client not initialized. Check AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.',
      );
    }
    if (!this.keyArn) {
      throw new Error(
        'KMS key ARN not configured. Set AWS_KMS_KEY_ARN environment variable.',
      );
    }
  }
}
