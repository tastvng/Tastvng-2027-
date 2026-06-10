/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Download, Mail, Calendar, MapPin, Printer, ArrowLeft, RefreshCw, Sparkle, ChevronDown, ChevronUp, Send, Inbox } from 'lucide-react';
import { Inscripcio, CategoriaParella } from '../types';
import { useLanguage } from '../LanguageContext';

interface ConfirmationProps {
  registration: Inscripcio;
  onClear: () => void;
}

export default function Confirmation({ registration, onClear }: ConfirmationProps) {
  const { language, t } = useLanguage();
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(registration.id)}`;

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
            <>Ben fet! Hem registrat la vostra parella per a les comparses 2026 de l'entitat <strong className="text-fuchsia-600">El Tast</strong>.</>
          ) : (
            <>¡Buen trabajo! Hemos registrado a vuestra pareja para las comparsas 2026 de la entidad <strong className="text-fuchsia-600">El Tast</strong>.</>
          )}
        </p>
      </div>

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
          <h2 className="font-sans font-black text-xl text-white tracking-tight flex items-center justify-center gap-1.5">
            <span className="text-fuchsia-500">EL TAST</span> COMPARSES 2026
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
                  {language === 'ca'
                    ? "Dimecres i divendres previs als dards de comparses, de 18:00h a 21:30h."
                    : "Miércoles y viernes previos a los días de comparsas, de 18:00h a 21:30h."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative ticket notch borders */}
        <div className="absolute top-[82px] -left-3 w-6 h-6 bg-[#fafafa] border-r border-zinc-200/80 rounded-full z-10 print:hidden" />
        <div className="absolute top-[82px] -right-3 w-6 h-6 bg-[#fafafa] border-l border-zinc-200/80 rounded-full z-10 print:hidden" />
      </motion.div>

      {/* Automated Email SMTP Live Simulation Banner/Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-6 text-white text-xs relative overflow-hidden shadow-2xl print:hidden animate-fade-in">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-600/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div>
              <p className="font-bold text-zinc-200 flex items-center gap-1">
                <Send size={12} className="text-emerald-400 animate-pulse" />
                {language === 'ca' ? 'Servidor SMTP El Tast: Enviat' : 'Servidor SMTP El Tast: Enviado'}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">
                {language === 'ca' ? 'Correu de confirmació enviat automàticament' : 'Correo de confirmación enviado automáticamente'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowEmailPreview(!showEmailPreview)}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 text-white font-bold py-1.5 px-3 rounded-lg border border-zinc-700 transition cursor-pointer text-[10px]"
          >
            <Inbox size={12} className="text-fuchsia-400 animate-bounce" />
            {language === 'ca' ? 'Veure correu rebut' : 'Ver correo recibido'}
            {showEmailPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Real-time micro details */}
        <div className="mt-3 space-y-1 font-mono text-[10px] text-zinc-400">
          <p><span className="text-zinc-600 font-bold">DE:</span> <span className="text-fuchsia-400 font-bold">secretaria@eltast.cat</span> <span className="text-[8px] bg-white/5 border border-white/10 px-1 py-0.5 rounded text-zinc-500 uppercase ml-1">Tast Server</span></p>
          <p><span className="text-zinc-600 font-bold">A:</span> <span className="text-zinc-200 font-bold">{registration.c1Email}</span>, <span className="text-zinc-200 font-bold">{registration.c2Email}</span></p>
          <p><span className="text-zinc-600 font-bold">ASSUMPTE / ASUNTO:</span> <span className="text-zinc-300 font-sans">{language === 'ca' ? `🎟️ El Tast Comparses 2026 - Registre d'Inscripció ${registration.codiSeguiment}` : `🎟️ El Tast Comparses 2026 - Registro de Inscripción ${registration.codiSeguiment}`}</span></p>
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
                <div className="text-center pb-3 border-b border-zinc-100 flex items-center justify-center gap-1.5 flex-col">
                  <div className="w-10 h-10 rounded-xl bg-fuchsia-600 text-white flex items-center justify-center font-black tracking-wider text-sm shadow-md">
                    T
                  </div>
                  <h3 className="font-black text-xs tracking-tight text-zinc-900 mt-1">
                    EL TAST <span className="text-fuchsia-600">VILANOVA</span>
                  </h3>
                  <span className="text-[8px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
                    {language === 'ca' ? "SESSió INFORMATIVA 2026" : "SESIÓN INFORMATIVA 2026"}
                  </span>
                </div>

                {/* Email text body */}
                <div className="space-y-3 leading-relaxed text-zinc-650">
                  <p className="font-black text-zinc-900 text-center text-xs">
                    {language === 'ca' ? `Hola, ${registration.c1Nom} i ${registration.c2Nom}!` : `¡Hola, ${registration.c1Nom} y ${registration.c2Nom}!`}
                  </p>
                  <p className="text-center text-[11px] leading-relaxed">
                    {language === 'ca' 
                      ? "La vostra preinscripció ha estat rebuda amb èxit. A continuació us facilitem el vostre codi de seguiment oficial i comprobat QR." 
                      : "Vuestra preinscripción ha sido recibida con éxito. A continuación os facilitamos vuestro código de seguimiento oficial y comprobante QR."}
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
                  <p>Carrer de l'Aigua, 12, Vilanova i la Geltrú</p>
                  <p className="font-bold text-fuchsia-650">secretaria@eltast.cat</p>
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
