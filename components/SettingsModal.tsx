import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { CustomButton } from './CustomButton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pubkey: string;
  onSettingsChange: (settings: UserSettings) => void;
}

export const SettingsModal = ({ isOpen, onClose, pubkey, onSettingsChange }: SettingsModalProps) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [newRelay, setNewRelay] = useState('');
  const [bitcoinConnectStatus, setBitcoinConnectStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isTestingRelay, setIsTestingRelay] = useState(false);
  const [customRelayError, setCustomRelayError] = useState('');

  useEffect(() => {
    // Load saved settings
    const savedSettings = localStorage.getItem(`settings-${pubkey}`);
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    // Check Bitcoin Connect status
    if (window.bitcoinConnect) {
      window.bitcoinConnect.isEnabled().then((enabled: boolean) => {
        setBitcoinConnectStatus(enabled ? 'connected' : 'disconnected');
      });
    }
  }, [pubkey]);

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(`settings-${pubkey}`, JSON.stringify(newSettings));
    onSettingsChange(newSettings);
  };

  const testRelay = async (url: string): Promise<boolean> => {
    try {
      const ws = new WebSocket(url);
      
      return new Promise((resolve) => {
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        
        ws.onerror = () => {
          resolve(false);
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);
      });
    } catch {
      return false;
    }
  };

  const handleAddRelay = async () => {
    if (!newRelay) return;
    
    setIsTestingRelay(true);
    setCustomRelayError('');
    
    try {
      new URL(newRelay);
      
      if (!newRelay.startsWith('wss://')) {
        throw new Error('Relay URL must start with wss://');
      }

      // Test relay connection
      const isValid = await testRelay(newRelay);
      
      if (!isValid) {
        throw new Error('Could not connect to relay');
      }

      if (settings.customRelays.includes(newRelay)) {
        throw new Error('Relay already exists');
      }

      const updatedRelays = [...settings.customRelays, newRelay];
      handleSettingChange('customRelays', updatedRelays);
      setNewRelay('');
      
      toast({
        title: "Relay added",
        description: "New relay has been added successfully"
      });
    } catch (error) {
      setCustomRelayError(error instanceof Error ? error.message : 'Invalid relay URL');
      toast({
        variant: "destructive",
        title: "Failed to add relay",
        description: error instanceof Error ? error.message : 'Invalid relay URL'
      });
    } finally {
      setIsTestingRelay(false);
    }
  };

  const handleRemoveRelay = (relay: string) => {
    if (relay === settings.defaultRelay) {
      toast({
        variant: "destructive",
        title: "Cannot remove default relay",
        description: "Please select a different default relay first"
      });
      return;
    }

    const updatedRelays = settings.customRelays.filter(r => r !== relay);
    handleSettingChange('customRelays', updatedRelays);
    
    toast({
      title: "Relay removed",
      description: "Relay has been removed successfully"
    });
  };

  const connectBitcoinConnect = async () => {
    if (!window.bitcoinConnect) {
      toast({
        variant: "destructive",
        title: "Bitcoin Connect not found",
        description: "Please install a Bitcoin Connect compatible wallet"
      });
      return;
    }

    try {
      setBitcoinConnectStatus('connecting');
      const response = await window.bitcoinConnect.enable();
      
      if (response.enabled) {
        handleSettingChange('bitcoinConnectEnabled', true);
        handleSettingChange('bitcoinConnectPubkey', response.pubkey);
        setBitcoinConnectStatus('connected');
        
        toast({
          title: "Connected",
          description: "Bitcoin Connect wallet connected successfully"
        });
      }
    } catch (error) {
      console.error('Bitcoin Connect error:', error);
      setBitcoinConnectStatus('disconnected');
      
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect Bitcoin Connect wallet"
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center sticky top-0 bg-[#1a1a1a] pb-4">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Public Generations Toggle */}
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

          {/* Default Relay Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Default Relay
              <p className="text-xs text-gray-400">
                Your preferred Nostr relay
              </p>
            </label>
            <select
              value={settings.defaultRelay}
              onChange={(e) => handleSettingChange('defaultRelay', e.target.value)}
              className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            >
              <option value="wss://relay.damus.io">Damus</option>
              {settings.customRelays.map((relay) => (
                <option key={relay} value={relay}>{relay}</option>
              ))}
            </select>
          </div>

          {/* Custom Relays */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Custom Relays
              <p className="text-xs text-gray-400">
                Add your own Nostr relays
              </p>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRelay}
                onChange={(e) => {
                  setNewRelay(e.target.value);
                  setCustomRelayError('');
                }}
                placeholder="wss://your-relay.com"
                className="flex-1 bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={handleAddRelay}
                disabled={isTestingRelay || !newRelay}
                className={`bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2`}
              >
                {isTestingRelay ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Plus size={20} />
                )}
              </button>
            </div>
            {customRelayError && (
              <p className="text-xs text-red-400 mt-1">{customRelayError}</p>
            )}
            <div className="space-y-2 mt-2">
              {settings.customRelays.map((relay) => (
                <div key={relay} className="flex items-center justify-between bg-[#2a2a2a] rounded-lg px-3 py-2">
                  <span className="text-sm truncate flex-1 mr-2">{relay}</span>
                  <button
                    onClick={() => handleRemoveRelay(relay)}
                    className="text-red-500 hover:text-red-400 p-1 rounded-lg hover:bg-gray-700"
                    disabled={relay === settings.defaultRelay}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bitcoin Connect */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Bitcoin Connect
              <p className="text-xs text-gray-400">
                Connect your lightning wallet for quick payments
              </p>
            </label>
            <button
              onClick={connectBitcoinConnect}
              disabled={bitcoinConnectStatus === 'connecting'}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                bitcoinConnectStatus === 'connected'
                  ? 'bg-green-600 hover:bg-green-700'
                  : bitcoinConnectStatus === 'connecting'
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {bitcoinConnectStatus === 'connecting' && (
                <Loader2 size={20} className="animate-spin" />
              )}
              {bitcoinConnectStatus === 'connected'
                ? 'Connected'
                : bitcoinConnectStatus === 'connecting'
                ? 'Connecting...'
                : 'Connect Wallet'}
            </button>
          </div>

          {/* Default Zap Amount */}
          {settings.bitcoinConnectEnabled && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Default Zap Amount
                <p className="text-xs text-gray-400">
                  Amount in sats to zap by default
                </p>
              </label>
              <input
                type="number"
                value={settings.defaultZapAmount}
                onChange={(e) => handleSettingChange('defaultZapAmount', parseInt(e.target.value))}
                min="1"
                step="1000"
                className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-800">
          <CustomButton
            onClick={onClose}
            variant="primary"
            className="w-full"
          >
            Save Settings
          </CustomButton>
        </div>
      </div>
    </div>
  );
};
