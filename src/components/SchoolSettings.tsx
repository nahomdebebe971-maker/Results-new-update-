import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, XCircle, AlertTriangle, Trash2, Loader2, Download, UploadCloud, Database } from 'lucide-react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { collection, getDocs, writeBatch, doc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

import { logAction } from '../lib/auditService';
import { useAuth } from '../hooks/useAuth';

export const SchoolSettings: React.FC = () => {
  const { user } = useAuth();
  const { config, updateConfig } = useSchoolConfig();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [uploadedBackupPayload, setUploadedBackupPayload] = useState<any | null>(null);

  const defaultRemarkRules = [
    { min: 90, max: 100, remark: 'Excellent' },
    { min: 80, max: 89, remark: 'Very Good' },
    { min: 75, max: 79, remark: 'Good' },
    { min: 65, max: 74, remark: 'Satisfactory' },
    { min: 50, max: 64, remark: 'Needs Improvement' },
    { min: 0, max: 49, remark: 'Poor Performance' }
  ];

  const [remarkRules, setRemarkRules] = useState<{ min: number; max: number; remark: string }[]>([]);

  React.useEffect(() => {
    if (config) {
      setRemarkRules(config.remarkRules || defaultRemarkRules);
    }
  }, [config]);

  const handleRuleChange = (idx: number, field: 'min' | 'max' | 'remark', value: string | number) => {
    const updated = [...remarkRules];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'remark' ? String(value) : Number(value)
    };
    setRemarkRules(updated);
  };

  const handleBackup = async () => {
    setBackupInProgress(true);
    try {
      const collections = ['students', 'teachers', 'grades', 'subjects', 'assignments', 'marks', 'analyticsCache'];
      const backupData: { [key: string]: any[] } = {};

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Add config document specifically
      const configRef = doc(db, 'config', 'school');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        backupData['config_school'] = [{ id: 'school', ...configSnap.data() }];
      }

      const backupString = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(backupString);
      
      const academicYear = config?.academicYear || '2026';
      const exportName = `School-Backup-${academicYear}-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportName);
      document.body.appendChild(linkElement);
      linkElement.click();
      linkElement.remove();

      // Log to audits
      if (user) {
        await logAction(
          user.uid,
          user.email || '',
          'SETTINGS_CHANGE',
          `Exported system backup: ${Object.keys(backupData).length} collections`,
          'BACKUP'
        );
      }

      toast.success('System backup snapshot generated and downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile database snapshot. Check connection.');
    } finally {
      setBackupInProgress(false);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        setUploadedBackupPayload(parsed);
        setRestoreConfirmOpen(true);
      } catch (err) {
        toast.error('Invalid file format. Must be a JSON school backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file target
  };

  const handleFinalizeRestore = async () => {
    if (!uploadedBackupPayload) return;
    setRestoreInProgress(true);
    try {
      const collections = ['students', 'teachers', 'grades', 'subjects', 'assignments', 'marks', 'analyticsCache'];
      
      // 1. Wipe out everything first to prevent record overlaps/collisions
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const batchWipeObj = writeBatch(db);
        let count = 0;
        snap.docs.forEach(docObj => {
          batchWipeObj.delete(doc(db, colName, docObj.id));
          count++;
        });
        if (count > 0) {
          await batchWipeObj.commit();
        }
      }

      // 2. Restore all data from payload
      for (const colName of collections) {
        const rows = uploadedBackupPayload[colName] || [];
        if (rows.length === 0) continue;

        const chunkLimit = 100;
        for (let j = 0; j < rows.length; j += chunkLimit) {
          const batchWriteObj = writeBatch(db);
          const chunk = rows.slice(j, j + chunkLimit);
          chunk.forEach((row: any) => {
            const { id, ...dataProps } = row;
            batchWriteObj.set(doc(db, colName, id), dataProps);
          });
          await batchWriteObj.commit();
        }
      }

      // 3. Restore config section specifically if saved
      const restoredConfig = uploadedBackupPayload['config_school']?.[0];
      if (restoredConfig) {
        const { id, ...cfgOnlyProps } = restoredConfig;
        await setDoc(doc(db, 'config', 'school'), cfgOnlyProps);
      }

      // Log event to Audits log
      if (user) {
        await logAction(
          user.uid,
          user.email || '',
          'SETTINGS_CHANGE',
          'Restored system state from backup payload',
          'RESTORE'
        );
      }

      toast.success('School state fully restored from backup payload! Reload lists.', { duration: 6000 });
      setRestoreConfirmOpen(false);
      setUploadedBackupPayload(null);
    } catch (err) {
      console.error(err);
      toast.error('Critical failure during database restoration process.');
    } finally {
      setRestoreInProgress(false);
    }
  };

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
      schoolWebsite: formData.get('schoolWebsite') as string,
      schoolAddress: formData.get('schoolAddress') as string,
      directorName: formData.get('directorName') as string,
      schoolLogo: formData.get('schoolLogo') as string,
      schoolStampURL: formData.get('schoolStampURL') as string,
      academicYear: formData.get('academicYear') as string,
      passMark: Number(formData.get('passMark')),
      studentIdPrefix: formData.get('studentIdPrefix') as string,
      remarkRules,
    };

    try {
      await updateConfig(updates);
      
      if (user) {
        await logAction(
          user.uid,
          user.email || '',
          'SETTINGS_CHANGE',
          'Updated global school configuration settings',
          'CONFIG'
        );
      }

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
      
      if (user) {
        await logAction(
          user.uid,
          user.email || '',
          'SETTINGS_CHANGE',
          `Performed Factory Data Reset. Cleared ${totalDeleted} records.`,
          'RESET'
        );
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
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Website</label>
                <input name="schoolWebsite" defaultValue={config?.schoolWebsite} placeholder="https://www.school.edu" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Director Name</label>
                <input name="directorName" defaultValue={config?.directorName} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Stamp URL</label>
                <input name="schoolStampURL" defaultValue={config?.schoolStampURL} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Address</label>
                <input name="schoolAddress" defaultValue={config?.schoolAddress} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Student ID Prefix</label>
                <input name="studentIdPrefix" defaultValue={config?.studentIdPrefix} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>

              {/* Editable Remark Rules ranges list */}
              <div className="md:col-span-2 border-t border-gray-105 pt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-black text-gray-900 tracking-tight">Remark (Yaada) Grade Range Rules</h3>
                  <p className="text-xs text-gray-400">Configure text/translations generated automatically for final average score bins on rosters and transcripts.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {remarkRules.map((rule, idx) => (
                    <div key={idx} className="flex gap-3 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <span className="text-xs font-black text-indigo-500 w-12 shrink-0">Rule #{idx + 1}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <input 
                          type="number" 
                          value={rule.min} 
                          onChange={(e) => handleRuleChange(idx, 'min', e.target.value)}
                          className="w-12 p-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-600 text-center font-bold"
                        />
                        <span className="text-[10px] text-gray-400">-</span>
                        <input 
                          type="number" 
                          value={rule.max} 
                          onChange={(e) => handleRuleChange(idx, 'max', e.target.value)}
                          className="w-12 p-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-600 text-center font-bold"
                        />
                      </div>
                      <div className="flex-grow">
                        <input 
                          type="text" 
                          value={rule.remark} 
                          onChange={(e) => handleRuleChange(idx, 'remark', e.target.value)}
                          placeholder="Remark string"
                          className="w-full p-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-600 font-bold text-gray-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <button disabled={saving} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all">
              {saving ? 'Saving...' : success ? <><CheckCircle2 className="w-5 h-5 text-green-400" /> Saved Successfully</> : <><Save className="w-5 h-5" /> Save Configuration</>}
            </button>
          </form>

          {/* Backup & Restore Panel */}
          <div className="bg-indigo-50/20 p-8 rounded-3xl border border-indigo-100/50 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">System Backup & Restore</h3>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Database recovery protocols</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-805">Generate Backup</h4>
                  <p className="text-xs text-gray-400 mt-1">Saves a complete snapshot containing school settings, teachers, grades, subjects, results database, conduct (Amala) and attendance records to a JSON file.</p>
                </div>
                <button 
                  onClick={handleBackup} 
                  disabled={backupInProgress}
                  className="mt-6 w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {backupInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download School-Backup.json
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-805">Restore Backup</h4>
                  <p className="text-xs text-gray-400 mt-1">Upload a previously generated backup JSON document to fully restore all structural configurations. This operation overrides and deletes current databases!</p>
                </div>
                
                <label className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer text-center">
                  <UploadCloud className="w-4 h-4" />
                  Restore System State
                  <input type="file" className="hidden" accept=".json" onChange={handleBackupFileSelect} />
                </label>
              </div>
            </div>
          </div>

          {/* Restore Confirmation Dialog Modal */}
          {restoreConfirmOpen && (
            <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6">
                <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <div>
                    <h4 className="font-black text-sm text-amber-900">Destructive Restore Protocol</h4>
                    <p className="text-[10px] uppercase font-black text-amber-505 tracking-wider">Warning Action Invariant</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 font-bold leading-relaxed">
                  You are about to restore system databases. This procedure wipes out ALL current students, teachers, grades, subjects, marks/results, and analytics cache instantly, replacing them with the backup payload!
                </p>

                <div className="flex gap-3 justify-end pt-2 border-t border-gray-50">
                  <button 
                    onClick={() => { setRestoreConfirmOpen(false); setUploadedBackupPayload(null); }}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={restoreInProgress}
                    onClick={handleFinalizeRestore}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    {restoreInProgress ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Override Databases'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
