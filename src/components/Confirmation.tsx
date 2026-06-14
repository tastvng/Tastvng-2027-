/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Download, Mail, Calendar, MapPin, Printer, ArrowLeft, RefreshCw, Sparkle } from 'lucide-react';
import { Inscripcio, CategoriaParella } from '../types';

interface ConfirmationProps {
  registration: Inscripcio;
  onClear: () => void;
}

export default function Confirmation({ registration, onClear }: ConfirmationProps) {
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
          Preinscripció Completada!
        </h1>
        <p className="text-zinc-500 text-sm max-w-sm mx-auto font-sans leading-relaxed">
          Ben fet! Hem registrat la vostra parella per a les comparses 2026 de l'entitat <strong className="text-fuchsia-600">El Tast</strong>.
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
          <span className="font-mono text-[9px] text-fuchsia-400 font-bold tracking-widest uppercase block">COMPROVANT OFICIAL DE REGISTRE</span>
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
            <div className="p-3 bg-zinc-50 rounded-2xl border-2 border-fuchsia-500/20 shadow-md relative group">
              <img 
                src={qrUrl} 
                alt="Codi QR de Registre" 
                className="w-48 h-48 block"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none" />
            </div>
            <p className="text-[10px] text-zinc-400 font-mono text-center mt-3 uppercase tracking-wider">
              Presenteu aquest QR als revisors per fer el pagament
            </p>
          </div>

          {/* Couples detail blocks */}
          <div className="border-t border-b border-zinc-100 py-4 space-y-3.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">Parella:</span>
              <span className="font-semibold text-zinc-900 text-right">
                {registration.c1Nom} &amp; {registration.c2Nom}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wide">Categoria:</span>
              <span className="bg-fuchsia-50 text-fuchsia-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px] font-mono">
                {registration.categoria === CategoriaParella.ADULT ? 'PARELLA ADULTA' : 'PARELLA JUVENIL'}
              </span>
            </div>

            {registration.teDomasBalco || registration.teMocadorsExtra > 0 ? (
              <div className="flex justify-between items-start text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-wide">Complements:</span>
                <span className="font-semibold text-zinc-800 text-right space-y-0.5 block">
                  {registration.teDomasBalco && <span className="block">+1 Domàs de Balcó</span>}
                  {registration.teMocadorsExtra > 0 && <span className="block">+{registration.teMocadorsExtra} Mocador oficial</span>}
                </span>
              </div>
            ) : null}

            <div className="flex justify-between items-center text-xs border-t border-dashed border-zinc-200 pt-3">
              <span className="text-zinc-900 font-extrabold text-sm uppercase">Total a pagar:</span>
              <span className="font-sans font-black text-xl text-fuchsia-600">
                {registration.preuCalculat}€
              </span>
            </div>
          </div>

          {/* Logistics steps cards */}
          <div className="space-y-3">
            <h4 className="font-sans font-bold text-zinc-800 text-xs uppercase tracking-wider mb-2">PROXIMS PASOS DE RECOLLIDA:</h4>
            
            <div className="flex gap-3 text-xs">
              <Mail className="shrink-0 text-fuchsia-500 mt-0.5" size={16} />
              <div>
                <p className="font-bold text-zinc-800">Codi QR enviat al correu</p>
                <p className="text-zinc-500 leading-relaxed">Hem enviat una còpia d'aquest comprobat a <span className="font-mono">{registration.c1Email}</span> i <span className="font-mono">{registration.c2Email}</span>.</p>
              </div>
            </div>

            <div className="flex gap-3 text-xs">
              <MapPin className="shrink-0 text-fuchsia-500 mt-0.5" size={16} />
              <div>
                <p className="font-bold text-zinc-800">Seu d'El Tast Vilanova</p>
                <p className="text-zinc-500 leading-relaxed">Presenteu-vos a la secretaria de l'associació cultural presentant aquest codi.</p>
              </div>
            </div>

            <div className="flex gap-3 text-xs">
              <Calendar className="shrink-0 text-fuchsia-500 mt-0.5" size={16} />
              <div>
                <p className="font-bold text-zinc-800">Dies de lliurament i caixa</p>
                <p className="text-zinc-500 leading-relaxed">Dimecres i divendres previs als dards de comparses, de 18:00h a 21:30h.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative ticket notch borders */}
        <div className="absolute top-[82px] -left-3 w-6 h-6 bg-slate-50 border-r border-zinc-200/80 rounded-full z-10 print:hidden" />
        <div className="absolute top-[82px] -right-3 w-6 h-6 bg-slate-50 border-l border-zinc-200/80 rounded-full z-10 print:hidden" />
      </motion.div>

      {/* Buttons actions row */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        <button 
          onClick={handlePrint}
          className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3.5 px-4 rounded-2xl transition hover:scale-[1.01] flex items-center justify-center gap-2 text-sm shadow-md"
          id="btn-print-voucher"
        >
          <Printer size={16} /> Imprimir / PDF
        </button>
        <button 
          onClick={onClear}
          className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3.5 px-4 rounded-2xl transition hover:scale-[1.01] flex items-center justify-center gap-2 text-sm shadow-md"
          id="btn-new-registration"
        >
          Nova preinscripció <RefreshCw size={14} />
        </button>
      </div>

      <div className="text-center mt-6 print:hidden">
        <button 
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-zinc-800 font-semibold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Tornar a la pàgina d'inici
        </button>
      </div>
    </div>
  );
}
