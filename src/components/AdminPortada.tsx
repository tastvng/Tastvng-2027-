import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, CheckCircle2, RotateCcw, Image, Video, Palette, Play, Eye, FileText, LayoutTemplate, Sliders, Upload, Trash2 } from 'lucide-react';
import { PortadaConfig } from './PortadaPage';
import { saveSupabaseSettings, getSupabaseSettings, isSupabaseConfigured } from '../supabaseClient';

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
  botoTextES: 'Inscripción en línea',

  // Defaults for image crop and colors
  bgImatgeX: 50,
  bgImatgeY: 50,
  bgImatgeScale: 'cover',
  bgImatgeOpacity: 40,
  bgImatgeSaturacio: 100,
  bgImatgeBrightness: 100,

  contingutImatgeX: 50,
  contingutImatgeY: 50,
  contingutImatgeScale: 'cover',

  // Color customization defaults
  accentColor: '#ff0090',
  titolColor: '#ffffff',
  subtitolColor: '#a1a1aa',
  descripcioColor: '#d4d4d8',
  botoBgColor: '#ff0090',
  botoTextColor: '#ffffff',

  // Badge customization defaults
  badgeTextCA: 'Inscripcions Obertes 2026',
  badgeTextES: 'Inscripciones Abiertas 2026',
  badgeIcon: 'compass',
  badgeStyle: 'custom',
  badgeBgColor: '#ff0090',
  badgeTextColor: '#ffffff',
  badgeBorderColor: 'rgba(255, 0, 144, 0.4)',
  badgeSpinIcon: true,

  // Footer customization defaults
  footerTextCA: '© 2026 ASSOCIACIÓ COMPARSES EL TAST • VILANOVA',
  footerTextES: '© 2026 ASOCIACIÓN COMPARSAS EL TAST • VILANOVA',
  footerLink1LabelCA: 'Normativa',
  footerLink1LabelES: 'Normativa',
  footerLink1Url: '#',
  footerLink2LabelCA: 'secretaria@eltast.cat',
  footerLink2LabelES: 'secretaria@eltast.cat',
  footerLink2Url: 'mailto:secretaria@eltast.cat',
  footerTextColor: '#71717a',

  // Button advanced customization defaults
  botoTextSize: 'text-xs md:text-sm',
  botoFontWeight: 'font-black',
  botoRounded: 'rounded-2xl',
  botoShadowSize: 'shadow-xl',
  botoShadowColor: '#ff0090',
  botoBorderWidth: 0,
  botoBorderColor: 'transparent',
  botoLetterSpacing: 'tracking-wider',
  botoUppercase: true,

  // Footer styling helper defaults
  footerLinkHoverColor: '#ff0090',
  footerTextSize: 'text-[10px]',
  footerFontWeight: 'font-normal',
  footerUppercase: true,
  footerLetterSpacing: 'tracking-wider',
  footerBorderTopColor: 'rgba(255, 255, 255, 0.1)',
  footerFontMono: true,
  footerShadowEnabled: false,
  cuestionariActiu: true
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

  const [estatInscripcions, setEstatInscripcions] = useState<'obertes' | 'espera' | 'tancades'>('obertes');

  // Load from Supabase on mount
  useEffect(() => {
    async function loadConfig() {
      if (!isSupabaseConfigured) {
        const scJson = localStorage.getItem('tast_config_2026');
        if (scJson) {
          try {
            const sc = JSON.parse(scJson);
            if (sc.estatInscripcions) setEstatInscripcions(sc.estatInscripcions);
          } catch {}
        }
        return;
      }
      try {
        const dbConfig = await getSupabaseSettings();
        if (dbConfig) {
          setConfig({ ...PORTADA_CONFIG_DEFAULTS, ...dbConfig });
        }
        
        const { getSupabaseSetting } = await import('../supabaseClient');
        const sc = await getSupabaseSetting('tast_config_2026', null);
        if (sc && sc.estatInscripcions) {
          setEstatInscripcions(sc.estatInscripcions);
        }
      } catch (e) {
        console.error("Error fetching admin config from Supabase:", e);
      }
    }
    loadConfig();
  }, []);

  const [activeLangTab, setActiveLangTab] = useState<'ca' | 'es'>('ca');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [savingSemafor, setSavingSemafor] = useState<boolean>(false);
  const [semaforSaveError, setSemaforSaveError] = useState<string | null>(null);
  const [semaforSaveSuccess, setSemaforSaveSuccess] = useState<boolean>(false);

  const handleEstatInscripcionsChange = async (newState: 'obertes' | 'espera' | 'tancades') => {
    setEstatInscripcions(newState);
    setSavingSemafor(true);
    setSemaforSaveError(null);
    setSemaforSaveSuccess(false);

    try {
      // 1. Save to LocalStorage first
      localStorage.setItem('estat_inscripcio_global', newState);
      const scJson = localStorage.getItem('tast_config_2026');
      if (scJson) {
        try {
          const sc = JSON.parse(scJson);
          sc.estatInscripcions = newState;
          localStorage.setItem('tast_config_2026', JSON.stringify(sc));
        } catch {}
      }

      // Dispatch custom event to let App know configuration changed
      window.dispatchEvent(new Event('portadaConfigChanged'));

      // 2. Save to Supabase
      if (isSupabaseConfigured) {
        const { getSupabaseSetting, saveSupabaseSetting } = await import('../supabaseClient');
        
        // Save the direct setting key estat_inscripcio_global
        const successGlobal = await saveSupabaseSetting('estat_inscripcio_global', newState);
        if (!successGlobal) {
          throw new Error("No s'ha pogut canviar la clau 'estat_inscripcio_global' a Supabase.");
        }

        // Also update the property inside the full system config 'tast_config_2026'
        const sc = await getSupabaseSetting<any>('tast_config_2026', null);
        if (sc) {
          sc.estatInscripcions = newState;
          const successConfig = await saveSupabaseSetting('tast_config_2026', sc);
          if (!successConfig) {
            throw new Error("No s'ha pogut actualitzar la clau 'tast_config_2026' a Supabase.");
          }
        }
      }

      setSemaforSaveSuccess(true);
      setTimeout(() => setSemaforSaveSuccess(false), 3000);

      if (onAddLog) {
        onAddLog(language === 'ca' 
          ? `S'ha canviat l'estat de les inscripcions a: ${newState.toUpperCase()} a Supabase.` 
          : `Se ha cambiado el estado de las inscripciones a: ${newState.toUpperCase()} en Supabase.`
        );
      }
    } catch (err: any) {
      console.error("Error setting dynamic registration status:", err);
      const errorMsg = err.message || JSON.stringify(err);
      setSemaforSaveError(language === 'ca'
        ? `Error en desar a Supabase: ${errorMsg}`
        : `Error al guardar en Supabase: ${errorMsg}`
      );
    } finally {
      setSavingSemafor(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to localStorage as a fast local copy fallback
    localStorage.setItem('tast_portada_config_2026', JSON.stringify(config));
    localStorage.setItem('estat_inscripcio_global', estatInscripcions);
    
    const scJson = localStorage.getItem('tast_config_2026');
    if (scJson) {
      try {
        const sc = JSON.parse(scJson);
        sc.estatInscripcions = estatInscripcions;
        localStorage.setItem('tast_config_2026', JSON.stringify(sc));
      } catch {}
    }
    
    // Save to Supabase using settings table
    let synced = false;
    if (isSupabaseConfigured) {
      synced = await saveSupabaseSettings(config);
      
      const { getSupabaseSetting, saveSupabaseSetting } = await import('../supabaseClient');
      const sc = await getSupabaseSetting('tast_config_2026', null);
      if (sc) {
        sc.estatInscripcions = estatInscripcions;
        await saveSupabaseSetting('tast_config_2026', sc);
      }
      await saveSupabaseSetting('estat_inscripcio_global', estatInscripcions);
    }
    
    // Dispatch custom event to let App know configuration changed
    window.dispatchEvent(new Event('portadaConfigChanged'));
    
    setSaveSuccess(true);
    if (onAddLog) {
      onAddLog(language === 'ca' 
        ? `Configuració de la pantalla de Portada actualitzada correctament${synced ? " (Sincronitzat amb Supabase)" : ""}.` 
        : `Configuración de la pantalla de Portada actualizada correctamente${synced ? " (Sincronizado con Supabase)" : ""}.`
      );
    }
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = async () => {
    if (window.confirm(language === 'ca' 
      ? "Segur que vols restaurar els valors per defecte de la Portada?" 
      : "¿Seguro que quieres restaurar los valores por defecto de la Portada?")) {
      
      setConfig(PORTADA_CONFIG_DEFAULTS);
      localStorage.setItem('tast_portada_config_2026', JSON.stringify(PORTADA_CONFIG_DEFAULTS));
      
      let synced = false;
      if (isSupabaseConfigured) {
        synced = await saveSupabaseSettings(PORTADA_CONFIG_DEFAULTS);
      }
      
      window.dispatchEvent(new Event('portadaConfigChanged'));
      
      if (onAddLog) {
        onAddLog(language === 'ca' 
          ? `Restaurats valors per defecte de la Portada${synced ? " (Sincronitzat amb Supabase)" : ""}.` 
          : `Restaurado valores por defecto de la Portada${synced ? " (Sincronizado con Supabase)" : ""}.`
        );
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const updateField = <K extends keyof PortadaConfig>(field: K, value: PortadaConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translatingFields, setTranslatingFields] = useState<Record<string, boolean>>({});
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => {
    return typeof window !== 'undefined' && window.sessionStorage?.getItem('tast_translation_quota_exceeded') === 'true';
  });

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setIsQuotaExceeded(true);
    };
    window.addEventListener('translationQuotaExceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('translationQuotaExceeded', handleQuotaExceeded);
    };
  }, []);

  const handleBlurTranslate = async (sourceField: keyof PortadaConfig, targetField: keyof PortadaConfig, sourceLang: 'ca' | 'es', targetLang: 'ca' | 'es') => {
    if (!autoTranslate) return;
    const textToTranslate = config[sourceField] as string;
    if (!textToTranslate || !textToTranslate.trim()) return;

    setTranslatingFields(prev => ({ ...prev, [targetField as string]: true }));
    try {
      const { translateText } = await import('../translateService');
      const translated = await translateText(textToTranslate, sourceLang, targetLang);
      if (translated && translated.trim()) {
        updateField(targetField, translated.trim());
      }
    } catch (e) {
      console.error("Auto translation error:", e);
    } finally {
      setTranslatingFields(prev => ({ ...prev, [targetField as string]: false }));
    }
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

        {/* Portada and Questionnaire Toggle Switches */}
        <div className="flex flex-col sm:flex-row gap-3 self-stretch sm:self-auto">
          {/* Switch 1: Portada Activa */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs">
            <div className="text-left">
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest leading-none">ESTAT DE PORTADA</p>
              <p className="text-xs font-semibold text-zinc-800 mt-1">
                {config.activa 
                  ? (language === 'ca' ? "✅ Activa abans de l'app" : "✅ Activa antes de la app")
                  : (language === 'ca' ? "❌ Salt directe a la fitxa" : "❌ Salto directo a la ficha")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('activa', !config.activa)}
              className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${config.activa ? 'bg-[#ff0090]' : 'bg-zinc-300'}`}
              id="btn-portada-activa-switch"
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.activa ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Switch 2: Qüestionari Actiu */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs">
            <div className="text-left">
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest leading-none">BLOC QÜESTIONARI</p>
              <p className="text-xs font-semibold text-zinc-800 mt-1">
                {config.cuestionariActiu !== false
                  ? (language === 'ca' ? "✅ Qüestionari Visible" : "✅ Cuestionario Visible")
                  : (language === 'ca' ? "❌ Qüestionari Ocult" : "❌ Cuestionario Oculto")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('cuestionariActiu', config.cuestionariActiu === false ? true : false)}
              className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${config.cuestionariActiu !== false ? 'bg-[#ff0090]' : 'bg-zinc-300'}`}
              id="btn-cuestionari-actiu-switch"
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.cuestionariActiu !== false ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* SEMÀFOR D'ESTAT DE LES INSCRIPCIONS (MOVED FROM ADMINCONFIG) */}
      <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-5" id="config-semafor-card">
        <div className="border-b border-zinc-100 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-sans font-black text-sm text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <span className="text-xl">🚦</span> {language === 'ca' ? "Semàfor d'Estat de les Inscripcions" : "Semáforo de Estado de Inscripciones"}
            </h3>
            <p className="text-[10px] text-zinc-400 mt-1">
              {language === 'ca' 
                ? "Controla la fase de registre. Canvia els indicadors en temps real." 
                : "Controla la fase de registro. Modifica los indicadores en tiempo real."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savingSemafor && (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                <svg className="animate-spin h-3.5 w-3.5 text-[#ff0090]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {language === 'ca' ? "Desant estat..." : "Guardando estado..."}
              </span>
            )}
            {semaforSaveSuccess && (
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                ✓ {language === 'ca' ? "Sincronitzat amb Supabase" : "Sincronizado con Supabase"}
              </span>
            )}
          </div>
        </div>

        {semaforSaveError && (
          <div className="bg-red-50 border-2 border-red-300 text-red-900 p-4 rounded-xl text-xs font-medium space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-red-700">
              ⚠️ {language === 'ca' ? "Error en canviar l'estat a Supabase" : "Error al cambiar el estado en Supabase"}
            </p>
            <p className="font-mono bg-white/50 p-2 rounded border border-red-100 text-red-800 break-all">{semaforSaveError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Opció 1: Obertes - VERD */}
          <button
            type="button"
            disabled={savingSemafor}
            onClick={() => handleEstatInscripcionsChange('obertes')}
            className={`w-full p-3 rounded-2xl border text-left transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              estatInscripcions === 'obertes'
                ? 'bg-emerald-50 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] font-black text-emerald-950'
                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 opacity-60'
            } disabled:cursor-not-allowed`}
            id="btn-semafor-obertes"
          >
            <div className={`w-6 h-6 mb-2 rounded-full bg-emerald-500 relative shrink-0 ${estatInscripcions === 'obertes' ? 'animate-ping' : ''}`}>
              <div className="absolute inset-0 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            </div>
            <span className="block font-sans font-bold text-xs text-zinc-850">
              {language === 'ca' ? "Inscripcions Obertes" : "Inscripciones Abiertas"}
            </span>
          </button>

          {/* Opció 2: Espera - TARONJA */}
          <button
            type="button"
            disabled={savingSemafor}
            onClick={() => handleEstatInscripcionsChange('espera')}
            className={`w-full p-3 rounded-2xl border text-left transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              estatInscripcions === 'espera'
                ? 'bg-amber-50 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] font-black text-amber-950'
                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 opacity-60'
            } disabled:cursor-not-allowed`}
            id="btn-semafor-espera"
          >
            <div className={`w-6 h-6 mb-2 rounded-full bg-amber-500 relative shrink-0 ${estatInscripcions === 'espera' ? 'animate-ping' : ''}`}>
              <div className="absolute inset-0 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
            </div>
            <span className="block font-sans font-bold text-xs text-zinc-850">
              {language === 'ca' ? "Llista d'Espera" : "Lista de Espera"}
            </span>
          </button>

          {/* Opció 3: Tancades - VERMELL */}
          <button
            type="button"
            disabled={savingSemafor}
            onClick={() => handleEstatInscripcionsChange('tancades')}
            className={`w-full p-3 rounded-2xl border text-left transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              estatInscripcions === 'tancades'
                ? 'bg-rose-50 border-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.25)] font-black text-rose-950'
                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 opacity-60'
            } disabled:cursor-not-allowed`}
            id="btn-semafor-tancades"
          >
            <div className={`w-6 h-6 mb-2 rounded-full bg-red-600 relative shrink-0 ${estatInscripcions === 'tancades' ? 'animate-pulse' : ''}`}>
              <div className="absolute inset-0 rounded-full bg-red-600 shadow-[0_0_12px_#ef4444]" />
            </div>
            <span className="block font-sans font-bold text-xs text-zinc-850">
              {language === 'ca' ? "Inscripcions Tancades" : "Inscripciones Cerradas"}
            </span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Parameters customize form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Texts Segment - ONE SINGLE FIELD FOR BOTH LANGUAGES */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-5 space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
              <h4 className="font-sans font-bold text-xs text-zinc-700 uppercase tracking-widest flex items-center gap-1.5">
                <FileText size={14} className="text-[#ff0090]" />
                {language === 'ca' ? "Textos de la Coberta" : "Textos de la Portada"}
              </h4>
              <div className="flex items-center gap-10">
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-500 select-none">
                  <input 
                    type="checkbox"
                    checked={autoTranslate && !isQuotaExceeded}
                    disabled={isQuotaExceeded}
                    onChange={(e) => setAutoTranslate(e.target.checked)}
                    className="rounded border-zinc-300 bg-white text-[#ff0090] focus:ring-0 accent-[#ff0090] w-3 h-3 cursor-pointer disabled:opacity-50"
                  />
                  <span className={autoTranslate && !isQuotaExceeded ? "text-[#ff0090] font-black uppercase tracking-wider animate-pulse" : "uppercase tracking-wider"}>
                    {isQuotaExceeded 
                      ? (language === 'ca' ? "Sincro Limits (Text Directe) ⚠️" : "Sincro Límites (Texto Directo) ⚠️")
                      : "Sincro IA ✨"
                    }
                  </span>
                </label>
                <span className="text-[9px] bg-zinc-805 bg-[#ff0090] text-white font-mono font-extrabold px-1.5 py-0.5 rounded">
                  {language.toUpperCase()} ACTIU
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Títol / Título */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono font-extrabold">
                    {language === 'ca' ? "Títol de la Portada *" : "Título de la Portada *"}
                  </label>
                  {translatingFields['titol'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <input 
                  type="text"
                  required
                  value={language === 'ca' ? (config.titolCA ?? '') : (config.titolES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('titolCA', val);
                    } else {
                      updateField('titolES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('titolCA', translated),
                      (translated) => updateField('titolES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, titol: loading }))
                    );
                  }}
                  placeholder={language === 'ca' ? "El títol principal cridaner..." : "El título principal llamativo..."}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all placeholder-zinc-400 font-sans"
                />
              </div>

              {/* Subtítol / Subtítulo */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono font-extrabold">
                    {language === 'ca' ? "Subtítol superior" : "Subtítulo superior"}
                  </label>
                  {translatingFields['subtitol'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <input 
                  type="text"
                  value={language === 'ca' ? (config.subtitolCA ?? '') : (config.subtitolES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('subtitolCA', val);
                    } else {
                      updateField('subtitolES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('subtitolCA', translated),
                      (translated) => updateField('subtitolES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, subtitol: loading }))
                    );
                  }}
                  placeholder={language === 'ca' ? "Ex: Benvinguts a les comparses d'El Tast..." : "Ej: Bienvenidos a las comparsas de El Tast..."}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all placeholder-zinc-400 font-sans"
                />
              </div>

              {/* Descripció / Descripción */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono font-extrabold">
                    {language === 'ca' ? "Descripció o Reglament breu *" : "Descripción o Reglamento breve *"}
                  </label>
                  {translatingFields['descripcio'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <textarea 
                  rows={4}
                  required
                  value={language === 'ca' ? (config.descripcioCA ?? '') : (config.descripcioES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('descripcioCA', val);
                    } else {
                      updateField('descripcioES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('descripcioCA', translated),
                      (translated) => updateField('descripcioES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, descripcio: loading }))
                    );
                  }}
                  placeholder={language === 'ca' ? "Descriu breument com funciona el registre..." : "Describe brevemente cómo funciona el registro..."}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all placeholder-zinc-400 font-sans resize-none leading-relaxed"
                />
              </div>

              {/* Text del Botó Principal */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono font-extrabold">
                    {language === 'ca' ? "Text del Botó Principal *" : "Texto del Botón Principal *"}
                  </label>
                  {translatingFields['botoText'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <input 
                  type="text"
                  required
                  value={language === 'ca' ? (config.botoTextCA ?? '') : (config.botoTextES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('botoTextCA', val);
                    } else {
                      updateField('botoTextES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('botoTextCA', translated),
                      (translated) => updateField('botoTextES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, botoText: loading }))
                    );
                  }}
                  placeholder={language === 'ca' ? "Ex: Iniciar Formulari..." : "Ej: Iniciar Formulario..."}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all placeholder-zinc-400 font-sans"
                />
              </div>

              {/* Text de l'Etiqueta / Badge */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-550 uppercase font-mono font-extrabold">
                    {language === 'ca' ? "Text de l'Etiqueta / Badge" : "Texto de la Etiqueta / Badge"}
                  </label>
                  {translatingFields['badgeText'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <input 
                  type="text"
                  value={language === 'ca' ? (config.badgeTextCA ?? '') : (config.badgeTextES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('badgeTextCA', val);
                    } else {
                      updateField('badgeTextES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('badgeTextCA', translated),
                      (translated) => updateField('badgeTextES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, badgeText: loading }))
                    );
                  }}
                  placeholder={language === 'ca' ? "Ex: Inscripcions Obertes 2026..." : "Ej: Inscripciones Abiertas 2026..."}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all placeholder-zinc-400 font-sans"
                />
              </div>
            </div>
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
              <div className="space-y-4">
                <FileOrUrlInput 
                  id="bgImatgeUrl"
                  labelCa="Enllaç / Fitxer de la Foto de Fons *"
                  labelEs="Enlace / Archivo de la Foto de Fondo *"
                  type="image"
                  value={config.bgImatgeUrl}
                  onChange={(val) => updateField('bgImatgeUrl', val)}
                  placeholder="https://images.unsplash.com/photo-... o puja un fitxer"
                />

                {config.bgImatgeUrl && (
                  <div className="bg-zinc-100 rounded-2xl p-4 border border-zinc-200 text-left space-y-3.5">
                    <div className="flex items-center gap-1.5 border-b border-zinc-200 pb-1.5">
                      <Sliders size={13} className="text-[#ff0090]" />
                      <span className="text-[10px] font-mono font-bold text-zinc-700 uppercase tracking-widest">
                        {language === 'ca' ? "Ajustaments de la Foto de Fons" : "Ajustes de la Foto de Fondo"}
                      </span>
                    </div>

                    {/* Framing / Alignments row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Vertical Crop slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-550 font-bold">{language === 'ca' ? "Enquadrament Vertical" : "Encuadre Vertical"}</span>
                          <span className="text-[#ff0090] font-bold">{config.bgImatgeY ?? 50}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={config.bgImatgeY ?? 50}
                          onChange={(e) => updateField('bgImatgeY', parseInt(e.target.value))}
                          className="w-full accent-[#ff0090] cursor-pointer h-1.5 bg-zinc-250 rounded-lg"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                          <span>{language === 'ca' ? "Dalt" : "Arriba"} (0%)</span>
                          <span>{language === 'ca' ? "Baix" : "Abajo"} (100%)</span>
                        </div>
                      </div>

                      {/* Horizontal Crop slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-550 font-bold">{language === 'ca' ? "Enquadrament Horizontal" : "Encuadre Horizontal"}</span>
                          <span className="text-[#ff0090] font-bold">{config.bgImatgeX ?? 50}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={config.bgImatgeX ?? 50}
                          onChange={(e) => updateField('bgImatgeX', parseInt(e.target.value))}
                          className="w-full accent-[#ff0090] cursor-pointer h-1.5 bg-zinc-250 rounded-lg"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                          <span>{language === 'ca' ? "Esquerra" : "Izquierda"} (0%)</span>
                          <span>{language === 'ca' ? "Dreta" : "Derecha"} (100%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Mode of Scaling dropdown & Opacity slider row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="block text-[9px] text-zinc-550 font-mono font-bold">{language === 'ca' ? "Mida d'ajust d'escala" : "Ajuste de escala"}</label>
                        <select
                          value={config.bgImatgeScale || 'cover'}
                          onChange={(e) => updateField('bgImatgeScale', e.target.value as any)}
                          className="w-full bg-white text-zinc-800 border border-zinc-200 rounded-xl px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#ff0090]"
                        >
                          <option value="cover">{language === 'ca' ? "Emplenar (Cover - Recomanat)" : "Rellenar (Cover - Recomendado)"}</option>
                          <option value="contain">{language === 'ca' ? "Encaixar (Contain)" : "Encajar (Contain)"}</option>
                          <option value="auto">{language === 'ca' ? "Mida original" : "Tamaño original"}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-550 font-bold">{language === 'ca' ? "Opacitat / Brillantor" : "Opacidad / Luminosidad"}</span>
                          <span className="text-[#ff0090] font-bold">{config.bgImatgeOpacity ?? 40}%</span>
                        </div>
                        <input 
                          type="range"
                          min="10"
                          max="100"
                          value={config.bgImatgeOpacity ?? 40}
                          onChange={(e) => updateField('bgImatgeOpacity', parseInt(e.target.value))}
                          className="w-full accent-[#ff0090] cursor-pointer h-1.5 bg-zinc-250 rounded-lg"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                          <span>{language === 'ca' ? "Més fosc" : "Más oscuro"}</span>
                          <span>{language === 'ca' ? "Més clar" : "Más claro"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Saturation and Brightness correction sliders (to keep natural color or tweak it) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-550 font-bold">{language === 'ca' ? "Intensitat del Color (Saturació)" : "Intensidad del Color (Saturación)"}</span>
                          <span className="text-[#ff0090] font-bold">{config.bgImatgeSaturacio ?? 100}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="200"
                          value={config.bgImatgeSaturacio ?? 100}
                          onChange={(e) => updateField('bgImatgeSaturacio', parseInt(e.target.value))}
                          className="w-full accent-[#ff0090] cursor-pointer h-1.5 bg-zinc-250 rounded-lg"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                          <span>{language === 'ca' ? "Blanc i Negre" : "Blanco y Negro"} (0%)</span>
                          <span>{language === 'ca' ? "Viu" : "Vivo"} (200%)</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-550 font-bold">{language === 'ca' ? "Correcció de Brillantor" : "Corrección de Brillo"}</span>
                          <span className="text-[#ff0090] font-bold">{config.bgImatgeBrightness ?? 100}%</span>
                        </div>
                        <input 
                          type="range"
                          min="50"
                          max="150"
                          value={config.bgImatgeBrightness ?? 100}
                          onChange={(e) => updateField('bgImatgeBrightness', parseInt(e.target.value))}
                          className="w-full accent-[#ff0090] cursor-pointer h-1.5 bg-zinc-250 rounded-lg"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                          <span>{language === 'ca' ? "Fosc" : "Oscuro"}</span>
                          <span>{language === 'ca' ? "Brillant" : "Brillante"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

          {/* Estil i Disseny del Badge / Etiqueta de Capçalera */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="font-sans font-bold text-xs text-zinc-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-200 pb-2">
              <Sparkles size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "Etiqueta Destacada / Badge de Portada" : "Etiqueta Destacada / Badge de Portada"}
            </h4>
            <p className="text-[11px] text-zinc-550 leading-normal mb-1">
              {language === 'ca' 
                ? "Dissenya l'etiqueta flotant que apareix a sobre del títol principal. Escull presets de marca moderns com Instagram o crea el teu estil propi."
                : "Diseña la etiqueta flotante que aparece sobre el título principal. Escoge presets de marca modernos como Instagram o crea tu propio estilo."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Preset d'Estil del Badge */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Preset d'Estil de l'Etiqueta" : "Preset de Estilo de la Etiqueta"}
                </label>
                <select
                  value={config.badgeStyle || 'custom'}
                  onChange={(e) => updateField('badgeStyle', e.target.value as any)}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-all"
                >
                  <option value="custom">⚙️ {language === 'ca' ? "Estil Personalitzat (Color sòlid i vora)" : "Estilo Personalizado (Color sólido y borde)"}</option>
                  <option value="instagram-gradient">📸 Instagram Story Gradient (Vibrant Color Wheel)</option>
                  <option value="glass-retro">🪟 Efecte Vidre Transmès (Glassmorphism Retro)</option>
                  <option value="solid-neon">🔋 Neon Elèctric Glow (Green/Acid)</option>
                  <option value="cyberpunk">👾 Cyberpunk Retro-Neon Pulse</option>
                </select>
              </div>

              {/* Icona de l'Etiqueta */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Icona de l'Etiqueta" : "Icono de la Etiqueta"}
                </label>
                <select
                  value={config.badgeIcon || 'compass'}
                  onChange={(e) => updateField('badgeIcon', e.target.value as any)}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-all"
                >
                  <option value="compass">🧭 Compass (Brúixola)</option>
                  <option value="instagram">📸 Instagram</option>
                  <option value="sparkles">✨ Sparkles (Destells)</option>
                  <option value="heart">❤️ Heart (Cor)</option>
                  <option value="star">⭐️ Star (Estrella)</option>
                  <option value="lightning">⚡️ Lightning (Rampell)</option>
                  <option value="bell">🔔 Bell (Campana)</option>
                  <option value="none">🚫 {language === 'ca' ? "Sense icona" : "Sin icono"}</option>
                </select>
              </div>

              {/* Animació / Gir de la icona */}
              <div className="flex items-center gap-2 py-2 col-span-1 md:col-span-2">
                <input 
                  type="checkbox"
                  id="badgeSpinIcon"
                  checked={config.badgeSpinIcon !== false}
                  onChange={(e) => updateField('badgeSpinIcon', e.target.checked)}
                  className="rounded text-[#ff0090] focus:ring-[#ff0090] h-4 w-4 border-zinc-300 cursor-pointer"
                />
                <label htmlFor="badgeSpinIcon" className="text-xs font-semibold text-zinc-700 cursor-pointer select-none">
                  🌀 {language === 'ca' ? "Rotar l'icona contínuament (Animació dinàmica)" : "Rotar el icono continuamente (Animación dinámica)"}
                </label>
              </div>

              {/* Camps opcionals de color per a estil custom */}
              {config.badgeStyle === 'custom' && (
                <>
                  {/* Color de Fons */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Fons de l'Etiqueta" : "Fondo de la Etiqueta"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={config.badgeBgColor || '#ff0090'} 
                        onChange={(e) => updateField('badgeBgColor', e.target.value)}
                        className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                      />
                      <input 
                        type="text" 
                        value={config.badgeBgColor || '#ff0090'} 
                        onChange={(e) => updateField('badgeBgColor', e.target.value)}
                        className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                        placeholder="#ff0090"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Color del Text */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Text de l'Etiqueta" : "Texto de la Etiqueta"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={config.badgeTextColor || '#ffffff'} 
                        onChange={(e) => updateField('badgeTextColor', e.target.value)}
                        className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                      />
                      <input 
                        type="text" 
                        value={config.badgeTextColor || '#ffffff'} 
                        onChange={(e) => updateField('badgeTextColor', e.target.value)}
                        className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                        placeholder="#ffffff"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Color de la Vora */}
                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Color de la Vora" : "Color del Borde"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={config.badgeBorderColor || 'rgba(255, 0, 144, 0.4)'} 
                        onChange={(e) => updateField('badgeBorderColor', e.target.value)}
                        className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                      />
                      <input 
                        type="text" 
                        value={config.badgeBorderColor || 'rgba(255, 0, 144, 0.4)'} 
                        onChange={(e) => updateField('badgeBorderColor', e.target.value)}
                        className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                        placeholder="rgba(255, 0, 144, 0.4)"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Colors i Estils de Textos */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="font-sans font-bold text-xs text-zinc-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-200 pb-2">
              <Palette size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "Colors i Estils Visuals de la Portada" : "Colores y Estilos Visuales de la Portada"}
            </h4>
            <p className="text-[11px] text-zinc-550 leading-normal mb-1">
              {language === 'ca' 
                ? "Estableix la combinació de colors per als textos i botons per donar una identitat unificada i personalitzada a la portada."
                : "Establece la combinación de colores para los textos y botones para dar una identidad unificada y personalizada a la portada."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Color d'accent global (marca) */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Color d'accent / Detalls" : "Color de acento / Detalles"}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={config.accentColor || '#ff0090'} 
                    onChange={(e) => updateField('accentColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={config.accentColor || '#ff0090'} 
                    onChange={(e) => updateField('accentColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                    placeholder="#ff0090"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Color del fons del botó CTA */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Fons del Botó Principal" : "Fondo del Botón Principal"}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={config.botoBgColor || config.accentColor || '#ff0090'} 
                    onChange={(e) => updateField('botoBgColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={config.botoBgColor || config.accentColor || '#ff0090'} 
                    onChange={(e) => updateField('botoBgColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                    placeholder="#ff0090"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Color del text del botó CTA */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Text del Botó Principal" : "Texto del Botón Principal"}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={config.botoTextColor || '#ffffff'} 
                    onChange={(e) => updateField('botoTextColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={config.botoTextColor || '#ffffff'} 
                    onChange={(e) => updateField('botoTextColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                    placeholder="#ffffff"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Ajusts Avançats del Botó CTA */}
              <div className="col-span-1 md:col-span-2 bg-white/40 border border-zinc-200/50 rounded-xl p-4.5 space-y-4">
                <div className="flex items-center gap-1.5 border-b border-zinc-250 pb-1.5 font-sans font-black text-[11px] text-zinc-700 uppercase tracking-wider">
                  <Sparkles size={13} className="text-[#ff0090]" />
                  <span>
                    {language === 'ca' ? "Estil i Sombreado del Botó" : "Estilo y Sombreado del Botón"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  {/* Text Size */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Mida del Text" : "Tamaño del Texto"}
                    </label>
                    <select
                      value={config.botoTextSize || 'text-xs md:text-sm'}
                      onChange={(e) => updateField('botoTextSize', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="text-[10px]">{language === 'ca' ? "Molt petit" : "Muy pequeño"}</option>
                      <option value="text-xs">{language === 'ca' ? "Petit" : "Pequeño"}</option>
                      <option value="text-xs md:text-sm">{language === 'ca' ? "Original (Estàndard)" : "Original (Estándar)"}</option>
                      <option value="text-sm">{language === 'ca' ? "Mitjà" : "Mediano"}</option>
                      <option value="text-base">{language === 'ca' ? "Gran" : "Grande"}</option>
                      <option value="text-lg">{language === 'ca' ? "Molt gran" : "Muy grande"}</option>
                    </select>
                  </div>

                  {/* Font Weight */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Gruix de Lletra" : "Grosor de Letra"}
                    </label>
                    <select
                      value={config.botoFontWeight || 'font-black'}
                      onChange={(e) => updateField('botoFontWeight', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="font-normal">{language === 'ca' ? "Normal" : "Normal"}</option>
                      <option value="font-medium">{language === 'ca' ? "Mitjà" : "Medio"}</option>
                      <option value="font-semibold">{language === 'ca' ? "Seminegre" : "Seminegrita"}</option>
                      <option value="font-bold">{language === 'ca' ? "Negre" : "Negrita"}</option>
                      <option value="font-extrabold">{language === 'ca' ? "Extra Negre" : "Extra Negrita"}</option>
                      <option value="font-black">{language === 'ca' ? "Original (Supernegre)" : "Original (Supernegrita)"}</option>
                    </select>
                  </div>

                  {/* Arrodoniment */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Arrodoniment (Cantons)" : "Redondeado (Esquinas)"}
                    </label>
                    <select
                      value={config.botoRounded || 'rounded-2xl'}
                      onChange={(e) => updateField('botoRounded', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="rounded-none">{language === 'ca' ? "Rectangle Recte" : "Rectángulo Recto"}</option>
                      <option value="rounded-sm">{language === 'ca' ? "Mínim" : "Mínimo"}</option>
                      <option value="rounded">{language === 'ca' ? "Petit" : "Pequeño"}</option>
                      <option value="rounded-md">{language === 'ca' ? "Mitjà" : "Medio"}</option>
                      <option value="rounded-lg">{language === 'ca' ? "Suau (L)" : "Suave (L)"}</option>
                      <option value="rounded-xl">{language === 'ca' ? "Bonic (XL)" : "Elegante (XL)"}</option>
                      <option value="rounded-2xl">{language === 'ca' ? "Original (2nd XL)" : "Original (2nd XL)"}</option>
                      <option value="rounded-3xl">{language === 'ca' ? "Màxim (3rd XL)" : "Máximo (3rd XL)"}</option>
                      <option value="rounded-full">{language === 'ca' ? "Pastilla (Full)" : "Cápsula (Full)"}</option>
                    </select>
                  </div>

                  {/* Distanciament de Lletres */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Espaiat de lletres" : "Espaciado de letras"}
                    </label>
                    <select
                      value={config.botoLetterSpacing || 'tracking-wider'}
                      onChange={(e) => updateField('botoLetterSpacing', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="tracking-tighter">{language === 'ca' ? "Molt estret" : "Muy estrecho"}</option>
                      <option value="tracking-normal">{language === 'ca' ? "Normal" : "Normal"}</option>
                      <option value="tracking-wide">{language === 'ca' ? "Ample" : "Ancho"}</option>
                      <option value="tracking-wider">{language === 'ca' ? "Original (Més Ample)" : "Original (Más Ancho)"}</option>
                      <option value="tracking-widest">{language === 'ca' ? "El més ample" : "El más ancho"}</option>
                    </select>
                  </div>

                  {/* Sombreado del Botó */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Mida del Sombreado (Ombra)" : "Tamaño del Sombreado (Sombra)"}
                    </label>
                    <select
                      value={config.botoShadowSize || 'shadow-xl'}
                      onChange={(e) => updateField('botoShadowSize', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="shadow-none">{language === 'ca' ? "Sense Sombra (Pla)" : "Sin Sombra (Plano)"}</option>
                      <option value="shadow-sm">{language === 'ca' ? "Molt lleugera" : "Muy ligera"}</option>
                      <option value="shadow">{language === 'ca' ? "Bàsica" : "Básica"}</option>
                      <option value="shadow-md">{language === 'ca' ? "Mitjana" : "Mediana"}</option>
                      <option value="shadow-lg">{language === 'ca' ? "Nítida (L)" : "Nítida (L)"}</option>
                      <option value="shadow-xl">{language === 'ca' ? "Original (Flotant XL)" : "Original (Flotante XL)"}</option>
                      <option value="shadow-2xl">{language === 'ca' ? "Màxima (Glow 2XL)" : "Máxima (Glow 2XL)"}</option>
                    </select>
                  </div>

                  {/* Color de la Sombra */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Color del Sombreado" : "Color del Sombreado"}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="color" 
                        value={config.botoShadowColor || config.botoBgColor || config.accentColor || '#ff0090'} 
                        onChange={(e) => updateField('botoShadowColor', e.target.value)}
                        className="w-7 h-7 border border-zinc-200 rounded-lg cursor-pointer p-0.5 shrink-0"
                        title={language === 'ca' ? "Escollir color d'ombra" : "Elegir color de sombra"}
                      />
                      <input 
                        type="text" 
                        value={config.botoShadowColor || config.botoBgColor || config.accentColor || '#ff0090'} 
                        onChange={(e) => updateField('botoShadowColor', e.target.value)}
                        className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                        placeholder="#ff0090"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Gruix de la Vora */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Gruix de la Vora" : "Grosor del Borde"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min={0} 
                        max={4} 
                        step={1}
                        value={config.botoBorderWidth ?? 0}
                        onChange={(e) => updateField('botoBorderWidth', parseInt(e.target.value))}
                        className="w-2/3 accent-[#ff0090] h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-bold text-zinc-700 font-mono shrink-0">{(config.botoBorderWidth ?? 0)}px</span>
                    </div>
                  </div>

                  {/* Color de la Vora */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Color de la Vora" : "Color del Borde"}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="color" 
                        value={config.botoBorderColor || 'transparent'} 
                        onChange={(e) => updateField('botoBorderColor', e.target.value)}
                        className="w-7 h-7 border border-zinc-200 rounded-lg cursor-pointer p-0.5 shrink-0"
                      />
                      <input 
                        type="text" 
                        value={config.botoBorderColor || ''} 
                        onChange={(e) => updateField('botoBorderColor', e.target.value)}
                        className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                        placeholder="Ex: #ffffff"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Majúscules toggle */}
                  <div className="sm:col-span-2 pt-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-700">
                      {language === 'ca' ? "Text completament en majúscules" : "Texto completamente en mayúsculas"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={config.botoUppercase !== false} 
                        onChange={(e) => updateField('botoUppercase', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff0090]"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Color del Títol */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Color del Títol Principal" : "Color del Título Principal"}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={config.titolColor || '#ffffff'} 
                    onChange={(e) => updateField('titolColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={config.titolColor || '#ffffff'} 
                    onChange={(e) => updateField('titolColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                    placeholder="#ffffff"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Color del Subtítol */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Color del Subtítol" : "Color del Subtítulo"}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={config.subtitolColor || '#a1a1aa'} 
                    onChange={(e) => updateField('subtitolColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={config.subtitolColor || '#a1a1aa'} 
                    onChange={(e) => updateField('subtitolColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                    placeholder="#a1a1aa"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Color de la Descripció */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Color de la Descripció" : "Color de la Descripción"}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={config.descripcioColor || '#d4d4d8'} 
                    onChange={(e) => updateField('descripcioColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={config.descripcioColor || '#d4d4d8'} 
                    onChange={(e) => updateField('descripcioColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                    placeholder="#d4d4d8"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Presets ràpids per simplicitat */}
            <div className="pt-2">
              <label className="block text-[9px] text-zinc-400 font-mono font-bold uppercase tracking-wider mb-2">
                {language === 'ca' ? "Paletes de Presets Ràpides" : "Paletas de Presets Rápidas"}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Tast Fuchsia (Original)', accent: '#ff0090', titol: '#ffffff', sub: '#a1a1aa', desc: '#d4d4d8', buttonBg: '#ff0090', buttonText: '#ffffff' },
                  { name: 'VNG Gold & Amber', accent: '#fbbf24', titol: '#ffffff', sub: '#fcd34d', desc: '#e5e7eb', buttonBg: '#fbbf24', buttonText: '#18181b' },
                  { name: 'Deep Electric Cyan', accent: '#06b6d4', titol: '#ffffff', sub: '#67e8f9', desc: '#f3f4f6', buttonBg: '#06b6d4', buttonText: '#ffffff' },
                  { name: 'Carnaval Acid Green', accent: '#84cc16', titol: '#ffffff', sub: '#bef264', desc: '#f3f4f6', buttonBg: '#84cc16', buttonText: '#111827' },
                  { name: 'Cosmic Royal Violet', accent: '#8b5cf6', titol: '#ffffff', sub: '#c084fc', desc: '#e2e8f0', buttonBg: '#8b5cf6', buttonText: '#ffffff' },
                  { name: 'Sunset Terracotta', accent: '#f97316', titol: '#ffffff', sub: '#fdba74', desc: '#cbd5e1', buttonBg: '#f97316', buttonText: '#ffffff' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      updateField('accentColor', preset.accent);
                      updateField('titolColor', preset.titol);
                      updateField('subtitolColor', preset.sub);
                      updateField('descripcioColor', preset.desc);
                      updateField('botoBgColor', preset.buttonBg);
                      updateField('botoTextColor', preset.buttonText);
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 text-[10px] font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer text-zinc-700 font-sans"
                  >
                    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: preset.accent }} />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Personalització del Peu de Pàgina */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-5 space-y-4 text-left">
            <h4 className="font-sans font-bold text-xs text-zinc-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-200 pb-2">
              <Sliders size={14} className="text-[#ff0090]" />
              {language === 'ca' ? "Personalització del Peu de Pàgina (Footer)" : "Personalización del Pie de Página (Footer)"}
            </h4>
            <p className="text-[11px] text-zinc-550 leading-normal mb-1">
              {language === 'ca' 
                ? "Editeu els textos, colors i enllaços legals o de contacte situats a la part inferior de la portada."
                : "Edita los textos, colores y enlaces legales o de contacto ubicados en la parte inferior de la portada."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Text de copyright / Principal - UNIFIED SINGLE FIELD */}
              <div className="space-y-1 md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                    {language === 'ca' ? "Text del Peu de Pàgina *" : "Texto del Pie de Página *"}
                  </label>
                  {translatingFields['footerText'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <input 
                  type="text"
                  required
                  value={language === 'ca' ? (config.footerTextCA ?? '') : (config.footerTextES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('footerTextCA', val);
                    } else {
                      updateField('footerTextES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('footerTextCA', translated),
                      (translated) => updateField('footerTextES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, footerText: loading }))
                    );
                  }}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0"
                  placeholder={language === 'ca' ? "Ex: © 2026 ASSOCIACIÓ COMPARSES EL TAST" : "Ej: © 2026 ASOCIACIÓN COMPARSAS EL TAST"}
                />
              </div>

              {/* Color del text del footer */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Color del Text del Peu de Pàgina" : "Color de Texto del Pie de Página"}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={config.footerTextColor || '#71717a'} 
                    onChange={(e) => updateField('footerTextColor', e.target.value)}
                    className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer p-0.5 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={config.footerTextColor || '#71717a'} 
                    onChange={(e) => updateField('footerTextColor', e.target.value)}
                    className="flex-1 bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                    placeholder="#71717a"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Enllaç 1 - UNIFIED SINGLE FIELD */}
              <div className="space-y-1 md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                    {language === 'ca' ? "Etiqueta Enllaç 1" : "Etiqueta Enlace 1"}
                  </label>
                  {translatingFields['footerLink1Label'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <input 
                  type="text"
                  value={language === 'ca' ? (config.footerLink1LabelCA ?? '') : (config.footerLink1LabelES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('footerLink1LabelCA', val);
                    } else {
                      updateField('footerLink1LabelES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('footerLink1LabelCA', translated),
                      (translated) => updateField('footerLink1LabelES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, footerLink1Label: loading }))
                    );
                  }}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0"
                  placeholder={language === 'ca' ? "Ex: Normativa" : "Ej: Normativa"}
                />
              </div>

              {/* URL Enllaç 1 */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "URL / Destí d'Enllaç 1" : "URL / Destino de Enlace 1"}
                </label>
                <input 
                  type="text"
                  value={config.footerLink1Url ?? ''}
                  onChange={(e) => updateField('footerLink1Url', e.target.value)}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0"
                  placeholder="https://eltast.cat/normativa.pdf o #"
                />
              </div>

              {/* Enllaç 2 - UNIFIED SINGLE FIELD */}
              <div className="space-y-1 md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                    {language === 'ca' ? "Etiqueta Enllaç 2" : "Etiqueta Enlace 2"}
                  </label>
                  {translatingFields['footerLink2Label'] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ Sincronitzant IA...</span>}
                </div>
                <input 
                  type="text"
                  value={language === 'ca' ? (config.footerLink2LabelCA ?? '') : (config.footerLink2LabelES ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      updateField('footerLink2LabelCA', val);
                    } else {
                      updateField('footerLink2LabelES', val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => updateField('footerLink2LabelCA', translated),
                      (translated) => updateField('footerLink2LabelES', translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, footerLink2Label: loading }))
                    );
                  }}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0"
                  placeholder={language === 'ca' ? "Ex: secretaria@eltast.cat" : "Ej: secretaria@eltast.cat"}
                />
              </div>

              {/* URL Enllaç 2 */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-[10px] text-zinc-650 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "URL / Destí d'Enllaç 2" : "URL / Destino de Enlace 2"}
                </label>
                <input 
                  type="text"
                  value={config.footerLink2Url ?? ''}
                  onChange={(e) => updateField('footerLink2Url', e.target.value)}
                  className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-0"
                  placeholder="mailto:secretaria@eltast.cat o https://..."
                />
              </div>

              {/* Ajusts de Disseny de Peu de Pàgina */}
              <div className="col-span-1 md:col-span-2 bg-white/40 border border-zinc-200/50 rounded-xl p-4.5 space-y-4 text-left">
                <div className="flex items-center gap-1.5 border-b border-zinc-250 pb-1.5 font-sans font-black text-[11px] text-zinc-700 uppercase tracking-wider">
                  <Palette size={13} className="text-[#ff0090]" />
                  <span>
                    {language === 'ca' ? "Estil del Peu de Pàgina" : "Estilo del Pie de Página"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mida de lletra del footer */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Mida del Text" : "Tamaño del Texto"}
                    </label>
                    <select
                      value={config.footerTextSize || 'text-[10px]'}
                      onChange={(e) => updateField('footerTextSize', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="text-[9px]">{language === 'ca' ? "Extra petit (9px)" : "Extra pequeño (9px)"}</option>
                      <option value="text-[10px]">{language === 'ca' ? "Original (10px)" : "Original (10px)"}</option>
                      <option value="text-xs">{language === 'ca' ? "Petit (12px)" : "Pequeño (12px)"}</option>
                      <option value="text-sm">{language === 'ca' ? "Mitjà (14px)" : "Mediano (14px)"}</option>
                    </select>
                  </div>

                  {/* Gruix de lletra del footer */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Gruix del text" : "Grosor del texto"}
                    </label>
                    <select
                      value={config.footerFontWeight || 'font-normal'}
                      onChange={(e) => updateField('footerFontWeight', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="font-normal">{language === 'ca' ? "Original (Normal)" : "Original (Normal)"}</option>
                      <option value="font-medium">{language === 'ca' ? "Mitjà d'accent" : "Grosor medio"}</option>
                      <option value="font-bold">{language === 'ca' ? "Gruixut" : "Negrita"}</option>
                    </select>
                  </div>

                  {/* Font tipus: Mono o Sans */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Família de Fonts" : "Familia de Fuentes"}
                    </label>
                    <select
                      value={config.footerFontMono !== false ? 'mono' : 'sans'}
                      onChange={(e) => updateField('footerFontMono', e.target.value === 'mono')}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="mono">{language === 'ca' ? "Original (Tipografia Mono)" : "Original (Tipografía Mono)"}</option>
                      <option value="sans">{language === 'ca' ? "Senzilla (Tipografia Sans-Serif)" : "Sencilla (Tipografía Sans-Serif)"}</option>
                    </select>
                  </div>

                  {/* Color de Hover dels Links */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Color del Link al passar el ratolí" : "Color del Link al pasar el ratón"}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="color" 
                        value={config.footerLinkHoverColor || config.accentColor || '#ff0090'} 
                        onChange={(e) => updateField('footerLinkHoverColor', e.target.value)}
                        className="w-7 h-7 border border-zinc-200 rounded-lg cursor-pointer p-0.5 shrink-0"
                      />
                      <input 
                        type="text" 
                        value={config.footerLinkHoverColor || config.accentColor || '#ff0090'} 
                        onChange={(e) => updateField('footerLinkHoverColor', e.target.value)}
                        className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:ring-0 uppercase font-mono"
                        placeholder="#ff0090"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Color de la línia superior del footer (Separador) */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Color de la línia separadora" : "Color de la línea separadora"}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="color" 
                        value={config.footerBorderTopColor || 'rgba(255, 255, 255, 0.1)'} 
                        onChange={(e) => updateField('footerBorderTopColor', e.target.value)}
                        className="w-7 h-7 border border-zinc-200 rounded-lg cursor-pointer p-0.5 shrink-0"
                      />
                      <input 
                        type="text" 
                        value={config.footerBorderTopColor || ''} 
                        onChange={(e) => updateField('footerBorderTopColor', e.target.value)}
                        className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:ring-0 font-mono"
                        placeholder="Ex: rgba(255,255,255,0.1)"
                      />
                    </div>
                  </div>

                  {/* Espaiat de lletres del footer */}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-zinc-550 font-mono font-bold uppercase tracking-wider">
                      {language === 'ca' ? "Espaiat de lletres" : "Espaciado de letras"}
                    </label>
                    <select
                      value={config.footerLetterSpacing || 'tracking-wider'}
                      onChange={(e) => updateField('footerLetterSpacing', e.target.value)}
                      className="w-full bg-white text-zinc-900 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-0"
                    >
                      <option value="tracking-normal">{language === 'ca' ? "Normal" : "Normal"}</option>
                      <option value="tracking-wide">{language === 'ca' ? "Ample" : "Ancho"}</option>
                      <option value="tracking-wider">{language === 'ca' ? "Original (Més ample)" : "Original (Más ancho)"}</option>
                      <option value="tracking-widest">{language === 'ca' ? "El més ample" : "El más ancho"}</option>
                    </select>
                  </div>

                  {/* Majúscules text toggle */}
                  <div className="sm:col-span-1 pt-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-700">
                      {language === 'ca' ? "Text complet en majúscules" : "Texto completo en mayúsculas"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={config.footerUppercase !== false} 
                        onChange={(e) => updateField('footerUppercase', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff0090]"></div>
                    </label>
                  </div>

                  {/* Sombreado de Text en Footer (per llegibilitat) */}
                  <div className="sm:col-span-1 pt-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-700">
                      {language === 'ca' ? "Sombreado per a llegibilitat" : "Sombreado para legibilidad"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!config.footerShadowEnabled} 
                        onChange={(e) => updateField('footerShadowEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff0090]"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
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
              <div className="space-y-4">
                <FileOrUrlInput 
                  id="contingutImatgeUrl"
                  labelCa="Enllaç / Fitxer del Spotlight *"
                  labelEs="Enlace / Archivo del Spotlight *"
                  type="image"
                  value={config.contingutImatgeUrl}
                  onChange={(val) => updateField('contingutImatgeUrl', val)}
                  placeholder="https://images.unsplash.com/photo-... o puja un fitxer"
                />

                {config.contingutImatgeUrl && (
                  <div className="bg-zinc-100 rounded-2xl p-4 border border-zinc-200 text-left space-y-3.5">
                    <div className="flex items-center gap-1.5 border-b border-zinc-200 pb-1.5 font-bold">
                      <Sliders size={13} className="text-[#ff0090]" />
                      <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
                        {language === 'ca' ? "Ajustaments de la Targeta Spotlight" : "Ajustes de la Tarjeta Spotlight"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Vertical alignment */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-550 font-bold">{language === 'ca' ? "Enquadrament Vertical" : "Encuadre Vertical"}</span>
                          <span className="text-[#ff0090] font-bold">{config.contingutImatgeY ?? 50}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={config.contingutImatgeY ?? 50}
                          onChange={(e) => updateField('contingutImatgeY', parseInt(e.target.value))}
                          className="w-full accent-[#ff0090] cursor-pointer h-1.5 bg-zinc-250 rounded-lg"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                          <span>{language === 'ca' ? "Dalt" : "Arriba"} (0%)</span>
                          <span>{language === 'ca' ? "Baix" : "Abajo"} (100%)</span>
                        </div>
                      </div>

                      {/* Horizontal alignment */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-550 font-bold">{language === 'ca' ? "Enquadrament Horizontal" : "Encuadre Horizontal"}</span>
                          <span className="text-[#ff0090] font-bold">{config.contingutImatgeX ?? 50}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={config.contingutImatgeX ?? 50}
                          onChange={(e) => updateField('contingutImatgeX', parseInt(e.target.value))}
                          className="w-full accent-[#ff0090] cursor-pointer h-1.5 bg-zinc-250 rounded-lg"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 font-mono">
                          <span>{language === 'ca' ? "Esquerra" : "Izquierda"} (0%)</span>
                          <span>{language === 'ca' ? "Dreta" : "Derecha"} (100%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Scale Mode Selector */}
                    <div className="space-y-1">
                      <label className="block text-[9px] text-zinc-550 font-mono font-bold">{language === 'ca' ? "Mida d'ajust d'escala" : "Ajuste de escala"}</label>
                      <select
                        value={config.contingutImatgeScale || 'cover'}
                        onChange={(e) => updateField('contingutImatgeScale', e.target.value as any)}
                        className="w-full bg-white text-zinc-800 border border-zinc-200 rounded-xl px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#ff0090]"
                      >
                        <option value="cover">{language === 'ca' ? "Retallar i Emplenar (Cover)" : "Recortar y Rellenar (Cover)"}</option>
                        <option value="contain">{language === 'ca' ? "Encaixar completament (Contain)" : "Encajar por completo (Contain)"}</option>
                        <option value="fill">{language === 'ca' ? "Ajustar forçat (Stretch Fill)" : "Ajustar forzado (Stretch Fill)"}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
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
                  className="absolute inset-0 w-full h-full z-0 transition-all duration-300"
                  style={{
                    objectPosition: `${config.bgImatgeX ?? 50}% ${config.bgImatgeY ?? 50}%`,
                    objectFit: config.bgImatgeScale || 'cover',
                    opacity: (config.bgImatgeOpacity ?? 40) / 100,
                    filter: `saturate(${config.bgImatgeSaturacio ?? 100}%) brightness(${config.bgImatgeBrightness ?? 100}%)`
                  }}
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
                {(() => {
                  const badgeText = activeLangTab === 'ca' 
                    ? (config.badgeTextCA || 'Inscripcions Obertes 2026') 
                    : (config.badgeTextES || 'Inscripciones Abiertas 2026');
                  
                  const badgeIconName = config.badgeIcon || 'compass';
                  const badgeStyleType = config.badgeStyle || 'custom';
                  const badgeBg = config.badgeBgColor || config.accentColor || '#ff0090';
                  const badgeTxtColor = config.badgeTextColor || '#ffffff';
                  const badgeBrdColor = config.badgeBorderColor || `rgba(255, 0, 144, 0.4)`;
                  const badgeSpinIcon = config.badgeSpinIcon !== false;

                  let badgeClasses = "px-2 py-1 text-[7.5px] font-mono tracking-wider font-extrabold uppercase w-max rounded-full transition-all duration-300 flex items-center gap-1 ";
                  let badgeStyles: React.CSSProperties = {};

                  if (badgeStyleType === 'instagram-gradient') {
                    badgeClasses += "bg-gradient-to-r from-amber-400 via-pink-600 to-purple-600 text-white shadow-md border border-white/10";
                  } else if (badgeStyleType === 'glass-retro') {
                    badgeClasses += "bg-white/10 backdrop-blur-md border border-white/20 text-white !rounded-xl";
                  } else if (badgeStyleType === 'solid-neon') {
                    badgeClasses += "bg-green-400 text-black border border-green-300 shadow-[0_0_8px_rgba(74,222,128,0.5)] font-bold";
                    badgeStyles = {
                      backgroundColor: '#22c55e',
                      color: '#000000',
                      borderColor: '#4ade80'
                    };
                  } else if (badgeStyleType === 'cyberpunk') {
                    badgeClasses += "bg-black text-rose-500 border border-fuchsia-500 !rounded-none shadow-[inset_0_0_5px_rgba(236,72,153,0.3)] animate-pulse";
                  } else {
                    badgeClasses += "bg-white/5 border";
                    badgeStyles = {
                      color: badgeTxtColor,
                      backgroundColor: badgeBg.startsWith('#') ? `${badgeBg}20` : badgeBg,
                      borderColor: badgeBrdColor
                    };
                  }

                  return (
                    <span className={badgeClasses} style={badgeStyles}>
                      {badgeIconName !== 'none' && (
                        <span className={badgeSpinIcon ? "animate-spin inline-block origin-center" : "inline-block"}>
                          {badgeIconName === 'instagram' ? '📸' : 
                           badgeIconName === 'sparkles' ? '✨' : 
                           badgeIconName === 'heart' ? '❤️' :
                           badgeIconName === 'star' ? '⭐️' :
                           badgeIconName === 'lightning' ? '⚡️' :
                           badgeIconName === 'bell' ? '🔔' : '🧭'}
                        </span>
                      )}
                      <span>{badgeText}</span>
                    </span>
                  );
                })()}

                <h5 
                  className="font-sans font-black text-base md:text-lg leading-tight tracking-tight"
                  style={{ color: config.titolColor || '#ffffff' }}
                >
                  {activeLangTab === 'ca' ? config.titolCA : config.titolES}
                </h5>

                <p 
                  className="text-[9px] tracking-wide uppercase font-mono"
                  style={{ color: config.subtitolColor || '#a1a1aa' }}
                >
                  {activeLangTab === 'ca' ? config.subtitolCA : config.subtitolES}
                </p>

                <p 
                  className="text-[9px] leading-relaxed line-clamp-3"
                  style={{ color: config.descripcioColor || '#d4d4d8' }}
                >
                  {activeLangTab === 'ca' ? config.descripcioCA : config.descripcioES}
                </p>

                {config.contingutTipus !== 'none' && (
                  <div className="bg-black/60 p-1.5 aspect-[16/10] rounded-xl border border-white/5 overflow-hidden flex items-center justify-center text-[8px] text-zinc-500 font-mono">
                    {config.contingutTipus === 'imatge' ? (
                       config.contingutImatgeUrl ? (
                        <img 
                          src={config.contingutImatgeUrl} 
                          alt="preview" 
                          className="w-full h-full rounded-lg transition-all duration-300"
                          style={{
                            objectPosition: `${config.contingutImatgeX ?? 50}% ${config.contingutImatgeY ?? 50}%`,
                            objectFit: config.contingutImatgeScale || 'cover'
                          }}
                        />
                      ) : 'Falta enllaç...'
                    ) : (
                      <span className="flex items-center gap-1"><Play size={9} /> Reproductor Spotlight</span>
                    )}
                  </div>
                )}

                {/* Simulated Click button CTA */}
                <div className="pt-2">
                  <div 
                    className="w-full text-center font-black py-2.5 rounded-xl uppercase tracking-wider text-[8px] shadow-lg"
                    style={{ 
                      backgroundColor: config.botoBgColor || config.accentColor || '#ff0090', 
                      color: config.botoTextColor || '#ffffff' 
                    }}
                  >
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
