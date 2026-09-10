/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  Smartphone, 
  QrCode, 
  Camera, 
  RotateCw, 
  CheckCircle, 
  X, 
  AlertTriangle, 
  Check, 
  Search, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  User, 
  Euro, 
  Package, 
  FileText,
  Clock,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { Inscripcio, SistemaConfig, RemoteScannerStatus, CategoriaParella, EstatPagament, EstatInscripcio, EstatVerificacio } from '../types';
import { useActiveYear } from '../hooks/useActiveYear';
import { supabase, getSupabaseInscripcionByCodeOrId, getDniSignedUrl } from '../supabaseClient';
import { buildMobilePairingUrl, extractAndValidateCode, apiCreateSession, apiPollSession } from '../utils/scannerSync';
import jsQR from 'jsqr';

interface AdminScannerProps {
  inscripcions: Inscripcio[];
  config?: SistemaConfig;
  initialOpenPairing?: boolean;
  onSelectInscripcio: (id: string, record?: Inscripcio) => void;
  onBack: () => void;
  onAddLog?: (txt: string) => void;
  onSaveInscripcio?: (updatedRecord: Inscripcio) => void;
}

export default function AdminScanner({ 
  inscripcions, 
  config,
  initialOpenPairing = false,
  onSelectInscripcio, 
  onBack, 
  onAddLog,
  onSaveInscripcio 
}: AdminScannerProps) {
  const { language } = useLanguage();
  const activeYear = useActiveYear();

  // 1. Ephemeral Session Keys
  const [syncKey, setSyncKey] = useState<string>(() => {
    try {
      const savedKey = sessionStorage.getItem('tast_scanner_sync_key');
      if (savedKey && savedKey.trim().length === 6) {
        return savedKey.trim().toUpperCase();
      }
    } catch (e) {}
    const newKey = Math.random().toString(36).substring(2, 8).toUpperCase();
    try { sessionStorage.setItem('tast_scanner_sync_key', newKey); } catch (e) {}
    return newKey;
  });

  const [sessionId, setSessionId] = useState<string>(() => {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  });

  // 2. States & Realtime Status
  const [scannerStatus, setScannerStatus] = useState<RemoteScannerStatus>('esperando_conexion');
  const [showPairingModal, setShowPairingModal] = useState<boolean>(initialOpenPairing);
  const [copiedLink, setCopiedLink] = useState(false);

  // Active scanned result & preview
  const [activeRecord, setActiveRecord] = useState<Inscripcio | null>(null);
  const [isProcessingCode, setIsProcessingCode] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    code?: string;
  } | null>(null);

  // Recent scans activity log
  const [scanHistory, setScanHistory] = useState<Array<{
    code: string;
    name: string;
    time: string;
    success: boolean;
  }>>([]);

  // Manual fallback input
  const [manualCodeInput, setManualCodeInput] = useState('');

  // Local PC Webcam fallback
  const [usePcCamera, setUsePcCamera] = useState(false);
  const [hasPcCameraPermission, setHasPcCameraPermission] = useState<boolean | null>(null);
  const [pcCameraError, setPcCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pcStreamRef = useRef<MediaStream | null>(null);
  const pcAnimFrameId = useRef<number | null>(null);
  const isComponentMounted = useRef(true);
  const realtimeChannelRef = useRef<any>(null);

  // Helper sound effect
  const playBeep = (frequency = 880, duration = 0.12, type: OscillatorType = 'sine') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  // 3. Core Handler: Process a received tracking code or UUID from Mobile or PC Camera
  const handleProcessCode = useCallback(async (rawCode: string) => {
    if (!rawCode || isProcessingCode) return;

    const validatedCode = extractAndValidateCode(rawCode);
    if (!validatedCode) {
      setFeedback({
        type: 'error',
        message: language === 'ca' ? "Format de codi QR invàlid" : "Formato de código QR inválido",
        code: rawCode
      });
      playBeep(320, 0.25, 'sawtooth');
      return;
    }

    setIsProcessingCode(true);
    setScannerStatus('codigo_recibido');

    try {
      // 1. Try finding in loaded local list first for instant display
      let record: Inscripcio | null = inscripcions.find(
        i => i.codiSeguiment.toLowerCase() === validatedCode.toLowerCase() ||
             i.id.toLowerCase() === validatedCode.toLowerCase()
      ) || null;

      // 2. Query Supabase for the freshest, complete record with all fields
      try {
        const freshFromDb = await getSupabaseInscripcionByCodeOrId(validatedCode);
        if (freshFromDb) {
          record = freshFromDb;
        }
      } catch (err) {
        console.warn("Database lookup error:", err);
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (record) {
        // Success: Found matching registration!
        playBeep(980, 0.15);
        setTimeout(() => playBeep(1320, 0.12), 100);

        // Resolve signed URLs for DNI documents if necessary
        if (record.c1DniUrl && !record.c1DniUrl.startsWith('http') && !record.c1DniUrl.startsWith('data:')) {
          try {
            const signed = await getDniSignedUrl(record.c1DniUrl);
            record.c1DniUrl = signed;
          } catch (e) {}
        }
        if (record.c2DniUrl && !record.c2DniUrl.startsWith('http') && !record.c2DniUrl.startsWith('data:')) {
          try {
            const signed = await getDniSignedUrl(record.c2DniUrl);
            record.c2DniUrl = signed;
          } catch (e) {}
        }

        setActiveRecord(record);
        setFeedback({
          type: 'success',
          message: language === 'ca' 
            ? `Inscripció trobada: ${record.c1Nom} & ${record.c2Nom}` 
            : `Inscripción encontrada: ${record.c1Nom} & ${record.c2Nom}`,
          code: record.codiSeguiment
        });

        // Add to history
        setScanHistory(prev => [
          {
            code: record!.codiSeguiment,
            name: `${record!.c1Nom} & ${record!.c2Nom}`,
            time: nowStr,
            success: true
          },
          ...prev.slice(0, 19)
        ]);

        if (onAddLog) {
          onAddLog(`Escàner mòbil: ${record.codiSeguiment} (${record.c1Nom} & ${record.c2Nom})`);
        }

        // Close/minimize pairing modal if open
        setShowPairingModal(false);

        // Requirement D & F: Automatically open the full AdminFicha sheet!
        setTimeout(() => {
          if (onSelectInscripcio && record) {
            onSelectInscripcio(record.id, record);
          }
        }, 500);

      } else {
        // Not found
        playBeep(300, 0.3, 'square');
        setFeedback({
          type: 'error',
          message: language === 'ca'
            ? `No s'ha trobat cap inscripció amb el codi: "${validatedCode}"`
            : `No se ha encontrado ninguna inscripción con el código: "${validatedCode}"`,
          code: validatedCode
        });

        setScanHistory(prev => [
          {
            code: validatedCode,
            name: language === 'ca' ? "Inscripció no trobada" : "Inscripción no encontrada",
            time: nowStr,
            success: false
          },
          ...prev.slice(0, 19)
        ]);
      }
    } catch (err: any) {
      console.error("Error processing code on PC:", err);
      setFeedback({
        type: 'error',
        message: language === 'ca' ? "Error en cercar la inscripció" : "Error al buscar la inscripción"
      });
    } finally {
      setIsProcessingCode(false);
      // Return status to waiting next scan
      setScannerStatus(prev => prev === 'codigo_recibido' ? 'movil_conectado' : prev);
    }
  }, [inscripcions, isProcessingCode, language, onAddLog, onSelectInscripcio]);

  // 4. Initialize Ephemeral Session & Supabase Realtime Channel
  useEffect(() => {
    isComponentMounted.current = true;
    let pollInterval: any = null;

    // Create session on serverless backend
    apiCreateSession(sessionId, syncKey).then(session => {
      if (!isComponentMounted.current) return;
      if (session) {
        setScannerStatus(session.status);
      }
    });

    // Supabase Realtime Broadcast Subscription
    if (supabase) {
      try {
        const channel = supabase.channel(`remote-scanner:${sessionId}`);
        realtimeChannelRef.current = channel;

        channel
          .on('broadcast', { event: 'mobile_status' }, (msg: any) => {
            if (!isComponentMounted.current) return;
            const newStatus = msg?.payload?.status;
            if (newStatus) {
              setScannerStatus(newStatus);
            }
          })
          .on('broadcast', { event: 'scanned_code' }, (msg: any) => {
            if (!isComponentMounted.current) return;
            const code = msg?.payload?.code;
            if (code) {
              handleProcessCode(code);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn("Supabase Realtime subscription error:", err);
      }
    }

    // High-frequency polling fallback (every 1500ms)
    pollInterval = setInterval(async () => {
      if (!isComponentMounted.current) return;
      try {
        const res = await apiPollSession(sessionId, syncKey);
        if (!isComponentMounted.current) return;

        if (res.ok) {
          // Update status
          if (res.status) {
            setScannerStatus(res.status);
          }
          // If a new code was delivered via serverless API
          if (res.code) {
            handleProcessCode(res.code);
          }
        } else if (res.status === 'sesion_caducada') {
          setScannerStatus('sesion_caducada');
        }
      } catch (err) {
        // network offline silent
      }
    }, 1500);

    return () => {
      isComponentMounted.current = false;
      if (pollInterval) clearInterval(pollInterval);
      if (realtimeChannelRef.current && supabase) {
        try {
          supabase.removeChannel(realtimeChannelRef.current);
        } catch (e) {}
      }
    };
  }, [sessionId, syncKey, handleProcessCode]);

  // 5. Generate New Session
  const handleGenerateNewSession = () => {
    const newKey = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newSessId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try { sessionStorage.setItem('tast_scanner_sync_key', newKey); } catch (e) {}
    setSyncKey(newKey);
    setSessionId(newSessId);
    setScannerStatus('esperando_conexion');
    setFeedback(null);
  };

  // 6. Local PC Webcam scanning logic
  const startPcCamera = async () => {
    setPcCameraError(null);
    try {
      setUsePcCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      pcStreamRef.current = stream;
      setHasPcCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        pcAnimFrameId.current = requestAnimationFrame(scanPcFrame);
      }
    } catch (e: any) {
      setHasPcCameraPermission(false);
      setPcCameraError(language === 'ca' ? "Càmera no disponible o permís denegat." : "Cámara no disponible o permiso denegado.");
    }
  };

  const stopPcCamera = () => {
    if (pcAnimFrameId.current) {
      cancelAnimationFrame(pcAnimFrameId.current);
      pcAnimFrameId.current = null;
    }
    if (pcStreamRef.current) {
      pcStreamRef.current.getTracks().forEach(t => t.stop());
      pcStreamRef.current = null;
    }
    setUsePcCamera(false);
  };

  const scanPcFrame = () => {
    if (!videoRef.current || !pcStreamRef.current || !usePcCamera) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data && code.data.trim()) {
            stopPcCamera();
            handleProcessCode(code.data.trim());
            return;
          }
        } catch (e) {}
      }
    }
    pcAnimFrameId.current = requestAnimationFrame(scanPcFrame);
  };

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    const code = manualCodeInput.trim();
    setManualCodeInput('');
    handleProcessCode(code);
  };

  const pairingUrl = buildMobilePairingUrl(syncKey, sessionId);

  // Status visual configurations
  const getStatusConfig = () => {
    switch (scannerStatus) {
      case 'movil_conectado':
        return {
          label: language === 'ca' ? "Mòbil connectat" : "Móvil conectado",
          sublabel: language === 'ca' ? "A punt per rebre codis QR" : "Listo para recibir códigos QR",
          badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dotColor: 'bg-emerald-500 animate-pulse'
        };
      case 'esperando_escaneo':
        return {
          label: language === 'ca' ? "Esperant escaneig" : "Esperando escaneo",
          sublabel: language === 'ca' ? "Càmera del mòbil activa" : "Cámara del móvil activa",
          badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
          dotColor: 'bg-emerald-400 animate-pulse'
        };
      case 'codigo_recibido':
        return {
          label: language === 'ca' ? "Codi rebut" : "Código recibido",
          sublabel: language === 'ca' ? "Processant inscripció..." : "Procesando inscripción...",
          badgeBg: 'bg-[#ff0090]/15 text-[#ff0090] border-[#ff0090]/30',
          dotColor: 'bg-[#ff0090] animate-ping'
        };
      case 'sesion_caducada':
        return {
          label: language === 'ca' ? "Sessió caducada" : "Sesión caducada",
          sublabel: language === 'ca' ? "Genereu un nou codi QR" : "Genere un nuevo código QR",
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          dotColor: 'bg-rose-500'
        };
      case 'movil_desconectado':
        return {
          label: language === 'ca' ? "Mòbil desconnectat" : "Móvil desconectado",
          sublabel: language === 'ca' ? "Torneu a enllaçar el telèfon" : "Vuelve a enlazar el teléfono",
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          dotColor: 'bg-rose-500'
        };
      case 'esperando_conexion':
      default:
        return {
          label: language === 'ca' ? "Esperant connexió" : "Esperando conexión",
          sublabel: language === 'ca' ? "Escanegeu el QR d'enllaç amb el mòbil" : "Escanee el QR de enlace con el móvil",
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dotColor: 'bg-amber-400 animate-pulse'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans select-none" id="admin-scanner-root">
      
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow-lg">
        <div className="flex flex-wrap gap-2.5 items-center">
          <button 
            type="button"
            onClick={() => {
              stopPcCamera();
              onBack();
            }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            id="btn-back-from-scanner"
          >
            <ArrowLeft size={14} /> {language === 'ca' ? "Tornar al taulell" : "Volver al panel"}
          </button>

          <button
            type="button"
            onClick={() => setShowPairingModal(true)}
            className="text-xs bg-[#ff0090] hover:bg-[#e0007e] text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-[#ff0090]/20 cursor-pointer animate-pulse"
            id="btn-enllaçar-mobil-qr"
          >
            <Smartphone size={15} /> {language === 'ca' ? "ENLLAÇAR MÒBIL (QR)" : "ENLAZAR MÓVIL (QR)"}
          </button>
        </div>

        <div className="text-center">
          <span className="font-mono text-[9px] text-[#ff0090] tracking-widest uppercase font-bold block">
            {language === 'ca' ? "PANEL DE SECRETARIA • VALIDACIÓ DE PASSOS" : "PANEL DE SECRETARÍA • VALIDACIÓN DE PASES"}
          </span>
          <h2 className="font-sans font-black text-sm tracking-tight text-white flex items-center justify-center gap-1.5 mt-0.5">
            {language === 'ca' ? "Escàner Mòbil Remot ⇆ PC Secretaria" : "Escáner Móvil Remoto ⇆ PC Secretaría"}
          </h2>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border flex items-center gap-2 ${statusConfig.badgeBg}`}>
            <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
            <span>{statusConfig.label}</span>
          </div>
        </div>
      </div>

      {/* Disconnection Warning Alert */}
      {scannerStatus === 'movil_desconectado' && (
        <div className="bg-rose-950/40 border-2 border-rose-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-white animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase text-rose-300">
                {language === 'ca' ? "El mòbil s'ha desconnectat" : "El móvil se ha desconectado"}
              </h4>
              <p className="text-xs text-zinc-300">
                {language === 'ca' ? "El mòbil s'ha desconnectat. Vuelve a enlazarlo." : "El móvil se ha desconectado. Vuelve a enlazarlo."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPairingModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shrink-0"
            id="btn-relink-mobile"
          >
            {language === 'ca' ? "Tornar a enllaçar" : "Volver a enlazar"}
          </button>
        </div>
      )}

      {/* Dynamic Feedback Banner */}
      {feedback && (
        <div className={`rounded-2xl p-4 border flex items-center justify-between gap-3 transition ${
          feedback.type === 'success' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' :
          feedback.type === 'error' ? 'bg-rose-950/30 border-rose-500/40 text-rose-300' :
          'bg-zinc-900 border-zinc-800 text-zinc-300'
        }`} id="scanner-feedback-banner">
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle size={22} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={22} className="text-rose-400 shrink-0" />
            )}
            <div>
              <p className="text-xs font-black tracking-wide">{feedback.message}</p>
              {feedback.code && (
                <p className="text-[11px] font-mono opacity-80 mt-0.5">
                  {language === 'ca' ? "Codi:" : "Código:"} {feedback.code}
                </p>
              )}
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Grid: Left Side Controls & Right Side Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT COLUMN: Link State & Manual Controls ================= */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Linked Session Info Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-[#ff0090]" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  {language === 'ca' ? "Sessió de Sincronització" : "Sesión de Sincronización"}
                </h3>
              </div>
              <span className="font-mono text-[10px] bg-zinc-950 text-[#ff0090] font-bold px-2 py-0.5 rounded border border-zinc-800">
                TAST-{syncKey}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">{language === 'ca' ? "Estat:" : "Estado:"}</span>
                <span className="font-bold font-mono text-zinc-200">{statusConfig.label}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">{language === 'ca' ? "Mecanisme:" : "Mecanismo:"}</span>
                <span className="font-mono text-[11px] text-zinc-300">Supabase Realtime + API</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">{language === 'ca' ? "Validesa:" : "Validez:"}</span>
                <span className="font-mono text-[11px] text-emerald-400">20 min (auto-renovable)</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowPairingModal(true)}
                className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer"
                id="btn-show-qr-pairing"
              >
                <QrCode size={14} className="text-[#ff0090]" />
                {language === 'ca' ? "Veure QR d'enllaç" : "Ver QR de enlace"}
              </button>

              <button
                type="button"
                onClick={handleGenerateNewSession}
                className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
                id="btn-new-session"
              >
                <RefreshCw size={13} />
                {language === 'ca' ? "Generar nova clau" : "Generar nueva clave"}
              </button>
            </div>
          </div>

          {/* Manual Code Entry & PC Webcam Fallback */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white space-y-4 shadow-md">
            <h3 className="font-bold text-xs uppercase tracking-wide flex items-center gap-2 text-zinc-300 border-b border-zinc-800 pb-3">
              <Search size={15} className="text-[#ff0090]" />
              {language === 'ca' ? "Cerca Manual o Pistola USB" : "Búsqueda Manual o Pistola USB"}
            </h3>

            <form onSubmit={handleManualSearchSubmit} className="space-y-2">
              <label className="block text-[10px] font-mono text-zinc-400 uppercase">
                {language === 'ca' ? "Codi d'inscripció o ID:" : "Código de inscripción o ID:"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  placeholder={`TAST-${activeYear}-0001`}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-[#ff0090]"
                  id="input-scanner-manual-code"
                />
                <button
                  type="submit"
                  disabled={!manualCodeInput.trim() || isProcessingCode}
                  className="px-4 py-2 bg-[#ff0090] hover:bg-[#e0007e] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  id="btn-scanner-submit-manual"
                >
                  {language === 'ca' ? "Cercar" : "Buscar"}
                </button>
              </div>
            </form>

            {/* PC Webcam Switch */}
            <div className="pt-2 border-t border-zinc-800">
              {usePcCamera ? (
                <div className="space-y-3">
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-700">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#ff0090] animate-pulse" />
                  </div>
                  <button
                    type="button"
                    onClick={stopPcCamera}
                    className="w-full py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition"
                  >
                    {language === 'ca' ? "Aturar càmera PC" : "Detener cámara PC"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startPcCamera}
                  className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
                  id="btn-activate-pc-cam"
                >
                  <Camera size={14} className="text-[#ff0090]" />
                  {language === 'ca' ? "Activar càmera integrada del PC" : "Activar cámara integrada del PC"}
                </button>
              )}
              {pcCameraError && (
                <p className="text-[10px] text-rose-400 mt-1 text-center">{pcCameraError}</p>
              )}
            </div>
          </div>

          {/* Recent Scans Mini History */}
          {scanHistory.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white space-y-3 shadow-md">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                <Clock size={13} />
                {language === 'ca' ? "Historial recent d'escaneig" : "Historial reciente de escaneo"}
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleProcessCode(item.code)}
                    className="p-2 bg-zinc-950 hover:bg-zinc-850 rounded-xl text-xs flex justify-between items-center cursor-pointer border border-zinc-850 transition"
                  >
                    <div className="truncate max-w-[170px]">
                      <span className="font-mono font-bold text-white text-[11px] block">{item.code}</span>
                      <span className="text-[10px] text-zinc-400 truncate block">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ================= RIGHT COLUMN: Radar / Live Registration Card ================= */}
        <div className="lg:col-span-8">
          {activeRecord ? (
            /* ACTIVE REGISTRATION CARD FOUND VIA QR SCAN */
            <div className="bg-zinc-900 border-2 border-emerald-500/40 rounded-3xl p-6 text-white space-y-6 shadow-2xl animate-in fade-in duration-150" id="scanned-registration-card">
              
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black px-3 py-1 rounded-lg border border-emerald-500/30">
                      {activeRecord.codiSeguiment}
                    </span>
                    <span className="bg-fuchsia-950 text-fuchsia-300 font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      {activeRecord.categoria === CategoriaParella.ADULT 
                        ? (language === 'ca' ? "Parella Adulta" : "Pareja Adulta")
                        : (language === 'ca' ? "Parella Juvenil" : "Pareja Juvenil")}
                    </span>
                  </div>
                  <h3 className="text-xl font-black mt-2 text-white tracking-tight">
                    {activeRecord.c1Nom} {activeRecord.c1Cognoms} &amp; {activeRecord.c2Nom} {activeRecord.c2Cognoms}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectInscripcio(activeRecord.id, activeRecord)}
                  className="px-5 py-2.5 bg-[#ff0090] hover:bg-[#e0007e] text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-[#ff0090]/25 cursor-pointer shrink-0"
                  id="btn-open-full-ficha"
                >
                  <FileText size={15} />
                  {language === 'ca' ? "Obrir Fitxa Completa" : "Abrir Ficha Completa"}
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Grid with Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Contact & Category */}
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2.5">
                  <h4 className="text-[11px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                    <User size={13} className="text-[#ff0090]" />
                    {language === 'ca' ? "Dades de Contacte" : "Datos de Contacto"}
                  </h4>
                  <div className="space-y-1 text-xs">
                    <p className="text-zinc-300">
                      <strong className="text-zinc-400 font-normal">{language === 'ca' ? "Email:" : "Email:"}</strong>{' '}
                      {activeRecord.emailContactoPareja || activeRecord.c1Email || activeRecord.c2Email || '—'}
                    </p>
                    <p className="text-zinc-300">
                      <strong className="text-zinc-400 font-normal">{language === 'ca' ? "Telèfon:" : "Teléfono:"}</strong>{' '}
                      {activeRecord.telefonContactoPareja || activeRecord.c1Telefon || activeRecord.c2Telefon || '—'}
                    </p>
                  </div>
                </div>

                {/* Logistics & Payment */}
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2.5">
                  <h4 className="text-[11px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                    <Euro size={13} className="text-emerald-400" />
                    {language === 'ca' ? "Estat del Pagament" : "Estado del Pago"}
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-lg text-emerald-400 font-sans">
                      {activeRecord.preuCalculat || 0}€
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] ${
                      activeRecord.estatPagament === EstatPagament.PAGAT
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {activeRecord.estatPagament === EstatPagament.PAGAT
                        ? (language === 'ca' ? "PAGAT" : "PAGADO")
                        : (language === 'ca' ? "PENDENT DE PAGAMENT" : "PENDIENTE DE PAGO")}
                    </span>
                  </div>
                </div>

                {/* Material Details */}
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2.5 md:col-span-2">
                  <h4 className="text-[11px] font-mono uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                    <Package size={13} className="text-[#ff0090]" />
                    {language === 'ca' ? "Material i Complements" : "Material y Complementos"}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block font-mono">ARMILLA</span>
                      <strong className="text-zinc-200">{activeRecord.c1TallaArmilla || '—'} / {activeRecord.c2TallaArmilla || '—'}</strong>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block font-mono">CORBATÍ</span>
                      <strong className="text-zinc-200">{activeRecord.teCorbati ? (language === 'ca' ? "Sí" : "Sí") : "No"}</strong>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block font-mono">MOCADORS</span>
                      <strong className="text-zinc-200">{activeRecord.teMocadorsExtra || 0} extra</strong>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block font-mono">DOMÀS BALCÓ</span>
                      <strong className="text-zinc-200">{activeRecord.teDomasBalco ? (language === 'ca' ? "Sí" : "Sí") : "No"}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 flex justify-between items-center border-t border-zinc-800">
                <span className="text-xs text-zinc-400 font-sans">
                  {language === 'ca' 
                    ? "A punt per al següent escaneig des del mòbil." 
                    : "Listo para el siguiente escaneo desde el móvil."}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectInscripcio(activeRecord.id, activeRecord)}
                  className="text-xs text-[#ff0090] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  {language === 'ca' ? "Validar entrega a la fitxa →" : "Validar entrega en la ficha →"}
                </button>
              </div>

            </div>
          ) : (
            /* STANDBY RADAR / WAITING SCREEN */
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[420px] relative overflow-hidden shadow-lg" id="scanner-radar-standby">
              
              {/* Radar pulse animation circles */}
              <div className="absolute w-64 h-64 rounded-full bg-[#ff0090]/5 border border-[#ff0090]/15 animate-ping duration-3000 pointer-events-none" />
              <div className="absolute w-44 h-44 rounded-full bg-[#ff0090]/10 border border-[#ff0090]/25 flex items-center justify-center pointer-events-none" />

              <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center relative z-10 shadow-xl">
                <QrCode size={36} className="text-[#ff0090] animate-pulse" />
              </div>

              <h3 className="text-base font-black text-white mt-6 tracking-tight relative z-10">
                {statusConfig.label}
              </h3>
              
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-2 leading-relaxed relative z-10 font-sans">
                {scannerStatus === 'movil_conectado' || scannerStatus === 'esperando_escaneo'
                  ? (language === 'ca' 
                      ? "El mòbil està connectat i preparat. Escanegeu el codi QR del comprovant o email per mostrar la fitxa automàticament." 
                      : "El móvil está conectado y preparado. Escanee el código QR del comprobante o email para mostrar la ficha automáticamente.")
                  : (language === 'ca'
                      ? "Premeu “ENLAZAR MÓVIL (QR)” per vincular el vostre smartphone com a lector remot autònom."
                      : "Pulse “ENLAZAR MÓVIL (QR)” para vincular su smartphone como lector remoto autónomo.")}
              </p>

              <div className="mt-6 flex flex-wrap gap-3 justify-center relative z-10">
                <button
                  type="button"
                  onClick={() => setShowPairingModal(true)}
                  className="px-5 py-2.5 bg-[#ff0090] hover:bg-[#e0007e] text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-[#ff0090]/20 cursor-pointer"
                  id="btn-radar-pair-phone"
                >
                  <Smartphone size={15} />
                  {language === 'ca' ? "ENLLAÇAR MÒBIL (QR)" : "ENLAZAR MÓVIL (QR)"}
                </button>

                <button
                  type="button"
                  onClick={startPcCamera}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center gap-2 border border-zinc-700 cursor-pointer"
                  id="btn-radar-pc-camera"
                >
                  <Camera size={15} />
                  {language === 'ca' ? "Usar Càmera PC" : "Usar Cámara PC"}
                </button>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* ================= PAIRING MODAL: Display Secure HTTPS QR Code ================= */}
      {showPairingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" id="pairing-modal-overlay">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-5 text-white animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#ff0090]/15 text-[#ff0090] rounded-xl">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="font-sans font-black text-sm text-white uppercase tracking-tight">
                    {language === 'ca' ? "Enllaçar Mòbil (QR)" : "Enlazar Móvil (QR)"}
                  </h3>
                  <p className="text-[9px] text-[#ff0090] font-mono font-bold uppercase tracking-wider">
                    {language === 'ca' ? "CANAL SEGUR DE TRANSMISSIÓ" : "CANAL SEGURO DE TRANSMISIÓN"}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPairingModal(false)}
                className="text-zinc-500 hover:text-white p-1.5 hover:bg-zinc-800 rounded-xl transition"
                id="btn-close-pairing-modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Instructions */}
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              {language === 'ca' 
                ? "Escanegeu aquest codi QR amb la càmera del vostre telèfon per obrir el lector. Quan escanegeu el QR del comprovant d'un participant, la fitxa completa s'obrirà automàticament en aquest ordinador." 
                : "Escanee este código QR con la cámara de su teléfono para abrir el lector. Cuando escanee el QR del comprobante de un participante, la ficha completa se abrirá automáticamente en este ordenador."}
            </p>

            {/* QR Code Container (Public HTTPS, No Localhost) */}
            <div className="flex flex-col items-center justify-center bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
              <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-fuchsia-500/20">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=e6007e&data=${encodeURIComponent(pairingUrl)}`}
                  alt="Pairing QR code for remote mobile scanner"
                  className="w-48 h-48 block rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Status inside modal */}
              <div className="mt-4 flex flex-col items-center gap-1.5 text-center">
                <div className={`px-3 py-1 rounded-full font-mono text-xs font-bold border flex items-center gap-1.5 ${statusConfig.badgeBg}`}>
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                  <span>{statusConfig.label}</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500 mt-1 select-all">
                  {language === 'ca' ? "CLAU" : "CLAVE"}: TAST-{syncKey}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(pairingUrl).then(() => {
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }).catch(() => {
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    });
                  }
                }}
                className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer"
                id="btn-copy-pairing-link"
              >
                {copiedLink ? (
                  <>
                    <Check size={14} className="text-emerald-400 stroke-[3]" />
                    <span>{language === 'ca' ? "Enllaç copiat al porta-retalls!" : "¡Enlace copiado al portapapeles!"}</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>{language === 'ca' ? "Copiar enllaç directe" : "Copiar enlace directo"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(pairingUrl, '_blank');
                  // We do NOT close the modal immediately so the user can verify the status change to "Móvil conectado" in real-time!
                }}
                className="w-full py-2 px-4 bg-zinc-950 hover:bg-zinc-850 text-zinc-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-dashed border-zinc-800 cursor-pointer text-center"
                id="btn-open-mobile-tab"
              >
                <ExternalLink size={14} />
                <span>{language === 'ca' ? "Provar en una pestanya nova (Simulador)" : "Probar en una pestaña nueva (Simulador)"}</span>
              </button>
            </div>

            <div className="pt-1 text-center">
              <p className="text-[10px] text-zinc-500 font-mono flex items-center justify-center gap-1">
                <ShieldCheck size={12} className="text-emerald-500" />
                {language === 'ca' ? "URL pública encriptada HTTPS sense dades personals" : "URL pública encriptada HTTPS sin datos personales"}
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
