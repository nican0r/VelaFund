import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { KmsService } from '../aws/kms.service';

/**
 * Application-level encryption service for LGPD compliance.
 *
 * Provides:
 * - KMS-based encryption/decryption for PII fields (CPF, bank details, KYC URLs)
 * - HMAC-SHA256 blind indexes for searchable encrypted fields
 *
 * Graceful degradation:
 * - When KMS is unavailable, encrypt/decrypt throw (callers must handle)
 * - When BLIND_INDEX_KEY is unset, blind index falls back to SHA-256
 *   (functionally correct but less secure — acceptable for development)
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly blindIndexKey: string | undefined;

  constructor(
    private readonly kmsService: KmsService,
    private readonly configService: ConfigService,
  ) {
    this.blindIndexKey = this.configService.get<string>('BLIND_INDEX_KEY');

    if (this.blindIndexKey) {
      this.logger.log('EncryptionService initialized with HMAC blind index key');
    } else {
      this.logger.warn(
        'BLIND_INDEX_KEY not configured. Blind indexes will use SHA-256 fallback (less secure).',
      );
    }

    if (this.kmsService.isAvailable()) {
      this.logger.log('KMS encryption available for PII field encryption');
    } else {
      this.logger.warn('KMS not available. Application-level PII encryption will be unavailable.');
    }
  }

  /**
   * Whether KMS-based encryption is available.
   * When false, encrypt/decrypt will throw — callers should
   * fall back to plaintext storage with appropriate logging.
   */
  isEncryptionAvailable(): boolean {
    return this.kmsService.isAvailable();
  }

  /**
   * Whether blind indexes use HMAC-SHA256 (secure) vs SHA-256 (fallback).
   */
  isBlindIndexSecure(): boolean {
    return !!this.blindIndexKey;
  }

  /**
   * Encrypt a plaintext string using AWS KMS.
   * Throws if KMS is not configured — callers must check isEncryptionAvailable() first,
   * or handle the error for graceful degradation.
   */
  async encrypt(plaintext: string): Promise<Buffer> {
    return this.kmsService.encrypt(plaintext);
  }

  /**
   * Decrypt ciphertext using AWS KMS.
   * Throws if KMS is not configured.
   */
  async decrypt(ciphertext: Buffer): Promise<string> {
    return this.kmsService.decrypt(ciphertext);
  }

  /**
   * Create a blind index for a value (e.g., CPF, CNPJ).
   *
   * Uses HMAC-SHA256 with BLIND_INDEX_KEY when available (production).
   * Falls back to SHA-256 when BLIND_INDEX_KEY is not set (development).
   *
   * The value is normalized to digits only before hashing,
   * so "529.982.247-25" and "52998224725" produce the same index.
   *
   * Returns a 32-character hex string (128-bit truncated hash).
   */
  createBlindIndex(value: string): string {
    const normalized = value.replace(/\D/g, '');

    if (this.blindIndexKey) {
      return createHmac('sha256', this.blindIndexKey).update(normalized).digest('hex').slice(0, 32);
    }

    // Fallback: SHA-256 without key (development only)
    return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  }
}
