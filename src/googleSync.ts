import { Inscripcio } from './types';
import { calculateDailySummaries } from './dailySummary';

/**
 * Pushes the full, current list of inscriptions to the user's Google Sheet
 * in real-time via the configured Google Apps Script Web App URL.
 * Now supports dual-tab synchronization: raw registrations and daily summary (cierre de día).
 */
export async function syncToGoogleSheet(
  inscripcions: Inscripcio[],
  googleSheetSyncUrl?: string,
  googleSheetSyncActive?: boolean
): Promise<boolean> {
  if (!googleSheetSyncActive || !googleSheetSyncUrl) {
    return false;
  }

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

    // Calculate aggregated day-by-day summaries
    const summaries = calculateDailySummaries(inscripcions);

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
    return true;
  } catch (error) {
    console.warn("Could not dispatch real-time Google Sheet sync:", error);
    return false;
  }
}
