import { Inscripcio, CategoriaParella, MetodePagament } from './types';

export interface DailySummaryRow {
  dateStr: string;                  // Format: YYYY-MM-DD
  totalRegistrations: number;       // Number of registrations
  waitingListCount: number;         // Count in waiting list
  totalRevenue: number;             // Sum of preuCalculat
  cashRevenue: number;              // Paid via 'efectiu' / cash
  bizumRevenue: number;             // Paid via 'bizum'
  adultsCount: number;              // Inscriptions of category/type adults
  juvenilsCount: number;            // Inscriptions of category/type juvenils
  minorsCount: number;              // Total number of minors among the participants
  domasCount: number;               // Sum of teDomasBalco ? 1 : 0
  extraMocadorsCount: number;       // Sum of teMocadorsExtra
}

/**
 * Parses and groups inscriptions into standard daily summaries.
 */
export function calculateDailySummaries(inscripcions: Inscripcio[]): DailySummaryRow[] {
  const map: Record<string, DailySummaryRow> = {};

  for (const item of inscripcions) {
    // Determine the creation date in local/regular format: YYYY-MM-DD
    let dateStr = 'Sense Data';
    if (item.creadoEn) {
      try {
        const d = new Date(item.creadoEn);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!map[dateStr]) {
      map[dateStr] = {
        dateStr,
        totalRegistrations: 0,
        waitingListCount: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        bizumRevenue: 0,
        adultsCount: 0,
        juvenilsCount: 0,
        minorsCount: 0,
        domasCount: 0,
        extraMocadorsCount: 0,
      };
    }

    const day = map[dateStr];
    day.totalRegistrations += 1;

    if (item.llistaEspera) {
      day.waitingListCount += 1;
    }

    const price = Number(item.preuCalculat) || 0;
    day.totalRevenue += price;

    if (item.metodePagament === MetodePagament.EFECTIU) {
      day.cashRevenue += price;
    } else if (item.metodePagament === MetodePagament.BIZUM) {
      day.bizumRevenue += price;
    }

    if (item.categoria === CategoriaParella.ADULT) {
      day.adultsCount += 1;
    } else if (item.categoria === CategoriaParella.JUVENIL) {
      day.juvenilsCount += 1;
    }

    // Count minors
    let minors = 0;
    if (item.c1EsMenor) minors += 1;
    if (item.c2EsMenor) minors += 1;
    day.minorsCount += minors;

    if (item.teDomasBalco) {
      day.domasCount += 1;
    }

    day.extraMocadorsCount += Number(item.teMocadorsExtra) || 0;
  }

  // Convert to array and sort chronologically (most recent first, or oldest first? Oldest to newest makes sense for ledger sheets)
  return Object.values(map).sort((a, b) => {
    if (a.dateStr === 'Sense Data') return 1;
    if (b.dateStr === 'Sense Data') return -1;
    return a.dateStr.localeCompare(b.dateStr);
  });
}
