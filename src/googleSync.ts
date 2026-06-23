import { Inscripcio, SistemaConfig } from './types';
import { calculateDailySummaries } from './dailySummary';

// Module-level state variables to enable debouncing and hash comparison across imports
let syncTimeout: any = null;
let lastSyncedDataSignature = '';

/**
 * Pushes the full, current list of inscriptions to the user's Google Sheet
 * in real-time via the configured Google Apps Script Web App URL.
 * Now supports dual-tab synchronization: raw registrations and daily summary (cierre de día).
 * Optimizations added:
 * - Debounces rapid successive calls within 2000ms.
 * - Compares serialized data signature to bypass redundant dispatches if no fields actually changed.
 */
export async function syncToGoogleSheet(
  inscripcions: Inscripcio[],
  googleSheetSyncUrl?: string,
  googleSheetSyncActive?: boolean,
  config?: SistemaConfig
): Promise<boolean> {
  if (!googleSheetSyncActive || !googleSheetSyncUrl) {
    return false;
  }

  return new Promise((resolve) => {
    // 1. Debounce consecutive executions (saves egress during bulk operations)
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(async () => {
      try {
        const formattedData = inscripcions.map((i) => ({
          codiSeguiment: i.codiSeguiment,
          categoria: i.categoria,
          c1Nom: i.c1Nom,
          c1Cognoms: i.c1Cognoms,
          c1Email: i.c1Email,
          c1Telefon: i.c1Telefon,
          c1Talla: i.c1Talla,
          c1UniformeTipus: i.c1UniformeTipus || 'compra',
          c1EsMenor: i.c1EsMenor ? 'SÍ' : 'NO',
          c1TutorNom: i.c1EsMenor ? (i.c1TutorNom || '') : '',
          c1TutorCognoms: i.c1EsMenor ? (i.c1TutorCognoms || '') : '',
          c1TutorDni: i.c1EsMenor ? (i.c1TutorDni || '') : '',
          c1TutorTelefon: i.c1EsMenor ? (i.c1TutorTelefon || '') : '',
          c2Nom: i.c2Nom,
          c2Cognoms: i.c2Cognoms,
          c2Email: i.c2Email,
          c2Telefon: i.c2Telefon,
          c2Talla: i.c2Talla,
          c2UniformeTipus: i.c2UniformeTipus || 'compra',
          c2EsMenor: i.c2EsMenor ? 'SÍ' : 'NO',
          c2TutorNom: i.c2EsMenor ? (i.c2TutorNom || '') : '',
          c2TutorCognoms: i.c2EsMenor ? (i.c2TutorCognoms || '') : '',
          c2TutorDni: i.c2EsMenor ? (i.c2TutorDni || '') : '',
          c2TutorTelefon: i.c2EsMenor ? (i.c2TutorTelefon || '') : '',
          preuTotal: i.preuCalculat,
          domasBalco: i.teDomasBalco ? 'SÍ' : 'NO',
          mocadorsExtra: i.teMocadorsExtra,
          estatPagament: i.estatPagament,
          metodePagament: i.metodePagament || 'CAP',
          validacioDni: i.estatDni,
          entregaMaterial: i.entregaMaterial,
          llistaEspera: i.llistaEspera ? 'SÍ' : 'NO',
          dataCreacio: i.creadoEn ? new Date(i.creadoEn).toLocaleString('ca-ES') : ''
        }));

        const summaries = calculateDailySummaries(inscripcions);

        // 2. Compute payload signature to filter out duplicate/redundant sync requests
        const currentSignature = JSON.stringify(formattedData) + JSON.stringify(summaries);
        if (currentSignature === lastSyncedDataSignature) {
          console.log("Google Sheets sync skipped: Data signature matches historical state.");
          resolve(true);
          return;
        }
        lastSyncedDataSignature = currentSignature;

        // Trigger POST request with standard text/plain to bypass complex CORS preflights in Google Apps Script redirects
        const response = await fetch(googleSheetSyncUrl, {
          method: 'POST',
          mode: 'no-cors', // standard way to submit data cross-origin to script.google.com without preflight failure
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify({
            action: 'sync_dual',
            data: formattedData,
            summaries: summaries,
          }),
        });

        console.log("Real-time Google Sheet dual-tab synchronization packet dispatched successfully.");
        resolve(true);
      } catch (error) {
        console.warn("Could not dispatch real-time Google Sheet sync:", error);
        resolve(false);
      }
    }, 2000); // 2000ms debounce buffer
  });
}
