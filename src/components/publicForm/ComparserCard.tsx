import React from 'react';
import { Camera, Upload, Trash2, AlertTriangle, Check, Database } from 'lucide-react';
import { SistemaConfig } from '../../types';
import { useLanguage } from '../../LanguageContext';
import TranslatedText from '../TranslatedText';

interface ComparserCardProps {
  num: 1 | 2;
  nom: string;
  setNom: (val: string) => void;
  cognoms: string;
  setCognoms: (val: string) => void;
  telefon: string;
  setTelefon: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  dniUrl: string | null;
  setDniUrl: (val: string | null) => void;
  esMenor: boolean;
  setEsMenor: (val: boolean) => void;
  tutorNom: string;
  setTutorNom: (val: string) => void;
  tutorCognoms: string;
  setTutorCognoms: (val: string) => void;
  tutorDni: string;
  setTutorDni: (val: string) => void;
  tutorTelefon: string;
  setTutorTelefon: (val: string) => void;
  tutorAccepta: boolean;
  setTutorAccepta: (val: boolean) => void;
  
  // Clothing and extras states
  seleccionsUniforme: any;
  setSeleccionsUniforme: (val: any) => void;
  setTallaBackwards?: (val: string) => void;
  setUniformeTipusBackwards?: (val: 'compra' | 'lloguer') => void;
  extrasSeleccionats: Record<string, number>;
  setExtrasSeleccionats: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Duplicate checks
  isNameDuplicate: boolean;
  isEmailDuplicate: boolean;
  isPhoneDuplicate: boolean;

  // Errors and Config
  errors: Record<string, string>;
  config: SistemaConfig;

  // File Upload and Camera callbacks
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, owner: 'c1' | 'c2') => void;
  startCamera: (owner: 'c1' | 'c2') => void;
}

export const ComparserCard: React.FC<ComparserCardProps> = ({
  num,
  nom,
  setNom,
  cognoms,
  setCognoms,
  telefon,
  setTelefon,
  email,
  setEmail,
  dniUrl,
  setDniUrl,
  esMenor,
  setEsMenor,
  tutorNom,
  setTutorNom,
  tutorCognoms,
  setTutorCognoms,
  tutorDni,
  setTutorDni,
  tutorTelefon,
  setTutorTelefon,
  tutorAccepta,
  setTutorAccepta,
  seleccionsUniforme,
  setSeleccionsUniforme,
  setTallaBackwards,
  setUniformeTipusBackwards,
  extrasSeleccionats,
  setExtrasSeleccionats,
  isNameDuplicate,
  isEmailDuplicate,
  isPhoneDuplicate,
  errors,
  config,
  handleFileUpload,
  startCamera,
}) => {
  const { language } = useLanguage();
  const prefix = `c${num}`;

  // Keys for uniform line selection based on participant number
  const keyTalla = num === 1 ? 'c1Talla' : 'c2Talla';
  const keyQuantitat = num === 1 ? 'c1Quantitat' : 'c2Quantitat';
  const keyTipus = num === 1 ? 'c1Tipus' : 'c2Tipus';

  const hasDuplicateError = errors[`${prefix}Duplicat`] || isNameDuplicate || isEmailDuplicate || isPhoneDuplicate;

  return (
    <div className={`rounded-3xl p-6 border transition-all relative overflow-hidden ${hasDuplicateError ? 'bg-amber-50/10 border-amber-300 ring-2 ring-amber-300 shadow-amber-100/30' : 'bg-white border-zinc-200/80 shadow-md'}`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-zinc-100 to-transparent pointer-events-none rounded-bl-3xl flex items-center justify-center">
        <span className="font-mono text-zinc-400 text-sm font-bold">#{num}</span>
      </div>
      
      <div className="flex justify-between items-center mb-5 pb-2 border-b border-zinc-100">
        <h3 className="font-sans font-bold text-zinc-900 text-lg flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full" />
          {language === 'ca' ? `Comparser/a ${num}` : `Comparsero/a ${num}`}
        </h3>
        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full font-mono uppercase tracking-tight flex items-center gap-1 shadow-sm shrink-0" title={language === 'ca' ? "Sincronitzat amb la base de dades" : "Sincronizado con la base de datos"}>
          <Database size={9} /> {language === 'ca' ? 'Enllaç BBDD' : 'Enlace BBDD'}
        </span>
      </div>

      {hasDuplicateError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl mb-4 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={16} />
          <div>
            <p className="font-bold">{language === 'ca' ? "Avís de dades coincidents" : "Aviso de datos coincidentes"}</p>
            <p className="text-[11px] text-amber-700 leading-normal mt-0.5">
              {language === 'ca'
                ? "S'ha detectat que part d'aquestes dades ja estan registrades a la base de dades d'inscripcions!"
                : "¡Se ha detectado que parte de estos datos ya están registrados en la base de datos de inscripciones!"}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-zinc-700 tracking-tight">
              {language === 'ca' ? 'Nom *' : 'Nombre *'}
            </label>
            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
              <Database size={8} /> BBDD
            </span>
          </div>
          <input 
            type="text" 
            value={nom} 
            onChange={(e) => setNom(e.target.value)}
            className={`w-full bg-zinc-50 border ${errors[`${prefix}Nom`] || isNameDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
            placeholder={language === 'ca' ? (num === 1 ? "Ex. Joan" : "Ex. Marta") : (num === 1 ? "Ej. Juan" : "Ej. Marta")}
            id={`input-${prefix}-nom`}
          />
          {isNameDuplicate && (
            <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
              <AlertTriangle size={10} /> {language === 'ca' ? "Ja existeix un participant amb aquest nom a la BBDD" : "Ya existe un participante con este nombre en la BBDD"}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-zinc-700 tracking-tight">
              {language === 'ca' ? 'Cognoms *' : 'Apellidos *'}
            </label>
            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
              <Database size={8} /> BBDD
            </span>
          </div>
          <input 
            type="text" 
            value={cognoms} 
            onChange={(e) => setCognoms(e.target.value)}
            className={`w-full bg-zinc-50 border ${errors[`${prefix}Cognoms`] || isNameDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
            placeholder={language === 'ca' ? "Ex. Garcia Pujol" : "Ej. García Pujol"}
            id={`input-${prefix}-cognoms`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-zinc-700 tracking-tight">
              {language === 'ca' ? 'Telèfon de contacte *' : 'Teléfono de contacto *'}
            </label>
            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
              <Database size={8} /> BBDD
            </span>
          </div>
          <input 
            type="tel" 
            value={telefon} 
            onChange={(e) => setTelefon(e.target.value)}
            className={`w-full bg-zinc-50 border ${errors[`${prefix}Telefon`] || isPhoneDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
            placeholder={language === 'ca' ? "Ex. 600123456" : "Ej. 600123456"}
            id={`input-${prefix}-telefon`}
          />
          {isPhoneDuplicate && (
            <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
              <AlertTriangle size={10} /> {language === 'ca' ? "Aquest telèfon ja consta registrat a la BBDD" : "Este teléfono ya consta registrado en la BBDD"}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-zinc-700 tracking-tight">
              {language === 'ca' ? 'Correu electrònic *' : 'Correo electrónico *'}
            </label>
            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
              <Database size={8} /> BBDD
            </span>
          </div>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full bg-zinc-50 border ${errors[`${prefix}Email`] || isEmailDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
            placeholder={language === 'ca' ? "Ex. joan@gmail.com" : "Ej. juan@gmail.com"}
            id={`input-${prefix}-email`}
          />
          {isEmailDuplicate && (
            <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
              <AlertTriangle size={10} /> {language === 'ca' ? "Aquest correu ja consta registrat a la BBDD" : "Este correo ya consta registrado en la BBDD"}
            </p>
          )}
        </div>

        {/* Minor status and Tutor details */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold text-zinc-700 tracking-tight">
              {language === 'ca' ? "El primer comparser és menor d'edat? *" : "¿El primer comparsero es menor de edad? *"}
            </label>
            <div className="flex rounded-lg overflow-hidden border border-zinc-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setEsMenor(false)}
                className={`text-xs px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${!esMenor ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setEsMenor(true)}
                className={`text-xs px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${esMenor ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                Sí
              </button>
            </div>
          </div>

          {esMenor && (
            <div className="pt-2 border-t border-zinc-200/60 space-y-3 animate-fadeIn">
              <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2 font-semibold">
                {language === 'ca' 
                  ? "En ser menor d'edat, cal incloure obligatòriament les dades de contacte del tutor legal."
                  : "Al ser menor de edad, es obligatorio incluir los datos de contacto de su tutor legal."}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                    {language === 'ca' ? "Nom del Tutor *" : "Nombre del Tutor *"}
                  </label>
                  <input 
                    type="text"
                    value={tutorNom}
                    onChange={(e) => setTutorNom(e.target.value)}
                    className={`w-full bg-white border ${errors[`${prefix}TutorNom`] ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                    placeholder={language === 'ca' ? "Ex. Pere" : "Ej. Pedro"}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                    {language === 'ca' ? "Cognoms del Tutor *" : "Apellidos del Tutor *"}
                  </label>
                  <input 
                    type="text"
                    value={tutorCognoms}
                    onChange={(e) => setTutorCognoms(e.target.value)}
                    className={`w-full bg-white border ${errors[`${prefix}TutorCognoms`] ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                    placeholder={language === 'ca' ? "Ex. Garcia Pou" : "Ej. García Pou"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                    {language === 'ca' ? "DNI / NIE del Tutor *" : "DNI / NIE del Tutor *"}
                  </label>
                  <input 
                    type="text"
                    value={tutorDni}
                    onChange={(e) => setTutorDni(e.target.value)}
                    className={`w-full bg-white border ${errors[`${prefix}TutorDni`] ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                    placeholder={language === 'ca' ? "Ex. 12345678Z" : "Ej. 12345678Z"}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                    {language === 'ca' ? "Telèfon del Tutor *" : "Teléfono del Tutor *"}
                  </label>
                  <input 
                    type="tel"
                    value={tutorTelefon}
                    onChange={(e) => setTutorTelefon(e.target.value)}
                    className={`w-full bg-white border ${errors[`${prefix}TutorTelefon`] ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                    placeholder={language === 'ca' ? "Ex. 600123456" : "Ej. 600123456"}
                  />
                </div>
              </div>

              {/* Legal Authorization Text for Minors */}
              <div className="pt-3 border-t border-zinc-200/80 space-y-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono">
                  {language === 'ca' ? "Autorització de deures i responsabilitats de menors *" : "Autorización de deberes y responsabilidades de menores *"}
                </label>
                <div className="bg-white border border-zinc-200 rounded-xl p-3 max-h-32 overflow-y-auto text-[11px] text-zinc-600 leading-relaxed font-sans whitespace-pre-line shadow-inner">
                  {language === 'ca' 
                    ? (config.textLegalAutoritzacioMenors || "AUTORITZACIÓ DE MENORS D'EDAT\n\nEn condició de tutor/a legal del menor inscrit, declaro sota la meva responsabilitat que autoritzo expressament la seva participació a l'esdeveniment i activitats organitzades per l'Associació Cultural El Tast.")
                    : (config.textLegalAutoritzacioMenorsES || "AUTORIZACIÓN DE MENORES DE EDAD\n\nEn condición de tutor/a legal del menor inscrito, declaro bajo mi responsabilidad que autorizo expresamente su participación en el evento y actividades organizadas por la Associació Cultural El Tast.")
                  }
                </div>

                <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${tutorAccepta ? 'bg-fuchsia-50/40 border-fuchsia-200 text-fuchsia-950' : errors[`${prefix}TutorAccepta`] ? 'bg-red-50/40 border-red-200 text-red-950 animate-shake' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                  <input
                    type="checkbox"
                    checked={tutorAccepta}
                    onChange={(e) => setTutorAccepta(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 filter-none focus:ring-fuchsia-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold leading-tight select-none">
                    {language === 'ca'
                      ? "Com a tutor legal, autoritzo i accepto de forma expressa les condicions i responsabilitats indicades."
                      : "Como tutor legal, autorizo y acepto de forma expresa las condiciones y responsabilidades indicadas."
                    }
                  </span>
                </label>
                {errors[`${prefix}TutorAccepta`] && (
                  <p className="text-[10px] text-red-500 font-bold">{errors[`${prefix}TutorAccepta`]}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic clothing lines and custom equipment options */}
        {(config.liniisUniforme || [
          {
            id: 'lin-1',
            nom: config.nomUniforme || 'Talla de Samarreta',
            nomES: config.nomUniformeES || 'Talla de Camiseta',
            opcions: config.opcionsUniforme || ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
            requeixQuantitat: false
          }
        ]).map((linia) => {
          const sel = seleccionsUniforme[linia.id] || { [keyTalla]: linia.opcions[0] || 'M', [keyQuantitat]: 1, [keyTipus]: 'compra' };
          const tallaVal = sel[keyTalla] || linia.opcions[0] || 'M';
          const quantitatVal = sel[keyQuantitat] || 1;
          const tipusVal = sel[keyTipus] || 'compra';

          return (
            <div key={linia.id} className="space-y-2 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <div className="flex justify-between items-center mb-1 bg-white px-3 py-1.5 rounded-lg border border-zinc-100 shadow-sm">
                <label className="block text-xs font-bold text-zinc-800 tracking-tight">
                  {language === 'ca' ? linia.nom : linia.nomES} *
                </label>
                {(linia.preu || linia.preuLloguer) ? (
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {linia.preu ? (
                      <span className="text-[10px] font-mono text-fuchsia-600 bg-fuchsia-50 rounded px-2 py-0.5 border border-fuchsia-100 font-bold tracking-tight uppercase">
                        PREU (COMPRA): {linia.preu}€
                      </span>
                    ) : null}
                    {linia.preuLloguer ? (
                      <span className="text-[10px] font-mono text-sky-600 bg-sky-50 rounded px-2 py-0.5 border border-sky-100 font-bold tracking-tight uppercase">
                        PREU (LLOGUER): {linia.preuLloguer}€
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2.5">
                <select 
                  value={tallaVal}
                  onChange={(e) => {
                    const newSel = { ...sel, [keyTalla]: e.target.value };
                    setSeleccionsUniforme({
                      ...seleccionsUniforme,
                      [linia.id]: newSel
                    });
                    
                    const firstId = (config.liniisUniforme && config.liniisUniforme[0]?.id) || 'lin-1';
                    if (linia.id === firstId && setTallaBackwards) {
                      setTallaBackwards(e.target.value);
                    }
                  }}
                  className="flex-1 bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {linia.opcions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                {linia.requeixQuantitat && (
                  <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-1 text-xs shrink-0">
                    <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase">Cant.</span>
                    <select
                      value={quantitatVal}
                      onChange={(e) => {
                        const newSel = { ...sel, [keyQuantitat]: Math.max(1, Number(e.target.value)) };
                        setSeleccionsUniforme({
                          ...seleccionsUniforme,
                          [linia.id]: newSel
                        });
                      }}
                      className="bg-transparent border-none text-xs font-bold text-zinc-800 focus:ring-0 focus:outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Venda / Lloguer selectors */}
              <div className="mt-2 text-left pt-2 border-t border-zinc-200/50 flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-tight">
                  {language === 'ca' ? "Tipus d'Adquisició:" : "Tipo de Adquisición:"}
                </span>
                <div className="flex bg-white rounded-lg overflow-hidden border border-zinc-200 p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const newSel = { ...sel, [keyTipus]: 'compra' as const };
                      setSeleccionsUniforme({
                        ...seleccionsUniforme,
                        [linia.id]: newSel
                      });
                      const firstId = (config.liniisUniforme && config.liniisUniforme[0]?.id) || 'lin-1';
                      if (linia.id === firstId && setUniformeTipusBackwards) {
                        setUniformeTipusBackwards('compra');
                      }
                    }}
                    className={`text-[10px] px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${(!tipusVal || tipusVal === 'compra') ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-zinc-550 hover:text-zinc-855'}`}
                  >
                    Compra
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newSel = { ...sel, [keyTipus]: 'lloguer' as const };
                      setSeleccionsUniforme({
                        ...seleccionsUniforme,
                        [linia.id]: newSel
                      });
                      const firstId = (config.liniisUniforme && config.liniisUniforme[0]?.id) || 'lin-1';
                      if (linia.id === firstId && setUniformeTipusBackwards) {
                        setUniformeTipusBackwards('lloguer');
                      }
                    }}
                    className={`text-[10px] px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${tipusVal === 'lloguer' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-550 hover:text-zinc-855'}`}
                  >
                    {language === 'ca' ? "Lloguer" : "Alquiler"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Extras per Comparser */}
        {(() => {
          const extrasForThisComparser = (config.tarifesDinamiques || []).filter(t => t.actiu && t.tipus === 'extra_generic');
          if (extrasForThisComparser.length === 0) return null;
          return (
            <div className="pt-4 border-t border-zinc-200/60 pb-2">
              <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-3">
                {language === 'ca' ? 'Extras / Complements' : 'Extras / Complementos'}
              </label>
              <div className="space-y-3">
                {extrasForThisComparser.map(extr => {
                  const isChecked = (extrasSeleccionats[extr.id] || 0) > 0;
                  return (
                    <div key={extr.id} 
                         onClick={() => setExtrasSeleccionats(prev => ({ ...prev, [extr.id]: isChecked ? 0 : 1 }))}
                         className={`flex justify-between items-center bg-zinc-50 border rounded-xl p-3 cursor-pointer transition-colors ${isChecked ? 'border-[#ff0090] bg-fuchsia-50/50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <div>
                        <span className="block text-xs font-bold text-zinc-800">{extr.nom}</span>
                        <span className="block text-[10px] text-fuchsia-600 font-mono font-bold uppercase">PREU (COMPRA): {extr.valor}€</span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-[#ff0090] border-[#ff0090]' : 'bg-white border-zinc-300'}`}>
                          {isChecked && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* DNI upload zona */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1.5">
            {language === 'ca' ? 'Foto de la part frontal del DNI *' : 'Foto de la parte frontal del DNI *'}
          </label>
          {dniUrl ? (
            <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 flex items-center justify-between gap-3 relative overflow-hidden group">
              <img 
                src={dniUrl} 
                alt={`DNI Comparser ${num}`} 
                className="w-20 h-14 object-cover rounded-md border border-zinc-200"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-800 truncate">DNI_Comparser_{num}.webp</p>
                <p className="text-[10px] text-zinc-400 font-mono">
                  {language === 'ca' ? 'Arxiu penjat correctament' : 'Archivo subido correctamente'}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setDniUrl(null)}
                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                title={language === 'ca' ? "Eliminar arxiu" : "Eliminar archivo"}
                id={`btn-remove-${prefix}-dni`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div className={`border-2 border-dashed ${errors[`${prefix}Dni`] ? 'border-red-300 bg-red-50/20' : 'border-zinc-200 hover:border-fuchsia-300'} rounded-2xl p-5 text-center transition-all`}>
              <Upload className="mx-auto text-zinc-400 mb-2" size={24} />
              <p className="text-xs text-zinc-600 font-semibold mb-1">
                {language === 'ca' ? 'Arrossega una foto o selecciona un arxiu' : 'Arrastra una foto o selecciona un archivo'}
              </p>
              <p className="text-[11px] text-zinc-400 mb-3 font-mono">Format PNG, JPG o WEBP (màx 10MB)</p>
              
              <div className="flex flex-wrap gap-2 justify-center">
                <label className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors border border-zinc-200">
                  {language === 'ca' ? 'Pujar fitxer' : 'Subir archivo'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileUpload(e, prefix as 'c1' | 'c2')} 
                    className="hidden" 
                  />
                </label>
                <button
                  type="button"
                  onClick={() => startCamera(prefix as 'c1' | 'c2')}
                  className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  id={`btn-camera-${prefix}`}
                >
                  <Camera size={14} /> {language === 'ca' ? 'Fes foto' : 'Hacer foto'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
