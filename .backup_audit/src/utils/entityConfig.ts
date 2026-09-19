import { getSupabaseSetting } from '../supabaseClient';
import { SistemaConfig } from '../types';

export interface EntityConfig {
  nom: string;
  direccio: string;
  email: string;
  telefon: string;
  horari: string;
  diesEntrega: string;
  nomEsdeveniment: string;
  anyEdicio: string;
  logoUrl?: string;
}

/**
 * Returns current entity configuration from localStorage or defaults.
 * Synchronous for immediate rendering.
 */
export function getEntityConfigSync(language: 'ca' | 'es' = 'ca', fallbackConfig?: SistemaConfig): EntityConfig {
  let storedPersonalizacion: any = null;
  try {
    const raw = localStorage.getItem('personalizacion');
    if (raw) storedPersonalizacion = JSON.parse(raw);
  } catch (e) {
    // Ignore JSON parse error
  }

  const ev = storedPersonalizacion?.evento || {};
  const sec = storedPersonalizacion?.secretaria || {};
  const med = storedPersonalizacion?.medios || {};

  const nom = ev.nombre || localStorage.getItem('tast_nom_esdeveniment') || fallbackConfig?.titolSeccioTarifes?.replace(/Tarifes\s*/i, '') || "Associació Cultural El Tast";
  const direccio = ev.direccio || localStorage.getItem('tast_direccio_esdeveniment') || "Plaça Soler i Carbonell, 28, Vilanova i la Geltrú";
  const rawEmail = ev.email || localStorage.getItem('tast_email_contacte') || "tastvng@gmail.com";
  const email = (rawEmail.includes('secretaria@eltast.cat') || rawEmail.includes('secretaria@tast.cat')) ? "tastvng@gmail.com" : rawEmail;
  const telefon = ev.telefon || localStorage.getItem('tast_telefon_contacte') || "600 000 000";
  const anyEdicio = ev.any_edicio || localStorage.getItem('tast_any_edicio') || "2027";
  const nomEsdeveniment = ev.nombre ? `${ev.nombre} ${anyEdicio}` : `El Tast ${anyEdicio}`;

  const defaultHoursCa = "Dimecres i divendres, de 18:00h a 21:30h a la seu de l'entitat.";
  const defaultHoursEs = "Miércoles y viernes, de 18:00h a 21:30h en la sede de la entidad.";
  const defaultDeliveryCa = "Dimecres i divendres de 18:00h a 21:30h a la seu social.";
  const defaultDeliveryEs = "Miércoles y viernes de 18:00h a 21:30h en la sede social.";

  const horari = (language === 'ca'
    ? (sec.hours_ca || localStorage.getItem('tast_secretaria_hours_ca') || defaultHoursCa)
    : (sec.hours_es || localStorage.getItem('tast_secretaria_hours_es') || defaultHoursEs)
  ).trim();

  const diesEntrega = (language === 'ca'
    ? (sec.dies_entrega_ca || localStorage.getItem('tast_dies_entrega_ca') || defaultDeliveryCa)
    : (sec.dies_entrega_es || localStorage.getItem('tast_dies_entrega_es') || defaultDeliveryEs)
  ).trim();

  const logoUrl = med.logo || localStorage.getItem('tast_email_logo') || undefined;

  return {
    nom,
    direccio,
    email,
    telefon,
    horari,
    diesEntrega,
    nomEsdeveniment,
    anyEdicio,
    logoUrl
  };
}

/**
 * Loads current entity configuration directly from Supabase sistema_config / settings,
 * updating localStorage cache and returning the unified entity information.
 */
export async function fetchLiveEntityConfig(language: 'ca' | 'es' = 'ca'): Promise<EntityConfig> {
  try {
    const livePersonalizacion = await getSupabaseSetting<any>('personalizacion', null);
    if (livePersonalizacion) {
      localStorage.setItem('personalizacion', JSON.stringify(livePersonalizacion));
    }
  } catch (e) {
    console.warn("Could not fetch live entity personalizacion:", e);
  }

  return getEntityConfigSync(language);
}
