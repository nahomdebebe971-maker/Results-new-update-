import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ProgressState {
  isOpen: boolean;
  operationName: string;
  progress: number; // 0-100
  currentStep: string;
  processedCount: number;
  totalCount: number;
  estimatedTimeRemaining?: string;
  status: 'processing' | 'success' | 'error';
  error?: string;
}

interface ProgressContextType {
  state: ProgressState;
  startOperation: (name: string, total?: number) => void;
  updateProgress: (progress: number, step?: string, processed?: number) => void;
  completeOperation: (message?: string) => void;
  failOperation: (error: string) => void;
  closeProgress: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ProgressState>({
    isOpen: false,
    operationName: '',
    progress: 0,
    currentStep: '',
    processedCount: 0,
    totalCount: 0,
    status: 'processing'
  });

  const startOperation = (name: string, total: number = 100) => {
    setState({
      isOpen: true,
      operationName: name,
      progress: 0,
      currentStep: 'Initializing...',
      processedCount: 0,
      totalCount: total,
      status: 'processing'
    });
  };

  const updateProgress = (progress: number, step?: string, processed?: number) => {
    setState(prev => ({
      ...prev,
      progress,
      currentStep: step || prev.currentStep,
      processedCount: processed !== undefined ? processed : prev.processedCount
    }));
  };

  const completeOperation = () => {
    setState(prev => ({ ...prev, progress: 100, status: 'success', currentStep: 'Success' }));
  };

  const failOperation = (error: string) => {
    setState(prev => ({ ...prev, status: 'error', error }));
  };

  const closeProgress = () => {
    setState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <ProgressContext.Provider value={{ state, startOperation, updateProgress, completeOperation, failOperation, closeProgress }}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used within a ProgressProvider');
  return context;
};
