// pages/api/create-lnbits-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Removed the import of node-fetch
// import fetch from 'node-fetch';

const LNbitsAPIKey = process.env.LNBITS_API_KEY;
const LNbitsURL = 'https://legend.lnbits.com';

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

    const data = await response.json();

    if (!response.ok) {
      console.error('Error from LNbits API:', data);
      throw new Error(`LNbits API error: ${data.detail || response.statusText}`);
    }

    res.status(200).json({
      payment_request: data.payment_request,
      payment_hash: data.payment_hash,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: (error as Error).message || 'Error creating invoice' });
  }
}
