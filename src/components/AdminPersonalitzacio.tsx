import React, { useState } from 'react';
import { Palette, Compass } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import PersonalizationPanel from './admin/PersonalizationPanel';
import AdminPortada from './AdminPortada';

interface AdminPersonalitzacioProps {
  language?: 'ca' | 'es';
  onAddLog?: (txt: string) => void;
}

export default function AdminPersonalitzacio({ onAddLog }: AdminPersonalitzacioProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'diseno' | 'portada'>('diseno');

  return (
    <div className="space-y-6">
      {/* Sub-tab selection menu inside the dashboard */}
      <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('diseno')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activeTab === 'diseno'
              ? 'bg-[#ff0090] text-white shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Palette size={13} />
          {language === 'ca' ? "Disseny i Identitat" : "Diseño e Identidad"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('portada')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activeTab === 'portada'
              ? 'bg-[#ff0090] text-white shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Compass size={13} />
          {language === 'ca' ? "Portada del Web" : "Portada de la Web"}
        </button>
      </div>

      {/* Render sub-panels */}
      {activeTab === 'diseno' && (
        <div className="animate-fade-in">
          <PersonalizationPanel onAddLog={onAddLog} />
        </div>
      )}

      {activeTab === 'portada' && (
        <div className="animate-fade-in">
          <AdminPortada onAddLog={onAddLog} />
        </div>
      )}
    </div>
  );
}
