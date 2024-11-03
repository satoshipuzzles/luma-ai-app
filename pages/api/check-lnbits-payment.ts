// pages/api/check-lnbits-payment.ts

import type { NextApiRequest, NextApiResponse } from 'next';

const LNbitsAPIKey = process.env.LNBITS_API_KEY;
const LNbitsURL = 'https://1a96a66a73.d.voltageapp.io';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { paymentHash } = req.body;

  try {
    const response = await fetch(`${LNbitsURL}/api/v1/payments/${paymentHash}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNbitsAPIKey!,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check payment status');
    }

    const data = await response.json();
    res.status(200).json({ paid: data.paid });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Error checking payment status' });
  }
}
