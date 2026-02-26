import { ExecutionContext } from '@nestjs/common';
import { KycGatingGuard } from './kyc-gating.guard';
import { AppException } from '../../common/filters/app-exception';

function createMockExecutionContext(overrides: {
  user?: Record<string, unknown> | undefined;
}): ExecutionContext & { _request: any } {
  const request: any = {
    user: overrides.user,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    _request: request,
  } as unknown as ExecutionContext & { _request: any };
}

const mockApprovedUser = {
  id: 'user-uuid-1',
  privyUserId: 'did:privy:abc123',
  email: 'test@example.com',
  walletAddress: '0x123',
  firstName: 'Test',
  lastName: 'User',
  kycStatus: 'APPROVED',
  locale: 'pt-BR',
};

describe('KycGatingGuard', () => {
  let guard: KycGatingGuard;

  beforeEach(() => {
    guard = new KycGatingGuard();
  });

  it('should allow access when user has APPROVED KYC status', () => {
    const ctx = createMockExecutionContext({ user: mockApprovedUser });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should throw AppException with KYC_REQUIRED code when user has NOT_STARTED status', () => {
    const ctx = createMockExecutionContext({
      user: { ...mockApprovedUser, kycStatus: 'NOT_STARTED' },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('KYC_REQUIRED');
      expect((e as AppException).messageKey).toBe('errors.kyc.required');
      expect((e as AppException).statusCode).toBe(403);
      expect((e as AppException).details).toEqual({ currentStatus: 'NOT_STARTED' });
    }
  });

  it('should throw AppException when user has IN_PROGRESS status', () => {
    const ctx = createMockExecutionContext({
      user: { ...mockApprovedUser, kycStatus: 'IN_PROGRESS' },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('KYC_REQUIRED');
      expect((e as AppException).statusCode).toBe(403);
      expect((e as AppException).details).toEqual({ currentStatus: 'IN_PROGRESS' });
    }
  });

  it('should throw AppException when user has PENDING_REVIEW status', () => {
    const ctx = createMockExecutionContext({
      user: { ...mockApprovedUser, kycStatus: 'PENDING_REVIEW' },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('KYC_REQUIRED');
      expect((e as AppException).details).toEqual({ currentStatus: 'PENDING_REVIEW' });
    }
  });

  it('should throw AppException when user has REJECTED status', () => {
    const ctx = createMockExecutionContext({
      user: { ...mockApprovedUser, kycStatus: 'REJECTED' },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('KYC_REQUIRED');
      expect((e as AppException).details).toEqual({ currentStatus: 'REJECTED' });
    }
  });

  it('should throw AppException when user has RESUBMISSION_REQUIRED status', () => {
    const ctx = createMockExecutionContext({
      user: { ...mockApprovedUser, kycStatus: 'RESUBMISSION_REQUIRED' },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('KYC_REQUIRED');
      expect((e as AppException).details).toEqual({ currentStatus: 'RESUBMISSION_REQUIRED' });
    }
  });

  it('should throw AppException when user is undefined on request', () => {
    const ctx = createMockExecutionContext({ user: undefined });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('KYC_REQUIRED');
      expect((e as AppException).messageKey).toBe('errors.kyc.required');
      expect((e as AppException).statusCode).toBe(403);
    }
  });

  it('should include currentStatus in error details for non-APPROVED users', () => {
    const ctx = createMockExecutionContext({
      user: { ...mockApprovedUser, kycStatus: 'IN_PROGRESS' },
    });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect((e as AppException).details).toHaveProperty('currentStatus');
      expect((e as AppException).details!.currentStatus).toBe('IN_PROGRESS');
    }
  });

  it('should not include details when user is missing', () => {
    const ctx = createMockExecutionContext({ user: undefined });

    try {
      guard.canActivate(ctx);
      fail('Expected AppException to be thrown');
    } catch (e) {
      expect((e as AppException).details).toBeUndefined();
    }
  });

  it('should be instantiable without DI (no constructor dependencies)', () => {
    const instance = new KycGatingGuard();
    expect(instance).toBeDefined();
    expect(instance.canActivate).toBeDefined();
  });
});
