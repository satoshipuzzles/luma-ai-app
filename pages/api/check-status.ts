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
    const response = await fetch(
      `https://api.lumalabs.ai/dream-machine/v1/generations/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.LUMA_API_KEY}`,
          'Accept': 'application/json'
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to check generation status');
    }

    const data = await response.json();
    console.log('Raw API response:', data);

    // If completed, verify the video is accessible
    if (data.state === 'completed' && data.assets?.video) {
      try {
        const videoCheck = await fetch(data.assets.video, { method: 'HEAD' });
        if (!videoCheck.ok) {
          // If video isn't ready, mark as still processing
          data.state = 'processing';
          data.assets.video = null;
        }
      } catch (e) {
        // If video check fails, mark as still processing
        data.state = 'processing';
        data.assets.video = null;
      }
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in status check:', error);
    return res.status(500).json({ 
      message: 'Error checking generation status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
