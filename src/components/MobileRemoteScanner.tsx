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
  X,
  Zap,
  UserCheck,
  Search,
  Check
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { Inscripcio, CategoriaParella } from '../types';
import jsQR from 'jsqr';

interface MobileRemoteScannerProps {
  syncKey: string;
  inscripcions: Inscripcio[];
  onBack: () => void;
}

export default function MobileRemoteScanner({ 
  syncKey, 
  inscripcions, 
  onBack 
}: MobileRemoteScannerProps) {
  const { language, t } = useLanguage();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraErrorCode, setCameraErrorCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [status, setStatus] = useState<'ready' | 'syncing' | 'success' | 'error'>('ready');
  const [lastScannedName, setLastScannedName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'camera' | 'search'>('camera');
  const [searchQuery, setSearchQuery] = useState('');

  const errorMessage = cameraErrorCode === 'permission'
    ? (language === 'ca'
        ? "No s'ha pogut accedir a la càmera del mòbil. Si us plau, reviseu els permisos d'accés."
        : "No se ha podido acceder a la cámara del móvil. Por favor, revise los permisos de acceso.")
    : cameraErrorCode;

  const statusText = status === 'ready'
    ? (language === 'ca' ? 'En línia i a punt' : 'En línea y listo')
    : status === 'syncing'
    ? (language === 'ca' ? 'Sincronitzant amb el PC...' : 'Sincronizando con el PC...')
    : status === 'success'
    ? (language === 'ca' ? '✔ Enviat amb èxit al PC!' : '✔ ¡Enviado con éxito al PC!')
    : (language === 'ca' ? '❌ Error en enviar dades' : '❌ Error al enviar datos');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  const startCamera = async () => {
    setCameraErrorCode(null);
    try {
      if (streamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } }
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Start loop analyzing frames
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error('Error starting camera on mobile:', err);
      setHasCameraPermission(false);
      setCameraErrorCode('permission');
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

  const transmitScan = async (scannedId: string, customName?: string) => {
    // Prevent immediate double scan of same item
    setIsScanning(false);
    setStatus('syncing');

    // Try device vibration
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(120);
      } catch (e) {
        // block
      }
    }

    try {
      const parentRecord = inscripcions.find(i => i.id === scannedId);
      const name = parentRecord 
        ? `${parentRecord.c1Nom} & ${parentRecord.c2Nom}` 
        : customName || (language === 'ca' ? 'Parella desconeguda' : 'Pareja desconocida');

      setLastScannedName(name);

      // POST to ntfy-channel
      await fetch(`https://ntfy.sh/tast_sync_${syncKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ scannedId, timestamp: Date.now() }),
      });

      setStatus('success');
      setTimeout(() => {
        setLastScannedName(null);
        setIsScanning(true);
        setStatus('ready');
        if (activeTab === 'camera') {
          // Restart stream loop safely
          if (videoRef.current && streamRef.current) {
            animationFrameId.current = requestAnimationFrame(scanFrame);
          } else {
            startCamera();
          }
        }
      }, 2500);

    } catch (e) {
      console.error(e);
      setStatus('error');
      setTimeout(() => {
        setIsScanning(true);
        setStatus('ready');
      }, 2000);
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || !streamRef.current || !isScanning) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
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

            const match = inscripcions.find(i => i.id === decodedId || i.codiSeguiment === decodedId);
            if (match) {
              transmitScan(match.id);
            } else {
              // Always transmit unknown codes directly! 
              // The PC database is the authoritative system and can read arbitrary parsed parameters/IDs
              transmitScan(decodedId, `Nova Parella (Codi: ${decodedId})`);
            }
            return; // Halt stream loop till completion transition
          }
        } catch (e) {
          // catch context security errors
        }
      }
    }
    // Keep looping
    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  const filtered = inscripcions.filter(i => {
    const query = searchQuery.toLowerCase();
    return i.c1Nom.toLowerCase().includes(query) || 
           i.c2Nom.toLowerCase().includes(query) || 
           i.codiSeguiment.toLowerCase().includes(query);
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between font-sans selection:bg-brand select-none" id="mobile-remote-scanner-root">
      
      {/* Header bar */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-30">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-zinc-400 hover:text-white flex items-center gap-1 font-bold text-xs"
          id="btn-mobile-exit"
        >
          <ArrowLeft size={18} /> {language === 'ca' ? 'Sortir' : 'Salir'}
        </button>

        <div className="text-center flex-1 pr-6">
          <span className="font-mono text-[8px] text-[#ff0090] tracking-widest uppercase font-bold block">
            {language === 'ca' ? "DISSENY ESCÀNER PORTÀTIL" : "DISEÑO ESCÁNER PORTÁTIL"}
          </span>
          <h2 className="text-xs font-black tracking-tight text-white flex items-center justify-center gap-1.5 uppercase">
            {language === 'ca' ? "Mòbil Enllaçat ⇆ PC" : "Móvil Enlazado ⇆ PC"}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-tight">{syncKey.slice(0, 6)}</span>
        </div>
      </header>

      {/* Main interface content */}
      <main className="flex-1 max-w-md mx-auto w-full p-4 flex flex-col justify-between space-y-4">
        
        {/* Connection status banner */}
        <div className="bg-zinc-900/60 rounded-2xl border border-[#ff0090]/10 p-3 flex items-center gap-3">
          <div className="p-2 bg-[#ff0090]/10 text-[#ff0090] rounded-xl self-start">
            <Smartphone size={20} className="animate-bounce" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[11px] uppercase text-zinc-300 tracking-wide">
              {language === 'ca' ? "Estat del Canal Síncron" : "Estado del Canal Síncro"}
            </h3>
            <p className="text-xs text-[#ff0090] font-bold mt-0.5 flex items-center gap-1 font-mono">
              <Zap size={10} /> {statusText}
            </p>
          </div>
        </div>

        {/* View tab switches */}
        <div className="flex border border-zinc-800 p-1 bg-zinc-900 rounded-2xl" id="mobile-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition ${
              activeTab === 'camera' ? 'bg-[#ff0090] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Camera size={14} className="inline mr-1" /> {language === 'ca' ? 'Utilitzar Càmera Mòbil' : 'Utilizar Cámara Móvil'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-1.5 text-center text-xs font-bold rounded-xl transition ${
              activeTab === 'search' ? 'bg-[#ff0090] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Search size={14} className="inline mr-1" /> {language === 'ca' ? 'Cercar i Cridar PC' : 'Buscar y Llamar PC'}
          </button>
        </div>

        {/* Dynamic tabs container content */}
        <div className="flex-1 flex flex-col justify-center min-h-[280px]">
          {activeTab === 'camera' ? (
            <div className="space-y-4 text-center">
              {/* Virtual Scanner viewframe */}
              <div className="relative w-full max-w-xs mx-auto aspect-square bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 flex flex-col items-center justify-center">
                {hasCameraPermission === null ? (
                  <div className="p-4 space-y-2 text-zinc-500 text-xs">
                    <RotateCw className="animate-spin mx-auto text-zinc-400" size={24} />
                    <p>{language === 'ca' ? 'Iniciant càmera del mòbil...' : 'Iniciando cámara del móvil...'}</p>
                  </div>
                ) : hasCameraPermission === false ? (
                  <div className="p-6 space-y-3 text-zinc-400 text-xs">
                    <AlertTriangle className="mx-auto text-amber-500 animate-pulse" size={32} />
                    <p>{errorMessage}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      {language === 'ca' ? 'Tornar-ho a intentar' : 'Volver a intentar'}
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    {/* Living WebCam device feed */}
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover" 
                      id="mobile-video-stream"
                    />

                    {/* Matrix targeted overlays matching screen focus */}
                    <div className="absolute inset-0 border-[35px] border-zinc-950/70 pointer-events-none">
                      <div className="w-full h-full border-2 border-dashed border-[#ff0090] rounded-xl relative">
                        {/* Interactive scan light ray */}
                        <div className="absolute left-0 right-0 h-0.5 bg-[#ff0090] shadow-md shadow-[#ff0090]/80 animate-bounce top-1/2" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Scanned popup notification HUD on camera stream */}
                {lastScannedName && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 space-y-3 z-20 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-3 bg-[#ff0090]/10 text-[#ff0090] rounded-full">
                      <CheckCircle size={36} className="animate-bounce" />
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[#ff0090] font-bold">
                      {language === 'ca' ? "RECONEGUT CORRECTAMENT" : "RECONOCIDO CORRECTAMENTE"}
                    </span>
                    <h4 className="font-sans font-black text-sm text-white max-w-xs">{lastScannedName}</h4>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {language === 'ca' ? "Dades trameses a la secretaria..." : "Datos enviados a la secretaría..."}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {language === 'ca'
                  ? "Apunta la càmera del mòbil cap al codi QR digital o imprès del comprovant del participant."
                  : "Apunte la cámara del móvil hacia el código QR digital o impreso del comprobante del participante."}
              </p>
            </div>
          ) : (
            /* Quick client simulator list or manual numeric override */
            <div className="space-y-4 flex-1 flex flex-col justify-start">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder={language === 'ca' ? "Cerca per nom, cognom o codi..." : "Buscar por nombre, apellido o código..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-9 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
                  id="mobile-search-input"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3.5 text-zinc-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* In-app Simulator layout section */}
              <div className="flex-1 overflow-y-auto max-h-[300px] border border-zinc-900 rounded-2xl bg-zinc-900/10 p-2 space-y-1.5 scrollbar-thin">
                {filtered.length === 0 ? (
                  <p className="text-center text-zinc-500 text-[11px] py-12">
                    {language === 'ca' ? "No s'han trobat parelles que coincideixin" : "No se han encontrado parejas que coincidan"}
                  </p>
                ) : (
                  filtered.map(i => (
                    <div 
                      key={i.id}
                      onClick={() => isScanning && transmitScan(i.id)}
                      className={`p-3 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-750 rounded-xl transition cursor-pointer flex justify-between items-center text-xs border border-zinc-800/50 ${
                        !isScanning ? 'opacity-50 pointer-events-none' : ''
                      }`}
                      id={`mobile-list-item-${i.id}`}
                    >
                      <div className="max-w-[70%]">
                        <strong className="text-zinc-200 block truncate">{i.c1Nom} &amp; {i.c2Nom}</strong>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          {i.categoria === CategoriaParella.ADULT 
                            ? (language === 'ca' ? 'Adult' : 'Adulto') 
                            : (language === 'ca' ? 'Juvenil' : 'Juvenil')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="inline-block font-mono text-[9px] bg-white/5 text-zinc-300 font-bold px-2 py-0.5 rounded border border-white/5">
                          {i.codiSeguiment}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <p className="text-[10px] text-zinc-500 text-center font-sans tracking-tight">
                {language === 'ca'
                  ? "Simulador ràpid: premeu a sobre de qualsevol parella per comprovar l'intercanvi de dades live amb el PC."
                  : "Simulador rápido: presione sobre cualquier pareja para comprobar el intercambio de datos en vivo con el PC."}
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer support credits */}
      <footer className="bg-zinc-950 p-4 border-t border-zinc-900 text-center">
        <p className="font-sans font-black text-[10px] text-zinc-400 flex items-center justify-center gap-1 uppercase tracking-tight">
          {language === 'ca' ? "EL TAST SECRETARIS ⇆ mòbil enllaçat actiu" : "EL TAST SECRETARIOS ⇆ móvil enlazado activo"}
        </p>
        <p className="text-[9px] text-[#ff0090] font-mono mt-0.5 uppercase tracking-wide">
          {language === 'ca' ? "canal síncron canònica actiu / ntfy broker" : "canal síncrono canónico activo / ntfy broker"}
        </p>
      </footer>
    </div>
  );
}
