// pages/api/lnbits-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Create a directory to store payment notifications
const WEBHOOK_DIR = path.join(process.cwd(), 'lnbits-webhooks');
if (!fs.existsSync(WEBHOOK_DIR)) {
  try {
    fs.mkdirSync(WEBHOOK_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create webhook directory:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Log the raw webhook data for debugging
    console.log('Received LNbits webhook:', JSON.stringify(req.body));
    
    // Extract payment info
    const {
      payment_hash,
      paid,
      amount,
      payment_request,
      // Other fields that might be useful
      // description, memo, time, fee, checking_id, lnurlp, webhook, webhook_status
    } = req.body;

    // Validate the webhook data
    if (!payment_hash) {
      return res.status(400).json({ message: 'Missing payment_hash in webhook data' });
    }

    // Store the webhook data for reference
    const logFilePath = path.join(WEBHOOK_DIR, `${payment_hash}.json`);
    fs.writeFileSync(
      logFilePath, 
      JSON.stringify({
        ...req.body,
        received_at: new Date().toISOString(),
        client_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      }, null, 2)
    );

    console.log(`Webhook data saved to ${logFilePath}`);

    // You could implement additional logic here like:
    // 1. Update a database with the payment status
    // 2. Notify connected clients via WebSockets
    // 3. Trigger generation if this confirms a payment

    // Always return success to the LNbits server
    return res.status(200).json({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Still return 200 to avoid webhook retries
    return res.status(200).json({ 
      message: 'Webhook received with errors',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
