export interface KycStatusResponse {
  status: string;
  completedSteps: string[];
  remainingSteps: string[];
  attemptCount: number;
  canResubmit: boolean;
  rejectionReason: string | null;
}
