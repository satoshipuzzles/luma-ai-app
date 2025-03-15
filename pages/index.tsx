// pages/index.tsx
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
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
  AlertCircle,
  ChevronRight,
  Zap,
  Video,
  CreditCard
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

// Import the new utilities
import { 
  savePendingPayment, 
  getPendingPayments, 
  markPaymentAsVerified,
  getUnverifiedPayments,
  markPaymentAsExpired,
  deletePendingPayment
} from '../utils/payment';
import {
  getUserCredits,
  addUserCredits,
  useCredits,
  refundCredits,
  getCreditHistory
} from '../utils/credits';

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

// Type definitions for resolution and duration
type Resolution = '540p' | '720p' | '1080p' | '4k';
type Duration = '3s' | '5s' | '8s' | '10s';

// Constants
const LIGHTNING_INVOICE_AMOUNT = 1000; // sats
const INVOICE_EXPIRY = 1800000; // 30 minutes in milliseconds (increased from 10 minutes)
const GENERATION_POLL_INTERVAL = 5000; // 5 seconds (increased from 2 seconds)
const PAYMENT_CHECK_INTERVAL = 3000; // 3 seconds
const PAYMENT_MAX_ATTEMPTS = 180; // 180 attempts * 3 seconds = 9 minutes of checking

// Dynamic pricing constants
const PRICING = {
  base: 1000, // 1000 sats for basic generation
  ray2: {
    '540p': {
      '3s': 1000,
      '5s': 1500,
      '8s': 2000,
      '10s': 2500
    },
    '720p': {
      '3s': 1500,
      '5s': 2000,
      '8s': 2500,
      '10s': 3000
    },
    '1080p': {
      '3s': 2000,
      '5s': 2500,
      '8s': 3000,
      '10s': 3500
    },
    '4k': {
      '3s': 3000,
      '5s': 3500,
      '8s': 4000,
      '10s': 5000
    }
  } as Record<Resolution, Record<Duration, number>>
};

// Sample videos for the landing page
const SAMPLE_VIDEOS = [
  {
    url: "https://cdn.animalsunset.com/samples/giraffe-sunset.mp4",
    title: "Giraffe at Sunset",
    description: "A majestic giraffe silhouetted against a vibrant African sunset"
  },
  {
    url: "https://cdn.animalsunset.com/samples/penguin-snow.mp4",
    title: "Penguin Adventure",
    description: "Adorable penguins sliding across Antarctic ice fields"
  },
  {
    url: "https://cdn.animalsunset.com/samples/lion-pride.mp4",
    title: "Lion Pride",
    description: "A powerful lion pride roaming through the savanna"
  }
];

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

// Landing Page Component
const LandingPage = ({ onConnect }: { onConnect: () => void }) => {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    // Initialize video refs
    videoRefs.current = videoRefs.current.slice(0, SAMPLE_VIDEOS.length);
    
    // Auto-play videos in sequence
    const interval = setInterval(() => {
      setActiveVideoIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % SAMPLE_VIDEOS.length;
        // Pause current video and play next
        if (videoRefs.current[prevIndex]) videoRefs.current[prevIndex]!.pause();
        if (videoRefs.current[nextIndex]) {
          videoRefs.current[nextIndex]!.currentTime = 0;
          videoRefs.current[nextIndex]!.play();
        }
        return nextIndex;
      });
    }, 8000);

    // Play the first video
    if (videoRefs.current[0]) {
      videoRefs.current[0].play();
    }

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Animal Sunset 🌞🦒 - AI Video Generation</title>
        <meta name="description" content="Create stunning AI-generated animal videos with Animal Sunset" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Hero Section */}
      <div className="relative h-screen flex items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-[#111111]">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[#111111] opacity-80"></div>
          <video 
            autoPlay 
            muted 
            loop 
            playsInline
            className="absolute w-full h-full object-cover"
            src="https://cdn.animalsunset.com/hero-background.mp4"
          ></video>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-orange-500">
              Animal Sunset 🌞🦒
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Create stunning, lifelike animal videos using AI - powered by Luma AI and the Lightning Network
            </p>
            <button
              onClick={onConnect}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg flex items-center mx-auto"
            >
              <Zap className="mr-2" size={20} />
              Connect with Nostr
            </button>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronRight className="rotate-90 text-purple-500" size={32} />
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-[#0d0d0d]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="bg-[#1a1a1a] p-6 rounded-xl text-center">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video size={24} className="text-purple-300" />
              </div>
              <h3 className="text-xl font-bold mb-4">Describe Your Video</h3>
              <p className="text-gray-400">
                Simply describe the animal video you want to create. Be as creative and detailed as you'd like!
              </p>
            </div>

            <div className="bg-[#1a1a1a] p-6 rounded-xl text-center">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <CreditCard size={24} className="text-purple-300" />
              </div>
              <h3 className="text-xl font-bold mb-4">Pay with Lightning</h3>
              <p className="text-gray-400">
                Quick micropayments using Bitcoin Lightning Network. Just scan a QR code and you're good to go.
              </p>
            </div>

            <div className="bg-[#1a1a1a] p-6 rounded-xl text-center">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Download size={24} className="text-purple-300" />
              </div>
              <h3 className="text-xl font-bold mb-4">Get Your Video</h3>
              <p className="text-gray-400">
                In just minutes, download your high-quality AI-generated video and share it across the Nostr network.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Examples Section */}
      <div className="py-20 bg-[#111111]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Example Videos</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden">
              {SAMPLE_VIDEOS.map((video, index) => (
                <video
                  key={index}
                  ref={el => videoRefs.current[index] = el}
                  src={video.url}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                    index === activeVideoIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                  muted
                  playsInline
                  loop
                />
              ))}
            </div>

            <div className="flex flex-col justify-center">
              <h3 className="text-2xl font-bold mb-4 text-purple-400">
                {SAMPLE_VIDEOS[activeVideoIndex].title}
              </h3>
              <p className="text-gray-300 mb-6">
                {SAMPLE_VIDEOS[activeVideoIndex].description}
              </p>
              <div className="flex space-x-2">
                {SAMPLE_VIDEOS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveVideoIndex(index);
                      videoRefs.current.forEach((video, i) => {
                        if (i === index) {
                          if (video) {
                            video.currentTime = 0;
                            video.play();
                          }
                        } else {
                          if (videoRefs.current[i]) videoRefs.current[i]!.pause();
                        }
                      });
                    }}
                    className={`w-3 h-3 rounded-full ${
                      index === activeVideoIndex ? 'bg-purple-500' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-20 bg-[#0d0d0d]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">Simple Pricing</h2>
          <p className="text-xl text-center text-gray-400 mb-16 max-w-3xl mx-auto">
            Pay only for what you generate, with Bitcoin Lightning Network
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-[#1a1a1a] rounded-xl p-8 border border-gray-800 hover:border-purple-600 transition-colors">
              <h3 className="text-xl font-bold mb-2">Basic</h3>
              <div className="text-3xl font-bold text-purple-400 mb-6">1,000 sats</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>HD video generation</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>Basic customization</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>3-5 second duration</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-8 border-2 border-purple-600 relative transform md:scale-110 md:-translate-y-4 z-10 shadow-xl">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white py-1 px-4 rounded-full text-sm font-bold">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Premium</h3>
              <div className="text-3xl font-bold text-purple-400 mb-6">2,000 sats</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>Full HD 1080p quality</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>Advanced settings</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>5-8 second duration</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>Start with your own image</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-8 border border-gray-800 hover:border-purple-600 transition-colors">
              <h3 className="text-xl font-bold mb-2">Ultra</h3>
              <div className="text-3xl font-bold text-purple-400 mb-6">5,000 sats</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>4K Ultra HD quality</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>Maximum customization</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>Up to 10 second videos</span>
                </li>
                <li className="flex items-start">
                  <Check size={18} className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                  <span>Extend existing videos</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-20 bg-gradient-to-b from-[#111111] to-[#0d0d0d] text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to create amazing animal videos?</h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join now and receive a one-time 500 sats credit to try it out!
          </p>
          <button
            onClick={onConnect}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg flex items-center mx-auto"
          >
            <Zap className="mr-2" size={20} />
            Connect with Nostr
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0d0d0d] border-t border-gray-800 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="text-2xl font-bold">Animal Sunset 🌞🦒</div>
              <div className="text-gray-500 text-sm">© 2023 Puzzles. All rights reserved.</div>
            </div>
            <div className="flex space-x-6">
              <Link href="/gallery" className="text-gray-400 hover:text-white">
                Gallery
              </Link>
              <a 
                href="https://github.com/puzzles/animal-sunset" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                GitHub
              </a>
              <a 
                href="https://twitter.com/animalsunsetai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
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
  
  // New state variables 
  const [credits, setCredits] = useState<number>(0);
  const [usingCredits, setUsingCredits] = useState<boolean>(false);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [isVerifyingOldPayments, setIsVerifyingOldPayments] = useState<boolean>(false);
  const [verifiedPaymentHashes, setVerifiedPaymentHashes] = useState<string[]>([]);
  const [showCreditConfirmation, setShowCreditConfirmation] = useState<boolean>(false);
  
  // Ray 2 state variables
  const [useRay2, setUseRay2] = useState<boolean>(true);
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [duration, setDuration] = useState<Duration>("5s");

  // Constants
  const DEFAULT_RELAY_URLS = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'];

  // Price calculation function
  const calculatePrice = (): number => {
    if (!useRay2) {
      return PRICING.base;
    }
    
    return PRICING.ray2[resolution][duration];
  };

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
      
      // Load credits
      const userCredits = getUserCredits(pubkey);
      setCredits(userCredits);
      
      // Load pending payments
      const unverifiedPayments = getUnverifiedPayments(pubkey);
      setPendingPayments(unverifiedPayments);
      
      // If there are unverified payments, try to verify them
      if (unverifiedPayments.length > 0) {
        verifyPendingPayments(unverifiedPayments);
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
  
  // Function to verify pending payments
  const verifyPendingPayments = async (payments: any[]) => {
    setIsVerifyingOldPayments(true);
    
    try {
      const response = await fetch('/api/verify-pending-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingPayments: payments }),
      });
      
      if (response.ok) {
        const { results, verified } = await response.json();
        
        // Store verified payment hashes
        setVerifiedPaymentHashes(verified);
        
        // Process each result
        for (const [paymentHash, isVerified] of Object.entries(results)) {
          if (isVerified) {
            // Credit was verified
            const payment = payments.find(p => p.paymentHash === paymentHash);
            
            if (payment) {
              toast({
                title: "Payment found!",
                description: `A previous payment of ${payment.amount} sats has been verified.`,
              });
              
              // Add credits to the user's account
              const newCredits = addUserCredits(
                pubkey!, 
                payment.amount, 
                "Verified pending payment",
                payment.paymentHash
              );
              setCredits(newCredits);
              
              // Mark as verified in local storage
              markPaymentAsVerified(paymentHash);
            }
          }
        }
        
        // Update pending payments list
        setPendingPayments(getUnverifiedPayments(pubkey!));
      }
    } catch (error) {
      console.error('Error verifying pending payments:', error);
    } finally {
      setIsVerifyingOldPayments(false);
    }
  };

  // Core Functions
  const connectNostr = async () => {
    try {
      const key = await getNostrPublicKey();
      setPubkey(key);
      toast({
        title: "Connected",
        description: "Successfully connected to Nostr",
      });
      
      // Add welcome credit for new users
      if (getUserCredits(key) === 0) {
        const newCredits = addUserCredits(key, 500, "Welcome bonus");
        setCredits(newCredits);
        
        toast({
          title: "Welcome Bonus!",
          description: "You've received 500 sats credit to get started.",
        });
      }
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
      
      if (!window.nostr) {
        throw new Error('Nostr extension not found');
      }
      
      if (!pubkey) {
        throw new Error('Not connected to Nostr');
      }

      const formData = new FormData();
      formData.append('file', file);

      // Create proper NIP-98 event
      const event: Partial<Event> = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        content: "",
        tags: [
          ["u", "https://nostr.build/api/v2/upload/files"],
          ["method", "POST"],
        ],
        pubkey
      };

      const hashedEvent = getEventHash(event as Event);
      const signedEvent = await window.nostr.signEvent({
        ...event,
        id: hashedEvent
      } as Event);

      if (!signedEvent) {
        throw new Error('Failed to sign event');
      }

      // Base64 encode the signed event
      const authToken = btoa(JSON.stringify(signedEvent));

      // Upload to nostr.build with Authorization header
      const response = await fetch('https://nostr.build/api/v2/upload/files', {
        method: 'POST',
        headers: {
          'Authorization': `Nostr ${authToken}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Upload failed: ' + errorText);
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
        description: err instanceof Error ? err.message : "Please try again"
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

  // Modified waitForPayment function with increased timeout
  const waitForPayment = async (paymentHash: string): Promise<boolean> => {
    const startTime = Date.now();
    let attempts = 0;
    
    console.log(`Beginning payment check for hash: ${paymentHash}`);
    
    while (Date.now() - startTime < INVOICE_EXPIRY && attempts < PAYMENT_MAX_ATTEMPTS) {
      try {
        attempts++;
        console.log(`Payment check attempt ${attempts}/${PAYMENT_MAX_ATTEMPTS}, hash: ${paymentHash}`);
        
        const response = await fetch('/api/check-lnbits-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            paymentHash,
            verifiedPayments: verifiedPaymentHashes 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Payment check error (${response.status}):`, errorData);
          
          // If we get a 404 or wallet not found, we might need to handle differently
          if (response.status === 404 || (errorData.error && errorData.error.includes('wallet'))) {
            toast({
              variant: "destructive",
              title: "Payment verification error",
              description: "Could not verify payment status. Please try again later."
            });
            
            // Save this payment for later verification
            savePendingPayment({
              paymentHash,
              paymentRequest: paymentRequest!,
              amount: calculatePrice(),
              createdAt: new Date().toISOString(),
              prompt,
              pubkey: pubkey!,
              verified: false
            });
            
            // We'll assume payment failed for now but will check later
            return false;
          }
          
          // For other errors, wait and retry
          await new Promise(resolve => setTimeout(resolve, PAYMENT_CHECK_INTERVAL));
          continue;
        }
        
        const data = await response.json();
        console.log('Payment check response:', data);

        if (data.paid) {
          console.log('Payment confirmed as paid!');
          
          // Add to verified payment hashes
          setVerifiedPaymentHashes(prev => [...prev, paymentHash]);
          
          toast({
            title: "Payment received",
            description: "Starting video generation",
          });
          return true;
        }

        console.log('Payment not confirmed yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, PAYMENT_CHECK_INTERVAL));
      } catch (err) {
        console.error('Error checking payment status:', err);
        await new Promise(resolve => setTimeout(resolve, PAYMENT_CHECK_INTERVAL));
      }
    }

    console.log('Payment check timed out after many attempts');
    
    // Save this payment for later verification
    savePendingPayment({
      paymentHash,
      paymentRequest: paymentRequest!,
      amount: calculatePrice(),
      createdAt: new Date().toISOString(),
      prompt,
      pubkey: pubkey!,
      verified: false
    });
    
    toast({
      variant: "destructive", 
      title: "Payment verification timeout",
      description: "We'll keep checking and credit your account once verified."
    });
    
    return false;
  };

  // Modified pollForCompletion function with credit system
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
      } else if (data.state === 'failed') {
        // Refund credits if the generation failed
        if (usingCredits) {
          const newCredits = refundCredits(pubkey!, calculatePrice(), generationId);
          setCredits(newCredits);
          
          toast({
            title: "Credits refunded",
            description: `${calculatePrice()} credits have been refunded due to generation failure.`,
          });
        }
        
        setGenerations((prevGenerations) => {
          const updatedGenerations = prevGenerations.map((g) =>
            g.id === generationId ? { ...g, state: 'failed', createdAt: data.created_at } : g
          );
          return updatedGenerations;
        });
        
        setSelectedGeneration((prevSelected) => {
          if (prevSelected?.id === generationId) {
            return {
              ...prevSelected,
              state: 'failed',
              createdAt: data.created_at,
            };
          }
          return prevSelected;
        });
        
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

  // Separated generation logic
  const handleGeneration = async () => {
    try {
      // If using credits, deduct them first
      if (usingCredits) {
        const price = calculatePrice();
        const success = useCredits(pubkey!, price, 'new-generation');
        
        if (!success) {
          toast({
            variant: "destructive",
            title: "Insufficient credits",
            description: "Please try a different payment method.",
          });
          setLoading(false);
          return;
        }
      }
      
      // Prepare generation request with Ray 2 parameters
      const generationBody: any = { 
        prompt,
        loop: isLooping,
        // Add Ray 2 parameters
        useRay2: useRay2,
        resolution: useRay2 ? resolution : undefined,
        duration: useRay2 ? duration : undefined
      };

      if (isExtending && selectedVideoId) {
        generationBody.extend = true;
        generationBody.videoId = selectedVideoId;
      } else if (startImageUrl) {
        generationBody.startImageUrl = startImageUrl;
      }

      console.log('Sending generation request with body:', JSON.stringify(generationBody));

      // Generate video
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(generationBody),
      });

      console.log('Generation response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If generation failed and we used credits, refund them
        if (usingCredits) {
          const price = calculatePrice();
          const newCredits = refundCredits(pubkey!, price, 'generation-failed');
          setCredits(newCredits);
          
          toast({
            title: "Credits refunded",
            description: `${price} credits have been refunded due to generation failure.`,
          });
        }
        
        throw new Error(errorData.message || 'Failed to generate video');
      }

      const data = await response.json();
      console.log('Generation response data:', data);

      if (!data.id) {
        throw new Error('Invalid response from server: no generation ID');
      }

      const newGeneration: StoredGeneration = {
        id: data.id,
        prompt,
        state: data.state || 'queued',
        createdAt: data.created_at || new Date().toISOString(),
        pubkey: pubkey || '',
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

  // Updated generateVideo function with credit system
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
    
    const price = calculatePrice();
    
    // Check if user has enough credits
    if (credits >= price) {
      // Ask user if they want to use credits
      setShowCreditConfirmation(true);
      return;
    }
    
    // Otherwise, proceed with payment flow
    try {
      console.log(`Creating invoice for ${price} sats`);
      
      // Create Lightning invoice
      const invoiceResponse = await fetch('/api/create-lnbits-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: price }),
      });

      console.log('Invoice response status:', invoiceResponse.status);

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json();
        console.error('Invoice creation error:', errorData);
        
        // Check specifically for wallet errors
        if (errorData.error && 
            (errorData.error.includes('wallet') || 
             errorData.error.includes('configuration'))) {
          throw new Error('Payment system is currently unavailable. Please try again later.');
        }
        
        throw new Error(errorData.error || 'Failed to create invoice');
      }

      const invoiceData = await invoiceResponse.json();
      console.log('Invoice data:', invoiceData);
      
      const { payment_request, payment_hash } = invoiceData;

      // Make sure we got valid data back
      if (!payment_request || !payment_hash) {
        throw new Error('Invalid invoice data received');
      }

      setPaymentRequest(payment_request);
      setPaymentHash(payment_hash);

      const paymentConfirmed = await waitForPayment(payment_hash);
      if (!paymentConfirmed) {
        setLoading(false);
        setPaymentRequest(null);
        setPaymentHash(null);
        return;
      }

      setPaymentRequest(null);
      setPaymentHash(null);

      // Call the separate generation handler
      await handleGeneration();
    } catch (err) {
      console.error('Payment error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to process payment. Please try again.'
      );
      toast({
        variant: "destructive",
        title: "Payment system error",
        description: err instanceof Error ? err.message : "Please try again",
      });
      setLoading(false);
      setPaymentRequest(null);
      setPaymentHash(null);
    }
  };
  
  // Helper function to use credits for generation
  const useCreditsForGeneration = async () => {
    setShowCreditConfirmation(false);
    setUsingCredits(true);
    
    try {
      await handleGeneration();
    } catch (err) {
      console.error('Generation with credits failed:', err);
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
    } finally {
      setUsingCredits(false);
    }
  };
  
  // Helper function to cancel credit usage
  const cancelCreditUsage = () => {
    setShowCreditConfirmation(false);
    setLoading(false);
  };
  
  // Render
  if (!pubkey) {
    return (
      <LandingPage onConnect={connectNostr} />
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
            <div className="px-2 py-1 bg-purple-800 rounded-md text-sm font-medium">
              {credits} sats
            </div>
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
              <div className="flex items-center space-x-4">
                <div className="px-3 py-1 bg-purple-800 rounded-md font-medium flex items-center">
                  <Zap size={16} className="mr-1 text-yellow-400" />
                  <span>{credits} sats</span>
                </div>
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
                {isVerifyingOldPayments && (
                  <div className="mb-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 flex items-center">
                    <RefreshCw className="animate-spin h-5 w-5 text-yellow-500 mr-3" />
                    <div>
                      <p className="font-medium text-yellow-300">Checking for unverified payments...</p>
                      <p className="text-sm text-yellow-400/70">
                        We're verifying any previous payments that weren't processed.
                      </p>
                    </div>
                  </div>
                )}
              
               {pendingPayments.length > 0 && (
                  <div className="mb-4 bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
                    <p className="font-medium text-blue-300 mb-2">
                      You have {pendingPayments.length} pending payment{pendingPayments.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-blue-400/70 mb-3">
                      These payments will be verified and credited to your account as soon as possible.
                    </p>
                    <button
                      onClick={() => verifyPendingPayments(pendingPayments)}
                      className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded"
                    >
                      Verify Now
                    </button>
                  </div>
                )}
              
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
                    {/* Ray 2 Model Toggle */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-300">Use Ray 2 Model</label>
                      <Switch
                        checked={useRay2}
                        onCheckedChange={setUseRay2}
                        disabled={loading}
                      />
                    </div>

                    {/* Ray 2 Options (only show when Ray 2 is enabled) */}
                    {useRay2 && (
                      <>
                        {/* Resolution Selector */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">
                            Resolution
                          </label>
                          <select
                            className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value as Resolution)}
                            disabled={loading}
                          >
                            <option value="540p">540p</option>
                            <option value="720p">720p (Recommended)</option>
                            <option value="1080p">1080p</option>
                            <option value="4k">4K</option>
                          </select>
                        </div>

                        {/* Duration Selector */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-300">
                            Duration
                          </label>
                          <select
                            className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value as Duration)}
                            disabled={loading}
                          >
                            <option value="3s">3 seconds</option>
                            <option value="5s">5 seconds (Recommended)</option>
                            <option value="8s">8 seconds</option>
                            <option value="10s">10 seconds</option>
                          </select>
                        </div>
                      </>
                    )}

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

                  {/* Price display */}
                  <div className="flex justify-between items-center p-3 bg-[#2a2a2a] rounded-lg">
                    <div>
                      <span className="text-gray-400">Price: </span>
                      <span className="font-bold text-white">{calculatePrice()} sats</span>
                    </div>
                    
                    {credits > 0 && (
                      <div className="text-sm text-gray-300">
                        <span className="font-medium text-purple-400">{credits} sats</span> available in credits
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
            
            {/* Dynamic pricing message */}
            <p className="text-sm text-gray-300">
              Please pay {calculatePrice()} sats to proceed.
              {useRay2 && (
                <span className="block mt-1 text-purple-400">
                  Using Ray 2 model with {resolution} resolution, {duration} duration.
                </span>
              )}
            </p>
            
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
              <p className="text-xs text-gray-500 text-center mt-2">
                If you've already paid but it's not detecting, don't worry! We'll verify and credit your account automatically.
              </p>
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

      {/* Credit Usage Confirmation Modal */}
      {showCreditConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-sm w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Use Credits</h2>
              <button
                onClick={cancelCreditUsage}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-gray-300">
              You have <span className="font-bold text-purple-400">{credits} sats</span> in credits.
              Would you like to use <span className="font-bold text-purple-400">{calculatePrice()} sats</span> to generate this video?
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={cancelCreditUsage}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={useCreditsForGeneration}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Use Credits
              </button>
            </div>
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
