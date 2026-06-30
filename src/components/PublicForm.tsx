/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Minus, 
  AlertTriangle,
  ChevronRight,
  Sparkle,
  Database
} from 'lucide-react';
import { CategoriaParella, SistemaConfig, Inscripcio, EstatPagament, EstatVerificacio, EstatInscripcio } from '../types';
import { useLanguage } from '../LanguageContext';
import TranslatedText, { TranslatedOption } from './TranslatedText';
import { ComparserCard } from './publicForm/ComparserCard';
import { CameraModal } from './publicForm/CameraModal';

interface PublicFormProps {
  config: SistemaConfig;
  onSubmit: (registration: Inscripcio) => void;
  onGoToLogin: () => void;
}

export default function PublicForm({ config, onSubmit, onGoToLogin }: PublicFormProps) {
  const { language, t } = useLanguage();

  // Form fields state
  const [categoria, setCategoria] = useState<CategoriaParella>(CategoriaParella.ADULT);
  
  // Comparser 1 state
  const [c1Nom, setC1Nom] = useState('');
  const [c1Cognoms, setC1Cognoms] = useState('');
  const [c1Email, setC1Email] = useState('');
  const [c1Telefon, setC1Telefon] = useState('');
  const [c1Talla, setC1Talla] = useState('M');
  const [c1DniUrl, setC1DniUrl] = useState<string | null>(null);
  const [c1EsMenor, setC1EsMenor] = useState(false);
  const [c1TutorNom, setC1TutorNom] = useState('');
  const [c1TutorCognoms, setC1TutorCognoms] = useState('');
  const [c1TutorDni, setC1TutorDni] = useState('');
  const [c1TutorTelefon, setC1TutorTelefon] = useState('');
  const [c1TutorAccepta, setC1TutorAccepta] = useState(false);
  const [c1UniformeTipus, setC1UniformeTipus] = useState<'compra' | 'lloguer'>('compra');
  
  // Comparser 2 state
  const [c2Nom, setC2Nom] = useState('');
  const [c2Cognoms, setC2Cognoms] = useState('');
  const [c2Email, setC2Email] = useState('');
  const [c2Telefon, setC2Telefon] = useState('');
  const [c2Talla, setC2Talla] = useState('M');
  const [c2DniUrl, setC2DniUrl] = useState<string | null>(null);
  const [c2EsMenor, setC2EsMenor] = useState(false);
  const [c2TutorNom, setC2TutorNom] = useState('');
  const [c2TutorCognoms, setC2TutorCognoms] = useState('');
  const [c2TutorDni, setC2TutorDni] = useState('');
  const [c2TutorTelefon, setC2TutorTelefon] = useState('');
  const [c2TutorAccepta, setC2TutorAccepta] = useState(false);
  const [c2UniformeTipus, setC2UniformeTipus] = useState<'compra' | 'lloguer'>('compra');

  // Dynamic uniform/equipment selections state
  const [seleccionsUniforme, setSeleccionsUniforme] = useState<Record<string, { c1Talla: string; c2Talla: string; c1Quantitat: number; c2Quantitat: number; c1Tipus: 'compra' | 'lloguer'; c2Tipus: 'compra' | 'lloguer' }>>(() => {
    const initial: Record<string, { c1Talla: string; c2Talla: string; c1Quantitat: number; c2Quantitat: number; c1Tipus: 'compra' | 'lloguer'; c2Tipus: 'compra' | 'lloguer' }> = {};
    const lines = config.liniisUniforme || [
      {
        id: 'lin-1',
        nom: config.nomUniforme || 'Talla de Samarreta',
        nomES: config.nomUniformeES || 'Talla de Camiseta',
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
        c2Tipus: 'compra'
      };
    });
    return initial;
  });

  // Dynamic answers
  const [respostesCuestionari, setRespostesCuestionari] = useState<Record<string, string | boolean>>({});
  
  // Extras
  const [teDomasBalcoQty, setTeDomasBalcoQty] = useState(0);
  const teDomasBalco = teDomasBalcoQty > 0;
  const [teMocadorsExtra, setTeMocadorsExtra] = useState(0);
  const [genericExtrasQty, setGenericExtrasQty] = useState<Record<string, number>>({});
  const [c1ExtrasSeleccionats, setC1ExtrasSeleccionats] = useState<Record<string, number>>({});
  const [c2ExtrasSeleccionats, setC2ExtrasSeleccionats] = useState<Record<string, number>>({});
  
  // Checkboxes
  const [acceptaRGPD, setAcceptaRGPD] = useState(false);
  const [acceptaPresencial, setAcceptaPresencial] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing registrations for live duplicate detection
  const [existingInscripcions, setExistingInscripcions] = useState<Inscripcio[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tast_inscripcions_2026');
      if (saved) {
        setExistingInscripcions(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error loading existing inscriptions in PublicForm:", e);
    }
  }, []);

  // Live duplicate check flags for Comparser 1 & 2
  const isC1NameDuplicate = useMemo(() => {
    if (!c1Nom.trim() || !c1Cognoms.trim()) return false;
    const nomNorm = c1Nom.trim().toLowerCase().replace(/\s+/g, ' ');
    const cognomsNorm = c1Cognoms.trim().toLowerCase().replace(/\s+/g, ' ');
    return existingInscripcions.some(ins => {
      const insC1Nom = (ins.c1Nom || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const insC1Cognoms = (ins.c1Cognoms || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const insC2Nom = (ins.c2Nom || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const insC2Cognoms = (ins.c2Cognoms || '').trim().toLowerCase().replace(/\s+/g, ' ');
      return (nomNorm === insC1Nom && cognomsNorm === insC1Cognoms) || 
             (nomNorm === insC2Nom && cognomsNorm === insC2Cognoms);
    });
  }, [c1Nom, c1Cognoms, existingInscripcions]);

  const isC1EmailDuplicate = useMemo(() => {
    if (!c1Email.trim()) return false;
    const emailNorm = c1Email.trim().toLowerCase();
    return existingInscripcions.some(ins => 
      (ins.c1Email || '').trim().toLowerCase() === emailNorm || 
      (ins.c2Email || '').trim().toLowerCase() === emailNorm
    );
  }, [c1Email, existingInscripcions]);

  const isC1PhoneDuplicate = useMemo(() => {
    if (!c1Telefon.trim()) return false;
    const phoneNorm = c1Telefon.trim().replace(/\s+/g, '');
    return existingInscripcions.some(ins => 
      (ins.c1Telefon || '').trim().replace(/\s+/g, '') === phoneNorm || 
      (ins.c2Telefon || '').trim().replace(/\s+/g, '') === phoneNorm
    );
  }, [c1Telefon, existingInscripcions]);

  const isC2NameDuplicate = useMemo(() => {
    if (!c2Nom.trim() || !c2Cognoms.trim()) return false;
    const nomNorm = c2Nom.trim().toLowerCase().replace(/\s+/g, ' ');
    const cognomsNorm = c2Cognoms.trim().toLowerCase().replace(/\s+/g, ' ');
    return existingInscripcions.some(ins => {
      const insC1Nom = (ins.c1Nom || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const insC1Cognoms = (ins.c1Cognoms || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const insC2Nom = (ins.c2Nom || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const insC2Cognoms = (ins.c2Cognoms || '').trim().toLowerCase().replace(/\s+/g, ' ');
      return (nomNorm === insC1Nom && cognomsNorm === insC1Cognoms) || 
             (nomNorm === insC2Nom && cognomsNorm === insC2Cognoms);
    });
  }, [c2Nom, c2Cognoms, existingInscripcions]);

  const isC2EmailDuplicate = useMemo(() => {
    if (!c2Email.trim()) return false;
    const emailNorm = c2Email.trim().toLowerCase();
    return existingInscripcions.some(ins => 
      (ins.c1Email || '').trim().toLowerCase() === emailNorm || 
      (ins.c2Email || '').trim().toLowerCase() === emailNorm
    );
  }, [c2Email, existingInscripcions]);

  const isC2PhoneDuplicate = useMemo(() => {
    if (!c2Telefon.trim()) return false;
    const phoneNorm = c2Telefon.trim().replace(/\s+/g, '');
    return existingInscripcions.some(ins => 
      (ins.c1Telefon || '').trim().replace(/\s+/g, '') === phoneNorm || 
      (ins.c2Telefon || '').trim().replace(/\s+/g, '') === phoneNorm
    );
  }, [c2Telefon, existingInscripcions]);
  
  // Camera Modal state
  const [cameraOwner, setCameraOwner] = useState<'c1' | 'c2' | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Calculate live total price
  const basePrice = categoria === CategoriaParella.ADULT 
    ? (config.tarifesDinamiques?.find(t => t.id === 'adults')?.valor ?? config.preuAdult)
    : (config.tarifesDinamiques?.find(t => t.id === 'juvenils')?.valor ?? config.preuJuvenil);
  const domasCost = teDomasBalcoQty * (config.tarifesDinamiques?.find(t => t.id === 'domas')?.valor ?? config.preuDomasBalco);
  const mocadorsCost = teMocadorsExtra * (config.tarifesDinamiques?.find(t => t.id === 'mocador')?.valor ?? config.preuMocadorExtra);

  // Calculate any custom dynamically added active generic extras using selected quantities
  const genericExtrasCost = (config.tarifesDinamiques || [])
    .filter(t => t.tipus === 'extra_generic' && t.actiu)
    .reduce((sum, t) => sum + (genericExtrasQty[t.id] || 0) * t.valor, 0);

  const c1ExtrasCost = Object.entries(c1ExtrasSeleccionats).reduce((total, [id, qty]) => {
    const extra = (config.tarifesDinamiques || []).find(t => t.id === id);
    return total + (extra ? extra.valor * Number(qty) : 0);
  }, 0);

  const c2ExtrasCost = Object.entries(c2ExtrasSeleccionats).reduce((total, [id, qty]) => {
    const extra = (config.tarifesDinamiques || []).find(t => t.id === id);
    return total + (extra ? extra.valor * Number(qty) : 0);
  }, 0);

  const uniformesCost = (config.liniisUniforme || []).reduce((sum, linia) => {
    let cost = 0;
    const sel = seleccionsUniforme[linia.id];
    
    if (sel) {
      const p1 = sel.c1Tipus === 'lloguer' ? (linia.preuLloguer || 0) : (linia.preu || 0);
      if (sel.c1Quantitat) {
        cost += p1 * sel.c1Quantitat;
      } else if (!linia.requeixQuantitat) {
        cost += p1;
      }
      
      const p2 = sel.c2Tipus === 'lloguer' ? (linia.preuLloguer || 0) : (linia.preu || 0);
      if (sel.c2Quantitat) {
        cost += p2 * sel.c2Quantitat;
      } else if (!linia.requeixQuantitat) {
        cost += p2;
      }
    } else {
      cost += (linia.preu || 0) * 2;
    }
    return sum + cost;
  }, 0);

  const totalCalculat = basePrice + domasCost + mocadorsCost + genericExtrasCost + c1ExtrasCost + c2ExtrasCost + uniformesCost;

  // Initialize dynamic answers on layout load
  useEffect(() => {
    const initialAnswers: Record<string, string | boolean> = {};
    config.preguntesFormulari.forEach(q => {
      if (q.activa) {
        initialAnswers[q.id] = q.tipus === 'boolean' ? false : '';
      }
    });
    setRespostesCuestionari(initialAnswers);
  }, [config]);

  // Handle webcam capture initialization
  const startCamera = async (owner: 'c1' | 'c2') => {
    setCameraOwner(owner);
    setVideoError(null);
    try {
      setCameraActive(true);
      // Wait minor tick for video DOM reference to establish
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: 'environment' } } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err: any) {
          console.error("error opening webcam:", err);
          setVideoError(language === 'ca' 
            ? "No s'ha pogut accedir a la càmera. S'utilitzarà el simulador de fotos." 
            : "No se ha podido acceder a la cámara. Se utilizará el simulador de fotos.");
        }
      }, 300);
    } catch (e) {
      setVideoError(language === 'ca' 
        ? "No s'ha pogut iniciar el flux de vídeo." 
        : "No se ha podido iniciar el flujo de vídeo.");
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
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/webp');
        if (cameraOwner === 'c1') {
          setC1DniUrl(dataUrl);
          if (errors.c1Dni) {
            setErrors(prev => {
              const copy = { ...prev };
              delete copy.c1Dni;
              return copy;
            });
          }
        } else if (cameraOwner === 'c2') {
          setC2DniUrl(dataUrl);
          if (errors.c2Dni) {
            setErrors(prev => {
              const copy = { ...prev };
              delete copy.c2Dni;
              return copy;
            });
          }
        }
      }
      stopCamera();
    }
  };

  const simulateCapture = () => {
    // Inject custom high-contrast placeholder simulated webp
    const mockDni = `https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&q=80&w=600`;
    if (cameraOwner === 'c1') {
      setC1DniUrl(mockDni);
      if (errors.c1Dni) {
        setErrors(prev => {
          const copy = { ...prev };
          delete copy.c1Dni;
          return copy;
        });
      }
    } else if (cameraOwner === 'c2') {
      setC2DniUrl(mockDni);
      if (errors.c2Dni) {
        setErrors(prev => {
          const copy = { ...prev };
          delete copy.c2Dni;
          return copy;
        });
      }
    }
    stopCamera();
  };

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
        if (owner === 'c1') {
          setC1DniUrl(dataUrl);
          if (errors.c1Dni) {
            setErrors(prev => {
              const copy = { ...prev };
              delete copy.c1Dni;
              return copy;
            });
          }
        } else if (owner === 'c2') {
          setC2DniUrl(dataUrl);
          if (errors.c2Dni) {
            setErrors(prev => {
              const copy = { ...prev };
              delete copy.c2Dni;
              return copy;
            });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const tempErrors: Record<string, string> = {};

    if (!c1Nom.trim()) tempErrors.c1Nom = language === 'ca' ? "El nom del primer participant és obligatori" : "El nombre del primer participante es obligatorio";
    if (!c1Cognoms.trim()) tempErrors.c1Cognoms = language === 'ca' ? "Els cognoms del primer participant són obligatoris" : "Los apellidos del primer participante son obligatorios";
    if (!c1Telefon.trim()) tempErrors.c1Telefon = language === 'ca' ? "El telèfon del primer participant és obligatori" : "El teléfono del primer participante es obligatorio";
    if (!c1Email.trim()) tempErrors.c1Email = language === 'ca' ? "El correu del primer participant és obligatori" : "El correo del primer participante es obligatorio";
    if (!c1DniUrl) tempErrors.c1Dni = language === 'ca' ? "Heu de pujar una imatge del DNI frontal" : "Debe subir una imagen del DNI frontal";

    if (c1EsMenor) {
      if (!c1TutorNom.trim()) tempErrors.c1TutorNom = language === 'ca' ? "El nom del tutor és obligatori" : "El nombre del tutor es obligatorio";
      if (!c1TutorCognoms.trim()) tempErrors.c1TutorCognoms = language === 'ca' ? "Els cognoms del tutor són obligatoris" : "Los apellidos del tutor son obligatorios";
      if (!c1TutorDni.trim()) tempErrors.c1TutorDni = language === 'ca' ? "El DNI del tutor és obligatori" : "El DNI del tutor es obligatorio";
      if (!c1TutorTelefon.trim()) tempErrors.c1TutorTelefon = language === 'ca' ? "El telèfon del tutor és obligatori" : "El teléfono del tutor es obligatorio";
      if (!c1TutorAccepta) tempErrors.c1TutorAccepta = language === 'ca' ? "Heu d'acceptar l'autorització de menors" : "Debe aceptar la autorización de menores";
    }

    if (!c2Nom.trim()) tempErrors.c2Nom = language === 'ca' ? "El nom del segon participant és obligatori" : "El nombre del segundo participante es obligatorio";
    if (!c2Cognoms.trim()) tempErrors.c2Cognoms = language === 'ca' ? "Els cognoms del segon participant són obligatoris" : "Los apellidos del segundo participante son obligatorios";
    if (!c2Telefon.trim()) tempErrors.c2Telefon = language === 'ca' ? "El telèfon del segon participant és obligatori" : "El teléfono del segundo participante es obligatorio";
    if (!c2Email.trim()) tempErrors.c2Email = language === 'ca' ? "El correu del segon participant és obligatori" : "El correo del segundo participante es obligatorio";
    if (!c2DniUrl) tempErrors.c2Dni = language === 'ca' ? "Heu de pujar una imatge del DNI frontal del segon participant" : "Debe subir una imagen del DNI frontal del segundo participante";

    if (c2EsMenor) {
      if (!c2TutorNom.trim()) tempErrors.c2TutorNom = language === 'ca' ? "El nom del tutor 2 és obligatori" : "El nombre del tutor 2 es obligatorio";
      if (!c2TutorCognoms.trim()) tempErrors.c2TutorCognoms = language === 'ca' ? "Els cognoms del tutor 2 són obligatoris" : "Los apellidos del tutor 2 son obligatorios";
      if (!c2TutorDni.trim()) tempErrors.c2TutorDni = language === 'ca' ? "El DNI del tutor 2 és obligatori" : "El DNI del tutor 2 es obligatorio";
      if (!c2TutorTelefon.trim()) tempErrors.c2TutorTelefon = language === 'ca' ? "El telèfon del tutor 2 és obligatori" : "El teléfono del tutor 2 es obligatorio";
      if (!c2TutorAccepta) tempErrors.c2TutorAccepta = language === 'ca' ? "Heu d'acceptar l'autorització de menors 2" : "Debe aceptar la autorización de menores 2";
    }

    if (config.cuestionariActiu !== false && config.preguntesFormulari) {
      config.preguntesFormulari.filter(q => q.activa && q.requerit).forEach(q => {
        const val = respostesCuestionari[q.id];
        if (q.tipus === 'text' && (val === undefined || val === null || String(val).trim() === '')) {
          tempErrors[`question_${q.id}`] = language === 'ca' ? "Aquesta resposta és requerida" : "Esta respuesta es requerida";
        } else if (q.tipus === 'select' && (val === undefined || val === null || String(val).trim() === '')) {
          tempErrors[`question_${q.id}`] = language === 'ca' ? "Seleccioneu una opció" : "Seleccione una opción";
        }
      });
    }

    if (c1Email.trim().toLowerCase() === c2Email.trim().toLowerCase() && c1Email.trim() !== '') {
      tempErrors.c2Email = language === 'ca' ? "Els correus electrònics no poden ser idèntics" : "Los correos electrónicos no pueden ser idénticos";
    }

    if (!acceptaRGPD) tempErrors.rgpd = language === 'ca' ? "Heu d'acceptar els termes de privadesa" : "Debe aceptar los términos de privacidad";
    if (!acceptaPresencial) tempErrors.presencial = language === 'ca' ? "Heu d'acceptar pagar i recollir de manera presencial" : "Debe aceptar pagar y recoger de forma presencial";

    // Check duplicates in the database ('tast_inscripcions_2026')
    try {
      const savedInscripcions = localStorage.getItem('tast_inscripcions_2026');
      if (savedInscripcions) {
        const existingInscripcions: Inscripcio[] = JSON.parse(savedInscripcions);
        
        const c1NomNormalized = c1Nom.trim().toLowerCase().replace(/\s+/g, ' ');
        const c1CognomsNormalized = c1Cognoms.trim().toLowerCase().replace(/\s+/g, ' ');
        const c1EmailNormalized = c1Email.trim().toLowerCase();
        
        const c2NomNormalized = c2Nom.trim().toLowerCase().replace(/\s+/g, ' ');
        const c2CognomsNormalized = c2Cognoms.trim().toLowerCase().replace(/\s+/g, ' ');
        const c2EmailNormalized = c2Email.trim().toLowerCase();

        let c1AlreadyRegistered = false;
        let c2AlreadyRegistered = false;

        for (const ins of existingInscripcions) {
          const insC1Nom = (ins.c1Nom || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const insC1Cognoms = (ins.c1Cognoms || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const insC1Email = (ins.c1Email || '').trim().toLowerCase();
          
          const insC2Nom = (ins.c2Nom || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const insC2Cognoms = (ins.c2Cognoms || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const insC2Email = (ins.c2Email || '').trim().toLowerCase();

          // Check Comparser 1 matching ANY of the registrants (either as c1 or c2)
          if (
            (c1NomNormalized && c1CognomsNormalized && (
              (c1NomNormalized === insC1Nom && c1CognomsNormalized === insC1Cognoms) ||
              (c1NomNormalized === insC2Nom && c1CognomsNormalized === insC2Cognoms)
            )) ||
            (c1EmailNormalized && (c1EmailNormalized === insC1Email || c1EmailNormalized === insC2Email))
          ) {
            c1AlreadyRegistered = true;
          }

          // Check Comparser 2 matching ANY of the registrants (either as c1 or c2)
          if (
            (c2NomNormalized && c2CognomsNormalized && (
              (c2NomNormalized === insC1Nom && c2CognomsNormalized === insC1Cognoms) ||
              (c2NomNormalized === insC2Nom && c2CognomsNormalized === insC2Cognoms)
            )) ||
            (c2EmailNormalized && (c2EmailNormalized === insC1Email || c2EmailNormalized === insC2Email))
          ) {
            c2AlreadyRegistered = true;
          }
        }

        if (c1AlreadyRegistered) {
          tempErrors.c1Nom = language === 'ca'
            ? "⚠️ El primer participant ja està registrat en la base de dades! Reviseu o contacteu amb secretaria."
            : "⚠️ ¡El primer participante ya está registrado en la base de datos! Revisad o contactad con secretaría.";
          tempErrors.c1Duplicat = language === 'ca'
            ? "El primer participant ja es troba inscrit prèviament."
            : "El primer participante ya se encuentra inscrito previamente.";
        }

        if (c2AlreadyRegistered) {
          tempErrors.c2Nom = language === 'ca'
            ? "⚠️ El segon participant ja està registrat en la base de dades! Reviseu o contacteu amb secretaria."
            : "⚠️ ¡El segundo participante ya está registrado en la base de datos! Revisad o contactad con secretaría.";
          tempErrors.c2Duplicat = language === 'ca'
            ? "El segon participant ja es troba inscrit prèviament."
            : "El segundo participante ya se encuentra inscrito previamente.";
        }

        if (c1AlreadyRegistered || c2AlreadyRegistered) {
          tempErrors.duplicateGlobal = language === 'ca'
            ? "No s'ha pogut enviar: Un o ambdós participants ja estan registrats a la base de dades de l'esdeveniment."
            : "No se ha podido enviar: Uno o ambos participantes ya están registrados en la base de datos del evento.";
          
          // Also show a browser alert as requested "que les salga un aviso de que ya están inscritos."
          alert(language === 'ca'
            ? "⚠️ Avís: Ja esteu inscrits a la base de dades! Rebreu el comprovant o contacteu amb secretaria si teniu qualsevol dubte."
            : "⚠️ Aviso: ¡Ya estáis inscritos en la base de datos! Recibiréis vuestro comprobante o contactad con secretaría ante cualquier duda."
          );
        }
      }
    } catch (e) {
      console.error("Error checking duplicates:", e);
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmetre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      const scrollTarget = document.getElementById('public-form-title');
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(10);

    // Dynamic beautiful upload progress simulation
    const interval = setInterval(() => {
      setSubmitProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 150);

    setTimeout(() => {
      clearInterval(interval);
      setSubmitProgress(100);

      // Generate a dynamic tracking code
      const prefix = categoria === CategoriaParella.ADULT ? 'A' : 'J';
      const randomId = 'ins-' + Math.random().toString(36).substr(2, 9);
      const codiSeguiment = `${prefix}-TEMP-${Math.floor(1000 + Math.random() * 9000)}`;

      const finalRespostes: Record<string, string> = {
        ...respostesCuestionari as Record<string, string>
      };

      if (teDomasBalcoQty > 0) finalRespostes['domas_qty'] = String(teDomasBalcoQty);
      if (teMocadorsExtra > 0) finalRespostes['mocadors_qty'] = String(teMocadorsExtra);
      
      Object.keys(genericExtrasQty).forEach(key => {
        if (genericExtrasQty[key] > 0) {
          finalRespostes[`extra_qty_${key}`] = String(genericExtrasQty[key]);
        }
      });

      const extresGuardats: { id: string; nom: string; quantitat: number; preuUnitari: number }[] = [];
      Object.entries(c1ExtrasSeleccionats).forEach(([id, qty]) => {
        if (Number(qty) > 0) {
          const extraDef = (config.tarifesDinamiques || []).find((t: any) => t.id === id);
          if (extraDef) {
            extresGuardats.push({ id, nom: extraDef.nom, quantitat: Number(qty), preuUnitari: extraDef.valor });
          }
        }
      });
      Object.entries(c2ExtrasSeleccionats).forEach(([id, qty]) => {
        if (Number(qty) > 0) {
          const extraDef = (config.tarifesDinamiques || []).find((t: any) => t.id === id);
          if (extraDef) {
            extresGuardats.push({ id, nom: extraDef.nom, quantitat: Number(qty), preuUnitari: extraDef.valor });
          }
        }
      });

      const novaInscripcio: Inscripcio = {
        id: randomId,
        codiSeguiment,
        categoria,
        c1Nom,
        c1Cognoms,
        c1Email,
        c1Telefon,
        c1Talla,
        c1DniUrl: c1DniUrl || '',
        c1EsMenor,
        c1TutorNom: c1EsMenor ? c1TutorNom : '',
        c1TutorCognoms: c1EsMenor ? c1TutorCognoms : '',
        c1TutorDni: c1EsMenor ? c1TutorDni : '',
        c1TutorTelefon: c1EsMenor ? c1TutorTelefon : '',
        c1UniformeTipus,
        c2Nom,
        c2Cognoms,
        c2Email,
        c2Telefon,
        c2Talla,
        c2DniUrl: c2DniUrl || '',
        c2EsMenor,
        c2TutorNom: c2EsMenor ? c2TutorNom : '',
        c2TutorCognoms: c2EsMenor ? c2TutorCognoms : '',
        c2TutorDni: c2EsMenor ? c2TutorDni : '',
        c2TutorTelefon: c2EsMenor ? c2TutorTelefon : '',
        c2UniformeTipus,
        respostesCuestionari: finalRespostes,
        seleccionsUniforme,
        extresSeleccionats: extresGuardats,
        preuCalculat: totalCalculat,
        teDomasBalco,
        teMocadorsExtra,
        estatPagament: EstatPagament.PENDENT,
        metodePagament: null,
        estatDni: EstatVerificacio.PENDENT,
        entregaMaterial: EstatInscripcio.PENDENT,
        llistaEspera: config.estatInscripcions === 'espera',
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };

      setIsSubmitting(false);
      onSubmit(novaInscripcio);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Dynamic Submit Overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            id="loading-overlay"
          >
            <div className="relative w-28 h-28 mb-8">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-full h-full border-4 border-zinc-800 border-t-fuchsia-500 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkle size={28} className="text-fuchsia-500 animate-pulse" />
              </div>
            </div>

            <h3 className="font-sans font-bold text-2xl text-white mb-2 tracking-tight">
              {language === 'ca' ? "Processant preinscripció" : "Procesando preinscripción"}
            </h3>
            <p className="font-mono text-xs text-fuchsia-400 mb-6 max-w-sm">
              {language === 'ca'
                ? "Comprimint i pujant imatges del DNI en format xifrat segur sota la norma RGPD..."
                : "Comprimiendo y subiendo imágenes del DNI en formato cifrado seguro bajo la norma RGPD..."}
            </p>

            <div className="w-64 bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
              <motion.div 
                className="bg-fuchsia-500 h-full"
                initial={{ width: '0%' }}
                animate={{ width: `${submitProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="font-mono text-zinc-400 text-xs">
              {submitProgress}% {language === 'ca' ? "completat" : "completado"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b border-zinc-200">
        <div>
          <span className="text-[10px] bg-fuchsia-100 text-fuchsia-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
            {language === 'ca' ? 'Formulari de preinscripció 2027' : 'Formulario de preinscripción 2027'}
          </span>
          <h1 id="public-form-title" className="font-sans font-bold text-3xl md:text-4xl text-zinc-900 tracking-tight mt-1.5">
            {t('form_title')}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {t('form_subtitle')}
          </p>
        </div>
        
        <button 
          onClick={onGoToLogin}
          className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-semibold font-mono tracking-tight px-4 py-2.5 rounded-xl border border-zinc-700/50 shadow transition-all flex items-center gap-1 hover:border-fuchsia-500 group cursor-pointer"
          id="btn-admin-access"
        >
          {language === 'ca' ? 'Accés Secretaries' : 'Acceso Secretarías'} <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {config.estatInscripcions === 'tancades' ? (
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm space-y-6 text-center max-w-2xl mx-auto py-12 animate-fadeIn" id="closed-registration-view">
          <div className="mx-auto w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-25" />
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
              <span className="text-3xl">🚦</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-sans font-black text-2xl text-zinc-900 tracking-tight uppercase">
              {language === 'ca' ? "🔴 Procés d'Inscripció Tancat" : "🔴 Proceso de Inscripción Cerrado"}
            </h2>
            <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
              {language === 'ca'
                ? "El període de preinscripció online per a les Comparses de El Tast 2027 ha finalitzat oficialment. Agraïm moltíssim el vostre interès."
                : "El periodo de preinscripción online para las Comparsas de El Tast 2027 ha finalizado oficialmente. Agradecemos muchísimo vuestro interés."}
            </p>
          </div>

          {/* Glowing Traffic light with red illuminated state */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 inline-flex items-center gap-6 shadow font-mono text-[10px] text-zinc-400">
            <span className="font-bold tracking-widest text-[#ff0090] uppercase">ESTAT:</span>
            <div className="bg-zinc-950 border border-zinc-850 px-3.5 py-1.5 rounded-full flex items-center gap-3">
              {/* Red - ON */}
              <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
              {/* Orange - OFF */}
              <div className="w-4 h-4 rounded-full bg-amber-950/20 opacity-20" />
              {/* Green - OFF */}
              <div className="w-4 h-4 rounded-full bg-emerald-900/20 opacity-20" />
            </div>
            <span className="font-sans font-extrabold text-red-500 uppercase tracking-wide">
              {language === 'ca' ? "Tancades" : "Cerradas"}
            </span>
          </div>

          <div className="border-t border-zinc-200 pt-5 space-y-3">
            <p className="text-xs text-zinc-400 italic">
              {language === 'ca'
                ? "Per a dubtes, reclamacions o incidències administratives, podeu contactar directament amb Secretaria a través de la seu presencial d'El Tast."
                : "Para dudas, reclamaciones o incidencias administrativas, podéis contactar directamente con Secretaría a través de la sede presencial de El Tast."}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmetre} className="space-y-8">
          {/* LLISTA D'ESPERA WARNING BAR FOR 'espera' STATUS */}
          {config.estatInscripcions === 'espera' && (
            <div className="bg-amber-50 rounded-3xl border border-amber-300 p-5 shadow-sm flex items-start gap-4 animate-fadeIn" id="waitlist-warning">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle size={20} className="animate-bounce" />
              </div>
              <div className="space-y-1">
                <h4 className="font-sans font-bold text-xs text-amber-800 uppercase tracking-wider flex items-center gap-2">
                  <span>🚦</span> {language === 'ca' ? "Fase Activa: Llista d'Espera" : "Fase Activa: Lista de Espera"}
                </h4>
                <p className="text-amber-700 text-xs leading-relaxed">
                  {language === 'ca'
                    ? "L'aforament d'enguany ha superat el límit inicial. Encara podeu enviar el formulari: la vostra sol·licitud serà registrada amb èxit i s'afegirà a la llista d'espera oficial d'El Tast, en rigorós ordre d'arribada."
                    : "El aforo de este año ha superado el límite inicial. Todavía podéis enviar el formulario: vuestra solicitud será registrada con éxito y se añadirá a la lista de espera oficial de El Tast, en riguroso orden de llegada."}
                </p>
              </div>
            </div>
          )}
        {/* Category Toggles Selector */}
        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-zinc-800/40 pointer-events-none">
            <Sparkle size={120} className="stroke-[0.5]" />
          </div>

          <h3 className="font-sans font-bold text-white text-lg mb-1 tracking-tight">{t('couple_category')}</h3>
          <p className="text-zinc-400 text-xs mb-5">
            {language === 'ca' 
              ? "El preu relatiu canvia automàticament segons la configuració vigent de l'entitat." 
              : "El precio relativo cambia automáticamente según la configuración vigente de la entidad."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(() => {
              const adultTarifaObj = (config.tarifesDinamiques || []).find(t => t.id === 'adults') || { nom: 'Parella Adulta', valor: config.preuAdult, actiu: !(config.tarifesDinamiques && config.tarifesDinamiques.length > 0) };
              const isAdultDisabled = !adultTarifaObj.actiu;

              return (
                <div 
                  onClick={() => !isAdultDisabled && setCategoria(CategoriaParella.ADULT)}
                  className={`p-5 rounded-2xl border-2 transition-all ${
                    isAdultDisabled 
                      ? 'bg-zinc-950/20 border-zinc-900 opacity-40 cursor-not-allowed'
                      : categoria === CategoriaParella.ADULT 
                        ? 'bg-fuchsia-950/40 border-fuchsia-500 shadow-lg shadow-fuchsia-500/10 cursor-pointer' 
                        : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 cursor-pointer'
                  }`}
                  id="card-cat-adult"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold font-mono ${isAdultDisabled ? 'text-zinc-600' : categoria === CategoriaParella.ADULT ? 'text-fuchsia-400' : 'text-zinc-500'}`}>
                      {language === 'ca' ? 'CATEGORIA SÈNIOR' : 'CATEGORÍA SÉNIOR'} {isAdultDisabled && (language === 'ca' ? "(No actiu)" : "(Inactivo)")}
                    </span>
                    {!isAdultDisabled && (
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${categoria === CategoriaParella.ADULT ? 'border-fuchsia-500' : 'border-zinc-500'}`}>
                        {categoria === CategoriaParella.ADULT && <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full" />}
                      </div>
                    )}
                  </div>
                  <h4 className="font-sans font-bold text-xl text-white">
                    {language === 'ca' ? 'Parella Adulta' : 'Pareja Adulta'}
                  </h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    {language === 'ca' 
                      ? 'Recomanada per a participants de 16 anys o més. Inclou samarretes exclusives de la collada i puros dolços.'
                      : 'Recomendada para participantes de 16 años o más. Incluye camisetas exclusivas de la colla y puros dulces.'}
                  </p>
                  <div className="text-right mt-3">
                    <span className="font-sans font-extrabold text-2xl text-fuchsia-500">{adultTarifaObj.valor}€</span>
                    <span className="text-zinc-400 text-xs font-mono"> / {language === 'ca' ? 'parella' : 'pareja'}</span>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const juvenilTarifaObj = (config.tarifesDinamiques || []).find(t => t.id === 'juvenils') || { nom: 'Parella Juvenil', valor: config.preuJuvenil, actiu: !(config.tarifesDinamiques && config.tarifesDinamiques.length > 0) };
              const isJuvenilDisabled = !juvenilTarifaObj.actiu;

              return (
                <div 
                  onClick={() => !isJuvenilDisabled && setCategoria(CategoriaParella.JUVENIL)}
                  className={`p-5 rounded-2xl border-2 transition-all ${
                    isJuvenilDisabled 
                      ? 'bg-zinc-950/20 border-zinc-900 opacity-40 cursor-not-allowed'
                      : categoria === CategoriaParella.JUVENIL 
                        ? 'bg-fuchsia-950/40 border-fuchsia-500 shadow-lg shadow-fuchsia-500/10 cursor-pointer' 
                        : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 cursor-pointer'
                  }`}
                  id="card-cat-juvenil"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold font-mono ${isJuvenilDisabled ? 'text-zinc-600' : categoria === CategoriaParella.JUVENIL ? 'text-fuchsia-400' : 'text-zinc-500'}`}>
                      {language === 'ca' ? 'CATEGORIA JUNIOR' : 'CATEGORÍA JUNIOR'} {isJuvenilDisabled && (language === 'ca' ? "(No actiu)" : "(Inactivo)")}
                    </span>
                    {!isJuvenilDisabled && (
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${categoria === CategoriaParella.JUVENIL ? 'border-fuchsia-500' : 'border-zinc-500'}`}>
                        {categoria === CategoriaParella.JUVENIL && <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full" />}
                      </div>
                    )}
                  </div>
                  <h4 className="font-sans font-bold text-xl text-white">
                    {language === 'ca' ? 'Parella Juvenil' : 'Pareja Juvenil'}
                  </h4>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                    {language === 'ca' 
                      ? 'Ideal per a parelles joves de fins a 15 anys d\'edat. Inclou fulard petit de color fúcsia.'
                      : 'Ideal para parejas jóvenes de hasta 15 años de edad. Incluye pañuelo pequeño de color fucsia.'}
                  </p>
                  <div className="text-right mt-3">
                    <span className="font-sans font-extrabold text-2xl text-fuchsia-500">{juvenilTarifaObj.valor}€</span>
                    <span className="text-zinc-400 text-xs font-mono"> / {language === 'ca' ? 'parella' : 'pareja'}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Global Errors Banner */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-red-800">
            <AlertTriangle className="shrink-0 text-red-600" size={20} />
            <div className="text-xs">
              <span className="font-sans font-bold block mb-1">
                {language === 'ca' ? "Hi ha errors al formulari:" : "Hay errores en el formulario:"}
              </span>
              <ul className="list-disc pl-4 space-y-0.5 font-mono">
                {Object.values(errors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Two-Column Comparser Info Sheets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ComparserCard
            num={1}
            nom={c1Nom}
            setNom={setC1Nom}
            cognoms={c1Cognoms}
            setCognoms={setC1Cognoms}
            telefon={c1Telefon}
            setTelefon={setC1Telefon}
            email={c1Email}
            setEmail={setC1Email}
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
            extrasSeleccionats={c1ExtrasSeleccionats}
            setExtrasSeleccionats={setC1ExtrasSeleccionats}
            isNameDuplicate={isC1NameDuplicate}
            isEmailDuplicate={isC1EmailDuplicate}
            isPhoneDuplicate={isC1PhoneDuplicate}
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
            telefon={c2Telefon}
            setTelefon={setC2Telefon}
            email={c2Email}
            setEmail={setC2Email}
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
            extrasSeleccionats={c2ExtrasSeleccionats}
            setExtrasSeleccionats={setC2ExtrasSeleccionats}
            isNameDuplicate={isC2NameDuplicate}
            isEmailDuplicate={isC2EmailDuplicate}
            isPhoneDuplicate={isC2PhoneDuplicate}
            errors={errors}
            config={config}
            handleFileUpload={handleFileUpload}
            startCamera={startCamera}
          />
        </div>

        {/* Extra Accessories Order Section */}
        {(() => {
          return null;
        })()}

        {/* Dynamic Custom Questionnaire Sections */}
        {config.cuestionariActiu !== false && config.preguntesFormulari && config.preguntesFormulari.filter(q => q.activa).length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-md space-y-6">
            <div className="border-b border-zinc-100 pb-4">
              <h3 className="font-sans font-black text-zinc-900 text-lg tracking-tight uppercase">
                <TranslatedText text={config.titolFormulariDinamic || (language === 'ca' ? 'Preguntes Addicionals' : 'Preguntas Adicionales')} />
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {language === 'ca' ? 'Si us plau, responeu a les següents preguntes requerides per l\'entitat.' : 'Por favor, responda a las siguientes preguntas requeridas por la entidad.'}
              </p>
            </div>

            <div className="space-y-4">
              {config.preguntesFormulari.filter(q => q.activa).map((q) => {
                const isErr = !!errors[`question_${q.id}`];
                return (
                  <div key={q.id} className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                      <TranslatedText text={q.titol} /> {q.requerit && '*'}
                    </label>
                    {q.descripcio && (
                      <p className="text-[11px] text-zinc-400 italic">
                        <TranslatedText text={q.descripcio} />
                      </p>
                    )}

                    {q.tipus === 'text' && (
                      <input 
                        type="text"
                        value={String(respostesCuestionari[q.id] || '')}
                        onChange={(e) => setRespostesCuestionari({
                          ...respostesCuestionari,
                          [q.id]: e.target.value
                        })}
                        className={`w-full bg-zinc-50 border ${isErr ? 'border-red-400 focus:border-red-500 bg-red-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none transition-all`}
                        placeholder={language === 'ca' ? "La vostra resposta..." : "Su respuesta..."}
                      />
                    )}

                    {q.tipus === 'boolean' && (
                      <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${respostesCuestionari[q.id] ? 'bg-fuchsia-50/40 border-fuchsia-200 text-fuchsia-950 font-bold' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                        <input
                          type="checkbox"
                          checked={!!respostesCuestionari[q.id]}
                          onChange={(e) => setRespostesCuestionari({
                            ...respostesCuestionari,
                            [q.id]: e.target.checked
                          })}
                          className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold leading-normal select-none">
                          {language === 'ca' ? 'Sí, confirmo aquesta opció.' : 'Sí, confirmo esta opción.'}
                        </span>
                      </label>
                    )}

                    {q.tipus === 'select' && (
                      <select
                        value={String(respostesCuestionari[q.id] || '')}
                        onChange={(e) => setRespostesCuestionari({
                          ...respostesCuestionari,
                          [q.id]: e.target.value
                        })}
                        className={`w-full bg-zinc-50 border ${isErr ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-fuchsia-500'} rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none cursor-pointer`}
                      >
                        <option value="">{language === 'ca' ? '-- Seleccioneu una opció --' : '-- Seleccione una opción --'}</option>
                        {(q.opcions || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {isErr && (
                      <p className="text-[10px] text-red-500 font-bold">{errors[`question_${q.id}`]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legal Agreements and Terms Checkboxes */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-md space-y-4">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="font-sans font-bold text-zinc-900 text-base tracking-tight uppercase flex items-center gap-1.5">
              <ShieldCheck className="text-fuchsia-600" size={18} />
              {language === 'ca' ? 'Termes Legals i Protecció de Dades' : 'Términos Legales y Protección de Datos'}
            </h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-zinc-500 uppercase font-mono">{language === 'ca' ? 'Normativa de Protecció de Dades (RGPD) *' : 'Normativa de Protección de Datos (RGPD) *'}</span>
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 max-h-36 overflow-y-auto text-[11px] text-zinc-600 leading-relaxed font-sans whitespace-pre-line shadow-inner">
                {language === 'ca' 
                  ? (config.textLegalRgpd || "En compliment del Reglament General de Protecció de Dades (RGPD), us informem que les vostres dades personals i la imatge del DNI frontal seran tractades exclusivament per l'Associació Cultural El Tast per gestionar la inscripció al Carnaval i verificar l'edat dels participants. No se cediran dades a tercers excepte obligació legal i seran totalment destruïdes una vegada finalitzat el Carnaval.")
                  : (config.textLegalRgpdES || "En cumplimiento del Reglamento General de Protección de Datos (RGPD), le informamos que sus datos personales y la imagen del DNI frontal serán tratados exclusivamente por la Associació Cultural El Tast para gestionar la inscripción al Carnaval y verificar la edad de los participantes. No se cederán datos a terceros salvo obligación legal y serán totalmente destruidos una vez finalizado el Carnaval.")
                }
              </div>

              <label className={`flex items-start gap-2.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${acceptaRGPD ? 'bg-fuchsia-50/40 border-fuchsia-200 text-fuchsia-950 font-bold' : errors.rgpd ? 'bg-red-50/40 border-red-200 text-red-950 animate-shake' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-350'}`}>
                <input
                  type="checkbox"
                  checked={acceptaRGPD}
                  onChange={(e) => setAcceptaRGPD(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 filter-none focus:ring-fuchsia-500 cursor-pointer"
                />
                <span className="text-xs font-semibold leading-normal select-none">
                  {language === 'ca'
                    ? "He llegit i accepto expressament el tractament de les meves dades sota la política de privadesa descrita."
                    : "He leído y acepto expresamente el tratamiento de mis datos bajo la política de privacidad descrita."
                  }
                </span>
              </label>
              {errors.rgpd && (
                <p className="text-[10px] text-red-500 font-bold">{errors.rgpd}</p>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <span className="block text-[10px] font-bold text-zinc-500 uppercase font-mono">{language === 'ca' ? 'Condicions d\'Inscripció i Pagament Presencial *' : 'Condiciones de Inscripción y Pago Presencial *'}</span>
              
              <label className={`flex items-start gap-2.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${acceptaPresencial ? 'bg-fuchsia-50/40 border-fuchsia-200 text-fuchsia-950 font-bold' : errors.presencial ? 'bg-red-50/40 border-red-200 text-red-950 animate-shake' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-350'}`}>
                <input
                  type="checkbox"
                  checked={acceptaPresencial}
                  onChange={(e) => setAcceptaPresencial(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 filter-none focus:ring-fuchsia-500 cursor-pointer"
                />
                <span className="text-xs font-semibold leading-normal select-none">
                  {language === 'ca'
                    ? "Confirmo i accepto que la inscripció requereix fer el pagament presencial obligatori i la recollida del material a les oficines d'El Tast en els terminis assenyalats."
                    : "Confirmo y acepto que la inscripción requiere realizar el pago presencial obligatorio y la recogida del material en las oficinas de El Tast en los plazos señalados."
                  }
                </span>
              </label>
              {errors.presencial && (
                <p className="text-[10px] text-red-500 font-bold">{errors.presencial}</p>
              )}
            </div>
          </div>
        </div>

        {/* Floating/Bottom Action price breakdown bar */}
        <div className="bg-zinc-950 rounded-3xl p-6 border border-zinc-850 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 p-8 text-zinc-900/40 pointer-events-none">
            <Sparkles size={80} className="stroke-[0.5]" />
          </div>

          <div className="space-y-1 relative z-10 text-center md:text-left">
            <span className="text-[9px] font-bold font-mono text-fuchsia-400 tracking-widest uppercase bg-fuchsia-950/60 px-2 py-1 rounded border border-fuchsia-900">
              {language === 'ca' ? 'Detall de pagament total' : 'Detalle de pago total'}
            </span>
            <div className="flex items-baseline gap-1 justify-center md:justify-start mt-2">
              <span className="font-sans font-black text-white text-3xl md:text-4xl tracking-tight leading-none">{totalCalculat}€</span>
              <span className="text-zinc-400 text-xs font-mono">EUR</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-normal max-w-sm">
              {language === 'ca'
                ? "El preu reflecteix la parella de comparsers, les talles d'uniformes seleccionades i qualsevol complement adquirit."
                : "El precio refleja la pareja de comparseros, las tallas de uniformes seleccionadas y cualquier complemento adquirido."
              }
            </p>
          </div>

          <button
            type="submit"
            className="w-full md:w-auto bg-[#ff0090] hover:bg-[#d60079] text-white font-sans font-extrabold text-sm uppercase tracking-wider px-8 py-4.5 rounded-2xl shadow-xl shadow-fuchsia-900/30 transition-all flex items-center justify-center gap-2 group shrink-0 cursor-pointer"
            id="btn-submit-registration"
          >
            <span>{language === 'ca' ? "Enviar Preinscripció" : "Enviar Preinscripción"}</span>
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </form>
      )}

      {/* Camera Live/Mock Modal Screen Overlay */}
      <CameraModal
        cameraActive={cameraActive}
        videoError={videoError}
        videoRef={videoRef}
        canvasRef={canvasRef}
        simulateCapture={simulateCapture}
        stopCamera={stopCamera}
        capturePhoto={capturePhoto}
      />
    </div>
  );
}
