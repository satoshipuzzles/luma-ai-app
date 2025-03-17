// components/SettingsModal.tsx
import { useState, useEffect } from 'react';
import { X, Zap, Wallet } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pubkey: string;
  onSettingsChange: (settings: UserSettings) => void;
}

export const SettingsModal = ({ isOpen, onClose, pubkey, onSettingsChange }: SettingsModalProps) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [bitcoinConnectAvailable, setBitcoinConnectAvailable] = useState(false);
  const [bitcoinConnectEnabled, setBitcoinConnectEnabled] = useState(false);
  const [isEnablingBitcoinConnect, setIsEnablingBitcoinConnect] = useState(false);
  
  // Check if Bitcoin Connect is available and its status
  useEffect(() => {
    const checkBitcoinConnect = async () => {
      console.log("Checking for Bitcoin Connect...");
      const available = typeof window !== 'undefined' && !!window.bitcoinConnect;
      console.log("Bitcoin Connect available:", available);
      setBitcoinConnectAvailable(available);
      
      if (available && window.bitcoinConnect) {
        const enabled = window.bitcoinConnect.isEnabled;
        setBitcoinConnectEnabled(enabled);
        
        try {
          if (enabled) {
            const info = await window.bitcoinConnect.getInfo();
            console.log('Bitcoin Connect info:', info);
          }
        } catch (error) {
          console.error('Error getting Bitcoin Connect info:', error);
        }
      }
    };
    
    checkBitcoinConnect();
  }, [isOpen]); // Check whenever the modal is opened
  
  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem(`settings-${pubkey}`);
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, [pubkey, isOpen]);

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(`settings-${pubkey}`, JSON.stringify(newSettings));
    onSettingsChange(newSettings);
  };
  
  // Enable Bitcoin Connect
  const enableBitcoinConnect = async () => {
    if (!window.bitcoinConnect) {
      toast({
        variant: "destructive",
        title: "Bitcoin Connect not available",
        description: "Please refresh the page or try a different browser"
      });
      return;
    }
    
    setIsEnablingBitcoinConnect(true);
    
    try {
      await window.bitcoinConnect.enable();
      const enabled = window.bitcoinConnect.isEnabled;
      setBitcoinConnectEnabled(enabled);
      
      if (enabled) {
        toast({
          title: "Bitcoin Connect enabled",
          description: "You can now pay invoices directly with your wallet"
        });
        
        // Try to get wallet info
        try {
          const info = await window.bitcoinConnect.getInfo();
          console.log('Bitcoin Connect info:', info);
          
          handleSettingChange('bitcoinConnectEnabled', true);
        } catch (err) {
          console.error('Error getting Bitcoin Connect info:', err);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Bitcoin Connect failed",
          description: "Could not enable Bitcoin Connect"
        });
      }
    } catch (error) {
      console.error('Error enabling Bitcoin Connect:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enable Bitcoin Connect"
      });
    } finally {
      setIsEnablingBitcoinConnect(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-md w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Public Generations */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Public Generations
              <p className="text-xs text-gray-400">
                Make your generations visible in the gallery
              </p>
            </label>
            <Switch
              checked={settings.publicGenerations}
              onCheckedChange={(checked) => handleSettingChange('publicGenerations', checked)}
            />
          </div>

          {/* Default Relay */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Default Relay
              <p className="text-xs text-gray-400">
                Your preferred Nostr relay
              </p>
            </label>
            <select
              value={settings.defaultRelay}
              onChange={(e) => handleSettingChange('defaultRelay', e.target.value)}
              className="bg-gray-700 rounded-lg px-3 py-1 text-sm"
            >
              <option value="wss://relay.nostrfreaks.com">Nostr Freaks</option>
              <option value="wss://relay.damus.io">Damus</option>
            </select>
          </div>
          
          {/* Bitcoin Connect Section */}
          <div className="mt-6 border-t border-gray-700 pt-6">
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <Wallet className="mr-2 text-yellow-500" size={20} />
              Lightning Wallet Settings
            </h3>
            
            {/* Bitcoin Connect */}
            <div className="mb-4">
              <h4 className="text-md font-medium mb-2">Bitcoin Connect</h4>
              <div className="flex flex-col space-y-3">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm">
                      {bitcoinConnectEnabled ? 
                        "Bitcoin Connect is enabled and ready to use" : 
                        "Enable Bitcoin Connect for easy Lightning payments"}
                    </p>
                  </div>
                  
                  <button
                    onClick={enableBitcoinConnect}
                    disabled={bitcoinConnectEnabled || isEnablingBitcoinConnect}
                    className={`ml-4 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center ${
                      bitcoinConnectEnabled 
                        ? 'bg-green-600 text-white cursor-default' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {bitcoinConnectEnabled ? (
                      <>
                        <Zap size={16} className="mr-1.5" />
                        Connected
                      </>
                    ) : isEnablingBitcoinConnect ? (
                      "Connecting..."
                    ) : (
                      "Connect"
                    )}
                  </button>
                </div>
                
                {bitcoinConnectEnabled ? (
                  <div className="text-xs text-gray-400 rounded-lg bg-gray-800 p-2">
                    Your Bitcoin Connect wallet is connected and will appear as a payment option.
                  </div>
                ) : bitcoinConnectAvailable ? (
                  <div className="text-xs text-gray-400 rounded-lg bg-gray-800 p-2">
                    Connect your Lightning wallet via Bitcoin Connect for one-click payments.
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 rounded-lg bg-gray-800 p-2">
                    Bitcoin Connect not detected. <a 
                      href="https://getalby.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Install Alby
                    </a> or another compatible wallet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
