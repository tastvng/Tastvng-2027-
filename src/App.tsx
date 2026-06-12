/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ShieldCheck, 
  Volume2, 
  HelpCircle,
  Megaphone,
  Facebook,
  Instagram,
  Terminal,
  Clock
} from 'lucide-react';

import { 
  Inscripcio, 
  SistemaConfig, 
  NoticiaXarxes
} from './types';

import { CONFIG_INICIAL } from './data';
import { supabase } from './lib/supabase';
import { useLanguage } from './LanguageContext';

// Component imports
import PublicForm from './components/PublicForm';
import Confirmation from './components/Confirmation';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import AdminFicha from './components/AdminFicha';
import AdminConfig from './components/AdminConfig';
import AdminScanner from './components/AdminScanner';
import NotificationFeed from './components/NotificationFeed';
import MobileRemoteScanner from './components/MobileRemoteScanner';

export default function App() {
  const { language, setLanguage, t } = useLanguage();

  // Navigation Routing States
  const [view, setView] = useState<string>('landing');
  const [mobileScannerSyncKey, setMobileScannerSyncKey] = useState<string | null>(null);

  // Persistence States
  const [config, setConfig] = useState<SistemaConfig>(CONFIG_INICIAL);
  const [inscripcions, setInscripcions] = useState<Inscripcio[]>([]);
  const [noticies, setNoticies] = useState<NoticiaXarxes[]>([]);
  const [activeRegistration, setActiveRegistration] = useState<Inscripcio | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  const [operationLogs, setOperationLogs] = useState<string[]>([]);
  const [staffCount, setStaffCount] = useState<number>(0);

  useEffect(() => {
    setOperationLogs([
      language === 'ca' ? "Sistema de gestió El Tast inicialitzat correctament." : "Sistema de gestión El Tast inicializado correctamente.",
      language === 'ca' ? "Sincronitzant amb la base de dades..." : "Sincronizando con la base de datos..."
    ]);
  }, [language]);

  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString('ca-ES');
    setOperationLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 4)]);
  };

  // Carga inicial conectada a las tablas reales de Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Cargar Configuración (settings)
        const { data: configData, error: configError } = await supabase.from('settings').select('*').eq('key', 'config').single();
        
        if (configData && configData.value) {
          setConfig({ ...CONFIG_INICIAL, ...configData.value });
        } else {
          setConfig(CONFIG_INICIAL);
        }

        // 2. Cargar Inscripciones (tabla: inscripciones)
        const { data: insData, error: insError } = await supabase.from('inscripciones').select('*').order('creadoEn', { ascending: false });
        if (insData) {
          const parsedInsData = insData.map((ins: any) => ({
            ...ins,
            respostesCuestionari: ins.respostesCuestionari || {},
            seleccionsUniforme: ins.seleccionsUniforme || undefined
          }));
          setInscripcions(parsedInsData);
        } else if (insError) {
          console.error("Error cargando inscripciones:", insError);
        }

        // 3. Cargar Noticias
        const { data: notData } = await supabase.from('noticies_xarxes').select('*');
        if (notData) {
          setNoticies(notData);
        }

        // 4. Cargar Staff
        const { count } = await supabase.from('staff').select('*', { count: 'exact', head: true });
        setStaffCount(count || 0);

      } catch (error) {
        console.error("Error general de carga:", error);
        addLog("Error carregant dades de Supabase.");
      }
    };

    loadData();

    const savedLogin = localStorage.getItem('tast_admin_session_2026');
    if (savedLogin === 'true') {
      setIsAdminLoggedIn(true);
    }
  }, []);

  const saveConfig = async (newConfig: SistemaConfig) => { 
    setConfig(newConfig); 
    try { 
      const { error } = await supabase.from('settings').upsert({ key: 'config', value: newConfig }); 
      if (error) throw error; 
      addLog("Configuració desada correctament."); 
    } catch (e) { 
      console.error("Error saving config:", e); 
      addLog("Error al desar la configuració."); 
    } 
  };

  const addRegistration = async (newReg: Inscripcio) => { 
    const updated = [newReg, ...inscripcions]; 
    setInscripcions(updated); 
    setActiveRegistration(newReg); 
    setView('confirmacio'); 
    try { 
      await supabase.from('inscripciones').insert(newReg); 
      addLog(`Preinscripció OK: ${newReg.c1Nom} & ${newReg.c2Nom}.`); 
    } catch (e) { 
      addLog("Error en registrar la preinscripció a la base de dades."); 
    } 
  };

  const addRegistrationManual = async (newReg: Inscripcio) => { 
    const updated = [newReg, ...inscripcions]; 
    setInscripcions(updated); 
    try { 
      await supabase.from('inscripciones').insert(newReg); 
      addLog(`Parella afegida manualment: ${newReg.c1Nom}.`); 
    } catch (e) { 
      addLog("Error en afegir manualment."); 
    } 
  };

  const deleteRegistration = async (id: string) => { 
    const updated = inscripcions.filter(i => i.id !== id); 
    setInscripcions(updated); 
    try { 
      await supabase.from('inscripciones').delete().eq('id', id); 
      addLog(`Inscripció eliminada.`); 
    } catch (e) { 
      addLog("Error en eliminar la inscripció."); 
    } 
  };

  const deleteMultipleRegistrations = async (ids: string[]) => { 
    const updated = inscripcions.filter(i => !ids.includes(i.id)); 
    setInscripcions(updated); 
    try { 
      await supabase.from('inscripciones').delete().in('id', ids); 
      addLog(`S'han eliminat les inscripcions seleccionades.`); 
    } catch (e) { 
      addLog("Error en l'eliminació massiva."); 
    } 
  };

  const clearAllRegistrations = async () => { 
    setInscripcions([]); 
    try { 
      const allIds = inscripcions.map(i => i.id); 
      if (allIds.length > 0) { 
        await supabase.from('inscripciones').delete().in('id', allIds); 
      } 
      addLog(`Base de dades d'inscripcions buidada.`); 
    } catch (e) { 
      addLog("Error en buidar la base de dades."); 
    } 
  };

  const saveNoticies = async (newNoticies: NoticiaXarxes[]) => { 
    setNoticies(newNoticies); 
    try { 
      const { data: existing } = await supabase.from('noticies_xarxes').select('id'); 
      if (existing && existing.length > 0) { 
        await supabase.from('noticies_xarxes').delete().in('id', existing.map(e => e.id)); 
      } 
      if (newNoticies.length > 0) { 
        await supabase.from('noticies_xarxes').insert(newNoticies); 
      } 
      addLog("S'han actualitzat les notícies."); 
    } catch (e) { 
      addLog("Error al actualitzar les notícies."); 
    } 
  };

  const updateRegistration = async (updatedReg: Inscripcio) => { 
    const updated = inscripcions.map(i => i.id === updatedReg.id ? updatedReg : i); 
    setInscripcions(updated); 
    try { 
      await supabase.from('inscripciones').update(updatedReg).eq('id', updatedReg.id); 
      addLog(`Ficha actualitzada: ${updatedReg.c1Nom}`); 
    } catch (e) { 
      addLog("Error en actualitzar la inscripció."); 
    } 
  };

  const handleAdminLogin = () => { 
    setIsAdminLoggedIn(true); 
    localStorage.setItem('tast_admin_session_2026', 'true'); 
    setView('admin-dashboard'); 
  };

  const handleAdminLogout = () => { 
    setIsAdminLoggedIn(false); 
    localStorage.setItem('tast_admin_session_2026', 'false'); 
    setView('landing'); 
  };

  // Variables de diseño vinculadas al panel de control dinámico
  const logoText = config.logoText || 'T'; 
  const titolPrincipal = config.titolPrincipal || 'EL TAST'; 
  const titolSecundari = config.titolSecundari || 'VILANOVA'; 
  const subtitol = config.subtitol || 'Vilanova i la Geltrú 2026'; 
  const logoColor = config.logoColor || '#ff0090';

  const bgImage = (config as any).portadaImatge || (config as any).fonsImatge || (config as any).bgImage || (config as any).portadaImatgeFons || '';
  const landingTitle = (config as any).portadaTitol || (config as any).titolPortada || titolPrincipal;
  const landingSubtitle = (config as any).portadaSubtitol || (config as any).subtitolPortada || subtitol;
  const landingDesc = (config as any).portadaDescripcio || (config as any).descripcioPortada || '';
  const landingBtnText = (config as any).portadaTextBoto || (config as any).textBotoPortada || (language === 'ca' ? 'Inscripció en línia' : 'Inscripción en línea');
  const landingBadge = (config as any).portadaBadge || (config as any).badgePortada || '';

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col justify-between selection:bg-brand selection:text-white" id="app-root-container">
      <header className="bg-dark-card text-white py-4 px-6 border-b border-white/10 flex justify-between items-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: logoColor }} />
        
        <div className="flex items-center gap-2.5">
          {config.logoUseImage && config.logoImgUrl ? (
            <img src={config.logoImgUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-black text-lg uppercase transition-all shrink-0" style={{ backgroundColor: logoColor, boxShadow: `0 4px 12px ${logoColor}40` }}>
              {logoText}
            </div>
          )}
          <div>
            <h1 className="font-sans font-black text-sm md:text-base leading-none text-white tracking-tight">
              {titolPrincipal} <span style={{ color: logoColor }}>{titolSecundari}</span>
            </h1>
            <p className="font-mono text-[9px] text-zinc-500 tracking-widest font-semibold uppercase mt-0.5">{subtitol}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 shrink-0">
            <button onClick={() => setLanguage('ca')} className={`text-[9px] font-sans font-black px-2 py-1 rounded-lg ${language === 'ca' ? 'bg-[#ff0090] text-white' : 'text-zinc-400'}`}>CAT</button>
            <button onClick={() => setLanguage('es')} className={`text-[9px] font-sans font-black px-2 py-1 rounded-lg ${language === 'es' ? 'bg-[#ff0090] text-white' : 'text-zinc-400'}`}>ESP</button>
          </div>

          {isAdminLoggedIn ? (
            <button onClick={() => setView('admin-dashboard')} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 font-bold px-3 py-2 rounded-xl">
              {t('admin_panel')}
            </button>
          ) : (
            <button onClick={() => setView('login')} className="text-xs bg-white/5 hover:bg-white/10 text-zinc-350 font-bold px-3.5 py-2 rounded-xl border border-white/10 font-mono">
              {t('secretary')}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 relative">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="w-full">
            
            {view === 'landing' && (
              <div 
                className="relative flex flex-col items-center justify-center text-center py-20 px-4 min-h-[75vh] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
                style={{
                  backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#121212'
                }}
              >
                <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"></div>
                <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center">
                  {landingBadge && (
                    <div className="mb-6 px-5 py-2 bg-[#ff0090]/20 border border-[#ff0090]/50 text-[#ff0090] text-xs font-bold uppercase tracking-widest rounded-full flex items-center gap-2">
                      <Sparkles size={16} /> {landingBadge}
                    </div>
                  )}
                  <h1 className="font-sans font-black text-5xl md:text-7xl text-white tracking-tight mb-6 drop-shadow-2xl">
                    {landingTitle}
                  </h1>
                  {landingSubtitle && (
                    <h2 className="text-zinc-300 font-bold uppercase tracking-widest text-sm md:text-lg mb-8 drop-shadow-md">
                      {landingSubtitle}
                    </h2>
                  )}
                  {landingDesc && (
                    <p className="text-zinc-200 text-base md:text-xl max-w-3xl mx-auto mb-12 drop-shadow-lg leading-relaxed">
                      {landingDesc}
                    </p>
                  )}
                  <button
                    onClick={() => setView('public')}
                    className="w-full md:w-auto text-white font-black text-lg md:text-xl px-12 py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer uppercase tracking-widest hover:scale-105"
                    style={{ backgroundColor: logoColor, boxShadow: `0 10px 25px -5px ${logoColor}60` }}
                  >
                    <Sparkles size={24} /> {landingBtnText}
                  </button>
                </div>
              </div>
            )}

            {view === 'public' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <PublicForm config={config} onSubmit={addRegistration} onGoToLogin={() => setView('login')} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                  <NotificationFeed onAddLog={addLog} noticies={noticies} />
                  <div className="bg-dark-card rounded-3xl p-6 border border-white/10 shadow-lg space-y-4">
                    <h4 className="font-sans font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={14} className="text-brand" /> {language === 'ca' ? 'Horaris de secretaria:' : 'Horarios de secretaría:'}
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {language === 'ca' ? "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social." : "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {view === 'confirmacio' && activeRegistration && (
              <Confirmation registration={activeRegistration} onClear={() => { setActiveRegistration(null); setView('landing'); }} />
            )}

            {view === 'login' && (
              <AdminLogin Honour-Sync onLoginSuccess={handleAdminLogin} onBackToPublic={() => setView('landing')} />
            )}

            {view === 'admin-dashboard' && (
              <AdminDashboard 
                inscripcions={inscripcions} config={config}
                onSelectInscripcio={(id) => { setEditId(id); setView('admin-ficha'); }}
                onGoToScanner={() => setView('admin-scanner')} onGoToConfig={() => setView('admin-config')}
                onLogout={handleAdminLogout} onAddLog={addLog} onDeleteInscripcio={deleteRegistration}
                onDeleteMultipleInscripcions={deleteMultipleRegistrations} onClearAllInscripcions={clearAllRegistrations}
                onAddInscripcioManual={addRegistrationManual}
              />
            )}

            {view === 'admin-ficha' && editId && (
              <AdminFicha registration={inscripcions.find(i => i.id === editId)!} config={config} onBack={() => { setEditId(null); setView('admin-dashboard'); }} onSave={updateRegistration} />
            )}

            {view === 'admin-config' && (
              <AdminConfig config={config} onBack={() => setView('admin-dashboard')} onSave={saveConfig} noticies={noticies} onSaveNoticies={saveNoticies} />
            )}

            {view === 'admin-scanner' && (
              <AdminScanner inscripcions={inscripcions} onSelectInscripcio={(id) => { setEditId(id); setView('admin-ficha'); }} onBack={() => setView('admin-dashboard')} onAddLog={addLog} onSaveInscripcio={updateRegistration} />
            )}

            {view === 'mobile-scanner' && mobileScannerSyncKey && (
              <MobileRemoteScanner syncKey={mobileScannerSyncKey} inscripcions={inscripcions} onBack={() => { window.history.pushState({}, '', window.location.pathname); setView('landing'); }} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-zinc-950 py-6 px-8 text-center text-white border-t border-zinc-900 mt-12">
        <p className="font-sans font-black text-xs tracking-tight text-white uppercase">
          ASSOCIACIÓ CULTURAL EL TAST • LES COMPARSES DE VILANOVA
        </p>
      </footer>
    </div>
  ); 
}
