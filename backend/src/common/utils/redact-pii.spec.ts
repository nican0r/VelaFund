import {
  redactPii,
  redactPiiFromString,
  maskCpf,
  maskCnpj,
  maskEmail,
  maskWallet,
  maskIp,
} from './redact-pii';

describe('redact-pii', () => {
  describe('maskCpf', () => {
    it('should mask formatted CPF keeping last 2 digits', () => {
      expect(maskCpf('123.456.789-09')).toBe('***.***.***-09');
    });

    it('should mask unformatted CPF keeping last 2 digits', () => {
      expect(maskCpf('12345678909')).toBe('***.***.***-09');
    });

    it('should handle null/undefined/empty', () => {
      expect(maskCpf('')).toBe('***.***.***-**');
      expect(maskCpf(null as unknown as string)).toBe('***.***.***-**');
      expect(maskCpf(undefined as unknown as string)).toBe('***.***.***-**');
    });

    it('should handle short input gracefully', () => {
      expect(maskCpf('1')).toBe('***.***.***-**');
      expect(maskCpf('12')).toBe('***.***.***-12');
    });

    it('should handle non-string input', () => {
      expect(maskCpf(12345678909 as unknown as string)).toBe('***.***.***-**');
    });

    it('should handle CPF with extra whitespace', () => {
      expect(maskCpf(' 123.456.789-09 ')).toBe('***.***.***-09');
    });
  });

  describe('maskCnpj', () => {
    it('should mask formatted CNPJ keeping last 2 digits', () => {
      expect(maskCnpj('12.345.678/0001-90')).toBe('**.***.****/****-90');
    });

    it('should mask unformatted CNPJ keeping last 2 digits', () => {
      expect(maskCnpj('12345678000190')).toBe('**.***.****/****-90');
    });

    it('should handle null/undefined/empty', () => {
      expect(maskCnpj('')).toBe('**.***.****/****-**');
      expect(maskCnpj(null as unknown as string)).toBe('**.***.****/****-**');
      expect(maskCnpj(undefined as unknown as string)).toBe('**.***.****/****-**');
    });

    it('should handle short input gracefully', () => {
      expect(maskCnpj('1')).toBe('**.***.****/****-**');
      expect(maskCnpj('90')).toBe('**.***.****/****-90');
    });
  });

  describe('maskEmail', () => {
    it('should mask email keeping first char and full domain', () => {
      expect(maskEmail('joao@example.com')).toBe('j***@example.com');
    });

    it('should mask single-char local part', () => {
      expect(maskEmail('a@test.com')).toBe('a***@test.com');
    });

    it('should handle null/undefined/empty', () => {
      expect(maskEmail('')).toBe('***@unknown');
      expect(maskEmail(null as unknown as string)).toBe('***@unknown');
      expect(maskEmail(undefined as unknown as string)).toBe('***@unknown');
    });

    it('should handle malformed email without @', () => {
      expect(maskEmail('notanemail')).toBe('***@unknown');
    });

    it('should handle email with @ at start', () => {
      expect(maskEmail('@domain.com')).toBe('***@unknown');
    });

    it('should handle email with subdomain', () => {
      expect(maskEmail('nelson@mail.navia.com.br')).toBe('n***@mail.navia.com.br');
    });
  });

  describe('maskWallet', () => {
    it('should mask Ethereum wallet address', () => {
      expect(maskWallet('0xAbCdEf1234567890AbCdEf1234567890AbCdEf12')).toBe('0xAbCd...Ef12');
    });

    it('should handle short addresses (<=10 chars)', () => {
      expect(maskWallet('0x1234')).toBe('0x1234');
      expect(maskWallet('0x12345678')).toBe('0x12345678');
    });

    it('should handle null/undefined/empty', () => {
      expect(maskWallet('')).toBe('[REDACTED]');
      expect(maskWallet(null as unknown as string)).toBe('[REDACTED]');
      expect(maskWallet(undefined as unknown as string)).toBe('[REDACTED]');
    });

    it('should handle non-Ethereum addresses', () => {
      expect(maskWallet('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe('bc1qar...5mdq');
    });
  });

  describe('maskIp', () => {
    it('should redact IPv4 to /24 subnet', () => {
      expect(maskIp('192.168.1.42')).toBe('192.168.1.0/24');
    });

    it('should handle IPv6-mapped IPv4', () => {
      expect(maskIp('::ffff:192.168.1.42')).toBe('192.168.1.0/24');
    });

    it('should handle pure IPv6 by masking last 2 segments', () => {
      expect(maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
        '2001:0db8:85a3:0000:0000:8a2e:xxxx:xxxx',
      );
    });

    it('should handle null/undefined/empty', () => {
      expect(maskIp('')).toBe('unknown');
      expect(maskIp(null as unknown as string)).toBe('unknown');
      expect(maskIp(undefined as unknown as string)).toBe('unknown');
    });

    it('should handle localhost', () => {
      expect(maskIp('127.0.0.1')).toBe('127.0.0.0/24');
    });
  });

  describe('redactPii', () => {
    it('should return null/undefined as-is', () => {
      expect(redactPii(null)).toBeNull();
      expect(redactPii(undefined)).toBeUndefined();
    });

    it('should return primitives as-is', () => {
      expect(redactPii('hello')).toBe('hello');
      expect(redactPii(42)).toBe(42);
      expect(redactPii(true)).toBe(true);
    });

    it('should mask CPF fields', () => {
      const input = { name: 'João', cpf: '123.456.789-09' };
      const result = redactPii(input);
      expect(result).toEqual({ name: 'João', cpf: '***.***.***-09' });
    });

    it('should mask CNPJ fields', () => {
      const input = { companyName: 'Acme', cnpj: '12.345.678/0001-90' };
      const result = redactPii(input);
      expect(result).toEqual({
        companyName: 'Acme',
        cnpj: '**.***.****/****-90',
      });
    });

    it('should mask email fields', () => {
      const input = { email: 'joao@example.com', name: 'João' };
      const result = redactPii(input);
      expect(result).toEqual({ email: 'j***@example.com', name: 'João' });
    });

    it('should mask wallet fields', () => {
      const input = {
        walletAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
      };
      const result = redactPii(input);
      expect(result).toEqual({ walletAddress: '0xAbCd...Ef12' });
    });

    it('should mask IP fields', () => {
      const input = { ipAddress: '192.168.1.42', action: 'login' };
      const result = redactPii(input);
      expect(result).toEqual({ ipAddress: '192.168.1.0/24', action: 'login' });
    });

    it('should redact password/token/secret fields', () => {
      const input = {
        password: 'supersecret',
        token: 'jwt.token.value',
        accessToken: 'at_12345',
        secret: 'my-secret-key',
        apiKey: 'ak_12345',
      };
      const result = redactPii(input);
      expect(result).toEqual({
        password: '[REDACTED]',
        token: '[REDACTED]',
        accessToken: '[REDACTED]',
        secret: '[REDACTED]',
        apiKey: '[REDACTED]',
      });
    });

    it('should mark encrypted bank detail fields', () => {
      const input = {
        bankAccountNumber: '12345-6',
        bankRoutingNumber: '001',
      };
      const result = redactPii(input);
      expect(result).toEqual({
        bankAccountNumber: '[ENCRYPTED]',
        bankRoutingNumber: '[ENCRYPTED]',
      });
    });

    it('should handle nested objects recursively', () => {
      const input = {
        user: {
          name: 'João',
          cpf: '123.456.789-09',
          email: 'joao@example.com',
          address: {
            city: 'São Paulo',
            ipAddress: '10.0.0.1',
          },
        },
        metadata: {
          token: 'secret-token',
        },
      };
      const result = redactPii(input);
      expect(result).toEqual({
        user: {
          name: 'João',
          cpf: '***.***.***-09',
          email: 'j***@example.com',
          address: {
            city: 'São Paulo',
            ipAddress: '10.0.0.0/24',
          },
        },
        metadata: {
          token: '[REDACTED]',
        },
      });
    });

    it('should handle arrays', () => {
      const input = [{ email: 'a@test.com' }, { email: 'b@test.com' }];
      const result = redactPii(input);
      expect(result).toEqual([{ email: 'a***@test.com' }, { email: 'b***@test.com' }]);
    });

    it('should handle arrays within objects', () => {
      const input = {
        shareholders: [
          { name: 'João', cpf: '123.456.789-09' },
          { name: 'Maria', cpf: '987.654.321-01' },
        ],
      };
      const result = redactPii(input);
      expect(result).toEqual({
        shareholders: [
          { name: 'João', cpf: '***.***.***-09' },
          { name: 'Maria', cpf: '***.***.***-01' },
        ],
      });
    });

    it('should not mutate the original object', () => {
      const input = { cpf: '123.456.789-09', name: 'João' };
      const original = { ...input };
      redactPii(input);
      expect(input).toEqual(original);
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-01-01');
      const input = { createdAt: date, email: 'j@test.com' };
      const result = redactPii(input);
      expect(result.createdAt).toBe(date);
      expect(result.email).toBe('j***@test.com');
    });

    it('should handle Buffer values in PII fields', () => {
      const input = { cpfEncrypted: Buffer.from('encrypted-data') };
      const result = redactPii(input);
      expect(result.cpfEncrypted).toBe('[BINARY_DATA]');
    });

    it('should handle Buffer values in non-PII fields', () => {
      const input = { content: Buffer.from('some-data') };
      const result = redactPii(input);
      expect(result.content).toBe('[BINARY_DATA]');
    });

    it('should respect maxDepth to prevent infinite recursion', () => {
      const deep: Record<string, unknown> = { level: 0 };
      let current = deep;
      for (let i = 1; i <= 15; i++) {
        const next: Record<string, unknown> = { level: i };
        current.child = next;
        current = next;
      }
      current.email = 'test@example.com';

      // With default maxDepth=10, the deepest levels should be truncated
      const result = redactPii(deep);
      expect(result).toBeDefined();
    });

    it('should handle null values in fields that would be masked', () => {
      const input = { cpf: null, email: null, ipAddress: null };
      const result = redactPii(input);
      expect(result).toEqual({ cpf: null, email: null, ipAddress: null });
    });

    it('should handle undefined values in fields that would be masked', () => {
      const input = { cpf: undefined, email: undefined };
      const result = redactPii(input);
      expect(result).toEqual({ cpf: undefined, email: undefined });
    });

    it('should detect token-like fields via pattern matching', () => {
      const input = {
        authToken: 'my-auth-token',
        resetPassword: 'temp-pass',
        clientSecret: 'cs_123',
      };
      const result = redactPii(input);
      expect(result).toEqual({
        authToken: '[REDACTED]',
        resetPassword: '[REDACTED]',
        clientSecret: '[REDACTED]',
      });
    });

    it('should handle targetEmail field', () => {
      const input = { targetEmail: 'target@domain.com' };
      const result = redactPii(input);
      expect(result).toEqual({ targetEmail: 't***@domain.com' });
    });

    it('should preserve non-PII fields exactly', () => {
      const input = {
        id: 'uuid-123',
        status: 'ACTIVE',
        type: 'INDIVIDUAL',
        createdAt: '2026-01-15T10:30:00.000Z',
        quantity: 10000,
        pricePerShare: '1.50',
        isVerified: true,
      };
      const result = redactPii(input);
      expect(result).toEqual(input);
    });

    it('should handle empty object', () => {
      expect(redactPii({})).toEqual({});
    });

    it('should handle all PII field types together', () => {
      const input = {
        id: 'uuid-123',
        name: 'João Silva',
        cpf: '123.456.789-09',
        cnpj: '12.345.678/0001-90',
        email: 'joao@example.com',
        walletAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
        ipAddress: '192.168.1.42',
        password: 'super-secret',
        bankAccountNumber: '12345-6',
        status: 'ACTIVE',
      };
      const result = redactPii(input);
      expect(result).toEqual({
        id: 'uuid-123',
        name: 'João Silva',
        cpf: '***.***.***-09',
        cnpj: '**.***.****/****-90',
        email: 'j***@example.com',
        walletAddress: '0xAbCd...Ef12',
        ipAddress: '192.168.1.0/24',
        password: '[REDACTED]',
        bankAccountNumber: '[ENCRYPTED]',
        status: 'ACTIVE',
      });
    });
  });

  describe('redactPiiFromString', () => {
    it('should mask CPF patterns in strings', () => {
      const msg = 'User with CPF 123.456.789-09 logged in';
      expect(redactPiiFromString(msg)).toBe('User with CPF ***.***.***-09 logged in');
    });

    it('should mask CNPJ patterns in strings', () => {
      const msg = 'Company CNPJ 12.345.678/0001-90 validated';
      expect(redactPiiFromString(msg)).toBe('Company CNPJ **.***.****/****-90 validated');
    });

    it('should mask email patterns in strings', () => {
      const msg = 'Sent email to joao@example.com';
      expect(redactPiiFromString(msg)).toBe('Sent email to j***@example.com');
    });

    it('should mask Ethereum wallet patterns in strings', () => {
      const msg = 'Wallet 0xAbCdEf1234567890AbCdEf1234567890AbCdEf12 connected';
      expect(redactPiiFromString(msg)).toBe('Wallet 0xAbCd...Ef12 connected');
    });

    it('should handle multiple PII values in one string', () => {
      const msg = 'User 123.456.789-09 (joao@example.com) logged in from 192.168.1.42';
      const result = redactPiiFromString(msg);
      expect(result).toContain('***.***.***-09');
      expect(result).toContain('j***@example.com');
      // Note: IP redaction is not done in string mode (would need context)
    });

    it('should handle null/undefined/empty', () => {
      expect(redactPiiFromString('')).toBe('');
      expect(redactPiiFromString(null as unknown as string)).toBe(null);
      expect(redactPiiFromString(undefined as unknown as string)).toBe(undefined);
    });

    it('should not modify strings without PII', () => {
      const msg = 'User created a new company with status ACTIVE';
      expect(redactPiiFromString(msg)).toBe(msg);
    });

    it('should handle multiple emails in one string', () => {
      const msg = 'From: alice@test.com To: bob@test.com';
      const result = redactPiiFromString(msg);
      expect(result).toBe('From: a***@test.com To: b***@test.com');
    });
  });
});
