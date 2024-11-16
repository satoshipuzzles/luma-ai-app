import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { CommentSection } from '../components/CommentSection';
import { AnimalKind, NostrEvent } from '../types/nostr';
import { BitcoinConnectProvider } from '../types/bitcoin-connect';
import { fetchProfile, formatPubkey, getLightningAddress } from '../lib/nostr';
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';
import { 
  Download, 
  MessageSquare, 
  Zap, 
  X, 
  Share2, 
  RefreshCw,
  Send,
  Copy
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

interface GroupedPosts {
  [videoUrl: string]: VideoPost[];
}

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
      description: "Your video is being downloaded"
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

const defaultRelays = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'];

export default function Gallery() {
  // State
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedPost, setSelectedPost] = useState<VideoPost | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [publishingComment, setPublishingComment] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [relays, setRelays] = useState<string[]>(defaultRelays);
  const postsRef = useRef<VideoPost[]>([]);
  
  // Effects
  useEffect(() => {
    const loadPubkey = async () => {
      if (window.nostr) {
        try {
          const key = await window.nostr.getPublicKey();
          setPubkey(key);
          
          // Load user settings
          const savedSettings = localStorage.getItem(`settings-${key}`);
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            setUserSettings(settings);
            setRelays([settings.defaultRelay, ...settings.customRelays]);
          }
        } catch (error) {
          console.error('Error loading pubkey:', error);
        }
      }
    };
    
    loadPubkey();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [relays]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Functions
  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const responses = await Promise.allSettled(
        relays.map(relay =>
          fetch('/api/nostr/fetch-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relay,
              filter: {
                kinds: [75757],
                limit: 100
              }
            })
          }).then(res => res.json())
        )
      );

      // Combine all successful responses
      const allEvents = responses
        .filter((result): result is PromiseFulfilledResult<AnimalKind[]> => 
          result.status === 'fulfilled'
        )
        .flatMap(result => result.value);

      // Group posts by video URL to handle duplicates
      const groupedPosts: GroupedPosts = {};
      
      for (const event of allEvents) {
        if (!groupedPosts[event.content]) {
          groupedPosts[event.content] = [];
        }
        groupedPosts[event.content].push({
          event,
          comments: [],
          profile: undefined
        });
      }

      // For each group, keep only the earliest post
      const uniquePosts = Object.values(groupedPosts).map(group => {
        return group.reduce((earliest, current) => {
          return current.event.created_at < earliest.event.created_at ? current : earliest;
        });
      });

      // Sort by creation date (newest first)
      uniquePosts.sort((a, b) => b.event.created_at - a.event.created_at);

      // Fetch profiles for all authors
      await Promise.all(uniquePosts.map(async post => {
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

      // Fetch comments
      const commentEvents = await Promise.all(
        relays.map(relay =>
          fetch('/api/nostr/fetch-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relay,
              filter: {
                kinds: [75757],
                '#e': uniquePosts.map(post => post.event.id)
              }
            })
          }).then(res => res.json())
        )
      );

      // Add comments to their respective posts
      const allComments = commentEvents.flat();
      uniquePosts.forEach(post => {
        post.comments = allComments.filter(comment => 
          comment.tags.some(tag => tag[0] === 'e' && tag[1] === post.event.id)
        );
      });

      setPosts(uniquePosts);
      
      toast({
        title: "Gallery updated",
        description: `Loaded ${uniquePosts.length} videos`
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

  const handleComment = async () => {
    if (!selectedPost || !newComment.trim() || !pubkey) return;
    
    setPublishingComment(true);
    
    try {
      const commentEvent: Partial<NostrEvent> = {
        kind: 75757,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        content: newComment.trim(),
        tags: [
          ['e', selectedPost.event.id],
          ['p', selectedPost.event.pubkey]
        ]
      };

      const signedEvent = await window.nostr!.signEvent(commentEvent as NostrEvent);
      
      // Publish to all relays
      await Promise.all(relays.map(relay =>
        fetch('/api/nostr/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relay, event: signedEvent })
        })
      ));

      // Update local state
      const updatedPosts = postsRef.current.map(post =>
        post.event.id === selectedPost.event.id
          ? {
              ...post,
              comments: [...post.comments, signedEvent as AnimalKind]
            }
          : post
      );

      setPosts(updatedPosts);
      setNewComment('');
      setShowCommentModal(false);
      setHighlightedCommentId(signedEvent.id);

      toast({
        title: "Comment posted",
        description: "Your comment has been published"
      });
    } catch (error) {
      console.error('Error publishing comment:', error);
      toast({
        variant: "destructive",
        title: "Failed to post comment",
        description: error instanceof Error ? error.message : "Please try again"
      });
    } finally {
      setPublishingComment(false);
    }
  };

  const handleZap = async (post: VideoPost) => {
    if (!window.bitcoinConnect || !userSettings.bitcoinConnectEnabled) {
      toast({
        variant: "destructive",
        title: "Bitcoin Connect not available",
        description: "Please enable Bitcoin Connect in settings"
      });
      return;
    }

    try {
      const lnAddress = await getLightningAddress(post.event.pubkey);
      if (!lnAddress) {
        throw new Error('No lightning address found for this user');
      }

      const response = await fetch('/api/lightning/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lnAddress,
          amount: userSettings.defaultZapAmount,
          comment: `Zap for Animal Sunset video: ${post.event.id}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }

      const { payment_request } = await response.json();
      
      await window.bitcoinConnect.makePayment(
        payment_request,
        userSettings.defaultZapAmount
      );

      toast({
        title: "Zap sent!",
        description: "Thank you for supporting the creator"
      });
    } catch (error) {
      console.error('Error sending zap:', error);
      toast({
        variant: "destructive",
        title: "Zap failed",
        description: error instanceof Error ? error.message : "Failed to send zap"
      });
    }
  };

  const copyVideoUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied",
        description: "Video URL copied to clipboard"
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Please try again"
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
                description: "Fetching latest videos..."
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
                {userSettings.bitcoinConnectEnabled && (
                  <button
                    onClick={() => handleZap(post)}
                    className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400"
                  >
                    <Zap size={20} />
                    <span>Zap</span>
                  </button>
                )}

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
                  onClick={() => copyVideoUrl(post.event.content)}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white"
                >
                  <Copy size={20} />
                  <span>Copy Link</span>
                </button>

                <button
                  onClick={() => downloadVideo(post.event.content, `animal-sunset-${post.event.id}.mp4`)}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white ml-auto"
                >
                  <Download size={20} />
                  <span>Download</span>
                </button>
              </div>

              {/* Comments Section */}
              <CommentSection
                comments={post.comments}
                highlightedCommentId={highlightedCommentId}
                onCommentClick={(comment) => {
                  setHighlightedCommentId(comment.id);
                }}
              />
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
            
            <div className="flex gap-3">
              <img
                src="/default-avatar.png"
                alt="Your avatar"
                className="w-8 h-8 rounded-full"
              />
              <textarea
                className="flex-1 bg-[#2a2a2a] rounded-lg p-3 text-white resize-none border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                rows={4}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write your comment..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleComment}
                disabled={publishingComment || !newComment.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {publishingComment ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Post Comment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
