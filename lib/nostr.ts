import { SimplePool } from 'nostr-tools/pool';
import { getEventHash, validateEvent } from 'nostr-tools/pure';
import { Event } from 'nostr-tools/event';
import { Pub } from 'nostr-tools/relay';

export const DEFAULT_RELAY = 'wss://relay.damus.io';
export const BACKUP_RELAYS = ['wss://relay.nostrfreaks.com'];

const pool = new SimplePool();

interface SignedEvent extends Event {
  id: string;
}

type UnsignedEvent = Omit<Event, 'id' | 'sig' | 'pubkey' | 'created_at'>;

export async function publishToRelays(
  event: UnsignedEvent,
  relays: string[] = [DEFAULT_RELAY, ...BACKUP_RELAYS]
): Promise<SignedEvent> {
  if (typeof window === 'undefined' || !window.nostr) {
    throw new Error('Nostr extension not found');
  }

  const pubkey = await window.nostr.getPublicKey();
  const finalEvent: Event = {
    ...event,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };

  finalEvent.id = getEventHash(finalEvent);
  const signedEvent = (await window.nostr.signEvent(finalEvent)) as SignedEvent;

  if (!validateEvent(signedEvent)) {
    throw new Error('Invalid event');
  }

  try {
    const pubs: Pub[] = pool.publish(relays, signedEvent);

    const publishPromises: Promise<void>[] = pubs.map((pub) => {
      return new Promise<void>((resolve, reject) => {
        if (!pub) {
          reject(new Error('Failed to publish to relay'));
          return;
        }
        pub.on('ok', () => resolve());
        pub.on('failed', () => reject(new Error('Publish failed')));
      });
    });

    await Promise.any(publishPromises);

    return signedEvent;
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw error;
  }
}

export async function publishVideo(
  videoUrl: string,
  prompt: string,
  isPublic: boolean
): Promise<void> {
  const animalEvent: UnsignedEvent = {
    kind: 75757,
    tags: [
      ['title', prompt],
      ['r', videoUrl],
      ['type', 'animal-sunset'],
    ],
    content: videoUrl,
  };

  const signedAnimalEvent = await publishToRelays(animalEvent);

  const historyEvent: UnsignedEvent = {
    kind: 8008135,
    tags: [
      ['text-to-speech', prompt],
      ['r', videoUrl],
      ['e', signedAnimalEvent.id],
      ['public', isPublic.toString()],
    ],
    content: JSON.stringify({
      prompt,
      videoUrl,
      createdAt: new Date().toISOString(),
      state: 'completed',
      public: isPublic,
    }),
  };

  await publishToRelays(historyEvent);
}

export async function fetchLightningDetails(
  pubkey: string
): Promise<{ lnurl?: string; lud16?: string } | null> {
  try {
    const events = await pool.list([DEFAULT_RELAY], [{ kinds: [0], authors: [pubkey] }]);
    const profileEvent = events[0];
    if (!profileEvent) return null;

    const profile = JSON.parse(profileEvent.content);
    return { lnurl: profile.lud06, lud16: profile.lud16 };
  } catch (error) {
    console.error('Error parsing profile:', error);
    return null;
  }
}

export async function createZapInvoice(
  lnAddress: string,
  amount: number,
  comment?: string
): Promise<string> {
  const [username, domain] = lnAddress.split('@');
  if (!username || !domain) {
    throw new Error('Invalid LN address format');
  }

  const response = await fetch(`https://${domain}/.well-known/lnurlp/${username}`);
  const { callback, maxSendable, minSendable } = await response.json();

  if (amount < minSendable || amount > maxSendable) {
    throw new Error('Amount out of bounds');
  }

  const callbackResponse = await fetch(
    `${callback}?amount=${amount}&comment=${encodeURIComponent(comment || '')}`
  );
  const { pr: paymentRequest } = await callbackResponse.json();

  return paymentRequest;
}

export async function fetchLightningAddress(pubkey: string): Promise<string | null> {
  try {
    const profileEvent = await fetchProfile(pubkey);
    if (!profileEvent) return null;

    const profile = JSON.parse(profileEvent.content);
    return profile.lud16 || profile.lud06 || null;
  } catch (error) {
    console.error('Error fetching Lightning address:', error);
    return null;
  }
}

export async function publishComment(
  content: string,
  parentId: string,
  kind: number = 1
): Promise<void> {
  const event: UnsignedEvent = {
    kind,
    tags: [['e', parentId, '', 'reply']],
    content,
  };

  await publishToRelays(event);
}

export async function shareToNostr(content: string, videoUrl: string): Promise<void> {
  const event: UnsignedEvent = {
    kind: 1,
    tags: [
      ['t', 'animalsunset'],
      ['r', videoUrl],
    ],
    content: content.trim(),
  };

  await publishToRelays(event);
}

export async function fetchProfile(pubkey: string): Promise<Event | null> {
  const events = await pool.list([DEFAULT_RELAY], [{ kinds: [0], authors: [pubkey] }]);
  return events.length > 0 ? events[0] : null;
}

export async function fetchEvents(filter: any): Promise<Event[]> {
  return await pool.list([DEFAULT_RELAY], [filter]);
}

export function formatPubkey(pubkey: string): string {
  return `${pubkey.slice(0, 6)}...${pubkey.slice(-6)}`;
}

export {
  fetchLightningDetails,
  createZapInvoice,
  fetchLightningAddress, // Renamed from getLightningAddress
  publishComment,
  shareToNostr,
  fetchProfile,
  fetchEvents,
  formatPubkey,
};
