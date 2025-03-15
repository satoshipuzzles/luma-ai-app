// pages/api/check-lnbits-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Your LNbits configuration
const LNBITS_API_KEY = process.env.LNBITS_API_KEY;
const LNBITS_URL = process.env.LNBITS_URL || 'https://1a96a66a73.d.voltageapp.io';

// Using the wallet API directly as shown in the LNbits documentation
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
    
    // Check if we have the necessary credentials
    if (!LNBITS_API_KEY) {
      console.error('Missing LNbits API key');
      return res.status(500).json({ error: 'Server configuration error (missing API key)' });
    }

    // First try to check payment status directly using the API endpoint from your docs
    const directCheckUrl = `${LNBITS_URL}/api/v1/payments/${paymentHash}`;
    console.log(`Using direct payment check URL: ${directCheckUrl}`);
    
    const directCheckResponse = await fetch(directCheckUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNBITS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    // If the direct check was successful, use that result
    if (directCheckResponse.ok) {
      const data = await directCheckResponse.json();
      console.log('Direct payment check result:', data);
      return res.status(200).json({ paid: data.paid });
    }
    
    // If direct check failed, try getting all payments and searching for this hash
    console.log('Direct payment check failed, trying wallet info method...');
    
    // Get wallet details to see up-to-date balance
    const walletResponse = await fetch(`${LNBITS_URL}/api/v1/wallet`, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNBITS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!walletResponse.ok) {
      console.error('Failed to fetch wallet info:', await walletResponse.text());
      return res.status(500).json({ error: 'Failed to verify payment through wallet info' });
    }

    const walletData = await walletResponse.json();
    console.log('Wallet info:', walletData);

    // Use the more general payments endpoint to get recent transactions
    const paymentsUrl = `${LNBITS_URL}/api/v1/payments`;
    const paymentsResponse = await fetch(paymentsUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': LNBITS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!paymentsResponse.ok) {
      console.error('Failed to fetch payments:', await paymentsResponse.text());
      return res.status(500).json({ error: 'Failed to fetch payment history' });
    }

    const paymentsData = await paymentsResponse.json();
    console.log(`Found ${paymentsData.length} payments in history`);

    // Find the payment with the matching hash
    const matchingPayment = paymentsData.find((payment: any) => payment.payment_hash === paymentHash);
    
    if (matchingPayment) {
      console.log('Found matching payment:', matchingPayment);
      return res.status(200).json({ 
        paid: matchingPayment.paid || matchingPayment.pending === false,
        payment: matchingPayment
      });
    }

    // If we couldn't find the payment in history, return not paid
    console.log('Payment not found in history');
    return res.status(200).json({ paid: false });

  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error checking payment status' 
    });
  }
}
