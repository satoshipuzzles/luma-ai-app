import { useState, useEffect } from 'react';
import Head from 'next/head';
import { AnimalKind, NostrEvent } from '../types/nostr';
import { fetchProfile, formatPubkey, getLightningAddress } from '../lib/nostr';

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

export default function Gallery() {
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
          relay: 'wss://sunset.nostrfreaks.com',
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
            // Parse the profile content
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
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(error instanceof Error ? error.message : 'Failed to load gallery');
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

      // Handle payment flow similar to generate video
      // ...
    } catch (error) {
      console.error('Error sending zap:', error);
    } finally {
      setSendingZap(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Gallery | Animal Sunset 🌞🦒</title>
        <meta name="description" content="Discover AI-generated animal videos" />
      </Head>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Animal Gallery</h1>

        <div className="space-y-8">
          {posts.map(post => (
            <div key={post.event.id} className="bg-[#1a1a1a] rounded-lg overflow-hidden">
              {/* Author Info */}
              <div className="p-4 flex items-center space-x-3">
                <img
                  src={post.profile?.picture || '/default-avatar.png'}
                  alt="Profile"
                  className="w-10 h-10 rounded-full"
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

              {/* Actions */}
              <div className="p-4 flex items-center space-x-4">
                <button
                  onClick={() => handleZap(post)}
                  disabled={sendingZap}
                  className="flex items-center space-x-2 text-yellow-500 hover:text-yellow-400"
                >
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                  </svg>
                  <span>Zap</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPost(post);
                    setShowCommentModal(true);
                  }}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <span>{post.comments.length}</span>
                </button>
              </div>

              {/* Comments */}
              {post.comments.length > 0 && (
                <div className="p-4 pt-0 space-y-4">
                  {post.comments.map(comment => (
                    <div key={comment.id} className="flex items-start space-x-3 text-sm">
                      <div className="flex-1 bg-[#2a2a2a] rounded p-3">
                        <div className="font-medium text-gray-300 mb-1">
                          {formatPubkey(comment.pubkey)}
                        </div>
                        {comment.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Comment Modal */}
      {showCommentModal && selectedPost && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-4 rounded-lg space-y-4 max-w-md w-full">
            <h2 className="text-xl font-bold">Add Comment</h2>
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg p-3 text-white"
              rows={4}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write your comment..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-purple-600 rounded-lg"
                disabled={!newComment.trim()}
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
