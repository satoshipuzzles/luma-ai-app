import type { NextApiRequest, NextApiResponse } from 'next';
import { LumaAI } from 'lumaai';

const client = new LumaAI({
  authToken: process.env.LUMA_API_KEY
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // Create the initial generation
    const generation = await client.generations.create({
      prompt,
      aspect_ratio: "16:9",
      loop: true
    });

    return res.status(200).json(generation);
  } catch (error) {
    console.error('Error generating video:', error);
    return res.status(500).json({ 
      message: 'Failed to generate video',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
