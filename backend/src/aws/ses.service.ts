import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-ses';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

@Injectable()
export class SesService {
  private readonly logger = new Logger(SesService.name);
  private readonly client: SESClient | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.fromAddress = this.configService.get<string>(
      'SES_FROM_ADDRESS',
      'noreply@navia.com.br',
    );

    if (region && accessKeyId && secretAccessKey) {
      this.client = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`SES client initialized (region: ${region})`);
    } else {
      this.client = null;
      this.logger.warn(
        'AWS credentials not configured. Email sending will be unavailable.',
      );
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async sendEmail(options: EmailOptions): Promise<string | null> {
    this.ensureAvailable();

    const toAddresses = Array.isArray(options.to)
      ? options.to
      : [options.to];

    const input: SendEmailCommandInput = {
      Source: this.fromAddress,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: options.htmlBody,
            Charset: 'UTF-8',
          },
          ...(options.textBody
            ? {
                Text: {
                  Data: options.textBody,
                  Charset: 'UTF-8',
                },
              }
            : {}),
        },
      },
      ...(options.replyTo
        ? { ReplyToAddresses: [options.replyTo] }
        : {}),
    };

    const result = await this.client!.send(new SendEmailCommand(input));

    this.logger.debug(
      `Email sent to ${toAddresses.join(', ')} (MessageId: ${result.MessageId})`,
    );

    return result.MessageId ?? null;
  }

  async sendTemplatedEmail(
    to: string | string[],
    templateName: string,
    locale: string,
    variables: Record<string, string>,
    subject: string,
    htmlBody: string,
  ): Promise<string | null> {
    // Resolve variables in template body and subject
    let resolvedHtml = htmlBody;
    let resolvedSubject = subject;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      resolvedHtml = resolvedHtml.replace(placeholder, value);
      resolvedSubject = resolvedSubject.replace(placeholder, value);
    }

    this.logger.debug(
      `Sending templated email: template=${templateName}, locale=${locale}`,
    );

    return this.sendEmail({
      to,
      subject: resolvedSubject,
      htmlBody: resolvedHtml,
    });
  }

  private ensureAvailable(): void {
    if (!this.client) {
      throw new Error(
        'SES client not initialized. Check AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.',
      );
    }
  }
}
