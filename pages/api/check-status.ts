import type { NextApiRequest, NextApiResponse } from 'next';
import { LumaAI } from 'lumaai';

const client = new LumaAI({
  authToken: process.env.LUMA_API_KEY
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
    const generation = await client.generations.get(id);
    
    if (generation.state === 'failed') {
      return res.status(200).json({
        ...generation,
        failure_reason: generation.failure_reason || 'Unknown error'
      });
    }
    
    return res.status(200).json(generation);
  } catch (error) {
    console.error('Error checking generation status:', error);
    return res.status(500).json({ 
      message: 'Error checking generation status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
