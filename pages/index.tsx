import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import QRCode from 'qrcode.react';
import { Event, getEventHash } from 'nostr-tools';
import { 
  Menu, 
  X, 
  Copy, 
  Check, 
  Settings, 
  Upload, 
  RefreshCw, 
  Download,
  Share2, 
  AlertCircle,
  Send,
  MessageCircle,
  Zap,
  Image,
  ChevronDown
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { 
  isPromptSafe, 
  getPromptFeedback 
} from '../lib/profanity';
import { Navigation } from '../components/Navigation';
import { SettingsModal } from '../components/SettingsModal';
import ShareModal from '../components/ShareModal';
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';
import { createNostrPost, createAnimalKind, publishToRelays } from '../lib/nostr';

// Types
interface StoredGeneration {
  id: string;
  prompt: string;
  videoUrl?: string;
  state: string;
  createdAt: string;
  pubkey: string;
}

interface Profile {
  name?: string;
  picture?: string;
  about?: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  prompt: string;
  onShare: (type: 'nostr' | 'gallery', content?: string) => Promise<void>;
  isSharing: boolean;
}

// Constants
const LIGHTNING_INVOICE_AMOUNT = 1000; // sats
const INVOICE_EXPIRY = 600000; // 10 minutes in milliseconds
const GENERATION_POLL_INTERVAL = 2000; // 2 seconds

// Share Modal Component
const ShareModal: React.FC<ShareModalProps> = ({
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
// Utility Functions
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Just now';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (e) {
    console.error('Date formatting error:', e);
    return 'Just now';
  }
};

const getNostrPublicKey = async () => {
  if (!window.nostr) {
    throw new Error('Nostr extension not found. Please install a NIP-07 browser extension.');
  }
  return await window.nostr.getPublicKey();
};

const saveGeneration = (generation: StoredGeneration) => {
  const generations = getGenerations();
  generations.unshift(generation);
  localStorage.setItem('generations', JSON.stringify(generations));
};

const getGenerations = (): StoredGeneration[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('generations');
  return stored ? JSON.parse(stored) : [];
};

const getStatusMessage = (state: string) => {
  switch (state) {
    case 'queued':
      return 'Preparing to generate your video...';
    case 'dreaming':
      return 'AI is crafting your video...';
    case 'processing':
      return 'Almost there...';
    case 'completed':
      return 'Video ready!';
    case 'failed':
      return 'Generation failed';
    default:
      return 'Processing...';
  }
};

const downloadVideo = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'animal-sunset-video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    
    toast({
      title: "Download started",
      description: "Your video is being downloaded",
      duration: 2000
    });
  } catch (err) {
    console.error('Download failed:', err);
    toast({
      variant: "destructive",
      title: "Download failed",
      description: "Please try again"
    });
  }
};

// Main Component
export default function Home() {
  // State Management
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generations, setGenerations] = useState<StoredGeneration[]>([]);
  const [error, setError] = useState('');
  const [selectedGeneration, setSelectedGeneration] = useState<StoredGeneration | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(true);
  const [startImageUrl, setStartImageUrl] = useState<string | null>(null);
  const [isExtending, setIsExtending] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Effects
  useEffect(() => {
    const connectAndLoadSettings = async () => {
      try {
        if (window.nostr) {
          const key = await getNostrPublicKey();
          setPubkey(key);
          
          const savedSettings = localStorage.getItem(`settings-${key}`);
          if (savedSettings) {
            setUserSettings(JSON.parse(savedSettings));
          }
        }
      } catch (error) {
        console.error('Failed to connect Nostr:', error);
      }
    };

    connectAndLoadSettings();
  }, []);

  useEffect(() => {
    if (pubkey) {
      const stored = getGenerations().filter((g) => g.pubkey === pubkey);
      setGenerations(stored);
      if (stored.length > 0) {
        setSelectedGeneration(stored[0]);
      }
    }
  }, [pubkey]);

  useEffect(() => {
    if (selectedGeneration && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [selectedGeneration]);

  // Core Functions
  const connectNostr = async () => {
    try {
      const key = await getNostrPublicKey();
      setPubkey(key);
      toast({
        title: "Connected",
        description: "Successfully connected to Nostr"
      });
    } catch (err) {
      setError('Failed to connect Nostr. Please install a NIP-07 extension like Alby.');
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "Please install a Nostr extension"
      });
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://nostr.build/api/v2/upload/files', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        setStartImageUrl(result.data[0].url);
        toast({
          title: "Image uploaded",
          description: "Start image has been set"
        });
        return result.data[0].url;
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Please try again"
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleShare = async (type: 'nostr' | 'gallery', content?: string) => {
    if (!selectedGeneration?.videoUrl || !pubkey) return;

    setIsSharing(true);
    try {
      if (type === 'nostr') {
        // Create and share regular Nostr post
        const event = await createNostrPost(
          content || selectedGeneration.videoUrl,
          [['t', 'AnimalSunset']]
        );
        await publishToRelays(event, [userSettings.defaultRelay, ...userSettings.customRelays]);
      } else {
        // Create and share Animal Kind post
        const event = await createAnimalKind(
          pubkey,
          selectedGeneration.videoUrl,
          selectedGeneration.prompt
        );
        await publishToRelays(event, [userSettings.defaultRelay, ...userSettings.customRelays]);
      }

      toast({
        title: type === 'nostr' ? 'Posted to Nostr' : 'Published to Gallery',
        description: 'Your video has been shared successfully'
      });

      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        variant: "destructive",
        title: "Share failed",
        description: error instanceof Error ? error.message : "Failed to share video"
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentRequest || !userSettings.bitcoinConnectEnabled || !window.bitcoinConnect) return;

    try {
      await window.bitcoinConnect.makePayment(paymentRequest, LIGHTNING_INVOICE_AMOUNT);
      setPaymentRequest(null);
      setPaymentHash(null);
      generateVideo();

      toast({
        title: "Payment successful",
        description: "Starting video generation"
      });
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        variant: "destructive",
        title: "Payment failed",
        description: "Please try again"
      });
    }
  };

  const waitForPayment = async (paymentHash: string): Promise<boolean> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < INVOICE_EXPIRY) {
      try {
        const response = await fetch('/api/check-lnbits-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentHash }),
        });

        if (!response.ok) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        const data = await response.json();
        if (data.paid) {
          toast({
            title: "Payment received",
            description: "Starting video generation",
          });
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (err) {
        console.error('Error checking payment status:', err);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    toast({
      variant: "destructive",
      title: "Payment expired",
      description: "Please try again",
    });
    return false;
  };

  const pollForCompletion = async (generationId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/check-status?id=${generationId}`);
        if (!response.ok) {
          throw new Error('Failed to check status');
        }

        const data = await response.json();

        if (data.state === 'completed' && data.assets?.video) {
          // Update generations
          setGenerations((prevGenerations) => {
            const updatedGenerations = prevGenerations.map((g) =>
              g.id === generationId 
                ? { ...g, state: 'completed', videoUrl: data.assets.video }
                : g
            );
            localStorage.setItem('generations', JSON.stringify(updatedGenerations));
            return updatedGenerations;
          });

          // Update selected generation
          setSelectedGeneration((prevSelected) => {
            if (prevSelected?.id === generationId) {
              return {
                ...prevSelected,
                state: 'completed',
                videoUrl: data.assets.video,
              };
            }
            return prevSelected;
          });

          setLoading(false);
          
          toast({
            title: "Generation complete",
            description: "Your video is ready!"
          });
          
          return true;
        }

        // Update generation state
        setGenerations((prevGenerations) => {
          const updatedGenerations = prevGenerations.map((g) =>
            g.id === generationId ? { ...g, state: data.state } : g
          );
          return updatedGenerations;
        });

        setSelectedGeneration((prevSelected) => {
          if (prevSelected?.id === generationId) {
            return {
              ...prevSelected,
              state: data.state,
            };
          }
          return prevSelected;
        });

        return false;
      } catch (err) {
        console.error('Status check error:', err);
        return false;
      }
    };

    const poll = async () => {
      const shouldStop = await checkStatus();
      if (!shouldStop) {
        setTimeout(poll, GENERATION_POLL_INTERVAL);
      }
    };

    poll();
  };

  const generateVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt || !pubkey) return;

    if (!isPromptSafe(prompt)) {
      setError(getPromptFeedback(prompt));
      toast({
        variant: "destructive",
        title: "Invalid prompt",
        description: getPromptFeedback(prompt)
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Handle payment first
      if (!paymentRequest) {
        const paymentResponse = await fetch('/api/lightning/create-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            amount: LIGHTNING_INVOICE_AMOUNT,
            description: `Animal Sunset video generation: ${prompt}`
          }),
        });

        if (!paymentResponse.ok) {
          throw new Error('Failed to create payment request');
        }

        const { payment_request, payment_hash } = await paymentResponse.json();
        
        setPaymentRequest(payment_request);
        setPaymentHash(payment_hash);
        return;
      }

      // Prepare generation request
      const generationBody: any = { 
        prompt,
        loop: isLooping
      };

      if (isExtending && selectedVideoId) {
        generationBody.extend = true;
        generationBody.videoId = selectedVideoId;
      } else if (startImageUrl) {
        generationBody.startImageUrl = startImageUrl;
      }

      // Generate video
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(generationBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate video');
      }

      const data = await response.json();

      const newGeneration: StoredGeneration = {
        id: data.id,
        prompt,
        state: 'queued',
        createdAt: new Date().toISOString(),
        pubkey,
        videoUrl: undefined,
      };

      saveGeneration(newGeneration);
      setGenerations((prev) => [newGeneration, ...prev]);
      setSelectedGeneration(newGeneration);
      setPrompt('');
      pollForCompletion(data.id);

      toast({
        title: "Generation started",
        description: "Your video is being generated"
      });
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate video');
      setLoading(false);
      
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Please try again"
      });
    }
  };
  // Continue from previous code...

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Animal Sunset 🌞🦒</title>
        <link rel="icon" href="https://animalsunset.com/favicon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Animal Sunset 🌞🦒 - AI-powered video generator." />
        <meta property="og:title" content="Animal Sunset 🌞🦒" />
        <meta property="og:description" content="AI-powered video generator." />
        <meta property="og:image" content="https://animalsunset.com/og-image.png" />
        <meta property="og:url" content="https://animalsunset.com" />
        <meta property="og:type" content="website" />
      </Head>

      {/* Connect Nostr Screen */}
      {!pubkey && (
        <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 space-y-6">
            <h1 className="text-3xl font-bold text-center">Animal Sunset 🌞🦒</h1>
            <div className="bg-[#1a1a1a] p-8 rounded-lg shadow-xl space-y-4">
              <p className="text-gray-300 text-center">Connect with Nostr to get started</p>
              <button
                onClick={connectNostr}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                Connect with Nostr
              </button>
              {error && (
                <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main App Layout */}
      {pubkey && (
        <div className="flex h-[calc(100vh-64px)] md:h-screen relative">
          {/* Mobile Header */}
          <div className="md:hidden bg-[#1a1a1a] p-4 flex items-center justify-between border-b border-gray-800 fixed top-0 left-0 right-0 z-30">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-white p-2 hover:bg-gray-700 rounded-lg"
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Navigation />
            {profile && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-gray-700 rounded-lg"
                  aria-label="Settings"
                >
                  <Settings size={20} />
                </button>
                {profile.picture && (
                  <img
                    src={profile.picture}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div 
            className={`
              fixed md:relative z-30 w-64 h-full bg-[#1a1a1a] border-r border-gray-800
              transition-transform duration-300 ease-in-out
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
          >
            <div className="p-6 space-y-4 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <h2 className="text-2xl font-bold hidden md:block">Your Generations</h2>
              {generations.length > 0 ? (
                <ul className="space-y-2">
                  {generations.map((generation) => (
                    <li
                      key={generation.id}
                      className={`p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                        selectedGeneration?.id === generation.id
                          ? 'bg-purple-700'
                          : 'hover:bg-gray-700'
                      }`}
                      onClick={() => setSelectedGeneration(generation)}
                    >
                      <div className="text-sm font-medium">{generation.prompt}</div>
                      <div className="text-xs text-gray-400">
                        {formatDate(generation.createdAt)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {getStatusMessage(generation.state)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No generations yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Start by creating your first video!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Main Content */}
          <div className="flex-1 flex flex-col w-full md:w-auto">
            {/* Desktop Header */}
            <div className="hidden md:flex bg-[#1a1a1a] p-4 items-center justify-between border-b border-gray-800">
              <Navigation />
              {profile && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                    aria-label="Settings"
                  >
                    <Settings size={20} />
                  </button>
                  {profile.picture && (
                    <img
                      src={profile.picture}
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span>{profile.name || 'Anonymous'}</span>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4 mt-16 md:mt-0">
              {selectedGeneration ? (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-[#1a1a1a] rounded-lg p-4 md:p-6 space-y-4">
                    {/* Generation Details */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h2 className="text-lg md:text-xl font-bold break-words">
                          {selectedGeneration.prompt}
                        </h2>
                        <div className="text-sm text-gray-400">
                          {formatDate(selectedGeneration.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedGeneration(null)}
                        className="text-gray-400 hover:text-white p-2"
                        aria-label="Close"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Video Display */}
                    <div className="border-t border-gray-800 pt-4">
                      <div className="text-sm text-gray-300 mb-4">
                        {getStatusMessage(selectedGeneration.state)}
                      </div>

                      {selectedGeneration.videoUrl ? (
                        <div className="space-y-4">
                          <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden">
                            <video
                              key={selectedGeneration.videoUrl}
                              className="absolute top-0 left-0 w-full h-full object-contain"
                              controls
                              autoPlay
                              loop
                              playsInline
                              src={selectedGeneration.videoUrl}
                            />
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setShowShareModal(true)}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
                            >
                              <Share2 size={16} />
                              <span>Share</span>
                            </button>

                            <button
                              onClick={() => {
                                if (selectedGeneration.videoUrl) {
                                  navigator.clipboard.writeText(selectedGeneration.videoUrl);
                                  toast({
                                    title: "Copied",
                                    description: "Video URL copied to clipboard"
                                  });
                                }
                              }}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
                            >
                              <Copy size={16} />
                              <span>Copy Link</span>
                            </button>

                            <button
                              onClick={() => downloadVideo(
                                selectedGeneration.videoUrl!, 
                                `animal-sunset-${selectedGeneration.id}.mp4`
                              )}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
                            >
                              <Download size={16} />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      ) : selectedGeneration.state === 'failed' ? (
                        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
                          Generation failed. Please try again.
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="relative h-48 md:h-64 bg-[#2a2a2a] rounded-lg overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="space-y-4 text-center">
                                <div className="inline-flex items-center space-x-2">
                                  <RefreshCw className="animate-spin h-6 w-6 text-purple-500" />
                                  <span className="text-purple-400 font-medium">
                                    AI is dreaming...
                                  </span>
                                </div>
                                <div className="text-sm text-gray-400">
                                  This usually takes 1-2 minutes
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto">
                  <form
                    onSubmit={generateVideo}
                    className="bg-[#1a1a1a] rounded-lg p-4 md:p-6 space-y-4"
                  >
                    <textarea
                      id="prompt-input"
                      name="prompt"
                      className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition duration-200"
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your video idea..."
                      disabled={loading}
                    />

                    {/* Video Options */}
                    <div className="space-y-4">
                      {/* Loop Toggle */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">Loop Video</label>
                        <Switch
                          checked={isLooping}
                          onCheckedChange={setIsLooping}
                          disabled={loading}
                        />
                      </div>

                      {/* Extend Toggle */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">Extend Previous Video</label>
                        <Switch
                          checked={isExtending}
                          onCheckedChange={(checked) => { 
                            setIsExtending(checked); 
                            if (checked) setStartImageUrl(null);
                          }}
                          disabled={loading}
                        />
                      </div>

                    {/* Conditional Content */}
                      {isExtending ? (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">
                            Select Video to Extend
                          </label>
                          <select
                            className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
                            value={selectedVideoId || ''}
                            onChange={(e) => setSelectedVideoId(e.target.value)}
                            disabled={loading}
                          >
                            <option value="">Select a video...</option>
                            {generations
                              .filter(g => g.state === 'completed')
                              .map((gen) => (
                                <option key={gen.id} value={gen.id}>
                                  {gen.prompt}
                                </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Start Image (Optional)
                          </label>
                          <div className="flex items-center gap-4">
                            <label className="flex-1">
                              <div className={`
                                flex items-center justify-center w-full h-32 
                                border-2 border-dashed border-gray-700 rounded-lg 
                                cursor-pointer hover:border-purple-500
                                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                              `}>
                                {startImageUrl ? (
                                  <div className="relative w-full h-full">
                                    <img
                                      src={startImageUrl}
                                      alt="Start frame"
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setStartImageUrl(null);
                                      }}
                                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <Upload size={24} className="text-gray-500" />
                                    <span className="mt-2 text-sm text-gray-500">
                                      {uploadingImage ? 'Uploading...' : 'Click to upload start image'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file);
                                }}
                                className="hidden"
                                disabled={loading}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading || !prompt || !!paymentRequest || (isExtending && !selectedVideoId)}
                        className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
                      >
                        {loading ? (
                          <span className="flex items-center space-x-2">
                            <RefreshCw className="animate-spin h-5 w-5" />
                            <span>Generating...</span>
                          </span>
                        ) : (
                          'Generate Video'
                        )}
                      </button>
                    </div>

                    {error && (
                      <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                        <p className="font-medium">Error</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        videoUrl={selectedGeneration?.videoUrl || ''}
        prompt={selectedGeneration?.prompt || ''}
        onShare={handleShare}
        isSharing={isSharing}
      />

      {/* Payment Modal */}
      {paymentRequest && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-sm w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Pay to Generate Video</h2>
              <button
                onClick={() => {
                  setPaymentRequest(null);
                  setPaymentHash(null);
                  setLoading(false);
                }}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                {userSettings.bitcoinConnectEnabled ? (
                  'Click below to pay with Bitcoin Connect'
                ) : (
                  'Please pay 1000 sats to proceed'
                )}
              </p>

              {userSettings.bitcoinConnectEnabled ? (
                <button
                  onClick={handlePayment}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                >
                  <Zap size={20} />
                  <span>Pay with Bitcoin Connect</span>
                </button>
              ) : (
                <>
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
                        onClick={() => {
                          navigator.clipboard.writeText(paymentRequest);
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
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                      <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full"></div>
                      Waiting for payment...
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setPaymentRequest(null);
                setPaymentHash(null);
                setLoading(false);
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        pubkey={pubkey}
        onSettingsChange={setUserSettings}
      />
    </div>
  );
}

export default Home;
