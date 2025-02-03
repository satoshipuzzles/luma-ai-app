// context/FeeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { GenerationFees } from '@/types/luma';

interface FeeContextType {
  fees: GenerationFees;
  loading: boolean;
  error: string | null;
}

const FeeContext = createContext<FeeContextType>({
  fees: {},
  loading: false,
  error: null
});

export const FeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fees, setFees] = useState<GenerationFees>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFees = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/fees');
        if (!response.ok) {
          throw new Error('Failed to fetch fees');
        }
        const data = await response.json();
        setFees(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fees');
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, []);

  return (
    <FeeContext.Provider value={{ fees, loading, error }}>
      {children}
    </FeeContext.Provider>
  );
};

export const useFees = () => {
  const context = useContext(FeeContext);
  if (context === undefined) {
    throw new Error('useFees must be used within a FeeProvider');
  }
  return context;
};

export default FeeContext;
