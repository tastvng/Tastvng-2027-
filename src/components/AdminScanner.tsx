/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  QrCode, 
  Camera, 
  AlertTriangle, 
  Smartphone,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Laptop,
  Check,
  RotateCw,
  Clock,
  ShieldCheck,
  User,
  Phone,
  Mail,
  Zap,
  CheckSquare,
  RefreshCw,
  FileText,
  X
} from 'lucide-react';
import { Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, CategoriaParella, SistemaConfig } from '../types';
import { useLanguage } from '../LanguageContext';
import TranslatedText from './TranslatedText';
import jsQR from 'jsqr';

const checkAllMaterialDelivered = (rec: Inscripcio): boolean => {
  const hasC1 = !!rec.c1Talla;
  const hasC2 = !!rec.c2Talla;
  const hasDomas = rec.teDomasBalco;
  const hasMocadors = rec.teMocadorsExtra > 0;

  const c1Ok = hasC1 ? (rec.entregaC1Uniforme ?? (rec.entregaMaterial === EstatInscripcio.ENTREGAT)) : true;
  const c2Ok = hasC2 ? (rec.entregaC2Uniforme ?? (rec.entregaMaterial === EstatInscripcio.ENTREGAT)) : true;
  const domasOk = hasDomas ? (rec.entregaDomas ?? (rec.entregaMaterial === EstatInscripcio.ENTREGAT)) : true;
  const mocadorsOk = hasMocadors ? (rec.entregaMocadors ?? (rec.entregaMaterial === EstatInscripcio.ENTREGAT)) : true;

  return c1Ok && c2Ok && domasOk && mocadorsOk;
};

interface AdminScannerProps {
  inscripcions: Inscripcio[];
  config?: SistemaConfig;
  onSelectInscripcio: (id: string) => void;
  onBack: () => void;
  onAddLog?: (txt: string) => void;
  onSaveInscripcio?: (updatedRecord: Inscripcio) => void;
}

export default function AdminScanner({ 
  inscripcions, 
  config,
  onSelectInscripcio, 
  onBack, 
  onAddLog,
  onSaveInscripcio 
}: AdminScannerProps) {
  const { language } = useLanguage();
  // Simulator active selected phone couple index (dropdown)
  const [selectedMobileId, setSelectedMobileId] = useState<string>(inscripcions[0]?.id || '');

  // Master states representing active parsed signal results on PC Monitor
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [tempRecord, setTempRecord] = useState<Inscripcio | null>(null);
  const [isScanningTransition, setIsScanningTransition] = useState(false);
  const [justSavedNotification, setJustSavedNotification] = useState<string | null>(null);
  const [zoomedDniUrl, setZoomedDniUrl] = useState<string | null>(null);

  // Real webcam camera state fallback
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronous multi-device pairing key (Persisted to prevent unlinking on view toggle)
  const [syncKey] = useState(() => {
    try {
      const savedKey = localStorage.getItem('tast_scanner_sync_key');
      if (savedKey && savedKey.trim().length === 6) {
        return savedKey.trim().toUpperCase();
      }
      const newKey = Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('tast_scanner_sync_key', newKey);
      return newKey;
    } catch (e) {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  });

  const [isLinkedDeviceActive, setIsLinkedDeviceActive] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Lazy-load complete details including heavy DNI blobs when a record is scanned/selected inside AdminScanner
  useEffect(() => {
    if (!tempRecord || !tempRecord.id) return;
    const recordId = tempRecord.id;
    const hasMissingDni = (!tempRecord.c1DniUrl || tempRecord.c1DniUrl.length < 50 || !tempRecord.c2DniUrl || tempRecord.c2DniUrl.length < 50);
    // Only check if we are connected to Supabase
    const isSupabaseConfigured = localStorage.getItem('tast_supabase_url') && localStorage.getItem('tast_supabase_anon_key');
    if (hasMissingDni && isSupabaseConfigured) {
      let active = true;
      async function loadFull() {
        try {
          const { getSupabaseInscripcionById } = await import('../supabaseClient');
          const full = await getSupabaseInscripcionById(recordId);
          if (full && active) {
            setTempRecord(prev => {
              if (!prev || prev.id !== recordId) return prev;
              return {
                ...prev,
                c1DniUrl: full.c1DniUrl || prev.c1DniUrl,
                c2DniUrl: full.c2DniUrl || prev.c2DniUrl
              };
            });
          }
        } catch (err) {
          console.warn("Could not lazy-load detailed DNI for scanned record:", err);
        }
      }
      loadFull();
      return () => {
        active = false;
      };
    }
  }, [tempRecord?.id]);

  // Fallback and manual search states
  const [manualSearchText, setManualSearchText] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Webcam live scanner refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const isWebcamScanning = useRef<boolean>(false);

  // SSE and HTTPS Polling double engine sync service
  useEffect(() => {
    if (!syncKey) return;

    let active = true;
    let eventSource: EventSource | null = null;
    let fallbackInterval: any = null;
    const processedMessages = new Set<string>();

    const processIncomingPayload = (rawData: string) => {
      try {
        const payload = JSON.parse(rawData);
        // Ignore keepalive or non-message events
        if (payload.event && payload.event !== 'message') return;

        // Use ntfy's unique message ID or fallback to constructed key
        const uniqueMsgId = payload.id || `${payload.message || ''}_${payload.time || ''}`;
        if (processedMessages.has(uniqueMsgId)) return;
        processedMessages.add(uniqueMsgId);

        let messageText = '';
        if (payload.message) {
          messageText = payload.message;
        } else if (payload.text) {
          messageText = payload.text;
        } else if (typeof payload === 'string') {
          messageText = payload;
        }

        if (!messageText) return;

        let scannedId = '';
        try {
          const info = JSON.parse(messageText);
          if (info && info.scannedId) {
            scannedId = info.scannedId;
          }
        } catch (e) {
          // Fallback if raw text (not JSON) was published
          scannedId = messageText.trim();
        }

        if (scannedId) {
          triggerSynchronousScan(scannedId);
        }
      } catch (err) {
        // parsing issues
      }
    };

    // 1. Establish SSE Client Channel
    try {
      const url = `https://ntfy.sh/tast_sync_${syncKey}/sse`;
      console.log("Connecting dual sync SSE to ntfy:", url);
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setIsLinkedDeviceActive(true);
      };

      eventSource.onmessage = (event) => {
        if (event.data) {
          processIncomingPayload(event.data);
        }
      };

      eventSource.onerror = () => {
        // Don't log or fail, let the HTTPS fallback handle it silently
      };
    } catch (e) {
      console.warn("EventSource is not supported on this client. Relying on API polling.");
    }

    // 2. Establish high-frequency HTTPS Polling Fallback with non-blocking poll=1 (every 1500ms)
    // This totally bypasses iframe and EventSource sandboxing blocks by doing pure non-blocking fetch!
    let polling = false;
    fallbackInterval = setInterval(async () => {
      if (!active || polling) return;
      polling = true;
      try {
        const res = await fetch(`https://ntfy.sh/tast_sync_${syncKey}/json?since=15s&poll=1`, {
          cache: 'no-store'
        });
        if (!res.ok) return;
        const text = await res.text();
        if (text) {
          setIsLinkedDeviceActive(true);
          const lines = text.trim().split("\n");
          for (const line of lines) {
            if (line.trim()) {
              processIncomingPayload(line);
            }
          }
        }
      } catch (err) {
        // network offline silent
      } finally {
        polling = false;
      }
    }, 1500);

    return () => {
      active = false;
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [syncKey, inscripcions]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sound generator simulation using Web Audio API for a real clerk desktop scan sound!
  const playClerkBeep = (freq = 880, dur = 0.12) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {
      // Audio stream blocked or unsupported in iframe - fail cleanly
    }
  };

  useEffect(() => {
    return () => {
      isWebcamScanning.current = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const scanPCFrame = () => {
    if (!videoRef.current || !streamRef.current || !isWebcamScanning.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            let decodedId = code.data.trim();

            // Support scanning full query parameter URLs or deep-links safely
            if (decodedId.includes('://') || decodedId.includes('?')) {
              try {
                const urlObj = new URL(decodedId);
                const idParam = urlObj.searchParams.get('id') || urlObj.searchParams.get('code') || urlObj.searchParams.get('codi');
                if (idParam) {
                  decodedId = idParam;
                } else {
                  // Fallback: take final segment
                  const pieces = urlObj.pathname.split('/').filter(Boolean);
                  if (pieces.length > 0) {
                    decodedId = pieces[pieces.length - 1];
                  }
                }
              } catch (e) {
                // block
              }
            }

            // Trigger scan on matched ID
            if (decodedId) {
              triggerSynchronousScan(decodedId);
              // Stop camera after scanning successfully to let user view details cleanly
              stopCamera();
              return;
            }
          }
        } catch (e) {
          // ignore frame read errors
        }
      }
    }

    if (isWebcamScanning.current) {
      animationFrameId.current = requestAnimationFrame(scanPCFrame);
    }
  };

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      setUseRealCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } } 
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      isWebcamScanning.current = true;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait a small delay before capturing frames to make sure stream is active
        setTimeout(() => {
          if (isWebcamScanning.current) {
            animationFrameId.current = requestAnimationFrame(scanPCFrame);
          }
        }, 300);
      }
    } catch (e: any) {
      setHasCameraPermission(false);
      isWebcamScanning.current = false;
      setErrorMessage(language === 'ca' 
        ? "Permís de càmera absent o dispositiu de captura ocupat." 
        : "Permiso de cámara ausente o dispositivo de captura ocupado.");
    }
  };

  const stopCamera = () => {
    isWebcamScanning.current = false;
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseRealCamera(false);
  };

  // Perform synchronous data transmission (Scanner triggered!)
  const triggerSynchronousScan = (idOrCode: string) => {
    if (!idOrCode) return;
    const cleanId = idOrCode.trim().toLowerCase();
    
    // Support robust case-insensitive and trimmed checking
    const parentRecord = inscripcions.find(
      i => i.id.trim().toLowerCase() === cleanId || 
           i.codiSeguiment.trim().toLowerCase() === cleanId
    );
    if (!parentRecord) return;

    playClerkBeep(920, 0.15);
    setIsScanningTransition(true);

    if (onAddLog) {
      onAddLog(`Rebuda sol·licitud a PC via QR: ${parentRecord.c1Nom} & ${parentRecord.c2Nom}`);
    }

    // Small transition simulation to visual data sync
    setTimeout(() => {
      setIsScanningTransition(false);
      setScannedId(parentRecord.id);
      // Create local copies of statuses so they can edit this sheet on screen!
      setTempRecord({ ...parentRecord });
    }, 600);
  };

  const handleManualSearch = () => {
    if (!manualSearchText.trim()) return;
    const cleanQuery = manualSearchText.trim().toLowerCase();
    
    // Find matching inscription by exact ID, code tracking, or name patterns
    const match = inscripcions.find(
      i => i.id.trim().toLowerCase() === cleanQuery || 
           i.codiSeguiment.trim().toLowerCase() === cleanQuery ||
           i.codiSeguiment.toLowerCase().includes(cleanQuery) ||
           `${i.c1Nom} ${i.c1Cognoms}`.toLowerCase().includes(cleanQuery) ||
           `${i.c2Nom} ${i.c2Cognoms}`.toLowerCase().includes(cleanQuery)
    );
    
    if (match) {
      setSearchFeedback(null);
      setManualSearchText('');
      triggerSynchronousScan(match.id);
    } else {
      setSearchFeedback(language === 'ca' 
        ? "No s'ha trobat cap inscripció amb aquest criteri." 
        : "No se encontró ninguna inscripción con este criterio.");
    }
  };

  const handleMobileSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedMobileId(newId);
    // If they change, we clear the active PC scan so they can test scanning again!
  };

  // Save changes from within the screen
  const handleSaveFromMonitor = () => {
    if (!tempRecord) return;

    if (onSaveInscripcio) {
      onSaveInscripcio(tempRecord);
    }

    playClerkBeep(1100, 0.08);
    setTimeout(() => playClerkBeep(1400, 0.1), 80);

    const matchName = `${tempRecord.c1Nom} & ${tempRecord.c2Nom}`;
    setJustSavedNotification(language === 'ca' 
      ? `La fitxa de la parella ${matchName} ha estat desada correctament!` 
      : `¡La ficha de la pareja ${matchName} ha sido guardada correctamente!`);
    
    if (onAddLog) {
      onAddLog(language === 'ca'
        ? `✔ Fitxa validada i finalitzada a Secretaria per a: ${matchName}`
        : `✔ Ficha validada y finalizada en Secretaría para: ${matchName}`);
    }

    // Reset monitor with animation success
    setTimeout(() => {
      setJustSavedNotification(null);
      setScannedId(null);
      setTempRecord(null);
    }, 2000);
  };

  // Quick helper to fetch the record displayed inside the phone mockup
  const activePhoneRecord = inscripcions.find(i => i.id === selectedMobileId) || inscripcions[0];

  return (
    <div className="space-y-6" id="admin-scanner-multi-interface">
      {/* Action header bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow-lg">
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              stopCamera();
              onBack();
            }}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            id="btn-back-from-clerk"
          >
            <ArrowLeft size={14} /> {language === 'ca' ? "Tornar al taulell" : "Volver al panel"}
          </button>

          <button
            type="button"
            onClick={() => setShowPairingModal(true)}
            className="text-xs bg-[#ff0090] hover:bg-[#e0007e] text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-[#ff0090]/20 cursor-pointer animate-pulse"
            id="btn-trigger-pairing"
          >
            <Smartphone size={14} /> {language === 'ca' ? "Enllaçar Mòbil (QR)" : "Enlazar Móvil (QR)"}
          </button>
        </div>

        <div className="text-center">
          <span className="font-mono text-[9px] text-[#ff0090] tracking-widest uppercase font-bold block">
            {language === 'ca' ? "XARXA DE VALIDACIÓ SÍNCRONA" : "RED DE VALIDACIÓN SÍNCRONA"}
          </span>
          <h2 className="font-sans font-black text-sm tracking-tight text-white flex items-center justify-center gap-1.5 mt-0.5">
            {language === 'ca' ? "Mapeig Terminal Mòbil ⇆ PC Secretaria" : "Mapeo Terminal Móvil ⇆ PC Secretaría"}
          </h2>
        </div>

        <div className="hidden sm:block text-right">
          <span className={`text-[10px] uppercase font-bold py-1 px-2.5 rounded-lg font-mono flex items-center gap-1.5 tracking-tight ${
            isLinkedDeviceActive 
              ? 'bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse' 
              : 'bg-zinc-800 text-zinc-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLinkedDeviceActive ? 'bg-green-500' : 'bg-zinc-500'}`} />
            {isLinkedDeviceActive 
              ? (language === 'ca' ? 'Port mòbil connectat' : 'Puerto móvil conectado') 
              : (language === 'ca' ? 'Mòbil desconnectat' : 'Móvil desconectado')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ================= COLUMN 1 (Phone Simulator) ================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="text-center">
            <h3 className="font-sans font-extrabold text-xs text-zinc-400 uppercase tracking-widest mb-1">
              {language === 'ca' ? "📟 MÒBIL DE LA PARELLA" : "📟 MÓVIL DE LA PAREJA"}
            </h3>
            <p className="text-[11px] text-zinc-500 font-sans leading-tight">
              {language === 'ca' 
                ? "Simuleu el client mostrant el seu comprovant digital." 
                : "Simule al cliente mostrando su comprobante digital."}
            </p>
          </div>

          {/* Smartphone chassis container */}
          <div className="max-w-xs mx-auto bg-zinc-950 border-4 border-zinc-800 rounded-[38px] p-4 pt-10 pb-10 shadow-2xl relative flex flex-col justify-between text-white border-gradient select-none">
            {/* Selfie camera and speaker dot notch */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-zinc-800 rounded-full flex justify-center items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-zinc-950" />
              <div className="w-8 h-1 bg-zinc-900 rounded-full" />
            </div>

            <div className="space-y-4">
              {/* Couple selector so they can simulate with any registered pair */}
              <div className="space-y-1 bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  {language === 'ca' ? "Tria la parella de la cua:" : "Elija la pareja de la cola:"}
                </label>
                <select 
                  value={selectedMobileId}
                  onChange={handleMobileSelectionChange}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand focus:outline-none cursor-pointer font-sans"
                  id="mobile-pair-switcher"
                >
                  {inscripcions.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.c1Nom} & {i.c2Nom} ({i.codiSeguiment})
                    </option>
                  ))}
                </select>
              </div>

              {activePhoneRecord ? (
                /* Ticket digital receipt rendering inside smartphone context */
                <div className="bg-white text-zinc-900 rounded-2xl p-4 shadow-xl border border-zinc-100 text-xs relative space-y-4 font-sans max-h-[360px] overflow-y-auto">
                  
                  {/* Digital ticket header */}
                  <div className="text-center border-b border-dashed border-zinc-300 pb-2 relative">
                    <span className="font-mono text-[8px] text-[#ff0090] font-bold block tracking-wider">
                      {language === 'ca' ? "COMPROVANT EL TAST 2026" : "COMPROBANTE EL TAST 2026"}
                    </span>
                    <p className="font-bold text-[11px] text-zinc-900 tracking-tight mt-0.5">
                      {language === 'ca' ? "LES COMPARSES DE VILANOVA" : "LAS COMPARSAS DE VILANOVA"}
                    </p>
                    <span className="inline-block mt-1 font-mono text-[10px] bg-[#ff0090]/10 text-[#ff0090] px-2 py-0.5 rounded font-bold">
                      {activePhoneRecord.codiSeguiment}
                    </span>
                  </div>

                  {/* QR rendering on mobile phone layout */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-1.5 bg-zinc-50 rounded-xl border border-zinc-200">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=e6007e&data=${encodeURIComponent(activePhoneRecord.id)}`} 
                        alt="Mobile QR code"
                        className="w-28 h-28 max-w-full block"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Small specs table */}
                  <div className="border-t border-zinc-150 pt-2 space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-bold uppercase font-mono">
                        {language === 'ca' ? "Parella:" : "Pareja:"}
                      </span>
                      <strong className="text-zinc-900 truncate max-w-[150px]">
                        {activePhoneRecord.c1Nom} &amp; {activePhoneRecord.c2Nom}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-bold uppercase font-mono">
                        {language === 'ca' ? "Categoria:" : "Categoría:"}
                      </span>
                      <strong className="text-zinc-800 font-bold font-mono">
                        {activePhoneRecord.categoria}
                      </strong>
                    </div>

                    <div className="flex justify-between border-t border-dotted border-zinc-250 pt-1 text-xs">
                      <span className="text-zinc-900 font-bold uppercase">
                        {language === 'ca' ? "Total a pagar:" : "Total a pagar:"}
                      </span>
                      <strong className="text-[#ff0090] font-black">{activePhoneRecord.preuCalculat}€</strong>
                    </div>
                  </div>

                  {/* Notch notch */}
                  <div className="absolute top-[82px] -left-2 w-4 h-4 bg-zinc-950 rounded-full" />
                  <div className="absolute top-[82px] -right-2 w-4 h-4 bg-zinc-950 rounded-full" />
                </div>
              ) : (
                <div className="p-6 text-center text-zinc-500 font-sans text-xs">
                  {language === 'ca' ? "Sense parelles preinscrites." : "Sin parejas preinscritas."}
                </div>
              )}
            </div>

            {/* Simulated Transmission trigger button on smartphone screen bottom section */}
            <div className="mt-4 pt-1">
              {activePhoneRecord && (
                <button
                  type="button"
                  onClick={() => triggerSynchronousScan(activePhoneRecord.id)}
                  disabled={isScanningTransition}
                  className="w-full bg-[#ff0090] hover:bg-[#e0007e] text-white font-extrabold text-[11px] py-3 rounded-xl transition shadow shadow-brand/20 active:scale-95 flex items-center justify-center gap-1 uppercase tracking-widest"
                  id="mobile-btn-transmit"
                >
                  <Smartphone size={13} className="animate-bounce" />
                  {isScanningTransition 
                    ? (language === 'ca' ? "Transmetent..." : "Transmitiendo...") 
                    : (language === 'ca' ? "Transmetre QR" : "Transmitir QR")}
                </button>
              )}
            </div>
          </div>
        </div>


        {/* ================= COLUMN 2 (PC Dashboard Screen) ================= */}
        <div className="lg:col-span-8 space-y-4">
          <div className="text-center">
            <h3 className="font-sans font-extrabold text-xs text-zinc-400 uppercase tracking-widest mb-1">
              {language === 'ca' ? "🖥️ DE CAIXA AL PC MONITOR" : "🖥️ DE CAJA AL PC MONITOR"}
            </h3>
            <p className="text-[11px] text-zinc-500 font-sans leading-tight">
              {language === 'ca' 
                ? "La pantalla de l'ordinador rep les dades d'admissió en temps real al escanejar." 
                : "La pantalla del ordenador recibe los datos de admisión en tiempo real al escanear."}
            </p>
          </div>

          {/* PC Monitor Bezel Outline */}
          <div className="bg-neutral-900 border-[10px] border-neutral-800 rounded-3xl p-5 shadow-2xl relative text-[#eeeeee] min-h-[540px] flex flex-col justify-between">
            {/* Inner tiny operational chrome header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 text-[10px] text-zinc-400 font-mono">
              <div className="flex items-center gap-1.5">
                <Laptop size={12} className="text-zinc-500" />
                <span>TERMINAL PC_SECRETARIA_MESA_1_OK</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="uppercase text-zinc-500 font-bold whitespace-nowrap">STATUS: ONLINE / LISTEN_PORT_3000</span>
              </div>
            </div>

            {/* Inner viewport container display */}
            <div className="flex-1 flex flex-col justify-between">
              
              {/* Transition effect */}
              {isScanningTransition ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 animate-pulse">
                  <div className="w-16 h-16 rounded-full border-4 border-t-brand border-white/10 animate-spin" />
                  <p className="text-xs font-mono text-zinc-400">
                    {language === 'ca' ? "DESCODIFICANT LECTURA QR... CONNEXIÓ SÍNCRONA..." : "DESCODIFICANDO LECTURA QR... CONEXIÓN SÍNCRONA..."}
                  </p>
                </div>
              ) : justSavedNotification ? (
                /* Success Save flash notice inside PC */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-green-950/20 rounded-2xl border border-green-500/20 text-green-400 space-y-3">
                  <CheckCircle size={44} className="text-green-500 animate-bounce" />
                  <h4 className="font-sans font-bold text-base">
                    {language === 'ca' ? "TRANSACCIÓ CORRECTA AL PC!" : "¡TRANSACCIÓN CORRECTA EN EL PC!"}
                  </h4>
                  <p className="text-xs text-green-200/80 font-mono max-w-sm mx-auto">{justSavedNotification}</p>
                  <p className="text-[10px] text-zinc-500 font-mono pt-4 animate-pulse">
                    {language === 'ca' ? "Actualitzant base de dades local... Escàner lliure." : "Actualizando base de datos local... Escáner libre."}
                  </p>
                </div>
              ) : tempRecord ? (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Ficha title banner */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-950 border border-white/5 p-4 rounded-2xl gap-3">
                    <div>
                      <span className="font-mono text-[8px] text-[#ff0090] tracking-widest font-black uppercase block mb-0.5">
                        {language === 'ca' ? "DADES REBRE DE LA MA REGAST DE SECRETARIA" : "DATOS RECIBIDOS DEL EXPEDIENTE DE SECRETARÍA"}
                      </span>
                      <h4 className="font-sans font-black text-base text-white flex items-center gap-2">
                        {tempRecord.c1Nom} &amp; {tempRecord.c2Nom}
                        <span className={`text-[9px] font-black tracking-tight font-mono px-2 py-0.5 rounded-full uppercase ${
                          tempRecord.categoria === CategoriaParella.ADULT 
                            ? 'bg-[#ff0090]/10 text-white border border-[#ff0090]/35' 
                            : 'bg-cyan-550/10 text-cyan-400 border border-cyan-500/30'
                        }`}>
                          {tempRecord.categoria === CategoriaParella.ADULT 
                            ? (language === 'ca' ? 'Adult' : 'Adulto') 
                            : (language === 'ca' ? 'Juvenil' : 'Juvenil')}
                        </span>
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">
                        {language === 'ca' ? "Registrat el: " : "Registrado el: "} 
                        <span className="text-zinc-300 font-bold">
                          {tempRecord.creadoEn ? new Date(tempRecord.creadoEn).toLocaleString(language === 'ca' ? 'ca-ES' : 'es-ES') : "13/06/2026, 17:34:20"}
                        </span>
                      </p>
                    </div>
                    <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                      <span className="font-mono text-[9px] text-zinc-500 uppercase block">
                        {language === 'ca' ? "Codi Localitzador" : "Código Localizador"}
                      </span>
                      <span className="font-mono font-black text-white text-sm bg-zinc-900 border border-white/10 px-3 py-1 rounded-lg select-all">
                        {tempRecord.codiSeguiment}
                      </span>
                    </div>
                  </div>

                  {/* Informació general columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                    
                    {/* Comparser 1 Sheet card */}
                    <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/2 to-transparent pointer-events-none rounded-bl-3xl flex items-center justify-end pr-3 pt-3">
                        <span className="font-mono text-zinc-800 text-lg font-bold">#1</span>
                      </div>
                      
                      <p className="font-bold text-[10px] text-zinc-400 font-mono uppercase pb-1.5 border-b border-white/5 tracking-wider">
                        {language === 'ca' ? "Representant Titular" : "Representante Titular"}
                      </p>

                      <div className="space-y-1.5">
                        <p className="text-[10px] text-zinc-500 font-mono">{language === 'ca' ? "Nom Sencer:" : "Nombre Completo:"}</p>
                        <p className="font-black text-white text-sm">{tempRecord.c1Nom} {tempRecord.c1Cognoms}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5 min-w-0">
                          <p className="text-[9px] text-zinc-500 font-mono truncate">{language === 'ca' ? "Correu Electrònic:" : "Correo Electrónico:"}</p>
                          <p className="font-bold text-zinc-200 mt-0.5 truncate flex items-center gap-1" title={tempRecord.c1Email}>
                            <Mail size={10} className="text-[#ff0090]" /> {tempRecord.c1Email}
                          </p>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5 min-w-0">
                          <p className="text-[9px] text-zinc-500 font-mono truncate">{language === 'ca' ? "Telèfon Mòbil:" : "Teléfono Móvil:"}</p>
                          <p className="font-bold text-zinc-200 mt-0.5 truncate flex items-center gap-1">
                            <Phone size={10} className="text-[#ff0090]" /> {tempRecord.c1Telefon}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5">
                          <p className="text-[9px] text-zinc-500 font-mono">{language === 'ca' ? "Talla Armilla:" : "Talla Chaleco:"}</p>
                          <p className="font-extrabold text-[#ff0090] text-xs mt-0.5 flex items-center gap-1">
                            <CheckSquare size={11} /> {tempRecord.c1Talla}
                          </p>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5">
                          <p className="text-[9px] text-zinc-500 font-mono">{language === 'ca' ? "Adquisició Vestitori:" : "Adquisición Vestuario:"}</p>
                          <p className="font-bold text-zinc-300 text-[10px] mt-0.5 uppercase tracking-wide">
                            {tempRecord.c1UniformeTipus === 'lloguer' 
                              ? (language === 'ca' ? "租 Lloguer" : "租 Alquiler") 
                              : (language === 'ca' ? "🛒 Compra" : "🛒 Compra")}
                          </p>
                        </div>
                      </div>

                      {/* Minor indicator & Tutor Box for C1 */}
                      {tempRecord.c1EsMenor ? (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1.5 text-[11px] animate-pulse">
                          <p className="font-bold text-amber-400 font-mono uppercase tracking-tight flex items-center gap-1">
                            <AlertTriangle size={12} /> {language === 'ca' ? "PARTICIPANT MENOR D'EDAT" : "PARTICIPANTE MENOR DE EDAD"}
                          </p>
                          <div className="text-zinc-300 space-y-1 pl-1">
                            <p>• {language === 'ca' ? "Tutor Legal: " : "Tutor Legal: "} <strong className="text-white">{tempRecord.c1TutorNom} {tempRecord.c1TutorCognoms}</strong></p>
                            <p>• {language === 'ca' ? "DNI Tutor: " : "DNI Tutor: "} <span className="font-mono text-zinc-150">{tempRecord.c1TutorDni || "N/A"}</span></p>
                            <p>• {language === 'ca' ? "Tel. Tutor: " : "Tel. Tutor: "} <span className="text-zinc-150">{tempRecord.c1TutorTelefon || "N/A"}</span></p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-950/45 p-2 rounded-xl border border-white/5 text-[10px] text-zinc-500 font-mono">
                          🧑 {language === 'ca' ? "Participant adult (Major d'edat)" : "Participante adulto (Mayor de edad)"}
                        </div>
                      )}

                      {/* DNI File layout inside card */}
                      <div className="overflow-hidden rounded-xl border border-white/5 bg-zinc-950/60 p-2.5 space-y-2">
                        <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                          {language === 'ca' ? "VERIFICACIÓ DOCUMENTACIÓ OFICIAL DNI/NIE:" : "VERIFICACIÓN DOCUMENTACIÓN OFICIAL DNI/NIE:"}
                        </span>
                        <div className="flex items-center gap-2.5">
                          {tempRecord.c1DniUrl ? (
                            <div 
                              onClick={() => setZoomedDniUrl(tempRecord.c1DniUrl)}
                              className="relative group overflow-hidden rounded-lg w-16 h-10 bg-zinc-90 w-16 md:w-20 md:h-12 border border-white/10 flex-shrink-0 cursor-zoom-in shadow-md"
                              title={language === 'ca' ? "Clic per ampliar DNI" : "Clic para ampliar DNI"}
                            >
                              <img src={tempRecord.c1DniUrl} alt="DNI Comparser 1" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <Sparkles size={11} className="text-[#ff0090] animate-spin" />
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg w-16 h-10 md:w-20 md:h-12 bg-zinc-900 border border-dashed border-white/10 flex items-center justify-center flex-shrink-0 text-zinc-650">
                              <AlertTriangle size={14} className="text-amber-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[10px] font-bold text-zinc-300 truncate font-mono">
                              {tempRecord.c1DniUrl ? `DNI_P1_${tempRecord.c1Nom.toUpperCase()}.PNG` : (language === 'ca' ? "Sense fitxer pujat" : "Sin archivo subido")}
                            </p>
                            <button 
                              type="button" 
                              onClick={() => setZoomedDniUrl(tempRecord.c1DniUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800')}
                              className="text-[9px] text-[#ff0090] font-black hover:underline tracking-tight block uppercase text-left"
                            >
                              {tempRecord.c1DniUrl ? (language === 'ca' ? "🔍 Auditar Document" : "🔍 Auditar Documento") : (language === 'ca' ? "⚠️ Veure demo genèrica" : "⚠️ Ver demo genérica")}
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Comparser 2 Sheet card */}
                    <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/2 to-transparent pointer-events-none rounded-bl-3xl flex items-center justify-end pr-3 pt-3">
                        <span className="font-mono text-zinc-800 text-lg font-bold">#2</span>
                      </div>

                      <p className="font-bold text-[10px] text-zinc-400 font-mono uppercase pb-1.5 border-b border-white/5 tracking-wider">
                        {language === 'ca' ? "Segon Comparser" : "Segundo Comparsero"}
                      </p>

                      <div className="space-y-1.5">
                        <p className="text-[10px] text-zinc-500 font-mono">{language === 'ca' ? "Nom Sencer:" : "Nombre Completo:"}</p>
                        <p className="font-black text-white text-sm">{tempRecord.c2Nom} {tempRecord.c2Cognoms}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5 min-w-0">
                          <p className="text-[9px] text-zinc-500 font-mono truncate">{language === 'ca' ? "Correu Electrònic:" : "Correo Electrónico:"}</p>
                          <p className="font-bold text-zinc-200 mt-0.5 truncate flex items-center gap-1" title={tempRecord.c2Email}>
                            <Mail size={10} className="text-[#ff0090]" /> {tempRecord.c2Email || "N/A"}
                          </p>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5 min-w-0">
                          <p className="text-[9px] text-zinc-500 font-mono truncate">{language === 'ca' ? "Telèfon Mòbil:" : "Teléfono Móvil:"}</p>
                          <p className="font-bold text-zinc-200 mt-0.5 truncate flex items-center gap-1">
                            <Phone size={10} className="text-[#ff0090]" /> {tempRecord.c2Telefon}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5">
                          <p className="text-[9px] text-zinc-500 font-mono">{language === 'ca' ? "Talla Armilla:" : "Talla Chaleco:"}</p>
                          <p className="font-extrabold text-[#ff0090] text-xs mt-0.5 flex items-center gap-1">
                            <CheckSquare size={11} /> {tempRecord.c2Talla}
                          </p>
                        </div>
                        <div className="bg-zinc-950 p-2 rounded-xl border border-white/5">
                          <p className="text-[9px] text-zinc-500 font-mono">{language === 'ca' ? "Adquisició Vestitori:" : "Adquisición Vestuario:"}</p>
                          <p className="font-bold text-zinc-300 text-[10px] mt-0.5 uppercase tracking-wide">
                            {tempRecord.c2UniformeTipus === 'lloguer' 
                              ? (language === 'ca' ? "租 Lloguer" : "租 Alquiler") 
                              : (language === 'ca' ? "🛒 Compra" : "🛒 Compra")}
                          </p>
                        </div>
                      </div>

                      {/* Minor indicator & Tutor Box for C2 */}
                      {tempRecord.c2EsMenor ? (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1.5 text-[11px] animate-pulse">
                          <p className="font-bold text-amber-400 font-mono uppercase tracking-tight flex items-center gap-1">
                            <AlertTriangle size={12} /> {language === 'ca' ? "PARTICIPANT MENOR D'EDAT" : "PARTICIPANTE MENOR DE EDAD"}
                          </p>
                          <div className="text-zinc-300 space-y-1 pl-1">
                            <p>• {language === 'ca' ? "Tutor Legal: " : "Tutor Legal: "} <strong className="text-white">{tempRecord.c2TutorNom} {tempRecord.c2TutorCognoms}</strong></p>
                            <p>• {language === 'ca' ? "DNI Tutor: " : "DNI Tutor: "} <span className="font-mono text-zinc-150">{tempRecord.c2TutorDni || "N/A"}</span></p>
                            <p>• {language === 'ca' ? "Tel. Tutor: " : "Tel. Tutor: "} <span className="text-zinc-150">{tempRecord.c2TutorTelefon || "N/A"}</span></p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-950/45 p-2 rounded-xl border border-white/5 text-[10px] text-zinc-500 font-mono">
                          🧑 {language === 'ca' ? "Participant adult (Major d'edat)" : "Participante adulto (Mayor de edad)"}
                        </div>
                      )}

                      {/* DNI File layout inside card */}
                      <div className="overflow-hidden rounded-xl border border-white/5 bg-zinc-950/60 p-2.5 space-y-2">
                        <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                          {language === 'ca' ? "VERIFICACIÓ DOCUMENTATION OFICIAL DNI/NIE:" : "VERIFICACIÓN DOCUMENTACIÓN OFICIAL DNI/NIE:"}
                        </span>
                        <div className="flex items-center gap-2.5">
                          {tempRecord.c2DniUrl ? (
                            <div 
                              onClick={() => setZoomedDniUrl(tempRecord.c2DniUrl)}
                              className="relative group overflow-hidden rounded-lg w-16 h-10 bg-zinc-90 w-16 md:w-20 md:h-12 border border-white/10 flex-shrink-0 cursor-zoom-in shadow-md"
                              title={language === 'ca' ? "Clic per ampliar DNI" : "Clic para ampliar DNI"}
                            >
                              <img src={tempRecord.c2DniUrl} alt="DNI Comparser 2" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <Sparkles size={11} className="text-[#ff0090] animate-spin" />
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg w-16 h-10 md:w-20 md:h-12 bg-zinc-900 border border-dashed border-white/10 flex items-center justify-center flex-shrink-0 text-zinc-650">
                              <AlertTriangle size={14} className="text-amber-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[10px] font-bold text-zinc-300 truncate font-mono">
                              {tempRecord.c2DniUrl ? `DNI_P2_${tempRecord.c2Nom.toUpperCase()}.PNG` : (language === 'ca' ? "Sense fitxer pujat" : "Sin archivo subido")}
                            </p>
                            <button 
                              type="button" 
                              onClick={() => setZoomedDniUrl(tempRecord.c2DniUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800')}
                              className="text-[9px] text-[#ff0090] font-black hover:underline tracking-tight block uppercase text-left"
                            >
                              {tempRecord.c2DniUrl ? (language === 'ca' ? "🔍 Auditar Document" : "🔍 Auditar Documento") : (language === 'ca' ? "⚠️ Veure demo genèrica" : "⚠️ Ver demo genérica")}
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* Questionnaire answers section if populated */}
                  {tempRecord.respostesCuestionari && Object.keys(tempRecord.respostesCuestionari).length > 0 && (
                    <div className="p-3 bg-[#121212] rounded-xl border border-white/5 space-y-2 text-xs">
                      <p className="font-bold text-[10px] text-zinc-400 font-mono uppercase pb-1.5 border-b border-white/5 tracking-wider flex items-center gap-1.5">
                        <FileText size={12} className="text-[#ff0090]" />
                        {language === 'ca' ? "📋 RESPOSTES COMPLEMENTÀRIES AL FORMULARI" : "📋 RESPUESTAS COMPLEMENTARIAS AL FORMULARIO"}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(tempRecord.respostesCuestionari).map(([clau, valor]) => {
                          let label = "";
                          const configPregunta = config?.preguntesFormulari?.find(p => p.id === clau);
                          if (configPregunta) {
                            label = configPregunta.titol;
                          } else if (clau === 'preg-1' || clau === 'q-1') {
                            label = language === 'ca' ? "Primera vegada tolerant amb El Tast?" : "¿Primera vez saliendo con El Tast?";
                          } else if (clau === 'preg-2' || clau === 'q-2') {
                            label = language === 'ca' ? "Participació al dinar de germanor de la colla?" : "¿Participación en la comida de hermandad de la colla?";
                          } else if (clau === 'preg-3' || clau === 'q-3') {
                            label = language === 'ca' ? "Intoleràncies alimentàries o comentaris dietètics:" : "Intolerancias alimentarias o comentarios dietéticos:";
                          } else {
                            label = clau;
                          }
                          
                          return (
                            <div key={clau} className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-between gap-2 min-w-0">
                              <span className="text-zinc-500 font-medium truncate shrink-0 max-w-[60%]">
                                <TranslatedText text={label} />:
                              </span>
                              <span className="text-white font-bold font-mono text-right truncate">
                                {typeof valor === 'boolean' 
                                  ? (valor ? (language === 'ca' ? "SÍ" : "SÍ") : (language === 'ca' ? "NO" : "NO")) 
                                  : (
                                    <TranslatedText text={String(valor)} />
                                  )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Uniform selections if populated */}
                  {tempRecord.seleccionsUniforme && Object.keys(tempRecord.seleccionsUniforme).length > 0 && (
                    <div className="p-3 bg-[#121212] rounded-xl border border-white/5 space-y-2 text-xs">
                      <p className="font-bold text-[10px] text-zinc-400 font-mono uppercase pb-1.5 border-b border-white/5 tracking-wider flex items-center gap-1.5">
                        <CheckSquare size={12} className="text-[#ff0090]" />
                        {language === 'ca' ? "👚 INVENTARI ADDICIONAL DE VESTUARI SOL·LICITAT" : "👚 INVENTARIO ADICIONAL DE VESTUARIO SOLICITADO"}
                      </p>
                      <div className="space-y-1.5 text-[11px]">
                        {Object.entries(tempRecord.seleccionsUniforme).map(([nomProducte, dadesVal]) => {
                          const dades = dadesVal as { c1Talla?: string; c2Talla?: string; c1Quantitat?: number; c2Quantitat?: number; c1Tipus?: string; c2Tipus?: string; quantitat?: number };
                          return (
                            <div key={nomProducte} className="flex justify-between items-center bg-zinc-950 p-2.5 rounded-xl border border-white/5">
                              <div>
                                <span className="text-zinc-200 font-extrabold">{nomProducte}</span>
                              </div>
                              <div className="text-right flex items-center gap-3 text-[10px] font-mono text-zinc-400">
                                {dades.c1Talla && (
                                  <div>
                                    P1: <span className="text-white bg-[#ff0090]/15 px-1.5 py-0.5 rounded font-black text-[10px] font-sans">{dades.c1Talla}</span>
                                    {(dades.c1Quantitat || dades.quantitat) && <span className="ml-1 text-[#ff0090]">x{dades.c1Quantitat || dades.quantitat}</span>}
                                    {dades.c1Tipus && <span className="ml-1 text-zinc-500">[{dades.c1Tipus.substring(0,3).toUpperCase()}]</span>}
                                  </div>
                                )}
                                {dades.c2Talla && (
                                  <div>
                                    P2: <span className="text-zinc-100 bg-zinc-800 px-1.5 py-0.5 rounded font-bold text-[10px] font-sans">{dades.c2Talla}</span>
                                    {(dades.c2Quantitat || dades.quantitat) && <span className="ml-1 text-zinc-300">x{dades.c2Quantitat || dades.quantitat}</span>}
                                    {dades.c2Tipus && <span className="ml-1 text-zinc-500">[{dades.c2Tipus.substring(0,3).toUpperCase()}]</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Highly polished receipt accounting breakdown box */}
                  <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 text-xs">
                    <p className="font-bold text-[10px] text-zinc-405 text-zinc-300 font-mono uppercase pb-1.5 mb-2 border-b border-white/5 tracking-wider">
                      {language === 'ca' ? "💵 DESGLOSSAMENT ANALÍTIC DEL REBUT DE COMPRA" : "💵 DESGLOSE ANALÍTICO DEL RECIBO DE COMPRA"}
                    </p>
                    
                    <div className="space-y-2 text-[11px] font-mono text-zinc-450 text-zinc-400">
                      
                      {/* Standard fee block */}
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <CheckCircle size={10} className="text-green-500" />
                          {language === 'ca' ? "Quota general d'inscripció de parella:" : "Cuota general de inscripción de pareja:"}
                        </span>
                        <span className="text-zinc-200 font-bold">
                          {tempRecord.categoria === CategoriaParella.ADULT ? "30.00" : "20.00"}€
                        </span>
                      </div>

                      {/* Balcony flag */}
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${tempRecord.teDomasBalco ? 'bg-[#ff0090]' : 'bg-zinc-750'}`} />
                          {language === 'ca' ? "Estandart / Domàs de Balcó Oficial tast 2026:" : "Estandarte / Domás de Balcón Oficial tast 2026:"}
                        </span>
                        <span className={`font-bold ${tempRecord.teDomasBalco ? 'text-zinc-200' : 'text-zinc-600'}`}>
                          {tempRecord.teDomasBalco ? "+15.00€" : "0.00€"}
                        </span>
                      </div>

                      {/* Scarf element */}
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${tempRecord.teMocadorsExtra > 0 ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-750'}`} />
                          {language === 'ca' ? "Mocadors / Fulards addicionals de colla:" : "Pañuelos / Fulards adicionales de colla:"} 
                          {tempRecord.teMocadorsExtra > 0 && <span className="bg-white/5 px-2 py-0.5 rounded text-[8px] font-bold text-zinc-305">({tempRecord.teMocadorsExtra} u.)</span>}
                        </span>
                        <span className={`font-bold ${tempRecord.teMocadorsExtra > 0 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                          {tempRecord.teMocadorsExtra > 0 ? `+${tempRecord.teMocadorsExtra * 5}.00€` : "0.00€"}
                        </span>
                      </div>

                      {/* Clothing uniform selection */}
                      {(tempRecord.c1UniformeTipus || tempRecord.c2UniformeTipus) && (
                        <div className="flex justify-between items-center bg-zinc-950 p-2 rounded-xl mt-1 border border-white/5">
                          <span className="text-zinc-500 font-bold uppercase text-[9px]">{language === 'ca' ? "KIT COMPARPERS COMPLET VESTIT:" : "KIT COMPARTIDO COMPLETO VESTUARIO:"}</span>
                          <span className="text-emerald-500 font-bold text-[10px] tracking-tight">{language === 'ca' ? "GRATUÏT / SOTA QUOTA" : "GRATUITO / BAJO CUOTA"}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t border-white/10 pt-2.5 mt-2.5 text-xs font-bold text-white">
                        <span className="uppercase text-zinc-150 flex items-center gap-1 text-[11px] font-sans">
                          <Zap size={12} className="text-[#ff0090]" />
                          {language === 'ca' ? "TOTAL QUOTA LIQUIDACIÓN:" : "TOTAL CUOTA LIQUIDACIÓN:"}
                        </span>
                        <span className="text-xl font-black text-[#ff0090] bg-zinc-950/90 border border-white/5 px-3 py-1 rounded-xl shadow-inner font-mono tracking-tight">
                          {tempRecord.preuCalculat}.00€
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ================= INTERACTIVE PC AUDITING FORMS ================= */}
                  <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/5 space-y-4">
                    <span className="block font-mono text-[9px] text-[#ff0090] tracking-widest font-bold uppercase">
                      {language === 'ca' ? "ACCIONS D'ACTUALITZACIÓ EN TEMPS REAL:" : "ACCIONES DE ACTUALIZACIÓN EN TIEMPO REAL:"}
                    </span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* DNI auditing flag selector */}
                      <div className="space-y-1.5 text-xs">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                          {language === 'ca' ? "DNI Documentació" : "DNI Documentación"}
                        </label>
                        <select
                          value={tempRecord.estatDni}
                          onChange={(e) => setTempRecord({ ...tempRecord, estatDni: e.target.value as EstatVerificacio })}
                          className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white tracking-tight cursor-pointer focus:border-[#ff0090]"
                        >
                          <option value={EstatVerificacio.PENDENT}>
                            {language === 'ca' ? "⚠️ PENDENT DE REVISAR" : "⚠️ PENDIENTE DE REVISAR"}
                          </option>
                          <option value={EstatVerificacio.VALIDAT}>
                            {language === 'ca' ? "✔ VALIDAT CORRECTAMENT" : "✔ VALIDADO CORRECTAMENTE"}
                          </option>
                          <option value={EstatVerificacio.REBUTJAT}>
                            {language === 'ca' ? "❌ REBUTJAT (DNI IL·LEGIBLE)" : "❌ RECHAZADO (DNI ILEGIBLE)"}
                          </option>
                        </select>
                      </div>

                      {/* Payment check form */}
                      <div className="space-y-1.5 text-xs">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                          {language === 'ca' ? "Cobrament a Caixa" : "Cobro en Caja"}
                        </label>
                        <select
                          value={tempRecord.estatPagament}
                          onChange={(e) => {
                            const val = e.target.value as EstatPagament;
                            setTempRecord({ 
                              ...tempRecord, 
                              estatPagament: val,
                              // Default to cash if marked paid
                              metodePagament: val === EstatPagament.PAGAT ? MetodePagament.EFECTIU : null
                            });
                          }}
                          className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white tracking-tight cursor-pointer focus:border-[#ff0090]"
                        >
                          <option value={EstatPagament.PENDENT}>
                            {language === 'ca' ? `⚠️ IMPORT DE ${tempRecord.preuCalculat}€ PENDENT` : `⚠️ IMPORTE DE ${tempRecord.preuCalculat}€ PENDIENTE`}
                          </option>
                          <option value={EstatPagament.PAGAT}>
                            {language === 'ca' ? "✔ REGISTRAT COM A PAGAT" : "✔ REGISTRADO COMO PAGADO"}
                          </option>
                        </select>
                      </div>

                      {/* Material delivery form */}
                      <div className="space-y-1.5 text-xs col-span-1 md:col-span-3 bg-zinc-900/40 p-4 rounded-2xl border border-white/5">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                          {language === 'ca' ? "Lliurament de Fulard / Material Escollit" : "Entrega de Pañuelo / Material Elegido"}
                        </label>
                        
                        <div className="flex flex-col xl:flex-row gap-4 pt-1">
                          {/* Left helper overall control */}
                          <div className="xl:w-1/3 space-y-1.5">
                            <span className="text-[10px] text-zinc-400 font-mono block">{language === 'ca' ? "Estat Global:" : "Estado Global:"}</span>
                            <select
                              value={tempRecord.entregaMaterial}
                              onChange={(e) => {
                                const val = e.target.value as EstatInscripcio;
                                const hasC1 = !!tempRecord.c1Talla;
                                const hasC2 = !!tempRecord.c2Talla;
                                const hasDomas = tempRecord.teDomasBalco;
                                const hasMocadors = tempRecord.teMocadorsExtra > 0;
                                setTempRecord({ 
                                  ...tempRecord, 
                                  entregaMaterial: val,
                                  entregaC1Uniforme: val === EstatInscripcio.ENTREGAT ? true : (hasC1 ? tempRecord.entregaC1Uniforme : undefined),
                                  entregaC2Uniforme: val === EstatInscripcio.ENTREGAT ? true : (hasC2 ? tempRecord.entregaC2Uniforme : undefined),
                                  entregaDomas: val === EstatInscripcio.ENTREGAT ? true : (hasDomas ? tempRecord.entregaDomas : undefined),
                                  entregaMocadors: val === EstatInscripcio.ENTREGAT ? true : (hasMocadors ? tempRecord.entregaMocadors : undefined),
                                });
                              }}
                              className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white tracking-tight cursor-pointer focus:border-[#ff0090]"
                            >
                              <option value={EstatInscripcio.PENDENT}>
                                {language === 'ca' ? "⚠️ MATERIAL PARCIAL / PENDENT" : "⚠️ MATERIAL PARCIAL / PENDIENTE"}
                              </option>
                              <option value={EstatInscripcio.ENTREGAT}>
                                {language === 'ca' ? "✔ MATERIAL COMPLET LLIURAT" : "✔ MATERIAL COMPLETO ENTREGADO"}
                              </option>
                            </select>
                          </div>

                          {/* Right side individual checkboxes */}
                          <div className="flex-1 space-y-1.5">
                            <span className="text-[10px] text-zinc-400 font-mono block">{language === 'ca' ? "Selecció de la Comanda realitzada:" : "Selección del Pedido realizado:"}</span>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-neutral-950 p-2.5 rounded-xl border border-white/5">
                              {/* 1. Comparser 1 size */}
                              {tempRecord.c1Talla && (
                                <label className="flex items-center gap-2 text-[11px] font-sans text-zinc-300 hover:text-white cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={tempRecord.entregaC1Uniforme ?? (tempRecord.entregaMaterial === EstatInscripcio.ENTREGAT)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const newRecord = { ...tempRecord, entregaC1Uniforme: checked };
                                      const allChecked = checkAllMaterialDelivered(newRecord);
                                      newRecord.entregaMaterial = allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT;
                                      setTempRecord(newRecord);
                                    }}
                                    className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                                  />
                                  <span>
                                    {language === 'ca' ? "P1 Talla: " : "P1 Talla: "} <strong className="font-mono text-[#ff0090]">{tempRecord.c1Talla}</strong>
                                    {tempRecord.c1UniformeTipus && <span className="text-[9px] text-zinc-500 block">({tempRecord.c1UniformeTipus})</span>}
                                  </span>
                                </label>
                              )}

                              {/* 2. Comparser 2 size */}
                              {tempRecord.c2Talla && (
                                <label className="flex items-center gap-2 text-[11px] font-sans text-zinc-300 hover:text-white cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={tempRecord.entregaC2Uniforme ?? (tempRecord.entregaMaterial === EstatInscripcio.ENTREGAT)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const newRecord = { ...tempRecord, entregaC2Uniforme: checked };
                                      const allChecked = checkAllMaterialDelivered(newRecord);
                                      newRecord.entregaMaterial = allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT;
                                      setTempRecord(newRecord);
                                    }}
                                    className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                                  />
                                  <span>
                                    {language === 'ca' ? "P2 Talla: " : "P2 Talla: "} <strong className="font-mono text-[#ff0090]">{tempRecord.c2Talla}</strong>
                                    {tempRecord.c2UniformeTipus && <span className="text-[9px] text-zinc-500 block">({tempRecord.c2UniformeTipus})</span>}
                                  </span>
                                </label>
                              )}

                              {/* 3. Domàs de balcó */}
                              {tempRecord.teDomasBalco && (
                                <label className="flex items-center gap-2 text-[11px] font-sans text-zinc-300 hover:text-white cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={tempRecord.entregaDomas ?? (tempRecord.entregaMaterial === EstatInscripcio.ENTREGAT)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const newRecord = { ...tempRecord, entregaDomas: checked };
                                      const allChecked = checkAllMaterialDelivered(newRecord);
                                      newRecord.entregaMaterial = allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT;
                                      setTempRecord(newRecord);
                                    }}
                                    className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                                  />
                                  <span>
                                    {language === 'ca' ? "🏡 Domàs de Balcó" : "🏡 Domás de Balcón"}
                                    <span className="text-[9px] text-zinc-500 block">(1 u.)</span>
                                  </span>
                                </label>
                              )}

                              {/* 4. Mocadors Extra */}
                              {tempRecord.teMocadorsExtra > 0 && (
                                <label className="flex items-center gap-2 text-[11px] font-sans text-zinc-300 hover:text-white cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={tempRecord.entregaMocadors ?? (tempRecord.entregaMaterial === EstatInscripcio.ENTREGAT)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const newRecord = { ...tempRecord, entregaMocadors: checked };
                                      const allChecked = checkAllMaterialDelivered(newRecord);
                                      newRecord.entregaMaterial = allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT;
                                      setTempRecord(newRecord);
                                    }}
                                    className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                                  />
                                  <span>
                                    {language === 'ca' ? "🧣 Mocadors Extra" : "🧣 Pañuelos Extra"}
                                    <span className="text-[9px] text-[#ff0090] block">({tempRecord.teMocadorsExtra} u. sol·licitats)</span>
                                  </span>
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Choose payment split option if paid */}
                    {tempRecord.estatPagament === EstatPagament.PAGAT && (
                      <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-between text-xs animate-fadeIn whitespace-nowrap">
                        <span className="text-zinc-400 font-medium">
                          {language === 'ca' ? "Mètode de cobrament a caixa:" : "Método de cobro en caja:"}
                        </span>
                        <div className="flex gap-2 font-mono">
                          <button
                            type="button"
                            onClick={() => setTempRecord({ ...tempRecord, metodePagament: MetodePagament.EFECTIU })}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition ${
                              tempRecord.metodePagament === MetodePagament.EFECTIU 
                                ? 'bg-[#ff0090] text-white' 
                                : 'bg-neutral-950 text-zinc-500 hover:text-white'
                            }`}
                          >
                            {language === 'ca' ? "EFECTIU (Metàl·lic)" : "EFECTIVO (Metálico)"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTempRecord({ ...tempRecord, metodePagament: MetodePagament.BIZUM })}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition ${
                              tempRecord.metodePagament === MetodePagament.BIZUM 
                                ? 'bg-[#ff0090] text-white' 
                                : 'bg-neutral-950 text-zinc-500 hover:text-white'
                            }`}
                          >
                            BIZUM COLLA
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buttons controls row inside PC screen */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScannedId(null);
                        setTempRecord(null);
                      }}
                      className="flex-1 py-3 bg-zinc-950 border border-white/10 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 font-mono uppercase"
                    >
                      {language === 'ca' ? "Desconnectar Fitxa" : "Desconectar Ficha"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFromMonitor}
                      className="flex-1.5 py-3 bg-[#ff0090] hover:bg-[#e0007e] text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-brand/20 uppercase tracking-wider"
                    >
                      <Check size={14} className="stroke-[3]" /> {language === 'ca' ? "Desar i Finalitzar Fitxa" : "Guardar y Finalizar Ficha"}
                    </button>
                  </div>

                  {/* Zoom Document Overlay Modal */}
                  {zoomedDniUrl && (
                    <div 
                      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 transition-all animate-fadeIn" 
                      onClick={() => setZoomedDniUrl(null)}
                      id="dni-zoom-portal-modal"
                    >
                      <div className="absolute top-4 right-4 text-white hover:text-[#ff0090] cursor-pointer p-2 bg-white/5 hover:bg-[#ff0090]/15 rounded-full transition" onClick={() => setZoomedDniUrl(null)}>
                        <X size={24} />
                      </div>
                      <div className="max-w-3xl w-full bg-zinc-950 border border-white/10 rounded-3xl p-5 flex flex-col items-center space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="w-full flex items-center justify-between border-b border-white/5 pb-3">
                          <h5 className="font-sans font-black text-xs text-zinc-400 font-mono tracking-wider uppercase flex items-center gap-2">
                            <ShieldCheck size={14} className="text-[#ff0090]" />
                            {language === 'ca' ? "CONTROL DOCUMENTAL ORIGINAL DNI / NIE DE SECRETARIA" : "CONTROL DOCUMENTAL ORIGINAL DNI / NIE DE SECRETARÍA"}
                          </h5>
                          <button type="button" className="text-xs text-zinc-450 hover:text-white font-mono font-bold px-3 py-1 bg-zinc-90 w-auto bg-zinc-900 rounded-lg hover:bg-neutral-800 transition" onClick={() => setZoomedDniUrl(null)}>
                            {language === 'ca' ? "Tancar" : "Cerrar"}
                          </button>
                        </div>
                        <div className="w-full max-h-[60vh] overflow-auto flex items-center justify-center rounded-2xl bg-zinc-900 border border-white/5 p-2 shadow-inner">
                          <img src={zoomedDniUrl} alt="Zoomed DNI Document" className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-lg" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-center font-sans bg-[#ff0090]/5 p-3 rounded-xl border border-[#ff0090]/20 w-full">
                          <p className="text-[11px] text-zinc-350 leading-relaxed font-semibold">
                            {language === 'ca' 
                              ? "Consell d'Auditoria: Verifiqueu que el nom del titular coincideix literalment amb l'alta i que és resident actual del sector."
                              : "Consejo de Auditoría: Verifique que el nombre del titular coincida literalmente con el alta y que sea residente actual del sector."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                /* ================ STATE A: WAITING SIGNAL / STANDBY RADAR ================ */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950/40 rounded-2xl border border-dashed border-white/5 text-center relative overflow-hidden h-96">
                  
                  {/* Glowing dynamic radar visual effect */}
                  <div className="w-24 h-24 rounded-full bg-[#ff0090]/10 border-2 border-dashed border-[#ff0090]/35 flex items-center justify-center animate-ping duration-3000 absolute" />
                  <div className="w-16 h-16 rounded-full bg-[#ff0090]/20 border border-[#ff0090]/40 flex items-center justify-center relative z-10">
                    <QrCode size={28} className="text-[#ff0090] animate-pulse" />
                  </div>

                  <h3 className="font-sans font-light italic text-sm text-white mt-6 tracking-tight">
                    {language === 'ca' ? "Esperant senyal d'escaneig del " : "Esperando señal de escaneo del "}<span className="text-brand font-black not-italic">{language === 'ca' ? "mòbil" : "móvil"}</span>
                  </h3>
                  <p className="text-zinc-500 text-xs leading-relaxed max-w-sm mt-2 font-sans">
                    {language === 'ca' 
                      ? "Premeu el botó fúcsia del simulador a l'esquerra, o enllaçeu un mòbil real com a escàner autònom des d'aquí!" 
                      : "¡Pulse el botón fucsia del simulador a la izquierda, o enlace un móvil real como escáner autónomo desde aquí!"}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2.5 justify-center relative z-20">
                    <button
                      type="button"
                      onClick={() => setShowPairingModal(true)}
                      className="bg-[#ff0090] hover:bg-[#e0007e] text-white font-bold text-[10px] px-4 py-2 rounded-xl transition flex items-center gap-1.5 uppercase tracking-widest cursor-pointer shadow-lg shadow-[#ff0090]/10 shrink-0"
                    >
                      <Smartphone size={12} className="animate-bounce" /> {language === 'ca' ? "Enllaçar Mòbil (QR)" : "Enlazar Móvil (QR)"}
                    </button>

                    {useRealCamera ? (
                      <div className="space-y-3">
                        <div className="relative w-44 h-28 bg-black rounded-lg overflow-hidden border border-white/20 mx-auto">
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#ff0090] animate-pulse" />
                        </div>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-1.5 bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white rounded-lg text-[10px] font-mono transition resize-none"
                        >
                          {language === 'ca' ? "Aturar Càmera" : "Detener Cámara"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[10px] px-4 py-2 rounded-xl transition border border-white/10 flex items-center gap-1.5 cursor-pointer uppercase tracking-widest shrink-0"
                      >
                        <Camera size={12} className="text-[#ff0090]" /> {language === 'ca' ? "Activar Càmera PC" : "Activar Cámara PC"}
                      </button>
                    )}
                  </div>

                  {/* Fallback search code input panel */}
                  <div className="mt-8 relative z-20 w-full max-w-sm px-4 bg-zinc-900/60 p-4 rounded-2xl border border-white/5 space-y-2">
                    <p className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider text-left">
                      {language === 'ca' ? "O cerqueu manualment pel codi o nom:" : "O busque manualmente por código o nombre:"}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualSearchText}
                        onChange={(e) => {
                          setManualSearchText(e.target.value);
                          setSearchFeedback(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleManualSearch();
                          }
                        }}
                        placeholder="Ex: TAST-2026-1234, Joan..."
                        className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white uppercase font-mono font-bold focus:outline-none focus:border-[#ff0090]"
                        id="input-manual-clerk-search"
                      />
                      <button
                        type="button"
                        onClick={handleManualSearch}
                        className="bg-zinc-850 hover:bg-zinc-800 border border-white/10 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shrink-0"
                        id="btn-manual-clerk-search"
                      >
                        {language === 'ca' ? "Cercar" : "Buscar"}
                      </button>
                    </div>
                    {searchFeedback && (
                      <p className="text-[9px] text-[#ff0090] font-bold text-left animate-pulse">{searchFeedback}</p>
                    )}
                  </div>

                  {errorMessage && (
                    <p className="text-[10px] text-amber-500 font-mono mt-3 absolute bottom-2">{errorMessage}</p>
                  )}

                </div>
              )}

            </div>

            {/* Simulated stand base of the PC Monitor */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-neutral-800 rounded-b-xl border-t border-neutral-700 shadow-md pointer-events-none" />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-40 h-1 bg-neutral-900 rounded-full shadow pointer-events-none" />
          </div>

          {/* Tips log information note */}
          <div className="bg-dark-card border border-white/10 rounded-2xl p-4.5 space-y-2 text-zinc-500 text-[10.5px] leading-relaxed font-sans mt-8">
            <p className="font-bold text-zinc-400 font-mono text-[9px] uppercase tracking-wider flex items-center gap-1">
              {language === 'ca' ? "💡 Informació d'operabilitat síncrona" : "💡 Información de operabilidad síncrona"}
            </p>
            <p>
              {language === 'ca' 
                ? 'Qualsevol canvi en els controls de caixa, DNI o lliurament es desa automàticament a la memòria cau persistent (LocalStorage). Quan premeu "Desar i Finalitzar Fitxa", tots els marcadors s\'actualitzen al feed principal i es tanca la sessió de la teva Mesa per rebre el següent participant en cua!' 
                : 'Cualquier cambio en los controles de caja, DNI o entrega se guarda automáticamente en la memoria caché pragmática (LocalStorage). Al pulsar "Guardar y Finalizar Ficha", todos los marcadores se actualizan en el panel principal y se cierra la sesión para recibir el siguiente participante.'}
            </p>
          </div>
        </div>

      </div>

      {/* ================= 4. PAIRING LINK MODAL ================= */}
      {showPairingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#ff0090]/10 text-[#ff0090] rounded-xl">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 className="font-sans font-black text-sm tracking-tight text-white">
                    {language === 'ca' ? "Enllaçar Mòbil Secretarial" : "Enlazar Móvil Secretarial"}
                  </h3>
                  <p className="text-[8px] text-[#ff0090] font-mono font-bold uppercase tracking-wider">
                    {language === 'ca' ? "Connexió Síncrona Activa" : "Conexión Síncrona Activa"}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowPairingModal(false);
                  setCopiedLink(false);
                }}
                className="text-zinc-500 hover:text-white p-1 hover:bg-zinc-800 rounded-lg transition"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              {language === 'ca' 
                ? "Escanegeu aquest codi QR amb la càmera del vostre mòbil (iPhone o Android) per connectar. Qualsevol comprovant escanejat des de la càmera del vostre telèfon s'obrirà a l'instant en aquest ordinador!" 
                : "Escanee este código QR con la cámara de su móvil (iPhone o Android) para conectar. Cualquier comprobante escaneado desde la cámara de su teléfono se abrirá al instante en este ordenador."}
            </p>

            {/* Micro QR Box code pointing to window link */}
            <div className="flex flex-col items-center justify-center bg-zinc-950 p-4.5 rounded-2xl border border-zinc-850/60">
              <div className="p-2 bg-white rounded-xl shadow-lg border border-white/5">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=e6007e&data=${encodeURIComponent(
                    `${window.location.origin}${window.location.pathname}?mode=mobile-scanner&syncKey=${syncKey}`
                  )}`}
                  alt="Pairing QR code for mobile scanner link"
                  className="w-36 h-36 block rounded"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-mono text-[9px] text-zinc-500 mt-3 bg-zinc-900 px-3 py-1 rounded border border-white/5 select-all">
                {language === 'ca' ? "CLAU" : "CLAVE"}: TAST-{syncKey}
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?mode=mobile-scanner&syncKey=${syncKey}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-white/5 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check size={13} className="text-[#ff0090] stroke-[3]" /> {language === 'ca' ? "Copiat correctament!" : "¡Copiado correctamente!"}
                  </>
                ) : (
                  <>
                    {language === 'ca' ? "Copiar enllaç de sincronització" : "Copiar enlace de sincronización"}
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?mode=mobile-scanner&syncKey=${syncKey}`;
                  window.open(url, '_blank');
                  setShowPairingModal(false);
                }}
                className="w-full py-2 px-4 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-dashed border-zinc-800 cursor-pointer text-center"
              >
                {language === 'ca' ? "Simular mòbil en nova pestanya" : "Simular móvil en nueva pestaña"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
