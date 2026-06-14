/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Users, 
  Coins, 
  QrCode, 
  Package, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronRight, 
  Smartphone,
  Eye,
  LogOut,
  Sliders,
  Compass,
  CreditCard,
  FileText
} from 'lucide-react';
import { Inscripcio, CategoriaParella, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament } from '../types';

interface AdminDashboardProps {
  inscripcions: Inscripcio[];
  onSelectInscripcio: (id: string) => void;
  onGoToScanner: () => void;
  onGoToConfig: () => void;
  onLogout: () => void;
  onAddLog?: (txt: string) => void;
}

export default function AdminDashboard({ 
  inscripcions, 
  onSelectInscripcio, 
  onGoToScanner, 
  onGoToConfig, 
  onLogout,
  onAddLog
}: AdminDashboardProps) {
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('ALL');
  const [filterPagament, setFilterPagament] = useState<string>('ALL');
  const [filterDni, setFilterDni] = useState<string>('ALL');
  const [filterEntrega, setFilterEntrega] = useState<string>('ALL');

  // Stats calculation
  const totalInscrites = inscripcions.length;
  const adultCount = inscripcions.filter(i => i.categoria === CategoriaParella.ADULT).length;
  const juvenilCount = inscripcions.filter(i => i.categoria === CategoriaParella.JUVENIL).length;
  
  const totalPagadesInscripcions = inscripcions.filter(i => i.estatPagament === EstatPagament.PAGAT);
  const totalRecaudat = totalPagadesInscripcions.reduce((acc, i) => acc + i.preuCalculat, 0);
  
  const pagamentsEfectiu = totalPagadesInscripcions.filter(i => i.metodePagament === MetodePagament.EFECTIU);
  const totalEfectiuVal = pagamentsEfectiu.reduce((acc, i) => acc + i.preuCalculat, 0);
  
  const pagamentsBizum = totalPagadesInscripcions.filter(i => i.metodePagament === MetodePagament.BIZUM);
  const totalBizumVal = pagamentsBizum.reduce((acc, i) => acc + i.preuCalculat, 0);

  const materialsEntregats = inscripcions.filter(i => i.entregaMaterial === EstatInscripcio.ENTREGAT).length;
  const percentatgeEntrega = totalInscrites > 0 ? Math.round((materialsEntregats / totalInscrites) * 100) : 0;

  const dnisValidads = inscripcions.filter(i => i.estatDni === EstatVerificacio.VALIDAT).length;

  // Filtered registrations list
  const filteredInscripcions = inscripcions.filter((item) => {
    // Text search
    const textFields = [
      item.codiSeguiment,
      item.c1Nom,
      item.c1Cognoms,
      item.c1Email,
      item.c1Telefon,
      item.c2Nom,
      item.c2Cognoms,
      item.c2Email,
      item.c2Telefon
    ].map(f => f.toLowerCase());
    
    const matchesSearch = searchQuery.trim() === '' || textFields.some(f => f.includes(searchQuery.toLowerCase()));

    // Categoria filter
    const matchesCategoria = filterCategoria === 'ALL' || item.categoria === filterCategoria;

    // Pagament filter
    const matchesPagament = filterPagament === 'ALL' || item.estatPagament === filterPagament;

    // DNI filter
    const matchesDni = filterDni === 'ALL' || item.estatDni === filterDni;

    // Entrega filter
    const matchesEntrega = filterEntrega === 'ALL' || item.entregaMaterial === filterEntrega;

    return matchesSearch && matchesCategoria && matchesPagament && matchesDni && matchesEntrega;
  });

  // Client-side CSV download simulator representing Excel sheet export
  const exportToExcel = () => {
    if (filteredInscripcions.length === 0) {
      alert("No hi ha dades seleccionades per exportar.");
      return;
    }

    const headers = [
      'CODI SEGUIMENT',
      'CATEGORIA',
      'NOM COMPARSER 1',
      'COGNOMS COMPARSER 1',
      'EMAIL COMPARSER 1',
      'TELEFON COMPARSER 1',
      'TALLA COMPARSER 1',
      'NOM COMPARSER 2',
      'COGNOMS COMPARSER 2',
      'EMAIL COMPARSER 2',
      'TELEFON COMPARSER 2',
      'TALLA COMPARSER 2',
      'PREU TOTAL (€)',
      'DOMAS BALCO?',
      'MOCADORS EXTRA',
      'ESTAT PAGAMENT',
      'METODE PAGAMENT',
      'VALIDACIO DNI',
      'ENTREGA MATERIAL',
      'DATA CREACIO'
    ];

    const rows = filteredInscripcions.map(i => [
      i.codiSeguiment,
      i.categoria,
      i.c1Nom,
      i.c1Cognoms,
      i.c1Email,
      i.c1Telefon,
      i.c1Talla,
      i.c2Nom,
      i.c2Cognoms,
      i.c2Email,
      i.c2Telefon,
      i.c2Talla,
      i.preuCalculat,
      i.teDomasBalco ? 'SÍ' : 'NO',
      i.teMocadorsExtra,
      i.estatPagament,
      i.metodePagament || 'CAP',
      i.estatDni,
      i.entregaMaterial,
      i.creadoEn
    ]);

    // Build properly formatted CSV
    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(r => r.map(cell => {
        const text = String(cell).replace(/"/g, '""');
        return text.includes(';') || text.includes('\n') || text.includes('"') ? `"${text}"` : text;
      }).join(';'))
    ].join('\n');

    // Create a real file blob download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `llista_espera_tast_comparses_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddLog) {
      onAddLog("Exportació a full d'Excel de dades completada.");
    }
  };

  return (
    <div className="space-y-8" id="admin-dashboard-container">
      {/* Top Navbar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-lg text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-fuchsia-600 flex items-center justify-center font-bold text-white tracking-widest text-lg font-mono border-2 border-white/15 animate-pulse">
            T
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-sans font-black text-lg tracking-tight">Panell Secretaria El Tast</h2>
              <span className="text-[9px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">ONLINE</span>
            </div>
            <p className="text-zinc-500 text-xs">Gestió i validació d'inscripcions Comparses 2026</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button 
            onClick={onGoToScanner}
            className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow"
            id="btn-nav-scanner"
          >
            <QrCode size={14} /> Escàner Mòbil
          </button>
          
          <button 
            onClick={onGoToConfig}
            className="text-xs bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
            id="btn-nav-config"
          >
            <Sliders size={14} className="text-fuchsia-500" /> Preus i Camps
          </button>

          <button 
            onClick={onLogout}
            className="text-xs bg-red-950/20 text-red-400 hover:bg-red-950/40 border border-red-900/30 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1"
            title="Tancar Sessió"
            id="btn-nav-logout"
          >
            <LogOut size={14} /> Sortir
          </button>
        </div>
      </div>

      {/* KPI metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recaudat card */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl">
            <Coins size={28} />
          </div>
          <div>
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">TOTAL RECAUDAT</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">{totalRecaudat.toFixed(2)}€</h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              Efectiu: <span className="font-bold">{totalEfectiuVal}€</span> • Bizum: <span className="font-bold">{totalBizumVal}€</span>
            </p>
          </div>
          <div className="absolute top-0 right-0 h-full w-2 bg-fuchsia-500" />
        </div>

        {/* Dynamic Registered Couples */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-zinc-100 text-zinc-800 rounded-2xl">
            <Users size={28} />
          </div>
          <div>
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">PARELLES INSCRITES</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">{totalInscrites} parelles</h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              Adults: <span className="font-bold">{adultCount}</span> • Juvenils: <span className="font-bold">{juvenilCount}</span>
            </p>
          </div>
          <div className="absolute top-0 right-0 h-full w-2 bg-zinc-800" />
        </div>

        {/* Materials Delivered percentage */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-zinc-100 text-zinc-800 rounded-2xl">
            <Package size={28} />
          </div>
          <div className="flex-1">
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">MATERIALS LLIURATS</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">{percentatgeEntrega}%</h3>
            
            <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-fuchsia-500 h-full" style={{ width: `${percentatgeEntrega}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Lliurats: <span className="font-bold">{materialsEntregats}</span> de <span className="font-bold">{totalInscrites}</span>
            </p>
          </div>
          <div className="absolute top-0 right-0 h-full w-2 bg-fuchsia-500" />
        </div>

        {/* DNI checks metric */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-zinc-100 text-zinc-800 rounded-2xl">
            <FileText size={28} />
          </div>
          <div>
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">DNIS REVISATS</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">{dnisValidads} validads</h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              Pendents: <span className="font-bold text-amber-600">{inscripcions.filter(i => i.estatDni === EstatVerificacio.PENDENT).length}</span> por revisar
            </p>
          </div>
          <div className="absolute top-0 right-0 h-full w-2 bg-zinc-800" />
        </div>
      </div>

      {/* Main filter toolbar and listing panel */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden">
        
        {/* Filter bar controller */}
        <div className="p-6 border-b border-zinc-100 bg-zinc-50 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 pointer-events-none">
                <Search size={18} />
              </span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per nom, cognom, telèfon, email o codi..."
                className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all placeholder-zinc-400 font-sans"
                id="input-search-query"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={exportToExcel}
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5"
                id="btn-export-excel"
              >
                <FileSpreadsheet size={15} /> Exportar Excel
              </button>
            </div>
          </div>

          {/* Core matrix dropdown filters */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-zinc-500 font-bold uppercase tracking-wider mr-2">
              <Filter size={12} /> Filtres:
            </div>

            {/* Category dropdown filter */}
            <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
              <span className="text-zinc-500 mr-2 font-mono">Categoria</span>
              <select 
                value={filterCategoria} 
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                id="filter-category"
              >
                <option value="ALL">Tots</option>
                <option value={CategoriaParella.ADULT}>Adults</option>
                <option value={CategoriaParella.JUVENIL}>Juvenils</option>
              </select>
            </div>

            {/* Payment dropdown filter */}
            <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
              <span className="text-zinc-500 mr-2 font-mono">Pagat</span>
              <select 
                value={filterPagament} 
                onChange={(e) => setFilterPagament(e.target.value)}
                className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                id="filter-payment"
              >
                <option value="ALL">Tots</option>
                <option value={EstatPagament.PAGAT}>Sí</option>
                <option value={EstatPagament.PENDENT}>Pendent</option>
              </select>
            </div>

            {/* DNI dropdown filter */}
            <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
              <span className="text-zinc-500 mr-2 font-mono">DNI</span>
              <select 
                value={filterDni} 
                onChange={(e) => setFilterDni(e.target.value)}
                className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                id="filter-dni"
              >
                <option value="ALL">Tots</option>
                <option value={EstatVerificacio.VALIDAT}>Validat</option>
                <option value={EstatVerificacio.PENDENT}>Pendent</option>
                <option value={EstatVerificacio.REBUTJAT}>Rebutjat</option>
              </select>
            </div>

            {/* Material Delivery dropdown filter */}
            <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
              <span className="text-zinc-500 mr-2 font-mono">Material</span>
              <select 
                value={filterEntrega} 
                onChange={(e) => setFilterEntrega(e.target.value)}
                className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                id="filter-delivery"
              >
                <option value="ALL">Tots</option>
                <option value={EstatInscripcio.ENTREGAT}>Entregat</option>
                <option value={EstatInscripcio.PENDENT}>Pendent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Primary Data Listing Grid */}
        <div className="overflow-x-auto">
          {filteredInscripcions.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <Users className="mx-auto text-zinc-300 mb-3" size={48} />
              <p className="font-sans font-bold text-lg text-zinc-700">No s'ha trobat cap parella registrada</p>
              <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">Comproveu els criteris de cerca o els filtres seleccionats actualment.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-zinc-100 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200">
                  <th className="px-6 py-4">CODI / DATA</th>
                  <th className="px-6 py-4">PRIMER COMPARSER</th>
                  <th className="px-6 py-4">SEGON COMPARSER</th>
                  <th className="px-6 py-4 text-center">CATEGORIA</th>
                  <th className="px-6 py-4 text-center">PAGAMENT</th>
                  <th className="px-6 py-4 text-center">DNI STATUS</th>
                  <th className="px-6 py-4 text-center">LLIURAMENT</th>
                  <th className="px-6 py-4 text-center">ACCIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs text-zinc-700 font-sans">
                {filteredInscripcions.map((item) => (
                  <tr 
                    key={item.id}
                    onClick={() => onSelectInscripcio(item.id)}
                    className="hover:bg-fuchsia-50/20 cursor-pointer transition-colors group align-middle"
                    id={`row-registration-${item.id}`}
                  >
                    {/* tracking code and creation date */}
                    <td className="px-6 py-4.5">
                      <span className="font-mono font-bold text-zinc-900 block">{item.codiSeguiment}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{new Date(item.creadoEn).toLocaleDateString('ca-ES')}</span>
                    </td>

                    {/* Participant 1 info */}
                    <td className="px-6 py-4.5">
                      <p className="font-bold text-zinc-900">{item.c1Nom} {item.c1Cognoms}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{item.c1Telefon} • Talla {item.c1Talla}</p>
                    </td>

                    {/* Participant 2 info */}
                    <td className="px-6 py-4.5">
                      <p className="font-bold text-zinc-900">{item.c2Nom} {item.c2Cognoms}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{item.c2Telefon} • Talla {item.c2Talla}</p>
                    </td>

                    {/* Category display */}
                    <td className="px-6 py-4.5 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold font-mono ${
                        item.categoria === CategoriaParella.ADULT 
                          ? 'bg-zinc-900 text-white' 
                          : 'bg-fuchsia-100 text-fuchsia-800'
                      }`}>
                        {item.categoria}
                      </span>
                    </td>

                    {/* Payment status badge */}
                    <td className="px-6 py-4.5 text-center">
                      {item.estatPagament === EstatPagament.PAGAT ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                            <CheckCircle size={10} /> <strong>{item.preuCalculat}€</strong>
                          </span>
                          <span className="text-[9px] text-zinc-400 font-mono mt-0.5">{item.metodePagament}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock size={10} /> <strong>{item.preuCalculat}€ Pendent</strong>
                        </span>
                      )}
                    </td>

                    {/* DNI status badge */}
                    <td className="px-6 py-4.5 text-center">
                      {item.estatDni === EstatVerificacio.VALIDAT && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                          Validat
                        </span>
                      )}
                      {item.estatDni === EstatVerificacio.PENDENT && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Pendent
                        </span>
                      )}
                      {item.estatDni === EstatVerificacio.REBUTJAT && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 animate-pulse">
                          Rebutjat
                        </span>
                      )}
                    </td>

                    {/* Delivery material status */}
                    <td className="px-6 py-4.5 text-center">
                      {item.entregaMaterial === EstatInscripcio.ENTREGAT ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 text-white">
                          Lliurat
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-500">
                          No lliurat
                        </span>
                      )}
                    </td>

                    {/* Quick navigation action triggers */}
                    <td className="px-6 py-4.5 text-center">
                      <button 
                        type="button"
                        className="p-1 px-2.5 bg-zinc-100 hover:bg-fuchsia-600 hover:text-white rounded-lg transition-all inline-flex items-center gap-1 font-semibold group-hover:scale-105"
                      >
                        Obrir <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Interactive visual helper: Simulated Queue Panel to scan QR codes inside client! */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl text-white">
        <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-zinc-800">
          <Smartphone className="text-fuchsia-500" size={24} />
          <div>
            <h3 className="font-sans font-bold text-base text-white tracking-tight">Simulador de Cua i Escaneig de QR (Eina de Desenvolupament)</h3>
            <p className="text-xs text-zinc-400">Perfecte per provar el lliurament immediat a l'iframe selectant parelles en directe.</p>
          </div>
        </div>

        <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/80 mb-4 text-xs leading-relaxed space-y-1">
          <p className="font-sans">
            Com que us trobeu dins de l'entorn de test de l'AI Studio, no cal que apropis un codi QR imprès a la webcam. Hem construït aquest <strong className="text-fuchsia-400">simulador de cua</strong>!
          </p>
          <p className="text-zinc-500 font-mono">
            En pitjar el botó d'escaneig a sota, el sistema descodificarà el QR virtual i invocarà síncronament la ficha de la parella al PC de secretaria.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {inscripcions.map((item) => (
            <div 
              key={item.id}
              onClick={() => {
                if (onAddLog) onAddLog(`Simulant lectura des d'escaneig mòbil per a: ${item.c1Nom}`);
                onSelectInscripcio(item.id);
              }}
              className="bg-zinc-900 border border-zinc-800 hover:border-fuchsia-500/60 p-3 rounded-xl transition-all cursor-pointer flex justify-between items-center group relative overflow-hidden"
              id={`simulation-pill-${item.id}`}
            >
              <div className="space-y-0.5">
                <p className="font-bold font-sans text-xs group-hover:text-fuchsia-400 truncate max-w-[130px]">{item.c1Nom} &amp; {item.c2Nom}</p>
                <p className="text-[10px] text-zinc-500 font-mono tracking-tight">{item.codiSeguiment}</p>
              </div>
              
              <div className="p-1 px-2.5 bg-fuchsia-950/40 text-fuchsia-400 font-mono text-[10px] font-bold rounded-lg group-hover:bg-fuchsia-500 group-hover:text-white transition-colors flex items-center gap-1">
                <QrCode size={11} /> Escanejar
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
