// pages/api/create-lnbits-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Your LNbits configuration
const LNBITS_API_KEY = process.env.LNBITS_API_KEY; // Your Invoice/Admin key
const LNBITS_URL = process.env.LNBITS_URL || 'https://legend.lnbits.com'; // Default to legend.lnbits.com
const LNBITS_WALLET_ID = process.env.LNBITS_WALLET_ID; // The ID of your wallet

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, lnAddress } = req.body;

  if (!amount || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    console.log(`Creating invoice for ${amount} sats`);
    console.log(`Using LNbits URL: ${LNBITS_URL}`);
    console.log(`Using API Key: ${LNBITS_API_KEY ? 'Key provided' : 'No API key found'}`);
    console.log(`Using Wallet ID: ${LNBITS_WALLET_ID ? LNBITS_WALLET_ID : 'No wallet ID found'}`);
    
    // Check if we have the necessary credentials
    if (!LNBITS_API_KEY) {
      console.error('Missing LNbits API key');
      return res.status(500).json({ error: 'Server configuration error (missing API key)' });
    }

    // API endpoint to create invoice
    // Note: The correct format when using LNbits includes the wallet_id in the URL path
    const apiEndpoint = `${LNBITS_URL}/api/v1/payments`;

    console.log(`Using API endpoint: ${apiEndpoint}`);

    const requestBody: any = {
      out: false,
      amount: amount,
      memo: 'Payment for Animal Sunset video generation',
      // No webhook - keeping it simple
    };

    // If this is for a specific lightning address
    if (lnAddress) {
      requestBody.lnurl_callback = lnAddress;
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': LNBITS_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`Raw response: ${responseText}`);

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

    if (!response.ok) {
      console.error('Error from LNbits API:', data);
      return res.status(response.status).json({ 
        error: data.detail || data.message || 'Unknown error from LNbits API'
      });
    }

    console.log('Invoice data:', data);

    res.status(200).json({
      payment_request: data.payment_request,
      payment_hash: data.payment_hash,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error creating invoice' 
    });
  }
}
