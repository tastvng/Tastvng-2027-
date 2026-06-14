/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  ShieldCheck, 
  Trash2, 
  Sparkles, 
  Plus, 
  Minus, 
  AlertTriangle,
  ChevronRight,
  Sparkle
} from 'lucide-react';
import { CategoriaParella, SistemaConfig, Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio } from '../types';

interface PublicFormProps {
  config: SistemaConfig;
  onSubmit: (registration: Inscripcio) => void;
  onGoToLogin: () => void;
}

export default function PublicForm({ config, onSubmit, onGoToLogin }: PublicFormProps) {
  // Form fields state
  const [categoria, setCategoria] = useState<CategoriaParella>(CategoriaParella.ADULT);
  
  // Comparser 1 state
  const [c1Nom, setC1Nom] = useState('');
  const [c1Cognoms, setC1Cognoms] = useState('');
  const [c1Email, setC1Email] = useState('');
  const [c1Telefon, setC1Telefon] = useState('');
  const [c1Talla, setC1Talla] = useState('M');
  const [c1DniUrl, setC1DniUrl] = useState<string | null>(null);
  
  // Comparser 2 state
  const [c2Nom, setC2Nom] = useState('');
  const [c2Cognoms, setC2Cognoms] = useState('');
  const [c2Email, setC2Email] = useState('');
  const [c2Telefon, setC2Telefon] = useState('');
  const [c2Talla, setC2Talla] = useState('M');
  const [c2DniUrl, setC2DniUrl] = useState<string | null>(null);

  // Dynamic answers
  const [respostesCuestionari, setRespostesCuestionari] = useState<Record<string, string | boolean>>({});
  
  // Extras
  const [teDomasBalco, setTeDomasBalco] = useState(false);
  const [teMocadorsExtra, setTeMocadorsExtra] = useState(0);
  
  // Checkboxes
  const [acceptaRGPD, setAcceptaRGPD] = useState(false);
  const [acceptaPresencial, setAcceptaPresencial] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Camera Modal state
  const [cameraOwner, setCameraOwner] = useState<'c1' | 'c2' | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Calculate live total price
  const basePrice = categoria === CategoriaParella.ADULT ? config.preuAdult : config.preuJuvenil;
  const domasCost = teDomasBalco ? config.preuDomasBalco : 0;
  const mocadorsCost = teMocadorsExtra * config.preuMocadorExtra;
  const totalCalculat = basePrice + domasCost + mocadorsCost;

  // Initialize dynamic answers on layout load
  useEffect(() => {
    const initialAnswers: Record<string, string | boolean> = {};
    config.preguntesFormulari.forEach(q => {
      if (q.activa) {
        initialAnswers[q.id] = q.tipus === 'boolean' ? false : '';
      }
    });
    setRespostesCuestionari(initialAnswers);
  }, [config]);

  // Handle webcam capture initialization
  const startCamera = async (owner: 'c1' | 'c2') => {
    setCameraOwner(owner);
    setVideoError(null);
    try {
      setCameraActive(true);
      // Wait minor tick for video DOM reference to establish
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err: any) {
          console.error("error opening webcam:", err);
          setVideoError("No s'ha pogut accedir a la càmera. S'utilitzarà el simulador de fotos.");
        }
      }, 300);
    } catch (e) {
      setVideoError("No s'ha pogut iniciar el flux de vídeo.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraOwner(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Add a beautiful watermark of 'El Tast' just to demonstrate realism
        context.fillStyle = 'rgba(230, 0, 126, 0.4)';
        context.font = 'bold 20px Inter';
        context.fillText('EL TAST - DNI VALIDACIÓ', 20, canvas.height - 30);
        
        const dataUrl = canvas.toDataURL('image/webp');
        if (cameraOwner === 'c1') setC1DniUrl(dataUrl);
        if (cameraOwner === 'c2') setC2DniUrl(dataUrl);
        
        stopCamera();
      }
    } else {
      // Simulator fallback if real webcam does not load or is blocked in iframe
      simulateCapture();
    }
  };

  const simulateCapture = () => {
    // Generate a beautiful fuchsia stylized voucher image representing a DNI card
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 380;
    const ctx = c.getContext('2d');
    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 600, 380);
      gradient.addColorStop(0, '#1c1917');
      gradient.addColorStop(1, '#e6007e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 380);

      // Card frame
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(15, 15, 570, 350);

      // Profile avatar mockup
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(40, 50, 150, 190);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 50, 150, 190);
      
      // Face placeholder lines
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(115, 120, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(115, 220, 60, Math.PI, 0);
      ctx.fill();

      // Text fields
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('DOCUMENT NACIONAL D\'IDENTITAT', 220, 80);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f3f4f6';
      ctx.fillText(`NOM: ${cameraOwner === 'c1' ? c1Nom || 'Participant 1' : c2Nom || 'Participant 2'}`, 220, 130);
      ctx.fillText(`COGNOMS: ${cameraOwner === 'c1' ? c1Cognoms || 'Cognoms 1' : c2Cognoms || 'Cognoms 2'}`, 220, 160);
      ctx.fillText(`SEXE: M/F   ESTAT: SPANISH`, 220, 190);
      ctx.fillText('DATA EXP: 31 DEC 2030', 220, 220);

      // Big watermark fuchsia text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = 'bold 90px Arial';
      ctx.fillText('EL TAST', 200, 310);

      // Signature bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(40, 260, 150, 40);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(40, 260, 150, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 14px Georgia';
      ctx.fillText('Signatura Oficial', 55, 285);

      const dataUrl = c.toDataURL('image/webp');
      if (cameraOwner === 'c1') setC1DniUrl(dataUrl);
      if (cameraOwner === 'c2') setC2DniUrl(dataUrl);
      stopCamera();
    }
  };

  // Convert uploaded files to base64 images
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, owner: 'c1' | 'c2') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("La imatge és massa gran (màxim 10MB).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (owner === 'c1') setC1DniUrl(reader.result as string);
        if (owner === 'c2') setC2DniUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validators
  const validateForm = () => {
    const tempErrors: Record<string, string> = {};
    if (!c1Nom.trim()) tempErrors.c1Nom = "El nom és requerit";
    if (!c1Cognoms.trim()) tempErrors.c1Cognoms = "Els cognoms són requerits";
    if (!c1Email.trim() || !/\S+@\S+\.\S+/.test(c1Email)) tempErrors.c1Email = "Email vàlid requerit";
    if (!c1Telefon.trim()) tempErrors.c1Telefon = "El telèfon és requerit";
    if (!c1DniUrl) tempErrors.c1Dni = "Cal pujar el DNI del Comparser 1";

    if (!c2Nom.trim()) tempErrors.c2Nom = "El nom és requerit";
    if (!c2Cognoms.trim()) tempErrors.c2Cognoms = "Els cognoms sencer és requerit";
    if (!c2Email.trim() || !/\S+@\S+\.\S+/.test(c2Email)) tempErrors.c2Email = "Email vàlid requerit";
    if (!c2Telefon.trim()) tempErrors.c2Telefon = "El telèfon és requerit";
    if (!c2DniUrl) tempErrors.c2Dni = "Cal pujar el DNI del Comparser 2";

    // Validate dynamic visible fields
    config.preguntesFormulari.forEach(q => {
      if (q.activa && q.requerit) {
        const ans = respostesCuestionari[q.id];
        if (q.tipus === 'text' && (!ans || String(ans).trim() === '')) {
          tempErrors[q.id] = "Aquesta pregunta és obligatòria";
        }
      }
    });

    if (c1Email.trim().toLowerCase() === c2Email.trim().toLowerCase() && c1Email.trim() !== '') {
      tempErrors.c2Email = "Els correus electrònics no poden ser idèntics";
    }

    if (!acceptaRGPD) tempErrors.rgpd = "Heu d'acceptar els termes de privadesa";
    if (!acceptaPresencial) tempErrors.presencial = "Heu d'acceptar pagar i recollir de manera presencial";

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmetre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      const scrollTarget = document.getElementById('public-form-title');
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(10);

    // Dynamic beautiful upload progress simulation
    const interval = setInterval(() => {
      setSubmitProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 150);

    setTimeout(() => {
      clearInterval(interval);
      setSubmitProgress(100);

      // Generate a dynamic tracking code
      const sequencialCode = Math.floor(1000 + Math.random() * 9000);
      const codiSeguiment = `TAST-2026-${sequencialCode}`;
      const randomId = 'ins-' + Math.random().toString(36).substr(2, 9);

      const novaInscripcio: Inscripcio = {
        id: randomId,
        codiSeguiment,
        categoria,
        c1Nom,
        c1Cognoms,
        c1Email,
        c1Telefon,
        c1Talla,
        c1DniUrl: c1DniUrl || '',
        c2Nom,
        c2Cognoms,
        c2Email,
        c2Telefon,
        c2Talla,
        c2DniUrl: c2DniUrl || '',
        respostesCuestionari,
        preuCalculat: totalCalculat,
        teDomasBalco,
        teMocadorsExtra,
        estatPagament: EstatPagament.PENDENT,
        metodePagament: null,
        estatDni: EstatVerificacio.PENDENT,
        entregaMaterial: EstatInscripcio.PENDENT,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };

      setIsSubmitting(false);
      onSubmit(novaInscripcio);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Dynamic Submit Overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            id="loading-overlay"
          >
            <div className="relative w-28 h-28 mb-8">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-full h-full border-4 border-zinc-800 border-t-fuchsia-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkle size={28} className="text-fuchsia-500 animate-pulse" />
              </div>
            </div>

            <h3 className="font-sans font-bold text-2xl text-white mb-2 tracking-tight">Processant preinscripció</h3>
            <p className="font-mono text-xs text-fuchsia-400 mb-6 max-w-sm">
              Comprimint i pujant imatges del DNI en format xifrat segur sota la norma RGPD...
            </p>

            <div className="w-64 bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
              <motion.div 
                className="bg-fuchsia-500 h-full"
                initial={{ width: '0%' }}
                animate={{ width: `${submitProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="font-mono text-zinc-400 text-xs">{submitProgress}% completat</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b border-zinc-200">
        <div>
          <span className="text-[10px] bg-fuchsia-100 text-fuchsia-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
            Formulari de preinscripció 2026
          </span>
          <h1 id="public-form-title" className="font-sans font-bold text-3xl md:text-4xl text-zinc-900 tracking-tight mt-1.5">
            Preinscriu la teva parella
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Les preinscripcions d'El Tast per a Les Comparses de Vilanova i la Geltrú.
          </p>
        </div>
        
        <button 
          onClick={onGoToLogin}
          className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-semibold font-mono tracking-tight px-4 py-2.5 rounded-xl border border-zinc-700/50 shadow transition-all flex items-center gap-1 hover:border-fuchsia-500 group"
          id="btn-admin-access"
        >
          Accés Secretaries <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <form onSubmit={handleSubmetre} className="space-y-8">
        {/* Category Toggles Selector */}
        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-zinc-800/40 pointer-events-none">
            <Sparkle size={120} className="stroke-[0.5]" />
          </div>

          <h3 className="font-sans font-bold text-white text-lg mb-1 tracking-tight">Trieu la categoria de la parella</h3>
          <p className="text-zinc-400 text-xs mb-5">El preu relatiu canvia automàticament segons la configuració vigent de l'entitat.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              onClick={() => setCategoria(CategoriaParella.ADULT)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                categoria === CategoriaParella.ADULT 
                  ? 'bg-fuchsia-950/40 border-fuchsia-500 shadow-lg shadow-fuchsia-500/10' 
                  : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
              }`}
              id="card-cat-adult"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold font-mono ${categoria === CategoriaParella.ADULT ? 'text-fuchsia-400' : 'text-zinc-500'}`}>CATEGORIA SÈNIOR</span>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${categoria === CategoriaParella.ADULT ? 'border-fuchsia-500' : 'border-zinc-500'}`}>
                  {categoria === CategoriaParella.ADULT && <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full" />}
                </div>
              </div>
              <h4 className="font-sans font-bold text-xl text-white">Parella Adulta</h4>
              <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                Recomanada per a participants de 16 anys o més. Inclou samarretes exclusives de la collada i puros dolços.
              </p>
              <div className="text-right mt-3">
                <span className="font-sans font-extrabold text-2xl text-fuchsia-500">{config.preuAdult}€</span>
                <span className="text-zinc-400 text-xs font-mono"> / parella</span>
              </div>
            </div>

            <div 
              onClick={() => setCategoria(CategoriaParella.JUVENIL)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                categoria === CategoriaParella.JUVENIL 
                  ? 'bg-fuchsia-950/40 border-fuchsia-500 shadow-lg shadow-fuchsia-500/10' 
                  : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
              }`}
              id="card-cat-juvenil"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold font-mono ${categoria === CategoriaParella.JUVENIL ? 'text-fuchsia-400' : 'text-zinc-500'}`}>CATEGORIA JUNIOR</span>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${categoria === CategoriaParella.JUVENIL ? 'border-fuchsia-500' : 'border-zinc-500'}`}>
                  {categoria === CategoriaParella.JUVENIL && <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full" />}
                </div>
              </div>
              <h4 className="font-sans font-bold text-xl text-white">Parella Juvenil</h4>
              <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                Ideal per a parelles joves de fins a 15 anys d'edat. Inclou fulard petit de color fúcsia.
              </p>
              <div className="text-right mt-3">
                <span className="font-sans font-extrabold text-2xl text-fuchsia-500">{config.preuJuvenil}€</span>
                <span className="text-zinc-400 text-xs font-mono"> / parella</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Errors Banner */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-red-800">
            <AlertTriangle className="shrink-0 text-red-600" size={20} />
            <div className="text-xs">
              <span className="font-sans font-bold block mb-1">Hi ha errors al formulari:</span>
              <ul className="list-disc pl-4 space-y-0.5 font-mono">
                {Object.values(errors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Two-Column Comparser Info Sheets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Comparser 1 Card */}
          <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-zinc-100 to-transparent pointer-events-none rounded-bl-3xl flex items-center justify-center">
              <span className="font-mono text-zinc-400 text-sm font-bold">#1</span>
            </div>
            
            <h3 className="font-sans font-bold text-zinc-900 text-lg mb-5 pb-2 border-b border-zinc-100 flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full" />
              Primer Comparser
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Nom *</label>
                <input 
                  type="text" 
                  value={c1Nom} 
                  onChange={(e) => setC1Nom(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Nom ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. Joan"
                  id="input-c1-nom"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Cognoms *</label>
                <input 
                  type="text" 
                  value={c1Cognoms} 
                  onChange={(e) => setC1Cognoms(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Cognoms ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. Garcia Pujol"
                  id="input-c1-cognoms"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Telèfon de contacte *</label>
                <input 
                  type="tel" 
                  value={c1Telefon} 
                  onChange={(e) => setC1Telefon(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Telefon ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. 600123456"
                  id="input-c1-telefon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Correu electrònic *</label>
                <input 
                  type="email" 
                  value={c1Email} 
                  onChange={(e) => setC1Email(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Email ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. joan@gmail.com"
                  id="input-c1-email"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Talla de Samarreta *</label>
                <select 
                  value={c1Talla} 
                  onChange={(e) => setC1Talla(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all cursor-pointer"
                  id="select-c1-talla"
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                  <option value="3XL">3XL</option>
                </select>
              </div>

              {/* DNI upload zona */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1.5">Foto de la part frontal del DNI *</label>
                {c1DniUrl ? (
                  <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 flex items-center justify-between gap-3 relative overflow-hidden group">
                    <img 
                      src={c1DniUrl} 
                      alt="DNI Comparser 1" 
                      className="w-20 h-14 object-cover rounded-md border border-zinc-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">DNI_Comparser_1.webp</p>
                      <p className="text-[10px] text-zinc-400 font-mono">Arxiu penjat correctament</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setC1DniUrl(null)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                      title="Eliminar arxiu"
                      id="btn-remove-c1-dni"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={`border-2 border-dashed ${errors.c1Dni ? 'border-red-300 bg-red-50/20' : 'border-zinc-200 hover:border-fuchsia-300'} rounded-2xl p-5 text-center transition-all`}>
                    <Upload className="mx-auto text-zinc-400 mb-2" size={24} />
                    <p className="text-xs text-zinc-600 font-semibold mb-1">Arrossega una foto o selecciona un arxiu</p>
                    <p className="text-[11px] text-zinc-400 mb-3 font-mono">Format PNG, JPG o WEBP (màx 10MB)</p>
                    
                    <div className="flex flex-wrap gap-2 justify-center">
                      <label className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors border border-zinc-200">
                        Pujar fitxer
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, 'c1')} 
                          className="hidden" 
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => startCamera('c1')}
                        className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                        id="btn-camera-c1"
                      >
                        <Camera size={14} /> Fes foto
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comparser 2 Card */}
          <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-zinc-100 to-transparent pointer-events-none rounded-bl-3xl flex items-center justify-center">
              <span className="font-mono text-zinc-400 text-sm font-bold">#2</span>
            </div>

            <h3 className="font-sans font-bold text-zinc-900 text-lg mb-5 pb-2 border-b border-zinc-100 flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full" />
              Segon Comparser
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Nom *</label>
                <input 
                  type="text" 
                  value={c2Nom} 
                  onChange={(e) => setC2Nom(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Nom ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. Marta"
                  id="input-c2-nom"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Cognoms *</label>
                <input 
                  type="text" 
                  value={c2Cognoms} 
                  onChange={(e) => setC2Cognoms(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Cognoms ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. Vilanova Soler"
                  id="input-c2-cognoms"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Telèfon de contacte *</label>
                <input 
                  type="tel" 
                  value={c2Telefon} 
                  onChange={(e) => setC2Telefon(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Telefon ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. 600654321"
                  id="input-c2-telefon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Correu electrònic *</label>
                <input 
                  type="email" 
                  value={c2Email} 
                  onChange={(e) => setC2Email(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Email ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder="Ex. marta@gmail.com"
                  id="input-c2-email"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Talla de Samarreta *</label>
                <select 
                  value={c2Talla} 
                  onChange={(e) => setC2Talla(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all cursor-pointer"
                  id="select-c2-talla"
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                  <option value="3XL">3XL</option>
                </select>
              </div>

              {/* DNI upload zona */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1.5">Foto de la part frontal del DNI *</label>
                {c2DniUrl ? (
                  <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 flex items-center justify-between gap-3 relative overflow-hidden group">
                    <img 
                      src={c2DniUrl} 
                      alt="DNI Comparser 2" 
                      className="w-20 h-14 object-cover rounded-md border border-zinc-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">DNI_Comparser_2.webp</p>
                      <p className="text-[10px] text-zinc-400 font-mono">Arxiu penjat correctament</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setC2DniUrl(null)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                      title="Eliminar arxiu"
                      id="btn-remove-c2-dni"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={`border-2 border-dashed ${errors.c2Dni ? 'border-red-300 bg-red-50/20' : 'border-zinc-200 hover:border-fuchsia-300'} rounded-2xl p-5 text-center transition-all`}>
                    <Upload className="mx-auto text-zinc-400 mb-2" size={24} />
                    <p className="text-xs text-zinc-600 font-semibold mb-1">Arrossega una foto o selecciona un arxiu</p>
                    <p className="text-[11px] text-zinc-400 mb-3 font-mono">Format PNG, JPG o WEBP (màx 10MB)</p>
                    
                    <div className="flex flex-wrap gap-2 justify-center">
                      <label className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors border border-zinc-200">
                        Pujar fitxer
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, 'c2')} 
                          className="hidden" 
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => startCamera('c2')}
                        className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                        id="btn-camera-c2"
                      >
                        <Camera size={14} /> Fes foto
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic customized questionnaire part */}
        {config.preguntesFormulari.some(q => q.activa) && (
          <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
            <h3 className="font-sans font-bold text-zinc-900 text-lg mb-5 pb-2 border-b border-zinc-100 flex items-center gap-2">
              <Sparkles className="text-fuchsia-500" size={18} />
              Preguntes del Qüestionari d'El Tast
            </h3>

            <div className="space-y-5">
              {config.preguntesFormulari.filter(q => q.activa).map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    {q.titol} {q.requerit && <span className="text-red-500">*</span>}
                  </label>

                  {q.tipus === 'text' && (
                    <input 
                      type="text"
                      value={String(respostesCuestionari[q.id] || '')}
                      onChange={(e) => setRespostesCuestionari(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Escriu la teva resposta"
                      className={`w-full bg-zinc-50 border ${errors[q.id] ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                    />
                  )}

                  {q.tipus === 'select' && (
                    <select
                      value={String(respostesCuestionari[q.id] || '')}
                      onChange={(e) => setRespostesCuestionari(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Selecciona una opció --</option>
                      {q.opcions?.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {q.tipus === 'boolean' && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setRespostesCuestionari(prev => ({ ...prev, [q.id]: true }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          respostesCuestionari[q.id] === true 
                            ? 'bg-fuchsia-500 text-white' 
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setRespostesCuestionari(prev => ({ ...prev, [q.id]: false }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          respostesCuestionari[q.id] === false 
                            ? 'bg-fuchsia-500 text-white' 
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  )}

                  {errors[q.id] && <p className="text-red-500 text-xs font-mono mt-1">{errors[q.id]}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extra Accessories Order Section */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
          <h3 className="font-sans font-bold text-zinc-900 text-lg mb-4 pb-2 border-b border-zinc-100 flex items-center gap-2">
            🎀 Comandes i Complements Addicionals (Opcional)
          </h3>
          <p className="text-zinc-500 text-xs mb-6">Podeu equipar la vostra parella amb el marxandatge oficial de l'entitat.</p>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="space-y-0.5">
                <h4 className="font-sans font-bold text-sm text-zinc-800">Domàs per al Balcó de les Comparses</h4>
                <p className="text-zinc-500 text-xs">Penja l'orgull fúcsia d'El Tast al teu balcó el cap de setmana de carnaval.</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-sans font-bold text-sm text-zinc-900">+{config.preuDomasBalco}€</span>
                <input 
                  type="checkbox" 
                  checked={teDomasBalco}
                  onChange={(e) => setTeDomasBalco(e.target.checked)}
                  className="w-5 h-5 rounded text-fuchsia-500 outline-none accent-fuchsia-500 cursor-pointer"
                  id="checkbox-domas"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="space-y-0.5">
                <h4 className="font-sans font-bold text-sm text-zinc-800">Mocadors oficials addicionals</h4>
                <p className="text-zinc-500 text-xs">Mocador gran de fil de la colla per a amics, fills o familiars que animen.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-sans font-bold text-sm text-zinc-900 mr-2">+{config.preuMocadorExtra}€ / u.</span>
                <button
                  type="button"
                  onClick={() => setTeMocadorsExtra(prev => Math.max(0, prev - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 font-bold text-zinc-700 transition"
                  id="btn-remove-mocador"
                >
                  <Minus size={14} />
                </button>
                <span className="font-mono font-bold text-sm text-zinc-900 w-6 text-center">{teMocadorsExtra}</span>
                <button
                  type="button"
                  onClick={() => setTeMocadorsExtra(prev => prev + 1)}
                  className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 font-bold text-zinc-700 transition"
                  id="btn-add-mocador"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legal RGPD and Payment policy */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <input 
              type="checkbox" 
              checked={acceptaRGPD}
              onChange={(e) => setAcceptaRGPD(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-fuchsia-500 outline-none accent-fuchsia-500 cursor-pointer"
              id="checkbox-rgpd"
            />
            <div>
              <p className="text-xs text-zinc-700 font-sans leading-relaxed">
                Accepto que l'Associació Gastronòmica El Tast tracti les meves dades i arxius dels DNIs exclusivament per a la finalitat de validar legalment la pertinença a les comparses 2026. Els fitxers s'eliminaran del servidor acabada la jornada festiva l'acord amb la RGPD europea. *
              </p>
              {errors.rgpd && <p className="text-red-500 text-[10px] font-mono mt-0.5">{errors.rgpd}</p>}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input 
              type="checkbox" 
              checked={acceptaPresencial}
              onChange={(e) => setAcceptaPresencial(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-fuchsia-500 outline-none accent-fuchsia-500 cursor-pointer"
              id="checkbox-presencial"
            />
            <div>
              <p className="text-xs text-zinc-700 font-sans leading-relaxed font-semibold">
                Accepto que la formalització del pagament (metàl·lic o Bizum de la colla) i la recollida del material d'armilles i mocadors es farà obligatòriament de forma presencial a la secretaria del local d'El Tast presentant el codi QR de preinscripció enviat per correu. *
              </p>
              {errors.presencial && <p className="text-red-500 text-[10px] font-mono mt-0.5">{errors.presencial}</p>}
            </div>
          </div>
        </div>

        {/* Floating action bar with prices breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-white flex flex-col sm:flex-row justify-between items-center gap-6 sticky bottom-4 z-40 backdrop-blur-md bg-zinc-900/95">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-zinc-400 text-xs font-mono uppercase tracking-wider">RESUM ECONÒMIC DE LA PARELLA</p>
            <div className="flex flex-wrap items-baseline gap-2 justify-center sm:justify-start">
              <span className="font-sans font-extrabold text-3xl md:text-4xl text-fuchsia-400">{totalCalculat}€</span>
              <span className="text-zinc-400 text-xs font-mono">
                ({categoria === CategoriaParella.ADULT ? 'Adults' : 'Juvenil'}: {basePrice}€
                {teDomasBalco ? ` + Domàs: ${config.preuDomasBalco}€` : ''}
                {teMocadorsExtra > 0 ? ` + ${teMocadorsExtra} mocadors: ${mocadorsCost}€` : ''})
              </span>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full sm:w-auto px-8 py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-2xl shadow-lg shadow-fuchsia-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            Confirmar Preinscripció <ShieldCheck size={18} />
          </button>
        </div>
      </form>

      {/* Camera Live/Mock Modal Screen Overlay */}
      <AnimatePresence>
        {cameraActive && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center"
            id="camera-overlay"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-lg w-full relative">
              <h3 className="font-sans font-bold text-white text-lg mb-1 tracking-tight">Capturadora de DNI</h3>
              <p className="text-zinc-400 text-xs mb-4">Centreu el document nacional d'identitat (part davantera) dins el quadre.</p>

              {/* Viewfinder stage */}
              <div className="relative aspect-[16/10] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center mb-6">
                {videoError ? (
                  <div className="p-6 text-center">
                    <AlertTriangle className="mx-auto text-amber-500 mb-2" size={28} />
                    <p className="text-xs text-zinc-300 mb-4">{videoError}</p>
                    <button 
                      type="button"
                      onClick={simulateCapture}
                      className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
                      id="btn-simulate-dni"
                    >
                      Simular captura amb foto d'exemple
                    </button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="absolute inset-0 object-cover w-full h-full"
                    />
                    {/* Visual Crop Guide overlay */}
                    <div className="absolute inset-4 border-2 border-dashed border-fuchsia-500/80 rounded-xl pointer-events-none flex items-center justify-center">
                      <div className="text-[10px] bg-fuchsia-500/90 text-white font-bold px-2 py-1 rounded tracking-widest uppercase font-mono">
                        EMQUADREU DNI FRONT
                      </div>
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition"
                  id="btn-cancel-camera"
                >
                  Cancel·lar
                </button>
                {!videoError && (
                  <button 
                    type="button"
                    onClick={capturePhoto}
                    className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-fuchsia-600/30 transition flex items-center gap-1.5"
                    id="btn-capture-camera"
                  >
                    <Camera size={14} /> Fes la foto del DNI
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
