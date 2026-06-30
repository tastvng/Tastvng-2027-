/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Download, Mail, Calendar, MapPin, Printer, ArrowLeft, RefreshCw, Sparkle, ChevronDown, ChevronUp, Send, Inbox, AlertTriangle } from 'lucide-react';
import { Inscripcio, CategoriaParella } from '../types';
import { useLanguage } from '../LanguageContext';

interface ConfirmationProps {
  registration: Inscripcio;
  onClear: () => void;
  onUpdate?: (updatedReg: Inscripcio) => void;
}

export default function Confirmation({ registration, onClear, onUpdate }: ConfirmationProps) {
  const { language, t } = useLanguage();
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'not_configured'>('idle');
  const [smtpError, setSmtpError] = useState('');

  const [nomEsdeveniment, setNomEsdeveniment] = useState(() => {
    const activeYear = localStorage.getItem('tast_any_edicio') || '2026';
    const rawName = localStorage.getItem('tast_nom_esdeveniment') || 'Carnaval 2026';
    return rawName.replace(/2026/g, activeYear).replace(/2027/g, activeYear);
  });
  const [direccioEsdeveniment, setDireccioEsdeveniment] = useState(() => localStorage.getItem('tast_direccio_esdeveniment') || 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú');

  const [subSubjectCa, setSubSubjectCa] = useState(() => localStorage.getItem('tast_email_subject_ca') || `🎟️ El Tast ${nomEsdeveniment} - Confirmació d'Inscripció`);
  const [subSubjectEs, setSubSubjectEs] = useState(() => localStorage.getItem('tast_email_subject_es') || `🎟️ El Tast ${nomEsdeveniment} - Confirmación de Inscripción`);
  const [subBodyCa, setSubBodyCa] = useState(() => localStorage.getItem('tast_email_body_ca') || `S'ha generat correctament el vostre comprovant per a ${nomEsdeveniment}.`);
  const [subBodyEs, setSubBodyEs] = useState(() => localStorage.getItem('tast_email_body_es') || `Se ha generado correctamente vuestro comprobante para ${nomEsdeveniment}.`);
  const [subLogo, setSubLogo] = useState(() => localStorage.getItem('tast_email_logo') || "");

  const [hoursConfigCa, setHoursConfigCa] = useState(() => localStorage.getItem('tast_secretaria_hours_ca') || "Dimecres i divendres, de 18:00h a 21:30h.");
  const [hoursConfigEs, setHoursConfigEs] = useState(() => localStorage.getItem('tast_secretaria_hours_es') || "Miércoles y viernes, de 18:00h a 21:30h.");

  useEffect(() => {
    // 1. Initial load from local cache if pre-existing
    const loadCustomTemplates = () => {
      const activeYear = localStorage.getItem('tast_any_edicio') || '2026';
      const rawName = localStorage.getItem('tast_nom_esdeveniment') || 'Carnaval 2026';
      const activeEvName = rawName.replace(/2026/g, activeYear).replace(/2027/g, activeYear);
      const activeEvDir = localStorage.getItem('tast_direccio_esdeveniment') || 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú';
      
      setNomEsdeveniment(activeEvName);
      setDireccioEsdeveniment(activeEvDir);

      setSubSubjectCa(localStorage.getItem('tast_email_subject_ca') || `🎟️ El Tast ${activeEvName} - Confirmació d'Inscripció`);
      setSubSubjectEs(localStorage.getItem('tast_email_subject_es') || `🎟️ El Tast ${activeEvName} - Confirmación de Inscripción`);
      setSubBodyCa(localStorage.getItem('tast_email_body_ca') || `S'ha generat correctament el vostre comprovant per a ${activeEvName}.`);
      setSubBodyEs(localStorage.getItem('tast_email_body_es') || `Se ha generado correctamente vuestro comprobante para ${activeEvName}.`);
      setSubLogo(localStorage.getItem('tast_email_logo') || "");

      setHoursConfigCa(localStorage.getItem('tast_secretaria_hours_ca') || "Dimecres i divendres, de 18:00h a 21:30h.");
      setHoursConfigEs(localStorage.getItem('tast_secretaria_hours_es') || "Miércoles y viernes, de 18:00h a 21:30h.");
    };
    loadCustomTemplates();

    // 2. Real-time fetch directly from Supabase to prevent empty/outdated cache mismatch
    async function loadLiveSupabaseTemplates() {
      try {
        const { getSupabaseSetting, isSupabaseConfigured } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          const liveEvNameRaw = await getSupabaseSetting<string>('tast_nom_esdeveniment', 'Carnaval 2026');
          const liveEvYear = await getSupabaseSetting<string>('tast_any_edicio', '2026');
          const liveEvName = liveEvNameRaw.replace(/2026/g, liveEvYear).replace(/2027/g, liveEvYear);
          const liveEvDir = await getSupabaseSetting<string>('tast_direccio_esdeveniment', 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú');
          
          if (liveEvName) {
            setNomEsdeveniment(liveEvName);
            localStorage.setItem('tast_nom_esdeveniment', liveEvName);
          }
          if (liveEvYear) {
            localStorage.setItem('tast_any_edicio', liveEvYear);
          }
          if (liveEvDir) {
            setDireccioEsdeveniment(liveEvDir);
            localStorage.setItem('tast_direccio_esdeveniment', liveEvDir);
          }

          const liveSubjectCa = await getSupabaseSetting<string>('tast_email_subject_ca', '');
          const liveSubjectEs = await getSupabaseSetting<string>('tast_email_subject_es', '');
          const liveBodyCa = await getSupabaseSetting<string>('tast_email_body_ca', '');
          const liveBodyEs = await getSupabaseSetting<string>('tast_email_body_es', '');
          const liveLogo = await getSupabaseSetting<string>('tast_email_logo', '');
          const liveHoursCa = await getSupabaseSetting<string>('tast_secretaria_hours_ca', '');
          const liveHoursEs = await getSupabaseSetting<string>('tast_secretaria_hours_es', '');

          const activeName = liveEvName || `Carnaval ${liveEvYear}`;

          if (liveSubjectCa) {
            setSubSubjectCa(liveSubjectCa);
            localStorage.setItem('tast_email_subject_ca', liveSubjectCa);
          } else if (liveEvName) {
            setSubSubjectCa(`🎟️ El Tast ${activeName} - Confirmació d'Inscripció`);
          }

          if (liveSubjectEs) {
            setSubSubjectEs(liveSubjectEs);
            localStorage.setItem('tast_email_subject_es', liveSubjectEs);
          } else if (liveEvName) {
            setSubSubjectEs(`🎟️ El Tast ${activeName} - Confirmación de Inscripción`);
          }

          if (liveBodyCa) {
            setSubBodyCa(liveBodyCa);
            localStorage.setItem('tast_email_body_ca', liveBodyCa);
          } else if (liveEvName) {
            setSubBodyCa(`S'ha generat correctament el vostre comprovant per a ${activeName}.`);
          }

          if (liveBodyEs) {
            setSubBodyEs(liveBodyEs);
            localStorage.setItem('tast_email_body_es', liveBodyEs);
          } else if (liveEvName) {
            setSubBodyEs(`Se ha generado correctamente vuestro comprobante para ${activeName}.`);
          }

          if (liveLogo) {
            setSubLogo(liveLogo);
            localStorage.setItem('tast_email_logo', liveLogo);
          }
          if (liveHoursCa) {
            setHoursConfigCa(liveHoursCa);
            localStorage.setItem('tast_secretaria_hours_ca', liveHoursCa);
          }
          if (liveHoursEs) {
            setHoursConfigEs(liveHoursEs);
            localStorage.setItem('tast_secretaria_hours_es', liveHoursEs);
          }
        }
      } catch (err) {
        console.error("Error loading live Supabase templates inside Confirmation.tsx:", err);
      }
    }
    loadLiveSupabaseTemplates();

    window.addEventListener('localStorage', loadCustomTemplates);
    window.addEventListener('hoursConfigChanged', loadCustomTemplates);
    window.addEventListener('eventDataChanged', loadCustomTemplates);
    return () => {
      window.removeEventListener('localStorage', loadCustomTemplates);
      window.removeEventListener('hoursConfigChanged', loadCustomTemplates);
      window.removeEventListener('eventDataChanged', loadCustomTemplates);
    };
  }, []);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(registration.id)}`;

  const sendRealEmail = async () => {
    setSmtpStatus('sending');
    setSmtpError('');

    try {
      const emailList = [registration.c1Email, registration.c2Email].filter(Boolean).filter(email => email.includes('@'));
      if (emailList.length === 0) {
        setSmtpStatus('error');
        setSmtpError(language === 'ca' 
          ? "S'ha trobat cap adreça de correu vàlida per als participants." 
          : "No se encontró ninguna dirección de correo válida para los participantes.");
        return;
      }

      const emailSubjectBase = language === 'ca' ? subSubjectCa : subSubjectEs;
      const emailSubject = `${emailSubjectBase} ${registration.codiSeguiment}`;

      const extrasHtml = `
        ${registration.teDomasBalco ? `<li>• 1x ${language === 'ca' ? 'Domàs de Balcó (Domás de Balcón)' : 'Colgadura de Balcón'}</li>` : ''}
        ${registration.teMocadorsExtra > 0 ? `<li>• ${registration.teMocadorsExtra}x ${language === 'ca' ? 'Mocador oficial extra (Pañuelo extra)' : 'Pañuelo oficial extra'}</li>` : ''}
      `;

      const emailBodyText = language === 'ca' ? subBodyCa : subBodyEs;

      let logoHtml = '';
      const emailAttachments: any[] = [];

      if (subLogo) {
        if (subLogo.startsWith('data:')) {
          logoHtml = `<div style="text-align: center; margin-bottom: 25px;"><img src="cid:tast-email-logo-cid" alt="Logo" style="max-height: 70px; max-width: 210px; object-fit: contain; margin: 0 auto; display: block; border-radius: 8px;" /></div>`;
          emailAttachments.push({
            filename: 'logo.png',
            content: subLogo,
            cid: 'tast-email-logo-cid'
          });
        } else {
          logoHtml = `<div style="text-align: center; margin-bottom: 25px;"><img src="${subLogo}" alt="Logo" style="max-height: 70px; max-width: 210px; object-fit: contain; margin: 0 auto; display: block; border-radius: 8px;" /></div>`;
        }
      } else {
        logoHtml = `<div style="text-align: center; margin-bottom: 25px;">
            <span style="background-color: #ff0090; color: #ffffff; padding: 10px 24px; font-size: 13px; font-weight: bold; border-radius: 50px; letter-spacing: 1px; display: inline-block; text-transform: uppercase;">
              Associació Cultural El Tast
            </span>
          </div>`;
      }

      const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e1e1e6; border-radius: 24px; background-color: #ffffff; color: #111115;">
          ${logoHtml}
          
          <h1 style="color: #111115; font-size: 24px; font-weight: 800; text-align: center; margin: 15px 0 5px 0; text-transform: uppercase; letter-spacing: -0.5px;">
            ${language === 'ca' ? "Preinscripció Confirmada!" : "¡Preinscripción Confirmada!"}
          </h1>
          <p style="font-size: 14px; text-align: center; color: #666670; margin-top: 0; margin-bottom: 25px;">
            ${emailBodyText}
          </p>

          <div style="border-top: 2px solid #ff0090; margin: 20px 0;"></div>

          <div style="background-color: #fcf6fa; border: 1px dashed #ff0090; padding: 20px; border-radius: 18px; text-align: center; margin-bottom: 30px;">
            <p style="font-size: 11px; font-family: monospace; color: #cc0073; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">
              ${language === 'ca' ? 'CODI DE SEGUIMENT OFICIAL' : 'CÓDIGO DE SEGUIMIENTO OFICIAL'}
            </p>
            <p style="font-size: 28px; font-family: monospace; font-weight: 900; color: #ff0090; margin: 0; letter-spacing: 1px;">
              ${registration.codiSeguiment}
            </p>
          </div>

          <!-- QR Container -->
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; padding: 15px; background-color: #f8f9fa; border: 1px solid #e1e1e6; border-radius: 20px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(registration.id)}" 
                   alt="QR Code" width="180" height="180" style="display: block; border-radius: 10px;" />
            </div>
            <p style="font-size: 11px; color: #888890; margin-top: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.5px;">
              ${language === 'ca' ? 'Presenteu aquest QR a Secretaria per pagar' : 'Presenten este QR en Secretaría para pagar'}
            </p>
          </div>

          <!-- Couples and details table -->
          <div style="border-top: 1px solid #e1e1e6; border-bottom: 1px solid #e1e1e6; padding: 15px 0; margin-bottom: 30px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #666670; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                  ${language === 'ca' ? 'Parella:' : 'Pareja:'}
                </td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111115;">
                  ${registration.c1Nom} &amp; ${registration.c2Nom}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666670; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                  ${language === 'ca' ? 'Categoria (Categoría):' : 'Categoría:'}
                </td>
                <td style="padding: 8px 0; text-align: right; color: #111115; font-family: monospace;">
                  ${registration.categoria === CategoriaParella.ADULT 
                    ? (language === 'ca' ? 'PARELLA ADULTA' : 'PAREJA ADULTA') 
                    : (language === 'ca' ? 'PARELLA JUVENIL' : 'PAREJA JUVENIL')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666670; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                  ${language === 'ca' ? 'Inscripció:' : 'Inscripción:'}
                </td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">
                  ${(registration.estatInscripcio === 'llista_espera' || (!registration.estatInscripcio && registration.llistaEspera))
                    ? `<span style="color: #b45309; background-color: #fef3c7; border: 1px solid #f59e0b; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-family: sans-serif; font-weight: bold; display: inline-block;">${language === 'ca' ? "LLISTA D'ESPERA" : "LISTA DE ESPERA"}</span>`
                    : `<span style="color: #047857; background-color: #d1fae5; border: 1px solid #10b981; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-family: sans-serif; font-weight: bold; display: inline-block;">${language === 'ca' ? "OBERTA" : "ABIERTA"}</span>`
                  }
                </td>
              </tr>
              ${registration.posicioGlobal ? `
              <tr>
                <td style="padding: 8px 0; color: #666670; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                  ${language === 'ca' ? 'Posició:' : 'Posición:'}
                </td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111115; font-family: monospace; font-size: 14px;">
                  #${registration.posicioGlobal}
                </td>
              </tr>
              ` : ''}
              ${extrasHtml ? `
              <tr>
                <td style="padding: 8px 0; color: #666670; font-weight: bold; text-transform: uppercase; font-size: 11px; vertical-align: top;">
                  ${language === 'ca' ? 'Complements:' : 'Complementos:'}
                </td>
                <td style="padding: 8px 0; text-align: right; color: #333338;">
                  <ul style="margin: 0; padding: 0; list-style: none; line-height: 1.4;">
                    ${extrasHtml}
                  </ul>
                </td>
              </tr>
              ` : ''}
              <tr style="border-top: 1px dashed #e1e1e6;">
                <td style="padding: 15px 0 8px 0; color: #111110; font-weight: 950; font-size: 14px; text-transform: uppercase;">
                  ${language === 'ca' ? 'Total a Pagar:' : 'Total a Pagar:'}
                </td>
                <td style="padding: 15px 0 8px 0; text-align: right; font-weight: 950; color: #ff0090; font-size: 22px;">
                  ${registration.preuCalculat}€
                </td>
              </tr>
            </table>
          </div>

          <!-- Next Steps -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 18px; margin-bottom: 30px;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 13px; color: #111115; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 850;">
              ${language === 'ca' ? '📦 PROXIMS PASOS I RECOLLIDA:' : '📦 PRÓXIMOS PASOS Y RECOGIDA:'}
            </h3>
            <div style="font-size: 13px; color: #44444f; line-height: 1.6;">
              <p style="margin: 0 0 8px 0;">
                <strong>1. ${language === 'ca' ? "Sede d'El Tast" : "Sede de El Tast"}:</strong><br/>
                ${language === 'ca'
                  ? "Presenteu-vos a la secretaria de l'associació cultural amb el codi QR adjunt."
                  : "Preséntense en la secretaría de la asociación cultural mostrando el código QR adjunto."}
              </p>
              <p style="margin: 0;">
                <strong>2. ${language === 'ca' ? 'Dies de lliurament i caixa' : 'Días de entrega y cobro'}:</strong><br/>
                ${language === 'ca'
                  ? "Dimecres i divendres previs als dards de comparses, de 18:00h a 21:30h."
                  : "Miércoles y viernes previos a los días de comparsas, de 18:00h a 21:30h."}
              </p>
            </div>
          </div>

          <div style="border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center;">
            <p style="font-size: 11px; color: #99999f; margin: 0; line-height: 1.5;">
              <strong>Associació Cultural El Tast de Vilanova i la Geltrú</strong><br/>
              Carrer de l'Aigua, 12, Vilanova i la Geltrú &bull; <a href="mailto:secretaria@eltast.cat" style="color: #ff0090; text-decoration: none;">secretaria@eltast.cat</a>
            </p>
          </div>
        </div>
      `;

      // Dispatch to all emails (passing base64 media payload as real MIME CID attachment)
      const sendPromises = emailList.map(emailTo => {
        return fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailData: {
              to: emailTo,
              subject: emailSubject,
              html: emailHtml,
              attachments: emailAttachments
            }
          })
        }).catch(err => {
          console.error(`Fetch to /api/send-email failed for ${emailTo}:`, err);
          return {
            ok: false,
            status: 500,
            text: async () => err.message || String(err)
          } as Response;
        });
      });

      const results = await Promise.all(sendPromises);
      const errorsList: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (!res.ok) {
          const text = await res.text();
          let errText = '';
          try {
            const data = JSON.parse(text);
            errText = data.error || data.message || '';
          } catch {
            // Not JSON
          }
          if (!errText) {
            errText = text.substring(0, 150) || `HTTP Error ${res.status}`;
          }
          errorsList.push(`${emailList[i]}: ${errText}`);
        }
      }

      if (errorsList.length === 0) {
        setSmtpStatus('success');
        if (onUpdate) {
          onUpdate({
            ...registration,
            respostesCuestionari: {
              ...registration.respostesCuestionari,
              estatCorreu: 'enviat'
            }
          });
        }
      } else {
        setSmtpStatus('error');
        setSmtpError(errorsList.join(', '));
        if (onUpdate) {
          onUpdate({
            ...registration,
            respostesCuestionari: {
              ...registration.respostesCuestionari,
              estatCorreu: 'fallat'
            }
          });
        }
      }
    } catch (err: any) {
      console.error("Error sending registration SMTP mail:", err);
      setSmtpStatus('error');
      setSmtpError(err.message || 'Error de conexión');
      if (onUpdate) {
        onUpdate({
          ...registration,
          respostesCuestionari: {
            ...registration.respostesCuestionari,
            estatCorreu: 'fallat'
          }
        });
      }
    }
  };

  useEffect(() => {
    sendRealEmail();
  }, [registration.id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-xl mx-auto py-4">
      {/* Visual background confetti particles */}
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
          {t('conf_title')}
        </h1>
        <p className="text-zinc-500 text-sm max-w-sm mx-auto font-sans leading-relaxed">
          {language === 'ca' ? (
            <>Ben fet! Hem registrat la vostra parella per a l'esdeveniment {nomEsdeveniment} de l'entitat <strong className="text-fuchsia-600">El Tast</strong>.</>
          ) : (
            <>¡Buen trabajo! Hemos registrado a vuestra pareja para el evento {nomEsdeveniment} de la entidad <strong className="text-fuchsia-600">El Tast</strong>.</>
          )}
        </p>
      </div>

      {/* High-visibility warning alert for SMTP sending error */}
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
                {language === 'ca' ? "⚠️ El correu de confirmació no s'ha enviat" : "⚠️ El correo de confirmación no se ha enviado"}
              </p>
              <p className="font-sans text-xs text-red-800 mt-1 leading-relaxed">
                {language === 'ca' 
                  ? "S'ha trobat un error en el servidor de correu d'El Tast. Podeu provar de tornar-lo a enviar de forma manual ara."
                  : "Se ha encontrado un error en el servidor de correo de El Tast. Podéis probar a volver a enviarlo de forma manual ahora."}
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
            {language === 'ca' ? "Enviar manualment" : "Enviar manualmente"}
          </button>
        </motion.div>
      )}

      {/* Main voucher printable ticket */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white border-2 border-zinc-200/80 rounded-[32px] overflow-hidden shadow-xl mb-6 relative print:border-none print:shadow-none"
        id="ticket-printable"
      >
        {/* Festive top banner */}
        <div className="bg-zinc-900 text-white p-6 text-center space-y-1 relative border-b border-zinc-800">
          <span className="font-mono text-[9px] text-fuchsia-400 font-bold tracking-widest uppercase block">
            {language === 'ca' ? 'COMPROVANT OFICIAL DE REGISTRE' : 'COMPROBANTE OFICIAL DE REGISTRO'}
          </span>
          <h2 className="font-sans font-black text-xl text-white tracking-tight flex items-center justify-center gap-1.5 uppercase">
            <span className="text-fuchsia-500">EL TAST</span> {nomEsdeveniment}
          </h2>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-fuchsia-600 text-white font-mono font-bold text-xs px-4 py-1.5 rounded-full shadow-md">
            {registration.codiSeguiment}
          </div>
        </div>

        {/* Info contents */}
        <div className="p-8 pt-10 space-y-6">
          {/* QR representation */}
          <div className="flex flex-col items-center justify-center pt-2 pb-4">
            <div className="p-3 bg-zinc-55 rounded-2xl border-2 border-fuchsia-500/20 shadow-md relative group bg-zinc-50">
              <img 
                src={qrUrl} 
                alt="Codi QR de Registre" 
                className="w-48 h-48 block"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none" />
            </div>
            <p className="text-[10px] text-zinc-400 font-mono text-center mt-3 uppercase tracking-wider">
              {language === 'ca' ? 'Presenteu aquest QR als revisors per fer el pagament' : 'Presenten este QR a los revisores para realizar el pago'}
            </p>
          </div>

          {/* Couples detail blocks */}
          <div className="border-t border-b border-zinc-100 py-4 space-y-3.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">
                {language === 'ca' ? 'Parella:' : 'Pareja:'}
              </span>
              <span className="font-semibold text-zinc-900 text-right">
                {registration.c1Nom} &amp; {registration.c2Nom}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">
                {language === 'ca' ? 'Categoria:' : 'Categoría:'}
              </span>
              <span className="bg-fuchsia-50 text-fuchsia-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px] font-mono">
                {registration.categoria === CategoriaParella.ADULT 
                  ? (language === 'ca' ? 'PARELLA ADULTA' : 'PAREJA ADULTA') 
                  : (language === 'ca' ? 'PARELLA JUVENIL' : 'PAREJA JUVENIL')}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">
                {language === 'ca' ? 'Inscripció:' : 'Inscripción:'}
              </span>
              {(registration.estatInscripcio === 'llista_espera' || (!registration.estatInscripcio && registration.llistaEspera)) ? (
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
                  {language === 'ca' ? 'Posició:' : 'Posición:'}
                </span>
                <span className="text-[#ff0090] font-mono font-black text-xs bg-fuchsia-50 px-2 py-0.5 rounded-lg">
                  #{registration.posicioGlobal}
                </span>
              </div>
            )}

            {registration.teDomasBalco || registration.teMocadorsExtra > 0 ? (
              <div className="flex justify-between items-start text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-wide">
                  {language === 'ca' ? 'Complements:' : 'Complementos:'}
                </span>
                <span className="font-semibold text-zinc-800 text-right space-y-0.5 block">
                  {registration.teDomasBalco && (
                    <span className="block">
                      {language === 'ca' ? '+1 Domàs de Balcó' : '+1 Colgadura de Balcón'}
                    </span>
                  )}
                  {registration.teMocadorsExtra > 0 && (
                    <span className="block">
                      {language === 'ca' 
                        ? `+${registration.teMocadorsExtra} Mocador oficial` 
                        : `+${registration.teMocadorsExtra} Pañuelo oficial`}
                    </span>
                  )}
                </span>
              </div>
            ) : null}

            <div className="flex justify-between items-center text-xs border-t border-dashed border-zinc-200 pt-3">
              <span className="text-zinc-900 font-extrabold text-sm uppercase">
                {language === 'ca' ? 'Total a pagar:' : 'Total a pagar:'}
              </span>
              <span className="font-sans font-black text-xl text-fuchsia-600">
                {registration.preuCalculat}€
              </span>
            </div>
          </div>

          {/* Logistics steps cards */}
          <div className="space-y-3">
            <h4 className="font-sans font-bold text-zinc-800 text-xs uppercase tracking-wider mb-2">
              {language === 'ca' ? 'PROXIMS PASOS DE RECOLLIDA:' : 'PRÓXIMOS PASOS DE RECOGIDA:'}
            </h4>
            
            <div className="flex gap-3 text-xs">
              <Mail className="shrink-0 text-fuchsia-500 mt-0.5" size={16} />
              <div>
                <p className="font-bold text-zinc-800">
                  {language === 'ca' ? 'Codi QR enviat al correu' : 'Código QR enviado al correo'}
                </p>
                <p className="text-zinc-500 leading-relaxed">
                  {language === 'ca' 
                    ? `Hem enviat una còpia d'aquest comprobat a `
                    : `Hemos enviado una copia de este comprobante a `}
                  <span className="font-mono">{registration.c1Email}</span>
                  {language === 'ca' ? ' i ' : ' y '}
                  <span className="font-mono">{registration.c2Email}</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-xs">
              <MapPin className="shrink-0 text-fuchsia-500 mt-0.5" size={16} />
              <div>
                <p className="font-bold text-zinc-800">
                  {language === 'ca' ? "Seu d'El Tast Vilanova" : "Sede de El Tast Vilanova"}
                </p>
                <p className="text-zinc-500 leading-relaxed">
                  {language === 'ca'
                    ? "Presenteu-vos a la secretaria de l'associació cultural presentant aquest codi."
                    : "Preséntense en la secretaría de la asociación cultural mostrando este código."}
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-xs">
              <Calendar className="shrink-0 text-fuchsia-500 mt-0.5" size={16} />
              <div>
                <p className="font-bold text-zinc-800">
                  {language === 'ca' ? 'Dies de lliurament i caixa' : 'Días de entrega y cobro'}
                </p>
                <p className="text-zinc-500 leading-relaxed">
                  {language === 'ca' ? hoursConfigCa : hoursConfigEs}
                </p>
              </div>
            </div>
          </div>
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
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            {smtpStatus === 'not_configured' && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            )}
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
                <Send size={12} className="text-fuchsia-400 animate-pulse" />
                {smtpStatus === 'not_configured' && (language === 'ca' ? 'SMTP: Rebut simulador (Sense configurar)' : 'SMTP: Recibo simulado (Sin configurar)')}
                {smtpStatus === 'sending' && (language === 'ca' ? 'Enviant correu real...' : 'Enviando correo real...')}
                {smtpStatus === 'success' && (language === 'ca' ? 'Servidor SMTP El Tast: Enviat Real' : 'Servidor SMTP El Tast: Enviado Real')}
                {smtpStatus === 'error' && (language === 'ca' ? "Error en l'enviament SMTP Real" : "Error en el envío SMTP Real")}
              </p>
              <p className="text-[10px] text-zinc-400 font-mono">
                {smtpStatus === 'not_configured' && (language === 'ca' ? 'Configureu el correu d’oficina al menú d’administrador per enviar-ne de reals' : 'Configure el correo de oficina en el menú de administrador de forma real')}
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
            <Inbox size={12} className="text-fuchsia-400 animate-bounce" />
            {language === 'ca' ? 'Veure correu redactat' : 'Ver correo redactado'}
            {showEmailPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Real-time micro details */}
        <div className="mt-3 space-y-1 font-mono text-[10px] text-zinc-400">
          <p><span className="text-zinc-600 font-bold">DE:</span> <span className="text-fuchsia-400 font-bold">{localStorage.getItem('tast_smtp_usuari') || 'tastvng@gmail.com'}</span> <span className="text-[8px] bg-white/5 border border-white/10 px-1 py-0.5 rounded text-zinc-300 uppercase ml-1 uppercase">Live Connection</span></p>
          <p><span className="text-zinc-600 font-bold">A:</span> <span className="text-zinc-200 font-bold">{registration.c1Email}</span>, <span className="text-zinc-200 font-bold">{registration.c2Email}</span></p>
          <p><span className="text-zinc-600 font-bold">ASSUMPTE / ASUNTO:</span> <span className="text-zinc-200 font-sans">{language === 'ca' ? `${subSubjectCa} ${registration.codiSeguiment}` : `${subSubjectEs} ${registration.codiSeguiment}`}</span></p>
          
          {smtpStatus === 'error' && (
            <div className="mt-3 p-3 bg-red-950/40 border border-red-900 rounded-xl space-y-1 text-left font-sans text-xs">
              <p className="font-sans font-bold text-red-300 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-450" />
                {language === 'ca' ? 'Motiu del rebuig del servidor:' : 'Motivo del rechazo del servidor:'}
              </p>
              <p className="text-red-200 select-all font-mono break-all text-[10px] bg-black/20 p-2 rounded-lg my-1">
                {smtpError}
              </p>
              <div className="text-red-450 text-[10px] pt-1 leading-relaxed space-y-1">
                <p className="font-bold">{language === 'ca' ? '💡 Com solucionar la incidència:' : '💡 Cómo solucionar la incidencia:'}</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>{language === 'ca' ? "S'està utilitzant Gmail? Cal activar la Verificació en 2 passos i generar una \"Contrasenya d'aplicació\"." : "¿Se está usando Gmail? Se debe activar la Verificación en 2 pasos y configurar una \"Contraseña de aplicación\"."}</li>
                  <li>{language === 'ca' ? "Comproveu si l'Host i el Port coincideixen (ex: Gmail té l'host smtp.gmail.com i port 587)." : "Comprobad si el Host y Puerto coinciden (ej: Gmail tiene el host smtp.gmail.com y el puerto 587)."}</li>
                  <li>{language === 'ca' ? "Assegureu-vos que l'usuari coincideix exactament amb l'adreça de correu remitent." : "Aseguraos de que el usuario coincide exactamente con la dirección de correo remitente."}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Toggleable high-fidelity Email body inside simulated browser frame */}
        {showEmailPreview && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 border border-zinc-805 rounded-2xl overflow-hidden bg-white text-zinc-900 w-full"
          >
            {/* Mock browser chrome window header bar */}
            <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200/70 flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 block" />
              </div>
              <span className="text-[9px] font-mono text-zinc-400 tracking-tight">https://secretaria.eltast.cat/inbox/webmail-viewer</span>
              <span className="w-6" />
            </div>

            {/* Email design frame */}
            <div className="p-4 sm:p-6 space-y-4 font-sans text-xs bg-zinc-100">
              <div className="bg-white p-5 rounded-2xl border border-zinc-200/70 shadow-md max-w-sm mx-auto space-y-4">
                {/* Email logo header */}
                <div className="text-center pb-3 border-b border-zinc-100 flex items-center justify-center gap-1.5 flex-col min-h-[58px]">
                  {subLogo ? (
                    <img 
                      src={subLogo} 
                      alt="Custom Logo" 
                      className="max-h-12 max-w-[150px] object-contain mx-auto rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-fuchsia-600 text-white flex items-center justify-center font-black tracking-wider text-sm shadow-md">
                        T
                      </div>
                      <h3 className="font-black text-xs tracking-tight text-zinc-900 mt-1">
                        EL TAST <span className="text-fuchsia-600">VILANOVA</span>
                      </h3>
                    </>
                  )}
                  <span className="text-[8px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
                    {nomEsdeveniment}
                  </span>
                </div>

                {/* Email text body */}
                <div className="space-y-3 leading-relaxed text-zinc-650">
                  <p className="font-black text-zinc-900 text-center text-xs">
                    {language === 'ca' ? `Hola, ${registration.c1Nom} i ${registration.c2Nom}!` : `¡Hola, ${registration.c1Nom} y ${registration.c2Nom}!`}
                  </p>
                  <p className="text-center text-[11px] leading-relaxed">
                    {language === 'ca' ? subBodyCa : subBodyEs}
                  </p>

                  <div className="bg-zinc-50 border border-zinc-200/50 rounded-xl p-3.5 text-center space-y-1">
                    <p className="text-[8px] font-mono text-zinc-400 uppercase font-black tracking-widest leading-none">
                      {language === 'ca' ? 'CODI DE SEGUIMENT' : 'CÓDIGO DE SEGUIMIENTO'}
                    </p>
                    <p className="text-base font-mono font-black text-fuchsia-600 tracking-tight">{registration.codiSeguiment}</p>
                    <div className="pt-2 border-t border-zinc-200/40 flex justify-between text-[10px]">
                      <span className="text-zinc-500 font-bold">{language === 'ca' ? 'Total preu de parella:' : 'Total precio de pareja:'}</span>
                      <span className="font-mono font-black text-zinc-800">{registration.preuCalculat}€</span>
                    </div>
                  </div>

                  {/* Embedded small QR */}
                  <div className="flex flex-col items-center justify-center py-2 bg-zinc-50 rounded-xl border border-zinc-150 p-2.5 gap-2">
                    <img 
                      src={qrUrl} 
                      alt="QR" 
                      className="w-24 h-24 block opacity-90 border border-zinc-200 p-1 bg-white rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[8px] font-mono text-zinc-400 font-bold uppercase text-center tracking-wider">
                      {language === 'ca' ? 'Mostreu el QR dels mòbils a secretaria' : 'Muestren el QR de los móviles en secretaría'}
                    </span>
                  </div>
                </div>

                {/* Email Button Mock */}
                <div className="text-center pt-2">
                  <div className="inline-block bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-[10px] px-4 py-2 rounded-xl uppercase tracking-wider font-sans">
                    {language === 'ca' ? 'Anar a la meva fitxa' : 'Ir a mi ficha'}
                  </div>
                </div>

                {/* Email Footer disclaimer */}
                <div className="text-center text-[8px] text-zinc-400 pt-3 border-t border-zinc-100 leading-normal space-y-0.5">
                  <p className="font-bold">Secretaria General d'Associació Cultural El Tast de Vilanova</p>
                  <p>{direccioEsdeveniment}</p>
                  <p className="font-bold text-fuchsia-650">{localStorage.getItem('tast_smtp_usuari') || 'tastvng@gmail.com'}</p>
                </div>
              </div>
            </div>
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
