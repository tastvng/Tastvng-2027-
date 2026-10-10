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
  CreditCard
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import TranslatedText from './TranslatedText';
import { Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, CategoriaParella, SistemaConfig, PagamentRegistrat } from '../types';
import { calculateInscriptionOrderBreakdown, validateInscriptionTotal } from '../utils/orderCalculations';
import { determineCodeGroup, allocateNextCode } from '../utils/codeAllocator';
import { parseScopeAndQuestionId, isPreguntaVisible } from '../utils/questionVisibility';
import { getPaymentSummary, derivedEstatPagament, derivedMetodePagament, parseImport, formatEuro } from '../utils/paymentCalculations';
import { supabase } from '../supabaseClient';

interface AdminFichaProps {
  registration: Inscripcio;
  allInscripcions?: Inscripcio[];
  config?: SistemaConfig;
  onBack: () => void;
  onSave: (updatedRecord: Inscripcio) => void;
  onRefresh?: () => Promise<any> | void;
}

export default function AdminFicha({ registration, allInscripcions = [], config, onBack, onSave, onRefresh }: AdminFichaProps) {
  const { language, t } = useLanguage();
  const [codiSeguiment, setCodiSeguiment] = useState<string>(registration.codiSeguiment || '');
  const [categoria, setCategoria] = useState<CategoriaParella>(registration.categoria);

  // Local extras state (supports frozen breakfast lines and recalculation)
  const [extresSeleccionats, setExtresSeleccionats] = useState<any[]>(() => registration.extresSeleccionats || []);

  const currentRecord = useMemo<Inscripcio>(() => ({
    ...registration,
    codiSeguiment,
    categoria,
    extresSeleccionats
  }), [registration, codiSeguiment, categoria, extresSeleccionats]);

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
        setDni1Error("No s'ha pogut obtenir l'enllaç");
      }
    } catch (err: any) {
      setDni1Error(err?.message || "Error generant enllaç signat");
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
        setDni2Error("No s'ha pogut obtenir l'enllaç");
      }
    } catch (err: any) {
      setDni2Error(err?.message || "Error generant enllaç signat");
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

  // Participant Editable configurations
  const [emailContactoPareja, setEmailContactoPareja] = useState(
    registration.emailContactoPareja || registration.c1Email || registration.c2Email || ''
  );
  const [telefonContactoPareja, setTelefonContactoPareja] = useState(
    registration.telefonContactoPareja || registration.c1Telefon || registration.c2Telefon || ''
  );

  // Determine if Participant 1 and Participant 2 explicitly chose an armilla/equipment
  const p1HasArmilla = React.useMemo(() => {
    const selUni = registration.seleccionsUniforme?.['lin-1'] || 
                   registration.seleccionsUniforme?.['uniforme'] || 
                   registration.seleccionsUniforme?.['armilla'] || 
                   (registration.seleccionsUniforme ? Object.values(registration.seleccionsUniforme)[0] : undefined);
    const isOptional = !!(config?.armilla_opcional ?? true);
    const c1VolCandidate = (selUni as any)?.c1Vol ?? (registration as any).c1Vol ?? (registration as any).c1_vol;
    const hasExplicitC1Vol = typeof c1VolCandidate === 'boolean';
    const rawTalla1 = ((selUni as any)?.c1Talla || registration.c1Talla || '').trim();
    const hasT1 = !!rawTalla1 && rawTalla1.toLowerCase() !== 'cap' && rawTalla1.toLowerCase() !== 'null' && rawTalla1.toLowerCase() !== 'undefined';
    return hasExplicitC1Vol ? c1VolCandidate === true : (isOptional ? false : hasT1);
  }, [registration, config]);

  const p2HasArmilla = React.useMemo(() => {
    const selUni = registration.seleccionsUniforme?.['lin-1'] || 
                   registration.seleccionsUniforme?.['uniforme'] || 
                   registration.seleccionsUniforme?.['armilla'] || 
                   (registration.seleccionsUniforme ? Object.values(registration.seleccionsUniforme)[0] : undefined);
    const isOptional = !!(config?.armilla_opcional ?? true);
    const c2VolCandidate = (selUni as any)?.c2Vol ?? (registration as any).c2Vol ?? (registration as any).c2_vol;
    const hasExplicitC2Vol = typeof c2VolCandidate === 'boolean';
    const rawTalla2 = ((selUni as any)?.c2Talla || registration.c2Talla || '').trim();
    const hasT2 = !!rawTalla2 && rawTalla2.toLowerCase() !== 'cap' && rawTalla2.toLowerCase() !== 'null' && rawTalla2.toLowerCase() !== 'undefined';
    return hasExplicitC2Vol ? c2VolCandidate === true : (isOptional ? false : hasT2);
  }, [registration, config]);

  const [c1Nom, setC1Nom] = useState(registration.c1Nom);
  const [c1Cognoms, setC1Cognoms] = useState(registration.c1Cognoms);
  const [c1Talla, setC1Talla] = useState<string>(() => {
    if (!p1HasArmilla) return '';
    const raw = (registration.c1Talla || '').trim();
    if (!raw || raw.toLowerCase() === 'cap' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return '';
    return raw;
  });
  const [c1UniformeTipus, setC1UniformeTipus] = useState<'compra' | 'lloguer'>(() => {
    return (registration.c1UniformeTipus as 'compra' | 'lloguer') || 'compra';
  });

  const [c1TutorNom, setC1TutorNom] = useState(registration.c1TutorNom || '');
  const [c1TutorCognoms, setC1TutorCognoms] = useState(registration.c1TutorCognoms || '');
  const [c1TutorDni, setC1TutorDni] = useState(registration.c1TutorDni || '');
  const [c1TutorTelefon, setC1TutorTelefon] = useState(registration.c1TutorTelefon || '');

  const [c2Nom, setC2Nom] = useState(registration.c2Nom);
  const [c2Cognoms, setC2Cognoms] = useState(registration.c2Cognoms);
  const [c2Talla, setC2Talla] = useState<string>(() => {
    if (!p2HasArmilla) return '';
    const raw = (registration.c2Talla || '').trim();
    if (!raw || raw.toLowerCase() === 'cap' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return '';
    return raw;
  });
  const [c2UniformeTipus, setC2UniformeTipus] = useState<'compra' | 'lloguer'>(() => {
    return (registration.c2UniformeTipus as 'compra' | 'lloguer') || 'compra';
  });

  const [c2TutorNom, setC2TutorNom] = useState(registration.c2TutorNom || '');
  const [c2TutorCognoms, setC2TutorCognoms] = useState(registration.c2TutorCognoms || '');
  const [c2TutorDni, setC2TutorDni] = useState(registration.c2TutorDni || '');
  const [c2TutorTelefon, setC2TutorTelefon] = useState(registration.c2TutorTelefon || '');
  
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

    // Concurrency check: verify if another admin updated pagaments in the database
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

    const derivedEstat = derivedEstatPagament(paymentSummary);
    const derivedMetode = derivedMetodePagament(pagaments);

    const updatedInscripcio: Inscripcio = {
      ...registration,
      codiSeguiment,
      categoria,
      emailContactoPareja: emailContactoPareja.trim(),
      telefonContactoPareja: telefonContactoPareja.trim(),
      c1Nom: c1Nom.trim(),
      c1Cognoms: c1Cognoms.trim(),
      c1Email: emailContactoPareja.trim(),
      c1Telefon: telefonContactoPareja.trim(),
      c1Talla: c1Talla.trim(),
      c1UniformeTipus: c1Talla.trim() ? c1UniformeTipus : '',
      c1TutorNom: c1TutorNom.trim(),
      c1TutorCognoms: c1TutorCognoms.trim(),
      c1TutorDni: c1TutorDni.trim(),
      c1TutorTelefon: c1TutorTelefon.trim(),
      c2Nom: c2Nom.trim(),
      c2Cognoms: c2Cognoms.trim(),
      c2Email: emailContactoPareja.trim(),
      c2Telefon: telefonContactoPareja.trim(),
      c2Talla: c2Talla.trim(),
      c2UniformeTipus: c2Talla.trim() ? c2UniformeTipus : '',
      c2TutorNom: c2TutorNom.trim(),
      c2TutorCognoms: c2TutorCognoms.trim(),
      c2TutorDni: c2TutorDni.trim(),
      c2TutorTelefon: c2TutorTelefon.trim(),
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
      actualizadoEn: new Date().toISOString()
    };

    onSave(updatedInscripcio);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onBack();
    }, 1500);
  };

  return (
    <div className="space-y-6" id="registration-detail-container">
      {/* Detail header toolbar */}
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white shadow">
        <button 
          onClick={onBack}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          id="btn-ficha-back"
        >
          <ArrowLeft size={14} /> {language === 'ca' ? 'Tornar al taulell' : 'Volver al tablero'}
        </button>

        <div className="text-center">
          <span className="font-mono text-[9px] text-fuchsia-400 font-bold uppercase tracking-wider">
            CODI DE SEGUIMENT
          </span>
          <div className="flex items-center justify-center gap-2">
            <h2 className="font-sans font-extrabold text-base tracking-tight text-fuchsia-400">{codiSeguiment}</h2>
            {codiSeguiment !== registration.codiSeguiment && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                {language === 'ca' ? `Nou codi (Antic: ${registration.codiSeguiment})` : `Nuevo código (Antiguo: ${registration.codiSeguiment})`}
              </span>
            )}
          </div>
        </div>

        <button 
          onClick={handleGuardaCanvis}
          className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow"
          id="btn-ficha-save"
        >
          {saveSuccess 
            ? (language === 'ca' ? "S'ha desat!" : "¡Guardado!") 
            : (language === 'ca' ? "Desar Canvis" : "Guardar Cambios")} <Save size={14} />
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-2xl font-semibold flex items-center gap-2">
          <ShieldCheck size={20} className="text-green-600 animate-bounce" />
          <span>
            {language === 'ca' 
              ? "Ficha d'inscripció actualitzada i guardada correctament al sistema de l'entitat! Redirigint..."
              : "¡Ficha de inscripción actualizada y guardada correctamente en el sistema de la entidad! Redireccionando..."}
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
            
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100">
              <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded ${
                registration.categoria === CategoriaParella.ADULT 
                  ? 'bg-zinc-900 text-white' 
                  : 'bg-fuchsia-100 text-fuchsia-800'
              }`}>
                {registration.categoria}
              </span>
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
              <div className="pt-1">
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
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Talla</label>
                      <select
                        value={c1Talla}
                        onChange={(e) => setC1Talla(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold font-sans focus:outline-none cursor-pointer"
                      >
                        <option value="">{language === 'ca' ? 'Sense armilla' : 'Sin chaleco'}</option>
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
                        value={c1UniformeTipus}
                        onChange={(e) => setC1UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                        className="w-full bg-white border border-[#ff0090]/40 rounded-lg px-2 py-1.5 text-xs font-bold text-[#ff0090] font-sans focus:outline-none cursor-pointer"
                      >
                        <option value="compra">{language === 'ca' ? 'Compra' : 'Compra (Venta)'}</option>
                        <option value="lloguer">{language === 'ca' ? 'Lloguer (Alquiler)' : 'Alquiler'}</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const entries = Object.entries(registration.seleccionsUniforme || {}).filter(([liniaId, sel]) => {
                      const linia = config?.liniisUniforme?.find(l => l.id === liniaId);
                      const isOptional = !!(linia?.opcional || linia?.armilla_opcional || config?.armilla_opcional);
                      const c1VolCandidate = (sel as any)?.c1Vol ?? (registration as any).c1Vol ?? (registration as any).c1_vol;
                      const hasExplicitC1Vol = typeof c1VolCandidate === 'boolean';
                      const rawTalla1 = (sel.c1Talla || registration.c1Talla || '').trim();
                      const hasT1 = !!rawTalla1 && rawTalla1.toLowerCase() !== 'cap' && rawTalla1.toLowerCase() !== 'null' && rawTalla1.toLowerCase() !== 'undefined';
                      const p1Wants = hasExplicitC1Vol ? c1VolCandidate === true : (isOptional ? false : hasT1);
                      // Si material.armilla es null, undefined o vacío -> no renderizar esa fila
                      return p1Wants && hasT1 && !!sel.c1Talla;
                    });

                    if (entries.length === 0) return null;

                    return (
                      <div className="space-y-1 bg-white p-2 border border-zinc-150 rounded-xl">
                        <span className="block text-[8px] font-mono text-zinc-400 uppercase font-bold tracking-wider mb-1">
                          {language === 'ca' ? "Comanda d'Equipament (Detalls):" : "Pedido de Equipamiento (Detalles):"}
                        </span>
                        {entries.map(([liniaId, sel]) => {
                          const linia = config?.liniisUniforme?.find(l => l.id === liniaId);
                          const nomLinia = linia ? (language === 'es' ? (linia.nomES || linia.nom) : linia.nom) : liniaId;
                          return (
                            <div key={liniaId} className="flex justify-between items-center text-[10px] py-0.5">
                              <span className="text-zinc-500 truncate pr-1">{nomLinia}:</span>
                              <span className="font-mono text-zinc-900 font-extrabold">
                                {sel.c1Talla} {linia?.requeixQuantitat && `(${sel.c1Quantitat || sel.quantitat || 1} u)`} {sel.c1Tipus ? `[${sel.c1Tipus.substring(0,3).toUpperCase()}]` : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {registration.c1EsMenor && (
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
                      <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Talla</label>
                      <select
                        value={c2Talla}
                        onChange={(e) => setC2Talla(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs font-bold font-sans focus:outline-none cursor-pointer"
                      >
                        <option value="">{language === 'ca' ? 'Sense armilla' : 'Sin chaleco'}</option>
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
                        value={c2UniformeTipus}
                        onChange={(e) => setC2UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                        className="w-full bg-white border border-[#ff0090]/40 rounded-lg px-2 py-1.5 text-xs font-bold text-[#ff0090] font-sans focus:outline-none cursor-pointer"
                      >
                        <option value="compra">{language === 'ca' ? 'Compra' : 'Compra (Venta)'}</option>
                        <option value="lloguer">{language === 'ca' ? 'Lloguer (Alquiler)' : 'Alquiler'}</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const entries = Object.entries(registration.seleccionsUniforme || {}).filter(([liniaId, sel]) => {
                      const linia = config?.liniisUniforme?.find(l => l.id === liniaId);
                      const isOptional = !!(linia?.opcional || linia?.armilla_opcional || config?.armilla_opcional);
                      const c2VolCandidate = (sel as any)?.c2Vol ?? (registration as any).c2Vol ?? (registration as any).c2_vol;
                      const hasExplicitC2Vol = typeof c2VolCandidate === 'boolean';
                      const rawTalla2 = (sel.c2Talla || registration.c2Talla || '').trim();
                      const hasT2 = !!rawTalla2 && rawTalla2.toLowerCase() !== 'cap' && rawTalla2.toLowerCase() !== 'null' && rawTalla2.toLowerCase() !== 'undefined';
                      const p2Wants = hasExplicitC2Vol ? c2VolCandidate === true : (isOptional ? false : hasT2);
                      // Si material.armilla es null, undefined o vacío -> no renderizar esa fila
                      return p2Wants && hasT2 && !!sel.c2Talla;
                    });

                    if (entries.length === 0) return null;

                    return (
                      <div className="space-y-1 bg-white p-2 border border-zinc-150 rounded-xl">
                        <span className="block text-[8px] font-mono text-zinc-400 uppercase font-bold tracking-wider mb-1">
                          {language === 'ca' ? "Comanda d'Equipament (Detalls):" : "Pedido de Equipamiento (Detalles):"}
                        </span>
                        {entries.map(([liniaId, sel]) => {
                          const linia = config?.liniisUniforme?.find(l => l.id === liniaId);
                          const nomLinia = linia ? (language === 'es' ? (linia.nomES || linia.nom) : linia.nom) : liniaId;
                          return (
                            <div key={liniaId} className="flex justify-between items-center text-[10px] py-0.5">
                              <span className="text-zinc-500 truncate pr-1">{nomLinia}:</span>
                              <span className="font-mono text-zinc-900 font-extrabold font-sans">
                                {sel.c2Talla} {linia?.requeixQuantitat && `(${sel.c2Quantitat || sel.quantitat || 1} u)`} {sel.c2Tipus ? `[${sel.c2Tipus.substring(0,3).toUpperCase()}]` : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {registration.c2EsMenor && (
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

            {/* Answers questionnaire block */}
            {(() => {
              const FORBIDDEN_KEYS = new Set([
                'estatCorreu', 'domas_qty', 'mocadors_qty', 'correuContacteParella',
                'telefonContacteParella', 'emailContactoPareja', 'telefonContactoPareja',
                'teDomasBalco', 'teMocadorsExtra', 'clavells_qty', 'corbati_qty', 'esmorzar_qty'
              ]);
              const rawAnswers = registration.respostesCuestionari || {};
              const allQuestions = config?.preguntesFormulari || [];

              const validEntries = Object.entries(rawAnswers).filter(([k, v]) => {
                if (FORBIDDEN_KEYS.has(k) || k.startsWith('extra_qty_') || k.startsWith('_')) return false;
                if (v === undefined || v === null || v === '') return false;
                const s = String(v).trim().toLowerCase();
                if (s === 'fallat' || s === 'sense resposta' || s === 'sin respuesta') return false;

                // Check condition visibility if key corresponds to a dynamic question
                const { questionId, scope } = parseScopeAndQuestionId(k);
                const q = allQuestions.find(p => p.id === questionId);
                if (q) {
                  const isVisible = isPreguntaVisible(q, rawAnswers, allQuestions, scope);
                  if (!isVisible) return false;
                }

                return true;
              });

              if (validEntries.length === 0) return null;

              return (
                <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-100 space-y-4">
                  <span className="font-sans font-black text-xs text-zinc-600 uppercase tracking-wider block">
                    {language === 'ca' ? "RESPOSTES AL QÜESTIONARI COMPARSILER:" : "RESPUESTAS AL CUESTIONARIO COMPARSILER:"}
                  </span>
                  <div className="divide-y divide-zinc-200/60 text-xs space-y-3 pt-1">
                    {validEntries.map(([key, value]) => {
                      let label = "";
                      let suffix = "";
                      const { questionId, scope } = parseScopeAndQuestionId(key);
                      const configPregunta = allQuestions.find(p => p.id === questionId);

                      if (configPregunta) {
                        label = configPregunta.titol;
                        if (scope === 'c1') {
                          const c1NomFull = registration.c1Nom ? `${registration.c1Nom} ${registration.c1Cognoms}`.trim() : (language === 'ca' ? 'Participant 1' : 'Participante 1');
                          suffix = ` (Comparser 1 · ${c1NomFull})`;
                        } else if (scope === 'c2') {
                          const c2NomFull = registration.c2Nom ? `${registration.c2Nom} ${registration.c2Cognoms}`.trim() : (language === 'ca' ? 'Participant 2' : 'Participante 2');
                          suffix = ` (Comparser 2 · ${c2NomFull})`;
                        }
                      } else if (key === 'preg-1' || key === 'q-1') {
                        label = language === 'ca' ? "Primera vegada saltant amb El Tast?" : "¿Primera vez saliendo con El Tast?";
                      } else if (key === 'preg-2' || key === 'q-2') {
                        label = language === 'ca' ? "Participació al dinar de germanor de la colla?" : "¿Participación en la comida de hermandad de la colla?";
                      } else if (key === 'preg-3' || key === 'q-3') {
                        label = language === 'ca' ? "Intoleràncies alimentàries o comentaris dietètics:" : "Intolerancias alimentarias o comentarios dietéticos:";
                      } else {
                        label = key;
                      }

                      return (
                        <div key={key} className="pt-2">
                          <p className="font-bold text-zinc-800 mb-1 leading-relaxed">
                            <TranslatedText text={label} />
                            {suffix && <span className="text-zinc-500 font-normal">{suffix}</span>}
                          </p>
                          <p className="text-zinc-600 font-mono italic">
                            {value === true ? 'Sí' : value === false ? 'No' : (
                              <TranslatedText text={String(value)} />
                            )}
                          </p>
                        </div>
                      );
                    })}
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
                        <span className="text-amber-400 text-xs">{dni1Error}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveDni1(c1RawPath);
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <RefreshCw size={10} /> {language === 'ca' ? "Regenerar enllaç" : "Regenerar enlace"}
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
                            setDni1Error(language === 'ca' ? "Enllaç caducat o imatge no disponible" : "Enlace caducado o imagen no disponible");
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
                        <span className="text-amber-400 text-xs">{dni2Error}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveDni2(c2RawPath);
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <RefreshCw size={10} /> {language === 'ca' ? "Regenerar enllaç" : "Regenerar enlace"}
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
                            setDni2Error(language === 'ca' ? "Enllaç caducat o imatge no disponible" : "Enlace caducado o imagen no disponible");
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

            {/* Segment: Estat i Posició de la Inscripció */}
            <div className="space-y-2 pb-4 border-b border-zinc-900">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                {language === 'ca' ? "Estat de la Inscripció" : "Estado de la Inscripción"}
              </label>
              <div className="flex items-center gap-3">
                {isWaitlist ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-500 font-sans uppercase">
                    🟡 {language === 'ca' ? "Llista d'Espera" : "Lista de Espera"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-sans uppercase">
                    🟢 {language === 'ca' ? "Inscripció Oberta" : "Inscripción Abierta"}
                  </span>
                )}
                {registration.posicioGlobal && (
                  <span className="font-mono text-zinc-300 text-sm font-black bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                    Posició: #{registration.posicioGlobal}
                  </span>
                )}
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
                <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-850">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                      {language === 'ca' ? "Import Total" : "Importe Total"}
                    </span>
                    <button
                      type="button"
                      onClick={handleRecalcularEsmorzar}
                      disabled={!canRecalcularEsmorzar}
                      title={!canRecalcularEsmorzar ? (language === 'ca' ? "Cap esmorzar amb preu" : "Ningún almuerzo con precio") : (language === 'ca' ? "Recalcular esmorzar amb els preus actuals" : "Recalcular almuerzo con los precios actuales")}
                      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border transition ${
                        canRecalcularEsmorzar
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-fuchsia-300 border-zinc-700 cursor-pointer'
                          : 'bg-zinc-900 text-zinc-600 border-zinc-850 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <RefreshCw size={9} />
                      {language === 'ca' ? "Recalcular" : "Recalcular"}
                    </button>
                  </div>
                  <p className="text-base font-mono font-black text-white mt-0.5">
                    {formatEuro(paymentSummary.total)}
                  </p>
                  {registration.preuCalculat !== breakdown.totalCalculat && (
                    <span className="text-[9px] font-mono text-amber-400 block mt-0.5" title="Diferència amb la base de dades">
                      ⚠️ DB: {formatEuro(registration.preuCalculat)}
                    </span>
                  )}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
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
    </div>
  );
}
