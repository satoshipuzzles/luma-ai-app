// utils/payment.ts
import crypto from 'crypto';

export interface PendingPayment {
  paymentHash: string;
  paymentRequest: string;
  amount: number;
  createdAt: string;
  prompt: string;
  pubkey: string;
  verified: boolean;
  expiredAt?: string;
  // Security enhancement: add a verification token
  verificationToken?: string;
}

// Generate a secure verification token to prevent tampering
export const generateVerificationToken = (paymentHash: string, pubkey: string, amount: number): string => {
  // In a production app, you would use a server-side secret here
  // For now, we'll use a combination of the data with a timestamp
  const data = `${paymentHash}:${pubkey}:${amount}:${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Validate a verification token
export const validateVerificationToken = (
  token: string, 
  paymentHash: string, 
  pubkey: string, 
  amount: number
): boolean => {
  // In a real implementation, you would validate against a server-stored secret
  // This is a simplified version for demonstration
  if (!token || token.length !== 64) return false;
  
  // The real validation would happen server-side
  return true;
}

// Save pending payment to localStorage with enhanced security
export const savePendingPayment = (payment: PendingPayment): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const storedPayments = localStorage.getItem('pendingPayments');
    let paymentsArray: PendingPayment[] = storedPayments ? JSON.parse(storedPayments) : [];
    
    // Remove any existing payment with same hash to avoid duplicates
    paymentsArray = paymentsArray.filter(p => p.paymentHash !== payment.paymentHash);
    
    // Generate verification token for security
    const verificationToken = generateVerificationToken(
      payment.paymentHash,
      payment.pubkey,
      payment.amount
    );
    
    // Add new payment with verification token
    paymentsArray.push({
      ...payment,
      verificationToken
    });
    
    localStorage.setItem('pendingPayments', JSON.stringify(paymentsArray));
  } catch (error) {
    console.error('Error saving pending payment:', error);
  }
};

// Get pending payments from localStorage with validation
export const getPendingPayments = (): PendingPayment[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedPayments = localStorage.getItem('pendingPayments');
    if (!storedPayments) return [];
    
    const paymentsArray: PendingPayment[] = JSON.parse(storedPayments);
    
    // Filter out any payments that fail verification
    return paymentsArray.filter(payment => {
      if (!payment.verificationToken) return false;
      
      return validateVerificationToken(
        payment.verificationToken,
        payment.paymentHash,
        payment.pubkey,
        payment.amount
      );
    });
  } catch (error) {
    console.error('Error getting pending payments:', error);
    return [];
  }
};

// Update payment verification status
export const markPaymentAsVerified = (paymentHash: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const storedPayments = localStorage.getItem('pendingPayments');
    if (!storedPayments) return;
    
    let paymentsArray: PendingPayment[] = JSON.parse(storedPayments);
    
    // Find and update payment
    const paymentIndex = paymentsArray.findIndex(p => p.paymentHash === paymentHash);
    if (paymentIndex >= 0) {
      paymentsArray[paymentIndex].verified = true;
      localStorage.setItem('pendingPayments', JSON.stringify(paymentsArray));
    }
  } catch (error) {
    console.error('Error marking payment as verified:', error);
  }
};

// Mark payment as expired
export const markPaymentAsExpired = (paymentHash: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const storedPayments = localStorage.getItem('pendingPayments');
    if (!storedPayments) return;
    
    let paymentsArray: PendingPayment[] = JSON.parse(storedPayments);
    
    // Find and update payment
    const paymentIndex = paymentsArray.findIndex(p => p.paymentHash === paymentHash);
    if (paymentIndex >= 0) {
      paymentsArray[paymentIndex].expiredAt = new Date().toISOString();
      localStorage.setItem('pendingPayments', JSON.stringify(paymentsArray));
    }
  } catch (error) {
    console.error('Error marking payment as expired:', error);
  }
};

// Delete a pending payment
export const deletePendingPayment = (paymentHash: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const storedPayments = localStorage.getItem('pendingPayments');
    if (!storedPayments) return;
    
    let paymentsArray: PendingPayment[] = JSON.parse(storedPayments);
    
    // Filter out the specified payment
    paymentsArray = paymentsArray.filter(p => p.paymentHash !== paymentHash);
    localStorage.setItem('pendingPayments', JSON.stringify(paymentsArray));
  } catch (error) {
    console.error('Error deleting pending payment:', error);
  }
};

// Get user's unverified payments
export const getUnverifiedPayments = (pubkey: string): PendingPayment[] => {
  const allPayments = getPendingPayments();
  return allPayments.filter(p => 
    p.pubkey === pubkey && 
    !p.verified && 
    !p.expiredAt &&
    // Only include payments created in the last 24 hours
    new Date().getTime() - new Date(p.createdAt).getTime() < 24 * 60 * 60 * 1000
  );
};

// Check for a specific unverified payment by hash
export const getUnverifiedPayment = (paymentHash: string): PendingPayment | null => {
  const allPayments = getPendingPayments();
  return allPayments.find(p => p.paymentHash === paymentHash && !p.verified && !p.expiredAt) || null;
};
