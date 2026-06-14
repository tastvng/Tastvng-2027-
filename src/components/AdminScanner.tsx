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
  RefreshCw, 
  Smartphone,
  CheckCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Inscripcio } from '../types';

interface AdminScannerProps {
  inscripcions: Inscripcio[];
  onSelectInscripcio: (id: string) => void;
  onBack: () => void;
  onAddLog?: (txt: string) => void;
}

export default function AdminScanner({ inscripcions, onSelectInscripcio, onBack, onAddLog }: AdminScannerProps) {
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera on cleanup
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      setUseRealCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e: any) {
      console.error("error starting back camera scanner:", e);
      setHasCameraPermission(false);
      setErrorMessage("Permís de càmera denegat o dispositiu absent en aquest navegador.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseRealCamera(false);
  };

  // Simulate scanning a registration of the list directly
  const simulateScan = (id: string, name: string) => {
    setIsScanning(false);
    setScanResult(`Estableix connexió síncrona amb la ID: ${id}`);
    
    if (onAddLog) {
      onAddLog(`Lectura correcta del QR de la parella: ${name}`);
    }

    // After animation delay, select registration detail
    setTimeout(() => {
      onSelectInscripcio(id);
    }, 1500);
  };

  return (
    <div className="space-y-6" id="admin-scanner-container">
      {/* Header bar controls */}
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow">
        <button 
          onClick={() => {
            stopCamera();
            onBack();
          }}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          id="btn-scanner-back"
        >
          <ArrowLeft size={14} /> Tornar al taulell
        </button>

        <h2 className="font-sans font-black text-base tracking-tight text-white flex items-center gap-2">
          <QrCode size={18} className="text-fuchsia-500" /> Lector QR de Secretaria
        </h2>

        <div className="w-24 pointer-events-none" /> {/* Spacer */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: The active camera stream viewer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden text-center text-white">
            <h3 className="font-sans font-bold text-lg text-white mb-2">Visor del lector de codis QR</h3>
            <p className="text-zinc-400 text-xs mb-6 max-w-sm mx-auto">Col·loqueu el comprovant de la parella sota el recull del visor mòbil.</p>

            {/* Viewer Stage Frame overlay */}
            <div className="relative aspect-[16/10] bg-zinc-900 max-w-md mx-auto rounded-2xl overflow-hidden border border-zinc-800 flex flex-col items-center justify-center">
              {useRealCamera ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="absolute inset-0 object-cover w-full h-full"
                  />
                  {/* Moving fuchsia laser beam lines guided */}
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-fuchsia-500 shadow-lg shadow-fuchsia-500/80 animate-pulse pointer-events-none" />
                  
                  <div className="absolute inset-8 border-2 border-fuchsia-500/50 rounded-lg pointer-events-none flex items-center justify-center">
                    <div className="text-[9px] bg-fuchsia-500 text-white px-2 py-0.5 font-bold rounded tracking-wider uppercase font-mono">
                      Lectura Càmara Activa
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 space-y-4">
                  {errorMessage ? (
                    <div className="space-y-2">
                      <AlertTriangle className="mx-auto text-amber-500" size={28} />
                      <p className="text-xs text-zinc-300 font-mono leading-relaxed">{errorMessage}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <QrCode className="mx-auto text-zinc-600 animate-pulse" size={36} />
                      <p className="text-xs text-zinc-400 font-sans">La càmera física utilitza les llibreries natives del vostre terminal d'escàner.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={startCamera}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 mx-auto"
                    id="btn-active-real-camera"
                  >
                    <Camera size={14} /> Activar Càmera Escàner
                  </button>
                </div>
              )}

              {/* Success scan animation */}
              {!isScanning && (
                <div className="absolute inset-0 bg-green-500/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 animate-fadeIn">
                  <CheckCircle size={48} className="text-white mb-2 animate-bounce" />
                  <p className="font-sans font-bold text-lg text-white">QR DESCODIFICAT CORRECTAMENT!</p>
                  <p className="text-xs text-green-100 font-mono mt-1">{scanResult}</p>
                </div>
              )}
            </div>

            <div className="text-center mt-6">
              {useRealCamera && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-xs bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold px-4 py-2.5 rounded-xl transition"
                  id="btn-scanner-stop-camera"
                >
                  Aturar Càmera
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Simulation queue picker */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-5">
            <h3 className="font-sans font-black text-sm text-zinc-900 pb-2 border-b border-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="text-fuchsia-500" size={16} />
              Simulació de Cua de Parelles
            </h3>
            
            <p className="text-zinc-500 text-xs leading-relaxed">
              Utilitzeu aquests botons per simular que una parella de comparseros arriba a secretaria i us mostra el codi QR del seu mòbil.
            </p>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {inscripcions.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => simulateScan(item.id, `${item.c1Nom} & ${item.c2Nom}`)}
                  className="p-3 bg-zinc-50 hover:bg-fuchsia-50 border border-zinc-200 rounded-2xl cursor-pointer transition flex items-center justify-between group"
                  id={`scanner-mock-pill-${item.id}`}
                >
                  <div className="space-y-0.5 max-w-[150px]">
                    <p className="font-bold text-zinc-900 text-xs truncate">{item.c1Nom} &amp; {item.c2Nom}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">{item.codiSeguiment}</p>
                  </div>

                  <div className="py-1 px-2 bg-fuchsia-100 text-fuchsia-700 text-[10px] font-bold rounded-lg group-hover:bg-fuchsia-600 group-hover:text-white transition flex items-center gap-1">
                    <QrCode size={11} /> Escanejar QR
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-[10px] text-zinc-400 leading-relaxed font-mono">
              La transmissió WebSocket emetrà la ID descodificada síncronament per tancar la cua i obrir elPC corresponent de la mesa de gestió.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
