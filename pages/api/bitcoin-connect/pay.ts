import type { NextApiRequest, NextApiResponse } from 'next';
import { validatePaymentRequest, decodeInvoice } from 'lightning-invoice-decoder';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { invoice, amount, pubkey } = req.body;

  if (!invoice || !amount || !pubkey) {
    return res.status(400).json({ 
      error: 'Missing required fields: invoice, amount, and pubkey are required' 
    });
  }

  try {
    // Validate the invoice
    const isValid = validatePaymentRequest(invoice);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid lightning invoice' });
    }

    // Decode the invoice to verify amount
    const decodedInvoice = decodeInvoice(invoice);
    if (decodedInvoice.amount !== amount) {
      return res.status(400).json({ 
        error: 'Invoice amount does not match expected amount' 
      });
    }

    // At this point, the invoice is valid and matches the expected amount
    // You can add additional verification or logging here if needed

    return res.status(200).json({ 
      valid: true,
      decoded: decodedInvoice
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error processing payment' 
    });
  }
}
