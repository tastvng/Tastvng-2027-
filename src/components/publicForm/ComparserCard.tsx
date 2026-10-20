import React, { useState } from 'react';
import { Camera, Upload, Trash2, AlertTriangle, Check, Database, Info, Shield, ShieldCheck, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { SistemaConfig, CategoriaParella } from '../../types';
import { useLanguage } from '../../LanguageContext';
import TranslatedText from '../TranslatedText';

interface ComparserCardProps {
  num: 1 | 2;
  nom: string;
  setNom: (val: string) => void;
  cognoms: string;
  setCognoms: (val: string) => void;
  dniUrl: string | null;
  setDniUrl: (val: string | null) => void;
  esMenor: boolean;
  setEsMenor: (val: boolean) => void;
  categoria?: CategoriaParella | string;
  confirma18?: boolean;
  onConfirma18Change?: (val: boolean) => void;
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
  isEmailDuplicate?: boolean;
  isPhoneDuplicate?: boolean;

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
  dniUrl,
  setDniUrl,
  esMenor,
  setEsMenor,
  categoria,
  confirma18,
  onConfirma18Change,
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
  const { language, t } = useLanguage();
  const prefix = `c${num}`;
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const isJuvenil = categoria === CategoriaParella.JUVENIL || String(categoria || '').toUpperCase().includes('JUVENIL');

  // Keys for uniform line selection based on participant number
  const keyTalla = num === 1 ? 'c1Talla' : 'c2Talla';
  const keyQuantitat = num === 1 ? 'c1Quantitat' : 'c2Quantitat';
  const keyTipus = num === 1 ? 'c1Tipus' : 'c2Tipus';

  const hasDuplicateError = errors[`${prefix}Duplicat`] || isNameDuplicate;

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
      </div>

      {hasDuplicateError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl mb-4 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={16} />
          <div>
            <p className="font-bold">{language === 'ca' ? "Avís de dades coincidents" : "Aviso de datos coincidentes"}</p>
            <p className="text-[11px] text-amber-700 leading-normal mt-0.5">
              {language === 'ca'
                ? "S'ha detectat que part d'aquestes dades ja estan registrades en una inscripció prèvia."
                : "¡Se ha detectado que parte de estos datos ya están registrados en una inscripción previa!"}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={`input-${prefix}-nom`} className="block text-xs font-bold text-zinc-700 tracking-tight cursor-pointer">
              {language === 'ca' ? 'Nom *' : 'Nombre *'}
            </label>
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
              <AlertTriangle size={10} /> {language === 'ca' ? "Aquest participant ja consta en una altra inscripció" : "Este participante ya consta en otra inscripción"}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={`input-${prefix}-cognoms`} className="block text-xs font-bold text-zinc-700 tracking-tight cursor-pointer">
              {language === 'ca' ? 'Cognoms *' : 'Apellidos *'}
            </label>
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

        {/* Minor status and Tutor details */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center gap-3">
            <span id={`label-${prefix}-esmenor`} className="block text-xs font-bold text-zinc-700 tracking-tight flex-1 min-w-0">
              {language === 'ca' 
                ? (num === 1 ? "El primer comparser és menor d'edat? *" : "El segon comparser o comparsera és menor d'edat? *")
                : (num === 1 ? "¿El primer comparsero es menor de edad? *" : "¿El segundo participante (comparsero/a) es menor de edad? *")}
            </span>
            <div className="flex rounded-lg overflow-hidden border border-zinc-200 bg-white p-0.5 shrink-0" role="group" aria-labelledby={`label-${prefix}-esmenor`}>
              <button
                type="button"
                onClick={() => setEsMenor(false)}
                aria-pressed={!esMenor}
                className={`text-xs px-4 py-2 font-bold rounded-md transition-all cursor-pointer ${!esMenor ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setEsMenor(true)}
                aria-pressed={esMenor}
                className={`text-xs px-4 py-2 font-bold rounded-md transition-all cursor-pointer ${esMenor ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                Sí
              </button>
            </div>
          </div>

          {isJuvenil && !esMenor && (
            <div className="pt-2 border-t border-zinc-200/60 space-y-2.5 animate-fadeIn">
              <div className="text-[11px] bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 font-medium leading-relaxed">
                <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={16} />
                <div>
                  <p className="font-bold text-xs text-amber-950">
                    {language === 'ca' ? "Avís: Categoria Juvenil" : "Aviso: Categoría Juvenil"}
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {language === 'ca'
                      ? "En la categoria Juvenil tots els participants han de ser menors d'edat, excepte si tenen 18 anys."
                      : "En la categoría Juvenil todos los participantes deben ser menores de edad, excepto si tienen 18 años."}
                  </p>
                </div>
              </div>

              {onConfirma18Change && (
                <div>
                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    confirma18 
                      ? 'bg-fuchsia-50 border-fuchsia-500 text-fuchsia-700 font-bold' 
                      : errors[`${prefix}Confirma18`] 
                        ? 'bg-red-50/50 border-red-300 text-red-950 animate-shake' 
                        : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                  }`}>
                    <input
                      type="checkbox"
                      id={`checkbox-${prefix}-confirma18`}
                      checked={!!confirma18}
                      onChange={(e) => onConfirma18Change(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold leading-tight select-none">
                      {language === 'ca'
                        ? "Parella juvenil: confirmo que aquest participant té 18 anys."
                        : "Pareja juvenil: confirmo que este participante tiene 18 años."}
                    </span>
                  </label>
                  {errors[`${prefix}Confirma18`] && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">
                      {errors[`${prefix}Confirma18`]}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {esMenor && (
            <div className="pt-2 border-t border-zinc-200/60 space-y-3 animate-fadeIn">
              <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2 font-semibold">
                {language === 'ca' 
                  ? "En ser menor d'edat, cal incloure obligatòriament les dades de contacte del tutor legal i l'autorització expressa."
                  : "Al ser menor de edad, es obligatorio incluir los datos de contacto del tutor legal y la autorización expresa."}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`input-${prefix}-tutor-nom`} className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1 cursor-pointer">
                    {language === 'ca' ? "Nom del Tutor *" : "Nombre del Tutor *"}
                  </label>
                  <input 
                    id={`input-${prefix}-tutor-nom`}
                    type="text"
                    value={tutorNom}
                    onChange={(e) => setTutorNom(e.target.value)}
                    className={`w-full bg-white border ${errors[`${prefix}TutorNom`] ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                    placeholder={language === 'ca' ? "Ex. Pere" : "Ej. Pedro"}
                  />
                </div>
                <div>
                  <label htmlFor={`input-${prefix}-tutor-cognoms`} className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1 cursor-pointer">
                    {language === 'ca' ? "Cognoms del Tutor *" : "Apellidos del Tutor *"}
                  </label>
                  <input 
                    id={`input-${prefix}-tutor-cognoms`}
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
                  <label htmlFor={`input-${prefix}-tutor-dni`} className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1 cursor-pointer">
                    {language === 'ca' ? "DNI / NIE del Tutor *" : "DNI / NIE del Tutor *"}
                  </label>
                  <input 
                    id={`input-${prefix}-tutor-dni`}
                    type="text"
                    value={tutorDni}
                    onChange={(e) => setTutorDni(e.target.value)}
                    className={`w-full bg-white border ${errors[`${prefix}TutorDni`] ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                    placeholder={language === 'ca' ? "Ex. 12345678Z" : "Ej. 12345678Z"}
                  />
                </div>
                <div>
                  <label htmlFor={`input-${prefix}-tutor-tel`} className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1 cursor-pointer">
                    {language === 'ca' ? "Telèfon del Tutor *" : "Teléfono del Tutor *"}
                  </label>
                  <input 
                    id={`input-${prefix}-tutor-tel`}
                    type="tel"
                    value={tutorTelefon}
                    onChange={(e) => setTutorTelefon(e.target.value)}
                    className={`w-full bg-white border ${errors[`${prefix}TutorTelefon`] ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                    placeholder={language === 'ca' ? "Ex. 600123456" : "Ej. 600123456"}
                  />
                </div>
              </div>

              {/* Legal Authorization Text for Minors (Balanced, compliant with legal review guidelines) */}
              <div className="pt-3 border-t border-zinc-200/80 space-y-2">
                <span className="block text-[10px] font-bold text-zinc-500 uppercase font-mono">
                  {language === 'ca' ? "Autorització de participació de menors d'edat *" : "Autorización de participación de menores de edad *"}
                </span>
                <div className="bg-white border border-zinc-200 rounded-xl p-3 max-h-32 overflow-y-auto text-[11px] text-zinc-600 leading-relaxed font-sans whitespace-pre-line shadow-inner">
                  {language === 'ca' 
                    ? (config.textLegalAutoritzacioMenors || "AUTORITZACIÓ DE PARTICIPACIÓ DE MENORS D'EDAT\n\nCom a pare/mare o tutor/a legal del menor d'edat inscrit, autoritzo expressament la seva participació a l'activitat de Comparses organitzada per l'Associació Cultural El Tast per a l'edició 2027.\n\nDeclaro que he estat informat/da de les característiques i normativa de la comparsa, que les dades de contacte facilitades són veraces per a qualsevol comunicació necessària durant l'activitat, i que aportaré el document acreditatiu si és requerit per l'organització.")
                    : (config.textLegalAutoritzacioMenorsES || "AUTORIZACIÓN DE PARTICIPACIÓN DE MENORES DE EDAD\n\nComo padre/madre o tutor/a legal del menor de edad inscrito, autorizo expresamente su participación en la actividad de Comparsas organizada por la Associació Cultural El Tast para la edición 2027.\n\nDeclaro haber sido informado/a de las características y normativa de la comparsa, que los datos de contacto facilitados son veraces para cualquier comunicación necesaria durante la actividad, y que aportaré el documento acreditativo si es requerido por la organización.")
                  }
                </div>

                <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${tutorAccepta ? 'bg-fuchsia-50 border-fuchsia-500 text-fuchsia-600 font-bold' : errors[`${prefix}TutorAccepta`] ? 'bg-red-50/40 border-red-200 text-red-950 animate-shake' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                  <input
                    type="checkbox"
                    checked={tutorAccepta}
                    onChange={(e) => setTutorAccepta(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 filter-none focus:ring-fuchsia-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold leading-tight select-none">
                    {language === 'ca'
                      ? "Com a tutor legal, autoritzo expressament la participació del menor i confirmo les dades facilitades."
                      : "Como tutor legal, autorizo expresamente la participación del menor y confirmo los datos facilitados."
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
            requeixQuantitat: false,
            actiu: true
          }
        ]).filter(l => l.actiu !== false).map((linia) => {
          const isOptional = !!(linia.opcional || linia.armilla_opcional || config.armilla_opcional);
          const keyVol = num === 1 ? 'c1Vol' : 'c2Vol';
          const defaultVol = !isOptional;
          const rawSel = seleccionsUniforme[linia.id];
          const volProducte = rawSel && rawSel[keyVol] !== undefined ? !!rawSel[keyVol] : defaultVol;
          const sel = rawSel || { [keyTalla]: '', [keyQuantitat]: 1, [keyTipus]: 'compra', [keyVol]: defaultVol };
          const tallaVal = sel[keyTalla] || '';
          const quantitatVal = sel[keyQuantitat] || 1;
          const tipusVal = sel[keyTipus] || 'compra';

          const displayNom = language === 'ca' 
            ? linia.nom.replace(/armilla/gi, t('armilla')) 
            : (linia.nomES || linia.nom).replace(/chaleco/gi, t('armilla'));

          return (
            <div key={linia.id} className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <div className="flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-zinc-100 shadow-sm">
                <label className="block text-xs font-bold text-zinc-800 tracking-tight">
                  {displayNom} {isOptional ? '' : '*'}
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
                        {linia.fianca && linia.fianca > 0
                          ? (language === 'ca'
                              ? `PREU (LLOGUER): ${linia.preuLloguer}€ + ${linia.fianca}€ fiança`
                              : `PRECIO (ALQUILER): ${linia.preuLloguer}€ + ${linia.fianca}€ fianza`)
                          : (language === 'ca'
                              ? `PREU (LLOGUER): ${linia.preuLloguer}€`
                              : `PRECIO (ALQUILER): ${linia.preuLloguer}€`)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Optional selection checkbox for armilla/product */}
              {isOptional && (
                <div className="flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-zinc-200 shadow-2xs">
                  <input
                    type="checkbox"
                    id={`check-vol-${linia.id}-${num}`}
                    checked={volProducte}
                    onChange={(e) => {
                      const newSel = { ...sel, [keyVol]: e.target.checked };
                      setSeleccionsUniforme({
                        ...seleccionsUniforme,
                        [linia.id]: newSel
                      });
                    }}
                    className="rounded text-fuchsia-600 focus:ring-fuchsia-500 h-4 w-4 border-zinc-300 cursor-pointer"
                  />
                  <label htmlFor={`check-vol-${linia.id}-${num}`} className="text-xs font-bold text-zinc-850 cursor-pointer select-none">
                    {language === 'ca' ? `Vols ${t('armilla').toLowerCase()}?` : `¿Deseas ${t('armilla').toLowerCase()}?`}
                  </label>
                </div>
              )}

              {/* Size and Acquisition controls - hidden/disabled when optional is unchecked */}
              {(!isOptional || volProducte) ? (
                <>
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
                      <option value="">{language === 'ca' ? 'Triar talla...' : 'Elegir talla...'}</option>
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
                  <div className="text-left pt-2 border-t border-zinc-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-tight shrink-0">
                      {language === 'ca' ? "Tipus d'Adquisició:" : "Tipo de Adquisición:"}
                    </span>
                    <div className="flex bg-white rounded-lg overflow-hidden border border-zinc-200 p-0.5 shrink-0 max-w-full">
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
                        className={`text-[10px] px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer text-center leading-tight ${tipusVal === 'lloguer' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-550 hover:text-zinc-855'}`}
                      >
                        {linia.fianca && linia.fianca > 0
                          ? (language === 'ca'
                              ? `Lloguer (${linia.preuLloguer || 0}€ + ${linia.fianca}€ fiança)`
                              : `Alquiler (${linia.preuLloguer || 0}€ + ${linia.fianca}€ fianza)`)
                          : (linia.preuLloguer
                              ? `${language === 'ca' ? "Lloguer" : "Alquiler"} (${linia.preuLloguer}€)`
                              : (language === 'ca' ? "Lloguer" : "Alquiler"))}
                      </button>
                    </div>
                  </div>

                  {tipusVal === 'lloguer' && typeof linia.fianca === 'number' && linia.fianca > 0 && (
                    <div className="mt-2.5 p-3 bg-amber-50/90 border border-amber-300/80 rounded-xl text-amber-950 text-xs flex items-start gap-2 shadow-2xs">
                      <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">
                        {language === 'ca'
                          ? `Lloguer ${linia.preuLloguer || 0}€ + fiança ${linia.fianca}€ = ${(linia.preuLloguer || 0) + linia.fianca}€ a pagar en la inscripció. La fiança (${linia.fianca}€) et serà retornada en entregar l'armilla.`
                          : `Alquiler ${linia.preuLloguer || 0}€ + fianza ${linia.fianca}€ = ${(linia.preuLloguer || 0) + linia.fianca}€ a pagar en la inscripción. La fianza (${linia.fianca}€) se te devolverá al entregar el chaleco.`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-zinc-400 italic px-1">
                  {language === 'ca' ? `Has escollit no sol·licitar ${t('armilla').toLowerCase()} per a aquest participant.` : `Has elegido no solicitar ${t('armilla').toLowerCase()} para este participante.`}
                </p>
              )}
            </div>
          );
        })}

        {/* Privacy & RGPD Information prior to requesting DNI */}
        <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="text-sky-600 shrink-0 mt-0.5" size={17} />
              <div>
                <h4 className="text-xs font-bold text-sky-950">
                  {language === 'ca' ? "Privacitat i tractament del DNI/NIE" : "Privacidad y tratamiento del DNI/NIE"}
                </h4>
                <p className="text-[11px] text-sky-800 leading-snug mt-0.5">
                  {language === 'ca'
                    ? "Les dades i imatges del document s'utilitzen únicament per comprovar l'edat i categoria. Podeu tapar el número de suport o dades personals no necessàries, deixant visibles només el nom, cognoms i data de naixement."
                    : "Los datos e imágenes del documento se utilizan únicamente para comprobar la edad y categoría. Puede tapar el número de soporte o datos personales no necesarios, dejando visibles solo el nombre, apellidos y fecha de nacimiento."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPrivacyPolicy(!showPrivacyPolicy)}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-100 hover:bg-sky-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              aria-expanded={showPrivacyPolicy}
              aria-controls={`privacy-policy-box-${prefix}`}
            >
              <span>{language === 'ca' ? "Veure política" : "Ver política"}</span>
              {showPrivacyPolicy ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {showPrivacyPolicy && (
            <div 
              id={`privacy-policy-box-${prefix}`} 
              className="pt-3 border-t border-sky-200/60 text-[10px] text-zinc-700 space-y-2 font-sans bg-white/80 p-3 rounded-xl border border-sky-100 animate-fadeIn"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <p>
                  <strong className="text-zinc-900">{language === 'ca' ? "Responsable:" : "Responsable:"}</strong>{" "}
                  [Pendent de completar: Associació Cultural El Tast — CIF i seu oficial pendents de confirmació]
                </p>
                <p>
                  <strong className="text-zinc-900">{language === 'ca' ? "Finalitat:" : "Finalidad:"}</strong>{" "}
                  {language === 'ca' ? "Comprovació d'edat i tramitació de la inscripció a les Comparses 2027." : "Comprobación de edad y tramitación de la inscripción a las Comparsas 2027."}
                </p>
                <p>
                  <strong className="text-zinc-900">{language === 'ca' ? "Base legal:" : "Base legal:"}</strong>{" "}
                  {language === 'ca' ? "Execució del conveni de participació i consentiment exprés (art. 6.1.a i 6.1.b RGPD)." : "Ejecución del convenio de participación y consentimiento expreso (art. 6.1.a y 6.1.b RGPD)."}
                </p>
                <p>
                  <strong className="text-zinc-900">{language === 'ca' ? "Conservació:" : "Conservación:"}</strong>{" "}
                  {language === 'ca' ? "Durant la gestió de l'edició 2027. Les imatges s'esborren un cop validada l'edat." : "Durante la gestión de la edición 2027. Las imágenes se eliminan tras validar la edad."}
                </p>
                <p>
                  <strong className="text-zinc-900">{language === 'ca' ? "Drets i contacte:" : "Derechos y contacto:"}</strong>{" "}
                  {language === 'ca' ? "Accés, rectificació o supressió via correu a tastvng@gmail.com." : "Acceso, rectificación o supresión vía correo a tastvng@gmail.com."}
                </p>
                <p>
                  <strong className="text-zinc-900">{language === 'ca' ? "Proveïdors i seguretat:" : "Proveedores y seguridad:"}</strong>{" "}
                  {language === 'ca' ? "Allotjament en servidors segurs a la UE (Supabase/Google Cloud) amb xifratge TLS i accés restringit." : "Alojamiento en servidores seguros en la UE (Supabase/Google Cloud) con cifrado TLS y acceso restringido."}
                </p>
              </div>
              <p className="text-[9.5px] text-zinc-500 italic pt-1 border-t border-sky-100">
                {language === 'ca'
                  ? "Alternativa presencial: Si preferiu no pujar la fotografia del DNI, podeu acreditar la vostra identitat i edat directament a la secretaria en recollir els materials."
                  : "Alternativa presencial: Si prefiere no subir la fotografía del DNI, puede acreditar su identidad y edad directamente en la secretaría al recoger los materiales."}
              </p>
            </div>
          )}
        </div>

        {/* DNI upload zona */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1.5">
            {language === 'ca' ? 'Foto de la part frontal del DNI' : 'Foto de la parte frontal del DNI'} {config.requerirDni !== false ? '*' : <span className="text-zinc-400 font-normal font-mono text-[10px]">({language === 'ca' ? 'Opcional' : 'Opcional'})</span>}
          </label>
          {((language === 'ca' ? config.instruccionsDniCA : config.instruccionsDniES) || null) && (
            <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">
              {language === 'ca' ? config.instruccionsDniCA : config.instruccionsDniES}
            </p>
          )}
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
