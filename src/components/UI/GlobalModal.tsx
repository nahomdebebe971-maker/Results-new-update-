import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, AlertCircle, AlertTriangle, Info, 
  X, Database, TrendingUp, ArrowRight 
} from 'lucide-react';
import { useModal } from '../../context/ModalContext';

export const GlobalModal: React.FC = () => {
  const { isOpen, options, hideModal } = useModal();

  if (!options) return null;

  const {
    title,
    message,
    type = 'info',
    onConfirm,
    onCancel,
    confirmText = 'Continue',
    cancelText = 'Cancel',
    showUsage = false,
    estimatedUsage,
    currentUsage
  } = options;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-12 h-12 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-12 h-12 text-rose-500" />;
      case 'warning': return <AlertTriangle className="w-12 h-12 text-amber-500" />;
      case 'confirm': return <Database className="w-12 h-12 text-indigo-500" />;
      default: return <Info className="w-12 h-12 text-blue-500" />;
    }
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    hideModal();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    hideModal();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
          >
            <div className="p-8">
              <button 
                onClick={handleCancel}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                id="modal-close-btn"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-3xl">
                  {getIcon()}
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    {title}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    {message}
                  </p>
                </div>

                {showUsage && (estimatedUsage || currentUsage) && (
                  <div className="w-full space-y-4 bg-gray-50 dark:bg-gray-850 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 text-left">
                    {currentUsage && (
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <TrendingUp className="w-3 h-3 text-emerald-500" /> Current Session Usage
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Reads</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{currentUsage.reads.toLocaleString()}</p>
                             </div>
                             <div className="bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Writes</p>
                                <p className="text-lg font-black text-indigo-600">{currentUsage.writes.toLocaleString()}</p>
                             </div>
                          </div>
                       </div>
                    )}

                    {estimatedUsage && (
                      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                           <Database className="w-3 h-3 text-indigo-500" /> Estimated Impact
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Estimated Reads</p>
                            <div className="flex items-center gap-2">
                               <p className="font-mono text-xs font-bold text-gray-500">~{estimatedUsage.reads}</p>
                               <ArrowRight className="w-2 h-2 text-gray-300" />
                               <p className="font-mono text-sm font-black text-indigo-600">~{(currentUsage?.reads || 0) + estimatedUsage.reads}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Estimated Writes</p>
                            <div className="flex items-center gap-2">
                               <p className="font-mono text-xs font-bold text-gray-500">~{estimatedUsage.writes}</p>
                               <ArrowRight className="w-2 h-2 text-gray-300" />
                               <p className="font-mono text-sm font-black text-rose-500">~{(currentUsage?.writes || 0) + estimatedUsage.writes}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {type === 'confirm' && (
                       <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider text-center pt-2">
                          WARNING: This action will affect your daily Spark quota.
                       </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 w-full pt-4">
                  {type === 'confirm' || type === 'confirm' ? (
                    <>
                      <button
                        onClick={handleCancel}
                        className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
                        id="modal-cancel-btn"
                      >
                        {cancelText}
                      </button>
                      <button
                        onClick={handleConfirm}
                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                        id="modal-confirm-btn"
                      >
                        {confirmText}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConfirm}
                      className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
                      id="modal-ok-btn"
                    >
                      {confirmText === 'Continue' ? 'OK' : confirmText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
