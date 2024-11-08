import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.LNBITS_URL || !process.env.LNBITS_API_KEY) {
    return res.status(500).json({ error: 'Lightning configuration missing' });
  }

  const { amount } = req.body;

  if (!amount || amount < 1) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const response = await fetch(`${process.env.LNBITS_URL}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.LNBITS_API_KEY,
      },
      body: JSON.stringify({
        out: false,
        amount: amount,
        memo: 'Animal Sunset Video Generation',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create invoice');
    }

    const data = await response.json();
    return res.status(200).json({
      payment_request: data.payment_request,
      payment_hash: data.payment_hash,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json({
      error: 'Failed to create invoice',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
