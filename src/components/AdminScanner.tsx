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
  FileText
} from 'lucide-react';
import { Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament } from '../types';

interface AdminScannerProps {
  inscripcions: Inscripcio[];
  onSelectInscripcio: (id: string) => void;
  onBack: () => void;
  onAddLog?: (txt: string) => void;
  onSaveInscripcio?: (updatedRecord: Inscripcio) => void;
}

export default function AdminScanner({ 
  inscripcions, 
  onSelectInscripcio, 
  onBack, 
  onAddLog,
  onSaveInscripcio 
}: AdminScannerProps) {
  // Simulator active selected phone couple index (dropdown)
  const [selectedMobileId, setSelectedMobileId] = useState<string>(inscripcions[0]?.id || '');

  // Master states representing active parsed signal results on PC Monitor
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [tempRecord, setTempRecord] = useState<Inscripcio | null>(null);
  const [isScanningTransition, setIsScanningTransition] = useState(false);
  const [justSavedNotification, setJustSavedNotification] = useState<string | null>(null);

  // Real webcam camera state fallback
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setHasCameraPermission(false);
      setErrorMessage("Permís de càmera absent o dispositiu de captura ocupat.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseRealCamera(false);
  };

  // Perform synchronous data transmission (Scanner triggered!)
  const triggerSynchronousScan = (id: string) => {
    const parentRecord = inscripcions.find(i => i.id === id);
    if (!parentRecord) return;

    playClerkBeep(920, 0.15);
    setIsScanningTransition(true);

    if (onAddLog) {
      onAddLog(`Rebuda sol·licitud a PC via QR: ${parentRecord.c1Nom} & ${parentRecord.c2Nom}`);
    }

    // Small transition simulation to visual data sync
    setTimeout(() => {
      setIsScanningTransition(false);
      setScannedId(id);
      // Create local copies of statuses so they can edit this sheet on screen!
      setTempRecord({ ...parentRecord });
    }, 600);
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
    setJustSavedNotification(`La ficha de la parella ${matchName} ha estat desada correctament!`);
    
    if (onAddLog) {
      onAddLog(`✔ Ficha validada i finalitzada a Secretaria per a: ${matchName}`);
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
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow-lg">
        <button 
          onClick={() => {
            stopCamera();
            onBack();
          }}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          id="btn-back-from-clerk"
        >
          <ArrowLeft size={14} /> Tornar al taulell
        </button>

        <div className="text-center">
          <span className="font-mono text-[9px] text-[#ff0090] tracking-widest uppercase font-bold">XARXA DE VALIDACIÓ SÍNCRONA</span>
          <h2 className="font-sans font-black text-sm md:text-base tracking-tight text-white flex items-center justify-center gap-1.5">
            Mapeig Terminal Mòbil ⇆ PC Secretaria
          </h2>
        </div>

        <div className="hidden sm:block text-right">
          <span className="text-[10px] bg-green-500/10 text-green-400 font-bold py-1 px-2.5 rounded-lg font-mono flex items-center gap-1 uppercase tracking-tight">
            <Zap size={10} className="animate-bounce" /> Sistema En Línia
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ================= COLUMN 1 (Phone Simulator) ================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="text-center">
            <h3 className="font-sans font-extrabold text-xs text-zinc-400 uppercase tracking-widest mb-1">📟 MÒBIL DE LA PARELLA</h3>
            <p className="text-[11px] text-zinc-500 font-sans leading-tight">Simuleu el client mostrant el seu comprovant digital.</p>
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
                <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Tria la parella de la cua:</label>
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
                    <span className="font-mono text-[8px] text-[#ff0090] font-bold block tracking-wider">COMPROVANT EL TAST 2026</span>
                    <p className="font-bold text-[11px] text-zinc-900 tracking-tight mt-0.5">LES COMPARSES DE VILANOVA</p>
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
                      <span className="text-zinc-400 font-bold uppercase font-mono">Parella:</span>
                      <strong className="text-zinc-900 truncate max-w-[150px]">
                        {activePhoneRecord.c1Nom} &amp; {activePhoneRecord.c2Nom}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-bold uppercase font-mono">Categoria:</span>
                      <strong className="text-zinc-800 font-bold font-mono">
                        {activePhoneRecord.categoria}
                      </strong>
                    </div>

                    <div className="flex justify-between border-t border-dotted border-zinc-250 pt-1 text-xs">
                      <span className="text-zinc-900 font-bold uppercase">Total a pagar:</span>
                      <strong className="text-[#ff0090] font-black">{activePhoneRecord.preuCalculat}€</strong>
                    </div>
                  </div>

                  {/* Notch notch */}
                  <div className="absolute top-[82px] -left-2 w-4 h-4 bg-zinc-950 rounded-full" />
                  <div className="absolute top-[82px] -right-2 w-4 h-4 bg-zinc-950 rounded-full" />
                </div>
              ) : (
                <div className="p-6 text-center text-zinc-500 font-sans text-xs">Sense parelles preinscrites.</div>
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
                  {isScanningTransition ? "Transmetent..." : "Transmetre QR"}
                </button>
              )}
            </div>
          </div>
        </div>


        {/* ================= COLUMN 2 (PC Dashboard Screen) ================= */}
        <div className="lg:col-span-8 space-y-4">
          <div className="text-center">
            <h3 className="font-sans font-extrabold text-xs text-zinc-400 uppercase tracking-widest mb-1">🖥️ DE CAIXA AL PC MONITOR</h3>
            <p className="text-[11px] text-zinc-500 font-sans leading-tight">La pantalla de l'ordinador rep les dades d'admissió en temps real al escanejar.</p>
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
                  <p className="text-xs font-mono text-zinc-400">DESCODIFICANT LECTURA QR... CONNEXIÓ SÍNCRONA...</p>
                </div>
              ) : justSavedNotification ? (
                /* Success Save flash notice inside PC */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-green-950/20 rounded-2xl border border-green-500/20 text-green-400 space-y-3">
                  <CheckCircle size={44} className="text-green-500 animate-bounce" />
                  <h4 className="font-sans font-bold text-base">TRANSACCIÓ CORRECTA AL PC!</h4>
                  <p className="text-xs text-green-200/80 font-mono max-w-sm mx-auto">{justSavedNotification}</p>
                  <p className="text-[10px] text-zinc-500 font-mono pt-4 animate-pulse">Actualitzant base de dades local... Escàner lliure.</p>
                </div>
              ) : tempRecord ? (
                /* ================ STATE B: DISPLAY FULL DETAILS FICHA ON SCREEN ================ */
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Ficha title banner */}
                  <div className="flex justify-between items-start bg-zinc-950 border border-white/5 p-3.5 rounded-xl text-xs">
                    <div>
                      <span className="font-mono text-[9px] text-zinc-500 uppercase block">FITXA DE SOCIS COMPARSERS VINCULATS:</span>
                      <h4 className="font-sans font-black text-sm text-brand">{tempRecord.c1Nom} &amp; {tempRecord.c2Nom}</h4>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[9px] text-zinc-500 uppercase block">Codi Seguint</span>
                      <span className="font-mono font-bold text-zinc-300 text-[11px]">{tempRecord.codiSeguiment}</span>
                    </div>
                  </div>

                  {/* Informació general columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                    
                    {/* C1 info panel */}
                    <div className="bg-[#121212] p-3 rounded-xl border border-white/5 space-y-1">
                      <p className="font-bold text-[11px] text-zinc-300 font-mono uppercase pb-1 border-b border-white/5">Comparser 1 (Principal)</p>
                      <p className="font-bold text-white mt-1">{tempRecord.c1Nom} {tempRecord.c1Cognoms}</p>
                      <p className="text-zinc-500 truncate">{tempRecord.c1Email}</p>
                      <p className="text-zinc-500">{tempRecord.c1Telefon}</p>
                      <p className="text-[10px] text-zinc-400 font-mono pt-1">
                        Talla vestimenta: <strong className="text-white font-sans text-[11px]">{tempRecord.c1Talla}</strong>
                      </p>
                    </div>

                    {/* C2 info panel */}
                    <div className="bg-[#121212] p-3 rounded-xl border border-white/5 space-y-1">
                      <p className="font-bold text-[11px] text-zinc-300 font-mono uppercase pb-1 border-b border-white/5">Comparser 2 (Acompanyant)</p>
                      <p className="font-bold text-white mt-1">{tempRecord.c2Nom} {tempRecord.c2Cognoms}</p>
                      <p className="text-zinc-500 truncate">{tempRecord.c2Email}</p>
                      <p className="text-zinc-500">{tempRecord.c2Telefon}</p>
                      <p className="text-[10px] text-zinc-400 font-mono pt-1">
                        Talla vestimenta: <strong className="text-white font-sans text-[11px]">{tempRecord.c2Talla}</strong>
                      </p>
                    </div>

                  </div>

                  {/* Complement and Extras items table brief */}
                  <div className="bg-[#121212] p-3 rounded-xl border border-white/5 text-xs">
                    <p className="font-bold text-[11px] text-zinc-300 font-mono uppercase pb-1 mb-2 border-b border-white/5">Càlcul d'Import i Complements contractats</p>
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Categoria d'inscripció: <strong>{tempRecord.categoria}</strong></span>
                      <span>Total Liquidació: <strong className="text-brand text-sm">{tempRecord.preuCalculat}€</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-white/5 px-2.5 py-1 rounded text-[10px] text-zinc-300">
                        {tempRecord.teDomasBalco ? "✔ Inclou Domàs de Balcó" : "🗙 Sense Domàs de Balcó"}
                      </span>
                      <span className="bg-white/5 px-2.5 py-1 rounded text-[10px] text-zinc-300">
                        {tempRecord.teMocadorsExtra > 0 ? `✔ Inclou +${tempRecord.teMocadorsExtra} mocador(s) extres` : "🗙 Sense mocadors extres"}
                      </span>
                    </div>
                  </div>

                  {/* ================= INTERACTIVE PC AUDITING FORMS ================= */}
                  <div className="p-4 bg-zinc-950/80 rounded-2xl border border-white/5 space-y-4">
                    <span className="block font-mono text-[9px] text-[#ff0090] tracking-widest font-bold uppercase">ACCIONS D'ACTUALITZACIÓ EN TEMPS REAL:</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* DNI auditing flag selector */}
                      <div className="space-y-1.5 text-xs">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">DNI Documentació</label>
                        <select
                          value={tempRecord.estatDni}
                          onChange={(e) => setTempRecord({ ...tempRecord, estatDni: e.target.value as EstatVerificacio })}
                          className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white tracking-tight cursor-pointer focus:border-[#ff0090]"
                        >
                          <option value={EstatVerificacio.PENDENT}>⚠️ PENDENT DE REVISAR</option>
                          <option value={EstatVerificacio.VALIDAT}>✔ VALIDAT CORRECTAMENT</option>
                          <option value={EstatVerificacio.REBUTJAT}>❌ REBUTJAT (DNI IL·LEGIBLE)</option>
                        </select>
                      </div>

                      {/* Payment check form */}
                      <div className="space-y-1.5 text-xs">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Cobrament a Caixa</label>
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
                          <option value={EstatPagament.PENDENT}>⚠️ IMPORT DE {tempRecord.preuCalculat}€ PENDENT</option>
                          <option value={EstatPagament.PAGAT}>✔ REGISTRAT COM A PAGAT</option>
                        </select>
                      </div>

                      {/* Material delivery form */}
                      <div className="space-y-1.5 text-xs">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Lliurament de Fulard</label>
                        <select
                          value={tempRecord.entregaMaterial}
                          onChange={(e) => setTempRecord({ ...tempRecord, entregaMaterial: e.target.value as EstatInscripcio })}
                          className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white tracking-tight cursor-pointer focus:border-[#ff0090]"
                        >
                          <option value={EstatInscripcio.PENDENT}>⚠️ MATERIAL PENDENT</option>
                          <option value={EstatInscripcio.ENTREGAT}>✔ MATERIAL COMPLET LLIURAT</option>
                        </select>
                      </div>

                    </div>

                    {/* Choose payment split option if paid */}
                    {tempRecord.estatPagament === EstatPagament.PAGAT && (
                      <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-between text-xs animate-fadeIn whitespace-nowrap">
                        <span className="text-zinc-400 font-medium">Mètode de cobrament a caixa:</span>
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
                            EFECTIU (Metàl·lic)
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
                      D'esconnectar de la Mesa
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFromMonitor}
                      className="flex-1.5 py-3 bg-[#ff0090] hover:bg-[#e0007e] text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-brand/20 uppercase tracking-wider"
                    >
                      <Check size={14} className="stroke-[3]" /> Desar i Finalitzar Ficha
                    </button>
                  </div>

                </div>
              ) : (
                /* ================ STATE A: WAITING SIGNAL / STANDBY RADAR ================ */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950/40 rounded-2xl border border-dashed border-white/5 text-center relative overflow-hidden h-96">
                  
                  {/* Glowing dynamic radar visual effect */}
                  <div className="w-24 h-24 rounded-full bg-[#ff0090]/10 border-2 border-dashed border-[#ff0090]/35 flex items-center justify-center animate-ping duration-3000 absolute" />
                  <div className="w-16 h-16 rounded-full bg-[#ff0090]/20 border border-[#ff0090]/40 flex items-center justify-center relative z-10">
                    <QrCode size={28} className="text-[#ff0090] animate-pulse" />
                  </div>

                  <h4 className="font-sans font-light italic text-sm text-white mt-6 tracking-tight">
                    Esperant senyal d'escaneig del <span className="text-brand font-black not-italic">mòbil</span>
                  </h4>
                  <p className="text-zinc-500 text-xs leading-relaxed max-w-sm mt-2 font-sans">
                    Premeu el botó fúcsia del mòbil a l'esquerra per transmetre el codi QR o utilitzeu el lector de càmera física per a documents físics.
                  </p>

                  <div className="mt-8 relative z-20">
                    {useRealCamera ? (
                      <div className="space-y-3">
                        <div className="relative w-44 h-28 bg-black rounded-lg overflow-hidden border border-white/20 mx-auto">
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#ff0090] animate-pulse" />
                        </div>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-1.5 bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white rounded-lg text-[10px] font-mono transition"
                        >
                          Aturar Càmera
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl transition border border-white/10 flex items-center gap-1.5 mx-auto font-mono uppercase tracking-widest hover:border-[#ff0090]/40"
                      >
                        <Camera size={12} className="text-[#ff0090]" /> Activar Càmera Física
                      </button>
                    )}

                    {errorMessage && (
                      <p className="text-[10px] text-amber-500 font-mono mt-1">{errorMessage}</p>
                    )}
                  </div>

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
              💡 Informació d'operabilitat síncrona
            </p>
            <p>
              Qualsevol canvi en els controls de caixa, DNI o lliurament es desa automàticament a la memòria cau persistent (LocalStorage). Quan premeu <strong>"Desar i Finalitzar Fitxa"</strong>, tots els marcadors s'actualitzen al feed principal i es tanca la sessió de la teva Mesa per rebre el següent participant en cua!
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
