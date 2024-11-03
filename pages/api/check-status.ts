import type { NextApiRequest, NextApiResponse } from 'next';
import { LumaAI } from 'lumaai';

const client = new LumaAI({
  authToken: process.env.LUMA_API_KEY as string
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Generation ID is required' });
  }

  console.log('Checking status for generation:', id);

  try {
    const generation = await client.generations.get(id);
    
    console.log('Status check response:', {
      id: generation.id,
      state: generation.state,
      hasAssets: !!generation.assets,
      hasVideo: !!generation.assets?.video
    });

    // Add proper timestamp handling
    const response = {
      ...generation,
      createdAt: generation.created_at || new Date().toISOString(),
      checkedAt: new Date().toISOString()
    };
    
    if (generation.state === 'failed') {
      return res.status(200).json({
        ...response,
        failure_reason: generation.failure_reason || 'Unknown error'
      });
    }
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in status check:', error);
    return res.status(500).json({ 
      message: 'Error checking generation status',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
