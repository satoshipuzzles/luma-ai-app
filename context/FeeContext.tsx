// context/FeeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { GenerationFees } from '@/types/luma';

interface FeeContextType {
  fees: GenerationFees;
  getFee: (model: string) => number;
  refreshFees: () => Promise<void>;
}

const FeeContext = createContext<FeeContextType | undefined>(undefined);

export const FeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fees, setFees] = useState<GenerationFees>({
    'ray-2': 2000,
    'ray-1-6': 1000,
    'photon-1': 500,
    'photon-flash-1': 300
  });

  const refreshFees = async () => {
    try {
      const response = await fetch('/api/admin/fees');
      if (response.ok) {
        const currentFees = await response.json();
        setFees(currentFees);
      }
    } catch (error) {
      console.error('Failed to fetch fees:', error);
    }
  };

  const getFee = (model: string): number => {
    return fees[model as keyof GenerationFees] || 1000;
  };

  useEffect(() => {
    refreshFees();
  }, []);

  return (
    <FeeContext.Provider value={{ fees, getFee, refreshFees }}>
      {children}
    </FeeContext.Provider>
  );
};

export const useFees = () => {
  const context = useContext(FeeContext);
  if (!context) {
    throw new Error('useFees must be used within a FeeProvider');
  }
  return context;
};
