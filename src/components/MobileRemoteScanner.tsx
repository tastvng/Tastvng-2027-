/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone,
  CheckCircle,
  Camera,
  RotateCw,
  AlertTriangle,
  ArrowLeft,
  Zap,
  Check,
  Send,
  Keyboard,
  ShieldCheck,
  X
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { supabase } from '../supabaseClient';
import jsQR from 'jsqr';

interface MobileRemoteScannerProps {
  syncKey: string;
  sessionId: string;
  onBack: () => void;
}

export default function MobileRemoteScanner({ 
  syncKey, 
  sessionId, 
  onBack 
}: MobileRemoteScannerProps) {
  const { language } = useLanguage();
  
  // Connection states: 'connecting' | 'connected' | 'expired' | 'error'
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'expired' | 'error'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Camera states
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  // Transmission states: 'ready' | 'transmitting' | 'success' | 'error'
  const [transmitStatus, setTransmitStatus] = useState<'ready' | 'transmitting' | 'success' | 'error'>('ready');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

  // Manual fallback input
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const isComponentMounted = useRef(true);
  const realtimeChannelRef = useRef<any>(null);

  // 1. Establish session connection with server and Supabase Realtime
  useEffect(() => {
    isComponentMounted.current = true;
    let pingInterval: any = null;

    async function initSession() {
      try {
        setConnectionStatus('connecting');
        const res = await fetch('/api/scanner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mobile_connect',
            sessionId,
            syncKey
          })
        });

        const data = await res.json();
        if (!isComponentMounted.current) return;

        if (res.ok && data.ok) {
          setConnectionStatus('connected');
          setConnectionError(null);
        } else {
          setConnectionStatus(data.status === 'sesion_caducada' ? 'expired' : 'error');
          setConnectionError(data.error || (language === 'ca' ? 'Error en connectar a la sessió' : 'Error al conectar a la sesión'));
        }
      } catch (err: any) {
        if (!isComponentMounted.current) return;
        setConnectionStatus('error');
        setConnectionError(err?.message || (language === 'ca' ? 'Error de xarxa en connectar' : 'Error de red al conectar'));
      }
    }

    initSession();

    // Setup Supabase Realtime Channel if available
    if (supabase) {
      try {
        const channel = supabase.channel(`remote-scanner:${sessionId}`);
        realtimeChannelRef.current = channel;

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'mobile_status',
              payload: { status: 'movil_conectado', syncKey, timestamp: Date.now() }
            }).catch(() => {});
          }
        });
      } catch (e) {
        console.warn('Realtime channel subscription error:', e);
      }
    }

    // Heartbeat ping every 12 seconds to keep connection alive
    pingInterval = setInterval(async () => {
      if (!isComponentMounted.current) return;
      try {
        const res = await fetch('/api/scanner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ping',
            from: 'mobile',
            sessionId,
            syncKey
          })
        });
        const data = await res.json();
        if (data.status === 'sesion_caducada') {
          setConnectionStatus('expired');
        }
      } catch (e) {
        // network glitch
      }
    }, 12000);

    return () => {
      isComponentMounted.current = false;
      if (pingInterval) clearInterval(pingInterval);
      if (realtimeChannelRef.current && supabase) {
        try {
          realtimeChannelRef.current.send({
            type: 'broadcast',
            event: 'mobile_status',
            payload: { status: 'movil_desconectado', syncKey, timestamp: Date.now() }
          }).catch(() => {});
          supabase.removeChannel(realtimeChannelRef.current);
        } catch (e) {}
      }
    };
  }, [sessionId, syncKey, language]);

  // 2. Camera handling
  useEffect(() => {
    startCamera().catch(err => console.error("Unhandled error in startCamera:", err));
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error('Error starting camera on mobile:', err);
      setHasCameraPermission(false);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? (language === 'ca' ? "Permís de càmera denegat. Permeteu l'accés a la càmera al navegador." : "Permiso de cámara denegado. Permita el acceso a la cámara en el navegador.")
          : (language === 'ca' ? "No s'ha pogut iniciar la càmera del mòbil." : "No se ha podido iniciar la cámara del móvil.")
      );
    }
  };

  const stopCamera = () => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // 3. QR Decoding Loop
  const scanFrame = () => {
    if (!videoRef.current || !streamRef.current || !isScanning) {
      if (isScanning) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
      return;
    }

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
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data && code.data.trim()) {
            let cleanCode = code.data.trim();

            // Extract tracking code or ID if formatted as URL query string
            if (cleanCode.includes('://') || cleanCode.includes('?')) {
              try {
                const urlObj = new URL(cleanCode);
                const extracted = urlObj.searchParams.get('codi') || 
                  urlObj.searchParams.get('code') || 
                  urlObj.searchParams.get('id');
                if (extracted) {
                  cleanCode = extracted;
                } else {
                  const parts = urlObj.pathname.split('/').filter(Boolean);
                  if (parts.length > 0) cleanCode = parts[parts.length - 1];
                }
              } catch (e) {}
            }

            if (cleanCode) {
              handleCodeScanned(cleanCode);
              return; // Stop scan loop while transmitting
            }
          }
        } catch (e) {
          // ignore scan frame error
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  // 4. Send scanned code to Desktop PC
  const handleCodeScanned = async (codeToTransmit: string) => {
    if (!codeToTransmit || !isScanning) return;

    setIsScanning(false);
    setTransmitStatus('transmitting');
    setLastScannedCode(codeToTransmit);

    // Haptic feedback if available on smartphone
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([80, 40, 80]);
      } catch (e) {}
    }

    // Audio beep
    playBeepSound();

    try {
      // a) Broadcast via Supabase Realtime for instant zero-latency delivery
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'scanned_code',
          payload: {
            code: codeToTransmit,
            syncKey,
            sessionId,
            timestamp: Date.now()
          }
        }).catch(() => {});
      }

      // b) Send via Serverless Session API (resilient fallback)
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mobile_scan',
          sessionId,
          syncKey,
          code: codeToTransmit
        })
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setTransmitStatus('success');
        setScannedCount(prev => prev + 1);

        // Resume scanning automatically after 1.8 seconds WITHOUT having to re-link!
        setTimeout(() => {
          if (!isComponentMounted.current) return;
          setTransmitStatus('ready');
          setLastScannedCode(null);
          setIsScanning(true);
          animationFrameId.current = requestAnimationFrame(scanFrame);
        }, 1800);
      } else {
        setTransmitStatus('error');
        if (data.status === 'sesion_caducada') {
          setConnectionStatus('expired');
        }
        setTimeout(() => {
          if (!isComponentMounted.current) return;
          setTransmitStatus('ready');
          setIsScanning(true);
          animationFrameId.current = requestAnimationFrame(scanFrame);
        }, 2200);
      }
    } catch (err) {
      console.error('Error transmitting code to PC:', err);
      setTransmitStatus('error');
      setTimeout(() => {
        if (!isComponentMounted.current) return;
        setTransmitStatus('ready');
        setIsScanning(true);
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }, 2200);
    }
  };

  const playBeepSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode('');
    setShowManualInput(false);
    handleCodeScanned(code);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between font-sans selection:bg-[#ff0090] select-none" id="mobile-remote-scanner-root">
      {/* Top Navigation Bar */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <button 
          onClick={onBack}
          className="py-2 px-3 -ml-2 text-zinc-400 hover:text-white flex items-center gap-1.5 font-bold text-xs bg-zinc-800/80 rounded-xl transition"
          id="btn-mobile-exit"
        >
          <ArrowLeft size={16} /> {language === 'ca' ? 'Tancar' : 'Cerrar'}
        </button>

        <div className="text-center flex-1 px-2">
          <span className="font-mono text-[9px] text-[#ff0090] tracking-widest uppercase font-bold block">
            {language === 'ca' ? "TERMINAL MÒBIL REMOT" : "TERMINAL MÓVIL REMOTO"}
          </span>
          <h1 className="text-sm font-black tracking-tight text-white uppercase flex items-center justify-center gap-1">
            {language === 'ca' ? "Escàner QR mòbil" : "Escáner QR móvil"}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
          <span className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
            connectionStatus === 'connecting' ? 'bg-amber-400 animate-spin' :
            'bg-rose-500'
          }`} />
          <span className="text-[10px] font-mono text-zinc-300 font-bold">
            {syncKey}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-between space-y-4">
        
        {/* Connection status banner */}
        <div className={`rounded-2xl border p-3.5 flex items-center gap-3 transition-colors ${
          connectionStatus === 'connected' ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' :
          connectionStatus === 'connecting' ? 'bg-amber-950/30 border-amber-500/30 text-amber-300' :
          'bg-rose-950/30 border-rose-500/30 text-rose-300'
        }`} id="mobile-connection-status-card">
          <div className={`p-2.5 rounded-xl ${
            connectionStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400' :
            connectionStatus === 'connecting' ? 'bg-amber-500/20 text-amber-400' :
            'bg-rose-500/20 text-rose-400'
          }`}>
            <Smartphone size={22} className={connectionStatus === 'connected' ? '' : 'animate-pulse'} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[11px] uppercase tracking-wide opacity-80">
              {language === 'ca' ? "Estat de connexió amb el PC" : "Estado de conexión con el PC"}
            </h3>
            <p className="text-xs font-black mt-0.5 flex items-center gap-1.5 font-sans">
              {connectionStatus === 'connected' && (
                <>
                  <Check size={14} className="stroke-[3] text-emerald-400" />
                  {language === 'ca' ? "Mòbil connectat a l'ordinador" : "Móvil conectado al ordenador"}
                </>
              )}
              {connectionStatus === 'connecting' && (
                <>
                  <RotateCw size={14} className="animate-spin text-amber-400" />
                  {language === 'ca' ? "Connectant a la sessió..." : "Conectando a la sesión..."}
                </>
              )}
              {connectionStatus === 'expired' && (
                <>
                  <AlertTriangle size={14} className="text-rose-400" />
                  {language === 'ca' ? "Sessió caducada. Torneu a enllaçar" : "Sesión caducada. Vuelve a enlazar"}
                </>
              )}
              {connectionStatus === 'error' && (
                <>
                  <AlertTriangle size={14} className="text-rose-400" />
                  {connectionError || (language === 'ca' ? "Error de connexió" : "Error de conexión")}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Live Camera Scanner Viewport */}
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="relative w-full max-w-[320px] aspect-square bg-zinc-900 rounded-3xl overflow-hidden border-2 border-zinc-800 shadow-2xl flex flex-col items-center justify-center">
            
            {hasCameraPermission === null ? (
              <div className="p-6 text-center space-y-3">
                <RotateCw className="animate-spin mx-auto text-zinc-400" size={32} />
                <p className="text-xs text-zinc-400 font-medium">
                  {language === 'ca' ? 'Sol·licitant accés a la càmera...' : 'Solicitando acceso a la cámara...'}
                </p>
              </div>
            ) : hasCameraPermission === false ? (
              <div className="p-6 text-center space-y-3">
                <AlertTriangle className="mx-auto text-rose-500 animate-pulse" size={36} />
                <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                  {cameraError}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2.5 bg-[#ff0090] hover:bg-[#e0007e] text-white rounded-xl text-xs font-bold transition shadow"
                  id="btn-retry-camera"
                >
                  {language === 'ca' ? 'Tornar a provar càmera' : 'Reintentar cámara'}
                </button>
              </div>
            ) : (
              <div className="relative w-full h-full">
                {/* Camera feed */}
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover" 
                  id="mobile-video-stream"
                />

                {/* Target overlay */}
                <div className="absolute inset-0 border-[36px] border-zinc-950/70 pointer-events-none">
                  <div className="w-full h-full border-2 border-dashed border-[#ff0090] rounded-2xl relative shadow-inner">
                    {/* Animated laser line */}
                    {isScanning && (
                      <div className="absolute left-1 right-1 h-0.5 bg-[#ff0090] shadow-[0_0_12px_#ff0090] animate-bounce top-1/2" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Instant HUD Status Banner when Code is Transmitted */}
            {transmitStatus === 'transmitting' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 space-y-2 z-20 animate-in fade-in duration-100">
                <RotateCw size={40} className="animate-spin text-[#ff0090]" />
                <h4 className="font-bold text-sm text-white">
                  {language === 'ca' ? "Enviant a l'ordinador..." : "Enviando al ordenador..."}
                </h4>
                <p className="text-xs font-mono text-[#ff0090] font-bold bg-[#ff0090]/10 px-3 py-1 rounded-lg">
                  {lastScannedCode}
                </p>
              </div>
            )}

            {transmitStatus === 'success' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 space-y-3 z-20 animate-in zoom-in-95 duration-150">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg border border-emerald-500/40">
                  <CheckCircle size={36} className="animate-bounce" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white uppercase tracking-wide">
                    {language === 'ca' ? "Codi enviat correctament" : "Código enviado correctamente"}
                  </h4>
                  <p className="text-xs font-mono text-emerald-400 font-bold mt-1 bg-emerald-950/60 px-3 py-1 rounded-lg inline-block border border-emerald-500/30">
                    {lastScannedCode}
                  </p>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">
                  {language === 'ca' ? "A punt per al següent escaneig..." : "Listo para el siguiente escaneo..."}
                </p>
              </div>
            )}

            {transmitStatus === 'error' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 space-y-2 z-20 animate-in zoom-in-95 duration-150">
                <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertTriangle size={32} />
                </div>
                <h4 className="font-black text-xs text-white uppercase">
                  {language === 'ca' ? "Error en enviar el codi" : "Error al enviar el código"}
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {language === 'ca' ? "Torneu-ho a provar" : "Vuelva a intentarlo"}
                </p>
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-400 text-center mt-3 max-w-xs leading-relaxed font-sans">
            {language === 'ca'
              ? "Apunta la càmera cap al codi QR del comprovant o email de la inscripció."
              : "Apunta la cámara hacia el código QR del comprobante o email de la inscripción."}
          </p>

          {/* Scanned counter badge */}
          {scannedCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[11px] text-zinc-400 font-mono">
              <Check size={12} className="text-emerald-400 stroke-[3]" />
              <span>{language === 'ca' ? `Codis enviats: ${scannedCount}` : `Códigos enviados: ${scannedCount}`}</span>
            </div>
          )}
        </div>

        {/* Manual Keyboard Input Option (Fallback) */}
        <div className="border-t border-zinc-900 pt-3">
          {!showManualInput ? (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
              id="btn-toggle-manual-input"
            >
              <Keyboard size={14} />
              {language === 'ca' ? "Introduir codi manualment" : "Introducir código manualmente"}
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-2 bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">
                  {language === 'ca' ? "Codi d'inscripció (ex: TAST-2027-0001)" : "Código de inscripción (ej: TAST-2027-0001)"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="text-zinc-500 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="TAST-2027-XXXX"
                  className="flex-1 bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#ff0090]"
                  id="mobile-manual-code-input"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || transmitStatus === 'transmitting'}
                  className="px-4 py-2 bg-[#ff0090] hover:bg-[#e0007e] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow"
                  id="btn-submit-manual-code"
                >
                  <Send size={13} />
                  {language === 'ca' ? "Enviar" : "Enviar"}
                </button>
              </div>
            </form>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 p-3 border-t border-zinc-900 text-center">
        <p className="text-[10px] text-zinc-400 font-mono flex items-center justify-center gap-1.5 uppercase">
          <ShieldCheck size={12} className="text-emerald-400" />
          {language === 'ca' ? "Connexió segura encriptada amb PC de Secretaria" : "Conexión segura encriptada con PC de Secretaría"}
        </p>
      </footer>
    </div>
  );
}
