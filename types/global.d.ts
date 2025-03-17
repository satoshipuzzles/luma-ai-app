interface Window {
  nostr?: {
    getPublicKey(): Promise<string>;
    signEvent(event: any): Promise<any>;
    getEventHash?(event: any): string;
  }
  bitcoinConnect?: {
    isEnabled: boolean;
    enable: () => Promise<void>;
    getInfo: () => Promise<{
      network: string;
      address: string;
    }>;
    sendPayment: (invoice: string) => Promise<{
      preimage: string;
      paymentHash: string;
    }>;
  }
}
