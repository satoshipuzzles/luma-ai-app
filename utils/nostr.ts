import { WebSocket } from 'ws';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { Profile, AnimalKind } from '../types/nostr';

interface NostrEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  id: string;
  sig: string;
}

interface NostrProfile {
  name?: string;
  picture?: string;
  about?: string;
}

export const fetchNostrProfile = async (pubkey: string): Promise<NostrProfile | null> => {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://relay.damus.io');
    let timeout: NodeJS.Timeout;
    ws.onopen = () => {
      const subscription = JSON.stringify([
        "REQ",
        "profile-lookup",
        {
          kinds: [0],
          authors: [pubkey],
          limit: 1
        }
      ]);
      
      ws.send(subscription);
      
      timeout = setTimeout(() => {
        ws.close();
        resolve(null);
      }, 5000);
    };
    ws.onmessage = (event) => {
      try {
        const [type, , nostrEvent] = JSON.parse(event.data.toString());
        
        if (type === "EVENT" && nostrEvent.kind === 0) {
          clearTimeout(timeout);
          
          const profile: NostrProfile = JSON.parse(nostrEvent.content);
          ws.close();
          resolve(profile);
        }
      } catch (error) {
        console.error('Error parsing Nostr event:', error);
      }
    };
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      clearTimeout(timeout);
      ws.close();
      resolve(null);
    };
  });
};

// Add this new export
export const handleShare = async (
  ndk: any,
  content: string,
  targetEventId: string,
  type: 'note' | 'gallery' = 'note'
): Promise<NDKEvent> => {
  if (!ndk) {
    throw new Error('NDK instance is required');
  }

  const event = new NDKEvent(ndk);
  event.kind = type === 'note' ? 1 : 75757;
  event.content = content;
  event.tags = [
    ['t', 'animalsunset'],
    ['e', targetEventId, '', type === 'note' ? 'mention' : 'reference']
  ];

  await event.publish();
  return event;
};

export const parseProfile = (content: string): Profile | undefined => {
  try {
    const parsed = JSON.parse(content);
    return {
      name: parsed.name,
      picture: parsed.picture,
      about: parsed.about,
      lud06: parsed.lud06,
      lud16: parsed.lud16,
      lnurl: parsed.lnurl
    };
  } catch (e) {
    console.error('Error parsing profile:', e);
    return undefined;
  }
};

export const convertToAnimalKind = (event: NDKEvent): AnimalKind => {
  return {
    id: event.id || '',
    pubkey: event.pubkey || '',
    created_at: Math.floor(event.created_at || Date.now() / 1000),
    kind: 75757,
    tags: event.tags.map(tag => [tag[0] || '', tag[1] || '']) as Array<['title' | 'r' | 'type' | 'e' | 'p', string]>,
    content: event.content || '',
    sig: event.sig || ''
  };
};
