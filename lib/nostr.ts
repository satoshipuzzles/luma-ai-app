import { Event, getEventHash, getPublicKey, nip19 } from 'nostr-tools';
import { AnimalKind, NostrProfile, ProfileContent } from '../types/nostr';

const SUNSET_RELAY_URL = 'wss://sunset.nostrfreaks.com';

export const createAnimalKind = async (
  pubkey: string,
  videoUrl: string,
  title: string,
  replyTo?: string
): Promise<AnimalKind> => {
  const tags: string[][] = [
    ['title', title]
  ];

  if (replyTo) {
    tags.push(['e', replyTo]);
  }

  const event: Partial<Event> = {
    kind: 75757,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: videoUrl,
    pubkey
  };

  event.id = getEventHash(event as Event);
  
  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  const signedEvent = await window.nostr.signEvent(event as Event);
  return signedEvent as AnimalKind;
};

export const generateGuestKeypair = () => {
  const privateKey = window.crypto.getRandomValues(new Uint8Array(32));
  const pubkey = getPublicKey(privateKey);
  return { privateKey, pubkey };
};

export const getLightningAddress = async (pubkey: string): Promise<string | null> => {
  try {
    const profile = await fetchProfile(pubkey);
    if (!profile) return null;

    const content: ProfileContent = JSON.parse(profile.content);
    return content.lud16 || content.lud06 || null;
  } catch (error) {
    console.error('Error getting lightning address:', error);
    return null;
  }
};

export const fetchProfile = async (pubkey: string): Promise<NostrProfile | null> => {
  const relays = [SUNSET_RELAY_URL, 'wss://relay.damus.io'];
  const filter = {
    authors: [pubkey],
    kinds: [0],
    limit: 1
  };

  for (const relay of relays) {
    try {
      const response = await fetch(`/api/nostr/fetch-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relay, filter })
      });

      if (!response.ok) continue;

      const events = await response.json();
      if (events.length > 0) {
        return events[0] as NostrProfile;
      }
    } catch (error) {
      console.error(`Failed to fetch profile from ${relay}:`, error);
    }
  }

  return null;
};

export const formatPubkey = (pubkey: string): string => {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-8);
  }
};
