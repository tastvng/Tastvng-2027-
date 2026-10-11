import { Inscripcio, PreguntaDinamica } from '../types';
import { isPreguntaVisible, answerKey, QuestionScope } from './questionVisibility';

export interface BocataExport {
  tipus: string;
  tomaquet: 'amb' | 'sense' | '';
  gluten: 'amb' | 'sense' | '';
}

export interface ParellaDesayunoExport {
  codi: string;
  c1NomCognoms: string;
  c2NomCognoms: string;
  desayunos: 0 | 1 | 2;
  bocata1: BocataExport | null;
  bocata2: BocataExport | null;
}

export interface DesayunosExportPayload {
  parelles: ParellaDesayunoExport[];
  codisConeguts: string[];
  tipusOpcions: string[];
  teTomaquet: boolean;
  teGluten: boolean;
  totals: {
    si: number;
    no: number;
    senseResposta: number;
  };
}

/**
 * Normalizes a text string by removing diacritics and converting to lowercase.
 */
function normalizeText(str: string): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Classifies an answer for a tomato question:
 * - Starts with sense/sin/no -> 'sense'
 * - Starts with amb/con/si/sí -> 'amb'
 * - Empty / no answer -> ''
 */
function classifyTomaquet(val: string): 'amb' | 'sense' | '' {
  const norm = normalizeText(val).trim();
  if (!norm) return '';
  if (/^(sense|sin|no)\b/.test(norm)) return 'sense';
  if (/^(amb|con|si)\b/.test(norm)) return 'amb';
  return '';
}

/**
 * Classifies an answer for a gluten question:
 * - Contains sense/sin -> 'sense'
 * - Contains amb/con -> 'amb'
 * - Empty / no answer -> ''
 */
function classifyGluten(val: string): 'amb' | 'sense' | '' {
  const norm = normalizeText(val).trim();
  if (!norm) return '';
  if (/sense|sin/.test(norm)) return 'sense';
  if (/amb|con/.test(norm)) return 'amb';
  return '';
}

/**
 * Pure function: Builds the structured payload for the DESAYUNOS Google Sheet tab.
 */
export function buildDesayunosExport(
  inscripcions: Inscripcio[],
  preguntes: PreguntaDinamica[]
): DesayunosExportPayload {
  // All known registration tracking codes across all inscriptions (with or without breakfast, waiting list or not)
  const codisConeguts = inscripcions
    .map(i => String(i.codiSeguiment || '').trim())
    .filter(Boolean);

  // Active questions only, sorted by ordre
  const activeQuestions = (preguntes || [])
    .filter(q => q.activa)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

  // Find root question with dependents:
  // Root Q: has dependents pointing to it.
  // Prefer one whose concepte or titol matches /esmorz|almuerz|desayun/i.
  // Otherwise, the first root question with dependents.
  const rootsWithDependents = activeQuestions.filter(rootQ =>
    activeQuestions.some(other => other.condicio?.preguntaId === rootQ.id)
  );

  let selectedRoot: PreguntaDinamica | undefined = rootsWithDependents.find(r =>
    /esmorz|almuerz|desayun/i.test(r.concepte || '') || /esmorz|almuerz|desayun/i.test(r.titol || '')
  );

  if (!selectedRoot && rootsWithDependents.length > 0) {
    selectedRoot = rootsWithDependents[0];
  }

  // If no breakfast root question exists, return empty result
  if (!selectedRoot) {
    return {
      parelles: [],
      codisConeguts,
      tipusOpcions: [],
      teTomaquet: false,
      teGluten: false,
      totals: { si: 0, no: 0, senseResposta: 0 }
    };
  }

  // Classify dependents of the selected root
  const dependents = activeQuestions.filter(q => q.condicio?.preguntaId === selectedRoot!.id);

  let tomatoDep: PreguntaDinamica | undefined;
  let glutenDep: PreguntaDinamica | undefined;
  let sandwichDep: PreguntaDinamica | undefined;

  for (const dep of dependents) {
    const normTitle = normalizeText(dep.titol);
    if (/tomaquet|tomate/.test(normTitle)) {
      tomatoDep = dep;
    } else if (/gluten/.test(normTitle)) {
      glutenDep = dep;
    } else if (!sandwichDep) {
      sandwichDep = dep;
    }
  }

  const teTomaquet = !!tomatoDep;
  const teGluten = !!glutenDep;
  const tipusOpcions = sandwichDep && sandwichDep.opcions ? [...sandwichDep.opcions] : [];

  const isComparserScope = selectedRoot.ambit === 'comparser';

  let totalSi = 0;
  let totalNo = 0;
  let totalSenseResposta = 0;

  const parelles: ParellaDesayunoExport[] = [];

  for (const ins of inscripcions) {
    const answers = ins.respostesCuestionari || {};
    const scopes: QuestionScope[] = isComparserScope ? ['c1', 'c2'] : ['parella'];

    let countSiInParelle = 0;
    let b1: BocataExport | null = null;
    let b2: BocataExport | null = null;

    for (const scope of scopes) {
      const rootKey = answerKey(selectedRoot, scope);
      const rawVal = answers[rootKey];
      const valStr = String(rawVal ?? '').trim();

      const isYes = valStr === 'Sí' || valStr === 'true' || rawVal === true;
      const isNo = valStr === 'No' || valStr === 'false' || rawVal === false;

      if (isYes) {
        totalSi++;
        countSiInParelle++;

        // Extract sandwich configuration for this person
        let tipus = '';
        let tomaquet: 'amb' | 'sense' | '' = '';
        let gluten: 'amb' | 'sense' | '' = '';

        if (sandwichDep && isPreguntaVisible(sandwichDep, answers, activeQuestions, scope)) {
          const sKey = answerKey(sandwichDep, scope);
          tipus = String(answers[sKey] ?? '').trim();
        }

        if (tomatoDep && isPreguntaVisible(tomatoDep, answers, activeQuestions, scope)) {
          const tKey = answerKey(tomatoDep, scope);
          tomaquet = classifyTomaquet(String(answers[tKey] ?? ''));
        }

        if (glutenDep && isPreguntaVisible(glutenDep, answers, activeQuestions, scope)) {
          const gKey = answerKey(glutenDep, scope);
          gluten = classifyGluten(String(answers[gKey] ?? ''));
        }

        const bocataObj: BocataExport = { tipus, tomaquet, gluten };
        if (scope === 'c1' || scope === 'parella') {
          b1 = bocataObj;
        } else if (scope === 'c2') {
          b2 = bocataObj;
        }
      } else if (isNo) {
        totalNo++;
      } else {
        totalSenseResposta++;
      }
    }

    // Exclude inscriptions on the waiting list and inscriptions without codiSeguiment from `parelles`
    // (Only send couples that have >= 1 breakfast)
    const isWaiting = !!ins.llistaEspera;
    const codi = String(ins.codiSeguiment || '').trim();

    if (!isWaiting && codi && countSiInParelle >= 1) {
      const c1NomCognoms = `${ins.c1Nom || ''} ${ins.c1Cognoms || ''}`.trim();
      const c2NomCognoms = `${ins.c2Nom || ''} ${ins.c2Cognoms || ''}`.trim();

      parelles.push({
        codi,
        c1NomCognoms,
        c2NomCognoms,
        desayunos: countSiInParelle > 2 ? 2 : (countSiInParelle as 1 | 2),
        bocata1: b1,
        bocata2: b2
      });
    }
  }

  return {
    parelles,
    codisConeguts,
    tipusOpcions,
    teTomaquet,
    teGluten,
    totals: {
      si: totalSi,
      no: totalNo,
      senseResposta: totalSenseResposta
    }
  };
}
