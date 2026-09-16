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
  ChevronRight,
  Plus,
  Trash2,
  PowerOff,
  Bell
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { 
  Inscripcio, 
  SistemaConfig, 
  CategoriaParella, 
  EstatPagament, 
  MobileScannerSession, 
  MobileConnectionStatus 
} from '../types';
import { useActiveYear } from '../hooks/useActiveYear';
import { supabase, getSupabaseInscripcionByCodeOrId, getDniSignedUrl } from '../supabaseClient';
import { 
  buildMobilePairingUrl, 
  extractAndValidateCode, 
  apiCreateSession, 
  apiPollSession, 
  apiDisconnectMobile
} from '../utils/scannerSync';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import AdminFicha from './AdminFicha';

interface AdminScannerProps {
  inscripcions: Inscripcio[];
  config?: SistemaConfig;
  initialOpenPairing?: boolean;
  onSelectInscripcio: (id: string, record?: Inscripcio) => void;
  onBack: () => void;
  onAddLog?: (txt: string) => void;
  onSaveInscripcio?: (updatedRecord: Inscripcio) => void;
}

interface QueuedScanItem {
  scanId: string;
  code: string;
  mobileName: string;
  mobileId: string;
  timestamp: number;
  record?: Inscripcio | null;
}

const SESSIONS_STORAGE_KEY = 'tast_multi_mobile_scanner_sessions_v1';

function createNewMobileSession(index: number): MobileScannerSession {
  const mobileId = `mob_${index}_${Math.random().toString(36).substring(2, 6)}`;
  const syncKey = Math.random().toString(36).substring(2, 8).toUpperCase();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  return {
    sessionId,
    mobileId,
    mobileName: `Mòbil ${index}`,
    syncKey,
    status: 'esperant_connexio',
    createdAt: now,
    expiresAt: now + 60 * 60 * 1000, // 60 minutes TTL
    lastPingPc: now,
    lastPingMobile: 0,
    scansCount: 0
  };
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

  // 1. Multi-Mobile Sessions State (Map<string, MobileScannerSession> by sessionId)
  const [sessions, setSessions] = useState<Map<string, MobileScannerSession>>(() => {
    const map = new Map<string, MobileScannerSession>();
    try {
      const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
      if (raw) {
        const parsed: MobileScannerSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((s: MobileScannerSession) => map.set(s.sessionId, s));
          return map;
        }
      }
    } catch (e) {}

    // Default: initialize Mobile 1
    const mob1 = createNewMobileSession(1);
    map.set(mob1.sessionId, mob1);
    return map;
  });

  // Keep a ref of sessions for event listeners & timers to access fresh state
  const sessionsRef = useRef<Map<string, MobileScannerSession>>(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
    try {
      const arr: MobileScannerSession[] = Array.from(sessions.values());
      sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
  }, [sessions]);

  // Active mobile selected for QR display in pairing modal
  const [selectedMobileForPairing, setSelectedMobileForPairing] = useState<string>(() => {
    const initialArr: MobileScannerSession[] = Array.from(sessions.values());
    return initialArr[0]?.sessionId || '';
  });

  const [showPairingModal, setShowPairingModal] = useState<boolean>(initialOpenPairing);
  const [pairingQrUrls, setPairingQrUrls] = useState<Record<string, string>>({});
  const [copiedLinkFor, setCopiedLinkFor] = useState<string | null>(null);

  // 2. Scan Queue & Deduplication
  const processedScanIdsRef = useRef<Set<string>>(new Set());
  const [scanQueue, setScanQueue] = useState<QueuedScanItem[]>([]);
  const [activeFichaRecord, setActiveFichaRecord] = useState<Inscripcio | null>(null);

  // 3. Standby / Scanned Record Preview State (when ficha is not expanded)
  const [standbyRecord, setStandbyRecord] = useState<Inscripcio | null>(null);
  const [lastScanInfo, setLastScanInfo] = useState<{
    code: string;
    mobileName: string;
    time: string;
    success: boolean;
  } | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    code?: string;
    mobileName?: string;
  } | null>(null);

  // Recent scans activity log
  const [scanHistory, setScanHistory] = useState<Array<{
    code: string;
    name: string;
    mobileName: string;
    time: string;
    success: boolean;
  }>>([]);

  // Manual search fallback input
  const [manualCodeInput, setManualCodeInput] = useState('');

  // Local PC Webcam fallback
  const [usePcCamera, setUsePcCamera] = useState(false);
  const [pcCameraError, setPcCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pcStreamRef = useRef<MediaStream | null>(null);
  const pcAnimFrameId = useRef<number | null>(null);

  // Realtime channels map: Map<sessionId, channel>
  const realtimeChannelsRef = useRef<Map<string, any>>(new Map());
  const isComponentMounted = useRef(true);

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

  // Generate QR data URL for a given session
  const generateQrForSession = useCallback(async (session: MobileScannerSession) => {
    const url = buildMobilePairingUrl(session.syncKey, session.sessionId, session.mobileId, session.mobileName);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 360,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setPairingQrUrls(prev => ({ ...prev, [session.sessionId]: dataUrl }));
    } catch (err) {
      console.error('Error generating pairing QR:', err);
    }
  }, []);

  // Update QR codes whenever sessions change
  useEffect(() => {
    sessions.forEach((sess: MobileScannerSession) => {
      if (!pairingQrUrls[sess.sessionId]) {
        generateQrForSession(sess);
      }
    });
  }, [sessions, generateQrForSession, pairingQrUrls]);

  // Format expiry time display (e.g. 18:45)
  const formatExpiryTime = (timestamp: number | null) => {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // 4. Core Registration Lookup
  const findRegistration = useCallback(async (codeToFind: string): Promise<Inscripcio | null> => {
    // 1. Try in-memory list first
    let record: Inscripcio | null = inscripcions.find(
      i => i.codiSeguiment.toLowerCase() === codeToFind.toLowerCase() ||
           i.id.toLowerCase() === codeToFind.toLowerCase()
    ) || null;

    // 2. Query Supabase for complete record
    try {
      const freshFromDb = await getSupabaseInscripcionByCodeOrId(codeToFind);
      if (freshFromDb) {
        record = freshFromDb;
      }
    } catch (err) {
      console.warn("Database lookup error:", err);
    }

    if (record) {
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
    }

    return record;
  }, [inscripcions]);

  // 5. Process an incoming scan from any connected mobile
  const handleIncomingScan = useCallback(async (
    rawCode: string, 
    mobileName: string, 
    mobileId: string, 
    scanId: string
  ) => {
    if (!rawCode) return;

    // Deduplicate: If this scanId was already handled, ignore duplicate
    if (processedScanIdsRef.current.has(scanId)) {
      console.log('[SCANNER PC] Duplicate scan ignored:', scanId);
      return;
    }
    processedScanIdsRef.current.add(scanId);
    if (processedScanIdsRef.current.size > 500) {
      const firstEntries = Array.from(processedScanIdsRef.current).slice(0, 100);
      firstEntries.forEach(id => processedScanIdsRef.current.delete(id));
    }

    console.log('[SCANNER PC] Processing scan:', { rawCode, mobileName, scanId });

    const validatedCode = extractAndValidateCode(rawCode);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (!validatedCode) {
      playBeep(320, 0.25, 'sawtooth');
      setFeedback({
        type: 'error',
        message: language === 'ca' ? `Format invàlid rebut de ${mobileName}` : `Formato inválido recibido de ${mobileName}`,
        code: rawCode,
        mobileName
      });
      return;
    }

    // Lookup registration
    const record = await findRegistration(validatedCode);

    // Update session metrics in Map
    setSessions(prev => {
      const next = new Map<string, MobileScannerSession>(prev);
      next.forEach((sess: MobileScannerSession, sId: string) => {
        if (sess.mobileId === mobileId || sess.mobileName === mobileName) {
          next.set(sId, {
            ...sess,
            scansCount: sess.scansCount + 1,
            lastScan: {
              code: validatedCode,
              scanId,
              timestamp: Date.now()
            }
          });
        }
      });
      return next;
    });

    if (record) {
      // Success sound
      playBeep(980, 0.15);
      setTimeout(() => playBeep(1320, 0.12), 100);

      // Add to history
      setScanHistory(prev => [
        {
          code: record.codiSeguiment,
          name: `${record.c1Nom} & ${record.c2Nom}`,
          mobileName,
          time: nowStr,
          success: true
        },
        ...prev.slice(0, 19)
      ]);

      if (onAddLog) {
        onAddLog(`[${mobileName}] Escaneig rebut: ${record.codiSeguiment} (${record.c1Nom} & ${record.c2Nom})`);
      }

      setLastScanInfo({
        code: record.codiSeguiment,
        mobileName,
        time: nowStr,
        success: true
      });

      setFeedback({
        type: 'success',
        message: language === 'ca' 
          ? `[${mobileName}] Inscripció trobada: ${record.c1Nom} & ${record.c2Nom}` 
          : `[${mobileName}] Inscripción encontrada: ${record.c1Nom} & ${record.c2Nom}`,
        code: record.codiSeguiment,
        mobileName
      });

      // If a ficha is ALREADY open, enqueue this scan so the secretary doesn't lose current work!
      setActiveFichaRecord(currentFicha => {
        if (currentFicha) {
          console.log('[SCANNER PC] Ficha is currently open; adding scan to queue:', validatedCode);
          setScanQueue(prev => [
            ...prev,
            { scanId, code: validatedCode, mobileName, mobileId, timestamp: Date.now(), record }
          ]);
          return currentFicha;
        } else {
          // No ficha currently open: open directly!
          setStandbyRecord(record);
          return record;
        }
      });

    } else {
      // Not found in database
      playBeep(300, 0.3, 'square');
      setFeedback({
        type: 'error',
        message: language === 'ca'
          ? `[${mobileName}] No s'ha trobat cap inscripció amb el codi: "${validatedCode}"`
          : `[${mobileName}] No se ha encontrado ninguna inscripción con el código: "${validatedCode}"`,
        code: validatedCode,
        mobileName
      });

      setScanHistory(prev => [
        {
          code: validatedCode,
          name: language === 'ca' ? "Inscripció no trobada" : "Inscripción no encontrada",
          mobileName,
          time: nowStr,
          success: false
        },
        ...prev.slice(0, 19)
      ]);
    }
  }, [findRegistration, language, onAddLog]);

  // 6. Handle Closing a Ficha
  // CRITICAL REQUIREMENT: Closing or saving a ficha MUST NOT disconnect any mobile!
  // It returns to "Esperant següent escaneig", keeps Realtime listener alive, and processes next queued scan if any!
  const handleCloseFicha = useCallback(() => {
    setActiveFichaRecord(null);

    // If there is an item in the queue, open it immediately
    setScanQueue(prev => {
      if (prev.length > 0) {
        const [nextItem, ...remaining] = prev;
        setTimeout(() => {
          if (nextItem.record) {
            setActiveFichaRecord(nextItem.record);
            setStandbyRecord(nextItem.record);
          }
        }, 150);
        return remaining;
      }
      return prev;
    });
  }, []);

  const handleSaveFicha = useCallback((updatedRecord: Inscripcio) => {
    if (onSaveInscripcio) {
      onSaveInscripcio(updatedRecord);
    }
    setStandbyRecord(updatedRecord);
    handleCloseFicha();
  }, [onSaveInscripcio, handleCloseFicha]);

  // 7. Subscribe to Supabase Realtime channels for all sessions in Map
  useEffect(() => {
    isComponentMounted.current = true;

    sessions.forEach((session: MobileScannerSession) => {
      const channelId = `remote-scanner:${session.sessionId}`;
      if (realtimeChannelsRef.current.has(session.sessionId)) {
        return; // already subscribed
      }

      if (supabase) {
        try {
          console.log('[SCANNER PC] Subscribing to channel:', channelId, session.mobileName);
          const channel = supabase.channel(channelId);
          realtimeChannelsRef.current.set(session.sessionId, channel);

          channel
            .on('broadcast', { event: 'mobile_status' }, (msg: any) => {
              if (!isComponentMounted.current) return;
              const payload = msg?.payload;
              const newStatus = payload?.status;
              const sMobileId = payload?.mobileId || session.mobileId;
              const sMobileName = payload?.mobileName || session.mobileName;

              console.log('[SCANNER PC] Status broadcast received:', { newStatus, sMobileId, sMobileName });

              setSessions(prev => {
                const next = new Map<string, MobileScannerSession>(prev);
                const curr: MobileScannerSession | undefined = next.get(session.sessionId);
                if (curr) {
                  let mappedStatus: MobileConnectionStatus = 'esperant_connexio';
                  if (newStatus === 'movil_conectado') mappedStatus = 'connectat';
                  else if (newStatus === 'movil_desconectado') mappedStatus = 'desconnectat';
                  else if (newStatus === 'reconnecting') mappedStatus = 'reconnectant';

                  next.set(session.sessionId, {
                    ...curr,
                    status: mappedStatus,
                    lastPingMobile: Date.now(),
                    connectedAt: mappedStatus === 'connectat' ? (curr.connectedAt || Date.now()) : curr.connectedAt
                  });
                }
                return next;
              });
            })
            .on('broadcast', { event: 'scanned_code' }, (msg: any) => {
              if (!isComponentMounted.current) return;
              const payload = msg?.payload;
              const code = payload?.code;
              const sId = payload?.sessionId || session.sessionId;
              const mId = payload?.mobileId || session.mobileId;
              const mName = payload?.mobileName || session.mobileName;
              const scanId = payload?.scanId || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

              // Security check: only accept scans matching this session's syncKey or sessionId
              if (payload?.syncKey && payload.syncKey !== session.syncKey) {
                console.warn('[SCANNER PC] Rejected scan with mismatched syncKey');
                return;
              }

              if (code) {
                handleIncomingScan(code, mName, mId, scanId);
              }
            })
            .subscribe((status) => {
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`[SCANNER PC] Realtime status ${status} for channel ${channelId}`);
              }
            });
        } catch (e) {
          console.warn('Realtime channel subscription error:', e);
        }
      }

      // Also register session on serverless backend
      apiCreateSession(session.sessionId, session.syncKey, session.mobileId, session.mobileName);
    });

    // Cleanup: remove channels for sessions that were deleted from Map
    for (const [sId, ch] of realtimeChannelsRef.current.entries()) {
      if (!sessions.has(sId)) {
        try {
          if (supabase && ch) supabase.removeChannel(ch);
        } catch (e) {}
        realtimeChannelsRef.current.delete(sId);
      }
    }
  }, [sessions, handleIncomingScan]);

  // High-frequency polling fallback (every 1800ms) across all active sessions
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (!isComponentMounted.current) return;

      const currentSessions: MobileScannerSession[] = Array.from(sessionsRef.current.values());
      for (const sess of currentSessions) {
        try {
          const res = await apiPollSession(sess.sessionId, sess.syncKey, false);
          if (!isComponentMounted.current) return;

          if (res.ok) {
            // Update status if serverless has newer status
            if (res.status) {
              setSessions(prev => {
                const next = new Map<string, MobileScannerSession>(prev);
                const cur: MobileScannerSession | undefined = next.get(sess.sessionId);
                if (cur) {
                  let mappedStatus: MobileConnectionStatus = cur.status;
                  if (res.status === 'movil_conectado') mappedStatus = 'connectat';
                  else if (res.status === 'movil_desconectado') mappedStatus = 'desconnectat';
                  else if (res.status === 'sesion_caducada') mappedStatus = 'caducat';

                  if (mappedStatus !== cur.status) {
                    next.set(sess.sessionId, { ...cur, status: mappedStatus });
                  }
                }
                return next;
              });
            }

            // Process any scans from serverless scan queue
            if (Array.isArray(res.scans) && res.scans.length > 0) {
              for (const queued of res.scans) {
                const scanId = queued.scanId || `queued_${queued.code}_${queued.timestamp}`;
                const mName = sess.mobileName;
                const mId = queued.mobileId || sess.mobileId;
                handleIncomingScan(queued.code, mName, mId, scanId);
              }
            } else if (res.code) {
              const scanId = `api_scan_${Date.now()}_${res.code}`;
              handleIncomingScan(res.code, sess.mobileName, sess.mobileId, scanId);
            }
          }
        } catch (e) {
          // network offline silent
        }
      }
    }, 1800);

    return () => {
      clearInterval(pollInterval);
    };
  }, [handleIncomingScan]);

  // Clean all channels ONLY when exiting the entire scanner panel to return to Dashboard!
  useEffect(() => {
    return () => {
      isComponentMounted.current = false;
      stopPcCamera();
      if (supabase) {
        realtimeChannelsRef.current.forEach(ch => {
          try { supabase.removeChannel(ch); } catch (e) {}
        });
        realtimeChannelsRef.current.clear();
      }
    };
  }, []);

  // 8. Management Actions: Add Mobile, Disconnect Mobile, Disconnect All
  const handleAddNewMobile = () => {
    const newIndex = sessions.size + 1;
    const newSession = createNewMobileSession(newIndex);
    setSessions(prev => {
      const next = new Map<string, MobileScannerSession>(prev);
      next.set(newSession.sessionId, newSession);
      return next;
    });
    setSelectedMobileForPairing(newSession.sessionId);
    setShowPairingModal(true);
  };

  const handleDisconnectSingleMobile = async (sessionId: string) => {
    const sess = sessions.get(sessionId);
    if (!sess) return;

    // Broadcast disconnect signal on this mobile's channel
    const channel = realtimeChannelsRef.current.get(sessionId);
    if (channel) {
      try {
        channel.send({
          type: 'broadcast',
          event: 'disconnect_mobile',
          payload: { sessionId, mobileId: sess.mobileId, timestamp: Date.now() }
        }).catch(() => {});
      } catch (e) {}
    }

    // Call API disconnect
    apiDisconnectMobile(sessionId, sess.syncKey, sess.mobileId);

    // Update status in map
    setSessions(prev => {
      const next = new Map<string, MobileScannerSession>(prev);
      const target: MobileScannerSession | undefined = next.get(sessionId);
      if (target) {
        next.set(sessionId, { ...target, status: 'desconnectat' });
      }
      return next;
    });

    if (onAddLog) {
      onAddLog(`[${sess.mobileName}] Desconnectat pel PC de Secretaria.`);
    }
  };

  const handleDisconnectAllMobiles = async () => {
    const sessionIds = Array.from(sessions.keys()) as string[];
    for (const sessionId of sessionIds) {
      handleDisconnectSingleMobile(sessionId);
    }
  };

  const handleRemoveMobile = (sessionId: string) => {
    if (sessions.size <= 1) return; // Keep at least one
    handleDisconnectSingleMobile(sessionId);
    setSessions(prev => {
      const next = new Map<string, MobileScannerSession>(prev);
      next.delete(sessionId);
      return next;
    });
    if (selectedMobileForPairing === sessionId) {
      const remaining = (Array.from(sessions.keys()) as string[]).filter((id: string) => id !== sessionId);
      if (remaining.length > 0) setSelectedMobileForPairing(remaining[0]);
    }
  };

  const handleReconnectMobile = async (sessionId: string) => {
    const sess = sessions.get(sessionId);
    if (!sess) return;
    const newKey = Math.random().toString(36).substring(2, 8).toUpperCase();
    const updated: MobileScannerSession = {
      ...sess,
      syncKey: newKey,
      status: 'esperant_connexio',
      expiresAt: Date.now() + 60 * 60 * 1000
    };

    setSessions(prev => {
      const next = new Map<string, MobileScannerSession>(prev);
      next.set(sessionId, updated);
      return next;
    });

    await apiCreateSession(sessionId, newKey, sess.mobileId, sess.mobileName);
    generateQrForSession(updated);
    setSelectedMobileForPairing(sessionId);
    setShowPairingModal(true);
  };

  // 9. Local PC Webcam scanning logic
  const startPcCamera = async () => {
    setPcCameraError(null);
    try {
      setUsePcCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      pcStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        pcAnimFrameId.current = requestAnimationFrame(scanPcFrame);
      }
    } catch (e: any) {
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
            const scanId = `pc_cam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            handleIncomingScan(code.data.trim(), 'PC Webcam', 'pc_cam', scanId);
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
    const scanId = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    handleIncomingScan(code, 'Teclat PC', 'manual', scanId);
  };

  // Status helper for active mobile sessions summary
  const sessionsArray: MobileScannerSession[] = Array.from(sessions.values());
  const connectedCount = sessionsArray.filter((s: MobileScannerSession) => s.status === 'connectat').length;
  const currentPairingSession: MobileScannerSession = sessions.get(selectedMobileForPairing) || sessionsArray[0];

  // ================= RENDER IF FULL FICHA IS CURRENTLY ACTIVE =================
  // By rendering AdminFicha right here, AdminScanner NEVER unmounts, Realtime channels stay continuous,
  // and mobile cameras never pause or lose connection!
  if (activeFichaRecord) {
    return (
      <div className="space-y-4" id="admin-scanner-ficha-view">
        {/* Floating Multi-Mobile Notification Bar on top of active ficha */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-white shadow-lg sticky top-2 z-40">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs font-bold text-emerald-400">
              {language === 'ca' 
                ? `${connectedCount} ${connectedCount === 1 ? 'mòbil connectat' : 'mòbils connectats'} a punt` 
                : `${connectedCount} ${connectedCount === 1 ? 'móvil conectado' : 'móviles conectados'} listos`}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400">
              {language === 'ca' 
                ? "Els mòbils segueixen amb la càmera activa i poden continuar escanejant." 
                : "Los móviles siguen con la cámara activa y pueden seguir escaneando."}
            </span>
          </div>

          {/* If there are queued scans waiting */}
          {scanQueue.length > 0 && (
            <div className="flex items-center gap-2 bg-[#ff0090]/20 border border-[#ff0090]/40 px-3 py-1.5 rounded-xl animate-pulse">
              <Bell size={14} className="text-[#ff0090]" />
              <span className="text-xs font-bold text-white">
                {language === 'ca' 
                  ? `Nou escaneig de ${scanQueue[0].mobileName}: ${scanQueue[0].code}` 
                  : `Nuevo escaneo de ${scanQueue[0].mobileName}: ${scanQueue[0].code}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = scanQueue[0];
                  setScanQueue(prev => prev.slice(1));
                  if (next.record) {
                    setActiveFichaRecord(next.record);
                  }
                }}
                className="text-[11px] font-bold bg-[#ff0090] text-white px-2 py-0.5 rounded-md hover:bg-[#e0007e] transition cursor-pointer"
              >
                {language === 'ca' ? "Obrir ara" : "Abrir ahora"}
              </button>
              <span className="text-[10px] text-[#ff0090] font-mono font-bold">
                ({scanQueue.length} {language === 'ca' ? 'en cua' : 'en cola'})
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCloseFicha}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ml-auto"
            id="btn-return-scanner-from-ficha"
          >
            <ArrowLeft size={13} />
            {language === 'ca' ? "Tornar a l'escàner" : "Volver al escáner"}
          </button>
        </div>

        {/* Embedded AdminFicha */}
        <AdminFicha 
          registration={activeFichaRecord}
          config={config}
          onBack={handleCloseFicha}
          onSave={handleSaveFicha}
        />
      </div>
    );
  }

  // ================= MAIN MULTI-MOBILE SCANNER DASHBOARD =================
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
            onClick={handleAddNewMobile}
            className="text-xs bg-[#ff0090] hover:bg-[#e0007e] text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-[#ff0090]/20 cursor-pointer"
            id="btn-add-another-mobile"
          >
            <Plus size={15} /> {language === 'ca' ? "+ ENLLAÇAR NOU MÒBIL" : "+ ENLAZAR NUEVO MÓVIL"}
          </button>

          {connectedCount > 0 && (
            <button
              type="button"
              onClick={handleDisconnectAllMobiles}
              className="text-xs bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
              id="btn-disconnect-all-mobiles"
              title={language === 'ca' ? "Desconnectar tots els mòbils a la vegada" : "Desconectar todos los móviles a la vez"}
            >
              <PowerOff size={13} /> {language === 'ca' ? "Desconnectar tots" : "Desconectar todos"}
            </button>
          )}
        </div>

        <div className="text-center">
          <span className="font-mono text-[9px] text-[#ff0090] tracking-widest uppercase font-bold block">
            {language === 'ca' ? "PANEL DE SECRETARIA • VALIDACIÓ MULTI-MÒBIL" : "PANEL DE SECRETARÍA • VALIDACIÓN MULTI-MÓVIL"}
          </span>
          <h2 className="font-sans font-black text-sm tracking-tight text-white flex items-center justify-center gap-1.5 mt-0.5">
            {language === 'ca' ? "Escàners Mòbils Simultanis ⇆ PC Secretaria" : "Escáneres Móviles Simultáneos ⇆ PC Secretaría"}
          </h2>
        </div>

        {/* Global Multi-Mobile Counter Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border flex items-center gap-2 ${
            connectedCount > 0 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connectedCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <span>{connectedCount} {connectedCount === 1 ? 'Mòbil actiu' : 'Mòbils actius'}</span>
          </div>
        </div>
      </div>

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
            className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ================= MULTI-MOBILE SESSIONS STATUS PANEL ================= */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white space-y-4 shadow-lg" id="multi-mobile-management-section">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone size={18} className="text-[#ff0090]" />
            <h3 className="font-bold text-xs uppercase tracking-wide">
              {language === 'ca' ? "Terminals Mòbils Connectats" : "Terminales Móviles Conectados"}
            </h3>
            <span className="font-mono text-[11px] bg-zinc-950 px-2 py-0.5 rounded text-zinc-400 border border-zinc-800">
              {sessions.size} {language === 'ca' ? "configurats" : "configurados"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddNewMobile}
            className="text-xs text-[#ff0090] hover:text-[#e0007e] font-bold flex items-center gap-1 transition cursor-pointer"
            id="btn-add-mobile-link-inline"
          >
            <Plus size={14} />
            {language === 'ca' ? "Enllaçar un altre telèfon" : "Enlazar otro teléfono"}
          </button>
        </div>

        {/* Grid of connected mobiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {sessionsArray.map((sess: MobileScannerSession) => {
            const isConnected = sess.status === 'connectat';
            const isReconnecting = sess.status === 'reconnectant';
            const isDisconnected = sess.status === 'desconnectat';

            return (
              <div 
                key={sess.sessionId}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isConnected 
                    ? 'bg-zinc-950 border-emerald-500/40 shadow-sm shadow-emerald-500/5' 
                    : isDisconnected
                    ? 'bg-zinc-950/70 border-zinc-800 text-zinc-400'
                    : 'bg-zinc-950 border-amber-500/30'
                }`}
                id={`mobile-card-${sess.mobileId}`}
              >
                {/* Mobile Title & Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className={isConnected ? "text-emerald-400" : "text-zinc-500"} />
                    <strong className="text-xs font-black text-white">{sess.mobileName}</strong>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold flex items-center gap-1.5 border ${
                    isConnected 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : isReconnecting
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : isDisconnected
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? 'bg-emerald-400 animate-pulse' :
                      isReconnecting ? 'bg-amber-400 animate-spin' :
                      'bg-rose-400'
                    }`} />
                    {isConnected ? (language === 'ca' ? "Connectat" : "Conectado") :
                     isReconnecting ? (language === 'ca' ? "Reconnectant" : "Reconectando") :
                     isDisconnected ? (language === 'ca' ? "Desconnectat" : "Desconectado") :
                     (language === 'ca' ? "Esperant" : "Esperando")}
                  </span>
                </div>

                {/* Session Info */}
                <div className="text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>{language === 'ca' ? "Clau:" : "Clave:"}</span>
                    <span className="text-white font-bold">{sess.syncKey}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>{language === 'ca' ? "Escanejos:" : "Escaneos:"}</span>
                    <span className="text-emerald-400 font-bold">{sess.scansCount}</span>
                  </div>
                  {sess.lastScan && (
                    <div className="flex justify-between text-zinc-400">
                      <span>{language === 'ca' ? "Últim:" : "Último:"}</span>
                      <span className="text-[#ff0090] font-bold truncate max-w-[130px]">{sess.lastScan.code}</span>
                    </div>
                  )}
                </div>

                {/* Actions per mobile */}
                <div className="pt-2 border-t border-zinc-850 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMobileForPairing(sess.sessionId);
                      setShowPairingModal(true);
                    }}
                    className="flex-1 py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] rounded-lg transition flex items-center justify-center gap-1 border border-zinc-800 cursor-pointer"
                    id={`btn-view-qr-${sess.mobileId}`}
                  >
                    <QrCode size={12} className="text-[#ff0090]" />
                    {language === 'ca' ? "Veure QR" : "Ver QR"}
                  </button>

                  {isConnected ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnectSingleMobile(sess.sessionId)}
                      className="py-1.5 px-2.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 font-bold text-[10px] rounded-lg transition border border-rose-800/40 cursor-pointer"
                      id={`btn-disconnect-${sess.mobileId}`}
                      title={language === 'ca' ? "Desconnectar aquest mòbil" : "Desconectar este móvil"}
                    >
                      {language === 'ca' ? "Desconnectar" : "Desconectar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReconnectMobile(sess.sessionId)}
                      className="py-1.5 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-[10px] rounded-lg transition border border-zinc-800 cursor-pointer flex items-center gap-1"
                      id={`btn-reconnect-${sess.mobileId}`}
                    >
                      <RefreshCw size={11} />
                      {language === 'ca' ? "Reenllaçar" : "Reenlazar"}
                    </button>
                  )}

                  {sessions.size > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMobile(sess.sessionId)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
                      title={language === 'ca' ? "Eliminar aquest terminal" : "Eliminar este terminal"}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Side Controls & Right Side Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT COLUMN: Link State & Manual Controls ================= */}
        <div className="lg:col-span-4 space-y-4">
          
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
                  placeholder="A0001 / J0001 / LE00001"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-[#ff0090]"
                  id="input-scanner-manual-code"
                />
                <button
                  type="submit"
                  disabled={!manualCodeInput.trim()}
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
                    className="w-full py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
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
                  {language === 'ca' ? "Usar càmera integrada del PC" : "Usar cámara integrada del PC"}
                </button>
              )}
              {pcCameraError && (
                <p className="text-[10px] text-rose-400 mt-1 text-center">{pcCameraError}</p>
              )}
            </div>
          </div>

          {/* Recent Scans Activity Log */}
          {scanHistory.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white space-y-3 shadow-md">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                <Clock size={13} />
                {language === 'ca' ? "Historial d'escanejos" : "Historial de escaneos"}
              </h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={async () => {
                      const rec = await findRegistration(item.code);
                      if (rec) setActiveFichaRecord(rec);
                    }}
                    className="p-2 bg-zinc-950 hover:bg-zinc-850 rounded-xl text-xs flex justify-between items-center cursor-pointer border border-zinc-850 transition"
                  >
                    <div className="truncate max-w-[170px]">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-white text-[11px] block">{item.code}</span>
                        <span className="text-[9px] font-mono text-[#ff0090] bg-[#ff0090]/10 px-1 rounded">{item.mobileName}</span>
                      </div>
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
          {standbyRecord ? (
            /* LAST SCANNED REGISTRATION CARD PREVIEW */
            <div className="bg-zinc-900 border-2 border-emerald-500/40 rounded-3xl p-6 text-white space-y-6 shadow-2xl animate-in fade-in duration-150" id="scanned-registration-card">
              
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black px-3 py-1 rounded-lg border border-emerald-500/30">
                      {standbyRecord.codiSeguiment}
                    </span>
                    <span className="bg-fuchsia-950 text-fuchsia-300 font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      {standbyRecord.categoria === CategoriaParella.ADULT 
                        ? (language === 'ca' ? "Parella Adulta" : "Pareja Adulta")
                        : (language === 'ca' ? "Parella Juvenil" : "Pareja Juvenil")}
                    </span>
                    {lastScanInfo && (
                      <span className="bg-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded">
                        {lastScanInfo.mobileName} • {lastScanInfo.time}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black mt-2 text-white tracking-tight">
                    {standbyRecord.c1Nom} {standbyRecord.c1Cognoms} &amp; {standbyRecord.c2Nom} {standbyRecord.c2Cognoms}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveFichaRecord(standbyRecord)}
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
                      {standbyRecord.emailContactoPareja || standbyRecord.c1Email || standbyRecord.c2Email || '—'}
                    </p>
                    <p className="text-zinc-300">
                      <strong className="text-zinc-400 font-normal">{language === 'ca' ? "Telèfon:" : "Teléfono:"}</strong>{' '}
                      {standbyRecord.telefonContactoPareja || standbyRecord.c1Telefon || standbyRecord.c2Telefon || '—'}
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
                      {standbyRecord.preuCalculat || 0}€
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] ${
                      standbyRecord.estatPagament === EstatPagament.PAGAT
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {standbyRecord.estatPagament === EstatPagament.PAGAT
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
                      <strong className="text-zinc-200">{standbyRecord.c1TallaArmilla || '—'} / {standbyRecord.c2TallaArmilla || '—'}</strong>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block font-mono">CORBATÍ</span>
                      <strong className="text-zinc-200">{standbyRecord.teCorbati ? "Sí" : "No"}</strong>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block font-mono">MOCADORS</span>
                      <strong className="text-zinc-200">{standbyRecord.teMocadorsExtra || 0} extra</strong>
                    </div>
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] block font-mono">DOMÀS BALCÓ</span>
                      <strong className="text-zinc-200">{standbyRecord.teDomasBalco ? "Sí" : "No"}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 flex justify-between items-center border-t border-zinc-800">
                <span className="text-xs text-zinc-400 font-sans">
                  {language === 'ca' 
                    ? "Esperant següent escaneig des de qualsevol mòbil..." 
                    : "Esperando siguiente escaneo desde cualquier móvil..."}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFichaRecord(standbyRecord)}
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
                {connectedCount > 0 
                  ? (language === 'ca' ? "Esperant següent escaneig" : "Esperando siguiente escaneo")
                  : (language === 'ca' ? "Esperant connexió de terminals mòbils" : "Esperando conexión de terminales móviles")}
              </h3>
              
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-2 leading-relaxed relative z-10 font-sans">
                {connectedCount > 0
                  ? (language === 'ca' 
                      ? `${connectedCount} mòbil(s) connectat(s). Els terminals tenen la càmera activa i estan a punt per escanejar comprovants QR simultàniament.` 
                      : `${connectedCount} móvil(es) conectado(s). Los terminales tienen la cámara activa y están listos para escanear comprobantes QR simultáneamente.`)
                  : (language === 'ca'
                      ? "Escanegeu el codi QR d'enllaç amb un o diversos telèfons per utilitzar-los com a lectors remots autònoms."
                      : "Escanee el código QR de enlace con uno o varios teléfonos para utilizarlos como lectores remotos autónomos.")}
              </p>

              <div className="mt-6 flex flex-wrap gap-3 justify-center relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    const firstWaiting: MobileScannerSession | undefined = sessionsArray.find((s: MobileScannerSession) => s.status !== 'connectat');
                    setSelectedMobileForPairing(firstWaiting?.sessionId || sessionsArray[0].sessionId);
                    setShowPairingModal(true);
                  }}
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

      {/* ================= PAIRING MODAL: Display QR Code per Mobile ================= */}
      {showPairingModal && currentPairingSession && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" id="pairing-modal-overlay">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4 text-white animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#ff0090]/15 text-[#ff0090] rounded-xl">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="font-sans font-black text-sm text-white uppercase tracking-tight">
                    {language === 'ca' ? `Enllaçar ${currentPairingSession.mobileName} (QR)` : `Enlazar ${currentPairingSession.mobileName} (QR)`}
                  </h3>
                  <p className="text-[9px] text-[#ff0090] font-mono font-bold uppercase tracking-wider">
                    {language === 'ca' ? "CANAL REALTIME INDEPENDENT" : "CANAL REALTIME INDEPENDIENTE"}
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowPairingModal(false)}
                className="text-zinc-500 hover:text-white p-1.5 hover:bg-zinc-800 rounded-xl transition cursor-pointer"
                id="btn-close-pairing-modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mobile Selector Tabs if multiple mobiles configured */}
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800 overflow-x-auto">
              {sessionsArray.map((sess: MobileScannerSession) => (
                <button
                  key={sess.sessionId}
                  type="button"
                  onClick={() => setSelectedMobileForPairing(sess.sessionId)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    selectedMobileForPairing === sess.sessionId
                      ? 'bg-[#ff0090] text-white shadow'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sess.status === 'connectat' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                  {sess.mobileName}
                </button>
              ))}

              <button
                type="button"
                onClick={handleAddNewMobile}
                className="px-2.5 py-1 text-xs text-[#ff0090] hover:text-white hover:bg-[#ff0090]/20 rounded-lg transition font-bold flex items-center gap-1 shrink-0 ml-auto cursor-pointer"
              >
                <Plus size={12} /> {language === 'ca' ? "Nou" : "Nuevo"}
              </button>
            </div>

            {/* Modal Instructions */}
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              {language === 'ca' 
                ? `Escanegeu aquest QR amb el telèfon que actuarà com a ${currentPairingSession.mobileName}. Quan llegeixi el comprovant d'una parella, la fitxa s'obrirà automàticament en aquest PC.` 
                : `Escanee este QR con el teléfono que actuará como ${currentPairingSession.mobileName}. Cuando lea el comprobante de una pareja, la ficha se abrirá automáticamente en este PC.`}
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center bg-zinc-950 p-5 rounded-2xl border border-zinc-800">
              <div className="p-4 bg-white rounded-2xl shadow-2xl flex items-center justify-center min-w-[300px] min-h-[300px] w-[300px] h-[300px] border border-zinc-300" id="qr-code-frame">
                {pairingQrUrls[currentPairingSession.sessionId] ? (
                  <img 
                    src={pairingQrUrls[currentPairingSession.sessionId]}
                    alt={`Pairing QR for ${currentPairingSession.mobileName}`}
                    className="w-[268px] h-[268px] block object-contain select-none"
                    id="admin-pairing-qr-img"
                  />
                ) : (
                  <RotateCw className="animate-spin text-zinc-400" size={32} />
                )}
              </div>

              {/* Status and Expiry inside modal */}
              <div className="mt-4 flex flex-col items-center gap-2 text-center w-full">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className={`px-3 py-1 rounded-full font-mono text-xs font-bold border flex items-center gap-1.5 ${
                    currentPairingSession.status === 'connectat'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${currentPairingSession.status === 'connectat' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span>
                      {currentPairingSession.status === 'connectat' 
                        ? (language === 'ca' ? `${currentPairingSession.mobileName}: Connectat` : `${currentPairingSession.mobileName}: Conectado`)
                        : (language === 'ca' ? "Esperant escaneig del QR..." : "Esperando escaneo del QR...")}
                    </span>
                  </div>

                  {currentPairingSession.expiresAt && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-950/50 border border-emerald-500/30 px-3 py-1 rounded-xl">
                      <Clock size={12} />
                      <span>{language === 'ca' ? "Caduca a les" : "Caduca a las"} {formatExpiryTime(currentPairingSession.expiresAt)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between w-full px-2 pt-1">
                  <span className="font-mono text-[11px] text-zinc-400 select-all">
                    {language === 'ca' ? "CLAU" : "CLAVE"}: <strong className="text-white">TAST-{currentPairingSession.syncKey}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleReconnectMobile(currentPairingSession.sessionId)}
                    className="px-3 py-1 bg-zinc-850 hover:bg-zinc-750 text-zinc-300 hover:text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 border border-zinc-700 cursor-pointer"
                    id="btn-modal-regenerate-qr"
                  >
                    <RefreshCw size={12} />
                    {language === 'ca' ? "Regenerar clau" : "Regenerar clave"}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {(() => {
              const url = buildMobilePairingUrl(
                currentPairingSession.syncKey, 
                currentPairingSession.sessionId, 
                currentPairingSession.mobileId, 
                currentPairingSession.mobileName
              );

              return (
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(url).then(() => {
                          setCopiedLinkFor(currentPairingSession.sessionId);
                          setTimeout(() => setCopiedLinkFor(null), 2000);
                        });
                      }
                    }}
                    className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer"
                    id="btn-copy-pairing-link"
                  >
                    {copiedLinkFor === currentPairingSession.sessionId ? (
                      <>
                        <Check size={14} className="text-emerald-400 stroke-[3]" />
                        <span>{language === 'ca' ? "Enllaç copiat!" : "¡Enlace copiado!"}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>{language === 'ca' ? `Copiar enllaç directe per a ${currentPairingSession.mobileName}` : `Copiar enlace directo para ${currentPairingSession.mobileName}`}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.open(url, '_blank');
                    }}
                    className="w-full py-2 px-4 bg-zinc-950 hover:bg-zinc-850 text-zinc-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-dashed border-zinc-800 cursor-pointer text-center"
                    id="btn-open-mobile-tab"
                  >
                    <ExternalLink size={14} />
                    <span>{language === 'ca' ? `Obrir ${currentPairingSession.mobileName} en pestanya nova (Simulador)` : `Abrir ${currentPairingSession.mobileName} en pestaña nueva (Simulador)`}</span>
                  </button>
                </div>
              );
            })()}

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
