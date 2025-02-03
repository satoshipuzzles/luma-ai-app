// pages/api/admin/fees.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GenerationFees } from '@/types/luma';

// In production, you'd use a database
let currentFees: GenerationFees = {
  'ray-2': 2000,
  'ray-1-6': 1000,
  'photon-1': 500,
  'photon-flash-1': 300
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(currentFees);
  }

  if (req.method === 'POST') {
    try {
      const newFees = req.body;
      // Validate fees
      if (Object.values(newFees).some(fee => fee < 0)) {
        return res.status(400).json({ error: 'Fees cannot be negative' });
      }
      
      currentFees = { ...currentFees, ...newFees };
      return res.status(200).json(currentFees);
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to update fees',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
