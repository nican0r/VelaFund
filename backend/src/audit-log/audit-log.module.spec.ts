import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogModule } from './audit-log.module';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bull';

const mockPrisma = {
  $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  auditHashChain: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({}),
  getFailedCount: jest.fn().mockResolvedValue(0),
};

describe('AuditLogModule', () => {
  let module: AuditLogModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    const testModule: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogModule,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('audit-log'), useValue: mockQueue },
      ],
    }).compile();

    module = testModule.get<AuditLogModule>(AuditLogModule);
  });

  describe('onModuleInit', () => {
    it('should create the prevent_audit_modification function', async () => {
      await module.onModuleInit();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE OR REPLACE FUNCTION prevent_audit_modification()'),
      );
    });

    it('should create the immutability trigger for UPDATE on audit_logs', async () => {
      await module.onModuleInit();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TRIGGER audit_logs_immutable_update'),
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('BEFORE UPDATE ON audit_logs'),
      );
    });

    it('should create the immutability trigger for DELETE on audit_logs', async () => {
      await module.onModuleInit();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TRIGGER audit_logs_immutable_delete'),
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('BEFORE DELETE ON audit_logs'),
      );
    });

    it('should drop existing triggers before creating new ones (idempotent)', async () => {
      await module.onModuleInit();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP TRIGGER IF EXISTS audit_logs_immutable_update'),
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP TRIGGER IF EXISTS audit_logs_immutable_delete'),
      );
    });

    it('should execute 5 SQL statements in total', async () => {
      await module.onModuleInit();

      // 1: CREATE FUNCTION, 2: DROP UPDATE TRIGGER, 3: CREATE UPDATE TRIGGER,
      // 4: DROP DELETE TRIGGER, 5: CREATE DELETE TRIGGER
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(5);
    });

    it('should raise exception message mentioning immutability', async () => {
      await module.onModuleInit();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining(
          'Audit logs are immutable. UPDATE and DELETE operations are prohibited.',
        ),
      );
    });

    it('should use plpgsql language for the trigger function', async () => {
      await module.onModuleInit();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LANGUAGE plpgsql'),
      );
    });

    it('should use FOR EACH ROW execution for both triggers', async () => {
      await module.onModuleInit();

      const calls = mockPrisma.$executeRawUnsafe.mock.calls.map((c: unknown[]) => c[0]);
      const triggerCalls = calls.filter(
        (sql: string) => sql.includes('CREATE TRIGGER') && !sql.includes('DROP'),
      );
      expect(triggerCalls).toHaveLength(2);
      for (const sql of triggerCalls) {
        expect(sql).toContain('FOR EACH ROW');
        expect(sql).toContain('EXECUTE FUNCTION prevent_audit_modification()');
      }
    });

    it('should not throw when trigger creation fails', async () => {
      mockPrisma.$executeRawUnsafe.mockRejectedValue(
        new Error('relation "audit_logs" does not exist'),
      );

      await expect(module.onModuleInit()).resolves.not.toThrow();
    });

    it('should not throw when database is unavailable', async () => {
      mockPrisma.$executeRawUnsafe.mockRejectedValue(
        new Error('Connection refused'),
      );

      await expect(module.onModuleInit()).resolves.not.toThrow();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockPrisma.$executeRawUnsafe.mockRejectedValue('string error');

      await expect(module.onModuleInit()).resolves.not.toThrow();
    });
  });
});
