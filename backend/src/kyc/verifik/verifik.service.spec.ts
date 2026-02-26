import { ConfigService } from '@nestjs/config';
import {
  VerifikService,
  VerifikUnavailableException,
  KycCpfNotFoundException,
  KycCpfDobMismatchException,
  KycDocumentUnreadableException,
  KycFaceMatchFailedException,
  KycLivenessCheckFailedException,
} from './verifik.service';
import { HttpStatus } from '@nestjs/common';

// ─── Mock global fetch ──────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchResponse(status: number, body: unknown) {
  return mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValueOnce(JSON.stringify(body)),
  } as unknown as Response);
}

function mockFetchNetworkError(message = 'Network error') {
  return mockFetch.mockRejectedValueOnce(new Error(message));
}

function mockFetchTimeout() {
  const abortError = new Error('The operation was aborted');
  abortError.name = 'AbortError';
  return mockFetch.mockRejectedValueOnce(abortError);
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const VALID_CPF = '123.456.789-09';
const VALID_DOB = '15/03/1990';
const VALID_NAME = 'Joao Silva';
const VALID_NATIONALITY = 'BR';

const DOCUMENT_FILE = Buffer.from('fake-document-bytes');
const SELFIE_FILE = Buffer.from('fake-selfie-bytes');
const DOCUMENT_IMAGE_URL = 'https://s3.amazonaws.com/bucket/doc.jpg';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VerifikService', () => {
  let service: VerifikService;

  function buildService(): VerifikService {
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'VERIFIK_API_TOKEN') return 'test-api-token';
        if (key === 'VERIFIK_BASE_URL') return defaultValue ?? 'https://api.verifik.co/v2';
        return defaultValue;
      }),
    };
    return new VerifikService(mockConfig as unknown as ConfigService);
  }

  function buildUnconfiguredService(): VerifikService {
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'VERIFIK_API_TOKEN') return undefined;
        if (key === 'VERIFIK_BASE_URL') return defaultValue ?? 'https://api.verifik.co/v2';
        return defaultValue;
      }),
    };
    return new VerifikService(mockConfig as unknown as ConfigService);
  }

  beforeEach(() => {
    mockFetch.mockReset();
    service = buildService();
  });

  // ─── Exception Classes ──────────────────────────────────────────────────

  describe('Exception Classes', () => {
    it('VerifikUnavailableException has 502 status and correct code', () => {
      const ex = new VerifikUnavailableException({ reason: 'test' });
      expect(ex.statusCode).toBe(HttpStatus.BAD_GATEWAY);
      expect(ex.code).toBe('KYC_VERIFIK_UNAVAILABLE');
      expect(ex.messageKey).toBe('errors.kyc.verifikUnavailable');
      expect(ex.details).toEqual({ reason: 'test' });
    });

    it('KycCpfNotFoundException has 404 status and correct code', () => {
      const ex = new KycCpfNotFoundException();
      expect(ex.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(ex.code).toBe('KYC_CPF_NOT_FOUND');
      expect(ex.messageKey).toBe('errors.kyc.cpfNotFound');
    });

    it('KycCpfDobMismatchException has 422 status and correct code', () => {
      const ex = new KycCpfDobMismatchException({ provided: '01/01/2000' });
      expect(ex.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.code).toBe('KYC_CPF_DOB_MISMATCH');
      expect(ex.messageKey).toBe('errors.kyc.cpfDobMismatch');
    });

    it('KycDocumentUnreadableException has 422 status and correct code', () => {
      const ex = new KycDocumentUnreadableException();
      expect(ex.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.code).toBe('KYC_DOCUMENT_UNREADABLE');
      expect(ex.messageKey).toBe('errors.kyc.documentUnreadable');
    });

    it('KycFaceMatchFailedException has 422 status and correct code', () => {
      const ex = new KycFaceMatchFailedException();
      expect(ex.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.code).toBe('KYC_FACE_MATCH_FAILED');
      expect(ex.messageKey).toBe('errors.kyc.faceMatchFailed');
    });

    it('KycLivenessCheckFailedException has 422 status and correct code', () => {
      const ex = new KycLivenessCheckFailedException();
      expect(ex.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.code).toBe('KYC_LIVENESS_CHECK_FAILED');
      expect(ex.messageKey).toBe('errors.kyc.livenessCheckFailed');
    });
  });

  // ─── isAvailable ────────────────────────────────────────────────────────

  describe('isAvailable', () => {
    it('returns true when API token is configured', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('returns false when API token is not set', () => {
      const svc = buildUnconfiguredService();
      expect(svc.isAvailable()).toBe(false);
    });

    it('returns false when API token is empty string', () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
          if (key === 'VERIFIK_API_TOKEN') return '';
          if (key === 'VERIFIK_BASE_URL') return defaultValue ?? 'https://api.verifik.co/v2';
          return defaultValue;
        }),
      };
      const svc = new VerifikService(mockConfig as unknown as ConfigService);
      expect(svc.isAvailable()).toBe(false);
    });
  });

  // ─── verifyCpf ──────────────────────────────────────────────────────────

  describe('verifyCpf', () => {
    it('successfully verifies CPF with English field names', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        dateOfBirth: '15/03/1990',
        cpfStatus: 'REGULAR',
        signature: 'abc123',
      });

      const result = await service.verifyCpf(VALID_CPF, VALID_DOB);

      expect(result).toEqual({
        data: {
          fullName: 'Joao Silva',
          dateOfBirth: '15/03/1990',
          cpfStatus: 'REGULAR',
        },
        signature: 'abc123',
      });

      // Verify fetch was called with the correct URL (digits only)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('cpf=12345678909');
      expect(fetchUrl).toContain('birthDate=15%2F03%2F1990');
      expect(fetchUrl).toContain('/br/cedula');
    });

    it('successfully verifies CPF with Portuguese field names', async () => {
      mockFetchResponse(200, {
        nome: 'Maria Santos',
        dataNascimento: '20/05/1985',
        situacao: 'REGULAR',
        signature: 'sig456',
      });

      const result = await service.verifyCpf('987.654.321-00', '20/05/1985');

      expect(result).toEqual({
        data: {
          fullName: 'Maria Santos',
          dateOfBirth: '20/05/1985',
          cpfStatus: 'REGULAR',
        },
        signature: 'sig456',
      });
    });

    it('uses English field over Portuguese when both present', async () => {
      mockFetchResponse(200, {
        fullName: 'English Name',
        nome: 'Portuguese Name',
        dateOfBirth: '15/03/1990',
        dataNascimento: '15/03/1990',
        cpfStatus: 'REGULAR',
        situacao: 'IRREGULAR',
      });

      const result = await service.verifyCpf(VALID_CPF, VALID_DOB);

      expect(result.data.fullName).toBe('English Name');
      expect(result.data.cpfStatus).toBe('REGULAR');
    });

    it('defaults cpfStatus to REGULAR when no status field present', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        dateOfBirth: '15/03/1990',
      });

      const result = await service.verifyCpf(VALID_CPF, VALID_DOB);

      expect(result.data.cpfStatus).toBe('REGULAR');
    });

    it('throws KycCpfDobMismatchException when DOB does not match', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        dateOfBirth: '01/01/1980', // Different from provided
        cpfStatus: 'REGULAR',
      });

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        KycCpfDobMismatchException,
      );
    });

    it('includes provided DOB in KycCpfDobMismatchException details', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        dateOfBirth: '01/01/1980',
        cpfStatus: 'REGULAR',
      });

      try {
        await service.verifyCpf(VALID_CPF, VALID_DOB);
        fail('Expected exception to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(KycCpfDobMismatchException);
        expect((err as KycCpfDobMismatchException).details).toEqual({
          provided: VALID_DOB,
        });
      }
    });

    it('does not throw DOB mismatch when API returns empty DOB', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        dateOfBirth: '',
        cpfStatus: 'REGULAR',
      });

      const result = await service.verifyCpf(VALID_CPF, VALID_DOB);

      // When DOB from API is empty/falsy, use provided DOB
      expect(result.data.dateOfBirth).toBe(VALID_DOB);
    });

    it('throws VerifikUnavailableException when not configured', async () => {
      const svc = buildUnconfiguredService();

      await expect(svc.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        await svc.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual({
          reason: 'notConfigured',
        });
      }
    });

    it('throws KycCpfNotFoundException when Verifik returns 404', async () => {
      mockFetchResponse(404, { message: 'CPF not found' });

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        KycCpfNotFoundException,
      );
    });

    it('throws VerifikUnavailableException on network error', async () => {
      mockFetchNetworkError('ECONNREFUSED');

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        mockFetchNetworkError('ECONNREFUSED');
        await service.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ reason: 'networkError' }),
        );
      }
    });

    it('throws VerifikUnavailableException on timeout (AbortError)', async () => {
      mockFetchTimeout();

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        mockFetchTimeout();
        await service.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({
            reason: 'timeout',
            timeoutMs: 30_000,
          }),
        );
      }
    });

    it('throws VerifikUnavailableException on 401 auth error', async () => {
      mockFetchResponse(401, { message: 'Invalid token' });

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        mockFetchResponse(401, { message: 'Invalid token' });
        await service.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ reason: 'authError', status: 401 }),
        );
      }
    });

    it('throws VerifikUnavailableException on 403 auth error', async () => {
      mockFetchResponse(403, { message: 'Forbidden' });

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        mockFetchResponse(403, { message: 'Forbidden' });
        await service.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ reason: 'authError', status: 403 }),
        );
      }
    });

    it('throws VerifikUnavailableException on 500 server error', async () => {
      mockFetchResponse(500, { message: 'Internal server error' });

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        mockFetchResponse(500, { message: 'Internal server error' });
        await service.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ reason: 'serverError', status: 500 }),
        );
      }
    });

    it('strips CPF formatting and sends digits only', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        dateOfBirth: VALID_DOB,
        cpfStatus: 'REGULAR',
      });

      await service.verifyCpf('123.456.789-09', VALID_DOB);

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('cpf=12345678909');
      expect(fetchUrl).not.toContain('123.456.789-09');
    });

    it('sends Authorization Bearer header with API token', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        dateOfBirth: VALID_DOB,
        cpfStatus: 'REGULAR',
      });

      await service.verifyCpf(VALID_CPF, VALID_DOB);

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect((fetchOptions.headers as Record<string, string>).Authorization).toBe(
        'Bearer test-api-token',
      );
    });

    it('sends GET request for CPF verification', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        dateOfBirth: VALID_DOB,
        cpfStatus: 'REGULAR',
      });

      await service.verifyCpf(VALID_CPF, VALID_DOB);

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.method).toBe('GET');
    });
  });

  // ─── verifyDocument ─────────────────────────────────────────────────────

  describe('verifyDocument', () => {
    it('successfully verifies document with English field names (verified=true, authenticity>=50)', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        documentNumber: '1234567',
        issueDate: '01/01/2020',
        expiryDate: '01/01/2030',
        verified: true,
        authenticity: 85,
      });

      const result = await service.verifyDocument(DOCUMENT_FILE, 'CNH');

      expect(result).toEqual({
        data: {
          fullName: 'Joao Silva',
          documentNumber: '1234567',
          issueDate: '01/01/2020',
          expiryDate: '01/01/2030',
        },
        verified: true,
        authenticity: 85,
      });
    });

    it('successfully verifies document with Portuguese field names', async () => {
      mockFetchResponse(200, {
        nome: 'Maria Santos',
        numeroDocumento: 'RG-987654',
        dataEmissao: '15/06/2018',
        dataValidade: '15/06/2028',
        verified: true,
        autenticidade: 92,
      });

      const result = await service.verifyDocument(DOCUMENT_FILE, 'RG');

      expect(result).toEqual({
        data: {
          fullName: 'Maria Santos',
          documentNumber: 'RG-987654',
          issueDate: '15/06/2018',
          expiryDate: '15/06/2028',
        },
        verified: true,
        authenticity: 92,
      });
    });

    it('successfully verifies document at exact authenticity threshold of 50', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        documentNumber: '123',
        verified: true,
        authenticity: 50,
      });

      const result = await service.verifyDocument(DOCUMENT_FILE, 'RG');

      expect(result.verified).toBe(true);
      expect(result.authenticity).toBe(50);
    });

    it('throws KycDocumentUnreadableException when verified=false', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        documentNumber: '123',
        verified: false,
        authenticity: 90,
      });

      await expect(service.verifyDocument(DOCUMENT_FILE, 'CNH')).rejects.toThrow(
        KycDocumentUnreadableException,
      );
    });

    it('throws KycDocumentUnreadableException when authenticity<50', async () => {
      mockFetchResponse(200, {
        fullName: 'Joao Silva',
        documentNumber: '123',
        verified: true,
        authenticity: 49,
      });

      await expect(service.verifyDocument(DOCUMENT_FILE, 'CNH')).rejects.toThrow(
        KycDocumentUnreadableException,
      );
    });

    it('includes verified, authenticity, and documentType in exception details', async () => {
      mockFetchResponse(200, {
        verified: false,
        authenticity: 30,
      });

      try {
        await service.verifyDocument(DOCUMENT_FILE, 'PASSPORT');
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(KycDocumentUnreadableException);
        expect((err as KycDocumentUnreadableException).details).toEqual({
          verified: false,
          authenticity: 30,
          documentType: 'PASSPORT',
        });
      }
    });

    it('throws KycDocumentUnreadableException when both verified=false and authenticity<50', async () => {
      mockFetchResponse(200, {
        verified: false,
        authenticity: 10,
      });

      await expect(service.verifyDocument(DOCUMENT_FILE, 'RNE')).rejects.toThrow(
        KycDocumentUnreadableException,
      );
    });

    it('defaults verified to false and authenticity to 0 when fields missing', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        documentNumber: '123',
      });

      // verified defaults to false, authenticity defaults to 0 -> should throw
      await expect(service.verifyDocument(DOCUMENT_FILE, 'CNH')).rejects.toThrow(
        KycDocumentUnreadableException,
      );
    });

    it('handles null issueDate and expiryDate gracefully', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        documentNumber: '123',
        issueDate: null,
        expiryDate: null,
        verified: true,
        authenticity: 75,
      });

      const result = await service.verifyDocument(DOCUMENT_FILE, 'CNH');

      expect(result.data.issueDate).toBeNull();
      expect(result.data.expiryDate).toBeNull();
    });

    it('throws VerifikUnavailableException when not configured', async () => {
      const svc = buildUnconfiguredService();

      await expect(svc.verifyDocument(DOCUMENT_FILE, 'CNH')).rejects.toThrow(
        VerifikUnavailableException,
      );
    });

    it('sends POST request with multipart/form-data content type', async () => {
      mockFetchResponse(200, {
        verified: true,
        authenticity: 85,
        fullName: 'Test',
        documentNumber: '123',
      });

      await service.verifyDocument(DOCUMENT_FILE, 'RG');

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.method).toBe('POST');
      const contentType = (fetchOptions.headers as Record<string, string>)['Content-Type'];
      expect(contentType).toContain('multipart/form-data');
      expect(contentType).toContain('boundary=');
    });

    it('uses the correct endpoint URL', async () => {
      mockFetchResponse(200, {
        verified: true,
        authenticity: 85,
        fullName: 'Test',
        documentNumber: '123',
      });

      await service.verifyDocument(DOCUMENT_FILE, 'CNH');

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toBe('https://api.verifik.co/v2/documents/verify');
    });
  });

  // ─── matchFace ──────────────────────────────────────────────────────────

  describe('matchFace', () => {
    it('successfully matches face with scores above thresholds', async () => {
      mockFetchResponse(200, {
        matchScore: 95,
        livenessScore: 88,
      });

      const result = await service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL);

      expect(result).toEqual({
        matchScore: 95,
        livenessScore: 88,
      });
    });

    it('succeeds at exact threshold values (matchScore=80, livenessScore=70)', async () => {
      mockFetchResponse(200, {
        matchScore: 80,
        livenessScore: 70,
      });

      const result = await service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL);

      expect(result.matchScore).toBe(80);
      expect(result.livenessScore).toBe(70);
    });

    it('throws KycLivenessCheckFailedException when livenessScore < 70', async () => {
      mockFetchResponse(200, {
        matchScore: 95,
        livenessScore: 69,
      });

      await expect(service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL)).rejects.toThrow(
        KycLivenessCheckFailedException,
      );
    });

    it('includes livenessScore and threshold in KycLivenessCheckFailedException details', async () => {
      mockFetchResponse(200, {
        matchScore: 95,
        livenessScore: 50,
      });

      try {
        await service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL);
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(KycLivenessCheckFailedException);
        expect((err as KycLivenessCheckFailedException).details).toEqual({
          livenessScore: 50,
          threshold: 70,
        });
      }
    });

    it('throws KycFaceMatchFailedException when matchScore < 80', async () => {
      mockFetchResponse(200, {
        matchScore: 79,
        livenessScore: 85,
      });

      await expect(service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL)).rejects.toThrow(
        KycFaceMatchFailedException,
      );
    });

    it('includes matchScore and threshold in KycFaceMatchFailedException details', async () => {
      mockFetchResponse(200, {
        matchScore: 60,
        livenessScore: 90,
      });

      try {
        await service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL);
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(KycFaceMatchFailedException);
        expect((err as KycFaceMatchFailedException).details).toEqual({
          matchScore: 60,
          threshold: 80,
        });
      }
    });

    it('checks liveness BEFORE face match (liveness failure takes priority)', async () => {
      // Both scores below threshold, liveness check should fire first
      mockFetchResponse(200, {
        matchScore: 50,
        livenessScore: 30,
      });

      await expect(service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL)).rejects.toThrow(
        KycLivenessCheckFailedException,
      );
    });

    it('handles Portuguese response fields (pontuacaoCorrespondencia, pontuacaoVivacidade)', async () => {
      mockFetchResponse(200, {
        pontuacaoCorrespondencia: 92,
        pontuacaoVivacidade: 85,
      });

      const result = await service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL);

      expect(result).toEqual({
        matchScore: 92,
        livenessScore: 85,
      });
    });

    it('prefers English field names when both present', async () => {
      mockFetchResponse(200, {
        matchScore: 90,
        pontuacaoCorrespondencia: 50,
        livenessScore: 80,
        pontuacaoVivacidade: 40,
      });

      const result = await service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL);

      expect(result.matchScore).toBe(90);
      expect(result.livenessScore).toBe(80);
    });

    it('defaults scores to 0 when fields are missing (throws liveness exception)', async () => {
      mockFetchResponse(200, {});

      await expect(service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL)).rejects.toThrow(
        KycLivenessCheckFailedException,
      );
    });

    it('throws VerifikUnavailableException when not configured', async () => {
      const svc = buildUnconfiguredService();

      await expect(svc.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL)).rejects.toThrow(
        VerifikUnavailableException,
      );
    });

    it('sends POST request to face/match endpoint', async () => {
      mockFetchResponse(200, {
        matchScore: 95,
        livenessScore: 88,
      });

      await service.matchFace(SELFIE_FILE, DOCUMENT_IMAGE_URL);

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toBe('https://api.verifik.co/v2/face/match');

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.method).toBe('POST');
    });
  });

  // ─── screenAml ──────────────────────────────────────────────────────────

  describe('screenAml', () => {
    it('returns AML results with English fields', async () => {
      mockFetchResponse(200, {
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: { source: 'global-screening-db' },
      });

      const result = await service.screenAml(VALID_NAME, VALID_CPF, VALID_NATIONALITY);

      expect(result).toEqual({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: { source: 'global-screening-db' },
      });
    });

    it('returns AML results with Portuguese fields', async () => {
      mockFetchResponse(200, {
        pontuacaoRisco: 'MEDIUM',
        ePEP: true,
        correspondenciaSancoes: false,
        detalhes: { cargo: 'Deputado Federal' },
      });

      const result = await service.screenAml(VALID_NAME, VALID_CPF, VALID_NATIONALITY);

      expect(result).toEqual({
        riskScore: 'MEDIUM',
        isPEP: true,
        sanctionsMatch: false,
        details: { cargo: 'Deputado Federal' },
      });
    });

    it('prefers English fields when both present', async () => {
      mockFetchResponse(200, {
        riskScore: 'HIGH',
        pontuacaoRisco: 'LOW',
        isPEP: true,
        ePEP: false,
        sanctionsMatch: true,
        correspondenciaSancoes: false,
        details: { en: true },
        detalhes: { pt: true },
      });

      const result = await service.screenAml(VALID_NAME, VALID_CPF, VALID_NATIONALITY);

      expect(result.riskScore).toBe('HIGH');
      expect(result.isPEP).toBe(true);
      expect(result.sanctionsMatch).toBe(true);
      expect(result.details).toEqual({ en: true });
    });

    it('handles missing/undefined fields gracefully with defaults', async () => {
      mockFetchResponse(200, {});

      const result = await service.screenAml(VALID_NAME, VALID_CPF, VALID_NATIONALITY);

      expect(result).toEqual({
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });
    });

    it('strips CPF digits for API call (sends digits only)', async () => {
      mockFetchResponse(200, {
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.screenAml(VALID_NAME, '123.456.789-09', VALID_NATIONALITY);

      // The body is sent as an ArrayBuffer, but we can verify via the fetch call
      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const bodyBuffer = Buffer.from(fetchOptions.body as ArrayBuffer);
      const bodyJson = JSON.parse(bodyBuffer.toString('utf-8'));

      expect(bodyJson.cpf).toBe('12345678909');
      expect(bodyJson.fullName).toBe(VALID_NAME);
      expect(bodyJson.nationality).toBe(VALID_NATIONALITY);
    });

    it('throws VerifikUnavailableException when not configured', async () => {
      const svc = buildUnconfiguredService();

      await expect(svc.screenAml(VALID_NAME, VALID_CPF, VALID_NATIONALITY)).rejects.toThrow(
        VerifikUnavailableException,
      );
    });

    it('sends POST request to screening endpoint', async () => {
      mockFetchResponse(200, {
        riskScore: 'LOW',
        isPEP: false,
        sanctionsMatch: false,
        details: {},
      });

      await service.screenAml(VALID_NAME, VALID_CPF, VALID_NATIONALITY);

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toBe('https://api.verifik.co/v2/screening');

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.method).toBe('POST');
      expect((fetchOptions.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
    });

    it('handles HIGH risk score with sanctions match', async () => {
      mockFetchResponse(200, {
        riskScore: 'HIGH',
        isPEP: true,
        sanctionsMatch: true,
        details: {
          sanctionsList: 'OFAC SDN',
          pepCategory: 'Foreign Senior Political Figure',
        },
      });

      const result = await service.screenAml(VALID_NAME, VALID_CPF, VALID_NATIONALITY);

      expect(result.riskScore).toBe('HIGH');
      expect(result.isPEP).toBe(true);
      expect(result.sanctionsMatch).toBe(true);
      expect(result.details).toHaveProperty('sanctionsList');
    });
  });

  // ─── Private request method (tested indirectly) ─────────────────────────

  describe('private request method (tested indirectly)', () => {
    it('handles non-JSON response body gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: jest.fn().mockResolvedValueOnce('Bad Gateway - not JSON'),
      } as unknown as Response);

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );
    });

    it('handles empty response body (empty string)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValueOnce(''),
      } as unknown as Response);

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );
    });

    it('handles 422 as apiError', async () => {
      mockFetchResponse(422, { message: 'Unprocessable entity' });

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        mockFetchResponse(422, { message: 'Unprocessable entity' });
        await service.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ reason: 'apiError', status: 422 }),
        );
      }
    });

    it('handles 400 as apiError', async () => {
      mockFetchResponse(400, { message: 'Bad request' });

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );

      try {
        mockFetchResponse(400, { message: 'Bad request' });
        await service.verifyCpf(VALID_CPF, VALID_DOB);
      } catch (err) {
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ reason: 'apiError', status: 400 }),
        );
      }
    });

    it('handles 503 as serverError', async () => {
      mockFetchResponse(503, { message: 'Service unavailable' });

      try {
        await service.verifyCpf(VALID_CPF, VALID_DOB);
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(VerifikUnavailableException);
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ reason: 'serverError', status: 503 }),
        );
      }
    });

    it('extracts error message from Portuguese "mensagem" field', async () => {
      mockFetchResponse(500, { mensagem: 'Erro interno do servidor' });

      try {
        await service.verifyCpf(VALID_CPF, VALID_DOB);
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(VerifikUnavailableException);
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({
            message: 'Erro interno do servidor',
          }),
        );
      }
    });

    it('extracts error message from "erro" field', async () => {
      mockFetchResponse(500, { erro: 'Algo deu errado' });

      try {
        await service.verifyCpf(VALID_CPF, VALID_DOB);
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(VerifikUnavailableException);
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ message: 'Algo deu errado' }),
        );
      }
    });

    it('extracts error message from "description" field', async () => {
      mockFetchResponse(500, { description: 'Something went wrong' });

      try {
        await service.verifyCpf(VALID_CPF, VALID_DOB);
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(VerifikUnavailableException);
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ message: 'Something went wrong' }),
        );
      }
    });

    it('falls back to HTTP status code when no message in body', async () => {
      mockFetchResponse(500, { someRandomField: true });

      try {
        await service.verifyCpf(VALID_CPF, VALID_DOB);
        fail('Expected exception');
      } catch (err) {
        expect(err).toBeInstanceOf(VerifikUnavailableException);
        expect((err as VerifikUnavailableException).details).toEqual(
          expect.objectContaining({ message: 'HTTP 500' }),
        );
      }
    });

    it('includes signal (AbortController) in fetch options', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        dateOfBirth: VALID_DOB,
        cpfStatus: 'REGULAR',
      });

      await service.verifyCpf(VALID_CPF, VALID_DOB);

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.signal).toBeDefined();
      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
    });

    it('sets Accept: application/json header', async () => {
      mockFetchResponse(200, {
        fullName: 'Test',
        dateOfBirth: VALID_DOB,
        cpfStatus: 'REGULAR',
      });

      await service.verifyCpf(VALID_CPF, VALID_DOB);

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect((fetchOptions.headers as Record<string, string>).Accept).toBe('application/json');
    });

    it('handles non-Error thrown objects in catch block', async () => {
      // Simulate a non-Error throw (e.g., a string)
      mockFetch.mockRejectedValueOnce('unexpected string error');

      await expect(service.verifyCpf(VALID_CPF, VALID_DOB)).rejects.toThrow(
        VerifikUnavailableException,
      );
    });
  });

  // ─── Constructor / Initialization ──────────────────────────────────────

  describe('constructor', () => {
    it('uses default base URL when VERIFIK_BASE_URL is not set', async () => {
      const customConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
          if (key === 'VERIFIK_API_TOKEN') return 'test-token';
          if (key === 'VERIFIK_BASE_URL') return defaultValue; // falls back to default
          return defaultValue;
        }),
      };

      const svc = new VerifikService(customConfigService as unknown as ConfigService);
      expect(svc.isAvailable()).toBe(true);

      // Verify the default base URL is used by making a call
      mockFetchResponse(200, {
        fullName: 'Test',
        dateOfBirth: VALID_DOB,
        cpfStatus: 'REGULAR',
      });

      await svc.verifyCpf(VALID_CPF, VALID_DOB);

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('https://api.verifik.co/v2');
    });
  });
});
