/**
 * Unified Registration Code Allocator
 * 
 * Formats:
 * - Adults: A0001, A0002, A0003... (Prefix 'A', 4 digits)
 * - Juveniles: J0001, J0002, J0003... (Prefix 'J', 4 digits)
 * - Waitlist (Lista de espera): LE00001, LE00002, LE00003... (Prefix 'LE', 5 digits)
 * 
 * Rules:
 * 1. Prefix depends on category and real status (waitlist takes precedence).
 * 2. Independent numbering per group.
 * 3. When an inscription is deleted, its number becomes free and is automatically reused.
 * 4. Always allocate the lowest available positive integer (e.g., if A0001, A0002, A0003 exist and A0002 is deleted, next adult is A0002).
 * 5. Atomic check & allocation to prevent race conditions.
 * 6. Never reuse a code that currently exists in the database.
 * 7. If moving to waitlist, assign LE00001...
 * 8. If moving from waitlist to admitted, assign Axxxx or Jxxxx.
 * 9. Legacy codes (e.g. TAST-...) are preserved and never auto-mutated unless explicitly promoted/demoted.
 */

export type CodeGroup = 'ADULT' | 'JUVENIL' | 'ESPERA';

/**
 * Determine the code group based on category and waitlist status.
 */
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

/**
 * Format sequence number according to the group rules:
 * - Adults: A + 4 digits (A0001)
 * - Juveniles: J + 4 digits (J0001)
 * - Waitlist: LE + 5 digits (LE00001)
 */
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

/**
 * Extract the sequence numbers currently in use for a specific group.
 * Checks against both exact patterns and ignores unrelated prefixes.
 */
export function extractUsedNumbers(
  codes: (string | null | undefined)[],
  group: CodeGroup
): Set<number> {
  const used = new Set<number>();
  
  // Regex depending on group
  // ESPERA: LE followed by digits
  // JUVENIL: J followed by digits (excluding LE)
  // ADULT: A followed by digits
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

/**
 * Find the lowest available positive integer >= 1.
 * Ensures the resulting code is not already in usedNumbers and does not match any existing code string.
 */
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

/**
 * Calculate the next code to assign for a group given the list of all currently existing codes.
 */
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

/**
 * Check if a code matches the legacy format (e.g. TAST-2027-...)
 */
export function isLegacyCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return String(code).trim().toUpperCase().startsWith('TAST-');
}
