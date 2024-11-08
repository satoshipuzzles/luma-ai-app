import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pubkey: string;
  onSettingsChange: (settings: UserSettings) => void;
}

export const SettingsModal = ({ isOpen, onClose, pubkey, onSettingsChange }: SettingsModalProps) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem(`settings-${pubkey}`);
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, [pubkey]);

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem(`settings-${pubkey}`, JSON.stringify(newSettings));
    onSettingsChange(newSettings);
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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Public Generations
              <p className="text-xs text-gray-400">
                Make your generations visible in the gallery
              </p>
            </label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.publicGenerations}
                onChange={(e) => handleSettingChange('publicGenerations', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer 
                           peer-checked:after:translate-x-full peer-checked:after:border-white 
                           after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                           after:bg-white after:border-gray-300 after:border after:rounded-full 
                           after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600">
              </div>
            </label>
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
