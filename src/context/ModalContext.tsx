import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ModalType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface ModalOptions {
  title: string;
  message: string;
  type?: ModalType;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showUsage?: boolean;
  estimatedUsage?: {
    reads: number;
    writes: number;
  };
  currentUsage?: {
    reads: number;
    writes: number;
  };
}

interface ModalContextType {
  isOpen: boolean;
  options: ModalOptions | null;
  showModal: (options: ModalOptions) => void;
  hideModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ModalOptions | null>(null);

  const showModal = (newOptions: ModalOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
  };

  const hideModal = () => {
    setIsOpen(false);
    setTimeout(() => setOptions(null), 300); // Wait for animation
  };

  return (
    <ModalContext.Provider value={{ isOpen, options, showModal, hideModal }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
