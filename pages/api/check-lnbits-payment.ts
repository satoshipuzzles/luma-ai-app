// pages/api/check-lnbits-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';

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

    // Added additional logging to track the request
    console.log(`Making request to: ${LNbitsURL}/api/v1/payments/${paymentHash}`);
    console.log(`Using API key: ${LNbitsAPIKey ? 'Key provided' : 'No API key found'}`);

    const response = await fetch(`${LNbitsURL}/api/v1/payments/${paymentHash}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNbitsAPIKey!,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response status: ${response.status}`);
    
    // Log the raw response for debugging
    const responseText = await response.text();
    console.log(`Raw response: ${responseText}`);
    
    // Parse the response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      return res.status(500).json({ 
        error: 'Failed to parse LNbits response',
        rawResponse: responseText
      });
    }

    console.log('LNbits payment status response:', data);

    if (!response.ok) {
      console.error('Error from LNbits API:', data);
      res
        .status(response.status)
        .json({ error: data.detail || data.message || 'Unknown error' });
      return;
    }

    // For debugging: Always return success in development
    // IMPORTANT: Remove this in production!
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Simulating payment success');
      return res.status(200).json({ paid: true });
    }

    // According to LNbits documentation, the response should be { "paid": <bool> }
    const isPaid = data.paid === true || data.paid === 'true';

    res.status(200).json({ paid: isPaid });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Error checking payment status' });
  }
}
