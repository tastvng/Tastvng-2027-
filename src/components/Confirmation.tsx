/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Download, Mail, Calendar, MapPin, Printer, ArrowLeft, RefreshCw, Sparkle, ChevronDown, ChevronUp, Send, Inbox, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { Inscripcio, CategoriaParella, SistemaConfig } from '../types';
import { useLanguage } from '../LanguageContext';
import { getEntityConfigSync, fetchLiveEntityConfig, EntityConfig } from '../utils/entityConfig';
import { calculateInscriptionOrderBreakdown, validateInscriptionTotal, InscriptionOrderBreakdown } from '../utils/orderCalculations';
import { buildUnifiedEmailHtml } from '../utils/ticketGenerator';
import { getDniSignedUrl, getSupabaseInscripcionById } from '../supabaseClient';

interface ConfirmationProps {
  registration: Inscripcio;
  onClear: () => void;
  onUpdate?: (updatedReg: Inscripcio) => void;
  config?: SistemaConfig;
}

export default function Confirmation({ registration, onClear, onUpdate, config }: ConfirmationProps) {
  const { language, t } = useLanguage();
  const [currentReg, setCurrentReg] = useState<Inscripcio>(registration);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'not_configured'>('idle');
  const [smtpError, setSmtpError] = useState('');

  const [entityConfig, setEntityConfig] = useState<EntityConfig>(() => getEntityConfigSync(language, config));
  const [c1DniSignedUrl, setC1DniSignedUrl] = useState<string | null>(null);
  const [c2DniSignedUrl, setC2DniSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    setCurrentReg(registration);
    if (registration.id && !registration.codiSeguiment) {
      getSupabaseInscripcionById(registration.id).then(fresh => {
        if (fresh && fresh.codiSeguiment) {
          setCurrentReg(fresh);
        }
      }).catch(err => console.warn("Could not retrieve fresh registration code:", err));
    }
  }, [registration]);

  // Single Source of Truth Calculation & Validation
  const breakdown: InscriptionOrderBreakdown = calculateInscriptionOrderBreakdown(currentReg, config, language);
  const validation = validateInscriptionTotal(currentReg, config, language);

  useEffect(() => {
    // 1. Refresh entity configuration from Supabase
    fetchLiveEntityConfig(language).then(liveCfg => {
      setEntityConfig(liveCfg);
    }).catch(err => console.warn("Could not fetch live entity config:", err));

    // 2. Resolve signed Supabase DNI URLs
    const c1Url = currentReg.c1DniUrl || registration.c1DniUrl;
    const c2Url = currentReg.c2DniUrl || registration.c2DniUrl;

    if (c1Url) {
      getDniSignedUrl(c1Url).then(url => {
        if (url) setC1DniSignedUrl(url);
      }).catch(err => console.warn("Error resolving C1 DNI signed url:", err));
    }
    if (c2Url) {
      getDniSignedUrl(c2Url).then(url => {
        if (url) setC2DniSignedUrl(url);
      }).catch(err => console.warn("Error resolving C2 DNI signed url:", err));
    }
  }, [language, currentReg.c1DniUrl, currentReg.c2DniUrl, registration.c1DniUrl, registration.c2DniUrl]);

  // QR code contains the exact saved tracking code
  const realTrackingCode = (
    currentReg.codiSeguiment || 
    registration.codiSeguiment || 
    (currentReg as any).codi_seguiment || 
    (registration as any).codi_seguiment || 
    (currentReg as any).codigo || 
    (registration as any).codigo || 
    (currentReg as any).codigoInscripcion || 
    (registration as any).codigoInscripcion || 
    (currentReg as any).codigo_inscripcion || 
    (registration as any).codigo_inscripcion || 
    (currentReg as any).codigo_seguimiento || 
    (registration as any).codigo_seguimiento || 
    (currentReg as any).codiseguiment || 
    (registration as any).codiseguiment || 
    (currentReg as any).codi || 
    (registration as any).codi || 
    ''
  ).trim();
  const qrIdentifier = realTrackingCode || currentReg.id || registration.id;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(qrIdentifier)}`;

  const sendRealEmail = async () => {
    setSmtpStatus('sending');
    setSmtpError('');

    let activeReg = currentReg;
    if (activeReg.id && !activeReg.codiSeguiment) {
      try {
        const fresh = await getSupabaseInscripcionById(activeReg.id);
        if (fresh && fresh.codiSeguiment) {
          activeReg = fresh;
          setCurrentReg(fresh);
        }
      } catch (e) {
        console.warn("Could not load fresh registration code for email:", e);
      }
    }

    const currentBreakdown = calculateInscriptionOrderBreakdown(activeReg, config, language);
    const currentValidation = validateInscriptionTotal(activeReg, config, language);

    // Requirement: Block sending if totals mismatch!
    if (!currentValidation.valid) {
      const err = currentValidation.errorMessage || "Error de concordança de preu.";
      console.error("[EMAIL BLOCKED - MISMATCH]:", err);
      setSmtpStatus('error');
      setSmtpError(err);
      return;
    }

    try {
      const coupleEmail = (activeReg.emailContactoPareja || activeReg.c1Email || activeReg.c2Email || registration.emailContactoPareja || registration.c1Email || registration.c2Email || '').trim();
      const emailList = coupleEmail && coupleEmail.includes('@') ? [coupleEmail] : [];
      if (emailList.length === 0) {
        setSmtpStatus('error');
        setSmtpError(language === 'ca' 
          ? "No s'ha trobat cap adreça de correu de contacte vàlida per a la parella." 
          : "No se encontró ninguna dirección de correo de contacto válida para la pareja.");
        return;
      }

      // Ensure DNI signed URLs are resolved before building email
      let resolvedC1Dni = c1DniSignedUrl;
      let resolvedC2Dni = c2DniSignedUrl;

      if (!resolvedC1Dni && (activeReg.c1DniUrl || registration.c1DniUrl)) {
        resolvedC1Dni = await getDniSignedUrl(activeReg.c1DniUrl || registration.c1DniUrl);
      }
      if (!resolvedC2Dni && (activeReg.c2DniUrl || registration.c2DniUrl)) {
        resolvedC2Dni = await getDniSignedUrl(activeReg.c2DniUrl || registration.c2DniUrl);
      }

      // Unified Single Source of Truth Template
      const { subject, html } = buildUnifiedEmailHtml({
        registration: activeReg,
        entityConfig,
        breakdown: currentBreakdown,
        c1DniSignedUrl: resolvedC1Dni,
        c2DniSignedUrl: resolvedC2Dni,
        language
      });

      const emailAttachments: any[] = [];
      if (entityConfig.logoUrl && entityConfig.logoUrl.startsWith('data:')) {
        emailAttachments.push({
          filename: 'logo.png',
          content: entityConfig.logoUrl,
          cid: 'tast-email-logo-cid'
        });
      }

      // Dispatch to recipient(s)
      const sendPromises = emailList.map(emailTo => {
        return fetch('/api/email?action=send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: activeReg.id,
            inscriptionId: activeReg.id,
            codiSeguiment: activeReg.codiSeguiment,
            emailData: {
              to: emailTo,
              subject,
              html,
              attachments: emailAttachments,
              codiSeguiment: activeReg.codiSeguiment
            }
          })
        }).catch(err => {
          console.error(`Fetch to /api/email?action=send failed for ${emailTo}:`, err);
          return {
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ ok: false, emailSent: false, error: 'SMTP_SEND_FAILED', message: err.message || String(err) })
          } as Response;
        });
      });

      const results = await Promise.all(sendPromises);
      const errorsList: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        let data: any = null;
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch {
          // Not JSON
        }
        if (!res.ok || data?.ok === false || data?.emailSent === false) {
          const errText = data?.error || data?.message || `HTTP Error ${res.status}`;
          errorsList.push(`${emailList[i]}: ${errText}`);
        }
      }

      if (errorsList.length === 0) {
        console.log('[EMAIL ok]:', { to: emailList, codi: activeReg.codiSeguiment });
        setSmtpStatus('success');
        if (onUpdate) {
          onUpdate({
            ...activeReg,
            respostesCuestionari: {
              ...activeReg.respostesCuestionari,
              estatCorreu: 'enviat'
            }
          });
        }
      } else {
        const errorMsg = errorsList.join(', ');
        console.error('[EMAIL error]:', { to: emailList, codi: activeReg.codiSeguiment, error: errorMsg });
        setSmtpStatus('error');
        setSmtpError(errorMsg);
        if (onUpdate) {
          onUpdate({
            ...activeReg,
            respostesCuestionari: {
              ...activeReg.respostesCuestionari,
              estatCorreu: 'fallat'
            }
          });
        }
      }
    } catch (err: any) {
      console.error("[EMAIL error]:", { to: activeReg.emailContactoPareja, codi: activeReg.codiSeguiment, error: err?.message || err });
      setSmtpStatus('error');
      setSmtpError(err.message || 'Error de conexión');
      if (onUpdate) {
        onUpdate({
          ...activeReg,
          respostesCuestionari: {
            ...activeReg.respostesCuestionari,
            estatCorreu: 'fallat'
          }
        });
      }
    }
  };

  useEffect(() => {
    sendRealEmail().catch(err => console.error("Unhandled error in sendRealEmail:", err));
  }, [registration.id]);

  const handlePrint = () => {
    window.print();
  };

  const isLlistaEspera = registration.estatInscripcio === 'llista_espera' || (!registration.estatInscripcio && registration.llistaEspera);
  const isAdult = String(registration.categoria || '').toUpperCase().includes('ADULT') || 
                  registration.categoria === CategoriaParella.ADULT;
  const categoriaLabel = isAdult 
    ? (language === 'ca' ? 'PARELLA ADULTA' : 'PAREJA ADULTA') 
    : (language === 'ca' ? 'PARELLA JUVENIL' : 'PAREJA JUVENIL');

  // Unified Email HTML for preview
  const unifiedEmailContent = buildUnifiedEmailHtml({
    registration,
    entityConfig,
    breakdown,
    c1DniSignedUrl,
    c2DniSignedUrl,
    language
  });

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* Visual background particles */}
      <div className="absolute top-10 left-10 text-fuchsia-300/30 animate-bounce pointer-events-none">
        <Sparkle size={32} />
      </div>
      <div className="absolute top-36 right-16 text-fuchsia-300/20 animate-spin duration-1000 pointer-events-none">
        <Sparkle size={48} />
      </div>

      <div className="text-center mb-8">
        <motion.div 
          initial={{ scale: 0.3, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full mb-4 shadow-inner"
        >
          <CheckCircle size={44} className="stroke-[2.5]" />
        </motion.div>
        
        <h1 className="font-sans font-black text-3xl text-zinc-900 tracking-tight mb-2">
          {(language === 'ca' ? config?.titolConfirmacioCA : config?.titolConfirmacioES) || t('conf_title')}
        </h1>
        <p className="text-zinc-500 text-sm max-w-md mx-auto font-sans leading-relaxed">
          {language === 'ca' ? (
            <>Hem registrat correctament la vostra parella per a l'esdeveniment <strong>{entityConfig.nomEsdeveniment}</strong> de l'entitat <strong className="text-fuchsia-600">{entityConfig.nom}</strong>.</>
          ) : (
            <>Hemos registrado correctamente a vuestra pareja para el evento <strong>{entityConfig.nomEsdeveniment}</strong> de la entidad <strong className="text-fuchsia-600">{entityConfig.nom}</strong>.</>
          )}
        </p>
      </div>

      {/* Requirement 7: High-visibility warning alert if total calculation mismatch */}
      {!validation.valid && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8 p-5 bg-amber-50 border-2 border-amber-400 rounded-3xl text-left shadow-lg print:hidden space-y-2"
          id="validation-error-warning-box"
        >
          <div className="flex gap-3.5 items-start">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={24} />
            <div>
              <p className="font-sans font-black text-amber-950 text-sm">
                {language === 'ca' ? "⚠️ Bloqueig de seguretat: Desajust en el total calculat" : "⚠️ Bloqueo de seguridad: Desajuste en el total calculado"}
              </p>
              <p className="font-sans text-xs text-amber-900 mt-1 leading-relaxed">
                {validation.errorMessage}
              </p>
              <div className="mt-2 text-xs font-mono bg-white/80 p-2.5 rounded-xl border border-amber-200">
                <span>{language === 'ca' ? 'Total desglossat:' : 'Total desglosado:'} <strong>{validation.expectedTotal}€</strong></span> &bull; 
                <span className="ml-2">{language === 'ca' ? 'Total registrat a la fitxa:' : 'Total registrado en ficha:'} <strong>{validation.registeredTotal}€</strong></span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Warning alert for SMTP sending error */}
      {smtpStatus === 'error' && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8 p-5 bg-red-50 border-2 border-red-300 rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-lg print:hidden"
          id="smtp-error-warning-box"
        >
          <div className="flex gap-3.5 items-start">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={24} />
            <div>
              <p className="font-sans font-black text-red-950 text-sm">
                {language === 'ca'
                  ? "⚠️ Inscripció guardada correctament, però no s'ha pogut enviar el correu de confirmació"
                  : "⚠️ Inscripción guardada correctamente, pero no se pudo enviar el correo de confirmación"}
              </p>
              <p className="font-sans text-xs text-red-800 mt-1 leading-relaxed">
                {language === 'ca' 
                  ? "La vostra plaça està registrada i segura a la base de dades. Podeu prémer el botó per reintentar l'enviament del correu o descarregar el comprovant en PDF."
                  : "Vuestra plaza está registrada y asegurada en la base de datos. Podéis pulsar el botón para reintentar el envío del correo o descargar el comprobante en PDF."}
              </p>
              <p className="text-[10px] font-mono text-red-650 mt-1 bg-red-100/40 px-2 py-1 rounded border border-red-200/30">
                {language === 'ca' ? `Detalls de l'error: ${smtpError}` : `Detalles del error: ${smtpError}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => sendRealEmail()}
            className="w-full sm:w-auto shrink-0 bg-red-650 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs px-4 py-3 rounded-xl transition-all shadow-md hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border border-red-700 font-sans"
            id="btn-retry-smtp-error"
          >
            <RefreshCw size={13} className={smtpStatus === 'sending' ? 'animate-spin' : ''} />
            {language === 'ca' ? "Reintentar enviament" : "Reintentar envío"}
          </button>
        </motion.div>
      )}

      {/* Main voucher printable ticket (Single Source of Truth, identical to Ficha) */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white border-2 border-zinc-200/80 rounded-[32px] overflow-hidden shadow-xl mb-6 relative print:border-none print:shadow-none"
        id="ticket-printable"
      >
        {/* Top banner */}
        <div className="bg-zinc-900 text-white p-6 text-center space-y-1 relative border-b border-zinc-800">
          <span className="font-mono text-[10px] text-fuchsia-400 font-bold tracking-widest uppercase block">
            {language === 'ca' ? 'COMPROVANT OFICIAL DE REGISTRE' : 'COMPROBANTE OFICIAL DE REGISTRO'}
          </span>
          <h2 className="font-sans font-black text-xl text-white tracking-tight flex items-center justify-center gap-1.5 uppercase">
            <span className="text-fuchsia-500">{entityConfig.nom}</span> &bull; {entityConfig.nomEsdeveniment}
          </h2>
          <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-fuchsia-600 text-white font-mono font-black text-xs px-5 py-1.5 rounded-full shadow-md tracking-wider flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[10px] tracking-widest text-fuchsia-200 uppercase">CODI DE SEGUIMENT:</span>
            <span>{realTrackingCode || registration.codiSeguiment}</span>
          </div>
        </div>

        {/* Info contents */}
        <div className="p-6 sm:p-8 pt-8 space-y-6">
          {/* QR representation */}
          <div className="flex flex-col items-center justify-center pt-2 pb-2">
            <div className="p-3 bg-zinc-50 rounded-2xl border-2 border-fuchsia-500/20 shadow-md relative group">
              <img 
                src={qrUrl} 
                alt="Codi QR de Registre" 
                className="w-44 h-44 block rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Couples detail blocks */}
          <div className="border-t border-b border-zinc-100 py-4 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">
                {language === 'ca' ? 'Parella:' : 'Pareja:'}
              </span>
              <span className="font-bold text-zinc-900 text-right">
                {registration.c1Nom} {registration.c1Cognoms || ''} &amp; {registration.c2Nom} {registration.c2Cognoms || ''}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">
                {language === 'ca' ? 'Contacte:' : 'Contacto:'}
              </span>
              <span className="font-mono text-zinc-700 text-right text-[11px]">
                {currentReg.emailContactoPareja || currentReg.c1Email || currentReg.c2Email || registration.emailContactoPareja || registration.c1Email || registration.c2Email}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">
                {language === 'ca' ? 'Categoria:' : 'Categoría:'}
              </span>
              <span className="bg-fuchsia-50 text-fuchsia-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px] font-mono">
                {categoriaLabel}
              </span>
            </div>

            {((currentReg as any).observacions || (currentReg as any).observaciones || currentReg.respostesCuestionari?.observacions || currentReg.respostesCuestionari?.observaciones) && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-wide">
                  {language === 'ca' ? 'Observacions:' : 'Observaciones:'}
                </span>
                <span className="font-medium text-zinc-800 text-right">
                  {String((currentReg as any).observacions || (currentReg as any).observaciones || currentReg.respostesCuestionari?.observacions || currentReg.respostesCuestionari?.observaciones)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">
                {language === 'ca' ? 'Estat d’inscripció:' : 'Estado de inscripción:'}
              </span>
              {isLlistaEspera ? (
                <span className="bg-amber-100 text-amber-800 font-black px-2.5 py-0.5 rounded-lg text-[11px] font-mono uppercase tracking-wider border border-amber-300">
                  {language === 'ca' ? "Llista d'Espera" : "Lista de Espera"}
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-lg text-[11px] font-mono uppercase tracking-wider border border-emerald-300">
                  {language === 'ca' ? "Oberta" : "Abierta"}
                </span>
              )}
            </div>

            {registration.posicioGlobal && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-wide">
                  {language === 'ca' ? 'Posició assignada:' : 'Posición asignada:'}
                </span>
                <span className="text-[#ff0090] font-mono font-black text-xs bg-fuchsia-50 px-2.5 py-0.5 rounded-lg">
                  #{registration.posicioGlobal}
                </span>
              </div>
            )}

            {/* Requirement 10: DNI Section with signed links or 'DNI no adjuntat' */}
            <div className="border-t border-dashed border-zinc-200 pt-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-600 font-bold uppercase tracking-wide">
                  DNI {registration.c1Nom || 'P1'}:
                </span>
                {c1DniSignedUrl ? (
                  <a 
                    href={c1DniSignedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 text-fuchsia-600 font-bold hover:underline"
                  >
                    <ExternalLink size={12} /> {language === 'ca' ? 'Veure document adjunt' : 'Ver documento adjunto'}
                  </a>
                ) : (
                  <span className="text-amber-700 bg-amber-50 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    ⚠️ {language === 'ca' ? 'DNI no adjuntat' : 'DNI no adjuntado'}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-600 font-bold uppercase tracking-wide">
                  DNI {registration.c2Nom || 'P2'}:
                </span>
                {c2DniSignedUrl ? (
                  <a 
                    href={c2DniSignedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 text-fuchsia-600 font-bold hover:underline"
                  >
                    <ExternalLink size={12} /> {language === 'ca' ? 'Veure document adjunt' : 'Ver documento adjunto'}
                  </a>
                ) : (
                  <span className="text-amber-700 bg-amber-50 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    ⚠️ {language === 'ca' ? 'DNI no adjuntat' : 'DNI no adjuntado'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Itemized Materials Breakdown Table (Single Source of Truth) */}
          <div className="space-y-2">
            <h4 className="font-sans font-bold text-zinc-900 text-xs uppercase tracking-wider">
              {language === 'ca' ? 'DESGLOSSAMENT OFICIAL DE MATERIALS I QUOTA:' : 'DESGLOSE OFICIAL DE MATERIALES Y CUOTA:'}
            </h4>

            <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                    <th className="py-2 px-3">{language === 'ca' ? 'Concepte / Material' : 'Concepto / Material'}</th>
                    <th className="py-2 px-2 text-center">{language === 'ca' ? 'Quant.' : 'Cant.'}</th>
                    <th className="py-2 px-2 text-center">{language === 'ca' ? 'Modalitat' : 'Modalidad'}</th>
                    <th className="py-2 px-2 text-right">{language === 'ca' ? 'Preu' : 'Precio'}</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
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
                </tbody>
                <tfoot>
                  <tr className="bg-fuchsia-50/70 border-t-2 border-fuchsia-500 text-zinc-900">
                    <td colSpan={4} className="py-3 px-3 font-black text-xs uppercase tracking-wider">
                      {language === 'ca' ? 'TOTAL A PAGAR:' : 'TOTAL A PAGAR:'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-lg text-fuchsia-600">
                      {breakdown.totalCalculat}€
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Real Logistics from Secretaria only if configured */}
          {(entityConfig.direccio || entityConfig.diesEntrega || entityConfig.horari) ? (
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 space-y-3">
              <h4 className="font-sans font-bold text-zinc-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-fuchsia-600" />
                {language === 'ca' ? 'PUNT DE RECOLLIDA I ATENCIÓ:' : 'PUNTO DE RECOGIDA Y ATENCIÓN:'}
              </h4>
              
              <div className="text-xs text-zinc-600 space-y-2 leading-relaxed">
                {entityConfig.direccio && (
                  <p>
                    <strong className="text-zinc-800">{entityConfig.nom}</strong><br/>
                    {entityConfig.direccio}
                  </p>
                )}
                {entityConfig.diesEntrega && (
                  <p>
                    <strong className="text-zinc-800">{language === 'ca' ? 'Dies de lliurament i caixa:' : 'Días de entrega y cobro:'}</strong><br/>
                    {entityConfig.diesEntrega}
                  </p>
                )}
                {entityConfig.horari && (
                  <p>
                    <strong className="text-zinc-800">{language === 'ca' ? 'Horari de Secretaria:' : 'Horario de Secretaría:'}</strong><br/>
                    {entityConfig.horari}
                  </p>
                )}
                <p>
                  <strong className="text-zinc-800">{language === 'ca' ? 'Contacte oficial:' : 'Contacto oficial:'}</strong><br/>
                  <a href="mailto:tastvng@gmail.com" className="text-fuchsia-600 font-bold hover:underline">tastvng@gmail.com</a>
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-center">
              <p className="text-xs text-zinc-600 m-0">
                <strong className="text-zinc-800">{entityConfig.nom}</strong> &bull; <a href="mailto:tastvng@gmail.com" className="text-fuchsia-600 font-bold hover:underline">tastvng@gmail.com</a>
              </p>
            </div>
          )}
        </div>

        {/* Decorative ticket notch borders */}
        <div className="absolute top-[82px] -left-3 w-6 h-6 bg-[#fafafa] border-r border-zinc-200/80 rounded-full z-10 print:hidden" />
        <div className="absolute top-[82px] -right-3 w-6 h-6 bg-[#fafafa] border-l border-zinc-200/80 rounded-full z-10 print:hidden" />
      </motion.div>

      {/* Automated Email SMTP Live Status Banner/Panel */}
      <div className={`border rounded-3xl p-5 mb-6 text-white text-xs relative overflow-hidden shadow-2xl print:hidden animate-fade-in transition-all duration-300 ${
        smtpStatus === 'not_configured' ? 'bg-amber-950/80 border-amber-800' :
        smtpStatus === 'sending' ? 'bg-zinc-900 border-zinc-800 animate-pulse' :
        smtpStatus === 'success' ? 'bg-emerald-950/80 border-emerald-800' :
        'bg-rose-950/80 border-rose-800'
      }`}>
        <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            {smtpStatus === 'sending' && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-400"></span>
              </span>
            )}
            {smtpStatus === 'success' && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
            {smtpStatus === 'error' && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 animate-pulse"></span>
              </span>
            )}
            <div>
              <p className="font-bold text-zinc-100 flex items-center gap-1.5">
                <Send size={12} className="text-fuchsia-400" />
                {smtpStatus === 'sending' && (language === 'ca' ? 'Enviant correu real...' : 'Enviando correo real...')}
                {smtpStatus === 'success' && (language === 'ca' ? 'Servidor SMTP El Tast: Enviat Real' : 'Servidor SMTP El Tast: Enviado Real')}
                {smtpStatus === 'error' && (language === 'ca' ? "Error en l'enviament SMTP Real" : "Error en el envío SMTP Real")}
              </p>
              <p className="text-[10px] text-zinc-400 font-mono">
                {smtpStatus === 'sending' && (language === 'ca' ? 'Connectant amb el servidor SMTP i autenticant...' : 'Conectando con el servidor SMTP y autenticando...')}
                {smtpStatus === 'success' && (language === 'ca' ? 'Correu de confirmació lliurat correctament de forma real als participants' : 'Correo de confirmación entregado correctamente de forma real')}
                {smtpStatus === 'error' && (language === 'ca' ? "No s'ha pogut enviar el correu" : "No se ha podido enviar el correo")}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowEmailPreview(!showEmailPreview)}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/15 text-white font-bold py-1.5 px-3 rounded-lg border border-white/10 transition cursor-pointer text-[10px]"
          >
            <Inbox size={12} className="text-fuchsia-400" />
            {language === 'ca' ? 'Veure correu redactat' : 'Ver correo redactado'}
            {showEmailPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Real-time micro details */}
        <div className="mt-3 space-y-1 font-mono text-[10px] text-zinc-400">
          <p><span className="text-zinc-600 font-bold">DE:</span> <span className="text-fuchsia-400 font-bold">{entityConfig.email}</span> <span className="text-[8px] bg-white/5 border border-white/10 px-1 py-0.5 rounded text-zinc-300 uppercase ml-1">Live Connection</span></p>
          <p><span className="text-zinc-600 font-bold">A:</span> <span className="text-zinc-200 font-bold">{registration.emailContactoPareja || registration.c1Email || registration.c2Email}</span></p>
          <p><span className="text-zinc-600 font-bold">ASSUMPTE:</span> <span className="text-zinc-200 font-sans">{unifiedEmailContent.subject}</span></p>
        </div>

        {/* Email preview */}
        {showEmailPreview && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 border border-zinc-700 rounded-2xl overflow-hidden bg-white text-zinc-900 w-full p-4 max-h-96 overflow-y-auto"
          >
            <div dangerouslySetInnerHTML={{ __html: unifiedEmailContent.html }} />
          </motion.div>
        )}
      </div>

      {/* Buttons actions row */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        <button 
          onClick={handlePrint}
          className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3.5 px-4 rounded-2xl transition hover:scale-[1.01] flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
          id="btn-print-voucher"
        >
          <Printer size={16} /> {language === 'ca' ? 'Imprimir / PDF' : 'Imprimir / PDF'}
        </button>
        <button 
          onClick={onClear}
          className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3.5 px-4 rounded-2xl transition hover:scale-[1.01] flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
          id="btn-new-registration"
        >
          {language === 'ca' ? 'Nova preinscripció' : 'Nueva preinscripción'} <RefreshCw size={14} />
        </button>
      </div>

      <div className="text-center mt-6 print:hidden">
        <button 
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-zinc-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft size={12} /> {t('back_btn')}
        </button>
      </div>
    </div>
  );
}
