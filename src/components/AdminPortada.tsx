import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, CheckCircle2, RotateCcw, Image, Video, Palette, Play, Eye, FileText, LayoutTemplate, Sliders, Upload, Trash2 } from 'lucide-react';
import { PortadaConfig } from './PortadaPage';

export const PORTADA_CONFIG_DEFAULTS: PortadaConfig = {
  activa: true,
  titolCA: 'Inscripcions Comparses El Tast 2026',
  titolES: 'Inscripciones Comparses El Tast 2026',
  subtitolCA: "Benvinguts a l'espai de registre oficial de la parella saltadora",
  subtitolES: 'Bienvenidos al espacio de registro oficial de la pareja saltadora',
  descripcioCA: "Enguany us presentem un qüestionari àgil i integrat amb el nostre sistema de secretaria digital de l'Associació Cultural El Tast. Prepara el teu DNI, escolleix la teva talla d'armilla o samarreta, i obtén el teu QR instantani per recollir el mocador oficial sense cues a la seu social!",
  descripcioES: 'Este año os presentamos un cuestionario ágil e integrado con nuestro sistema de secretaría digital de la Asociación Cultural El Tast. ¡Prepara tu DNI, elige tu talla de chaleco o camiseta, y obtén tu QR instantáneo para recoger el pañuelo oficial sin colas en la sede social!',
  
  bgTipus: 'imatge',
  bgColor: '#0c0c0e',
  bgImatgeUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop', // Beautiful festival lights
  bgVideoUrl: 'https://www.youtube.com/watch?v=5df06uXk7nQ', // Placeholder or generic festival reel
  
  contingutTipus: 'imatge',
  contingutImatgeUrl: 'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?q=80&w=800&auto=format&fit=crop', // Festive candies
  contingutVideoUrl: '',
  
  botoTextCA: 'Inscripció en línia',
  botoTextES: 'Inscripción en línea'
};

interface AdminPortadaProps {
  language: 'ca' | 'es';
  onAddLog?: (txt: string) => void;
}

export default function AdminPortada({ language, onAddLog }: AdminPortadaProps) {
  const [config, setConfig] = useState<PortadaConfig>(() => {
    try {
      const saved = localStorage.getItem('tast_portada_config_2026');
      if (saved) {
        return { ...PORTADA_CONFIG_DEFAULTS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Error loading Portada config", e);
    }
    return PORTADA_CONFIG_DEFAULTS;
  });

  const [activeLangTab, setActiveLangTab] = useState<'ca' | 'es'>('ca');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('tast_portada_config_2026', JSON.stringify(config));
    
    // Dispatch custom event to let App know configuration changed
    window.dispatchEvent(new Event('portadaConfigChanged'));
    
    setSaveSuccess(true);
    if (onAddLog) {
      onAddLog(language === 'ca' 
        ? "Configuració de la pantalla de Portada actualitzada correctament." 
        : "Configuración de la pantalla de Portada actualizada correctamente."
      );
    }
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm(language === 'ca' 
      ? "Segur que vols restaurar els valors per defecte de la Portada?" 
      : "¿Seguro que quieres restaurar los valores por defecto de la Portada?")) {
      setConfig(PORTADA_CONFIG_DEFAULTS);
      localStorage.setItem('tast_portada_config_2026', JSON.stringify(PORTADA_CONFIG_DEFAULTS));
      window.dispatchEvent(new Event('portadaConfigChanged'));
      
      if (onAddLog) onAddLog("Restaurats valors per defecte de la Portada.");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const updateField = <K extends keyof PortadaConfig>(field: K, value: PortadaConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const FileOrUrlInput = ({
    labelCa,
    labelEs,
    id,
    value,
    onChange,
    type,
    placeholder
  }: {
    labelCa: string;
    labelEs: string;
    id: string;
    value: string;
    onChange: (val: string) => void;
    type: 'image' | 'video';
    placeholder: string;
  }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    };

    const processFile = (file: File) => {
      const isTypeOk = type === 'image' 
        ? file.type.startsWith('image/') 
        : file.type.startsWith('video/');
      
      if (!isTypeOk) {
        alert(language === 'ca' 
          ? `El fitxer ha de ser un format de ${type === 'image' ? 'imatge' : 'vídeo'}.` 
          : `El archivo debe ser un formato de ${type === 'image' ? 'imagen' : 'video'}.`
        );
        return;
      }

      // Max size check: warn of localstorage constraint
      const maxMb = type === 'image' ? 1.5 : 4.0;
      if (file.size > maxMb * 1024 * 1024) {
        const confirmGo = window.confirm(language === 'ca'
          ? `⚠️ Avís: El fitxer pesa ${(file.size / (1024*1024)).toFixed(1)}MB. Per problemes de límit d'emmagatzematge LocalStorage al navegador, es recomana utilitzar fitxers de menys de ${maxMb}MB o fer servir enllaços/URLs. Desitgeu continuar de totes maneres?`
          : `⚠️ Aviso: El archivo pesa ${(file.size / (1024*1024)).toFixed(1)}MB. Por límites de capacidad de LocalStorage en el navegador, se recomienda usar archivos de menos de ${maxMb}MB o usar enlaces/URLs. ¿Deseas continuar de todas formas?`
        );
        if (!confirmGo) return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onChange(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    };

    const isBase64 = value && value.startsWith('data:');

    return (
      <div className="space-y-2 text-left" id={`container-${id}`}>
        <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold" htmlFor={id}>
          {language === 'ca' ? labelCa : labelEs}
        </label>
        
        {/* URL Input field matching target selector */}
        <div className="flex gap-2">
          <input 
            type="url"
            id={id}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all font-mono"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition flex items-center justify-center cursor-pointer border border-rose-200"
              title={language === 'ca' ? "Netejar" : "Limpiar"}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            const el = document.getElementById(`file-picker-${id}`);
            el?.click();
          }}
          className={`border border-dashed rounded-xl p-3 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
            isDragging 
              ? 'border-[#ff0090] bg-fuchsia-50/20' 
              : isBase64
                ? 'border-emerald-300 bg-emerald-50/5' 
                : 'border-zinc-200 bg-white hover:border-[#ff0090]'
          }`}
        >
          <input 
            type="file"
            id={`file-picker-${id}`}
            accept={type === 'image' ? 'image/*' : 'video/*'}
            className="hidden"
            onChange={handleFileSelect}
          />
          
          {isBase64 ? (
            <div className="flex items-center gap-2 text-xs">
              {type === 'image' ? (
                <img 
                  src={value} 
                  alt="thumbnail" 
                  className="w-10 h-8 rounded object-cover border bg-white" 
                />
              ) : (
                <div className="w-10 h-8 rounded bg-zinc-900 flex items-center justify-center text-fuchsia-400 font-mono text-[7px] font-bold">Base64</div>
              )}
              <div className="text-left leading-none">
                <span className="text-[10px] text-emerald-600 font-bold block">
                  ✓ {language === 'ca' ? "FITXER LOCAL PUJAT" : "ARCHIVO LOCAL CARGADO"}
                </span>
                <span className="text-[8px] text-zinc-400 font-mono mt-0.5 block italic">
                  {(value.length * 0.75 / (1024 * 1024)).toFixed(2)} MB {language === 'ca' ? "(Base64)" : "(Base64)"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-center py-2.5">
              <Upload size={14} className="text-[#ff0090] animate-bounce shrink-0" />
              <div className="text-left leading-tight">
                <span className="text-[10px] font-bold text-zinc-700 block">
                  {language === 'ca' 
                    ? "Arrossegueu o pugeu fitxer local d'imatge/vídeo" 
                    : "Arrastrad o subid archivo local de imagen/video"}
                </span>
                <span className="text-[8px] text-zinc-400 block font-mono">
                  {type === 'image' 
                    ? "Formats suportats: PNG, JPG, BMP, WEBP, SVG" 
                    : "Formats suportats: MP4, WEBM, MOV, etc."}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-md p-6 sm:p-8 space-y-8 animate-fade-in" id="panel-view-portada">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-zinc-100">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-fuchsia-50 text-[#ff0090] rounded-2xl">
            <Compass size={24} />
          </div>
          <div>
            <h3 className="font-sans font-black text-lg text-zinc-900 uppercase tracking-tight">
              {language === 'ca' ? "PERSONALITZACIÓ PORTADA" : "PERSONALIZACIÓN PORTADA"}
            </h3>
            <p className="text-xs text-zinc-500 max-w-2xl">
              {language === 'ca'
                ? "Dissenya i edita completament la pantalla de benvinguda que veuen els comparseres abans d'iniciar el qüestionari d'inscripció mòbil/web."
                : "Diseña y edita completamente la pantalla de bienvenida que ven los comparsers antes de iniciar el cuestionario de inscripción móvil/web."}
            </p>
          </div>
        </div>

        {/* Portada Toggle Activation Switch */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 flex items-center gap-3 self-stretch sm:self-auto justify-between shadow-xs">
          <div className="text-left">
            <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest leading-none">ESTAT DE PORTADA</p>
            <p className="text-xs font-semibold text-zinc-800 mt-1">
              {config.activa 
                ? (language === 'ca' ? "✅ Activa abans de l'app" : "✅ Activa antes de la app")
                : (language === 'ca' ? "❌ Deshabilitada (Salt directe)" : "❌ Deshabilitada (Salto directo)")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateField('activa', !config.activa)}
            className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${config.activa ? 'bg-[#ff0090]' : 'bg-zinc-300'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.activa ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Parameters customize form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Subtitle / Language segment tabs */}
          <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono px-3 text-zinc-500 uppercase tracking-widest font-bold">Idioma Continguts:</span>
              <button
                type="button"
                onClick={() => setActiveLangTab('ca')}
                className={`text-[10px] font-sans font-black tracking-tight px-3 py-1.5 rounded-lg transition-all cursor-pointer uppercase ${
                  activeLangTab === 'ca' 
                    ? 'bg-[#ff0090] text-white shadow-md' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Català (VNG)
              </button>
              <button
                type="button"
                onClick={() => setActiveLangTab('es')}
                className={`text-[10px] font-sans font-black tracking-tight px-3 py-1.5 rounded-lg transition-all cursor-pointer uppercase ${
                  activeLangTab === 'es' 
                    ? 'bg-[#ff0090] text-white shadow-md' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Castellano
              </button>
            </div>
          </div>

          {/* Texts Segment according to language tab */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="font-sans font-bold text-xs text-zinc-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-200 pb-2">
              <FileText size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "Títols i Copys de Text" : "Títulos y Copys de Texto"}
              <span className="text-[9px] bg-zinc-800 text-white font-mono font-extrabold px-1.5 py-0.5 rounded ml-auto">
                {activeLangTab.toUpperCase()}
              </span>
            </h4>

            {activeLangTab === 'ca' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Títol de la Portada (CAT) *</label>
                  <input 
                    type="text"
                    required
                    value={config.titolCA}
                    onChange={(e) => updateField('titolCA', e.target.value)}
                    placeholder="El títol principal cridaner..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all placeholder-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Subtítol superior (CAT)</label>
                  <input 
                    type="text"
                    value={config.subtitolCA}
                    onChange={(e) => updateField('subtitolCA', e.target.value)}
                    placeholder="Ex: Benvinguts a les comparses d'El Tast..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Descripció o Reglament breu (CAT) *</label>
                  <textarea 
                    rows={4}
                    required
                    value={config.descripcioCA}
                    onChange={(e) => updateField('descripcioCA', e.target.value)}
                    placeholder="Descriu breument com funciona el registre..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Text del Botó Principal (CAT) *</label>
                  <input 
                    type="text"
                    required
                    value={config.botoTextCA}
                    onChange={(e) => updateField('botoTextCA', e.target.value)}
                    placeholder="Ex: Iniciar Formulari..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Título de la Portada (ESP) *</label>
                  <input 
                    type="text"
                    required
                    value={config.titolES}
                    onChange={(e) => updateField('titolES', e.target.value)}
                    placeholder="El título principal llamativo..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all placeholder-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Subtítulo superior (ESP)</label>
                  <input 
                    type="text"
                    value={config.subtitolES}
                    onChange={(e) => updateField('subtitolES', e.target.value)}
                    placeholder="Ej: Bienvenidos a las comparsas de El Tast..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Descripción o Reglamento breve (ESP) *</label>
                  <textarea 
                    rows={4}
                    required
                    value={config.descripcioES}
                    onChange={(e) => updateField('descripcioES', e.target.value)}
                    placeholder="Describe brevemente cómo funciona el registro..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Texto del Botón Principal (ESP) *</label>
                  <input 
                    type="text"
                    required
                    value={config.botoTextES}
                    onChange={(e) => updateField('botoTextES', e.target.value)}
                    placeholder="Ej: Iniciar Formulario..."
                    className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Background customizable rules with photos, HTML, video */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="font-sans font-bold text-xs text-zinc-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-200 pb-2">
              <Palette size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "Dissenya el Fons de Pantalla" : "Diseña el Fondo de Pantalla"}
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateField('bgTipus', 'color')}
                className={`py-2.5 text-xs rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                  config.bgTipus === 'color' 
                    ? 'bg-zinc-900 border-zinc-900 text-[#ff0090]' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Palette size={16} />
                <span>Color</span>
              </button>
              <button
                type="button"
                onClick={() => updateField('bgTipus', 'imatge')}
                className={`py-2.5 text-xs rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                  config.bgTipus === 'imatge' 
                    ? 'bg-zinc-900 border-zinc-900 text-[#ff0090]' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Image size={16} />
                <span>Imatge / Foto</span>
              </button>
              <button
                type="button"
                onClick={() => updateField('bgTipus', 'video')}
                className={`py-2.5 text-xs rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                  config.bgTipus === 'video' 
                    ? 'bg-zinc-900 border-zinc-900 text-[#ff0090]' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Video size={16} />
                <span>Vídeo Ambient</span>
              </button>
            </div>

            {config.bgTipus === 'color' && (
              <div>
                <label className="block text-[10px] text-zinc-550 uppercase font-mono mb-1 font-extrabold">Color d'Hexadecimal del Fons *</label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={config.bgColor}
                    onChange={(e) => updateField('bgColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-250 rounded-xl cursor-pointer"
                  />
                  <input 
                    type="text"
                    required
                    value={config.bgColor}
                    onChange={(e) => updateField('bgColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all font-mono"
                    placeholder="#121214"
                  />
                </div>
              </div>
            )}
            {config.bgTipus === 'imatge' && (
              <FileOrUrlInput 
                id="bgImatgeUrl"
                labelCa="Enllaç / Fitxer de la Foto de Fons *"
                labelEs="Enlace / Archivo de la Foto de Fondo *"
                type="image"
                value={config.bgImatgeUrl}
                onChange={(val) => updateField('bgImatgeUrl', val)}
                placeholder="https://images.unsplash.com/photo-... o puja un fitxer"
              />
            )}

            {config.bgTipus === 'video' && (
              <FileOrUrlInput 
                id="bgVideoUrl"
                labelCa="Enllaç / Fitxer del Vídeo de Fons *"
                labelEs="Enlace / Archivo del Vídeo del Fondo *"
                type="video"
                value={config.bgVideoUrl}
                onChange={(val) => updateField('bgVideoUrl', val)}
                placeholder="https://www.youtube.com/watch?v=... o puja un fitxer"
              />
            )}
          </div>

          {/* Spotlight Highlight Showcase Content Card on Portada */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="font-sans font-bold text-xs text-zinc-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-200 pb-2">
              <LayoutTemplate size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "Targeta de Contingut Destacat" : "Tarjeta de Contenido Destacado"}
            </h4>
            <p className="text-[11px] text-zinc-550 leading-normal mb-3">
              Configureu si voleu mostrar una targeta visual de suport (a la banda dreta en pantalles d'escriptori) amb una imatge clau o un reproductor de vídeo del festival.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateField('contingutTipus', 'none')}
                className={`py-2 text-xs rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                  config.contingutTipus === 'none' 
                    ? 'bg-zinc-900 border-zinc-900 text-[#ff0090]' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Eye size={15} className="opacity-50" />
                <span>Oculta</span>
              </button>
              <button
                type="button"
                onClick={() => updateField('contingutTipus', 'imatge')}
                className={`py-2 text-xs rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                  config.contingutTipus === 'imatge' 
                    ? 'bg-zinc-900 border-zinc-900 text-[#ff0090]' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Image size={15} />
                <span>Foto</span>
              </button>
              <button
                type="button"
                onClick={() => updateField('contingutTipus', 'video')}
                className={`py-2 text-xs rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer border ${
                  config.contingutTipus === 'video' 
                    ? 'bg-zinc-900 border-zinc-900 text-[#ff0090]' 
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Video size={15} />
                <span>Vídeo</span>
              </button>
            </div>

            {config.contingutTipus === 'imatge' && (
              <FileOrUrlInput 
                id="contingutImatgeUrl"
                labelCa="Enllaç / Fitxer del Spotlight *"
                labelEs="Enlace / Archivo del Spotlight *"
                type="image"
                value={config.contingutImatgeUrl}
                onChange={(val) => updateField('contingutImatgeUrl', val)}
                placeholder="https://images.unsplash.com/photo-... o puja un fitxer"
              />
            )}

            {config.contingutTipus === 'video' && (
              <FileOrUrlInput 
                id="contingutVideoUrl"
                labelCa="Enllaç / Fitxer del Vídeo del Spotlight *"
                labelEs="Enlace / Archivo del Vídeo del Spotlight *"
                type="video"
                value={config.contingutVideoUrl}
                onChange={(val) => updateField('contingutVideoUrl', val)}
                placeholder="https://www.youtube.com/watch?v=... o puja un fitxer"
              />
            )}
          </div>

          {/* Action trigger submits */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold rounded-2xl transition duration-200 text-xs flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer font-semibold"
            >
              <RotateCcw size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "Restaurar Defecte" : "Restaurar Defectos"}
            </button>

            <button
              type="submit"
              className="flex-1 py-3.5 bg-[#ff0090] text-white hover:bg-[#ff0090]/90 active:scale-[0.99] transition duration-200 text-xs font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-150 uppercase tracking-widest cursor-pointer"
            >
              <CheckCircle2 size={15} />
              {language === 'ca' ? "Desar Configuració" : "Guardar Configuración"}
            </button>
          </div>

          {saveSuccess && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 border border-emerald-200 animate-pulse text-left font-sans shadow-xs">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>{language === 'ca' ? "Canvis desats amb èxit! La Portada ha estat actualitzada a l'instant." : "¡Cambios guardados con éxito! La Portada ha sido actualizada al instante."}</span>
            </div>
          )}

        </div>

        {/* Right Side: Interactive Smart Live Mock Preview Frame! */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6">
            <h4 className="font-sans font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2 text-left">
              <Eye size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "PREESTRENA EN DIRECTE" : "PREESTRENO EN DIRECTO"}
            </h4>
            
            {/* The Live Interactive mockup phone shell view */}
            <div className="w-full aspect-[9/16] max-h-[620px] bg-[#0c0c0e] rounded-3xl border border-zinc-800/85 relative overflow-hidden shadow-2xl flex flex-col justify-between p-4 text-xs font-sans">
              
              {/* Solid of image ambient preview */}
              {config.bgTipus === 'imatge' && config.bgImatgeUrl && (
                <img 
                  src={config.bgImatgeUrl} 
                  alt="Ambient Preview" 
                  className="absolute inset-0 w-full h-full object-cover z-0 opacity-20 mix-blend-luminosity"
                  referrerPolicy="no-referrer"
                />
              )}

              {config.bgTipus === 'video' && (
                <div className="absolute inset-0 bg-neutral-900 border border-neutral-800 z-0 flex items-center justify-center opacity-30 text-[9px] text-neutral-500">
                  <Play size={12} className="text-[#ff0090]" /> [Vídeo ambient actiu]
                </div>
              )}

              {config.bgTipus === 'color' && (
                <div className="absolute inset-0 z-0" style={{ backgroundColor: config.bgColor, opacity: 0.8 }} />
              )}

              {/* Gradient layer */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 z-5 pointer-events-none" />

              {/* Shell mock header */}
              <div className="relative z-10 w-full flex justify-between items-center text-[8px] text-zinc-550 uppercase tracking-widest border-b border-white/5 pb-2 font-mono">
                <span>⚡ el tast vng 2026</span>
                <span className="text-[7px] bg-white/5 px-1.5 py-0.5 rounded text-fuchsia-400">mockup</span>
              </div>

              {/* Shell mock body */}
              <div className="relative z-10 flex-1 flex flex-col justify-center space-y-3 py-4 text-left">
                <span className="px-2 py-0.5 bg-[#ff0090]/10 border border-[#ff0090]/25 rounded-full text-[7px] text-[#ff0090] font-mono tracking-wider font-extrabold uppercase w-max">
                  {language === 'ca' ? 'Obert en directe' : 'Abierto en directo'}
                </span>

                <h5 className="font-sans font-black text-white text-base md:text-lg leading-tight tracking-tight">
                  {activeLangTab === 'ca' ? config.titolCA : config.titolES}
                </h5>

                <p className="text-zinc-400 text-[9px] tracking-wide uppercase font-mono">
                  {activeLangTab === 'ca' ? config.subtitolCA : config.subtitolES}
                </p>

                <p className="text-zinc-350 text-[9px] leading-relaxed line-clamp-3">
                  {activeLangTab === 'ca' ? config.descripcioCA : config.descripcioES}
                </p>

                {config.contingutTipus !== 'none' && (
                  <div className="bg-black/60 p-1.5 aspect-[16/10] rounded-xl border border-white/5 overflow-hidden flex items-center justify-center text-[8px] text-zinc-500 font-mono">
                    {config.contingutTipus === 'imatge' ? (
                      config.contingutImatgeUrl ? (
                        <img 
                          src={config.contingutImatgeUrl} 
                          alt="preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : 'Falta enllaç...'
                    ) : (
                      <span className="flex items-center gap-1"><Play size={9} /> Reproductor Spotlight</span>
                    )}
                  </div>
                )}

                {/* Simulated Click button CTA */}
                <div className="pt-2">
                  <div className="w-full bg-[#ff0090] text-white text-center font-black py-2.5 rounded-xl uppercase tracking-wider text-[8px] shadow-lg shadow-fuchsia-950/20">
                    {activeLangTab === 'ca' ? config.botoTextCA : config.botoTextES}
                  </div>
                </div>
              </div>

              {/* Shell mock footer */}
              <div className="relative z-10 w-full pt-2 border-t border-white/5 text-[7px] text-zinc-550 flex justify-between tracking-tight font-mono">
                <span>© EL TAST PORTADA PREVIEW</span>
                <span>CAT • ESP</span>
              </div>

            </div>

            <p className="text-[10px] text-zinc-550 mt-2 italic flex justify-center items-center gap-1">
              <Sparkles size={11} className="text-[#ff0090]" />
              <span>{language === 'ca' ? "Canvia els camps d'esquerra per veure actualització síncrona en viu" : "Cambia los campos de izquierda para ver actualización síncrona en vivo"}</span>
            </p>
          </div>
        </div>

      </form>
    </div>
  );
}
