// pages/api/check-lnbits-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Your LNbits configuration
const LNBITS_API_KEY = process.env.LNBITS_API_KEY; // Your Invoice/Admin key
const LNBITS_URL = process.env.LNBITS_URL || 'https://legend.lnbits.com'; // Default to legend.lnbits.com
const LNBITS_WALLET_ID = process.env.LNBITS_WALLET_ID; // The ID of your wallet

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentHash } = req.body;

  if (!paymentHash || typeof paymentHash !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid paymentHash' });
  }

  try {
    console.log(`Checking payment status for hash: ${paymentHash}`);
    console.log(`Using LNbits URL: ${LNBITS_URL}`);
    console.log(`Using API Key: ${LNBITS_API_KEY ? 'Key provided' : 'No API key found'}`);
    
    // Check if we have the necessary credentials
    if (!LNBITS_API_KEY) {
      console.error('Missing LNbits API key');
      return res.status(500).json({ error: 'Server configuration error (missing API key)' });
    }

    // API endpoint to check payment status
    const apiEndpoint = `${LNBITS_URL}/api/v1/payments/${paymentHash}`;

    console.log(`Using API endpoint: ${apiEndpoint}`);

    const response = await fetch(apiEndpoint, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNBITS_API_KEY,
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
      return res.status(response.status).json({ 
        error: data.detail || data.message || 'Unknown error from LNbits API'
      });
    }

    // Check if payment is "settled" or "paid" property is true
    const isPaid = 
      (data.paid === true || data.paid === 'true') || 
      (data.details?.settled === true || data.details?.settled === 'true');

    return res.status(200).json({ paid: isPaid });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error checking payment status' 
    });
  }
}
