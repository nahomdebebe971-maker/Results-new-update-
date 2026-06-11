import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, XCircle, Loader2, 
  ArrowRight, Clock, Box 
} from 'lucide-react';
import { useProgress } from '../context/ProgressContext';

export const GlobalProgressModal: React.FC = () => {
  const { state, closeProgress } = useProgress();

  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
      >
        <div className="p-8 text-center">
          {state.status === 'processing' && (
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Box className="w-6 h-6 text-indigo-400" />
                </div>
              </div>
            </div>
          )}

          {state.status === 'success' && (
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex justify-center mb-6"
            >
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
            </motion.div>
          )}

          {state.status === 'error' && (
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex justify-center mb-6"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-rose-500" />
              </div>
            </motion.div>
          )}

          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
            {state.status === 'processing' ? state.operationName : 
             state.status === 'success' ? 'Operation Completed' : 'Operation Failed'}
          </h3>
          
          <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-widest mb-8">
            {state.status === 'processing' ? state.currentStep : 
             state.status === 'success' ? 'Task finished successfully' : state.error}
          </p>

          {state.status === 'processing' && (
            <div className="space-y-6">
               <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between font-mono">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {state.progress}%
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">
                      {state.processedCount} / {state.totalCount}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${state.progress}%` }}
                    />
                  </div>
               </div>

               <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-50 dark:border-gray-850">
                  <div className="flex items-center gap-2">
                     <Clock className="w-4 h-4 text-gray-300" />
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {state.estimatedTimeRemaining || 'Calculating...'}
                     </span>
                  </div>
               </div>
            </div>
          )}

          {(state.status === 'success' || state.status === 'error') && (
            <button 
              onClick={closeProgress}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                state.status === 'success' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Continue
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
