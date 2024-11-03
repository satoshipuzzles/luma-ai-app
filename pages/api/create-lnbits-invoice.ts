// pages/api/create-lnbits-invoice.ts

import type { NextApiRequest, NextApiResponse } from 'next';

const LNbitsAPIKey = process.env.LNBITS_API_KEY; // Access the API key from environment variables
const LNbitsURL = 'https://legend.lnbits.com'; // Replace with your LNbits instance URL if self-hosted

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { amount } = req.body;

  try {
    const response = await fetch(`${LNbitsURL}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': LNbitsAPIKey!,
      },
      body: JSON.stringify({
        out: false,
        amount: amount,
        memo: 'Payment for video generation',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create invoice');
    }

    const data = await response.json();
    res.status(200).json({
      payment_request: data.payment_request,
      payment_hash: data.payment_hash,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Error creating invoice' });
  }
}
