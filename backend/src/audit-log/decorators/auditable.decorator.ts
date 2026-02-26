import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableOptions {
  /** Event type code (e.g., "SHAREHOLDER_CREATED") */
  action: string;
  /** Entity type affected (e.g., "Shareholder") */
  resourceType: string;
  /** URL param name for resource ID (e.g., "id", "shareholderId") */
  resourceIdParam?: string;
  /** Fetch entity state before update/delete — service sets request['auditBeforeState'] */
  captureBeforeState?: boolean;
  /** Include response data in "after" snapshot */
  captureAfterState?: boolean;
}

export const Auditable = (options: AuditableOptions) => SetMetadata(AUDITABLE_KEY, options);
