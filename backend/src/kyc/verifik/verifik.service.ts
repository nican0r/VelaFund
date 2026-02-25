import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/filters/app-exception';
import {
  VerifikCpfResponse,
  VerifikCnpjResponse,
  VerifikDocumentResponse,
  VerifikFaceMatchResponse,
  VerifikAmlResponse,
} from '../interfaces/verifik.interfaces';

// ─── KYC-specific exception classes ────────────────────────────────────────

export class VerifikUnavailableException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'KYC_VERIFIK_UNAVAILABLE',
      'errors.kyc.verifikUnavailable',
      HttpStatus.BAD_GATEWAY,
      details,
    );
  }
}

export class KycCpfNotFoundException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'KYC_CPF_NOT_FOUND',
      'errors.kyc.cpfNotFound',
      HttpStatus.NOT_FOUND,
      details,
    );
  }
}

export class KycCpfDobMismatchException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'KYC_CPF_DOB_MISMATCH',
      'errors.kyc.cpfDobMismatch',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

export class KycDocumentUnreadableException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'KYC_DOCUMENT_UNREADABLE',
      'errors.kyc.documentUnreadable',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

export class KycFaceMatchFailedException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'KYC_FACE_MATCH_FAILED',
      'errors.kyc.faceMatchFailed',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

export class KycLivenessCheckFailedException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super(
      'KYC_LIVENESS_CHECK_FAILED',
      'errors.kyc.livenessCheckFailed',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

// ─── Thresholds ─────────────────────────────────────────────────────────────

/** Minimum face match score (0–100) to consider a match successful. */
const FACE_MATCH_THRESHOLD = 80;

/** Minimum liveness score (0–100) to consider liveness detection successful. */
const LIVENESS_THRESHOLD = 70;

/** Request timeout in milliseconds (30 seconds). */
const REQUEST_TIMEOUT_MS = 30_000;

// ─── Internal raw API response shapes ────────────────────────────────────────

interface RawVerifikCpfApiResponse {
  fullName?: string;
  nome?: string;
  dateOfBirth?: string;
  dataNascimento?: string;
  cpfStatus?: string;
  situacao?: string;
  signature?: string;
}

interface RawVerifikDocumentApiResponse {
  fullName?: string;
  nome?: string;
  documentNumber?: string;
  numeroDocumento?: string;
  issueDate?: string | null;
  dataEmissao?: string | null;
  expiryDate?: string | null;
  dataValidade?: string | null;
  verified?: boolean;
  autenticidade?: number;
  authenticity?: number;
}

interface RawVerifikFaceMatchApiResponse {
  matchScore?: number;
  pontuacaoCorrespondencia?: number;
  livenessScore?: number;
  pontuacaoVivacidade?: number;
}

interface RawVerifikCnpjApiResponse {
  razaoSocial?: string;
  razao_social?: string;
  nomeFantasia?: string;
  nome_fantasia?: string;
  situacaoCadastral?: string;
  situacao_cadastral?: string;
  dataAbertura?: string;
  data_abertura?: string;
  naturezaJuridica?: string;
  natureza_juridica?: string;
  atividadePrincipal?: {
    codigo?: string;
    descricao?: string;
  };
  atividade_principal?: {
    codigo?: string;
    descricao?: string;
  };
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  capitalSocial?: number;
  capital_social?: number;
}

interface RawVerifikAmlApiResponse {
  riskScore?: string;
  pontuacaoRisco?: string;
  isPEP?: boolean;
  ePEP?: boolean;
  sanctionsMatch?: boolean;
  correspondenciaSancoes?: boolean;
  details?: Record<string, unknown>;
  detalhes?: Record<string, unknown>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class VerifikService {
  private readonly logger = new Logger(VerifikService.name);
  private readonly apiToken: string | undefined;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiToken = this.configService.get<string>('VERIFIK_API_TOKEN');
    this.baseUrl = this.configService.get<string>(
      'VERIFIK_BASE_URL',
      'https://api.verifik.co/v2',
    );

    if (this.apiToken) {
      this.logger.log(
        `VerifikService initialized (baseUrl: ${this.baseUrl})`,
      );
    } else {
      this.logger.warn(
        'VERIFIK_API_TOKEN is not configured. KYC verification will be unavailable.',
      );
    }
  }

  /**
   * Returns true if the Verifik API token has been configured.
   * All verification methods will throw VerifikUnavailableException when false.
   */
  isAvailable(): boolean {
    return Boolean(this.apiToken);
  }

  // ─── CPF Verification ──────────────────────────────────────────────────────

  /**
   * Verifies a Brazilian CPF document against the Receita Federal registry via
   * Verifik.  Also validates that the provided date of birth matches the record.
   *
   * @param cpf         CPF in the format XXX.XXX.XXX-XX
   * @param dateOfBirth Date of birth in the format DD/MM/YYYY
   * @returns Normalised VerifikCpfResponse
   * @throws VerifikUnavailableException  — service not configured or network failure
   * @throws KycCpfNotFoundException      — CPF not found in registry
   * @throws KycCpfDobMismatchException   — date of birth does not match
   */
  async verifyCpf(
    cpf: string,
    dateOfBirth: string,
  ): Promise<VerifikCpfResponse> {
    this.ensureAvailable();

    // Normalise CPF to digits only for the query parameter
    const cpfDigits = cpf.replace(/\D/g, '');

    const url = `${this.baseUrl}/br/cedula?cpf=${encodeURIComponent(cpfDigits)}&birthDate=${encodeURIComponent(dateOfBirth)}`;

    this.logger.debug(
      `[verifyCpf] GET ${this.baseUrl}/br/cedula cpf=***${cpfDigits.slice(-2)}`,
    );

    const raw = await this.request<RawVerifikCpfApiResponse>('GET', url);

    // Normalise field names — Verifik may return Portuguese or English keys
    const fullName = raw.fullName ?? raw.nome ?? '';
    const dobFromApi = raw.dateOfBirth ?? raw.dataNascimento ?? '';
    const cpfStatus = raw.cpfStatus ?? raw.situacao ?? 'REGULAR';
    const signature = raw.signature ?? '';

    // Validate DOB match (Verifik returns the DOB from the registry; if it
    // does not match what the user provided the CPF belongs to someone else)
    if (dobFromApi && dobFromApi !== dateOfBirth) {
      this.logger.debug(
        `[verifyCpf] DOB mismatch — registry: ${dobFromApi}, provided: ${dateOfBirth}`,
      );
      throw new KycCpfDobMismatchException({ provided: dateOfBirth });
    }

    const response: VerifikCpfResponse = {
      data: {
        fullName,
        dateOfBirth: dobFromApi || dateOfBirth,
        cpfStatus,
      },
      signature,
    };

    this.logger.debug(
      `[verifyCpf] Success — cpfStatus=${cpfStatus} name="${fullName}"`,
    );

    return response;
  }

  // ─── CNPJ Validation ─────────────────────────────────────────────────────

  /**
   * Validates a Brazilian CNPJ against the Receita Federal registry via Verifik.
   * Returns the full company data including razão social, situação cadastral,
   * address, CNAE, and registered capital.
   *
   * @param cnpj CNPJ in any format (digits or formatted XX.XXX.XXX/XXXX-XX)
   * @returns Normalised VerifikCnpjResponse
   * @throws VerifikUnavailableException — service not configured or network failure
   */
  async validateCnpj(cnpj: string): Promise<VerifikCnpjResponse> {
    this.ensureAvailable();

    const cnpjDigits = cnpj.replace(/\D/g, '');

    const url = `${this.baseUrl}/br/cnpj?cnpj=${encodeURIComponent(cnpjDigits)}`;

    this.logger.debug(
      `[validateCnpj] GET ${this.baseUrl}/br/cnpj cnpj=***${cnpjDigits.slice(-4)}`,
    );

    const raw = await this.request<RawVerifikCnpjApiResponse>('GET', url);

    // Normalise field names — Verifik may return camelCase or snake_case
    const razaoSocial = raw.razaoSocial ?? raw.razao_social ?? '';
    const nomeFantasia = raw.nomeFantasia ?? raw.nome_fantasia ?? null;
    const situacaoCadastral = raw.situacaoCadastral ?? raw.situacao_cadastral ?? '';
    const dataAbertura = raw.dataAbertura ?? raw.data_abertura ?? '';
    const naturezaJuridica = raw.naturezaJuridica ?? raw.natureza_juridica ?? '';
    const rawAtividade = raw.atividadePrincipal ?? raw.atividade_principal;
    const rawEndereco = raw.endereco;
    const capitalSocial = raw.capitalSocial ?? raw.capital_social ?? 0;

    const response: VerifikCnpjResponse = {
      razaoSocial,
      nomeFantasia,
      situacaoCadastral,
      dataAbertura,
      naturezaJuridica,
      atividadePrincipal: {
        codigo: rawAtividade?.codigo ?? '',
        descricao: rawAtividade?.descricao ?? '',
      },
      endereco: {
        logradouro: rawEndereco?.logradouro ?? '',
        numero: rawEndereco?.numero ?? '',
        complemento: rawEndereco?.complemento ?? null,
        bairro: rawEndereco?.bairro ?? '',
        municipio: rawEndereco?.municipio ?? '',
        uf: rawEndereco?.uf ?? '',
        cep: rawEndereco?.cep ?? '',
      },
      capitalSocial,
    };

    this.logger.debug(
      `[validateCnpj] Success — situacaoCadastral=${situacaoCadastral} razaoSocial="${razaoSocial}"`,
    );

    return response;
  }

  // ─── Document Verification ─────────────────────────────────────────────────

  /**
   * Uploads and verifies an identity document image (RG, CNH, RNE, Passport)
   * via Verifik's OCR + authenticity pipeline.
   *
   * @param file         Raw file buffer (PNG or JPEG)
   * @param documentType One of: RG, CNH, RNE, PASSPORT
   * @returns Normalised VerifikDocumentResponse
   * @throws VerifikUnavailableException   — service not configured or network failure
   * @throws KycDocumentUnreadableException — OCR failed or authenticity too low
   */
  async verifyDocument(
    file: Buffer,
    documentType: string,
  ): Promise<VerifikDocumentResponse> {
    this.ensureAvailable();

    const url = `${this.baseUrl}/documents/verify`;

    this.logger.debug(
      `[verifyDocument] POST ${url} documentType=${documentType} size=${file.length}B`,
    );

    // Build multipart form data without external dependencies
    const boundary = `----VerifikBoundary${Date.now()}`;
    const body = this.buildMultipartFormData(boundary, file, documentType);

    const raw = await this.request<RawVerifikDocumentApiResponse>(
      'POST',
      url,
      body,
      `multipart/form-data; boundary=${boundary}`,
    );

    const verified = raw.verified ?? false;
    const authenticity = raw.authenticity ?? raw.autenticidade ?? 0;

    if (!verified || authenticity < 50) {
      this.logger.debug(
        `[verifyDocument] Document unreadable — verified=${verified} authenticity=${authenticity}`,
      );
      throw new KycDocumentUnreadableException({
        verified,
        authenticity,
        documentType,
      });
    }

    const response: VerifikDocumentResponse = {
      data: {
        fullName: raw.fullName ?? raw.nome ?? '',
        documentNumber: raw.documentNumber ?? raw.numeroDocumento ?? '',
        issueDate: raw.issueDate ?? raw.dataEmissao ?? null,
        expiryDate: raw.expiryDate ?? raw.dataValidade ?? null,
      },
      verified,
      authenticity,
    };

    this.logger.debug(
      `[verifyDocument] Success — authenticity=${authenticity}`,
    );

    return response;
  }

  // ─── Face Match ────────────────────────────────────────────────────────────

  /**
   * Compares a live selfie against the portrait extracted from a previously
   * uploaded identity document.
   *
   * @param selfie            Raw selfie image buffer (PNG or JPEG)
   * @param documentImageUrl  S3 URL of the document image already on file
   * @returns Normalised VerifikFaceMatchResponse
   * @throws VerifikUnavailableException    — service not configured or network failure
   * @throws KycLivenessCheckFailedException — liveness score below threshold
   * @throws KycFaceMatchFailedException     — face similarity score below threshold
   */
  async matchFace(
    selfie: Buffer,
    documentImageUrl: string,
  ): Promise<VerifikFaceMatchResponse> {
    this.ensureAvailable();

    const url = `${this.baseUrl}/face/match`;

    this.logger.debug(
      `[matchFace] POST ${url} selfieSize=${selfie.length}B`,
    );

    const boundary = `----VerifikBoundary${Date.now()}`;
    const body = this.buildFaceMatchFormData(
      boundary,
      selfie,
      documentImageUrl,
    );

    const raw = await this.request<RawVerifikFaceMatchApiResponse>(
      'POST',
      url,
      body,
      `multipart/form-data; boundary=${boundary}`,
    );

    const livenessScore =
      raw.livenessScore ?? raw.pontuacaoVivacidade ?? 0;
    const matchScore =
      raw.matchScore ?? raw.pontuacaoCorrespondencia ?? 0;

    if (livenessScore < LIVENESS_THRESHOLD) {
      this.logger.debug(
        `[matchFace] Liveness check failed — score=${livenessScore} threshold=${LIVENESS_THRESHOLD}`,
      );
      throw new KycLivenessCheckFailedException({
        livenessScore,
        threshold: LIVENESS_THRESHOLD,
      });
    }

    if (matchScore < FACE_MATCH_THRESHOLD) {
      this.logger.debug(
        `[matchFace] Face match failed — score=${matchScore} threshold=${FACE_MATCH_THRESHOLD}`,
      );
      throw new KycFaceMatchFailedException({
        matchScore,
        threshold: FACE_MATCH_THRESHOLD,
      });
    }

    const response: VerifikFaceMatchResponse = {
      matchScore,
      livenessScore,
    };

    this.logger.debug(
      `[matchFace] Success — matchScore=${matchScore} livenessScore=${livenessScore}`,
    );

    return response;
  }

  // ─── AML Screening ─────────────────────────────────────────────────────────

  /**
   * Screens an individual against global PEP, sanctions, and adverse-media
   * lists via Verifik's AML/KYC screening endpoint.
   *
   * @param fullName    Individual's full legal name
   * @param cpf         CPF in format XXX.XXX.XXX-XX (used as secondary identifier)
   * @param nationality ISO 3166-1 alpha-2 country code (e.g. "BR")
   * @returns Normalised VerifikAmlResponse
   * @throws VerifikUnavailableException — service not configured or network failure
   */
  async screenAml(
    fullName: string,
    cpf: string,
    nationality: string,
  ): Promise<VerifikAmlResponse> {
    this.ensureAvailable();

    const url = `${this.baseUrl}/screening`;

    // Mask CPF in debug log — keep only last 2 digits
    const cpfDigits = cpf.replace(/\D/g, '');
    const maskedCpf = `***.***.***-${cpfDigits.slice(-2)}`;

    this.logger.debug(
      `[screenAml] POST ${url} name="${fullName}" cpf=${maskedCpf} nationality=${nationality}`,
    );

    const payload = JSON.stringify({
      fullName,
      cpf: cpfDigits,
      nationality,
    });

    const raw = await this.request<RawVerifikAmlApiResponse>(
      'POST',
      url,
      Buffer.from(payload, 'utf-8'),
      'application/json',
    );

    const response: VerifikAmlResponse = {
      riskScore: raw.riskScore ?? raw.pontuacaoRisco ?? 'LOW',
      isPEP: raw.isPEP ?? raw.ePEP ?? false,
      sanctionsMatch:
        raw.sanctionsMatch ?? raw.correspondenciaSancoes ?? false,
      details: raw.details ?? raw.detalhes ?? {},
    };

    this.logger.debug(
      `[screenAml] Success — riskScore=${response.riskScore} isPEP=${response.isPEP} sanctionsMatch=${response.sanctionsMatch}`,
    );

    return response;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Performs an HTTP request to the Verifik API with a 30-second timeout.
   * Handles network errors, timeouts, and non-2xx status codes uniformly.
   */
  private async request<T>(
    method: 'GET' | 'POST',
    url: string,
    body?: Buffer,
    contentType?: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    let response: Response;

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: 'application/json',
      };

      if (contentType && body) {
        headers['Content-Type'] = contentType;
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body && method === 'POST') {
        // TypeScript's DOM BodyInit accepts ArrayBuffer (BufferSource) but not
        // Buffer<ArrayBufferLike> directly.  Slicing produces a new Buffer whose
        // underlying ArrayBuffer has type `ArrayBuffer` (not `ArrayBufferLike`),
        // which satisfies the BodyInit constraint at compile-time.
        fetchOptions.body = body.buffer.slice(
          body.byteOffset,
          body.byteOffset + body.byteLength,
        ) as ArrayBuffer;
      }

      response = await fetch(url, fetchOptions);
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);

      const isTimeout =
        err instanceof Error && err.name === 'AbortError';

      if (isTimeout) {
        this.logger.error(
          `[request] Timeout after ${REQUEST_TIMEOUT_MS}ms — ${method} ${url}`,
        );
        throw new VerifikUnavailableException({
          reason: 'timeout',
          timeoutMs: REQUEST_TIMEOUT_MS,
        });
      }

      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[request] Network error — ${method} ${url}: ${message}`,
      );
      throw new VerifikUnavailableException({
        reason: 'networkError',
        message,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    // Parse the response body regardless of status so we can extract any
    // error message returned by Verifik
    let responseBody: unknown;
    try {
      const text = await response.text();
      responseBody = text ? JSON.parse(text) : {};
    } catch {
      responseBody = {};
    }

    this.logger.debug(
      `[request] ${method} ${url} → HTTP ${response.status}`,
    );

    if (response.status === 404) {
      throw new KycCpfNotFoundException({
        status: response.status,
        url,
      });
    }

    if (!response.ok) {
      const errorMessage =
        this.extractErrorMessage(responseBody) ?? `HTTP ${response.status}`;

      this.logger.error(
        `[request] Verifik API error — ${method} ${url} status=${response.status} message="${errorMessage}"`,
      );

      // 401 / 403 — misconfigured token; treat as service unavailable
      if (response.status === 401 || response.status === 403) {
        throw new VerifikUnavailableException({
          reason: 'authError',
          status: response.status,
        });
      }

      // 5xx — Verifik-side server error
      if (response.status >= 500) {
        throw new VerifikUnavailableException({
          reason: 'serverError',
          status: response.status,
          message: errorMessage,
        });
      }

      // 4xx business errors — surface as service unavailable with details so
      // the caller can decide how to handle them
      throw new VerifikUnavailableException({
        reason: 'apiError',
        status: response.status,
        message: errorMessage,
      });
    }

    return responseBody as T;
  }

  /**
   * Throws VerifikUnavailableException if the API token is not configured.
   */
  private ensureAvailable(): void {
    if (!this.apiToken) {
      throw new VerifikUnavailableException({
        reason: 'notConfigured',
      });
    }
  }

  /**
   * Tries to extract a human-readable error message from various Verifik
   * error response shapes.
   */
  private extractErrorMessage(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const b = body as Record<string, unknown>;
    const candidate =
      b['message'] ??
      b['mensagem'] ??
      b['error'] ??
      b['erro'] ??
      b['description'] ??
      b['descricao'];
    if (typeof candidate === 'string') return candidate;
    return null;
  }

  /**
   * Builds a minimal multipart/form-data body for document verification.
   * Includes the raw file bytes and the document type as a form field.
   */
  private buildMultipartFormData(
    boundary: string,
    file: Buffer,
    documentType: string,
  ): Buffer {
    const CRLF = '\r\n';
    const parts: Buffer[] = [];

    // Field: documentType
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="documentType"${CRLF}` +
          CRLF +
          documentType +
          CRLF,
        'utf-8',
      ),
    );

    // Field: file (binary)
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="file"; filename="document.jpg"${CRLF}` +
          `Content-Type: image/jpeg${CRLF}` +
          CRLF,
        'utf-8',
      ),
    );
    parts.push(file);
    parts.push(Buffer.from(CRLF, 'utf-8'));

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--${CRLF}`, 'utf-8'));

    return Buffer.concat(parts);
  }

  /**
   * Builds a multipart/form-data body for the face-match endpoint.
   * Includes the selfie image and the document image URL as a form field.
   */
  private buildFaceMatchFormData(
    boundary: string,
    selfie: Buffer,
    documentImageUrl: string,
  ): Buffer {
    const CRLF = '\r\n';
    const parts: Buffer[] = [];

    // Field: documentImageUrl
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="documentImageUrl"${CRLF}` +
          CRLF +
          documentImageUrl +
          CRLF,
        'utf-8',
      ),
    );

    // Field: selfie (binary)
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="selfie"; filename="selfie.jpg"${CRLF}` +
          `Content-Type: image/jpeg${CRLF}` +
          CRLF,
        'utf-8',
      ),
    );
    parts.push(selfie);
    parts.push(Buffer.from(CRLF, 'utf-8'));

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--${CRLF}`, 'utf-8'));

    return Buffer.concat(parts);
  }
}
