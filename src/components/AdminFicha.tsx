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
import { useLanguage } from '../LanguageContext';
import { Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, CategoriaParella, SistemaConfig } from '../types';

interface AdminFichaProps {
  registration: Inscripcio;
  config?: SistemaConfig;
  onBack: () => void;
  onSave: (updatedRecord: Inscripcio) => void;
}

export default function AdminFicha({ registration, config, onBack, onSave }: AdminFichaProps) {
  const { language, t } = useLanguage();
  // State variables replicating the sheet parameters
  const [estatPagament, setEstatPagament] = useState<EstatPagament>(registration.estatPagament);
  const [metodePagament, setMetodePagament] = useState<MetodePagament | null>(registration.metodePagament);
  const [estatDni, setEstatDni] = useState<EstatVerificacio>(registration.estatDni);
  const [entregaMaterial, setEntregaMaterial] = useState<EstatInscripcio>(registration.entregaMaterial);
  const [entregaC1Uniforme, setEntregaC1Uniforme] = useState<boolean>(() => {
    if (registration.entregaC1Uniforme !== undefined) return registration.entregaC1Uniforme;
    return registration.entregaMaterial === EstatInscripcio.ENTREGAT;
  });
  const [entregaC2Uniforme, setEntregaC2Uniforme] = useState<boolean>(() => {
    if (registration.entregaC2Uniforme !== undefined) return registration.entregaC2Uniforme;
    return registration.entregaMaterial === EstatInscripcio.ENTREGAT;
  });
  const [entregaDomas, setEntregaDomas] = useState<boolean>(() => {
    if (registration.entregaDomas !== undefined) return registration.entregaDomas;
    return registration.entregaMaterial === EstatInscripcio.ENTREGAT;
  });
  const [entregaMocadors, setEntregaMocadors] = useState<boolean>(() => {
    if (registration.entregaMocadors !== undefined) return registration.entregaMocadors;
    return registration.entregaMaterial === EstatInscripcio.ENTREGAT;
  });
  const [llistaEspera, setLlistaEspera] = useState<boolean>(!!registration.llistaEspera);

  // Participant Editable configurations
  const [c1Nom, setC1Nom] = useState(registration.c1Nom);
  const [c1Cognoms, setC1Cognoms] = useState(registration.c1Cognoms);
  const [c1Email, setC1Email] = useState(registration.c1Email);
  const [c1Telefon, setC1Telefon] = useState(registration.c1Telefon);
  const [c1Talla, setC1Talla] = useState(registration.c1Talla);
  const [c1UniformeTipus, setC1UniformeTipus] = useState<'compra' | 'lloguer'>(registration.c1UniformeTipus || 'compra');

  const [c1TutorNom, setC1TutorNom] = useState(registration.c1TutorNom || '');
  const [c1TutorCognoms, setC1TutorCognoms] = useState(registration.c1TutorCognoms || '');
  const [c1TutorDni, setC1TutorDni] = useState(registration.c1TutorDni || '');
  const [c1TutorTelefon, setC1TutorTelefon] = useState(registration.c1TutorTelefon || '');

  const [c2Nom, setC2Nom] = useState(registration.c2Nom);
  const [c2Cognoms, setC2Cognoms] = useState(registration.c2Cognoms);
  const [c2Email, setC2Email] = useState(registration.c2Email);
  const [c2Telefon, setC2Telefon] = useState(registration.c2Telefon);
  const [c2Talla, setC2Talla] = useState(registration.c2Talla);
  const [c2UniformeTipus, setC2UniformeTipus] = useState<'compra' | 'lloguer'>(registration.c2UniformeTipus || 'compra');

  const [c2TutorNom, setC2TutorNom] = useState(registration.c2TutorNom || '');
  const [c2TutorCognoms, setC2TutorCognoms] = useState(registration.c2TutorCognoms || '');
  const [c2TutorDni, setC2TutorDni] = useState(registration.c2TutorDni || '');
  const [c2TutorTelefon, setC2TutorTelefon] = useState(registration.c2TutorTelefon || '');
  
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
      setValidationError(
        language === 'ca'
          ? "Heu d'especificar obligatòriament el mètode de cobrament (Efectiu o Bizum)."
          : "Debe especificar obligatoriamente el método de cobro (Efectivo o Bizum)."
      );
      return;
    }

    if (!c1Nom.trim() || !c2Nom.trim()) {
      setValidationError(
        language === 'ca'
          ? "El nom dels participants no pot estar buit."
          : "El nombre de los participantes no puede estar vacío."
      );
      return;
    }

    setValidationError(null);

    const updatedInscripcio: Inscripcio = {
      ...registration,
      c1Nom: c1Nom.trim(),
      c1Cognoms: c1Cognoms.trim(),
      c1Email: c1Email.trim(),
      c1Telefon: c1Telefon.trim(),
      c1Talla,
      c1UniformeTipus,
      c1TutorNom: c1TutorNom.trim(),
      c1TutorCognoms: c1TutorCognoms.trim(),
      c1TutorDni: c1TutorDni.trim(),
      c1TutorTelefon: c1TutorTelefon.trim(),
      c2Nom: c2Nom.trim(),
      c2Cognoms: c2Cognoms.trim(),
      c2Email: c2Email.trim(),
      c2Telefon: c2Telefon.trim(),
      c2Talla,
      c2UniformeTipus,
      c2TutorNom: c2TutorNom.trim(),
      c2TutorCognoms: c2TutorCognoms.trim(),
      c2TutorDni: c2TutorDni.trim(),
      c2TutorTelefon: c2TutorTelefon.trim(),
      estatPagament,
      metodePagament: estatPagament === EstatPagament.PAGAT ? metodePagament : null,
      estatDni,
      entregaMaterial,
      entregaC1Uniforme,
      entregaC2Uniforme,
      entregaDomas,
      entregaMocadors,
      llistaEspera,
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
          <ArrowLeft size={14} /> {language === 'ca' ? 'Tornar al taulell' : 'Volver al tablero'}
        </button>

        <div className="text-center">
          <span className="font-mono text-[9px] text-zinc-500 uppercase">
            {language === 'ca' ? 'CODI DETALL DE FITXA' : 'CÓDIGO DETALLE DE FICHA'}
          </span>
          <h2 className="font-sans font-extrabold text-base tracking-tight text-fuchsia-400">{registration.codiSeguiment}</h2>
        </div>

        <button 
          onClick={handleGuardaCanvis}
          className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow"
          id="btn-ficha-save"
        >
          {saveSuccess 
            ? (language === 'ca' ? "S'ha desat!" : "¡Guardado!") 
            : (language === 'ca' ? "Desar Canvis" : "Guardar Cambios")} <Save size={14} />
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-2xl font-semibold flex items-center gap-2">
          <ShieldCheck size={20} className="text-green-600 animate-bounce" />
          <span>
            {language === 'ca' 
              ? "Ficha d'inscripció actualitzada i guardada correctament al sistema de l'entitat! Redirigint..."
              : "¡Ficha de inscripción actualizada y guardada correctamente en el sistema de la entidad! Redireccionando..."}
          </span>
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
              <span className="font-sans font-bold text-zinc-700 text-sm">
                {language === 'ca' ? "Informació dels Participants" : "Información de los Participantes"}
              </span>
            </div>

            {/* Participants mirror block cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Comparser 1 profile card */}
              <div className="bg-zinc-50 rounded-2xl p-4.5 border border-zinc-200/60 space-y-3 relative overflow-hidden" id="c1-profile-card">
                <span className="absolute top-2 right-2 text-[10px] text-zinc-400 font-mono font-bold">C1 (Editable)</span>
                
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Nom</label>
                      <input 
                        type="text" 
                        value={c1Nom} 
                        onChange={(e) => setC1Nom(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Cognoms</label>
                      <input 
                        type="text" 
                        value={c1Cognoms} 
                        onChange={(e) => setC1Cognoms(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Telèfon</label>
                      <input 
                        type="tel" 
                        value={c1Telefon} 
                        onChange={(e) => setC1Telefon(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">E-mail</label>
                      <input 
                        type="email" 
                        value={c1Email} 
                        onChange={(e) => setC1Email(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none truncate" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Talla</label>
                      <select
                        value={c1Talla}
                        onChange={(e) => setC1Talla(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold font-sans focus:outline-none cursor-pointer"
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
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Adquisició</label>
                      <select
                        value={c1UniformeTipus}
                        onChange={(e) => setC1UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                        className="w-full bg-white border border-[#ff0090]/40 rounded-lg px-2 py-1.5 text-xs font-bold text-[#ff0090] font-sans focus:outline-none cursor-pointer"
                      >
                        <option value="compra">{language === 'ca' ? 'Compra' : 'Compra (Venta)'}</option>
                        <option value="lloguer">{language === 'ca' ? 'Lloguer (Alquiler)' : 'Alquiler'}</option>
                      </select>
                    </div>
                  </div>

                  {registration.seleccionsUniforme && Object.keys(registration.seleccionsUniforme).length > 0 && (
                    <div className="space-y-1 bg-white p-2 border border-zinc-150 rounded-xl">
                      <span className="block text-[8px] font-mono text-zinc-400 uppercase font-bold tracking-wider mb-1">
                        {language === 'ca' ? "Comanda d'Equipament (Detalls):" : "Pedido de Equipamiento (Detalles):"}
                      </span>
                      {Object.entries(registration.seleccionsUniforme).map(([liniaId, sel]) => {
                        const linia = config?.liniisUniforme?.find(l => l.id === liniaId);
                        const nomLinia = linia ? linia.nom : liniaId;
                        return (
                          <div key={liniaId} className="flex justify-between items-center text-[10px] py-0.5">
                            <span className="text-zinc-500 truncate pr-1">{nomLinia}:</span>
                            <span className="font-mono text-zinc-900 font-extrabold">
                              {sel.c1Talla} {linia?.requeixQuantitat && `(${sel.quantitat} u)`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {registration.c1EsMenor && (
                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2.5 space-y-2 mt-1">
                      <span className="block text-[8px] font-mono text-amber-800 uppercase font-black tracking-wider">TUTOR (Editable):</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">Nom</label>
                          <input 
                            type="text" 
                            value={c1TutorNom} 
                            onChange={(e) => setC1TutorNom(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">Cognoms</label>
                          <input 
                            type="text" 
                            value={c1TutorCognoms} 
                            onChange={(e) => setC1TutorCognoms(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">DNI</label>
                          <input 
                            type="text" 
                            value={c1TutorDni} 
                            onChange={(e) => setC1TutorDni(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">Mòbil</label>
                          <input 
                            type="tel" 
                            value={c1TutorTelefon} 
                            onChange={(e) => setC1TutorTelefon(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Comparser 2 profile card */}
              <div className="bg-zinc-50 rounded-2xl p-4.5 border border-zinc-200/60 space-y-3 relative overflow-hidden" id="c2-profile-card">
                <span className="absolute top-2 right-2 text-[10px] text-zinc-400 font-mono font-bold">C2 (Editable)</span>
                
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Nom</label>
                      <input 
                        type="text" 
                        value={c2Nom} 
                        onChange={(e) => setC2Nom(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Cognoms</label>
                      <input 
                        type="text" 
                        value={c2Cognoms} 
                        onChange={(e) => setC2Cognoms(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Telèfon</label>
                      <input 
                        type="tel" 
                        value={c2Telefon} 
                        onChange={(e) => setC2Telefon(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">E-mail</label>
                      <input 
                        type="email" 
                        value={c2Email} 
                        onChange={(e) => setC2Email(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none truncate" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Talla</label>
                      <select
                        value={c2Talla}
                        onChange={(e) => setC2Talla(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold font-sans focus:outline-none cursor-pointer"
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
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Adquisició</label>
                      <select
                        value={c2UniformeTipus}
                        onChange={(e) => setC2UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                        className="w-full bg-white border border-[#ff0090]/40 rounded-lg px-2 py-1.5 text-xs font-bold text-[#ff0090] font-sans focus:outline-none cursor-pointer"
                      >
                        <option value="compra">{language === 'ca' ? 'Compra' : 'Compra (Venta)'}</option>
                        <option value="lloguer">{language === 'ca' ? 'Lloguer (Alquiler)' : 'Alquiler'}</option>
                      </select>
                    </div>
                  </div>

                  {registration.seleccionsUniforme && Object.keys(registration.seleccionsUniforme).length > 0 && (
                    <div className="space-y-1 bg-white p-2 border border-zinc-150 rounded-xl">
                      <span className="block text-[8px] font-mono text-zinc-400 uppercase font-bold tracking-wider mb-1">
                        {language === 'ca' ? "Comanda d'Equipament (Detalls):" : "Pedido de Equipamiento (Detalles):"}
                      </span>
                      {Object.entries(registration.seleccionsUniforme).map(([liniaId, sel]) => {
                        const linia = config?.liniisUniforme?.find(l => l.id === liniaId);
                        const nomLinia = linia ? linia.nom : liniaId;
                        return (
                          <div key={liniaId} className="flex justify-between items-center text-[10px] py-0.5">
                            <span className="text-zinc-500 truncate pr-1">{nomLinia}:</span>
                            <span className="font-mono text-zinc-900 font-extrabold font-sans">
                              {sel.c2Talla} {linia?.requeixQuantitat && `(${sel.quantitat} u)`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {registration.c2EsMenor && (
                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2.5 space-y-2 mt-1">
                      <span className="block text-[8px] font-mono text-amber-800 uppercase font-black tracking-wider">TUTOR (Editable):</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">Nom</label>
                          <input 
                            type="text" 
                            value={c2TutorNom} 
                            onChange={(e) => setC2TutorNom(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">Cognoms</label>
                          <input 
                            type="text" 
                            value={c2TutorCognoms} 
                            onChange={(e) => setC2TutorCognoms(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">DNI</label>
                          <input 
                            type="text" 
                            value={c2TutorDni} 
                            onChange={(e) => setC2TutorDni(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-zinc-400 uppercase font-mono">Mòbil</label>
                          <input 
                            type="tel" 
                            value={c2TutorTelefon} 
                            onChange={(e) => setC2TutorTelefon(e.target.value)} 
                            className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Extras ordered details indicator list */}
            <div className="space-y-3 border-t border-zinc-100 pt-5">
              <span className="font-sans font-bold text-zinc-700 text-sm block">
                {language === 'ca' ? "Complements o Marxandatge afegit" : "Complementos o Merchandising añadido"}
              </span>
              <div className="flex flex-wrap gap-2">
                {registration.teDomasBalco ? (
                  <span className="bg-fuchsia-100 text-fuchsia-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-fuchsia-200 flex items-center gap-1">
                    💝 {language === 'ca' ? "Domàs oficial inclòs" : "Cubrebalcón oficial incluido"}
                  </span>
                ) : (
                  <span className="bg-zinc-50 text-zinc-400 text-xs px-3 py-1.5 rounded-xl border border-zinc-200/50">
                    {language === 'ca' ? "Sense domàs de balcó" : "Sin cubrebalcón de balcón"}
                  </span>
                )}

                {registration.teMocadorsExtra > 0 ? (
                  <span className="bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                    🧣 {language === 'ca' 
                      ? `${registration.teMocadorsExtra} mocador(s) extres ordenats (${registration.teMocadorsExtra * 6}€)`
                      : `${registration.teMocadorsExtra} pañuelo(s) extras pedidos (${registration.teMocadorsExtra * 6}€)`}
                  </span>
                ) : (
                  <span className="bg-zinc-50 text-zinc-400 text-xs px-3 py-1.5 rounded-xl border border-zinc-200/50">
                    {language === 'ca' ? "Sense mocadors extres" : "Sin pañuelos extras"}
                  </span>
                )}
              </div>
            </div>

            {/* Answers questionnaire block */}
            {Object.keys(registration.respostesCuestionari).length > 0 && (
              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 space-y-4">
                <span className="font-sans font-black text-xs text-zinc-505 uppercase tracking-wider block">
                  {language === 'ca' ? "RESPOSTES AL CÜESTIONARI COMPARSILER:" : "RESPUESTAS AL CUESTIONARIO COMPARSILER:"}
                </span>
                <div className="divide-y divide-zinc-200/60 text-xs space-y-3 pt-1">
                  {Object.entries(registration.respostesCuestionari).map(([key, value]) => {
                    // Match key question text statically representation for realistic view
                    let label = `Pregunta (${key})`;
                    if (key === 'preg-1') {
                      label = language === 'ca' ? "Primera vegada tolerant amb El Tast?" : "¿Primera vez saliendo con El Tast?";
                    }
                    if (key === 'preg-2') {
                      label = language === 'ca' ? "Participació al dinar de germanor de la colla?" : "¿Participación en la comida de hermandad de la colla?";
                    }
                    if (key === 'preg-3') {
                      label = language === 'ca' ? "Intoleràncies alimentàries o comentaris dietètics:" : "Intolerancias alimentarias o comentarios dietéticos:";
                    }
                    
                    return (
                      <div key={key} className="pt-2">
                        <p className="font-bold text-zinc-800 mb-1 leading-relaxed">{label}</p>
                        <p className="text-zinc-600 font-mono italic">
                          {value === true ? 'Sí' : value === false ? 'No' : String(value || (language === 'ca' ? 'Sense resposta' : 'Sin respuesta'))}
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
                {language === 'ca' ? "Auditoria de Documents (DNI / NIE)" : "Auditoría de Documentos (DNI / NIE)"}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono uppercase">
                {language === 'ca' ? "Control de legibilitat" : "Control de legibilidad"}
              </span>
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
                      title={language === 'ca' ? "Rotar 90 graus" : "Rotar 90 grados"}
                    >
                      <RotateCw size={12} /> {language === 'ca' ? "Rotar" : "Rotar"}
                    </button>
                    <button 
                      onClick={() => setActiveZoomUrl(registration.c1DniUrl)}
                      className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-md text-[10px] inline-flex items-center gap-1 transition"
                      title={language === 'ca' ? "Ampliar imatge" : "Ampliar imagen"}
                    >
                      <ZoomIn size={12} /> {language === 'ca' ? "Lupa" : "Lupa"}
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
                      title={language === 'ca' ? "Rotar 90 graus" : "Rotar 90 grados"}
                    >
                      <RotateCw size={12} /> {language === 'ca' ? "Rotar" : "Rotar"}
                    </button>
                    <button 
                      onClick={() => setActiveZoomUrl(registration.c2DniUrl)}
                      className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-605 rounded-md text-[10px] inline-flex items-center gap-1 transition"
                      title={language === 'ca' ? "Ampliar imatge" : "Ampliar imagen"}
                    >
                      <ZoomIn size={12} /> {language === 'ca' ? "Lupa" : "Lupa"}
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
              <Sparkles size={16} /> {language === 'ca' ? "Controles i Semàfors de Mesa" : "Controles y Semáforos de Mesa"}
            </h3>

            {/* Segment 1: Verified DNI */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "DNI Validat per Secretaria" : "DNI Validado por Secretaría"}
              </label>
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
                  {language === 'ca' ? "Pendent" : "Pendiente"}
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
                  {language === 'ca' ? "VALIDAT" : "VALIDADO"}
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
                  {language === 'ca' ? "REBUTJAT" : "RECHAZADO"}
                </button>
              </div>
            </div>

            {/* Segment 2: Payment state and selection */}
            <div className="space-y-3.5 border-t border-zinc-900 pt-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                  {language === 'ca' ? "Estat del Pagament" : "Estado del Pago"}
                </label>
                <span className="font-mono text-xs text-zinc-500 font-bold">
                  {language === 'ca' ? "Import Total" : "Importe Total"}: {registration.preuCalculat}€
                </span>
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
                  {language === 'ca' ? "PENDENT DE PAGAR" : "PENDIENTE DE PAGO"}
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
                  {language === 'ca' ? "PAGAT A CAIXA" : "PAGADO EN CAJA"}
                </button>
              </div>

              {/* Choose payment method (Cash vs Bizum) */}
              {estatPagament === EstatPagament.PAGAT && (
                <div className="bg-zinc-900/40 p-3 rounded-2xl border border-zinc-800 space-y-2 animate-fadeIn">
                  <span className="block text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider font-mono">
                    {language === 'ca' ? "Mètode utilitzat:" : "Método utilizado:"}
                  </span>
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
                      {language === 'ca' ? "Efectiu (Metàl·lic)" : "Efectivo (Metálico)"}
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
            <div className="space-y-2 border-t border-zinc-900 pt-4" id="segment-material-delivery">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "Lliurament de Fulard / Mocador / Armilla" : "Entrega de Pañuelo / Pañoleta / Chaleco"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEntregaMaterial(EstatInscripcio.PENDENT);
                    setEntregaC1Uniforme(false);
                    setEntregaC2Uniforme(false);
                    setEntregaDomas(false);
                    setEntregaMocadors(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    entregaMaterial === EstatInscripcio.PENDENT 
                      ? 'bg-zinc-850 text-white border border-zinc-700' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                  id="btn-material-pendent"
                >
                  {language === 'ca' ? "Pendent d'entregar" : "Pendiente de entregar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntregaMaterial(EstatInscripcio.ENTREGAT);
                    setEntregaC1Uniforme(true);
                    setEntregaC2Uniforme(true);
                    setEntregaDomas(true);
                    setEntregaMocadors(true);
                    if (estatDni === EstatVerificacio.PENDENT) {
                      setEstatDni(EstatVerificacio.VALIDAT);
                    }
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    entregaMaterial === EstatInscripcio.ENTREGAT 
                      ? 'bg-fuchsia-600 text-white shadow shadow-fuchsia-600/10' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                  id="btn-material-entregat"
                >
                  {language === 'ca' ? "Lliurat Complet" : "Entregado Completo"}
                </button>
              </div>

              {/* Checklist details matching ordered elements */}
              <div className="mt-2 text-xs bg-zinc-950/60 p-3 rounded-2xl border border-zinc-900 space-y-2">
                <span className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                  {language === 'ca' ? "DETALL DE LA COMANDA A LLIURAR:" : "DETALLE DEL PEDIDO A ENTREGAR:"}
                </span>

                <div className="space-y-2 text-[11px]">
                  {/* 1. Comparser 1 size */}
                  {c1Talla && (
                    <label className="flex items-center gap-2.5 text-zinc-300 hover:text-white cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={entregaC1Uniforme}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setEntregaC1Uniforme(val);
                          const allChecked = val && (!c2Talla || entregaC2Uniforme) && (!registration.teDomasBalco || entregaDomas) && (!(registration.teMocadorsExtra > 0) || entregaMocadors);
                          setEntregaMaterial(allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT);
                        }}
                        className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                        id="chk-entrega-c1"
                      />
                      <span className="leading-tight">
                        {language === 'ca' ? "👚 Vestidor Coparticipant 1 - Talla: " : "👚 Vestuario Coparticipante 1 - Talla: "}
                        <strong className="font-mono text-[#ff0090]">{c1Talla}</strong> 
                        <span className="text-[10px] text-zinc-500 ml-1">({c1UniformeTipus})</span>
                      </span>
                    </label>
                  )}

                  {/* 2. Comparser 2 size */}
                  {c2Talla && (
                    <label className="flex items-center gap-2.5 text-zinc-300 hover:text-white cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={entregaC2Uniforme}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setEntregaC2Uniforme(val);
                          const allChecked = (!c1Talla || entregaC1Uniforme) && val && (!registration.teDomasBalco || entregaDomas) && (!(registration.teMocadorsExtra > 0) || entregaMocadors);
                          setEntregaMaterial(allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT);
                        }}
                        className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                        id="chk-entrega-c2"
                      />
                      <span className="leading-tight">
                        {language === 'ca' ? "👚 Vestidor Coparticipant 2 - Talla: " : "👚 Vestuario Coparticipante 2 - Talla: "}
                        <strong className="font-mono text-[#ff0090]">{c2Talla}</strong> 
                        <span className="text-[10px] text-zinc-500 ml-1">({c2UniformeTipus})</span>
                      </span>
                    </label>
                  )}

                  {/* 3. Domàs de balcó */}
                  {registration.teDomasBalco && (
                    <label className="flex items-center gap-2.5 text-zinc-300 hover:text-white cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={entregaDomas}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setEntregaDomas(val);
                          const allChecked = (!c1Talla || entregaC1Uniforme) && (!c2Talla || entregaC2Uniforme) && val && (!(registration.teMocadorsExtra > 0) || entregaMocadors);
                          setEntregaMaterial(allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT);
                        }}
                        className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                        id="chk-entrega-domas"
                      />
                      <span className="leading-tight">
                        {language === 'ca' ? "🏡 Domàs de Balcó Oficial" : "🏡 Domás de Balcón Oficial"} 
                        <span className="text-[10px] text-zinc-500 ml-1">(1 unitat)</span>
                      </span>
                    </label>
                  )}

                  {/* 4. Mocadors Extra */}
                  {registration.teMocadorsExtra > 0 && (
                    <label className="flex items-center gap-2.5 text-zinc-300 hover:text-white cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={entregaMocadors}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setEntregaMocadors(val);
                          const allChecked = (!c1Talla || entregaC1Uniforme) && (!c2Talla || entregaC2Uniforme) && (!registration.teDomasBalco || entregaDomas) && val;
                          setEntregaMaterial(allChecked ? EstatInscripcio.ENTREGAT : EstatInscripcio.PENDENT);
                        }}
                        className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                        id="chk-entrega-mocadors"
                      />
                      <span className="leading-tight">
                        {language === 'ca' ? "🧣 Mocadors Extra de Colla" : "🧣 Pañuelos Extra de Colla"} 
                        <strong className="text-[#ff0090] font-mono ml-1">({registration.teMocadorsExtra} u.)</strong>
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Segment 4: Waitlist Status */}
            <div className="space-y-2 border-t border-zinc-900 pt-4">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "Estat en Llista d'Espera" : "Estado en Lista de Espera"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLlistaEspera(false)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !llistaEspera 
                      ? 'bg-zinc-850 text-white border border-zinc-700' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                >
                  {language === 'ca' ? "Admitit / Normal" : "Admitido / Normal"}
                </button>
                <button
                  type="button"
                  onClick={() => setLlistaEspera(true)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    llistaEspera 
                      ? 'bg-amber-500 text-white shadow shadow-amber-500/10' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                >
                  {language === 'ca' ? "🟡 Llista d'Espera" : "🟡 Lista de Espera"}
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
                <Save size={16} /> {language === 'ca' ? "Guardar i Confirmar Ficha" : "Guardar y Confirmar Ficha"}
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
              alt={language === 'ca' ? "Ampliació DNI" : "Ampliación DNI"} 
              className="max-w-full max-h-[85vh] object-contain block m-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-zinc-500 text-xs font-mono mt-3 uppercase tracking-wider">
            {language === 'ca' 
              ? "Prem a qualsevol lloc per tancar el visor de seguretat" 
              : "Pulsa en cualquier lugar para cerrar el visor de seguridad"}
          </p>
        </div>
      )}
    </div>
  );
}
