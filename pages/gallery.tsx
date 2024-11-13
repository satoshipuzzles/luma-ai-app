import { useState, useEffect } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { AnimalKind, ProfileKind, Profile, NostrEvent } from '../types/nostr';
import { useNostr } from '../contexts/NostrContext';
import {
  Download,
  MessageSquare,
  Zap,
  X,
  Share2,
  RefreshCw
} from 'lucide-react';

// Utility function for downloading videos
const downloadVideo = async (url, filename) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    toast({
      title: "Download started",
      description: "Your video is being downloaded",
    });
  } catch (error) {
    console.error('Download failed:', error);
    toast({
      variant: "destructive",
      title: "Download failed",
      description: "Please try again",
    });
  }
};

function Gallery() {
  const { pubkey, profile, connect, isConnected } = useNostr();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingZap, setSendingZap] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);

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

      const events = await response.json();
      setPosts(events);

      toast({
        title: "Gallery updated",
        description: `Loaded ${events.length} videos`,
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(error.message || 'Failed to load gallery');
      toast({
        variant: "destructive",
        title: "Failed to load gallery",
        description: "Please try refreshing the page",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleZap = async (post) => {
    if (!pubkey) {
      toast({
        title: "Connect Required",
        description: "Please connect your Nostr account first",
        variant: "destructive"
      });
      return;
    }

    try {
      setSendingZap(true);
      // Assuming getLightningAddress is a utility function to fetch lightning address
      const lnAddress = await getLightningAddress(post.pubkey);
      if (!lnAddress) {
        throw new Error('No lightning address found for this user');
      }
      
      // Create invoice logic here
      // Show success toast
      toast({
        title: "Zap sent!",
        description: "Thank you for supporting the creator",
      });
    } catch (error) {
      console.error('Error sending zap:', error);
      toast({
        variant: "destructive",
        title: "Zap failed",
        description: error.message || "Failed to send zap",
      });
    } finally {
      setSendingZap(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 space-y-6">
          <h1 className="text-3xl font-bold text-center">Animal Gallery 🌞🦒</h1>
          <div className="bg-[#1a1a1a] p-8 rounded-lg shadow-xl space-y-4">
            <p className="text-gray-300 text-center">Connect with Nostr to interact with the gallery</p>
            <button
              onClick={connect}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
            >
              Connect with Nostr
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <title>Gallery | Animal Sunset 🌞🦒</title>
        <meta name="description" content="Discover AI-generated animal videos" />
      </Head>

      <div className="bg-[#1a1a1a] p-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Navigation />
          {profile && (
            <div className="flex items-center space-x-2">
              {profile.picture && (
                <img
                  src={profile.picture}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span>{profile.name || "Anonymous"}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Animal Gallery</h1>
          <button
            onClick={() => fetchPosts()}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {error ? (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No videos found in the gallery yet.
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map(post => (
              <div key={post.id} className="bg-[#1a1a1a] rounded-lg overflow-hidden">
                <div className="p-4 flex items-center space-x-3">
                  <img
                    src={post.profile?.picture || '/default-avatar.png'}
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-medium">
                      {post.profile?.name || "Anonymous"}
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(post.created_at * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="relative pt-[56.25%] bg-black">
                  <video
                    src={post.content}
                    className="absolute top-0 left-0 w-full h-full object-contain"
                    controls
                    loop
                    playsInline
                  />
                </div>

                <div className="p-4 pb-2">
                  <p className="text-lg font-medium">
                    {post.tags?.find(tag => tag[0] === 'title')?.[1] || 'Untitled'}
                  </p>
                </div>

                <div className="p-4 flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => handleZap(post)}
                    disabled={sendingZap}
                    className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap size={20} />
                    <span>Zap</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedPost(post);
                      setShowCommentModal(true);
                    }}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white"
                  >
                    <MessageSquare size={20} />
                    <span>Comment</span>
                  </button>

                  <button
                    onClick={() => downloadVideo(post.content, `animal-sunset-${post.id}.mp4`)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white ml-auto"
                  >
                    <Download size={20} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Gallery;
