import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyPayment } from '../../middleware/paymentVerification';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentHash } = req.body;

  if (!paymentHash) {
    return res.status(400).json({ error: 'Payment hash required' });
  }

  try {
    const isPaid = await verifyPayment(paymentHash);
    return res.status(200).json({ paid: isPaid });
  } catch (error) {
    console.error('Error checking payment:', error);
    return res.status(500).json({
      error: 'Failed to check payment status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
