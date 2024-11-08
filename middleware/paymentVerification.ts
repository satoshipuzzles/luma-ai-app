import { NextApiRequest, NextApiResponse } from 'next';

export interface PaymentVerifiedRequest extends NextApiRequest {
  paymentVerified?: boolean;
}

export async function verifyPayment(paymentHash: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.LNBITS_URL}/api/v1/payments/${paymentHash}`, {
      headers: {
        'X-Api-Key': process.env.LNBITS_API_KEY || '',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.paid;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}

export function withPaymentVerification(
  handler: (req: PaymentVerifiedRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: PaymentVerifiedRequest, res: NextApiResponse) => {
    const { paymentHash } = req.body;

    if (!paymentHash) {
      return res.status(400).json({ error: 'Payment hash required' });
    }

    const isPaid = await verifyPayment(paymentHash);
    if (!isPaid) {
      return res.status(402).json({ error: 'Payment required' });
    }

    req.paymentVerified = true;
    return handler(req, res);
  };
}
