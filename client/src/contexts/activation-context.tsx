import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ActivationEntry {
  timestamp: number;
}

interface ActivationState {
  [key: string]: ActivationEntry;
}

interface ActivationContextType {
  isActivating: (id: string) => boolean;
  startActivation: (id: string) => void;
  stopActivation: (id: string) => void;
}

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

const STORAGE_KEY = 'activation-states';
const EXPIRATION_TIME = 30000; // 30 seconds - assume any activation older than this is stale

function cleanStaleEntries(state: ActivationState): ActivationState {
  const now = Date.now();
  const cleaned: ActivationState = {};
  
  Object.entries(state).forEach(([id, entry]) => {
    if (now - entry.timestamp < EXPIRATION_TIME) {
      cleaned[id] = entry;
    }
  });
  
  return cleaned;
}

export function ActivationProvider({ children }: { children: ReactNode }) {
  const [activatingItems, setActivatingItems] = useState<ActivationState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      return cleanStaleEntries(parsed);
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activatingItems));
  }, [activatingItems]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivatingItems(prev => cleanStaleEntries(prev));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const isActivating = (id: string): boolean => {
    const entry = activatingItems[id];
    if (!entry) return false;
    
    const isStale = Date.now() - entry.timestamp > EXPIRATION_TIME;
    return !isStale;
  };

  const startActivation = (id: string) => {
    setActivatingItems(prev => ({ 
      ...prev, 
      [id]: { timestamp: Date.now() }
    }));
  };

  const stopActivation = (id: string) => {
    setActivatingItems(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  return (
    <ActivationContext.Provider value={{ isActivating, startActivation, stopActivation }}>
      {children}
    </ActivationContext.Provider>
  );
}

export function useActivation() {
  const context = useContext(ActivationContext);
  if (!context) {
    throw new Error('useActivation must be used within ActivationProvider');
  }
  return context;
}
