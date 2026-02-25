import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

/**
 * CSRF protection using double-submit cookie pattern per security.md.
 *
 * How it works:
 * - On safe HTTP methods (GET, HEAD, OPTIONS), sets a random 32-byte hex token
 *   in a non-HTTP-only cookie (`navia-csrf`) readable by frontend JS.
 * - On state-changing methods (POST, PUT, PATCH, DELETE), validates that the
 *   `X-CSRF-Token` header matches the `navia-csrf` cookie value.
 * - Requests using Bearer token authentication are exempt from CSRF validation
 *   because browsers never send Authorization headers automatically in cross-site
 *   requests, making them immune to CSRF attacks.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Set CSRF token on safe HTTP methods (readable by frontend JS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const token = randomBytes(32).toString('hex');
      res.cookie('navia-csrf', token, {
        httpOnly: false, // Must be readable by frontend JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      next();
      return;
    }

    // State-changing methods: POST, PUT, PATCH, DELETE
    // Skip CSRF validation for Bearer token requests — these use
    // Authorization headers which browsers never send automatically,
    // so they are not vulnerable to CSRF attacks.
    const authHeader = req.headers['authorization'];
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      next();
      return;
    }

    // Cookie-authenticated requests must include a valid CSRF token
    const cookieToken = req.cookies?.['navia-csrf'];
    const headerToken = req.headers['x-csrf-token'] as string;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      const lang = this.normalizeLanguage(
        req.headers['accept-language'] as string,
      );

      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_CSRF_INVALID',
          message:
            lang === 'en'
              ? 'Invalid CSRF token'
              : 'Token CSRF inválido',
          messageKey: 'errors.auth.csrfInvalid',
        },
      });
      return;
    }

    next();
  }

  private normalizeLanguage(acceptLanguage: string | undefined): string {
    if (!acceptLanguage) return 'pt-BR';
    const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
    if (lang.startsWith('en')) return 'en';
    return 'pt-BR';
  }
}
