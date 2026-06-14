/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  TrendingUp
} from 'lucide-react';
import { SistemaConfig, PreguntaDinamica } from '../types';

interface AdminConfigProps {
  config: SistemaConfig;
  onBack: () => void;
  onSave: (updatedConfig: SistemaConfig) => void;
}

export default function AdminConfig({ config, onBack, onSave }: AdminConfigProps) {
  // Config parameters state
  const [preuAdult, setPreuAdult] = useState(config.preuAdult);
  const [preuJuvenil, setPreuJuvenil] = useState(config.preuJuvenil);
  const [preuDomasBalco, setPreuDomasBalco] = useState(config.preuDomasBalco);
  const [preuMocadorExtra, setPreuMocadorExtra] = useState(config.preuMocadorExtra);

  // Questionnaire questions state
  const [preguntes, setPreguntes] = useState<PreguntaDinamica[]>(config.preguntesFormulari);
  
  // Create novel question states
  const [newTitol, setNewTitol] = useState('');
  const [newTipus, setNewTipus] = useState<'text' | 'select' | 'boolean'>('text');
  const [newOpcionsCsv, setNewOpcionsCsv] = useState('');

  const [notifSuccess, setNotifSuccess] = useState(false);

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

  const handleGuardarConfig = () => {
    const updated: SistemaConfig = {
      preuAdult: Number(preuAdult),
      preuJuvenil: Number(preuJuvenil),
      preuDomasBalco: Number(preuDomasBalco),
      preuMocadorExtra: Number(preuMocadorExtra),
      preguntesFormulari: preguntes
    };

    onSave(updated);
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
          className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          id="btn-nav-config-back"
        >
          <ArrowLeft size={14} /> Tornar al taulell
        </button>

        <h2 className="font-sans font-extrabold text-base tracking-tight text-white flex items-center gap-2">
          Personalitza Canons i Cüestionaris
        </h2>

        <button 
          onClick={handleGuardarConfig}
          className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow animate-pulse"
          id="btn-nav-config-save"
        >
          {notifSuccess ? "S'ha guardat!" : "Guardar Ajustos"} <Save size={14} />
        </button>
      </div>

      {notifSuccess && (
        <div className="bg-green-150 border border-green-200 text-green-800 p-4 rounded-2xl font-bold flex items-center gap-2">
          <CheckCircle size={20} className="text-green-600 animate-bounce" />
          <span>Configuració del sistema i condicions del qüestionari actualitzades amb èxit!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Prices configurations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            <h3 className="font-sans font-black text-sm text-zinc-900 pb-3 border-b border-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Coins size={16} className="text-fuchsia-500" /> Tarifes i Cànons 2026
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Preu Parella Adulta (€) *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={preuAdult} 
                    onChange={(e) => setPreuAdult(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
                    id="input-config-price-adult"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-xs text-zinc-400 font-bold">EUR</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Preu Parella Juvenil (€) *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={preuJuvenil} 
                    onChange={(e) => setPreuJuvenil(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
                    id="input-config-price-juvenile"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-xs text-zinc-400 font-bold">EUR</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Cànon Domàs de Balcó (€) *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={preuDomasBalco} 
                    onChange={(e) => setPreuDomasBalco(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
                    id="input-config-price-domas"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-xs text-zinc-400 font-bold">EUR</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1">Cànon Mocador Extra (€) *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={preuMocadorExtra} 
                    onChange={(e) => setPreuMocadorExtra(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono"
                    id="input-config-price-mocador"
                  />
                  <span className="absolute inset-y-0 right-4 flex items-center text-xs text-zinc-400 font-bold">EUR</span>
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
        </div>

        {/* Right columns: Questionnaire form builder */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            <h3 className="font-sans font-black text-sm text-zinc-900 pb-3 border-b border-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <LayoutList size={16} className="text-fuchsia-500" /> Editor de Camps del Formulari Dinàmic
            </h3>

            {/* List existing fields with actions toggles */}
            <div className="space-y-3.5">
              {preguntes.map((preg) => (
                <div key={preg.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-xs text-zinc-900">{preg.titol}</p>
                    <div className="flex gap-2 items-center text-[10px] text-zinc-400 font-mono uppercase">
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
        </div>
      </div>
    </div>
  );
}
