import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!process.env.LUMA_API_KEY) {
    console.error('LUMA_API_KEY not found');
    return res.status(500).json({ message: 'API configuration error' });
  }

  try {
    const { prompt } = req.body;

    console.log('Starting generation with prompt:', prompt);

    const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LUMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: "16:9",
        loop: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error('Failed to generate video');
    }

    const generation = await response.json();
    console.log('Generation started:', generation);

    return res.status(200).json(generation);
  } catch (error) {
    console.error('Error in generate:', error);
    return res.status(500).json({ 
      message: 'Failed to generate video',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
