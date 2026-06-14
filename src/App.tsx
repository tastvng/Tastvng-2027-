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
  EstatInscripcio 
} from './types';

import { 
  CONFIG_INICIAL, 
  INSCRIPCIONS_INICIALS 
} from './data';

// Component imports
import PublicForm from './components/PublicForm';
import Confirmation from './components/Confirmation';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import AdminFicha from './components/AdminFicha';
import AdminConfig from './components/AdminConfig';
import AdminScanner from './components/AdminScanner';
import NotificationFeed from './components/NotificationFeed';

export default function App() {
  // Navigation Routing States
  // 'public' | 'confirmacio' | 'login' | 'admin-dashboard' | 'admin-ficha' | 'admin-config' | 'admin-scanner'
  const [view, setView] = useState<string>('public');

  // Persistence States
  const [config, setConfig] = useState<SistemaConfig>(CONFIG_INICIAL);
  const [inscripcions, setInscripcions] = useState<Inscripcio[]>([]);
  const [activeRegistration, setActiveRegistration] = useState<Inscripcio | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Operations activity logs for demonstration realism inside iframe
  const [operationLogs, setOperationLogs] = useState<string[]>([
    "Sistema de gestió El Tast inicialitzat correctament.",
    "Formulari públic de parelles preparat."
  ]);

  // Load and recover state from LocalStorage on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('tast_config_2026');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
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

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col justify-between selection:bg-brand selection:text-white" id="app-root-container">
      {/* Top Banner header of El Tast branding style */}
      <header className="bg-dark-card text-white py-4 px-6 border-b border-white/10 flex justify-between items-center relative overflow-hidden shadow-2xl">
        {/* Abstract vector background lines representing festival confetti lights */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand via-brand/60 to-brand" />
        
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-brand flex items-center justify-center font-bold text-black tracking-widest text-lg border border-white/10 shadow-lg shadow-brand/20">
            T
          </div>
          <div>
            <h1 className="font-sans font-black text-sm md:text-base leading-none text-white tracking-tight">
              EL TAST <span className="text-brand">VILANOVA</span>
            </h1>
            <p className="font-mono text-[9px] text-zinc-500 tracking-widest font-semibold uppercase mt-0.5">Vilanova i la Geltrú 2026</p>
          </div>
        </div>

        {/* Live operational log display (real-time feedback logger in page margin) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg max-w-sm text-[10px] text-zinc-400 font-mono">
          <Terminal size={12} className="text-brand shrink-0" />
          <span className="truncate">{operationLogs[0] || 'Iniciant servidor El Tast...'}</span>
        </div>

        <div className="flex items-center gap-3">
          {isAdminLoggedIn ? (
            <button
              onClick={() => setView('admin-dashboard')}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand/40 text-zinc-200 font-bold px-3 py-2 rounded-xl transition"
              id="header-btn-dashboard"
            >
              Taulell Admin
            </button>
          ) : (
            <button
              onClick={() => setView('login')}
              className="text-xs bg-white/5 hover:bg-white/10 text-zinc-350 font-bold px-3.5 py-2 rounded-xl transition-all border border-white/10 hover:border-brand/35 font-mono tracking-tight"
              id="header-btn-login"
            >
              Secretaria 🔒
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
                  <NotificationFeed onAddLog={addLog} />
                  
                  {/* Practical guidance card */}
                  <div className="bg-dark-card rounded-3xl p-6 border border-white/10 shadow-lg space-y-4">
                    <h4 className="font-sans font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={14} className="text-brand" /> Horaris de secretaria:
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                      Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Gastronòmica El Tast.
                    </p>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Inscripció lliure, parelles d'Adults/Juvenils sota reglament</span>
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
                onSelectInscripcio={(id) => {
                  setEditId(id);
                  setView('admin-ficha');
                }}
                onGoToScanner={() => setView('admin-scanner')}
                onGoToConfig={() => setView('admin-config')}
                onLogout={handleAdminLogout}
                onAddLog={addLog}
              />
            )}

            {/* 5. Detail Auditor sheet views */}
            {view === 'admin-ficha' && editId && (
              <AdminFicha 
                registration={inscripcions.find(i => i.id === editId)!}
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
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer information bar */}
      <footer className="bg-zinc-950 py-6 px-8 text-center text-white border-t border-zinc-900 mt-12">
        <p className="font-sans font-black text-xs tracking-tight text-white flex items-center justify-center gap-1">
          ASSOCIACIÓ GASTRONÒMICA EL TAST <span className="text-fuchsia-500">•</span> LES COMPARSES DE VILANOVA
        </p>
        <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">
          disseny del quadre de comandament i formulari integral 2026
        </p>
      </footer>
    </div>
  );
}
