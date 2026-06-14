/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  RotateCw, 
  ZoomIn, 
  Check, 
  X, 
  Sparkles, 
  Save, 
  HelpCircle,
  AlertTriangle,
  QrCode
} from 'lucide-react';
import { Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, CategoriaParella } from '../types';

interface AdminFichaProps {
  registration: Inscripcio;
  onBack: () => void;
  onSave: (updatedRecord: Inscripcio) => void;
}

export default function AdminFicha({ registration, onBack, onSave }: AdminFichaProps) {
  // State variables replicating the sheet parameters
  const [estatPagament, setEstatPagament] = useState<EstatPagament>(registration.estatPagament);
  const [metodePagament, setMetodePagament] = useState<MetodePagament | null>(registration.metodePagament);
  const [estatDni, setEstatDni] = useState<EstatVerificacio>(registration.estatDni);
  const [entregaMaterial, setEntregaMaterial] = useState<EstatInscripcio>(registration.entregaMaterial);
  
  // DNI image manipulation states (rotation degrees)
  const [rotacio1, setRotacio1] = useState(0);
  const [rotacio2, setRotacio2] = useState(0);
  
  // Zoom modal active image URL
  const [activeZoomUrl, setActiveZoomUrl] = useState<string | null>(null);

  // Error notifications
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const rotateImage1 = () => {
    setRotacio1((prev) => (prev + 90) % 360);
  };

  const rotateImage2 = () => {
    setRotacio2((prev) => (prev + 90) % 360);
  };

  const handleGuardaCanvis = () => {
    // Validate rules: No payment method allowed if payment is pending
    if (estatPagament === EstatPagament.PAGAT && !metodePagament) {
      setValidationError("Heu d'especificar obligatòriament el mètode de cobrament (Efectiu o Bizum).");
      return;
    }

    setValidationError(null);

    const updatedInscripcio: Inscripcio = {
      ...registration,
      estatPagament,
      metodePagament: estatPagament === EstatPagament.PAGAT ? metodePagament : null,
      estatDni,
      entregaMaterial,
      actualizadoEn: new Date().toISOString()
    };

    onSave(updatedInscripcio);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onBack();
    }, 1500);
  };

  return (
    <div className="space-y-6" id="registration-detail-container">
      {/* Detail header toolbar */}
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow">
        <button 
          onClick={onBack}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          id="btn-ficha-back"
        >
          <ArrowLeft size={14} /> Tornar al taulell
        </button>

        <div className="text-center">
          <span className="font-mono text-[9px] text-zinc-500 uppercase">CODI DETALL DE FITXA</span>
          <h2 className="font-sans font-extrabold text-base tracking-tight text-fuchsia-400">{registration.codiSeguiment}</h2>
        </div>

        <button 
          onClick={handleGuardaCanvis}
          className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow"
          id="btn-ficha-save"
        >
          {saveSuccess ? "S'ha desat!" : "Desar Canvis"} <Save size={14} />
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-2xl font-semibold flex items-center gap-2">
          <ShieldCheck size={20} className="text-green-600 animate-bounce" />
          <span>Ficha d'inscripció actualitzada i guardada correctament al sistema de l'entitat! Redirigint...</span>
        </div>
      )}

      {validationError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-center gap-2 font-mono">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: General Profile and Registration Data */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100">
              <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded ${
                registration.categoria === CategoriaParella.ADULT 
                  ? 'bg-zinc-900 text-white' 
                  : 'bg-fuchsia-100 text-fuchsia-800'
              }`}>
                {registration.categoria}
              </span>
              <span className="font-sans font-bold text-zinc-700 text-sm">Informació dels Participants</span>
            </div>

            {/* Participants mirror block cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Comparser 1 profile card */}
              <div className="bg-zinc-50 rounded-2xl p-4.5 border border-zinc-100 space-y-3 relative overflow-hidden">
                <span className="absolute top-2 right-2 text-[10px] text-zinc-400 font-mono font-bold">C1</span>
                <h4 className="font-sans font-black text-sm text-zinc-900 pr-4 flex items-center gap-1.5">
                  <User size={14} className="text-fuchsia-500" />
                  {registration.c1Nom} {registration.c1Cognoms}
                </h4>
                
                <div className="space-y-1.5 text-xs text-zinc-600 font-sans">
                  <a href={`tel:${registration.c1Telefon}`} className="flex items-center gap-1.5 hover:text-zinc-950">
                    <Phone className="text-zinc-400" size={12} /> {registration.c1Telefon}
                  </a>
                  <a href={`mailto:${registration.c1Email}`} className="flex items-center gap-1.5 hover:text-zinc-950 truncate block">
                    <Mail className="text-zinc-400" size={12} /> {registration.c1Email}
                  </a>
                  <p className="flex items-center gap-1.5 mt-2">
                    <span className="font-mono text-[9px] bg-zinc-200 text-zinc-700 px-2.5 py-0.5 rounded font-extrabold uppercase">TALLA DE ROBA:</span>
                    <strong className="text-zinc-900 text-sm">{registration.c1Talla}</strong>
                  </p>
                </div>
              </div>

              {/* Comparser 2 profile card */}
              <div className="bg-zinc-50 rounded-2xl p-4.5 border border-zinc-100 space-y-3 relative overflow-hidden">
                <span className="absolute top-2 right-2 text-[10px] text-zinc-400 font-mono font-bold">C2</span>
                <h4 className="font-sans font-black text-sm text-zinc-900 pr-4 flex items-center gap-1.5">
                  <User size={14} className="text-fuchsia-500" />
                  {registration.c2Nom} {registration.c2Cognoms}
                </h4>

                <div className="space-y-1.5 text-xs text-zinc-600 font-sans">
                  <a href={`tel:${registration.c2Telefon}`} className="flex items-center gap-1.5 hover:text-zinc-950">
                    <Phone className="text-zinc-400" size={12} /> {registration.c2Telefon}
                  </a>
                  <a href={`mailto:${registration.c2Email}`} className="flex items-center gap-1.5 hover:text-zinc-950 truncate block">
                    <Mail className="text-zinc-400" size={12} /> {registration.c2Email}
                  </a>
                  <p className="flex items-center gap-1.5 mt-2">
                    <span className="font-mono text-[9px] bg-zinc-200 text-zinc-700 px-2.5 py-0.5 rounded font-extrabold uppercase">TALLA DE ROBA:</span>
                    <strong className="text-zinc-900 text-sm">{registration.c2Talla}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Extras ordered details indicator list */}
            <div className="space-y-3 border-t border-zinc-100 pt-5">
              <span className="font-sans font-bold text-zinc-700 text-sm block">Complements o Marxandatge afegit</span>
              <div className="flex flex-wrap gap-2">
                {registration.teDomasBalco ? (
                  <span className="bg-fuchsia-100 text-fuchsia-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-fuchsia-200 flex items-center gap-1">
                    💝 Domàs oficial inclòs
                  </span>
                ) : (
                  <span className="bg-zinc-50 text-zinc-400 text-xs px-3 py-1.5 rounded-xl border border-zinc-200/50">
                    Sense domàs de balcó
                  </span>
                )}

                {registration.teMocadorsExtra > 0 ? (
                  <span className="bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                    🧣 {registration.teMocadorsExtra} mocador(s) extres ordenats ({registration.teMocadorsExtra * 6}€)
                  </span>
                ) : (
                  <span className="bg-zinc-50 text-zinc-400 text-xs px-3 py-1.5 rounded-xl border border-zinc-200/50">
                    Sense mocadors extres
                  </span>
                )}
              </div>
            </div>

            {/* Answers questionnaire block */}
            {Object.keys(registration.respostesCuestionari).length > 0 && (
              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 space-y-4">
                <span className="font-sans font-black text-xs text-zinc-505 uppercase tracking-wider block">RESPOSTES AL CÜESTIONARI COMPARSILER:</span>
                <div className="divide-y divide-zinc-200/60 text-xs space-y-3 pt-1">
                  {Object.entries(registration.respostesCuestionari).map(([key, value]) => {
                    // Match key question text statically representation for realistic view
                    let label = `Pregunta (${key})`;
                    if (key === 'preg-1') label = "Primera vegada tolerant amb El Tast?";
                    if (key === 'preg-2') label = "Participació al dinar de germanor de la colla?";
                    if (key === 'preg-3') label = "Intoleràncies alimentàries o comentaris dietètics:";
                    
                    return (
                      <div key={key} className="pt-2">
                        <p className="font-bold text-zinc-800 mb-1 leading-relaxed">{label}</p>
                        <p className="text-zinc-600 font-mono italic">
                          {value === true ? 'Sí' : value === false ? 'No' : String(value || 'Sense resposta')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* DNI auditing stage documents layout */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="font-sans font-bold text-zinc-700 text-sm flex items-center gap-1.5">
                <FileText size={16} className="text-fuchsia-500" />
                Auditoria de Documents (DNI / NIE)
              </span>
              <span className="text-[10px] text-zinc-400 font-mono uppercase">Control de legibilitat</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* DNI Comparser 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-800 font-bold font-mono">DNI Comparser 1 ({registration.c1Nom})</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={rotateImage1}
                      className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-md text-[10px] inline-flex items-center gap-1 transition"
                      title="Rotar 90 graus"
                    >
                      <RotateCw size={12} /> Rotar
                    </button>
                    <button 
                      onClick={() => setActiveZoomUrl(registration.c1DniUrl)}
                      className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-md text-[10px] inline-flex items-center gap-1 transition"
                      title="Ampliar imatge"
                    >
                      <ZoomIn size={12} /> Lupa
                    </button>
                  </div>
                </div>

                <div 
                  className="aspect-[1.58] bg-zinc-150 rounded-2xl overflow-hidden border border-zinc-200 relative cursor-zoom-in flex items-center justify-center bg-zinc-900"
                  onClick={() => setActiveZoomUrl(registration.c1DniUrl)}
                >
                  <img 
                    src={registration.c1DniUrl} 
                    alt="DNI Comparser 1" 
                    style={{ transform: `rotate(${rotacio1}deg)` }}
                    className="object-contain w-full h-full transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/5 hover:bg-black/25 transition-colors" />
                </div>
              </div>

              {/* DNI Comparser 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-800 font-bold font-mono">DNI Comparser 2 ({registration.c2Nom})</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={rotateImage2}
                      className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-md text-[10px] inline-flex items-center gap-1 transition"
                      title="Rotar 90 graus"
                    >
                      <RotateCw size={12} /> Rotar
                    </button>
                    <button 
                      onClick={() => setActiveZoomUrl(registration.c2DniUrl)}
                      className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-md text-[10px] inline-flex items-center gap-1 transition"
                      title="Ampliar imatge"
                    >
                      <ZoomIn size={12} /> Lupa
                    </button>
                  </div>
                </div>

                <div 
                  className="aspect-[1.58] bg-zinc-150 rounded-2xl overflow-hidden border border-zinc-200 relative cursor-zoom-in flex items-center justify-center bg-zinc-900"
                  onClick={() => setActiveZoomUrl(registration.c2DniUrl)}
                >
                  <img 
                    src={registration.c2DniUrl} 
                    alt="DNI Comparser 2" 
                    style={{ transform: `rotate(${rotacio2}deg)` }}
                    className="object-contain w-full h-full transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/5 hover:bg-black/25 transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Toggles, Auditing Controls and Checkout state */}
        <div className="space-y-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 text-white shadow space-y-6">
            <h3 className="font-sans font-black text-base text-fuchsia-400 pb-3 border-b border-zinc-900 tracking-tight flex items-center gap-2">
              <Sparkles size={16} /> Controles i Semàfors de Mesa
            </h3>

            {/* Segment 1: Verified DNI */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">DNI Validat per Secretaria</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setEstatDni(EstatVerificacio.PENDENT)}
                  className={`py-2 rounded-xl text-center text-[10px] font-bold tracking-tight block ${
                    estatDni === EstatVerificacio.PENDENT 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  Pendent
                </button>
                <button
                  type="button"
                  onClick={() => setEstatDni(EstatVerificacio.VALIDAT)}
                  className={`py-2 rounded-xl text-center text-[10px] font-bold tracking-tight block ${
                    estatDni === EstatVerificacio.VALIDAT 
                      ? 'bg-green-600 text-white' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  VALIDAT
                </button>
                <button
                  type="button"
                  onClick={() => setEstatDni(EstatVerificacio.REBUTJAT)}
                  className={`py-2 rounded-xl text-center text-[10px] font-bold tracking-tight block ${
                    estatDni === EstatVerificacio.REBUTJAT 
                      ? 'bg-red-600 text-white' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  REBUTJAT
                </button>
              </div>
            </div>

            {/* Segment 2: Payment state and selection */}
            <div className="space-y-3.5 border-t border-zinc-900 pt-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Estat del Pagament</label>
                <span className="font-mono text-xs text-zinc-500 font-bold">Import Total: {registration.preuCalculat}€</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEstatPagament(EstatPagament.PENDENT);
                    setMetodePagament(null);
                  }}
                  className={`py-2.5 rounded-xl text-center text-xs font-bold transition-all ${
                    estatPagament === EstatPagament.PENDENT 
                      ? 'bg-amber-500 text-white shadow' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  PENDENT DE PAGAR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEstatPagament(EstatPagament.PAGAT);
                    // Default to Bizum if none selected yet
                    if (!metodePagament) setMetodePagament(MetodePagament.BIZUM);
                  }}
                  className={`py-2.5 rounded-xl text-center text-xs font-bold transition-all ${
                    estatPagament === EstatPagament.PAGAT 
                      ? 'bg-green-600 text-white shadow' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  PAGAT A CAIXA
                </button>
              </div>

              {/* Choose payment method (Cash vs Bizum) */}
              {estatPagament === EstatPagament.PAGAT && (
                <div className="bg-zinc-900/40 p-3 rounded-2xl border border-zinc-800 space-y-2 animate-fadeIn">
                  <span className="block text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider font-mono">Mètode utilitzat:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMetodePagament(MetodePagament.EFECTIU)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        metodePagament === MetodePagament.EFECTIU 
                          ? 'bg-fuchsia-600 text-white shadow' 
                          : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-900'
                      }`}
                    >
                      Efectiu (Metàl·lic)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodePagament(MetodePagament.BIZUM)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        metodePagament === MetodePagament.BIZUM 
                          ? 'bg-fuchsia-600 text-white shadow' 
                          : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-900'
                      }`}
                    >
                      Bizum Colla
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Segment 3: Material Delivery */}
            <div className="space-y-2 border-t border-zinc-900 pt-4">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Lliurament de Fulard / Mocador / Armilla</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEntregaMaterial(EstatInscripcio.PENDENT)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    entregaMaterial === EstatInscripcio.PENDENT 
                      ? 'bg-zinc-850 text-white border border-zinc-700' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                >
                  Pendent d'entregar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntregaMaterial(EstatInscripcio.ENTREGAT);
                    // Standard visual quality of life check
                    if (estatDni === EstatVerificacio.PENDENT) {
                      setEstatDni(EstatVerificacio.VALIDAT);
                    }
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    entregaMaterial === EstatInscripcio.ENTREGAT 
                      ? 'bg-fuchsia-600 text-white shadow shadow-fuchsia-600/10' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                >
                  Lliurat Complet
                </button>
              </div>
            </div>

            {/* Save Action block */}
            <div className="pt-4 border-t border-zinc-900">
              <button
                type="button"
                onClick={handleGuardaCanvis}
                className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-2xl shadow-xl transition-all shadow-fuchsia-600/20 text-sm flex items-center justify-center gap-2 hover:scale-[1.01]"
                id="btn-fiche-save-action"
              >
                <Save size={16} /> Guardar i Confirmar Ficha
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DNI Ampliada Modal */}
      {activeZoomUrl && (
        <div 
          onClick={() => setActiveZoomUrl(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
          id="dni-zoom-modal"
        >
          <div className="absolute top-4 right-4 bg-zinc-900 p-2 text-white hover:bg-zinc-800 rounded-full cursor-pointer border border-zinc-800">
            <X size={20} />
          </div>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl relative pointer-events-auto shadow-2xl border border-zinc-800">
            <img 
              src={activeZoomUrl} 
              alt="Ampliació DNI" 
              className="max-w-full max-h-[85vh] object-contain block m-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-zinc-500 text-xs font-mono mt-3 uppercase tracking-wider">Prem a qualsevol lloc per tancar el visor de seguretat</p>
        </div>
      )}
    </div>
  );
}
