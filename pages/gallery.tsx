// pages/gallery.tsx

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Event, Filter, getEventHash } from 'nostr-tools';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  Download,
  MessageSquare,
  Zap,
  Share2,
  RefreshCw,
  X,
  Check,
  Copy,
} from 'lucide-react';
import QRCode from 'qrcode.react';
import NDK from '@nostr-dev-kit/ndk'; // Corrected import

// TypeScript Interfaces
interface AnimalKind extends Event {
  kind: 75757;
  content: string; // Video URL
}

interface Profile {
  name?: string;
  picture?: string;
  about?: string;
  lud06?: string;
  lud16?: string;
}

interface VideoPost {
  event: AnimalKind;
  profile?: Profile;
  comments: Event[];
}

interface ZapInvoice {
  payment_request: string;
  payment_hash: string;
}

export default function Gallery() {
  // State Variables
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<VideoPost | null>(null);
  const [showCommentModal, setShowCommentModal] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [currentZap, setCurrentZap] = useState<ZapInvoice | null>(null);
  const [hasCopiedZap, setHasCopiedZap] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<{
    videoUrl: string;
    authorPubkey: string;
    prompt: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [lightningWallet, setLightningWallet] = useState<string | null>(null);

  // Initialize NDK
  const ndk = new NDK();

  useEffect(() => {
    const initializeNDK = async () => {
      try {
        await ndk.connect(); // Establish connection to relays
        // You can subscribe to events or perform other initializations here
      } catch (err) {
        console.error('Error initializing NDK:', err);
        toast.error('Failed to initialize NDK.');
      }
    };

    initializeNDK();
  }, [ndk]);

  // Placeholder for user pubkey; replace with actual authentication logic
  const userPubkey = 'USER_PUBKEY_HERE';

  // Fetch User Profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const profile = await fetchProfile(userPubkey);
        setUserProfile(profile);
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    if (userPubkey) {
      fetchUserProfile();
    }
  }, [userPubkey]);

  // Fetch and Process Animal Videos
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const events = await fetchAnimalVideos();
        const processedPosts = await processVideoPosts(events);
        setPosts(processedPosts);
      } catch (err) {
        setError('Failed to load gallery.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  // Function to Fetch Profile
  const fetchProfile = async (pubkey: string): Promise<Profile | null> => {
    const filters: Filter[] = [
      {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      },
    ];

    try {
      const events = await ndk.relayPool.getEvents(filters);
      if (events.length === 0) return null;

      const profileData = JSON.parse(events[0].content);
      return {
        name: profileData.name,
        picture: profileData.picture,
        about: profileData.about,
        lud06: profileData.lud06,
        lud16: profileData.lud16,
      };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  // Function to Fetch Animal Videos
  const fetchAnimalVideos = async (): Promise<AnimalKind[]> => {
    const filters: Filter[] = [
      {
        kinds: [75757],
        limit: 50,
      },
    ];

    try {
      const events = await ndk.relayPool.getEvents(filters);
      return events as AnimalKind[];
    } catch (error) {
      console.error('Error fetching animal videos:', error);
      return [];
    }
  };

  // Function to Process Video Posts
  const processVideoPosts = async (
    events: AnimalKind[]
  ): Promise<VideoPost[]> => {
    const postsMap = new Map<string, VideoPost>();

    // Initialize posts map
    events.forEach((event) => {
      postsMap.set(event.id, {
        event,
        profile: undefined,
        comments: [],
      });
    });

    // Fetch profiles
    const uniquePubkeys = Array.from(
      new Set(events.map((event) => event.pubkey))
    );
    const profilePromises = uniquePubkeys.map((pubkey) => fetchProfile(pubkey));
    const profiles = await Promise.all(profilePromises);

    // Assign profiles
    profiles.forEach((profile, index) => {
      const pubkey = uniquePubkeys[index];
      if (profile) {
        events
          .filter((event) => event.pubkey === pubkey)
          .forEach((event) => {
            const post = postsMap.get(event.id);
            if (post) {
              post.profile = profile;
            }
          });
      }
    });

    // Fetch comments for each post
    const commentPromises = Array.from(postsMap.values()).map(
      async (post) => {
        const comments = await fetchComments(post.event.id);
        post.comments = comments;
      }
    );
    await Promise.all(commentPromises);

    return Array.from(postsMap.values());
  };

  // Function to Fetch Comments
  const fetchComments = async (parentId: string): Promise<Event[]> => {
    const filters: Filter[] = [
      {
        kinds: [1], // Assuming kind 1 is for comments
        '#e': [parentId],
        limit: 50,
      },
    ];

    try {
      const events = await ndk.relayPool.getEvents(filters);
      return events;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  };

  // Handle Refresh Gallery
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const events = await fetchAnimalVideos();
      const processedPosts = await processVideoPosts(events);
      setPosts(processedPosts);
      toast.success(`Gallery refreshed. Loaded ${processedPosts.length} videos.`);
    } catch (err) {
      setError('Failed to refresh gallery.');
      toast.error('Failed to refresh gallery.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Zap Action
  const handleZap = async (post: VideoPost) => {
    try {
      if (!lightningWallet) {
        toast.error('Please connect your Lightning wallet first.');
        return;
      }

      // Retrieve the author's LNURL-pay endpoint
      const lnurlPay = post.profile?.lud16 || post.profile?.lud06;
      if (!lnurlPay) {
        toast.error('Author has not set up LNURL-pay.');
        return;
      }

      // Generate LNURL-pay link (Assuming the author has set up an LNURL-pay)
      const lnurl = `lightning:${lnurlPay}`;

      // Redirect user to their Lightning wallet with the LNURL-pay link
      window.location.href = lnurl;
      toast.success('Redirecting to your Lightning wallet for Zap.');
    } catch (err) {
      toast.error('Failed to send Zap.');
      console.error(err);
    }
  };

  // Handle Copy Zap Invoice
  const handleCopyZap = async () => {
    if (currentZap?.payment_request) {
      try {
        await navigator.clipboard.writeText(currentZap.payment_request);
        setHasCopiedZap(true);
        toast.success('Invoice copied to clipboard.');
        setTimeout(() => setHasCopiedZap(false), 2000);
      } catch (err) {
        toast.error('Failed to copy invoice.');
        console.error(err);
      }
    }
  };

  // Handle Download Video
  const handleDownload = async (videoUrl: string, filename: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started.');
    } catch (err) {
      toast.error('Failed to download video.');
      console.error(err);
    }
  };

  // Handle Share Action
  const handleShare = (post: VideoPost) => {
    setShowShareModal({
      videoUrl: post.event.content,
      authorPubkey: post.event.pubkey,
      prompt:
        post.event.tags.find((tag) => tag[0] === 'title')?.[1] || '',
    });
  };

  // Publish Share to Nostr
  const publishShare = async () => {
    if (!showShareModal) return;

    const { videoUrl, authorPubkey, prompt } = showShareModal;

    try {
      // Create a new Nostr event for sharing
      const shareEvent: Event = {
        kind: 1, // General kind
        tags: [
          ['t', 'animalsunset'],
          ['r', videoUrl],
        ],
        content: prompt,
        pubkey: userPubkey,
        created_at: Math.floor(Date.now() / 1000),
        sig: '', // Will be signed by Nostr wallet
      };

      // Sign the event
      const signedEvent = await signEvent(shareEvent);
      if (!signedEvent) throw new Error('Failed to sign event.');

      // Publish the event
      await publishToRelays(signedEvent);

      toast.success('Video shared successfully!');
      setShowShareModal(null);
    } catch (err) {
      toast.error('Failed to share video.');
      console.error(err);
    }
  };

  // Handle Comment Action
  const handleComment = async () => {
    if (!newComment.trim() || !selectedPost) return;

    try {
      // Create a new comment event
      const commentEvent: Event = {
        kind: 1, // Assuming kind 1 is for comments
        tags: [
          ['e', selectedPost.event.id],
          ['t', 'animalsunset'],
        ],
        content: newComment.trim(),
        pubkey: userPubkey,
        created_at: Math.floor(Date.now() / 1000),
        sig: '', // Will be signed by Nostr wallet
      };

      // Sign the event
      const signedComment = await signEvent(commentEvent);
      if (!signedComment) throw new Error('Failed to sign comment.');

      // Publish the comment
      await publishToRelays(signedComment);

      toast.success('Comment posted successfully!');
      setShowCommentModal(false);
      setNewComment('');

      // Refresh comments for the selected post
      const updatedPosts = posts.map((post) => {
        if (post.event.id === selectedPost.event.id) {
          return {
            ...post,
            comments: [...post.comments, signedComment],
          };
        }
        return post;
      });
      setPosts(updatedPosts);
    } catch (err) {
      toast.error('Failed to post comment.');
      console.error(err);
    }
  };

  // Function to Sign Event
  const signEvent = async (event: Event): Promise<Event | null> => {
    if (typeof window === 'undefined' || !window.nostr) {
      toast.error('Nostr extension not found.');
      return null;
    }

    try {
      const signedEvent = (await window.nostr.signEvent(event)) as Event;
      return signedEvent;
    } catch (err) {
      console.error('Error signing event:', err);
      return null;
    }
  };

  // Function to Publish Event to Relays using NDK
  const publishToRelays = async (event: Event): Promise<void> => {
    try {
      await ndk.publish(event);
    } catch (err) {
      console.error('Error publishing to relays:', err);
      throw err;
    }
  };

  // Handle Lightning Wallet Connection
  const handleConnectWallet = async () => {
    try {
      if (typeof window === 'undefined' || !window.nostr) {
        toast.error('Nostr extension not found.');
        return;
      }

      const pubkey = await window.nostr.getPublicKey();
      setLightningWallet(pubkey);
      toast.success('Lightning wallet connected successfully!');
    } catch (err) {
      toast.error('Failed to connect Lightning wallet.');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Animal Sunset Gallery</title>
        <meta name="description" content="Discover AI-generated animal videos" />
      </Head>

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Navigation */}
      <nav className="bg-[#1a1a1a] p-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex space-x-4">
            <a href="/gallery" className="text-white hover:text-purple-500">
              Gallery
            </a>
            {/* Add more navigation links as needed */}
          </div>
          <div className="flex items-center space-x-4">
            {userProfile ? (
              <div className="flex items-center space-x-2">
                {userProfile.picture ? (
                  <img
                    src={userProfile.picture}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                    <span className="text-white text-sm">
                      {userProfile.name
                        ? userProfile.name.charAt(0).toUpperCase()
                        : 'U'}
                    </span>
                  </div>
                )}
                <span>{userProfile.name || 'Anonymous'}</span>
              </div>
            ) : (
              <span className="text-gray-400">Not Logged In</span>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-700 rounded-lg"
              aria-label="Settings"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Animal Gallery</h1>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Lightning Wallet Connection */}
        <div className="flex items-center space-x-4 mb-8">
          {lightningWallet ? (
            <div className="flex items-center space-x-2">
              <span className="text-green-400">Wallet Connected:</span>
              <span className="font-mono">{lightningWallet}</span>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              <Zap size={16} />
              <span>Connect Lightning Wallet</span>
            </button>
          )}
        </div>

        {/* Gallery Feed */}
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
          <div className="space-y-8">
            {posts.map((post) => (
              <div
                key={post.event.id}
                className="bg-[#1a1a1a] rounded-lg overflow-hidden"
              >
                {/* Author Info */}
                <div className="p-4 flex items-center space-x-3">
                  {post.profile?.picture ? (
                    <img
                      src={post.profile.picture}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center">
                      <span className="text-white text-sm">
                        {post.profile?.name
                          ? post.profile.name.charAt(0).toUpperCase()
                          : 'U'}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium">
                      {post.profile?.name ||
                        `${post.event.pubkey.slice(0, 6)}...${post.event.pubkey.slice(
                          -4
                        )}`}
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
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    loop
                    playsInline
                    onError={() => {
                      toast.error('Failed to load the video.');
                    }}
                  />
                </div>

                {/* Title */}
                <div className="p-4 pb-2">
                  <p className="text-lg font-medium">
                    {post.event.tags.find((tag) => tag[0] === 'title')?.[1] ||
                      'Untitled'}
                  </p>
                </div>

                {/* Actions */}
                <div className="p-4 flex items-center gap-4">
                  <button
                    onClick={() => handleZap(post)}
                    className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400"
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
                    onClick={() =>
                      handleDownload(
                        post.event.content,
                        `animal-sunset-${post.event.id}.mp4`
                      )
                    }
                    className="flex items-center space-x-2 text-gray-400 hover:text-white ml-auto"
                  >
                    <Download size={20} />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => handleShare(post)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white"
                  >
                    <Share2 size={20} />
                    <span>Share</span>
                  </button>
                </div>

                {/* Comments Section */}
                {post.comments.length > 0 && (
                  <div className="border-t border-gray-800">
                    <div className="p-4 space-y-4">
                      {post.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="flex items-start space-x-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                            <span className="text-white text-xs">
                              {comment.pubkey.slice(0, 3)}...
                            </span>
                          </div>
                          <div className="flex-1 bg-[#2a2a2a] rounded-lg p-3">
                            <div className="font-medium text-gray-300 mb-1">
                              {`${comment.pubkey.slice(0, 6)}...${comment.pubkey.slice(
                                -4
                              )}`}
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
        )}
      </main>

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
            <p className="text-sm text-gray-300">
              Scan the QR code below to send your zap.
            </p>

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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Share on Nostr</h2>
              <button
                onClick={() => setShowShareModal(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition duration-200"
              rows={4}
              value={`${showShareModal.prompt}\n#animalsunset\n${showShareModal.videoUrl}`}
              readOnly
              placeholder="Write your note..."
            />
            <div className="flex flex-col md:flex-row gap-2">
              <button
                onClick={() => setShowShareModal(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={publishShare}
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

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleComment}
                disabled={!newComment.trim()}
                className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 ${
                  !newComment.trim() ? 'bg-gray-600 cursor-not-allowed' : ''
                } text-white font-semibold rounded-lg transition-colors`}
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Lightning Wallet Setup */}
            <div>
              <h3 className="text-lg font-semibold">Lightning Wallet</h3>
              {lightningWallet ? (
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">Connected:</span>
                  <span className="font-mono">{lightningWallet}</span>
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  <Zap size={16} />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>

            {/* Profile Information */}
            <div>
              <h3 className="text-lg font-semibold">Profile</h3>
              <p className="text-gray-300">
                Name: {userProfile?.name || 'Anonymous'}
              </p>
              <p className="text-gray-300">
                About: {userProfile?.about || 'No description.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
