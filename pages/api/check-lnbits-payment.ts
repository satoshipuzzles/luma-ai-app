// pages/api/check-lnbits-payment.ts - Updated with more robust error handling
import type { NextApiRequest, NextApiResponse } from 'next';

// Your LNbits configuration
const LNBITS_API_KEY = process.env.LNBITS_API_KEY;
const RAW_LNBITS_URL = process.env.LNBITS_URL;
// Ensure URL has proper protocol prefix
const LNBITS_URL = RAW_LNBITS_URL && !RAW_LNBITS_URL.startsWith('http') 
  ? `https://${RAW_LNBITS_URL}` 
  : RAW_LNBITS_URL;

// Keep track of verified payments server-side (in-memory database)
// In production, use a real database
const verifiedPayments = new Set<string>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentHash, verifiedPayments: clientVerifiedPayments = [] } = req.body;

  if (!paymentHash || typeof paymentHash !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid paymentHash' });
  }

  // If this payment has been previously verified
  if (verifiedPayments.has(paymentHash) || clientVerifiedPayments.includes(paymentHash)) {
    console.log(`Payment ${paymentHash} found in verified payments cache`);
    return res.status(200).json({ paid: true, manualVerification: true });
  }

  try {
    console.log(`Checking payment status for hash: ${paymentHash}`);
    
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
      timeout: 10000, // 10 second timeout
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

    // If payment is verified, add to our verified payments set
    if (isPaid) {
      verifiedPayments.add(paymentHash);
    }

    return res.status(200).json({ paid: isPaid });
  } catch (error) {
    console.error('Error checking payment status:', error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error checking payment status' 
    });
  }
}

// pages/api/verify-pending-payments.ts - Making more robust with retry logic
import type { NextApiRequest, NextApiResponse } from 'next';

// Maximum number of retries for payment verification
const MAX_VERIFICATION_ATTEMPTS = 10;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { pendingPayments } = req.body;
  
  if (!Array.isArray(pendingPayments) || pendingPayments.length === 0) {
    return res.status(400).json({ message: 'No pending payments to verify' });
  }

  // Security: Validate all payment records
  for (const payment of pendingPayments) {
    if (!payment.paymentHash || !payment.pubkey || !payment.amount || !payment.createdAt) {
      return res.status(400).json({ 
        message: 'Invalid payment records detected',
        payment
      });
    }
  }

  const results: Record<string, boolean> = {};
  const verifiedPayments: string[] = [];

  console.log(`Attempting to verify ${pendingPayments.length} pending payments`);

  // Verify each payment
  await Promise.all(pendingPayments.map(async (payment) => {
    const { paymentHash } = payment;
    let verified = false;
    
    // Try verifying multiple times with delay
    for (let attempt = 0; attempt < MAX_VERIFICATION_ATTEMPTS; attempt++) {
      try {
        console.log(`Verification attempt ${attempt+1}/${MAX_VERIFICATION_ATTEMPTS} for payment ${paymentHash}`);
        
        const response = await fetch(`${req.headers.origin}/api/check-lnbits-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentHash, verifiedPayments }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.paid) {
            verified = true;
            verifiedPayments.push(paymentHash);
            
            console.log(`Payment ${paymentHash} verified successfully`);
            
            // Log the verified payment
            await fetch(`${req.headers.origin}/api/log-credit-transaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pubkey: payment.pubkey,
                type: 'add',
                amount: payment.amount,
                reason: 'Verified pending payment',
                paymentHash: payment.paymentHash,
                timestamp: new Date().toISOString()
              })
            }).catch(e => console.error('Error logging credit transaction:', e));
            
            break;
          }
        } else {
          console.error(`Verification attempt ${attempt+1} failed with status ${response.status}`);
          try {
            const errorData = await response.json();
            console.error('Error details:', errorData);
          } catch (e) {
            console.error('Could not parse error response');
          }
        }
      } catch (error) {
        console.error(`Error in verification attempt ${attempt+1} for payment ${paymentHash}:`, error);
      }
      
      // Wait before next attempt (increasing delay)
      await new Promise(r => setTimeout(r, 1000 + (attempt * 500)));
    }
    
    results[paymentHash] = verified;
  }));

  console.log('Verification results:', results);
  console.log('Verified payments:', verifiedPayments);

  return res.status(200).json({ 
    results,
    verified: verifiedPayments
  });
}
