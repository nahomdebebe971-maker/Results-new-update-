import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, XCircle, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

export const SchoolSettings: React.FC = () => {
  const { config, updateConfig } = useSchoolConfig();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      schoolName: formData.get('schoolName') as string,
      schoolMotto: formData.get('schoolMotto') as string,
      schoolPhone: formData.get('schoolPhone') as string,
      schoolEmail: formData.get('schoolEmail') as string,
      schoolAddress: formData.get('schoolAddress') as string,
      schoolLogo: formData.get('schoolLogo') as string,
      academicYear: formData.get('academicYear') as string,
      passMark: Number(formData.get('passMark')),
      studentIdPrefix: formData.get('studentIdPrefix') as string,
    };

    try {
      await updateConfig(updates);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllData = async () => {
    setIsResetting(true);
    try {
      const collections = ['students', 'teachers', 'grades', 'subjects', 'marks', 'assignments'];
      const batch = writeBatch(db);
      let totalDeleted = 0;

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        snap.forEach((document) => {
          batch.delete(doc(db, colName, document.id));
          totalDeleted++;
        });
      }

      // Reset published grades in config
      await updateConfig({ publishedGrades: [] });

      if (totalDeleted > 0) {
        await batch.commit();
      }
      
      toast.success('System reset completed. All academic records cleared.');
      setShowConfirmReset(false);
    } catch (err) {
      console.error('Error resetting system:', err);
      toast.error('Reset failed. Please check permissions.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">School Settings</h2>
          <p className="text-gray-500 font-medium">Configure global school branding and system behavior.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Name</label>
                <input name="schoolName" defaultValue={config?.schoolName} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Logo URL</label>
                <input name="schoolLogo" defaultValue={config?.schoolLogo} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Motto</label>
                <input name="schoolMotto" defaultValue={config?.schoolMotto} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Academic Year</label>
                <input name="academicYear" defaultValue={config?.academicYear} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pass Mark (%)</label>
                <input name="passMark" type="number" defaultValue={config?.passMark} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contact Phone</label>
                <input name="schoolPhone" defaultValue={config?.schoolPhone} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Email</label>
                <input name="schoolEmail" type="email" defaultValue={config?.schoolEmail} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Address</label>
                <input name="schoolAddress" defaultValue={config?.schoolAddress} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Student ID Prefix</label>
                <input name="studentIdPrefix" defaultValue={config?.studentIdPrefix} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
            </div>
            
            <button disabled={saving} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all">
              {saving ? 'Saving...' : success ? <><CheckCircle2 className="w-5 h-5 text-green-400" /> Saved Successfully</> : <><Save className="w-5 h-5" /> Save Configuration</>}
            </button>
          </form>

          {/* Danger Zone */}
          <div className="bg-red-50 p-8 rounded-3xl border border-red-100 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Danger Zone</h3>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest">System Destruction Protocols</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-red-50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="font-bold text-gray-900">Factory Data Reset</p>
                <p className="text-xs text-gray-500 font-medium mt-1">This will permanently delete all students, teachers, grades, subjects, and marks. This action cannot be undone.</p>
              </div>
              
              {!showConfirmReset ? (
                <button 
                  onClick={() => setShowConfirmReset(true)}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 whitespace-nowrap"
                >
                  Reset All Data
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowConfirmReset(false)}
                    className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteAllData}
                    disabled={isResetting}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 text-xs uppercase tracking-widest flex items-center gap-2"
                  >
                    {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Wipeout'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-100 text-white relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Result Governance
              </h3>
              <p className="text-sm opacity-80 mb-6 font-medium">
                Publishing is now managed at the grade level. This ensures students only see results for classes that have finalized their marks.
              </p>
              <div className="bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
                 <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Control Panel</p>
                 <p className="text-xs font-bold">Go to Academic Structure to toggle publishing for individual sections.</p>
              </div>
            </div>
            <Settings className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 group-hover:rotate-45 transition-transform duration-1000" />
          </div>
        </div>
      </div>
    </div>
  );
};
