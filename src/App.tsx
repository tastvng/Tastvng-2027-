/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ShieldCheck, 
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
  const [config, setConfig] = useState<any>(CONFIG_INICIAL);
  const [inscripcions, setInscripcions] = useState<Inscripcio[]>([]);
  const [noticies, setNoticies] = useState<NoticiaXarxes[]>([]);
  const [activeRegistration, setActiveRegistration] = useState<Inscripcio | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  const [operationLogs, setOperationLogs] = useState<string[]>([]);
  const [staffCount, setStaffCount] = useState<number>(0);

  useEffect(() => {
    setOperationLogs([
      language === 'ca' ? "Sistema de gestió El Tast inicialitzat." : "Sistema de gestión El Tast inicializado.",
      language === 'ca' ? "Sincronitzant dades del servidor..." : "Sincronizando datos del servidor..."
    ]);
  }, [language]);

  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString('ca-ES');
    setOperationLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 4)]);
  };

  // Carga paralela de contingencia absoluta de configuración
  useEffect(() => {
    const loadData = async () => {
      try {
        let remotoConfig: any = null;

        // Intentar leer de 'settings'
        try {
          const { data: sData } = await supabase.from('settings').select('*').eq('key', 'config').single();
          if (sData && sData.value) remotoConfig = sData.value;
        } catch (e) { console.log("Settings no cargado", e); }

        // Si falla, intentar leer de 'sistema_config' por si acaso
        if (!remotoConfig) {
          try {
            const { data: scData } = await supabase.from('sistema_config').select('*').limit(1).single();
            if (scData) remotoConfig = scData.value || scData;
          } catch (e) { console.log("Sistema_config no cargado", e); }
        }

        if (remotoConfig) {
          setConfig({ ...CONFIG_INICIAL, ...remotoConfig });
        } else {
          setConfig(CONFIG_INICIAL);
        }

        // Cargar Inscripciones reales (tabla: inscripciones)
        const { data: insData } = await supabase.from('inscripciones').select('*').order('creadoEn', { ascending: false });
        if (insData) {
          setInscripcions(insData.map((ins: any) => ({
            ...ins,
            respostesCuestionari: ins.respostesCuestionari || {},
            seleccionsUniforme: ins.seleccionsUniforme || undefined
          })));
        }

        // Cargar Noticias
        const { data: notData } = await supabase.from('noticies_xarxes').select('*');
        if (notData) setNoticies(notData);

        // Cargar Staff count
        const { count } = await supabase.from('staff').select('*', { count: 'exact', head: true });
        setStaffCount(count || 0);

      } catch (error) {
        console.error("Error cargando datos:", error);
      }
    };

    loadData();

    if (localStorage.getItem('tast_admin_session_2026') === 'true') {
      setIsAdminLoggedIn(true);
    }
  }, []);

  const saveConfig = async (newConfig: any) => { 
    setConfig(newConfig); 
    try { 
      // Guardar de forma masiva en ambas tablas posibles para blindar el guardado
      await supabase.from('settings').upsert({ key: 'config', value: newConfig }); 
      try {
        await supabase.from('sistema_config').upsert({ id: 1, value: newConfig, ...newConfig });
      } catch(ee){}
      addLog("Configuració desada amb èxit."); 
    } catch (e) { 
      addLog("Error al desar la configuració."); 
    } 
  };

  const addRegistration = async (newReg: Inscripcio) => { 
    setInscripcions([newReg, ...inscripcions]); 
    setActiveRegistration(newReg); 
    setView('confirmacio'); 
    try { await supabase.from('inscripciones').insert(newReg); } catch (e) {} 
  };

  const addRegistrationManual = async (newReg: Inscripcio) => { 
    setInscripcions([newReg, ...inscripcions]); 
    try { await supabase.from('inscripciones').insert(newReg); } catch (e) {} 
  };

  const deleteRegistration = async (id: string) => { 
    setInscripcions(inscripcions.filter(i => i.id !== id)); 
    try { await supabase.from('inscripciones').delete().eq('id', id); } catch (e) {} 
  };

  const deleteMultipleRegistrations = async (ids: string[]) => { 
    setInscripcions(inscripcions.filter(i => !ids.includes(i.id))); 
    try { await supabase.from('inscripciones').delete().in('id', ids); } catch (e) {} 
  };

  const clearAllRegistrations = async () => { 
    setInscripcions([]); 
    try { await supabase.from('inscripciones').delete().in('id', inscripcions.map(i => i.id)); } catch (e) {} 
  };

  const saveNoticies = async (newNoticies: NoticiaXarxes[]) => { 
    setNoticies(newNoticies); 
    try { 
      const { data: ex } = await supabase.from('noticies_xarxes').select('id'); 
      if (ex && ex.length > 0) await supabase.from('noticies_xarxes').delete().in('id', ex.map(e => e.id)); 
      if (newNoticies.length > 0) await supabase.from('noticies_xarxes').insert(newNoticies); 
    } catch (e) {} 
  };

  const updateRegistration = async (updatedReg: Inscripcio) => { 
    setInscripcions(inscripcions.map(i => i.id === updatedReg.id ? updatedReg : i)); 
    try { await supabase.from('inscripciones').update(updatedReg).eq('id', updatedReg.id); } catch (e) {} 
  };

  // Mapeo Inteligente Definitivo de Variables (Soporta múltiples nomenclaturas de la base de datos)
  const logoText = config.logoText || config.logo_text || 'T'; 
  const titolPrincipal = config.titolPrincipal || config.titol_principal || 'EL TAST'; 
  const titolSecundari = config.titolSecundari || config.titol_secundari || 'VILANOVA'; 
  const subtitol = config.subtitol || 'Vilanova i la Geltrú 2026'; 
  const logoColor = config.logoColor || config.logo_color || '#ff0090';

  // Buscar el título de la portada en cualquier campo posible
  const landingTitle = config.portadaTitol || config.portada_titol || config.titolPortada || config.titol_portada || "Inscripcions Comparses El Tast 2027";
  const landingSubtitle = config.portadaSubtitol || config.portada_subtitol || config.subtitolPortada || config.subtitol_portada || "Bienvenidos al espacio de registro oficial del Tast";
  const landingDesc = config.portadaDescripcio || config.portada_descripcio || config.descripcioPortada || config.descripcio_portada || "Enguany us presentem un qüestionari àgil i integrat amb el nostre sistema de secretaria digital de l'Asociación Cultural El Tast.";
  const landingBtnText = config.portadaTextBoto || config.portada_text_boto || config.textBotoPortada || (language === 'ca' ? 'Inscripció en línia' : 'Inscripción en línea');
  const landingBadge = config.portadaBadge || config.portada_badge || config.badgePortada || "Inscripcions Obertes 2026";
  const bgImage = config.portadaImatge || config.portada_imatge || config.fonsImatge || config.fons_imatge || config.portadaImatgeFons || '';

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col justify-between" id="app-root-container">
      <header className="bg-dark-card text-white py-4 px-6 border-b border-white/10 flex justify-between items-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: logoColor }} />
        
        <div className="flex items-center gap-2.5">
          {config.logoUseImage && config.logoImgUrl ? (
            <img src={config.logoImgUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
          ) : (
            <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-black text-lg uppercase transition-all" style={{ backgroundColor: logoColor }}>
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
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
            <button onClick={() => setLanguage('ca')} className={`text-[9px] font-sans font-black px-2 py-1 rounded-lg ${language === 'ca' ? 'bg-[#ff0090] text-white' : 'text-zinc-400'}`}>CAT</button>
            <button onClick={() => setLanguage('es')} className={`text-[9px] font-sans font-black px-2 py-1 rounded-lg ${language === 'es' ? 'bg-[#ff0090] text-white' : 'text-zinc-400'}`}>ESP</button>
          </div>

          {isAdminLoggedIn ? (
            <button onClick={() => setView('admin-dashboard')} className="text-xs bg-white/5 border border-white/10 text-zinc-200 font-bold px-3 py-2 rounded-xl">
              {t('admin_panel')}
            </button>
          ) : (
            <button onClick={() => setView('login')} className="text-xs bg-white/5 text-zinc-350 font-bold px-3.5 py-2 rounded-xl border border-white/10 font-mono">
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
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"></div>
                
                <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center">
                  {landingBadge && (
                    <div className="mb-6 px-5 py-2 bg-[#ff0090]/20 border border-[#ff0090]/50 text-[#ff0090] text-xs font-bold uppercase tracking-widest rounded-full flex items-center gap-2">
                      <Sparkles size={16} /> {landingBadge}
                    </div>
                  )}
                  <h1 className="font-sans font-black text-4xl md:text-6xl text-white tracking-tight mb-6 max-w-3xl leading-tight">
                    {landingTitle}
                  </h1>
                  {landingSubtitle && (
                    <h2 className="text-zinc-300 font-bold uppercase tracking-widest text-xs md:text-sm mb-8">
                      {landingSubtitle}
                    </h2>
                  )}
                  {landingDesc && (
                    <p className="text-zinc-300 text-sm md:text-base max-w-2xl mx-auto mb-12 leading-relaxed">
                      {landingDesc}
                    </p>
                  )}
                  <button
                    onClick={() => setView('public')}
                    className="w-full md:w-auto text-white font-black text-base px-10 py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest hover:scale-102"
                    style={{ backgroundColor: logoColor }}
                  >
                    <Sparkles size={20} /> {landingBtnText}
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
                      Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {view === 'confirmacio' && activeRegistration && (
              <Confirmation registration={activeRegistration} onClear={() => { setActiveRegistration(null); setView('landing'); }} />
            )}

            {view === 'login' && (
              <AdminLogin onLoginSuccess={() => { setIsAdminLoggedIn(true); localStorage.setItem('tast_admin_session_2026', 'true'); setView('admin-dashboard'); }} onBackToPublic={() => setView('landing')} />
            )}

            {view === 'admin-dashboard' && (
              <AdminDashboard 
                inscripcions={inscripcions} config={config}
                onSelectInscripcio={(id) => { setEditId(id); setView('admin-ficha'); }}
                onGoToScanner={() => setView('admin-scanner')} onGoToConfig={() => setView('admin-config')}
                onLogout={() => { setIsAdminLoggedIn(false); localStorage.setItem('tast_admin_session_2026', 'false'); setView('landing'); }} 
                onAddLog={addLog} onDeleteInscripcio={deleteRegistration}
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
