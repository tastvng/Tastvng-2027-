/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  RotateCw, 
  ZoomIn, 
  Check, 
  CheckCircle,
  Clock,
  X, 
  Sparkles, 
  Save, 
  HelpCircle,
  AlertTriangle,
  QrCode,
  Download,
  ExternalLink,
  RefreshCw,
  Coins,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Edit3,
  Send,
  History
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import TranslatedText from './TranslatedText';
import { Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, CategoriaParella, SistemaConfig, PagamentRegistrat } from '../types';
import { calculateInscriptionOrderBreakdown, validateInscriptionTotal } from '../utils/orderCalculations';
import { determineCodeGroup, allocateNextCode } from '../utils/codeAllocator';
import { parseScopeAndQuestionId, isPreguntaVisible, answerKey } from '../utils/questionVisibility';
import { getPaymentSummary, derivedEstatPagament, derivedMetodePagament, parseImport, formatEuro } from '../utils/paymentCalculations';
import { supabase } from '../supabaseClient';
import { buildUnifiedEmailHtml } from '../utils/ticketGenerator';
import { getEntityConfig } from '../utils/entityConfig';
import { DynamicQuestionsSection } from './DynamicQuestionsSection';

interface AdminFichaProps {
  registration: Inscripcio;
  allInscripcions?: Inscripcio[];
  config?: SistemaConfig;
  onBack: () => void;
  onSave: (updatedRecord: Inscripcio, modifiedFields?: Record<string, any>) => Promise<any> | void;
  onRefresh?: () => Promise<any> | void;
}

function didEmailRelevantFieldsChange(initial: Inscripcio, current: Inscripcio): boolean {
  if ((initial.codiSeguiment || '').trim() !== (current.codiSeguiment || '').trim()) return true;
  if (initial.categoria !== current.categoria) return true;
  const initialEmail = (initial.emailContactoPareja || initial.c1Email || '').trim();
  const currentEmail = (current.emailContactoPareja || current.c1Email || '').trim();
  if (initialEmail !== currentEmail) return true;
  if (Number(initial.preuCalculat || 0) !== Number(current.preuCalculat || 0)) return true;

  const initC1Vol = Boolean((initial as any).c1Vol || ((Object.values(initial.seleccionsUniforme || {})[0] as any)?.c1Vol) || (initial.c1Talla && initial.c1Talla.toLowerCase() !== 'cap'));
  const initC2Vol = Boolean((initial as any).c2Vol || ((Object.values(initial.seleccionsUniforme || {})[0] as any)?.c2Vol) || (initial.c2Talla && initial.c2Talla.toLowerCase() !== 'cap'));
  const curC1Vol = Boolean((current as any).c1Vol);
  const curC2Vol = Boolean((current as any).c2Vol);
  if (initC1Vol !== curC1Vol || initC2Vol !== curC2Vol) return true;
  if ((initial.c1Talla || '').trim() !== (current.c1Talla || '').trim()) return true;
  if ((initial.c2Talla || '').trim() !== (current.c2Talla || '').trim()) return true;
  if ((initial.c1UniformeTipus || '') !== (current.c1UniformeTipus || '')) return true;
  if ((initial.c2UniformeTipus || '') !== (current.c2UniformeTipus || '')) return true;

  const oldResp = initial.respostesCuestionari || {};
  const newResp = current.respostesCuestionari || {};
  if (String(oldResp.clavells_qty || '0') !== String(newResp.clavells_qty || '0')) return true;
  if (String(oldResp.corbati_qty || '0') !== String(newResp.corbati_qty || '0')) return true;

  const allKeys = new Set([...Object.keys(oldResp), ...Object.keys(newResp)]);
  for (const k of allKeys) {
    if (/esmorzar|bocata|gluten|tomaquet|esm-/i.test(k)) {
      if (String(oldResp[k] ?? '') !== String(newResp[k] ?? '')) {
        return true;
      }
    }
  }

  return false;
}

export default function AdminFicha({ registration, allInscripcions = [], config, onBack, onSave, onRefresh }: AdminFichaProps) {
  const { language, t } = useLanguage();
  const [codiSeguiment, setCodiSeguiment] = useState<string>(registration.codiSeguiment || '');
  const [categoria, setCategoria] = useState<CategoriaParella>(registration.categoria);

  // Participant Contact & Identifiers
  const [emailContactoPareja, setEmailContactoPareja] = useState(
    registration.emailContactoPareja || registration.c1Email || registration.c2Email || ''
  );
  const [telefonContactoPareja, setTelefonContactoPareja] = useState(
    registration.telefonContactoPareja || registration.c1Telefon || registration.c2Telefon || (registration.respostesCuestionari as any)?.telefonContactoPareja || (registration.respostesCuestionari as any)?.telefonContacteParella || ''
  );

  React.useEffect(() => {
    setEmailContactoPareja(registration.emailContactoPareja || registration.c1Email || registration.c2Email || '');
    setTelefonContactoPareja(
      registration.telefonContactoPareja || registration.c1Telefon || registration.c2Telefon || (registration.respostesCuestionari as any)?.telefonContactoPareja || (registration.respostesCuestionari as any)?.telefonContacteParella || ''
    );
  }, [registration.id]);

  // Initial armilla intent (c1Vol / c2Vol)
  const selUni = registration.seleccionsUniforme || {};
  const firstUni = Object.values(selUni)[0] as any;
  const initC1Vol = typeof (registration as any).c1Vol === 'boolean'
    ? (registration as any).c1Vol
    : (typeof firstUni?.c1Vol === 'boolean'
      ? firstUni.c1Vol
      : Boolean(registration.c1Talla && registration.c1Talla.trim() && registration.c1Talla.toLowerCase() !== 'cap'));
  const initC2Vol = typeof (registration as any).c2Vol === 'boolean'
    ? (registration as any).c2Vol
    : (typeof firstUni?.c2Vol === 'boolean'
      ? firstUni.c2Vol
      : Boolean(registration.c2Talla && registration.c2Talla.trim() && registration.c2Talla.toLowerCase() !== 'cap'));

  const [c1Vol, setC1Vol] = useState<boolean>(initC1Vol);
  const [c2Vol, setC2Vol] = useState<boolean>(initC2Vol);

  // Participant 1
  const [c1Nom, setC1Nom] = useState(registration.c1Nom || '');
  const [c1Cognoms, setC1Cognoms] = useState(registration.c1Cognoms || '');
  const [c1Email, setC1Email] = useState(registration.c1Email || '');
  const [c1Telefon, setC1Telefon] = useState(registration.c1Telefon || '');
  const [c1Talla, setC1Talla] = useState<string>(() => {
    const raw = (registration.c1Talla || '').trim();
    if (!raw || raw.toLowerCase() === 'cap' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return '';
    return raw;
  });
  const [c1UniformeTipus, setC1UniformeTipus] = useState<string>(() => {
    return (registration.c1UniformeTipus as string) || '';
  });
  const [c1EsMenor, setC1EsMenor] = useState<boolean>(Boolean(registration.c1EsMenor));
  const [c1TutorNom, setC1TutorNom] = useState(registration.c1TutorNom || '');
  const [c1TutorCognoms, setC1TutorCognoms] = useState(registration.c1TutorCognoms || '');
  const [c1TutorDni, setC1TutorDni] = useState(registration.c1TutorDni || '');
  const [c1TutorTelefon, setC1TutorTelefon] = useState(registration.c1TutorTelefon || '');

  // Participant 2
  const [c2Nom, setC2Nom] = useState(registration.c2Nom || '');
  const [c2Cognoms, setC2Cognoms] = useState(registration.c2Cognoms || '');
  const [c2Email, setC2Email] = useState(registration.c2Email || '');
  const [c2Telefon, setC2Telefon] = useState(registration.c2Telefon || '');
  const [c2Talla, setC2Talla] = useState<string>(() => {
    const raw = (registration.c2Talla || '').trim();
    if (!raw || raw.toLowerCase() === 'cap' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return '';
    return raw;
  });
  const [c2UniformeTipus, setC2UniformeTipus] = useState<string>(() => {
    return (registration.c2UniformeTipus as string) || '';
  });
  const [c2EsMenor, setC2EsMenor] = useState<boolean>(Boolean(registration.c2EsMenor));
  const [c2TutorNom, setC2TutorNom] = useState(registration.c2TutorNom || '');
  const [c2TutorCognoms, setC2TutorCognoms] = useState(registration.c2TutorCognoms || '');
  const [c2TutorDni, setC2TutorDni] = useState(registration.c2TutorDni || '');
  const [c2TutorTelefon, setC2TutorTelefon] = useState(registration.c2TutorTelefon || '');

  // Clavells and Corbatí quantities
  const initClavells = Number(
    registration.respostesCuestionari?.clavells_qty ??
    (registration.extresSeleccionats || []).find(e => /clavell/i.test(e.nom))?.quantitat ??
    (registration as any).clavells ??
    0
  );
  const initCorbati = Number(
    registration.respostesCuestionari?.corbati_qty ??
    (registration.extresSeleccionats || []).find(e => /corbat/i.test(e.nom))?.quantitat ??
    (registration as any).corbati ??
    0
  );
  const [clavellsQty, setClavellsQty] = useState<number>(isNaN(initClavells) ? 0 : initClavells);
  const [corbatiQty, setCorbatiQty] = useState<number>(isNaN(initCorbati) ? 0 : initCorbati);

  // Dynamic configured questions from table preguntes / config
  const [preguntesList, setPreguntesList] = useState<any[]>(() => config?.preguntesFormulari || []);

  React.useEffect(() => {
    let active = true;
    async function loadQuestions() {
      try {
        const { cargarPreguntesDetallat } = await import('../api/questionnaireApi');
        const res = await cargarPreguntesDetallat(false);
        if (active && res && res.data && res.data.length > 0) {
          setPreguntesList(res.data);
        }
      } catch (err) {
        console.warn("Could not load dynamic questions in AdminFicha:", err);
      }
    }
    loadQuestions();
    return () => { active = false; };
  }, []);

  // Local extras and questionnaire state
  const [extresSeleccionats, setExtresSeleccionats] = useState<any[]>(() => registration.extresSeleccionats || []);
  const [respostesCuestionari, setRespostesCuestionari] = useState<Record<string, any>>(() => registration.respostesCuestionari || {});

  // DB Save and Drive sync status indicators
  const [dbSaveStatus, setDbSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [driveSyncStatus, setDriveSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [mailPendingResend, setMailPendingResend] = useState<boolean>(false);

  // Material Editing Mode and Email Resend
  const [isEditingMaterials, setIsEditingMaterials] = useState(false);
  const [justSavedMaterials, setJustSavedMaterials] = useState(false);
  const [lastMaterialChanges, setLastMaterialChanges] = useState<string[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingModifiedEmail, setIsSendingModifiedEmail] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [mailEnviat, setMailEnviat] = useState<boolean>(() => {
    return registration.mailEnviat !== undefined
      ? Boolean(registration.mailEnviat)
      : (registration.mailEstat === 'enviat' || registration.respostesCuestionari?.estatCorreu === 'enviat');
  });
  const [mailData, setMailData] = useState<string | undefined>(() => {
    const raw = registration.mailData || registration.respostesCuestionari?.mailData || registration.respostesCuestionari?.dataUltimCorreu;
    return typeof raw === 'string' ? raw : undefined;
  });
  const [mailError, setMailError] = useState<string | null | undefined>(() => {
    const rawErr = registration.mailError || registration.respostesCuestionari?.mailError;
    return typeof rawErr === 'string' ? rawErr : null;
  });
  const [mailEstat, setMailEstat] = useState<'pendent' | 'enviat' | 'fallat'>(() => {
    if (registration.mailEstat) return registration.mailEstat;
    if (registration.mailEnviat || registration.respostesCuestionari?.estatCorreu === 'enviat') return 'enviat';
    if (registration.mailError || registration.respostesCuestionari?.mailError) return 'fallat';
    return 'pendent';
  });

  const currentRecord = useMemo<Inscripcio>(() => {
    const effResp: Record<string, any> = {
      ...respostesCuestionari,
      clavells_qty: String(clavellsQty),
      corbati_qty: String(corbatiQty),
      mailEnviat,
      mailData,
      mailError,
      mailEstat,
      estatCorreu: mailEstat,
      dataUltimCorreu: mailData
    };

    const selUniRecord = {
      ...(registration.seleccionsUniforme || {}),
      'lin-1': {
        c1Vol,
        c1Talla: c1Vol ? c1Talla.trim() : '',
        c1Tipus: c1Vol ? c1UniformeTipus : '',
        c2Vol,
        c2Talla: c2Vol ? c2Talla.trim() : '',
        c2Tipus: c2Vol ? c2UniformeTipus : ''
      }
    };

    return {
      ...registration,
      codiSeguiment: codiSeguiment.trim(),
      categoria,
      c1Nom: c1Nom.trim(),
      c1Cognoms: c1Cognoms.trim(),
      c1Email: c1Email.trim() || emailContactoPareja.trim(),
      c1Telefon: c1Telefon.trim() || telefonContactoPareja.trim(),
      c1Talla: c1Vol ? c1Talla.trim() : '',
      c1UniformeTipus: c1Vol ? (c1UniformeTipus as any) : undefined,
      c1EsMenor,
      c1TutorNom: c1TutorNom.trim(),
      c1TutorCognoms: c1TutorCognoms.trim(),
      c1TutorDni: c1TutorDni.trim(),
      c1TutorTelefon: c1TutorTelefon.trim(),
      c2Nom: c2Nom.trim(),
      c2Cognoms: c2Cognoms.trim(),
      c2Email: c2Email.trim() || emailContactoPareja.trim(),
      c2Telefon: c2Telefon.trim() || telefonContactoPareja.trim(),
      c2Talla: c2Vol ? c2Talla.trim() : '',
      c2UniformeTipus: c2Vol ? (c2UniformeTipus as any) : undefined,
      c2EsMenor,
      c2TutorNom: c2TutorNom.trim(),
      c2TutorCognoms: c2TutorCognoms.trim(),
      c2TutorDni: c2TutorDni.trim(),
      c2TutorTelefon: c2TutorTelefon.trim(),
      emailContactoPareja: emailContactoPareja.trim(),
      telefonContactoPareja: telefonContactoPareja.trim(),
      c1Vol,
      c2Vol,
      seleccionsUniforme: selUniRecord,
      extresSeleccionats,
      respostesCuestionari: effResp,
      mailEnviat,
      mailData,
      mailError,
      mailEstat
    } as any;
  }, [
    registration, codiSeguiment, categoria, emailContactoPareja, telefonContactoPareja,
    c1Nom, c1Cognoms, c1Email, c1Telefon, c1Talla, c1UniformeTipus, c1EsMenor, c1TutorNom, c1TutorCognoms, c1TutorDni, c1TutorTelefon, c1Vol,
    c2Nom, c2Cognoms, c2Email, c2Telefon, c2Talla, c2UniformeTipus, c2EsMenor, c2TutorNom, c2TutorCognoms, c2TutorDni, c2TutorTelefon, c2Vol,
    extresSeleccionats, respostesCuestionari, clavellsQty, corbatiQty, mailEnviat, mailData, mailError, mailEstat
  ]);

  // Single Source of Truth Order Breakdown and Validation
  const breakdown = useMemo(() => {
    return calculateInscriptionOrderBreakdown(currentRecord, config, language);
  }, [currentRecord, config, language]);

  const validation = useMemo(() => {
    return validateInscriptionTotal(currentRecord, config, language);
  }, [currentRecord, config, language]);

  // Registered Payments state
  const [pagaments, setPagaments] = useState<PagamentRegistrat[]>(() => {
    if (Array.isArray(registration.pagaments) && registration.pagaments.length > 0) {
      return registration.pagaments;
    }
    return getPaymentSummary(registration, breakdown.totalCalculat).pagaments;
  });

  const initialPagamentsJson = useRef(JSON.stringify(registration.pagaments || []));

  // Form state for adding a payment
  const [nouImport, setNouImport] = useState<string>('');
  const [nouMetode, setNouMetode] = useState<MetodePagament>(MetodePagament.EFECTIU);
  const [novaData, setNovaData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [novaNota, setNovaNota] = useState<string>('');

  const paymentSummary = useMemo(() => {
    return getPaymentSummary({ ...currentRecord, pagaments }, breakdown.totalCalculat);
  }, [currentRecord, pagaments, breakdown.totalCalculat]);

  const hasUnsavedPayments = useMemo(() => {
    return JSON.stringify(pagaments) !== initialPagamentsJson.current;
  }, [pagaments]);

  const hasUnsavedExtres = useMemo(() => {
    return JSON.stringify(extresSeleccionats) !== JSON.stringify(registration.extresSeleccionats || []);
  }, [extresSeleccionats, registration.extresSeleccionats]);

  // Check if breakfast recalculation can be performed
  const hasPricedBreakfastQuestion = useMemo(() => {
    return (config?.preguntesFormulari || []).some(q => 
      q.preus && typeof q.preus === 'object' && Object.values(q.preus).some(p => typeof p === 'number' && !isNaN(p) && p > 0)
    );
  }, [config?.preguntesFormulari]);

  const hasSavedEsmorzarLines = useMemo(() => {
    return (extresSeleccionats || []).some(e => String(e.id || '').startsWith('esm-'));
  }, [extresSeleccionats]);

  const canRecalcularEsmorzar = hasPricedBreakfastQuestion || hasSavedEsmorzarLines;

  const handleRecalcularEsmorzar = () => {
    if (!canRecalcularEsmorzar) return;

    const recalculatedBreakdown = calculateInscriptionOrderBreakdown(
      currentRecord,
      config,
      language,
      { recalcularEsmorzar: true }
    );

    const oldTotal = breakdown.totalCalculat;
    const newTotal = recalculatedBreakdown.totalCalculat;
    const diff = Math.round((newTotal - oldTotal) * 100) / 100;
    const diffFormatted = diff >= 0 ? `+${formatEuro(diff)}` : `-${formatEuro(Math.abs(diff))}`;

    const confirmMsg = language === 'ca'
      ? `Passarà de ${formatEuro(oldTotal)} a ${formatEuro(newTotal)} (${diffFormatted}). Això canvia el pendent de pagament. Continuar?`
      : `Pasará de ${formatEuro(oldTotal)} a ${formatEuro(newTotal)} (${diffFormatted}). Esto cambia el pendiente de pago. ¿Continuar?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    const nonEsmorzar = (extresSeleccionats || []).filter(e => !String(e.id || '').startsWith('esm-'));
    const newEsmorzar = recalculatedBreakdown.materials
      .filter(m => m.modalitat === 'Esmorzar' || m.id.startsWith('esm-'))
      .map(m => ({
        id: m.id,
        nom: m.nom,
        quantitat: m.quantitat,
        preuUnitari: m.preuUnitari,
        modalitat: m.modalitat
      }));

    const updatedExtres = [...nonEsmorzar, ...newEsmorzar];
    setExtresSeleccionats(updatedExtres);
  };

  const handleSendEmail = async () => {
    const coupleEmail = (emailContactoPareja || registration.c1Email || registration.c2Email || '').trim();
    if (!coupleEmail || !coupleEmail.includes('@')) {
      alert(language === 'ca' ? "No s'ha trobat cap adreça de correu de contacte vàlida." : "No se encontró ninguna dirección de correo de contacto válida.");
      return;
    }

    const codeToSend = (codiSeguiment || registration.codiSeguiment || '').trim();
    if (!codeToSend) {
      alert(language === 'ca'
        ? "El codi de seguiment real està buit a Supabase. No es pot enviar el correu sense codi de parella."
        : "El código de seguimiento real está vacío en Supabase. No se puede enviar el correo sin código de pareja.");
      return;
    }

    setIsSendingModifiedEmail(true);
    setEmailSendStatus(null);

    try {
      const isCorrection = Boolean(mailEnviat || mailEstat === 'enviat');

      let adminToken = '';
      try {
        const session = (await supabase?.auth.getSession())?.data?.session;
        adminToken = session?.access_token || '';
      } catch {}

      const res = await fetch('/api/email?action=send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({
          id: registration.id,
          to: coupleEmail,
          isCorrection,
          language
        })
      });

      const nowIso = new Date().toISOString();
      const resJson = await res.json().catch(() => null);

      if (res.ok && resJson?.ok !== false && resJson?.emailSent !== false) {
        setMailEnviat(true);
        setMailData(nowIso);
        setMailEstat('enviat');
        setMailError(null);
        setEmailSendStatus({
          ok: true,
          msg: language === 'ca' ? `Correu enviat correctament a ${coupleEmail}` : `Correo enviado correctamente a ${coupleEmail}`
        });

        const recordWithMail: Inscripcio = {
          ...currentRecord,
          mailEnviat: true,
          mailData: nowIso,
          mailEstat: 'enviat',
          mailError: null,
          respostesCuestionari: {
            ...currentRecord.respostesCuestionari,
            mailEnviat: true,
            mailData: nowIso,
            mailEstat: 'enviat',
            mailError: null,
            estatCorreu: 'enviat',
            dataUltimCorreu: nowIso
          }
        };
        onSave(recordWithMail);
      } else {
        const errMsg = resJson?.message || resJson?.error || `Error ${res.status}`;
        setMailEnviat(false);
        setMailEstat('fallat');
        setMailError(errMsg);
        setEmailSendStatus({
          ok: false,
          msg: language === 'ca' ? `Error enviant correu: ${errMsg}` : `Error enviando correo: ${errMsg}`
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setMailEnviat(false);
      setMailEstat('fallat');
      setMailError(errMsg);
      setEmailSendStatus({
        ok: false,
        msg: language === 'ca' ? `Error de xarxa: ${errMsg}` : `Error de red: ${errMsg}`
      });
    } finally {
      setIsSendingModifiedEmail(false);
    }
  };

  // State variables replicating the sheet parameters
  const [estatPagament, setEstatPagament] = useState<EstatPagament>(registration.estatPagament);
  const [metodePagament, setMetodePagament] = useState<MetodePagament | null>(registration.metodePagament);
  const [estatDni, setEstatDni] = useState<EstatVerificacio>(registration.estatDni);
  const [entregaMaterial, setEntregaMaterial] = useState<EstatInscripcio>(registration.entregaMaterial);
  const [entregaC1Uniforme, setEntregaC1Uniforme] = useState<boolean>(() => {
    if (registration.entregaC1Uniforme !== undefined) return registration.entregaC1Uniforme;
    return registration.entregaMaterial === EstatInscripcio.ENTREGAT;
  });
  const [entregaC2Uniforme, setEntregaC2Uniforme] = useState<boolean>(() => {
    if (registration.entregaC2Uniforme !== undefined) return registration.entregaC2Uniforme;
    return registration.entregaMaterial === EstatInscripcio.ENTREGAT;
  });
  const [entregaExtras, setEntregaExtras] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    breakdown.materials.forEach(m => {
      initial[m.id] = registration.entregaMaterial === EstatInscripcio.ENTREGAT;
    });
    return initial;
  });
  const [llistaEspera, setLlistaEspera] = useState<boolean>(!!registration.llistaEspera);
  const [estatInscripcio, setEstatInscripcio] = useState<'obertes' | 'llista_espera' | undefined>(registration.estatInscripcio);
  const [bandera, setBandera] = useState<number>(registration.bandera || 0);

  // Lazy-load complete details including heavy DNI blobs only when viewing the individual card
  const [c1RawPath, setC1RawPath] = useState<string>(registration.c1DniUrl || '');
  const [c2RawPath, setC2RawPath] = useState<string>(registration.c2DniUrl || '');
  const [c1DniUrl, setC1DniUrl] = useState<string>('');
  const [c2DniUrl, setC2DniUrl] = useState<string>('');
  const [loadingDni1, setLoadingDni1] = useState<boolean>(false);
  const [loadingDni2, setLoadingDni2] = useState<boolean>(false);
  const [dni1Error, setDni1Error] = useState<string | null>(null);
  const [dni2Error, setDni2Error] = useState<string | null>(null);

  const resolveDni1 = React.useCallback(async (path: string) => {
    if (!path) {
      setC1DniUrl('');
      return;
    }
    if (path.startsWith('data:')) {
      setC1DniUrl(path);
      return;
    }
    setLoadingDni1(true);
    setDni1Error(null);
    try {
      const { getDniSignedUrl } = await import('../supabaseClient');
      const signed = await getDniSignedUrl(path);
      if (signed) {
        setC1DniUrl(signed);
      } else {
        setDni1Error("DNI no disponible");
      }
    } catch (err: any) {
      setDni1Error("DNI no disponible");
    } finally {
      setLoadingDni1(false);
    }
  }, []);

  const resolveDni2 = React.useCallback(async (path: string) => {
    if (!path) {
      setC2DniUrl('');
      return;
    }
    if (path.startsWith('data:')) {
      setC2DniUrl(path);
      return;
    }
    setLoadingDni2(true);
    setDni2Error(null);
    try {
      const { getDniSignedUrl } = await import('../supabaseClient');
      const signed = await getDniSignedUrl(path);
      if (signed) {
        setC2DniUrl(signed);
      } else {
        setDni2Error("DNI no disponible");
      }
    } catch (err: any) {
      setDni2Error("DNI no disponible");
    } finally {
      setLoadingDni2(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    const recordId = registration.id;

    async function loadFullDni() {
      try {
        const { getSupabaseInscripcionById } = await import('../supabaseClient');
        const full = await getSupabaseInscripcionById(recordId);
        if (full && active) {
          const p1 = full.c1DniUrl || registration.c1DniUrl || '';
          const p2 = full.c2DniUrl || registration.c2DniUrl || '';
          if (p1 && p1 !== c1RawPath) {
            setC1RawPath(p1);
            resolveDni1(p1);
          }
          if (p2 && p2 !== c2RawPath) {
            setC2RawPath(p2);
            resolveDni2(p2);
          }
        }
      } catch (err) {
        console.warn("Could not lazy-load DNI images from Supabase:", err);
      }
    }

    if (registration.c1DniUrl) {
      resolveDni1(registration.c1DniUrl);
    }
    if (registration.c2DniUrl) {
      resolveDni2(registration.c2DniUrl);
    }

    loadFullDni();

    return () => {
      active = false;
    };
  }, [registration.id, registration.c1DniUrl, registration.c2DniUrl, resolveDni1, resolveDni2]);

  const openDniInNewTab = async (currentUrl: string, rawPath: string) => {
    try {
      let targetUrl = currentUrl;
      if (!targetUrl || targetUrl.startsWith('data:') === false) {
        const { getDniSignedUrl } = await import('../supabaseClient');
        targetUrl = await getDniSignedUrl(rawPath || currentUrl);
      }
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.warn("Could not open DNI:", e);
      if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadDniFile = async (currentUrl: string, rawPath: string, pNum: number, pName: string) => {
    try {
      let targetUrl = currentUrl;
      if (!targetUrl) {
        const { getDniSignedUrl } = await import('../supabaseClient');
        targetUrl = await getDniSignedUrl(rawPath);
      }
      if (!targetUrl) return;

      if (targetUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.download = `DNI_P${pNum}_${registration.codiSeguiment}_${(pName || '').trim().replace(/\s+/g, '_')}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error("Error descarregant fitxer");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('pdf') ? 'pdf' : 'jpg';
      a.download = `DNI_P${pNum}_${registration.codiSeguiment}_${(pName || '').trim().replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Descàrrega directa fallada, obrint en pestanya nova:", err);
      if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Determine if Participant 1 and Participant 2 explicitly chose an armilla/equipment
  const p1HasArmilla = React.useMemo(() => {
    return !!c1Talla.trim();
  }, [c1Talla]);

  const p2HasArmilla = React.useMemo(() => {
    return !!c2Talla.trim();
  }, [c2Talla]);
  
  // DNI image manipulation states (rotation degrees)
  const [rotacio1, setRotacio1] = useState(0);
  const [rotacio2, setRotacio2] = useState(0);
  
  // Zoom modal active image URL
  const [activeZoomUrl, setActiveZoomUrl] = useState<string | null>(null);

  // Error notifications
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isWaitlist = estatInscripcio === 'llista_espera' || (!estatInscripcio && llistaEspera);

  const handleStatusChange = async (newIsWaitlist: boolean, newCategory?: CategoriaParella) => {
    const targetCategory = newCategory || categoria;
    setLlistaEspera(newIsWaitlist);
    setEstatInscripcio(newIsWaitlist ? 'llista_espera' : 'obertes');
    if (newCategory) setCategoria(newCategory);

    const targetGroup = determineCodeGroup(targetCategory, newIsWaitlist);
    const currentGroup = determineCodeGroup(categoria, isWaitlist);
    
    // If group changed (e.g. from Waitlist LE to Normal A/J, or vice-versa)
    if (targetGroup !== currentGroup) {
      try {
        const res = await fetch(`/api/inscriptions?action=allocate-code&categoria=${encodeURIComponent(targetCategory)}&isWaitlist=${newIsWaitlist}&excludeCode=${encodeURIComponent(registration.codiSeguiment || '')}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.codiSeguiment) {
            setCodiSeguiment(data.codiSeguiment);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not query server code allocator:", err);
      }
      const existing = (allInscripcions || [])
        .filter(i => i.id !== registration.id)
        .map(i => i.codiSeguiment);
      const newCode = allocateNextCode(existing, targetGroup);
      setCodiSeguiment(newCode);
    }
  };

  const rotateImage1 = () => {
    setRotacio1((prev) => (prev + 90) % 360);
  };

  const rotateImage2 = () => {
    setRotacio2((prev) => (prev + 90) % 360);
  };

  const handleAddPagament = () => {
    const imp = parseImport(nouImport);
    if (imp === null) {
      alert(
        language === 'ca'
          ? "L'import ha de ser un número vàlid major que 0 amb màxim 2 decimals."
          : "El importe debe ser un número válido mayor que 0 con máximo 2 decimales."
      );
      return;
    }

    if (!nouMetode) {
      alert(
        language === 'ca'
          ? "Cal triar un mètode de pagament (Efectiu o Bizum)."
          : "Debe elegir un método de pago (Efectivo o Bizum)."
      );
      return;
    }

    if (imp > paymentSummary.pendent) {
      const excess = (imp - paymentSummary.pendent).toFixed(2).replace('.', ',');
      const confirmMsg = language === 'ca'
        ? `Aquest import supera el pendent en ${excess} €. Vols registrar-lo igualment?`
        : `Este importe supera el pendiente en ${excess} €. ¿Deseas registrarlo igualmente?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    const newPayment: PagamentRegistrat = {
      id: 'pag-' + Math.random().toString(36).substr(2, 9),
      data: novaData ? new Date(novaData).toISOString() : new Date().toISOString(),
      import: imp,
      metode: nouMetode,
      nota: novaNota.trim() || undefined
    };

    setPagaments([...pagaments, newPayment]);
    setNouImport('');
    setNovaNota('');
  };

  const handleRemovePagament = (id: string) => {
    const confirmMsg = language === 'ca'
      ? "Segur que voleu eliminar aquest pagament registrat?"
      : "¿Seguro que desea eliminar este pago registrado?";
    if (!window.confirm(confirmMsg)) return;

    setPagaments(pagaments.filter(p => p.id !== id));
  };

  const handleSyncDrive = async (recordToSync?: Inscripcio) => {
    const target = recordToSync || currentRecord;
    setDriveSyncStatus('syncing');
    setDriveSyncError(null);
    try {
      const { syncToGoogleSheet } = await import('../googleSync');
      const updatedList = (allInscripcions || []).map(i => i.id === target.id ? target : i);
      if (!updatedList.some(i => i.id === target.id)) {
        updatedList.push(target);
      }
      const ok = await syncToGoogleSheet(
        updatedList,
        config?.googleSheetSyncUrl,
        config?.googleSheetSyncActive,
        config
      );
      if (ok) {
        setDriveSyncStatus('success');
      } else {
        setDriveSyncStatus('error');
        setDriveSyncError(language === 'ca' ? "No s'ha pogut sincronitzar amb Drive" : "No se pudo sincronizar con Drive");
      }
    } catch (err: any) {
      setDriveSyncStatus('error');
      setDriveSyncError(err?.message || String(err));
    }
  };

  const handleGuardaCanvis = async () => {
    if (!c1Nom.trim() || !c2Nom.trim()) {
      setValidationError(
        language === 'ca'
          ? "El nom dels participants no pot estar buit."
          : "El nombre de los participantes no puede estar vacío."
      );
      return;
    }

    setValidationError(null);

    // Validate unique tracking code and prompt confirmation if email was already sent (Point 4)
    const cleanCode = (codiSeguiment || '').trim();
    const hadMailSent = Boolean(registration.mailEnviat || registration.mailEstat === 'enviat' || mailEnviat || mailEstat === 'enviat');
    if (cleanCode && cleanCode !== (registration.codiSeguiment || '').trim() && hadMailSent) {
      const confirmCodeChange = window.confirm(
        language === 'ca'
          ? "Aquesta inscripció ja té el correu enviat. Si canvieu el codi de seguiment, la parella tindrà un codi diferent al que va rebre per correu. Voleu continuar?"
          : "Esta inscripción ya tiene el correo enviado. Si cambia el código de seguimiento, la pareja tendrá un código diferente al que recibió por correo. ¿Desea continuar?"
      );
      if (!confirmCodeChange) {
        return;
      }
    }

    if (supabase && registration.id) {
      try {
        const { data: dbRow } = await supabase
          .from('inscripciones')
          .select('pagaments')
          .eq('id', registration.id)
          .maybeSingle();

        if (dbRow) {
          const currentDbPagamentsJson = JSON.stringify(dbRow.pagaments || []);
          if (currentDbPagamentsJson !== initialPagamentsJson.current && currentDbPagamentsJson !== JSON.stringify(pagaments)) {
            const conflictMsg = language === 'ca'
              ? "Un altre administrador ha modificat els pagaments d'aquesta parella mentre tenies la fitxa oberta. Es recarregaran les dades per evitar sobreescriure-les."
              : "Otro administrador ha modificado los pagos de esta pareja mientras tenías la ficha abierta. Se recargarán los datos para evitar sobrescribirlos.";
            alert(conflictMsg);
            if (onRefresh) {
              await onRefresh();
            }
            onBack();
            return;
          }
        }
      } catch (err) {
        console.warn("Concurrency check warning:", err);
      }
    }

    const affectsEmail = didEmailRelevantFieldsChange(registration, currentRecord);
    const newMailEstat = affectsEmail ? 'pendent' : mailEstat;
    const newMailEnviat = affectsEmail ? false : mailEnviat;

    const derivedEstat = derivedEstatPagament(paymentSummary);
    const derivedMetode = derivedMetodePagament(pagaments);

    const updatedInscripcio: Inscripcio = {
      ...currentRecord,
      codiSeguiment: cleanCode,
      categoria,
      emailContactoPareja: emailContactoPareja.trim(),
      telefonContactoPareja: telefonContactoPareja.trim(),
      c1Nom: c1Nom.trim(),
      c1Cognoms: c1Cognoms.trim(),
      c1Email: c1Email.trim() || emailContactoPareja.trim(),
      c1Telefon: c1Telefon.trim() || telefonContactoPareja.trim(),
      c1Talla: c1Vol ? c1Talla.trim() : '',
      c1UniformeTipus: c1Vol ? (c1UniformeTipus as any) : undefined,
      c1EsMenor,
      c1TutorNom: c1TutorNom.trim(),
      c1TutorCognoms: c1TutorCognoms.trim(),
      c1TutorDni: c1TutorDni.trim(),
      c1TutorTelefon: c1TutorTelefon.trim(),
      c2Nom: c2Nom.trim(),
      c2Cognoms: c2Cognoms.trim(),
      c2Email: c2Email.trim() || emailContactoPareja.trim(),
      c2Telefon: c2Telefon.trim() || telefonContactoPareja.trim(),
      c2Talla: c2Vol ? c2Talla.trim() : '',
      c2UniformeTipus: c2Vol ? (c2UniformeTipus as any) : undefined,
      c2EsMenor,
      c2TutorNom: c2TutorNom.trim(),
      c2TutorCognoms: c2TutorCognoms.trim(),
      c2TutorDni: c2TutorDni.trim(),
      c2TutorTelefon: c2TutorTelefon.trim(),
      c1Vol,
      c2Vol,
      extresSeleccionats,
      preuCalculat: breakdown.totalCalculat,
      pagaments,
      estatPagament: derivedEstat,
      metodePagament: derivedMetode,
      estatDni,
      entregaMaterial,
      entregaC1Uniforme,
      entregaC2Uniforme,
      llistaEspera,
      estatInscripcio,
      bandera,
      mailEnviat: newMailEnviat,
      mailEstat: newMailEstat,
      respostesCuestionari: {
        ...currentRecord.respostesCuestionari,
        mailEnviat: newMailEnviat,
        mailEstat: newMailEstat,
        estatCorreu: newMailEstat
      },
      actualizadoEn: new Date().toISOString()
    };

    // Calculate diff: ONLY modified fields sent to DB (point 2.b)
    const modifiedUpdates: Record<string, any> = {};
    if (cleanCode !== (registration.codiSeguiment || '').trim()) modifiedUpdates.codiSeguiment = cleanCode;
    if (categoria !== registration.categoria) modifiedUpdates.categoria = categoria;
    if (c1Nom.trim() !== (registration.c1Nom || '').trim()) modifiedUpdates.c1Nom = c1Nom.trim();
    if (c1Cognoms.trim() !== (registration.c1Cognoms || '').trim()) modifiedUpdates.c1Cognoms = c1Cognoms.trim();
    const effEmail = emailContactoPareja.trim();
    if (effEmail !== (registration.emailContactoPareja || registration.c1Email || '').trim()) {
      modifiedUpdates.c1Email = effEmail;
      modifiedUpdates.c2Email = effEmail;
    }
    const effTel = telefonContactoPareja.trim();
    if (effTel !== (registration.telefonContactoPareja || registration.c1Telefon || '').trim()) {
      modifiedUpdates.c1Telefon = effTel;
      modifiedUpdates.c2Telefon = effTel;
    }
    if (c1Vol !== initC1Vol || c1Talla.trim() !== (registration.c1Talla || '').trim()) {
      modifiedUpdates.c1Talla = c1Vol ? c1Talla.trim() : '';
    }
    if (c1Vol !== initC1Vol || c1UniformeTipus !== (registration.c1UniformeTipus || '')) {
      modifiedUpdates.c1UniformeTipus = c1Vol ? c1UniformeTipus : null;
    }
    if (c1EsMenor !== Boolean(registration.c1EsMenor)) modifiedUpdates.c1EsMenor = c1EsMenor;
    if (c1TutorNom.trim() !== (registration.c1TutorNom || '').trim()) modifiedUpdates.c1TutorNom = c1TutorNom.trim();
    if (c1TutorCognoms.trim() !== (registration.c1TutorCognoms || '').trim()) modifiedUpdates.c1TutorCognoms = c1TutorCognoms.trim();
    if (c1TutorDni.trim() !== (registration.c1TutorDni || '').trim()) modifiedUpdates.c1TutorDni = c1TutorDni.trim();
    if (c1TutorTelefon.trim() !== (registration.c1TutorTelefon || '').trim()) modifiedUpdates.c1TutorTelefon = c1TutorTelefon.trim();

    if (c2Nom.trim() !== (registration.c2Nom || '').trim()) modifiedUpdates.c2Nom = c2Nom.trim();
    if (c2Cognoms.trim() !== (registration.c2Cognoms || '').trim()) modifiedUpdates.c2Cognoms = c2Cognoms.trim();
    if (c2Vol !== initC2Vol || c2Talla.trim() !== (registration.c2Talla || '').trim()) {
      modifiedUpdates.c2Talla = c2Vol ? c2Talla.trim() : '';
    }
    if (c2Vol !== initC2Vol || c2UniformeTipus !== (registration.c2UniformeTipus || '')) {
      modifiedUpdates.c2UniformeTipus = c2Vol ? c2UniformeTipus : null;
    }
    if (c2EsMenor !== Boolean(registration.c2EsMenor)) modifiedUpdates.c2EsMenor = c2EsMenor;
    if (c2TutorNom.trim() !== (registration.c2TutorNom || '').trim()) modifiedUpdates.c2TutorNom = c2TutorNom.trim();
    if (c2TutorCognoms.trim() !== (registration.c2TutorCognoms || '').trim()) modifiedUpdates.c2TutorCognoms = c2TutorCognoms.trim();
    if (c2TutorDni.trim() !== (registration.c2TutorDni || '').trim()) modifiedUpdates.c2TutorDni = c2TutorDni.trim();
    if (c2TutorTelefon.trim() !== (registration.c2TutorTelefon || '').trim()) modifiedUpdates.c2TutorTelefon = c2TutorTelefon.trim();

    if (breakdown.totalCalculat !== registration.preuCalculat) modifiedUpdates.preuCalculat = breakdown.totalCalculat;
    if (hasUnsavedPayments) {
      modifiedUpdates.pagaments = pagaments;
      modifiedUpdates.estatPagament = derivedEstat;
      modifiedUpdates.metodePagament = derivedMetode;
    }
    if (estatDni !== registration.estatDni) modifiedUpdates.estatDni = estatDni;
    if (entregaMaterial !== registration.entregaMaterial) modifiedUpdates.entregaMaterial = entregaMaterial;
    if (bandera !== registration.bandera) modifiedUpdates.bandera = bandera;

    if (c1Vol !== initC1Vol || c2Vol !== initC2Vol || c1Talla !== (registration.c1Talla || '') || c2Talla !== (registration.c2Talla || '')) {
      modifiedUpdates.seleccionsUniforme = updatedInscripcio.seleccionsUniforme;
    }

    // respostesCuestionari diff (send only changed keys)
    const diffResp: Record<string, any> = {};
    const oldResp = registration.respostesCuestionari || {};
    const newResp = updatedInscripcio.respostesCuestionari || {};
    for (const [k, v] of Object.entries(newResp)) {
      if (oldResp[k] !== v) {
        diffResp[k] = v;
      }
    }
    if (Object.keys(diffResp).length > 0) {
      modifiedUpdates.respostesCuestionari = diffResp;
    }

    setDbSaveStatus('saving');
    try {
      const saveRes: any = await onSave(updatedInscripcio, modifiedUpdates);
      if (saveRes && saveRes.ok === false) {
        setDbSaveStatus('error');
        setValidationError(saveRes.error || "Error al desar canvis");
        return;
      }
      setDbSaveStatus('success');
      setSaveSuccess(true);
      if (affectsEmail) {
        setMailEstat('pendent');
        setMailEnviat(false);
        setMailPendingResend(true);
      }
      const confirmed = (saveRes && saveRes.data) ? saveRes.data : updatedInscripcio;
      await handleSyncDrive(confirmed);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      setDbSaveStatus('error');
      setValidationError(err?.message || "Error al desar canvis a la base de dades");
    }
  };

  return (
    <div className="space-y-6" id="registration-detail-container">
      {/* Detail header toolbar */}
      <div className="flex flex-wrap justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow gap-3">
        <button 
          onClick={onBack}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          id="btn-ficha-back"
        >
          <ArrowLeft size={14} /> {language === 'ca' ? 'Tornar al taulell' : 'Volver al tablero'}
        </button>

        <div className="text-center">
          <span className="font-mono text-[9px] text-fuchsia-400 font-bold uppercase tracking-wider block mb-0.5">
            CODI DE SEGUIMENT (Editable)
          </span>
          <div className="flex items-center justify-center gap-2">
            <input 
              type="text"
              value={codiSeguiment}
              onChange={(e) => setCodiSeguiment(e.target.value.toUpperCase().trim())}
              className="font-sans font-extrabold text-base tracking-tight text-fuchsia-400 bg-zinc-800 border border-zinc-700 focus:border-fuchsia-500 rounded-lg px-2.5 py-0.5 text-center uppercase w-32 focus:outline-none"
              title={language === 'ca' ? "Editar codi de seguiment" : "Editar código de seguimiento"}
            />
            {codiSeguiment !== registration.codiSeguiment && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                {language === 'ca' ? `Antic: ${registration.codiSeguiment}` : `Antiguo: ${registration.codiSeguiment}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dbSaveStatus === 'success' && (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1">
              <Check size={13} /> Base de dades ✓
            </span>
          )}
          {driveSyncStatus === 'syncing' && (
            <span className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 animate-pulse">
              <RotateCw size={13} className="animate-spin" /> Drive...
            </span>
          )}
          {driveSyncStatus === 'success' && (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1">
              <Check size={13} /> Drive ✓
            </span>
          )}
          {driveSyncStatus === 'error' && (
            <button
              type="button"
              onClick={() => handleSyncDrive()}
              className="text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition"
              title={driveSyncError || "Error en sincronitzar amb Drive"}
            >
              <RefreshCw size={13} /> Drive ✗ ({language === 'ca' ? 'Reintentar' : 'Reintentar'})
            </button>
          )}

          <button 
            type="button"
            onClick={() => {
              setEmailSendStatus(null);
              setShowEmailModal(true);
            }}
            className={`text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer ${
              mailEnviat || mailEstat === 'enviat'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-fuchsia-300 border border-fuchsia-500/30'
                : 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black'
            }`}
            id="btn-ficha-email-resend"
            title={mailEnviat ? (language === 'ca' ? "Reenviar correu modificat" : "Reenviar correo modificado") : (language === 'ca' ? "Enviar correu de confirmació" : "Enviar correo de confirmación")}
          >
            <Send size={14} />
            {mailEnviat || mailEstat === 'enviat'
              ? (language === 'ca' ? "Reenviar correu modificat" : "Reenviar correo modificado")
              : (language === 'ca' ? "Enviar correu" : "Enviar correo")}
          </button>

          <button 
            onClick={handleGuardaCanvis}
            disabled={dbSaveStatus === 'saving'}
            className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
            id="btn-ficha-save"
          >
            {dbSaveStatus === 'saving' 
              ? (language === 'ca' ? "Desant..." : "Guardando...")
              : saveSuccess 
                ? (language === 'ca' ? "S'ha desat!" : "¡Guardado!") 
                : (language === 'ca' ? "Desar Canvis" : "Guardar Cambios")} <Save size={14} />
          </button>
        </div>
      </div>

      {/* Email metadata banner */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-zinc-400" />
          <span>
            {mailEnviat || mailEstat === 'enviat' ? (
              <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                <CheckCircle size={12} /> {language === 'ca' ? "Últim correu enviat:" : "Último correo enviado:"} {mailData ? `${new Date(mailData).toLocaleDateString('ca-ES')} ${new Date(mailData).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}` : '—'}
              </span>
            ) : mailEstat === 'fallat' ? (
              <span className="text-red-400 font-semibold inline-flex items-center gap-1">
                <AlertTriangle size={12} /> {language === 'ca' ? "Error en darrer enviament:" : "Error en último envío:"} {mailError || 'Error desconegut'}
              </span>
            ) : (
              <span className="text-amber-400 font-semibold inline-flex items-center gap-1">
                <Clock size={12} /> {language === 'ca' ? "Correu pendent d'enviar" : "Correo pendiente de enviar"}
              </span>
            )}
          </span>
        </div>
        {emailContactoPareja && (
          <span className="text-zinc-400 text-[11px]">
            {language === 'ca' ? "Destinatari:" : "Destinatario:"} <strong className="text-zinc-200">{emailContactoPareja}</strong>
          </span>
        )}
      </div>

      {mailPendingResend && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-600 shrink-0" size={18} />
            <div>
              <span className="font-bold text-xs block">
                {language === 'ca' ? "Canvis desats: Correu pendent de reenviar" : "Cambios guardados: Correo pendiente de reenviar"}
              </span>
              <span className="text-[11px] text-amber-700">
                {language === 'ca' 
                  ? "S'han modificat dades de la inscripció (materials, import, contacte o esmorzar). Podeu reenviar el correu amb les dades actualitzades."
                  : "Se han modificado datos de la inscripción (materiales, importe, contacto o almuerzo). Puede reenviar el correo con los datos actualizados."}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={isSendingModifiedEmail}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Send size={13} />
            {isSendingModifiedEmail 
              ? (language === 'ca' ? "Enviant..." : "Enviando...") 
              : (language === 'ca' ? "Reenviar correu modificat" : "Reenviar correo modificado")}
          </button>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-2xl font-semibold flex items-center gap-2">
          <ShieldCheck size={20} className="text-green-600 animate-bounce" />
          <span>
            {language === 'ca' 
              ? "Ficha d'inscripció actualitzada i guardada correctament al sistema de l'entitat!"
              : "¡Ficha de inscripción actualizada y guardada correctamente en el sistema de la entidad!"}
          </span>
        </div>
      )}

      {validationError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-center gap-2 font-mono">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: General Profile and Registration Data */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-6">
            
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase font-bold font-mono text-zinc-500">
                  {language === 'ca' ? 'CATEGORIA (Editable):' : 'CATEGORÍA (Editable):'}
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as CategoriaParella)}
                  className="text-xs font-bold font-sans bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg px-2.5 py-1 text-zinc-900 cursor-pointer focus:outline-none"
                >
                  <option value={CategoriaParella.ADULT}>ADULT</option>
                  <option value={CategoriaParella.JUVENIL}>JUVENIL</option>
                </select>
              </div>
              <span className="font-sans font-bold text-zinc-700 text-sm">
                {language === 'ca' ? "Informació dels Participants" : "Información de los Participantes"}
              </span>
            </div>

            {/* Dades de Contacte de la Parella (Únic) */}
            <div className="bg-fuchsia-50/50 border border-fuchsia-200/80 rounded-2xl p-4.5 space-y-2 mb-4" id="couple-contact-card">
              <div className="flex items-center justify-between pb-1 border-b border-fuchsia-200/60">
                <span className="text-xs font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
                  <Phone size={13} className="text-fuchsia-600" />
                  {language === 'ca' ? 'Dades de Contacte de la Parella (Únic)' : 'Datos de Contacto de la Pareja (Único)'}
                </span>
                <span className="text-[9px] font-mono font-bold text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded-md">
                  {language === 'ca' ? 'Comú per a la parella' : 'Común para la pareja'}
                </span>
              </div>
              <div className="pt-1 space-y-3">
                <div>
                  <label className="block text-[10px] text-zinc-600 font-bold uppercase font-mono mb-1">
                    {language === 'ca' ? 'Correu electrònic *' : 'Correo electrónico *'}
                  </label>
                  <input 
                    type="email" 
                    value={emailContactoPareja} 
                    onChange={(e) => setEmailContactoPareja(e.target.value)}
                    className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold font-sans focus:outline-none truncate" 
                    placeholder={language === 'ca' ? 'Ex. parella@gmail.com' : 'Ej. pareja@gmail.com'}
                    id="admin-input-couple-email"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-600 font-bold uppercase font-mono mb-1">
                    {language === 'ca' ? 'Telèfon de contacte' : 'Teléfono de contacto'}
                  </label>
                  <input 
                    type="tel" 
                    value={telefonContactoPareja} 
                    onChange={(e) => setTelefonContactoPareja(e.target.value)}
                    className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold font-sans focus:outline-none truncate" 
                    placeholder="—"
                    id="admin-input-couple-phone"
                  />
                </div>
              </div>
            </div>

            {/* Participants mirror block cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Comparser 1 profile card */}
              <div className="bg-zinc-50 rounded-2xl p-4.5 border border-zinc-200/60 space-y-3 relative overflow-hidden" id="c1-profile-card">
                <span className="absolute top-2 right-2 text-[10px] text-zinc-400 font-mono font-bold">C1 (Editable)</span>
                
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Nom</label>
                      <input 
                        type="text" 
                        value={c1Nom} 
                        onChange={(e) => setC1Nom(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Cognoms</label>
                      <input 
                        type="text" 
                        value={c1Cognoms} 
                        onChange={(e) => setC1Cognoms(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Correu P1</label>
                      <input 
                        type="email" 
                        value={c1Email} 
                        onChange={(e) => setC1Email(e.target.value)}
                        placeholder={emailContactoPareja}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Telèfon P1</label>
                      <input 
                        type="tel" 
                        value={c1Telefon} 
                        onChange={(e) => setC1Telefon(e.target.value)}
                        placeholder={telefonContactoPareja}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-sans focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-zinc-150">
                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={c1Vol}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setC1Vol(checked);
                          if (!checked) {
                            setC1Talla('');
                          }
                        }}
                        className="rounded border-zinc-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                      />
                      <span>{language === 'ca' ? 'Vol armilla (Comparser 1)' : 'Quiere chaleco (Comparser 1)'}</span>
                    </label>

                    {c1Vol && (
                      <div className="grid grid-cols-2 gap-1.5 p-2 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100">
                        <div>
                          <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Talla</label>
                          <select
                            value={c1Talla}
                            onChange={(e) => setC1Talla(e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold font-sans focus:outline-none cursor-pointer"
                          >
                            <option value="">{language === 'ca' ? '-- Tria talla --' : '-- Elige talla --'}</option>
                            <option value="XS">XS</option>
                            <option value="S">S</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                            <option value="XXL">XXL</option>
                            <option value="3XL">3XL</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Adquisició</label>
                          <select
                            value={c1UniformeTipus || 'compra'}
                            onChange={(e) => setC1UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                            className="w-full bg-white border border-[#ff0090]/40 rounded-lg px-2 py-1.5 text-xs font-bold text-[#ff0090] font-sans focus:outline-none cursor-pointer"
                          >
                            <option value="compra">{language === 'ca' ? 'Compra' : 'Compra (Venta)'}</option>
                            <option value="lloguer">{language === 'ca' ? 'Lloguer (Alquiler)' : 'Alquiler'}</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-zinc-150">
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={c1EsMenor}
                        onChange={(e) => setC1EsMenor(e.target.checked)}
                        className="rounded border-zinc-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                      />
                      <span>{language === 'ca' ? 'És menor d’edat' : 'Es menor de edad'}</span>
                    </label>

                    {c1EsMenor && (
                      <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2.5 space-y-2 mt-1">
                        <span className="block text-[8px] font-mono text-amber-800 uppercase font-black tracking-wider">TUTOR (Editable):</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">Nom</label>
                            <input 
                              type="text" 
                              value={c1TutorNom} 
                              onChange={(e) => setC1TutorNom(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">Cognoms</label>
                            <input 
                              type="text" 
                              value={c1TutorCognoms} 
                              onChange={(e) => setC1TutorCognoms(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">DNI</label>
                            <input 
                              type="text" 
                              value={c1TutorDni} 
                              onChange={(e) => setC1TutorDni(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">Mòbil</label>
                            <input 
                              type="tel" 
                              value={c1TutorTelefon} 
                              onChange={(e) => setC1TutorTelefon(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Comparser 2 profile card */}
              <div className="bg-zinc-50 rounded-2xl p-4.5 border border-zinc-200/60 space-y-3 relative overflow-hidden" id="c2-profile-card">
                <span className="absolute top-2 right-2 text-[10px] text-zinc-400 font-mono font-bold">C2 (Editable)</span>
                
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Nom</label>
                      <input 
                        type="text" 
                        value={c2Nom} 
                        onChange={(e) => setC2Nom(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Cognoms</label>
                      <input 
                        type="text" 
                        value={c2Cognoms} 
                        onChange={(e) => setC2Cognoms(e.target.value)}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-bold font-sans focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Correu P2</label>
                      <input 
                        type="email" 
                        value={c2Email} 
                        onChange={(e) => setC2Email(e.target.value)}
                        placeholder={emailContactoPareja}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-sans focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Telèfon P2</label>
                      <input 
                        type="tel" 
                        value={c2Telefon} 
                        onChange={(e) => setC2Telefon(e.target.value)}
                        placeholder={telefonContactoPareja}
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-lg px-2.5 py-1.5 text-xs font-sans focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-zinc-150">
                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={c2Vol}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setC2Vol(checked);
                          if (!checked) {
                            setC2Talla('');
                          }
                        }}
                        className="rounded border-zinc-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                      />
                      <span>{language === 'ca' ? 'Vol armilla (Comparser 2)' : 'Quiere chaleco (Comparser 2)'}</span>
                    </label>

                    {c2Vol && (
                      <div className="grid grid-cols-2 gap-1.5 p-2 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100">
                        <div>
                          <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Talla</label>
                          <select
                            value={c2Talla}
                            onChange={(e) => setC2Talla(e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold font-sans focus:outline-none cursor-pointer"
                          >
                            <option value="">{language === 'ca' ? '-- Tria talla --' : '-- Elige talla --'}</option>
                            <option value="XS">XS</option>
                            <option value="S">S</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                            <option value="XXL">XXL</option>
                            <option value="3XL">3XL</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Adquisició</label>
                          <select
                            value={c2UniformeTipus || 'compra'}
                            onChange={(e) => setC2UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                            className="w-full bg-white border border-[#ff0090]/40 rounded-lg px-2 py-1.5 text-xs font-bold text-[#ff0090] font-sans focus:outline-none cursor-pointer"
                          >
                            <option value="compra">{language === 'ca' ? 'Compra' : 'Compra (Venta)'}</option>
                            <option value="lloguer">{language === 'ca' ? 'Lloguer (Alquiler)' : 'Alquiler'}</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-zinc-150">
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={c2EsMenor}
                        onChange={(e) => setC2EsMenor(e.target.checked)}
                        className="rounded border-zinc-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                      />
                      <span>{language === 'ca' ? 'És menor d’edat' : 'Es menor de edad'}</span>
                    </label>

                    {c2EsMenor && (
                      <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2.5 space-y-2 mt-1">
                        <span className="block text-[8px] font-mono text-amber-800 uppercase font-black tracking-wider">TUTOR (Editable):</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">Nom</label>
                            <input 
                              type="text" 
                              value={c2TutorNom} 
                              onChange={(e) => setC2TutorNom(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">Cognoms</label>
                            <input 
                              type="text" 
                              value={c2TutorCognoms} 
                              onChange={(e) => setC2TutorCognoms(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none" 
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">DNI</label>
                            <input 
                              type="text" 
                              value={c2TutorDni} 
                              onChange={(e) => setC2TutorDni(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] text-zinc-400 uppercase font-mono">Mòbil</label>
                            <input 
                              type="tel" 
                              value={c2TutorTelefon} 
                              onChange={(e) => setC2TutorTelefon(e.target.value)} 
                              className="w-full bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none" 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Complements i Extres: Clavells i Corbatí */}
            <div className="bg-zinc-50 rounded-2xl p-4.5 border border-zinc-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-sans font-black text-xs text-zinc-700 uppercase tracking-wider block">
                  {language === 'ca' ? "Complements i Extres (Editables)" : "Complementos y Extras (Editables)"}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {language === 'ca' ? "Clavells: 8€ / Corbatí: 10€" : "Claveles: 8€ / Pajarita: 10€"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800">
                      {language === 'ca' ? "Clavells" : "Claveles"}
                    </label>
                    <span className="text-[10px] text-zinc-400 font-mono">8,00 € / unitat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setClavellsQty(Math.max(0, clavellsQty - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold cursor-pointer"
                    >-</button>
                    <input 
                      type="number"
                      min="0"
                      value={clavellsQty}
                      onChange={(e) => setClavellsQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-14 text-center font-mono font-bold text-sm bg-zinc-50 border border-zinc-200 rounded-lg py-1 focus:outline-none focus:border-fuchsia-500"
                    />
                    <button
                      type="button"
                      onClick={() => setClavellsQty(clavellsQty + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold cursor-pointer"
                    >+</button>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800">
                      {language === 'ca' ? "Corbatí" : "Pajarita"}
                    </label>
                    <span className="text-[10px] text-zinc-400 font-mono">10,00 € / unitat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorbatiQty(Math.max(0, corbatiQty - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold cursor-pointer"
                    >-</button>
                    <input 
                      type="number"
                      min="0"
                      value={corbatiQty}
                      onChange={(e) => setCorbatiQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-14 text-center font-mono font-bold text-sm bg-zinc-50 border border-zinc-200 rounded-lg py-1 focus:outline-none focus:border-fuchsia-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCorbatiQty(corbatiQty + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold cursor-pointer"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Itemized Breakdown Table (Single Source of Truth) */}
            <div className="space-y-3 border-t border-zinc-100 pt-5">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="font-sans font-bold text-zinc-800 text-sm block">
                  {language === 'ca' ? "Desglossament Oficial de Materials i Quota" : "Desglose Oficial de Materiales y Cuota"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRecalcularEsmorzar}
                    disabled={!canRecalcularEsmorzar}
                    title={!canRecalcularEsmorzar ? (language === 'ca' ? "Cap esmorzar amb preu" : "Ningún almuerzo con precio") : undefined}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl transition border ${
                      canRecalcularEsmorzar
                        ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 shadow-xs cursor-pointer'
                        : 'bg-zinc-100/50 text-zinc-400 border-zinc-200 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <RefreshCw size={12} className={canRecalcularEsmorzar ? "text-fuchsia-600" : ""} />
                    {language === 'ca' ? "Recalcular esmorzar amb els preus actuals" : "Recalcular almuerzo con los precios actuales"}
                  </button>
                  <span className="text-xs font-mono font-bold text-fuchsia-600 bg-fuchsia-50 px-2.5 py-1 rounded-lg border border-fuchsia-200">
                    {formatEuro(breakdown.totalCalculat)} Total
                  </span>
                </div>
              </div>

              {!validation.valid && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">
                      {language === 'ca' ? "Avís de discrepància de preu:" : "Aviso de discrepancia de precio:"}
                    </strong>
                    <span>{validation.errorMessage}</span>
                  </div>
                </div>
              )}

              <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                      <th className="py-2.5 px-3">{language === 'ca' ? 'Concepte / Material' : 'Concepto / Material'}</th>
                      <th className="py-2.5 px-2 text-center">{language === 'ca' ? 'Quant.' : 'Cant.'}</th>
                      <th className="py-2.5 px-2 text-center">{language === 'ca' ? 'Modalitat' : 'Modalidad'}</th>
                      <th className="py-2.5 px-2 text-right">{language === 'ca' ? 'Preu unitari' : 'Precio unitario'}</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-zinc-900">
                        {language === 'ca' ? 'Quota d’inscripció' : 'Cuota de inscripción'} <span className="font-normal text-zinc-500 text-[11px]">({breakdown.categoriaNom})</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">1</td>
                      <td className="py-2.5 px-2 text-center text-zinc-500 text-[11px]">{language === 'ca' ? 'Oficial' : 'Oficial'}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-zinc-600">{breakdown.categoriaQuotaBase}€</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">{breakdown.categoriaQuotaBase}€</td>
                    </tr>
                    {breakdown.materials.map(mat => (
                      <tr key={mat.id}>
                        <td className="py-2.5 px-3 font-semibold text-zinc-800">{mat.nom}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-fuchsia-600">{mat.quantitat}</td>
                        <td className="py-2.5 px-2 text-center text-zinc-500 text-[11px]">{mat.modalitat}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-zinc-600">{mat.preuUnitari}€</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">{mat.subtotal}€</td>
                      </tr>
                    ))}
                    {breakdown.materials.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-center text-zinc-400 italic text-[11px]">
                          {language === 'ca' ? "Sense materials o complements addicionals seleccionats" : "Sin materiales o complementos adicionales seleccionados"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-fuchsia-50/70 border-t-2 border-fuchsia-500 text-zinc-900 font-bold">
                      <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wider text-xs font-black">
                        {language === 'ca' ? 'TOTAL CALCULAT:' : 'TOTAL CALCULADO:'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-base text-fuchsia-600">
                        {breakdown.totalCalculat}€
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Dynamic & Configured Questions Section (Editable from Ficha) */}
            <div className="space-y-4 pt-2 border-t border-zinc-100">
              <DynamicQuestionsSection
                preguntesList={preguntesList}
                respostesCuestionari={respostesCuestionari}
                onAnswerChange={(qId, val, scope) => {
                  const q = preguntesList.find(p => p.id === qId);
                  const k = q ? answerKey(q, scope) : (scope === 'parella' ? qId : `${qId}__${scope}`);
                  setRespostesCuestionari(prev => ({
                    ...prev,
                    [k]: val === false ? 'No' : (val === true ? 'Sí' : val)
                  }));
                }}
                errors={{}}
                c1Nom={c1Nom}
                c1Cognoms={c1Cognoms}
                c2Nom={c2Nom}
                c2Cognoms={c2Cognoms}
                titolFormulariDinamic={language === 'ca' ? "Qüestionari Comparsiler (Editable)" : "Cuestionario Comparsiler (Editable)"}
                cuestionariActiu={true}
              />
            </div>

            {/* Other recorded questionnaire responses if any exist */}
            {(() => {
              const FORBIDDEN_KEYS = new Set([
                'estatCorreu', 'domas_qty', 'mocadors_qty', 'correuContacteParella',
                'telefonContacteParella', 'emailContactoPareja', 'telefonContactoPareja',
                'teDomasBalco', 'teMocadorsExtra', 'clavells_qty', 'corbati_qty', 'esmorzar_qty',
                'extresSeleccionats', 'extres_seleccionats', 'extres', 'mailEnviat', 'mailData', 'mailError', 'mailEstat', 'dataUltimCorreu'
              ]);
              const rawAnswers = respostesCuestionari || {};
              const handledKeys = new Set<string>();
              for (const q of (preguntesList || [])) {
                handledKeys.add(q.id);
                handledKeys.add(`${q.id}__c1`);
                handledKeys.add(`${q.id}__c2`);
              }

              const legacyEntries = Object.entries(rawAnswers).filter(([k, v]) => {
                if (FORBIDDEN_KEYS.has(k) || handledKeys.has(k) || k.startsWith('extra_qty_') || k.startsWith('_')) return false;
                if (v === undefined || v === null || v === '') return false;
                if (typeof v === 'object') return false;
                const s = String(v).trim().toLowerCase();
                return s !== 'fallat' && s !== 'sense resposta' && s !== 'sin respuesta';
              });

              if (legacyEntries.length === 0) return null;

              return (
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60 text-xs space-y-2">
                  <span className="font-mono text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
                    {language === 'ca' ? "Altres respostes registrades:" : "Otras respuestas registradas:"}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {legacyEntries.map(([k, val]) => (
                      <div key={k} className="p-2 bg-white rounded-lg border border-zinc-150">
                        <span className="font-bold text-zinc-700 block text-[11px]">{k}:</span>
                        <span className="text-zinc-600 font-mono text-[11px]">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* DNI auditing stage documents layout */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="font-sans font-bold text-zinc-700 text-sm flex items-center gap-1.5">
                <FileText size={16} className="text-fuchsia-500" />
                {language === 'ca' ? "Auditoria de Documents (DNI / NIE)" : "Auditoría de Documentos (DNI / NIE)"}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono uppercase">
                {language === 'ca' ? "Control de legibilitat i descàrrega" : "Control de legibilidad y descarga"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* DNI Comparser 1 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-800 font-bold font-mono">
                    DNI {registration.c1Nom} {registration.c1Cognoms}
                  </span>
                  {c1RawPath || c1DniUrl ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check size={10} /> {language === 'ca' ? "DNI adjuntat" : "DNI adjuntado"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle size={10} /> {language === 'ca' ? "DNI no adjuntat" : "DNI no adjuntado"}
                    </span>
                  )}
                </div>

                {/* Buttons for Participant 1 */}
                {c1RawPath || c1DniUrl ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => openDniInNewTab(c1DniUrl, c1RawPath)}
                      className="p-1.5 px-3 bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                      title={language === 'ca' ? "Obrir DNI en pestanya nova" : "Abrir DNI en pestaña nueva"}
                    >
                      <ExternalLink size={13} /> {language === 'ca' ? "Veure DNI participant 1" : "Ver DNI participante 1"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => downloadDniFile(c1DniUrl, c1RawPath, 1, c1Nom)}
                      className="p-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                      title={language === 'ca' ? "Descarregar document DNI" : "Descargar documento DNI"}
                    >
                      <Download size={13} /> {language === 'ca' ? "Descarregar DNI" : "Descargar DNI"}
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={rotateImage1}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] inline-flex items-center gap-1 transition"
                        title={language === 'ca' ? "Rotar 90 graus" : "Rotar 90 grados"}
                      >
                        <RotateCw size={12} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActiveZoomUrl(c1DniUrl)}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] inline-flex items-center gap-1 transition"
                        title={language === 'ca' ? "Ampliar imatge" : "Ampliar imagen"}
                      >
                        <ZoomIn size={12} />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Preview Box 1 */}
                {c1RawPath || c1DniUrl ? (
                  <div 
                    className="aspect-[1.58] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 relative cursor-zoom-in flex items-center justify-center"
                    onClick={() => c1DniUrl && setActiveZoomUrl(c1DniUrl)}
                  >
                    {loadingDni1 ? (
                      <div className="flex flex-col items-center gap-2 text-zinc-400 text-xs">
                        <RefreshCw size={20} className="animate-spin text-fuchsia-500" />
                        <span>{language === 'ca' ? "Carregant document..." : "Cargando documento..."}</span>
                      </div>
                    ) : dni1Error ? (
                      <div className="flex flex-col items-center gap-2 text-center p-4">
                        <span className="text-amber-400 text-xs font-semibold">DNI no disponible</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveDni1(c1RawPath);
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={10} /> Reintentar
                        </button>
                      </div>
                    ) : c1DniUrl ? (
                      <>
                        <img 
                          src={c1DniUrl} 
                          alt={`DNI ${c1Nom}`} 
                          style={{ transform: `rotate(${rotacio1}deg)` }}
                          className="object-contain w-full h-full transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            setDni1Error("DNI no disponible");
                          }}
                        />
                        <div className="absolute inset-0 bg-black/5 hover:bg-black/25 transition-colors" />
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveDni1(c1RawPath);
                        }}
                        className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <RefreshCw size={12} /> {language === 'ca' ? "Carregar DNI" : "Cargar DNI"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="aspect-[1.58] bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center p-4 text-center">
                    <FileText size={32} className="text-zinc-300 mb-2" />
                    <span className="text-xs font-bold text-zinc-600">
                      {language === 'ca' ? "DNI no adjuntat" : "DNI no adjuntado"}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      {language === 'ca' ? "Aquest participant no ha pujat cap arxiu de document" : "Este participante no ha subido ningún archivo de documento"}
                    </span>
                  </div>
                )}
              </div>

              {/* DNI Comparser 2 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-800 font-bold font-mono">
                    DNI {registration.c2Nom} {registration.c2Cognoms}
                  </span>
                  {c2RawPath || c2DniUrl ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check size={10} /> {language === 'ca' ? "DNI adjuntat" : "DNI adjuntado"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle size={10} /> {language === 'ca' ? "DNI no adjuntat" : "DNI no adjuntado"}
                    </span>
                  )}
                </div>

                {/* Buttons for Participant 2 */}
                {c2RawPath || c2DniUrl ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => openDniInNewTab(c2DniUrl, c2RawPath)}
                      className="p-1.5 px-3 bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                      title={language === 'ca' ? "Obrir DNI en pestanya nova" : "Abrir DNI en pestaña nueva"}
                    >
                      <ExternalLink size={13} /> {language === 'ca' ? "Veure DNI participant 2" : "Ver DNI participante 2"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => downloadDniFile(c2DniUrl, c2RawPath, 2, c2Nom)}
                      className="p-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                      title={language === 'ca' ? "Descarregar document DNI" : "Descargar documento DNI"}
                    >
                      <Download size={13} /> {language === 'ca' ? "Descarregar DNI" : "Descargar DNI"}
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={rotateImage2}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] inline-flex items-center gap-1 transition"
                        title={language === 'ca' ? "Rotar 90 graus" : "Rotar 90 grados"}
                      >
                        <RotateCw size={12} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActiveZoomUrl(c2DniUrl)}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] inline-flex items-center gap-1 transition"
                        title={language === 'ca' ? "Ampliar imatge" : "Ampliar imagen"}
                      >
                        <ZoomIn size={12} />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Preview Box 2 */}
                {c2RawPath || c2DniUrl ? (
                  <div 
                    className="aspect-[1.58] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 relative cursor-zoom-in flex items-center justify-center"
                    onClick={() => c2DniUrl && setActiveZoomUrl(c2DniUrl)}
                  >
                    {loadingDni2 ? (
                      <div className="flex flex-col items-center gap-2 text-zinc-400 text-xs">
                        <RefreshCw size={20} className="animate-spin text-fuchsia-500" />
                        <span>{language === 'ca' ? "Carregant document..." : "Cargando documento..."}</span>
                      </div>
                    ) : dni2Error ? (
                      <div className="flex flex-col items-center gap-2 text-center p-4">
                        <span className="text-amber-400 text-xs font-semibold">DNI no disponible</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveDni2(c2RawPath);
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={10} /> Reintentar
                        </button>
                      </div>
                    ) : c2DniUrl ? (
                      <>
                        <img 
                          src={c2DniUrl} 
                          alt={`DNI ${c2Nom}`} 
                          style={{ transform: `rotate(${rotacio2}deg)` }}
                          className="object-contain w-full h-full transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            setDni2Error("DNI no disponible");
                          }}
                        />
                        <div className="absolute inset-0 bg-black/5 hover:bg-black/25 transition-colors" />
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveDni2(c2RawPath);
                        }}
                        className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <RefreshCw size={12} /> {language === 'ca' ? "Carregar DNI" : "Cargar DNI"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="aspect-[1.58] bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center p-4 text-center">
                    <FileText size={32} className="text-zinc-300 mb-2" />
                    <span className="text-xs font-bold text-zinc-600">
                      {language === 'ca' ? "DNI no adjuntat" : "DNI no adjuntado"}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      {language === 'ca' ? "Aquest participant no ha pujat cap arxiu de document" : "Este participante no ha subido ningún archivo de documento"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Toggles, Auditing Controls and Checkout state */}
        <div className="space-y-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 text-white shadow space-y-6">
            <h3 className="font-sans font-black text-base text-fuchsia-400 pb-3 border-b border-zinc-900 tracking-tight flex items-center gap-2">
              <Sparkles size={16} /> {language === 'ca' ? "Controles i Semàfors de Mesa" : "Controles y Semáforos de Mesa"}
            </h3>

            {/* Segment: Estat i Posició de la Inscripció (Semàfor interactiu i sincronitzat) */}
            <div className="space-y-2 pb-4 border-b border-zinc-900" id="segment-estat-semafor">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                  {language === 'ca' ? "Estat de la Inscripció" : "Estado de la Inscripción"}
                </label>
                {registration.posicioGlobal && (
                  <span className="font-mono text-zinc-300 text-xs font-black bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-zinc-800">
                    Posició: #{registration.posicioGlobal}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(false)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    !isWaitlist
                      ? 'bg-emerald-600 text-white border border-emerald-500 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 border border-zinc-800'
                  }`}
                >
                  🟢 {language === 'ca' ? "Inscripció Oberta" : "Inscripción Abierta"}
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(true)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isWaitlist
                      ? 'bg-amber-500 text-white border border-amber-400 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850 border border-zinc-800'
                  }`}
                >
                  🟡 {language === 'ca' ? "Llista d'Espera" : "Lista de Espera"}
                </button>
              </div>
            </div>

            {/* Segment: Bandera (Flag) Assignada */}
            <div className="space-y-2 pb-4 border-b border-zinc-900" id="segment-ficha-bandera">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "Bandera de la Parella" : "Bandera de la Pareja"}
              </label>
              <div className="relative">
                <select
                  value={bandera}
                  onChange={(e) => setBandera(Number(e.target.value))}
                  className={`w-full font-sans font-extrabold text-xs uppercase px-3.5 py-2.5 rounded-xl border border-zinc-800 outline-none cursor-pointer tracking-wider ${
                    bandera === 1
                      ? 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-700'
                      : bandera === 2
                      ? 'bg-yellow-950 text-yellow-300 border-yellow-700'
                      : bandera === 3
                      ? 'bg-blue-950 text-blue-300 border-blue-700'
                      : 'bg-zinc-900 text-zinc-350 border-zinc-800 hover:bg-zinc-850'
                  }`}
                  id="select-ficha-bandera"
                >
                  <option value="0">{language === 'ca' ? 'No assignat (0)' : 'No asignado (0)'}</option>
                  <option value="1">Bandera BOSS (1)</option>
                  <option value="2">Bandera No ni na (2)</option>
                  <option value="3">Bandera juvenil (3)</option>
                </select>
              </div>
            </div>

            {/* Segment 1: Verified DNI */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "DNI Validat per Secretaria" : "DNI Validado por Secretaría"}
              </label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setEstatDni(EstatVerificacio.PENDENT)}
                  className={`py-2 rounded-xl text-center text-[10px] font-bold tracking-tight block ${
                    estatDni === EstatVerificacio.PENDENT 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  {language === 'ca' ? "Pendent" : "Pendiente"}
                </button>
                <button
                  type="button"
                  onClick={() => setEstatDni(EstatVerificacio.VALIDAT)}
                  className={`py-2 rounded-xl text-center text-[10px] font-bold tracking-tight block ${
                    estatDni === EstatVerificacio.VALIDAT 
                      ? 'bg-green-600 text-white' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  {language === 'ca' ? "VALIDAT" : "VALIDADO"}
                </button>
                <button
                  type="button"
                  onClick={() => setEstatDni(EstatVerificacio.REBUTJAT)}
                  className={`py-2 rounded-xl text-center text-[10px] font-bold tracking-tight block ${
                    estatDni === EstatVerificacio.REBUTJAT 
                      ? 'bg-red-600 text-white' 
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  {language === 'ca' ? "REBUTJAT" : "RECHAZADO"}
                </button>
              </div>
            </div>

            {/* Segment 2: Gestió de Pagaments Parcials i Pagament Total */}
            <div className="space-y-4 border-t border-zinc-900 pt-4" id="segment-pagaments">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Coins size={16} className="text-amber-400" />
                  <label className="text-[11px] font-black text-zinc-300 uppercase tracking-wider font-mono">
                    {language === 'ca' ? "Gestió de Pagaments" : "Gestión de Pagos"}
                  </label>
                  {(hasUnsavedPayments || hasUnsavedExtres) && (
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                      ⚠️ {hasUnsavedExtres 
                        ? (language === 'ca' ? "Canvis en esmorzar sense desar" : "Cambios en almuerzo sin guardar")
                        : (language === 'ca' ? "Pagaments sense desar" : "Pagos sin guardar")}
                    </span>
                  )}
                </div>

                {/* Badge of derived status */}
                <div>
                  {paymentSummary.estat === 'PAGAT' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      <Check size={12} /> {language === 'ca' ? "PAGAT" : "PAGADO"}
                    </span>
                  )}
                  {paymentSummary.estat === 'PARCIAL' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      {language === 'ca' ? "PAGAMENT PARCIAL" : "PAGO PARCIAL"}
                    </span>
                  )}
                  {paymentSummary.estat === 'PENDENT' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      {language === 'ca' ? "PENDENT DE PAGAR" : "PENDIENTE DE PAGO"}
                    </span>
                  )}
                  {paymentSummary.estat === 'SOBREPAGAT' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">
                      <AlertTriangle size={12} /> {language === 'ca' ? "SOBREPAGAT" : "SOBREPAGADO"}
                    </span>
                  )}
                </div>
              </div>

              {/* Three figures header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-zinc-950/70 p-3.5 rounded-2xl border border-zinc-900">
                <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-850 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                      {language === 'ca' ? "Import Total" : "Importe Total"}
                    </span>
                    <p className="text-base font-mono font-black text-white mt-0.5">
                      {formatEuro(paymentSummary.total)}
                    </p>
                    {registration.preuCalculat !== breakdown.totalCalculat && (
                      <span className="text-[9px] font-mono text-amber-400 block mt-0.5" title="Diferència amb la base de dades">
                        ⚠️ DB: {formatEuro(registration.preuCalculat)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 pt-1 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={handleRecalcularEsmorzar}
                      disabled={!canRecalcularEsmorzar}
                      title={!canRecalcularEsmorzar ? (language === 'ca' ? "Cap esmorzar amb preu" : "Ningún almuerzo con precio") : (language === 'ca' ? "Recalcular desglose i total amb els preus actuals" : "Recalcular desglose y total con los precios actuales")}
                      className={`w-full inline-flex items-center justify-center gap-1 text-[9px] font-bold px-1.5 py-1 rounded-md border transition ${
                        canRecalcularEsmorzar
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-fuchsia-300 border-zinc-700 cursor-pointer'
                          : 'bg-zinc-900 text-zinc-600 border-zinc-850 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <RefreshCw size={9} />
                      {language === 'ca' ? "Recalcular" : "Recalcular"}
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-850">
                  <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                    {language === 'ca' ? "Pagat" : "Pagado"}
                  </span>
                  <p className="text-base font-mono font-black text-emerald-400 mt-0.5">
                    {formatEuro(paymentSummary.pagat)}
                  </p>
                  <span className="text-[9px] font-mono text-zinc-500 block mt-0.5">
                    {paymentSummary.pagaments.length} {paymentSummary.pagaments.length === 1 ? (language === 'ca' ? 'ingrés' : 'ingreso') : (language === 'ca' ? 'ingressos' : 'ingresos')}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  paymentSummary.sobrepagat > 0
                    ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                    : paymentSummary.pendent > 0
                      ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                      : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                }`}>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider block opacity-80">
                    {paymentSummary.sobrepagat > 0 
                      ? (language === 'ca' ? "Sobrepagat" : "Sobrepagado") 
                      : (language === 'ca' ? "Resta per Pagar" : "Resta por Pagar")}
                  </span>
                  <p className="text-base font-mono font-black mt-0.5">
                    {paymentSummary.sobrepagat > 0
                      ? `+${formatEuro(paymentSummary.sobrepagat)}`
                      : formatEuro(paymentSummary.pendent)}
                  </p>
                  <span className="text-[9px] font-mono block mt-0.5 opacity-80">
                    {paymentSummary.sobrepagat > 0 
                      ? (language === 'ca' ? "Excedent a retornar" : "Excedente a devolver")
                      : paymentSummary.pendent === 0 
                        ? (language === 'ca' ? "Completat al 100%" : "Completado al 100%")
                        : (language === 'ca' ? "Pendent de liquidar" : "Pendiente de liquidar")}
                  </span>
                </div>
              </div>

              {/* Form "Afegir pagament" */}
              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-200 tracking-tight flex items-center gap-1.5">
                    <Plus size={14} className="text-amber-400" />
                    {language === 'ca' ? "Registrar un nou pagament" : "Registrar un nuevo pago"}
                  </span>
                  {paymentSummary.pendent > 0 && (
                    <button
                      type="button"
                      onClick={() => setNouImport(paymentSummary.pendent.toFixed(2).replace('.', ','))}
                      className="text-[11px] font-mono font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer self-start sm:self-auto"
                      id="btn-cobrar-pendent"
                    >
                      {language === 'ca' ? `Cobrar el que resta (${formatEuro(paymentSummary.pendent)})` : `Cobrar lo que resta (${formatEuro(paymentSummary.pendent)})`}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Amount input */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      {language === 'ca' ? "Import (€) *" : "Importe (€) *"}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={nouImport}
                        onChange={(e) => setNouImport(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-400 focus:bg-black rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                        id="input-nou-import"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-zinc-500">€</span>
                    </div>
                  </div>

                  {/* Method select */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      {language === 'ca' ? "Mètode *" : "Método *"}
                    </label>
                    <select
                      value={nouMetode}
                      onChange={(e) => setNouMetode(e.target.value as MetodePagament)}
                      className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-400 focus:bg-black rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
                      id="select-nou-metode"
                    >
                      <option value={MetodePagament.EFECTIU}>{language === 'ca' ? "Efectiu" : "Efectivo"}</option>
                      <option value={MetodePagament.BIZUM}>Bizum Colla</option>
                    </select>
                  </div>

                  {/* Date input */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      {language === 'ca' ? "Data *" : "Fecha *"}
                    </label>
                    <input
                      type="date"
                      value={novaData}
                      onChange={(e) => setNovaData(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-400 focus:bg-black rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-none"
                      id="input-nova-data"
                    />
                  </div>

                  {/* Optional Note */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      {language === 'ca' ? "Nota (opcional)" : "Nota (opcional)"}
                    </label>
                    <input
                      type="text"
                      value={novaNota}
                      onChange={(e) => setNovaNota(e.target.value)}
                      placeholder={language === 'ca' ? "Ex: Bestreta, sobre..." : "Ej: Anticipo, sobre..."}
                      className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-400 focus:bg-black rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      id="input-nova-nota"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddPagament}
                    className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs px-4 py-2 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                    id="btn-afegir-pagament"
                  >
                    <Plus size={14} />
                    {language === 'ca' ? "Afegir pagament" : "Añadir pago"}
                  </button>
                </div>
              </div>

              {/* Historial de pagaments */}
              <div className="space-y-2">
                <span className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  {language === 'ca' ? "Historial de pagaments registrats:" : "Historial de pagos registrados:"}
                </span>

                {pagaments.length === 0 ? (
                  <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-900 text-center text-xs text-zinc-500 italic">
                    {language === 'ca' ? "Cap pagament registrat encara." : "Ningún pago registrado todavía."}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {pagaments.map((p, pIdx) => {
                      const dStr = p.data ? new Date(p.data).toLocaleDateString() : '—';
                      return (
                        <div
                          key={p.id || pIdx}
                          className="flex items-center justify-between p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-xl gap-2 hover:border-zinc-750 transition-all text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase shrink-0 ${
                              p.metode === MetodePagament.BIZUM
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                : 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40'
                            }`}>
                              {p.metode}
                            </span>
                            <span className="font-mono font-black text-white text-sm shrink-0">
                              {formatEuro(p.import)}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                              {dStr}
                            </span>
                            {p.nota && (
                              <span className="text-[11px] text-zinc-400 truncate italic" title={p.nota}>
                                • {p.nota}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePagament(p.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                            title={language === 'ca' ? "Eliminar aquest pagament" : "Eliminar este pago"}
                            id={`btn-remove-pagament-${p.id}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Segment 3: Material Delivery (Derived strictly from selected materials) */}
            <div className="space-y-2 border-t border-zinc-900 pt-4" id="segment-material-delivery">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "Lliurament de Materials i Complements" : "Entrega de Materiales y Complementos"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEntregaMaterial(EstatInscripcio.PENDENT);
                    setEntregaC1Uniforme(false);
                    setEntregaC2Uniforme(false);
                    const resetExtras: Record<string, boolean> = {};
                    breakdown.materials.forEach(m => { resetExtras[m.id] = false; });
                    setEntregaExtras(resetExtras);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    entregaMaterial === EstatInscripcio.PENDENT 
                      ? 'bg-zinc-850 text-white border border-zinc-700' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                  id="btn-material-pendent"
                >
                  {language === 'ca' ? "Pendent d'entregar" : "Pendiente de entregar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntregaMaterial(EstatInscripcio.ENTREGAT);
                    setEntregaC1Uniforme(true);
                    setEntregaC2Uniforme(true);
                    const allExtras: Record<string, boolean> = {};
                    breakdown.materials.forEach(m => { allExtras[m.id] = true; });
                    setEntregaExtras(allExtras);
                    if (estatDni === EstatVerificacio.PENDENT) {
                      setEstatDni(EstatVerificacio.VALIDAT);
                    }
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    entregaMaterial === EstatInscripcio.ENTREGAT 
                      ? 'bg-fuchsia-600 text-white shadow shadow-fuchsia-600/10' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                  id="btn-material-entregat"
                >
                  {language === 'ca' ? "Lliurat Complet" : "Entregado Completo"}
                </button>
              </div>

              {/* Checklist details matching active ordered materials */}
              <div className="mt-2 text-xs bg-zinc-950/60 p-3 rounded-2xl border border-zinc-900 space-y-2">
                <span className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                  {language === 'ca' ? "DETALL DE LA COMANDA A LLIURAR:" : "DETALLE DEL PEDIDO A ENTREGAR:"}
                </span>

                <div className="space-y-2 text-[11px]">
                  {/* Real selected materials from breakdown */}
                  {breakdown.materials.map((mat) => (
                    <label key={mat.id} className="flex items-center gap-2.5 text-zinc-300 hover:text-white cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={entregaMaterial === EstatInscripcio.ENTREGAT || entregaExtras[mat.id] === true}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setEntregaExtras(prev => ({ ...prev, [mat.id]: val }));
                        }}
                        className="rounded border-zinc-800 bg-[#121212] text-[#ff0090] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-[#ff0090]"
                        id={`chk-entrega-mat-${mat.id}`}
                      />
                      <span className="leading-tight">
                        📦 {mat.nom}
                        <strong className="text-[#ff0090] font-mono ml-1">({mat.quantitat} u. &bull; {mat.modalitat})</strong>
                      </span>
                    </label>
                  ))}

                  {breakdown.materials.length === 0 && !c1Talla && !c2Talla && (
                    <p className="text-zinc-500 text-[10px] italic">
                      {language === 'ca' ? "No hi ha materials pendents de lliurar." : "No hay materiales pendientes de entregar."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Segment 4: Waitlist Status */}
            <div className="space-y-2 border-t border-zinc-900 pt-4">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "Estat en Llista d'Espera" : "Estado en Lista de Espera"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(false)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !isWaitlist 
                      ? 'bg-zinc-850 text-white border border-zinc-700' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                >
                  {language === 'ca' ? "Admitit / Normal" : "Admitido / Normal"}
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(true)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isWaitlist 
                      ? 'bg-amber-500 text-white shadow shadow-amber-500/10' 
                      : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-850'
                  }`}
                >
                  {language === 'ca' ? "🟡 Llista d'Espera" : "🟡 Lista de Espera"}
                </button>
              </div>
            </div>

            {/* Save Action block */}
            <div className="pt-4 border-t border-zinc-900">
              <button
                type="button"
                onClick={handleGuardaCanvis}
                className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-2xl shadow-xl transition-all shadow-fuchsia-600/20 text-sm flex items-center justify-center gap-2 hover:scale-[1.01]"
                id="btn-fiche-save-action"
              >
                <Save size={16} /> {language === 'ca' ? "Guardar i Confirmar Ficha" : "Guardar y Confirmar Ficha"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DNI Ampliada Modal */}
      {activeZoomUrl && (
        <div 
          onClick={() => setActiveZoomUrl(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
          id="dni-zoom-modal"
        >
          <div className="absolute top-4 right-4 bg-zinc-900 p-2 text-white hover:bg-zinc-800 rounded-full cursor-pointer border border-zinc-800">
            <X size={20} />
          </div>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl relative pointer-events-auto shadow-2xl border border-zinc-800">
            <img 
              src={activeZoomUrl} 
              alt={language === 'ca' ? "Ampliació DNI" : "Ampliación DNI"} 
              className="max-w-full max-h-[85vh] object-contain block m-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-zinc-500 text-xs font-mono mt-3 uppercase tracking-wider">
            {language === 'ca' 
              ? "Prem a qualsevol lloc per tancar el visor de seguretat" 
              : "Pulsa en cualquier lugar para cerrar el visor de seguridad"}
          </p>
        </div>
      )}

      {/* Email Preview & Confirmation Modal (Points 10 & 12) */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-750 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-bold text-base text-fuchsia-400 flex items-center gap-2">
                <Mail size={18} />
                {mailEnviat || mailEstat === 'enviat'
                  ? (language === 'ca' ? "Reenviar correu modificat" : "Reenviar correo modificado")
                  : (language === 'ca' ? "Enviar correu de confirmació" : "Enviar correo de confirmación")}
              </h3>
              <button 
                type="button"
                onClick={() => { setShowEmailModal(false); setEmailSendStatus(null); }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Destinatari:</span>
                  <span className="font-bold text-white">{emailContactoPareja || registration.c1Email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{language === 'ca' ? 'Telèfon:' : 'Teléfono:'}</span>
                  <span className="font-bold text-white">{telefonContactoPareja || registration.c1Telefon || registration.c2Telefon || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Codi parella:</span>
                  <span className="font-bold text-fuchsia-400">{codiSeguiment || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Parella:</span>
                  <span className="font-bold text-white">{c1Nom} &amp; {c2Nom}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total a pagar:</span>
                  <span className="font-bold text-white">{formatEuro(breakdown.totalCalculat)}</span>
                </div>
              </div>

              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
                <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono block mb-1.5">
                  {language === 'ca' ? "Materials i equipament a enviar:" : "Materiales y equipamiento a enviar:"}
                </span>
                <ul className="space-y-1 text-zinc-300">
                  {breakdown.materials.map(m => (
                    <li key={m.id} className="flex justify-between">
                      <span>• {m.nom} ({m.modalitat}):</span>
                      <strong className="text-white">{m.quantitat} u. ({m.subtotal}€)</strong>
                    </li>
                  ))}
                  {breakdown.materials.length === 0 && (
                    <li className="text-zinc-500 italic">Sense materials addicionals</li>
                  )}
                </ul>
              </div>

              {mailEnviat && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] leading-relaxed">
                  ⚠️ {language === 'ca'
                    ? "Aquest correu s'enviarà indicant expressament que és una versió corregida de la inscripció."
                    : "Este correo se enviará indicando expresamente que es una versión corregida de la inscripción."}
                </div>
              )}

              {emailSendStatus && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  emailSendStatus.ok 
                    ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300' 
                    : 'bg-rose-950/80 border border-rose-700 text-rose-300'
                }`}>
                  {emailSendStatus.msg}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => { setShowEmailModal(false); setEmailSendStatus(null); }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {language === 'ca' ? "Tancar" : "Cerrar"}
              </button>
              <button
                type="button"
                disabled={isSendingModifiedEmail || !emailContactoPareja}
                onClick={handleSendEmail}
                className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                {isSendingModifiedEmail ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    {language === 'ca' ? "Enviant..." : "Enviando..."}
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    {language === 'ca' ? "Confirmar i Enviar" : "Confirmar y Enviar"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
