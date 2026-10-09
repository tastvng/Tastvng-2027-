import { Inscripcio, PagamentRegistrat, EstatPagament, MetodePagament } from '../types';

export type PaymentDerivedStatus = 'PENDENT' | 'PARCIAL' | 'PAGAT' | 'SOBREPAGAT';

export interface PaymentSummary {
  total: number;
  pagat: number;
  pendent: number;
  sobrepagat: number;
  estat: PaymentDerivedStatus;
  metodes: MetodePagament[];
  pagaments: PagamentRegistrat[];
  ultimaData?: string;
}

/**
 * Parses an amount string accepting both dot and comma as decimal separator.
 * Rejects empty, non-numeric, <= 0 and numbers with more than 2 decimal digits.
 * Returns the parsed number rounded to 2 decimals, or null if invalid.
 */
export function parseImport(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  const str = String(texto).trim();
  if (!str) return null;

  // Replace comma with dot
  const normalized = str.replace(',', '.');

  // Verify format: positive integer or decimal with up to 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const num = Number(normalized);
  if (isNaN(num) || num <= 0) {
    return null;
  }

  // Work in integer cents
  const cents = Math.round(num * 100);
  return cents / 100;
}

/**
 * Formats a number as Euro currency: "50,00 €"
 */
export function formatEuro(n: number): string {
  const safeNum = typeof n === 'number' && !isNaN(n) ? n : 0;
  return safeNum.toFixed(2).replace('.', ',') + ' €';
}

/**
 * Validates a single payment record.
 */
export function isValidPagament(p: any): p is PagamentRegistrat {
  if (!p || typeof p !== 'object') return false;
  const imp = typeof p.import === 'number' ? p.import : Number(p.import);
  if (isNaN(imp) || imp <= 0) return false;
  if (p.metode !== MetodePagament.EFECTIU && p.metode !== MetodePagament.BIZUM && p.metode !== 'EFECTIU' && p.metode !== 'BIZUM') {
    return false;
  }
  return true;
}

/**
 * Computes payment summary for an inscription.
 * Uses integer cents internally to avoid IEEE 754 precision issues.
 */
export function getPaymentSummary(
  registration: Partial<Inscripcio> | null | undefined,
  customTotal?: number
): PaymentSummary {
  const regTotal = typeof customTotal === 'number' && !isNaN(customTotal)
    ? customTotal
    : (typeof registration?.preuCalculat === 'number' && !isNaN(registration.preuCalculat) ? registration.preuCalculat : 0);

  const totalCents = Math.round(regTotal * 100);

  let validPayments: PagamentRegistrat[] = [];

  if (Array.isArray(registration?.pagaments) && registration.pagaments.length > 0) {
    validPayments = registration.pagaments.filter(isValidPagament).map(p => ({
      ...p,
      import: Math.round(Number(p.import) * 100) / 100,
      metode: (p.metode === MetodePagament.BIZUM || (p.metode as unknown) === 'BIZUM') ? MetodePagament.BIZUM : MetodePagament.EFECTIU
    }));
  }

  // Backwards-compatibility fallback:
  // If pagaments is empty and estatPagament === 'PAGAT', treat as single virtual payment of preuCalculat
  if (validPayments.length === 0 && registration?.estatPagament === EstatPagament.PAGAT && totalCents > 0) {
    const fallbackMetode = registration.metodePagament === MetodePagament.BIZUM ? MetodePagament.BIZUM : MetodePagament.EFECTIU;
    validPayments = [{
      id: `virtual-${registration.id || 'legacy'}`,
      data: registration.actualizadoEn || registration.creadoEn || new Date().toISOString(),
      import: totalCents / 100,
      metode: fallbackMetode,
      nota: 'Pagament registrat previ'
    }];
  }

  // Calculate sum of payments in cents
  let pagatCents = 0;
  const methodsSet = new Set<MetodePagament>();
  let lastDate: string | undefined = undefined;

  for (const p of validPayments) {
    const pCents = Math.round(p.import * 100);
    pagatCents += pCents;
    methodsSet.add(p.metode);
    if (p.data && (!lastDate || new Date(p.data).getTime() > new Date(lastDate).getTime())) {
      lastDate = p.data;
    }
  }

  const pendentCents = Math.max(0, totalCents - pagatCents);
  const sobrepagatCents = Math.max(0, pagatCents - totalCents);

  let estat: PaymentDerivedStatus = 'PENDENT';
  if (pagatCents === 0) {
    estat = 'PENDENT';
  } else if (sobrepagatCents > 0) {
    estat = 'SOBREPAGAT';
  } else if (pendentCents === 0) {
    estat = 'PAGAT';
  } else {
    estat = 'PARCIAL';
  }

  return {
    total: totalCents / 100,
    pagat: pagatCents / 100,
    pendent: pendentCents / 100,
    sobrepagat: sobrepagatCents / 100,
    estat,
    metodes: Array.from(methodsSet),
    pagaments: validPayments,
    ultimaData: lastDate
  };
}

/**
 * Returns derived legacy EstatPagament for backwards compatibility and storage.
 * Tolerance of 0.004 € (less than half a cent).
 */
export function derivedEstatPagament(summary: PaymentSummary): EstatPagament {
  if (summary.pendent <= 0.004 && summary.pagat > 0) {
    return EstatPagament.PAGAT;
  }
  return EstatPagament.PENDENT;
}

/**
 * Returns derived legacy MetodePagament (the method of the last payment, or null if no payments).
 */
export function derivedMetodePagament(
  pagaments: PagamentRegistrat[] | undefined | null
): MetodePagament | null {
  if (!Array.isArray(pagaments) || pagaments.length === 0) return null;
  const valid = pagaments.filter(isValidPagament);
  if (valid.length === 0) return null;

  // Find the last payment by date, or last in array
  let last = valid[valid.length - 1];
  let lastTime = last.data ? new Date(last.data).getTime() : 0;

  for (const p of valid) {
    const t = p.data ? new Date(p.data).getTime() : 0;
    if (t > lastTime) {
      last = p;
      lastTime = t;
    }
  }

  return last.metode === MetodePagament.BIZUM ? MetodePagament.BIZUM : MetodePagament.EFECTIU;
}

/**
 * Returns human-readable text for payment methods ("Efectiu", "Bizum", "Efectiu + Bizum")
 * for exports and sheets.
 */
export function metodesTexto(summary: PaymentSummary): string {
  const hasEfectiu = summary.metodes.includes(MetodePagament.EFECTIU);
  const hasBizum = summary.metodes.includes(MetodePagament.BIZUM);

  if (hasEfectiu && hasBizum) {
    return 'Efectiu + Bizum';
  }
  if (hasBizum) {
    return 'Bizum';
  }
  if (hasEfectiu) {
    return 'Efectiu';
  }
  return '';
}
