'use client'
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';

const BitcoinConnectButton = dynamic(
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
    // Initialize Bitcoin Connect
    const initBitcoinConnect = async () => {
      const { init, onConnected } = await import('@getalby/bitcoin-connect-react');
      init({
        appName: "Animal Sunset",
      });

      const unsub = onConnected((provider) => {
        onConnect(provider);
      });

      return () => {
        unsub();
      };
    };

    initBitcoinConnect();
  }, [onConnect]);

  if (!isClient) return null;

  return (
    <div className="flex flex-col items-center space-y-4">
      <BitcoinConnectButton />
      <button
        onClick={onDisconnect}
        className="text-sm text-gray-400 hover:text-gray-300"
      >
        Disconnect Wallet
      </button>
    </div>
  );
};
