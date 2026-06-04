import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Layout, Table as TableIcon, 
  Settings, Save, Loader2, ListOrdered,
  Users, CheckCircle2, AlertTriangle, MoveVertical
} from 'lucide-react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { RosterFooterTable } from '../types';

export const RosterTemplateEditor: React.FC = () => {
  const { config, updateConfig } = useSchoolConfig();
  const [saving, setSaving] = useState(false);
  const [footerTables, setFooterTables] = useState<RosterFooterTable[]>([]);

  useEffect(() => {
    if (config?.rosterFooterTables) {
      setFooterTables(config.rosterFooterTables);
    } else {
      // Defaults
      setFooterTables([
        { title: 'Registered Students', fields: ['Male', 'Female', 'Total'] },
        { title: 'Passed Students', fields: ['Male', 'Female', 'Total'] },
        { title: 'Failed Students', fields: ['Male', 'Female', 'Total'] }
      ]);
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig({
        rosterFooterTables: footerTables
      });
      toast.success('Roster template updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save roster template.');
    } finally {
      setSaving(false);
    }
  };

  const addTable = () => {
    setFooterTables([...footerTables, { title: 'New Table', fields: ['Field 1', 'Field 2'] }]);
  };

  const removeTable = (index: number) => {
    setFooterTables(footerTables.filter((_, i) => i !== index));
  };

  const updateTable = (index: number, updates: Partial<RosterFooterTable>) => {
    const newTables = [...footerTables];
    newTables[index] = { ...newTables[index], ...updates };
    setFooterTables(newTables);
  };

  const addField = (tIdx: number) => {
    const newTables = [...footerTables];
    newTables[tIdx].fields.push(`New Field`);
    setFooterTables(newTables);
  };

  const updateField = (tIdx: number, fIdx: number, val: string) => {
    const newTables = [...footerTables];
    newTables[tIdx].fields[fIdx] = val;
    setFooterTables(newTables);
  };

  const removeField = (tIdx: number, fIdx: number) => {
    const newTables = [...footerTables];
    newTables[tIdx].fields = newTables[tIdx].fields.filter((_, i) => i !== fIdx);
    setFooterTables(newTables);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div className="space-y-8">
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <TableIcon className="w-6 h-6 text-indigo-600" /> Roster Footer Tables
              </h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Customize summary tables at the end of each page</p>
            </div>
            <button 
              onClick={addTable}
              className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <AnimatePresence>
              {footerTables.map((table, tIdx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  key={tIdx} 
                  className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 group"
                >
                  <div className="flex justify-between items-center">
                    <input 
                      value={table.title}
                      onChange={e => updateTable(tIdx, { title: e.target.value })}
                      className="bg-transparent font-black text-gray-900 focus:outline-none focus:ring-b-2 focus:ring-indigo-600 border-b-2 border-transparent transition-all"
                    />
                    <button onClick={() => removeTable(tIdx)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {table.fields.map((field, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 group/field">
                        <input 
                          value={field}
                          onChange={e => updateField(tIdx, fIdx, e.target.value)}
                          className="flex-grow text-xs font-bold text-gray-600 outline-none"
                        />
                        <button onClick={() => removeField(tIdx, fIdx)} className="text-gray-300 hover:text-red-400 opacity-0 group-field-hover:opacity-100 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => addField(tIdx)}
                      className="flex items-center justify-center gap-1 p-2 rounded-xl border border-dashed border-gray-200 text-[10px] font-black text-gray-400 uppercase hover:border-indigo-200 hover:text-indigo-500 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Add Field
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-lg shadow-xl shadow-gray-200 hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
          Update Roster Blueprint
        </button>
      </div>

      {/* Preview Section */}
      <div className="space-y-6">
        <div className="bg-indigo-900 p-8 rounded-[40px] shadow-2xl">
          <div className="mb-8 flex justify-between items-center text-white">
            <div>
              <h3 className="text-xl font-black">Live Roster Preview</h3>
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Page Layout & Footer Summary</p>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 text-xs font-bold">
              Page 1 of 1
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-inner min-h-[500px] flex flex-col">
            {/* Header Mockup */}
            <div className="border-b-2 border-gray-900 pb-4 mb-4 flex justify-between items-end">
               <div>
                  <h4 className="text-lg font-black text-gray-900 leading-none">{config?.schoolName || 'CHERCHER SECONDARY SCHOOL'}</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Official Academic Roster • {config?.academicYear}</p>
               </div>
               <div className="text-right text-[10px] font-black text-gray-400 space-y-0.5">
                  <p>GRADE: 12A</p>
                  <p>HOMEROOM: ABC</p>
               </div>
            </div>

            {/* Table Mockup */}
            <div className="flex-grow">
               <div className="border border-gray-900 text-[8px] font-black uppercase overflow-hidden">
                  <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-900 text-center">
                     <div className="col-span-1 p-1 border-r border-gray-900">NO</div>
                     <div className="col-span-5 p-1 border-r border-gray-900">STUDENT NAME</div>
                     <div className="col-span-1 p-1 border-r border-gray-900">SEX</div>
                     <div className="col-span-5 p-1">SUBJECT RECORDS</div>
                  </div>
                  {[1, 2].map(i => (
                    <div key={i} className="grid grid-cols-12 border-b border-gray-900 last:border-0 h-16">
                       <div className="col-span-1 p-1 border-r border-gray-900 flex items-center justify-center">{i}</div>
                       <div className="col-span-5 p-1 border-r border-gray-900 flex items-center">NAHOM {i}</div>
                       <div className="col-span-1 p-1 border-r border-gray-900 flex items-center justify-center">M</div>
                       <div className="col-span-5 grid grid-rows-3 h-full divide-y divide-gray-200">
                          <div className="p-0.5 text-blue-600">SEM 1: 95.5</div>
                          <div className="p-0.5 text-indigo-600">SEM 2: 98.4</div>
                          <div className="p-0.5 bg-gray-50">AVG: 97.0</div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Footer Tables Mockup */}
            <div className="mt-8 flex flex-wrap gap-4 border-t-2 border-gray-900 pt-6">
               {footerTables.map((table, idx) => (
                 <div key={idx} className="flex-1 min-w-[120px] border border-gray-900">
                    <div className="bg-gray-100 p-1 text-[8px] font-black text-center border-b border-gray-900">
                       {table.title}
                    </div>
                    {table.fields.map((f, fidx) => (
                      <div key={fidx} className="flex justify-between p-1 border-b border-gray-100 last:border-0 text-[7px] font-bold">
                         <span>{f}</span>
                         <span className="text-gray-300">______</span>
                      </div>
                    ))}
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
