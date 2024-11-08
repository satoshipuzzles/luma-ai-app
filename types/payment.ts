export interface PaymentProvider {
  enable: () => Promise<void>;
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
}

export interface PaymentStatus {
  paid: boolean;
  preimage?: string;
  error?: string;
}
