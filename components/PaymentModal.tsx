// components/PaymentModal.tsx
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { X, Copy, Check, RefreshCw, Zap, Wallet, ExternalLink } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface PaymentModalProps {
  paymentRequest: string;
  paymentHash: string;
  amount: number;
  onClose: () => void;
  onPaymentStarted: () => void;
  pubkey: string;
  extraInfo?: React.ReactNode;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  paymentRequest,
  paymentHash,
  amount,
  onClose,
  onPaymentStarted,
  pubkey,
  extraInfo
}) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [bitcoinConnectAvailable, setBitcoinConnectAvailable] = useState(false);
  const [bitcoinConnectEnabled, setBitcoinConnectEnabled] = useState(false);
  const [bitcoinConnectPaying, setBitcoinConnectPaying] = useState(false);
  const [nwcAvailable, setNwcAvailable] = useState(false);
  const [nwcPaying, setNwcPaying] = useState(false);
  
  // Check for payment options
  useEffect(() => {
    // Check Bitcoin Connect availability
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
    
    // Check for Nostr Wallet Connect string
    const checkNWC = () => {
      if (typeof window === 'undefined') return;
      
      try {
        const savedSettings = localStorage.getItem(`settings-${pubkey}`);
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.nostrWalletConnect) {
            console.log("NWC available");
            setNwcAvailable(true);
          }
        }
      } catch (error) {
        console.error('Error checking NWC:', error);
      }
    };
    
    checkBitcoinConnect();
    checkNWC();
    
    // Try checking again after a short delay to allow script to load
    const timeoutId = setTimeout(checkBitcoinConnect, 1000);
    return () => clearTimeout(timeoutId);
  }, [pubkey]);
  
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
  
  // Handle NWC Payment
  const handleNWCPayment = async () => {
    try {
      setNwcPaying(true);
      
      // Get the NWC string from settings
      const savedSettings = localStorage.getItem(`settings-${pubkey}`);
      if (!savedSettings) {
        throw new Error("No wallet settings found");
      }
      
      const settings = JSON.parse(savedSettings);
      const nwcString = settings.nostrWalletConnect;
      
      if (!nwcString) {
        throw new Error("Nostr Wallet Connect not configured");
      }
      
      // Create a deep link to open the NWC wallet with the payment request
      // Format: [nwc_string]?pr=[payment_request]
      const paymentUrl = `${nwcString}?pr=${encodeURIComponent(paymentRequest)}`;
      
      // Open in a new window
      window.open(paymentUrl, '_blank');
      
      toast({
        title: "Wallet opened",
        description: "Complete the payment in your wallet"
      });
      
      // We can't know for sure if the payment was successful from here
      // The user will need to confirm it manually or we can poll the payment status
      toast({
        title: "Payment status",
        description: "Click 'Payment Complete' once you've paid"
      });
      
      // In a real implementation, we would poll the payment status here
      
    } catch (error) {
      console.error('NWC payment error:', error);
      toast({
        variant: "destructive",
        title: "NWC Error",
        description: error instanceof Error ? error.message : "Please try again"
      });
    } finally {
      setNwcPaying(false);
    }
  };
  
  // For NWC: User manually confirms payment
  const handleManualPaymentConfirmation = () => {
    toast({
      title: "Payment confirmed",
      description: "Verifying your payment..."
    });
    onPaymentStarted();
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

        <div className="space-y-3">
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
          
          {/* Payment options */}
          <div className="flex flex-col space-y-2">
            {/* Bitcoin Connect - Show if available */}
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
                    <span>{bitcoinConnectEnabled ? 'Pay with Browser Wallet' : 'Connect Browser Wallet'}</span>
                  </>
                )}
              </button>
            )}
            
            {/* Nostr Wallet Connect - Show if available */}
            {nwcAvailable && (
              <button
                onClick={handleNWCPayment}
                disabled={nwcPaying}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {nwcPaying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Opening Wallet...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>Pay with Nostr Wallet</span>
                  </>
                )}
              </button>
            )}
            
            {/* External wallets */}
            <button
              onClick={() => {
                // Open BOLT11 in default Lightning wallet
                window.open(`lightning:${paymentRequest}`, '_blank');
              }}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink size={16} />
              <span>Open in Lightning Wallet</span>
            </button>
            
            {/* Confirmation button for NWC and external wallets */}
            <button
              onClick={handleManualPaymentConfirmation}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors mt-2"
            >
              <span>Payment Complete</span>
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-2">
            <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>Waiting for payment confirmation...</span>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-1">
            If you've already paid but it's not detecting, click "Payment Complete".
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
