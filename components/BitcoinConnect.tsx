'use client'
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

interface BitcoinConnectProps {
  onConnect: (provider: any) => void;
  onDisconnect: () => void;
}

export const BitcoinPayment = ({ onConnect, onDisconnect }: BitcoinConnectProps) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const DynamicButton = dynamic(
    () => import('@getalby/bitcoin-connect-react').then((mod) => {
      const handleConnect = (provider: any) => {
        onConnect(provider);
        (window as any).webln = provider;
      };

      return () => <mod.Button onClick={handleConnect} />;
    }),
    { ssr: false }
  );

  if (!isClient) return null;

  return (
    <div className="flex flex-col items-center space-y-4">
      <DynamicButton />
      <Button
        onClick={onDisconnect}
        variant="ghost"
        className="text-sm text-gray-400 hover:text-gray-300"
      >
        Disconnect Wallet
      </Button>
    </div>
  );
};
