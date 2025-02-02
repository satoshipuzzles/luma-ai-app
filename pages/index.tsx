import { useState, useEffect } from 'react';
import Head from 'next/head';
import QRCode from 'qrcode.react';
import { relayInit, getEventHash, Event } from 'nostr-tools';
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
  AlertCircle 
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { 
  isPromptSafe, 
  getPromptFeedback 
} from '../lib/profanity';
import { Navigation } from '../components/Navigation';
import { SettingsModal } from '../components/SettingsModal';
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';

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

/*interface NostrWindow extends Window {
  nostr?: {
    getPublicKey(): Promise<string>;
    signEvent(event: any): Promise<any>;
  };
}

declare global {
  interface Window extends NostrWindow {}
}
*/

// Constants
const LIGHTNING_INVOICE_AMOUNT = 1000; // sats
const INVOICE_EXPIRY = 600000; // 10 minutes in milliseconds
const GENERATION_POLL_INTERVAL = 2000; // 2 seconds
const DEFAULT_RELAY_URLS = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'];
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
      title: "Download failed",
      description: "Please try again",
      variant: "destructive"
    });
  }
};

const publishToNostr = async (
  videoUrl: string, 
  prompt: string, 
  isPublic: boolean,
  eventId: string,
  pubkey: string
): Promise<void> => {
  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  try {
    // Animal Kind Event (75757)
    const animalEvent: Partial<Event> = {
      kind: 75757,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['title', prompt],
        ['r', videoUrl],
        ['type', 'animal-sunset']
      ],
      content: videoUrl,
    };

    animalEvent.id = getEventHash(animalEvent as Event);
    const signedAnimalEvent = await window.nostr.signEvent(animalEvent as Event);

    // History Event (8008135)
    const historyEvent: Partial<Event> = {
      kind: 8008135,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['text-to-speech', prompt],
        ['r', videoUrl],
        ['e', signedAnimalEvent.id],
        ['public', isPublic.toString()]
      ],
      content: JSON.stringify({
        prompt,
        videoUrl,
        createdAt: new Date().toISOString(),
        state: 'completed',
        public: isPublic
      }),
    };

    historyEvent.id = getEventHash(historyEvent as Event);
    const signedHistoryEvent = await window.nostr.signEvent(historyEvent as Event);

    const relayConnections = DEFAULT_RELAY_URLS.map((url) => relayInit(url));

    await Promise.all(
      relayConnections.map((relay) => {
        return new Promise<void>((resolve, reject) => {
          relay.on('connect', async () => {
            try {
              await relay.publish(signedAnimalEvent);
              await relay.publish(signedHistoryEvent);
              resolve();
            } catch (error) {
              reject(error);
            }
          });

          relay.on('error', () => {
            reject(new Error(`Failed to connect to relay ${relay.url}`));
          });

          relay.connect();
        });
      })
    );

    relayConnections.forEach(relay => relay.close());

    toast({
      title: "Published to Nostr",
      description: "Your video has been shared successfully",
      duration: 2000
    });
  } catch (err) {
    console.error('Error publishing to Nostr:', err);
    throw err;
  }
};
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
  const [showNostrModal, setShowNostrModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Effects
  useEffect(() => {
    if (pubkey) {
      const stored = getGenerations().filter((g) => g.pubkey === pubkey);
      setGenerations(stored);
      if (stored.length > 0) {
        setSelectedGeneration(stored[0]);
      }
      const savedSettings = localStorage.getItem(`settings-${pubkey}`);
      if (savedSettings) {
        setUserSettings(JSON.parse(savedSettings));
      }
    }
  }, [pubkey]);

  useEffect(() => {
    if (selectedGeneration && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [selectedGeneration]);

  useEffect(() => {
    const loadProfile = async () => {
      if (pubkey) {
        try {
          const response = await fetch(`/api/nostr/profile?pubkey=${pubkey}`);
          if (response.ok) {
            const profileData = await response.json();
            setProfile(profileData);
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      }
    };

    loadProfile();
  }, [pubkey]);
  // Core Functions
  const connectNostr = async () => {
    try {
      const key = await getNostrPublicKey();
      setPubkey(key);
      toast({
        title: "Connected",
        description: "Successfully connected to Nostr",
      });
    } catch (err) {
      setError('Failed to connect Nostr. Please install a NIP-07 extension like Alby.');
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "Please install a Nostr extension",
      });
    }
  };
const handleImageUpload = async (file: File) => {
  try {
    setUploadingImage(true);
    setError('');
    
    if (!pubkey) {
      throw new Error('Not connected to Nostr');
    }

    // Create and sign the event
    const event: Partial<Event> = {
      kind: 27235, // Nostr.build specific kind
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [['u', URL.createObjectURL(file)]],
      pubkey
    };

    const hashedEvent = getEventHash(event as Event);
    const signedEvent = await window.nostr.signEvent({
      ...event,
      id: hashedEvent
    } as Event);

    // Create form data with both file and signed event
    const formData = new FormData();
    formData.append('file', file);
    formData.append('event', JSON.stringify(signedEvent));

    // Upload to nostr.build
    const response = await fetch('https://nostr.build/api/v2/upload/files', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed: ' + await response.text());
    }

    const result = await response.json();
    
    if (result.status === 'success') {
      setStartImageUrl(result.data[0].url);
      toast({
        title: "Image uploaded",
        description: "Start image has been set"
      });
      return result.data[0].url;
    } else {
      throw new Error(result.message || 'Upload failed');
    }
  } catch (err) {
    console.error('Failed to upload image:', err);
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
  const handleCopyInvoice = async () => {
    if (paymentRequest) {
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
    }
  };

  const copyVideoUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied",
        description: "Video URL copied to clipboard",
        duration: 2000
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Please try again",
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
          setGenerations((prevGenerations) => {
            const updatedGenerations = prevGenerations.map((g) =>
              g.id === generationId 
                ? { ...g, state: 'completed', videoUrl: data.assets.video, createdAt: data.created_at }
                : g
                );

            localStorage.setItem('generations', JSON.stringify(updatedGenerations));
            return updatedGenerations;
          });

          setSelectedGeneration((prevSelected) => {
            if (prevSelected?.id === generationId) {
              return {
                ...prevSelected,
                state: 'completed',
                videoUrl: data.assets.video,
                createdAt: data.created_at,
              };
            }
            return prevSelected;
          });

          // Publish to Nostr when video is ready
          if (userSettings.publicGenerations) {
            try {
              await publishToNostr(
                data.assets.video,
                prompt,
                userSettings.publicGenerations,
                generationId,
                pubkey!
              );
            } catch (error) {
              console.error('Failed to publish to Nostr:', error);
              toast({
                variant: "destructive",
                title: "Publishing failed",
                description: "Failed to share to Nostr",
              });
            }
          }

          setLoading(false);
          return true;
        }

        // Update generation state
        setGenerations((prevGenerations) => {
          const updatedGenerations = prevGenerations.map((g) =>
            g.id === generationId ? { ...g, state: data.state, createdAt: data.created_at } : g
          );
          return updatedGenerations;
        });

        setSelectedGeneration((prevSelected) => {
          if (prevSelected?.id === generationId) {
            return {
              ...prevSelected,
              state: data.state,
              createdAt: data.created_at,
            };
          }
          return prevSelected;
        });

        return false;
      } catch (err) {
        console.error('Status check error:', err);
        return true;
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
        description: getPromptFeedback(prompt),
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create Lightning invoice
      const invoiceResponse = await fetch('/api/create-lnbits-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: LIGHTNING_INVOICE_AMOUNT }),
      });

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json();
        throw new Error(errorData.error || 'Failed to create invoice');
      }

      const invoiceData = await invoiceResponse.json();
      const { payment_request, payment_hash } = invoiceData;

      setPaymentRequest(payment_request);
      setPaymentHash(payment_hash);

      const paymentConfirmed = await waitForPayment(payment_hash);
      if (!paymentConfirmed) {
        setLoading(false);
        return;
      }

      setPaymentRequest(null);
      setPaymentHash(null);

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
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate video');
      }

      const data = await response.json();

      if (!data.id) {
        throw new Error('Invalid response from server');
      }

      const newGeneration: StoredGeneration = {
        id: data.id,
        prompt,
        state: data.state || 'queued',
        createdAt: data.created_at || new Date().toISOString(),
        pubkey,
        videoUrl: data.assets?.video,
      };

      saveGeneration(newGeneration);
      setGenerations((prev) => [newGeneration, ...prev]);
      setSelectedGeneration(newGeneration);
      setPrompt('');
      pollForCompletion(data.id);

      toast({
        title: "Generation started",
        description: "Your video is being generated",
      });
    } catch (err) {
      console.error('Generation error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate video. Please try again.'
      );
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Please try again",
      });
      setLoading(false);
    }
  };
  // Render
  if (!pubkey) {
    return (
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
    );
  }

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

      {/* Mobile Header */}
      <div className="md:hidden bg-[#1a1a1a] p-4 flex items-center justify-between border-b border-gray-800">
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

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-64px)] md:h-screen relative">
        {/* Sidebar */}
        <div 
          className={`
            fixed md:relative z-30 w-64 h-full bg-[#1a1a1a] border-r border-gray-800
            transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-6 space-y-4 h-full overflow-y-auto">
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">No generations yet.</p>
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
          <div className="flex-1 overflow-auto p-4">
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
                            onClick={() => copyVideoUrl(selectedGeneration.videoUrl!)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
                          >
                            <Copy size={16} />
                            <span>Copy URL</span>
                          </button>
                          <button
                            onClick={() => downloadVideo(selectedGeneration.videoUrl!, `animal-sunset-${selectedGeneration.id}.mp4`)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
                          >
                            <Download size={16} />
                            <span>Download</span>
                          </button>
                          <button
                            onClick={() => {
                              setNoteContent(
                                `${selectedGeneration.prompt}\n\n${selectedGeneration.videoUrl}`
                              );
                              setShowNostrModal(true);
                            }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 min-w-[120px]"
                          >
                            <Share2 size={16} />
                            <span>Share</span>
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
                                    className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600"
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
            <p className="text-sm text-gray-300">Please pay 1000 sats to proceed.</p>
            
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
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full"></div>
                Waiting for payment confirmation...
              </div>
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

      {/* Nostr Note Modal */}
      {showNostrModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-md w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Share on Nostr</h2>
              <button
                onClick={() => setShowNostrModal(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition duration-200"
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note..."
            />
            {publishError && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                {publishError}
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-2">
              <button
                onClick={() => setShowNostrModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedGeneration?.videoUrl) {
                    publishToNostr(
                      selectedGeneration.videoUrl,
                      selectedGeneration.prompt,
                      userSettings.publicGenerations,
                      selectedGeneration.id,
                      pubkey!
                    ).then(() => {
                      setShowNostrModal(false);
                      setNoteContent('');
                    }).catch((error) => {
                      setPublishError(error.message);
                    });
                  }
                }}
                disabled={publishing || !selectedGeneration?.videoUrl}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
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
