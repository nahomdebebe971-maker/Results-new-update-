import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';

export const SchoolSettings: React.FC = () => {
  const { config, updateConfig } = useSchoolConfig();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      schoolName: formData.get('schoolName') as string,
      academicYear: formData.get('academicYear') as string,
      passMark: Number(formData.get('passMark')),
      contactInfo: formData.get('contactInfo') as string,
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

  const togglePublish = async () => {
    await updateConfig({ resultsPublished: !config?.resultsPublished });
  };

  return (
    <div className="space-y-8">
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
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Academic Year</label>
                <input name="academicYear" defaultValue={config?.academicYear} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pass Mark (%)</label>
                <input name="passMark" type="number" defaultValue={config?.passMark} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contact Info</label>
                <input name="contactInfo" defaultValue={config?.contactInfo} required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
            </div>
            
            <button disabled={saving} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all">
              {saving ? 'Saving...' : success ? <><CheckCircle2 className="w-5 h-5 text-green-400" /> Saved Successfully</> : <><Save className="w-5 h-5" /> Save Configuration</>}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-fit">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> Result Publication
            </h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              When results are published, students can search and view their transcripts using their IDs.
            </p>
            
            <div className={`p-6 rounded-2xl border-2 transition-all ${config?.resultsPublished ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold uppercase tracking-wider text-gray-500">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${config?.resultsPublished ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                  {config?.resultsPublished ? 'Published' : 'Hidden'}
                </span>
              </div>
              <button 
                onClick={togglePublish}
                className={`w-full py-3 rounded-xl font-bold transition-all shadow-md ${
                  config?.resultsPublished 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {config?.resultsPublished ? 'Unpublish Results' : 'Publish Results Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
