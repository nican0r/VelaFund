import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Raw response shape from BigDataCorp's litigation API.
 * Fields may come in Portuguese or English depending on the dataset.
 */
export interface BigDataCorpLitigationResponse {
  lawsuits: Array<{
    processId?: string;
    numeroProcesso?: string;
    court?: string;
    tribunal?: string;
    caseType?: string;
    tipoProcesso?: string;
    status?: string;
    situacao?: string;
    filingDate?: string;
    dataDistribuicao?: string;
    lastUpdate?: string;
    ultimaMovimentacao?: string;
    valueInDispute?: string | null;
    valorCausa?: string | null;
    plaintiffName?: string;
    nomeAutor?: string;
    defendantRole?: string;
    poloPassivo?: string;
    subject?: string;
    assunto?: string;
  }>;
  administrativeProceedings?: Array<{
    processId?: string;
    numeroProcesso?: string;
    agency?: string;
    orgao?: string;
    status?: string;
    situacao?: string;
    filingDate?: string;
    dataDistribuicao?: string;
  }>;
  protests?: Array<{
    date?: string;
    data?: string;
    amount?: string;
    valor?: string;
    notaryOffice?: string;
    cartorio?: string;
    status?: string;
    situacao?: string;
  }>;
}

/** Error thrown when BigDataCorp does not find the CNPJ (definitive, do not retry). */
export class BigDataCorpNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BigDataCorpNotFoundError';
  }
}

/** Error thrown when BigDataCorp is unavailable (transient, retry). */
export class BigDataCorpUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BigDataCorpUnavailableError';
  }
}

/**
 * BigDataCorpService — External API client for litigation data fetching.
 *
 * Uses native fetch + AbortController timeout following the same pattern as VerifikService.
 * Includes a lightweight circuit breaker (5 failures → open, 60s half-open).
 * Gracefully degrades when BIGDATACORP_API_TOKEN is not configured.
 */
@Injectable()
export class BigDataCorpService {
  private readonly logger = new Logger(BigDataCorpService.name);
  private readonly REQUEST_TIMEOUT_MS = 30_000;

  private readonly apiToken: string | undefined;
  private readonly baseUrl: string;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private circuitOpenUntil: number | null = null;
  private readonly RESET_TIMEOUT_MS = 60_000;

  constructor(private readonly configService: ConfigService) {
    this.apiToken = this.configService.get<string>('BIGDATACORP_API_TOKEN');
    this.baseUrl = this.configService.get<string>(
      'BIGDATACORP_BASE_URL',
      'https://api.bigdatacorp.com.br',
    );

    if (!this.apiToken) {
      this.logger.warn(
        'BIGDATACORP_API_TOKEN not configured — litigation verification will be unavailable',
      );
    }
  }

  /** Whether the service is configured and ready to make API calls. */
  isAvailable(): boolean {
    return !!this.apiToken;
  }

  /**
   * Fetch litigation data for a CNPJ from BigDataCorp.
   *
   * @throws BigDataCorpNotFoundError — CNPJ not found (definitive, do not retry)
   * @throws BigDataCorpUnavailableError — Service unavailable (transient, retry)
   */
  async fetchLitigationData(cnpj: string): Promise<BigDataCorpLitigationResponse> {
    if (!this.apiToken) {
      throw new BigDataCorpUnavailableError('BigDataCorp API token not configured');
    }

    // Circuit breaker check
    if (this.isCircuitOpen()) {
      throw new BigDataCorpUnavailableError(
        'Circuit breaker open — BigDataCorp temporarily unavailable',
      );
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    this.logger.debug(`Fetching litigation data for CNPJ ***${cleanCnpj.slice(-4)}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/empresas/owners_lawsuits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cnpj: cleanCnpj }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 400 || response.status === 404) {
          // Definitive result — CNPJ not found, do not retry
          this.recordSuccess(); // Not a service failure
          throw new BigDataCorpNotFoundError(
            `CNPJ ***${cleanCnpj.slice(-4)} not found in BigDataCorp`,
          );
        }

        if (response.status === 401 || response.status === 403) {
          this.recordFailure();
          throw new BigDataCorpUnavailableError(
            `BigDataCorp authentication error: ${response.status}`,
          );
        }

        this.recordFailure();
        throw new BigDataCorpUnavailableError(`BigDataCorp API error: ${response.status}`);
      }

      const data = await response.json();
      this.recordSuccess();

      // Normalize response fields (Portuguese/English)
      return this.normalizeResponse(data);
    } catch (error) {
      if (error instanceof BigDataCorpNotFoundError) {
        throw error;
      }
      if (error instanceof BigDataCorpUnavailableError) {
        throw error;
      }

      // Network or timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        this.recordFailure();
        throw new BigDataCorpUnavailableError('BigDataCorp request timed out after 30 seconds');
      }

      this.recordFailure();
      throw new BigDataCorpUnavailableError(
        `BigDataCorp network error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── CIRCUIT BREAKER ──────────────────────────────────────────────────

  private isCircuitOpen(): boolean {
    if (this.circuitOpenUntil === null) return false;
    if (Date.now() >= this.circuitOpenUntil) {
      // Half-open: allow one request through
      this.circuitOpenUntil = null;
      return false;
    }
    return true;
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = null;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + this.RESET_TIMEOUT_MS;
      this.logger.warn(
        `Circuit breaker OPEN — ${this.consecutiveFailures} consecutive BigDataCorp failures. Will retry after ${this.RESET_TIMEOUT_MS / 1000}s`,
      );
    }
  }

  // ─── RESPONSE NORMALIZATION ───────────────────────────────────────────

  /**
   * Normalize BigDataCorp API response fields which may come in
   * Portuguese or English depending on the dataset.
   */
  private normalizeResponse(raw: any): BigDataCorpLitigationResponse {
    const lawsuits = Array.isArray(raw.lawsuits)
      ? raw.lawsuits
      : Array.isArray(raw.processos)
        ? raw.processos
        : [];

    const administrativeProceedings = Array.isArray(raw.administrativeProceedings)
      ? raw.administrativeProceedings
      : Array.isArray(raw.processosAdministrativos)
        ? raw.processosAdministrativos
        : [];

    const protests = Array.isArray(raw.protests)
      ? raw.protests
      : Array.isArray(raw.protestos)
        ? raw.protestos
        : [];

    return {
      lawsuits: lawsuits.map((l: any) => ({
        processId: l.processId ?? l.numeroProcesso ?? '',
        court: l.court ?? l.tribunal ?? '',
        caseType: l.caseType ?? l.tipoProcesso ?? 'CIVIL',
        status: l.status ?? l.situacao ?? '',
        filingDate: l.filingDate ?? l.dataDistribuicao ?? '',
        lastUpdate: l.lastUpdate ?? l.ultimaMovimentacao ?? '',
        valueInDispute: l.valueInDispute ?? l.valorCausa ?? null,
        plaintiffName: l.plaintiffName ?? l.nomeAutor ?? '',
        defendantRole: l.defendantRole ?? l.poloPassivo ?? '',
        subject: l.subject ?? l.assunto ?? '',
      })),
      administrativeProceedings: administrativeProceedings.map((a: any) => ({
        processId: a.processId ?? a.numeroProcesso ?? '',
        agency: a.agency ?? a.orgao ?? '',
        status: a.status ?? a.situacao ?? '',
        filingDate: a.filingDate ?? a.dataDistribuicao ?? '',
      })),
      protests: protests.map((p: any) => ({
        date: p.date ?? p.data ?? '',
        amount: p.amount ?? p.valor ?? '0',
        notaryOffice: p.notaryOffice ?? p.cartorio ?? '',
        status: p.status ?? p.situacao ?? '',
      })),
    };
  }
}
