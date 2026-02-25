import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SesService } from './ses.service';

// Mock the AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  SendEmailCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('SesService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when AWS credentials are configured', () => {
    let service: SesService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SesService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                const config: Record<string, string> = {
                  AWS_REGION: 'sa-east-1',
                  AWS_ACCESS_KEY_ID: 'test-access-key',
                  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<SesService>(SesService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should report as available', () => {
      expect(service.isAvailable()).toBe(true);
    });

    describe('sendEmail', () => {
      it('should send an email with HTML body', async () => {
        mockSend.mockResolvedValue({ MessageId: 'msg-123' });

        const result = await service.sendEmail({
          to: 'user@example.com',
          subject: 'Test Subject',
          htmlBody: '<p>Hello</p>',
        });

        expect(result).toBe('msg-123');
        expect(mockSend).toHaveBeenCalledTimes(1);

        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        expect(SendEmailCommand).toHaveBeenCalledWith({
          Source: 'noreply@navia.com.br',
          Destination: {
            ToAddresses: ['user@example.com'],
          },
          Message: {
            Subject: { Data: 'Test Subject', Charset: 'UTF-8' },
            Body: {
              Html: { Data: '<p>Hello</p>', Charset: 'UTF-8' },
            },
          },
        });
      });

      it('should send email with HTML and text body', async () => {
        mockSend.mockResolvedValue({ MessageId: 'msg-456' });

        await service.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          htmlBody: '<p>Hello</p>',
          textBody: 'Hello',
        });

        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        const call = SendEmailCommand.mock.calls[0][0];
        expect(call.Message.Body.Text).toEqual({
          Data: 'Hello',
          Charset: 'UTF-8',
        });
      });

      it('should send to multiple recipients', async () => {
        mockSend.mockResolvedValue({ MessageId: 'msg-789' });

        await service.sendEmail({
          to: ['user1@example.com', 'user2@example.com'],
          subject: 'Batch',
          htmlBody: '<p>Hi all</p>',
        });

        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        const call = SendEmailCommand.mock.calls[0][0];
        expect(call.Destination.ToAddresses).toEqual([
          'user1@example.com',
          'user2@example.com',
        ]);
      });

      it('should include replyTo when provided', async () => {
        mockSend.mockResolvedValue({ MessageId: 'msg-reply' });

        await service.sendEmail({
          to: 'user@example.com',
          subject: 'With Reply',
          htmlBody: '<p>Reply to me</p>',
          replyTo: 'support@navia.com.br',
        });

        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        const call = SendEmailCommand.mock.calls[0][0];
        expect(call.ReplyToAddresses).toEqual(['support@navia.com.br']);
      });

      it('should return null when MessageId is undefined', async () => {
        mockSend.mockResolvedValue({});

        const result = await service.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          htmlBody: '<p>No ID</p>',
        });

        expect(result).toBeNull();
      });

      it('should propagate SES errors', async () => {
        mockSend.mockRejectedValue(new Error('Email address not verified'));

        await expect(
          service.sendEmail({
            to: 'invalid@example.com',
            subject: 'Test',
            htmlBody: '<p>Fail</p>',
          }),
        ).rejects.toThrow('Email address not verified');
      });
    });

    describe('sendTemplatedEmail', () => {
      it('should resolve template variables in body and subject', async () => {
        mockSend.mockResolvedValue({ MessageId: 'msg-tmpl' });

        await service.sendTemplatedEmail(
          'user@example.com',
          'invitation',
          'pt-BR',
          {
            inviterName: 'Nelson',
            companyName: 'Acme Ltda',
            invitationLink: 'https://app.navia.com.br/invite/abc',
          },
          'Convite para {{companyName}}',
          '<p>{{inviterName}} convidou você para {{companyName}}. <a href="{{invitationLink}}">Aceitar</a></p>',
        );

        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        const call = SendEmailCommand.mock.calls[0][0];
        expect(call.Message.Subject.Data).toBe('Convite para Acme Ltda');
        expect(call.Message.Body.Html.Data).toBe(
          '<p>Nelson convidou você para Acme Ltda. <a href="https://app.navia.com.br/invite/abc">Aceitar</a></p>',
        );
      });

      it('should handle multiple occurrences of the same variable', async () => {
        mockSend.mockResolvedValue({ MessageId: 'msg-multi' });

        await service.sendTemplatedEmail(
          'user@example.com',
          'test',
          'en',
          { name: 'João' },
          'Hello {{name}}',
          '<p>Hi {{name}}, welcome {{name}}!</p>',
        );

        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        const call = SendEmailCommand.mock.calls[0][0];
        expect(call.Message.Body.Html.Data).toBe(
          '<p>Hi João, welcome João!</p>',
        );
      });

      it('should leave unmatched placeholders as-is', async () => {
        mockSend.mockResolvedValue({ MessageId: 'msg-partial' });

        await service.sendTemplatedEmail(
          'user@example.com',
          'test',
          'en',
          { name: 'João' },
          'Hello',
          '<p>{{name}} and {{unknown}}</p>',
        );

        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        const call = SendEmailCommand.mock.calls[0][0];
        expect(call.Message.Body.Html.Data).toBe(
          '<p>João and {{unknown}}</p>',
        );
      });
    });
  });

  describe('when AWS credentials are not configured', () => {
    let service: SesService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SesService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => defaultValue),
            },
          },
        ],
      }).compile();

      service = module.get<SesService>(SesService);
    });

    it('should report as unavailable', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should throw on sendEmail when not configured', async () => {
      await expect(
        service.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          htmlBody: '<p>Fail</p>',
        }),
      ).rejects.toThrow('SES client not initialized');
    });

    it('should throw on sendTemplatedEmail when not configured', async () => {
      await expect(
        service.sendTemplatedEmail(
          'user@example.com',
          'test',
          'en',
          {},
          'Subject',
          '<p>Body</p>',
        ),
      ).rejects.toThrow('SES client not initialized');
    });
  });

  describe('with custom from address', () => {
    it('should use SES_FROM_ADDRESS from config', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SesService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                const config: Record<string, string> = {
                  AWS_REGION: 'sa-east-1',
                  AWS_ACCESS_KEY_ID: 'test-key',
                  AWS_SECRET_ACCESS_KEY: 'test-secret',
                  SES_FROM_ADDRESS: 'custom@navia.com.br',
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const service = module.get<SesService>(SesService);
      mockSend.mockResolvedValue({ MessageId: 'msg-custom' });

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Custom From',
        htmlBody: '<p>Test</p>',
      });

      const { SendEmailCommand } = require('@aws-sdk/client-ses');
      const call = SendEmailCommand.mock.calls[0][0];
      expect(call.Source).toBe('custom@navia.com.br');
    });
  });
});
