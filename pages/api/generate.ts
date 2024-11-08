// pages/api/generate.ts
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
    const { prompt, loop = true, startImageUrl, extend, videoId } = req.body;
    console.log('Starting generation with prompt:', prompt);

    const requestBody: any = {
      prompt,
      aspect_ratio: "16:9",
      loop: Boolean(loop)
    };

    // Add keyframes if we have a start image or extending video
    if (extend && videoId) {
      requestBody.keyframes = {
        frame0: {
          type: "generation",
          id: videoId
        }
      };
    } else if (startImageUrl) {
      requestBody.keyframes = {
        frame0: {
          type: "image",
          url: startImageUrl
        }
      };
    }

    const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LUMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
