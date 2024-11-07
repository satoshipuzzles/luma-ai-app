import { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from 'ws';
import { Filter } from 'nostr-tools';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { relay, filter } = req.body;

  if (!relay || !filter) {
    return res.status(400).json({ error: 'Missing relay URL or filter' });
  }

  try {
    const events = await fetchEvents(relay, filter);
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

function fetchEvents(relayUrl: string, filter: Filter): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const events: any[] = [];
    const ws = new WebSocket(relayUrl);

    const timeout = setTimeout(() => {
      ws.close();
      resolve(events);
    }, 5000);

    ws.on('open', () => {
      const subId = Math.random().toString(36).substring(7);
      ws.send(JSON.stringify(['REQ', subId, filter]));
    });

    ws.on('message', (data) => {
      try {
        const [type, subId, event] = JSON.parse(data.toString());
        if (type === 'EVENT') {
          events.push(event);
        } else if (type === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      ws.close();
      reject(error);
    });
  });
}
