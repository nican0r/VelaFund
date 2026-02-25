export interface VerifikCpfResponse {
  data: {
    fullName: string;
    dateOfBirth: string;
    cpfStatus: string;
  };
  signature: string;
}

export interface VerifikDocumentResponse {
  data: {
    fullName: string;
    documentNumber: string;
    issueDate: string | null;
    expiryDate: string | null;
  };
  verified: boolean;
  authenticity: number;
}

export interface VerifikFaceMatchResponse {
  matchScore: number;
  livenessScore: number;
}

export interface VerifikAmlResponse {
  riskScore: string;
  isPEP: boolean;
  sanctionsMatch: boolean;
  details: Record<string, unknown>;
}

export interface VerifikCnpjResponse {
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  dataAbertura: string;
  naturezaJuridica: string;
  atividadePrincipal: {
    codigo: string;
    descricao: string;
  };
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  capitalSocial: number;
}

export interface VerifikWebhookPayload {
  session_id: string;
  event_type: string;
  status: string;
  data: Record<string, unknown>;
  signature: string;
}
