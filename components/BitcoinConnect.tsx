'use client'
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';

const Button = dynamic(
  () => import('@getalby/bitcoin-connect-react').then((mod) => mod.Button),
  { ssr: false }
);

interface BitcoinConnectProps {
  onConnect: (provider: any) => void;
  onDisconnect: () => void;
}

export const BitcoinPayment = ({ onConnect, onDisconnect }: BitcoinConnectProps) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <div className="flex flex-col items-center space-y-4">
      <Button onConnect={provider => {
        onConnect(provider);
        (window as any).webln = provider;
      }} />
      <button
        onClick={onDisconnect}
        className="text-sm text-gray-400 hover:text-gray-300"
      >
        Disconnect Wallet
      </button>
    </div>
  );
};
