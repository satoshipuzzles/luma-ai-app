'use client'
import { useEffect, useState } from "react";
import { Button } from '@getalby/bitcoin-connect-react';

interface BitcoinConnectProps {
  onConnect: (provider: any) => void;
  onDisconnect: () => void;
}

export const BitcoinPayment = ({ onConnect, onDisconnect }: BitcoinConnectProps) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleConnect = (provider: any) => {
    onConnect(provider);
    (window as any).webln = provider;
  };

  if (!isClient) return null;

  return (
    <div className="flex flex-col items-center space-y-4">
      <Button onClick={handleConnect} />
      <button
        onClick={onDisconnect}
        className="text-sm text-gray-400 hover:text-gray-300"
      >
        Disconnect Wallet
      </button>
    </div>
  );
};
