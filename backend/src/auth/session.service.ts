import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.constants';

export interface SessionData {
  userId: string;
  createdAt: number; // Unix timestamp ms
  lastActivityAt: number; // Unix timestamp ms
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  // Session timeouts
  static readonly ABSOLUTE_TIMEOUT_S = 7 * 24 * 60 * 60; // 7 days in seconds (Redis TTL)
  static readonly INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in ms

  // Reduce Redis writes: only update lastActivityAt if >60s since last touch
  private static readonly TOUCH_THRESHOLD_MS = 60_000;

  // Redis key prefixes
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user-sessions:';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  /**
   * Create a new session in Redis. Returns the session ID (64-char hex string).
   * Returns null if Redis is not available.
   */
  async createSession(
    userId: string,
    metadata: { ipAddress: string; userAgent: string },
  ): Promise<string | null> {
    if (!this.redis) {
      this.logger.warn(
        'Redis not available — session-based auth disabled, falling back to Privy tokens',
      );
      return null;
    }

    const sessionId = randomBytes(32).toString('hex');
    const now = Date.now();

    const sessionData: SessionData = {
      userId,
      createdAt: now,
      lastActivityAt: now,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    };

    try {
      const key = `${SessionService.SESSION_PREFIX}${sessionId}`;

      // Store session with 7-day TTL (absolute timeout enforced by Redis)
      await this.redis.set(
        key,
        JSON.stringify(sessionData),
        'EX',
        SessionService.ABSOLUTE_TIMEOUT_S,
      );

      // Track session in user's session set (for bulk invalidation on logout-all)
      const userKey = `${SessionService.USER_SESSIONS_PREFIX}${userId}`;
      await this.redis.sadd(userKey, sessionId);
      // User session set TTL = absolute timeout + 1h buffer
      await this.redis.expire(userKey, SessionService.ABSOLUTE_TIMEOUT_S + 3600);

      this.logger.debug(`Session created for user ${userId}: ${sessionId.slice(0, 8)}...`);
      return sessionId;
    } catch (error) {
      this.logger.error(
        `Failed to create session: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return null;
    }
  }

  /**
   * Get session data from Redis.
   * Returns null if session not found, corrupted, or Redis unavailable.
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.redis) return null;

    try {
      const key = `${SessionService.SESSION_PREFIX}${sessionId}`;
      const data = await this.redis.get(key);

      if (!data) return null;

      return JSON.parse(data) as SessionData;
    } catch (error) {
      this.logger.error(
        `Error reading session ${sessionId.slice(0, 8)}...: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return null;
    }
  }

  /**
   * Check if session has been inactive longer than the inactivity timeout (2 hours).
   */
  isInactive(session: SessionData): boolean {
    return Date.now() - session.lastActivityAt > SessionService.INACTIVITY_TIMEOUT_MS;
  }

  /**
   * Update session's lastActivityAt to extend the inactivity window.
   * Skips the write if the last update was within the touch threshold (60s)
   * to reduce Redis write load.
   */
  async touchSession(sessionId: string, session: SessionData): Promise<void> {
    if (!this.redis) return;

    const now = Date.now();
    if (now - session.lastActivityAt < SessionService.TOUCH_THRESHOLD_MS) {
      return; // Recently touched, skip write
    }

    try {
      const key = `${SessionService.SESSION_PREFIX}${sessionId}`;
      // Preserve the remaining TTL (absolute timeout is enforced by Redis TTL, not by us)
      const ttl = await this.redis.ttl(key);
      if (ttl > 0) {
        session.lastActivityAt = now;
        await this.redis.set(key, JSON.stringify(session), 'EX', ttl);
      }
    } catch (error) {
      // Non-critical: session will still work, just inactivity detection may be slightly off
      this.logger.warn(
        `Failed to touch session: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Destroy a single session.
   */
  async destroySession(sessionId: string): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `${SessionService.SESSION_PREFIX}${sessionId}`;

      // Get session to find userId for cleanup of user-sessions set
      const data = await this.redis.get(key);
      if (data) {
        try {
          const session = JSON.parse(data) as SessionData;
          const userKey = `${SessionService.USER_SESSIONS_PREFIX}${session.userId}`;
          await this.redis.srem(userKey, sessionId);
        } catch {
          // Ignore parse errors during cleanup
        }
      }

      await this.redis.del(key);
      this.logger.debug(`Session destroyed: ${sessionId.slice(0, 8)}...`);
    } catch (error) {
      this.logger.error(
        `Failed to destroy session: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Destroy all sessions for a user (e.g., on account deletion or security event).
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    if (!this.redis) return;

    try {
      const userKey = `${SessionService.USER_SESSIONS_PREFIX}${userId}`;
      const sessionIds = await this.redis.smembers(userKey);

      if (sessionIds.length > 0) {
        const sessionKeys = sessionIds.map((id) => `${SessionService.SESSION_PREFIX}${id}`);
        await this.redis.del(...sessionKeys);
        this.logger.debug(`Destroyed ${sessionIds.length} sessions for user ${userId}`);
      }

      await this.redis.del(userKey);
    } catch (error) {
      this.logger.error(
        `Failed to destroy user sessions: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Check if Redis is available for session management.
   */
  isAvailable(): boolean {
    return this.redis !== null;
  }
}
