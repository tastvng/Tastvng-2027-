/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { 
  ArrowLeft, 
  Save, 
  Coins, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  LayoutList, 
  RefreshCw, 
  Sparkles,
  Megaphone,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Palette,
  Type,
  Shirt
} from 'lucide-react';
import { SistemaConfig, PreguntaDinamica, NoticiaXarxes, TarifaConcept, LiniaUniforme } from '../types';

interface AdminConfigProps {
  config: SistemaConfig;
  onBack: () => void;
  onSave: (updatedConfig: SistemaConfig) => void;
  noticies?: NoticiaXarxes[];
  onSaveNoticies?: (updatedNoticies: NoticiaXarxes[]) => void;
}

export default function AdminConfig({ config, onBack, onSave, noticies, onSaveNoticies }: AdminConfigProps) {
  const { language, t } = useLanguage();
  // Config parameters state
  const [preuAdult, setPreuAdult] = useState(config.preuAdult);
  const [preuJuvenil, setPreuJuvenil] = useState(config.preuJuvenil);
  const [preuDomasBalco, setPreuDomasBalco] = useState(config.preuDomasBalco);
  const [preuMocadorExtra, setPreuMocadorExtra] = useState(config.preuMocadorExtra);

  // States for dynamic customizable tariffs/payment lines
  const [titolSeccioTarifes, setTitolSeccioTarifes] = useState(config.titolSeccioTarifes || 'Tarifes i Cànons 2026');
  const [tarifesDinamiques, setTarifesDinamiques] = useState<TarifaConcept[]>(
    config.tarifesDinamiques || [
      { id: 'adults', nom: 'Preu Parella Adulta (€)', valor: config.preuAdult, actiu: true, tipus: 'categoria_adult' },
      { id: 'juvenils', nom: 'Preu Parella Juvenil (€)', valor: config.preuJuvenil, actiu: true, tipus: 'categoria_juvenil' },
      { id: 'domas', nom: 'Cànon Domàs de Balcó (€)', valor: config.preuDomasBalco, actiu: true, tipus: 'extra_domas' },
      { id: 'mocador', nom: 'Cànon Mocador Extra (€)', valor: config.preuMocadorExtra, actiu: true, tipus: 'extra_mocador' }
    ]
  );
  const [newTarifaNom, setNewTarifaNom] = useState('');
  const [newTarifaValor, setNewTarifaValor] = useState<number>(0);

  const handleAddTarifa = () => {
    if (!newTarifaNom.trim()) return;
    const nova: TarifaConcept = {
      id: 'tf-' + Math.random().toString(36).substr(2, 9),
      nom: newTarifaNom.trim(),
      valor: Number(newTarifaValor) || 0,
      actiu: true,
      tipus: 'extra_generic'
    };
    setTarifesDinamiques([...tarifesDinamiques, nova]);
    setNewTarifaNom('');
    setNewTarifaValor(0);
  };

  const handleRemoveTarifa = (id: string) => {
    const item = tarifesDinamiques.find(t => t.id === id);
    if (item && item.tipus !== 'extra_generic') {
      alert("No es poden eliminar les tarifes troncals del sistema (Adults, Juvenils, Domàs o Mocadors), però podeu canviar-ne el preu, el nom o desactivar-ne el seu ús.");
      return;
    }
    setTarifesDinamiques(tarifesDinamiques.filter(t => t.id !== id));
  };

  const updateTarifaConcept = (id: string, updates: Partial<TarifaConcept>) => {
    setTarifesDinamiques(prev => prev.map(t => {
      if (t.id === id) {
        const updatedItem = { ...t, ...updates };
        if (updatedItem.tipus === 'categoria_adult' && updates.valor !== undefined) setPreuAdult(updatedItem.valor);
        if (updatedItem.tipus === 'categoria_juvenil' && updates.valor !== undefined) setPreuJuvenil(updatedItem.valor);
        if (updatedItem.tipus === 'extra_domas' && updates.valor !== undefined) setPreuDomasBalco(updatedItem.valor);
        if (updatedItem.tipus === 'extra_mocador' && updates.valor !== undefined) setPreuMocadorExtra(updatedItem.valor);
        return updatedItem;
      }
      return t;
    }));
  };

  // Customization state
  const [logoText, setLogoText] = useState(config.logoText || 'T');
  const [titolPrincipal, setTitolPrincipal] = useState(config.titolPrincipal || 'EL TAST');
  const [titolSecundari, setTitolSecundari] = useState(config.titolSecundari || 'VILANOVA');
  const [subtitol, setSubtitol] = useState(config.subtitol || 'Vilanova i la Geltrú 2026');
  const [logoColor, setLogoColor] = useState(config.logoColor || '#ff0090');
  const [titolFormulariDinamic, setTitolFormulariDinamic] = useState(config.titolFormulariDinamic || "Preguntes del Qüestionari d'El Tast");
  const [logoImgUrl, setLogoImgUrl] = useState(config.logoImgUrl || '');
  const [logoUseImage, setLogoUseImage] = useState(!!config.logoUseImage);

  // Clothing lines & custom equipment options states
  const [nomUniforme, setNomUniforme] = useState(config.nomUniforme || 'Talla de Samarreta');
  const [nomUniformeES, setNomUniformeES] = useState(config.nomUniformeES || 'Talla de Camiseta');
  const [opcionsUniformeCsv, setOpcionsUniformeCsv] = useState(
    (config.opcionsUniforme || ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']).join(', ')
  );

  const [liniisUniforme, setLiniisUniforme] = useState<LiniaUniforme[]>(
    config.liniisUniforme || [
      {
        id: 'lin-1',
        nom: config.nomUniforme || 'Talla de Samarreta',
        nomES: config.nomUniformeES || 'Talla de Camiseta',
        opcions: config.opcionsUniforme || ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
        requeixQuantitat: false
      }
    ]
  );

  // Questionnaire questions state
  const [preguntes, setPreguntes] = useState<PreguntaDinamica[]>(config.preguntesFormulari);

  // Announcements / News Feed State
  const [newsList, setNewsList] = useState<NoticiaXarxes[]>(noticies || []);
  const [newPostXarxa, setNewPostXarxa] = useState<'instagram' | 'facebook' | 'entitat'>('entitat');
  const [newPostUsuari, setNewPostUsuari] = useState('Associació Cultural El Tast');
  const [newPostText, setNewPostText] = useState('');
  const [newPostImatge, setNewPostImatge] = useState('');
  const [newPostLikes, setNewPostLikes] = useState(0);
  
  // Custom enhanced fields for multi-media entity notices
  const [newPostTipus, setNewPostTipus] = useState<'normal' | 'video' | 'nota' | 'alerta'>('normal');
  const [newPostTitol, setNewPostTitol] = useState('');
  const [newPostVideoUrl, setNewPostVideoUrl] = useState('');
  const [newPostRessaltat, setNewPostRessaltat] = useState(false);
  const [newPostEnllacUrl, setNewPostEnllacUrl] = useState('');
  
  // Create novel question states
  const [newTitol, setNewTitol] = useState('');
  const [newTipus, setNewTipus] = useState<'text' | 'select' | 'boolean'>('text');
  const [newOpcionsCsv, setNewOpcionsCsv] = useState('');

  const [textLegalAutoritzacioMenors, setTextLegalAutoritzacioMenors] = useState(config.textLegalAutoritzacioMenors || "AUTORITZACIÓ DE MENORS D'EDAT\n\nEn condició de tutor/a legal del menor inscrit, declaro sota la meva responsabilitat que autoritzo expressament la seva participació a l'esdeveniment i activitats organitzades per l'Associació Cultural El Tast (Vilanova i la Geltrú 2026).\n\nCertifico que el menor es troba en condicions físiques i de salut aptes per al correcte desenvolupament de l'activitat, i m'en faig responsable de qualsevol incidència que se'n derivi del seu estat previ de salut, així com del cumprimento de la normativa vigent de l'organització.");
  const [textLegalAutoritzacioMenorsES, setTextLegalAutoritzacioMenorsES] = useState(config.textLegalAutoritzacioMenorsES || "AUTORIZACIÓN DE MENORES DE EDAD\n\nEn condición de tutor/a legal del menor inscrito, declaro bajo mi responsabilidad que autorizo expresamente su participación en el evento y actividades organizadas por la Associació Cultural El Tast (Vilanova i la Geltrú 2026).\n\nCertifico que el menor se encuentra en condiciones físicas y de salud aptas para el correcto desarrollo de la actividad, y me hago responsable de cualquier incidencia que se derive de su estado previo de salud, así como del cumplimiento de la normativa de la organización.");

  const [notifSuccess, setNotifSuccess] = useState(false);

  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translatingFields, setTranslatingFields] = useState<Record<string, boolean>>({});

  const handleBlurTranslate = async (
    textToTranslate: string,
    setTargetValue: (val: string) => void,
    targetKey: string,
    sourceLang: 'ca' | 'es',
    targetLang: 'ca' | 'es'
  ) => {
    if (!autoTranslate || !textToTranslate || !textToTranslate.trim()) return;

    setTranslatingFields(prev => ({ ...prev, [targetKey]: true }));
    try {
      const { translateText } = await import('../translateService');
      const translated = await translateText(textToTranslate, sourceLang, targetLang);
      if (translated && translated.trim()) {
        setTargetValue(translated.trim());
      }
    } catch (e) {
      console.error("Auto translation error in AdminConfig:", e);
    } finally {
      setTranslatingFields(prev => ({ ...prev, [targetKey]: false }));
    }
  };

  // States and Handlers for Logo Drag & Drop / Upload
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoImgUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const updatePreguntaTitol = (id: string, value: string) => {
    setPreguntes(prev => prev.map(p => p.id === id ? { ...p, titol: value } : p));
  };

  const handleAddPregunta = () => {
    if (!newTitol.trim()) return;

    const opcionsArray = newTipus === 'select' 
      ? newOpcionsCsv.split(',').map(s => s.trim()).filter(Boolean) 
      : undefined;

    const nova: PreguntaDinamica = {
      id: 'preg-' + Math.random().toString(36).substr(2, 9),
      titol: newTitol,
      tipus: newTipus,
      opcions: opcionsArray,
      requerit: false,
      activa: true
    };

    setPreguntes([...preguntes, nova]);
    setNewTitol('');
    setNewOpcionsCsv('');
  };

  const handleRemovePregunta = (id: string) => {
    setPreguntes(preguntes.filter(p => p.id !== id));
  };

  const togglePreguntaActiva = (id: string) => {
    setPreguntes(preguntes.map(p => p.id === id ? { ...p, activa: !p.activa } : p));
  };

  const togglePreguntaRequerida = (id: string) => {
    setPreguntes(preguntes.map(p => p.id === id ? { ...p, requerit: !p.requerit } : p));
  };

  const handleAddNewsPost = () => {
    if (!newPostText.trim()) return;
    const nova: NoticiaXarxes = {
      id: 'not-' + Math.random().toString(36).substr(2, 9),
      xarxa: newPostXarxa,
      usuari: newPostUsuari.trim() || (newPostXarxa === 'instagram' ? '@eltastvng' : newPostXarxa === 'facebook' ? 'Associació Cultural El Tast' : 'Secretaria El Tast'),
      text: newPostText.trim(),
      imatgeUrl: newPostImatge.trim() || undefined,
      dataPublicacio: 'Just ara',
      enllacUrl: newPostEnllacUrl.trim() || undefined,
      likes: Number(newPostLikes) || 0,
      tipus: newPostTipus,
      titol: newPostTitol.trim() || undefined,
      videoUrl: newPostTipus === 'video' ? newPostVideoUrl.trim() : undefined,
      ressaltat: newPostRessaltat
    };
    setNewsList([...newsList, nova]);
    setNewPostText('');
    setNewPostImatge('');
    setNewPostLikes(0);
    setNewPostTitol('');
    setNewPostVideoUrl('');
    setNewPostEnllacUrl('');
    setNewPostRessaltat(false);
  };

  const handleRemoveNewsPost = (id: string) => {
    setNewsList(newsList.filter(p => p.id !== id));
  };

  const handleAddLiniaUniforme = () => {
    const nova: LiniaUniforme = {
      id: 'lin-' + Math.random().toString(36).substr(2, 9),
      nom: 'Nova línia d\'equipament',
      nomES: 'Nueva línea de equipamiento',
      opcions: ['S', 'M', 'L', 'XL'],
      requeixQuantitat: false
    };
    setLiniisUniforme([...liniisUniforme, nova]);
  };

  const handleRemoveLiniaUniforme = (id: string) => {
    setLiniisUniforme(liniisUniforme.filter(l => l.id !== id));
  };

  const handleUpdateLiniaUniforme = (id: string, updates: Partial<LiniaUniforme>) => {
    setLiniisUniforme(liniisUniforme.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleGuardarConfig = () => {
    // Find rates in the array or fall back to single inputs
    const adultsVal = tarifesDinamiques.find(t => t.id === 'adults')?.valor ?? Number(preuAdult);
    const juvenilsVal = tarifesDinamiques.find(t => t.id === 'juvenils')?.valor ?? Number(preuJuvenil);
    const domasVal = tarifesDinamiques.find(t => t.id === 'domas')?.valor ?? Number(preuDomasBalco);
    const mocadorVal = tarifesDinamiques.find(t => t.id === 'mocador')?.valor ?? Number(preuMocadorExtra);

    const updated: SistemaConfig = {
      preuAdult: Number(adultsVal),
      preuJuvenil: Number(juvenilsVal),
      preuDomasBalco: Number(domasVal),
      preuMocadorExtra: Number(mocadorVal),
      titolSeccioTarifes: titolSeccioTarifes.trim(),
      tarifesDinamiques: tarifesDinamiques,
      titolFormulariDinamic: titolFormulariDinamic.trim(),
      preguntesFormulari: preguntes,
      logoText: logoText.trim(),
      titolPrincipal: titolPrincipal.trim(),
      titolSecundari: titolSecundari.trim(),
      subtitol: subtitol.trim(),
      logoColor: logoColor.trim(),
      logoImgUrl: logoImgUrl.trim(),
      logoUseImage: logoUseImage,
      nomUniforme: liniisUniforme[0]?.nom || nomUniforme,
      nomUniformeES: liniisUniforme[0]?.nomES || nomUniformeES,
      opcionsUniforme: liniisUniforme[0]?.opcions || (config.opcionsUniforme || ["XS", "S", "M", "L", "XL", "XXL", "3XL"]),
      liniisUniforme: liniisUniforme,
      textLegalAutoritzacioMenors: textLegalAutoritzacioMenors,
      textLegalAutoritzacioMenorsES: textLegalAutoritzacioMenorsES
    };

    onSave(updated);
    if (onSaveNoticies) {
      onSaveNoticies(newsList);
    }
    setNotifSuccess(true);
    setTimeout(() => {
      setNotifSuccess(false);
      onBack();
    }, 1500);
  };

  return (
    <div className="space-y-6" id="admin-config-container">
      {/* Configuration headers */}
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow">
        <button 
          onClick={onBack}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          id="btn-nav-config-back"
        >
          <ArrowLeft size={14} /> {language === 'ca' ? "Tornar al taulell" : "Volver al panel"}
        </button>

        <h2 className="font-sans font-extrabold text-base tracking-tight text-white flex items-center gap-2">
          {language === 'ca' ? "Personalitza Canons i Cüestionaris" : "Personaliza Cánones y Cuestionarios"}
        </h2>

        <button 
          onClick={handleGuardarConfig}
          className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow animate-pulse cursor-pointer"
          id="btn-nav-config-save"
        >
          {notifSuccess 
            ? (language === 'ca' ? "S'ha guardat!" : "¡Guardado!") 
            : (language === 'ca' ? "Guardar Ajustos" : "Guardar Ajustes")} <Save size={14} />
        </button>
      </div>

      {notifSuccess && (
        <div className="bg-green-150 border border-green-200 text-green-800 p-4 rounded-2xl font-bold flex items-center gap-2">
          <CheckCircle size={20} className="text-green-600 animate-bounce" />
          <span>
            {language === 'ca' 
              ? "Configuració del sistema i condicions del qüestionari actualitzades amb èxit!" 
              : "¡Configuración del sistema y condiciones del cuestionario guardadas con éxito!"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Prices configurations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            <h3 className="font-sans font-black text-sm text-zinc-900 pb-3 border-b border-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Coins size={16} className="text-fuchsia-500" /> {titolSeccioTarifes}
            </h3>

            {/* Editable Card Title */}
            <div className="space-y-1">
              <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold">Títol de la Secció / Targeta</label>
              <input 
                type="text" 
                value={titolSeccioTarifes} 
                onChange={(e) => setTitolSeccioTarifes(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                id="input-config-titol-tarifes"
                placeholder="Canvia el títol del canonical"
              />
            </div>

            {/* List of Dynamic Rate Lines */}
            <div className="space-y-4">
              <span className="block text-[10px] text-zinc-400 uppercase font-mono tracking-wider font-bold">Línies de Tarifes i Preus</span>
              {tarifesDinamiques.map((tf) => (
                <div key={tf.id} className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center gap-2">
                    {/* Rename name of the line */}
                    <input 
                      type="text" 
                      value={tf.nom} 
                      onChange={(e) => updateTarifaConcept(tf.id, { nom: e.target.value })}
                      className="bg-transparent border-0 hover:bg-zinc-100/50 focus:bg-white focus:border-fuchsia-400 rounded px-2 py-0.5 text-xs font-bold text-zinc-850 focus:outline-none flex-1 truncate"
                      placeholder="Nom de l'element"
                      title="Fes clic per canviar el nom de la línia"
                    />

                    {tf.tipus === 'extra_generic' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTarifa(tf.id)}
                        className="p-1 text-zinc-400 hover:text-red-500 rounded transition shrink-0"
                        title="Eliminar línia"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Value/Amount Input */}
                    <div className="relative flex-1">
                      <input 
                        type="number" 
                        value={tf.valor} 
                        onChange={(e) => updateTarifaConcept(tf.id, { valor: Math.max(0, Number(e.target.value)) })}
                        className="w-full bg-white border border-zinc-250 focus:border-fuchsia-500 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-[10px] text-zinc-400 font-bold">EUR</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateTarifaConcept(tf.id, { actiu: !tf.actiu })}
                      className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all shrink-0 ${
                        tf.actiu 
                          ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600' 
                          : 'bg-zinc-200/50 border-transparent text-zinc-400'
                      }`}
                    >
                      {tf.actiu ? 'Activa' : 'Inactiva'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Dynamic Rate Line */}
            <div className="p-3.5 bg-zinc-950 text-white rounded-2xl space-y-3">
              <span className="block text-[10px] text-fuchsia-400 uppercase font-mono font-bold flex items-center gap-1">
                <Plus size={12} /> Afegir Nova Línia
              </span>
              <div className="space-y-2 text-xs">
                <div>
                  <input 
                    type="text" 
                    value={newTarifaNom}
                    onChange={(e) => setNewTarifaNom(e.target.value)}
                    placeholder="Nom de la línia (Ex: Sopar Oficial)"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      value={newTarifaValor || ''}
                      onChange={(e) => setNewTarifaValor(Number(e.target.value))}
                      placeholder="Import (€)"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-[10px] text-zinc-400">EUR</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTarifa}
                    className="px-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl transition"
                  >
                    Afegir
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex gap-2 text-zinc-500 text-[10px] leading-relaxed">
              <TrendingUp size={16} className="text-zinc-400 shrink-0 mt-0.5" />
              <span>
                Les modificacions en els preus s'aplicaran en temps real sobre la tarjeta de liquidació de la zona pública. Els registres previs mantindran el preu calculat històric.
              </span>
            </div>
          </div>

          {/* Custom brand identity customization card */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            <h3 className="font-sans font-black text-sm text-zinc-900 pb-3 border-b border-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Palette size={16} className="text-[#ff0090]" /> Personalització Visual i Identitat
            </h3>

            {/* Micro demo preview of the header branding */}
            <div className="p-4 bg-zinc-950 border border-white/5 rounded-2xl space-y-2">
              <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Vista Prèvia en Temps Real</span>
              <div className="flex items-center gap-2.5 bg-black/40 p-2 rounded-xl">
                {logoUseImage && logoImgUrl ? (
                  <img 
                    src={logoImgUrl} 
                    alt="Logo El Tast" 
                    className="w-8 h-8 object-contain rounded-lg shadow-lg border border-white/10 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div 
                    className="w-7 h-7 rounded flex items-center justify-center font-bold text-black text-xs uppercase shrink-0 transition-all font-sans"
                    style={{ backgroundColor: logoColor, boxShadow: `0 2px 8px ${logoColor}30` }}
                  >
                    {logoText || '?'}
                  </div>
                )}
                <div>
                  <h4 className="font-sans font-black text-xs leading-none text-white tracking-tight">
                    {titolPrincipal || 'TEXT'} <span style={{ color: logoColor }}>{titolSecundari || 'CODI'}</span>
                  </h4>
                  <p className="font-mono text-[8px] text-zinc-500 tracking-wider truncate mt-0.5">{subtitol || 'SEU ELECTRÒNICA'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs font-sans text-zinc-700">
              {/* Type of Logo selector */}
              <div>
                <label className="block font-bold tracking-tight mb-2">Tipus de Logotip Corporatiu</label>
                <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLogoUseImage(false)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      !logoUseImage 
                        ? 'bg-white text-zinc-900 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Símbol de Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoUseImage(true)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      logoUseImage 
                        ? 'bg-white text-zinc-900 shadow shadow-zinc-200 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Imatge / GIF
                  </button>
                </div>
              </div>

              {!logoUseImage ? (
                /* Logo symbol text */
                <div>
                  <label className="block font-bold tracking-tight mb-1">Símbol del Logotip (1-3 caràcters) *</label>
                  <input 
                    type="text" 
                    maxLength={3}
                    value={logoText} 
                    onChange={(e) => setLogoText(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-4 py-2.5 focus:outline-none transition-all font-mono uppercase"
                    placeholder="Ex: T"
                    id="input-config-logo-text"
                  />
                </div>
              ) : (
                /* Custom uploader and preset selector */
                <div className="space-y-3">
                  <label className="block font-bold tracking-tight">Imatge o GIF animat del Logotip</label>
                  
                  {/* File Upload Area supporting Drag-and-Drop and Click */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      dragActive 
                        ? 'border-[#ff0090] bg-[#ff0090]/5 shadow-inner' 
                        : 'border-zinc-200 hover:border-[#ff0090]/50 bg-zinc-50'
                    }`}
                    onClick={() => document.getElementById('logo-file-input')?.click()}
                  >
                    <input
                      type="file"
                      id="logo-file-input"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    
                    {logoImgUrl ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <img 
                          src={logoImgUrl} 
                          alt="Logo cargado" 
                          className="h-14 max-w-[120px] object-contain rounded-lg shadow-sm border border-zinc-200 bg-white p-1"
                        />
                        <span className="text-[10px] text-zinc-400 font-mono truncate max-w-full">Arxiu carregat correctament</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLogoImgUrl('');
                          }}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold transition mt-1"
                        >
                          Eliminar Imatge
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 py-1">
                        <span className="block text-xs font-bold text-zinc-600">Arrossega o selecciona un arxiu</span>
                        <span className="block text-[10px] text-zinc-400">Suporta png, jpg, svg o gif animat (enllaç o base64)</span>
                      </div>
                    )}
                  </div>

                  {/* Direct Input Field */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono tracking-wider font-bold mb-1">O enganxa un enllaç de l'imatge / GIF extern</label>
                    <input 
                      type="text" 
                      value={logoImgUrl} 
                      onChange={(e) => setLogoImgUrl(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-all font-mono"
                      placeholder="https://exple.com/my-logo-or-gift.gif"
                      id="input-[#ff0090]-logo-url"
                    />
                  </div>

                  {/* Quick-select Carnaval GIF Presets */}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[9px] text-zinc-400 uppercase font-mono tracking-wider font-bold">Idees i presets de Carnaval (GIFs de festa!)</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { name: '🎉 Confetti', url: 'https://media.giphy.com/media/26tOZ42cXxdb76XyE/giphy.gif' },
                        { name: '✨ Dansa Samba', url: 'https://media.giphy.com/media/l2Jhtx8S50VatYFsY/giphy.gif' },
                        { name: '🎭 Antifaç', url: 'https://media.giphy.com/media/26AHG5K7upgLaI9Xy/giphy.gif' },
                        { name: '🎷 Festa', url: 'https://media.giphy.com/media/l3q2zVr6cu95nF6O4/giphy.gif' }
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setLogoImgUrl(preset.url);
                          }}
                          className={`p-1.5 rounded-lg border text-left text-[9px] font-bold transition truncate flex flex-col gap-1 items-center justify-between hover:bg-zinc-50 hover:border-[#ff0090]/40 ${
                            logoImgUrl === preset.url ? 'border-[#ff0090] bg-[#ff0090]/5 text-[#ff0090]' : 'border-zinc-200 bg-white text-zinc-600'
                          }`}
                        >
                          <img 
                            src={preset.url} 
                            alt={preset.name} 
                            className="w-6 h-6 object-cover rounded"
                            referrerPolicy="no-referrer"
                          />
                          <span className="truncate w-full text-center text-[8px]">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Title 1 */}
              <div>
                <label className="block font-bold tracking-tight mb-1">Títol Principal canònic (Text Blanc) *</label>
                <input 
                  type="text" 
                  value={titolPrincipal} 
                  onChange={(e) => setTitolPrincipal(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                  placeholder="Ex: EL TAST"
                  id="input-config-title-principal"
                />
              </div>

              {/* Title 2 */}
              <div>
                <label className="block font-bold tracking-tight mb-1">Títol Secundari (Color Corporatiu) *</label>
                <input 
                  type="text" 
                  value={titolSecundari} 
                  onChange={(e) => setTitolSecundari(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                  placeholder="Ex: VILANOVA"
                  id="input-config-title-secundari"
                />
              </div>

              {/* Subtitle / Phrase */}
              <div>
                <label className="block font-bold tracking-tight mb-1">Lema / Subtítol inferior *</label>
                <input 
                  type="text" 
                  value={subtitol} 
                  onChange={(e) => setSubtitol(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                  placeholder="Ex: Vilanova i la Geltrú 2026"
                  id="input-config-title-subtitle"
                />
              </div>

              {/* Corporation Accent color */}
              <div>
                <label className="block font-bold tracking-tight mb-1">Color Corporatiu (Hexadecimal o Selector) *</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={logoColor}
                    onChange={(e) => setLogoColor(e.target.value)}
                    className="w-10 h-10 bg-transparent border-0 rounded cursor-pointer shrink-0"
                    title="Tria color corporatiu"
                    id="input-config-logo-color-picker"
                  />
                  <input 
                    type="text" 
                    value={logoColor} 
                    onChange={(e) => setLogoColor(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-4 py-2.5 focus:outline-none transition-all font-mono"
                    placeholder="#ff0090"
                    id="input-config-logo-color-hex"
                  />
                </div>
              </div>

              {/* Minor legal texts customization */}
              <div className="pt-4 border-t border-zinc-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="block text-[9px] text-zinc-400 uppercase font-mono tracking-wider font-bold">Autorització de Menors</span>
                  <label className="flex items-center gap-1 cursor-pointer text-[9px] text-zinc-400 select-none">
                    <input 
                      type="checkbox"
                      checked={autoTranslate}
                      onChange={(e) => setAutoTranslate(e.target.checked)}
                      className="rounded border-zinc-200 bg-white text-[#ff0090] focus:ring-0 accent-[#ff0090] w-2.5 h-2.5 cursor-pointer"
                    />
                    <span className={autoTranslate ? "text-[#ff0090] font-bold" : ""}>IA Sincro ✨</span>
                  </label>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-zinc-700">Text de l'Autorització (Català) *</label>
                    {translatingFields['minorLegalCa'] && <span className="text-[9px] text-[#ff0090] font-black animate-pulse">✨ Traduint al català...</span>}
                  </div>
                  <textarea
                    value={textLegalAutoritzacioMenors}
                    onChange={(e) => setTextLegalAutoritzacioMenors(e.target.value)}
                    onBlur={() => handleBlurTranslate(textLegalAutoritzacioMenors, setTextLegalAutoritzacioMenorsES, 'minorLegalEs', 'ca', 'es')}
                    rows={4}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-4 py-2 text-xs focus:outline-none transition-all font-sans leading-relaxed shadow-inner"
                    placeholder="Text legal de l'autorització en català..."
                    id="input-config-minor-legal-ca"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-zinc-700">Texto de la Autorización (Castellano) *</label>
                    {translatingFields['minorLegalEs'] && <span className="text-[9px] text-[#ff0090] font-black animate-pulse">✨ Traduciendo al castellano...</span>}
                  </div>
                  <textarea
                    value={textLegalAutoritzacioMenorsES}
                    onChange={(e) => setTextLegalAutoritzacioMenorsES(e.target.value)}
                    onBlur={() => handleBlurTranslate(textLegalAutoritzacioMenorsES, setTextLegalAutoritzacioMenors, 'minorLegalCa', 'es', 'ca')}
                    rows={4}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-[#ff0090] rounded-xl px-4 py-2 text-xs focus:outline-none transition-all font-sans leading-relaxed shadow-inner"
                    placeholder="Texto legal de la autorización en castellano..."
                    id="input-config-minor-legal-es"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right columns: Questionnaire form builder */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            <h3 className="font-sans font-black text-sm text-zinc-900 pb-3 border-b border-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <LayoutList size={16} className="text-fuchsia-500" /> {titolFormulariDinamic}
            </h3>

            {/* Editable Card Title */}
            <div className="space-y-1">
              <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold">Títol de la Secció de Preguntes</label>
              <input 
                type="text" 
                value={titolFormulariDinamic} 
                onChange={(e) => setTitolFormulariDinamic(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                id="input-config-titol-formulari-dinamic"
                placeholder="Ex: Preguntes del Qüestionari d'El Tast"
              />
            </div>

            {/* List existing fields with actions toggles */}
            <div className="space-y-3.5">
              {preguntes.map((preg) => (
                <div key={preg.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1 flex-1 w-full">
                    <input 
                      type="text" 
                      value={preg.titol} 
                      onChange={(e) => updatePreguntaTitol(preg.id, e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-fuchsia-400 focus:bg-white rounded px-1.5 py-1 text-xs font-bold text-zinc-900 focus:outline-none w-full"
                      placeholder="Títol de la pregunta / línia..."
                      title="Fes clic per canviar el nom de la pregunta"
                    />
                    <div className="flex gap-2 items-center text-[10px] text-zinc-400 font-mono uppercase pl-1.5">
                      <span>Tipus: {preg.tipus}</span>
                      {preg.opcions && <span>• Opcs: {preg.opcions.join(', ')}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto font-sans text-[11px] font-bold">
                    {/* Active toggle check */}
                    <button
                      type="button"
                      onClick={() => togglePreguntaActiva(preg.id)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        preg.activa 
                          ? 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200' 
                          : 'bg-zinc-200/60 text-zinc-400 border border-transparent'
                      }`}
                      id={`btn-config-toggle-active-${preg.id}`}
                    >
                      {preg.activa ? "Activa" : "Inactiva"}
                    </button>

                    {/* Requerida toggle check */}
                    <button
                      type="button"
                      onClick={() => togglePreguntaRequerida(preg.id)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        preg.requerit 
                          ? 'bg-red-50 text-red-600 border border-red-200' 
                          : 'bg-zinc-200/60 text-zinc-400 border border-transparent'
                      }`}
                      id={`btn-config-toggle-req-${preg.id}`}
                    >
                      {preg.requerit ? "Requerida" : "Opcional"}
                    </button>

                    {/* Delete question */}
                    <button
                      type="button"
                      onClick={() => handleRemovePregunta(preg.id)}
                      className="p-1.5 bg-zinc-150 hover:bg-zinc-200 text-zinc-600 rounded-lg transition"
                      title="Eliminar pregunta"
                      id={`btn-config-delete-${preg.id}`}
                    >
                      <Trash2 size={13} className="text-zinc-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Build new custom question drawer item */}
            <div className="p-5 bg-zinc-900 text-white rounded-2xl border border-zinc-800 space-y-4">
              <span className="block font-sans font-bold text-xs text-fuchsia-400 uppercase tracking-wider flex items-center gap-1">
                <Plus size={14} /> Afegir nova pregunta dinàmica
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Enunciat de la pregunta *</label>
                  <input 
                    type="text"
                    value={newTitol}
                    onChange={(e) => setNewTitol(e.target.value)}
                    placeholder="Ex. Digueu la colla de castells a la qual pertanyeu:"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-fuchsia-500 text-white placeholder-zinc-600"
                    id="input-config-new-question-title"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Tipus de resposta *</label>
                  <select
                    value={newTipus}
                    onChange={(e) => setNewTipus(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                    id="select-config-new-question-type"
                  >
                    <option value="text">Camp de Text sencer</option>
                    <option value="boolean">Binaris (Sí / No)</option>
                    <option value="select">Opcions Múltiples (Dropdown)</option>
                  </select>
                </div>

                {newTipus === 'select' && (
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Opcions (Separades per comes) *</label>
                    <input 
                      type="text"
                      value={newOpcionsCsv}
                      onChange={(e) => setNewOpcionsCsv(e.target.value)}
                      placeholder="Opció 1, Opció 2, Opció 3"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-fuchsia-500 text-white placeholder-zinc-600"
                      id="input-config-new-question-options"
                    />
                  </div>
                )}
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={handleAddPregunta}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
                  id="btn-config-add-question-submit"
                >
                  Afegir Pregunta
                </button>
              </div>
            </div>
          </div>

          {/* SEC_UNIFORMS: Gestor de Línies de Talles i Equipament Personalitzat */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6" id="uniform-lines-config-card">
            <div className="border-b border-zinc-100 pb-3 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-sans font-black text-sm text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Shirt size={16} className="text-[#ff0090]" /> {language === 'ca' ? "Gestió de Línies de Talles i Productes" : "Gestor de Líneas de Tallas y Productos"}
              </h3>
              <span className="text-[10px] bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200 rounded-full px-2 py-0.5 font-bold uppercase font-mono">
                {language === 'ca' ? "Configuració lliure" : "Configuración libre"}
              </span>
            </div>

            <p className="text-zinc-500 text-xs">
              {language === 'ca' 
                ? "Configureu les diferents línies de material, talles o marxandatge disponibles per als participants de la parella. Cada línia pot rebre opcions de selecció i la possibilitat d'afegir-hi quantitats."
                : "Configure las diferentes líneas de material, tallas o merchandising disponibles para los participantes de la pareja. Cada línea puede tener opciones de selección y la posibilidad de añadir cantidades."}
            </p>

            <div className="space-y-4">
              {liniisUniforme.map((linia, index) => (
                <div key={linia.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3 relative group">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded font-mono">
                      {language === 'ca' ? `LÍNIA ${index + 1}` : `LÍNEA ${index + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLiniaUniforme(linia.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                      title={language === 'ca' ? "Eliminar línia" : "Eliminar línea"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold">
                          {language === 'ca' ? "Nom de la línia (Català) *" : "Nombre de la línea (Catalán) *"}
                        </label>
                        {translatingFields[`line-nomES-${linia.id}`] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ traduint...</span>}
                      </div>
                      <input 
                        type="text"
                        value={linia.nom}
                        onChange={(e) => handleUpdateLiniaUniforme(linia.id, { nom: e.target.value })}
                        onBlur={async () => {
                          if (!autoTranslate || !linia.nom.trim()) return;
                          const targetKey = `line-nomES-${linia.id}`;
                          setTranslatingFields(prev => ({ ...prev, [targetKey]: true }));
                          try {
                            const { translateText } = await import('../translateService');
                            const translated = await translateText(linia.nom, 'ca', 'es');
                            if (translated && translated.trim()) {
                              handleUpdateLiniaUniforme(linia.id, { nomES: translated.trim() });
                            }
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setTranslatingFields(prev => ({ ...prev, [targetKey]: false }));
                          }
                        }}
                        className="w-full bg-white border border-zinc-250 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                        placeholder="Ex: Talla de Samarreta"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold">
                          {language === 'ca' ? "Nom de la línia (Castellà) *" : "Nombre de la línea (Castellano) *"}
                        </label>
                        {translatingFields[`line-nom-${linia.id}`] && <span className="text-[8px] text-[#ff0090] font-black animate-pulse">✨ traduint...</span>}
                      </div>
                      <input 
                        type="text"
                        value={linia.nomES}
                        onChange={(e) => handleUpdateLiniaUniforme(linia.id, { nomES: e.target.value })}
                        onBlur={async () => {
                          if (!autoTranslate || !linia.nomES.trim()) return;
                          const targetKey = `line-nom-${linia.id}`;
                          setTranslatingFields(prev => ({ ...prev, [targetKey]: true }));
                          try {
                            const { translateText } = await import('../translateService');
                            const translated = await translateText(linia.nomES, 'es', 'ca');
                            if (translated && translated.trim()) {
                              handleUpdateLiniaUniforme(linia.id, { nom: translated.trim() });
                            }
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setTranslatingFields(prev => ({ ...prev, [targetKey]: false }));
                          }
                        }}
                        className="w-full bg-white border border-zinc-250 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                        placeholder="Ex: Talla de Camiseta"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono font-bold mb-1">
                      {language === 'ca' ? "Opcions de selecció (Separades per comes) *" : "Opciones de selección (Separadas por comas) *"}
                    </label>
                    <input 
                      type="text"
                      value={linia.opcions.join(', ')}
                      onChange={(e) => {
                        const vals = e.target.value.split(',').map(s => s.trim());
                        handleUpdateLiniaUniforme(linia.id, { opcions: vals });
                      }}
                      className="w-full bg-white border border-zinc-250 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                      placeholder="XS, S, M, L, XL, XXL..."
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="checkbox"
                      id={`check-qty-${linia.id}`}
                      checked={!!linia.requeixQuantitat}
                      onChange={(e) => handleUpdateLiniaUniforme(linia.id, { requeixQuantitat: e.target.checked })}
                      className="rounded text-fuchsia-600 focus:ring-fuchsia-500 h-4 w-4 border-zinc-300 cursor-pointer"
                    />
                    <label htmlFor={`check-qty-${linia.id}`} className="text-zinc-700 text-xs font-bold select-none cursor-pointer">
                      {language === 'ca' 
                        ? "Permet escollir quantitat de marxandatge/material" 
                        : "Permitir elegir cantidad de merchandising/material"}
                    </label>
                  </div>
                </div>
              ))}

              {liniisUniforme.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                  <p className="text-xs text-zinc-400 italic">
                    {language === 'ca' ? "No hi ha cap línia de talles/productes configurada." : "No hay ninguna línea de tallas/productos configurada."}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddLiniaUniforme}
                className="w-full py-3 border-2 border-dashed border-zinc-200 hover:border-[#ff0090] text-zinc-500 hover:text-[#ff0090] text-xs font-bold rounded-2xl transition flex items-center justify-center gap-1.5 cursor-pointer bg-white"
              >
                <Plus size={14} /> {language === 'ca' ? "Afegir línia de productes/talles" : "Añadir línea de productos/tallas"}
              </button>
            </div>
          </div>

          {/* Gestor d'Avisos i Xarxes Card - Enhanced Multi-resource Communicator */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            <div className="border-b border-zinc-100 pb-3 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-sans font-black text-sm text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Megaphone size={16} className="text-[#ff0090]" /> Gestor de Comunicacions, Vídeos i Notes Oficials
              </h3>
              <span className="text-[10px] bg-[#ff0090]/10 text-[#ff0090] border border-[#ff0090]/20 rounded-full px-2 py-0.5 font-bold uppercase font-mono">
                Multidifusió Activa
              </span>
            </div>

            {/* List and delete existing posts */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {newsList.map((post) => (
                <div 
                  key={post.id} 
                  className={`p-4 rounded-2xl border transition-all flex justify-between items-start gap-4 ${
                    post.ressaltat || post.tipus === 'alerta'
                      ? 'bg-fuchsia-50/50 border-fuchsia-350 shadow-sm'
                      : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  <div className="space-y-1 overflow-hidden min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-zinc-900">{post.usuari}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-650 uppercase font-bold tracking-tight">
                        {post.tipus || 'normal'}
                      </span>
                      {(post.ressaltat || post.tipus === 'alerta') && (
                        <span className="text-[8px] font-mono bg-red-600 text-white font-extrabold px-1.5 rounded animate-pulse">
                          ALT RESSALTAT
                        </span>
                      )}
                    </div>
                    {post.titol && <p className="font-sans font-bold text-xs text-zinc-800 uppercase tracking-tight">{post.titol}</p>}
                    <p className="text-zinc-600 text-xs truncate max-w-lg">{post.text}</p>
                    {post.videoUrl && <p className="text-[9px] text-[#ff0090] font-mono truncate">🎥 {post.videoUrl}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveNewsPost(post.id)}
                    className="p-1.5 bg-zinc-200/60 hover:bg-zinc-200 text-zinc-700 hover:text-red-600 rounded-lg transition shrink-0 self-center"
                    title="Eliminar publicació"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {newsList.length === 0 && (
                <p className="text-zinc-400 text-xs italic text-center py-4">No hi ha publicacions ni avisos públics editats.</p>
              )}
            </div>

            {/* Add new post form */}
            <div className="p-5 bg-zinc-900 text-white rounded-2xl border border-zinc-800 space-y-4">
              <span className="block font-sans font-black text-xs text-[#ff0090] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-zinc-800">
                <Plus size={14} /> Redactar nou Recurs, Comunicat o Vídeo
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-sans">
                {/* 1. Origin / Channel type */}
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">Canal o Signatura</label>
                  <select
                    value={newPostXarxa}
                    onChange={(e) => {
                      const val = e.target.value as 'instagram' | 'facebook' | 'entitat';
                      setNewPostXarxa(val);
                      if (val === 'entitat') {
                        setNewPostUsuari('Associació Cultural El Tast');
                      } else if (val === 'instagram') {
                        setNewPostUsuari('@eltastvng');
                      } else {
                        setNewPostUsuari('El Tast Facebook');
                      }
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer focus:border-[#ff0090]"
                  >
                    <option value="entitat">📢 Comunicat Oficial de l'Entitat</option>
                    <option value="instagram">📸 Instagram Post</option>
                    <option value="facebook">👥 Facebook Post</option>
                  </select>
                </div>

                {/* 2. Sender name */}
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">Signatura de l'Emissor</label>
                  <input
                    type="text"
                    value={newPostUsuari}
                    onChange={(e) => setNewPostUsuari(e.target.value)}
                    placeholder="Ex: Junta Directiva El Tast"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#ff0090] text-white"
                  />
                </div>

                {/* 3. Resource Type */}
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">Tipus de Contingut / Mitjà</label>
                  <select
                    value={newPostTipus}
                    onChange={(e) => setNewPostTipus(e.target.value as 'normal' | 'video' | 'nota' | 'alerta')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer focus:border-[#ff0090]"
                  >
                    <option value="normal">Publicació Estàndard (Imatge/Text)</option>
                    <option value="video">🎬 Vídeo Interactiu (YouTube / Directe MP4)</option>
                    <option value="nota">📝 Nota Informativa o Recurs útil</option>
                    <option value="alerta">🚨 Advertència Crítica / Alerta Urgent</option>
                  </select>
                </div>

                {/* 4. Title / Subject of notice */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">Títol o Assumpte destacat (Opcional)</label>
                  <input
                    type="text"
                    value={newPostTitol}
                    onChange={(e) => setNewPostTitol(e.target.value)}
                    placeholder="Ex: INFORMACIÓ IMPORTANT RECOLLIDA D'ARMILLES"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#ff0090] text-white"
                  />
                </div>

                {/* 5. Sim Likes */}
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">Reaccions Simulades (Likes)</label>
                  <input
                    type="number"
                    value={newPostLikes}
                    onChange={(e) => setNewPostLikes(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#ff0090] text-white"
                  />
                </div>

                {/* 6. Video Integration URL - Conditional */}
                {newPostTipus === 'video' && (
                  <div className="sm:col-span-3 bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                    <label className="block text-[10px] text-amber-400 uppercase font-mono font-bold tracking-wider">Enllaç de Vídeo (YouTube, Vimeo, o MP4 complet)</label>
                    <input
                      type="text"
                      value={newPostVideoUrl}
                      onChange={(e) => setNewPostVideoUrl(e.target.value)}
                      placeholder="Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ o https://meuservidor.com/video.mp4"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-zinc-600"
                    />
                    <p className="text-[10px] text-zinc-500 font-sans italic">La plataforma transformarà enllaços estàndard de YouTube en reproductors dinàmics integrats automàticament.</p>
                  </div>
                )}

                {/* 7. Image attachment URL - Conditional for non-video */}
                {newPostTipus !== 'video' && (
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">URL de la foto o infografia adjunta (Opcional)</label>
                    <input
                      type="text"
                      value={newPostImatge}
                      onChange={(e) => setNewPostImatge(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#ff0090] text-white placeholder-zinc-700"
                    />
                  </div>
                )}

                {/* 8. Text content body */}
                <div className="sm:col-span-3">
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">Cos del Text del Comunicat *</label>
                  <textarea
                    value={newPostText}
                    onChange={(e) => setNewPostText(e.target.value)}
                    placeholder="Escriu les directrius, explicacions de les notes o canvis que veurà l'usuari..."
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#ff0090] text-white placeholder-zinc-600"
                  />
                </div>

                {/* 9. Action action extern link url */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-zinc-400 uppercase font-mono font-bold tracking-wider mb-1">Enllaç d'Acció Extern (Opcional, enllaçar documents, PDFs o webs)</label>
                  <input
                    type="text"
                    value={newPostEnllacUrl}
                    onChange={(e) => setNewPostEnllacUrl(e.target.value)}
                    placeholder="https://web-entitat.com/normativa-comparses-pdf"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#ff0090] text-white placeholder-zinc-700"
                  />
                </div>

                {/* 10. Eye-catching Urgent Highlight Blinker Switch! */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 sm:col-span-1 self-end">
                  <div className="space-y-0.5">
                    <span className="block text-[9px] text-fuchsia-450 uppercase font-mono font-black tracking-widest">CRIDAR L'ATENCIÓ?</span>
                    <span className="block text-[8px] text-zinc-500 font-sans leading-none">Ressaltat amb ràfega de colors i efectes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newPostRessaltat}
                    onChange={(e) => setNewPostRessaltat(e.target.checked)}
                    className="w-4 h-4 rounded text-[#ff0090] focus:ring-0 accent-[#ff0090] bg-zinc-950 border-zinc-800 cursor-pointer text-xs"
                  />
                </div>
              </div>

              <div className="text-right pt-2">
                <button
                  type="button"
                  onClick={handleAddNewsPost}
                  className="bg-[#ff0090] hover:bg-[#ff0090]/90 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-[#ff0090]/25 uppercase tracking-wide"
                >
                  Publicar Avis a la Web
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
