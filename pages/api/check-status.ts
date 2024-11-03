import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id) {
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
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ 
      message: 'Error checking generation status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
