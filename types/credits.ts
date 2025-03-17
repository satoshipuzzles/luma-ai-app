// types/credits.ts
export interface UserCredit {
  pubkey: string;
  credits: number;
  lastUpdated: string;
  // Added for tamper protection
  creditHistory: CreditTransaction[];
  securityHash: string;
}

export interface CreditTransaction {
  id: string;
  timestamp: string;
  amount: number;
  type: 'add' | 'use' | 'refund';
  reason: string;
  paymentHash?: string;
  generationId?: string;
}
