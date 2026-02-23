import { HttpStatus } from '@nestjs/common';
import { ValidationErrorDetail } from '../types/api-response.types';

const MESSAGES: Record<string, Record<string, string>> = {
  'errors.sys.internalError': {
    'pt-BR': 'Erro interno do servidor',
    en: 'Internal server error',
  },
  'errors.sys.httpError': {
    'pt-BR': 'Erro HTTP',
    en: 'HTTP Error',
  },
  'errors.sys.rateLimited': {
    'pt-BR': 'Limite de requisições excedido',
    en: 'Rate limit exceeded',
  },
  'errors.val.invalidInput': {
    'pt-BR': 'Dados de entrada inválidos',
    en: 'Invalid input data',
  },
  'errors.company.notFound': {
    'pt-BR': 'Empresa não encontrada',
    en: 'Company not found',
  },
  'errors.shareholder.notFound': {
    'pt-BR': 'Acionista não encontrado',
    en: 'Shareholder not found',
  },
  'errors.shareClass.notFound': {
    'pt-BR': 'Classe de ações não encontrada',
    en: 'Share class not found',
  },
  'errors.transaction.notFound': {
    'pt-BR': 'Transação não encontrada',
    en: 'Transaction not found',
  },
  'errors.document.notFound': {
    'pt-BR': 'Documento não encontrado',
    en: 'Document not found',
  },
  'errors.auth.invalidToken': {
    'pt-BR': 'Token de autenticação inválido',
    en: 'Invalid authentication token',
  },
  'errors.auth.unauthorized': {
    'pt-BR': 'Não autorizado',
    en: 'Unauthorized',
  },
  'errors.auth.accountLocked': {
    'pt-BR': 'Conta temporariamente bloqueada. Tente novamente em 15 minutos.',
    en: 'Account temporarily locked. Try again in 15 minutes.',
  },
  'errors.auth.privyUnavailable': {
    'pt-BR': 'Serviço de autenticação indisponível',
    en: 'Authentication service unavailable',
  },
  'errors.auth.duplicateEmail': {
    'pt-BR': 'E-mail já registrado',
    en: 'Email already registered',
  },
  'errors.company.cnpjDuplicate': {
    'pt-BR': 'CNPJ já cadastrado',
    en: 'CNPJ already registered',
  },
  'errors.company.invalidCnpj': {
    'pt-BR': 'CNPJ inválido — dígitos verificadores incorretos',
    en: 'Invalid CNPJ — incorrect check digits',
  },
  'errors.company.invalidFoundedDate': {
    'pt-BR': 'Data de fundação inválida',
    en: 'Invalid founding date',
  },
  'errors.company.futureFoundedDate': {
    'pt-BR': 'Data de fundação não pode ser no futuro',
    en: 'Founding date cannot be in the future',
  },
  'errors.company.membershipLimit': {
    'pt-BR': 'Limite de empresas atingido (máximo 20)',
    en: 'Company membership limit reached (maximum 20)',
  },
  'errors.company.cannotUpdateDissolved': {
    'pt-BR': 'Empresa dissolvida não pode ser atualizada',
    en: 'Dissolved company cannot be updated',
  },
  'errors.company.alreadyDissolved': {
    'pt-BR': 'Empresa já está dissolvida',
    en: 'Company is already dissolved',
  },
  'errors.company.hasActiveShareholders': {
    'pt-BR': 'Empresa possui acionistas ativos — remova-os antes de dissolver',
    en: 'Company has active shareholders — remove them before dissolving',
  },
  'errors.company.hasActiveRounds': {
    'pt-BR': 'Empresa possui rodadas de investimento ativas — encerre-as antes de dissolver',
    en: 'Company has active funding rounds — close them before dissolving',
  },
  'errors.company.invalidStatusTransition': {
    'pt-BR': 'Transição de status inválida',
    en: 'Invalid status transition',
  },
  'errors.cap.insufficientShares': {
    'pt-BR': 'Ações insuficientes para completar a operação',
    en: 'Insufficient shares to complete the operation',
  },
  'errors.auth.forbidden': {
    'pt-BR': 'Permissão insuficiente para esta operação',
    en: 'Insufficient permission for this operation',
  },
  'errors.auth.loggedOut': {
    'pt-BR': 'Sessão encerrada com sucesso',
    en: 'Session ended successfully',
  },
};

export class AppException extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly statusCode: number = HttpStatus.UNPROCESSABLE_ENTITY,
    public readonly details?: Record<string, unknown>,
    public readonly validationErrors?: ValidationErrorDetail[],
  ) {
    super(messageKey);
  }

  getLocalizedMessage(lang: string): string {
    const messages = MESSAGES[this.messageKey];
    if (!messages) return this.messageKey;
    return messages[lang] || messages['pt-BR'] || this.messageKey;
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string, id?: string) {
    super(
      `${resource.toUpperCase()}_NOT_FOUND`,
      `errors.${resource.toLowerCase()}.notFound`,
      HttpStatus.NOT_FOUND,
      id ? { id } : undefined,
    );
  }
}

export class ConflictException extends AppException {
  constructor(code: string, messageKey: string, details?: Record<string, unknown>) {
    super(code, messageKey, HttpStatus.CONFLICT, details);
  }
}

export class BusinessRuleException extends AppException {
  constructor(code: string, messageKey: string, details?: Record<string, unknown>) {
    super(code, messageKey, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class ValidationException extends AppException {
  constructor(errors: ValidationErrorDetail[]) {
    super('VAL_INVALID_INPUT', 'errors.val.invalidInput', HttpStatus.BAD_REQUEST, undefined, errors);
  }
}

export class UnauthorizedException extends AppException {
  constructor(messageKey = 'errors.auth.invalidToken') {
    super('AUTH_INVALID_TOKEN', messageKey, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends AppException {
  constructor(messageKey = 'errors.auth.unauthorized') {
    super('AUTH_FORBIDDEN', messageKey, HttpStatus.FORBIDDEN);
  }
}
