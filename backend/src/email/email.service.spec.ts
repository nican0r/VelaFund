import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { SesService } from '../aws/ses.service';
import * as fs from 'fs';
import * as path from 'path';

describe('EmailService', () => {
  let service: EmailService;
  let sesService: any;
  let configService: any;

  const templatesDir = path.resolve(__dirname, '../../templates/email');

  beforeEach(async () => {
    sesService = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendEmail: jest.fn().mockResolvedValue('mock-message-id'),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.navia.com.br';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: SesService, useValue: sesService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  // ─── isAvailable ─────────────────────────────────────────────────

  describe('isAvailable', () => {
    it('should return true when SES is available', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when SES is not available', () => {
      sesService.isAvailable!.mockReturnValue(false);
      expect(service.isAvailable()).toBe(false);
    });
  });

  // ─── compileTemplate ────────────────────────────────────────────

  describe('compileTemplate', () => {
    it('should compile invitation template in pt-BR', () => {
      const result = service.compileTemplate('invitation', 'pt-BR', {
        inviterName: 'Nelson Pereira',
        companyName: 'Acme Ltda.',
        roleName: 'Investidor',
        invitationUrl: 'https://app.navia.com.br/invitations/abc123',
        expiryDays: '7',
      });

      expect(result.subject).toBe('Convite para Acme Ltda. na Navia');
      expect(result.html).toContain('Nelson Pereira');
      expect(result.html).toContain('Acme Ltda.');
      expect(result.html).toContain('Investidor');
      expect(result.html).toContain('https://app.navia.com.br/invitations/abc123');
      expect(result.html).toContain('7 dias');
      expect(result.text).toBeTruthy();
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('should compile invitation template in EN', () => {
      const result = service.compileTemplate('invitation', 'en', {
        inviterName: 'Nelson Pereira',
        companyName: 'Acme Inc.',
        roleName: 'Investor',
        invitationUrl: 'https://app.navia.com.br/invitations/abc123',
        expiryDays: '7',
      });

      expect(result.subject).toBe('Invitation to Acme Inc. on Navia');
      expect(result.html).toContain('Nelson Pereira');
      expect(result.html).toContain('Acme Inc.');
      expect(result.html).toContain('Investor');
      expect(result.html).toContain('7 days');
    });

    it('should fall back to pt-BR when locale not found', () => {
      const result = service.compileTemplate('invitation', 'fr', {
        inviterName: 'Test User',
        companyName: 'Test Corp',
        roleName: 'Admin',
        invitationUrl: 'https://app.navia.com.br/invitations/test',
        expiryDays: '7',
      });

      // Should fallback to pt-BR
      expect(result.subject).toContain('Convite para');
    });

    it('should throw when template does not exist', () => {
      expect(() => service.compileTemplate('nonexistent-template', 'pt-BR', {})).toThrow(
        'Email template not found: nonexistent-template/pt-BR.mjml',
      );
    });

    it('should compile exercise-notification template in pt-BR', () => {
      const result = service.compileTemplate('exercise-notification', 'pt-BR', {
        recipientName: 'Admin User',
        companyName: 'Acme Ltda.',
        employeeName: 'João Silva',
        quantity: '10.000',
        strikePrice: '1,50',
        totalValue: '15.000,00',
        actionUrl: 'https://app.navia.com.br/exercises/123',
      });

      expect(result.subject).toContain('Solicitação de exercício');
      expect(result.html).toContain('João Silva');
      expect(result.html).toContain('10.000');
    });

    it('should compile exercise-notification template in EN', () => {
      const result = service.compileTemplate('exercise-notification', 'en', {
        recipientName: 'Admin User',
        companyName: 'Acme Inc.',
        employeeName: 'John Smith',
        quantity: '10,000',
        strikePrice: '1.50',
        totalValue: '15,000.00',
        actionUrl: 'https://app.navia.com.br/exercises/123',
      });

      expect(result.subject).toContain('Option exercise request');
      expect(result.html).toContain('John Smith');
    });

    it('should compile export-ready template in pt-BR', () => {
      const result = service.compileTemplate('export-ready', 'pt-BR', {
        recipientName: 'Nelson',
        companyName: 'Acme Ltda.',
        reportType: 'Cap Table',
        exportFormat: 'PDF',
        downloadUrl: 'https://app.navia.com.br/downloads/xyz',
      });

      expect(result.subject).toContain('exportação está pronta');
      expect(result.html).toContain('Cap Table');
      expect(result.html).toContain('PDF');
    });

    it('should compile export-ready template in EN', () => {
      const result = service.compileTemplate('export-ready', 'en', {
        recipientName: 'Nelson',
        companyName: 'Acme Inc.',
        reportType: 'Cap Table',
        exportFormat: 'PDF',
        downloadUrl: 'https://app.navia.com.br/downloads/xyz',
      });

      expect(result.subject).toContain('export is ready');
    });

    it('should compile password-reset template in pt-BR', () => {
      const result = service.compileTemplate('password-reset', 'pt-BR', {
        recipientName: 'Nelson',
        resetUrl: 'https://app.navia.com.br/reset/abc',
        expiryMinutes: '30',
      });

      expect(result.subject).toContain('Redefinição de senha');
      expect(result.html).toContain('30 minutos');
    });

    it('should compile password-reset template in EN', () => {
      const result = service.compileTemplate('password-reset', 'en', {
        recipientName: 'Nelson',
        resetUrl: 'https://app.navia.com.br/reset/abc',
        expiryMinutes: '30',
      });

      expect(result.subject).toContain('Password reset');
      expect(result.html).toContain('30 minutes');
    });

    it('should inject frontendUrl and year automatically', () => {
      const result = service.compileTemplate('invitation', 'pt-BR', {
        inviterName: 'Test',
        companyName: 'Test',
        roleName: 'Test',
        invitationUrl: 'https://app.navia.com.br/invitations/test',
        expiryDays: '7',
      });

      expect(result.html).toContain(new Date().getFullYear().toString());
    });

    it('should escape HTML in variable values to prevent XSS', () => {
      const result = service.compileTemplate('invitation', 'pt-BR', {
        inviterName: '<script>alert("xss")</script>',
        companyName: 'Test & Co.',
        roleName: 'Admin',
        invitationUrl: 'https://app.navia.com.br/invitations/test',
        expiryDays: '7',
      });

      // The script tag should be escaped, not executable
      expect(result.html).not.toContain('<script>alert');
      // MJML encodes our escaped HTML entities further, so the final output
      // has &lt;script&gt; (HTML-safe rendering of the escaped input)
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('Test &amp; Co.');
    });

    it('should generate plain text version from HTML', () => {
      const result = service.compileTemplate('invitation', 'pt-BR', {
        inviterName: 'Test User',
        companyName: 'Test Corp',
        roleName: 'Investidor',
        invitationUrl: 'https://app.navia.com.br/invitations/test',
        expiryDays: '7',
      });

      expect(result.text).toBeTruthy();
      // Plain text should not contain HTML tags
      expect(result.text).not.toMatch(/<[a-z][\s\S]*>/i);
      // But should contain the text content
      expect(result.text).toContain('Test User');
    });
  });

  // ─── sendEmail ──────────────────────────────────────────────────

  describe('sendEmail', () => {
    it('should compile template and send via SES', async () => {
      const messageId = await service.sendEmail({
        to: 'user@example.com',
        templateName: 'invitation',
        locale: 'pt-BR',
        variables: {
          inviterName: 'Nelson',
          companyName: 'Acme',
          roleName: 'Investidor',
          invitationUrl: 'https://app.navia.com.br/invitations/token123',
          expiryDays: '7',
        },
      });

      expect(messageId).toBe('mock-message-id');
      expect(sesService.sendEmail).toHaveBeenCalledTimes(1);

      const callArgs = sesService.sendEmail!.mock.calls[0][0];
      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toBe('Convite para Acme na Navia');
      expect(callArgs.htmlBody).toContain('Nelson');
      expect(callArgs.htmlBody).toContain('Acme');
      expect(callArgs.textBody).toBeTruthy();
    });

    it('should default to pt-BR locale when not specified', async () => {
      await service.sendEmail({
        to: 'user@example.com',
        templateName: 'invitation',
        variables: {
          inviterName: 'Nelson',
          companyName: 'Acme',
          roleName: 'Investidor',
          invitationUrl: 'https://app.navia.com.br/invitations/token123',
          expiryDays: '7',
        },
      });

      const callArgs = sesService.sendEmail!.mock.calls[0][0];
      expect(callArgs.subject).toContain('Convite para');
    });

    it('should use EN locale when specified', async () => {
      await service.sendEmail({
        to: 'user@example.com',
        templateName: 'invitation',
        locale: 'en',
        variables: {
          inviterName: 'Nelson',
          companyName: 'Acme',
          roleName: 'Investor',
          invitationUrl: 'https://app.navia.com.br/invitations/token123',
          expiryDays: '7',
        },
      });

      const callArgs = sesService.sendEmail!.mock.calls[0][0];
      expect(callArgs.subject).toContain('Invitation to');
    });

    it('should pass replyTo when provided', async () => {
      await service.sendEmail({
        to: 'user@example.com',
        templateName: 'invitation',
        locale: 'pt-BR',
        variables: {
          inviterName: 'Nelson',
          companyName: 'Acme',
          roleName: 'Investidor',
          invitationUrl: 'https://app.navia.com.br/invitations/token123',
          expiryDays: '7',
        },
        replyTo: 'admin@acme.com',
      });

      const callArgs = sesService.sendEmail!.mock.calls[0][0];
      expect(callArgs.replyTo).toBe('admin@acme.com');
    });

    it('should send to multiple recipients', async () => {
      await service.sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        templateName: 'invitation',
        locale: 'pt-BR',
        variables: {
          inviterName: 'Nelson',
          companyName: 'Acme',
          roleName: 'Investidor',
          invitationUrl: 'https://app.navia.com.br/invitations/token123',
          expiryDays: '7',
        },
      });

      const callArgs = sesService.sendEmail!.mock.calls[0][0];
      expect(callArgs.to).toEqual(['user1@example.com', 'user2@example.com']);
    });

    it('should propagate SES errors', async () => {
      sesService.sendEmail!.mockRejectedValue(new Error('SES error'));

      await expect(
        service.sendEmail({
          to: 'user@example.com',
          templateName: 'invitation',
          locale: 'pt-BR',
          variables: {
            inviterName: 'Nelson',
            companyName: 'Acme',
            roleName: 'Investidor',
            invitationUrl: 'https://app.navia.com.br/invitations/token123',
            expiryDays: '7',
          },
        }),
      ).rejects.toThrow('SES error');
    });
  });

  // ─── Template file verification ─────────────────────────────────

  describe('template files', () => {
    const templates = ['invitation', 'exercise-notification', 'export-ready', 'password-reset'];
    const locales = ['pt-BR', 'en'];

    for (const template of templates) {
      for (const locale of locales) {
        it(`should have ${template}/${locale}.mjml template file`, () => {
          const filePath = path.join(templatesDir, template, `${locale}.mjml`);
          expect(fs.existsSync(filePath)).toBe(true);
        });

        it(`should have subject comment in ${template}/${locale}.mjml`, () => {
          const filePath = path.join(templatesDir, template, `${locale}.mjml`);
          const content = fs.readFileSync(filePath, 'utf-8');
          expect(content).toMatch(/<!--\s*subject:\s*.+\s*-->/i);
        });

        it(`should contain valid MJML in ${template}/${locale}.mjml`, () => {
          const filePath = path.join(templatesDir, template, `${locale}.mjml`);
          const content = fs.readFileSync(filePath, 'utf-8');
          expect(content).toContain('<mjml>');
          expect(content).toContain('</mjml>');
        });
      }
    }
  });
});
