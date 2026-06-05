import React, { useState, useRef, useEffect } from 'react';
import { 
  Save, Image as ImageIcon, School, MapPin, 
  Phone, Mail, Type, Move, CheckCircle2, 
  AlertCircle, Loader2, Link as LinkIcon
} from 'lucide-react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import { Point } from '../types';

interface ElementPos {
  id: 'header' | 'logo' | 'watermark' | 'footer' | 'signature';
  label: string;
  pos: Point;
}

export const TranscriptTemplateEditor: React.FC = () => {
  const { config, updateConfig } = useSchoolConfig();
  const [saving, setSaving] = useState(false);
  const [activeElement, setActiveElement] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    schoolMotto: '',
    schoolAddress: '',
    schoolPhone: '',
    schoolEmail: '',
    schoolLogo: '',
    schoolHeaderURL: '',
    schoolWatermarkURL: '',
  });

  const [layout, setLayout] = useState<Record<string, Point>>({
    header: { x: 50, y: 10 },
    logo: { x: 10, y: 10 },
    watermark: { x: 50, y: 50 },
    footer: { x: 50, y: 90 },
    signature: { x: 80, y: 85 }
  });

  useEffect(() => {
    if (config) {
      setFormData({
        schoolMotto: config.schoolMotto || '',
        schoolAddress: config.schoolAddress || '',
        schoolPhone: config.schoolPhone || '',
        schoolEmail: config.schoolEmail || '',
        schoolLogo: config.schoolLogo || '',
        schoolHeaderURL: config.schoolHeaderURL || '',
        schoolWatermarkURL: config.schoolWatermarkURL || '',
      });
      if (config.transcriptLayout) {
        setLayout(config.transcriptLayout);
      }
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig({
        ...formData,
        transcriptLayout: layout as any
      });
      toast.success('Transcript layout template saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save layout preferences.');
    } finally {
      setSaving(false);
    }
  };

  const updatePos = (id: string, x: number, y: number) => {
    setLayout(prev => ({
      ...prev,
      [id]: { 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      }
    }));
  };

  const handleDrag = (e: React.MouseEvent, id: string) => {
    const parent = e.currentTarget.parentElement as HTMLElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    updatePos(id, x, y);
  };

  const elements: ElementPos[] = [
    { id: 'header', label: 'School Header', pos: layout.header },
    { id: 'logo', label: 'School Logo', pos: layout.logo },
    { id: 'watermark', label: 'Watermark', pos: layout.watermark },
    { id: 'footer', label: 'Footer Text', pos: layout.footer },
    { id: 'signature', label: 'Principal Signature', pos: layout.signature },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
      {/* Settings Form */}
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-[32px] border border-gray-100 dark:border-gray-800/80 shadow-sm space-y-6">
          <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <School className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> School Information
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Academic Year</label>
                <input 
                  value={config?.academicYear || '2025/2026'}
                  disabled
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-2xl outline-none opacity-60 text-gray-700 dark:text-gray-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">School Motto</label>
                <input 
                  value={formData.schoolMotto}
                  onChange={e => setFormData({ ...formData, schoolMotto: e.target.value })}
                  placeholder="e.g. Knowledge is Power"
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Address</label>
                <input 
                  value={formData.schoolAddress}
                  onChange={e => setFormData({ ...formData, schoolAddress: e.target.value })}
                  placeholder="Street, City, Region"
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
                <input 
                  value={formData.schoolPhone}
                  onChange={e => setFormData({ ...formData, schoolPhone: e.target.value })}
                  placeholder="+251 ..."
                  className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                value={formData.schoolEmail}
                onChange={e => setFormData({ ...formData, schoolEmail: e.target.value })}
                placeholder="contact@school.edu.et"
                className="w-full p-4 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-[32px] border border-gray-100 dark:border-gray-800/80 shadow-sm space-y-6">
          <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Branding & Media Assets
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Official School Logo URL</label>
              <div className="relative">
                <input 
                  value={formData.schoolLogo}
                  onChange={e => setFormData({ ...formData, schoolLogo: e.target.value })}
                  placeholder="https://icon-library.com/logo.png"
                  className="w-full p-4 pl-12 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
                />
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Header Image Banner URL</label>
              <div className="relative">
                <input 
                  value={formData.schoolHeaderURL}
                  onChange={e => setFormData({ ...formData, schoolHeaderURL: e.target.value })}
                  placeholder="https://images.unsplash.com/academic-header.png"
                  className="w-full p-4 pl-12 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
                />
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Transcript Watermark URL</label>
              <div className="relative">
                <input 
                  value={formData.schoolWatermarkURL}
                  onChange={e => setFormData({ ...formData, schoolWatermarkURL: e.target.value })}
                  placeholder="https://icon-library.com/watermark.png"
                  className="w-full p-4 pl-12 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold"
                />
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-5 bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 text-white rounded-[24px] font-black text-base shadow-xl dark:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Finalize Layout & Info
        </button>
      </div>

      {/* Visual Canvas Area */}
      <div className="space-y-6">
        <div className="bg-gray-900 dark:bg-gray-950/80 p-6 sm:p-8 rounded-[40px] shadow-2xl relative border border-gray-800">
          <div className="flex justify-between items-center mb-6 text-white">
             <div>
               <h3 className="text-lg font-black tracking-tight">Transcript Canvas</h3>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Interactive drag-and-drop position layout</p>
             </div>
             <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-[10px] font-black tracking-widest uppercase">
               Representation
             </div>
          </div>

          <div 
            className="mx-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl relative overflow-hidden" 
            style={{ 
              width: '100%', 
              maxWidth: '380px', 
              aspectRatio: '210/297',
              userSelect: 'none'
            }}
            onMouseMove={(e) => activeElement && handleDrag(e, activeElement)}
            onMouseUp={() => setActiveElement(null)}
            onMouseLeave={() => setActiveElement(null)}
          >
            {/* Watermark in background */}
            {elements.map((el) => {
              if (el.id !== 'watermark') return null;
              return (
                <div
                  key={el.id}
                  onMouseDown={() => setActiveElement(el.id)}
                  className={`absolute cursor-move p-2 rounded-xl border-2 flex items-center justify-center transition-all group ${
                    activeElement === el.id 
                      ? 'border-indigo-500 bg-indigo-50/10 z-20 shadow-lg' 
                      : 'border-transparent z-0 opacity-20 hover:border-indigo-400/40 hover:opacity-40'
                  }`}
                  style={{
                    left: `${el.pos.x}%`,
                    top: `${el.pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '120px',
                    height: '120px'
                  }}
                >
                  <div className="text-center">
                    {formData.schoolWatermarkURL ? (
                      <img src={formData.schoolWatermarkURL} alt="watermark" className="w-24 h-24 object-contain pointer-events-none" />
                    ) : (
                      <div className="w-16 h-16 rounded-full border-4 border-dashed border-indigo-300 dark:border-indigo-600 flex items-center justify-center text-indigo-400">
                        <School className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute -bottom-1 left-0 right-0 text-[7px] font-black uppercase text-indigo-500 text-center tracking-tight leading-none pointer-events-none">{el.label}</span>
                  </div>
                </div>
              );
            })}

            {/* Other elements */}
            {elements.map((el) => {
              if (el.id === 'watermark') return null;
              return (
                <motion.div
                  key={el.id}
                  onMouseDown={() => setActiveElement(el.id)}
                  className={`absolute cursor-move p-2 rounded-lg border-2 flex items-center justify-center transition-shadow group ${
                    activeElement === el.id 
                      ? 'border-indigo-600 bg-indigo-50/90 dark:bg-gray-800 z-30 shadow-xl' 
                      : 'border-indigo-150 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 z-10 hover:border-indigo-400'
                  }`}
                  style={{
                    left: `${el.pos.x}%`,
                    top: `${el.pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    minWidth: el.id === 'header' ? '65%' : '100px',
                  }}
                >
                  <div className="text-center">
                     <div className="flex items-center justify-center gap-1 mb-1 pointer-events-none">
                        <Move className="w-2.5 h-2.5 text-indigo-400 group-hover:text-indigo-600" />
                        <span className="text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-tight">{el.label}</span>
                     </div>
                     {el.id === 'logo' && (
                       formData.schoolLogo ? (
                         <img src={formData.schoolLogo} alt="Logo" className="w-8 h-8 object-contain mx-auto pointer-events-none" />
                       ) : (
                         <div className="w-6 h-6 bg-indigo-50 dark:bg-gray-800 rounded flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 font-extrabold text-[8px]">LOGO</div>
                       )
                     )}
                     {el.id === 'header' && (
                        <div className="space-y-0.5 pointer-events-none">
                          <p className="text-[8px] font-black text-gray-900 dark:text-white leading-none">{config?.schoolName || 'CHERCHER SECONDARY SCHOOL'}</p>
                          <p className="text-[6px] text-gray-400 dark:text-gray-500 font-bold italic line-clamp-1">{formData.schoolMotto || 'Knowledge Is Power'}</p>
                        </div>
                     )}
                     {el.id === 'footer' && (
                        <p className="text-[6px] text-gray-400 dark:text-gray-550 font-bold max-w-[80px] truncate leading-none pointer-events-none">{formData.schoolEmail || 'contact@chercher.edu'}</p>
                     )}
                     {el.id === 'signature' && (
                        <p className="text-[6px] text-gray-500 font-black tracking-widest leading-none border-t border-gray-300 dark:border-gray-700 pt-1 pointer-events-none">PRINCIPAL</p>
                     )}
                  </div>
                </motion.div>
              );
            })}

            {/* Simulated Data */}
            <div className="px-6 mt-40 space-y-3 opacity-10 pointer-events-none">
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-full" />
              <div className="h-4 bg-gray-150 dark:bg-gray-850 rounded w-3/4" />
              <div className="grid grid-cols-4 gap-2">
                 <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
                 <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
                 <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
                 <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-40 bg-gray-150 dark:bg-gray-850 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
