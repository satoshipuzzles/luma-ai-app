import { Event, getEventHash, getPublicKey, generatePrivateKey, nip19 } from 'nostr-tools';
import { RelayPool } from 'nostr-tools';

export interface NostrEvent extends Event {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'];

export const createNostrPost = async (
  content: string,
  tags: string[][],
  kind: number = 1
): Promise<NostrEvent> => {
  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  const event: Partial<Event> = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content
  };

  try {
    const signedEvent = await window.nostr.signEvent(event as Event);
    return signedEvent as NostrEvent;
  } catch (error) {
    console.error('Error creating Nostr event:', error);
    throw new Error('Failed to create Nostr event');
  }
};

export const publishToRelays = async (
  event: NostrEvent,
  relays: string[] = DEFAULT_RELAYS
): Promise<void> => {
  const pool = new RelayPool(relays);

  try {
    await Promise.all(
      relays.map(async (relay) => {
        const pub = await pool.publish(relay, event);
        await pub.wait();
      })
    );
  } finally {
    pool.close();
  }
};

export const createAnimalKind = async (
  pubkey: string,
  videoUrl: string,
  title: string,
  replyTo?: string
): Promise<NostrEvent> => {
  const tags: string[][] = [
    ['title', title],
    ['t', 'AnimalSunset']
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
  return signedEvent as NostrEvent;
};

export const getLightningAddress = async (pubkey: string): Promise<string | null> => {
  try {
    const profile = await fetchProfile(pubkey);
    if (!profile) return null;

    const content = JSON.parse(profile.content);
    return content.lud16 || content.lud06 || null;
  } catch (error) {
    console.error('Error getting lightning address:', error);
    return null;
  }
};

export const fetchProfile = async (pubkey: string): Promise<Event | null> => {
  const pool = new RelayPool(DEFAULT_RELAYS);
  
  try {
    const events = await pool.list(DEFAULT_RELAYS, [{
      authors: [pubkey],
      kinds: [0],
      limit: 1
    }]);

    return events[0] || null;
  } finally {
    pool.close();
  }
};

export const formatPubkey = (pubkey: string): string => {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-8);
  }
};

export const subscribeToEvents = (
  filter: any,
  onEvent: (event: Event) => void,
  relays: string[] = DEFAULT_RELAYS
): (() => void) => {
  const pool = new RelayPool(relays);
  
  const sub = pool.sub(relays, [filter]);
  
  sub.on('event', (event: Event) => {
    onEvent(event);
  });

  return () => {
    sub.unsub();
    pool.close();
  };
};
