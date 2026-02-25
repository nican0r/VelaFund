/**
 * Internal DTO for creating notifications programmatically.
 * Not exposed via API — used by NotificationService.create() and Bull queue jobs.
 */
export interface CreateNotificationPayload {
  userId: string;
  notificationType: string;
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  companyId?: string;
  companyName?: string;
}

/**
 * Notification type to preference category mapping.
 * Used to check if a user has the category enabled before creating the notification.
 */
export const NOTIFICATION_TYPE_CATEGORY: Record<string, string> = {
  // Document events
  SIGNATURE_REQUEST: 'documents',
  DOCUMENT_SIGNED: 'documents',
  DOCUMENT_FULLY_SIGNED: 'documents',
  DOCUMENT_DECLINED: 'documents',

  // Transaction events
  SHARES_ISSUED: 'transactions',
  SHARES_TRANSFERRED: 'transactions',
  TRANSACTION_FAILED: 'transactions',

  // Option events
  OPTION_GRANTED: 'options',
  VESTING_MILESTONE: 'options',
  OPTION_EXERCISE_REQUESTED: 'options',
  OPTION_EXERCISE_COMPLETED: 'options',
  OPTIONS_EXPIRING: 'options',

  // Funding round events
  ROUND_INVITATION: 'fundingRounds',
  ROUND_CLOSING_SOON: 'fundingRounds',
  ROUND_CLOSED: 'fundingRounds',

  // Cap table events
  SHAREHOLDER_ADDED: 'transactions',
  SHAREHOLDER_REMOVED: 'transactions',
  DILUTION_EVENT: 'transactions',

  // KYC events — security category (cannot be disabled)
  KYC_COMPLETED: 'security',
  KYC_REJECTED: 'security',
  KYC_RESUBMISSION: 'security',
};

/**
 * Critical notification types that cannot be disabled by user preferences.
 */
export const CRITICAL_NOTIFICATION_TYPES = new Set([
  'KYC_COMPLETED',
  'KYC_REJECTED',
  'KYC_RESUBMISSION',
]);
