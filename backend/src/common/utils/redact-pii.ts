// PII Redaction Utility
//
// Centralized redaction for all personally identifiable information (PII)
// before logging, Sentry reporting, or audit log storage.
//
// Redaction rules per security.md and error-handling.md:
//   CPF:     ***.***.***-XX        (keep last 2 digits)
//   CNPJ:    **.***.****.****-XX   (keep last 2 digits)
//   Email:   n***@domain.com       (keep first char + domain)
//   Wallet:  0x1234...abcd         (first 6 + last 4)
//   IP:      truncate to /24 subnet
//   Tokens:  [REDACTED]
//   Bank:    [ENCRYPTED]

/** Fields whose values are always fully redacted */
const REDACTED_FIELDS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'appSecret',
  'apiKey',
  'apiToken',
  'authorization',
  'cookie',
  'sessionId',
  'privyToken',
  'blindIndexKey',
]);

/** Fields whose values are marked as encrypted */
const ENCRYPTED_FIELDS = new Set([
  'bankAccountNumber',
  'bankRoutingNumber',
  'accountNumber',
  'routingNumber',
  'bankAccount',
]);

/** Fields containing CPF values */
const CPF_FIELDS = new Set(['cpf', 'cpfNumber', 'cpfEncrypted']);

/** Fields containing CNPJ values */
const CNPJ_FIELDS = new Set(['cnpj', 'cnpjNumber']);

/** Fields containing email values */
const EMAIL_FIELDS = new Set(['email', 'userEmail', 'targetEmail', 'inviteeEmail']);

/** Fields containing wallet addresses */
const WALLET_FIELDS = new Set(['walletAddress', 'wallet', 'fromWallet', 'toWallet']);

/** Fields containing IP addresses */
const IP_FIELDS = new Set(['ip', 'ipAddress', 'remoteAddress', 'clientIp']);

/**
 * Mask a CPF string to ***.***.***-XX (keep last 2 digits).
 * Handles both formatted (123.456.789-09) and unformatted (12345678909) input.
 */
export function maskCpf(cpf: string): string {
  if (!cpf || typeof cpf !== 'string') return '***.***.***-**';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 2) return '***.***.***-**';
  const lastTwo = digits.slice(-2);
  return `***.***.***-${lastTwo}`;
}

/**
 * Mask a CNPJ string keeping only the last 2 digits.
 * Handles both formatted and unformatted input.
 */
export function maskCnpj(cnpj: string): string {
  if (!cnpj || typeof cnpj !== 'string') return '**.***.****/****-**';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length < 2) return '**.***.****/****-**';
  const lastTwo = digits.slice(-2);
  return `**.***.****/****-${lastTwo}`;
}

/**
 * Mask an email to n***@domain.com (keep first character + full domain).
 * Guards against malformed emails.
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '***@unknown';
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return '***@unknown';
  const domain = email.slice(atIndex + 1);
  return `${email[0]}***@${domain}`;
}

/**
 * Mask a wallet address to show first 6 + last 4 characters.
 * Example: 0xAbCd...9876
 */
export function maskWallet(wallet: string): string {
  if (!wallet || typeof wallet !== 'string') return '[REDACTED]';
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

/**
 * Redact an IP address to /24 subnet.
 * Handles IPv6-mapped IPv4 format (::ffff:192.168.1.1).
 * IPv6 addresses are returned with last 2 segments masked.
 */
export function maskIp(ip: string): string {
  if (!ip || typeof ip !== 'string') return 'unknown';
  const clean = ip.replace('::ffff:', '');
  const parts = clean.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  // IPv6: mask last 2 segments
  const ipv6Parts = ip.split(':');
  if (ipv6Parts.length > 2) {
    return ipv6Parts.slice(0, -2).join(':') + ':xxxx:xxxx';
  }
  return ip;
}

/**
 * Determine the masking strategy for a field by its name.
 * Returns null if the field doesn't need special treatment.
 */
function getFieldMaskType(
  fieldName: string,
): 'redacted' | 'encrypted' | 'cpf' | 'cnpj' | 'email' | 'wallet' | 'ip' | null {
  const lower = fieldName.toLowerCase();

  // Exact match checks (case-insensitive via Set lookup on original)
  if (REDACTED_FIELDS.has(fieldName)) return 'redacted';
  if (ENCRYPTED_FIELDS.has(fieldName)) return 'encrypted';
  if (CPF_FIELDS.has(fieldName)) return 'cpf';
  if (CNPJ_FIELDS.has(fieldName)) return 'cnpj';
  if (EMAIL_FIELDS.has(fieldName)) return 'email';
  if (WALLET_FIELDS.has(fieldName)) return 'wallet';
  if (IP_FIELDS.has(fieldName)) return 'ip';

  // Fallback pattern matching for fields not in the exact sets
  if (lower.includes('password') || lower.includes('secret') || lower.includes('token')) {
    return 'redacted';
  }

  return null;
}

/**
 * Apply masking to a single value based on its detected type.
 */
function maskValue(
  value: unknown,
  maskType: 'redacted' | 'encrypted' | 'cpf' | 'cnpj' | 'email' | 'wallet' | 'ip',
): string {
  const str = typeof value === 'string' ? value : String(value);
  switch (maskType) {
    case 'redacted':
      return '[REDACTED]';
    case 'encrypted':
      return '[ENCRYPTED]';
    case 'cpf':
      return maskCpf(str);
    case 'cnpj':
      return maskCnpj(str);
    case 'email':
      return maskEmail(str);
    case 'wallet':
      return maskWallet(str);
    case 'ip':
      return maskIp(str);
  }
}

/**
 * Recursively redact PII from an object.
 *
 * Traverses the object and masks values based on field names.
 * Returns a new object with PII redacted — does not mutate the input.
 *
 * @param data - The object to redact PII from
 * @param maxDepth - Maximum recursion depth to prevent circular reference issues (default: 10)
 * @returns A new object with PII fields masked
 *
 * @example
 * ```typescript
 * const user = { name: 'João', cpf: '123.456.789-09', email: 'joao@example.com' };
 * const redacted = redactPii(user);
 * // { name: 'João', cpf: '***.***.***-09', email: 'j***@example.com' }
 * ```
 */
export function redactPii<T>(data: T, maxDepth: number = 10): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (maxDepth <= 0) return '[MAX_DEPTH]' as unknown as T;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => redactPii(item, maxDepth - 1)) as unknown as T;
  }

  // Handle Date objects — return as-is
  if (data instanceof Date) return data;

  // Handle Buffer/Uint8Array — return placeholder
  if (data instanceof Buffer || data instanceof Uint8Array) {
    return '[BINARY_DATA]' as unknown as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const maskType = getFieldMaskType(key);

    if (maskType && value !== null && value !== undefined) {
      // Binary data in PII fields gets a placeholder, not masking
      if (value instanceof Buffer || value instanceof Uint8Array) {
        result[key] = '[BINARY_DATA]';
      } else {
        result[key] = maskValue(value, maskType);
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactPii(value, maxDepth - 1);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Redact PII from a log message string.
 *
 * Applies regex-based redaction for common PII patterns found in free-text logs:
 * - CPF patterns (XXX.XXX.XXX-XX)
 * - Email patterns
 * - Ethereum wallet addresses (0x...)
 *
 * @param message - The log message to redact
 * @returns The message with PII patterns masked
 */
export function redactPiiFromString(message: string): string {
  if (!message || typeof message !== 'string') return message;

  let result = message;

  // CPF pattern: 123.456.789-09 → ***.***.***-09
  result = result.replace(
    /\b\d{3}\.\d{3}\.\d{3}-(\d{2})\b/g,
    '***.***.***-$1',
  );

  // Unformatted CPF (11 consecutive digits that look like CPF in context)
  // Only match if preceded/followed by non-digit to avoid matching random numbers
  result = result.replace(
    /(?<=\D|^)\d{9}(\d{2})(?=\D|$)/g,
    '***********$1',
  );

  // CNPJ pattern: 12.345.678/0001-90 → **.***.****/****-90
  result = result.replace(
    /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-(\d{2})\b/g,
    '**.***.****/****-$1',
  );

  // Email pattern
  result = result.replace(
    /\b([a-zA-Z0-9])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    '$1***@$2',
  );

  // Ethereum wallet addresses: 0x followed by 40 hex chars
  result = result.replace(
    /\b(0x[a-fA-F0-9]{4})[a-fA-F0-9]{32}([a-fA-F0-9]{4})\b/g,
    '$1...$2',
  );

  return result;
}
