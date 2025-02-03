// pages/api/admin/fees.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GenerationFees } from '@/types/luma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify admin authentication here
  const isAdmin = true; // Replace with actual admin check

  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        // Return current fees
        const currentFees: GenerationFees = {
          'ray-2': 2000,
          'ray-1-6': 1000,
          'photon-1': 500,
          'photon-flash-1': 300
        };
        return res.status(200).json(currentFees);

      case 'POST':
        const newFees = req.body as GenerationFees;
        
        // Validate fees
        if (Object.values(newFees).some((fee: number) => fee < 0)) {
          return res.status(400).json({ error: 'Fees cannot be negative' });
        }
        
        // Update fees logic here
        return res.status(200).json(newFees);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Error handling fees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
