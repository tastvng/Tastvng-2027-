/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
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
  FileText,
  Plus,
  Trash2,
  ShieldCheck,
  UserCheck,
  Key
} from 'lucide-react';
import { Inscripcio, CategoriaParella, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, SistemaConfig, StaffMember } from '../types';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  inscripcions: Inscripcio[];
  config: SistemaConfig;
  onSelectInscripcio: (id: string) => void;
  onGoToScanner: () => void;
  onGoToConfig: () => void;
  onLogout: () => void;
  onAddLog?: (txt: string) => void;
  onDeleteInscripcio?: (id: string) => void;
  onDeleteMultipleInscripcions?: (ids: string[]) => void;
  onClearAllInscripcions?: () => void;
  onAddInscripcioManual?: (newReg: Inscripcio) => void;
}

export default function AdminDashboard({ 
  inscripcions, 
  config,
  onSelectInscripcio, 
  onGoToScanner, 
  onGoToConfig, 
  onLogout,
  onAddLog,
  onDeleteInscripcio,
  onDeleteMultipleInscripcions,
  onClearAllInscripcions,
  onAddInscripcioManual
}: AdminDashboardProps) {
  const { language, t } = useLanguage();
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('ALL');
  const [filterPagament, setFilterPagament] = useState<string>('ALL');
  const [filterDni, setFilterDni] = useState<string>('ALL');
  const [filterEntrega, setFilterEntrega] = useState<string>('ALL');

  // Bulk and complete deletion helpers
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showBulkDeleteConfirmModal, setShowBulkDeleteConfirmModal] = useState(false);

  // Staff management state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem('tast_staff_2026');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    const defaults: StaffMember[] = [
      { id: 'st-0', nom: 'Secretaria General', usuari: 'secretaria', rol: 'Secretaria', contrasenya: 'eltast2026', creadoEn: '01/01/2026', actiu: true },
      { id: 'st-1', nom: 'Jordi Altiplà', usuari: 'jordia', rol: 'Coordinador', contrasenya: 'jordia123', creadoEn: '02/02/2026', actiu: true },
      { id: 'st-2', nom: 'Mireia VNG', usuari: 'mireiav', rol: 'Mesa d\'Entrega', contrasenya: 'mireia99', creadoEn: '15/03/2026', actiu: true }
    ];
    localStorage.setItem('tast_staff_2026', JSON.stringify(defaults));
    return defaults;
  });

  // Manual staff member introduction state
  const [newStaffNom, setNewStaffNom] = useState('');
  const [newStaffUsuari, setNewStaffUsuari] = useState('');
  const [newStaffContrasenya, setNewStaffContrasenya] = useState('');
  const [newStaffRol, setNewStaffRol] = useState<'SuperAdministrador' | 'Secretaria' | 'Mesa d\'Entrega' | 'Coordinador'>('Secretaria');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [inscriptionDeleteConfirmId, setInscriptionDeleteConfirmId] = useState<string | null>(null);

  // Manual add couple modal state
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for manual registration
  const [newCategoria, setNewCategoria] = useState<CategoriaParella>(CategoriaParella.ADULT);
  
  const [newC1Nom, setNewC1Nom] = useState('');
  const [newC1Cognoms, setNewC1Cognoms] = useState('');
  const [newC1Email, setNewC1Email] = useState('');
  const [newC1Telefon, setNewC1Telefon] = useState('');
  const [newC1Talla, setNewC1Talla] = useState('M');
  
  const [newC2Nom, setNewC2Nom] = useState('');
  const [newC2Cognoms, setNewC2Cognoms] = useState('');
  const [newC2Email, setNewC2Email] = useState('');
  const [newC2Telefon, setNewC2Telefon] = useState('');
  const [newC2Talla, setNewC2Talla] = useState('M');
  
  const [newC1UniformeTipus, setNewC1UniformeTipus] = useState<'compra' | 'lloguer'>('compra');
  const [newC2UniformeTipus, setNewC2UniformeTipus] = useState<'compra' | 'lloguer'>('compra');

  const [newDomas, setNewDomas] = useState(false);
  const [newMocadors, setNewMocadors] = useState(0);

  const [newEstatPagament, setNewEstatPagament] = useState<EstatPagament>(EstatPagament.PENDENT);
  const [newMetodePagament, setNewMetodePagament] = useState<MetodePagament>(MetodePagament.EFECTIU);

  const basePreu = newCategoria === CategoriaParella.ADULT ? config.preuAdult : config.preuJuvenil;
  const domasPreu = newDomas ? config.preuDomasBalco : 0;
  const mocadorsPreu = newMocadors * config.preuMocadorExtra;
  const calculatedPreu = basePreu + domasPreu + mocadorsPreu;

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newC1Nom.trim() || !newC2Nom.trim()) {
      alert("Si us plau, omple com a mínim els noms de tots dos participants.");
      return;
    }

    const tracker = 'TAST-2026-' + Math.floor(1000 + Math.random() * 9000);

    const novaInscripcio: Inscripcio = {
      id: 'ins-' + Math.random().toString(36).substr(2, 9),
      codiSeguiment: tracker,
      categoria: newCategoria,
      c1Nom: newC1Nom.trim(),
      c1Cognoms: newC1Cognoms.trim(),
      c1Email: newC1Email.trim() || 'secretaria@eltast.cat',
      c1Telefon: newC1Telefon.trim() || '600000000',
      c1Talla: newC1Talla,
      c1DniUrl: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?q=80&w=600&auto=format&fit=crop',
      c1UniformeTipus: newC1UniformeTipus,
      c2Nom: newC2Nom.trim(),
      c2Cognoms: newC2Cognoms.trim(),
      c2Email: newC2Email.trim() || 'secretaria@eltast.cat',
      c2Telefon: newC2Telefon.trim() || '600000000',
      c2Talla: newC2Talla,
      c2DniUrl: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?q=80&w=600&auto=format&fit=crop',
      c2UniformeTipus: newC2UniformeTipus,
      respostesCuestionari: {},
      preuCalculat: calculatedPreu,
      teDomasBalco: newDomas,
      teMocadorsExtra: newMocadors,
      estatPagament: newEstatPagament,
      metodePagament: newEstatPagament === EstatPagament.PAGAT ? newMetodePagament : null,
      estatDni: EstatVerificacio.VALIDAT,
      entregaMaterial: EstatInscripcio.PENDENT,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };

    if (onAddInscripcioManual) {
      onAddInscripcioManual(novaInscripcio);
    }

    // Reset Form
    setNewC1Nom('');
    setNewC1Cognoms('');
    setNewC1Email('');
    setNewC1Telefon('');
    setNewC2Nom('');
    setNewC2Cognoms('');
    setNewC2Email('');
    setNewC2Telefon('');
    setNewDomas(false);
    setNewMocadors(0);
    setNewEstatPagament(EstatPagament.PENDENT);
    setShowAddModal(false);
  };

  const handleAddStaffMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffNom.trim() || !newStaffUsuari.trim() || !newStaffContrasenya.trim()) {
      alert("Si us plau, omple tots els camps d’identificació manuals per al membre del staff.");
      return;
    }

    const nouMembre: StaffMember = {
      id: 'st-' + Math.random().toString(36).substr(2, 9),
      nom: newStaffNom.trim(),
      usuari: newStaffUsuari.trim().toLowerCase(),
      rol: newStaffRol,
      contrasenya: newStaffContrasenya.trim(),
      creadoEn: new Date().toLocaleDateString('ca-ES'),
      actiu: true
    };

    const updated = [...staffList, nouMembre];
    setStaffList(updated);
    localStorage.setItem('tast_staff_2026', JSON.stringify(updated));
    window.dispatchEvent(new Event('staffChanged'));

    if (onAddLog) {
      onAddLog(`S'ha afegit ${newStaffNom} (${newStaffRol}) al personal d'administració.`);
    }

    // Reset fields
    setNewStaffNom('');
    setNewStaffUsuari('');
    setNewStaffContrasenya('');
    setNewStaffRol('Secretaria');
  };

  const handleUpdateStaffRol = (id: string, rol: 'SuperAdministrador' | 'Secretaria' | 'Mesa d\'Entrega' | 'Coordinador') => {
    const updated = staffList.map(s => s.id === id ? { ...s, rol } : s);
    setStaffList(updated);
    localStorage.setItem('tast_staff_2026', JSON.stringify(updated));
    window.dispatchEvent(new Event('staffChanged'));
    if (onAddLog) {
      onAddLog(`S'ha canviat el rol del perfil d'administrador.`);
    }
  };

  const handleToggleStaffActiu = (id: string) => {
    const updated = staffList.map(s => s.id === id ? { ...s, actiu: !s.actiu } : s);
    setStaffList(updated);
    localStorage.setItem('tast_staff_2026', JSON.stringify(updated));
    window.dispatchEvent(new Event('staffChanged'));
    if (onAddLog) {
      onAddLog(`Estat d'accés del perfil de staff modificat.`);
    }
  };

  const handleRemoveStaffMember = (id: string, name: string) => {
    if (deleteConfirmId === id) {
      const updated = staffList.filter(s => s.id !== id);
      setStaffList(updated);
      localStorage.setItem('tast_staff_2026', JSON.stringify(updated));
      window.dispatchEvent(new Event('staffChanged'));
      if (onAddLog) {
        onAddLog(`Retirat ${name} del canal de personal habilitat.`);
      }
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // Automatically reset confirmation after 3.5 seconds of inactivity
      setTimeout(() => {
        setDeleteConfirmId(prev => prev === id ? null : prev);
      }, 3500);
    }
  };

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
      item.c2Telefon,
      item.c1UniformeTipus || 'compra',
      item.c2UniformeTipus || 'compra',
      (item.c1UniformeTipus === 'lloguer' ? 'lloguer alquiler renta rent' : 'compra venta sale buy'),
      (item.c2UniformeTipus === 'lloguer' ? 'lloguer alquiler renta rent' : 'compra venta sale buy')
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

  const isAllVisibleSelected = filteredInscripcions.length > 0 && filteredInscripcions.every(item => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (isAllVisibleSelected) {
      const visibleIds = filteredInscripcions.map(i => i.id);
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      const visibleIds = filteredInscripcions.map(i => i.id);
      setSelectedIds(prev => {
        const unique = new Set([...prev, ...visibleIds]);
        return Array.from(unique);
      });
    }
  };

  const handleBulkDelete = () => {
    if (onDeleteMultipleInscripcions) {
      onDeleteMultipleInscripcions(selectedIds);
      setSelectedIds([]);
      setShowBulkDeleteConfirmModal(false);
    }
  };

  const handleClearAll = () => {
    if (onClearAllInscripcions) {
      onClearAllInscripcions();
      setSelectedIds([]);
      setShowClearConfirmModal(false);
    }
  };

  // Client-side Excel download representing true Excel .xlsx sheet export
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
      'ADQUISICIÓ UNIFORME 1',
      'C1 MENOR D\'EDAT?',
      'C1 NOM TUTOR',
      'C1 COGNOMS TUTOR',
      'C1 DNI TUTOR',
      'C1 TELEFON TUTOR',
      'NOM COMPARSER 2',
      'COGNOMS COMPARSER 2',
      'EMAIL COMPARSER 2',
      'TELEFON COMPARSER 2',
      'TALLA COMPARSER 2',
      'ADQUISICIÓ UNIFORME 2',
      'C2 MENOR D\'EDAT?',
      'C2 NOM TUTOR',
      'C2 COGNOMS TUTOR',
      'C2 DNI TUTOR',
      'C2 TELEFON TUTOR',
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
      i.c1UniformeTipus === 'lloguer' ? (language === 'ca' ? 'LLOGUER' : 'ALQUILER') : (language === 'ca' ? 'COMPRA' : 'COMPRA'),
      i.c1EsMenor ? 'SÍ' : 'NO',
      i.c1EsMenor ? (i.c1TutorNom || '') : '',
      i.c1EsMenor ? (i.c1TutorCognoms || '') : '',
      i.c1EsMenor ? (i.c1TutorDni || '') : '',
      i.c1EsMenor ? (i.c1TutorTelefon || '') : '',
      i.c2Nom,
      i.c2Cognoms,
      i.c2Email,
      i.c2Telefon,
      i.c2Talla,
      i.c2UniformeTipus === 'lloguer' ? (language === 'ca' ? 'LLOGUER' : 'ALQUILER') : (language === 'ca' ? 'COMPRA' : 'COMPRA'),
      i.c2EsMenor ? 'SÍ' : 'NO',
      i.c2EsMenor ? (i.c2TutorNom || '') : '',
      i.c2EsMenor ? (i.c2TutorCognoms || '') : '',
      i.c2EsMenor ? (i.c2TutorDni || '') : '',
      i.c2EsMenor ? (i.c2TutorTelefon || '') : '',
      i.preuCalculat,
      i.teDomasBalco ? 'SÍ' : 'NO',
      i.teMocadorsExtra,
      i.estatPagament,
      i.metodePagament || 'CAP',
      i.estatDni,
      i.entregaMaterial,
      i.creadoEn ? new Date(i.creadoEn).toLocaleString() : ''
    ]);

    // Create a worksheet from headers and rows
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Create workbook and append worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inscripcions");

    // Write workbook to file in standard .xlsx format
    XLSX.writeFile(wb, `llista_espera_tast_comparses_${new Date().toISOString().slice(0,10)}.xlsx`);

    if (onAddLog) {
      onAddLog("Exportació a full d'Excel (.xlsx) de dades completada.");
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
              <h2 className="font-sans font-black text-lg tracking-tight">
                {language === 'ca' ? "Panell Secretaria El Tast" : "Panel Secretaría El Tast"}
              </h2>
              <span className="text-[9px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">ONLINE</span>
            </div>
            <p className="text-zinc-500 text-xs">
              {language === 'ca' 
                ? "Gestió i validació d'inscripcions Comparses 2026" 
                : "Gestión y validación de inscripciones Comparsas 2026"}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button 
            onClick={onGoToScanner}
            className="text-xs bg-fuchsia-600 hover:bg-fuchsia-500 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
            id="btn-nav-scanner"
          >
            <QrCode size={14} /> {language === 'ca' ? "Escàner Mòbil" : "Escáner Móvil"}
          </button>
          
          <button 
            onClick={onGoToConfig}
            className="text-xs bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            id="btn-nav-config"
          >
            <Sliders size={14} className="text-fuchsia-500" /> {language === 'ca' ? "Preus i Camps" : "Precios y Campos"}
          </button>

          <button 
            onClick={() => setShowStaffModal(true)}
            className="text-xs bg-zinc-900 hover:bg-[#ff0090]/15 hover:text-white hover:border-[#ff0090] border border-zinc-800 font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 focus:outline-none shadow-md shadow-fuchsia-500/5 cursor-pointer"
            id="btn-nav-staff"
          >
            <ShieldCheck size={14} className="text-[#ff0090]" /> {language === 'ca' ? "Gestió de Staff" : "Gestión de Staff"}
          </button>

          <button 
            onClick={onLogout}
            className="text-xs bg-red-950/20 text-red-400 hover:bg-red-950/40 border border-red-900/30 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
            title={language === 'ca' ? "Tancar Sessió" : "Cerrar Sesión"}
            id="btn-nav-logout"
          >
            <LogOut size={14} /> {language === 'ca' ? "Sortir" : "Salir"}
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
                type="button"
                onClick={() => setShowAddModal(true)}
                className="bg-zinc-900 hover:bg-black text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5"
                id="btn-add-couple-manual"
              >
                <Plus size={15} className="text-[#ff0090]" /> Afegir Parella Manual
              </button>

              <button 
                onClick={exportToExcel}
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5"
                id="btn-export-excel"
              >
                <FileSpreadsheet size={15} /> Exportar Excel
              </button>

              {selectedIds.length > 0 && (
                <button 
                  type="button"
                  onClick={() => setShowBulkDeleteConfirmModal(true)}
                  className="bg-red-50 hover:bg-red-105 border border-red-200 text-red-600 font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  id="btn-delete-selected"
                >
                  <Trash2 size={15} /> Esborrar seleccionats ({selectedIds.length})
                </button>
              )}

              <button 
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                id="btn-clear-all"
              >
                <Trash2 size={15} /> Buidar Base de Dades
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
                  <th className="px-4 py-4 text-center w-12">
                    <input 
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 text-[#ff0090] focus:ring-[#ff0090] cursor-pointer h-4 w-4"
                      id="checkbox-select-all"
                    />
                  </th>
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
                    className={`hover:bg-fuchsia-50/20 cursor-pointer transition-colors group align-middle ${
                      selectedIds.includes(item.id) ? 'bg-fuchsia-50/30' : ''
                    }`}
                    id={`row-registration-${item.id}`}
                  >
                    <td className="px-4 py-4.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds(prev => 
                            checked ? [...prev, item.id] : prev.filter(x => x !== item.id)
                          );
                        }}
                        className="rounded border-zinc-300 text-[#ff0090] focus:ring-[#ff0090] cursor-pointer h-4 w-4"
                        id={`checkbox-select-${item.id}`}
                      />
                    </td>
                    {/* tracking code and creation date */}
                    <td className="px-6 py-4.5">
                      <span className="font-mono font-bold text-zinc-900 block">{item.codiSeguiment}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{new Date(item.creadoEn).toLocaleDateString('ca-ES')}</span>
                    </td>

                    {/* Participant 1 info */}
                    <td className="px-6 py-4.5">
                      <p className="font-bold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                        {item.c1Nom} {item.c1Cognoms}
                        {item.c1EsMenor && (
                          <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shrink-0" title="És menor d'edat">
                            MENOR
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {item.c1Telefon} • Talla {item.c1Talla} <span className="text-[#ff0090] font-sans font-bold text-[9px] uppercase px-1 pb-0.5 bg-fuchsia-50/50 rounded border border-fuchsia-100/50 ml-1">{item.c1UniformeTipus === 'lloguer' ? (language === 'ca' ? 'Lloguer' : 'Alquiler') : (language === 'ca' ? 'Compra' : 'Compra')}</span>
                      </p>
                    </td>

                    {/* Participant 2 info */}
                    <td className="px-6 py-4.5">
                      <p className="font-bold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                        {item.c2Nom} {item.c2Cognoms}
                        {item.c2EsMenor && (
                          <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shrink-0" title="És menor d'edat">
                            MENOR
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {item.c2Telefon} • Talla {item.c2Talla} <span className="text-[#ff0090] font-sans font-bold text-[9px] uppercase px-1 pb-0.5 bg-fuchsia-50/50 rounded border border-fuchsia-100/50 ml-1">{item.c2UniformeTipus === 'lloguer' ? (language === 'ca' ? 'Lloguer' : 'Alquiler') : (language === 'ca' ? 'Compra' : 'Compra')}</span>
                      </p>
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
                      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => onSelectInscripcio(item.id)}
                          type="button"
                          className="p-1 px-2.5 bg-zinc-100 hover:bg-fuchsia-600 hover:text-white rounded-lg transition-all inline-flex items-center gap-1 font-semibold hover:scale-105"
                        >
                          Obrir <ChevronRight size={12} />
                        </button>
                        {onDeleteInscripcio && (
                          <button
                            onClick={() => {
                              if (inscriptionDeleteConfirmId === item.id) {
                                onDeleteInscripcio(item.id);
                                setSelectedIds(prev => prev.filter(x => x !== item.id));
                                setInscriptionDeleteConfirmId(null);
                              } else {
                                setInscriptionDeleteConfirmId(item.id);
                                setTimeout(() => {
                                  setInscriptionDeleteConfirmId(prev => prev === item.id ? null : prev);
                                }, 4000);
                              }
                            }}
                            type="button"
                            className={`p-1.5 rounded-lg transition-all hover:scale-105 font-bold font-sans flex items-center gap-1 ${
                              inscriptionDeleteConfirmId === item.id 
                                ? 'bg-red-600 text-white animate-pulse text-[10px] px-2' 
                                : 'bg-zinc-100 hover:bg-red-600 hover:text-white text-red-500'
                            }`}
                            title={inscriptionDeleteConfirmId === item.id ? "Clica un altre cop per confirmar l'eliminació" : "Eliminar parella"}
                          >
                            {inscriptionDeleteConfirmId === item.id ? "Eliminar?" : <Trash2 size={13} />}
                          </button>
                        )}
                      </div>
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

      {/* Manual Registration Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm font-sans" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-3xl border border-zinc-150 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 text-zinc-900 relative animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
              <div>
                <h3 className="font-sans font-black text-lg text-zinc-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Plus size={20} className="text-[#ff0090]" /> Registre Manual de Parella
                </h3>
                <p className="text-xs text-zinc-500 font-mono">Secretaria de l'Associació El Tast • 2026</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 px-3 bg-zinc-100 hover:bg-zinc-250 text-zinc-650 rounded-lg text-xs font-bold transition"
              >
                Tancar ✕
              </button>
            </div>

            <form onSubmit={handleSubmitManual} className="space-y-5 text-xs text-zinc-800">
              {/* Category selector */}
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5 font-bold">Categoria de la Parella *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2.5 p-3.5 bg-zinc-50 hover:bg-zinc-100 rounded-2xl cursor-pointer border border-zinc-200 flex-1">
                    <input 
                      type="radio" 
                      name="modal-categoria" 
                      value={CategoriaParella.ADULT}
                      checked={newCategoria === CategoriaParella.ADULT}
                      onChange={() => setNewCategoria(CategoriaParella.ADULT)}
                      className="accent-[#ff0090]"
                    />
                    <div>
                      <p className="font-bold text-zinc-850 text-xs">Adults (Preu: {config.preuAdult}€)</p>
                      <p className="text-[10px] text-zinc-500 font-mono">A partir de 16 anys</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3.5 bg-zinc-50 hover:bg-zinc-100 rounded-2xl cursor-pointer border border-zinc-200 flex-1">
                    <input 
                      type="radio" 
                      name="modal-categoria" 
                      value={CategoriaParella.JUVENIL}
                      checked={newCategoria === CategoriaParella.JUVENIL}
                      onChange={() => setNewCategoria(CategoriaParella.JUVENIL)}
                      className="accent-[#ff0090]"
                    />
                    <div>
                      <p className="font-bold text-zinc-850 text-xs">Juvenils (Preu: {config.preuJuvenil}€)</p>
                      <p className="text-[10px] text-zinc-500 font-mono">Fins als 15 anys inclòs</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Comparser 1 Box */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-150 space-y-3.5">
                  <h4 className="font-sans font-bold text-xs text-[#ff0090] uppercase tracking-wider">Primer Comparser</h4>
                  
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Nom *</label>
                    <input 
                      type="text" 
                      required
                      value={newC1Nom}
                      onChange={(e) => setNewC1Nom(e.target.value)}
                      placeholder="Ex. Joan"
                      className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Cognoms *</label>
                    <input 
                      type="text" 
                      required
                      value={newC1Cognoms}
                      onChange={(e) => setNewC1Cognoms(e.target.value)}
                      placeholder="Ex. Garcia Perez"
                      className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Mòbil (Opcional)</label>
                      <input 
                        type="tel" 
                        value={newC1Telefon}
                        onChange={(e) => setNewC1Telefon(e.target.value)}
                        placeholder="600000000"
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-2 text-[11px] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Talla Camisa</label>
                      <select
                        value={newC1Talla}
                        onChange={(e) => setNewC1Talla(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none cursor-pointer font-bold"
                      >
                        <option value="XS font-bold">XS</option>
                        <option value="S">S</option>
                        <option value="M">M</option>
                        <option value="L">L</option>
                        <option value="XL">XL</option>
                        <option value="XXL">XXL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Adquisició</label>
                      <select
                        value={newC1UniformeTipus}
                        onChange={(e) => setNewC1UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                        className="w-full bg-white border border-zinc-200 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none cursor-pointer font-bold text-[#ff0090]"
                      >
                        <option value="compra">Compra</option>
                        <option value="lloguer">Lloguer</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">E-mail (Opcional)</label>
                    <input 
                      type="email" 
                      value={newC1Email}
                      onChange={(e) => setNewC1Email(e.target.value)}
                      placeholder="joan@example.com"
                      className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Comparser 2 Box */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-150 space-y-3.5">
                  <h4 className="font-sans font-bold text-xs text-[#ff0090] uppercase tracking-wider">Segon Comparser</h4>
                  
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Nom *</label>
                    <input 
                      type="text" 
                      required
                      value={newC2Nom}
                      onChange={(e) => setNewC2Nom(e.target.value)}
                      placeholder="Ex. Marta"
                      className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Cognoms *</label>
                    <input 
                      type="text" 
                      required
                      value={newC2Cognoms}
                      onChange={(e) => setNewC2Cognoms(e.target.value)}
                      placeholder="Ex. Lopez Pujol"
                      className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Mòbil (Opcional)</label>
                      <input 
                        type="tel" 
                        value={newC2Telefon}
                        onChange={(e) => setNewC2Telefon(e.target.value)}
                        placeholder="611000000"
                        className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2.5 py-2 text-[11px] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Talla Camisa</label>
                      <select
                        value={newC2Talla}
                        onChange={(e) => setNewC2Talla(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none cursor-pointer font-bold"
                      >
                        <option value="XS">XS</option>
                        <option value="S">S</option>
                        <option value="M">M</option>
                        <option value="L">L</option>
                        <option value="XL">XL</option>
                        <option value="XXL">XXL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Adquisició</label>
                      <select
                        value={newC2UniformeTipus}
                        onChange={(e) => setNewC2UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                        className="w-full bg-white border border-zinc-200 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none cursor-pointer font-bold text-[#ff0090]"
                      >
                        <option value="compra">Compra</option>
                        <option value="lloguer">Lloguer</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">E-mail (Opcional)</label>
                    <input 
                      type="email" 
                      value={newC2Email}
                      onChange={(e) => setNewC2Email(e.target.value)}
                      placeholder="marta@example.com"
                      className="w-full bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Extras and Payment state */}
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-150 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-zinc-800 uppercase tracking-wide">Complements i Extres</h4>
                  
                  <label className="flex items-center gap-2.5 cursor-pointer py-1.5">
                    <input 
                      type="checkbox"
                      checked={newDomas}
                      onChange={(e) => setNewDomas(e.target.checked)}
                      className="rounded accent-[#ff0090] h-4 w-4"
                    />
                    <div>
                      <p className="font-bold text-xs">Domàs Corporatiu (+{config.preuDomasBalco}€)</p>
                      <p className="text-[10px] text-zinc-500">Un mocador gegant ideal per decorar balconeres</p>
                    </div>
                  </label>

                  <div className="flex justify-between items-center py-1 border-t border-zinc-200 pt-2.5">
                    <div>
                      <p className="font-bold text-xs">Mocadors Extra de Comparsa (+{config.preuMocadorExtra}€/u.)</p>
                      <p className="text-[10px] text-zinc-500">Mocadors adicionals oficials del Tast</p>
                    </div>
                    <input 
                      type="number"
                      min={0}
                      value={newMocadors}
                      onChange={(e) => setNewMocadors(Math.max(0, Number(e.target.value)))}
                      className="w-14 bg-white border border-zinc-200 focus:border-[#ff0090] rounded-xl px-2 py-1 text-xs text-center font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-3 md:border-l md:border-zinc-200 md:pl-4">
                  <h4 className="font-bold text-xs text-zinc-800 uppercase tracking-wide">Estat del Pagament</h4>
                  
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Estat de Liquidació</label>
                    <select
                      value={newEstatPagament}
                      onChange={(e) => setNewEstatPagament(e.target.value as EstatPagament)}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none cursor-pointer font-semibold"
                    >
                      <option value={EstatPagament.PENDENT}>Pendent de Pagament</option>
                      <option value={EstatPagament.PAGAT}>S'ha rebut correctament (Cobrat)</option>
                    </select>
                  </div>

                  {newEstatPagament === EstatPagament.PAGAT && (
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Mètode de Cobrament</label>
                      <select
                        value={newMetodePagament}
                        onChange={(e) => setNewMetodePagament(e.target.value as MetodePagament)}
                        className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none cursor-pointer font-semibold"
                      >
                        <option value={MetodePagament.EFECTIU}>Efectiu a secretaria</option>
                        <option value={MetodePagament.BIZUM}>Bizum rebut a caixa</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Total display action area */}
              <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-zinc-950 text-white rounded-2xl gap-4">
                <div>
                  <span className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wide">Total a Liquidar</span>
                  <span className="font-sans font-black text-xl text-[#ff0090]">
                    {calculatedPreu}€ <span className="text-[10px] font-normal text-zinc-400">({basePreu}€ base + {domasPreu + mocadorsPreu}€ extres)</span>
                  </span>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-zinc-850 hover:bg-zinc-800 font-bold border border-zinc-750 text-zinc-300 rounded-xl transition"
                  >
                    Cancel·lar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#ff0090] text-black hover:bg-[#ff0090]/90 font-black rounded-xl transition-all shadow-md uppercase tracking-wider text-xs"
                  >
                    Alta de Parella
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-sans font-black text-sm text-zinc-900 tracking-tight">Buidar Base de Dades</h3>
                <p className="text-[10px] text-red-500 font-mono font-bold uppercase tracking-wider">Perill • Acció Irreversible</p>
              </div>
            </div>

            <p className="text-xs text-zinc-650 leading-relaxed font-sans">
              Estàs 100% segur de que vols esborrar-ho tot de la base de dades d'inscripcions d'El Tast? Aquesta acció és irreversible i eliminarà totes les dades registrades fins ara.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition"
              >
                No, cancel·lar
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 py-1 px-4 bg-red-650 text-white hover:bg-red-700 font-bold text-xs rounded-xl transition"
              >
                Sí, vull esborrar-ho tot
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-sans font-black text-sm text-zinc-900 tracking-tight">Esborrar seleccionats</h3>
                <p className="text-[10px] text-red-500 font-mono font-bold uppercase tracking-wider">Acció Massiva</p>
              </div>
            </div>

            <p className="text-xs text-zinc-650 leading-relaxed font-sans">
              Estàs segur que vols esborrar les <strong>{selectedIds.length}</strong> parelles seleccionades? Aquesta acció no es pot desfer.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirmModal(false)}
                className="flex-1 py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition"
              >
                No, cancel·lar
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex-1 py-1 px-4 bg-red-650 text-white hover:bg-red-700 font-bold text-xs rounded-xl transition"
              >
                Sí, esborrar seleccionats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Gestió de Staff i Administradors */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-950 text-white animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-fuchsia-600 rounded-xl">
                  <ShieldCheck size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-base text-white tracking-tight">Gestió de Staff i Administradors</h3>
                  <p className="text-[11px] text-zinc-400 font-sans">Afegeix administradors, assigna rols o gestiona permisos de l'equip del Tast</p>
                </div>
              </div>
              <button 
                onClick={() => setShowStaffModal(false)}
                className="p-1.5 px-3 text-xs bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 rounded-xl transition font-mono tracking-tighter"
              >
                Tancar (esc)
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-zinc-50">
              
              {/* Grid 2 Columns: Add member / Current members */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* 1. Add Staff Member Form (Manual Introduction) */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm space-y-4">
                  <h4 className="font-sans font-bold text-xs text-zinc-800 uppercase tracking-widest flex items-center gap-1">
                    <UserCheck size={16} className="text-[#ff0090]" /> Alta de Superadministradors i Staff
                  </h4>
                  <div className="h-px bg-zinc-100" />

                  <form onSubmit={handleAddStaffMember} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1 font-bold">Nom Complet *</label>
                      <input 
                        type="text" 
                        required
                        value={newStaffNom}
                        onChange={(e) => setNewStaffNom(e.target.value)}
                        placeholder="Ex. Joan Garcia"
                        className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl px-3 py-2 text-xs focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1 font-bold">Nom d'Usuari *</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 pointer-events-none text-xs font-mono">@</span>
                        <input 
                          type="text" 
                          required
                          value={newStaffUsuari}
                          onChange={(e) => setNewStaffUsuari(e.target.value)}
                          placeholder="Ex. joang"
                          className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl pl-7 pr-3 py-2 text-xs focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1 font-bold">Contrasenya *</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 pointer-events-none">
                          <Key size={12} />
                        </span>
                        <input 
                          type="text" 
                          required
                          value={newStaffContrasenya}
                          onChange={(e) => setNewStaffContrasenya(e.target.value)}
                          placeholder="Clau ràpida format privat"
                          className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1 font-bold">Seleccionar Categoria (SuperAdministrador o Staff) *</label>
                      <select
                        value={newStaffRol}
                        onChange={(e) => setNewStaffRol(e.target.value as any)}
                        className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none cursor-pointer font-bold"
                      >
                        <option value="SuperAdministrador">👑 SuperAdministrador (Accés i Control Total)</option>
                        <option value="Secretaria">👥 Staff / Secretaria (Edició i Pagaments)</option>
                        <option value="Mesa d'Entrega">👥 Staff / Mesa d'Entrega (Lliurament de Dossals)</option>
                        <option value="Coordinador">👥 Staff / Coordinador Tècnic de Taula</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2 py-2.5 bg-zinc-950 text-white hover:bg-black font-bold rounded-xl transition text-xs flex items-center justify-center gap-1 shadow-sm uppercase tracking-wider cursor-pointer font-sans"
                    >
                      <Plus size={14} className="text-[#ff0090]" /> Donar d'Alta Membre
                    </button>
                  </form>
                </div>

                {/* 2. Staff Directory */}
                <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-sans font-bold text-xs text-zinc-800 uppercase tracking-widest">
                      Llistat de Personal ({staffList.length})
                    </h4>
                    <span className="text-[9px] bg-zinc-100 text-zinc-500 font-mono font-bold px-2 py-0.5 rounded">
                      2026 ACTIVE SHEETS
                    </span>
                  </div>
                  <div className="h-px bg-zinc-100" />

                  {staffList.length === 0 ? (
                    <div className="py-8 text-center text-zinc-400 font-sans text-xs">
                      No hi ha cap membre extra registrat. Utilitzeu el qüestionari manual de l’esquerra enguany.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {staffList.map((st) => (
                        <div 
                          key={st.id} 
                          className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            st.actiu ? 'bg-white border-zinc-200 hover:bg-zinc-50/50 hover:shadow-xs' : 'bg-zinc-50 border-zinc-150 opacity-60'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-zinc-900 leading-none">{st.nom}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                st.rol === 'SuperAdministrador' ? 'bg-red-50 text-red-550 border border-red-200' :
                                st.rol === 'Secretaria' ? 'bg-fuchsia-50 text-fuchsia-550 border border-fuchsia-200' :
                                st.rol === 'Coordinador' ? 'bg-blue-50 text-blue-550 border border-blue-200' :
                                'bg-zinc-100 text-zinc-650 border border-zinc-200'
                              }`}>
                                {st.rol}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                              <span>usuari: <strong className="text-zinc-650">@{st.usuari}</strong></span>
                              <span>clau: <strong className="text-zinc-650">{st.contrasenya}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Role changer dropdown */}
                            <select
                              value={st.rol}
                              onChange={(e) => handleUpdateStaffRol(st.id, e.target.value as any)}
                              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[10px] border-none font-bold rounded px-2 py-1 focus:outline-none cursor-pointer"
                            >
                              <option value="Secretaria">Secretaria</option>
                              <option value="Mesa d'Entrega">Mesa d'Entrega</option>
                              <option value="Coordinador">Coordinador</option>
                              <option value="SuperAdministrador">Admin</option>
                            </select>

                            {/* Active Toggle Button */}
                            <button
                              onClick={() => handleToggleStaffActiu(st.id)}
                              className={`text-[9px] font-bold px-2 py-1 rounded transition cursor-pointer ${
                                st.actiu 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                                  : 'bg-zinc-100 text-zinc-400 border border-zinc-200 hover:bg-zinc-200 hover:text-zinc-600'
                              }`}
                              title="Habilitar/Deshabilitar accés"
                            >
                              {st.actiu ? 'Actiu' : 'Inactiu'}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleRemoveStaffMember(st.id, st.nom)}
                              className={`px-2 py-1 transition rounded-lg cursor-pointer text-xs font-bold font-sans flex items-center gap-1 ${
                                deleteConfirmId === st.id 
                                  ? 'bg-red-650 text-white animate-pulse' 
                                  : 'text-zinc-400 hover:text-red-500 hover:bg-red-55'
                              }`}
                              title={deleteConfirmId === st.id ? "Clica un altre cop per confirmar" : "Retirar accés"}
                            >
                              {deleteConfirmId === st.id ? (
                                <span className="text-[10px] px-1 font-extrabold uppercase">Confirmar?</span>
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-400 font-mono">
              <span>Nota: Els usuaris afegits es poden fer servir instantàniament des de la pantalla de login.</span>
              <span>Associació Cultural El Tast • Vilanova 2026</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
