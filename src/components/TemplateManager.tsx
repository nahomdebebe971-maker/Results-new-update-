import React from 'react';
import { Layout, Layers, ShieldAlert } from 'lucide-react';
import { RosterTemplateEditor } from './RosterTemplateEditor';

export const TemplateManager: React.FC = () => {
  return (
    <div className="space-y-8 pb-20">
      {/* Redesigned Clean Header without Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden gap-6">
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">Roster Layout Blueprint</h2>
          <p className="text-gray-500 font-medium text-sm">Design and customize report card columns and signature matrices for official rosters.</p>
          <div className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">
            <ShieldAlert className="w-3.5 h-3.5" />
            Transcript structure is locked to official, standardized regulatory regulations.
          </div>
        </div>
        <div className="relative z-10 flex items-center bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-100">
          <Layout className="w-5 h-5 mr-2" /> Official Roster Layout
        </div>
        {/* Decorative backdrop art */}
        <Layers className="absolute -right-10 -bottom-10 w-40 h-40 text-gray-50 opacity-40 rotate-12" />
      </div>

      <div>
        <RosterTemplateEditor />
      </div>
    </div>
  );
};
