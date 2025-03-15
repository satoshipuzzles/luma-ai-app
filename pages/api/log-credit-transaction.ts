// pages/api/log-credit-transaction.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// In production, you'd use a database instead of file storage
const LOG_DIR = path.join(process.cwd(), 'credit-logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create credit logs directory:', error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { 
      pubkey, 
      type, 
      amount, 
      reason, 
      paymentHash, 
      generationId,
      timestamp 
    } = req.body;

    // Validate inputs
    if (!pubkey || !type || typeof amount !== 'number' || !timestamp) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Basic sanitization of pubkey to use as filename
    const sanitizedPubkey = pubkey.replace(/[^a-zA-Z0-9]/g, '');
    const logFilePath = path.join(LOG_DIR, `${sanitizedPubkey}.log`);

    // Create log entry
    const logEntry = JSON.stringify({
      pubkey,
      type,
      amount,
      reason,
      paymentHash,
      generationId,
      timestamp,
      clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Append to log file
    fs.appendFileSync(logFilePath, logEntry + '\n');

    return res.status(200).json({ message: 'Transaction logged' });
  } catch (error) {
    console.error('Error logging credit transaction:', error);
    return res.status(500).json({ 
      message: 'Failed to log transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// pages/api/get-credit-history.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Match with log directory above
const LOG_DIR = path.join(process.cwd(), 'credit-logs');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { pubkey } = req.query;

    if (!pubkey || typeof pubkey !== 'string') {
      return res.status(400).json({ message: 'Valid pubkey is required' });
    }

    // Basic sanitization of pubkey
    const sanitizedPubkey = pubkey.replace(/[^a-zA-Z0-9]/g, '');
    const logFilePath = path.join(LOG_DIR, `${sanitizedPubkey}.log`);

    // Check if file exists
    if (!fs.existsSync(logFilePath)) {
      return res.status(200).json({ transactions: [] });
    }

    // Read and parse log file
    const logContent = fs.readFileSync(logFilePath, 'utf-8');
    const transactions = logContent
      .split('\n')
      .filter(line => line.trim())  // Remove empty lines
      .map(line => JSON.parse(line))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Sort by newest first

    return res.status(200).json({ transactions });
  } catch (error) {
    console.error('Error getting credit history:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve transaction history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// pages/api/verify-pending-payments.ts
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
