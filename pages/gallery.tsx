// Import necessary modules
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { AnimalKind, ProfileKind, Profile, NostrEvent } from '../types/nostr';
import { Download, MessageSquare, Zap, X, RefreshCw } from 'lucide-react';
import NDK, { NDKNip07Signer, NDKEvent } from "@nostr-dev-kit/ndk";
import "websocket-polyfill";

// Create an NDK instance
const ndk = new NDK({
  explicitRelayUrls: ["wss://relay.nostrfreaks.com"],
  signer: new NDKNip07Signer()
});

function Gallery() {
  const [posts, setPosts] = useState<NDKEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<NDKEvent | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingZap, setSendingZap] = useState(false);

  useEffect(() => {
    ndk.connect().then(() => fetchPosts());
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const events = await ndk.fetchEvents({
        kinds: [75757],
        limit: 50
      });

      setPosts(Array.from(events));

      toast({
        title: "Gallery updated",
        description: `Loaded ${Array.from(events).length} videos`,
      });
    } catch (error: unknown) {
      console.error('Error fetching posts:', error);
      setError((error as Error).message || 'Failed to load gallery');
      toast({
        variant: "destructive",
        title: "Failed to load gallery",
        description: "Please try refreshing the page",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleZap = async (post: NDKEvent) => {
    try {
      setSendingZap(true);
      const ndkEvent = new NDKEvent(ndk);
      ndkEvent.kind = 9734;
      ndkEvent.content = "Zap event";
      ndkEvent.tags = [
        ["e", post.id],
        ["p", post.pubkey]
      ];
      await ndkEvent.publish();
      toast({
        title: "Zap sent!",
        description: "Thank you for supporting the creator",
      });
    } catch (error: unknown) {
      console.error('Error sending zap:', error);
      toast({
        variant: "destructive",
        title: "Zap failed",
        description: (error as Error).message || "Failed to send zap",
      });
    } finally {
      setSendingZap(false);
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
          <div className="flex items-center space-x-2">
            <span>Connected to Nostr</span>
          </div>
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
                    src={(post as any)?.profile?.picture || '/default-avatar.png'}
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-medium">
                      {(post as any)?.profile?.name || "Anonymous"}
                    </div>
                    <div className="text-sm text-gray-400">
                      {post.created_at ? new Date(post.created_at * 1000).toLocaleDateString() : 'Unknown date'}
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
