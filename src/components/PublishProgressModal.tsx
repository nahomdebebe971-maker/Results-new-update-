import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';

export interface ProgressData {
  current: number;
  total: number;
  status: string;
  stage: 'fetching' | 'processing' | 'writing' | 'completed' | 'error';
  gradeName?: string;
  section?: string;
  successful?: number;
  failed?: number;
  failedStudents?: string[];
  startTime?: number;
}

interface PublishProgressModalProps {
  progress: ProgressData | null;
  onClose: () => void;
  onRetry?: (failedIds: string[]) => void;
}

export const PublishProgressModal: React.FC<PublishProgressModalProps> = ({ progress, onClose, onRetry }) => {
  if (!progress) return null;

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const isFinished = progress.stage === 'completed' || progress.stage === 'error';
  const hasFailures = (progress.failed || 0) > 0;

  // Calculate estimated time remaining
  const getTimeRemaining = () => {
    if (!progress.startTime || isFinished || progress.current === 0) return null;
    const elapsed = Date.now() - progress.startTime;
    const avgPerItem = elapsed / progress.current;
    const remaining = progress.total - progress.current;
    const estMs = remaining * avgPerItem;
    
    if (estMs < 1000) return 'Few seconds...';
    const seconds = Math.ceil(estMs / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`;
    return `${seconds}s remaining`;
  };

  const estTime = getTimeRemaining();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-colors ${
              progress.stage === 'error' ? 'bg-rose-50 text-rose-500' : 
              progress.stage === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {progress.stage === 'error' ? <XCircle className="w-10 h-10" /> : 
               progress.stage === 'completed' ? <CheckCircle2 className="w-10 h-10" /> : 
               <Loader2 className="w-10 h-10 animate-spin" />}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                {progress.stage === 'error' ? 'Publishing Failed' : 
                 progress.stage === 'completed' ? 'Publishing Successful' : 'Publishing Results...'}
              </h3>
              {(progress.gradeName && progress.section) && (
                <p className="text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest">
                  Grade {progress.gradeName} Section {progress.section}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar Section */}
          <div className="space-y-6">
            {!isFinished && (
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Processing</span>
                  <span className="text-2xl font-black text-indigo-600 tabular-nums">{percentage}%</span>
                </div>
                <div className="w-full h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200/50 dark:border-gray-750">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  <span>Processed: {progress.current}</span>
                  {hasFailures && <span className="text-rose-500">Failed: {progress.failed}</span>}
                  <span>{estTime || `Remaining: ${Math.max(0, progress.total - progress.current)}`}</span>
                </div>
              </div>
            )}

            {/* Status Message */}
            <div className={`p-4 rounded-2xl flex gap-3 items-start ${
              progress.stage === 'error' ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400' : 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400'
            }`}>
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold leading-tight">{progress.status}</p>
                {percentage > 0 && percentage < 100 && (
                   <p className="text-[10px] opacity-70">Please do not close this window until the process is complete.</p>
                )}
              </div>
            </div>

            {/* Summary details for success or partial success */}
            {progress.stage === 'completed' && (
              <div className={`p-6 rounded-[2rem] border text-center space-y-4 ${
                hasFailures ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40' : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40'
              }`}>
                 <div className="space-y-0.5">
                   <p className={`text-[10px] font-black uppercase tracking-widest ${hasFailures ? 'text-amber-600/60' : 'text-emerald-600/60'}`}>Publication Summary</p>
                   <div className="flex justify-center items-baseline gap-2">
                     <span className={`text-4xl font-black ${hasFailures ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{progress.successful}</span>
                     <span className="text-gray-400 text-sm font-bold">/ {progress.total}</span>
                   </div>
                   <p className={`text-xs font-bold ${hasFailures ? 'text-amber-600/80' : 'text-emerald-600/80'}`}>
                     {hasFailures ? `${progress.failed} Records Failed to Save` : 'Students Published Successfully'}
                   </p>
                 </div>

                 {hasFailures && onRetry && (
                   <button 
                    onClick={() => onRetry(progress.failedStudents || [])}
                    className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-amber-900/20"
                   >
                     Retry Failed Records
                   </button>
                 )}

                 <button 
                  onClick={onClose}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                    hasFailures ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-900/20'
                  }`}
                 >
                   {hasFailures ? 'Close Anyway' : 'Done'}
                 </button>
              </div>
            )}

            {/* Error controls */}
            {progress.stage === 'error' && (
              <div className="space-y-3">
                 <button 
                  onClick={onClose}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-rose-900/20"
                 >
                   Close & Review Errors
                 </button>
              </div>
            )}
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
