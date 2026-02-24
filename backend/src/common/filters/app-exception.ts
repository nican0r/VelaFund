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
  'errors.shareholder.companyNotActive': {
    'pt-BR': 'A empresa deve estar ativa para gerenciar acionistas',
    en: 'Company must be active to manage shareholders',
  },
  'errors.shareholder.invalidDocument': {
    'pt-BR': 'CPF/CNPJ inválido — formato não reconhecido',
    en: 'Invalid CPF/CNPJ — unrecognized format',
  },
  'errors.shareholder.corporateNeedsCnpj': {
    'pt-BR': 'Acionista do tipo CORPORATE deve informar CNPJ',
    en: 'CORPORATE shareholder must provide a CNPJ',
  },
  'errors.shareholder.individualNeedsCpf': {
    'pt-BR': 'Acionista pessoa física deve informar CPF',
    en: 'Individual shareholder must provide a CPF',
  },
  'errors.shareholder.invalidCpf': {
    'pt-BR': 'CPF inválido — dígitos verificadores incorretos',
    en: 'Invalid CPF — incorrect check digits',
  },
  'errors.shareholder.invalidCnpj': {
    'pt-BR': 'CNPJ inválido — dígitos verificadores incorretos',
    en: 'Invalid CNPJ — incorrect check digits',
  },
  'errors.shareholder.cpfCnpjDuplicate': {
    'pt-BR': 'CPF/CNPJ já cadastrado nesta empresa',
    en: 'CPF/CNPJ already registered in this company',
  },
  'errors.shareholder.invalidRdeDate': {
    'pt-BR': 'Data do RDE-IED inválida',
    en: 'Invalid RDE-IED date',
  },
  'errors.shareholder.alreadyInactive': {
    'pt-BR': 'Acionista já está inativo',
    en: 'Shareholder is already inactive',
  },
  'errors.shareholder.notCorporate': {
    'pt-BR': 'Apenas acionistas do tipo CORPORATE podem ter beneficiários finais',
    en: 'Only CORPORATE shareholders can have beneficial owners',
  },
  'errors.shareholder.uboPercentagesExceed': {
    'pt-BR': 'A soma das participações dos beneficiários finais não pode exceder 100%',
    en: 'Beneficial owners ownership percentages cannot exceed 100%',
  },
  'errors.shareholder.uboNoQualifiedOwner': {
    'pt-BR': 'Pelo menos um beneficiário final deve ter participação >= 25%',
    en: 'At least one beneficial owner must have >= 25% ownership',
  },
  'errors.shareClass.notFound': {
    'pt-BR': 'Classe de ações não encontrada',
    en: 'Share class not found',
  },
  'errors.transaction.notFound': {
    'pt-BR': 'Transação não encontrada',
    en: 'Transaction not found',
  },
  'errors.txn.companyNotActive': {
    'pt-BR': 'A empresa deve estar ativa para criar transações',
    en: 'Company must be active to create transactions',
  },
  'errors.txn.invalidQuantity': {
    'pt-BR': 'Quantidade de ações deve ser maior que zero',
    en: 'Share quantity must be greater than zero',
  },
  'errors.txn.insufficientShares': {
    'pt-BR': 'Ações insuficientes para completar a transferência',
    en: 'Insufficient shares to complete the transfer',
  },
  'errors.txn.exceedsAuthorized': {
    'pt-BR': 'Emissão excede o total autorizado da classe de ações',
    en: 'Issuance exceeds the authorized total of the share class',
  },
  'errors.txn.toShareholderRequired': {
    'pt-BR': 'Acionista de destino é obrigatório para este tipo de transação',
    en: 'Destination shareholder is required for this transaction type',
  },
  'errors.txn.fromShareholderRequired': {
    'pt-BR': 'Acionista de origem é obrigatório para este tipo de transação',
    en: 'Source shareholder is required for this transaction type',
  },
  'errors.txn.sameShareholder': {
    'pt-BR': 'Acionista de origem e destino não podem ser o mesmo',
    en: 'Source and destination shareholder cannot be the same',
  },
  'errors.txn.invalidStatusTransition': {
    'pt-BR': 'Transição de status inválida para esta transação',
    en: 'Invalid status transition for this transaction',
  },
  'errors.txn.cannotCancelConfirmed': {
    'pt-BR': 'Transação confirmada não pode ser cancelada',
    en: 'Confirmed transaction cannot be cancelled',
  },
  'errors.txn.alreadyCancelled': {
    'pt-BR': 'Transação já foi cancelada',
    en: 'Transaction has already been cancelled',
  },
  'errors.txn.toShareClassRequired': {
    'pt-BR': 'Classe de ações de destino é obrigatória para conversão',
    en: 'Target share class is required for conversion',
  },
  'errors.txn.splitRatioRequired': {
    'pt-BR': 'Proporção de desdobramento é obrigatória para split',
    en: 'Split ratio is required for split transactions',
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
  'errors.cap.futureSnapshotDate': {
    'pt-BR': 'Não é possível criar snapshot para data futura',
    en: 'Cannot create snapshot for a future date',
  },
  'errors.cap.noDataForDate': {
    'pt-BR': 'Nenhum dado disponível para a data solicitada',
    en: 'No cap table data available for the requested date',
  },
  'errors.capTableSnapshot.notFound': {
    'pt-BR': 'Snapshot da tabela de capitalização não encontrado',
    en: 'Cap table snapshot not found',
  },
  'errors.cap.shareClassDuplicate': {
    'pt-BR': 'Já existe uma classe de ações com este nome nesta empresa',
    en: 'A share class with this name already exists in this company',
  },
  'errors.cap.shareClassInUse': {
    'pt-BR':
      'Classe de ações não pode ser removida — possui ações emitidas ou participações ativas',
    en: 'Share class cannot be deleted — has issued shares or active shareholdings',
  },
  'errors.cap.companyNotActive': {
    'pt-BR': 'A empresa deve estar ativa para gerenciar classes de ações',
    en: 'Company must be active to manage share classes',
  },
  'errors.cap.invalidShareClassType': {
    'pt-BR': 'Tipo de classe de ações inválido para este tipo de empresa',
    en: 'Invalid share class type for this company entity type',
  },
  'errors.cap.totalAuthorizedCannotDecrease': {
    'pt-BR': 'O total autorizado não pode ser diminuído',
    en: 'Total authorized cannot be decreased',
  },
  'errors.cap.preferredShareLimitExceeded': {
    'pt-BR':
      'Ações preferenciais não podem exceder 2/3 do capital total autorizado (Lei 6.404/76 Art. 15 §2)',
    en: 'Preferred shares cannot exceed 2/3 of total authorized capital (Brazilian Corp Law Art. 15 §2)',
  },
  'errors.cap.invalidTotalAuthorized': {
    'pt-BR': 'O total autorizado deve ser um valor não-negativo',
    en: 'Total authorized must be a non-negative value',
  },
  'errors.auth.forbidden': {
    'pt-BR': 'Permissão insuficiente para esta operação',
    en: 'Insufficient permission for this operation',
  },
  'errors.auth.loggedOut': {
    'pt-BR': 'Sessão encerrada com sucesso',
    en: 'Session ended successfully',
  },
  'errors.company.dissolved': {
    'pt-BR': 'Empresa dissolvida não aceita novos membros',
    en: 'Dissolved company cannot accept new members',
  },
  'errors.member.notFound': {
    'pt-BR': 'Membro não encontrado',
    en: 'Member not found',
  },
  'errors.member.alreadyExists': {
    'pt-BR': 'Usuário já é membro ativo desta empresa',
    en: 'User is already an active member of this company',
  },
  'errors.member.invitationPending': {
    'pt-BR': 'Já existe um convite pendente para este e-mail',
    en: 'A pending invitation already exists for this email',
  },
  'errors.member.invitationRateLimit': {
    'pt-BR': 'Limite diário de convites atingido',
    en: 'Daily invitation limit reached',
  },
  'errors.member.notActive': {
    'pt-BR': 'Membro não está ativo',
    en: 'Member is not active',
  },
  'errors.member.lastAdmin': {
    'pt-BR': 'Não é possível remover ou rebaixar o último administrador',
    en: 'Cannot remove or demote the last admin',
  },
  'errors.member.permissionProtected': {
    'pt-BR': 'Esta permissão não pode ser atribuída a este cargo',
    en: 'This permission cannot be assigned to this role',
  },
  'errors.member.alreadyRemoved': {
    'pt-BR': 'Membro já foi removido',
    en: 'Member has already been removed',
  },
  'errors.member.notPending': {
    'pt-BR': 'Membro não está com status pendente',
    en: 'Member is not in pending status',
  },
  'errors.member.invitationExpired': {
    'pt-BR': 'O convite expirou',
    en: 'Invitation has expired',
  },
  'errors.member.invitationAlreadyAccepted': {
    'pt-BR': 'O convite já foi aceito',
    en: 'Invitation has already been accepted',
  },
  'errors.member.companyLimitReached': {
    'pt-BR': 'Limite máximo de empresas atingido (máximo 20)',
    en: 'Maximum company membership limit reached (maximum 20)',
  },
  'errors.invitation.notFound': {
    'pt-BR': 'Convite não encontrado',
    en: 'Invitation not found',
  },
  'errors.round.notFound': {
    'pt-BR': 'Rodada de investimento não encontrada',
    en: 'Funding round not found',
  },
  'errors.round.companyNotActive': {
    'pt-BR': 'A empresa deve estar ativa para criar rodadas de investimento',
    en: 'Company must be active to create funding rounds',
  },
  'errors.round.invalidAmount': {
    'pt-BR': 'Valor inválido — deve ser maior que zero',
    en: 'Invalid amount — must be greater than zero',
  },
  'errors.round.minimumExceedsTarget': {
    'pt-BR': 'O valor mínimo de fechamento não pode exceder o valor alvo',
    en: 'Minimum close amount cannot exceed target amount',
  },
  'errors.round.hardCapBelowTarget': {
    'pt-BR': 'O teto máximo não pode ser menor que o valor alvo',
    en: 'Hard cap cannot be less than target amount',
  },
  'errors.round.notOpen': {
    'pt-BR': 'A rodada não está aberta para modificações ou compromissos',
    en: 'Round is not open for modifications or commitments',
  },
  'errors.round.invalidStatusTransition': {
    'pt-BR': 'Transição de status inválida para esta rodada',
    en: 'Invalid status transition for this funding round',
  },
  'errors.round.alreadyClosed': {
    'pt-BR': 'A rodada já foi encerrada',
    en: 'Funding round has already been closed',
  },
  'errors.round.noCommitments': {
    'pt-BR': 'Não é possível fechar a rodada sem compromissos ativos',
    en: 'Cannot close round without active commitments',
  },
  'errors.round.unconfirmedPayments': {
    'pt-BR': 'Existem pagamentos não confirmados — confirme todos antes de fechar',
    en: 'There are unconfirmed payments — confirm all before closing',
  },
  'errors.round.minimumNotMet': {
    'pt-BR': 'Valor mínimo da rodada não foi atingido',
    en: 'Round minimum close amount not met',
  },
  'errors.round.exceedsAuthorized': {
    'pt-BR': 'Emissão excede o total autorizado da classe de ações',
    en: 'Issuance would exceed the authorized total of the share class',
  },
  'errors.round.hardCapReached': {
    'pt-BR': 'O compromisso excede o teto máximo da rodada',
    en: 'Commitment would exceed the round hard cap',
  },
  'errors.round.commitmentExists': {
    'pt-BR': 'Já existe um compromisso ativo para este acionista nesta rodada',
    en: 'An active commitment already exists for this shareholder in this round',
  },
  'errors.round.commitmentCancelled': {
    'pt-BR': 'O compromisso já foi cancelado',
    en: 'Commitment has already been cancelled',
  },
  'errors.round.commitmentAlreadyConfirmed': {
    'pt-BR': 'O pagamento do compromisso já foi confirmado',
    en: 'Commitment payment has already been confirmed',
  },
  'errors.round.invalidPaymentTransition': {
    'pt-BR': 'Transição de status de pagamento inválida',
    en: 'Invalid payment status transition',
  },
  'errors.commitment.notFound': {
    'pt-BR': 'Compromisso não encontrado',
    en: 'Commitment not found',
  },
  'errors.optionPlan.notFound': {
    'pt-BR': 'Plano de opções não encontrado',
    en: 'Option plan not found',
  },
  'errors.opt.companyNotActive': {
    'pt-BR': 'A empresa deve estar ativa para gerenciar planos de opções',
    en: 'Company must be active to manage option plans',
  },
  'errors.opt.invalidPoolSize': {
    'pt-BR': 'O tamanho do pool deve ser maior que zero',
    en: 'Pool size must be greater than zero',
  },
  'errors.opt.planClosed': {
    'pt-BR': 'O plano de opções está encerrado — não é possível modificar',
    en: 'Option plan is closed — cannot modify',
  },
  'errors.opt.planAlreadyClosed': {
    'pt-BR': 'O plano de opções já está encerrado',
    en: 'Option plan is already closed',
  },
  'errors.opt.poolCannotShrink': {
    'pt-BR': 'O pool não pode ser reduzido abaixo do total já outorgado',
    en: 'Pool size cannot be reduced below total granted amount',
  },
  'errors.opt.planExhausted': {
    'pt-BR': 'Plano de opções não possui opções disponíveis suficientes',
    en: 'Option plan does not have enough available options',
  },
  'errors.opt.invalidQuantity': {
    'pt-BR': 'Quantidade de opções deve ser maior que zero',
    en: 'Option quantity must be greater than zero',
  },
  'errors.opt.invalidStrikePrice': {
    'pt-BR': 'Preço de exercício deve ser maior que zero',
    en: 'Strike price must be greater than zero',
  },
  'errors.opt.cliffExceedsVesting': {
    'pt-BR': 'Período de cliff não pode exceder o período total de vesting',
    en: 'Cliff period cannot exceed total vesting duration',
  },
  'errors.opt.invalidExpiration': {
    'pt-BR': 'Data de expiração deve ser posterior à data de outorga',
    en: 'Expiration date must be after grant date',
  },
  'errors.opt.grantAlreadyCancelled': {
    'pt-BR': 'A outorga de opções já foi cancelada',
    en: 'Option grant has already been cancelled',
  },
  'errors.opt.grantTerminated': {
    'pt-BR': 'A outorga de opções foi finalizada — não é possível modificar',
    en: 'Option grant has been terminated — cannot modify',
  },
  'errors.optionGrant.notFound': {
    'pt-BR': 'Outorga de opções não encontrada',
    en: 'Option grant not found',
  },
  'errors.optionExercise.notFound': {
    'pt-BR': 'Solicitação de exercício não encontrada',
    en: 'Exercise request not found',
  },
  'errors.opt.exercisePending': {
    'pt-BR': 'Já existe uma solicitação de exercício pendente para esta outorga',
    en: 'An exercise request is already pending for this grant',
  },
  'errors.opt.insufficientVested': {
    'pt-BR': 'Opções vestidas insuficientes para o exercício solicitado',
    en: 'Insufficient vested options for the requested exercise',
  },
  'errors.opt.exerciseWindowClosed': {
    'pt-BR': 'O prazo para exercício pós-término expirou',
    en: 'Post-termination exercise window has expired',
  },
  'errors.opt.grantNotActive': {
    'pt-BR': 'A outorga de opções não está ativa',
    en: 'Option grant is not active',
  },
  'errors.opt.exerciseNotPending': {
    'pt-BR': 'A solicitação de exercício não está pendente de pagamento',
    en: 'Exercise request is not pending payment',
  },
  'errors.opt.exerciseAlreadyCancelled': {
    'pt-BR': 'A solicitação de exercício já foi cancelada',
    en: 'Exercise request has already been cancelled',
  },
  'errors.opt.exerciseAlreadyConfirmed': {
    'pt-BR': 'A solicitação de exercício já foi confirmada',
    en: 'Exercise request has already been confirmed',
  },
  'errors.opt.noShareholderLinked': {
    'pt-BR': 'A outorga precisa estar vinculada a um acionista para emitir ações',
    en: 'Grant must be linked to a shareholder to issue shares',
  },
  // ─── CONVERTIBLE INSTRUMENT MESSAGES ──────────────────────────────
  'errors.convertible.notFound': {
    'pt-BR': 'Instrumento conversível não encontrado',
    en: 'Convertible instrument not found',
  },
  'errors.conv.companyNotActive': {
    'pt-BR': 'A empresa deve estar ativa para criar instrumentos conversíveis',
    en: 'Company must be active to create convertible instruments',
  },
  'errors.conv.maturityBeforeIssue': {
    'pt-BR': 'Data de vencimento deve ser posterior à data de emissão',
    en: 'Maturity date must be after issue date',
  },
  'errors.conv.invalidPrincipal': {
    'pt-BR': 'O valor principal deve ser maior que zero',
    en: 'Principal amount must be greater than zero',
  },
  'errors.conv.highInterestRate': {
    'pt-BR': 'Taxa de juros acima de 30% requer confirmação explícita',
    en: 'Interest rate above 30% requires explicit confirmation',
  },
  'errors.conv.cannotUpdate': {
    'pt-BR': 'Instrumento conversível não pode ser atualizado no status atual',
    en: 'Convertible instrument cannot be updated in current status',
  },
  'errors.conv.invalidStatusTransition': {
    'pt-BR': 'Transição de status inválida para este instrumento conversível',
    en: 'Invalid status transition for this convertible instrument',
  },
  'errors.conv.alreadyConverted': {
    'pt-BR': 'Instrumento conversível já foi convertido ou não está ativo',
    en: 'Convertible instrument has already been converted or is not active',
  },
  'errors.conv.triggerNotMet': {
    'pt-BR': 'Valor da rodada não atinge o limite mínimo de financiamento qualificado',
    en: 'Funding round amount does not meet the qualified financing threshold',
  },
  'errors.conv.holdingPeriodNotMet': {
    'pt-BR': 'Período mínimo de retenção do Investimento-Anjo não foi cumprido',
    en: 'Investimento-Anjo minimum holding period has not been met',
  },
  'errors.conv.zeroPremoneeyShares': {
    'pt-BR': 'Não existem ações pré-money emitidas — impossível calcular preço de conversão',
    en: 'No pre-money shares issued — cannot calculate conversion price',
  },
  'errors.conv.invalidValuation': {
    'pt-BR': 'O valor da avaliação deve ser maior que zero',
    en: 'Valuation must be greater than zero',
  },
  'errors.conv.exceedsAuthorized': {
    'pt-BR': 'Conversão excede o total autorizado da classe de ações',
    en: 'Conversion would exceed the authorized total of the share class',
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

export class GoneException extends AppException {
  constructor(code: string, messageKey: string, details?: Record<string, unknown>) {
    super(code, messageKey, HttpStatus.GONE, details);
  }
}
