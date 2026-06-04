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
      toast.success('Transcript template saved!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template.');
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
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
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
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <School className="w-6 h-6 text-indigo-600" /> School Information
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Academic Year</label>
                <input 
                  value={config?.academicYear}
                  disabled
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none opacity-60"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">School Motto</label>
                <input 
                  value={formData.schoolMotto}
                  onChange={e => setFormData({ ...formData, schoolMotto: e.target.value })}
                  placeholder="e.g. Knowledge is Power"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Address</label>
                <input 
                  value={formData.schoolAddress}
                  onChange={e => setFormData({ ...formData, schoolAddress: e.target.value })}
                  placeholder="Street, City, Region"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                <input 
                  value={formData.schoolPhone}
                  onChange={e => setFormData({ ...formData, schoolPhone: e.target.value })}
                  placeholder="+251 ..."
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                value={formData.schoolEmail}
                onChange={e => setFormData({ ...formData, schoolEmail: e.target.value })}
                placeholder="contact@school.edu.et"
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all font-bold"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-600" /> branding & Images
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Logo URL</label>
              <div className="relative">
                <input 
                  value={formData.schoolLogo}
                  onChange={e => setFormData({ ...formData, schoolLogo: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all font-bold"
                />
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Header Image URL</label>
              <div className="relative">
                <input 
                  value={formData.schoolHeaderURL}
                  onChange={e => setFormData({ ...formData, schoolHeaderURL: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all font-bold"
                />
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Watermark Image URL</label>
              <div className="relative">
                <input 
                  value={formData.schoolWatermarkURL}
                  onChange={e => setFormData({ ...formData, schoolWatermarkURL: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all font-bold"
                />
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-lg shadow-xl shadow-gray-200 hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
          Save Template Preferences
        </button>
      </div>

      {/* Visual Canvas Area */}
      <div className="space-y-6">
        <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl relative">
          <div className="flex justify-between items-center mb-6 text-white">
             <div>
               <h3 className="text-xl font-black tracking-tight">Visual Layout Preview</h3>
               <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Drag elements to reposition</p>
             </div>
             <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 text-xs font-bold text-gray-300">
               A4 Scale Representation
             </div>
          </div>

          <div 
            className="mx-auto bg-white shadow-2xl relative overflow-hidden" 
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
            {/* Element Overlays */}
            {elements.map((el) => (
              <motion.div
                key={el.id}
                onMouseDown={() => setActiveElement(el.id)}
                className={`absolute cursor-move p-2 rounded-lg border-2 flex items-center justify-center transition-shadow group ${
                  activeElement === el.id 
                    ? 'border-indigo-600 bg-indigo-50/80 z-20 shadow-xl' 
                    : 'border-indigo-200 bg-white/40 z-10 hover:border-indigo-400'
                }`}
                style={{
                  left: `${el.pos.x}%`,
                  top: `${el.pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  minWidth: el.id === 'header' ? '60%' : '100px',
                  height: el.id === 'watermark' ? '120px' : 'auto'
                }}
              >
                <div className="text-center">
                   <div className="flex items-center justify-center gap-1 mb-1">
                      <Move className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600" />
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-tight">{el.label}</span>
                   </div>
                   {el.id === 'logo' && formData.schoolLogo && (
                     <img src={formData.schoolLogo} alt="Logo" className="w-12 h-12 object-contain mx-auto" />
                   )}
                   {el.id === 'header' && (
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-gray-900 leading-none">{config?.schoolName}</p>
                        <p className="text-[6px] text-gray-400 font-bold italic line-clamp-1">{formData.schoolMotto}</p>
                      </div>
                   )}
                   {el.id === 'watermark' && (
                      <div className="w-20 h-20 rounded-full border-4 border-dashed border-indigo-100 flex items-center justify-center opacity-20">
                         <School className="w-10 h-10" />
                      </div>
                   )}
                </div>
              </motion.div>
            ))}

            {/* Simulated Data */}
            <div className="px-6 mt-40 space-y-3 opacity-20 pointer-events-none">
              <div className="h-6 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-50 rounded w-3/4" />
              <div className="grid grid-cols-4 gap-2">
                 <div className="h-10 bg-gray-100 rounded" />
                 <div className="h-10 bg-gray-100 rounded" />
                 <div className="h-10 bg-gray-100 rounded" />
                 <div className="h-10 bg-gray-100 rounded" />
              </div>
              <div className="h-40 bg-gray-50 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
