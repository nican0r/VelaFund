import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivyClient, type User as PrivyUser } from '@privy-io/node';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  UnauthorizedException,
  AppException,
} from '../common/filters/app-exception';
import { AuthenticatedUser } from './decorators/current-user.decorator';

export class AccountLockedException extends AppException {
  constructor() {
    super(
      'AUTH_ACCOUNT_LOCKED',
      'errors.auth.accountLocked',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class PrivyUnavailableException extends AppException {
  constructor() {
    super(
      'AUTH_PRIVY_UNAVAILABLE',
      'errors.auth.privyUnavailable',
      HttpStatus.BAD_GATEWAY,
    );
  }
}

interface FailedAttempt {
  count: number;
  lockedUntil: Date | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly privyClient: PrivyClient;
  private readonly failedAttempts = new Map<string, FailedAttempt>();

  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  // BUG-13 fix: Cap in-memory lockout map to prevent memory exhaustion from DDoS
  private static readonly MAX_TRACKED_IPS = 10000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const appId = this.configService.get<string>('PRIVY_APP_ID', '');
    const appSecret = this.configService.get<string>('PRIVY_APP_SECRET', '');

    this.privyClient = new PrivyClient({ appId, appSecret });
  }

  /**
   * Verify a Privy access token and return the authenticated user.
   * Called by AuthGuard on every authenticated request.
   */
  async verifyTokenAndGetUser(token: string): Promise<AuthenticatedUser> {
    let privyUserId: string;

    try {
      const verifiedClaims = await this.privyClient
        .utils()
        .auth()
        .verifyAccessToken(token);
      privyUserId = verifiedClaims.user_id;
    } catch (error) {
      this.logger.debug(
        `Privy token verification failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw new UnauthorizedException('errors.auth.invalidToken');
    }

    const user = await this.prisma.user.findUnique({
      where: { privyUserId },
    });

    if (!user) {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }

    return this.toAuthenticatedUser(user);
  }

  /**
   * Handle the login flow:
   * 1. Verify Privy token
   * 2. Get Privy user data
   * 3. Find or create User in database
   * 4. Update last login
   * 5. Return user data
   */
  async login(
    privyAccessToken: string,
    ipAddress: string,
  ): Promise<{
    user: AuthenticatedUser;
    isNewUser: boolean;
  }> {
    this.checkLockout(ipAddress);

    // Verify the Privy token
    let privyUserId: string;
    try {
      const verifiedClaims = await this.privyClient
        .utils()
        .auth()
        .verifyAccessToken(privyAccessToken);
      privyUserId = verifiedClaims.user_id;
    } catch (error) {
      this.recordFailedAttempt(ipAddress);
      this.logger.warn(
        `Login failed - invalid Privy token from IP: ${this.redactIp(ipAddress)}`,
      );
      throw new UnauthorizedException('errors.auth.invalidToken');
    }

    // Get Privy user profile
    let privyUser: PrivyUser;
    try {
      privyUser = await this.privyClient.users()._get(privyUserId);
    } catch (error) {
      this.logger.error(
        `Failed to get Privy user ${privyUserId}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw new PrivyUnavailableException();
    }

    // Extract email and wallet from Privy user's linked accounts
    const email = this.extractEmail(privyUser);
    const walletAddress = this.extractWallet(privyUser);

    if (!email) {
      this.logger.error(`Privy user ${privyUserId} has no email`);
      throw new UnauthorizedException('errors.auth.invalidToken');
    }

    // BUG-8 fix: Wrap find-or-create in a transaction to prevent race conditions.
    // Two concurrent first-login requests for the same Privy user could both attempt
    // to create a user, causing unique-constraint violations.
    const name = this.extractName(privyUser, email);
    let isNewUser = false;

    const user = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let dbUser = await tx.user.findUnique({
        where: { privyUserId },
      });

      if (!dbUser) {
        // Check if email already exists with a different Privy ID
        const existingByEmail = await tx.user.findUnique({
          where: { email },
        });

        if (existingByEmail) {
          this.logger.warn(
            `Duplicate email detected: ${this.redactEmail(email)} already exists with different Privy ID`,
          );
          throw new AppException(
            'AUTH_DUPLICATE_EMAIL',
            'errors.auth.duplicateEmail',
            HttpStatus.CONFLICT,
          );
        }

        // Create new user
        dbUser = await tx.user.create({
          data: {
            privyUserId,
            email,
            walletAddress,
            firstName: name.first,
            lastName: name.last,
            lastLoginAt: new Date(),
          },
        });
        isNewUser = true;
        this.logger.log(
          `New user created: ${dbUser.id} (${this.redactEmail(email)})`,
        );
      } else {
        // BUG-10 fix: Check if synced email conflicts with another user before updating
        const emailUpdateData: Record<string, unknown> = {
          lastLoginAt: new Date(),
        };

        if (walletAddress && walletAddress !== dbUser.walletAddress) {
          emailUpdateData.walletAddress = walletAddress;
        }

        if (email !== dbUser.email) {
          const existingWithEmail = await tx.user.findUnique({
            where: { email },
          });
          if (!existingWithEmail) {
            emailUpdateData.email = email;
          } else {
            this.logger.warn(
              `Cannot sync email ${this.redactEmail(email)} — already in use by another account`,
            );
          }
        }

        dbUser = await tx.user.update({
          where: { id: dbUser.id },
          data: emailUpdateData,
        });
      }

      return dbUser;
    });

    // Clear failed attempts on successful login
    this.clearFailedAttempts(ipAddress);

    return {
      user: this.toAuthenticatedUser(user),
      isNewUser,
    };
  }

  /**
   * Get the current user's full profile.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        profilePictureUrl: true,
        kycStatus: true,
        locale: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }

    return user;
  }

  // --- Private helpers ---

  private toAuthenticatedUser(user: {
    id: string;
    privyUserId: string;
    email: string;
    walletAddress: string | null;
    firstName: string | null;
    lastName: string | null;
    kycStatus: string;
    locale: string;
  }): AuthenticatedUser {
    return {
      id: user.id,
      privyUserId: user.privyUserId,
      email: user.email,
      walletAddress: user.walletAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      kycStatus: user.kycStatus,
      locale: user.locale,
    };
  }

  /**
   * BUG-6 fix: Extract email from Privy linked accounts.
   * Checks email accounts first, then Google OAuth, then Apple OAuth.
   */
  private extractEmail(privyUser: PrivyUser): string | null {
    for (const account of privyUser.linked_accounts) {
      if (account.type === 'email') {
        return account.address;
      }
    }
    for (const account of privyUser.linked_accounts) {
      if (account.type === 'google_oauth') {
        return account.email;
      }
    }
    for (const account of privyUser.linked_accounts) {
      if (account.type === 'apple_oauth') {
        return account.email;
      }
    }
    return null;
  }

  private extractWallet(privyUser: PrivyUser): string | null {
    for (const account of privyUser.linked_accounts) {
      if (
        account.type === 'wallet' &&
        'wallet_client_type' in account &&
        account.wallet_client_type === 'privy'
      ) {
        return account.address;
      }
    }
    return null;
  }

  /**
   * BUG-11 fix: Extract name from Privy linked accounts.
   * Checks Google OAuth and Apple OAuth for name. Falls back to email local part
   * so email-only users don't end up with null firstName.
   */
  private extractName(
    privyUser: PrivyUser,
    email?: string | null,
  ): {
    first: string | null;
    last: string | null;
  } {
    // Try Google OAuth name
    for (const account of privyUser.linked_accounts) {
      if (account.type === 'google_oauth' && account.name) {
        const parts = account.name.split(' ');
        return {
          first: parts[0] || null,
          last: parts.length > 1 ? parts.slice(1).join(' ') : null,
        };
      }
    }
    // Try Apple OAuth name
    for (const account of privyUser.linked_accounts) {
      if (
        account.type === 'apple_oauth' &&
        'first_name' in account &&
        account.first_name
      ) {
        return {
          first: account.first_name as string,
          last: ('last_name' in account ? (account.last_name as string) : null) || null,
        };
      }
    }
    // Fallback: use email local part as first name
    if (email && email.includes('@')) {
      const localPart = email.split('@')[0];
      return { first: localPart, last: null };
    }
    return { first: null, last: null };
  }

  private checkLockout(ipAddress: string): void {
    const attempt = this.failedAttempts.get(ipAddress);
    if (!attempt) return;

    if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
      throw new AccountLockedException();
    }

    // Lock expired, clear it
    if (attempt.lockedUntil && attempt.lockedUntil <= new Date()) {
      this.failedAttempts.delete(ipAddress);
    }
  }

  /**
   * BUG-13 fix: Cap the in-memory Map size. When the limit is reached, evict the
   * oldest non-locked entries to prevent memory exhaustion from DDoS with many IPs.
   */
  private recordFailedAttempt(ipAddress: string): void {
    const attempt = this.failedAttempts.get(ipAddress) || {
      count: 0,
      lockedUntil: null,
    };
    attempt.count += 1;

    if (attempt.count >= AuthService.MAX_FAILED_ATTEMPTS) {
      attempt.lockedUntil = new Date(
        Date.now() + AuthService.LOCKOUT_DURATION_MS,
      );
      this.logger.warn(
        `IP ${this.redactIp(ipAddress)} locked out after ${attempt.count} failed attempts`,
      );
    }

    this.failedAttempts.set(ipAddress, attempt);

    // Evict oldest non-locked entries if map exceeds cap
    if (this.failedAttempts.size > AuthService.MAX_TRACKED_IPS) {
      const now = new Date();
      for (const [ip, entry] of this.failedAttempts) {
        if (!entry.lockedUntil || entry.lockedUntil <= now) {
          this.failedAttempts.delete(ip);
          if (this.failedAttempts.size <= AuthService.MAX_TRACKED_IPS) break;
        }
      }
    }
  }

  private clearFailedAttempts(ipAddress: string): void {
    this.failedAttempts.delete(ipAddress);
  }

  private redactIp(ip: string): string {
    if (!ip) return 'unknown';
    const clean = ip.replace('::ffff:', '');
    const parts = clean.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return ip;
  }

  /**
   * BUG-12 fix: Guard against malformed emails without '@'.
   */
  private redactEmail(email: string): string {
    if (!email) return 'unknown';
    const atIndex = email.indexOf('@');
    if (atIndex < 1) return '***@unknown';
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    return `${local[0]}***@${domain}`;
  }
}
