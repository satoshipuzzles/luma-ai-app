// pages/api/log-credit-transaction.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Create log directory
const LOG_DIR = path.join(process.cwd(), 'credit-logs');
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
