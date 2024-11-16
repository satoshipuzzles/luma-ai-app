import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lnAddress, amount, comment } = req.body;

  if (!lnAddress || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // First, get the lightning address info
    const lnAddressResponse = await fetch(
      `https://${lnAddress.split('@')[1]}/.well-known/lnurlp/${lnAddress.split('@')[0]}`
    );

    if (!lnAddressResponse.ok) {
      throw new Error('Failed to fetch lightning address info');
    }

    const lnAddressData = await lnAddressResponse.json();
    
    if (!lnAddressData.callback) {
      throw new Error('Invalid lightning address data');
    }

    // Create the invoice
    const callbackUrl = new URL(lnAddressData.callback);
    callbackUrl.searchParams.set('amount', (amount * 1000).toString()); // Convert to millisats
    if (comment) {
      callbackUrl.searchParams.set('comment', comment);
    }

    const invoiceResponse = await fetch(callbackUrl.toString());
    
    if (!invoiceResponse.ok) {
      throw new Error('Failed to create invoice');
    }

    const invoiceData = await invoiceResponse.json();

    if (!invoiceData.pr) {
      throw new Error('No payment request in response');
    }

    return res.status(200).json({
      payment_request: invoiceData.pr,
      verify_url: invoiceData.verify,
      expires_at: Date.now() + 600000 // 10 minutes from now
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create invoice' 
    });
  }
}
