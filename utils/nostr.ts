import { WebSocket } from 'ws';

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
      // Subscribe to kind 0 events for this pubkey
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
      
      // Set timeout for 5 seconds
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
