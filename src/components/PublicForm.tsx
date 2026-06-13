/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  ShieldCheck, 
  Trash2, 
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
import TranslatedText from './TranslatedText';

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
  const [seleccionsUniforme, setSeleccionsUniforme] = useState<Record<string, { c1Talla: string; c2Talla: string; quantitat: number }>>(() => {
    const initial: Record<string, { c1Talla: string; c2Talla: string; quantitat: number }> = {};
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
        quantitat: 1
      };
    });
    return initial;
  });

  // Dynamic answers
  const [respostesCuestionari, setRespostesCuestionari] = useState<Record<string, string | boolean>>({});
  
  // Extras
  const [teDomasBalco, setTeDomasBalco] = useState(false);
  const [teMocadorsExtra, setTeMocadorsExtra] = useState(0);
  const [genericExtrasSelected, setGenericExtrasSelected] = useState<Record<string, boolean>>({});
  
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
  const domasCost = teDomasBalco ? (config.tarifesDinamiques?.find(t => t.id === 'domas')?.valor ?? config.preuDomasBalco) : 0;
  const mocadorsCost = teMocadorsExtra * (config.tarifesDinamiques?.find(t => t.id === 'mocador')?.valor ?? config.preuMocadorExtra);

  // Calculate any custom dynamically added active generic extras
  const genericExtrasCost = (config.tarifesDinamiques || [])
    .filter(t => t.tipus === 'extra_generic' && t.actiu && genericExtrasSelected[t.id])
    .reduce((sum, t) => sum + t.valor, 0);

  const totalCalculat = basePrice + domasCost + mocadorsCost + genericExtrasCost;

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
            video: { facingMode: 'environment' } 
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
        
        // Add a beautiful watermark of 'El Tast' just to demonstrate realism
        context.fillStyle = 'rgba(230, 0, 126, 0.4)';
        context.font = 'bold 20px Inter';
        context.fillText('EL TAST - DNI VALIDACIÓ', 20, canvas.height - 30);
        
        const dataUrl = canvas.toDataURL('image/webp');
        if (cameraOwner === 'c1') setC1DniUrl(dataUrl);
        if (cameraOwner === 'c2') setC2DniUrl(dataUrl);
        
        stopCamera();
      }
    } else {
      // Simulator fallback if real webcam does not load or is blocked in iframe
      simulateCapture();
    }
  };

  const simulateCapture = () => {
    // Generate a beautiful fuchsia stylized voucher image representing a DNI card
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 380;
    const ctx = c.getContext('2d');
    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 600, 380);
      gradient.addColorStop(0, '#1c1917');
      gradient.addColorStop(1, '#e6007e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 380);

      // Card frame
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(15, 15, 570, 350);

      // Profile avatar mockup
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(40, 50, 150, 190);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 50, 150, 190);
      
      // Face placeholder lines
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(115, 120, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(115, 220, 60, Math.PI, 0);
      ctx.fill();

      // Text fields
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('DOCUMENT NACIONAL D\'IDENTITAT', 220, 80);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f3f4f6';
      ctx.fillText(`NOM: ${cameraOwner === 'c1' ? c1Nom || 'Participant 1' : c2Nom || 'Participant 2'}`, 220, 130);
      ctx.fillText(`COGNOMS: ${cameraOwner === 'c1' ? c1Cognoms || 'Cognoms 1' : c2Cognoms || 'Cognoms 2'}`, 220, 160);
      ctx.fillText(`SEXE: M/F   ESTAT: SPANISH`, 220, 190);
      ctx.fillText('DATA EXP: 31 DEC 2030', 220, 220);

      // Big watermark fuchsia text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = 'bold 90px Arial';
      ctx.fillText('EL TAST', 200, 310);

      // Signature bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(40, 260, 150, 40);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(40, 260, 150, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 14px Georgia';
      ctx.fillText('Signatura Oficial', 55, 285);

      const dataUrl = c.toDataURL('image/webp');
      if (cameraOwner === 'c1') setC1DniUrl(dataUrl);
      if (cameraOwner === 'c2') setC2DniUrl(dataUrl);
      stopCamera();
    }
  };

  // Convert uploaded files to base64 images
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, owner: 'c1' | 'c2') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("La imatge és massa gran (màxim 10MB).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (owner === 'c1') setC1DniUrl(reader.result as string);
        if (owner === 'c2') setC2DniUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

    // Validators
  const validateForm = () => {
    const tempErrors: Record<string, string> = {};
    if (!c1Nom.trim()) tempErrors.c1Nom = language === 'ca' ? "El nom és requerit" : "El nombre es requerido";
    if (!c1Cognoms.trim()) tempErrors.c1Cognoms = language === 'ca' ? "Els cognoms són requerits" : "Los apellidos son requeridos";
    if (!c1Email.trim() || !/\S+@\S+\.\S+/.test(c1Email)) tempErrors.c1Email = language === 'ca' ? "Email vàlid requerit" : "Email válido requerido";
    if (!c1Telefon.trim()) tempErrors.c1Telefon = language === 'ca' ? "El telèfon és requerit" : "El teléfono es requerido";
    if (!c1DniUrl) tempErrors.c1Dni = language === 'ca' ? "Cal pujar el DNI del Comparser 1" : "Es necesario subir el DNI del Comparser 1";

    if (c1EsMenor) {
      if (!c1TutorNom.trim()) tempErrors.c1TutorNom = language === 'ca' ? "El nom del tutor és requerit" : "El nombre del tutor es requerido";
      if (!c1TutorCognoms.trim()) tempErrors.c1TutorCognoms = language === 'ca' ? "Els cognoms del tutor són requerits" : "Los apellidos del tutor son requeridos";
      if (!c1TutorDni.trim()) tempErrors.c1TutorDni = language === 'ca' ? "El DNI del tutor és requerit" : "El DNI del tutor es requerido";
      if (!c1TutorTelefon.trim()) tempErrors.c1TutorTelefon = language === 'ca' ? "El telèfon del tutor és requerit" : "El teléfono del tutor es requerido";
      if (!c1TutorAccepta) tempErrors.c1TutorAccepta = language === 'ca' ? "Cal acceptar l'autorització de menors" : "Es necesario aceptar la autorización de menores";
    }

    if (!c2Nom.trim()) tempErrors.c2Nom = language === 'ca' ? "El nom és requerit" : "El nombre es requerido";
    if (!c2Cognoms.trim()) tempErrors.c2Cognoms = language === 'ca' ? "Els cognoms són requerits" : "Los apellidos son requeridos";
    if (!c2Email.trim() || !/\S+@\S+\.\S+/.test(c2Email)) tempErrors.c2Email = language === 'ca' ? "Email vàlid requerit" : "Email válido requerido";
    if (!c2Telefon.trim()) tempErrors.c2Telefon = language === 'ca' ? "El telèfon és requerit" : "El teléfono es requerido";
    if (!c2DniUrl) tempErrors.c2Dni = language === 'ca' ? "Cal pujar el DNI del Comparser 2" : "Es necesario subir el DNI del Comparser 2";

    if (c2EsMenor) {
      if (!c2TutorNom.trim()) tempErrors.c2TutorNom = language === 'ca' ? "El nom del tutor és requerit" : "El nombre del tutor es requerido";
      if (!c2TutorCognoms.trim()) tempErrors.c2TutorCognoms = language === 'ca' ? "Els cognoms del tutor són requerits" : "Los apellidos del tutor son requeridos";
      if (!c2TutorDni.trim()) tempErrors.c2TutorDni = language === 'ca' ? "El DNI del tutor és requerit" : "El DNI del tutor es requerido";
      if (!c2TutorTelefon.trim()) tempErrors.c2TutorTelefon = language === 'ca' ? "El telèfon del tutor és requerit" : "El teléfono del tutor es requerido";
      if (!c2TutorAccepta) tempErrors.c2TutorAccepta = language === 'ca' ? "Cal acceptar l'autorització de menors" : "Es necesario aceptar la autorización de menores";
    }

    // Validate dynamic visible fields
    config.preguntesFormulari.forEach(q => {
      if (q.activa && q.requerit) {
        const ans = respostesCuestionari[q.id];
        if (q.tipus === 'text' && (!ans || String(ans).trim() === '')) {
          tempErrors[q.id] = language === 'ca' ? "Aquesta pregunta és obligatòria" : "Esta pregunta es obligatoria";
        }
      }
    });

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
      const sequencialCode = Math.floor(1000 + Math.random() * 9000);
      const codiSeguiment = `TAST-2026-${sequencialCode}`;
      const randomId = 'ins-' + Math.random().toString(36).substr(2, 9);

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
        respostesCuestionari,
        seleccionsUniforme,
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
            {language === 'ca' ? 'Formulari de preinscripció 2026' : 'Formulario de preinscripción 2026'}
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
                ? "El període de preinscripció online per a les Comparses de El Tast 2026 ha finalitzat oficialment. Agraïm moltíssim el vostre interès."
                : "El periodo de preinscripción online para las Comparsas de El Tast 2026 ha finalizado oficialmente. Agradecemos muchísimo vuestro interés."}
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
              const adultTarifaObj = (config.tarifesDinamiques || []).find(t => t.id === 'adults') || { nom: 'Parella Adulta', valor: config.preuAdult, actiu: true };
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
              const juvenilTarifaObj = (config.tarifesDinamiques || []).find(t => t.id === 'juvenils') || { nom: 'Parella Juvenil', valor: config.preuJuvenil, actiu: true };
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
          
          {/* Comparser 1 Card */}
          <div className={`rounded-3xl p-6 border transition-all relative overflow-hidden ${errors.c1Duplicat || isC1NameDuplicate || isC1EmailDuplicate || isC1PhoneDuplicate ? 'bg-amber-50/10 border-amber-300 ring-2 ring-amber-300 shadow-amber-100/30' : 'bg-white border-zinc-200/80 shadow-md'}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-zinc-100 to-transparent pointer-events-none rounded-bl-3xl flex items-center justify-center">
              <span className="font-mono text-zinc-400 text-sm font-bold">#1</span>
            </div>
            
            <div className="flex justify-between items-center mb-5 pb-2 border-b border-zinc-100">
              <h3 className="font-sans font-bold text-zinc-900 text-lg flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full" />
                {language === 'ca' ? 'Primer Comparser (Representant)' : 'Primer Comparsero (Representante)'}
              </h3>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full font-mono uppercase tracking-tight flex items-center gap-1 shadow-sm shrink-0" title={language === 'ca' ? "Sincronitzat amb la base de dades" : "Sincronizado con la base de datos"}>
                <Database size={9} /> {language === 'ca' ? 'Enllaç BBDD' : 'Enlace BBDD'}
              </span>
            </div>

            {(errors.c1Duplicat || isC1NameDuplicate || isC1EmailDuplicate || isC1PhoneDuplicate) && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl mb-4 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={16} />
                <div>
                  <p className="font-bold">{language === 'ca' ? "Avís de dades coincidents" : "Aviso de datos coincidentes"}</p>
                  <p className="text-[11px] text-amber-700 leading-normal mt-0.5">
                    {language === 'ca'
                      ? "S'ha detectat que part d'aquestes dades ja estan registrades a la base de dades d'inscripcions!"
                      : "¡Se ha detectado que parte de estos datos ya están registrados en la base de datos de inscripciones!"}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Nom *' : 'Nombre *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="text" 
                  value={c1Nom} 
                  onChange={(e) => setC1Nom(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Nom || isC1NameDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. Joan" : "Ej. Juan"}
                  id="input-c1-nom"
                />
                {isC1NameDuplicate && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} /> {language === 'ca' ? "Ja existeix un participant amb aquest nom a la BBDD" : "Ya existe un participante con este nombre en la BBDD"}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Cognoms *' : 'Apellidos *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="text" 
                  value={c1Cognoms} 
                  onChange={(e) => setC1Cognoms(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Cognoms || isC1NameDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. Garcia Pujol" : "Ej. García Pujol"}
                  id="input-c1-cognoms"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Telèfon de contacte *' : 'Teléfono de contacto *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="tel" 
                  value={c1Telefon} 
                  onChange={(e) => setC1Telefon(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Telefon || isC1PhoneDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. 600123456" : "Ej. 600123456"}
                  id="input-c1-telefon"
                />
                {isC1PhoneDuplicate && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} /> {language === 'ca' ? "Aquest telèfon ja consta registrat a la BBDD" : "Este teléfono ya consta registrado en la BBDD"}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Correu electrònic *' : 'Correo electrónico *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="email" 
                  value={c1Email} 
                  onChange={(e) => setC1Email(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c1Email || isC1EmailDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. joan@gmail.com" : "Ej. juan@gmail.com"}
                  id="input-c1-email"
                />
                {isC1EmailDuplicate && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} /> {language === 'ca' ? "Aquest correu ja consta registrat a la BBDD" : "Este correo ya consta registrado en la BBDD"}
                  </p>
                )}
              </div>

              {/* Minor status and Tutor details for Comparser 1 */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? "El primer comparser és menor d'edat? *" : "¿El primer comparsero es menor de edad? *"}
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-zinc-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setC1EsMenor(false)}
                      className={`text-xs px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${!c1EsMenor ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                    >
                      {language === 'ca' ? "No" : "No"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setC1EsMenor(true)}
                      className={`text-xs px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${c1EsMenor ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                    >
                      {language === 'ca' ? "Sí" : "Sí"}
                    </button>
                  </div>
                </div>

                {c1EsMenor && (
                  <div className="pt-2 border-t border-zinc-200/60 space-y-3 animate-fadeIn">
                    <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2 font-semibold">
                      {language === 'ca' 
                        ? "En ser menor d'edat, cal incloure obligatòriament les dades de contacte del tutor legal."
                        : "Al ser menor de edad, es obligatorio incluir los datos de contacto de su tutor legal."}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "Nom del Tutor *" : "Nombre del Tutor *"}
                        </label>
                        <input 
                          type="text"
                          value={c1TutorNom}
                          onChange={(e) => setC1TutorNom(e.target.value)}
                          className={`w-full bg-white border ${errors.c1TutorNom ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. Pere" : "Ej. Pedro"}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "Cognoms del Tutor *" : "Apellidos del Tutor *"}
                        </label>
                        <input 
                          type="text"
                          value={c1TutorCognoms}
                          onChange={(e) => setC1TutorCognoms(e.target.value)}
                          className={`w-full bg-white border ${errors.c1TutorCognoms ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. Garcia Pou" : "Ej. García Pou"}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "DNI / NIE del Tutor *" : "DNI / NIE del Tutor *"}
                        </label>
                        <input 
                          type="text"
                          value={c1TutorDni}
                          onChange={(e) => setC1TutorDni(e.target.value)}
                          className={`w-full bg-white border ${errors.c1TutorDni ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. 12345678Z" : "Ej. 12345678Z"}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "Telèfon del Tutor *" : "Teléfono del Tutor *"}
                        </label>
                        <input 
                          type="tel"
                          value={c1TutorTelefon}
                          onChange={(e) => setC1TutorTelefon(e.target.value)}
                          className={`w-full bg-white border ${errors.c1TutorTelefon ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. 600123456" : "Ej. 600123456"}
                        />
                      </div>
                    </div>

                    {/* Legal Authorization Text for Minors */}
                    <div className="pt-3 border-t border-zinc-200/80 space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono">
                        {language === 'ca' ? "Autorització de deures i responsabilitats de menors *" : "Autorización de deberes y responsabilidades de menores *"}
                      </label>
                      <div className="bg-white border border-zinc-200 rounded-xl p-3 max-h-32 overflow-y-auto text-[11px] text-zinc-600 leading-relaxed font-sans whitespace-pre-line shadow-inner">
                        {language === 'ca' 
                          ? (config.textLegalAutoritzacioMenors || "AUTORITZACIÓ DE MENORS D'EDAT\n\nEn condició de tutor/a legal del menor inscrit, declaro sota la meva responsabilitat que autoritzo expressament la seva participació a l'esdeveniment i activitats organitzades per l'Associació Cultural El Tast.")
                          : (config.textLegalAutoritzacioMenorsES || "AUTORIZACIÓN DE MENORES DE EDAD\n\nEn condición de tutor/a legal del menor inscrito, declaro bajo mi responsabilidad que autorizo expresamente su participación en el evento y actividades organizadas por la Associació Cultural El Tast.")
                        }
                      </div>

                      <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${c1TutorAccepta ? 'bg-fuchsia-50/40 border-fuchsia-200 text-fuchsia-950' : errors.c1TutorAccepta ? 'bg-red-50/40 border-red-200 text-red-950 animate-shake' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                        <input
                          type="checkbox"
                          checked={c1TutorAccepta}
                          onChange={(e) => setC1TutorAccepta(e.target.checked)}
                          className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 filter-none focus:ring-fuchsia-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold leading-tight select-none">
                          {language === 'ca'
                            ? "Com a tutor legal, autoritzo i accepto de forma expressa les condicions i responsabilitats indicades."
                            : "Como tutor legal, autorizo y acepto de forma expresa las condiciones y responsabilidades indicadas."
                          }
                        </span>
                      </label>
                      {errors.c1TutorAccepta && (
                        <p className="text-[10px] text-red-500 font-bold">{errors.c1TutorAccepta}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic clothing lines and custom equipment options - Comparser 1 */}
              {(config.liniisUniforme || [
                {
                  id: 'lin-1',
                  nom: config.nomUniforme || 'Talla de Samarreta',
                  nomES: config.nomUniformeES || 'Talla de Camiseta',
                  opcions: config.opcionsUniforme || ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
                  requeixQuantitat: false
                }
              ]).map((linia) => {
                const sel = seleccionsUniforme[linia.id] || { c1Talla: linia.opcions[0] || 'M', c2Talla: linia.opcions[0] || 'M', quantitat: 1 };
                return (
                  <div key={linia.id} className="space-y-2 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                        {language === 'ca' ? linia.nom : linia.nomES} *
                      </label>
                    </div>

                    <div className="flex gap-2.5">
                      <select 
                        value={sel.c1Talla} 
                        onChange={(e) => {
                          const newSel = { ...sel, c1Talla: e.target.value };
                          setSeleccionsUniforme({
                            ...seleccionsUniforme,
                            [linia.id]: newSel
                          });
                          // Maintain backward compatibility for c1Talla if it matches the first item
                          const firstId = (config.liniisUniforme && config.liniisUniforme[0]?.id) || 'lin-1';
                          if (linia.id === firstId) {
                            setC1Talla(e.target.value);
                          }
                        }}
                        className="flex-1 bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none cursor-pointer"
                      >
                        {linia.opcions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>

                      {linia.requeixQuantitat && (
                        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-1 text-xs shrink-0">
                          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase">{language === 'ca' ? "Cant." : "Cant."}</span>
                          <select
                            value={sel.quantitat || 1}
                            onChange={(e) => {
                              const newSel = { ...sel, quantitat: Math.max(1, Number(e.target.value)) };
                              setSeleccionsUniforme({
                                ...seleccionsUniforme,
                                [linia.id]: newSel
                              });
                            }}
                            className="bg-transparent border-none text-xs font-bold text-zinc-800 focus:ring-0 focus:outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Casilla o Toggles per triar Venda o Lloguer */}
                    <div className="mt-2 text-left pt-2 border-t border-zinc-200/50 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-tight">
                        {language === 'ca' ? "Tipus d'Adquisició:" : "Tipo de Adquisición:"}
                      </span>
                      <div className="flex bg-white rounded-lg overflow-hidden border border-zinc-200 p-0.5 shrink-0" id="c1-uniform-adquisicio-container">
                        <button
                          type="button"
                          onClick={() => setC1UniformeTipus('compra')}
                          className={`text-[10px] px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${c1UniformeTipus === 'compra' ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-zinc-550 hover:text-zinc-855'}`}
                        >
                          {language === 'ca' ? "Compra" : "Compra (Venta)"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setC1UniformeTipus('lloguer')}
                          className={`text-[10px] px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${c1UniformeTipus === 'lloguer' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-550 hover:text-zinc-855'}`}
                        >
                          {language === 'ca' ? "Lloguer" : "Alquiler"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* DNI upload zona */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1.5">
                  {language === 'ca' ? 'Foto de la part frontal del DNI *' : 'Foto de la parte frontal del DNI *'}
                </label>
                {c1DniUrl ? (
                  <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 flex items-center justify-between gap-3 relative overflow-hidden group">
                    <img 
                      src={c1DniUrl} 
                      alt="DNI Comparser 1" 
                      className="w-20 h-14 object-cover rounded-md border border-zinc-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">DNI_Comparser_1.webp</p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {language === 'ca' ? 'Arxiu penjat correctament' : 'Archivo subido correctamente'}
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setC1DniUrl(null)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                      title={language === 'ca' ? "Eliminar arxiu" : "Eliminar archivo"}
                      id="btn-remove-c1-dni"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={`border-2 border-dashed ${errors.c1Dni ? 'border-red-300 bg-red-50/20' : 'border-zinc-200 hover:border-fuchsia-300'} rounded-2xl p-5 text-center transition-all`}>
                    <Upload className="mx-auto text-zinc-400 mb-2" size={24} />
                    <p className="text-xs text-zinc-600 font-semibold mb-1">
                      {language === 'ca' ? 'Arrossega una foto o selecciona un arxiu' : 'Arrastra una foto o selecciona un archivo'}
                    </p>
                    <p className="text-[11px] text-zinc-400 mb-3 font-mono">Format PNG, JPG o WEBP (màx 10MB)</p>
                    
                    <div className="flex flex-wrap gap-2 justify-center">
                      <label className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors border border-zinc-200">
                        {language === 'ca' ? 'Pujar fitxer' : 'Subir archivo'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, 'c1')} 
                          className="hidden" 
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => startCamera('c1')}
                        className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        id="btn-camera-c1"
                      >
                        <Camera size={14} /> {language === 'ca' ? 'Fes foto' : 'Hacer foto'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comparser 2 Card */}
          <div className={`rounded-3xl p-6 border transition-all relative overflow-hidden ${errors.c2Duplicat || isC2NameDuplicate || isC2EmailDuplicate || isC2PhoneDuplicate ? 'bg-amber-50/10 border-amber-300 ring-2 ring-amber-300 shadow-amber-100/30' : 'bg-white border-zinc-200/80 shadow-md'}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-zinc-100 to-transparent pointer-events-none rounded-bl-3xl flex items-center justify-center">
              <span className="font-mono text-zinc-400 text-sm font-bold">#2</span>
            </div>

            <div className="flex justify-between items-center mb-5 pb-2 border-b border-zinc-100">
              <h3 className="font-sans font-bold text-zinc-900 text-lg flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full" />
                {language === 'ca' ? 'Segon Comparser' : 'Segundo Comparsero'}
              </h3>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full font-mono uppercase tracking-tight flex items-center gap-1 shadow-sm shrink-0" title={language === 'ca' ? "Sincronitzat amb la base de dades" : "Sincronizado con la base de datos"}>
                <Database size={9} /> {language === 'ca' ? 'Enllaç BBDD' : 'Enlace BBDD'}
              </span>
            </div>

            {(errors.c2Duplicat || isC2NameDuplicate || isC2EmailDuplicate || isC2PhoneDuplicate) && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl mb-4 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={16} />
                <div>
                  <p className="font-bold">{language === 'ca' ? "Avís de dades coincidents" : "Aviso de datos coincidentes"}</p>
                  <p className="text-[11px] text-amber-700 leading-normal mt-0.5">
                    {language === 'ca'
                      ? "S'ha detectat que part d'aquestes dades ja estan registrades a la base de dades d'inscripcions!"
                      : "¡Se ha detectado que parte de estos datos ya están registrados en la base de datos de inscripciones!"}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Nom *' : 'Nombre *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="text" 
                  value={c2Nom} 
                  onChange={(e) => setC2Nom(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Nom || isC2NameDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. Marta" : "Ej. Marta"}
                  id="input-c2-nom"
                />
                {isC2NameDuplicate && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} /> {language === 'ca' ? "Ja existeix un participant amb aquest nom a la BBDD" : "Ya existe un participante con este nombre en la BBDD"}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Cognoms *' : 'Apellidos *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="text" 
                  value={c2Cognoms} 
                  onChange={(e) => setC2Cognoms(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Cognoms || isC2NameDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. Vilanova Soler" : "Ej. Vilanova Soler"}
                  id="input-c2-cognoms"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Telèfon de contacte *' : 'Teléfono de contacto *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="tel" 
                  value={c2Telefon} 
                  onChange={(e) => setC2Telefon(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Telefon || isC2PhoneDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. 600654321" : "Ej. 600654321"}
                  id="input-c2-telefon"
                />
                {isC2PhoneDuplicate && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} /> {language === 'ca' ? "Aquest telèfon ja consta registrat a la BBDD" : "Este teléfono ya consta registrado en la BBDD"}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? 'Correu electrònic *' : 'Correo electrónico *'}
                  </label>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono uppercase tracking-tight flex items-center gap-0.5" title={language === 'ca' ? "Es desa a la base de dades" : "Se guarda en la base de datos"}>
                    <Database size={8} /> BBDD
                  </span>
                </div>
                <input 
                  type="email" 
                  value={c2Email} 
                  onChange={(e) => setC2Email(e.target.value)}
                  className={`w-full bg-zinc-50 border ${errors.c2Email || isC2EmailDuplicate ? 'border-amber-400 focus:border-amber-500 bg-amber-50/5' : 'border-zinc-200 focus:border-fuchsia-500'} focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                  placeholder={language === 'ca' ? "Ex. marta@gmail.com" : "Ej. marta@gmail.com"}
                  id="input-c2-email"
                />
                {isC2EmailDuplicate && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={10} /> {language === 'ca' ? "Aquest correu ja consta registrat a la BBDD" : "Este correo ya consta registrado en la BBDD"}
                  </p>
                )}
              </div>

              {/* Minor status and Tutor details for Comparser 2 */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                    {language === 'ca' ? "El segon comparser és menor d'edat? *" : "¿El segundo comparsero es menor de edad? *"}
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-zinc-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setC2EsMenor(false)}
                      className={`text-xs px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${!c2EsMenor ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                    >
                      {language === 'ca' ? "No" : "No"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setC2EsMenor(true)}
                      className={`text-xs px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${c2EsMenor ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                    >
                      {language === 'ca' ? "Sí" : "Sí"}
                    </button>
                  </div>
                </div>

                {c2EsMenor && (
                  <div className="pt-2 border-t border-zinc-200/60 space-y-3 animate-fadeIn">
                    <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2 font-semibold">
                      {language === 'ca' 
                        ? "En ser menor d'edat, cal incloure obligatòriament les dades de contacte del tutor legal."
                        : "Al ser menor de edad, es obligatorio incluir los datos de contacto de su tutor legal."}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "Nom del Tutor *" : "Nombre del Tutor *"}
                        </label>
                        <input 
                          type="text"
                          value={c2TutorNom}
                          onChange={(e) => setC2TutorNom(e.target.value)}
                          className={`w-full bg-white border ${errors.c2TutorNom ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. Pere" : "Ej. Pedro"}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "Cognoms del Tutor *" : "Apellidos del Tutor *"}
                        </label>
                        <input 
                          type="text"
                          value={c2TutorCognoms}
                          onChange={(e) => setC2TutorCognoms(e.target.value)}
                          className={`w-full bg-white border ${errors.c2TutorCognoms ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. Garcia Pou" : "Ej. García Pou"}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "DNI / NIE del Tutor *" : "DNI / NIE del Tutor *"}
                        </label>
                        <input 
                          type="text"
                          value={c2TutorDni}
                          onChange={(e) => setC2TutorDni(e.target.value)}
                          className={`w-full bg-white border ${errors.c2TutorDni ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. 12345678Z" : "Ej. 12345678Z"}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono mb-1">
                          {language === 'ca' ? "Telèfon del Tutor *" : "Teléfono del Tutor *"}
                        </label>
                        <input 
                          type="tel"
                          value={c2TutorTelefon}
                          onChange={(e) => setC2TutorTelefon(e.target.value)}
                          className={`w-full bg-white border ${errors.c2TutorTelefon ? 'border-red-500' : 'border-zinc-250'} focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none`}
                          placeholder={language === 'ca' ? "Ex. 600123456" : "Ej. 600123456"}
                        />
                      </div>
                    </div>

                    {/* Legal Authorization Text for Minors */}
                    <div className="pt-3 border-t border-zinc-200/80 space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase font-mono">
                        {language === 'ca' ? "Autorització de deures i responsabilitats de menors *" : "Autorización de deberes y responsabilidades de menores *"}
                      </label>
                      <div className="bg-white border border-zinc-200 rounded-xl p-3 max-h-32 overflow-y-auto text-[11px] text-zinc-600 leading-relaxed font-sans whitespace-pre-line shadow-inner">
                        {language === 'ca' 
                          ? (config.textLegalAutoritzacioMenors || "AUTORITZACIÓ DE MENORS D'EDAT\n\nEn condició de tutor/a legal del menor inscrit, declaro sota la meva responsabilitat que autoritzo expressament la seva participació a l'esdeveniment i activitats organitzades per l'Associació Cultural El Tast.")
                          : (config.textLegalAutoritzacioMenorsES || "AUTORIZACIÓN DE MENORES DE EDAD\n\nEn condición de tutor/a legal del menor inscrito, declaro bajo mi responsabilidad que autorizo expresamente su participación en el evento y actividades organizadas por la Associació Cultural El Tast.")
                        }
                      </div>

                      <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${c2TutorAccepta ? 'bg-fuchsia-50/40 border-fuchsia-200 text-fuchsia-950' : errors.c2TutorAccepta ? 'bg-red-50/40 border-red-200 text-red-950 animate-shake' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                        <input
                          type="checkbox"
                          checked={c2TutorAccepta}
                          onChange={(e) => setC2TutorAccepta(e.target.checked)}
                          className="mt-0.5 rounded border-zinc-300 text-fuchsia-600 filter-none focus:ring-fuchsia-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold leading-tight select-none">
                          {language === 'ca'
                            ? "Com a tutor legal, autoritzo i accepto de forma expressa les condicions i responsabilitats indicades."
                            : "Como tutor legal, autorizo y acepto de forma expresa las condiciones y responsabilidades indicadas."
                          }
                        </span>
                      </label>
                      {errors.c2TutorAccepta && (
                        <p className="text-[10px] text-red-500 font-bold">{errors.c2TutorAccepta}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic clothing lines and custom equipment options - Comparser 2 */}
              {(config.liniisUniforme || [
                {
                  id: 'lin-1',
                  nom: config.nomUniforme || 'Talla de Samarreta',
                  nomES: config.nomUniformeES || 'Talla de Camiseta',
                  opcions: config.opcionsUniforme || ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
                  requeixQuantitat: false
                }
              ]).map((linia) => {
                const sel = seleccionsUniforme[linia.id] || { c1Talla: linia.opcions[0] || 'M', c2Talla: linia.opcions[0] || 'M', quantitat: 1 };
                return (
                  <div key={linia.id} className="space-y-2 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-zinc-700 tracking-tight">
                        {language === 'ca' ? linia.nom : linia.nomES} *
                      </label>
                    </div>

                    <div className="flex gap-2.5">
                      <select 
                        value={sel.c2Talla} 
                        onChange={(e) => {
                          const newSel = { ...sel, c2Talla: e.target.value };
                          setSeleccionsUniforme({
                            ...seleccionsUniforme,
                            [linia.id]: newSel
                          });
                          // Maintain backward compatibility for c2Talla if it matches the first item
                          const firstId = (config.liniisUniforme && config.liniisUniforme[0]?.id) || 'lin-1';
                          if (linia.id === firstId) {
                            setC2Talla(e.target.value);
                          }
                        }}
                        className="flex-1 bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none cursor-pointer"
                      >
                        {linia.opcions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>

                      {linia.requeixQuantitat && (
                        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-1 text-xs shrink-0">
                          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase">{language === 'ca' ? "Cant." : "Cant."}</span>
                          <select
                            value={sel.quantitat || 1}
                            onChange={(e) => {
                              const newSel = { ...sel, quantitat: Math.max(1, Number(e.target.value)) };
                              setSeleccionsUniforme({
                                ...seleccionsUniforme,
                                [linia.id]: newSel
                              });
                            }}
                            className="bg-transparent border-none text-xs font-bold text-zinc-800 focus:ring-0 focus:outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Casilla o Toggles per triar Venda o Lloguer */}
                    <div className="mt-2 text-left pt-2 border-t border-zinc-200/50 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-tight">
                        {language === 'ca' ? "Tipus d'Adquisició:" : "Tipo de Adquisición:"}
                      </span>
                      <div className="flex bg-white rounded-lg overflow-hidden border border-zinc-200 p-0.5 shrink-0" id="c2-uniform-adquisicio-container">
                        <button
                          type="button"
                          onClick={() => setC2UniformeTipus('compra')}
                          className={`text-[10px] px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${c2UniformeTipus === 'compra' ? 'bg-fuchsia-100 text-fuchsia-700 shadow-sm' : 'text-zinc-550 hover:text-zinc-855'}`}
                        >
                          {language === 'ca' ? "Compra" : "Compra (Venta)"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setC2UniformeTipus('lloguer')}
                          className={`text-[10px] px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${c2UniformeTipus === 'lloguer' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-zinc-550 hover:text-zinc-855'}`}
                        >
                          {language === 'ca' ? "Lloguer" : "Alquiler"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* DNI upload zona */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-zinc-700 tracking-tight mb-1.5">
                  {language === 'ca' ? 'Foto de la part frontal del DNI *' : 'Foto de la parte frontal del DNI *'}
                </label>
                {c2DniUrl ? (
                  <div className="border border-zinc-200 rounded-2xl p-3 bg-zinc-50 flex items-center justify-between gap-3 relative overflow-hidden group">
                    <img 
                      src={c2DniUrl} 
                      alt="DNI Comparser 2" 
                      className="w-20 h-14 object-cover rounded-md border border-zinc-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">DNI_Comparser_2.webp</p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {language === 'ca' ? 'Arxiu penjat correctament' : 'Archivo subido correctamente'}
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setC2DniUrl(null)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                      title={language === 'ca' ? "Eliminar arxiu" : "Eliminar archivo"}
                      id="btn-remove-c2-dni"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={`border-2 border-dashed ${errors.c2Dni ? 'border-red-300 bg-red-50/20' : 'border-zinc-200 hover:border-fuchsia-300'} rounded-2xl p-5 text-center transition-all`}>
                    <Upload className="mx-auto text-zinc-400 mb-2" size={24} />
                    <p className="text-xs text-zinc-600 font-semibold mb-1">
                      {language === 'ca' ? 'Arrossega una foto o selecciona un arxiu' : 'Arrastra una foto o selecciona un archivo'}
                    </p>
                    <p className="text-[11px] text-zinc-400 mb-3 font-mono">Format PNG, JPG o WEBP (màx 10MB)</p>
                    
                    <div className="flex flex-wrap gap-2 justify-center">
                      <label className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors border border-zinc-200">
                        {language === 'ca' ? 'Pujar fitxer' : 'Subir archivo'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, 'c2')} 
                          className="hidden" 
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => startCamera('c2')}
                        className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        id="btn-camera-c2"
                      >
                        <Camera size={14} /> {language === 'ca' ? 'Fes foto' : 'Hacer foto'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic customized questionnaire part */}
        {config.preguntesFormulari.some(q => q.activa) && (
          <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
            <h3 className="font-sans font-bold text-zinc-900 text-lg mb-5 pb-2 border-b border-zinc-100 flex items-center gap-2">
              <Sparkles className="text-fuchsia-500" size={18} />
              {config.titolFormulariDinamic ? (
                <TranslatedText text={config.titolFormulariDinamic} />
              ) : (
                language === 'ca' ? "Preguntes del Qüestionari d'El Tast" : "Preguntas del Cuestionario de El Tast"
              )}
            </h3>

            <div className="space-y-5">
              {config.preguntesFormulari.filter(q => q.activa).map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5 flex items-center gap-1.5">
                    <TranslatedText text={q.titol} />
                    {q.requerit && <span className="text-red-500">*</span>}
                  </label>

                  {q.tipus === 'text' && (
                    <input 
                      type="text"
                      value={String(respostesCuestionari[q.id] || '')}
                      onChange={(e) => setRespostesCuestionari(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={language === 'ca' ? "Escriu la teva resposta" : "Escribe tu respuesta"}
                      className={`w-full bg-zinc-50 border ${errors[q.id] ? 'border-red-500' : 'border-zinc-200'} focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all`}
                    />
                  )}

                  {q.tipus === 'select' && (
                    <select
                      value={String(respostesCuestionari[q.id] || '')}
                      onChange={(e) => setRespostesCuestionari(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">{language === 'ca' ? "-- Selecciona una opció --" : "-- Selecciona una opción --"}</option>
                      {q.opcions?.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {q.tipus === 'boolean' && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setRespostesCuestionari(prev => ({ ...prev, [q.id]: true }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          respostesCuestionari[q.id] === true 
                            ? 'bg-fuchsia-500 text-white' 
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {language === 'ca' ? 'Sí' : 'Sí'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRespostesCuestionari(prev => ({ ...prev, [q.id]: false }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          respostesCuestionari[q.id] === false 
                            ? 'bg-fuchsia-500 text-white' 
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  )}

                  {errors[q.id] && <p className="text-red-500 text-xs font-mono mt-1">{errors[q.id]}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extra Accessories Order Section */}
        {(() => {
          const domasTarifaObj = (config.tarifesDinamiques || []).find(t => t.id === 'domas') || { nom: "Domàs per al Balcó de les Comparses", valor: config.preuDomasBalco, actiu: true };
          const mocadorTarifaObj = (config.tarifesDinamiques || []).find(t => t.id === 'mocador') || { nom: "Mocadors oficials addicionals", valor: config.preuMocadorExtra, actiu: true };
          const genericExtras = (config.tarifesDinamiques || []).filter(t => t.tipus === 'extra_generic' && t.actiu);

          const hasAnyExtras = domasTarifaObj.actiu || mocadorTarifaObj.actiu || genericExtras.length > 0;

          if (!hasAnyExtras) return null;

          return (
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
              <h3 className="font-sans font-bold text-zinc-900 text-lg mb-4 pb-2 border-b border-zinc-100 flex items-center gap-2">
                {language === 'ca' ? '🎀 Comandes i Complements Addicionals (Opcional)' : '🎀 Pedidos y Complementos Adicionales (Opcional)'}
              </h3>
              <p className="text-zinc-500 text-xs mb-6">
                {language === 'ca' ? 'Podeu equipar la vostra parella o afegir complements oficials de l\'entitat.' : 'Podéis equipar a vuestra pareja o añadir complementos oficiales de la entidad.'}
              </p>

              <div className="space-y-6">
                {domasTarifaObj.actiu && (
                  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="space-y-0.5">
                      <h4 className="font-sans font-bold text-sm text-zinc-800">
                        {language === 'ca' ? 'Domàs per al Balcó de les Comparses' : 'Colgadura para el Balcón de las Comparsas'}
                      </h4>
                      <p className="text-zinc-500 text-xs">
                        {language === 'ca' 
                          ? 'Penja l\'orgull fúcsia d\'El Tast al teu balcó el cap de setmana de carnaval.' 
                          : 'Cuelga el orgullo fucsia de El Tast en tu balcón el fin de semana de carnaval.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-sans font-bold text-sm text-zinc-950">+{domasTarifaObj.valor}€</span>
                      <input 
                        type="checkbox" 
                        checked={teDomasBalco}
                        onChange={(e) => setTeDomasBalco(e.target.checked)}
                        className="w-5 h-5 rounded text-fuchsia-500 outline-none accent-fuchsia-500 cursor-pointer"
                        id="checkbox-domas"
                      />
                    </div>
                  </div>
                )}

                {mocadorTarifaObj.actiu && (
                  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="space-y-0.5">
                      <h4 className="font-sans font-bold text-sm text-zinc-800">
                        {language === 'ca' ? 'Mocadors oficials addicionals' : 'Pañuelos oficiales adicionales'}
                      </h4>
                      <p className="text-zinc-500 text-xs">
                        {language === 'ca'
                          ? 'Mocador gran de fil de la colla per a amics, fills o familiars que animen.'
                          : 'Pañuelo grande de hilo de la colla para amigos, hijos o familiares que animan.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-sans font-bold text-sm text-zinc-950 mr-2">+{mocadorTarifaObj.valor}€ / u.</span>
                      <button
                        type="button"
                        onClick={() => setTeMocadorsExtra(prev => Math.max(0, prev - 1))}
                        className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 font-bold text-zinc-700 transition"
                        id="btn-remove-mocador"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-mono font-bold text-sm text-zinc-900 w-6 text-center">{teMocadorsExtra}</span>
                      <button
                        type="button"
                        onClick={() => setTeMocadorsExtra(prev => prev + 1)}
                        className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 font-bold text-zinc-700 transition"
                        id="btn-add-mocador"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Newly added customizable payment/rate lines */}
                {genericExtras.map((extr) => (
                  <div key={extr.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="space-y-0.5">
                      <h4 className="font-sans font-bold text-sm text-zinc-850">{extr.nom}</h4>
                      <p className="text-zinc-500 text-xs">
                        {language === 'ca' 
                          ? "Complement addicional configurat per l'administració de l'entitat." 
                          : "Complemento adicional configurado por la administración de la entidad."}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-sans font-bold text-sm text-zinc-950">+{extr.valor}€</span>
                      <input 
                        type="checkbox" 
                        checked={!!genericExtrasSelected[extr.id]}
                        onChange={(e) => setGenericExtrasSelected(prev => ({ ...prev, [extr.id]: e.target.checked }))}
                        className="w-5 h-5 rounded text-fuchsia-500 outline-none accent-fuchsia-500 cursor-pointer"
                        id={`checkbox-extra-${extr.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Legal RGPD and Payment policy */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-start gap-3 p-4 bg-zinc-50 border border-zinc-200 hover:border-fuchsia-300 rounded-2xl transition-all shadow-sm">
            <input 
              type="checkbox" 
              checked={acceptaRGPD}
              onChange={(e) => setAcceptaRGPD(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-fuchsia-500 outline-none accent-fuchsia-500 cursor-pointer shrink-0"
              id="checkbox-rgpd"
            />
            <div className="space-y-1 bg-transparent">
              <p className="text-xs text-zinc-700 font-sans leading-relaxed">
                {language === 'ca'
                  ? "Accepto que l'Associació Cultural El Tast tracti les meves dades i arxius dels DNIs exclusivament per a la finalitat de validar legalment la pertinença a les comparses 2026. Els fitxers s'eliminaran del servidor acabada la jornada festiva l'acord amb la RGPD europea. *"
                  : "Acepto que la Associació Cultural El Tast trate mis datos y archivos de los DNIs exclusivamente para la finalidad de validar legalmente la pertenencia a las comparsas 2026. Los archivos se eliminarán del servidor al finalizar la jornada festiva de acuerdo con la RGPD europea. *"}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase font-mono tracking-tight flex items-center gap-1" title={language === 'ca' ? "Sota protecció de dades xifrades" : "Bajo protección de datos cifrados"}>
                  <Database size={8} /> RGPD BBDD SECURE
                </span>
                <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded uppercase font-mono tracking-tight">
                  {language === 'ca' ? "Eliminació automàtica" : "Remoción automática"}
                </span>
              </div>
              {errors.rgpd && <p className="text-red-500 text-[10px] font-mono mt-0.5">{errors.rgpd}</p>}
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-zinc-50 border border-zinc-200 hover:border-fuchsia-300 rounded-2xl transition-all shadow-sm">
            <input 
              type="checkbox" 
              checked={acceptaPresencial}
              onChange={(e) => setAcceptaPresencial(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-fuchsia-500 outline-none accent-fuchsia-500 cursor-pointer shrink-0"
              id="checkbox-presencial"
            />
            <div className="space-y-1 bg-transparent">
              <p className="text-xs text-zinc-700 font-sans leading-relaxed font-semibold">
                {language === 'ca'
                  ? "Accepto que la formalització del pagament (metàl·lic o Bizum de la colla) i la recollida del material d'armilles i mocadors es farà obligatòriament de forma presencial a la secretaria del local d'El Tast presentant el codi QR de preinscripció enviat per correu. *"
                  : "Acepto que la formalización del pago (metálico o Bizum de la colla) y la recogida del material de chalecos y pañuelos se realizará obligatoriamente de forma presencial en la secretaría del local de El Tast presentando el código QR de preinscripción enviado por correo. *"}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[9px] font-bold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-100 px-1.5 py-0.5 rounded uppercase font-mono tracking-tight flex items-center gap-1">
                  🔒 VERIFICACIÓ PRESENCIAL
                </span>
              </div>
              {errors.presencial && <p className="text-red-500 text-[10px] font-mono mt-0.5">{errors.presencial}</p>}
            </div>
          </div>
        </div>

        {/* Floating action bar with prices breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-white flex flex-col sm:flex-row justify-between items-center gap-6 sticky bottom-4 z-40 backdrop-blur-md bg-zinc-900/95">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-zinc-400 text-xs font-mono uppercase tracking-wider">
              {language === 'ca' ? 'RESUM ECONÒMIC DE LA PARELLA' : 'RESUMEN ECONÓMICO DE LA PAREJA'}
            </p>
            <div className="flex flex-wrap items-baseline gap-2 justify-center sm:justify-start">
              <span className="font-sans font-extrabold text-3xl md:text-4xl text-fuchsia-400">{totalCalculat}€</span>
              <span className="text-zinc-400 text-xs font-mono">
                ({categoria === CategoriaParella.ADULT ? (language === 'ca' ? 'Adults' : 'Adultos') : (language === 'ca' ? 'Juvenil' : 'Juvenil')}: {basePrice}€
                {teDomasBalco ? ` + ${language === 'ca' ? 'Domàs' : 'Colgadura'}: ${config.preuDomasBalco}€` : ''}
                {teMocadorsExtra > 0 ? ` + ${teMocadorsExtra} ${language === 'ca' ? 'mocadors' : 'pañuelos'}: ${mocadorsCost}€` : ''})
              </span>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full sm:w-auto px-8 py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-2xl shadow-lg shadow-fuchsia-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
          >
            {t('submit_btn')} <ShieldCheck size={18} />
          </button>
        </div>
      </form>
      )}

      {/* Camera Live/Mock Modal Screen Overlay */}
      <AnimatePresence>
        {cameraActive && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center"
            id="camera-overlay"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-lg w-full relative">
              <h3 className="font-sans font-bold text-white text-lg mb-1 tracking-tight">
                {language === 'ca' ? 'Capturadora de DNI' : 'Capturadora de DNI'}
              </h3>
              <p className="text-zinc-400 text-xs mb-4">
                {language === 'ca' 
                  ? "Centreu el document nacional d'identitat (part davantera) dins el quadre." 
                  : "Centre el documento nacional de identidad (parte delantera) dentro del recuadro."}
              </p>

              {/* Viewfinder stage */}
              <div className="relative aspect-[16/10] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center mb-6">
                {videoError ? (
                  <div className="p-6 text-center">
                    <AlertTriangle className="mx-auto text-amber-500 mb-2" size={28} />
                    <p className="text-xs text-zinc-300 mb-4">{videoError}</p>
                    <button 
                      type="button"
                      onClick={simulateCapture}
                      className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
                      id="btn-simulate-dni"
                    >
                      {language === 'ca' ? "Simular captura amb foto d'exemple" : "Simular captura con foto de ejemplo"}
                    </button>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="absolute inset-0 object-cover w-full h-full"
                    />
                    {/* Visual Crop Guide overlay */}
                    <div className="absolute inset-4 border-2 border-dashed border-fuchsia-500/80 rounded-xl pointer-events-none flex items-center justify-center">
                      <div className="text-[10px] bg-fuchsia-500/90 text-white font-bold px-2 py-1 rounded tracking-widest uppercase font-mono">
                        {language === 'ca' ? 'EMQUADREU DNI FRONT' : 'ENCUADRE DNI FRONTAL'}
                      </div>
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                  id="btn-cancel-camera"
                >
                  {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
                </button>
                {!videoError && (
                  <button 
                    type="button"
                    onClick={capturePhoto}
                    className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-fuchsia-600/30 transition flex items-center gap-1.5 cursor-pointer"
                    id="btn-capture-camera"
                  >
                    <Camera size={14} /> {language === 'ca' ? 'Fes la foto del DNI' : 'Hacer foto del DNI'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
