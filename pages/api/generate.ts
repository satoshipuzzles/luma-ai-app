// pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GenerationOptions } from '@/types/luma';

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
    const options: GenerationOptions = req.body;

    const requestBody = {
      model: options.model,
      prompt: options.prompt,
      aspect_ratio: options.aspectRatio,
      loop: options.loop,
      ...(options.cameraMotion && { camera_motion: options.cameraMotion }),
      ...(options.duration && { duration: options.duration }),
      ...(options.resolution && { resolution: options.resolution })
    };

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
      throw new Error('Failed to generate');
    }

    const generation = await response.json();
    return res.status(200).json(generation);
  } catch (error) {
    console.error('Error in generate:', error);
    return res.status(500).json({ 
      message: 'Failed to generate',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
