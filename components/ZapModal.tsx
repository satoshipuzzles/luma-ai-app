// components/ZapModal.tsx
import { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { X, Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

interface ZapModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: string;
  amount: number;
  recipientName?: string;
  onPaymentConfirmed: () => void;
}

const ZapModal = ({
  isOpen,
  onClose,
  invoice,
  amount,
  recipientName,
  onPaymentConfirmed
}: ZapModalProps) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      const checkPayment = async () => {
        try {
          const response = await fetch('/api/lightning/check-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice })
          });

          if (response.ok) {
            const { paid } = await response.json();
            if (paid) {
              setIsPaid(true);
              onPaymentConfirmed();
              onClose();
              toast({
                title: "Zap sent!",
                description: `Successfully sent ${amount} sats to ${recipientName || 'creator'}`
              });
            }
          }
        } catch (error) {
          console.error('Error checking payment:', error);
        }
      };

      const interval = setInterval(checkPayment, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, invoice, amount, recipientName, onPaymentConfirmed, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-sm w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Send Zap</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-gray-300">
          Send {amount} sats to {recipientName || 'creator'}
        </p>

        <div className="flex justify-center p-4 bg-white rounded-lg">
          <QRCode 
            value={invoice} 
            size={Math.min(window.innerWidth - 80, 256)}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-[#2a2a2a] p-2 rounded-lg">
            <input
              type="text"
              value={invoice}
              readOnly
              className="flex-1 bg-transparent text-sm text-gray-400 overflow-hidden overflow-ellipsis"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(invoice);
                setHasCopied(true);
                setTimeout(() => setHasCopied(false), 2000);
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1"
            >
              {hasCopied ? (
                <>
                  <Check size={16} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          
          {!isPaid && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full"></div>
              <RefreshCw className="animate-spin h-4 w-4" />
              <span>Waiting for payment...</span>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ZapModal;
