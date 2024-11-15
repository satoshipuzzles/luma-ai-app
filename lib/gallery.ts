// lib/gallery.ts

import { fetchProfile, fetchLightningAddress, formatPubkey } from './nostr';
import { AnimalKind, VideoPost, Profile } from '../types/nostr';

/**
 * Fetches kind 75757 events (animal videos) from Nostr relays.
 * @returns An array of AnimalKind events.
 */
export const fetchAnimalVideos = async (): Promise<AnimalKind[]> => {
  try {
    const response = await fetch('/api/nostr/fetch-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relay: 'wss://relay.nostrfreaks.com',
        filter: {
          kinds: [75757],
          limit: 50,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch animal videos');
    }

    const events: AnimalKind[] = await response.json();
    return events;
  } catch (error) {
    console.error('Error fetching animal videos:', error);
    throw error;
  }
};

/**
 * Processes fetched events to structure them into VideoPost objects.
 * @param events - The raw AnimalKind events.
 * @returns An array of VideoPost objects with associated profiles and comments.
 */
export const processVideoPosts = async (events: AnimalKind[]): Promise<VideoPost[]> => {
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
        profile: undefined,
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
  const uniquePubkeys = Array.from(new Set(uniqueEvents.map(event => event.pubkey)));
  const profilePromises = uniquePubkeys.map(async (pubkey) => {
    const profile = await fetchProfile(pubkey);
    if (profile) {
      return { pubkey, profile };
    }
    return { pubkey, profile: undefined };
  });

  const profilesData = await Promise.all(profilePromises);
  const profileMap = new Map<string, Profile>();
  profilesData.forEach(({ pubkey, profile }) => {
    if (profile) {
      profileMap.set(pubkey, profile);
    }
  });

  // Assign profiles to posts
  const postsArray: VideoPost[] = Array.from(postsMap.values()).map(post => ({
    ...post,
    profile: profileMap.get(post.event.pubkey),
  }));

  // Sort posts by created_at descending (newest first)
  postsArray.sort((a, b) => (b.event.created_at || 0) - (a.event.created_at || 0));

  return postsArray;
};
