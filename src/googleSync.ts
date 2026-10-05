import { Inscripcio, SistemaConfig } from './types';
import { calculateDailySummaries } from './dailySummary';
import { calculateInscriptionOrderBreakdown } from './utils/orderCalculations';

// Module-level state variables to enable debouncing and hash comparison across imports
let syncTimeout: any = null;
let lastSyncedDataSignature = '';

/**
 * Reutiliza la lógica de orderCalculations para saber quién quiere armilla
 * y formatear su talla y modalidad: p. ej. "S (Lloguer), M (Compra)".
 */
function getTallaArmilla(i: Inscripcio, config?: SistemaConfig): string {
  const liniis = config?.liniisUniforme && config.liniisUniforme.length > 0
    ? config.liniisUniforme
    : [{
        id: 'lin-1',
        nom: config?.nomUniforme || 'Armilla',
        nomES: config?.nomUniformeES || 'Armilla',
        opcions: config?.opcionsUniforme || ['S', 'M', 'L', 'XL', 'XXL'],
        requeixQuantitat: false,
        actiu: true,
        preu: 30,
        preuLloguer: 30,
        opcional: config?.armilla_opcional ?? true
      }];

  const seleccionsUniforme = i.seleccionsUniforme || {};
  const regAny = i as any;
  const parts: string[] = [];

  for (const linia of liniis) {
    if (linia.actiu === false) continue;
    const isArmilla = /armilla|chaleco|uniforme/i.test(linia.nom) || /armilla|chaleco|uniforme/i.test(linia.id) || linia.id === 'lin-1';
    if (!isArmilla && liniis.length > 1) continue;

    const sel = seleccionsUniforme[linia.id] || seleccionsUniforme['uniforme'] || seleccionsUniforme['armilla'];
    const isOptional = !!(linia.opcional || linia.armilla_opcional || config?.armilla_opcional);

    const c1VolCandidate = (sel as any)?.c1Vol ?? regAny.c1Vol ?? regAny.c1_vol ?? regAny.c1VolArmilla ?? regAny.c1_vol_armilla;
    const c2VolCandidate = (sel as any)?.c2Vol ?? regAny.c2Vol ?? regAny.c2_vol ?? regAny.c2VolArmilla ?? regAny.c2_vol_armilla;

    const hasExplicitC1Vol = typeof c1VolCandidate === 'boolean';
    const hasExplicitC2Vol = typeof c2VolCandidate === 'boolean';

    const rawTalla1 = ((sel as any)?.c1Talla || i.c1Talla || '').trim();
    const rawTalla2 = ((sel as any)?.c2Talla || i.c2Talla || '').trim();
    const hasT1 = !!rawTalla1 && rawTalla1.toLowerCase() !== 'cap';
    const hasT2 = !!rawTalla2 && rawTalla2.toLowerCase() !== 'cap';

    const p1Wants = hasExplicitC1Vol ? c1VolCandidate === true : (isOptional ? false : hasT1);
    const p2Wants = hasExplicitC2Vol ? c2VolCandidate === true : (isOptional ? false : hasT2);

    const c1Tipus = ((sel as any)?.c1Tipus || i.c1UniformeTipus || 'compra').toLowerCase();
    const c2Tipus = ((sel as any)?.c2Tipus || i.c2UniformeTipus || 'compra').toLowerCase();

    const p1IsLloguer = c1Tipus.includes('lloguer') || c1Tipus.includes('alquiler');
    const p2IsLloguer = c2Tipus.includes('lloguer') || c2Tipus.includes('alquiler');

    const p1Modality = p1IsLloguer ? 'Lloguer' : 'Compra';
    const p2Modality = p2IsLloguer ? 'Lloguer' : 'Compra';

    if (p1Wants && rawTalla1) {
      parts.push(`${rawTalla1} (${p1Modality})`);
    }
    if (p2Wants && rawTalla2) {
      parts.push(`${rawTalla2} (${p2Modality})`);
    }
  }

  return parts.join(', ');
}

/**
 * Pushes the full, current list of inscriptions to the user's Google Sheet
 * in real-time via the configured Google Apps Script Web App URL.
 * Now supports dual-tab synchronization: raw registrations, daily summary (cierre de día),
 * and the full 'rows' array formatted specifically for the 'COMPARSAS 2027' sheet.
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
        const activeYear = localStorage.getItem('tast_any_edicio') || '2027';
        const formattedData = inscripcions.map((i) => {
          const emailContacto = i.emailContactoPareja || i.c1Email || i.c2Email || '';
          const telefonContacto = i.telefonContactoPareja || i.c1Telefon || i.c2Telefon || '';
          return {
            anyEdicio: activeYear,
            codiSeguiment: i.codiSeguiment,
            categoria: i.categoria,
            emailContactoPareja: emailContacto,
            telefonContactoPareja: telefonContacto,
            c1Nom: i.c1Nom,
            c1Cognoms: i.c1Cognoms,
            c1Email: emailContacto,
            c1Telefon: telefonContacto,
            c1Talla: i.c1Talla,
            c1UniformeTipus: i.c1UniformeTipus || 'compra',
            c1EsMenor: i.c1EsMenor ? 'SÍ' : 'NO',
            c1TutorNom: i.c1EsMenor ? (i.c1TutorNom || '') : '',
            c1TutorCognoms: i.c1EsMenor ? (i.c1TutorCognoms || '') : '',
            c1TutorDni: i.c1EsMenor ? (i.c1TutorDni || '') : '',
            c1TutorTelefon: i.c1EsMenor ? (i.c1TutorTelefon || '') : '',
            c2Nom: i.c2Nom,
            c2Cognoms: i.c2Cognoms,
            c2Email: emailContacto,
            c2Telefon: telefonContacto,
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
            clavells: (i.extresSeleccionats || []).find(e => /clavell/i.test(e.nom))?.quantitat || (i.respostesCuestionari?.clavells_qty ? Number(i.respostesCuestionari.clavells_qty) : 0),
            corbati: (i.extresSeleccionats || []).find(e => /corbat/i.test(e.nom))?.quantitat || (i.respostesCuestionari?.corbati_qty ? Number(i.respostesCuestionari.corbati_qty) : 0),
            extresMaterial: (i.extresSeleccionats || []).map(e => `${e.quantitat}x ${e.nom}`).join(', ') || '',
            estatPagament: i.estatPagament,
            metodePagament: i.metodePagament || 'CAP',
            validacioDni: i.estatDni,
            entregaMaterial: i.entregaMaterial,
            llistaEspera: i.llistaEspera ? 'SÍ' : 'NO',
            dataCreacio: i.creadoEn ? new Date(i.creadoEn).toLocaleString('ca-ES') : ''
          };
        });

        const summaries = calculateDailySummaries(inscripcions);

        // 2. Format rows specifically for the 'COMPARSAS 2027' Google Sheet
        const banderaMap: Record<number, string> = {
          1: 'BOSS',
          2: 'No ni na',
          3: 'Juvenil',
        };

        const rows = inscripcions.map((i) => {
          const emailContacto = i.emailContactoPareja || i.c1Email || i.c2Email || '';
          const telefonContacto = i.telefonContactoPareja || i.c1Telefon || i.c2Telefon || '';
          const bandera = typeof i.bandera === 'number' ? (banderaMap[i.bandera] || '') : '';
          const c1NomCognoms = `${i.c1Nom || ''} ${i.c1Cognoms || ''}`.trim();
          const c2NomCognoms = `${i.c2Nom || ''} ${i.c2Cognoms || ''}`.trim();
          const tallaArmilla = getTallaArmilla(i, config);

          const baseRow: Record<string, any> = {
            codi: i.codiSeguiment || '',
            bandera,
            c1NomCognoms,
            c2NomCognoms,
            telefon: telefonContacto,
            email: emailContacto,
            tallaArmilla,
          };

          if (config) {
            const breakdown = calculateInscriptionOrderBreakdown(i, config, 'ca');

            const armillaRows = breakdown.materials.filter(m =>
              !m.id.toLowerCase().endsWith('-fianca') &&
              (/armilla|chaleco|uniforme/i.test(m.nom) || /armilla|chaleco|uniforme/i.test(m.id) || m.id.startsWith('lin-'))
            );
            const armillaQty = armillaRows.reduce((sum, m) => sum + m.quantitat, 0);
            const preuArmilla = armillaRows.reduce((sum, m) => sum + m.subtotal, 0);

            const fiancaRows = breakdown.materials.filter(m => m.id.toLowerCase().endsWith('-fianca'));
            const fianca = fiancaRows.reduce((sum, m) => sum + m.subtotal, 0);

            const clavellsRows = breakdown.materials.filter(m => m.id === 'clavells' || /clavell|clavel/i.test(m.nom));
            const clavellsQty = clavellsRows.reduce((sum, m) => sum + m.quantitat, 0);
            const preuClavells = clavellsRows.reduce((sum, m) => sum + m.subtotal, 0);

            const corbatiRows = breakdown.materials.filter(m => m.id === 'corbati' || /corbat|pajarit/i.test(m.nom));
            const corbatiQty = corbatiRows.reduce((sum, m) => sum + m.quantitat, 0);
            const preuCorbati = corbatiRows.reduce((sum, m) => sum + m.subtotal, 0);

            const esmorzarRows = breakdown.materials.filter(m => /esmorz|desayun/i.test(m.nom) || /esmorz|desayun/i.test(m.id));
            const esmorzarQty = esmorzarRows.reduce((sum, m) => sum + m.quantitat, 0);
            const preuEsmorzar = esmorzarRows.reduce((sum, m) => sum + m.subtotal, 0);

            const totalAPagar = typeof i.preuCalculat === 'number' && !isNaN(i.preuCalculat)
              ? i.preuCalculat
              : breakdown.totalCalculat;

            return {
              codi: i.codiSeguiment || '',
              bandera,
              c1NomCognoms,
              c2NomCognoms,
              telefon: telefonContacto,
              email: emailContacto,
              preuParella: breakdown.categoriaQuotaBase,
              armillaQty,
              preuArmilla,
              fianca,
              tallaArmilla,
              clavellsQty,
              preuClavells,
              corbatiQty,
              preuCorbati,
              esmorzarQty,
              preuEsmorzar,
              totalAPagar,
            };
          }

          return baseRow;
        });

        // 3. Compute payload signature to filter out duplicate/redundant sync requests
        const currentSignature = JSON.stringify(formattedData) + JSON.stringify(summaries) + JSON.stringify(rows) + ':completo:true:' + activeYear;
        if (currentSignature === lastSyncedDataSignature) {
          console.log("Google Sheets sync skipped: Data signature matches historical state.");
          resolve(true);
          return;
        }
        lastSyncedDataSignature = currentSignature;

        const payload = {
          action: 'sync_dual',
          any_edicio: activeYear,
          anyEdicio: activeYear,
          completo: true,
          data: formattedData,
          summaries: summaries,
          rows: rows,
        };

        const jsonBody = JSON.stringify(payload);

        // 4. Verification and dual-dispatch flow (CORS first with follow redirects, fallback to no-cors)
        try {
          const res = await fetch(googleSheetSyncUrl, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
              'Content-Type': 'text/plain',
            },
            body: jsonBody,
          });

          let resJson: any = null;
          try {
            resJson = await res.json();
          } catch {
            // Not a JSON response or already consumed
          }

          if (resJson) {
            if (resJson.ok === false) {
              console.warn("[Google Sheets Sync Error]:", resJson.error || resJson.message || resJson);
              resolve(false);
              return;
            }
            if (typeof resJson.aviso === 'string' && resJson.aviso.trim()) {
              console.warn("[Google Sheets Sync Avís]:", resJson.aviso);
            }
            if (resJson.ok === true) {
              console.log("Real-time Google Sheet synchronization confirmed by Apps Script (ok: true).");
              resolve(true);
              return;
            }
          }

          if (!res.ok) {
            console.warn("[Google Sheets Sync] HTTP Error:", res.status, res.statusText);
            resolve(false);
            return;
          }

          resolve(true);
          return;
        } catch (corsErr) {
          // If browser throws a CORS or network error on mode 'cors', fall back to 'no-cors'
          console.warn("[Google Sheets Sync] Mode 'cors' failed, falling back to 'no-cors':", corsErr);
          try {
            await fetch(googleSheetSyncUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: {
                'Content-Type': 'text/plain',
              },
              body: jsonBody,
            });
            console.log("Real-time Google Sheet dual-tab synchronization packet dispatched successfully (no-cors mode).");
            resolve(true);
            return;
          } catch (noCorsErr) {
            console.warn("Could not dispatch Google Sheet sync via 'no-cors':", noCorsErr);
            resolve(false);
            return;
          }
        }
      } catch (error) {
        console.warn("Could not dispatch real-time Google Sheet sync:", error);
        resolve(false);
      }
    }, 2000); // 2000ms debounce buffer
  });
}
