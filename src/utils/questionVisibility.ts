import { PreguntaDinamica } from '../types';

export type QuestionScope = 'parella' | 'c1' | 'c2';

/**
 * Returns the exact storage / lookup key for a question in a given scope.
 * - 'comparser' questions use `${q.id}__c1` and `${q.id}__c2`.
 * - 'parella' questions use `${q.id}`.
 */
export function answerKey(
  q: PreguntaDinamica | { id: string; ambit?: 'parella' | 'comparser' },
  scope?: QuestionScope
): string {
  const isComparser = q.ambit === 'comparser';
  if (isComparser && (scope === 'c1' || scope === 'c2')) {
    return `${q.id}__${scope}`;
  }
  return q.id;
}

/**
 * Parses an answer key back into its question ID and scope.
 */
export function parseScopeAndQuestionId(key: string): { questionId: string; scope: QuestionScope } {
  if (key.endsWith('__c1')) {
    return { questionId: key.slice(0, -4), scope: 'c1' };
  }
  if (key.endsWith('__c2')) {
    return { questionId: key.slice(0, -4), scope: 'c2' };
  }
  return { questionId: key, scope: 'parella' };
}

/**
 * Determines whether a condition is orphan (parent question deleted,
 * or parent question lost the configured option).
 */
export function isOrphanCondition(
  q: PreguntaDinamica,
  allQuestions: PreguntaDinamica[]
): boolean {
  if (!q.condicio || !q.condicio.preguntaId) return false;
  const parent = allQuestions.find(x => x.id === q.condicio!.preguntaId);
  if (!parent) return true;

  if (parent.tipus === 'select') {
    const parentOpts = parent.opcions || [];
    if (!parentOpts.includes(q.condicio.valor)) {
      return true;
    }
  } else if (parent.tipus === 'boolean') {
    if (q.condicio.valor !== 'Sí' && q.condicio.valor !== 'No') {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether setting parentId as parent of childId would create a cycle.
 */
export function hasConditionCycle(
  childId: string,
  candidateParentId: string,
  allQuestions: PreguntaDinamica[]
): boolean {
  if (childId === candidateParentId) return true;

  let currentId: string | null = candidateParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === childId) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const parent = allQuestions.find(x => x.id === currentId);
    currentId = parent?.condicio?.preguntaId || null;
  }

  return false;
}

/**
 * Validates if the entire questions list contains any circular dependency.
 */
export function detectAnyConditionCycle(allQuestions: PreguntaDinamica[]): boolean {
  for (const q of allQuestions) {
    if (q.condicio?.preguntaId) {
      if (hasConditionCycle(q.id, q.condicio.preguntaId, allQuestions)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Pure function: Determines if a dynamic question is visible given the current answers.
 * - If no condition is set: true.
 * - If condition is orphan: treated as always visible so data is not hidden silently.
 * - If parent question itself is not visible: false.
 * - If parent answer matches condition valor: true, else false.
 */
export function isPreguntaVisible(
  q: PreguntaDinamica,
  answers: Record<string, any>,
  allQuestions: PreguntaDinamica[],
  scope?: QuestionScope,
  visited = new Set<string>()
): boolean {
  if (!q.condicio || !q.condicio.preguntaId) {
    return true;
  }

  // Prevent infinite recursion in case of malformed data
  if (visited.has(q.id)) {
    return true;
  }
  visited.add(q.id);

  const parent = allQuestions.find(x => x.id === q.condicio!.preguntaId);
  // Orphan condition: parent was deleted -> treat as visible
  if (!parent) {
    return true;
  }

  // Orphan condition: parent lost the option -> treat as visible
  if (parent.tipus === 'select' && parent.opcions && !parent.opcions.includes(q.condicio.valor)) {
    return true;
  }

  // Determine scope for the parent question:
  // If parent is comparser, check against the same participant's answer.
  // If parent is parella, check against couple's answer.
  const parentScope: QuestionScope = parent.ambit === 'comparser'
    ? (scope === 'c1' || scope === 'c2' ? scope : 'c1')
    : 'parella';

  // Parent must be visible first
  if (!isPreguntaVisible(parent, answers, allQuestions, parentScope, visited)) {
    return false;
  }

  const parentKey = answerKey(parent, parentScope);
  const parentAns = answers[parentKey];

  // Compare parent answer
  if (parent.tipus === 'boolean') {
    const isYes = parentAns === true || parentAns === 'true' || parentAns === 'Sí';
    const isNo = parentAns === false || parentAns === 'false' || parentAns === 'No';
    if (q.condicio.valor === 'Sí') return isYes;
    if (q.condicio.valor === 'No') return isNo;
    return false;
  }

  const expectedStr = String(q.condicio.valor || '').trim();
  const actualStr = String(parentAns ?? '').trim();

  return expectedStr === actualStr && expectedStr !== '';
}

/**
 * Cleans up orphan / descendant answers when a parent question's answer changes or is cleared.
 */
export function cleanupDescendantsOnAnswerChange(
  currentAnswers: Record<string, any>,
  changedQuestionId: string,
  allQuestions: PreguntaDinamica[],
  scope?: QuestionScope
): Record<string, any> {
  const updated = { ...currentAnswers };

  // Recursively find and clear any question whose visibility condition is no longer met
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of allQuestions) {
      if (!q.condicio?.preguntaId) continue;

      const scopesToCheck: QuestionScope[] = q.ambit === 'comparser' ? ['c1', 'c2'] : ['parella'];
      for (const s of scopesToCheck) {
        if (scope && scope !== 'parella' && q.ambit === 'comparser' && s !== scope) {
          continue;
        }

        const visible = isPreguntaVisible(q, updated, allQuestions, s);
        const k = answerKey(q, s);
        if (!visible && updated[k] !== undefined && updated[k] !== '' && updated[k] !== false) {
          delete updated[k];
          changed = true;
        }
      }
    }
  }

  return updated;
}

/**
 * Returns only answers of active and visible questions.
 * Preserves legacy non-question keys (clavells_qty, corbati_qty, etc.)
 */
export function visibleAnswers(
  answers: Record<string, any>,
  allQuestions: PreguntaDinamica[]
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  // 1. Keep legacy / special keys
  for (const [k, v] of Object.entries(answers)) {
    if (k.startsWith('_')) continue;
    if (k === 'clavells_qty' || k === 'corbati_qty' || k.startsWith('extra_qty_')) {
      if (v !== undefined && v !== null && v !== '') {
        result[k] = v;
      }
    }
  }

  // 2. Add only active & visible questions
  for (const q of allQuestions) {
    if (!q.activa) continue;

    if (q.ambit === 'comparser') {
      for (const s of ['c1', 'c2'] as const) {
        if (isPreguntaVisible(q, answers, allQuestions, s)) {
          const k = answerKey(q, s);
          const v = answers[k];
          if (v !== undefined && v !== null && v !== '') {
            result[k] = v;
          }
        }
      }
    } else {
      if (isPreguntaVisible(q, answers, allQuestions, 'parella')) {
        const k = answerKey(q, 'parella');
        const v = answers[k];
        if (v !== undefined && v !== null && v !== '') {
          result[k] = v;
        }
      }
    }
  }

  return result;
}
