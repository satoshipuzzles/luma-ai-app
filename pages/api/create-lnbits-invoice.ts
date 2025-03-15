// pages/api/create-lnbits-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const LNbitsAPIKey = process.env.LNBITS_API_KEY; // Your Invoice Key
const LNbitsURL = 'https://1a96a66a73.d.voltageapp.io'; // Your LNbits instance URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { amount } = req.body;

  if (!amount || typeof amount !== 'number') {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

  try {
    console.log(`Creating invoice for ${amount} sats`);
    console.log(`Using API key: ${LNbitsAPIKey ? 'Key provided' : 'No API key found'}`);
    console.log(`Using LNbits URL: ${LNbitsURL}`);

    // For development: Create a fake invoice for testing
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Returning fake invoice');
      return res.status(200).json({ 
        payment_request: 'lnbc100n1p3zj427pp5eplrde0yecvd0fphu2vd39xu3r7mfspsg7dhhx4uxpfx69nekqsdqqcqzpgxqyz5vqsp5hsfy92lqjm0f3jqjvwhuahevrxzgur42tjx8fpnwj3vygkxfaejq9qyyssq6tkw4pvrc7qkmd9u9735tmqmuhnrj9euc2a8frnxp9hn2vvcdnkxwrw24vkm38k34tjnpkgxrrh8hvw8xnn7t8vp25l0qzwa065yqcpskjd7k', 
        payment_hash: 'fake_payment_hash_for_dev'
      });
    }

    const response = await fetch(`${LNbitsURL}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': LNbitsAPIKey!,
      },
      body: JSON.stringify({
        out: false,
        amount: amount,
        memo: 'Payment for video generation',
      }),
    });

    const responseText = await response.text();
    console.log(`Raw response: ${responseText}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      return res.status(500).json({ 
        error: 'Failed to parse LNbits response',
        rawResponse: responseText
      });
    }

    if (!response.ok) {
      console.error('Error from LNbits API:', data);
      res
        .status(response.status)
        .json({ error: data.detail || data.message || 'Unknown error' });
      return;
    }

    console.log('Invoice data:', data);

    res.status(200).json({
      payment_request: data.payment_request,
      payment_hash: data.payment_hash,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res
      .status(500)
      .json({ error: (error as Error).message || 'Error creating invoice' });
  }
}
