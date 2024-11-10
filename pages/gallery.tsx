import { useState, useEffect } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { NostrEvent, AnimalKind, ProfileKind, Profile } from '../types/nostr';
import { useNostr } from '../contexts/NostrContext';
import { 
  publishToRelays, 
  fetchLightningDetails, 
  createZapInvoice, 
  publishComment,
  shareToNostr,
  DEFAULT_RELAY 
} from '../lib/nostr';
import { 
  Download, 
  MessageSquare, 
  Zap, 
  X, 
  Share2, 
  RefreshCw,
  Globe,
  Send
} from 'lucide-react';

interface VideoPost {
  event: AnimalKind;
  profile?: Profile;
  comments: Array<CommentPost>;
}

interface CommentPost {
  event: AnimalKind;
  profile?: Profile;
}

interface CommentThread {
  id: string;
  event: AnimalKind;
  profile?: Profile;
  replies: CommentThread[];
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
      variant: "destructive",
      title: "Download failed",
      description: "Please try again",
    });
  }
};

const formatPubkey = (pubkey: string) => {
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
};

// Recursive function to build comment threads
const buildCommentThread = (comments: CommentPost[]): CommentThread[] => {
  const threadMap = new Map<string, CommentThread>();
  const rootThreads: CommentThread[] = [];

  // First pass: create thread objects
  comments.forEach(comment => {
    threadMap.set(comment.event.id, {
      id: comment.event.id,
      event: comment.event,
      profile: comment.profile,
      replies: []
    });
  });

  // Second pass: build hierarchy
  comments.forEach(comment => {
    const replyTo = comment.event.tags.find(tag => tag[0] === 'e')?.[1];
    if (replyTo && threadMap.has(replyTo)) {
      const parentThread = threadMap.get(replyTo)!;
      const commentThread = threadMap.get(comment.event.id)!;
      parentThread.replies.push(commentThread);
    } else {
      const commentThread = threadMap.get(comment.event.id)!;
      rootThreads.push(commentThread);
    }
  });

  return rootThreads;
};

// Comment Thread Component
const CommentThreadComponent = ({ 
  thread, 
  onReply, 
  level 
}: { 
  thread: CommentThread; 
  onReply: (parentId: string) => void;
  level: number;
}) => {
  if (level >= 6) return null; // Limit nesting depth

  return (
    <div className="space-y-2">
      <div className="flex items-start space-x-3">
        <img
          src={thread.profile?.picture || "/default-avatar.png"}
          alt="Profile"
          className="w-8 h-8 rounded-full"
        />
        <div className="flex-1">
          <div className={`bg-[#2a2a2a] rounded-lg p-3 space-y-1`}>
            <div className="font-medium text-gray-300">
              {thread.profile?.name || formatPubkey(thread.event.pubkey)}
            </div>
            <div className="text-sm text-gray-200">
              {thread.event.content}
            </div>
          </div>
          <button
            onClick={() => onReply(thread.event.id)}
            className="text-sm text-gray-400 hover:text-white mt-1 ml-3"
          >
            Reply
          </button>
        </div>
      </div>
      
      {thread.replies.length > 0 && (
        <div className={`ml-8 space-y-2 border-l-2 border-gray-800 pl-4`}>
          {thread.replies.map(reply => (
            <CommentThreadComponent
              key={reply.id}
              thread={reply}
              onReply={onReply}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function Gallery() {
  const { pubkey, profile, connect } = useNostr();
  
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<VideoPost | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentParentId, setCommentParentId] = useState<string | null>(null);
  const [sendingZap, setSendingZap] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [shareText, setShareText] = useState('');

  useEffect(() => {
    if (pubkey) {
      fetchPosts();
    }
  }, [pubkey]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nostr/fetch-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relay: DEFAULT_RELAY,
          filters: [
            { kinds: [75757], limit: 50 }, // Main posts
            { kinds: [75757], limit: 200, '#e': [] }, // Comments
            { kinds: [0], limit: 100 } // Profiles
          ]
        })
      });

      if (!response.ok) throw new Error('Failed to fetch posts');

      const events = await response.json() as NostrEvent[];
      
      // Helper function to check if event is AnimalKind with specific tag condition
      const isAnimalKindWithTag = (event: NostrEvent, hasETag: boolean): event is AnimalKind => {
        if (event.kind !== 75757) return false;
        return event.tags.some(t => t[0] === 'e') === hasETag;
      };

      // Separate posts and comments
      const mainPosts = events.filter(e => isAnimalKindWithTag(e, false));
      const comments = events.filter(e => isAnimalKindWithTag(e, true));
      
      // Create profile map first
      const profileEvents = events.filter((e): e is ProfileKind => e.kind === 0);
      const profileMap = new Map<string, Profile>();
      
      profileEvents.forEach(e => {
        try {
          const profile = JSON.parse(e.content);
          profileMap.set(e.pubkey, {
            name: profile.name,
            picture: profile.picture,
            about: profile.about,
            lud06: profile.lud06,
            lud16: profile.lud16
          });
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      });

      // Convert comments to CommentPosts with profiles
      const commentPosts = comments.map(comment => ({
        event: comment,
        profile: profileMap.get(comment.pubkey)
      }));

      // Create VideoPosts with profiles and comments
      const posts: VideoPost[] = mainPosts.map(post => ({
        event: post,
        profile: profileMap.get(post.pubkey),
        comments: commentPosts.filter(c => 
          c.event.tags.find(t => t[0] === 'e')?.[1] === post.id
        )
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
      setProcessingAction('zap');
      
      const lnDetails = await fetchLightningDetails(post.event.pubkey);
      if (!lnDetails?.lud16 && !lnDetails?.lnurl) {
        throw new Error('No lightning address found for this user');
      }

      const lnAddress = lnDetails.lud16 || lnDetails.lnurl;

      if (lnAddress) {
        const amount = 1000; // 1000 sats
        const comment = `Zap for your Animal Sunset video!`;
        
        try {
          const paymentRequest = await createZapInvoice(lnAddress, amount, comment);
          
          // Create and copy invoice to clipboard
          await navigator.clipboard.writeText(paymentRequest);
          
          toast({
            title: "Invoice copied!",
            description: "Lightning invoice has been copied to your clipboard",
          });
        } catch (error) {
          console.error('Error sending zap:', error);
          toast({
            variant: "destructive",
            title: "Zap failed",
            description: error instanceof Error ? error.message : "Failed to send zap",
          });
        }
      } else {
        throw new Error('No lightning address found for this user');
      }
    } catch (error) {
      console.error('Error handling zap:', error);
      toast({
        variant: "destructive",
        title: "Zap failed",
        description: error instanceof Error ? error.message : "Failed to handle zap",
      });
    } finally {
      setSendingZap(false);
      setProcessingAction(null);
    }
  };
const handleComment = async () => {
  try {
    setProcessingAction('comment');

    if (selectedPost) {
      let parentId: number | undefined = undefined;
      if (commentParentId) {
        const parsedParentId = parseInt(commentParentId);
        if (!isNaN(parsedParentId)) {
          parentId = parsedParentId;
        }
      }

      await publishComment(selectedPost.event.id, newComment, parentId);

      // Refresh posts to show new comment
      await fetchPosts();

      toast({
        title: "Comment posted",
        description: "Your comment has been published",
      });
    } else {
      console.error('No selected post found');
      toast({
        variant: "destructive",
        title: "Comment failed",
        description: "No post selected",
      });
    }
  } catch (error) {
    console.error('Error posting comment:', error);
    toast({
      variant: "destructive",
      title: "Comment failed",
      description: "Failed to post comment",
    });
  } finally {
    setProcessingAction(null);
  }
};
  const handleShare = async (post: VideoPost) => {
    if (!pubkey) {
      toast({
        title: "Connect Required",
        description: "Please connect your Nostr account first",
        variant: "destructive"
      });
      return;
    }

    try {
      setProcessingAction('share');
      const note = shareText || 
        `Check out this Animal Sunset video!\n\n${post.event.tags.find(tag => tag[0] === 'title')?.[1]}\n#animalsunset`;
        
      await shareToNostr(note, post.event.content);
      
      setShowShareModal(false);
      setShareText('');
      
      toast({
        title: "Shared successfully",
        description: "Your note has been published to Nostr",
      });
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        variant: "destructive",
        title: "Share failed",
        description: "Failed to share to Nostr",
      });
    } finally {
      setProcessingAction(null);
    }
  };

  // Render login prompt if not connected
  if (!pubkey) {
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

      {/* Navigation Header */}
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
              <span>{profile.name || formatPubkey(pubkey)}</span>
            </div>
          )}
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
              disabled={sendingZap || processingAction === 'zap'}
              className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingAction === 'zap' ? (
                <RefreshCw className="animate-spin h-5 w-5" />
              ) : (
                <Zap size={20} />
              )}
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
              onClick={() => {
                setSelectedPost(post);
                setShareText(`Check out this Animal Sunset video!\n\n${post.event.tags.find(tag => tag[0] === 'title')?.[1]}\n`);
                setShowShareModal(true);
              }}
              className="flex items-center space-x-2 text-gray-400 hover:text-white"
            >
              <Share2 size={20} />
              <span>Share</span>
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
                {buildCommentThread(post.comments).map(thread => (
                  <CommentThreadComponent
                    key={thread.id}
                    thread={thread}
                    onReply={(parentId) => {
                      setSelectedPost(post);
                      setCommentParentId(parentId);
                      setShowCommentModal(true);
                    }}
                    level={0}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</div>

{/* Comment Modal */}
{showCommentModal && selectedPost && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
    <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">
          {commentParentId ? 'Reply to Comment' : 'Add Comment'}
        </h2>
        <button
          onClick={() => {
            setShowCommentModal(false);
            setCommentParentId(null);
          }}
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
          onClick={() => {
            setShowCommentModal(false);
            setCommentParentId(null);
          }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleComment}
          disabled={!newComment.trim() || processingAction === 'comment'}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {processingAction === 'comment' ? (
            <>
              <RefreshCw className="animate-spin h-5 w-5" />
              <span>Posting...</span>
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
{/* Share Modal */}
{showShareModal && selectedPost && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
    <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Share to Nostr</h2>
        <button
          onClick={() => setShowShareModal(false)}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <textarea
        className="w-full bg-[#2a2a2a] rounded-lg p-3 text-white resize-none border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
        rows={4}
        value={shareText}
        onChange={(e) => setShareText(e.target.value)}
        placeholder="Add a note..."
      />

      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setShowShareModal(false)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => handleShare(selectedPost)}
          disabled={!shareText.trim() || processingAction === 'share'}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {processingAction === 'share' ? (
            <>
              <RefreshCw className="animate-spin h-5 w-5" />
              <span>Sharing...</span>
            </>
          ) : (
            <>
              <Globe size={16} />
              <span>Share to Nostr</span>
            </>
          )}
        </button>
      </div>
    </div>
  </div>
)}
</div>
