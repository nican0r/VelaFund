import { ConfigService } from '@nestjs/config';
import {
  BigDataCorpService,
  BigDataCorpNotFoundError,
  BigDataCorpUnavailableError,
} from './bigdatacorp.service';

// ═══════════════════════════════════════════════════════════════════════
// MOCK: global fetch
// ═══════════════════════════════════════════════════════════════════════

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockFetchResponse(status: number, body: unknown) {
  return mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValueOnce(body),
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

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

const VALID_CNPJ = '12.345.678/0001-90';
const CLEAN_CNPJ = '12345678000190';

function buildService(apiToken = 'test-api-token'): BigDataCorpService {
  const mockConfig = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'BIGDATACORP_API_TOKEN') return apiToken;
      if (key === 'BIGDATACORP_BASE_URL') return defaultValue ?? 'https://api.bigdatacorp.com.br';
      return defaultValue;
    }),
  };
  return new BigDataCorpService(mockConfig as unknown as ConfigService);
}

function buildUnconfiguredService(): BigDataCorpService {
  const mockConfig = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'BIGDATACORP_API_TOKEN') return undefined;
      if (key === 'BIGDATACORP_BASE_URL') return defaultValue ?? 'https://api.bigdatacorp.com.br';
      return defaultValue;
    }),
  };
  return new BigDataCorpService(mockConfig as unknown as ConfigService);
}

function buildMockLitigationResponse() {
  return {
    lawsuits: [
      {
        processId: 'PROC-001',
        court: 'TJSP',
        caseType: 'CIVIL',
        status: 'ATIVO',
        filingDate: '2025-01-15',
        lastUpdate: '2025-06-01',
        valueInDispute: '50000.00',
        plaintiffName: 'João Silva',
        defendantRole: 'Réu',
        subject: 'Cobrança',
      },
      {
        processId: 'PROC-002',
        court: 'TRT',
        caseType: 'TRABALHISTA',
        status: 'ENCERRADO',
        filingDate: '2024-03-10',
        lastUpdate: '2025-02-20',
        valueInDispute: '25000.00',
        plaintiffName: 'Maria Santos',
        defendantRole: 'Réu',
        subject: 'Reclamação Trabalhista',
      },
    ],
    administrativeProceedings: [
      {
        processId: 'ADM-001',
        agency: 'CADE',
        status: 'ATIVO',
        filingDate: '2024-06-01',
      },
    ],
    protests: [
      {
        date: '2024-12-01',
        amount: '5000.00',
        notaryOffice: '1º Cartório de Protestos',
        status: 'ATIVO',
      },
    ],
  };
}

function buildMockPortugueseResponse() {
  return {
    processos: [
      {
        numeroProcesso: 'PROC-PT-001',
        tribunal: 'TJRJ',
        tipoProcesso: 'CÍVEL',
        situacao: 'ATIVO',
        dataDistribuicao: '2025-02-01',
        ultimaMovimentacao: '2025-06-15',
        valorCausa: '100000.00',
        nomeAutor: 'Pedro Souza',
        poloPassivo: 'Réu',
        assunto: 'Indenização',
      },
    ],
    processosAdministrativos: [],
    protestos: [
      {
        data: '2025-01-15',
        valor: '3000.00',
        cartorio: '2º Cartório',
        situacao: 'INATIVO',
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('BigDataCorpService', () => {
  let service: BigDataCorpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = buildService();
  });

  // ─── ERROR CLASSES ──────────────────────────────────────────────────

  describe('Error Classes', () => {
    it('BigDataCorpNotFoundError has correct name', () => {
      const err = new BigDataCorpNotFoundError('CNPJ not found');
      expect(err.name).toBe('BigDataCorpNotFoundError');
      expect(err.message).toBe('CNPJ not found');
      expect(err).toBeInstanceOf(Error);
    });

    it('BigDataCorpUnavailableError has correct name', () => {
      const err = new BigDataCorpUnavailableError('Service down');
      expect(err.name).toBe('BigDataCorpUnavailableError');
      expect(err.message).toBe('Service down');
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ─── isAvailable ───────────────────────────────────────────────────

  describe('isAvailable', () => {
    it('should return true when API token is configured', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when API token is not configured', () => {
      const unconfigured = buildUnconfiguredService();
      expect(unconfigured.isAvailable()).toBe(false);
    });
  });

  // ─── fetchLitigationData — Happy Path ─────────────────────────────

  describe('fetchLitigationData', () => {
    it('should fetch and return normalized litigation data', async () => {
      const mockResponse = buildMockLitigationResponse();
      mockFetchResponse(200, mockResponse);

      const result = await service.fetchLitigationData(VALID_CNPJ);

      expect(result.lawsuits).toHaveLength(2);
      expect(result.lawsuits[0].processId).toBe('PROC-001');
      expect(result.lawsuits[0].court).toBe('TJSP');
      expect(result.lawsuits[0].status).toBe('ATIVO');
      expect(result.lawsuits[0].valueInDispute).toBe('50000.00');
      expect(result.administrativeProceedings).toHaveLength(1);
      expect(result.protests).toHaveLength(1);
    });

    it('should strip non-digit characters from CNPJ', async () => {
      mockFetchResponse(200, { lawsuits: [], protests: [] });

      await service.fetchLitigationData(VALID_CNPJ);

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('empresas/owners_lawsuits');

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.cnpj).toBe(CLEAN_CNPJ);
    });

    it('should send correct Authorization header', async () => {
      mockFetchResponse(200, { lawsuits: [] });

      await service.fetchLitigationData(VALID_CNPJ);

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect((fetchOptions.headers as Record<string, string>).Authorization).toBe(
        'Bearer test-api-token',
      );
      expect((fetchOptions.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
    });

    it('should include AbortController signal for timeout', async () => {
      mockFetchResponse(200, { lawsuits: [] });

      await service.fetchLitigationData(VALID_CNPJ);

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.signal).toBeDefined();
    });

    // ─── Portuguese Response Normalization ───────────────────────────

    it('should normalize Portuguese field names to English', async () => {
      const ptResponse = buildMockPortugueseResponse();
      mockFetchResponse(200, ptResponse);

      const result = await service.fetchLitigationData(VALID_CNPJ);

      expect(result.lawsuits).toHaveLength(1);
      expect(result.lawsuits[0].processId).toBe('PROC-PT-001');
      expect(result.lawsuits[0].court).toBe('TJRJ');
      expect(result.lawsuits[0].caseType).toBe('CÍVEL');
      expect(result.lawsuits[0].status).toBe('ATIVO');
      expect(result.lawsuits[0].filingDate).toBe('2025-02-01');
      expect(result.lawsuits[0].lastUpdate).toBe('2025-06-15');
      expect(result.lawsuits[0].valueInDispute).toBe('100000.00');
      expect(result.lawsuits[0].plaintiffName).toBe('Pedro Souza');
      expect(result.lawsuits[0].defendantRole).toBe('Réu');
      expect(result.lawsuits[0].subject).toBe('Indenização');
    });

    it('should normalize Portuguese protest fields', async () => {
      const ptResponse = buildMockPortugueseResponse();
      mockFetchResponse(200, ptResponse);

      const result = await service.fetchLitigationData(VALID_CNPJ);

      expect(result.protests).toHaveLength(1);
      expect(result.protests![0].date).toBe('2025-01-15');
      expect(result.protests![0].amount).toBe('3000.00');
      expect(result.protests![0].notaryOffice).toBe('2º Cartório');
      expect(result.protests![0].status).toBe('INATIVO');
    });

    it('should handle empty arrays in response', async () => {
      mockFetchResponse(200, {});

      const result = await service.fetchLitigationData(VALID_CNPJ);

      expect(result.lawsuits).toEqual([]);
      expect(result.administrativeProceedings).toEqual([]);
      expect(result.protests).toEqual([]);
    });

    it('should default missing fields to empty strings or null', async () => {
      mockFetchResponse(200, {
        lawsuits: [{}],
        protests: [{}],
      });

      const result = await service.fetchLitigationData(VALID_CNPJ);

      expect(result.lawsuits[0].processId).toBe('');
      expect(result.lawsuits[0].court).toBe('');
      expect(result.lawsuits[0].caseType).toBe('CIVIL');
      expect(result.lawsuits[0].status).toBe('');
      expect(result.lawsuits[0].valueInDispute).toBeNull();
      expect(result.protests![0].date).toBe('');
      expect(result.protests![0].amount).toBe('0');
    });

    // ─── Error Paths ─────────────────────────────────────────────────

    it('should throw BigDataCorpUnavailableError when API token is not configured', async () => {
      const unconfigured = buildUnconfiguredService();

      await expect(unconfigured.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpUnavailableError,
      );
      await expect(unconfigured.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        'BigDataCorp API token not configured',
      );
    });

    it('should throw BigDataCorpNotFoundError on 404 response', async () => {
      mockFetchResponse(404, { error: 'Not Found' });

      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpNotFoundError,
      );
    });

    it('should throw BigDataCorpNotFoundError on 400 response', async () => {
      mockFetchResponse(400, { error: 'Bad Request' });

      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpNotFoundError,
      );
    });

    it('should throw BigDataCorpUnavailableError on 401 response', async () => {
      mockFetchResponse(401, { error: 'Unauthorized' });

      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpUnavailableError,
      );
    });

    it('should throw BigDataCorpUnavailableError on 403 response', async () => {
      mockFetchResponse(403, { error: 'Forbidden' });

      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpUnavailableError,
      );
    });

    it('should throw BigDataCorpUnavailableError on 500 response', async () => {
      mockFetchResponse(500, { error: 'Internal Server Error' });

      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpUnavailableError,
      );
    });

    it('should throw BigDataCorpUnavailableError on network error', async () => {
      mockFetchNetworkError('ECONNREFUSED');

      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpUnavailableError,
      );
    });

    it('should throw BigDataCorpUnavailableError on timeout', async () => {
      mockFetchTimeout();

      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        BigDataCorpUnavailableError,
      );

      mockFetchTimeout();
      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
        'BigDataCorp request timed out after 30 seconds',
      );
    });
  });

  // ─── Circuit Breaker ──────────────────────────────────────────────

  describe('Circuit Breaker', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        mockFetchResponse(500, { error: 'Server Error' });
        await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
          BigDataCorpUnavailableError,
        );
      }

      // 6th call should fail immediately without hitting the API
      await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow('Circuit breaker open');

      // Verify that fetch was NOT called for the 6th attempt
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should reset circuit breaker on success', async () => {
      // Trigger 4 failures (just under the threshold)
      for (let i = 0; i < 4; i++) {
        mockFetchResponse(500, { error: 'Server Error' });
        await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
          BigDataCorpUnavailableError,
        );
      }

      // 5th call succeeds — resets the counter
      mockFetchResponse(200, { lawsuits: [] });
      await service.fetchLitigationData(VALID_CNPJ);

      // 4 more failures should NOT open the circuit
      for (let i = 0; i < 4; i++) {
        mockFetchResponse(500, { error: 'Server Error' });
        await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
          BigDataCorpUnavailableError,
        );
      }

      // Should still be able to make API calls (circuit not open)
      mockFetchResponse(200, { lawsuits: [] });
      await expect(service.fetchLitigationData(VALID_CNPJ)).resolves.toBeDefined();
    });

    it('should NOT count 404 as a failure (definitive result)', async () => {
      // 404 is a NotFoundError, not a circuit breaker failure
      for (let i = 0; i < 5; i++) {
        mockFetchResponse(404, { error: 'Not Found' });
        await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
          BigDataCorpNotFoundError,
        );
      }

      // Circuit should NOT be open — 404 calls recordSuccess()
      mockFetchResponse(200, { lawsuits: [] });
      const result = await service.fetchLitigationData(VALID_CNPJ);
      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it('should allow one request through in half-open state', async () => {
      // Trigger 5 failures to open circuit
      for (let i = 0; i < 5; i++) {
        mockFetchResponse(500, { error: 'Server Error' });
        await expect(service.fetchLitigationData(VALID_CNPJ)).rejects.toThrow(
          BigDataCorpUnavailableError,
        );
      }

      // Circuit is open — fast-forward past the reset timeout
      // Access the private field to simulate time passage
      (service as any).circuitOpenUntil = Date.now() - 1;

      // Should allow one request through (half-open)
      mockFetchResponse(200, { lawsuits: [] });
      const result = await service.fetchLitigationData(VALID_CNPJ);
      expect(result).toBeDefined();
    });
  });
});
