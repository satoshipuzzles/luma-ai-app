import type { NextApiRequest, NextApiResponse } from 'next';
import { SimplePool, Filter, Event } from 'nostr-tools';

const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol'
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { pubkey } = req.query;

  if (!pubkey || typeof pubkey !== 'string') {
    return res.status(400).json({ message: 'Pubkey is required' });
  }

  const pool = new SimplePool();

  try {
    const filter: Filter = {
      kinds: [0],
      authors: [pubkey],
      limit: 1
    };

    // Try to get profile from any of the relays with a 5 second timeout
    const event: Event | null = await pool.get(
      RELAY_URLS,
      filter,
      { skipVerification: true }
    );

    // Close the pool without await
    pool.close();

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
    // Close the pool in case of error too
    pool.close();
    return res.status(500).json({ 
      message: 'Error fetching profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
