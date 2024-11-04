// pages/api/create-lnbits-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const LNbitsAPIKey = process.env.LNBITS_API_KEY; // Your Invoice Key
const LNbitsURL = 'https://1a96a66a73.d.voltageapp.io'; // Your LNbits instance URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { amount } = req.body;

  if (!amount || typeof amount !== 'number') {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

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
      res
        .status(response.status)
        .json({ error: data.detail || data.message || 'Unknown error' });
      return;
    }

    console.log('Invoice data:', data);

    res.status(200).json({
      payment_request: data.payment_request,
      payment_hash: data.payment_hash,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res
      .status(500)
      .json({ error: (error as Error).message || 'Error creating invoice' });
  }
}
