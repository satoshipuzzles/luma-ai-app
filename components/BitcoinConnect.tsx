'use client'
import { useState } from 'react';
import { requestProvider, launchModal, launchPaymentModal } from '@getalby/bitcoin-connect-react';

interface BitcoinConnectProps {
  onConnect: (provider: any) => void;
  onDisconnect: () => void;
}

const BitcoinConnect = ({ onConnect, onDisconnect }: BitcoinConnectProps) => {
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    try {
      const provider = await requestProvider();
      setIsConnected(true);
      onConnect(provider);
      // Use the provider to interact with the user's lightning wallet
      await provider.sendPayment('lnbc...');
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      onDisconnect();
    }
  };

  const handleReceivePayment = async () => {
    const { setPaid } = launchPaymentModal({
      invoice: 'lnbc...',
      onPaid: (response) => {
        // Handle successful payment
        console.log('Payment received:', response);
      },
      onCancelled: () => {
        // Handle cancelled payment
        console.log('Payment cancelled');
      },
    });

    // Implement logic to check if the invoice has been paid
    // and call the `setPaid` function when that happens
  };

  return (
    <div>
      {!isConnected ? (
        <button onClick={handleConnect}>Connect Wallet</button>
      ) : (
        <div>
          <button onClick={handleReceivePayment}>Receive Payment</button>
          <button onClick={onDisconnect}>Disconnect Wallet</button>
        </div>
      )}
    </div>
  );
};

export default BitcoinConnect;
