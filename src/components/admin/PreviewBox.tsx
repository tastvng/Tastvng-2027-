import React from 'react';
import { Mail, Calendar, MapPin, Clock } from 'lucide-react';

interface PreviewBoxProps {
  config: any;
}

export default function PreviewBox({ config }: PreviewBoxProps) {
  const primario = config.colores?.primario || '#ff0090';
  const secundario = config.colores?.secundario || '#f7931e';
  const fondo = config.colores?.fondo || '#ffffff';
  
  const logoUrl = config.medios?.logo || '';
  const bannerUrl = config.medios?.banner || '';
  
  const nombreEvento = config.evento?.nombre || 'Carnaval 2027';
  const descripcionEvento = config.evento?.descripcion || 'Inscripcions oficials per a la Comparsa El Tast';
  const emailContacto = config.evento?.email || 'info@tastvng.cat';
  const direccioEvento = config.evento?.direccio || 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-inner">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
          Vista prèvia en temps real / Preview en tiempo real
        </h4>
        <span className="text-[10px] text-zinc-400 bg-zinc-200/50 px-2 py-0.5 rounded-md font-mono">
          Live Mockup
        </span>
      </div>
      
      <div 
        className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm transition-all duration-300"
        style={{ backgroundColor: fondo }}
      >
        {/* Event Banner */}
        <div className="h-28 w-full bg-zinc-800 relative overflow-hidden flex items-center justify-center">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 to-zinc-700 flex items-center justify-center opacity-90">
              <span className="text-white/20 font-bold text-2xl font-sans tracking-wider uppercase">El Tast 2026</span>
            </div>
          )}
          
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-4 w-auto object-contain" />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primario }}></span>
            )}
            <span className="text-[10px] font-bold text-zinc-800 font-sans tracking-tight">
              {nombreEvento}
            </span>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-5 space-y-4">
          <div>
            <span 
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md text-white shadow-sm inline-block mb-1.5"
              style={{ backgroundColor: primario }}
            >
              Confirmació d'Inscripció
            </span>
            <h2 className="text-lg font-extrabold text-zinc-900 leading-snug font-sans">
              {nombreEvento}
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-sans mt-1">
              {descripcionEvento}
            </p>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 text-zinc-600 font-sans">
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-zinc-400 mt-0.5 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-zinc-700 leading-none">Direcció</p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{direccioEvento}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail size={13} className="text-zinc-400 mt-0.5 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-zinc-700 leading-none">Contacte</p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{emailContacto}</p>
              </div>
            </div>
          </div>

          {/* Action button mock */}
          <div className="pt-2">
            <button 
              type="button"
              className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-sm hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              style={{ backgroundColor: primario }}
            >
              Completar Inscripció
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
