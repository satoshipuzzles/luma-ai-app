import type { NextApiRequest, NextApiResponse } from 'next';

type GenerationResponse = {
  id: string;
  state: string;
  failure_reason?: string | null;
  assets?: {
    video?: string;
  };
};

type ErrorResponse = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerationResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check if LUMA_API_KEY is configured
  if (!process.env.LUMA_API_KEY) {
    return res.status(500).json({ message: 'LUMA_API_KEY is not configured' });
  }

  try {
    const { prompt } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt is required and must be a string' });
    }

    // Make request to Luma AI API
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

    // Check if the response was successful
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      return res.status(response.status).json({
        message: error.message || `Luma AI API error: ${response.statusText}`
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error generating video:', error);
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Error generating video'
    });
  }
}
