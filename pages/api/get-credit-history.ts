// pages/api/get-credit-history.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Match with log directory from log-credit-transaction.ts
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
