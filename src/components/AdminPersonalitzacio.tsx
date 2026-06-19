import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Sparkles, 
  CheckCircle2, 
  RotateCcw, 
  Image, 
  Video, 
  Palette, 
  Play, 
  Eye, 
  FileText, 
  LayoutTemplate, 
  Sliders,
  Mail,
  Clock,
  Inbox,
  AlertCircle,
  Save,
  ArrowRight,
  Upload,
  Trash2
} from 'lucide-react';
import AdminPortada from './AdminPortada';
import { useLanguage } from '../LanguageContext';

interface AdminPersonalitzacioProps {
  language?: 'ca' | 'es';
  onAddLog?: (txt: string) => void;
}

export default function AdminPersonalitzacio({ onAddLog }: AdminPersonalitzacioProps) {
  const { language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'correu' | 'horari' | 'portada'>('correu');

  // Correu states
  const [emailSubjectCa, setEmailSubjectCa] = useState(() => localStorage.getItem('tast_email_subject_ca') || "🎟️ El Tast Comparses 2026 - Confirmació d'Inscripció");
  const [emailSubjectEs, setEmailSubjectEs] = useState(() => localStorage.getItem('tast_email_subject_es') || "🎟️ El Tast Comparses 2026 - Confirmación de Inscripción");
  const [emailBodyCa, setEmailBodyCa] = useState(() => localStorage.getItem('tast_email_body_ca') || "S'ha generat correctament el vostre comprovant per a les comparses 2026.");
  const [emailBodyEs, setEmailBodyEs] = useState(() => localStorage.getItem('tast_email_body_es') || "Se ha generado correctamente vuestro comprobante para las comparsas 2026.");
  const [emailLogo, setEmailLogo] = useState(() => localStorage.getItem('tast_email_logo') || "");

  // Horari states
  const [hoursCa, setHoursCa] = useState(() => localStorage.getItem('tast_secretaria_hours_ca') || "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Cultural El Tast.");
  const [hoursEs, setHoursEs] = useState(() => localStorage.getItem('tast_secretaria_hours_es') || "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social de la Asociación Cultural El Tast.");

  // Event Name & Address States (Unique source of truth)
  const [nomEsdeveniment, setNomEsdeveniment] = useState(() => localStorage.getItem('tast_nom_esdeveniment') || "Carnaval 2027");
  const [direccioEsdeveniment, setDireccioEsdeveniment] = useState(() => localStorage.getItem('tast_direccio_esdeveniment') || "Plaça Soler i Carbonell, 28, Vilanova i la Geltrú");

  const [activeLangTab, setActiveLangTab] = useState<'ca' | 'es'>('ca');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync with Supabase Settings if available
  useEffect(() => {
    async function loadPersonalization() {
      try {
        const { isSupabaseConfigured, getSupabaseSetting } = await import('../supabaseClient');
        if (!isSupabaseConfigured) return;

        const subCa = await getSupabaseSetting('tast_email_subject_ca', '');
        const subEs = await getSupabaseSetting('tast_email_subject_es', '');
        const bdyCa = await getSupabaseSetting('tast_email_body_ca', '');
        const bdyEs = await getSupabaseSetting('tast_email_body_es', '');
        const lg = await getSupabaseSetting('tast_email_logo', '');
        const hrCa = await getSupabaseSetting('tast_secretaria_hours_ca', '');
        const hrEs = await getSupabaseSetting('tast_secretaria_hours_es', '');
        const evName = await getSupabaseSetting('tast_nom_esdeveniment', 'Carnaval 2027');
        const evAddr = await getSupabaseSetting('tast_direccio_esdeveniment', 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú');

        if (subCa) setEmailSubjectCa(subCa);
        if (subEs) setEmailSubjectEs(subEs);
        if (bdyCa) setEmailBodyCa(bdyCa);
        if (bdyEs) setEmailBodyEs(bdyEs);
        if (lg) setEmailLogo(lg);
        if (hrCa) setHoursCa(hrCa);
        if (hrEs) setHoursEs(hrEs);
        if (evName) setNomEsdeveniment(evName);
        if (evAddr) setDireccioEsdeveniment(evAddr);
      } catch (err) {
        console.error("Failed to load personalization from Supabase:", err);
      }
    }
    loadPersonalization();
  }, []);

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

  const handleBlurTranslate = async (
    textToTranslate: string,
    setTargetValue: (val: string) => void,
    targetKey: string,
    sourceLang: 'ca' | 'es',
    targetLang: 'ca' | 'es'
  ) => {
    if (!autoTranslate || !textToTranslate || !textToTranslate.trim()) return;

    setTranslatingFields(prev => ({ ...prev, [targetKey]: true }));
    try {
      const { translateText } = await import('../translateService');
      const translated = await translateText(textToTranslate, sourceLang, targetLang);
      if (translated && translated.trim()) {
        setTargetValue(translated.trim());
      }
    } catch (e) {
      console.error("Auto translation error:", e);
    } finally {
      setTranslatingFields(prev => ({ ...prev, [targetKey]: false }));
    }
  };

  // Drag and drop / File upload states and systems
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
    if (!file.type.startsWith('image/')) {
      alert(language === 'ca' 
        ? "El fitxer ha de ser una imatge." 
        : "El archivo debe ser una imagen."
      );
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) { // 1.5MB to be safe inside LocalStorage
      alert(language === 'ca' 
        ? "La imatge és massa gran (màxim 1.5MB per a un emmagatzematge ràpid i òptim en el navegador)." 
        : "La imagen es demasiado grande (máximo 1.5MB para un almacenamiento rápido y óptimo en el navegador)."
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const logoData = event.target.result as string;
        setEmailLogo(logoData);
        // Save immediately and notify all components/pages
        localStorage.setItem('tast_email_logo', logoData);
        try {
          const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
          if (isSupabaseConfigured) {
            await saveSupabaseSetting('tast_email_logo', logoData);
          }
        } catch (e) {}
        window.dispatchEvent(new Event('hoursConfigChanged'));
        window.dispatchEvent(new Event('localStorage'));
        if (onAddLog) {
          onAddLog(language === 'ca' 
            ? "Mòdul de Personalització: Imatge de logotip actualitzada i aplicada al sistema global." 
            : "Módulo de Personalización: Imagen de logotipo actualizada y aplicada al sistema global."
          );
        }
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

  const handleSaveCorreuIHorari = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('tast_email_subject_ca', emailSubjectCa);
    localStorage.setItem('tast_email_subject_es', emailSubjectEs);
    localStorage.setItem('tast_email_body_ca', emailBodyCa);
    localStorage.setItem('tast_email_body_es', emailBodyEs);
    localStorage.setItem('tast_email_logo', emailLogo);
    localStorage.setItem('tast_secretaria_hours_ca', hoursCa);
    localStorage.setItem('tast_secretaria_hours_es', hoursEs);
    localStorage.setItem('tast_nom_esdeveniment', nomEsdeveniment);
    localStorage.setItem('tast_direccio_esdeveniment', direccioEsdeveniment);

    try {
      const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
      if (isSupabaseConfigured) {
        await saveSupabaseSetting('tast_email_subject_ca', emailSubjectCa);
        await saveSupabaseSetting('tast_email_subject_es', emailSubjectEs);
        await saveSupabaseSetting('tast_email_body_ca', emailBodyCa);
        await saveSupabaseSetting('tast_email_body_es', emailBodyEs);
        await saveSupabaseSetting('tast_email_logo', emailLogo);
        await saveSupabaseSetting('tast_secretaria_hours_ca', hoursCa);
        await saveSupabaseSetting('tast_secretaria_hours_es', hoursEs);
        await saveSupabaseSetting('tast_nom_esdeveniment', nomEsdeveniment);
        await saveSupabaseSetting('tast_direccio_esdeveniment', direccioEsdeveniment);
      }
    } catch (err) {}

    // Dispatch events to let Confirmation & App components refresh state in real-time
    window.dispatchEvent(new Event('hoursConfigChanged'));
    window.dispatchEvent(new Event('eventDataChanged'));
    window.dispatchEvent(new Event('localStorage'));

    setSaveSuccess(true);
    if (onAddLog) {
      onAddLog(language === 'ca' 
        ? "Personalització de text de correu i horaris de secretaria desada amb èxit a Supabase." 
        : "Personalización de texto de correo y horarios de secretaría guardada con éxito en Supabase."
      );
    }
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetCorreuIHorari = async () => {
    if (window.confirm(language === 'ca' 
      ? "Segur que vols restaurar els valors de correu i horaris per defecte?" 
      : "¿Seguro que quieres restaurar los valores de correo y horarios por defecto?")) {
      
      const defSubjectCa = "🎟️ El Tast Comparses 2026 - Confirmació d'Inscripció";
      const defSubjectEs = "🎟️ El Tast Comparses 2026 - Confirmación de Inscripción";
      const defBodyCa = "S'ha generat correctament el vostre comprovant per a les comparses 2026.";
      const defBodyEs = "Se ha generado correctamente vuestro comprobante para las comparsas 2026.";
      const defHoursCa = "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Cultural El Tast.";
      const defHoursEs = "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social de la Asociación Cultural El Tast.";
      const defNomEsdeveniment = "Carnaval 2027";
      const defDireccioEsdeveniment = "Plaça Soler i Carbonell, 28, Vilanova i la Geltrú";

      setEmailSubjectCa(defSubjectCa);
      setEmailSubjectEs(defSubjectEs);
      setEmailBodyCa(defBodyCa);
      setEmailBodyEs(defBodyEs);
      setEmailLogo("");
      setHoursCa(defHoursCa);
      setHoursEs(defHoursEs);
      setNomEsdeveniment(defNomEsdeveniment);
      setDireccioEsdeveniment(defDireccioEsdeveniment);

      localStorage.setItem('tast_email_subject_ca', defSubjectCa);
      localStorage.setItem('tast_email_subject_es', defSubjectEs);
      localStorage.setItem('tast_email_body_ca', defBodyCa);
      localStorage.setItem('tast_email_body_es', defBodyEs);
      localStorage.setItem('tast_email_logo', "");
      localStorage.setItem('tast_secretaria_hours_ca', defHoursCa);
      localStorage.setItem('tast_secretaria_hours_es', defHoursEs);
      localStorage.setItem('tast_nom_esdeveniment', defNomEsdeveniment);
      localStorage.setItem('tast_direccio_esdeveniment', defDireccioEsdeveniment);

      try {
        const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          await saveSupabaseSetting('tast_email_subject_ca', defSubjectCa);
          await saveSupabaseSetting('tast_email_subject_es', defSubjectEs);
          await saveSupabaseSetting('tast_email_body_ca', defBodyCa);
          await saveSupabaseSetting('tast_email_body_es', defBodyEs);
          await saveSupabaseSetting('tast_email_logo', "");
          await saveSupabaseSetting('tast_secretaria_hours_ca', defHoursCa);
          await saveSupabaseSetting('tast_secretaria_hours_es', defHoursEs);
          await saveSupabaseSetting('tast_nom_esdeveniment', defNomEsdeveniment);
          await saveSupabaseSetting('tast_direccio_esdeveniment', defDireccioEsdeveniment);
        }
      } catch (err) {}

      window.dispatchEvent(new Event('hoursConfigChanged'));
      window.dispatchEvent(new Event('eventDataChanged'));
      window.dispatchEvent(new Event('localStorage'));

      if (onAddLog) onAddLog("Valors per defecte restaurats en disc i núvol.");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const currentSubject = language === 'ca' ? emailSubjectCa : emailSubjectEs;
  const currentBody = language === 'ca' ? emailBodyCa : emailBodyEs;
  const currentHours = language === 'ca' ? hoursCa : hoursEs;

  return (
    <div className="space-y-6">
      {/* Top Tabs within customizable board */}
      <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl max-w-lg mb-4">
        <button
          type="button"
          onClick={() => setActiveSubTab('correu')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'correu'
              ? 'bg-[#ff0090] text-white shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Mail size={13} />
          {language === 'ca' ? "Correu Conf." : "Correo Conf."}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('horari')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'horari'
              ? 'bg-[#ff0090] text-white shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Clock size={13} />
          {language === 'ca' ? "Horaris Secr." : "Horarios Secr."}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('portada')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'portada'
              ? 'bg-[#ff0090] text-white shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Compass size={13} />
          {language === 'ca' ? "Portada" : "Portada"}
        </button>
      </div>

      {activeSubTab === 'correu' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-md p-6 sm:p-8 space-y-6 animate-fade-in text-zinc-900">
          <div className="flex items-start gap-4 pb-5 border-b border-zinc-100 justify-between">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-fuchsia-50 text-[#ff0090] rounded-2xl shrink-0">
                <Mail size={22} />
              </div>
              <div className="text-left">
                <h3 className="font-sans font-black text-lg uppercase tracking-tight text-zinc-900">
                  {language === 'ca' ? "Redacció de Correu Electrònic" : "Redacción de Correo Electrónico"}
                </h3>
                <p className="text-xs text-zinc-400 max-w-xl">
                  {language === 'ca'
                    ? "Modifica el títol del correu que reben els participants un cop finalitzen la seva inscripció."
                    : "Modifica el título del correo que reciben los participantes una vez finalizan su inscripción."}
                </p>
              </div>
            </div>

            {/* Language status */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
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

              <div className="bg-zinc-805 bg-[#ff0090] text-white font-mono font-extrabold px-3 py-1.5 rounded-xl text-[9px]">
                {language.toUpperCase()} ACTIU
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveCorreuIHorari} className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            <div className="lg:col-span-6 space-y-5">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5 font-bold flex items-center justify-between">
                  <span>{language === 'ca' ? "Assumpte del Correu *" : "Asunto del Correo *"}</span>
                  {translatingFields['emailSubject'] && <span className="text-[9.5px] text-[#ff0090] font-black animate-pulse lowercase">✨ sincronitzant IA...</span>}
                </label>
                <input
                  type="text"
                  required
                  value={language === 'ca' ? emailSubjectCa : emailSubjectEs}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      setEmailSubjectCa(val);
                    } else {
                      setEmailSubjectEs(val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => setEmailSubjectCa(translated),
                      (translated) => setEmailSubjectEs(translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, emailSubject: loading }))
                    );
                  }}
                  className="w-full bg-white text-zinc-900 border border-zinc-300 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  {language === 'ca' ? "El codi de seguiment s'afegirà al final de l'assumpte automàticament." : "El código de seguimiento se añadirá al final del asunto automáticamente."}
                </span>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5 font-bold flex items-center justify-between">
                  <span>{language === 'ca' ? "Paràgraf de benvinguda opcional *" : "Párrafo de bienvenida opcional *"}</span>
                  {translatingFields['emailBody'] && <span className="text-[9.5px] text-[#ff0090] font-black animate-pulse lowercase">✨ sincronitzant IA...</span>}
                </label>
                <textarea
                  rows={4}
                  required
                  value={language === 'ca' ? emailBodyCa : emailBodyEs}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      setEmailBodyCa(val);
                    } else {
                      setEmailBodyEs(val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => setEmailBodyCa(translated),
                      (translated) => setEmailBodyEs(translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, emailBody: loading }))
                    );
                  }}
                  className="w-full bg-white text-zinc-900 border border-zinc-300 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all leading-relaxed resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5 font-bold">
                  {language === 'ca' ? "Imatge de Logotip Personalitzat (Opcional)" : "Imagen de Logotipo Personalizado (Opcional)"}
                </label>
                
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-4 transition-all text-center flex flex-col items-center justify-center gap-2 cursor-pointer ${
                    isDragging 
                      ? 'border-[#ff0090] bg-fuchsia-50/45' 
                      : emailLogo 
                        ? 'border-emerald-300 bg-emerald-50/10' 
                        : 'border-zinc-250 hover:border-[#ff0090] bg-zinc-50/50'
                  }`}
                >
                  {emailLogo ? (
                    <div className="space-y-2 w-full flex flex-col items-center">
                      <div className="relative group max-w-[160px]">
                        <img 
                          src={emailLogo} 
                          alt="Email custom logo thumbnail" 
                          className="max-h-16 mx-auto object-contain rounded-lg border border-zinc-200 bg-white p-1"
                        />
                      </div>
                      <div className="flex gap-2 justify-center items-center">
                        <span className="text-[10px] text-emerald-600 font-bold font-mono">
                          ✓ {language === 'ca' ? "LOGOTIP CARREGAT" : "LOGOTIPO CARGADO"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmailLogo("");
                            localStorage.setItem('tast_email_logo', "");
                            import('../supabaseClient').then(async (m) => {
                              if (m.isSupabaseConfigured) {
                                await m.saveSupabaseSetting('tast_email_logo', "");
                              }
                            }).catch(err => console.error(err));
                            window.dispatchEvent(new Event('hoursConfigChanged'));
                            window.dispatchEvent(new Event('localStorage'));
                            if (onAddLog) {
                              onAddLog(language === 'ca' 
                                ? "Mòdul de Personalització: Logotip personalitzat eliminat amb èxit." 
                                : "Módulo de Personalización: Logotipo personalizado eliminado con éxito."
                              );
                            }
                          }}
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                          title={language === 'ca' ? "Eliminar imatge" : "Eliminar imagen"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 flex flex-col items-center">
                      <Upload size={24} className="text-zinc-400 mb-1.5" />
                      <p className="text-xs font-bold text-zinc-700">
                        {language === 'ca' ? "Arrossegueu una imatge aquí o feu clic a sota" : "Arrastrad una imagen aquí o haced clic abajo"}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        PNG, JPG, SVG, GIF ({language === 'ca' ? "màx. 1.5MB" : "máx. 1.5MB"})
                      </p>
                    </div>
                  )}
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="email-logo-file-picker"
                  />
                  {!emailLogo && (
                    <label 
                      htmlFor="email-logo-file-picker" 
                      className="inline-block mt-1 px-3.5 py-2 bg-zinc-900 text-white text-[10px] font-black rounded-xl cursor-pointer hover:bg-zinc-800 transition"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {language === 'ca' ? "Seleccionar Fitxer" : "Seleccionar Archivo"}
                    </label>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 mt-2 block">
                  {language === 'ca' 
                    ? "Aquesta imatge substituirà el logotip oficial de 'El Tast' al correu de confirmació." 
                    : "Esta imagen sustituirá al logotipo oficial de 'El Tast' en el correo de confirmación."}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="submit"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black px-5 py-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save size={14} />
                  {language === 'ca' ? "Desar Canvis" : "Guardar Cambios"}
                </button>
                <button
                  type="button"
                  onClick={handleResetCorreuIHorari}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-650 text-xs font-bold px-4 py-3 rounded-xl transition cursor-pointer"
                >
                  {language === 'ca' ? "Valors per Defecte" : "Valores por Defecto"}
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  {language === 'ca' ? "Configuració del correu actualitzada amb èxit!" : "¡Configuración de correo actualizada con éxito!"}
                </div>
              )}
            </div>

            {/* Right side: Email visual mockup */}
            <div className="lg:col-span-6 bg-zinc-105 border border-zinc-200 rounded-3xl p-5 space-y-4">
              <h4 className="font-sans font-bold text-xs text-zinc-600 uppercase tracking-widest flex items-center gap-1 pb-1.5 border-b border-zinc-200">
                <Inbox size={13} className="text-[#ff0090]" />
                {language === 'ca' ? "Previsualizació correu electrònic oficial" : "Previsualización correo electrónico oficial"}
              </h4>

              <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white text-zinc-900 shadow-sm">
                <div className="bg-zinc-50 px-4 py-1.5 border-b border-zinc-200/70 flex items-center justify-between">
                  <span className="text-[8px] font-mono text-zinc-400">Assumpte / Asunto: {currentSubject} [CODI-2026]</span>
                </div>
                <div className="p-5 space-y-4 font-sans text-[11px] text-zinc-700 max-w-sm mx-auto">
                  <div className="text-center pb-2 border-b border-zinc-100 flex items-center justify-center gap-1 flex-col min-h-[48px]">
                    {emailLogo ? (
                      <div className="py-1">
                        <img 
                          src={emailLogo} 
                          alt="Custom Logo" 
                          className="max-h-12 max-w-[140px] object-contain mx-auto rounded"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-fuchsia-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                          T
                        </div>
                        <span className="font-black text-[10px] text-zinc-900 mt-1">EL TAST VILANOVA</span>
                      </>
                    )}
                  </div>

                  <p className="font-black text-zinc-900 text-center">{language === 'ca' ? "Hola, Joana i Pere!" : "¡Hola, Joana y Pere!"}</p>
                  <p className="text-center text-[10.5px] text-zinc-500 leading-relaxed leading-normal">{currentBody}</p>

                  <div className="bg-zinc-50 border border-dashed border-fuchsia-450 p-3 rounded-xl text-center">
                    <span className="block text-[8px] font-mono text-zinc-400 uppercase">CODI SEGUIMENT</span>
                    <span className="text-sm font-mono font-black text-fuchsia-600">TAST-2026-X84B</span>
                  </div>

                  <div className="text-center text-[7.5px] text-zinc-400 pt-2 border-t border-zinc-100 leading-tight">
                    <p className="font-bold">Secretaria General de l'Associació Cultural El Tast</p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'horari' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-md p-6 sm:p-8 space-y-6 animate-fade-in text-zinc-900">
          <div className="flex items-start gap-4 pb-5 border-b border-zinc-100 justify-between">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-fuchsia-50 text-[#ff0090] rounded-2xl shrink-0">
                <Clock size={22} />
              </div>
              <div className="text-left">
                <h3 className="font-sans font-black text-lg uppercase tracking-tight text-zinc-900">
                  {language === 'ca' ? "Horaris d'Atenció de Secretaria" : "Horarios de Atención de Secretaría"}
                </h3>
                <p className="text-xs text-zinc-400 max-w-xl">
                  {language === 'ca'
                    ? "Determina la informació d'horaris presencials que es mostra públicament a l'usuari final al costat del formulari de registre."
                    : "Determina la información de horarios presenciales que se muestra públicamente al usuario final junto al formulario de registro."}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveCorreuIHorari} className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            <div className="lg:col-span-6 space-y-5">
              {/* Event Name Input */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5 font-bold flex items-center justify-between">
                  <span>{language === 'ca' ? "Nom de l'Esdeveniment (Font Única de Veritat):" : "Nombre del Evento (Fuente Única de Verdad):"}</span>
                </label>
                <input
                  type="text"
                  required
                  value={nomEsdeveniment}
                  onChange={(e) => setNomEsdeveniment(e.target.value)}
                  className="w-full bg-white text-zinc-900 border border-zinc-300 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  placeholder="Ex: Carnaval 2027 o Comparses 2026"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  {language === 'ca' 
                    ? "Controla el nom de l'esdeveniment i l'any de forma global a tot l'aplicatiu." 
                    : "Controla el nombre del evento y el año de forma global en toda la aplicación."}
                </span>
              </div>

              {/* Event/Secretariat Address Input */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5 font-bold flex items-center justify-between">
                  <span>{language === 'ca' ? "Adreça Oficial de Secretaria" : "Dirección Oficial de Secretaría"}</span>
                </label>
                <input
                  type="text"
                  required
                  value={direccioEsdeveniment}
                  onChange={(e) => setDireccioEsdeveniment(e.target.value)}
                  className="w-full bg-white text-zinc-900 border border-zinc-300 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  placeholder="Ex: Plaça Soler i Carbonell, 28, Vilanova i la Geltrú"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  {language === 'ca' 
                    ? "S'inclourà al peu del rebut de confirmació i al correu electrònic." 
                    : "Se incluirá en el pie del recibo de confirmación y en el correo electrónico."}
                </span>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5 font-bold flex items-center justify-between">
                  <span>{language === 'ca' ? "Horaris d'Atenció de Secretaria *" : "Horario de Atención de Secretaría *"}</span>
                  {translatingFields['hours'] && <span className="text-[9.5px] text-[#ff0090] font-black animate-pulse lowercase">✨ sincronitzant IA...</span>}
                </label>
                <textarea
                  rows={4}
                  required
                  value={language === 'ca' ? hoursCa : hoursEs}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'ca') {
                      setHoursCa(val);
                    } else {
                      setHoursEs(val);
                    }
                  }}
                  onBlur={async (e) => {
                    if (!autoTranslate) return;
                    const val = e.target.value;
                    const { syncDetectAndTranslate } = await import('../translateService');
                    syncDetectAndTranslate(
                      val,
                      (translated) => setHoursCa(translated),
                      (translated) => setHoursEs(translated),
                      (loading) => setTranslatingFields(prev => ({ ...prev, hours: loading }))
                    );
                  }}
                  className="w-full bg-white text-zinc-900 border border-zinc-300 focus:border-[#ff0090] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all leading-relaxed resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="submit"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black px-5 py-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save size={14} />
                  {language === 'ca' ? "Desar Canvis" : "Guardar Cambios"}
                </button>
                <button
                  type="button"
                  onClick={handleResetCorreuIHorari}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-650 text-xs font-bold px-4 py-3 rounded-xl transition cursor-pointer"
                >
                  {language === 'ca' ? "Valors per Defecte" : "Valores por Defecto"}
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  {language === 'ca' ? "Horari de secretaria guardat correctament!" : "¡Horario de secretaría guardado correctamente!"}
                </div>
              )}
            </div>

            {/* Right side: Public Hours preview block */}
            <div className="lg:col-span-6 bg-zinc-105 border border-zinc-200 rounded-3xl p-5 space-y-4">
              <h4 className="font-sans font-bold text-xs text-zinc-650 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-zinc-200">
                <Clock size={13} className="text-[#ff0090]" />
                {language === 'ca' ? "L'usuari ho veurà així (CAT / ESP):" : "El usuario lo verá así (CAT / ESP):"}
              </h4>

              <div className="bg-zinc-950 rounded-2xl p-5 border border-white/5 space-y-3.5 text-white max-w-sm mx-auto text-left">
                <h5 className="font-sans font-bold text-[10.5px] text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={13} className="text-fuchsia-500" />
                  {language === 'ca' ? "Horaris de secretaria:" : "Horarios de secretaría:"}
                </h5>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  {language === 'ca' ? hoursCa : hoursEs}
                </p>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-zinc-550 font-mono">
                  <span>{language === 'ca' ? "Secció de Informació Pública" : "Sección de Información Pública"}</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'portada' && (
        <AdminPortada onAddLog={onAddLog} />
      )}
    </div>
  );
}
