import React, { useState, useEffect } from 'react';
import { 
  Bell, CheckCircle2, AlertCircle, Info, 
  Trash2, X, Clock, MessageSquare, ChevronRight,
  Eye, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeToNotifications, 
  markAsRead, 
  markAllUnreadAsRead,
  SystemNotification 
} from '../lib/notificationService';

interface NotificationPanelProps {
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const unsub = subscribeToNotifications(setNotifications);
    return () => unsub();
  }, []);

  const filtered = notifications.filter(n => activeTab === 'all' || !n.isRead);

  const getIcon = (type: string) => {
    switch (type) {
      case 'MARK_UPDATE': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'CONDUCT_UPDATE': return <Info className="w-4 h-4 text-blue-500" />;
      case 'FINALIZATION': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <motion.div 
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed top-0 right-0 h-screen w-[400px] bg-white dark:bg-gray-900 shadow-2xl z-[100] border-l border-gray-100 dark:border-gray-800 flex flex-col"
    >
      <div className="p-6 border-b border-gray-50 dark:border-gray-850 flex items-center justify-between">
        <div>
           <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
             <Bell className="w-6 h-6 text-indigo-500" /> Notifications
           </h2>
           <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Live Feed of System Activity</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex p-4 gap-2 bg-gray-50/50 dark:bg-gray-850/50">
         <button 
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
            activeTab === 'all' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
         >All</button>
         <button 
          onClick={() => setActiveTab('unread')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
            activeTab === 'unread' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
         >Unread ({notifications.filter(n => !n.isRead).length})</button>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-3">
         {filtered.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p className="text-sm font-bold">No notifications found.</p>
           </div>
         ) : (
           filtered.map((n) => (
             <motion.div 
               layout
               key={n.id}
               className={`p-4 rounded-2xl border transition-all ${
                 n.isRead ? 'bg-white dark:bg-gray-900 border-gray-50 dark:border-gray-850' : 'bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900'
               }`}
             >
                <div className="flex items-start gap-3">
                   <div className="mt-1">{getIcon(n.type)}</div>
                   <div className="flex-grow">
                      <div className="flex items-center justify-between mb-1">
                         <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{n.type.replace('_', ' ')}</span>
                         <div className="flex items-center gap-1.5 text-[8px] font-bold text-gray-400 uppercase">
                            <Clock className="w-3 h-3" /> {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </div>
                      </div>
                      <h4 className="text-sm font-black text-gray-900 dark:text-white leading-tight mb-1">{n.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{n.message}</p>
                      
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-bold text-gray-400">By {n.updatedBy}</span>
                         {!n.isRead && (
                           <button 
                            onClick={() => markAsRead(n.id!)}
                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700"
                           >
                              <Check className="w-3 h-3" /> Mark Read
                           </button>
                         )}
                      </div>
                   </div>
                </div>
             </motion.div>
           ))
         )}
      </div>

      <div className="p-4 border-t border-gray-50 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-850/50">
         <button 
          onClick={markAllUnreadAsRead}
          className="w-full py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
         >
            <CheckCircle2 className="w-4 h-4" /> Finalize All Unread
         </button>
      </div>
    </motion.div>
  );
};
