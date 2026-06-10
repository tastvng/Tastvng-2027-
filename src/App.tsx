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

import { 
  CONFIG_INICIAL, 
  INSCRIPCIONS_INICIALS 
} from './data';

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
  // 'public' | 'confirmacio' | 'login' | 'admin-dashboard' | 'admin-ficha' | 'admin-config' | 'admin-scanner' | 'mobile-scanner'
  const [view, setView] = useState<string>('public');
  const [mobileScannerSyncKey, setMobileScannerSyncKey] = useState<string | null>(null);

  // Persistence States
  const [config, setConfig] = useState<SistemaConfig>(CONFIG_INICIAL);
  const [inscripcions, setInscripcions] = useState<Inscripcio[]>([]);
  const [noticies, setNoticies] = useState<NoticiaXarxes[]>([]);
  const [activeRegistration, setActiveRegistration] = useState<Inscripcio | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Operations activity logs for demonstration realism inside iframe
  const [operationLogs, setOperationLogs] = useState<string[]>([]);

  useEffect(() => {
    setOperationLogs([
      language === 'ca' ? "Sistema de gestió El Tast inicialitzat correctament." : "Sistema de gestión El Tast inicializado correctamente.",
      language === 'ca' ? "Formulari públic de parelles preparat." : "Formulario público de parejas preparado."
    ]);
  }, [language]);

  // Check for mobile remote scanner sync request on mount
  useEffect(() => {
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
  }, []);

  // Load and recover state from LocalStorage on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('tast_config_2026');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        let updated = false;
        if (!parsed.titolSeccioTarifes || !parsed.tarifesDinamiques) {
          parsed.titolSeccioTarifes = parsed.titolSeccioTarifes || CONFIG_INICIAL.titolSeccioTarifes || 'Tarifes i Cànons 2026';
          parsed.tarifesDinamiques = parsed.tarifesDinamiques || [
            { id: 'adults', nom: 'Preu Parella Adulta (€)', valor: parsed.preuAdult ?? 90.00, actiu: true, tipus: 'categoria_adult' },
            { id: 'juvenils', nom: 'Preu Parella Juvenil (€)', valor: parsed.preuJuvenil ?? 60.00, actiu: true, tipus: 'categoria_juvenil' },
            { id: 'domas', nom: 'Cànon Domàs de Balcó (€)', valor: parsed.preuDomasBalco ?? 15.00, actiu: true, tipus: 'extra_domas' },
            { id: 'mocador', nom: 'Cànon Mocador Extra (€)', valor: parsed.preuMocadorExtra ?? 6.00, actiu: true, tipus: 'extra_mocador' }
          ];
          updated = true;
        }
        if (!parsed.titolFormulariDinamic) {
          parsed.titolFormulariDinamic = CONFIG_INICIAL.titolFormulariDinamic || "Preguntes del Qüestionari d'El Tast";
          updated = true;
        }
        if (parsed.logoUseImage === undefined) {
          parsed.logoUseImage = false;
          parsed.logoImgUrl = '';
          updated = true;
        }
        if (!parsed.nomUniforme) {
          parsed.nomUniforme = CONFIG_INICIAL.nomUniforme || "Talla de Samarreta";
          parsed.nomUniformeES = CONFIG_INICIAL.nomUniformeES || "Talla de Camiseta";
          parsed.opcionsUniforme = CONFIG_INICIAL.opcionsUniforme || ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
          updated = true;
        }
        if (!parsed.liniisUniforme) {
          parsed.liniisUniforme = CONFIG_INICIAL.liniisUniforme || [];
          updated = true;
        }
        if (updated) {
          localStorage.setItem('tast_config_2026', JSON.stringify(parsed));
        }
        setConfig(parsed);
      } else {
        localStorage.setItem('tast_config_2026', JSON.stringify(CONFIG_INICIAL));
      }

      const savedInscripcions = localStorage.getItem('tast_inscripcions_2026');
      if (savedInscripcions) {
        setInscripcions(JSON.parse(savedInscripcions));
      } else {
        setInscripcions(INSCRIPCIONS_INICIALS);
        localStorage.setItem('tast_inscripcions_2026', JSON.stringify(INSCRIPCIONS_INICIALS));
      }

      const savedNoticies = localStorage.getItem('tast_noticies_2026');
      import('./data').then((module) => {
        if (savedNoticies) {
          setNoticies(JSON.parse(savedNoticies));
        } else {
          setNoticies(module.COMPARTIDES_XARXES);
          localStorage.setItem('tast_noticies_2026', JSON.stringify(module.COMPARTIDES_XARXES));
        }
      });

      const savedLogin = localStorage.getItem('tast_admin_session_2026');
      if (savedLogin === 'true') {
        setIsAdminLoggedIn(true);
      }
    } catch (e) {
      console.error("error loading local storage state:", e);
      setInscripcions(INSCRIPCIONS_INICIALS);
    }
  }, []);

  // Quick logger function
  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString('ca-ES');
    setOperationLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 4)]);
  };

  // State update actions
  const saveConfig = (newConfig: SistemaConfig) => {
    setConfig(newConfig);
    localStorage.setItem('tast_config_2026', JSON.stringify(newConfig));
    addLog("S'han modificat les tarifes i config.");
  };

  const addRegistration = (newReg: Inscripcio) => {
    const updated = [newReg, ...inscripcions];
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    setActiveRegistration(newReg);
    setView('confirmacio');
    addLog(`Preinscripció realitzada amb èxit per a: ${newReg.c1Nom} & ${newReg.c2Nom}. Codi: ${newReg.codiSeguiment}`);
    addLog(language === 'ca'
      ? `📧 SMTP: Correu de confirmació oficial enviat automàticament des de secretaria@eltast.cat a ${newReg.c1Email} i ${newReg.c2Email}`
      : `📧 SMTP: Correo de confirmación oficial enviado automáticamente desde secretaria@eltast.cat a ${newReg.c1Email} y ${newReg.c2Email}`
    );
  };

  const addRegistrationManual = (newReg: Inscripcio) => {
    const updated = [newReg, ...inscripcions];
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    addLog(`Parella afegida manualment des del taulell: ${newReg.c1Nom} & ${newReg.c2Nom}. Codi: ${newReg.codiSeguiment}`);
  };

  const deleteRegistration = (id: string) => {
    const itemToDelete = inscripcions.find(i => i.id === id);
    const updated = inscripcions.filter(i => i.id !== id);
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    addLog(`S'ha eliminat la inscripció de la parella: ${itemToDelete ? `${itemToDelete.c1Nom} & ${itemToDelete.c2Nom}` : id}`);
  };

  const deleteMultipleRegistrations = (ids: string[]) => {
    const updated = inscripcions.filter(i => !ids.includes(i.id));
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    addLog(`S'han eliminat ${ids.length} inscripcions de forma massiva.`);
  };

  const clearAllRegistrations = () => {
    setInscripcions([]);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify([]));
    addLog(`S'ha buidat completament la base de dades d'inscripcions.`);
  };

  const saveNoticies = (newNoticies: NoticiaXarxes[]) => {
    setNoticies(newNoticies);
    localStorage.setItem('tast_noticies_2026', JSON.stringify(newNoticies));
    addLog("S'han actualitzat les notícies de la xarxa social.");
  };

  const updateRegistration = (updatedReg: Inscripcio) => {
    const updated = inscripcions.map(i => i.id === updatedReg.id ? updatedReg : i);
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    addLog(`Ficha d'inscripció actualitzada del parella: ${updatedReg.c1Nom} (${updatedReg.codiSeguiment})`);
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

  // Dynamic Staff state to update header visual dynamically
  const [staffCount, setStaffCount] = useState<number>(3);
  useEffect(() => {
    const updateCount = () => {
      try {
        const saved = localStorage.getItem('tast_staff_2026');
        if (saved) {
          const parsed = JSON.parse(saved);
          setStaffCount(parsed.length);
        } else {
          // Initialize defaults
          const defaults = [
            { id: 'st-0', nom: 'Secretaria General', usuari: 'secretaria', rol: 'Secretaria', contrasenya: 'eltast2026', creadoEn: '01/01/2026', actiu: true },
            { id: 'st-1', nom: 'Jordi Altiplà', usuari: 'jordia', rol: 'Coordinador', contrasenya: 'jordia123', creadoEn: '02/02/2026', actiu: true },
            { id: 'st-2', nom: 'Mireia VNG', usuari: 'mireiav', rol: 'Mesa d\'Entrega', contrasenya: 'mireia99', creadoEn: '15/03/2026', actiu: true }
          ];
          localStorage.setItem('tast_staff_2026', JSON.stringify(defaults));
          setStaffCount(3);
        }
      } catch (e) {
        console.error(e);
      }
    };
    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('staffChanged', updateCount);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('staffChanged', updateCount);
    };
  }, []);

  const logoText = config.logoText || 'T';
  const titolPrincipal = config.titolPrincipal || 'EL TAST';
  const titolSecundari = config.titolSecundari || 'VILANOVA';
  const subtitol = config.subtitol || 'Vilanova i la Geltrú 2026';
  const logoColor = config.logoColor || '#ff0090';

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col justify-between selection:bg-brand selection:text-white" id="app-root-container">
      {/* Top Banner header of El Tast branding style */}
      <header className="bg-dark-card text-white py-4 px-6 border-b border-white/10 flex justify-between items-center relative overflow-hidden shadow-2xl">
        {/* Abstract vector background lines representing festival confetti lights */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: logoColor }} />
        
        <div className="flex items-center gap-2.5">
          {config.logoUseImage && config.logoImgUrl ? (
            <img 
              src={config.logoImgUrl} 
              alt="Logo El Tast" 
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

        {/* Dynamic Staff Quick Indicator matchingFocused CSS Selector */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-zinc-400 font-mono">
          <ShieldCheck size={12} className="text-fuchsia-500 animate-pulse" />
          <span>{t('staff_count', { count: staffCount })}</span>
        </div>

        {/* Live operational log display (real-time feedback logger in page margin) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg max-w-sm text-[10px] text-zinc-400 font-mono">
          <Terminal size={12} className="text-brand shrink-0" />
          <span className="truncate">{operationLogs[0] || t('official_server')}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector d'Idioma Castellà / Català */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 shrink-0" id="header-lang-selector">
            <button
              onClick={() => setLanguage('ca')}
              className={`text-[9px] font-sans font-black tracking-tight px-2 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'ca' 
                  ? 'bg-[#ff0090] text-white shadow-md shadow-[#ff0090]/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Català"
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
              title="Castellano"
            >
              ESP
            </button>
          </div>

          {isAdminLoggedIn ? (
            <button
              onClick={() => setView('admin-dashboard')}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand/40 text-zinc-200 font-bold px-3 py-2 rounded-xl transition cursor-pointer"
              id="header-btn-dashboard"
            >
              {t('admin_panel')}
            </button>
          ) : (
            <button
              onClick={() => setView('login')}
              className="text-xs bg-white/5 hover:bg-white/10 text-zinc-350 font-bold px-3.5 py-2 rounded-xl transition-all border border-white/10 hover:border-brand/35 font-mono tracking-tight cursor-pointer"
              id="header-btn-login"
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
            {/* 1. Public Questionnaire form flow (with Feed on the side) */}
            {view === 'public' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <PublicForm 
                    config={config} 
                    onSubmit={addRegistration} 
                    onGoToLogin={() => setView('login')}
                  />
                </div>
                
                {/* Right side activity social bar */}
                <div className="lg:col-span-1 space-y-6">
                  <NotificationFeed onAddLog={addLog} noticies={noticies} />
                  
                  {/* Practical guidance card */}
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

            {/* 2. Registration Confirmation stage display layout */}
            {view === 'confirmacio' && activeRegistration && (
              <Confirmation 
                registration={activeRegistration} 
                onClear={() => {
                  setActiveRegistration(null);
                  setView('public');
                }}
              />
            )}

            {/* 3. Secure Admin Access logging flow */}
            {view === 'login' && (
              <AdminLogin 
                onLoginSuccess={handleAdminLogin}
                onBackToPublic={() => setView('public')}
              />
            )}

            {/* 4. Protected Workspace Manager: Metrics and general listings */}
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

            {/* 5. Detail Auditor sheet views */}
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

            {/* 6. System Prices & custom questionnaire togglers config */}
            {view === 'admin-config' && (
              <AdminConfig 
                config={config}
                onBack={() => setView('admin-dashboard')}
                onSave={saveConfig}
                noticies={noticies}
                onSaveNoticies={saveNoticies}
              />
            )}

            {/* 7. QR Scanner (Device webcam or waiting queue) */}
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

            {/* 8. Portable Mobile Remote QR Scanner */}
            {view === 'mobile-scanner' && mobileScannerSyncKey && (
              <MobileRemoteScanner 
                syncKey={mobileScannerSyncKey}
                inscripcions={inscripcions}
                onBack={() => {
                  // clean URL parameters and go back to public
                  window.history.pushState({}, '', window.location.pathname);
                  setView('public');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer information bar */}
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
