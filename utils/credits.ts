// utils/credits.ts
import { UserCredit, CreditTransaction } from '../types/credits';
import crypto from 'crypto';

// Generate a unique transaction ID
const generateTransactionId = (): string => {
  return crypto.randomUUID ? 
    crypto.randomUUID() : 
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Generate a security hash to prevent tampering
const generateSecurityHash = (pubkey: string, credits: number, transactions: CreditTransaction[]): string => {
  const data = `${pubkey}:${credits}:${JSON.stringify(transactions)}:${process.env.NEXT_PUBLIC_SECURITY_SALT || 'animal-sunset'}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Validate a user's credit record
const validateCreditRecord = (credit: UserCredit): boolean => {
  const calculatedHash = generateSecurityHash(credit.pubkey, credit.credits, credit.creditHistory);
  
  // If security hash doesn't match, the record may have been tampered with
  if (calculatedHash !== credit.securityHash) {
    console.error('Credit record security validation failed');
    return false;
  }
  
  // Verify the credit amount matches the sum of transactions
  const calculatedBalance = credit.creditHistory.reduce((total, tx) => {
    if (tx.type === 'add' || tx.type === 'refund') {
      return total + tx.amount;
    } else if (tx.type === 'use') {
      return total - tx.amount;
    }
    return total;
  }, 0);
  
  if (calculatedBalance !== credit.credits) {
    console.error('Credit balance does not match transaction history');
    return false;
  }
  
  return true;
};

// Get user credits from localStorage with validation
export const getUserCredits = (pubkey: string): number => {
  if (typeof window === 'undefined') return 0;
  
  try {
    const storedCredits = localStorage.getItem('userCredits');
    if (!storedCredits) return 0;
    
    const creditsMap: UserCredit[] = JSON.parse(storedCredits);
    const userCredit = creditsMap.find(credit => credit.pubkey === pubkey);
    
    if (!userCredit) return 0;
    
    // Validate the credit record for tampering
    if (!validateCreditRecord(userCredit)) {
      // If validation fails, reset credits to prevent potential exploitation
      console.error('Credit validation failed, resetting credits');
      return 0;
    }
    
    return userCredit.credits;
  } catch (error) {
    console.error('Error getting user credits:', error);
    return 0;
  }
};

// Add a new transaction to a user's credit history
const addTransaction = (
  pubkey: string, 
  amount: number, 
  type: 'add' | 'use' | 'refund', 
  reason: string,
  paymentHash?: string,
  generationId?: string
): CreditTransaction => {
  const transaction: CreditTransaction = {
    id: generateTransactionId(),
    timestamp: new Date().toISOString(),
    amount,
    type,
    reason,
    paymentHash,
    generationId
  };
  
  return transaction;
};

// Update user credits with transaction tracking
export const updateUserCredits = (
  pubkey: string, 
  newCredits: number, 
  transactionType: 'add' | 'use' | 'refund',
  amount: number,
  reason: string,
  paymentHash?: string,
  generationId?: string
): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const storedCredits = localStorage.getItem('userCredits');
    let creditsMap: UserCredit[] = storedCredits ? JSON.parse(storedCredits) : [];
    
    const existingIndex = creditsMap.findIndex(credit => credit.pubkey === pubkey);
    
    if (existingIndex >= 0) {
      // Add the new transaction to history
      const newTransaction = addTransaction(
        pubkey, 
        amount, 
        transactionType, 
        reason,
        paymentHash,
        generationId
      );
      
      const transactions = [...creditsMap[existingIndex].creditHistory, newTransaction];
      
      // Update the record with new values
      creditsMap[existingIndex] = {
        pubkey,
        credits: newCredits,
        lastUpdated: new Date().toISOString(),
        creditHistory: transactions,
        securityHash: generateSecurityHash(pubkey, newCredits, transactions)
      };
    } else {
      // Create new record with initial transaction
      const transactions = [
        addTransaction(
          pubkey, 
          amount, 
          transactionType, 
          reason,
          paymentHash,
          generationId
        )
      ];
      
      creditsMap.push({
        pubkey,
        credits: newCredits,
        lastUpdated: new Date().toISOString(),
        creditHistory: transactions,
        securityHash: generateSecurityHash(pubkey, newCredits, transactions)
      });
    }
    
    localStorage.setItem('userCredits', JSON.stringify(creditsMap));
  } catch (error) {
    console.error('Error updating user credits:', error);
  }
};

// Add credits to a user with security tracking
export const addUserCredits = (
  pubkey: string, 
  creditsToAdd: number, 
  reason: string = "Credit addition",
  paymentHash?: string
): number => {
  const currentCredits = getUserCredits(pubkey);
  const newCredits = currentCredits + creditsToAdd;
  
  updateUserCredits(
    pubkey, 
    newCredits, 
    'add', 
    creditsToAdd, 
    reason,
    paymentHash
  );
  
  // Also log to server for additional security
  logCreditTransaction(pubkey, 'add', creditsToAdd, reason, paymentHash);
  
  return newCredits;
};

// Use credits for a generation with validation
export const useCredits = (
  pubkey: string, 
  creditsToUse: number, 
  generationId: string
): boolean => {
  const currentCredits = getUserCredits(pubkey);
  
  if (currentCredits >= creditsToUse) {
    const newCredits = currentCredits - creditsToUse;
    
    updateUserCredits(
      pubkey, 
      newCredits, 
      'use', 
      creditsToUse, 
      "Video generation",
      undefined,
      generationId
    );
    
    // Also log to server for additional security
    logCreditTransaction(
      pubkey, 
      'use', 
      creditsToUse, 
      "Video generation", 
      undefined, 
      generationId
    );
    
    return true;
  }
  
  return false;
};

// Refund credits for failed generations
export const refundCredits = (
  pubkey: string, 
  creditsToRefund: number, 
  generationId: string
): number => {
  const currentCredits = getUserCredits(pubkey);
  const newCredits = currentCredits + creditsToRefund;
  
  updateUserCredits(
    pubkey, 
    newCredits, 
    'refund', 
    creditsToRefund, 
    "Failed generation refund",
    undefined,
    generationId
  );
  
  // Also log to server for additional security
  logCreditTransaction(
    pubkey, 
    'refund', 
    creditsToRefund, 
    "Failed generation refund", 
    undefined, 
    generationId
  );
  
  return newCredits;
};

// Log transaction to server for additional security
const logCreditTransaction = async (
  pubkey: string, 
  type: 'add' | 'use' | 'refund',
  amount: number,
  reason: string,
  paymentHash?: string, 
  generationId?: string
): Promise<void> => {
  try {
    // Only do this client-side
    if (typeof window === 'undefined') return;
    
    await fetch('/api/log-credit-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey,
        type,
        amount,
        reason,
        paymentHash,
        generationId,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Error logging credit transaction:', error);
    // Non-critical operation, so we don't need to handle errors
  }
};

// Get user's credit transaction history
export const getCreditHistory = (pubkey: string): CreditTransaction[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedCredits = localStorage.getItem('userCredits');
    if (!storedCredits) return [];
    
    const creditsMap: UserCredit[] = JSON.parse(storedCredits);
    const userCredit = creditsMap.find(credit => credit.pubkey === pubkey);
    
    if (!userCredit || !validateCreditRecord(userCredit)) {
      return [];
    }
    
    return userCredit.creditHistory;
  } catch (error) {
    console.error('Error getting credit history:', error);
    return [];
  }
};
