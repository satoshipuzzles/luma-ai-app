// pages/api/check-lnbits-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentHash } = req.body;

  if (!paymentHash || typeof paymentHash !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid paymentHash' });
  }

  // Get configuration from environment variables
  const LNBITS_API_KEY = process.env.LNBITS_API_KEY;
  const LNBITS_URL = process.env.LNBITS_URL || 'https://legend.lnbits.com';

  // Log key configuration (redacted for security)
  console.log(`Checking payment status for hash: ${paymentHash}`);
  console.log(`Using LNbits URL: ${LNBITS_URL}`);
  console.log(`API Key present: ${LNBITS_API_KEY ? 'Yes' : 'No'}`);

  try {
    if (!LNBITS_API_KEY) {
      throw new Error('Missing LNbits API key in environment variables');
    }

    // First try: Check payment directly
    const directCheckUrl = `${LNBITS_URL}/api/v1/payments/${paymentHash}`;
    
    console.log(`Checking payment with URL: ${directCheckUrl}`);
    
    const directCheckResponse = await fetch(directCheckUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNBITS_API_KEY,
        'Content-Type': 'application/json',
      },
    })
    .catch(error => {
      console.error('Network error during direct check:', error);
      throw new Error('Network error connecting to LNbits API');
    });

    console.log(`Direct check status: ${directCheckResponse.status}`);

    // If the direct check was successful, use that result
    if (directCheckResponse.ok) {
      const responseText = await directCheckResponse.text();
      console.log(`Raw response: ${responseText}`);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        console.error('Error parsing response:', error);
        throw new Error('Invalid JSON response from LNbits API');
      }
      
      console.log('Direct payment check result:', data);
      
      // Make sure we have the expected structure
      if (data && typeof data.paid !== 'undefined') {
        return res.status(200).json({ paid: data.paid });
      } else {
        console.warn('Unexpected response structure:', data);
      }
    }
    
    console.log('Direct check failed, trying wallet info method...');
    
    // Second try: Check wallet info and payments
    const walletResponse = await fetch(`${LNBITS_URL}/api/v1/wallet`, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNBITS_API_KEY,
        'Content-Type': 'application/json',
      },
    })
    .catch(error => {
      console.error('Network error during wallet check:', error);
      throw new Error('Network error connecting to LNbits wallet API');
    });

    if (!walletResponse.ok) {
      const errorText = await walletResponse.text();
      console.error(`Wallet API error (${walletResponse.status}):`, errorText);
      throw new Error(`LNbits wallet API error: ${walletResponse.status}`);
    }

    const walletData = await walletResponse.json();
    console.log('Wallet info:', {
      name: walletData.name,
      balance: walletData.balance
    });

    // Third try: Get all payments and find our hash
    const paymentsUrl = `${LNBITS_URL}/api/v1/payments`;
    console.log(`Fetching all payments from: ${paymentsUrl}`);
    
    const paymentsResponse = await fetch(paymentsUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNBITS_API_KEY,
        'Content-Type': 'application/json',
      },
    })
    .catch(error => {
      console.error('Network error during payments check:', error);
      throw new Error('Network error connecting to LNbits payments API');
    });

    if (!paymentsResponse.ok) {
      const errorText = await paymentsResponse.text();
      console.error(`Payments API error (${paymentsResponse.status}):`, errorText);
      throw new Error(`LNbits payments API error: ${paymentsResponse.status}`);
    }

    const paymentsData = await paymentsResponse.json();
    console.log(`Found ${paymentsData.length} payments in history`);

    // Find payment with matching hash
    const matchingPayment = paymentsData.find((payment: any) => 
      payment.payment_hash === paymentHash ||
      payment.checking_id === paymentHash
    );
    
    if (matchingPayment) {
      console.log('Found matching payment:', {
        amount: matchingPayment.amount,
        time: matchingPayment.time,
        pending: matchingPayment.pending,
        paid: matchingPayment.paid
      });
      
      return res.status(200).json({ 
        paid: matchingPayment.paid || matchingPayment.pending === false,
        payment: matchingPayment
      });
    }

    console.log('Payment not found in history');
    return res.status(200).json({ paid: false });

  } catch (error) {
    console.error('Error checking payment status:', error);
    
    // Return structured error for better debugging
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error checking payment status',
      timestamp: new Date().toISOString()
    });
  }
}
