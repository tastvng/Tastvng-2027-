import React from 'react';
import { Check } from 'lucide-react';
import { PreguntaDinamica } from '../types';
import { useLanguage } from '../LanguageContext';
import TranslatedText from './TranslatedText';
import { 
  answerKey, 
  isPreguntaVisible, 
  QuestionScope 
} from '../utils/questionVisibility';

export interface DynamicQuestionsSectionProps {
  preguntesList: PreguntaDinamica[];
  respostesCuestionari: Record<string, string | boolean>;
  onAnswerChange: (qId: string, val: string | boolean, scope: QuestionScope) => void;
  errors: Record<string, string>;
  c1Nom: string;
  c1Cognoms: string;
  c2Nom: string;
  c2Cognoms: string;
  titolFormulariDinamic?: string;
  cuestionariActiu?: boolean;
}

export const DynamicQuestionsSection: React.FC<DynamicQuestionsSectionProps> = ({
  preguntesList,
  respostesCuestionari,
  onAnswerChange,
  errors,
  c1Nom,
  c1Cognoms,
  c2Nom,
  c2Cognoms,
  titolFormulariDinamic,
  cuestionariActiu = true
}) => {
  const { language } = useLanguage();

  if (cuestionariActiu === false || !preguntesList || preguntesList.filter(q => q.activa).length === 0) {
    return null;
  }

  const activeQuestions = preguntesList.filter(q => q.activa);
  const parellaQuestions = activeQuestions.filter(q => q.ambit !== 'comparser');
  const comparserQuestions = activeQuestions.filter(q => q.ambit === 'comparser');

  const renderSingleQuestion = (q: PreguntaDinamica, scope: QuestionScope) => {
    if (!isPreguntaVisible(q, respostesCuestionari, preguntesList, scope)) {
      return null;
    }

    const k = answerKey(q, scope);
    const isErr = !!errors[`question_${k}`];
    const currentVal = respostesCuestionari[k];

    return (
      <div key={k} className="space-y-1.5" id={`camp-pregunta-${k}`}>
        <label className="block text-xs font-bold text-zinc-700 tracking-tight">
          <TranslatedText text={q.titol} /> {q.requerit && '*'}
        </label>
        {q.descripcio && (
          <p className="text-[11px] text-zinc-400 italic">
            <TranslatedText text={q.descripcio} />
          </p>
        )}

        {q.tipus === 'text' && (
          <input 
            type="text"
            id={`input-pregunta-${k}`}
            value={String(currentVal || '')}
            onChange={(e) => onAnswerChange(q.id, e.target.value, scope)}
            className={`w-full bg-zinc-50 border ${isErr ? 'border-red-400 focus:border-red-500 bg-red-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none transition-all`}
            placeholder={language === 'ca' ? "La vostra resposta..." : "Su respuesta..."}
          />
        )}

        {q.tipus === 'boolean' && (
          <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${currentVal ? 'bg-fuchsia-50 border-fuchsia-500 text-fuchsia-600 font-bold' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
            <input
              type="checkbox"
              id={`input-pregunta-${k}`}
              checked={!!currentVal}
              onChange={(e) => onAnswerChange(q.id, e.target.checked, scope)}
              className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
            />
            <span className="text-xs font-semibold leading-normal select-none">
              {language === 'ca' ? 'Sí, confirmo aquesta opció.' : 'Sí, confirmo esta opción.'}
            </span>
          </label>
        )}

        {q.tipus === 'select' && q.presentacio === 'botons' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {(q.opcions || []).map((opt) => {
              const isSelected = String(currentVal ?? '') === opt;
              const price = q.preus?.[opt];
              const hasPrice = typeof price === 'number' && !isNaN(price) && price > 0;
              const priceStr = hasPrice ? ` (+${price.toFixed(2).replace('.', ',')} €)` : '';

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onAnswerChange(q.id, opt, scope)}
                  className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-fuchsia-50 border-fuchsia-500 text-fuchsia-600 ring-2 ring-fuchsia-500/30 font-bold shadow-xs'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected && <Check size={16} className="text-fuchsia-600 shrink-0" />}
                    <span className="text-xs font-semibold leading-tight">
                      <TranslatedText text={opt} />
                    </span>
                  </div>
                  {hasPrice && (
                    <span className={`text-[11px] font-mono font-bold shrink-0 ${isSelected ? 'text-fuchsia-600' : 'text-zinc-400'}`}>
                      {priceStr}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {q.tipus === 'select' && q.presentacio !== 'botons' && (
          <select
            id={`input-pregunta-${k}`}
            value={String(currentVal || '')}
            onChange={(e) => onAnswerChange(q.id, e.target.value, scope)}
            className={`w-full bg-zinc-50 border ${isErr ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-fuchsia-500'} rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none cursor-pointer`}
          >
            <option value="">{language === 'ca' ? '-- Seleccioneu una opció --' : '-- Seleccione una opción --'}</option>
            {(q.opcions || []).map((opt) => {
              const price = q.preus?.[opt];
              const hasPrice = typeof price === 'number' && !isNaN(price) && price > 0;
              const priceStr = hasPrice ? ` (+${price.toFixed(2).replace('.', ',')} €)` : '';
              return (
                <option key={opt} value={opt}>
                  {opt}{priceStr}
                </option>
              );
            })}
          </select>
        )}

        {isErr && (
          <p className="text-[10px] text-red-500 font-bold">{errors[`question_${k}`]}</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-md space-y-6" id="cuestionari-preguntes-seccio">
      <div className="border-b border-zinc-100 pb-4">
        <h3 className="font-sans font-black text-zinc-900 text-lg tracking-tight uppercase">
          <TranslatedText text={titolFormulariDinamic || (language === 'ca' ? 'Preguntes Addicionals' : 'Preguntas Adicionales')} />
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          {language === 'ca' ? 'Si us plau, responeu a les següents preguntes requerides per l\'entitat.' : 'Por favor, responda a las siguientes preguntas requeridas por la entidad.'}
        </p>
      </div>

      {/* Questions per parella */}
      {parellaQuestions.length > 0 && (
        <div className="space-y-4">
          {parellaQuestions.map(q => renderSingleQuestion(q, 'parella'))}
        </div>
      )}

      {/* Questions per comparser */}
      {comparserQuestions.length > 0 && (
        <div className="space-y-6 pt-2">
          {/* Comparser 1 block */}
          <div className="border border-zinc-200 rounded-2xl p-5 space-y-4">
            <div className="border-b border-zinc-200/60 pb-2">
              <h4 className="font-sans font-black text-xs text-zinc-800 uppercase tracking-wider">
                {language === 'ca' ? 'Comparser 1' : 'Comparser 1'} — {c1Nom.trim() ? `${c1Nom} ${c1Cognoms}`.trim() : (language === 'ca' ? 'Participant 1' : 'Participante 1')}
              </h4>
            </div>
            <div className="space-y-4">
              {comparserQuestions.map(q => renderSingleQuestion(q, 'c1'))}
            </div>
          </div>

          {/* Comparser 2 block */}
          <div className="border border-zinc-200 rounded-2xl p-5 space-y-4">
            <div className="border-b border-zinc-200/60 pb-2">
              <h4 className="font-sans font-black text-xs text-zinc-800 uppercase tracking-wider">
                {language === 'ca' ? 'Comparser 2' : 'Comparser 2'} — {c2Nom.trim() ? `${c2Nom} ${c2Cognoms}`.trim() : (language === 'ca' ? 'Participant 2' : 'Participante 2')}
              </h4>
            </div>
            <div className="space-y-4">
              {comparserQuestions.map(q => renderSingleQuestion(q, 'c2'))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
