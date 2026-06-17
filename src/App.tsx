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
  NoticiaXarxes,
  StaffMember
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
import PortadaPage, { PortadaConfig } from './components/PortadaPage';
import { PORTADA_CONFIG_DEFAULTS } from './components/AdminPortada';
import { 
  supabase,
  isSupabaseConfigured, 
  getSupabaseSetting, 
  saveSupabaseSetting, 
  getSupabaseInscripciones, 
  saveSupabaseInscripcion, 
  deleteSupabaseInscripcion, 
  deleteMultipleSupabaseInscripciones, 
  clearAllSupabaseInscripciones 
} from './supabaseClient';

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Portada Configuration State
  const [portadaConfig, setPortadaConfig] = useState<PortadaConfig>(() => {
    try {
      const saved = localStorage.getItem('tast_portada_config_2026');
      if (saved) {
        return { ...PORTADA_CONFIG_DEFAULTS, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return PORTADA_CONFIG_DEFAULTS;
  });

  // Navigation Routing States
  // 'portada' | 'public' | 'confirmacio' | 'login' | 'admin-dashboard' | 'admin-ficha' | 'admin-config' | 'admin-scanner' | 'mobile-scanner'
  const [view, setView] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('tast_portada_config_2026');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activa === false) {
          return 'public';
        }
      }
    } catch (e) {}
    return 'portada';
  });
  const [mobileScannerSyncKey, setMobileScannerSyncKey] = useState<string | null>(null);

  // Load from Supabase on component mount
  useEffect(() => {
    async function loadConfigFromSupabase() {
      if (!isSupabaseConfigured) return;
      try {
        const dbConfig = await getSupabaseSetting<PortadaConfig | null>('tast_portada_config_2026', null);
        if (dbConfig) {
          const merged = { ...PORTADA_CONFIG_DEFAULTS, ...dbConfig };
          setPortadaConfig(merged);
          // Auto route to public if the loaded Supabase landing page is set to inactive
          if (merged.activa === false && view === 'portada') {
            setView('public');
          }
        }
      } catch (err) {
        console.error("Failed to load Supabase settings:", err);
      }
    }
    loadConfigFromSupabase();
  }, [view]);

  // Sync Portada state dynamically with localStorage & Supabase changes
  useEffect(() => {
    const handlePortadaChange = async () => {
      try {
        if (isSupabaseConfigured) {
          const dbConfig = await getSupabaseSetting<PortadaConfig | null>('tast_portada_config_2026', null);
          if (dbConfig) {
            setPortadaConfig({ ...PORTADA_CONFIG_DEFAULTS, ...dbConfig });
            return;
          }
        }
        
        const saved = localStorage.getItem('tast_portada_config_2026');
        if (saved) {
          setPortadaConfig({ ...PORTADA_CONFIG_DEFAULTS, ...JSON.parse(saved) });
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('portadaConfigChanged', handlePortadaChange);
    return () => {
      window.removeEventListener('portadaConfigChanged', handlePortadaChange);
    };
  }, []);

  // Persistence States
  const [config, setConfig] = useState<SistemaConfig>(CONFIG_INICIAL);
  const [inscripcions, setInscripcions] = useState<Inscripcio[]>([]);
  const [noticies, setNoticies] = useState<NoticiaXarxes[]>([]);
  const [activeRegistration, setActiveRegistration] = useState<Inscripcio | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Practical guidance card hours state
  const [hoursConfig, setHoursConfig] = useState({
    ca: "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Cultural El Tast.",
    es: "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social de la Asociación Cultural El Tast."
  });

  const [emailLogo, setEmailLogo] = useState(() => localStorage.getItem('tast_email_logo') || "");

  useEffect(() => {
    const loadHoursAndLogo = () => {
      const savedCa = localStorage.getItem('tast_secretaria_hours_ca');
      const savedEs = localStorage.getItem('tast_secretaria_hours_es');
      setHoursConfig({
        ca: savedCa || "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Cultural El Tast.",
        es: savedEs || "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social de la Asociación Cultural El Tast."
      });
      setEmailLogo(localStorage.getItem('tast_email_logo') || "");
    };
    loadHoursAndLogo();
    window.addEventListener('storage', loadHoursAndLogo);
    window.addEventListener('hoursConfigChanged', loadHoursAndLogo);
    window.addEventListener('localStorage', loadHoursAndLogo);
    return () => {
      window.removeEventListener('storage', loadHoursAndLogo);
      window.removeEventListener('hoursConfigChanged', loadHoursAndLogo);
      window.removeEventListener('localStorage', loadHoursAndLogo);
    };
  }, []);

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

  // Load and recover state from Supabase / LocalStorage on mount
  useEffect(() => {
    async function loadAllFromDatabase() {
      if (isSupabaseConfigured) {
        try {
          // 1. Fetch Global Config
          const dbConfig = await getSupabaseSetting<SistemaConfig | null>('tast_config_2026', null);
          if (dbConfig) {
            setConfig(dbConfig);
            localStorage.setItem('tast_config_2026', JSON.stringify(dbConfig));
          } else {
            console.log("No config found in Supabase settings table, uploading CONFIG_INICIAL...");
            setConfig(CONFIG_INICIAL);
            localStorage.setItem('tast_config_2026', JSON.stringify(CONFIG_INICIAL));
          }
        } catch (e) {
          console.error("Error loading config from Supabase:", e);
          setConfig(CONFIG_INICIAL);
        }

        // Sensitive inscription loading has been deferred and is handled dynamically only after admin logs in!

        try {
          // 3. Fetch social news / noticies
          const dbNoticies = await getSupabaseSetting<NoticiaXarxes[] | null>('tast_noticies_2026', null);
          if (dbNoticies) {
            setNoticies(dbNoticies);
            localStorage.setItem('tast_noticies_2026', JSON.stringify(dbNoticies));
          } else {
            const module = await import('./data');
            setNoticies(module.COMPARTIDES_XARXES);
            localStorage.setItem('tast_noticies_2026', JSON.stringify(module.COMPARTIDES_XARXES));
          }
        } catch (e) {
          console.error("Error loading news from Supabase:", e);
        }

        try {
          // 4. Fetch extra customization settings
          const dbPortada = await getSupabaseSetting<PortadaConfig | null>('tast_portada_config_2026', null);
          if (dbPortada) {
            const merged = { ...PORTADA_CONFIG_DEFAULTS, ...dbPortada };
            setPortadaConfig(merged);
            localStorage.setItem('tast_portada_config_2026', JSON.stringify(merged));
          }

          const lg = await getSupabaseSetting('tast_email_logo', '');
          const hrCa = await getSupabaseSetting('tast_secretaria_hours_ca', '');
          const hrEs = await getSupabaseSetting('tast_secretaria_hours_es', '');

          if (lg) {
            localStorage.setItem('tast_email_logo', lg);
            setEmailLogo(lg);
          }
          if (hrCa) localStorage.setItem('tast_secretaria_hours_ca', hrCa);
          if (hrEs) localStorage.setItem('tast_secretaria_hours_es', hrEs);

          if (hrCa || hrEs) {
            setHoursConfig({
              ca: hrCa || "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Cultural El Tast.",
              es: hrEs || "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social de la Asociación Cultural El Tast."
            });
          }
        } catch (e) {
          console.error("Error loading extra settings from Supabase:", e);
        }
      } else {
        // Traditional LocalStorage loading fallback
        try {
          const savedConfig = localStorage.getItem('tast_config_2026');
          if (savedConfig) {
            setConfig(JSON.parse(savedConfig));
          } else {
            setConfig(CONFIG_INICIAL);
          }
          setInscripcions([]); // Clear any public in-memory inscriptions on load
          const savedNoticies = localStorage.getItem('tast_noticies_2026');
          if (savedNoticies) {
            setNoticies(JSON.parse(savedNoticies));
          } else {
            const module = await import('./data');
            setNoticies(module.COMPARTIDES_XARXES);
          }
        } catch (e) {
          console.error("LocalStorage fallback load failed:", e);
          setInscripcions([]);
        }
      }

      setIsLoading(false);
    }

    loadAllFromDatabase();
  }, []);

  // Maintain session via Supabase Auth
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // Check current session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAdminLoggedIn(!!session);
      });

      // Listen to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const loggedIn = !!session;
        setIsAdminLoggedIn(loggedIn);
        if (loggedIn) {
          setView('admin-dashboard');
        } else {
          // Send to portada or public depending on the landing page status
          setView(portadaConfig.activa === false ? 'public' : 'portada');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [portadaConfig.activa]);

  // Lazy-load inscriptions ONLY when logged in
  useEffect(() => {
    async function loadInscripcions() {
      if (!isAdminLoggedIn) {
        setInscripcions([]);
        return;
      }
      
      if (isSupabaseConfigured) {
        try {
          const dbInscripcions = await getSupabaseInscripciones();
          if (dbInscripcions && dbInscripcions.length > 0) {
            setInscripcions(dbInscripcions);
            localStorage.setItem('tast_inscripcions_2026', JSON.stringify(dbInscripcions));
          } else {
            setInscripcions([]);
            localStorage.setItem('tast_inscripcions_2026', JSON.stringify([]));
          }
        } catch (e) {
          console.error("Error loading inscriptions dynamically for session:", e);
          setInscripcions([]);
        }
      } else {
        // Traditional LocalStorage loading fallback if logged in for custom layouts
        try {
          const savedInscripcions = localStorage.getItem('tast_inscripcions_2026');
          if (savedInscripcions) {
            setInscripcions(JSON.parse(savedInscripcions));
          } else {
            setInscripcions([]);
          }
        } catch (e) {
          setInscripcions([]);
        }
      }
    }

    loadInscripcions();
  }, [isAdminLoggedIn]);

  // Route authenticated admins automatically
  useEffect(() => {
    if (isAdminLoggedIn && view === 'login') {
      setView('admin-dashboard');
    }
  }, [isAdminLoggedIn, view]);

  // Quick logger function
  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString('ca-ES');
    setOperationLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 4)]);
  };

  // Trigger background google sheet sync when inscriptions change or config updates
  const syncWithGoogle = (latestInscripcions: Inscripcio[], activeConfig: SistemaConfig = config) => {
    if (activeConfig.googleSheetSyncActive && activeConfig.googleSheetSyncUrl) {
      import('./googleSync').then(({ syncToGoogleSheet }) => {
        syncToGoogleSheet(latestInscripcions, activeConfig.googleSheetSyncUrl, activeConfig.googleSheetSyncActive);
      });
    }
  };

  // State update actions
  const saveConfig = async (newConfig: SistemaConfig) => {
    setConfig(newConfig);
    localStorage.setItem('tast_config_2026', JSON.stringify(newConfig));
    addLog("S'han modificat les tarifes i config.");
    syncWithGoogle(inscripcions, newConfig);
    if (isSupabaseConfigured) {
      try {
        await saveSupabaseSetting('tast_config_2026', newConfig);
        addLog("✓ Configuració desada globalment a la base de dades d'settings.");
      } catch (err) {
        console.error("Error saving config to Supabase:", err);
      }
    }
  };

  const handleResetConfig = async () => {
    setConfig(CONFIG_INICIAL);
    localStorage.setItem('tast_config_2026', JSON.stringify(CONFIG_INICIAL));
    addLog("S'ha restablert la configuració inicial de fàbrica.");
    syncWithGoogle(inscripcions, CONFIG_INICIAL);
    if (isSupabaseConfigured) {
      try {
        await saveSupabaseSetting('tast_config_2026', CONFIG_INICIAL);
        addLog("✓ Configuració de fàbrica desada globalment a Supabase.");
      } catch (err) {
        console.error("Error saving reset config to Supabase:", err);
      }
    }
    // Force reload so that state hooks and variables inside subcomponents reinitialize cleanly!
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const getEstatInscripcioForCategory = (categoria: CategoriaParella) => {
    const matchingTarifa = config.tarifesDinamiques?.find(tf => {
      if (categoria === CategoriaParella.ADULT) {
        return tf.tipus === 'categoria_adult' || tf.id === 'adults';
      } else {
        return tf.tipus === 'categoria_juvenil' || tf.id === 'juvenils';
      }
    });
    
    if (!matchingTarifa) return 'obertes';
    return matchingTarifa.actiu ? 'obertes' : 'llista_espera';
  };

  const addRegistration = async (newReg: Inscripcio) => {
    // 1. Determine local registration status
    const categoryStatus = getEstatInscripcioForCategory(newReg.categoria);
    newReg.estatInscripcio = categoryStatus;

    // 2. Fetch all latest inscriptions to calculate global position sequentially
    let latestInscripcions: Inscripcio[] = [];
    if (isSupabaseConfigured) {
      try {
        latestInscripcions = await getSupabaseInscripciones();
      } catch (err) {
        console.error("Error fetching dynamic registrations from Supabase:", err);
      }
    } else {
      try {
        const savedInscripcions = localStorage.getItem('tast_inscripcions_2026');
        if (savedInscripcions) {
          latestInscripcions = JSON.parse(savedInscripcions);
        }
      } catch (e) {
        console.error("Error loading inscriptions from localStorage:", e);
      }
    }

    const maxPos = latestInscripcions.reduce((max, ins) => {
      return ins.posicioGlobal && ins.posicioGlobal > max ? ins.posicioGlobal : max;
    }, 0);
    newReg.posicioGlobal = maxPos > 0 ? maxPos + 1 : (latestInscripcions.length + 1);

    const updated = [newReg, ...inscripcions];
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    syncWithGoogle(updated);
    setActiveRegistration(newReg);
    setView('confirmacio');
    addLog(`Preinscripció realitzada amb èxit per a: ${newReg.c1Nom} & ${newReg.c2Nom}. Codi: ${newReg.codiSeguiment}`);
    addLog(language === 'ca'
      ? `📧 SMTP: Correu de confirmació oficial enviat automàticament des de secretaria@eltast.cat a ${newReg.c1Email} i ${newReg.c2Email}`
      : `📧 SMTP: Correo de confirmación oficial enviado automáticamente desde secretaria@eltast.cat a ${newReg.c1Email} y ${newReg.c2Email}`
    );
    if (isSupabaseConfigured) {
      try {
        await saveSupabaseInscripcion(newReg);
        addLog(`✓ Inscripció registrada persistentment a Supabase.`);
      } catch (err) {
        console.error("Error saving inscription to Supabase:", err);
      }
    }
  };

  const addRegistrationManual = async (newReg: Inscripcio) => {
    // 1. Determine local registration status
    const categoryStatus = getEstatInscripcioForCategory(newReg.categoria);
    newReg.estatInscripcio = categoryStatus;

    // 2. Determine global position (using in-memory list which is up to date for manual screen)
    const maxPos = inscripcions.reduce((max, ins) => {
      return ins.posicioGlobal && ins.posicioGlobal > max ? ins.posicioGlobal : max;
    }, 0);
    newReg.posicioGlobal = maxPos > 0 ? maxPos + 1 : (inscripcions.length + 1);

    const updated = [newReg, ...inscripcions];
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    syncWithGoogle(updated);
    addLog(`Parella afegida manualment des del taulell: ${newReg.c1Nom} & ${newReg.c2Nom}. Codi: ${newReg.codiSeguiment}`);
    if (isSupabaseConfigured) {
      try {
        await saveSupabaseInscripcion(newReg);
        addLog(`✓ Inscripció manual registrada persistentment a Supabase.`);
      } catch (err) {
        console.error("Error saving manual inscription to Supabase:", err);
      }
    }
  };

  const deleteRegistration = async (id: string) => {
    const itemToDelete = inscripcions.find(i => i.id === id);
    const updated = inscripcions.filter(i => i.id !== id);
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    syncWithGoogle(updated);
    addLog(`S'ha eliminat la inscripció de la parella: ${itemToDelete ? `${itemToDelete.c1Nom} & ${itemToDelete.c2Nom}` : id}`);
    if (isSupabaseConfigured) {
      try {
        await deleteSupabaseInscripcion(id);
        addLog(`✓ Inscripció eliminada a Supabase.`);
      } catch (err) {
        console.error("Error deleting inscription from Supabase:", err);
      }
    }
  };

  const deleteMultipleRegistrations = async (ids: string[]) => {
    const updated = inscripcions.filter(i => !ids.includes(i.id));
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    syncWithGoogle(updated);
    addLog(`S'han eliminat ${ids.length} inscripcions de forma massiva.`);
    if (isSupabaseConfigured) {
      try {
        await deleteMultipleSupabaseInscripciones(ids);
        addLog(`✓ S'han eliminat ${ids.length} inscripcions a Supabase.`);
      } catch (err) {
        console.error("Error deleting multiple inscriptions from Supabase:", err);
      }
    }
  };

  const clearAllRegistrations = async () => {
    setInscripcions([]);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify([]));
    syncWithGoogle([]);
    addLog(`S'ha buidat completament la base de dades d'inscripcions.`);
    if (isSupabaseConfigured) {
      try {
        await clearAllSupabaseInscripciones();
        addLog(`✓ Base de dades d'inscripcions buidada a Supabase.`);
      } catch (err) {
        console.error("Error clearing all inscriptions from Supabase:", err);
      }
    }
  };

  const saveNoticies = async (newNoticies: NoticiaXarxes[]) => {
    setNoticies(newNoticies);
    localStorage.setItem('tast_noticies_2026', JSON.stringify(newNoticies));
    addLog("S'han actualitzat les notícies de la xarxa social.");
    if (isSupabaseConfigured) {
      try {
        await saveSupabaseSetting('tast_noticies_2026', newNoticies);
      } catch (err) {
        console.error("Error saving news to Supabase:", err);
      }
    }
  };

  const updateRegistration = async (updatedReg: Inscripcio) => {
    const updated = inscripcions.map(i => i.id === updatedReg.id ? updatedReg : i);
    setInscripcions(updated);
    localStorage.setItem('tast_inscripcions_2026', JSON.stringify(updated));
    syncWithGoogle(updated);
    addLog(`Ficha d'inscripció actualitzada del parella: ${updatedReg.c1Nom} (${updatedReg.codiSeguiment})`);
    if (isSupabaseConfigured) {
      try {
        await saveSupabaseInscripcion(updatedReg);
        addLog(`✓ Ficha actualitzada persistentment a Supabase.`);
      } catch (err) {
        console.error("Error updating inscription on Supabase:", err);
      }
    }
  };

  const handleAdminLogin = (rememberMe: boolean = false) => {
    setIsAdminLoggedIn(true);
    setView('admin-dashboard');
    addLog("Sessió d'administrador iniciada correctament.");
  };

  const handleAdminLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Sign out error:", e);
      }
    }
    setIsAdminLoggedIn(false);
    localStorage.setItem('tast_admin_session_2026', 'false');
    sessionStorage.setItem('tast_admin_session_2026', 'false');
    setView(portadaConfig.activa ? 'portada' : 'public');
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
            { id: 'st-1', nom: 'Tast VNG (Admin)', usuari: 'tastvng@gmail.com', rol: 'SuperAdministrador', contrasenya: 'eltast2026', creadoEn: '01/01/2026', actiu: true },
            { id: 'st-2', nom: 'Jordi Altiplà', usuari: 'jordia', rol: 'Coordinador', contrasenya: 'jordia123', creadoEn: '02/02/2026', actiu: true },
            { id: 'st-3', nom: 'Mireia VNG', usuari: 'mireiav', rol: 'Mesa d\'Entrega', contrasenya: 'mireia99', creadoEn: '15/03/2026', actiu: true }
          ];
          localStorage.setItem('tast_staff_2026', JSON.stringify(defaults));
          setStaffCount(4);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-brand border-t-transparent animate-spin" />
          <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Carregant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col justify-between selection:bg-brand selection:text-white" id="app-root-container">
      {/* Top Banner header of El Tast branding style */}
      <header className="bg-dark-card text-white py-4 px-6 border-b border-white/10 flex justify-between items-center relative overflow-hidden shadow-2xl">
        {/* Abstract vector background lines representing festival confetti lights */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: logoColor }} />
        
        <div className="flex items-center gap-2.5">
          {emailLogo ? (
            <img 
              src={emailLogo} 
              alt="Logo El Tast" 
              className="w-9 h-9 object-contain rounded-lg shadow-lg border border-white/10 shrink-0 bg-white p-0.5"
              referrerPolicy="no-referrer"
            />
          ) : config.logoUseImage && config.logoImgUrl ? (
            <img 
              src={config.logoImgUrl} 
              alt="Logo El Tast" 
              className="w-9 h-9 object-contain rounded-lg shadow-lg border border-white/10 shrink-0 bg-white p-0.5"
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
        {isAdminLoggedIn && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-zinc-400 font-mono">
            <ShieldCheck size={12} className="text-fuchsia-500 animate-pulse" />
            <span>{t('staff_count', { count: staffCount })}</span>
          </div>
        )}

        {/* Live operational log display (real-time feedback logger in page margin) */}
        {isAdminLoggedIn && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg max-w-sm text-[10px] text-zinc-400 font-mono">
            <Terminal size={12} className="text-brand shrink-0" />
            <span className="truncate">{operationLogs[0] || t('official_server')}</span>
          </div>
        )}

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
            {/* 0. Custom Landing Page / Portada */}
            {view === 'portada' && (
              <PortadaPage 
                config={portadaConfig}
                globalLogoColor={config.logoColor}
                globalLogoText={config.logoText}
                globalLogoUseImage={config.logoUseImage}
                globalLogoImgUrl={config.logoImgUrl}
                globalEstatInscripcions={config.estatInscripcions || 'obertes'}
                onEnterForm={() => setView('public')}
                onGoToLogin={() => setView('login')}
              />
            )}

            {/* 1. Public Questionnaire form flow (with Feed on the side) */}
            {view === 'public' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <PublicForm 
                    config={{ ...config, cuestionariActiu: portadaConfig.cuestionariActiu !== false }} 
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
                      {language === 'ca' ? hoursConfig.ca : hoursConfig.es}
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
                onUpdate={updateRegistration}
              />
            )}

            {/* 3. Secure Admin Access logging flow */}
            {view === 'login' && (
              <AdminLogin 
                onLoginSuccess={handleAdminLogin}
                onBackToPublic={() => setView(portadaConfig.activa ? 'portada' : 'public')}
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
                onSaveInscripcio={updateRegistration}
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
                onResetConfig={handleResetConfig}
                noticies={noticies}
                onSaveNoticies={saveNoticies}
              />
            )}

            {/* 7. QR Scanner (Device webcam or waiting queue) */}
            {view === 'admin-scanner' && (
              <AdminScanner 
                inscripcions={inscripcions}
                config={config}
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
                  setView(portadaConfig.activa ? 'portada' : 'public');
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
