import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, UtensilsCrossed, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Inscripcio, SistemaConfig, PreguntaDinamica } from '../types';
import { useLanguage } from '../LanguageContext';
import { cargarPreguntes } from '../api/questionnaireApi';
import { isPreguntaVisible, answerKey, QuestionScope } from '../utils/questionVisibility';
import { calculateInscriptionOrderBreakdown } from '../utils/orderCalculations';
import TranslatedText from './TranslatedText';

interface ResumEsmorzarsModalProps {
  isOpen: boolean;
  onClose: () => void;
  inscripcions: Inscripcio[];
  config?: SistemaConfig;
}

interface ComboRow {
  comboText: string;
  count: number;
  unitPrice: number;
  subtotal: number;
}

interface QuestionStats {
  question: PreguntaDinamica;
  optionCounts: Record<string, number>;
  totalAnswered: number;
  noResponseCount: number;
}

export const ResumEsmorzarsModal: React.FC<ResumEsmorzarsModalProps> = ({
  isOpen,
  onClose,
  inscripcions,
  config
}) => {
  const { language } = useLanguage();
  const [preguntes, setPreguntes] = useState<PreguntaDinamica[]>(config?.preguntesFormulari || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);

    cargarPreguntes(false).then(data => {
      if (!isMounted) return;
      if (data && data.length > 0) {
        setPreguntes(data);
      } else if (config?.preguntesFormulari && config.preguntesFormulari.length > 0) {
        setPreguntes(config.preguntesFormulari);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading questions for ResumEsmorzarsModal:", err);
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [isOpen, config]);

  const activeQuestions = useMemo(() => {
    return preguntes.filter(q => q.activa).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }, [preguntes]);

  // Root questions with dependents (e.g. "Voleu esmorzar?")
  const rootQuestionsWithDependents = useMemo(() => {
    return activeQuestions.filter(rootQ => {
      return activeQuestions.some(other => other.condicio?.preguntaId === rootQ.id);
    });
  }, [activeQuestions]);

  // Combinations per root question
  const combinationsData = useMemo(() => {
    const results: Record<string, {
      rootQ: PreguntaDinamica;
      dependents: PreguntaDinamica[];
      combos: ComboRow[];
      totalSi: number;
      totalNo: number;
      totalSenseResposta: number;
    }> = {};

    for (const rootQ of rootQuestionsWithDependents) {
      const dependents = activeQuestions.filter(q => q.condicio?.preguntaId === rootQ.id);

      let totalSi = 0;
      let totalNo = 0;
      let totalSenseResposta = 0;
      const comboCounts = new Map<string, { count: number; unitPrice: number }>();

      for (const ins of inscripcions) {
        const answers = ins.respostesCuestionari || {};
        const scopes: QuestionScope[] = rootQ.ambit === 'comparser' ? ['c1', 'c2'] : ['parella'];

        for (const scope of scopes) {
          const rootKey = answerKey(rootQ, scope);
          const rawVal = answers[rootKey];
          const valStr = String(rawVal ?? '').trim();

          const isYes = valStr === 'Sí' || valStr === 'true' || rawVal === true;
          const isNo = valStr === 'No' || valStr === 'false' || rawVal === false;

          if (isYes) {
            totalSi++;

            // Collect answers of dependent questions
            const parts: string[] = [];
            let personPrice = 0;

            // Add root price if option 'Sí' has price
            if (rootQ.preus && typeof rootQ.preus['Sí'] === 'number') {
              personPrice += rootQ.preus['Sí'];
            }

            for (const dep of dependents) {
              if (isPreguntaVisible(dep, answers, activeQuestions, scope)) {
                const depKey = answerKey(dep, scope);
                const depAns = String(answers[depKey] ?? '').trim();
                const displayAns = depAns || (language === 'ca' ? '(sense resposta)' : '(sin respuesta)');
                parts.push(displayAns);

                // Add dependent option price if any
                if (dep.preus && typeof dep.preus[depAns] === 'number') {
                  personPrice += dep.preus[depAns];
                }
              }
            }

            const comboKey = parts.length > 0 ? parts.join(' · ') : (language === 'ca' ? 'Esmorzar estàndard' : 'Almuerzo estándar');
            const existing = comboCounts.get(comboKey) || { count: 0, unitPrice: personPrice };
            existing.count++;
            existing.unitPrice = personPrice;
            comboCounts.set(comboKey, existing);
          } else if (isNo) {
            totalNo++;
          } else {
            totalSenseResposta++;
          }
        }
      }

      const combos: ComboRow[] = Array.from(comboCounts.entries())
        .map(([comboText, data]) => ({
          comboText,
          count: data.count,
          unitPrice: data.unitPrice,
          subtotal: Math.round(data.count * data.unitPrice * 100) / 100
        }))
        .sort((a, b) => b.count - a.count);

      results[rootQ.id] = {
        rootQ,
        dependents,
        combos,
        totalSi,
        totalNo,
        totalSenseResposta
      };
    }

    return results;
  }, [rootQuestionsWithDependents, activeQuestions, inscripcions, language]);

  // Overall question option statistics
  const questionStatsList: QuestionStats[] = useMemo(() => {
    return activeQuestions
      .filter(q => q.tipus === 'select' || q.tipus === 'boolean')
      .map(q => {
        const optionCounts: Record<string, number> = {};
        const options = q.tipus === 'boolean' ? ['Sí', 'No'] : (q.opcions || []);
        options.forEach(opt => { optionCounts[opt] = 0; });

        let totalAnswered = 0;
        let noResponseCount = 0;

        for (const ins of inscripcions) {
          const answers = ins.respostesCuestionari || {};
          const scopes: QuestionScope[] = q.ambit === 'comparser' ? ['c1', 'c2'] : ['parella'];

          for (const scope of scopes) {
            if (!isPreguntaVisible(q, answers, activeQuestions, scope)) {
              continue;
            }

            const k = answerKey(q, scope);
            const val = answers[k];

            if (val === undefined || val === null || val === '') {
              noResponseCount++;
              continue;
            }

            if (q.tipus === 'boolean') {
              const str = (val === true || val === 'true' || val === 'Sí') ? 'Sí' : 'No';
              optionCounts[str] = (optionCounts[str] || 0) + 1;
              totalAnswered++;
            } else {
              const strVal = String(val).trim();
              if (options.includes(strVal)) {
                optionCounts[strVal] = (optionCounts[strVal] || 0) + 1;
                totalAnswered++;
              } else {
                noResponseCount++;
              }
            }
          }
        }

        return {
          question: q,
          optionCounts,
          totalAnswered,
          noResponseCount
        };
      });
  }, [activeQuestions, inscripcions]);

  // Grand total breakfast money across all registrations
  const grandTotalBreakfastMoney = useMemo(() => {
    let sum = 0;
    for (const ins of inscripcions) {
      const breakdown = calculateInscriptionOrderBreakdown(ins, config, language);
      const items = breakdown.materials.filter(m => 
        m.modalitat === 'Esmorzar' || 
        /esmorz|almuerz|desayun/i.test(m.nom) || 
        /esmorz|almuerz|desayun/i.test(m.id)
      );
      sum += items.reduce((acc, m) => acc + (m.subtotal || 0), 0);
    }
    return Math.round(sum * 100) / 100;
  }, [inscripcions, config, language]);

  // Export CSV handler
  const handleExportCSV = () => {
    const lines: string[] = [];
    const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

    lines.push(escapeCsv(language === 'ca' ? "RESUM D'ESMORZARS I PREGUNTES DINÀMIQUES - EL TAST" : "RESUMEN DE ALMUERZOS Y PREGUNTAS DINÁMICAS - EL TAST"));
    lines.push(escapeCsv(language === 'ca' ? `Data: ${new Date().toLocaleDateString()}` : `Fecha: ${new Date().toLocaleDateString()}`));
    lines.push("");

    // Section 1: Combinations
    for (const rootQId of Object.keys(combinationsData)) {
      const data = combinationsData[rootQId];
      lines.push(escapeCsv(language === 'ca' ? `COMBINACIONS PER A: ${data.rootQ.titol}` : `COMBINACIONES PARA: ${data.rootQ.titol}`));
      lines.push([
        escapeCsv(language === 'ca' ? "Combinació d'entrepà / opcions" : "Combinación de bocadillo / opciones"),
        escapeCsv(language === 'ca' ? "Recompte (Persones)" : "Recuento (Personas)"),
        escapeCsv(language === 'ca' ? "Preu Unitari (€)" : "Precio Unitario (€)"),
        escapeCsv(language === 'ca' ? "Subtotal (€)" : "Subtotal (€)")
      ].join(","));

      for (const c of data.combos) {
        lines.push([
          escapeCsv(c.comboText),
          escapeCsv(c.count),
          escapeCsv(c.unitPrice.toFixed(2)),
          escapeCsv(c.subtotal.toFixed(2))
        ].join(","));
      }

      lines.push([
        escapeCsv(language === 'ca' ? "TOTAL PERSONES QUE VOLEN ESMORZAR (SÍ)" : "TOTAL PERSONAS QUE QUIEREN ALMUERZO (SÍ)"),
        escapeCsv(data.totalSi),
        "",
        escapeCsv(grandTotalBreakfastMoney.toFixed(2))
      ].join(","));
      lines.push([
        escapeCsv(language === 'ca' ? "Total que NO volen esmorzar" : "Total que NO quieren almuerzo"),
        escapeCsv(data.totalNo),
        "",
        ""
      ].join(","));
      lines.push([
        escapeCsv(language === 'ca' ? "Sense resposta" : "Sin respuesta"),
        escapeCsv(data.totalSenseResposta),
        "",
        ""
      ].join(","));
      lines.push("");
    }

    // Section 2: Option Totals
    lines.push(escapeCsv(language === 'ca' ? "TOTALS PER PREGUNTA I OPCIÓ" : "TOTALES POR PREGUNTA Y OPCIÓN"));
    lines.push([
      escapeCsv(language === 'ca' ? "Pregunta" : "Pregunta"),
      escapeCsv(language === 'ca' ? "Àmbit" : "Ámbito"),
      escapeCsv(language === 'ca' ? "Opció" : "Opción"),
      escapeCsv(language === 'ca' ? "Recompte" : "Recuento")
    ].join(","));

    for (const stat of questionStatsList) {
      for (const [opt, count] of Object.entries(stat.optionCounts)) {
        lines.push([
          escapeCsv(stat.question.titol),
          escapeCsv(stat.question.ambit === 'comparser' ? (language === 'ca' ? 'Comparser' : 'Comparser') : (language === 'ca' ? 'Parella' : 'Pareja')),
          escapeCsv(opt),
          escapeCsv(count)
        ].join(","));
      }
      if (stat.noResponseCount > 0) {
        lines.push([
          escapeCsv(stat.question.titol),
          escapeCsv(stat.question.ambit === 'comparser' ? 'Comparser' : 'Parella'),
          escapeCsv(language === 'ca' ? 'Sense resposta' : 'Sin respuesta'),
          escapeCsv(stat.noResponseCount)
        ].join(","));
      }
    }

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `resum_esmorzars_eltast_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" id="modal-resum-esmorzars">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <UtensilsCrossed size={22} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">
                {language === 'ca' ? "Resum d'Esmorzars i Respostes" : "Resumen de Almuerzos y Respuestas"}
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                {language === 'ca' ? "Comptabilitat per fer la comanda d'entrepans a Secretaria" : "Contabilidad para encargar los bocadillos en Secretaría"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              id="btn-export-csv-esmorzars"
            >
              <Download size={14} />
              {language === 'ca' ? "Exportar CSV" : "Exportar CSV"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl transition hover:bg-zinc-800 cursor-pointer"
              id="btn-tancar-modal-esmorzars"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-zinc-400 text-xs font-mono">
              {language === 'ca' ? "Carregant configuració i respostes..." : "Cargando configuración y respuestas..."}
            </div>
          ) : (
            <>
              {/* Grand Total Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold text-amber-800 block">
                    {language === 'ca' ? "Import Total Esmorzar" : "Importe Total Almuerzo"}
                  </span>
                  <p className="text-2xl font-black text-amber-900 mt-1 font-mono">
                    {grandTotalBreakfastMoney.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                </div>
                {rootQuestionsWithDependents.map(rootQ => {
                  const data = combinationsData[rootQ.id];
                  if (!data) return null;
                  return (
                    <React.Fragment key={rootQ.id}>
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                        <span className="text-[10px] uppercase font-mono font-bold text-green-800 block">
                          {language === 'ca' ? "Volen esmorzar (Sí)" : "Quieren almuerzo (Sí)"}
                        </span>
                        <p className="text-2xl font-black text-green-900 mt-1 font-mono">
                          {data.totalSi} <span className="text-xs font-sans font-bold text-green-700">{language === 'ca' ? "persones" : "personas"}</span>
                        </p>
                      </div>
                      <div className="bg-zinc-100 border border-zinc-200 rounded-2xl p-4">
                        <span className="text-[10px] uppercase font-mono font-bold text-zinc-600 block">
                          {language === 'ca' ? "No volen esmorzar (No)" : "No quieren almuerzo (No)"}
                        </span>
                        <p className="text-2xl font-black text-zinc-800 mt-1 font-mono">
                          {data.totalNo} <span className="text-xs font-sans font-bold text-zinc-500">{language === 'ca' ? "persones" : "personas"}</span>
                        </p>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Combinations Table */}
              {Object.keys(combinationsData).map(rootQId => {
                const data = combinationsData[rootQId];
                return (
                  <div key={rootQId} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs space-y-3 p-5">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div>
                        <h3 className="font-sans font-black text-sm text-zinc-900 uppercase">
                          {data.rootQ.titol} — {language === 'ca' ? "Combinacions de comanda" : "Combinaciones de pedido"}
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                          {language === 'ca'
                            ? "Recompte exacte d'entrepans per ingredients i complements sol·licitats."
                            : "Recuento exacto de bocadillos por ingredientes y complementos solicitados."}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
                        {data.combos.length} {language === 'ca' ? "variants" : "variantes"}
                      </span>
                    </div>

                    {data.combos.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic py-4 text-center">
                        {language === 'ca' ? "Encara no hi ha comandes d'esmorzar registrades." : "Aún no hay pedidos de almuerzo registrados."}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-zinc-50 text-[10px] uppercase font-mono font-bold text-zinc-500 border-b border-zinc-200">
                            <tr>
                              <th className="py-2.5 px-3">{language === 'ca' ? "Combinació d'entrepà / Opcions" : "Combinación de bocadillo / Opciones"}</th>
                              <th className="py-2.5 px-3 text-center">{language === 'ca' ? "Quantitat" : "Cantidad"}</th>
                              <th className="py-2.5 px-3 text-right">{language === 'ca' ? "Preu unitari" : "Precio unitario"}</th>
                              <th className="py-2.5 px-3 text-right">{language === 'ca' ? "Subtotal" : "Subtotal"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {data.combos.map((c, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50/60">
                                <td className="py-2.5 px-3 font-semibold text-zinc-800">
                                  {c.comboText}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-amber-600 text-sm">
                                  {c.count}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                                  {c.unitPrice.toFixed(2)} €
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                                  {c.subtotal.toFixed(2)} €
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold">
                            <tr>
                              <td className="py-2.5 px-3 uppercase text-[11px] text-zinc-800">
                                {language === 'ca' ? "TOTAL ENTREPANS" : "TOTAL BOCADILLOS"}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-base font-black text-amber-700">
                                {data.totalSi}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-zinc-500 text-[11px]">
                                —
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-base font-black text-amber-700">
                                {grandTotalBreakfastMoney.toFixed(2)} €
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Totals per option for every active question */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                <div className="border-b border-zinc-100 pb-3">
                  <h3 className="font-sans font-black text-sm text-zinc-900 uppercase">
                    {language === 'ca' ? "Totals per opció de cada pregunta activa" : "Totales por opción de cada pregunta activa"}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    {language === 'ca' ? "Distribució de respostes de tot el qüestionari." : "Distribución de respuestas de todo el cuestionario."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questionStatsList.map(stat => (
                    <div key={stat.question.id} className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-zinc-800 leading-tight">
                          <TranslatedText text={stat.question.titol} />
                        </span>
                        <span className="text-[9px] font-mono uppercase bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-bold shrink-0">
                          {stat.question.ambit === 'comparser' ? 'Comparser' : 'Parella'}
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {Object.entries(stat.optionCounts).map(([opt, count]) => (
                          <div key={opt} className="flex justify-between items-center text-xs">
                            <span className="text-zinc-600 font-medium">
                              <TranslatedText text={opt} />:
                            </span>
                            <span className="font-mono font-bold text-zinc-900 bg-white border border-zinc-200 px-2 py-0.5 rounded-md">
                              {count}
                            </span>
                          </div>
                        ))}
                        {stat.noResponseCount > 0 && (
                          <div className="flex justify-between items-center text-xs text-zinc-400 italic">
                            <span>{language === 'ca' ? "Sense resposta / no visible:" : "Sin respuesta / no visible:"}</span>
                            <span className="font-mono text-zinc-500">{stat.noResponseCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
