import React, { useState, useEffect } from 'react';
import { saveLogger, SaveLog } from '../services/SaveLogger';
import { useLanguage } from '../LanguageContext';
import { Settings, Trash2, Play, Pause, RefreshCw, CheckCircle, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { singularPlural } from '../utils/singularPlural';
import { Inscripcio } from '../types';

interface AdminStatusPanelProps {
  isAdmin: boolean;
  inscripcions?: Inscripcio[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<any>;
}

export const AdminStatusPanel: React.FC<AdminStatusPanelProps> = ({ 
  isAdmin,
  inscripcions = [],
  isLoading = false,
  error = null,
  onRefresh
}) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<SaveLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time counter states unified with single source of truth (public.inscripciones)
  const totalInscrits = inscripcions.length;
  const numRespuestas = inscripcions.filter(i => i.respostesCuestionari && Object.keys(i.respostesCuestionari).length > 0).length;
  const [numPreguntes, setNumPreguntes] = useState(0);

  const loadLogs = () => {
    setLogs(saveLogger.getRecentLogs(20));
  };

  useEffect(() => {
    if (!isAdmin) return;

    loadLogs();

    // Listen to custom events from SaveLogger for real-time reactive updates
    const handleUpdate = () => {
      loadLogs();
    };
    window.addEventListener('saveLoggerUpdate', handleUpdate);

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 2000);
    }

    return () => {
      window.removeEventListener('saveLoggerUpdate', handleUpdate);
      if (interval) clearInterval(interval);
    };
  }, [isAdmin, autoRefresh]);

  // Load questions count from official questions API
  useEffect(() => {
    if (!isAdmin || !isOpen) return;

    const fetchPreguntes = async () => {
      try {
        const { cargarPreguntes } = await import('../api/questionnaireApi');
        const preguntesData = await cargarPreguntes();
        setNumPreguntes(preguntesData ? preguntesData.length : 0);
      } catch (err) {
        console.error('Error fetching questions count for AdminStatusPanel:', err);
      }
    };

    fetchPreguntes();
  }, [isAdmin, isOpen]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (e) {
      console.error('Error on manual refresh from AdminStatusPanel:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isAdmin) return null;

  const handleClear = () => {
    saveLogger.clearLogs();
    loadLogs();
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-sans">
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border ${
          isOpen 
            ? 'bg-zinc-900 border-purple-500/40 text-purple-400' 
            : 'bg-zinc-950/95 border-zinc-800 text-zinc-100 hover:border-purple-500/50 hover:shadow-purple-500/10'
        }`}
        title="Status Panel (Admin)"
      >
        <Settings className={`w-5 h-5 ${isOpen ? 'animate-spin [animation-duration:8s]' : ''}`} />
        <span className="text-xs font-bold tracking-wider uppercase">
          {language === 'ca' ? 'Estat' : 'Estado'}
        </span>
        <span className={`flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-mono font-bold rounded-full ${
          error || logs.some(l => l.status === 'error')
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            : logs.length > 0
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            : 'bg-zinc-800 text-zinc-400'
        }`}>
          {totalInscrits}
        </span>
      </button>

      {/* Slide-out Panel */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-zinc-950/95 border border-zinc-800/80 rounded-2xl shadow-2xl w-96 max-h-[480px] overflow-hidden flex flex-col backdrop-blur-xl animate-toast-in-bottom">
          {/* Header */}
          <div className="p-4 bg-zinc-900/50 border-b border-zinc-800/80 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-100 tracking-wide uppercase">
                  {language === 'ca' ? 'Panel de Sincronització' : 'Panel de Sincronización'}
                </h3>
                <p className="text-[10px] text-zinc-500">
                  {language === 'ca' ? 'Font: public.inscripciones' : 'Fuente: public.inscripciones'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {onRefresh && (
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing || isLoading}
                  title={language === 'ca' ? "Actualitzar dades de Supabase" : "Actualizar datos de Supabase"}
                  className="text-zinc-400 hover:text-purple-400 p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${(isRefreshing || isLoading) ? 'animate-spin text-purple-400' : ''}`} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Database Error Banner if query failed */}
          {error && (
            <div className="px-4 py-2 bg-rose-500/15 border-b border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[11px] leading-tight truncate">
                  {language === 'ca' ? 'Error consultant Supabase' : 'Error consultando Supabase'}
                </p>
                <p className="text-[9px] text-rose-400/80 font-mono truncate">{error}</p>
              </div>
            </div>
          )}

          {/* Counters Section: strictly unified with public.inscripciones */}
          <div className="px-4 py-2.5 bg-zinc-900/10 border-b border-zinc-800/50 grid grid-cols-3 gap-2 shrink-0">
            <div className="bg-zinc-950/40 border border-zinc-900 p-2 rounded-xl text-center">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                {language === 'ca' ? 'Inscrits' : 'Inscritos'}
              </span>
              <p className="text-xs font-black text-purple-400 mt-0.5">
                {isLoading ? '...' : `${totalInscrits} ${singularPlural(totalInscrits, 'inscrit', 'inscrits')}`}
              </p>
            </div>
            <div className="bg-zinc-950/40 border border-zinc-900 p-2 rounded-xl text-center">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                {language === 'ca' ? 'Preguntes' : 'Preguntas'}
              </span>
              <p className="text-xs font-black text-purple-400 mt-0.5">
                {numPreguntes} {singularPlural(numPreguntes, 'pregunta', 'preguntes')}
              </p>
            </div>
            <div className="bg-zinc-950/40 border border-zinc-900 p-2 rounded-xl text-center">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                {language === 'ca' ? 'Respostes' : 'Respuestas'}
              </span>
              <p className="text-xs font-black text-purple-400 mt-0.5">
                {isLoading ? '...' : `${numRespuestas} ${singularPlural(numRespuestas, 'respuesta', 'respuestas')}`}
              </p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="px-4 py-2 bg-zinc-900/20 border-b border-zinc-800/50 flex justify-between items-center shrink-0 text-xs">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              {language === 'ca' ? 'Últims 20 registres' : 'Últimos 20 registros'}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium tracking-wide transition-all border ${
                  autoRefresh
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                }`}
              >
                {autoRefresh ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin [animation-duration:3s]" />
                    <span>Auto</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-2.5 h-2.5" />
                    <span>Manual</span>
                  </>
                )}
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>{language === 'ca' ? 'Netejar' : 'Limpiar'}</span>
              </button>
            </div>
          </div>

          {/* Logs List Container */}
          <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-[150px] max-h-[320px] scrollbar-thin scrollbar-thumb-zinc-800">
            {logs.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Settings className="w-8 h-8 text-zinc-700 mb-2 animate-pulse" />
                <p className="text-xs font-medium text-zinc-500">
                  {language === 'ca' ? 'No hi ha cap acció registrada' : 'No hay acciones registradas'}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  {language === 'ca' ? 'Es mostraran els guardats fets a la base de dades' : 'Se mostrarán los guardados hechos en la base de datos'}
                </p>
              </div>
            ) : (
              logs.map((log) => {
                const isSuccess = log.status === 'success';
                const logTime = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border transition-all duration-200 ${
                      isSuccess
                        ? 'bg-zinc-900/40 border-emerald-500/15 hover:border-emerald-500/35'
                        : 'bg-zinc-950 border-rose-500/20 hover:border-rose-500/40 shadow-lg shadow-rose-950/10'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                          isSuccess
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {log.page}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {logTime}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {isSuccess ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        )
                      }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 leading-snug">
                          {log.action}
                        </p>
                        {log.details && (
                          <p className="text-[10px] text-zinc-400 mt-1 font-medium bg-zinc-900/60 p-1.5 rounded-md border border-zinc-800/40">
                            {log.details}
                          </p>
                        )}
                        {log.errorMessage && (
                          <p className="text-[10px] text-rose-400 mt-1 bg-rose-950/20 p-1.5 rounded-md border border-rose-500/15 font-mono break-all">
                            {log.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
