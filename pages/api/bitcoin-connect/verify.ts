import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySignature } from 'nostr-tools';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pubkey, message, signature } = req.body;

  if (!pubkey || !message || !signature) {
    return res.status(400).json({ 
      error: 'Missing required fields: pubkey, message, and signature are required' 
    });
  }

  try {
    const isValid = verifySignature({
      pubkey,
      sig: signature,
      id: message
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    return res.status(200).json({ verified: true });
  } catch (error) {
    console.error('Error verifying signature:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error verifying signature' 
    });
  }
}
