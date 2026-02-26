import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { CnpjValidationProcessor, CnpjValidationPayload } from './cnpj-validation.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifikService } from '../../kyc/verifik/verifik.service';
import { NotificationService } from '../../notification/notification.service';
import { EmailService } from '../../email/email.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

const mockPayload: CnpjValidationPayload = {
  companyId: 'comp-1',
  cnpj: '11.222.333/0001-81',
  creatorUserId: 'user-1',
  companyName: 'Acme Ltda.',
};

const mockVerifikResult = {
  razaoSocial: 'ACME TECNOLOGIA LTDA',
  nomeFantasia: 'Acme Tech',
  situacaoCadastral: 'ATIVA',
  dataAbertura: '2020-01-15',
  naturezaJuridica: '206-2 - Sociedade Empresária Limitada',
  atividadePrincipal: {
    codigo: '62.01-5-01',
    descricao: 'Desenvolvimento de programas de computador sob encomenda',
  },
  endereco: {
    logradouro: 'Rua Exemplo',
    numero: '100',
    complemento: 'Sala 1',
    bairro: 'Centro',
    municipio: 'São Paulo',
    uf: 'SP',
    cep: '01001-000',
  },
  capitalSocial: 100000,
};

function createMockJob(
  data: CnpjValidationPayload,
  opts?: Partial<{ attempts: number }>,
  attemptsMade = 0,
): Job<CnpjValidationPayload> {
  return {
    id: 'job-1',
    data,
    opts: { attempts: opts?.attempts ?? 3 },
    attemptsMade,
  } as unknown as Job<CnpjValidationPayload>;
}

describe('CnpjValidationProcessor', () => {
  let processor: CnpjValidationProcessor;
  let prisma: any;
  let verifik: any;
  let notificationService: any;
  let emailService: any;
  let auditLogService: any;

  beforeEach(async () => {
    prisma = {
      company: {
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'creator@example.com',
          locale: 'pt-BR',
        }),
      },
    };

    verifik = {
      validateCnpj: jest.fn(),
    };

    notificationService = {
      create: jest.fn().mockResolvedValue({}),
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue({}),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CnpjValidationProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: VerifikService, useValue: verifik },
        { provide: NotificationService, useValue: notificationService },
        { provide: EmailService, useValue: emailService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    processor = module.get<CnpjValidationProcessor>(CnpjValidationProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── SUCCESS: CNPJ ATIVA ──────────────────────────────────────────

  describe('handleCnpjValidation — success', () => {
    it('should activate company when CNPJ is ATIVA', async () => {
      verifik.validateCnpj.mockResolvedValue(mockVerifikResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      // Company should be updated to ACTIVE with cnpjData
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: {
          cnpjData: expect.objectContaining({
            validationStatus: 'COMPLETED',
            razaoSocial: 'ACME TECNOLOGIA LTDA',
          }),
          cnpjValidatedAt: expect.any(Date),
          status: 'ACTIVE',
        },
      });
    });

    it('should create two audit log entries on success', async () => {
      verifik.validateCnpj.mockResolvedValue(mockVerifikResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(auditLogService.log).toHaveBeenCalledTimes(2);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPANY_CNPJ_VALIDATED',
          resourceId: 'comp-1',
        }),
      );
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPANY_STATUS_CHANGED',
          resourceId: 'comp-1',
        }),
      );
    });

    it('should send notification to creator on success', async () => {
      verifik.validateCnpj.mockResolvedValue(mockVerifikResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          notificationType: 'COMPANY_ACTIVATED',
          relatedEntityType: 'Company',
          relatedEntityId: 'comp-1',
        }),
      );
    });

    it('should send success email to creator', async () => {
      verifik.validateCnpj.mockResolvedValue(mockVerifikResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'creator@example.com',
          templateName: 'cnpj-validation-success',
          locale: 'pt-BR',
          variables: expect.objectContaining({
            companyName: 'Acme Ltda.',
            razaoSocial: 'ACME TECNOLOGIA LTDA',
          }),
        }),
      );
    });

    it('should not fail if email sending fails', async () => {
      verifik.validateCnpj.mockResolvedValue(mockVerifikResult);
      emailService.sendEmail.mockRejectedValue(new Error('SES error'));

      // Should not throw
      await processor.handleCnpjValidation(createMockJob(mockPayload));

      // Company should still be activated
      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should not send email if creator has no email', async () => {
      verifik.validateCnpj.mockResolvedValue(mockVerifikResult);
      prisma.user.findUnique.mockResolvedValue({ email: null, locale: 'pt-BR' });

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ─── FAILURE: CNPJ NOT ATIVA ──────────────────────────────────────

  describe('handleCnpjValidation — inactive CNPJ', () => {
    it('should mark validation as FAILED when CNPJ is not ATIVA', async () => {
      const inactiveResult = {
        ...mockVerifikResult,
        situacaoCadastral: 'BAIXADA',
      };
      verifik.validateCnpj.mockResolvedValue(inactiveResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: {
          cnpjData: expect.objectContaining({
            validationStatus: 'FAILED',
            error: expect.objectContaining({
              code: 'COMPANY_CNPJ_INACTIVE',
            }),
          }),
        },
      });
    });

    it('should create audit log for failed CNPJ validation', async () => {
      const inactiveResult = {
        ...mockVerifikResult,
        situacaoCadastral: 'SUSPENSA',
      };
      verifik.validateCnpj.mockResolvedValue(inactiveResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPANY_CNPJ_VALIDATION_FAILED',
          resourceId: 'comp-1',
          changes: expect.objectContaining({
            after: { situacaoCadastral: 'SUSPENSA' },
          }),
        }),
      );
    });

    it('should send failure notification to creator', async () => {
      const inactiveResult = {
        ...mockVerifikResult,
        situacaoCadastral: 'INAPTA',
      };
      verifik.validateCnpj.mockResolvedValue(inactiveResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          notificationType: 'COMPANY_CNPJ_FAILED',
          relatedEntityType: 'Company',
          relatedEntityId: 'comp-1',
        }),
      );
    });

    it('should send failure email to creator', async () => {
      const inactiveResult = {
        ...mockVerifikResult,
        situacaoCadastral: 'BAIXADA',
      };
      verifik.validateCnpj.mockResolvedValue(inactiveResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'creator@example.com',
          templateName: 'cnpj-validation-failed',
          variables: expect.objectContaining({
            companyName: 'Acme Ltda.',
            situacaoCadastral: 'BAIXADA',
          }),
        }),
      );
    });

    it('should not retry when CNPJ is not ATIVA (definitive failure)', async () => {
      const inactiveResult = {
        ...mockVerifikResult,
        situacaoCadastral: 'BAIXADA',
      };
      verifik.validateCnpj.mockResolvedValue(inactiveResult);

      // Should complete without throwing (no retry)
      await expect(
        processor.handleCnpjValidation(createMockJob(mockPayload)),
      ).resolves.toBeUndefined();
    });

    it('should not set company status to ACTIVE when CNPJ is inactive', async () => {
      const inactiveResult = {
        ...mockVerifikResult,
        situacaoCadastral: 'BAIXADA',
      };
      verifik.validateCnpj.mockResolvedValue(inactiveResult);

      await processor.handleCnpjValidation(createMockJob(mockPayload));

      // Verify company.update was NOT called with status: 'ACTIVE'
      const updateCall = prisma.company.update.mock.calls[0][0];
      expect(updateCall.data.status).toBeUndefined();
    });
  });

  // ─── FAILURE: TRANSIENT ERRORS ────────────────────────────────────

  describe('handleCnpjValidation — transient errors', () => {
    it('should re-throw error for Bull retry on non-final attempt', async () => {
      verifik.validateCnpj.mockRejectedValue(new Error('Verifik service unavailable'));

      // attemptsMade=0, attempts=3 → not last attempt
      const job = createMockJob(mockPayload, { attempts: 3 }, 0);

      await expect(processor.handleCnpjValidation(job)).rejects.toThrow(
        'Verifik service unavailable',
      );

      // Should NOT mark validation as failed (only on last attempt)
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('should mark validation as FAILED on last attempt', async () => {
      verifik.validateCnpj.mockRejectedValue(new Error('Verifik service unavailable'));

      // attemptsMade=2, attempts=3 → last attempt (2+1 >= 3)
      const job = createMockJob(mockPayload, { attempts: 3 }, 2);

      await expect(processor.handleCnpjValidation(job)).rejects.toThrow(
        'Verifik service unavailable',
      );

      // Should mark as failed before re-throwing
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: {
          cnpjData: expect.objectContaining({
            validationStatus: 'FAILED',
            error: expect.objectContaining({
              code: 'COMPANY_CNPJ_VERIFIK_UNAVAILABLE',
            }),
          }),
        },
      });
    });

    it('should create audit log on final attempt failure', async () => {
      verifik.validateCnpj.mockRejectedValue(new Error('timeout'));

      const job = createMockJob(mockPayload, { attempts: 3 }, 2);
      await expect(processor.handleCnpjValidation(job)).rejects.toThrow();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPANY_CNPJ_VALIDATION_FAILED',
        }),
      );
    });

    it('should send notification to creator on final attempt failure', async () => {
      verifik.validateCnpj.mockRejectedValue(new Error('Network error'));

      const job = createMockJob(mockPayload, { attempts: 3 }, 2);
      await expect(processor.handleCnpjValidation(job)).rejects.toThrow();

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          notificationType: 'COMPANY_CNPJ_FAILED',
        }),
      );
    });

    it('should send failure email on final attempt failure', async () => {
      verifik.validateCnpj.mockRejectedValue(new Error('timeout'));

      const job = createMockJob(mockPayload, { attempts: 3 }, 2);
      await expect(processor.handleCnpjValidation(job)).rejects.toThrow();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateName: 'cnpj-validation-failed',
        }),
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      verifik.validateCnpj.mockRejectedValue('string error');

      const job = createMockJob(mockPayload, { attempts: 3 }, 2);
      await expect(processor.handleCnpjValidation(job)).rejects.toBe('string error');

      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cnpjData: expect.objectContaining({
              error: expect.objectContaining({
                message: 'string error',
              }),
            }),
          }),
        }),
      );
    });
  });
});
