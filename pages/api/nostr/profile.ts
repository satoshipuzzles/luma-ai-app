import type { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from 'ws';

interface NostrEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  id: string;
  sig: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { pubkey } = req.query;

  if (!pubkey || typeof pubkey !== 'string') {
    return res.status(400).json({ message: 'Pubkey is required' });
  }

  try {
    const profile = await new Promise((resolve, reject) => {
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
          const [type, , eventData] = JSON.parse(event.data.toString());
          
          if (type === "EVENT" && eventData.kind === 0) {
            clearTimeout(timeout);
            
            const profileData = JSON.parse(eventData.content);
            ws.close();
            resolve(profileData);
          }
        } catch (error) {
          console.error('Error parsing Nostr event:', error);
          reject(error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeout);
        ws.close();
        reject(error);
      };
    });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ 
      message: 'Error fetching profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
