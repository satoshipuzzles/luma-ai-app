// pages/api/verify-pending-payments.ts
import { NextApiRequest, NextApiResponse } from 'next';

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

  // Security: Validate that all payments have verification tokens
  const invalidPayments = pendingPayments.filter(payment => !payment.verificationToken);
  if (invalidPayments.length > 0) {
    return res.status(400).json({ 
      message: 'Invalid payment records detected',
      invalidCount: invalidPayments.length
    });
  }

  const results: Record<string, boolean> = {};
  const verifiedPayments: string[] = [];

  // Verify each payment
  await Promise.all(pendingPayments.map(async (payment) => {
    const { paymentHash } = payment;
    let verified = false;
    
    // Try verifying multiple times with delay
    for (let attempt = 0; attempt < MAX_VERIFICATION_ATTEMPTS; attempt++) {
      try {
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
            });
            
            break;
          }
        }
      } catch (error) {
        console.error(`Error verifying payment ${paymentHash}:`, error);
      }
      
      // Wait before next attempt (increasing delay)
      await new Promise(r => setTimeout(r, 1000 + (attempt * 500)));
    }
    
    results[paymentHash] = verified;
  }));

  return res.status(200).json({ 
    results,
    verified: verifiedPayments
  });
}
