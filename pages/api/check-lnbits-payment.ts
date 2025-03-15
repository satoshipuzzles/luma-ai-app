// pages/api/check-lnbits-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Your LNbits configuration
const LNBITS_API_KEY = process.env.LNBITS_API_KEY;
const RAW_LNBITS_URL = process.env.LNBITS_URL;
// Ensure URL has proper protocol prefix
const LNBITS_URL = RAW_LNBITS_URL && !RAW_LNBITS_URL.startsWith('http') 
  ? `https://${RAW_LNBITS_URL}` 
  : RAW_LNBITS_URL;

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
    console.log(`Host: ${req.headers.host}`);
    console.log(`Using raw LNbits URL: ${RAW_LNBITS_URL}`);
    console.log(`Using formatted LNbits URL: ${LNBITS_URL}`);
    console.log(`Using API Key: ${LNBITS_API_KEY ? 'Present' : 'Missing'}`);
    
    // Check if we have the necessary credentials
    if (!LNBITS_API_KEY) {
      console.error('Missing LNbits API key');
      return res.status(500).json({ error: 'Server configuration error (missing API key)' });
    }

    if (!LNBITS_URL) {
      console.error('Missing LNbits URL');
      return res.status(500).json({ error: 'Server configuration error (missing LNbits URL)' });
    }

    // Ensure URL is properly formatted
    let apiUrl;
    try {
      apiUrl = new URL(`/api/v1/payments/${paymentHash}`, LNBITS_URL);
      console.log(`Constructed API URL: ${apiUrl.toString()}`);
    } catch (error) {
      console.error('Failed to construct API URL:', error);
      return res.status(500).json({ 
        error: `Invalid LNbits URL format: ${LNBITS_URL}. Make sure it includes the protocol (https://).` 
      });
    }

    const response = await fetch(apiUrl.toString(), {
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

    // Check payment status comprehensively
    let isPaid = false;
    
    if (data.paid === true || data.paid === 'true') {
      console.log('Payment confirmed via paid flag');
      isPaid = true;
    } else if (data.details?.status === 'complete' || data.details?.status === 'settled') {
      console.log('Payment confirmed via status field');
      isPaid = true;
    } else if (data.details?.settled === true || data.details?.settled === 'true') {
      console.log('Payment confirmed via settled field');
      isPaid = true;
    } else if (data.details?.pending === false) {
      console.log('Payment confirmed via pending=false');
      isPaid = true;
    }

    return res.status(200).json({ paid: isPaid });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error checking payment status' 
    });
  }
}
