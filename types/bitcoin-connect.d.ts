// types/bitcoin-connect.d.ts
interface BitcoinConnectProvider {
  enable(): Promise<{
    enabled: boolean;
    pubkey: string;
    signature?: string;
  }>;
  isEnabled(): Promise<boolean>;
  makePayment(invoice: string, amount: number): Promise<void>;
  signMessage(message: string): Promise<string>;
}

declare global {
  interface Window {
    bitcoinConnect?: BitcoinConnectProvider;
  }
}

export interface BitcoinInvoice {
  paymentRequest: string;
  paymentHash: string;
  amount: number;
  description?: string;
  expiresAt: number;
}

export interface BitcoinPaymentResponse {
  preimage: string;
  paymentHash: string;
  amount: number;
  timestamp: number;
}

export interface BitcoinZapRequest {
  recipientPubkey: string;
  amount: number;
  comment?: string;
  eventId?: string;
}

export interface BitcoinZapResponse {
  success: boolean;
  error?: string;
  preimage?: string;
  paymentHash?: string;
}
