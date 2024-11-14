import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { AnimalKind } from '../types/nostr';
import { fetchProfile, formatPubkey, getLightningAddress } from '../lib/nostr';
import { Download, MessageSquare, Zap, X, Share2, RefreshCw, Check, Copy } from 'lucide-react';
import QRCode from 'qrcode.react';

// Define the Profile interface
interface Profile {
  name?: string;
  picture?: string;
  about?: string;
}

interface VideoPost {
  event: AnimalKind;
  profile?: Profile;
  comments: AnimalKind[];
}

interface NostrModalData {
  videoUrl: string;
  author: string;
  prompt: string;
}

export default function Gallery() {
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedPost, setSelectedPost] = useState<VideoPost | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [sendingZap, setSendingZap] = useState(false);
  const [currentZap, setCurrentZap] = useState<{ payment_request: string; payment_hash: string } | null>(null);
  const [hasCopiedZap, setHasCopiedZap] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [showNostrModal, setShowNostrModal] = useState<NostrModalData | null>(null);
  const [publishError, setPublishError] = useState('');

  const profileCache = useRef<Map<string, Profile>>(new Map());

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/nostr/fetch-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relay: 'wss://relay.nostrfreaks.com',
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
      const postsMap = new Map<string, VideoPost>();

      for (const event of events) {
        const replyTo = event.tags.find(tag => tag[0] === 'e')?.[1];

        if (!replyTo) {
          postsMap.set(event.id, { event, comments: [], profile: undefined });
        } else {
          const parentPost = postsMap.get(replyTo);
          if (parentPost) {
            parentPost.comments.push(event);
          }
        }
      }

      const uniquePubkeys = Array.from(new Set(events.map(event => event.pubkey)));
      await Promise.all(uniquePubkeys.map(async (pubkey) => {
        if (profileCache.current.has(pubkey)) return;

        const profileEvent = await fetchProfile(pubkey);
        if (profileEvent) {
          const profileContent = JSON.parse(profileEvent.content);
          const profile: Profile = { name: profileContent.name, picture: profileContent.picture, about: profileContent.about };
          profileCache.current.set(pubkey, profile);
        }
      }));

      const postsArray = Array.from(postsMap.values()).map(post => ({
        ...post,
        profile: profileCache.current.get(post.event.pubkey)
      }));

      setPosts(postsArray);
      toast({ title: "Gallery updated", description: `Loaded ${postsArray.length} videos` });
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(error instanceof Error ? error.message : 'Failed to load gallery');
      toast({ variant: "destructive", title: "Failed to load gallery", description: "Please try refreshing the page" });
    } finally {
      setLoading(false);
    }
  };

  const handleZap = async (post: VideoPost) => {
    setSendingZap(true);
    try {
      const lnAddress = await getLightningAddress(post.event.pubkey);
      if (!lnAddress) throw new Error('No Lightning Address found for this user');

      const response = await fetch('/api/create-lnbits-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, lnAddress })
      });

      if (!response.ok) throw new Error('Failed to create invoice');

      const { payment_request, payment_hash } = await response.json();
      setCurrentZap({ payment_request, payment_hash });
      toast({ title: "Zap Invoice Generated", description: "Scan the QR code to complete the payment." });
    } catch (error) {
      console.error('Error sending zap:', error);
      toast({ variant: "destructive", title: "Zap failed", description: error instanceof Error ? error.message : "Failed to send zap" });
    } finally {
      setSendingZap(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Gallery | Animal Sunset 🌞🦒</title>
        <meta name="description" content="Discover AI-generated animal videos" />
      </Head>

      <div className="bg-[#1a1a1a] p-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Navigation />
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Animal Gallery</h1>
          <button onClick={() => fetchPosts()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="space-y-8">
          {loading ? (
            <div className="flex items-center space-x-2">
              <RefreshCw className="animate-spin h-8 w-8 text-purple-500" />
              <span className="text-lg">Loading gallery...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : posts.length === 0 ? (
            <p className="text-gray-400">No videos found.</p>
          ) : (
            posts.map(post => (
              <div key={post.event.id} className="bg-[#1a1a1a] rounded-lg overflow-hidden">
                <div className="p-4 flex items-center space-x-3">
                  <img src={post.profile?.picture || '/default-avatar.png'} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <div className="font-medium">{post.profile?.name || formatPubkey(post.event.pubkey)}</div>
                    <div className="text-sm text-gray-400">{new Date(post.event.created_at * 1000).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="relative pt-[56.25%] bg-black">
                  <video src={post.event.content} className="absolute top-0 left-0 w-full h-full object-contain" controls loop playsInline />
                </div>
                <div className="p-4 pb-2">
                  <p className="text-lg font-medium">{post.event.tags.find(tag => tag[0] === 'title')?.[1] || 'Untitled'}</p>
                </div>
                <div className="p-4 flex flex-wrap items-center gap-4">
                  <button onClick={() => handleZap(post)} disabled={sendingZap} className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Zap size={20} />
                    <span>Zap</span>
                  </button>
                  <button onClick={() => setSelectedPost(post)} className="flex items-center space-x-2 text-gray-400 hover:text-white">
                    <MessageSquare size={20} />
                    <span>{post.comments.length}</span>
                  </button>
                  <button onClick={() => downloadVideo(post.event.content, `animal-sunset-${post.event.id}.mp4`)} className="flex items-center space-x-2 text-gray-400 hover:text-white ml-auto">
                    <Download size={20} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
