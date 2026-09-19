/**
 * Server-side Unified Registration Code Allocator
 * 
 * Formats:
 * - Adults: A0001, A0002, A0003... (Prefix 'A', 4 digits)
 * - Juveniles: J0001, J0002, J0003... (Prefix 'J', 4 digits)
 * - Waitlist (Lista de espera): LE00001, LE00002, LE00003... (Prefix 'LE', 5 digits)
 */

export type CodeGroup = 'ADULT' | 'JUVENIL' | 'ESPERA';

export function determineCodeGroup(
  categoria: string | undefined | null,
  isWaitlist: boolean
): CodeGroup {
  if (isWaitlist) {
    return 'ESPERA';
  }
  const cat = String(categoria || 'ADULT').trim().toUpperCase();
  if (cat === 'JUVENIL') {
    return 'JUVENIL';
  }
  return 'ADULT';
}

export function formatCode(group: CodeGroup, seq: number): string {
  const safeSeq = Math.max(1, Math.floor(seq));
  if (group === 'ESPERA') {
    return `LE${String(safeSeq).padStart(5, '0')}`;
  }
  if (group === 'JUVENIL') {
    return `J${String(safeSeq).padStart(4, '0')}`;
  }
  return `A${String(safeSeq).padStart(4, '0')}`;
}

export function extractUsedNumbers(
  codes: (string | null | undefined)[],
  group: CodeGroup
): Set<number> {
  const used = new Set<number>();
  
  const regex = group === 'ESPERA'
    ? /^LE0*([1-9]\d*)$/i
    : group === 'JUVENIL'
      ? /^J0*([1-9]\d*)$/i
      : /^A0*([1-9]\d*)$/i;

  for (const raw of codes) {
    if (!raw) continue;
    const clean = String(raw).trim().toUpperCase();
    const match = clean.match(regex);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        used.add(parsed);
      }
    }
  }

  return used;
}

export function findLowestAvailableNumber(
  usedNumbers: Set<number>,
  existingExactCodes?: Set<string>,
  group?: CodeGroup
): number {
  let candidate = 1;
  while (true) {
    if (!usedNumbers.has(candidate)) {
      if (group && existingExactCodes) {
        const candidateStr = formatCode(group, candidate).toUpperCase();
        if (!existingExactCodes.has(candidateStr)) {
          return candidate;
        }
      } else {
        return candidate;
      }
    }
    candidate++;
  }
}

export function allocateNextCode(
  existingCodes: (string | null | undefined)[],
  group: CodeGroup
): string {
  const existingSet = new Set<string>();
  for (const c of existingCodes) {
    if (c) existingSet.add(String(c).trim().toUpperCase());
  }

  const usedNumbers = extractUsedNumbers(existingCodes, group);
  const nextNum = findLowestAvailableNumber(usedNumbers, existingSet, group);
  return formatCode(group, nextNum);
}

export function isLegacyCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return String(code).trim().toUpperCase().startsWith('TAST-');
}
