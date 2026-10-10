import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Plus,
  UtensilsCrossed,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { PreguntaDinamica } from '../../types';

interface BlocPreguntaCardProps {
  root: PreguntaDinamica;
  children: PreguntaDinamica[];
  language: 'ca' | 'es';
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveBlock: (direction: 'up' | 'down') => void;
  onToggleActiveBlock: () => void;
  onToggleRequeritRoot: () => void;
  onDuplicateBlock: () => void;
  onDeleteBlock: () => void;
  onUpdateRootTitol: (val: string) => void;
  onUpdateBlockAmbit: (val: 'parella' | 'comparser') => void;
  onUpdateBlockPresentacio: (val: 'desplegable' | 'botons') => void;
  onUpdateRootOptions: (newOpts: string[]) => void;
  onUpdateRootTriggerOption: (newOption: string) => void;
  onUpdateRootPrice: (opcio: string, valStr: string) => void;
  onUpdateRootConcepte: (val: string) => void;
  onUpdateRootConcepteES: (val: string) => void;
  // Children actions
  onUpdateChild: (childId: string, updates: Partial<PreguntaDinamica>) => void;
  onUpdateChildOptions: (childId: string, newOpts: string[]) => void;
  onMoveChild: (childIndex: number, direction: 'up' | 'down') => void;
  onDeleteChild: (childId: string) => void;
  onAddChild: (titol: string, opcions: string[]) => void;
}

export const BlocPreguntaCard: React.FC<BlocPreguntaCardProps> = ({
  root,
  children,
  language,
  canMoveUp,
  canMoveDown,
  onMoveBlock,
  onToggleActiveBlock,
  onToggleRequeritRoot,
  onDuplicateBlock,
  onDeleteBlock,
  onUpdateRootTitol,
  onUpdateBlockAmbit,
  onUpdateBlockPresentacio,
  onUpdateRootOptions,
  onUpdateRootTriggerOption,
  onUpdateRootPrice,
  onUpdateRootConcepte,
  onUpdateRootConcepteES,
  onUpdateChild,
  onUpdateChildOptions,
  onMoveChild,
  onDeleteChild,
  onAddChild
}) => {
  const [newRootOpt, setNewRootOpt] = useState('');
  const [editingRootOptIdx, setEditingRootOptIdx] = useState<number | null>(null);
  const [editingRootOptVal, setEditingRootOptVal] = useState('');

  // Child option chip states: map of childId -> state
  const [newChildOpt, setNewChildOpt] = useState<Record<string, string>>({});
  const [editingChildOpt, setEditingChildOpt] = useState<{ childId: string; idx: number; val: string } | null>(null);

  // New child drawer / form state
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [newChildTitol, setNewChildTitol] = useState('');
  const [newChildOptionsCsv, setNewChildOptionsCsv] = useState('');

  const totalPreguntesInBloc = 1 + children.length;
  const isBlockActive = root.activa;
  const rootOptions = root.opcions || [];

  // Active trigger option for dependents (taken from first child or default to root's first option)
  const currentTriggerOption = children[0]?.condicio?.valor || rootOptions[0] || 'Sí';

  // Has at least one positive price
  const hasPrice = root.preus && Object.values(root.preus).some(v => typeof v === 'number' && v > 0);

  // Root option helpers
  const handleAddRootOption = () => {
    const trimmed = newRootOpt.trim();
    if (!trimmed) return;
    if (rootOptions.includes(trimmed)) {
      alert(language === 'ca' ? "Aquesta opció ja existeix." : "Esta opción ya existe.");
      return;
    }
    onUpdateRootOptions([...rootOptions, trimmed]);
    setNewRootOpt('');
  };

  const handleRemoveRootOption = (optToRemove: string) => {
    if (rootOptions.length <= 1) {
      alert(language === 'ca' ? "Hi ha d'haver almenys una opció." : "Debe haber al menos una opción.");
      return;
    }
    if (optToRemove === currentTriggerOption) {
      const confirmMsg = language === 'ca'
        ? `L'opció «${optToRemove}» activa les preguntes de la comanda. Si l'elimineu, caldrà seleccionar una altra opció activadora. Voleu continuar?`
        : `La opción «${optToRemove}» activa las preguntas del pedido. Si la elimina, se deberá seleccionar otra opción activadora. ¿Desea continuar?`;
      if (!window.confirm(confirmMsg)) return;
    }
    const filtered = rootOptions.filter(o => o !== optToRemove);
    onUpdateRootOptions(filtered);
    if (optToRemove === currentTriggerOption && filtered.length > 0) {
      onUpdateRootTriggerOption(filtered[0]);
    }
  };

  const handleSaveRenameRootOption = (idx: number) => {
    const newVal = editingRootOptVal.trim();
    if (!newVal) return;
    const oldVal = rootOptions[idx];
    if (newVal === oldVal) {
      setEditingRootOptIdx(null);
      return;
    }
    if (rootOptions.some((o, i) => i !== idx && o === newVal)) {
      alert(language === 'ca' ? "Ja existeix una altra opció amb aquest nom." : "Ya existe otra opción con este nombre.");
      return;
    }
    const updated = [...rootOptions];
    updated[idx] = newVal;
    onUpdateRootOptions(updated);
    setEditingRootOptIdx(null);
  };

  // Child option chip handlers
  const handleAddChildOption = (child: PreguntaDinamica) => {
    const val = (newChildOpt[child.id] || '').trim();
    if (!val) return;
    const opts = child.opcions || [];
    if (opts.includes(val)) {
      alert(language === 'ca' ? "Aquesta opció ja existeix." : "Esta opción ya existe.");
      return;
    }
    onUpdateChildOptions(child.id, [...opts, val]);
    setNewChildOpt(prev => ({ ...prev, [child.id]: '' }));
  };

  const handleRemoveChildOption = (child: PreguntaDinamica, optToRemove: string) => {
    const opts = child.opcions || [];
    if (opts.length <= 1) {
      alert(language === 'ca' ? "Hi ha d'haver almenys una opció." : "Debe haber al menos una opción.");
      return;
    }
    onUpdateChildOptions(child.id, opts.filter(o => o !== optToRemove));
  };

  const handleSaveRenameChildOption = (child: PreguntaDinamica, idx: number) => {
    if (!editingChildOpt || editingChildOpt.childId !== child.id) return;
    const newVal = editingChildOpt.val.trim();
    const opts = child.opcions || [];
    const oldVal = opts[idx];
    if (!newVal || newVal === oldVal) {
      setEditingChildOpt(null);
      return;
    }
    if (opts.some((o, i) => i !== idx && o === newVal)) {
      alert(language === 'ca' ? "Ja existeix una altra opció amb aquest nom." : "Ya existe otra opción con este nombre.");
      return;
    }
    const updated = [...opts];
    updated[idx] = newVal;
    onUpdateChildOptions(child.id, updated);
    setEditingChildOpt(null);
  };

  const handleCreateChildSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const titol = newChildTitol.trim();
    if (!titol) {
      alert(language === 'ca' ? "Introduïu el títol de la pregunta." : "Introduzca el título de la pregunta.");
      return;
    }
    const parsedOptions = newChildOptionsCsv
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (parsedOptions.length === 0) {
      alert(language === 'ca' ? "Heu de definir almenys una opció separada per comes." : "Debe definir al menos una opción separada por comas.");
      return;
    }
    onAddChild(titol, parsedOptions);
    setNewChildTitol('');
    setNewChildOptionsCsv('');
    setShowAddChildModal(false);
  };

  return (
    <div
      className={`border-2 rounded-3xl p-5 sm:p-6 transition-all shadow-sm space-y-6 ${
        isBlockActive
          ? 'bg-amber-50/20 border-amber-300'
          : 'bg-zinc-50 border-zinc-200 opacity-80'
      }`}
      id={`admin-bloc-card-${root.id}`}
    >
      {/* 1. Cabecera del bloque */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-amber-200/60">
        <div className="flex items-center gap-3 w-full lg:w-auto flex-1">
          {/* Reordering buttons for the entire block */}
          <div className="flex flex-row lg:flex-col gap-1 items-center shrink-0">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMoveBlock('up')}
              className="p-1 text-zinc-400 hover:text-zinc-800 disabled:opacity-20 disabled:hover:text-zinc-400 rounded transition cursor-pointer"
              title={language === 'ca' ? "Pujar bloc sencer" : "Subir bloque entero"}
              id={`btn-config-bloc-order-up-${root.id}`}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMoveBlock('down')}
              className="p-1 text-zinc-400 hover:text-zinc-800 disabled:opacity-20 disabled:hover:text-zinc-400 rounded transition cursor-pointer"
              title={language === 'ca' ? "Baixar bloc sencer" : "Bajar bloque entero"}
              id={`btn-config-bloc-order-down-${root.id}`}
            >
              <ArrowDown size={14} />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500 text-white shadow-xs">
                <UtensilsCrossed size={12} />
                {language === 'ca' ? `Bloc · ${totalPreguntesInBloc} preguntes` : `Bloque · ${totalPreguntesInBloc} preguntas`}
              </span>
              {!hasPrice && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  {language === 'ca' ? "Sense preu" : "Sin precio"}
                </span>
              )}
            </div>

            <input
              type="text"
              value={root.titol}
              onChange={(e) => onUpdateRootTitol(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-amber-300 focus:border-amber-500 focus:bg-white rounded px-1.5 py-1 text-sm sm:text-base font-extrabold text-zinc-900 focus:outline-none w-full"
              placeholder={language === 'ca' ? "Títol de la pregunta principal..." : "Título de la pregunta principal..."}
              title={language === 'ca' ? "Fes clic per editar el títol de la pregunta principal" : "Haz clic para editar el título de la pregunta principal"}
              id={`input-admin-bloc-titol-${root.id}`}
            />
          </div>
        </div>

        {/* Global Block Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-center font-sans text-xs font-bold">
          {/* Active / Inactive for entire block */}
          <button
            type="button"
            onClick={onToggleActiveBlock}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold ${
              isBlockActive
                ? 'bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'
            }`}
            title={language === 'ca' ? "Activa o desactiva tot el bloc" : "Activa o desactiva todo el bloque"}
            id={`btn-config-bloc-toggle-active-${root.id}`}
          >
            {isBlockActive ? (language === 'ca' ? "Bloc Actiu" : "Bloque Activo") : (language === 'ca' ? "Bloc Inactiu" : "Bloque Inactivo")}
          </button>

          {/* Required / Optional for root question */}
          <button
            type="button"
            onClick={onToggleRequeritRoot}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold ${
              root.requerit
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-zinc-150 text-zinc-400 hover:bg-zinc-200'
            }`}
            id={`btn-config-bloc-toggle-req-${root.id}`}
          >
            {root.requerit ? (language === 'ca' ? "Requerida" : "Requerida") : (language === 'ca' ? "Opcional" : "Opcional")}
          </button>

          {/* Duplicate Block */}
          <button
            type="button"
            onClick={onDuplicateBlock}
            className="p-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl transition shadow-2xs cursor-pointer flex items-center gap-1.5"
            title={language === 'ca' ? "Duplicar bloc sencer" : "Duplicar bloque entero"}
            id={`btn-config-bloc-duplicate-${root.id}`}
          >
            <Copy size={14} />
            <span className="hidden sm:inline text-[11px] font-bold">{language === 'ca' ? "Duplicar" : "Duplicar"}</span>
          </button>

          {/* Delete Block */}
          <button
            type="button"
            onClick={onDeleteBlock}
            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition shadow-2xs cursor-pointer flex items-center gap-1.5"
            title={language === 'ca' ? "Eliminar bloc sencer" : "Eliminar bloque entero"}
            id={`btn-config-bloc-delete-${root.id}`}
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline text-[11px] font-bold">{language === 'ca' ? "Eliminar" : "Eliminar"}</span>
          </button>
        </div>
      </div>

      {/* 2. Ajustes del bloque (una sola vez) */}
      <div className="bg-white/80 border border-amber-200/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-mono uppercase font-bold text-zinc-600 mb-1.5">
            {language === 'ca' ? "Àmbit del bloc (aplicat a totes les preguntes)" : "Ámbito del bloque (aplicado a todas las preguntas)"}
          </label>
          <select
            value={root.ambit || 'comparser'}
            onChange={(e) => onUpdateBlockAmbit(e.target.value as any)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
            id={`select-admin-bloc-ambit-${root.id}`}
          >
            <option value="comparser">{language === 'ca' ? "Una per cada comparser" : "Una por cada comparser"}</option>
            <option value="parella">{language === 'ca' ? "Una per parella" : "Una por pareja"}</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase font-bold text-zinc-600 mb-1.5">
            {language === 'ca' ? "Presentació (aplicada a totes les preguntes)" : "Presentación (aplicada a todas las preguntas)"}
          </label>
          <select
            value={root.presentacio || 'botons'}
            onChange={(e) => onUpdateBlockPresentacio(e.target.value as any)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
            id={`select-admin-bloc-presentacio-${root.id}`}
          >
            <option value="botons">{language === 'ca' ? "Botons" : "Botones"}</option>
            <option value="desplegable">{language === 'ca' ? "Desplegable" : "Desplegable"}</option>
          </select>
        </div>
      </div>

      {/* 3. Pregunta Principal (R) */}
      <div className="bg-white border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {language === 'ca' ? "Pregunta principal (arrel del bloc)" : "Pregunta principal (raíz del bloque)"}
          </span>
          <span className="text-[11px] font-mono text-zinc-400">
            ID: <code className="text-zinc-600">{root.id}</code>
          </span>
        </div>

        {/* Options chips */}
        <div className="space-y-2">
          <label className="block text-[10px] font-mono uppercase font-bold text-zinc-500">
            {language === 'ca' ? "Opcions de resposta" : "Opciones de respuesta"}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {rootOptions.map((opt, idx) => {
              const isEditing = editingRootOptIdx === idx;
              const isTrigger = opt === currentTriggerOption;
              return (
                <div
                  key={`${opt}-${idx}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${
                    isTrigger
                      ? 'bg-amber-100/80 border-amber-400 text-amber-950'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingRootOptVal}
                        onChange={(e) => setEditingRootOptVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRenameRootOption(idx);
                          if (e.key === 'Escape') setEditingRootOptIdx(null);
                        }}
                        autoFocus
                        className="bg-white border border-amber-400 rounded px-1.5 py-0.5 text-xs text-zinc-900 font-bold focus:outline-none w-24"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRenameRootOption(idx)}
                        className="text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        title={language === 'ca' ? "Desar nom" : "Guardar nombre"}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRootOptIdx(null)}
                        className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                        title={language === 'ca' ? "Cancel·lar" : "Cancelar"}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        onClick={() => {
                          setEditingRootOptIdx(idx);
                          setEditingRootOptVal(opt);
                        }}
                        className="cursor-pointer hover:underline"
                        title={language === 'ca' ? "Fes clic per canviar el nom" : "Haz clic para cambiar el nombre"}
                      >
                        {opt}
                      </span>
                      {isTrigger && (
                        <span className="text-[9px] bg-amber-500 text-white font-mono px-1 rounded">
                          {language === 'ca' ? "Activa" : "Activa"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveRootOption(opt)}
                        className="text-zinc-400 hover:text-red-500 ml-1 transition cursor-pointer"
                        title={language === 'ca' ? "Eliminar opció" : "Eliminar opción"}
                      >
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add option input inline */}
            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                value={newRootOpt}
                onChange={(e) => setNewRootOpt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRootOption();
                  }
                }}
                placeholder={language === 'ca' ? "+ Nova opció..." : "+ Nueva opción..."}
                className="bg-zinc-50 border border-zinc-200 focus:border-amber-400 focus:bg-white rounded-xl px-2.5 py-1 text-xs text-zinc-800 font-medium focus:outline-none w-32"
              />
              <button
                type="button"
                onClick={handleAddRootOption}
                className="p-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition cursor-pointer"
                title={language === 'ca' ? "Afegir opció" : "Añadir opción"}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Selector de la opción que activa las preguntas de la comanda */}
        <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-[11px] font-mono uppercase font-bold text-amber-900 shrink-0">
            {language === 'ca' ? "Opció que activa les preguntes següents:" : "Opción que activa las preguntas siguientes:"}
          </label>
          <select
            value={currentTriggerOption}
            onChange={(e) => onUpdateRootTriggerOption(e.target.value)}
            className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-950 focus:outline-none focus:border-amber-500 cursor-pointer"
            id={`select-admin-bloc-trigger-opt-${root.id}`}
          >
            {rootOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-zinc-500 italic">
            {language === 'ca'
              ? "(Actualitza automàticament la condició de totes les preguntes de la comanda)"
              : "(Actualiza automáticamente la condición de todas las preguntas del pedido)"}
          </span>
        </div>

        {/* Precios por opción (€) */}
        <div className="pt-2 border-t border-zinc-100 space-y-2">
          <span className="block text-[10px] font-mono uppercase font-bold text-amber-900 tracking-wider">
            {language === 'ca' ? "Preu per opció (€) de la pregunta principal" : "Precio por opción (€) de la pregunta principal"}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {rootOptions.map(opt => {
              const val = root.preus?.[opt];
              return (
                <div key={opt} className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 space-y-1">
                  <span className="block text-[11px] font-bold text-zinc-800 truncate" title={opt}>
                    {opt}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={val !== undefined ? val : ''}
                      onChange={(e) => onUpdateRootPrice(opt, e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-zinc-200 focus:border-amber-500 rounded px-2 py-0.5 text-xs font-mono font-bold text-zinc-800 focus:outline-none"
                      id={`input-admin-bloc-preu-${root.id}-${opt}`}
                    />
                    <span className="text-xs text-zinc-500 font-bold">€</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Concept labels CA / ES */}
        <div className="pt-2 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-mono uppercase font-bold text-zinc-500 mb-0.5">
              {language === 'ca' ? "Nom del concepte (CA)" : "Nombre del concepto (CA)"}
            </label>
            <input
              type="text"
              value={root.concepte || ''}
              onChange={(e) => onUpdateRootConcepte(e.target.value)}
              placeholder={language === 'ca' ? "Ex: Esmorzar" : "Ej: Almuerzo"}
              className="w-full bg-zinc-50 border border-zinc-200 focus:border-amber-500 focus:bg-white rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-800 focus:outline-none"
              id={`input-admin-bloc-concepte-ca-${root.id}`}
            />
          </div>
          <div>
            <label className="block text-[9px] font-mono uppercase font-bold text-zinc-500 mb-0.5">
              {language === 'ca' ? "Nom del concepte (ES)" : "Nombre del concepto (ES)"}
            </label>
            <input
              type="text"
              value={root.concepteES || ''}
              onChange={(e) => onUpdateRootConcepteES(e.target.value)}
              placeholder={language === 'ca' ? "Ex: Almuerzo" : "Ej: Almuerzo"}
              className="w-full bg-zinc-50 border border-zinc-200 focus:border-amber-500 focus:bg-white rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-800 focus:outline-none"
              id={`input-admin-bloc-concepte-es-${root.id}`}
            />
          </div>
        </div>
      </div>

      {/* 4. Preguntes de la comanda (Dependents) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-2">
              <Layers size={14} className="text-amber-600" />
              {language === 'ca' ? "Preguntes de la comanda" : "Preguntas del pedido"}
              <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold">
                {language === 'ca'
                  ? `només si respon «${currentTriggerOption}»`
                  : `solo si responde «${currentTriggerOption}»`}
              </span>
            </h4>
          </div>

          <button
            type="button"
            onClick={() => setShowAddChildModal(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer self-start sm:self-auto"
            id={`btn-admin-bloc-add-child-${root.id}`}
          >
            <Plus size={13} />
            {language === 'ca' ? "+ Afegir pregunta a la comanda" : "+ Añadir pregunta al pedido"}
          </button>
        </div>

        {/* Drawer / inline form for new child question */}
        {showAddChildModal && (
          <form
            onSubmit={handleCreateChildSubmit}
            className="bg-amber-50/70 border-2 border-dashed border-amber-300 rounded-2xl p-4 space-y-3 animate-fade-in"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-950 font-mono uppercase">
                {language === 'ca' ? "Nova pregunta a la comanda" : "Nueva pregunta al pedido"}
              </span>
              <button
                type="button"
                onClick={() => setShowAddChildModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-zinc-600 mb-1">
                  {language === 'ca' ? "Enunciat de la pregunta *" : "Enunciado de la pregunta *"}
                </label>
                <input
                  type="text"
                  value={newChildTitol}
                  onChange={(e) => setNewChildTitol(e.target.value)}
                  placeholder={language === 'ca' ? "Ex: Quin tipus de beguda voleu?" : "Ej: ¿Qué tipo de bebida desea?"}
                  className="w-full bg-white border border-zinc-200 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-zinc-600 mb-1">
                  {language === 'ca' ? "Opcions (Separades per comes) *" : "Opciones (Separadas por comas) *"}
                </label>
                <input
                  type="text"
                  value={newChildOptionsCsv}
                  onChange={(e) => setNewChildOptionsCsv(e.target.value)}
                  placeholder={language === 'ca' ? "Aigua, Coca-cola, Cervesa" : "Agua, Coca-cola, Cerveza"}
                  className="w-full bg-white border border-zinc-200 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddChildModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-200 cursor-pointer"
              >
                {language === 'ca' ? "Cancel·lar" : "Cancelar"}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
              >
                {language === 'ca' ? "Crear pregunta" : "Crear pregunta"}
              </button>
            </div>
          </form>
        )}

        {/* Children rows */}
        <div className="space-y-3">
          {children.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-zinc-200 rounded-2xl bg-white/60 text-zinc-400 text-xs font-medium">
              {language === 'ca'
                ? "No hi ha cap pregunta a la comanda encara. Afegiu-ne una amb el botó superior."
                : "No hay ninguna pregunta en el pedido todavía. Añada una con el botón superior."}
            </div>
          ) : (
            children.map((child, cIdx) => {
              const childOptions = child.opcions || [];
              const isChildActive = child.activa;

              return (
                <div
                  key={child.id}
                  className={`bg-white border rounded-2xl p-4 transition-all shadow-2xs space-y-3 ${
                    isChildActive ? 'border-zinc-200' : 'border-zinc-200/60 opacity-75 bg-zinc-50/50'
                  }`}
                  id={`admin-bloc-child-row-${child.id}`}
                >
                  {/* Top row: reordering within block, title, and action toggles */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 w-full sm:w-auto">
                      {/* Move up / down within block */}
                      <div className="flex flex-row sm:flex-col gap-0.5 items-center shrink-0">
                        <button
                          type="button"
                          disabled={cIdx === 0}
                          onClick={() => onMoveChild(cIdx, 'up')}
                          className="p-1 text-zinc-400 hover:text-zinc-800 disabled:opacity-20 rounded transition cursor-pointer"
                          title={language === 'ca' ? "Pujar dins del bloc" : "Subir dentro del bloque"}
                          id={`btn-admin-bloc-child-up-${child.id}`}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={cIdx === children.length - 1}
                          onClick={() => onMoveChild(cIdx, 'down')}
                          className="p-1 text-zinc-400 hover:text-zinc-800 disabled:opacity-20 rounded transition cursor-pointer"
                          title={language === 'ca' ? "Baixar dins del bloc" : "Bajar dentro del bloque"}
                          id={`btn-admin-bloc-child-down-${child.id}`}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={child.titol}
                          onChange={(e) => onUpdateChild(child.id, { titol: e.target.value })}
                          className="bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-amber-400 focus:bg-white rounded px-1.5 py-0.5 text-xs font-bold text-zinc-900 focus:outline-none w-full"
                          placeholder={language === 'ca' ? "Títol de la pregunta..." : "Título de la pregunta..."}
                          id={`input-admin-bloc-child-titol-${child.id}`}
                        />
                      </div>
                    </div>

                    {/* Action toggles: Activa, Requerida, Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-center font-sans text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => onUpdateChild(child.id, { activa: !child.activa })}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold text-[11px] ${
                          isChildActive
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-zinc-200 text-zinc-400 border border-transparent'
                        }`}
                        id={`btn-admin-bloc-child-active-${child.id}`}
                      >
                        {isChildActive ? (language === 'ca' ? "Activa" : "Activa") : (language === 'ca' ? "Inactiva" : "Inactiva")}
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateChild(child.id, { requerit: !child.requerit })}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold text-[11px] ${
                          child.requerit
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-zinc-150 text-zinc-400 border border-transparent'
                        }`}
                        id={`btn-admin-bloc-child-req-${child.id}`}
                      >
                        {child.requerit ? (language === 'ca' ? "Requerida" : "Requerida") : (language === 'ca' ? "Opcional" : "Opcional")}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteChild(child.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title={language === 'ca' ? "Eliminar pregunta de la comanda" : "Eliminar pregunta del pedido"}
                        id={`btn-admin-bloc-child-delete-${child.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Child Options chips with rename (preserving price) and add/remove */}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[10px] font-mono uppercase font-bold text-zinc-500">
                      {language === 'ca' ? "Opcions:" : "Opciones:"}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {childOptions.map((opt, oIdx) => {
                        const isEditingThis = editingChildOpt?.childId === child.id && editingChildOpt.idx === oIdx;
                        return (
                          <div
                            key={`${opt}-${oIdx}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-800 shadow-2xs"
                          >
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingChildOpt.val}
                                  onChange={(e) => setEditingChildOpt({ ...editingChildOpt, val: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRenameChildOption(child, oIdx);
                                    if (e.key === 'Escape') setEditingChildOpt(null);
                                  }}
                                  autoFocus
                                  className="bg-white border border-amber-400 rounded px-1 py-0.5 text-xs text-zinc-900 font-bold focus:outline-none w-20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRenameChildOption(child, oIdx)}
                                  className="text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingChildOpt(null)}
                                  className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span
                                  onClick={() => setEditingChildOpt({ childId: child.id, idx: oIdx, val: opt })}
                                  className="cursor-pointer hover:underline"
                                  title={language === 'ca' ? "Fes clic per canviar el nom de l'opció" : "Haz clic para cambiar el nombre de la opción"}
                                >
                                  {opt}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChildOption(child, opt)}
                                  className="text-zinc-400 hover:text-red-500 transition cursor-pointer ml-0.5"
                                  title={language === 'ca' ? "Eliminar opció" : "Eliminar opción"}
                                >
                                  <X size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {/* Add option to child */}
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          value={newChildOpt[child.id] || ''}
                          onChange={(e) => setNewChildOpt({ ...newChildOpt, [child.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddChildOption(child);
                            }
                          }}
                          placeholder={language === 'ca' ? "+ Opció..." : "+ Opción..."}
                          className="bg-zinc-50 border border-zinc-200 focus:border-amber-400 focus:bg-white rounded-lg px-2 py-0.5 text-[11px] text-zinc-800 font-medium focus:outline-none w-24"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddChildOption(child)}
                          className="p-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-md transition cursor-pointer"
                          title={language === 'ca' ? "Afegir opció" : "Añadir opción"}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Optional Prices per option for this child question */}
                  {childOptions.length > 0 && (
                    <div className="pt-2 border-t border-zinc-100/80">
                      <details className="text-[11px] group">
                        <summary className="font-mono uppercase font-bold text-zinc-500 hover:text-amber-800 cursor-pointer list-none flex items-center gap-1">
                          <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                          {language === 'ca' ? "Preus per opció (€) (Opcional)" : "Precios por opción (€) (Opcional)"}
                        </summary>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
                          {childOptions.map(opt => {
                            const val = child.preus?.[opt];
                            return (
                              <div key={opt} className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 space-y-1">
                                <span className="block text-[10px] font-bold text-zinc-700 truncate" title={opt}>
                                  {opt}
                                </span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={val !== undefined ? val : ''}
                                    onChange={(e) => {
                                      const valStr = e.target.value;
                                      const currentPreus = { ...(child.preus || {}) };
                                      if (valStr === '' || valStr === undefined) {
                                        delete currentPreus[opt];
                                      } else {
                                        const num = parseFloat(valStr);
                                        if (!isNaN(num)) currentPreus[opt] = num;
                                      }
                                      onUpdateChild(child.id, {
                                        preus: Object.keys(currentPreus).length > 0 ? currentPreus : undefined
                                      });
                                    }}
                                    placeholder="0"
                                    className="w-full bg-white border border-zinc-200 focus:border-amber-500 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-zinc-800 focus:outline-none"
                                  />
                                  <span className="text-[10px] text-zinc-500 font-bold">€</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
