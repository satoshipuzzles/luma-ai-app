// components/PaymentModal.tsx
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { X, Copy, Check, RefreshCw, Zap, Wallet } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface PaymentModalProps {
  paymentRequest: string;
  paymentHash: string;
  amount: number;
  onClose: () => void;
  onPaymentStarted: () => void;
  extraInfo?: React.ReactNode;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  paymentRequest,
  paymentHash,
  amount,
  onClose,
  onPaymentStarted,
  extraInfo
}) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [bitcoinConnectAvailable, setBitcoinConnectAvailable] = useState(false);
  const [bitcoinConnectEnabled, setBitcoinConnectEnabled] = useState(false);
  const [bitcoinConnectPaying, setBitcoinConnectPaying] = useState(false);
  
  // Check if Bitcoin Connect is available
  useEffect(() => {
    const checkBitcoinConnect = () => {
      console.log("Checking for Bitcoin Connect...");
      const available = typeof window !== 'undefined' && !!window.bitcoinConnect;
      console.log("Bitcoin Connect available:", available);
      setBitcoinConnectAvailable(available);
      
      // If available, check if already enabled
      if (available && window.bitcoinConnect?.isEnabled) {
        console.log("Bitcoin Connect is already enabled");
        setBitcoinConnectEnabled(true);
      }
    };
    
    checkBitcoinConnect();
    
    // Try checking again after a short delay to allow script to load
    const timeoutId = setTimeout(checkBitcoinConnect, 1000);
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Handle copy invoice
  const handleCopyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(paymentRequest);
      setHasCopied(true);
      toast({
        title: "Copied",
        description: "Invoice copied to clipboard",
      });
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy invoice:', err);
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Please try again",
      });
    }
  };
  
  // Handle Bitcoin Connect
  const handleBitcoinConnect = async () => {
    try {
      console.log("Handling Bitcoin Connect payment");
      if (!bitcoinConnectEnabled) {
        console.log("Enabling Bitcoin Connect...");
        if (!window.bitcoinConnect) {
          console.error("Bitcoin Connect not available");
          toast({
            variant: "destructive",
            title: "Bitcoin Connect",
            description: "Bitcoin Connect not available in your browser"
          });
          return;
        }
        
        try {
          await window.bitcoinConnect.enable();
          const enabled = window.bitcoinConnect.isEnabled;
          console.log("Bitcoin Connect enabled:", enabled);
          setBitcoinConnectEnabled(enabled);
          
          if (!enabled) {
            toast({
              variant: "destructive",
              title: "Bitcoin Connect",
              description: "Failed to enable Bitcoin Connect"
            });
            return;
          }
        } catch (error) {
          console.error("Error enabling Bitcoin Connect:", error);
          toast({
            variant: "destructive",
            title: "Bitcoin Connect",
            description: "Error enabling Bitcoin Connect"
          });
          return;
        }
      }
      
      // Now pay with Bitcoin Connect
      setBitcoinConnectPaying(true);
      console.log("Sending payment with Bitcoin Connect:", paymentRequest);
      
      try {
        // Add another null check here
        if (!window.bitcoinConnect) {
          throw new Error("Bitcoin Connect became unavailable");
        }
        
        const result = await window.bitcoinConnect.sendPayment(paymentRequest);
        console.log("Bitcoin Connect payment result:", result);
        
        if (result && result.preimage) {
          toast({
            title: "Payment sent",
            description: "Your payment is being processed"
          });
          onPaymentStarted();
        } else {
          throw new Error("Invalid payment result");
        }
      } catch (error) {
        console.error('Bitcoin Connect payment error:', error);
        toast({
          variant: "destructive",
          title: "Payment failed",
          description: error instanceof Error ? error.message : "Please try again"
        });
      } finally {
        setBitcoinConnectPaying(false);
      }
    } catch (error) {
      console.error('Bitcoin Connect error:', error);
      toast({
        variant: "destructive",
        title: "Payment error",
        description: error instanceof Error ? error.message : "Please try again"
      });
      setBitcoinConnectPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-sm w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Pay to Generate Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-gray-300">
          Please pay <span className="font-bold text-white">{amount}</span> sats to proceed.
          {extraInfo}
        </p>
        
        <div className="flex justify-center p-4 bg-white rounded-lg">
          <QRCode 
            value={paymentRequest} 
            size={Math.min(window.innerWidth - 80, 256)}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-[#2a2a2a] p-2 rounded-lg">
            <input
              type="text"
              value={paymentRequest}
              readOnly
              className="flex-1 bg-transparent text-sm text-gray-400 overflow-hidden overflow-ellipsis"
            />
            <button
              onClick={handleCopyInvoice}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1"
            >
              {hasCopied ? <Check size={16} /> : <Copy size={16} />}
              {hasCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          
          {/* Bitcoin Connect button - display if available */}
          {bitcoinConnectAvailable && (
            <button
              onClick={handleBitcoinConnect}
              disabled={bitcoinConnectPaying}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {bitcoinConnectPaying ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  <span>{bitcoinConnectEnabled ? 'Pay with Bitcoin Connect' : 'Connect Wallet'}</span>
                </>
              )}
            </button>
          )}
          
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-2">
            <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>Waiting for payment confirmation...</span>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-1">
            If you've already paid but it's not detecting, don't worry!
            <br />We'll verify and credit your account automatically.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PaymentModal;
