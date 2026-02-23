# Error Handling Specification

## Overview

This specification defines the error handling strategy for the Navia platform. It complements `api-standards.md` (which defines the error response envelope, `AppException` class hierarchy, and `GlobalExceptionFilter`) by providing:

- Complete error code catalog with translations
- Retry strategies per external service
- Sentry monitoring and alerting configuration
- PII redaction rules for LGPD compliance
- Frontend error handling patterns with React code examples

**Prerequisite**: Read `api-standards.md` for the error response format, HTTP status code usage, and NestJS exception filter implementation.

---

## Table of Contents

1. [Error Code Catalog](#error-code-catalog)
2. [Error Code to HTTP Status Mapping](#error-code-to-http-status-mapping)
3. [i18n Translation Table](#i18n-translation-table)
4. [Retry Strategies by Service](#retry-strategies-by-service)
5. [Error Logging and PII Redaction](#error-logging-and-pii-redaction)
6. [Sentry Monitoring and Alerting](#sentry-monitoring-and-alerting)
7. [Frontend Error Handling](#frontend-error-handling)
8. [Success Criteria](#success-criteria)

---

## Error Code Catalog

Error codes follow the pattern `PREFIX_DESCRIPTION` in `UPPER_SNAKE_CASE`. The prefix identifies the domain.

### AUTH — Authentication

| Code | Description | Trigger |
|------|-------------|---------|
| `AUTH_INVALID_TOKEN` | Privy JWT is missing, malformed, or expired | Token verification fails |
| `AUTH_TOKEN_EXPIRED` | JWT has expired | Token `exp` claim is in the past |
| `AUTH_TOKEN_VERIFICATION_FAILED` | Privy SDK could not verify the token | Privy API rejects token |
| `AUTH_SESSION_NOT_FOUND` | No active session for the user | Session lookup returns null |
| `AUTH_DUPLICATE_EMAIL` | Email already associated with another account | Registration with existing email |
| `AUTH_NO_WALLET` | User has no embedded wallet address | Wallet-required operation without wallet |
| `AUTH_ACCOUNT_LOCKED` | Account temporarily locked after failed attempts | 5+ failed login attempts in 15 minutes |
| `AUTH_PRIVY_UNAVAILABLE` | Privy authentication service is unreachable | Privy API timeout or 5xx |

### KYC — KYC Verification

| Code | Description | Trigger |
|------|-------------|---------|
| `KYC_REQUIRED` | User must complete KYC before this action | Accessing KYC-gated feature |
| `KYC_CPF_INVALID` | CPF format invalid or check digit failed | CPF validation |
| `KYC_CPF_NOT_FOUND` | CPF not found in Receita Federal | Verifik lookup returns no match |
| `KYC_CPF_DOB_MISMATCH` | Date of birth does not match CPF record | DOB verification fails |
| `KYC_DOCUMENT_INVALID` | Uploaded document is unreadable or tampered | Document OCR/validation fails |
| `KYC_DOCUMENT_EXPIRED` | Identity document has expired | Expiry date check |
| `KYC_FACE_MATCH_FAILED` | Face match score below 85% threshold | Facial recognition comparison |
| `KYC_LIVENESS_CHECK_FAILED` | Liveness detection failed | Deepfake or static image detected |
| `KYC_AML_HIGH_RISK` | AML screening returned HIGH risk | AML check result |
| `KYC_PEP_DETECTED` | User flagged as Politically Exposed Person | PEP screening result |
| `KYC_SANCTIONS_MATCH` | User matches a sanctions list | Sanctions screening result |
| `KYC_MAX_ATTEMPTS_EXCEEDED` | Exceeded maximum KYC submission attempts (3) | Attempt counter check |
| `KYC_VERIFIK_UNAVAILABLE` | Verifik API is unreachable | Verifik timeout or 5xx |

### COMPANY — Company Management

| Code | Description | Trigger |
|------|-------------|---------|
| `COMPANY_NOT_FOUND` | Company does not exist or user has no access | Lookup returns null |
| `COMPANY_CNPJ_INVALID` | CNPJ format is invalid or check digit failed | CNPJ format validation |
| `COMPANY_CNPJ_DUPLICATE` | CNPJ is already registered on the platform | Unique constraint violation |
| `COMPANY_CNPJ_INACTIVE` | CNPJ status in Receita Federal is not ATIVA | Verifik returns non-ATIVA status |
| `COMPANY_CNPJ_VALIDATION_FAILED` | CNPJ validation via Verifik failed | Verifik API error during validation |
| `COMPANY_MEMBER_EXISTS` | Email already has an active membership | Invite to existing active member |
| `COMPANY_MEMBER_NOT_FOUND` | Member does not exist in this company | Member lookup returns null |
| `COMPANY_MEMBER_LIMIT_REACHED` | User is at 20-company membership limit | Membership count check |
| `COMPANY_LAST_ADMIN` | Cannot remove or demote the only ADMIN | Admin count check |
| `COMPANY_NOT_ACTIVE` | Company is not in ACTIVE status | Action requires ACTIVE company |
| `COMPANY_DISSOLVED` | Company is dissolved and read-only | Write operation on DISSOLVED company |
| `COMPANY_HAS_SHAREHOLDERS` | Cannot change entity type with shareholders | Entity type change attempt |
| `COMPANY_HAS_ACTIVE_ROUNDS` | Cannot dissolve with active funding rounds | Dissolution prerequisite check |
| `COMPANY_HAS_PENDING_EXERCISES` | Cannot dissolve with pending option exercises | Dissolution prerequisite check |
| `COMPANY_SETUP_FAILED` | Async company setup (CNPJ/contract) failed | Bull job failure after retries |
| `COMPANY_INVITATION_EXPIRED` | Invitation token has expired (>7 days) | Token expiry check |
| `COMPANY_INVITATION_USED` | Invitation token has already been used | Token used_at not null |

### CAP — Cap Table

| Code | Description | Trigger |
|------|-------------|---------|
| `CAP_INSUFFICIENT_SHARES` | Not enough shares to complete operation | Balance check fails |
| `CAP_NEGATIVE_BALANCE` | Operation would result in negative balance | Calculation check |
| `CAP_RECONCILIATION_FAILED` | On-chain and off-chain data mismatch | Reconciliation job |
| `CAP_SNAPSHOT_NOT_FOUND` | Requested cap table snapshot does not exist | Snapshot lookup |
| `CAP_SHARE_CLASS_NOT_FOUND` | Share class does not exist in this company | Share class lookup |
| `CAP_SHARE_CLASS_IN_USE` | Cannot delete share class with existing holdings | Delete attempt |

### TXN — Transactions

| Code | Description | Trigger |
|------|-------------|---------|
| `TXN_NOT_FOUND` | Transaction does not exist | Lookup returns null |
| `TXN_LOCKUP_ACTIVE` | Shares are locked until a future date | Lock-up period check |
| `TXN_ROFR_REQUIRED` | Right of first refusal has not been exercised | ROFR check on transfer |
| `TXN_APPROVAL_REQUIRED` | Transaction requires board/admin approval | Approval workflow check |
| `TXN_ALREADY_APPROVED` | Transaction has already been approved | Duplicate approval attempt |
| `TXN_ALREADY_CANCELLED` | Transaction has already been cancelled | Cancel on cancelled transaction |
| `TXN_INVALID_TYPE` | Transaction type is not valid for this operation | Type validation |
| `TXN_DILUTION_EXCEEDS_THRESHOLD` | Dilution exceeds configurable warning threshold | Dilution calculation (warning, not block) |

### ROUND — Funding Rounds

| Code | Description | Trigger |
|------|-------------|---------|
| `ROUND_NOT_FOUND` | Funding round does not exist | Lookup returns null |
| `ROUND_NOT_OPEN` | Round is not in OPEN status | Action requires OPEN round |
| `ROUND_HARD_CAP_REACHED` | Round has reached its maximum amount | Commitment exceeds hard cap |
| `ROUND_COMMITMENT_NOT_FOUND` | Commitment does not exist | Lookup returns null |
| `ROUND_ALREADY_CLOSED` | Round has already been closed | Close attempt on CLOSED round |
| `ROUND_MINIMUM_NOT_MET` | Minimum funding threshold not reached | Close attempt below minimum |

### OPT — Options

| Code | Description | Trigger |
|------|-------------|---------|
| `OPT_PLAN_NOT_FOUND` | Option plan does not exist | Lookup returns null |
| `OPT_PLAN_EXHAUSTED` | Option plan has no remaining shares in pool | Pool availability check |
| `OPT_GRANT_NOT_FOUND` | Option grant does not exist | Lookup returns null |
| `OPT_INSUFFICIENT_VESTED` | Not enough vested options to exercise | Vested balance check |
| `OPT_EXERCISE_PENDING` | An exercise request is already pending | Duplicate exercise check |
| `OPT_EXERCISE_NOT_FOUND` | Exercise request does not exist | Lookup returns null |
| `OPT_GRANT_TERMINATED` | Grant has been terminated | Action on terminated grant |
| `OPT_EXERCISE_WINDOW_CLOSED` | Post-termination exercise window has expired | Window date check |

### DOC — Documents

| Code | Description | Trigger |
|------|-------------|---------|
| `DOC_NOT_FOUND` | Document does not exist | Lookup returns null |
| `DOC_TEMPLATE_NOT_FOUND` | Document template does not exist | Template lookup |
| `DOC_GENERATION_FAILED` | PDF generation failed | Puppeteer error |
| `DOC_SIGNATURE_INVALID` | EIP-712 signature verification failed | Signature verification |
| `DOC_ALREADY_SIGNED` | Signer has already signed this document | Duplicate signature check |
| `DOC_ALL_SIGNATURES_COMPLETE` | Document is already fully signed | Sign attempt on completed doc |
| `DOC_UPLOAD_TOO_LARGE` | File exceeds maximum size (10 MB) | File size check |
| `DOC_INVALID_FILE_TYPE` | File type not allowed (must be PDF, PNG, JPG) | MIME type check |

### CHAIN — Blockchain

| Code | Description | Trigger |
|------|-------------|---------|
| `CHAIN_TX_FAILED` | On-chain transaction reverted | Transaction receipt status 0 |
| `CHAIN_TX_TIMEOUT` | Transaction not mined within timeout period | Timeout after 5 minutes |
| `CHAIN_GAS_ESTIMATION_FAILED` | Gas estimation failed (likely revert) | `estimateGas` throws |
| `CHAIN_WALLET_NOT_FOUND` | Admin wallet for this company not found | Wallet lookup |
| `CHAIN_CONTRACT_NOT_DEPLOYED` | Company smart contract not yet deployed | Contract address is null |
| `CHAIN_NONCE_CONFLICT` | Transaction nonce conflict | Nonce management error |
| `CHAIN_RPC_UNAVAILABLE` | Base network RPC is unreachable | RPC connection failure |
| `CHAIN_SYNC_BEHIND` | Blockchain sync is more than 30 min behind | Sync status check |
| `CHAIN_REORG_DETECTED` | Block reorganization detected | Block number regression |

### VAL — Validation

| Code | Description | Trigger |
|------|-------------|---------|
| `VAL_INVALID_INPUT` | One or more fields failed validation | class-validator pipe |
| `VAL_REQUIRED_FIELD` | A required field is missing | `@IsNotEmpty` check |
| `VAL_INVALID_FORMAT` | Field does not match expected format | `@Matches` check |
| `VAL_OUT_OF_RANGE` | Numeric value outside allowed range | `@Min`/`@Max` check |
| `VAL_INVALID_UUID` | Value is not a valid UUID | `@IsUUID` check |
| `VAL_INVALID_ENUM` | Value is not in the allowed enum values | `@IsEnum` check |
| `VAL_INVALID_DATE` | Value is not a valid ISO 8601 date | `@IsDateString` check |

### SYS — System

| Code | Description | Trigger |
|------|-------------|---------|
| `SYS_INTERNAL_ERROR` | Unhandled server error | Uncaught exception |
| `SYS_DATABASE_ERROR` | Database connection or query failure | Prisma error |
| `SYS_RATE_LIMITED` | Rate limit exceeded | Throttler guard |
| `SYS_EXTERNAL_SERVICE_ERROR` | An external service returned an error | Privy/Verifik/AWS error |
| `SYS_MAINTENANCE` | System is under maintenance | Maintenance mode flag |

---

## Error Code to HTTP Status Mapping

| HTTP Status | Error Code Prefixes | Usage |
|-------------|-------------------|-------|
| **400** | `VAL_*` | Validation failures, malformed input |
| **401** | `AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_VERIFICATION_FAILED`, `AUTH_SESSION_NOT_FOUND` | Authentication failures |
| **403** | `AUTH_NO_WALLET` (when wallet required for action), role/permission denials | Authorization failures |
| **404** | `*_NOT_FOUND` (all entity not-found codes) | Resource not found or inaccessible |
| **409** | `COMPANY_CNPJ_DUPLICATE`, `COMPANY_MEMBER_EXISTS`, `AUTH_DUPLICATE_EMAIL` | Resource conflicts |
| **422** | All business rule violations: `CAP_*`, `TXN_*`, `ROUND_*`, `OPT_*`, `DOC_*`, `KYC_*` (non-auth), `COMPANY_LAST_ADMIN`, etc. | Valid input but violates business rules |
| **429** | `SYS_RATE_LIMITED`, `AUTH_ACCOUNT_LOCKED`, `KYC_MAX_ATTEMPTS_EXCEEDED` | Rate/attempt limits exceeded |
| **500** | `SYS_INTERNAL_ERROR`, `SYS_DATABASE_ERROR` | Unhandled server errors |
| **502** | `AUTH_PRIVY_UNAVAILABLE`, `KYC_VERIFIK_UNAVAILABLE`, `CHAIN_RPC_UNAVAILABLE`, `SYS_EXTERNAL_SERVICE_ERROR` | Upstream service failures |
| **503** | `SYS_MAINTENANCE` | Planned downtime |

---

## i18n Translation Table

Every error code maps to a `messageKey` for frontend i18n lookup, plus default messages in PT-BR and EN. The backend uses these to populate the `message` field based on `Accept-Language`.

### Translation File Structure

Translation files are stored as JSON at:
- `backend/src/i18n/pt-BR/errors.json`
- `backend/src/i18n/en/errors.json`

The `messageKey` uses dot notation: `errors.<prefix>.<description>`.

### AUTH — Authentication

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `AUTH_INVALID_TOKEN` | `errors.auth.invalidToken` | Token de autenticação inválido | Invalid authentication token |
| `AUTH_TOKEN_EXPIRED` | `errors.auth.tokenExpired` | Sessão expirada. Faça login novamente | Session expired. Please log in again |
| `AUTH_TOKEN_VERIFICATION_FAILED` | `errors.auth.tokenVerificationFailed` | Falha na verificação do token | Token verification failed |
| `AUTH_SESSION_NOT_FOUND` | `errors.auth.sessionNotFound` | Sessão não encontrada | Session not found |
| `AUTH_DUPLICATE_EMAIL` | `errors.auth.duplicateEmail` | Este email já está cadastrado | This email is already registered |
| `AUTH_NO_WALLET` | `errors.auth.noWallet` | Carteira digital não encontrada. Configure sua carteira primeiro | Digital wallet not found. Set up your wallet first |
| `AUTH_ACCOUNT_LOCKED` | `errors.auth.accountLocked` | Conta temporariamente bloqueada. Tente novamente em alguns minutos | Account temporarily locked. Try again in a few minutes |
| `AUTH_PRIVY_UNAVAILABLE` | `errors.auth.privyUnavailable` | Serviço de autenticação temporariamente indisponível | Authentication service temporarily unavailable |

### KYC — KYC Verification

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `KYC_REQUIRED` | `errors.kyc.required` | Verificação de identidade necessária para continuar | Identity verification required to continue |
| `KYC_CPF_INVALID` | `errors.kyc.cpfInvalid` | CPF inválido. Verifique o número informado | Invalid CPF. Please check the number |
| `KYC_CPF_NOT_FOUND` | `errors.kyc.cpfNotFound` | CPF não encontrado na Receita Federal | CPF not found in Federal Revenue records |
| `KYC_CPF_DOB_MISMATCH` | `errors.kyc.cpfDobMismatch` | Data de nascimento não corresponde ao CPF | Date of birth does not match CPF record |
| `KYC_DOCUMENT_INVALID` | `errors.kyc.documentInvalid` | Documento ilegível ou inválido. Envie uma foto mais nítida | Document unreadable or invalid. Please upload a clearer photo |
| `KYC_DOCUMENT_EXPIRED` | `errors.kyc.documentExpired` | Documento de identidade expirado | Identity document has expired |
| `KYC_FACE_MATCH_FAILED` | `errors.kyc.faceMatchFailed` | Verificação facial não corresponde ao documento | Face verification does not match the document |
| `KYC_LIVENESS_CHECK_FAILED` | `errors.kyc.livenessCheckFailed` | Verificação de vivacidade falhou. Tente novamente com boa iluminação | Liveness check failed. Try again with good lighting |
| `KYC_AML_HIGH_RISK` | `errors.kyc.amlHighRisk` | Verificação de conformidade requer análise manual | Compliance check requires manual review |
| `KYC_PEP_DETECTED` | `errors.kyc.pepDetected` | Identificação como pessoa politicamente exposta requer análise adicional | Identification as a politically exposed person requires additional review |
| `KYC_SANCTIONS_MATCH` | `errors.kyc.sanctionsMatch` | Verificação de conformidade requer análise manual | Compliance check requires manual review |
| `KYC_MAX_ATTEMPTS_EXCEEDED` | `errors.kyc.maxAttemptsExceeded` | Número máximo de tentativas excedido. Entre em contato com o suporte | Maximum attempts exceeded. Please contact support |
| `KYC_VERIFIK_UNAVAILABLE` | `errors.kyc.verifikUnavailable` | Serviço de verificação temporariamente indisponível | Verification service temporarily unavailable |

### COMPANY — Company Management

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `COMPANY_NOT_FOUND` | `errors.company.notFound` | Empresa não encontrada | Company not found |
| `COMPANY_CNPJ_INVALID` | `errors.company.cnpjInvalid` | CNPJ inválido. Verifique o número informado | Invalid CNPJ. Please check the number |
| `COMPANY_CNPJ_DUPLICATE` | `errors.company.cnpjDuplicate` | Este CNPJ já está cadastrado na plataforma | This CNPJ is already registered on the platform |
| `COMPANY_CNPJ_INACTIVE` | `errors.company.cnpjInactive` | CNPJ não está ativo na Receita Federal | CNPJ is not active in Federal Revenue records |
| `COMPANY_CNPJ_VALIDATION_FAILED` | `errors.company.cnpjValidationFailed` | Falha na validação do CNPJ. Tente novamente | CNPJ validation failed. Please try again |
| `COMPANY_MEMBER_EXISTS` | `errors.company.memberExists` | Este email já possui um convite ou acesso ativo | This email already has an active invitation or access |
| `COMPANY_MEMBER_NOT_FOUND` | `errors.company.memberNotFound` | Membro não encontrado nesta empresa | Member not found in this company |
| `COMPANY_MEMBER_LIMIT_REACHED` | `errors.company.memberLimitReached` | Limite máximo de 20 empresas por usuário atingido | Maximum limit of 20 companies per user reached |
| `COMPANY_LAST_ADMIN` | `errors.company.lastAdmin` | Não é possível remover ou rebaixar o único administrador | Cannot remove or demote the only administrator |
| `COMPANY_NOT_ACTIVE` | `errors.company.notActive` | Empresa não está ativa | Company is not active |
| `COMPANY_DISSOLVED` | `errors.company.dissolved` | Empresa foi dissolvida e está em modo somente leitura | Company has been dissolved and is read-only |
| `COMPANY_HAS_SHAREHOLDERS` | `errors.company.hasShareholders` | Não é possível alterar o tipo de entidade com acionistas existentes | Cannot change entity type with existing shareholders |
| `COMPANY_HAS_ACTIVE_ROUNDS` | `errors.company.hasActiveRounds` | Não é possível dissolver com rodadas de investimento ativas | Cannot dissolve with active funding rounds |
| `COMPANY_HAS_PENDING_EXERCISES` | `errors.company.hasPendingExercises` | Não é possível dissolver com exercícios de opções pendentes | Cannot dissolve with pending option exercises |
| `COMPANY_SETUP_FAILED` | `errors.company.setupFailed` | Configuração da empresa falhou. Tente novamente | Company setup failed. Please try again |
| `COMPANY_INVITATION_EXPIRED` | `errors.company.invitationExpired` | Convite expirado. Solicite um novo convite | Invitation expired. Please request a new invitation |
| `COMPANY_INVITATION_USED` | `errors.company.invitationUsed` | Este convite já foi utilizado | This invitation has already been used |

### CAP — Cap Table

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `CAP_INSUFFICIENT_SHARES` | `errors.cap.insufficientShares` | Ações insuficientes para completar a operação | Insufficient shares to complete the operation |
| `CAP_NEGATIVE_BALANCE` | `errors.cap.negativeBalance` | Operação resultaria em saldo negativo | Operation would result in a negative balance |
| `CAP_RECONCILIATION_FAILED` | `errors.cap.reconciliationFailed` | Falha na reconciliação dos dados on-chain | On-chain data reconciliation failed |
| `CAP_SNAPSHOT_NOT_FOUND` | `errors.cap.snapshotNotFound` | Snapshot do cap table não encontrado | Cap table snapshot not found |
| `CAP_SHARE_CLASS_NOT_FOUND` | `errors.cap.shareClassNotFound` | Classe de ações não encontrada | Share class not found |
| `CAP_SHARE_CLASS_IN_USE` | `errors.cap.shareClassInUse` | Não é possível excluir classe de ações com participações existentes | Cannot delete share class with existing holdings |

### TXN — Transactions

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `TXN_NOT_FOUND` | `errors.txn.notFound` | Transação não encontrada | Transaction not found |
| `TXN_LOCKUP_ACTIVE` | `errors.txn.lockupActive` | Ações estão em período de lock-up | Shares are in lock-up period |
| `TXN_ROFR_REQUIRED` | `errors.txn.rofrRequired` | Direito de preferência não foi exercido | Right of first refusal has not been exercised |
| `TXN_APPROVAL_REQUIRED` | `errors.txn.approvalRequired` | Transação requer aprovação da administração | Transaction requires management approval |
| `TXN_ALREADY_APPROVED` | `errors.txn.alreadyApproved` | Transação já foi aprovada | Transaction has already been approved |
| `TXN_ALREADY_CANCELLED` | `errors.txn.alreadyCancelled` | Transação já foi cancelada | Transaction has already been cancelled |
| `TXN_INVALID_TYPE` | `errors.txn.invalidType` | Tipo de transação inválido para esta operação | Invalid transaction type for this operation |
| `TXN_DILUTION_EXCEEDS_THRESHOLD` | `errors.txn.dilutionExceedsThreshold` | Diluição excede o limite configurado | Dilution exceeds configured threshold |

### ROUND — Funding Rounds

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `ROUND_NOT_FOUND` | `errors.round.notFound` | Rodada de investimento não encontrada | Funding round not found |
| `ROUND_NOT_OPEN` | `errors.round.notOpen` | Rodada não está aberta para compromissos | Round is not open for commitments |
| `ROUND_HARD_CAP_REACHED` | `errors.round.hardCapReached` | Rodada atingiu o valor máximo | Round has reached its maximum amount |
| `ROUND_COMMITMENT_NOT_FOUND` | `errors.round.commitmentNotFound` | Compromisso não encontrado | Commitment not found |
| `ROUND_ALREADY_CLOSED` | `errors.round.alreadyClosed` | Rodada já foi encerrada | Round has already been closed |
| `ROUND_MINIMUM_NOT_MET` | `errors.round.minimumNotMet` | Valor mínimo da rodada não foi atingido | Round minimum threshold not reached |

### OPT — Options

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `OPT_PLAN_NOT_FOUND` | `errors.opt.planNotFound` | Plano de opções não encontrado | Option plan not found |
| `OPT_PLAN_EXHAUSTED` | `errors.opt.planExhausted` | Plano de opções não possui mais ações disponíveis | Option plan has no remaining shares |
| `OPT_GRANT_NOT_FOUND` | `errors.opt.grantNotFound` | Concessão de opções não encontrada | Option grant not found |
| `OPT_INSUFFICIENT_VESTED` | `errors.opt.insufficientVested` | Opções vested insuficientes para exercício | Insufficient vested options to exercise |
| `OPT_EXERCISE_PENDING` | `errors.opt.exercisePending` | Já existe uma solicitação de exercício pendente | An exercise request is already pending |
| `OPT_EXERCISE_NOT_FOUND` | `errors.opt.exerciseNotFound` | Solicitação de exercício não encontrada | Exercise request not found |
| `OPT_GRANT_TERMINATED` | `errors.opt.grantTerminated` | Concessão de opções foi encerrada | Option grant has been terminated |
| `OPT_EXERCISE_WINDOW_CLOSED` | `errors.opt.exerciseWindowClosed` | Prazo para exercício pós-desligamento expirou | Post-termination exercise window has expired |

### DOC — Documents

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `DOC_NOT_FOUND` | `errors.doc.notFound` | Documento não encontrado | Document not found |
| `DOC_TEMPLATE_NOT_FOUND` | `errors.doc.templateNotFound` | Modelo de documento não encontrado | Document template not found |
| `DOC_GENERATION_FAILED` | `errors.doc.generationFailed` | Falha na geração do documento. Tente novamente | Document generation failed. Please try again |
| `DOC_SIGNATURE_INVALID` | `errors.doc.signatureInvalid` | Assinatura digital inválida | Invalid digital signature |
| `DOC_ALREADY_SIGNED` | `errors.doc.alreadySigned` | Documento já foi assinado por este signatário | Document has already been signed by this signer |
| `DOC_ALL_SIGNATURES_COMPLETE` | `errors.doc.allSignaturesComplete` | Documento já possui todas as assinaturas | Document already has all signatures |
| `DOC_UPLOAD_TOO_LARGE` | `errors.doc.uploadTooLarge` | Arquivo excede o tamanho máximo de 10 MB | File exceeds maximum size of 10 MB |
| `DOC_INVALID_FILE_TYPE` | `errors.doc.invalidFileType` | Tipo de arquivo não permitido. Use PDF, PNG ou JPG | File type not allowed. Use PDF, PNG, or JPG |

### CHAIN — Blockchain

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `CHAIN_TX_FAILED` | `errors.chain.txFailed` | Transação on-chain falhou | On-chain transaction failed |
| `CHAIN_TX_TIMEOUT` | `errors.chain.txTimeout` | Transação on-chain expirou. Será reprocessada automaticamente | On-chain transaction timed out. It will be reprocessed automatically |
| `CHAIN_GAS_ESTIMATION_FAILED` | `errors.chain.gasEstimationFailed` | Falha na estimativa de gas da transação | Transaction gas estimation failed |
| `CHAIN_WALLET_NOT_FOUND` | `errors.chain.walletNotFound` | Carteira administrativa não encontrada para esta empresa | Admin wallet not found for this company |
| `CHAIN_CONTRACT_NOT_DEPLOYED` | `errors.chain.contractNotDeployed` | Contrato inteligente da empresa ainda não foi implantado | Company smart contract has not been deployed yet |
| `CHAIN_NONCE_CONFLICT` | `errors.chain.nonceConflict` | Conflito de nonce na transação. Será reprocessada automaticamente | Transaction nonce conflict. It will be reprocessed automatically |
| `CHAIN_RPC_UNAVAILABLE` | `errors.chain.rpcUnavailable` | Rede blockchain temporariamente indisponível | Blockchain network temporarily unavailable |
| `CHAIN_SYNC_BEHIND` | `errors.chain.syncBehind` | Sincronização blockchain está atrasada | Blockchain sync is behind |
| `CHAIN_REORG_DETECTED` | `errors.chain.reorgDetected` | Reorganização de bloco detectada. Dados sendo reconciliados | Block reorganization detected. Data being reconciled |

### VAL — Validation

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `VAL_INVALID_INPUT` | `errors.val.invalidInput` | Dados de entrada inválidos | Invalid input data |
| `VAL_REQUIRED_FIELD` | `errors.val.requiredField` | Campo obrigatório | Required field |
| `VAL_INVALID_FORMAT` | `errors.val.invalidFormat` | Formato inválido | Invalid format |
| `VAL_OUT_OF_RANGE` | `errors.val.outOfRange` | Valor fora do intervalo permitido | Value out of allowed range |
| `VAL_INVALID_UUID` | `errors.val.invalidUuid` | ID inválido | Invalid ID |
| `VAL_INVALID_ENUM` | `errors.val.invalidEnum` | Valor não é uma opção válida | Value is not a valid option |
| `VAL_INVALID_DATE` | `errors.val.invalidDate` | Data inválida. Use o formato ISO 8601 | Invalid date. Use ISO 8601 format |

### SYS — System

| Code | messageKey | PT-BR | EN |
|------|-----------|-------|-----|
| `SYS_INTERNAL_ERROR` | `errors.sys.internalError` | Erro interno do servidor. Tente novamente mais tarde | Internal server error. Please try again later |
| `SYS_DATABASE_ERROR` | `errors.sys.databaseError` | Erro no banco de dados. Tente novamente mais tarde | Database error. Please try again later |
| `SYS_RATE_LIMITED` | `errors.sys.rateLimited` | Limite de requisições excedido. Tente novamente em breve | Request limit exceeded. Please try again shortly |
| `SYS_EXTERNAL_SERVICE_ERROR` | `errors.sys.externalServiceError` | Serviço externo temporariamente indisponível | External service temporarily unavailable |
| `SYS_MAINTENANCE` | `errors.sys.maintenance` | Sistema em manutenção. Voltaremos em breve | System under maintenance. We'll be back shortly |

---

## Retry Strategies by Service

### Privy (Authentication & Wallets)

| Aspect | Configuration |
|--------|--------------|
| Timeout | 10 seconds |
| Retries | 3 attempts |
| Backoff | Exponential: 1s, 2s, 4s |
| Retry on | Network errors, 502, 503, 504 |
| Do not retry | 400, 401, 403, 404, 422 |
| Circuit breaker | Open after 5 consecutive failures, half-open after 30s |
| Fallback | Return `AUTH_PRIVY_UNAVAILABLE` (502). No local fallback — auth is blocked. |

### Verifik (KYC & CNPJ Validation)

| Aspect | Configuration |
|--------|--------------|
| Timeout | 30 seconds |
| Retries | 3 attempts (via Bull job) |
| Backoff | Exponential: 30s, 60s, 120s |
| Retry on | Network errors, 502, 503, 504, timeouts |
| Do not retry | 400, 404 (CPF/CNPJ not found is a definitive result) |
| Circuit breaker | Open after 5 consecutive failures, half-open after 60s |
| Fallback | Company remains in DRAFT. User notified to retry later. Admin alerted. |

### Base Network RPC (Blockchain)

| Aspect | Configuration |
|--------|--------------|
| Timeout | 30 seconds per call |
| Transaction timeout | 5 minutes (waiting for mining) |
| Retries | 5 attempts |
| Backoff | Exponential: 2s, 4s, 8s, 16s, 32s |
| Retry on | Network errors, timeouts, nonce conflicts |
| Do not retry | Transaction revert (on-chain failure is definitive) |
| Nonce management | Sequential queue via Bull. On nonce conflict, re-fetch nonce and retry. |
| Fallback | Queue transaction for later. Alert admin if queue grows > 50 pending. |

### AWS S3 (Document Storage)

| Aspect | Configuration |
|--------|--------------|
| Timeout | 30 seconds |
| Retries | 3 attempts (AWS SDK built-in) |
| Backoff | Exponential (AWS SDK default) |
| Retry on | Network errors, 500, 503 |
| Do not retry | 400, 403, 404 |
| Fallback | Return `SYS_EXTERNAL_SERVICE_ERROR` (502). Alert admin. |

### AWS SES (Email)

| Aspect | Configuration |
|--------|--------------|
| Timeout | 10 seconds |
| Retries | 5 attempts (via Bull job) |
| Backoff | Fixed delay: 10s between retries |
| Retry on | Network errors, 500, 503, throttling |
| Do not retry | 400 (invalid email address — mark email as invalid) |
| Circuit breaker | Open after 10 consecutive failures, half-open after 60s |
| Fallback | Queue for later delivery. Alert admin if queue > 100 pending. |

### NestJS Implementation — Circuit Breaker

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // ms
}

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject calls immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

@Injectable()
export class CircuitBreakerService {
  private circuits = new Map<string, {
    state: CircuitState;
    failureCount: number;
    lastFailure: number;
    config: CircuitBreakerConfig;
  }>();

  register(name: string, config: CircuitBreakerConfig) {
    this.circuits.set(name, {
      state: CircuitState.CLOSED,
      failureCount: 0,
      lastFailure: 0,
      config,
    });
  }

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.circuits.get(name);
    if (!circuit) throw new Error(`Circuit ${name} not registered`);

    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() - circuit.lastFailure > circuit.config.resetTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
      } else {
        throw new AppException(
          'SYS_EXTERNAL_SERVICE_ERROR',
          'errors.sys.externalServiceError',
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    try {
      const result = await fn();
      circuit.failureCount = 0;
      circuit.state = CircuitState.CLOSED;
      return result;
    } catch (error) {
      circuit.failureCount++;
      circuit.lastFailure = Date.now();
      if (circuit.failureCount >= circuit.config.failureThreshold) {
        circuit.state = CircuitState.OPEN;
      }
      throw error;
    }
  }
}
```

---

## Error Logging and PII Redaction

### What Is Logged

Every error is logged with the following structure:

```typescript
interface ErrorLog {
  timestamp: string;       // ISO 8601
  level: 'error' | 'warn' | 'info';
  requestId: string;       // X-Request-Id
  errorCode: string;       // e.g., "CAP_INSUFFICIENT_SHARES"
  httpStatus: number;
  method: string;          // HTTP method
  path: string;            // Request path
  userId: string | null;   // Authenticated user ID (if available)
  companyId: string | null;
  ip: string;              // Redacted to /24 subnet for LGPD
  userAgent: string;
  duration: number;        // Request duration in ms
  stack?: string;          // Stack trace (5xx only)
  details?: Record<string, unknown>; // Redacted error details
}
```

### PII Redaction Rules

Sensitive data **must** be redacted before logging. The following rules apply:

| Field | Contains PII | Redaction Rule | Example |
|-------|-------------|----------------|---------|
| CPF | Yes | Mask middle digits: `***.***.***-XX` (keep last 2) | `***.***.***-42` |
| CNPJ | Yes | Mask middle digits: `**.***.****/****-XX` (keep last 2) | `**.***.****/****-90` |
| Email | Yes | Mask local part: `n***@domain.com` (keep first char) | `n***@gmail.com` |
| Full name | Yes | Mask last name: `Nelson P.` | `Nelson P.` |
| Wallet address | Partial | Truncate: `0x1234...abcd` (first 6 + last 4) | `0x1234...abcd` |
| IP address | Yes | Truncate to /24: `192.168.1.0/24` | `192.168.1.0/24` |
| Phone number | Yes | Mask: `(**) *****-XXXX` (keep last 4) | `(**) *****-1234` |
| Document images | Yes | Never log. Log only document ID. | `doc_id: uuid` |
| Bearer token | Yes | Never log. Log `[REDACTED]`. | `[REDACTED]` |
| Request body passwords | Yes | Never log. Automatically stripped. | — |

### NestJS Implementation — PII Redaction Utility

```typescript
const PII_PATTERNS: Record<string, (value: string) => string> = {
  cpf: (v) => v.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '***.***.***-$4'),
  cnpj: (v) => v.replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/, '**.***.****/$4-$5'),
  email: (v) => {
    const [local, domain] = v.split('@');
    return `${local[0]}***@${domain}`;
  },
  walletAddress: (v) => `${v.slice(0, 6)}...${v.slice(-4)}`,
  ip: (v) => v.replace(/\.\d+$/, '.0/24'),
};

const SENSITIVE_FIELDS = [
  'cpf', 'cnpj', 'email', 'password', 'token', 'accessToken',
  'refreshToken', 'authorization', 'walletAddress', 'phoneNumber',
  'documentUrl', 'selfieUrl',
];

export function redactPii(obj: Record<string, any>): Record<string, any> {
  const redacted = { ...obj };
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f.toLowerCase()))) {
      if (typeof redacted[key] === 'string') {
        const pattern = Object.keys(PII_PATTERNS).find((p) => lowerKey.includes(p));
        redacted[key] = pattern
          ? PII_PATTERNS[pattern](redacted[key])
          : '[REDACTED]';
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactPii(redacted[key]);
    }
  }
  return redacted;
}
```

### What Is NOT Logged

- Full request/response bodies (too large, may contain PII)
- Document file contents
- Raw KYC images or biometric data
- Full bearer tokens or secrets
- Database query parameters containing PII

---

## Sentry Monitoring and Alerting

### Sentry Configuration

```typescript
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event) {
    // Redact PII from Sentry events
    if (event.request?.data) {
      event.request.data = redactPii(event.request.data);
    }
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
```

### Severity Tiers

#### CRITICAL — Immediate Page (PagerDuty / SMS)

Requires immediate human response. System is unusable or data integrity is at risk.

| Condition | Error Codes | Alert Channel |
|-----------|------------|---------------|
| Unhandled 500 errors (>3 in 5 min) | `SYS_INTERNAL_ERROR`, `SYS_DATABASE_ERROR` | PagerDuty |
| Database connection failures | `SYS_DATABASE_ERROR` | PagerDuty |
| Blockchain sync >30 min behind | `CHAIN_SYNC_BEHIND` | PagerDuty |
| Zero successful authentications in 5 min | `AUTH_PRIVY_UNAVAILABLE` | PagerDuty |
| On-chain/off-chain data mismatch | `CAP_RECONCILIATION_FAILED` | PagerDuty |

#### WARNING — Slack Alert

Service degradation or elevated error rate. Investigate within 1 hour.

| Condition | Error Codes | Alert Channel |
|-----------|------------|---------------|
| Privy API errors (>3 in 5 min) | `AUTH_PRIVY_UNAVAILABLE` | Slack #alerts |
| Verifik API errors (>3 in 5 min) | `KYC_VERIFIK_UNAVAILABLE` | Slack #alerts |
| SES delivery failures (>10 in 1 hour) | — | Slack #alerts |
| Error rate >5% of requests | — | Slack #alerts |
| S3 upload failures | `SYS_EXTERNAL_SERVICE_ERROR` | Slack #alerts |
| Bull job queue depth >50 | — | Slack #alerts |
| Blockchain transaction queue >20 pending | — | Slack #alerts |
| Circuit breaker opens for any service | — | Slack #alerts |

#### INFO — Log Only (Sentry Breadcrumbs)

Expected errors. No alert needed. Available in Sentry for investigation.

| Condition | Error Codes |
|-----------|------------|
| 4xx client errors | All `VAL_*`, `AUTH_INVALID_TOKEN`, `*_NOT_FOUND` |
| Validation failures | `VAL_INVALID_INPUT` |
| Rate limit hits | `SYS_RATE_LIMITED` |
| Business rule rejections | `CAP_*`, `TXN_*`, `ROUND_*`, `OPT_*` (422) |
| Duplicate resource conflicts | `*_DUPLICATE`, `*_EXISTS` (409) |

### Sentry Integration in GlobalExceptionFilter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine severity and whether to report to Sentry
    if (exception instanceof AppException) {
      if (exception.statusCode >= 500) {
        Sentry.captureException(exception, {
          level: 'error',
          tags: { errorCode: exception.code },
          extra: redactPii(exception.details || {}),
        });
      }
      // 4xx errors are breadcrumbs only
    } else {
      // Unhandled exceptions are always critical
      Sentry.captureException(exception, { level: 'fatal' });
    }

    // ... format and send response (see api-standards.md)
  }
}
```

---

## Frontend Error Handling

### API Error Class

```typescript
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
    public readonly validationErrors?: Array<{
      field: string;
      message: string;
      messageKey: string;
    }>,
  ) {
    super(messageKey);
    this.name = 'ApiError';
  }

  get isValidation(): boolean {
    return this.code === 'VAL_INVALID_INPUT';
  }

  get isAuth(): boolean {
    return this.statusCode === 401;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get isServerError(): boolean {
    return this.statusCode >= 500;
  }
}
```

### API Client Error Interceptor

Parses the standard error envelope and throws a typed `ApiError`:

```typescript
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const body = await response.json();

  if (!body.success) {
    const err = body.error;
    throw new ApiError(
      err.code,
      err.messageKey,
      response.status,
      err.details,
      err.validationErrors,
    );
  }

  return body.data;
}
```

### 401 Redirect — Session Expiry

When the API returns 401, redirect the user to the login page:

```typescript
import { usePrivy } from '@privy-io/react-auth';

export function useApiClient() {
  const { logout } = usePrivy();
  const router = useRouter();

  const handleError = useCallback((error: ApiError) => {
    if (error.isAuth) {
      logout();
      router.push('/login?expired=true');
    }
  }, [logout, router]);

  return { handleError };
}
```

### React Error Boundary

Catches unhandled rendering errors and shows a fallback UI:

```typescript
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    // Sentry captures this automatically via @sentry/nextjs
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8">
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="text-muted-foreground mt-2">
            Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
          </p>
          <button
            className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Toast Notifications

Display user-facing error messages via a toast system:

```typescript
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export function useErrorToast() {
  const t = useTranslations();

  const showError = useCallback((error: ApiError) => {
    // Try to translate via messageKey, fall back to server message
    const message = t.has(error.messageKey)
      ? t(error.messageKey)
      : error.messageKey;

    if (error.isServerError) {
      toast.error(message, {
        description: t('errors.sys.tryAgainLater'),
        duration: 8000,
      });
    } else if (error.isRateLimited) {
      const retryAfter = error.details?.retryAfter as number;
      toast.warning(message, {
        description: retryAfter
          ? t('errors.sys.retryAfterSeconds', { seconds: retryAfter })
          : undefined,
        duration: 6000,
      });
    } else {
      toast.error(message, { duration: 5000 });
    }
  }, [t]);

  return { showError };
}
```

### TanStack Query Global Error Handler

Centralized error handling for all queries and mutations:

```typescript
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(showError: (e: ApiError) => void, handleAuth: (e: ApiError) => void) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // Don't retry auth, validation, or business logic errors
            if (error.isAuth || error.isValidation || error.statusCode === 422) {
              return false;
            }
            // Retry server errors up to 2 times
            if (error.isServerError) return failureCount < 2;
          }
          return failureCount < 1;
        },
      },
      mutations: {
        onError: (error) => {
          if (error instanceof ApiError) {
            if (error.isAuth) return handleAuth(error);
            if (!error.isValidation) showError(error);
            // Validation errors are handled by the form, not toast
          }
        },
      },
    },
  });
}
```

### Form Validation Error Display

Map server validation errors to React Hook Form field errors:

```typescript
import { UseFormSetError, FieldValues, Path } from 'react-hook-form';

export function applyServerErrors<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
) {
  if (!error.isValidation || !error.validationErrors) return;

  for (const ve of error.validationErrors) {
    setError(ve.field as Path<T>, {
      type: 'server',
      message: ve.message,
    });
  }
}

// Usage in a mutation
const { mutate } = useMutation({
  mutationFn: (data: CreateCompanyDto) =>
    api.post('/api/v1/companies', data),
  onError: (error) => {
    if (error instanceof ApiError && error.isValidation) {
      applyServerErrors(error, form.setError);
    }
  },
});
```

---

## Success Criteria

- [ ] Every error code in the catalog has a corresponding PT-BR and EN translation
- [ ] All external service calls use the defined retry strategy and circuit breaker
- [ ] PII is redacted in all log output (verified by log audit)
- [ ] Sentry receives only 5xx errors and unhandled exceptions at `error`/`fatal` level
- [ ] CRITICAL alerts page within 5 minutes of trigger condition
- [ ] WARNING alerts appear in Slack within 15 minutes
- [ ] Frontend displays translated error messages via `messageKey` lookup
- [ ] 401 responses redirect to login page
- [ ] Form validation errors map to individual field errors
- [ ] Server errors show a toast with retry guidance
- [ ] Rate limit errors show remaining wait time
- [ ] Error boundary catches rendering errors with a fallback UI
