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

  try {
    console.log('Checking status for generation:', id);
    const generation = await client.generations.get(id);
    
    console.log('Status check response:', {
      id: generation.id,
      state: generation.state,
      hasAssets: !!generation.assets,
      hasVideo: !!generation.assets?.video
    });
    
    return res.status(200).json(generation);
  } catch (error) {
    console.error('Error in status check:', error);
    return res.status(500).json({ 
      message: 'Error checking generation status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
