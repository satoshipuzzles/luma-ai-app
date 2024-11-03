// pages/api/create-lnbits-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch'; // Add this import

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

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from LNbits API:', errorData);
      throw new Error(`LNbits API error: ${errorData.detail || response.statusText}`);
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
