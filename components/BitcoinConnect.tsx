'use client'
import { useState } from 'react';
import { WebLNProviders, requestProvider, launchModal, launchPaymentModal } from '@getalby/bitcoin-connect-react';

interface BitcoinConnectProps {
  onConnect: (provider: WebLNProviders.WebLNProvider) => void;
  onDisconnect: () => void;
  onPaymentConfirmed: () => void;
}

const BitcoinConnect = ({ onConnect, onDisconnect, onPaymentConfirmed }: BitcoinConnectProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      const provider = await requestProvider();
      setIsConnected(true);
      onConnect(provider);
      // Use the provider to interact with the user's lightning wallet
      const { payment_hash } = await provider.sendPayment('lnbc...');
      setPaymentHash(payment_hash);
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
        setPaymentHash(null);
        onPaymentConfirmed();
      },
      onCancelled: () => {
        // Handle cancelled payment
        console.log('Payment cancelled');
        setPaymentHash(null);
      },
    });

    // Implement logic to check if the invoice has been paid
    // and call the `setPaid` function when that happens
    const checkPaymentStatus = async () => {
      try {
        const response = await fetch('/api/check-payment-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentHash }),
        });

        if (response.ok) {
          const { paid } = await response.json();
          if (paid) {
            setPaid({ preimage: 'REPLACE_WITH_ACTUAL_PREIMAGE' });
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };

    // Periodically check the payment status
    const interval = setInterval(checkPaymentStatus, 5000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);
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
