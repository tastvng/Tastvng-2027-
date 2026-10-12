import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  X, 
  Phone, 
  Mail, 
  AlertCircle, 
  Check, 
  Minus, 
  CreditCard, 
  Receipt, 
  ShieldCheck, 
  Camera, 
  Upload, 
  Trash2,
  Euro
} from 'lucide-react';
import { 
  Inscripcio, 
  SistemaConfig, 
  CategoriaParella, 
  EstatPagament, 
  EstatVerificacio, 
  EstatInscripcio, 
  MetodePagament, 
  PagamentRegistrat,
  PreguntaDinamica 
} from '../types';
import { useLanguage } from '../LanguageContext';
import { cargarPreguntesDetallat } from '../api/questionnaireApi';
import { 
  answerKey, 
  isPreguntaVisible, 
  cleanupDescendantsOnAnswerChange, 
  visibleAnswers, 
  QuestionScope 
} from '../utils/questionVisibility';
import { calculateInscriptionOrderBreakdown } from '../utils/orderCalculations';
import { parseImport, formatEuro, derivedEstatPagament } from '../utils/paymentCalculations';
import { ComparserCard } from './publicForm/ComparserCard';
import { DynamicQuestionsSection } from './DynamicQuestionsSection';

interface AdminManualRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (registration: Inscripcio) => void;
  config: SistemaConfig;
  inscripcions: Inscripcio[];
  activeYear: number | string;
}

export const AdminManualRegistrationModal: React.FC<AdminManualRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  config,
  inscripcions,
  activeYear
}) => {
  const { language } = useLanguage();

  // Category
  const [categoria, setCategoria] = useState<CategoriaParella>(CategoriaParella.ADULT);

  // Couple contact details
  const [emailContactoPareja, setEmailContactoPareja] = useState('');
  const [telefonContactoPareja, setTelefonContactoPareja] = useState('');

  // Comparser 1
  const [c1Nom, setC1Nom] = useState('');
  const [c1Cognoms, setC1Cognoms] = useState('');
  const [c1DniUrl, setC1DniUrl] = useState<string | null>('');
  const [c1EsMenor, setC1EsMenor] = useState(false);
  const [c1TutorNom, setC1TutorNom] = useState('');
  const [c1TutorCognoms, setC1TutorCognoms] = useState('');
  const [c1TutorDni, setC1TutorDni] = useState('');
  const [c1TutorTelefon, setC1TutorTelefon] = useState('');
  const [c1TutorAccepta, setC1TutorAccepta] = useState(false);
  const [c1Talla, setC1Talla] = useState('M');
  const [c1UniformeTipus, setC1UniformeTipus] = useState<'compra' | 'lloguer'>('compra');

  // Comparser 2
  const [c2Nom, setC2Nom] = useState('');
  const [c2Cognoms, setC2Cognoms] = useState('');
  const [c2DniUrl, setC2DniUrl] = useState<string | null>('');
  const [c2EsMenor, setC2EsMenor] = useState(false);
  const [c2TutorNom, setC2TutorNom] = useState('');
  const [c2TutorCognoms, setC2TutorCognoms] = useState('');
  const [c2TutorDni, setC2TutorDni] = useState('');
  const [c2TutorTelefon, setC2TutorTelefon] = useState('');
  const [c2TutorAccepta, setC2TutorAccepta] = useState(false);
  const [c2Talla, setC2Talla] = useState('M');
  const [c2UniformeTipus, setC2UniformeTipus] = useState<'compra' | 'lloguer'>('compra');

  // Dynamic Uniform Selections
  const buildInitialUniformSelections = () => {
    const initial: Record<string, { c1Talla: string; c2Talla: string; c1Quantitat: number; c2Quantitat: number; c1Tipus: 'compra' | 'lloguer'; c2Tipus: 'compra' | 'lloguer'; c1Vol?: boolean; c2Vol?: boolean }> = {};
    const lines = config.liniisUniforme || [
      {
        id: 'lin-1',
        nom: config.nomUniforme || "Talla d'Armilla",
        nomES: config.nomUniformeES || "Talla de Chaleco",
        opcions: config.opcionsUniforme || ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
        requeixQuantitat: false
      }
    ];
    lines.forEach(l => {
      initial[l.id] = {
        c1Talla: l.opcions[0] || 'M',
        c2Talla: l.opcions[0] || 'M',
        c1Quantitat: 1,
        c2Quantitat: 1,
        c1Tipus: 'compra',
        c2Tipus: 'compra',
        c1Vol: false,
        c2Vol: false
      };
    });
    return initial;
  };

  const [seleccionsUniforme, setSeleccionsUniforme] = useState(buildInitialUniformSelections);
  const [extrasSeleccionats, setExtrasSeleccionats] = useState<Record<string, number>>({});

  // Extras: Clavells and Corbatí
  const [clavellsQty, setClavellsQty] = useState(0);
  const [corbatiQty, setCorbatiQty] = useState(0);

  // Dynamic Questions from DB / Config
  const [preguntesList, setPreguntesList] = useState<PreguntaDinamica[]>([]);
  const [respostesCuestionari, setRespostesCuestionari] = useState<Record<string, string | boolean>>({});

  // Payment states: 'PENDENT' | 'PAGAT' | 'PARCIAL'
  const [modalEstatPagament, setModalEstatPagament] = useState<'PENDENT' | 'PAGAT' | 'PARCIAL'>('PENDENT');
  const [modalMetodePagament, setModalMetodePagament] = useState<MetodePagament>(MetodePagament.EFECTIU);
  const [pagoParcialImport, setPagoParcialImport] = useState<string>('');

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Camera state for optional DNI capture
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraOwner, setCameraOwner] = useState<'c1' | 'c2' | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load dynamic questions from Supabase table 'preguntes' with fallback
  useEffect(() => {
    let isMounted = true;
    async function loadQuestions() {
      try {
        const result = await cargarPreguntesDetallat(true);
        if (!isMounted) return;
        if (result.data !== null) {
          const activeSorted = [...result.data]
            .filter(q => q.activa)
            .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
          setPreguntesList(activeSorted);
        } else {
          const fallbackList = (config.preguntesFormulari || [])
            .filter(q => q.activa)
            .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
          setPreguntesList(fallbackList);
        }
      } catch (e) {
        if (!isMounted) return;
        const fallbackList = (config.preguntesFormulari || [])
          .filter(q => q.activa)
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
        setPreguntesList(fallbackList);
      }
    }

    if (isOpen) {
      loadQuestions();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, config.preguntesFormulari]);

  // Initialize answers when questions change
  useEffect(() => {
    setRespostesCuestionari(prev => {
      const initial: Record<string, string | boolean> = { ...prev };
      preguntesList.forEach(q => {
        if (!q.activa) return;
        if (q.ambit === 'comparser') {
          const k1 = `${q.id}__c1`;
          const k2 = `${q.id}__c2`;
          if (initial[k1] === undefined) initial[k1] = q.tipus === 'boolean' ? false : '';
          if (initial[k2] === undefined) initial[k2] = q.tipus === 'boolean' ? false : '';
        } else {
          if (initial[q.id] === undefined) initial[q.id] = q.tipus === 'boolean' ? false : '';
        }
      });
      return initial;
    });
  }, [preguntesList]);

  // Answer change handler with cascade cleanup
  const handleDynamicAnswerChange = (qId: string, val: string | boolean, scope: QuestionScope) => {
    const targetQ = preguntesList.find(p => p.id === qId) || { id: qId };
    const k = answerKey(targetQ, scope);
    setRespostesCuestionari(prev => {
      const updated = { ...prev, [k]: val };
      return cleanupDescendantsOnAnswerChange(updated, qId, preguntesList, scope);
    });

    if (errors[`question_${k}`]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[`question_${k}`];
        return copy;
      });
    }
  };

  // Tariff prices for clavells & corbatí
  const clavellsTariff = useMemo(() => {
    return (config.tarifesDinamiques || []).find(t => 
      t.actiu && (/clavell/i.test(t.nom) || /clavell/i.test(t.id) || /clavel/i.test(t.nomES || ''))
    );
  }, [config.tarifesDinamiques]);
  const clavellsPrice = clavellsTariff ? clavellsTariff.valor : 4;
  const clavellsNom = language === 'ca' ? 'Clavells' : 'Claveles';

  const corbatiTariff = useMemo(() => {
    return (config.tarifesDinamiques || []).find(t => 
      t.actiu && (/corbat|pajarit/i.test(t.nom) || /corbat|pajarit/i.test(t.id) || /pajarit/i.test(t.nomES || ''))
    );
  }, [config.tarifesDinamiques]);
  const corbatiPrice = corbatiTariff ? corbatiTariff.valor : 10;
  const corbatiNom = language === 'ca' ? 'Corbatí' : 'Pajarita';

  // Construct current registration for exact live breakdown calculation
  const currentRegistration: Inscripcio = useMemo(() => {
    const extres: Array<{ id: string; nom: string; quantitat: number; preuUnitari: number; modalitat?: string }> = [];

    if (clavellsQty > 0) {
      extres.push({
        id: 'clavells',
        nom: clavellsNom,
        quantitat: clavellsQty,
        preuUnitari: clavellsPrice,
        modalitat: language === 'ca' ? 'Complements' : 'Complementos'
      });
    }

    if (corbatiQty > 0) {
      extres.push({
        id: 'corbati',
        nom: corbatiNom,
        quantitat: corbatiQty,
        preuUnitari: corbatiPrice,
        modalitat: language === 'ca' ? 'Complements' : 'Complementos'
      });
    }

    return {
      categoria,
      c1Nom,
      c1Cognoms,
      c1Talla,
      c1UniformeTipus,
      c2Nom,
      c2Cognoms,
      c2Talla,
      c2UniformeTipus,
      seleccionsUniforme,
      extresSeleccionats: extres,
      respostesCuestionari
    } as Inscripcio;
  }, [
    categoria,
    c1Nom,
    c1Cognoms,
    c1Talla,
    c1UniformeTipus,
    c2Nom,
    c2Cognoms,
    c2Talla,
    c2UniformeTipus,
    seleccionsUniforme,
    clavellsQty,
    clavellsNom,
    clavellsPrice,
    corbatiQty,
    corbatiNom,
    corbatiPrice,
    language,
    respostesCuestionari
  ]);

  // Order breakdown calculation
  const orderBreakdown = useMemo(() => {
    return calculateInscriptionOrderBreakdown(
      currentRegistration, 
      { ...config, preguntesFormulari: preguntesList }, 
      language
    );
  }, [currentRegistration, config, preguntesList, language]);

  const totalCalculat = orderBreakdown?.totalCalculat ?? 0;

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, owner: 'c1' | 'c2') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(language === 'ca' ? "L'arxiu supera el màxim permès de 10MB." : "El archivo supera el máximo permitido de 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (owner === 'c1') setC1DniUrl(dataUrl);
        else setC2DniUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // Camera handlers
  const startCamera = async (owner: 'c1' | 'c2') => {
    setCameraOwner(owner);
    setVideoError(null);
    try {
      setCameraActive(true);
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: 'environment' } } 
          });
          streamRef.current = stream;
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = stream;
          }
        } catch (err: any) {
          setVideoError(language === 'ca' 
            ? "No s'ha pogut accedir a la càmera. Si us plau, pugeu un arxiu." 
            : "No se ha podido acceder a la cámara. Por favor, suba un archivo.");
        }
      }, 300);
    } catch {
      setVideoError(language === 'ca' ? "Error en iniciar vídeo." : "Error al iniciar vídeo.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraOwner(null);
  };

  const capturePhoto = () => {
    if (cameraVideoRef.current && canvasRef.current) {
      const video = cameraVideoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/webp');
        if (cameraOwner === 'c1') setC1DniUrl(dataUrl);
        else if (cameraOwner === 'c2') setC2DniUrl(dataUrl);
      }
      stopCamera();
    }
  };

  // Reset form completely
  const resetForm = () => {
    setCategoria(CategoriaParella.ADULT);
    setEmailContactoPareja('');
    setTelefonContactoPareja('');
    setC1Nom('');
    setC1Cognoms('');
    setC1DniUrl('');
    setC1EsMenor(false);
    setC1TutorNom('');
    setC1TutorCognoms('');
    setC1TutorDni('');
    setC1TutorTelefon('');
    setC1TutorAccepta(false);
    setC1Talla('M');
    setC1UniformeTipus('compra');

    setC2Nom('');
    setC2Cognoms('');
    setC2DniUrl('');
    setC2EsMenor(false);
    setC2TutorNom('');
    setC2TutorCognoms('');
    setC2TutorDni('');
    setC2TutorTelefon('');
    setC2TutorAccepta(false);
    setC2Talla('M');
    setC2UniformeTipus('compra');

    setSeleccionsUniforme(buildInitialUniformSelections());
    setExtrasSeleccionats({});
    setClavellsQty(0);
    setCorbatiQty(0);
    setRespostesCuestionari({});

    setModalEstatPagament('PENDENT');
    setModalMetodePagament(MetodePagament.EFECTIU);
    setPagoParcialImport('');
    setErrors({});
  };

  // Validation
  const validateModal = (): boolean => {
    const errs: Record<string, string> = {};

    if (!telefonContactoPareja.trim()) {
      errs.telefonContactoPareja = language === 'ca' ? "El telèfon de contacte és obligatori" : "El teléfono de contacto es obligatorio";
    }
    if (!emailContactoPareja.trim()) {
      errs.emailContactoPareja = language === 'ca' ? "El correu electrònic és obligatori" : "El correo electrónico es obligatorio";
    } else if (!emailContactoPareja.includes('@') || !emailContactoPareja.includes('.')) {
      errs.emailContactoPareja = language === 'ca' ? "El format del correu no és vàlid" : "El formato del correo no es válido";
    }

    if (!c1Nom.trim()) errs.c1Nom = language === 'ca' ? "El nom del primer participant és obligatori" : "El nombre del primer participante es obligatorio";
    if (!c1Cognoms.trim()) errs.c1Cognoms = language === 'ca' ? "Els cognoms del primer participant són obligatoris" : "Los apellidos del primer participante son obligatorios";

    if (c1EsMenor) {
      if (!c1TutorNom.trim()) errs.c1TutorNom = language === 'ca' ? "Nom del tutor obligatori" : "Nombre del tutor obligatorio";
      if (!c1TutorCognoms.trim()) errs.c1TutorCognoms = language === 'ca' ? "Cognoms del tutor obligatoris" : "Apellidos del tutor obligatorios";
      if (!c1TutorDni.trim()) errs.c1TutorDni = language === 'ca' ? "DNI del tutor obligatori" : "DNI del tutor obligatorio";
      if (!c1TutorTelefon.trim()) errs.c1TutorTelefon = language === 'ca' ? "Telèfon del tutor obligatori" : "Teléfono del tutor obligatorio";
      if (!c1TutorAccepta) errs.c1TutorAccepta = language === 'ca' ? "Cal marcar l'autorització del menor" : "Debe marcar la autorización del menor";
    }

    if (!c2Nom.trim()) errs.c2Nom = language === 'ca' ? "El nom del segon participant és obligatori" : "El nombre del segundo participante es obligatorio";
    if (!c2Cognoms.trim()) errs.c2Cognoms = language === 'ca' ? "Els cognoms del segon participant són obligatoris" : "Los apellidos del segundo participante son obligatorios";

    if (c2EsMenor) {
      if (!c2TutorNom.trim()) errs.c2TutorNom = language === 'ca' ? "Nom del tutor obligatori" : "Nombre del tutor obligatorio";
      if (!c2TutorCognoms.trim()) errs.c2TutorCognoms = language === 'ca' ? "Cognoms del tutor obligatoris" : "Apellidos del tutor obligatorios";
      if (!c2TutorDni.trim()) errs.c2TutorDni = language === 'ca' ? "DNI del tutor obligatori" : "DNI del tutor obligatorio";
      if (!c2TutorTelefon.trim()) errs.c2TutorTelefon = language === 'ca' ? "Telèfon del tutor obligatori" : "Teléfono del tutor obligatorio";
      if (!c2TutorAccepta) errs.c2TutorAccepta = language === 'ca' ? "Cal marcar l'autorització del menor" : "Debe marcar la autorización del menor";
    }

    // Dynamic questions validation
    if (config.cuestionariActiu !== false && preguntesList.length > 0) {
      preguntesList.filter(q => q.activa && q.requerit).forEach(q => {
        if (q.ambit === 'comparser') {
          for (const s of ['c1', 'c2'] as const) {
            if (!isPreguntaVisible(q, respostesCuestionari, preguntesList, s)) continue;
            const k = `${q.id}__${s}`;
            const val = respostesCuestionari[k];
            const errKey = `question_${k}`;
            if (q.tipus === 'text' && (val === undefined || val === null || String(val).trim() === '')) {
              errs[errKey] = language === 'ca' ? "Aquesta resposta és requerida" : "Esta respuesta es requerida";
            } else if (q.tipus === 'select' && (val === undefined || val === null || String(val).trim() === '')) {
              errs[errKey] = language === 'ca' ? "Seleccioneu una opció" : "Seleccione una opción";
            } else if (q.tipus === 'boolean' && !val) {
              errs[errKey] = language === 'ca' ? "Cal marcar aquesta casella" : "Debe marcar esta casilla";
            }
          }
        } else {
          if (!isPreguntaVisible(q, respostesCuestionari, preguntesList, 'parella')) return;
          const k = q.id;
          const val = respostesCuestionari[k];
          const errKey = `question_${k}`;
          if (q.tipus === 'text' && (val === undefined || val === null || String(val).trim() === '')) {
            errs[errKey] = language === 'ca' ? "Aquesta resposta és requerida" : "Esta respuesta es requerida";
          } else if (q.tipus === 'select' && (val === undefined || val === null || String(val).trim() === '')) {
            errs[errKey] = language === 'ca' ? "Seleccioneu una opció" : "Seleccione una opción";
          } else if (q.tipus === 'boolean' && !val) {
            errs[errKey] = language === 'ca' ? "Cal marcar aquesta casella" : "Debe marcar esta casilla";
          }
        }
      });
    }

    // Partial payment validation
    if (modalEstatPagament === 'PARCIAL') {
      const imp = parseImport(pagoParcialImport);
      if (imp === null || imp <= 0) {
        errs.pagoParcialImport = language === 'ca' ? "Introduïu un import vàlid major que 0" : "Introduzca un importe válido mayor que 0";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateModal()) {
      return;
    }

    // Prepare dynamic answers
    const finalRespostes: Record<string, string | boolean> = {
      ...visibleAnswers(respostesCuestionari, preguntesList)
    };
    if (clavellsQty > 0) finalRespostes['clavells_qty'] = String(clavellsQty);
    if (corbatiQty > 0) finalRespostes['corbati_qty'] = String(corbatiQty);

    // Prepare material list
    const extresGuardats: { id: string; nom: string; quantitat: number; preuUnitari: number; modalitat?: string }[] = [];
    if (orderBreakdown && orderBreakdown.materials) {
      orderBreakdown.materials.forEach(m => {
        extresGuardats.push({
          id: m.id,
          nom: m.nom,
          quantitat: m.quantitat,
          preuUnitari: m.preuUnitari,
          modalitat: m.modalitat
        });
      });
    }

    // Prepare payments
    let finalPagaments: PagamentRegistrat[] = [];
    let finalEstatPagament: EstatPagament = EstatPagament.PENDENT;
    let finalMetodePagament: MetodePagament | null = null;

    if (modalEstatPagament === 'PAGAT') {
      finalPagaments = [{
        id: 'pag-' + Math.random().toString(36).substr(2, 9),
        data: new Date().toISOString(),
        import: totalCalculat,
        metode: modalMetodePagament,
        nota: 'Alta manual a caixa'
      }];
      finalEstatPagament = EstatPagament.PAGAT;
      finalMetodePagament = modalMetodePagament;
    } else if (modalEstatPagament === 'PARCIAL') {
      const parsedPartial = parseImport(pagoParcialImport) || 0;
      if (parsedPartial > 0) {
        finalPagaments = [{
          id: 'pag-' + Math.random().toString(36).substr(2, 9),
          data: new Date().toISOString(),
          import: parsedPartial,
          metode: modalMetodePagament,
          nota: 'Alta manual a caixa'
        }];
        const pendent = Math.max(0, Math.round((totalCalculat - parsedPartial) * 100) / 100);
        finalEstatPagament = pendent <= 0.004 ? EstatPagament.PAGAT : EstatPagament.PENDENT;
        finalMetodePagament = modalMetodePagament;
      }
    }

    const isWaitlist = config.estatInscripcions === 'espera';

    const novaInscripcio: Inscripcio = {
      id: 'ins-' + Math.random().toString(36).substr(2, 9),
      codiSeguiment: '', // Assigned by allocateNextCode in App.tsx
      categoria,
      emailContactoPareja: emailContactoPareja.trim(),
      telefonContactoPareja: telefonContactoPareja.trim(),
      c1Nom: c1Nom.trim(),
      c1Cognoms: c1Cognoms.trim(),
      c1Email: emailContactoPareja.trim(),
      c1Telefon: telefonContactoPareja.trim(),
      c1Talla,
      c1DniUrl: c1DniUrl || '',
      c1EsMenor,
      c1TutorNom: c1EsMenor ? c1TutorNom.trim() : '',
      c1TutorCognoms: c1EsMenor ? c1TutorCognoms.trim() : '',
      c1TutorDni: c1EsMenor ? c1TutorDni.trim() : '',
      c1TutorTelefon: c1EsMenor ? c1TutorTelefon.trim() : '',
      c1UniformeTipus,
      c2Nom: c2Nom.trim(),
      c2Cognoms: c2Cognoms.trim(),
      c2Email: emailContactoPareja.trim(),
      c2Telefon: telefonContactoPareja.trim(),
      c2Talla,
      c2DniUrl: c2DniUrl || '',
      c2EsMenor,
      c2TutorNom: c2EsMenor ? c2TutorNom.trim() : '',
      c2TutorCognoms: c2EsMenor ? c2TutorCognoms.trim() : '',
      c2TutorDni: c2EsMenor ? c2TutorDni.trim() : '',
      c2TutorTelefon: c2EsMenor ? c2TutorTelefon.trim() : '',
      c2UniformeTipus,
      respostesCuestionari: finalRespostes,
      seleccionsUniforme,
      extresSeleccionats: extresGuardats,
      preuCalculat: totalCalculat,
      teDomasBalco: false,
      teMocadorsExtra: 0,
      videoWatched: true,
      pagaments: finalPagaments,
      estatPagament: finalEstatPagament,
      metodePagament: finalMetodePagament,
      estatDni: EstatVerificacio.PENDENT,
      entregaMaterial: EstatInscripcio.PENDENT,
      llistaEspera: isWaitlist,
      estatInscripcio: isWaitlist ? 'llista_espera' : 'obertes',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };

    onSave(novaInscripcio);
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Partial payment calculations for live preview
  const partialParsed = parseImport(pagoParcialImport) || 0;
  const partialPendent = Math.max(0, Math.round((totalCalculat - partialParsed) * 100) / 100);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-sm font-sans" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 space-y-6 text-zinc-900 relative animate-in fade-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-zinc-100">
          <div>
            <h3 className="font-sans font-black text-xl text-zinc-900 flex items-center gap-2 uppercase tracking-wide">
              <Plus size={22} className="text-[#ff0090]" /> 
              {language === 'ca' ? "Registre Manual de Parella" : "Registro Manual de Pareja"}
            </h3>
            <p className="text-xs text-zinc-500 font-mono">
              {language === 'ca' ? "Secretaria de l'Associació El Tast" : "Secretaría de la Asociación El Tast"} • {activeYear}
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition cursor-pointer"
            aria-label="Tancar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-xs text-zinc-800">
          {/* Category selection */}
          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
            <label className="block text-[11px] text-zinc-600 uppercase font-mono mb-2 font-bold">
              {language === 'ca' ? "Categoria de la Parella *" : "Categoría de la Pareja *"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer border transition-all ${categoria === CategoriaParella.ADULT ? 'bg-fuchsia-50/70 border-fuchsia-500 shadow-xs' : 'bg-white border-zinc-200 hover:bg-zinc-100/70'}`}>
                <input 
                  type="radio" 
                  name="modal-categoria" 
                  value={CategoriaParella.ADULT}
                  checked={categoria === CategoriaParella.ADULT}
                  onChange={() => setCategoria(CategoriaParella.ADULT)}
                  className="accent-fuchsia-600 w-4 h-4"
                />
                <div>
                  <p className="font-bold text-zinc-900 text-xs">
                    {language === 'ca' ? `Adults (${config.preuAdult}€)` : `Adultos (${config.preuAdult}€)`}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {language === 'ca' ? "A partir de 16 anys (o majors segons reglament)" : "A partir de 16 años (o mayores según reglamento)"}
                  </p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer border transition-all ${categoria === CategoriaParella.JUVENIL ? 'bg-fuchsia-50/70 border-fuchsia-500 shadow-xs' : 'bg-white border-zinc-200 hover:bg-zinc-100/70'}`}>
                <input 
                  type="radio" 
                  name="modal-categoria" 
                  value={CategoriaParella.JUVENIL}
                  checked={categoria === CategoriaParella.JUVENIL}
                  onChange={() => setCategoria(CategoriaParella.JUVENIL)}
                  className="accent-fuchsia-600 w-4 h-4"
                />
                <div>
                  <p className="font-bold text-zinc-900 text-xs">
                    {language === 'ca' ? `Juvenils (${config.preuJuvenil}€)` : `Juveniles (${config.preuJuvenil}€)`}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {language === 'ca' ? "Fins als 15 anys inclòs" : "Hasta los 15 años incluido"}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Couple Contact Info (Unique) */}
          <div className="p-4 bg-fuchsia-50/40 rounded-2xl border border-fuchsia-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-fuchsia-200/60">
              <h4 className="font-sans font-bold text-xs text-zinc-900 tracking-tight flex items-center gap-1.5">
                <Phone size={14} className="text-fuchsia-600" />
                {language === 'ca' ? 'Dades de Contacte de la Parella (Obligatòries)' : 'Datos de Contacto de la Pareja (Obligatorios)'}
              </h4>
              <span className="text-[9px] font-mono font-bold text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded-md">
                {language === 'ca' ? 'Comú per a la parella' : 'Común para la pareja'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-600 font-bold uppercase font-mono mb-1">
                  {language === 'ca' ? 'Telèfon de contacte *' : 'Teléfono de contacto *'}
                </label>
                <input 
                  type="tel" 
                  value={telefonContactoPareja}
                  onChange={(e) => {
                    setTelefonContactoPareja(e.target.value);
                    if (errors.telefonContactoPareja) {
                      setErrors(prev => {
                        const copy = { ...prev };
                        delete copy.telefonContactoPareja;
                        return copy;
                      });
                    }
                  }}
                  placeholder="Ex. 600123456"
                  className={`w-full bg-white border ${errors.telefonContactoPareja ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-fuchsia-500'} rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none transition-all`}
                />
                {errors.telefonContactoPareja && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">{errors.telefonContactoPareja}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-zinc-600 font-bold uppercase font-mono mb-1">
                  {language === 'ca' ? 'Correu electrònic *' : 'Correo electrónico *'}
                </label>
                <input 
                  type="email" 
                  value={emailContactoPareja}
                  onChange={(e) => {
                    setEmailContactoPareja(e.target.value);
                    if (errors.emailContactoPareja) {
                      setErrors(prev => {
                        const copy = { ...prev };
                        delete copy.emailContactoPareja;
                        return copy;
                      });
                    }
                  }}
                  placeholder="Ex. parella@example.com"
                  className={`w-full bg-white border ${errors.emailContactoPareja ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-fuchsia-500'} rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none transition-all`}
                />
                {errors.emailContactoPareja && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">{errors.emailContactoPareja}</p>
                )}
              </div>
            </div>
          </div>

          {/* Comparser Cards (Participant 1 and Participant 2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ComparserCard 
              num={1}
              nom={c1Nom}
              setNom={setC1Nom}
              cognoms={c1Cognoms}
              setCognoms={setC1Cognoms}
              dniUrl={c1DniUrl}
              setDniUrl={setC1DniUrl}
              esMenor={c1EsMenor}
              setEsMenor={setC1EsMenor}
              tutorNom={c1TutorNom}
              setTutorNom={setC1TutorNom}
              tutorCognoms={c1TutorCognoms}
              setTutorCognoms={setC1TutorCognoms}
              tutorDni={c1TutorDni}
              setTutorDni={setC1TutorDni}
              tutorTelefon={c1TutorTelefon}
              setTutorTelefon={setC1TutorTelefon}
              tutorAccepta={c1TutorAccepta}
              setTutorAccepta={setC1TutorAccepta}
              seleccionsUniforme={seleccionsUniforme}
              setSeleccionsUniforme={setSeleccionsUniforme}
              setTallaBackwards={setC1Talla}
              setUniformeTipusBackwards={setC1UniformeTipus}
              extrasSeleccionats={extrasSeleccionats}
              setExtrasSeleccionats={setExtrasSeleccionats}
              isNameDuplicate={false}
              errors={errors}
              config={config}
              handleFileUpload={handleFileUpload}
              startCamera={startCamera}
            />

            <ComparserCard 
              num={2}
              nom={c2Nom}
              setNom={setC2Nom}
              cognoms={c2Cognoms}
              setCognoms={setC2Cognoms}
              dniUrl={c2DniUrl}
              setDniUrl={setC2DniUrl}
              esMenor={c2EsMenor}
              setEsMenor={setC2EsMenor}
              tutorNom={c2TutorNom}
              setTutorNom={setC2TutorNom}
              tutorCognoms={c2TutorCognoms}
              setTutorCognoms={setC2TutorCognoms}
              tutorDni={c2TutorDni}
              setTutorDni={setC2TutorDni}
              tutorTelefon={c2TutorTelefon}
              setTutorTelefon={setC2TutorTelefon}
              tutorAccepta={c2TutorAccepta}
              setTutorAccepta={setC2TutorAccepta}
              seleccionsUniforme={seleccionsUniforme}
              setSeleccionsUniforme={setSeleccionsUniforme}
              setTallaBackwards={setC2Talla}
              setUniformeTipusBackwards={setC2UniformeTipus}
              extrasSeleccionats={extrasSeleccionats}
              setExtrasSeleccionats={setExtrasSeleccionats}
              isNameDuplicate={false}
              errors={errors}
              config={config}
              handleFileUpload={handleFileUpload}
              startCamera={startCamera}
            />
          </div>

          {/* Dynamic Questions & Breakfast block */}
          <DynamicQuestionsSection 
            preguntesList={preguntesList}
            respostesCuestionari={respostesCuestionari}
            onAnswerChange={handleDynamicAnswerChange}
            errors={errors}
            c1Nom={c1Nom}
            c1Cognoms={c1Cognoms}
            c2Nom={c2Nom}
            c2Cognoms={c2Cognoms}
            titolFormulariDinamic={config.titolFormulariDinamic}
            cuestionariActiu={config.cuestionariActiu}
          />

          {/* Optional Complementary Extras (Clavells and Corbatí) */}
          <div className="bg-zinc-900 text-white rounded-3xl p-5 border border-zinc-800 space-y-4">
            <div className="border-b border-zinc-800 pb-2">
              <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-[#ff0090]">
                {language === 'ca' ? "Complements de Comparsa" : "Complementos de Comparsa"}
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {language === 'ca' ? "Opcional: afegiu clavells o corbatí segons desitgi la parella." : "Opcional: añada claveles o pajarita según desee la pareja."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Clavells */}
              <div className={`p-3.5 rounded-2xl border transition-all ${clavellsQty > 0 ? 'bg-[#ff0090]/15 border-[#ff0090]' : 'bg-zinc-950 border-zinc-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-white">{clavellsNom}</span>
                  <span className="text-xs font-mono font-bold text-[#ff0090]">{clavellsPrice.toFixed(2)}€/u.</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <span className="text-[11px] text-zinc-400 font-bold">{language === 'ca' ? "Quantitat:" : "Cantidad:"}</span>
                  <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setClavellsQty(Math.max(0, clavellsQty - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-xs text-white">{clavellsQty}</span>
                    <button
                      type="button"
                      onClick={() => setClavellsQty(clavellsQty + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Corbatí */}
              <div className={`p-3.5 rounded-2xl border transition-all ${corbatiQty > 0 ? 'bg-[#ff0090]/15 border-[#ff0090]' : 'bg-zinc-950 border-zinc-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-white">{corbatiNom}</span>
                  <span className="text-xs font-mono font-bold text-[#ff0090]">{corbatiPrice.toFixed(2)}€/u.</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <span className="text-[11px] text-zinc-400 font-bold">{language === 'ca' ? "Quantitat:" : "Cantidad:"}</span>
                  <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setCorbatiQty(Math.max(0, corbatiQty - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-xs text-white">{corbatiQty}</span>
                    <button
                      type="button"
                      onClick={() => setCorbatiQty(corbatiQty + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Settlement Selection */}
          <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-4">
            <div className="border-b border-zinc-200 pb-2">
              <h4 className="font-bold text-xs text-zinc-900 uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard size={15} className="text-[#ff0090]" />
                {language === 'ca' ? "Estat del Pagament i Liquidació a Caixa" : "Estado del Pago y Liquidación en Caja"}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${modalEstatPagament === 'PENDENT' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20' : 'bg-white border-zinc-200'}`}>
                <input 
                  type="radio" 
                  name="modal-estat-pagament"
                  value="PENDENT"
                  checked={modalEstatPagament === 'PENDENT'}
                  onChange={() => setModalEstatPagament('PENDENT')}
                  className="accent-amber-600"
                />
                <div>
                  <span className="block font-bold text-xs text-zinc-900">
                    {language === 'ca' ? "Pendent de Pagament" : "Pendiente de Pago"}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {language === 'ca' ? "Sense cobrament inicial" : "Sin cobro inicial"}
                  </span>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${modalEstatPagament === 'PARCIAL' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-zinc-200'}`}>
                <input 
                  type="radio" 
                  name="modal-estat-pagament"
                  value="PARCIAL"
                  checked={modalEstatPagament === 'PARCIAL'}
                  onChange={() => setModalEstatPagament('PARCIAL')}
                  className="accent-blue-600"
                />
                <div>
                  <span className="block font-bold text-xs text-zinc-900">
                    {language === 'ca' ? "Pagament Parcial" : "Pago Parcial"}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {language === 'ca' ? "Entrega a compte" : "Entrega a cuenta"}
                  </span>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${modalEstatPagament === 'PAGAT' ? 'bg-green-50 border-green-500 ring-2 ring-green-500/20' : 'bg-white border-zinc-200'}`}>
                <input 
                  type="radio" 
                  name="modal-estat-pagament"
                  value="PAGAT"
                  checked={modalEstatPagament === 'PAGAT'}
                  onChange={() => setModalEstatPagament('PAGAT')}
                  className="accent-green-600"
                />
                <div>
                  <span className="block font-bold text-xs text-zinc-900">
                    {language === 'ca' ? "Pagat Totalment" : "Pagado Totalmente"}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {language === 'ca' ? "Liquidat al 100%" : "Liquidado al 100%"}
                  </span>
                </div>
              </label>
            </div>

            {/* If paid or partial: method of payment */}
            {modalEstatPagament !== 'PENDENT' && (
              <div className="pt-3 border-t border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1 font-bold">
                    {language === 'ca' ? "Mètode de Cobrament *" : "Método de Cobro *"}
                  </label>
                  <select
                    value={modalMetodePagament}
                    onChange={(e) => setModalMetodePagament(e.target.value as MetodePagament)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value={MetodePagament.EFECTIU}>{language === 'ca' ? "Efectiu a secretaria" : "Efectivo en secretaría"}</option>
                    <option value={MetodePagament.BIZUM}>{language === 'ca' ? "Bizum a caixa" : "Bizum en caja"}</option>
                  </select>
                </div>

                {modalEstatPagament === 'PARCIAL' && (
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1 font-bold">
                      {language === 'ca' ? "Import Cobrat a Compte (€) *" : "Importe Cobrado a Cuenta (€) *"}
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={pagoParcialImport}
                        onChange={(e) => {
                          setPagoParcialImport(e.target.value);
                          if (errors.pagoParcialImport) {
                            setErrors(prev => {
                              const copy = { ...prev };
                              delete copy.pagoParcialImport;
                              return copy;
                            });
                          }
                        }}
                        placeholder="Ex. 30"
                        className={`w-full bg-white border ${errors.pagoParcialImport ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-blue-500'} rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                      />
                      <span className="absolute right-3 top-2 font-mono text-zinc-400 text-xs">€</span>
                    </div>
                    {errors.pagoParcialImport && (
                      <p className="text-[10px] text-red-500 font-bold mt-1">{errors.pagoParcialImport}</p>
                    )}

                    {/* Automatic remaining balance display */}
                    <div className="mt-2 p-2 bg-blue-50/80 rounded-xl border border-blue-200/80 flex justify-between items-center text-[11px] font-mono">
                      <span className="text-blue-900 font-semibold">{language === 'ca' ? "Pendent restant:" : "Pendiente restante:"}</span>
                      <span className="font-black text-blue-950">{formatEuro(partialPendent)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Order Breakdown Summary */}
          <div className="p-5 bg-zinc-950 text-white rounded-3xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Receipt size={14} className="text-[#ff0090]" />
                {language === 'ca' ? "Desglossament del Total en Viu" : "Desglose del Total en Vivo"}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {language === 'ca' ? "Càlcul Oficial de Comanda" : "Cálculo Oficial de Pedido"}
              </span>
            </div>

            {/* Materials and items */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span>
                  {categoria === CategoriaParella.ADULT 
                    ? (language === 'ca' ? "Quota Parella Adulta" : "Cuota Pareja Adulta")
                    : (language === 'ca' ? "Quota Parella Juvenil" : "Cuota Pareja Juvenil")}
                </span>
                <span className="font-mono font-semibold">
                  {categoria === CategoriaParella.ADULT ? config.preuAdult : config.preuJuvenil}€
                </span>
              </div>

              {orderBreakdown?.materials.map((m, idx) => (
                <div key={m.id + idx} className="flex justify-between items-center text-zinc-400 text-[11px]">
                  <span className="truncate pr-2">
                    {m.quantitat > 1 ? `${m.quantitat}x ` : ''}{m.nom}
                  </span>
                  <span className="font-mono shrink-0">
                    {m.subtotal > 0 ? `+${m.subtotal.toFixed(2)}€` : '0.00€'}
                  </span>
                </div>
              ))}
            </div>

            {/* Final Total Bar */}
            <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <span className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wide">
                  {language === 'ca' ? "Total de la Inscripció" : "Total de la Inscripción"}
                </span>
                <span className="font-sans font-black text-2xl text-[#ff0090]">
                  {formatEuro(totalCalculat)}
                </span>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 font-bold border border-zinc-700 text-zinc-300 rounded-xl transition cursor-pointer text-xs"
                >
                  {language === 'ca' ? "Cancel·lar" : "Cancelar"}
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-[#ff0090] text-black hover:bg-[#ff0090]/90 font-black rounded-xl transition-all shadow-lg hover:shadow-[#ff0090]/30 active:scale-95 uppercase tracking-wider text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus size={16} />
                  {language === 'ca' ? "Donar d'Alta Parella" : "Dar de Alta Pareja"}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Camera Modal Overlay if active */}
        {cameraActive && (
          <div className="fixed inset-0 bg-black/90 z-60 flex flex-col items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 max-w-lg w-full space-y-4 text-center">
              <h4 className="font-bold text-white text-sm">
                {language === 'ca' ? `Captura DNI - Participant ${cameraOwner === 'c1' ? '1' : '2'}` : `Captura DNI - Participante ${cameraOwner === 'c1' ? '1' : '2'}`}
              </h4>

              {videoError ? (
                <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 text-xs rounded-xl">
                  {videoError}
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                  <video ref={cameraVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition"
                >
                  {language === 'ca' ? "Tancar" : "Cerrar"}
                </button>
                {!videoError && (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-5 py-2 bg-[#ff0090] text-black font-black rounded-xl text-xs transition"
                  >
                    {language === 'ca' ? "Fer Foto" : "Hacer Foto"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
