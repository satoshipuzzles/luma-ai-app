import { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  Check,
  Copy
} from 'lucide-react';
import QRCode from 'qrcode.react';

// ... (Other imports and type definitions)

interface NostrModalData {
  videoUrl: string;
  author: string;
  prompt: string;
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

      // Filter out events without video URLs
      const filteredEvents = events.filter(event => event.content && event.content.trim() !== '');

      // Remove duplicate video URLs
      const uniqueEventsMap = new Map<string, AnimalKind>();
      for (const event of filteredEvents) {
        if (!uniqueEventsMap.has(event.content)) {
          uniqueEventsMap.set(event.content, event);
        }
      }
      const uniqueEvents = Array.from(uniqueEventsMap.values());

      // Group comments with their parent posts
      const postsMap = new Map<string, VideoPost>();

      for (const event of uniqueEvents) {
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

      // Fetch profiles for all unique pubkeys in parallel
      const uniquePubkeys = Array.from(new Set(events.map(event => event.pubkey)));
      const profilePromises = uniquePubkeys.map(async (pubkey) => {
        if (profileCache.current.has(pubkey)) {
          return { pubkey, profile: profileCache.current.get(pubkey) };
        } else {
          const profileEvent = await fetchProfile(pubkey);
          if (profileEvent) {
            try {
              const profileContent = JSON.parse(profileEvent.content);
              const profile: Profile = {
                name: profileContent.name,
                picture: profileContent.picture,
                about: profileContent.about
              };
              profileCache.current.set(pubkey, profile);
              return { pubkey, profile };
            } catch (error) {
              console.error(`Error parsing profile for pubkey ${pubkey}:`, error);
              return { pubkey, profile: undefined };
            }
          }
          return { pubkey, profile: undefined };
        }
      });

      const profilesData = await Promise.all(profilePromises);
      const profileMap = new Map<string, Profile>();
      profilesData.forEach(({ pubkey, profile }) => {
        if (profile) {
          profileMap.set(pubkey, profile);
        }
      });

      // Assign profiles to posts
      const postsArray = Array.from(postsMap.values()).map(post => ({
        ...post,
        profile: profileMap.get(post.event.pubkey)
      }));

      // Sort posts by created_at descending (newest first)
      postsArray.sort((a, b) => (b.event.created_at || 0) - (a.event.created_at || 0));

      setPosts(postsArray);
      toast({
        title: "Gallery updated",
        description: `Loaded ${postsArray.length} videos`,
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
      
      setCurrentZap({ payment_request, payment_hash });
      toast({
        title: "Zap Invoice Generated",
        description: "Scan the QR code to complete the payment.",
        duration: 3000
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
          ['t', 'animalsunset'] // Hashtag
        ],
        content,
      };

      commentEvent.id = getEventHash(commentEvent as Event);
      const signedCommentEvent = await window.nostr.signEvent(commentEvent as Event);

      const relayConnections = DEFAULT_RELAY_URLS.map((url) => relayInit(url));

      await Promise.all(
        relayConnections.map((relay) => {
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
        })
      );

      relayConnections.forEach(relay => relay.close());
    } catch (err) {
      console.error('Error publishing comment to Nostr:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!currentZap) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/check-lnbits-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentHash: currentZap.payment_hash }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.paid) {
            toast({
              title: "Zap Successful",
              description: "Thank you for your support!",
              duration: 3000
            });
            setCurrentZap(null);
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Error checking zap payment:', error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [currentZap]);

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
          {/* Assuming you have access to the signed-in user's pubkey */}
          {/* Replace 'currentUserPubkey' with actual pubkey */}
          {currentUserProfile && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-700 rounded-lg"
                aria-label="Settings"
              >
                <Settings size={20} />
              </button>
              {currentUserProfile.picture ? (
                <img
                  src={currentUserProfile.picture}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <DefaultAvatar />
              )}
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

        <div className="space-y-8">
          {posts.map(post => (
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
                {isValidUrl(post.event.content) ? (
                  <video
                    src={post.event.content}
                    className="absolute top-0 left-0 w-full h-full object-contain"
                    controls
                    loop
                    playsInline
                    onError={(e) => {
                      console.error(`Failed to load video: ${post.event.content}`);
                      toast({
                        variant: "destructive",
                        title: "Video Load Error",
                        description: "Failed to load the video. Please try again later.",
                      });
                    }}
                  />
                ) : (
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-red-500">
                    Invalid Video URL
                  </div>
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
                      prompt: post.event.tags.find(tag => tag[0] === 'title')?.[1] || ''
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
          ))}
        </div>
      </div>

      {/* Zap Modal */}
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
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(currentZap.payment_request);
                    setHasCopiedZap(true);
                    toast({
                      title: "Copied",
                      description: "Invoice copied to clipboard",
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
                }}
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
              onChange={(e) => setNoteContent(e.target.value)}
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
                      `${showNostrModal.prompt}\n#animalsunset`,
                      userSettings.publicGenerations,
                      showNostrModal.videoUrl, // Assuming videoUrl is unique and used as eventId
                      pubkey!,
                      showNostrModal.author
                    );
                    setShowNostrModal(null);
                    setNoteContent('');
                  } catch (error) {
                    setPublishError(error instanceof Error ? error.message : "Failed to publish");
                  }
                }}
                disabled={false} // Adjust based on your logic
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
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
                    await publishComment(selectedPost.event.id, newComment.trim(), pubkey!);
                    await fetchPosts(); // Refresh posts to include the new comment
                    setSelectedPost(prev => prev ? { ...prev, comments: [...prev.comments, /* new comment */] } : prev);
                    setShowCommentModal(false);
                    setNewComment('');
                    toast({
                      title: "Comment posted",
                      description: "Your comment has been published",
                      duration: 2000
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
        pubkey={pubkey}
        onSettingsChange={setUserSettings}
      />
    </div>
  );
}
