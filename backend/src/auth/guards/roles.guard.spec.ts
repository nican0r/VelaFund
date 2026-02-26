// Mock @privy-io/node to avoid ESM import issues in tests
jest.mock('@privy-io/node', () => ({
  PrivyClient: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '../../common/filters/app-exception';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let prisma: {
    companyMember: {
      findFirst: jest.Mock;
    };
  };

  const mockUser = {
    id: 'user-uuid-1',
    privyUserId: 'did:privy:abc123',
    email: 'test@example.com',
    walletAddress: '0x123',
    firstName: 'Test',
    lastName: 'User',
    kycStatus: 'NOT_STARTED',
    locale: 'pt-BR',
  };

  function createMockExecutionContext(overrides: {
    user?: typeof mockUser | null;
    params?: Record<string, string>;
    method?: string;
    path?: string;
  }): ExecutionContext {
    const request = {
      user: overrides.user ?? mockUser,
      params: overrides.params ?? {},
      method: overrides.method ?? 'GET',
      path: overrides.path ?? '/api/v1/companies/comp-1/shareholders',
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      _request: request,
    } as unknown as ExecutionContext & { _request: any };
  }

  beforeEach(async () => {
    prisma = {
      companyMember: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, { provide: PrismaService, useValue: prisma }, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no @Roles() decorator is present', async () => {
    const ctx = createMockExecutionContext({});
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(prisma.companyMember.findFirst).not.toHaveBeenCalled();
  });

  it('should allow access when @Roles() has empty array', async () => {
    const ctx = createMockExecutionContext({});
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(prisma.companyMember.findFirst).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when no user is attached to request', async () => {
    const ctx = createMockExecutionContext({ user: null as any });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when @Roles() used without companyId param', async () => {
    const ctx = createMockExecutionContext({ params: {} });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException when user is not a company member', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'comp-uuid-1' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    prisma.companyMember.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    expect(prisma.companyMember.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'comp-uuid-1',
        userId: 'user-uuid-1',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        role: true,
        permissions: true,
      },
    });
  });

  it('should throw ForbiddenException when user role does not match required roles', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'comp-uuid-1' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    prisma.companyMember.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'INVESTOR',
      permissions: null,
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when user has ADMIN role and ADMIN is required', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'comp-uuid-1' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    prisma.companyMember.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'ADMIN',
      permissions: null,
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should allow access when user has one of multiple required roles', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'comp-uuid-1' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'FINANCE', 'LEGAL']);
    prisma.companyMember.findFirst.mockResolvedValue({
      id: 'member-2',
      role: 'FINANCE',
      permissions: null,
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should attach companyMember to request on successful authorization', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'comp-uuid-1' },
    }) as ExecutionContext & { _request: any };
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

    const memberData = {
      id: 'member-1',
      role: 'ADMIN',
      permissions: { canExportCapTable: true },
    };
    prisma.companyMember.findFirst.mockResolvedValue(memberData);

    await guard.canActivate(ctx);

    expect(ctx._request.companyMember).toEqual(memberData);
  });

  it('should only find ACTIVE members (not INVITED or REMOVED)', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'comp-uuid-1' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    prisma.companyMember.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    expect(prisma.companyMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('should return 404 (not 403) for non-members to prevent enumeration', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'nonexistent-company' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    prisma.companyMember.findFirst.mockResolvedValue(null);

    try {
      await guard.canActivate(ctx);
      fail('Expected NotFoundException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect((e as NotFoundException).statusCode).toBe(404);
      expect((e as NotFoundException).code).toBe('COMPANY_NOT_FOUND');
    }
  });

  it('should use Reflector with ROLES_KEY to check metadata', async () => {
    const ctx = createMockExecutionContext({
      params: { companyId: 'comp-uuid-1' },
    });
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    prisma.companyMember.findFirst.mockResolvedValue({
      id: 'member-1',
      role: 'ADMIN',
      permissions: null,
    });

    await guard.canActivate(ctx);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.arrayContaining([expect.any(Function), expect.any(Function)]),
    );
  });
});
