// pages/gallery.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { AnimalKind } from '../types/nostr';
import { fetchProfile, formatPubkey, getLightningAddress } from '../lib/nostr';
import ZapModal from '@/components/ZapModal';
import { 
  Download, 
  MessageCircle, 
  Zap, 
  X, 
  Share2, 
  RefreshCw 
} from 'lucide-react';
import { UserSettings, DEFAULT_SETTINGS } from '@/types/settings';

interface Profile {
  name?: string;
  picture?: string;
  about?: string;
  lud16?: string;
  lud06?: string;
}

interface VideoPost {
  event: AnimalKind;
  profile?: Profile;
  comments: AnimalKind[];
}

interface ZapInfo {
  invoice: string;
  amount: number;
  recipientPubkey: string;
  recipientName?: string;
}

const Gallery = () => {
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showZapModal, setShowZapModal] = useState(false);
  const [currentZap, setCurrentZap] = useState<ZapInfo | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [pubkey, setPubkey] = useState<string | null>(null);

  useEffect(() => {
    const loadNostrKey = async () => {
      if (window.nostr) {
        try {
          const key = await window.nostr.getPublicKey();
          setPubkey(key);
          const savedSettings = localStorage.getItem(`settings-${key}`);
          if (savedSettings) {
            setUserSettings(JSON.parse(savedSettings));
          }
        } catch (error) {
          console.error('Error loading Nostr key:', error);
        }
      }
    };
    loadNostrKey();
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/nostr/fetch-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relay: userSettings.defaultRelay,
          filter: {
            kinds: [75757],
            limit: 50
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const events = await response.json() as AnimalKind[];
      
      // Filter out duplicates based on video URL
      const uniqueEvents = events.reduce((unique, event) => {
        const exists = unique.find(e => e.content === event.content);
        if (!exists || event.created_at < exists.created_at) {
          return [...unique.filter(e => e.content !== event.content), event];
        }
        return unique;
      }, [] as AnimalKind[]);

      // Sort by creation date (newest first)
      uniqueEvents.sort((a, b) => b.created_at - a.created_at);

      // Create posts with profiles and comments
      const postsWithProfiles = await Promise.all(uniqueEvents.map(async event => {
        const post: VideoPost = { event, comments: [], profile: undefined };
        try {
          const profileEvent = await fetchProfile(event.pubkey);
          if (profileEvent) {
            post.profile = JSON.parse(profileEvent.content);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
        return post;
      }));

      setPosts(postsWithProfiles);
      toast({
        title: "Gallery updated",
        description: `Loaded ${postsWithProfiles.length} videos`
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(error instanceof Error ? error.message : 'Failed to load gallery');
      toast({
        variant: "destructive",
        title: "Failed to load gallery",
        description: "Please try refreshing the page"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleZap = async (post: VideoPost) => {
    try {
      if (!post.profile) {
        throw new Error('Creator profile not found');
      }

      const lnAddress = post.profile.lud16 || post.profile.lud06;
      if (!lnAddress) {
        throw new Error('No lightning address found for this creator');
      }

      // Create lightning invoice
      const response = await fetch('/api/lightning/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lnAddress,
          amount: userSettings.defaultZapAmount,
          memo: `Zap for content: ${post.event.id}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create zap invoice');
      }

      const { payment_request } = await response.json();

      setCurrentZap({
        invoice: payment_request,
        amount: userSettings.defaultZapAmount,
        recipientPubkey: post.event.pubkey,
        recipientName: post.profile.name
      });
      setShowZapModal(true);

    } catch (error) {
      console.error('Error creating zap:', error);
      toast({
        variant: "destructive",
        title: "Zap failed",
        description: error instanceof Error ? error.message : "Failed to create zap"
      });
    }
  };

  const handleZapComplete = async () => {
    if (currentZap) {
      // You could add additional logic here, like updating a zap count
      toast({
        title: "Zap sent!",
        description: `Successfully sent ${currentZap.amount} sats`
      });
      setCurrentZap(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="animate-spin h-8 w-8 text-purple-500" />
          <span className="text-lg">Loading gallery...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Gallery | Luma AI 🌞🦒</title>
        <meta name="description" content="Discover AI-generated content" />
      </Head>

      <div className="bg-[#1a1a1a] p-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto">
          <Navigation />
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Gallery</h1>
          <button
            onClick={() => {
              fetchPosts();
              toast({
                title: "Refreshing gallery",
                description: "Fetching latest content..."
              });
            }}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="space-y-8">
          {posts.map(post => (
            <div key={post.event.id} className="bg-[#1a1a1a] rounded-lg overflow-hidden">
              {/* Author Info */}
              <div className="p-4 flex items-center space-x-3">
                <img
                  src={post.profile?.picture || '/default-avatar.png'}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <div className="font-medium">
                    {post.profile?.name || formatPubkey(post.event.pubkey)}
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(post.event.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Video */}
              <div className="relative pt-[56.25%] bg-black">
                <video
                  src={post.event.content}
                  className="absolute top-0 left-0 w-full h-full object-contain"
                  controls
                  loop
                  playsInline
                />
              </div>

              {/* Title */}
              <div className="p-4 pb-2">
                <p className="text-lg font-medium">
                  {post.event.tags.find(tag => tag[0] === 'title')?.[1] || 'Untitled'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="p-4 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => handleZap(post)}
                  className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400"
                >
                  <Zap size={20} />
                  <span>Zap</span>
                </button>

                <button
                  onClick={() => {
                    const url = post.event.content;
                    const filename = `luma-${post.event.id}.mp4`;
                    fetch(url)
                      .then(res => res.blob())
                      .then(blob => {
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      });
                  }}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white"
                >
                  <Download size={20} />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(post.event.content);
                    toast({
                      title: "Copied!",
                      description: "URL copied to clipboard"
                    });
                  }}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white"
                >
                  <Share2 size={20} />
                  <span>Share</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zap Modal */}
      {showZapModal && currentZap && (
        <ZapModal
          isOpen={showZapModal}
          onClose={() => setShowZapModal(false)}
          invoice={currentZap.invoice}
          amount={currentZap.amount}
          recipientName={currentZap.recipientName}
          onPaymentConfirmed={handleZapComplete}
        />
      )}
    </div>
  );
};

export default Gallery;
