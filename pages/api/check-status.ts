import type { NextApiRequest, NextApiResponse } from 'next';

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
    
    const response = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.LUMA_API_KEY}`,
        'Accept': 'application/json'
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check generation status');
    }

    const generation = await response.json();
    
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
