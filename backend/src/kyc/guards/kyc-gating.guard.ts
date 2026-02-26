import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { AppException } from '../../common/filters/app-exception';
import { AuthenticatedUser } from '../../auth/decorators/current-user.decorator';

/**
 * Guard that blocks access unless the authenticated user has KYC status APPROVED.
 *
 * Per kyc-verification.md: founders must complete KYC before publishing profiles,
 * creating companies, or accessing KYC-gated features.
 *
 * Usage: Apply via @UseGuards(KycGatingGuard) on endpoints that require KYC approval.
 * Must run AFTER AuthGuard (which is global), so request.user is always available.
 *
 * No DI dependencies — reads kycStatus from request.user, which AuthGuard loads
 * fresh from the database on every request.
 */
@Injectable()
export class KycGatingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as AuthenticatedUser | undefined;

    if (!user) {
      throw new AppException(
        'KYC_REQUIRED',
        'errors.kyc.required',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.kycStatus !== 'APPROVED') {
      throw new AppException(
        'KYC_REQUIRED',
        'errors.kyc.required',
        HttpStatus.FORBIDDEN,
        { currentStatus: user.kycStatus },
      );
    }

    return true;
  }
}
