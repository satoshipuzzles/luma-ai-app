import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { verifyUrl } = req.body;

  if (!verifyUrl) {
    return res.status(400).json({ error: 'Missing verify URL' });
  }

  try {
    const response = await fetch(verifyUrl);
    
    if (!response.ok) {
      throw new Error('Failed to verify payment');
    }

    const data = await response.json();

    return res.status(200).json({
      paid: data.paid,
      preimage: data.preimage
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to verify payment' 
    });
  }
}
