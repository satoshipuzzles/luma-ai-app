import type { NextApiRequest, NextApiResponse } from 'next';
import { LumaAI } from 'lumaai';

const client = new LumaAI({
  authToken: process.env.LUMA_API_KEY as string
});

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

    const generation = await client.generations.create({
      prompt,
      aspect_ratio: "16:9",
      loop: true
    });

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
