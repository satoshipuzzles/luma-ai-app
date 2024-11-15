// pages/gallery.tsx

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { toast } from "@/components/ui/use-toast";
import { Navigation } from '../components/Navigation';
import { fetchAnimalVideos, processVideoPosts, VideoPost } from '../lib/gallery';
import { 
  Download, 
  MessageSquare, 
  Zap, 
  X, 
  Share2, 
  RefreshCw,
  Check,
  Copy
} from 'lucide-react';
import QRCode from 'qrcode.react';
import SettingsModal from '../components/SettingsModal'; // Ensure you have this component

interface Profile {
  name?: string;
  picture?: string;
  about?: string;
}

export default function Gallery() {
  // State Variables
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedPost, setSelectedPost] = useState<VideoPost | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [sendingZap, setSendingZap] = useState(false);
  const [currentZap, setCurrentZap] = useState<{ payment_request: string; payment_hash: string } | null>(null);
  const [hasCopiedZap, setHasCopiedZap] = useState(false);
  const [showNostrModal, setShowNostrModal] = useState<{ videoUrl: string; author: string; prompt: string } | null>(null);
  const [publishError, setPublishError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Replace this with actual user authentication to get the pubkey
  const currentUserPubkey = 'USER_PUBKEY_HERE'; // Example pubkey
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  
  const profileCache = useRef<Map<string, Profile>>(new Map());

  useEffect(() => {
    // Fetch the current user's profile
    const loadCurrentUserProfile = async () => {
      if (currentUserPubkey) {
        try {
          const { fetchProfile } = await import('../lib/nostr');
          const profileEvent = await fetchProfile(currentUserPubkey);
          if (profileEvent) {
            const profileContent = JSON.parse(profileEvent.content);
            const profile: Profile = {
              name: profileContent.name,
              picture: profileContent.picture,
              about: profileContent.about,
            };
            setCurrentUserProfile(profile);
            profileCache.current.set(currentUserPubkey, profile);
          }
        } catch (error) {
          console.error('Error loading current user profile:', error);
        }
      }
    };

    loadCurrentUserProfile();
  }, [currentUserPubkey]);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const events = await fetchAnimalVideos();
      const processedPosts = await processVideoPosts(events);
      setPosts(processedPosts);
      toast({
        title: "Gallery updated",
        description: `Loaded ${processedPosts.length} videos`,
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

  /**
   * Handles the Zap action by generating a Lightning invoice and displaying it to the user.
   * @param post - The video post to zap.
   */
  const handleZap = async (post: VideoPost) => {
    setSendingZap(true);
    try {
      const { fetchLightningAddress } = await import('../lib/nostr');
      const lnAddress = await fetchLightningAddress(post.event.pubkey);
      if (!lnAddress) {
        throw new Error('No Lightning Address found for this user');
      }

      const response = await fetch('/api/create-lnbits-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1000, // Satoshis
          lnAddress,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }

      const { payment_request, payment_hash } = await response.json();

      setCurrentZap({ payment_request, payment_hash });
      toast({
        title: "Zap Invoice Generated",
        description: "Scan the QR code to complete the payment.",
        duration: 3000,
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

  /**
   * Publishes a comment to Nostr, referencing the parent post.
   * @param parentId - The ID of the parent post.
   * @param content - The content of the comment.
   * @param pubkey - The public key of the commenter.
   */
  const publishComment = async (parentId: string, content: string, pubkey: string): Promise<void> => {
    if (!window.nostr) {
      throw new Error('Nostr extension not found');
    }

    try {
      const commentEvent: Partial<Event> = {
        kind: 1, // Assuming kind 1 is for comments
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', parentId], // Reference to the parent post
          ['t', 'animalsunset'], // Hashtag
        ],
        content,
      };

      commentEvent.id = getEventHash(commentEvent as Event);
      const signedCommentEvent = await window.nostr.signEvent(commentEvent as Event);

      const relayUrls = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com']; // Add more relays as needed
      const relays = relayUrls.map(url => relayInit(url));

      await Promise.all(relays.map(relay => {
        return new Promise<void>((resolve, reject) => {
          relay.on('connect', async () => {
            try {
              await relay.publish(signedCommentEvent);
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
      }));

      relays.forEach(relay => relay.close());
    } catch (err) {
      console.error('Error publishing comment to Nostr:', err);
      throw err;
    }
  };

  /**
   * Publishes an event to Nostr.
   * @param videoUrl - The URL of the video.
   * @param prompt - The prompt used to generate the video.
   * @param isPublic - Whether the event should be public.
   * @param pubkey - The public key of the publisher.
   * @param authorPubkey - The public key of the author to tag.
   */
  const publishToNostr = async (
    videoUrl: string, 
    prompt: string, 
    isPublic: boolean,
    pubkey: string,
    authorPubkey: string
  ): Promise<void> => {
    if (!window.nostr) {
      throw new Error('Nostr extension not found');
    }

    try {
      // Create the main event (kind 75757)
      const mainEvent: Partial<Event> = {
        kind: 75757,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['title', prompt],
          ['r', videoUrl],
          ['p', authorPubkey], // Tagging the author
          ['t', 'animalsunset'], // Hashtag
        ],
        content: `${prompt}\n#animalsunset`,
      };

      mainEvent.id = getEventHash(mainEvent as Event);
      const signedMainEvent = await window.nostr.signEvent(mainEvent as Event);

      // Publish the event to relays
      const relayUrls = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com']; // Add more relays as needed
      const relays = relayUrls.map(url => relayInit(url));

      await Promise.all(relays.map(relay => {
        return new Promise<void>((resolve, reject) => {
          relay.on('connect', async () => {
            try {
              await relay.publish(signedMainEvent);
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
      }));

      relays.forEach(relay => relay.close());

      toast({
        title: "Published to Nostr",
        description: "Your video has been shared successfully",
        duration: 2000,
      });
    } catch (err) {
      console.error('Error publishing to Nostr:', err);
      throw new Error('Failed to publish note. Please try again.');
    }
  };

  /**
   * Downloads a video from the given URL.
   * @param url - The URL of the video.
   * @param filename - The desired filename for the downloaded video.
   */
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
        duration: 2000,
      });
    } catch (err) {
      console.error('Download failed:', err);
      toast({
        title: "Download failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  /**
   * Handles copying the Zap invoice to the clipboard.
   */
  const handleCopyZap = async () => {
    if (currentZap?.payment_request) {
      try {
        await navigator.clipboard.writeText(currentZap.payment_request);
        setHasCopiedZap(true);
        toast({
          title: "Copied",
          description: "Invoice copied to clipboard",
          duration: 2000,
        });
        setTimeout(() => setHasCopiedZap(false), 2000);
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
          {/* Display signed-in user's profile */}
          {currentUserProfile && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-700 rounded-lg"
                aria-label="Settings"
              >
                <X size={20} />
              </button>
              {currentUserProfile.picture ? (
                <img
                  src={currentUserProfile.picture}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                  <span className="text-white text-sm">
                    {currentUserProfile.name ? currentUserProfile.name.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>
              )}
              <span>{currentUserProfile.name || 'Anonymous'}</span>
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

        {/* Gallery Feed */}
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
              <div key={post.event.id} id={`post-${post.event.id}`} className="bg-[#1a1a1a] rounded-lg overflow-hidden">
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
                  {post.event.content && (
                    <video
                      src={post.event.content}
                      className="absolute top-0 left-0 w-full h-full object-contain"
                      controls
                      loop
                      playsInline
                      onError={() => {
                        toast({
                          variant: "destructive",
                          title: "Video Load Error",
                          description: "Failed to load the video.",
                        });
                      }}
                    />
                  )}
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

                  <button
                    onClick={() => {
                      setShowNostrModal({
                        videoUrl: post.event.content,
                        author: post.event.pubkey,
                        prompt: post.event.tags.find(tag => tag[0] === 'title')?.[1] || '',
                      });
                    }}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white"
                  >
                    <Share2 size={20} />
                    <span>Share</span>
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
            ))
          )}
        </div>
      </div>

      {/* Zap Invoice Modal */}
      {currentZap && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-sm w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Complete Your Zap</h2>
              <button
                onClick={() => setCurrentZap(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-300">Scan the QR code below to send your zap.</p>
            
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCode 
                value={currentZap.payment_request} 
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="flex items-center gap-2 bg-[#2a2a2a] p-2 rounded-lg">
              <input
                type="text"
                value={currentZap.payment_request}
                readOnly
                className="flex-1 bg-transparent text-sm text-gray-400 overflow-hidden overflow-ellipsis"
              />
              <button
                onClick={handleCopyZap}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1"
              >
                {hasCopiedZap ? <Check size={16} /> : <Copy size={16} />}
                {hasCopiedZap ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              onClick={() => setCurrentZap(null)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Nostr Share Modal */}
      {showNostrModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Share on Nostr</h2>
              <button
                onClick={() => setShowNostrModal(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition duration-200"
              rows={4}
              value={`${showNostrModal.prompt}\n#animalsunset\n${showNostrModal.videoUrl}`}
              onChange={() => {}}
              placeholder="Write your note..."
              readOnly
            />
            {publishError && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                {publishError}
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-2">
              <button
                onClick={() => setShowNostrModal(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await publishToNostr(
                      showNostrModal.videoUrl,
                      showNostrModal.prompt,
                      true, // Assuming public share
                      currentUserPubkey,
                      showNostrModal.author
                    );
                    setShowNostrModal(null);
                    toast({
                      title: "Published to Nostr",
                      description: "Your share has been published successfully",
                      duration: 2000,
                    });
                  } catch (error) {
                    setPublishError(error instanceof Error ? error.message : "Failed to publish");
                  }
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && selectedPost && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Add Comment</h2>
              <button
                onClick={() => setShowCommentModal(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
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

            {publishError && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                {publishError}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newComment.trim()) return;
                  try {
                    await publishComment(selectedPost.event.id, newComment.trim(), currentUserPubkey);
                    await fetchPosts(); // Refresh posts to include the new comment
                    setShowCommentModal(false);
                    setNewComment('');
                    toast({
                      title: "Comment posted",
                      description: "Your comment has been published",
                      duration: 2000,
                    });
                  } catch (error) {
                    console.error('Error posting comment:', error);
                    setPublishError(error instanceof Error ? error.message : "Failed to post comment");
                  }
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        pubkey={currentUserPubkey}
        onSettingsChange={() => { /* Implement settings change handler */ }}
      />
    }
  
    // Helper component for Default Avatar
    const DefaultAvatar = () => (
      <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
        <span className="text-white text-sm">
          U
        </span>
      </div>
    );
}
