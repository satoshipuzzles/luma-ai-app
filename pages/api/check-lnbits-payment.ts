// pages/api/check-lnbits-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

const LNbitsAPIKey = process.env.LNBITS_API_KEY; // Your Invoice Key
const LNbitsURL = 'https://1a96a66a73.d.voltageapp.io'; // Your LNbits instance URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { paymentHash } = req.body;

  if (!paymentHash || typeof paymentHash !== 'string') {
    res.status(400).json({ error: 'Missing or invalid paymentHash' });
    return;
  }

  try {
    console.log(`Fetching payment status from LNbits for hash: ${paymentHash}`);

    const response = await fetch(`${LNbitsURL}/api/v1/payments/${paymentHash}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNbitsAPIKey!,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    console.log('LNbits payment status response:', data);

    if (!response.ok) {
      console.error('Error from LNbits API:', data);
      res
        .status(response.status)
        .json({ error: data.detail || data.message || 'Unknown error' });
      return;
    }

    // According to LNbits documentation, the response should be { "paid": <bool> }
    const isPaid = data.paid === true || data.paid === 'true';

    res.status(200).json({ paid: isPaid });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res
      .status(500)
      .json({ error: (error as Error).message || 'Error checking payment status' });
  }
}
