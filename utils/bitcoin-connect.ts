// utils/bitcoin-connect.ts
export interface BitcoinConnectProvider {
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

declare global {
  interface Window {
    // Bitcoin Connect interface
    bitcoinConnect?: BitcoinConnectProvider;
  }
}

// Check if Bitcoin Connect is available
export const isBitcoinConnectAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.bitcoinConnect;
};

// Enable Bitcoin Connect
export const enableBitcoinConnect = async (): Promise<boolean> => {
  if (!isBitcoinConnectAvailable()) return false;
  
  try {
    await window.bitcoinConnect!.enable();
    return window.bitcoinConnect!.isEnabled;
  } catch (error) {
    console.error('Error enabling Bitcoin Connect:', error);
    return false;
  }
};

// Get Bitcoin Connect info
export const getBitcoinConnectInfo = async (): Promise<{
  network: string;
  address: string;
} | null> => {
  if (!isBitcoinConnectAvailable() || !window.bitcoinConnect!.isEnabled) return null;
  
  try {
    return await window.bitcoinConnect!.getInfo();
  } catch (error) {
    console.error('Error getting Bitcoin Connect info:', error);
    return null;
  }
};

// Pay invoice with Bitcoin Connect
export const payWithBitcoinConnect = async (invoice: string): Promise<{
  success: boolean;
  preimage?: string;
  paymentHash?: string;
  error?: string;
}> => {
  if (!isBitcoinConnectAvailable() || !window.bitcoinConnect!.isEnabled) {
    return {
      success: false,
      error: 'Bitcoin Connect not available or not enabled'
    };
  }
  
  try {
    const result = await window.bitcoinConnect!.sendPayment(invoice);
    return {
      success: true,
      preimage: result.preimage,
      paymentHash: result.paymentHash
    };
  } catch (error) {
    console.error('Error paying with Bitcoin Connect:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
