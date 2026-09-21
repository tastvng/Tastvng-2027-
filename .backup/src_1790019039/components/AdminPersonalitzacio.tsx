import React, { useState, useEffect } from 'react';
import { Palette, Compass } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import PersonalizationPanel from './admin/PersonalizationPanel';
import AdminPortada from './AdminPortada';
import { CodigoVestimentaModal } from './CodigoVestimentaModal';

interface AdminPersonalitzacioProps {
  language?: 'ca' | 'es';
  onAddLog?: (txt: string) => void;
}

export default function AdminPersonalitzacio({ onAddLog }: AdminPersonalitzacioProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'diseno' | 'portada'>('diseno');
  
  const [codigoVestimentaUrl, setCodigoVestimentaUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        const { getCodigoVestimentaUrl } = await import('../supabaseClient');
        const val = await getCodigoVestimentaUrl();
        if (val) {
          setCodigoVestimentaUrl(val);
        }
      } catch (err) {
        console.error('Error reading dress code url:', err);
      }
    };
    fetchUrl().catch(err => console.error("Error in fetchUrl:", err));
  }, []);

  const saveCodigoVestimentaUrlHandler = async () => {
    setIsSaving(true);
    const trimmed = codigoVestimentaUrl.trim();
    try {
      const { saveCodigoVestimentaUrl } = await import('../supabaseClient');
      const success = await saveCodigoVestimentaUrl(trimmed);
      if (success) {
        if (onAddLog) onAddLog(language === 'ca' ? `S'ha actualitzat l'enllaç de vestimenta a: ${trimmed}` : `Se ha actualizado el enlace de vestimenta a: ${trimmed}`);
        alert(language === 'ca' ? 'Enllaç desat correctament' : 'Enlace guardado correctamente');
      } else {
        alert(language === 'ca' ? 'Error al desar l\'enllaç' : 'Error al guardar el enlace');
      }
    } catch (error) {
      console.error('Error saving URL:', error);
      alert(language === 'ca' ? 'Error al desar' : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

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

      {/* Dress Code URL Configuration Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl text-left space-y-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            {language === 'ca' ? "CONFIGURACIÓ DE CODI DE VESTIMENTA" : "CONFIGURACIÓN DE CÓDIGO DE VESTIMENTA"}
          </span>
          <h3 className="font-sans font-black text-lg text-white mt-1">
            {language === 'ca' ? "Vídeo del Codi de Vestimenta" : "Vídeo del Código de Vestimenta"}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {language === 'ca' 
              ? "Configura la URL de YouTube de tipus embed per mostrar el vídeo explicatiu en format vertical (9:16) als usuaris."
              : "Configura la URL de YouTube de tipo embed para mostrar el vídeo explicativo en formato vertical (9:16) a los usuarios."
            }
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-mono font-bold text-zinc-300">
            {language === 'ca' ? "URL del Vídeo informatiu (MP4 o Supabase Storage)" : "URL del Vídeo informativo (MP4 o Supabase Storage)"}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="https://.../video.mp4"
              value={codigoVestimentaUrl}
              onChange={(e) => setCodigoVestimentaUrl(e.target.value)}
              className="flex-1 bg-zinc-950 text-white border border-zinc-800 focus:border-[#ff0090] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-0 transition-all font-mono"
            />
            <button
              onClick={saveCodigoVestimentaUrlHandler}
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#ff0090] hover:bg-[#d60079] disabled:bg-zinc-700 text-white font-sans font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer shrink-0"
            >
              {isSaving 
                ? (language === 'ca' ? "Desant..." : "Guardando...") 
                : (language === 'ca' ? "Desar URL" : "Guardar URL")
              }
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            {language === 'ca' 
              ? "Format admès: URL directa a un fitxer .mp4 o enllaç públic/signat de Supabase Storage." 
              : "Formato admitido: URL directa a un archivo .mp4 o enlace público/firmado de Supabase Storage."
            }
          </p>
        </div>

        {/* Preview Container */}
        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-2xl p-4 space-y-3">
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
            {language === 'ca' ? "VISTA PRÈVIA DEL BLOC DE VÍDEO" : "VISTA PREVIA DEL BLOQUE DE VÍDEO"}
          </span>
          <div className="w-full max-w-xl">
            <CodigoVestimentaModal youtubeUrl={codigoVestimentaUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
