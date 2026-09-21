import { Inscripcio, SistemaConfig, CategoriaParella } from '../types';

export interface SelectedMaterialItem {
  id: string;
  nom: string;
  quantitat: number;
  modalitat: string;
  preuUnitari: number;
  subtotal: number;
}

export interface InscriptionOrderBreakdown {
  categoriaId: string;
  categoriaNom: string;
  categoriaQuotaBase: number;
  materials: SelectedMaterialItem[];
  totalMaterials: number;
  totalCalculat: number;
}

export interface TotalValidationResult {
  valid: boolean;
  expectedTotal: number;
  registeredTotal: number;
  difference: number;
  errorMessage?: string;
}

/**
 * Single source of truth calculation for an inscription order breakdown.
 * - Reads active tariffs and uniform lines from the current config.
 * - Shows ONLY materials actually selected by the couple (quantity > 0).
 * - Never uses default/invented quantities or prices.
 * - Never includes legacy or invented labels like "clavells inclòs", "Domassos" or "Mocadors" when not selected.
 * - Calculates individual item subtotals and grand total.
 */
export function calculateInscriptionOrderBreakdown(
  registration: Inscripcio,
  config?: SistemaConfig | null,
  language: 'ca' | 'es' = 'ca'
): InscriptionOrderBreakdown {
  // 1. Calculate Category Base Fee
  const isAdult = String(registration.categoria || '').toUpperCase().includes('ADULT') || 
                  registration.categoria === CategoriaParella.ADULT;

  let categoriaQuotaBase = 0;
  let categoriaNom = '';

  if (isAdult) {
    categoriaNom = language === 'ca' 
      ? (config?.categoriaAdultaNom || "Parella Adulta")
      : (config?.categoriaAdultaNomES || "Pareja Adulta");
    
    const adultTariff = config?.tarifesDinamiques?.find(t => 
      t.actiu !== false && (t.tipus === 'categoria_adult' || t.id === 'adults')
    );
    categoriaQuotaBase = adultTariff ? adultTariff.valor : (config?.preuAdult ?? (config as any)?.preuAdults ?? (config as any)?.preu_adults ?? 45);
  } else {
    categoriaNom = language === 'ca'
      ? (config?.categoriaJuvenilNom || "Parella Juvenil")
      : (config?.categoriaJuvenilNomES || "Pareja Juvenil");

    const juvenilTariff = config?.tarifesDinamiques?.find(t => 
      t.actiu !== false && (t.tipus === 'categoria_juvenil' || t.id === 'juvenils')
    );
    categoriaQuotaBase = juvenilTariff ? juvenilTariff.valor : (config?.preuJuvenil ?? (config as any)?.preu_juvenil ?? 45);
  }

  const materials: SelectedMaterialItem[] = [];
  const processedExtraIds = new Set<string>();

  // 2. Uniforms / Vestuari from current configuration (liniisUniforme)
  const liniis = config?.liniisUniforme && config.liniisUniforme.length > 0
    ? config.liniisUniforme
    : [{
        id: 'lin-uniforme-def',
        nom: config?.nomUniforme || 'Armilla',
        nomES: config?.nomUniformeES || 'Armilla',
        opcions: config?.opcionsUniforme || ['S', 'M', 'L', 'XL', 'XXL'],
        requeixQuantitat: false,
        actiu: true,
        preu: 30,
        preuLloguer: 30,
        opcional: config?.armilla_opcional ?? true
      }];

  const seleccionsUniforme = registration.seleccionsUniforme || {};

  for (const linia of liniis) {
    if (linia.actiu === false) continue;

    const sel = seleccionsUniforme[linia.id] || seleccionsUniforme['uniforme'] || seleccionsUniforme['armilla'];
    const isOptional = !!(linia.opcional || linia.armilla_opcional || config?.armilla_opcional);
    const liniaNom = (language === 'es' ? (linia.nomES || linia.nom) : linia.nom) || 'Armilla';

    // Check if armilla quantity is explicitly recorded in registration or questionnaire responses
    const regAny = registration as any;
    let explicitQty: number | null = null;
    const candidates = [
      regAny.armilla,
      regAny.armilla_qty,
      regAny.armillaQuantitat,
      regAny.armilles,
      regAny.totalArmilles,
      regAny.total_armilles,
      regAny.quantitat_armilla,
      regAny.quantitat,
      registration.respostesCuestionari?.armilla,
      registration.respostesCuestionari?.armilla_qty,
      (sel as any)?.quantitat,
      (sel as any)?.armilla
    ];

    for (const val of candidates) {
      if (val !== undefined && val !== null && val !== '') {
        if (typeof val === 'boolean') {
          explicitQty = val ? 1 : 0;
          break;
        }
        const parsed = Number(val);
        if (!isNaN(parsed)) {
          explicitQty = Math.max(0, parsed);
          break;
        }
      }
    }

    // Participant wants & selections
    const c1VolCandidate = (sel as any)?.c1Vol ?? regAny.c1Vol ?? regAny.c1_vol ?? regAny.c1VolArmilla ?? regAny.c1_vol_armilla;
    const c2VolCandidate = (sel as any)?.c2Vol ?? regAny.c2Vol ?? regAny.c2_vol ?? regAny.c2VolArmilla ?? regAny.c2_vol_armilla;

    const hasExplicitC1Vol = typeof c1VolCandidate === 'boolean';
    const hasExplicitC2Vol = typeof c2VolCandidate === 'boolean';

    const c1Wants = hasExplicitC1Vol 
      ? c1VolCandidate === true 
      : (isOptional 
          ? (explicitQty !== null ? explicitQty >= 1 : (!!registration.c1Talla && registration.c1Talla.toLowerCase() !== 'cap'))
          : (!!registration.c1Talla && registration.c1Talla.toLowerCase() !== 'cap'));

    const c2Wants = hasExplicitC2Vol 
      ? c2VolCandidate === true 
      : (isOptional 
          ? (explicitQty !== null ? explicitQty >= 2 : (!!registration.c2Talla && registration.c2Talla.toLowerCase() !== 'cap'))
          : (!!registration.c2Talla && registration.c2Talla.toLowerCase() !== 'cap'));

    let finalQty = 0;
    if (explicitQty !== null) {
      finalQty = explicitQty;
    } else if (c1Wants && c2Wants) {
      finalQty = 2;
    } else if (c1Wants || c2Wants) {
      finalQty = 1;
    }

    if (finalQty > 0) {
      const c1Tipus = ((sel as any)?.c1Tipus || registration.c1UniformeTipus || 'compra').toLowerCase();
      const c2Tipus = ((sel as any)?.c2Tipus || registration.c2UniformeTipus || 'compra').toLowerCase();

      const rawTalla1 = ((sel as any)?.c1Talla || registration.c1Talla || '').trim();
      const rawTalla2 = ((sel as any)?.c2Talla || registration.c2Talla || '').trim();
      const hasT1 = !!rawTalla1 && rawTalla1.toLowerCase() !== 'cap';
      const hasT2 = !!rawTalla2 && rawTalla2.toLowerCase() !== 'cap';

      // Strictly determine which size(s) were selected by the user
      let p1Selected = false;
      let p2Selected = false;

      if (hasExplicitC1Vol || hasExplicitC2Vol) {
        p1Selected = c1Wants && hasT1;
        p2Selected = c2Wants && hasT2;
      } else if (finalQty === 1) {
        // Exactly one item: show exactly one size
        if (c1Wants && !c2Wants && hasT1) {
          p1Selected = true;
        } else if (c2Wants && !c1Wants && hasT2) {
          p2Selected = true;
        } else if (hasT1) {
          p1Selected = true;
        } else if (hasT2) {
          p2Selected = true;
        }
      } else if (finalQty >= 2) {
        p1Selected = hasT1;
        p2Selected = hasT2;
      }

      // If user only marked 1 size, show 1 size. If marked 2, show 2.
      const activeTalla1 = p1Selected ? rawTalla1 : '';
      const activeTalla2 = p2Selected ? rawTalla2 : '';

      const p1IsLloguer = c1Tipus.includes('lloguer') || c1Tipus.includes('alquiler');
      const p2IsLloguer = c2Tipus.includes('lloguer') || c2Tipus.includes('alquiler');

      let baseModality = language === 'ca' ? 'Compra' : 'Compra';
      let unitPrice = linia.preu ?? 0;

      if (activeTalla1 && activeTalla2) {
        if (p1IsLloguer && p2IsLloguer) {
          baseModality = language === 'ca' ? 'Lloguer' : 'Alquiler';
          unitPrice = linia.preuLloguer ?? linia.preu ?? 0;
        } else if (p1IsLloguer || p2IsLloguer) {
          baseModality = language === 'ca' 
            ? (p1IsLloguer ? 'P1 Lloguer, P2 Compra' : 'P1 Compra, P2 Lloguer')
            : (p1IsLloguer ? 'P1 Alquiler, P2 Compra' : 'P1 Compra, P2 Alquiler');
          unitPrice = linia.preu ?? 0;
        }
      } else if (activeTalla2 && !activeTalla1) {
        if (p2IsLloguer) {
          baseModality = language === 'ca' ? 'Lloguer' : 'Alquiler';
          unitPrice = linia.preuLloguer ?? linia.preu ?? 0;
        }
      } else {
        if (p1IsLloguer) {
          baseModality = language === 'ca' ? 'Lloguer' : 'Alquiler';
          unitPrice = linia.preuLloguer ?? linia.preu ?? 0;
        }
      }

      let detail = '';
      if (activeTalla1 && activeTalla2) {
        detail = language === 'ca' ? `(Talles: P1 ${activeTalla1}, P2 ${activeTalla2})` : `(Tallas: P1 ${activeTalla1}, P2 ${activeTalla2})`;
      } else if (activeTalla1) {
        detail = language === 'ca' ? `(Talla: ${activeTalla1})` : `(Talla: ${activeTalla1})`;
      } else if (activeTalla2) {
        detail = language === 'ca' ? `(Talla: ${activeTalla2})` : `(Talla: ${activeTalla2})`;
      }

      const modalityLabel = detail ? `${baseModality} ${detail}` : baseModality;

      processedExtraIds.add(linia.id);
      processedExtraIds.add('armilla');
      processedExtraIds.add('chaleco');

      materials.push({
        id: linia.id,
        nom: liniaNom,
        quantitat: finalQty,
        modalitat: modalityLabel,
        preuUnitari: unitPrice,
        subtotal: finalQty * unitPrice
      });
    }
  }

  // 3. Materials recorded directly in registration.extresSeleccionats
  // Requirement: The only valid materials are chaleco, claveles and pajarita.
  // Eliminate references to pañuelos, mocadors, domàs y domassos.
  if (Array.isArray(registration.extresSeleccionats)) {
    for (const ext of registration.extresSeleccionats) {
      if (!ext || ext.quantitat <= 0) continue;
      
      const extId = String(ext.id || ext.nom || '');
      const extNom = String(ext.nom || '');
      
      const isForbidden = /doma|mocador|pañuelo|panuelo/i.test(extId) || /doma|mocador|pañuelo|panuelo/i.test(extNom);
      const isClavells = /clavell/i.test(extId) || /clavell/i.test(extNom);
      const isCorbati = /corbat|pajarit/i.test(extId) || /corbat|pajarit/i.test(extNom);
      const isArmillaExtra = /armilla|chaleco/i.test(extId) || /armilla|chaleco/i.test(extNom);

      // Discard legacy domàs / mocadors unless it was renamed to clavells / corbatí
      if (isForbidden && !isClavells && !isCorbati) {
        continue;
      }

      // Do not duplicate armilla if already processed
      if (isArmillaExtra && processedExtraIds.has('armilla')) {
        continue;
      }

      processedExtraIds.add(extId);
      processedExtraIds.add(extId.toLowerCase());
      if (isClavells) {
        processedExtraIds.add('clavells');
      }
      if (isCorbati) {
        processedExtraIds.add('corbati');
      }

      const cleanNom = isClavells 
        ? (language === 'ca' ? 'Clavells' : 'Claveles')
        : isCorbati 
          ? (language === 'ca' ? 'Corbatí' : 'Pajarita')
          : extNom;

      materials.push({
        id: isClavells ? 'clavells' : (isCorbati ? 'corbati' : (ext.id || `ext-${materials.length}`)),
        nom: cleanNom,
        quantitat: ext.quantitat,
        modalitat: (ext as any).modalitat || (language === 'ca' ? 'Complements' : 'Complementos'),
        preuUnitari: ext.preuUnitari,
        subtotal: ext.quantitat * ext.preuUnitari
      });
    }
  }

  // 4. Materials from respostesCuestionari if not already in extresSeleccionats (e.g. clavells_qty, corbati_qty)
  const respostes = registration.respostesCuestionari || {};
  const dynamicTariffList = config?.tarifesDinamiques || [];

  for (const [key, val] of Object.entries(respostes)) {
    let cleanKey = key.replace(/_qty$/i, '').replace(/^extra_qty_/i, '');
    const num = Number(val);
    if (isNaN(num) || num <= 0) continue;

    // Discard any forbidden legacy keys
    if (/doma|mocador|pañuelo|panuelo/i.test(cleanKey)) {
      continue;
    }

    // Skip if already processed in extresSeleccionats
    if (processedExtraIds.has(cleanKey) || processedExtraIds.has(cleanKey.toLowerCase())) continue;

    // Find active tariff for this extra
    const tariff = dynamicTariffList.find(t => 
      t.actiu !== false && (t.id === cleanKey || t.id.toLowerCase() === cleanKey.toLowerCase() || t.nom.toLowerCase() === cleanKey.toLowerCase())
    );

    if (tariff) {
      const isForbiddenTariff = /doma|mocador|pañuelo|panuelo/i.test(tariff.id) || /doma|mocador|pañuelo|panuelo/i.test(tariff.nom);
      const isClavellsTariff = /clavell/i.test(tariff.id) || /clavell/i.test(tariff.nom);
      const isCorbatiTariff = /corbat|pajarit/i.test(tariff.id) || /corbat|pajarit/i.test(tariff.nom);

      if (isForbiddenTariff && !isClavellsTariff && !isCorbatiTariff) {
        continue;
      }

      processedExtraIds.add(cleanKey);
      processedExtraIds.add(cleanKey.toLowerCase());

      const cleanNom = isClavellsTariff 
        ? (language === 'ca' ? 'Clavells' : 'Claveles')
        : isCorbatiTariff 
          ? (language === 'ca' ? 'Corbatí' : 'Pajarita')
          : (language === 'es' && tariff.nomES ? tariff.nomES : tariff.nom);

      materials.push({
        id: isClavellsTariff ? 'clavells' : (isCorbatiTariff ? 'corbati' : tariff.id),
        nom: cleanNom,
        quantitat: num,
        modalitat: language === 'ca' ? 'Complements' : 'Complementos',
        preuUnitari: tariff.valor,
        subtotal: num * tariff.valor
      });
    } else if (cleanKey === 'clavells' || cleanKey === 'corbati') {
      // Known specific complement with fallback price if active
      const fallbackPrice = cleanKey === 'clavells' ? 8 : 10;
      const nom = cleanKey === 'clavells' ? (language === 'ca' ? 'Clavells' : 'Claveles') : (language === 'ca' ? 'Corbatí' : 'Pajarita');
      processedExtraIds.add(cleanKey);
      materials.push({
        id: cleanKey,
        nom,
        quantitat: num,
        modalitat: language === 'ca' ? 'Complements' : 'Complementos',
        preuUnitari: fallbackPrice,
        subtotal: num * fallbackPrice
      });
    }
  }

  const totalMaterials = materials.reduce((sum, item) => sum + item.subtotal, 0);
  const totalCalculat = categoriaQuotaBase + totalMaterials;

  return {
    categoriaId: isAdult ? 'adults' : 'juvenils',
    categoriaNom,
    categoriaQuotaBase,
    materials,
    totalMaterials,
    totalCalculat
  };
}

/**
 * Calculates the exact grand total for an inscription.
 */
export function calculateInscriptionTotal(
  registration: Inscripcio,
  config?: SistemaConfig | null
): number {
  const breakdown = calculateInscriptionOrderBreakdown(registration, config);
  return breakdown.totalCalculat;
}

/**
 * Validates that the recorded total on the inscription matches the single source of truth total.
 * Requirement 7: "El total debe coincidir en todos los sitios. Si no coincide, bloquea el envío y muestra un error."
 */
export function validateInscriptionTotal(
  registration: Inscripcio,
  config?: SistemaConfig | null,
  language: 'ca' | 'es' = 'ca'
): TotalValidationResult {
  const breakdown = calculateInscriptionOrderBreakdown(registration, config, language);
  const expectedTotal = breakdown.totalCalculat;
  const registeredTotal = Number(registration.preuCalculat !== undefined ? registration.preuCalculat : 0);
  const difference = Math.abs(expectedTotal - registeredTotal);

  if (difference > 0.01) {
    const errorMsg = language === 'ca'
      ? `Error de concordança de preu: El total calculat dels conceptes i quota (${expectedTotal}€) no coincideix amb el total registrat a la fitxa (${registeredTotal}€). S'ha bloquejat l'enviament per seguretat.`
      : `Error de concordancia de precio: El total calculado de los conceptos y cuota (${expectedTotal}€) no coincide con el total registrado en la ficha (${registeredTotal}€). Se ha bloqueado el envío por seguridad.`;
    return {
      valid: false,
      expectedTotal,
      registeredTotal,
      difference,
      errorMessage: errorMsg
    };
  }

  return {
    valid: true,
    expectedTotal,
    registeredTotal,
    difference: 0
  };
}

/**
 * Generates an HTML table representing the itemized breakdown
 * with columns: Concepte/Material, Quantitat, Modalitat, Preu unitari, Subtotal.
 * Used identically for Email, Printable Voucher, and PDF.
 */
export function generateItemizedBreakdownHtml(
  breakdown: InscriptionOrderBreakdown,
  language: 'ca' | 'es' = 'ca'
): string {
  const colMaterial = language === 'ca' ? 'Concepte / Material' : 'Concepto / Material';
  const colQty = language === 'ca' ? 'Quantitat' : 'Cantidad';
  const colModality = language === 'ca' ? 'Modalitat' : 'Modalidad';
  const colUnitPrice = language === 'ca' ? 'Preu unitari' : 'Precio unitario';
  const colSubtotal = language === 'ca' ? 'Subtotal' : 'Subtotal';
  const quotaLabel = language === 'ca' ? 'Quota inscripció' : 'Cuota inscripción';
  const totalLabel = language === 'ca' ? 'TOTAL A PAGAR:' : 'TOTAL A PAGAR:';

  let rowsHtml = `
    <tr style="border-bottom: 1px solid #f0f0f4;">
      <td style="padding: 10px 8px; font-weight: bold; color: #111115;">
        ${quotaLabel} <span style="color: #666670; font-weight: normal; font-size: 11px;">(${breakdown.categoriaNom})</span>
      </td>
      <td style="padding: 10px 8px; text-align: center; color: #444450; font-family: monospace;">1</td>
      <td style="padding: 10px 8px; text-align: center; color: #666670; font-size: 11px;">${language === 'ca' ? 'Oficial' : 'Oficial'}</td>
      <td style="padding: 10px 8px; text-align: right; color: #444450; font-family: monospace;">${breakdown.categoriaQuotaBase}€</td>
      <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #111115; font-family: monospace;">${breakdown.categoriaQuotaBase}€</td>
    </tr>
  `;

  for (const m of breakdown.materials) {
    rowsHtml += `
      <tr style="border-bottom: 1px solid #f0f0f4;">
        <td style="padding: 10px 8px; font-weight: 600; color: #111115;">
          ${m.nom}
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: #ff0090; font-family: monospace;">
          ${m.quantitat}
        </td>
        <td style="padding: 10px 8px; text-align: center; color: #666670; font-size: 11px;">
          ${m.modalitat}
        </td>
        <td style="padding: 10px 8px; text-align: right; color: #444450; font-family: monospace;">
          ${m.preuUnitari}€
        </td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #111115; font-family: monospace;">
          ${m.subtotal}€
        </td>
      </tr>
    `;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background-color: #f8f9fa; border-bottom: 2px solid #e1e1e6; text-transform: uppercase; font-size: 10px; color: #666670; letter-spacing: 0.5px;">
          <th style="padding: 10px 8px; text-align: left;">${colMaterial}</th>
          <th style="padding: 10px 8px; text-align: center;">${colQty}</th>
          <th style="padding: 10px 8px; text-align: center;">${colModality}</th>
          <th style="padding: 10px 8px; text-align: right;">${colUnitPrice}</th>
          <th style="padding: 10px 8px; text-align: right;">${colSubtotal}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="border-top: 2px solid #ff0090; background-color: #fcf6fa;">
          <td colspan="4" style="padding: 14px 8px; font-weight: 900; font-size: 13px; color: #111115; text-transform: uppercase;">
            ${totalLabel}
          </td>
          <td style="padding: 14px 8px; text-align: right; font-weight: 950; color: #ff0090; font-size: 20px; font-family: monospace;">
            ${breakdown.totalCalculat}€
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}
