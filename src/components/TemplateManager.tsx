import React, { useState } from 'react';
import { FileText, Layout, ChevronRight, Eye, Save, Settings, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TranscriptTemplateEditor } from './TranscriptTemplateEditor';
import { RosterTemplateEditor } from './RosterTemplateEditor';

export const TemplateManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'transcript' | 'roster'>('transcript');

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-1">Document Templates</h2>
          <p className="text-gray-500 font-medium text-sm">Design and customize official school documents and reporting layouts.</p>
        </div>
        <div className="flex gap-2 relative z-10">
          <button 
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${
              activeTab === 'transcript' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-5 h-5" /> Transcript
          </button>
          <button 
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${
              activeTab === 'roster' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Layout className="w-5 h-5" /> Roster
          </button>
        </div>
        {/* Decorative mask */}
        <Layers className="absolute -right-10 -bottom-10 w-40 h-40 text-gray-50 opacity-40 rotate-12" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'transcript' ? <TranscriptTemplateEditor /> : <RosterTemplateEditor />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
