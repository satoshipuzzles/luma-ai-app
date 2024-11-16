// components/ShareModal.tsx
import { useState, useEffect } from 'react';
import { X, RefreshCw, MessageCircle, Share2 } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  prompt: string;
  onShare: (type: 'nostr' | 'gallery', content?: string) => Promise<void>;
  isSharing: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  prompt,
  onShare,
  isSharing
}) => {
  const [shareNote, setShareNote] = useState('');
  const [includePrompt, setIncludePrompt] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setShareNote('');
      setIncludePrompt(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-md w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Share Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Share to Nostr */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Share to Nostr</h3>
              <div className="text-sm text-gray-400">Regular Post</div>
            </div>
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg p-3 text-white resize-none border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
              rows={4}
              value={shareNote}
              onChange={(e) => setShareNote(e.target.value)}
              placeholder="Add a note (optional)..."
            />
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includePrompt}
                onChange={(e) => setIncludePrompt(e.target.checked)}
                className="rounded border-gray-700 bg-[#2a2a2a]"
              />
              <span className="text-sm text-gray-300">Include generation prompt</span>
            </label>
            <button
              onClick={() => onShare('nostr', includePrompt ? 
                `${shareNote}\n\nPrompt: ${prompt}\n\n${videoUrl}\n\n#AnimalSunset` : 
                `${shareNote}\n\n${videoUrl}\n\n#AnimalSunset`
              )}
              disabled={isSharing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSharing ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  <span>Sharing...</span>
                </>
              ) : (
                <>
                  <MessageCircle size={16} />
                  <span>Share as Post</span>
                </>
              )}
            </button>
          </div>

          {/* Share to Gallery */}
          <div className="space-y-3 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Share to Gallery</h3>
              <div className="text-sm text-gray-400">Animal Kind</div>
            </div>
            <p className="text-sm text-gray-400">
              Make your generation publicly visible in the Animal Sunset gallery
            </p>
            <button
              onClick={() => onShare('gallery')}
              disabled={isSharing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSharing ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  <span>Publish to Gallery</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
