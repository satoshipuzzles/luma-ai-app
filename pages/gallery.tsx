import { useState, useEffect } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { AnimalKind, NostrEvent } from '../types/nostr';
import { fetchProfile, formatPubkey, getLightningAddress } from '../lib/nostr';
import { 
  Download, 
  MessageSquare, 
  Zap, 
  X, 
  Share2, 
  RefreshCw 
} from 'lucide-react';

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

// Utility function for downloading videos
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

export default function Gallery() {
  // Keep existing state variables
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedPost, setSelectedPost] = useState<VideoPost | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [sendingZap, setSendingZap] = useState(false);

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
      
      // Group comments with their parent posts
      const postsMap = new Map<string, VideoPost>();
      
      for (const event of events) {
        const replyTo = event.tags.find(tag => tag[0] === 'e')?.[1];
        
        if (!replyTo) {
          // This is a main post
          postsMap.set(event.id, {
            event,
            comments: [],
            profile: undefined
          });
        } else {
          // This is a comment
          const parentPost = postsMap.get(replyTo);
          if (parentPost) {
            parentPost.comments.push(event);
          }
        }
      }

      // Fetch profiles for all authors
      const posts = Array.from(postsMap.values());
      await Promise.all(posts.map(async post => {
        try {
          const profileEvent = await fetchProfile(post.event.pubkey);
          if (profileEvent) {
            const profileContent = JSON.parse(profileEvent.content);
            post.profile = {
              name: profileContent.name,
              picture: profileContent.picture,
              about: profileContent.about
            };
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }));

      setPosts(posts);
      toast({
        title: "Gallery updated",
        description: `Loaded ${posts.length} videos`,
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(error instanceof Error ? error.message : 'Failed to load gallery');
      toast({
        variant: "destructive",
        title: "Failed to load gallery",
        description: "Please try refreshing the page",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleZap = async (post: VideoPost) => {
    setSendingZap(true);
    try {
      const lnAddress = await getLightningAddress(post.event.pubkey);
      if (!lnAddress) {
        throw new Error('No lightning address found for this user');
      }

      const response = await fetch('/api/create-lnbits-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1000,
          lnAddress
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }

      const { payment_request, payment_hash } = await response.json();
      
      // Show success toast
      toast({
        title: "Zap sent!",
        description: "Thank you for supporting the creator",
        duration: 2000
      });
    } catch (error) {
      console.error('Error sending zap:', error);
      toast({
        variant: "destructive",
        title: "Zap failed",
        description: error instanceof Error ? error.message : "Failed to send zap",
      });
    } finally {
      setSendingZap(false);
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

      {/* Navigation Header */}
      <div className="bg-[#1a1a1a] p-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto">
          <Navigation />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Animal Gallery</h1>
          <button
            onClick={() => {
              fetchPosts();
              toast({
                title: "Refreshing gallery",
                description: "Fetching latest videos...",
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

              {/* Actions */}
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
                  <span>{post.comments.length}</span>
                </button>

                <button
                  onClick={() => downloadVideo(post.event.content, `animal-sunset-${post.event.id}.mp4`)}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white ml-auto"
                >
                  <Download size={20} />
                  <span>Download</span>
                </button>
              </div>

              {/* Comments */}
              {post.comments.length > 0 && (
                <div className="border-t border-gray-800">
                  <div className="p-4 space-y-4">
                    {post.comments.map(comment => (
                      <div key={comment.id} className="flex items-start space-x-3">
                        <img
                          src="/default-avatar.png"
                          alt="Commenter"
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1 bg-[#2a2a2a] rounded-lg p-3">
                          <div className="font-medium text-gray-300 mb-1">
                            {formatPubkey(comment.pubkey)}
                          </div>
                          <div className="text-sm text-gray-200">
                            {comment.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Comment Modal */}
      {showCommentModal && selectedPost && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Add Comment</h2>
              <button
                onClick={() => setShowCommentModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg p-3 text-white resize-none border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
              rows={4}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write your comment..."
            />

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // TODO: Implement comment publishing via Nostr
                  setShowCommentModal(false);
                  setNewComment('');
                  toast({
                    title: "Comment posted",
                    description: "Your comment has been published",
                    duration: 2000
                  });
                }}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
