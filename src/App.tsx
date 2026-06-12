/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ShieldCheck, 
  Compass, 
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
  CategoriaParella, 
  EstatPagament, 
  EstatVerificacio, 
  EstatInscripcio,
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
  const [view, setView] = useState<string>('public');
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

  // Load state from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load Config
        const { data: configData, error: configError } = await supabase.from('settings').select('*').eq('key', 'config').single();
        if (configData && configData.value) {
          setConfig(configData.value);
        } else if (configError && configError.code !== 'PGRST116') {
          console.error("Error loading config:", configError);
        }

        // Load Inscripcions
        const { data: insData } = await supabase.from('inscripcions').select('*').order('creadoEn', { ascending: false });
        if (insData) {
          // parse jsonb fields
          const parsedInsData = insData.map((ins: any) => ({
            ...ins,
            respostesCuestionari: ins.respostesCuestionari || {},
            seleccionsUniforme: ins.seleccionsUniforme || undefined
          }));
          setInscripcions(parsedInsData);
        }

        // Load Noticies
        const { data: notData } = await supabase.from('noticies_xarxes').select('*');
        if (notData) {
          setNoticies(notData);
        }

        // Load Staff count
        const { count } = await supabase.from('staff').select('*', { count: 'exact', head: true });
        setStaffCount(count || 0);

      } catch (error) {
        console.error("Error loading data from Supabase", error);
        addLog("Error carregant dades. Revisa la connexió.");
      }
    };

    loadData();

    // Check for mobile remote scanner sync request
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const syncKey = params.get('syncKey');
      if (mode === 'mobile-scanner' && syncKey) {
        setMobileScannerSyncKey(syncKey);
        setView('mobile-scanner');
        addLog(`S'ha iniciat el terminal mòbil d'escaneig síncron amb la clau: ${syncKey}`);
      }
    } catch (e) {
      console.error("Error parsing query params", e);
    }

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
      addLog("S'han modificat les tarifes i config.");
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
      await supabase.from('inscripcions').insert(newReg);
      addLog(`Preinscripció realitzada amb èxit per a: ${newReg.c1Nom} & ${newReg.c2Nom}. Codi: ${newReg.codiSeguiment}`);
    } catch (e) {
      addLog("Error en registrar la preinscripció.");
    }
  };

  const addRegistrationManual = async (newReg: Inscripcio) => {
    const updated = [newReg, ...inscripcions];
    setInscripcions(updated);
    try {
      await supabase.from('inscripcions').insert(newReg);
      addLog(`Parella afegida manualment des del taulell: ${newReg.c1Nom} & ${newReg.c2Nom}. Codi: ${newReg.codiSeguiment}`);
    } catch (e) {
      addLog("Error en afegir manualment.");
    }
  };

  const deleteRegistration = async (id: string) => {
    const itemToDelete = inscripcions.find(i => i.id === id);
    const updated = inscripcions.filter(i => i.id !== id);
    setInscripcions(updated);
    try {
      await supabase.from('inscripcions').delete().eq('id', id);
      addLog(`S'ha eliminat la inscripció de la parella: ${itemToDelete ? `${itemToDelete.c1Nom} & ${itemToDelete.c2Nom}` : id}`);
    } catch (e) {
      addLog("Error en eliminar la inscripció.");
    }
  };

  const deleteMultipleRegistrations = async (ids: string[]) => {
    const updated = inscripcions.filter(i => !ids.includes(i.id));
    setInscripcions(updated);
    try {
      await supabase.from('inscripcions').delete().in('id', ids);
      addLog(`S'han eliminat ${ids.length} inscripcions de forma massiva.`);
    } catch (e) {
      addLog("Error en l'eliminació massiva.");
    }
  };

  const clearAllRegistrations = async () => {
    setInscripcions([]);
    try {
      const allIds = inscripcions.map(i => i.id);
      if (allIds.length > 0) {
        await supabase.from('inscripcions').delete().in('id', allIds);
      }
      addLog(`S'ha buidat completament la base de dades d'inscripcions.`);
    } catch (e) {
      addLog("Error en buidar la base de dades.");
    }
  };

  const saveNoticies = async (newNoticies: NoticiaXarxes[]) => {
    setNoticies(newNoticies);
    try {
      // Simplest way is to delete all and insert new
      // But let's just use upsert
      const { data: existing } = await supabase.from('noticies_xarxes').select('id');
      if (existing && existing.length > 0) {
         await supabase.from('noticies_xarxes').delete().in('id', existing.map(e => e.id));
      }
      if (newNoticies.length > 0) {
         await supabase.from('noticies_xarxes').insert(newNoticies);
      }
      addLog("S'han actualitzat les notícies de la xarxa social.");
    } catch (e) {
      addLog("Error al actualitzar les notícies.");
    }
  };

  const updateRegistration = async (updatedReg: Inscripcio) => {
    const updated = inscripcions.map(i => i.id === updatedReg.id ? updatedReg : i);
    setInscripcions(updated);
    try {
      await supabase.from('inscripcions').update(updatedReg).eq('id', updatedReg.id);
      addLog(`Ficha d'inscripció actualitzada del parella: ${updatedReg.c1Nom} (${updatedReg.codiSeguiment})`);
    } catch (e) {
      addLog("Error en actualitzar la inscripció.");
    }
  };

  const handleAdminLogin = () => {
    setIsAdminLoggedIn(true);
    localStorage.setItem('tast_admin_session_2026', 'true');
    setView('admin-dashboard');
    addLog("Sessió d'administrador iniciada correctament.");
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.setItem('tast_admin_session_2026', 'false');
    setView('public');
    addLog("Sessió de secretaria tancada de manera segura.");
  };

  const logoText = config.logoText || 'T';
  const titolPrincipal = config.titolPrincipal || 'EL TAST';
  const titolSecundari = config.titolSecundari || 'VILANOVA';
  const subtitol = config.subtitol || 'Vilanova i la Geltrú 2026';
  const logoColor = config.logoColor || '#ff0090';

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col justify-between selection:bg-brand selection:text-white" id="app-root-container">
      {/* Top Banner header */}
      <header className="bg-dark-card text-white py-4 px-6 border-b border-white/10 flex justify-between items-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: logoColor }} />
        
        <div className="flex items-center gap-2.5">
          {config.logoUseImage && config.logoImgUrl ? (
            <img 
              src={config.logoImgUrl} 
              alt="Logo" 
              className="w-9 h-9 object-contain rounded-lg shadow-lg border border-white/10 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="w-8 h-8 rounded flex items-center justify-center font-bold text-black tracking-widest text-lg border border-white/10 shadow-lg uppercase transition-all shrink-0"
              style={{ backgroundColor: logoColor, boxShadow: `0 4px 12px ${logoColor}40` }}
            >
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

        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-zinc-400 font-mono">
          <ShieldCheck size={12} className="text-fuchsia-500 animate-pulse" />
          <span>{t('staff_count', { count: staffCount })}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg max-w-sm text-[10px] text-zinc-400 font-mono">
          <Terminal size={12} className="text-brand shrink-0" />
          <span className="truncate">{operationLogs[0] || t('official_server')}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 shrink-0" id="header-lang-selector">
            <button
              onClick={() => setLanguage('ca')}
              className={`text-[9px] font-sans font-black tracking-tight px-2 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'ca' 
                  ? 'bg-[#ff0090] text-white shadow-md shadow-[#ff0090]/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              CAT
            </button>
            <button
              onClick={() => setLanguage('es')}
              className={`text-[9px] font-sans font-black tracking-tight px-2 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'es' 
                  ? 'bg-[#ff0090] text-white shadow-md shadow-[#ff0090]/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              ESP
            </button>
          </div>

          {isAdminLoggedIn ? (
            <button
              onClick={() => setView('admin-dashboard')}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand/40 text-zinc-200 font-bold px-3 py-2 rounded-xl transition cursor-pointer"
            >
              {t('admin_panel')}
            </button>
          ) : (
            <button
              onClick={() => setView('login')}
              className="text-xs bg-white/5 hover:bg-white/10 text-zinc-350 font-bold px-3.5 py-2 rounded-xl transition-all border border-white/10 hover:border-brand/35 font-mono tracking-tight cursor-pointer"
            >
              {t('secretary')}
            </button>
          )}
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            {view === 'public' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <PublicForm 
                    config={config} 
                    onSubmit={addRegistration} 
                    onGoToLogin={() => setView('login')}
                  />
                </div>
                
                <div className="lg:col-span-1 space-y-6">
                  <NotificationFeed onAddLog={addLog} noticies={noticies} />
                  
                  <div className="bg-dark-card rounded-3xl p-6 border border-white/10 shadow-lg space-y-4">
                    <h4 className="font-sans font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={14} className="text-brand" /> {language === 'ca' ? 'Horaris de secretaria:' : 'Horarios de secretaría:'}
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                      {language === 'ca' 
                        ? "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Cultural El Tast."
                        : "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social de la Asociación Cultural El Tast."}
                    </p>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{language === 'ca' ? "Inscripció lliure, parelles d'Adults/Juvenils sota reglament" : "Inscripción libre, parejas de Adultos/Juveniles bajo reglamento"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'confirmacio' && activeRegistration && (
              <Confirmation 
                registration={activeRegistration} 
                onClear={() => {
                  setActiveRegistration(null);
                  setView('public');
                }}
              />
            )}

            {view === 'login' && (
              <AdminLogin 
                onLoginSuccess={handleAdminLogin}
                onBackToPublic={() => setView('public')}
              />
            )}

            {view === 'admin-dashboard' && (
              <AdminDashboard 
                inscripcions={inscripcions}
                config={config}
                onSelectInscripcio={(id) => {
                  setEditId(id);
                  setView('admin-ficha');
                }}
                onGoToScanner={() => setView('admin-scanner')}
                onGoToConfig={() => setView('admin-config')}
                onLogout={handleAdminLogout}
                onAddLog={addLog}
                onDeleteInscripcio={deleteRegistration}
                onDeleteMultipleInscripcions={deleteMultipleRegistrations}
                onClearAllInscripcions={clearAllRegistrations}
                onAddInscripcioManual={addRegistrationManual}
              />
            )}

            {view === 'admin-ficha' && editId && (
              <AdminFicha 
                registration={inscripcions.find(i => i.id === editId)!}
                config={config}
                onBack={() => {
                  setEditId(null);
                  setView('admin-dashboard');
                }}
                onSave={updateRegistration}
              />
            )}

            {view === 'admin-config' && (
              <AdminConfig 
                config={config}
                onBack={() => setView('admin-dashboard')}
                onSave={saveConfig}
                noticies={noticies}
                onSaveNoticies={saveNoticies}
              />
            )}

            {view === 'admin-scanner' && (
              <AdminScanner 
                inscripcions={inscripcions}
                onSelectInscripcio={(id) => {
                  setEditId(id);
                  setView('admin-ficha');
                }}
                onBack={() => setView('admin-dashboard')}
                onAddLog={addLog}
                onSaveInscripcio={updateRegistration}
              />
            )}

            {view === 'mobile-scanner' && mobileScannerSyncKey && (
              <MobileRemoteScanner 
                syncKey={mobileScannerSyncKey}
                inscripcions={inscripcions}
                onBack={() => {
                  window.history.pushState({}, '', window.location.pathname);
                  setView('public');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-zinc-950 py-6 px-8 text-center text-white border-t border-zinc-900 mt-12">
        <p className="font-sans font-black text-xs tracking-tight text-white flex items-center justify-center gap-1">
          {language === 'ca' ? 'ASSOCIACIÓ CULTURAL EL TAST' : 'ASOCIACIÓN CULTURAL EL TAST'} <span className="text-fuchsia-500">•</span> {language === 'ca' ? 'LES COMPARSES DE VILANOVA' : 'LAS COMPARSES DE VILANOVA'}
        </p>
        <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">
          {language === 'ca' 
            ? 'disseny del quadre de comandament i formulari integral 2026' 
            : 'diseño del cuadro de mando y formulario integral 2026'}
        </p>
      </footer>
    </div>
  );
}
