import { BitcoinConnect as AlbyConnect, useBitcoinConnect } from "@getalby/bitcoin-connect-react";
import { useEffect } from "react";

interface BitcoinConnectProps {
  onConnect: (provider: any) => void;
  onDisconnect: () => void;
}

export const BitcoinPayment = ({ onConnect, onDisconnect }: BitcoinConnectProps) => {
  const { provider, connected } = useBitcoinConnect();

  useEffect(() => {
    if (connected && provider) {
      onConnect(provider);
    }
  }, [connected, provider, onConnect]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <AlbyConnect />
      {connected && (
        <button
          onClick={onDisconnect}
          className="text-sm text-gray-400 hover:text-gray-300"
        >
          Disconnect Wallet
        </button>
      )}
    </div>
  );
};
