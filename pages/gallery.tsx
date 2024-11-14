// pages/gallery.tsx

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { Profile, NostrEvent } from '../types/nostr';
import { useNostr } from '../contexts/NostrContext';
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
import { publishVideo, shareToNostr, fetchEvents, publishComment } from '../lib/nostr'; // Import necessary functions
import { ShareDialog } from '../components/ShareDialog'; // Corrected import for named export

const ANIMAL_KIND = 75757;
const PROFILE_KIND = 0;
const NOTE_KIND = 1;

interface VideoPost {
  event: NostrEvent;
  profile?: Profile;
  comments: Array<CommentPost>;
}

interface CommentPost {
  event: NostrEvent;
  profile?: Profile;
}

export default function Gallery() {
  const { pubkey, profile: userProfile, connect } = useNostr();
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<VideoPost | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [newComment, setNewComment] = useState('');
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
      setError(null);

      // Fetch main events (animal videos)
      let mainEventsSet = await fetchEvents({
        kinds: [ANIMAL_KIND],
        limit: 50
      });

      if (!mainEventsSet) {
        throw new Error('No events returned from relay');
      }

      // Convert Set to Array and filter out events without an ID
      const mainEvents = Array.from(mainEventsSet).filter((event): event is NostrEvent & { id: string } => !!event.id);

      // Fetch comments related to main events
      let commentEventsSet = await fetchEvents({
        kinds: [NOTE_KIND], // Assuming comments are of kind NOTE_KIND
        limit: 200,
        '#e': mainEvents.map(event => event.id)
      });

      const commentEvents = commentEventsSet ? Array.from(commentEventsSet).filter((comment): comment is NostrEvent & { id: string } => !!comment.id) : [];

      // Collect all pubkeys from main events and comments
      const profilePubkeys = new Set<string>();
      mainEvents.forEach(event => profilePubkeys.add(event.pubkey));
      commentEvents.forEach(event => profilePubkeys.add(event.pubkey));

      // Fetch profile events
      const profileEventsSet = await fetchEvents({
        kinds: [PROFILE_KIND],
        authors: Array.from(profilePubkeys)
      });

      const profileEvents = profileEventsSet ? Array.from(profileEventsSet) : [];

      const profileMap = new Map<string, Profile>();
      profileEvents.forEach(event => {
        const profile = parseProfile(event.content);
        if (profile) {
          profileMap.set(event.pubkey, profile);
        }
      });

      const processedPosts = mainEvents.map(event => ({
        event,
        profile: profileMap.get(event.pubkey),
        comments: commentEvents
          .filter(comment =>
            comment.tags?.some(tag => tag[0] === 'e' && tag[1] === event.id) ?? false
          )
          .map(comment => ({
            event: comment,
            profile: profileMap.get(comment.pubkey)
          }))
      }));

      // Filter out posts without .mp4 URLs
      const filteredPosts = processedPosts.filter(post => post.event.content && post.event.content.includes('.mp4'));

      // Deduplicate posts based on video URL
      const uniquePostsMap = new Map<string, VideoPost>();
      filteredPosts.forEach(post => {
        if (!uniquePostsMap.has(post.event.content)) {
          uniquePostsMap.set(post.event.content, post as VideoPost); // Type assertion is safe here
        }
      });
      const uniquePosts = Array.from(uniquePostsMap.values());

      // Sort posts chronologically, newest first
      uniquePosts.sort((a, b) => b.event.created_at - a.event.created_at);

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

  const parseProfile = (content: string): Profile | undefined => {
    try {
      const parsed = JSON.parse(content);
      return {
        name: parsed.name,
        picture: parsed.picture,
        about: parsed.about,
        lud06: parsed.lud06,
        lud16: parsed.lud16,
        lnurl: parsed.lud06, // Adjust if lnurl is stored differently
      };
    } catch (e) {
      console.error('Error parsing profile:', e);
      return undefined;
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

    if (!post.profile?.lnurl) {
      toast({
        variant: "destructive",
        title: "Zap Failed",
        description: "Author has not set up an LNURL for receiving Zaps.",
      });
      return;
    }

    try {
      setSendingZap(true);
      setProcessingAction('zap');

      // Fetch the lightning invoice using the author's LNURL
      const lnurlResponse = await fetch(post.profile.lnurl);
      if (!lnurlResponse.ok) {
        throw new Error(`Failed to fetch LNURL endpoint: ${lnurlResponse.statusText}`);
      }

      const lnurlData = await lnurlResponse.json();
      if (lnurlData.status !== 'OK') {
        throw new Error(`LNURL endpoint returned an error: ${lnurlData.reason || 'Unknown reason'}`);
      }

      const paymentRequest: string = lnurlData.pr; // 'pr' is the payment request

      if (!paymentRequest) {
        throw new Error('No payment request found in LNURL response');
      }

      // Copy the payment request to clipboard
      try {
        await navigator.clipboard.writeText(paymentRequest);
        toast({
          title: "Zap Invoice Copied!",
          description: "Lightning invoice has been copied to your clipboard"
        });
      } catch (clipboardError) {
        console.error('Clipboard copy failed:', clipboardError);
        toast({
          variant: "destructive",
          title: "Copy Failed",
          description: "Please manually copy the invoice."
        });
      }

      // Optionally, open the user's lightning wallet with the payment request
      // Example:
      // window.location.href = `lightning:${paymentRequest}`;
      
      toast({
        title: "Zap Initiated",
        description: "Please complete the payment using your lightning wallet.",
      });

      // Monitoring payment status can be implemented here if desired
    } catch (error) {
      console.error('Error sending zap:', error);
      toast({
        variant: "destructive",
        title: "Zap failed",
        description: error instanceof Error ? error.message : "Failed to send zap"
      });
    } finally {
      setSendingZap(false);
      setProcessingAction(null);
    }
  };

  const handleComment = async () => {
    if (!selectedPost || !newComment.trim() || !pubkey) {
      toast({
        variant: "destructive",
        title: "Cannot post comment",
        description: "Please make sure you are connected to Nostr"
      });
      return;
    }

    try {
      setProcessingAction('comment');
      
      const commentContent = newComment.trim();
      const parentId = selectedPost.event.id;

      // Publish the comment
      await publishComment(commentContent, parentId);

      setShowCommentModal(false);
      setNewComment('');
      
      await fetchPosts();

      toast({
        title: "Comment posted",
        description: "Your comment has been published"
      });

      // Scroll to the commented post
      setTimeout(() => {
        const postElement = document.getElementById(`post-${selectedPost.event.id}`);
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        variant: "destructive",
        title: "Comment failed",
        description: "Failed to post comment"
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleShare = async (post: VideoPost) => {
    if (!pubkey) {
      toast({
        variant: "destructive",
        title: "Cannot share",
        description: "Please make sure you are connected to Nostr"
      });
      return;
    }

    try {
      setProcessingAction('share');

      const shareContent = `Check out this Animal Sunset video!\n\n${post.event.tags?.find(tag => tag[0] === 'title')?.[1] || 'Untitled'}\n${post.event.content}\n#animalsunset`;

      await shareToNostr(shareContent, post.event.content);

      toast({
        title: "Shared successfully",
        description: "Your note has been published to Nostr"
      });

      // Additional logic after sharing, e.g., updating UI
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        variant: "destructive",
        title: "Share failed",
        description: error instanceof Error ? error.message : "Failed to share to Nostr"
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch video');
      
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
          {userProfile && (
            <div className="flex items-center space-x-2">
              {userProfile.picture ? (
                <img
                  src={userProfile.picture}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-avatar.png';
                  }}
                />
              ) : (
                <img
                  src="/default-avatar.png"
                  alt="Default Profile"
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span>{userProfile.name || "Anonymous"}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Animal Gallery</h1>
          <button
            onClick={fetchPosts}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            disabled={loading}
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
              <div key={post.event.id} className="bg-[#1a1a1a] rounded-lg overflow-hidden" id={`post-${post.event.id}`}>
                <div className="p-4 flex items-center space-x-3">
                  {post.profile?.picture ? (
                    <img
                      src={post.profile.picture}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-avatar.png';
                      }}
                    />
                  ) : (
                    <img
                      src="/default-avatar.png"
                      alt="Default Profile"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <div className="font-medium">
                      {post.profile?.name || "Anonymous"}
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(post.event.created_at * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="relative pt-[56.25%] bg-black">
                  <video
                    src={post.event.content}
                    className="absolute top-0 left-0 w-full h-full object-contain"
                    controls
                    loop
                    playsInline
                    onError={() => {
                      toast({
                        variant: "destructive",
                        title: "Video Load Failed",
                        description: "Failed to load the video. Please try again.",
                      });
                    }}
                  />
                </div>

                <div className="p-4 pb-2">
                  <p className="text-lg font-medium">
                    {post.event.tags?.find(tag => tag[0] === 'title')?.[1] || 'Untitled'}
                  </p>
                </div>

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
                      setShareText(`Check out this Animal Sunset video!\n\n${post.event.tags?.find(tag => tag[0] === 'title')?.[1] || 'Untitled'}\n${post.event.content}\n#animalsunset`);
                      setShowShareModal(true);
                    }}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white"
                  >
                    <Share2 size={20} />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={() => handleDownload(post.event.content, `animal-sunset-${post.event.id}.mp4`)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white ml-auto"
                  >
                    <Download size={20} />
                    <span>Download</span>
                  </button>
                </div>

                {post.comments.length > 0 && (
                  <div className="border-t border-gray-800">
                    <div className="p-4 space-y-4">
                      {post.comments.map(comment => (
                        <div key={comment.event.id} className="flex items-start space-x-3">
                          {comment.profile?.picture ? (
                            <img
                              src={comment.profile.picture}
                              alt="Commenter"
                              className="w-8 h-8 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/default-avatar.png';
                              }}
                            />
                          ) : (
                            <img
                              src="/default-avatar.png"
                              alt="Default Profile"
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <div className="flex-1 bg-[#2a2a2a] rounded-lg p-3">
                            <div className="font-medium text-gray-300 mb-1">
                              {comment.profile?.name || "Anonymous"}
                            </div>
                            <div className="text-sm text-gray-200">
                              {comment.event.content}
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
        )}
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
              className="w-full bg-[#2a2a2a] rounded-lg p-3 text-white resize-none 
                       border border-gray-700 focus:border-purple-500 focus:ring-2 
                       focus:ring-purple-500"
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
                onClick={handleComment}
                disabled={!newComment.trim() || processingAction === 'comment'}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 
                         disabled:cursor-not-allowed text-white font-semibold py-2 px-4 
                         rounded-lg transition-colors flex items-center space-x-2"
              >
                {processingAction === 'comment' ? (
                  <>
                    <RefreshCw className="animate-spin h-4 w-4" />
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

      {/* Share Dialog Component */}
      {showShareModal && selectedPost && (
        <ShareDialog
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          videoUrl={selectedPost.event.content}
          prompt={selectedPost.event.tags?.find(tag => tag[0] === 'title')?.[1] || 'Untitled'}
          isPublic={true} // Or derive from user settings if applicable
          onShare={handleShare}
        />
      )}
    </div>
  );
}
