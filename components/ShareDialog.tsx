// components/ShareDialog.tsx

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { publishVideo, shareToNostr } from '../lib/nostr';
import { toast } from "@/components/ui/use-toast";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  prompt: string;
  isPublic: boolean;
  onShare: () => void; // Added onShare callback
}

export function ShareDialog({ isOpen, onClose, videoUrl, prompt, isPublic, onShare }: ShareDialogProps) {
  const [publishing, setPublishing] = useState(false);
  const [noteContent, setNoteContent] = useState(`${prompt}\n\n${videoUrl}\n#animalsunset`);

  if (!isOpen) return null;

  const handlePublishToGallery = async () => {
    try {
      setPublishing(true);
      await publishVideo(videoUrl, prompt, isPublic);
      toast({
        title: "Published to gallery",
        description: "Your video has been shared successfully",
      });
      onClose();
    } catch (error) {
      console.error('Error publishing to gallery:', error);
      toast({
        variant: "destructive",
        title: "Publishing failed",
        description: "Failed to publish to gallery",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleShareToNostr = async () => {
    try {
      setPublishing(true);
      await shareToNostr(noteContent, videoUrl);
      toast({
        title: "Shared to Nostr",
        description: "Your note has been published successfully",
      });
      onShare(); // Trigger external share logic if needed
      onClose();
    } catch (error) {
      console.error('Error sharing to Nostr:', error);
      toast({
        variant: "destructive",
        title: "Sharing failed",
        description: "Failed to share to Nostr",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Share Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={handlePublishToGallery}
            disabled={publishing}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 
                     disabled:cursor-not-allowed text-white font-semibold py-2 px-4 
                     rounded-lg transition-colors"
          >
            Publish to Gallery
          </button>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Share to Nostr
            </label>
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg p-3 text-white resize-none 
                       border border-gray-700 focus:border-purple-500 focus:ring-2 
                       focus:ring-purple-500"
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note..."
            />
            <button
              onClick={handleShareToNostr}
              disabled={publishing || !noteContent.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                       disabled:cursor-not-allowed text-white font-semibold py-2 px-4 
                       rounded-lg transition-colors"
            >
              Share to Nostr
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
