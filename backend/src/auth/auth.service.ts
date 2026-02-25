import { Injectable, Logger, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivyClient, type User as PrivyUser } from '@privy-io/node';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import {
  UnauthorizedException,
  AppException,
  ConflictException,
} from '../common/filters/app-exception';
import { AuthenticatedUser } from './decorators/current-user.decorator';
import { maskEmail, maskIp } from '../common/utils/redact-pii';
import { REDIS_CLIENT } from '../redis/redis.constants';

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

  // In-memory fallback for when Redis is unavailable
  private readonly failedAttempts = new Map<string, FailedAttempt>();

  static readonly MAX_FAILED_ATTEMPTS = 5;
  static readonly LOCKOUT_DURATION_S = 15 * 60; // 15 minutes in seconds (Redis TTL)
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes in ms (in-memory fallback)
  // BUG-13 fix: Cap in-memory lockout map to prevent memory exhaustion from DDoS
  private static readonly MAX_TRACKED_IPS = 10000;

  // Redis key prefix for rate-limit lockout data
  private static readonly LOCKOUT_PREFIX = 'lockout:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
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
    await this.checkLockout(ipAddress);

    // Verify the Privy token
    let privyUserId: string;
    try {
      const verifiedClaims = await this.privyClient
        .utils()
        .auth()
        .verifyAccessToken(privyAccessToken);
      privyUserId = verifiedClaims.user_id;
    } catch (error) {
      await this.recordFailedAttempt(ipAddress);
      this.logger.warn(
        `Login failed - invalid Privy token from IP: ${maskIp(ipAddress)}`,
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
            `Duplicate email detected: ${maskEmail(email)} already exists with different Privy ID`,
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
          `New user created: ${dbUser.id} (${maskEmail(email)})`,
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
              `Cannot sync email ${maskEmail(email)} — already in use by another account`,
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
    await this.clearFailedAttempts(ipAddress);

    return {
      user: this.toAuthenticatedUser(user),
      isNewUser,
    };
  }

  /**
   * Look up a user by database ID and return the AuthenticatedUser object.
   * Used by session-based auth (AuthGuard) to load the user from a Redis session's userId.
   */
  async getUserById(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
   * Update the current user's profile (firstName, lastName, email).
   * Used during onboarding Step 1.
   */
  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; email?: string },
  ) {
    // If email is being changed, check for uniqueness
    if (data.email) {
      const existingWithEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingWithEmail && existingWithEmail.id !== userId) {
        throw new ConflictException(
          'AUTH_DUPLICATE_EMAIL',
          'errors.auth.duplicateEmail',
          { email: data.email },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
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

    return user;
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

  /**
   * Check if an IP is locked out due to too many failed login attempts.
   * Uses Redis as primary store; falls back to in-memory Map if Redis is unavailable.
   */
  private async checkLockout(ipAddress: string): Promise<void> {
    if (this.redis) {
      try {
        const key = `${AuthService.LOCKOUT_PREFIX}${ipAddress}`;
        const countStr = await this.redis.get(key);
        if (
          countStr !== null &&
          parseInt(countStr, 10) >= AuthService.MAX_FAILED_ATTEMPTS
        ) {
          throw new AccountLockedException();
        }
        return;
      } catch (error) {
        if (error instanceof AccountLockedException) throw error;
        this.logger.warn(
          `Redis lockout check failed, falling back to in-memory: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // In-memory fallback
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
   * Record a failed login attempt for an IP address.
   * Uses Redis INCR for atomic counter with TTL-based auto-expiry.
   * Falls back to in-memory Map (BUG-13 cap) if Redis is unavailable.
   */
  private async recordFailedAttempt(ipAddress: string): Promise<void> {
    if (this.redis) {
      try {
        const key = `${AuthService.LOCKOUT_PREFIX}${ipAddress}`;
        const count = await this.redis.incr(key);

        // Set TTL on first failure (start the attempt window)
        if (count === 1) {
          await this.redis.expire(key, AuthService.LOCKOUT_DURATION_S);
        }

        // Reset TTL to full lockout duration when threshold is reached
        if (count === AuthService.MAX_FAILED_ATTEMPTS) {
          await this.redis.expire(key, AuthService.LOCKOUT_DURATION_S);
          this.logger.warn(
            `IP ${maskIp(ipAddress)} locked out after ${count} failed attempts (Redis)`,
          );
        }
        return;
      } catch (error) {
        this.logger.warn(
          `Redis lockout record failed, falling back to in-memory: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // In-memory fallback
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
        `IP ${maskIp(ipAddress)} locked out after ${attempt.count} failed attempts`,
      );
    }

    this.failedAttempts.set(ipAddress, attempt);

    // BUG-13 fix: Evict oldest non-locked entries if map exceeds cap
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

  /**
   * Clear failed login attempts for an IP address (on successful login).
   * Clears from both Redis and in-memory store.
   */
  private async clearFailedAttempts(ipAddress: string): Promise<void> {
    if (this.redis) {
      try {
        const key = `${AuthService.LOCKOUT_PREFIX}${ipAddress}`;
        await this.redis.del(key);
        return;
      } catch (error) {
        this.logger.warn(
          `Redis lockout clear failed, falling back to in-memory: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // In-memory fallback
    this.failedAttempts.delete(ipAddress);
  }

}
