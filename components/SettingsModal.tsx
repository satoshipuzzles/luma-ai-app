// components/SettingsModal.tsx

import { FC, useState } from 'react';
import { X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pubkey: string;
  onSettingsChange: (settings: any) => void; // Replace 'any' with your actual settings type
}

const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, pubkey, onSettingsChange }) => {
  if (!isOpen) return null;

  const [publicGenerations, setPublicGenerations] = useState<boolean>(true); // Example setting

  const handleSave = () => {
    onSettingsChange({ publicGenerations });
    onClose();
    // Optionally, persist settings to backend or local storage
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
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

        {/* Example Setting: Public Generations */}
        <div>
          <label className="block text-sm font-medium text-gray-300">Public Generations</label>
          <input
            type="checkbox"
            checked={publicGenerations}
            onChange={(e) => setPublicGenerations(e.target.checked)}
            className="mt-2"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
