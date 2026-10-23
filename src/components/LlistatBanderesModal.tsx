import React, { useState, useMemo } from 'react';
import { X, Download, Printer, Flag, Users, CheckCircle2, Clock } from 'lucide-react';
import { Inscripcio, SistemaConfig } from '../types';
import { useLanguage } from '../LanguageContext';
import { calculateInscriptionOrderBreakdown } from '../utils/orderCalculations';
import { getPaymentSummary } from '../utils/paymentCalculations';

interface LlistatBanderesModalProps {
  isOpen: boolean;
  onClose: () => void;
  inscripcions: Inscripcio[];
  config?: SistemaConfig;
}

type FilterTab = 'totes' | 'boss' | 'nonina' | 'juvenil' | 'sense_assignar';

interface BanderaBlockDef {
  key: FilterTab;
  banderaId: number;
  titleCA: string;
  titleES: string;
  badgeCA: string;
  badgeES: string;
  colorClass: string;
  borderClass: string;
  headerBgClass: string;
  items: Inscripcio[];
}

/**
 * Normalizes bandera ID to 1, 2, 3 or 0 (unassigned).
 */
function getBanderaId(ins: Inscripcio): number {
  const b = Number(ins.bandera);
  if (b === 1 || b === 2 || b === 3) return b;
  return 0;
}

/**
 * Natural alphanumeric comparator for registration codes (e.g. A0001, A0087, J0010).
 */
function sortByCodi(a: Inscripcio, b: Inscripcio): number {
  const codiA = (a.codiSeguiment || '').trim();
  const codiB = (b.codiSeguiment || '').trim();
  if (!codiA && !codiB) return 0;
  if (!codiA) return 1;
  if (!codiB) return -1;
  return codiA.localeCompare(codiB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Calculates number of breakfasts (0, 1, or 2) using calculateInscriptionOrderBreakdown.
 */
function getEsmorzarsCount(ins: Inscripcio, config?: SistemaConfig): number {
  try {
    const breakdown = calculateInscriptionOrderBreakdown(ins, config);
    const count = (breakdown.materials || [])
      .filter(m => 
        m.id.startsWith('esm-') || 
        m.modalitat === 'Esmorzar' || 
        /esmorz|almuerz|desayun/i.test(m.id) || 
        /esmorz|almuerz|desayun/i.test(m.nom)
      )
      .reduce((sum, m) => sum + (m.quantitat || 0), 0);
    return count;
  } catch (err) {
    console.error('Error calculating esmorzars count for', ins.codiSeguiment, err);
    return 0;
  }
}

/**
 * Returns localized payment badge for an inscription.
 */
function getPaymentStatusInfo(ins: Inscripcio, language: 'ca' | 'es'): { label: string; badgeClass: string } {
  const summary = getPaymentSummary(ins);
  if (summary.estat === 'PAGAT' || summary.estat === 'SOBREPAGAT') {
    return {
      label: language === 'ca' ? 'Pagat' : 'Pagado',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300'
    };
  }
  if (summary.estat === 'PARCIAL') {
    return {
      label: language === 'ca' ? 'Parcial' : 'Parcial',
      badgeClass: 'bg-blue-100 text-blue-800 border border-blue-300'
    };
  }
  return {
    label: language === 'ca' ? 'Pendent' : 'Pendiente',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300'
  };
}

/**
 * Returns formatted category label.
 */
function getCategoryDisplay(categoria: string | undefined, language: 'ca' | 'es'): string {
  const cat = String(categoria || '').toUpperCase();
  if (cat.includes('JUVENIL')) {
    return language === 'ca' ? 'Juvenil' : 'Juvenil';
  }
  return language === 'ca' ? 'Adulta' : 'Adulta';
}

export const LlistatBanderesModal: React.FC<LlistatBanderesModalProps> = ({
  isOpen,
  onClose,
  inscripcions,
  config
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<FilterTab>('totes');

  // Group and sort inscriptions by flag
  const { bossList, noninaList, juvenilList, unassignedList } = useMemo(() => {
    const boss: Inscripcio[] = [];
    const nonina: Inscripcio[] = [];
    const juvenil: Inscripcio[] = [];
    const unassigned: Inscripcio[] = [];

    for (const item of inscripcions) {
      const bId = getBanderaId(item);
      if (bId === 1) boss.push(item);
      else if (bId === 2) nonina.push(item);
      else if (bId === 3) juvenil.push(item);
      else unassigned.push(item);
    }

    boss.sort(sortByCodi);
    nonina.sort(sortByCodi);
    juvenil.sort(sortByCodi);
    unassigned.sort(sortByCodi);

    return {
      bossList: boss,
      noninaList: nonina,
      juvenilList: juvenil,
      unassignedList: unassigned
    };
  }, [inscripcions]);

  const totalBoss = bossList.length;
  const totalNonina = noninaList.length;
  const totalJuvenil = juvenilList.length;
  const totalUnassigned = unassignedList.length;
  const grandTotal = inscripcions.length;

  // Build the block definitions in the exact required order:
  // 1: BOSS, 2: No ni na, 3: Juvenil, and "No assignat" (only if > 0)
  const blocks: BanderaBlockDef[] = useMemo(() => {
    const list: BanderaBlockDef[] = [
      {
        key: 'boss',
        banderaId: 1,
        titleCA: 'Bandera 1: BOSS',
        titleES: 'Bandera 1: BOSS',
        badgeCA: 'Bandera 1',
        badgeES: 'Bandera 1',
        colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        borderClass: 'border-purple-200',
        headerBgClass: 'bg-purple-900/20 text-purple-950',
        items: bossList
      },
      {
        key: 'nonina',
        banderaId: 2,
        titleCA: 'Bandera 2: No ni na',
        titleES: 'Bandera 2: No ni na',
        badgeCA: 'Bandera 2',
        badgeES: 'Bandera 2',
        colorClass: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30',
        borderClass: 'border-fuchsia-200',
        headerBgClass: 'bg-fuchsia-900/20 text-fuchsia-950',
        items: noninaList
      },
      {
        key: 'juvenil',
        banderaId: 3,
        titleCA: 'Bandera 3: Juvenil',
        titleES: 'Bandera 3: Juvenil',
        badgeCA: 'Bandera 3',
        badgeES: 'Bandera 3',
        colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
        borderClass: 'border-pink-200',
        headerBgClass: 'bg-pink-900/20 text-pink-950',
        items: juvenilList
      }
    ];

    if (totalUnassigned > 0) {
      list.push({
        key: 'sense_assignar',
        banderaId: 0,
        titleCA: 'No assignat',
        titleES: 'Sin asignar',
        badgeCA: 'Sense assignar',
        badgeES: 'Sin asignar',
        colorClass: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
        borderClass: 'border-zinc-300',
        headerBgClass: 'bg-zinc-100 text-zinc-800',
        items: unassignedList
      });
    }

    return list;
  }, [bossList, noninaList, juvenilList, unassignedList, totalUnassigned]);

  // Blocks filtered by activeTab
  const visibleBlocks = useMemo(() => {
    if (activeTab === 'totes') return blocks;
    return blocks.filter(b => b.key === activeTab);
  }, [blocks, activeTab]);

  // Print handler: window.print()
  const handlePrint = () => {
    window.print();
  };

  // CSV Export handler (delimited with ;, UTF-8 with BOM)
  const handleExportCSV = () => {
    const lines: string[] = [];
    const escapeCsv = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const headers = [
      language === 'ca' ? 'Bandera' : 'Bandera',
      'Nº',
      language === 'ca' ? 'Codi' : 'Código',
      language === 'ca' ? 'Primer comparser' : 'Primer comparsero/a',
      language === 'ca' ? 'Segon comparser' : 'Segundo comparsero/a',
      language === 'ca' ? 'Categoria' : 'Categoría',
      language === 'ca' ? 'Esmorzars' : 'Almuerzos',
      language === 'ca' ? 'Estat pagament' : 'Estado pago'
    ];
    lines.push(headers.map(escapeCsv).join(';'));

    visibleBlocks.forEach(block => {
      const blockTitle = language === 'ca' ? block.titleCA : block.titleES;
      block.items.forEach((item, index) => {
        const c1 = `${item.c1Nom || ''} ${item.c1Cognoms || ''}`.trim();
        const c2 = `${item.c2Nom || ''} ${item.c2Cognoms || ''}`.trim();
        const cat = getCategoryDisplay(item.categoria, language);
        const esmorzars = getEsmorzarsCount(item, config);
        const payStatus = getPaymentStatusInfo(item, language).label;

        const row = [
          blockTitle,
          index + 1,
          item.codiSeguiment || '',
          c1,
          c2,
          cat,
          esmorzars,
          payStatus
        ];
        lines.push(row.map(escapeCsv).join(';'));
      });
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `llistat_banderes_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const printDateStr = new Date().toLocaleDateString(language === 'ca' ? 'ca-ES' : 'es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' ' + new Date().toLocaleTimeString(language === 'ca' ? 'ca-ES' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <>
      {/* Print-specific style sheet injected for clean A4 printing */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide app elements outside the modal */
          #admin-dashboard-container,
          #app-root-container > *:not(#llistat-banderes-modal-overlay),
          .no-print,
          .print\\:hidden {
            display: none !important;
          }
          #llistat-banderes-modal-overlay {
            position: static !important;
            inset: auto !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            box-shadow: none !important;
          }
          #llistat-banderes-modal-dialog {
            max-width: 100% !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            max-height: none !important;
          }
          #llistat-banderes-modal-header,
          #llistat-banderes-tabs-container,
          .modal-actions-bar {
            display: none !important;
          }
          #printable-banderes-content {
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-header-banner {
            display: block !important;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #000000;
          }
          .bandera-print-page {
            page-break-inside: auto;
          }
          .bandera-print-page:not(:first-child) {
            page-break-before: always;
            break-before: page;
          }
          .bandera-print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
          }
          .bandera-print-table th, 
          .bandera-print-table td {
            border: 1px solid #71717a !important;
            padding: 4px 6px !important;
            color: #000000 !important;
            background: #ffffff !important;
          }
          .bandera-print-table th {
            background-color: #f4f4f5 !important;
            font-weight: 700 !important;
          }
          .bandera-print-table tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" 
        id="llistat-banderes-modal-overlay"
      >
        <div 
          className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden" 
          id="llistat-banderes-modal-dialog"
        >
          {/* Header */}
          <div 
            className="p-5 sm:p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-900 text-white print:hidden"
            id="llistat-banderes-modal-header"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
                <Flag size={22} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wide flex items-center gap-2">
                  <span>{language === 'ca' ? "Llistat de Parelles per Banderes" : "Listado de Parejas por Banderas"}</span>
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  {language === 'ca' ? "Classificació per ordre i comparsa oficial" : "Clasificación por orden y comparsa oficial"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                id="btn-print-banderes"
                title={language === 'ca' ? "Imprimir llistat (A4)" : "Imprimir listado (A4)"}
              >
                <Printer size={14} />
                <span className="hidden sm:inline">{language === 'ca' ? "Imprimir" : "Imprimir"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                id="btn-export-csv-banderes"
                title={language === 'ca' ? "Exportar a fitxer CSV per a Excel" : "Exportar a archivo CSV para Excel"}
              >
                <Download size={14} />
                <span className="hidden sm:inline">{language === 'ca' ? "Exportar CSV" : "Exportar CSV"}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white rounded-xl transition hover:bg-zinc-800 cursor-pointer ml-1"
                id="btn-close-modal-banderes"
                aria-label={language === 'ca' ? "Tancar" : "Cerrar"}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Top Summary Bar as required: "BOSS: X · No ni na: Y · Juvenil: Z · Sense assignar: W · Total: N" */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white print:hidden">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-400 flex items-center gap-1.5">
                  <Users size={14} className="text-purple-400" />
                  {language === 'ca' ? "Resum General de Banderes" : "Resumen General de Banderas"}
                </span>
                <span className="text-xs font-mono font-bold text-purple-300">
                  {language === 'ca' ? `Total parelles: ${grandTotal}` : `Total parejas: ${grandTotal}`}
                </span>
              </div>

              {/* Explicit single line summary requested by user */}
              <p className="text-xs sm:text-sm font-semibold font-mono text-zinc-200 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
                {language === 'ca'
                  ? `BOSS: ${totalBoss} · No ni na: ${totalNonina} · Juvenil: ${totalJuvenil} · Sense assignar: ${totalUnassigned} · Total: ${grandTotal}`
                  : `BOSS: ${totalBoss} · No ni na: ${totalNonina} · Juvenil: ${totalJuvenil} · Sin asignar: ${totalUnassigned} · Total: ${grandTotal}`
                }
              </p>

              {/* Visual badges row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                <div className="bg-purple-950/40 border border-purple-800/40 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-purple-300 font-bold uppercase block">Bandera 1</span>
                    <span className="text-xs font-black text-white">BOSS</span>
                  </div>
                  <span className="text-xl font-mono font-black text-purple-300">{totalBoss}</span>
                </div>

                <div className="bg-fuchsia-950/40 border border-fuchsia-800/40 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-fuchsia-300 font-bold uppercase block">Bandera 2</span>
                    <span className="text-xs font-black text-white">No ni na</span>
                  </div>
                  <span className="text-xl font-mono font-black text-fuchsia-300">{totalNonina}</span>
                </div>

                <div className="bg-pink-950/40 border border-pink-800/40 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-pink-300 font-bold uppercase block">Bandera 3</span>
                    <span className="text-xs font-black text-white">Juvenil</span>
                  </div>
                  <span className="text-xl font-mono font-black text-pink-300">{totalJuvenil}</span>
                </div>

                <div className="bg-zinc-800/60 border border-zinc-700/60 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                      {language === 'ca' ? "Sense assignar" : "Sin asignar"}
                    </span>
                    <span className="text-xs font-black text-zinc-300">N/A</span>
                  </div>
                  <span className="text-xl font-mono font-black text-zinc-300">{totalUnassigned}</span>
                </div>
              </div>
            </div>

            {/* Quick Filter Tabs inside modal */}
            <div 
              className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl overflow-x-auto print:hidden"
              id="llistat-banderes-tabs-container"
            >
              <button
                type="button"
                onClick={() => setActiveTab('totes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'totes'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
              >
                {language === 'ca' ? "Totes" : "Todas"} ({grandTotal})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('boss')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'boss'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
              >
                BOSS ({totalBoss})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('nonina')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'nonina'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
              >
                No ni na ({totalNonina})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('juvenil')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'juvenil'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
              >
                Juvenil ({totalJuvenil})
              </button>

              {totalUnassigned > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('sense_assignar')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    activeTab === 'sense_assignar'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                  }`}
                >
                  {language === 'ca' ? "Sense assignar" : "Sin asignar"} ({totalUnassigned})
                </button>
              )}
            </div>

            {/* Printable and Screen Content */}
            <div id="printable-banderes-content" className="space-y-8">
              {/* Print-only Top Header */}
              <div className="hidden print-header-banner">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-xl font-black uppercase text-black">
                      {language === 'ca' ? "Llistat de Parelles per Banderes" : "Listado de Parejas por Banderas"}
                    </h1>
                    <p className="text-xs text-zinc-600">
                      Associació Cultural El Tast · Carnaval
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-zinc-800">
                      {language === 'ca' ? "Data impressió:" : "Fecha impresión:"} <strong>{printDateStr}</strong>
                    </p>
                    <p className="text-[10px] font-mono text-zinc-600">
                      {language === 'ca'
                        ? `BOSS: ${totalBoss} · No ni na: ${totalNonina} · Juvenil: ${totalJuvenil} · Sense assignar: ${totalUnassigned} · Total: ${grandTotal}`
                        : `BOSS: ${totalBoss} · No ni na: ${totalNonina} · Juvenil: ${totalJuvenil} · Sin asignar: ${totalUnassigned} · Total: ${grandTotal}`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Render Blocks */}
              {visibleBlocks.map((block) => {
                const blockTitle = language === 'ca' ? block.titleCA : block.titleES;
                const totalInBlock = block.items.length;

                return (
                  <div 
                    key={block.key} 
                    className="bandera-print-page bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
                  >
                    {/* Block Title Header */}
                    <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${block.colorClass}`}>
                          {language === 'ca' ? block.badgeCA : block.badgeES}
                        </span>
                        <h3 className="text-base font-black text-zinc-900 tracking-tight">
                          {blockTitle}
                        </h3>
                      </div>
                      <span className="text-xs font-bold font-mono px-3 py-1 bg-white border border-zinc-200 rounded-full text-zinc-700 shadow-xs">
                        {language === 'ca' 
                          ? `${totalInBlock} ${totalInBlock === 1 ? 'parella' : 'parelles'}`
                          : `${totalInBlock} ${totalInBlock === 1 ? 'pareja' : 'parejas'}`
                        }
                      </span>
                    </div>

                    {/* Table */}
                    {totalInBlock === 0 ? (
                      <div className="p-8 text-center text-zinc-400 text-xs font-mono">
                        {language === 'ca' 
                          ? "No hi ha cap parella assignada a aquesta bandera."
                          : "No hay ninguna pareja asignada a esta bandera."
                        }
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="bandera-print-table w-full text-left text-xs">
                          <thead>
                            <tr className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[11px]">
                              <th className="py-2.5 px-3 w-12 text-center">Nº</th>
                              <th className="py-2.5 px-3 w-24">{language === 'ca' ? "Codi" : "Código"}</th>
                              <th className="py-2.5 px-3">{language === 'ca' ? "Primer comparser" : "Primer comparsero/a"}</th>
                              <th className="py-2.5 px-3">{language === 'ca' ? "Segon comparser" : "Segundo comparsero/a"}</th>
                              <th className="py-2.5 px-3 w-24 text-center">{language === 'ca' ? "Categoria" : "Categoría"}</th>
                              <th className="py-2.5 px-3 w-24 text-center">{language === 'ca' ? "Esmorzars" : "Almuerzos"}</th>
                              <th className="py-2.5 px-3 w-28 text-center">{language === 'ca' ? "Estat pagament" : "Estado pago"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 font-sans">
                            {block.items.map((item, idx) => {
                              const c1 = `${item.c1Nom || ''} ${item.c1Cognoms || ''}`.trim() || '—';
                              const c2 = `${item.c2Nom || ''} ${item.c2Cognoms || ''}`.trim() || '—';
                              const cat = getCategoryDisplay(item.categoria, language);
                              const esmorzars = getEsmorzarsCount(item, config);
                              const payStatus = getPaymentStatusInfo(item, language);

                              return (
                                <tr 
                                  key={item.id || item.codiSeguiment || idx} 
                                  className="hover:bg-zinc-50/80 transition-colors"
                                >
                                  {/* Nº (Order within this block) */}
                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-500">
                                    {idx + 1}
                                  </td>

                                  {/* Codi */}
                                  <td className="py-2.5 px-3 font-mono font-black text-zinc-900 whitespace-nowrap">
                                    {item.codiSeguiment || '—'}
                                  </td>

                                  {/* Primer comparser */}
                                  <td className="py-2.5 px-3 text-zinc-800 font-medium whitespace-nowrap">
                                    {c1}
                                  </td>

                                  {/* Segon comparser */}
                                  <td className="py-2.5 px-3 text-zinc-800 font-medium whitespace-nowrap">
                                    {c2}
                                  </td>

                                  {/* Categoria */}
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      cat === 'Juvenil'
                                        ? 'bg-pink-100 text-pink-800 border border-pink-200'
                                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                                    }`}>
                                      {cat}
                                    </span>
                                  </td>

                                  {/* Esmorzars (0, 1, or 2) */}
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                      esmorzars > 0 
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                        : 'text-zinc-400'
                                    }`}>
                                      {esmorzars}
                                    </span>
                                  </td>

                                  {/* Estat de pagament */}
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${payStatus.badgeClass}`}>
                                      {payStatus.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500 print:hidden">
            <span className="font-mono">
              {language === 'ca' ? `Total carregat: ${grandTotal} inscripcions` : `Total cargado: ${grandTotal} inscripciones`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {language === 'ca' ? "Tancar" : "Cerrar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
