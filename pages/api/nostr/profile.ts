import type { NextApiRequest, NextApiResponse } from 'next';
import { SimplePool, Filter } from 'nostr-tools';
import type { Event } from 'nostr-tools';

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

  const pool = new SimplePool();
  const RELAY_URLS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band'
  ];

  try {
    const filter: Filter = {
      kinds: [0],
      authors: [pubkey],
      limit: 1
    };

    const event = await pool.get(
      RELAY_URLS,
      filter
    );

    // Don't await close since it doesn't return a promise
    pool.close(RELAY_URLS);

    if (!event) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    try {
      const profileData = JSON.parse(event.content);
      return res.status(200).json(profileData);
    } catch (error) {
      console.error('Error parsing profile content:', error);
      return res.status(500).json({ message: 'Invalid profile data' });
    }

  } catch (error) {
    console.error('Error fetching profile:', error);
    pool.close(RELAY_URLS);
    return res.status(500).json({ 
      message: 'Error fetching profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
