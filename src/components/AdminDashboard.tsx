/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Key,
  Mail,
  Send,
  Sparkles,
  Share2,
  AlertCircle,
  ExternalLink,
  Globe,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { Inscripcio, CategoriaParella, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, SistemaConfig, StaffMember, NoticiaXarxes } from '../types';
import ExcelJS from 'exceljs';
import AdminPortada from './AdminPortada';
import AdminPersonalitzacio from './AdminPersonalitzacio';
import { calculateDailySummaries } from '../dailySummary';

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
  noticies?: NoticiaXarxes[];
  onSaveNoticies?: (updatedNoticies: NoticiaXarxes[]) => void;
  onSaveInscripcio?: (updatedReg: Inscripcio) => void;
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
  onAddInscripcioManual,
  noticies = [],
  onSaveNoticies,
  onSaveInscripcio
}: AdminDashboardProps) {
  const { language, t } = useLanguage();
  
  // Admin Tabs Navigation State
  const [activePanelTab, setActivePanelTab] = useState<'inscripcions' | 'smtp' | 'xarxes' | 'portada' | 'personalitzacio' | 'cierre'>('inscripcions');

  // State to track SMTP sending status of specific rows
  const [rowSmtpSending, setRowSmtpSending] = useState<Record<string, 'sending' | 'success' | 'error'>>({});

  // SMTP state hooks
  const [smtpHost, setSmtpHost] = useState(() => localStorage.getItem('tast_smtp_host') || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(() => localStorage.getItem('tast_smtp_port') || '587');
  const [smtpUsuari, setSmtpUsuari] = useState(() => localStorage.getItem('tast_smtp_usuari') || 'tastvng@gmail.com');
  const [smtpContrasenya, setSmtpContrasenya] = useState(() => localStorage.getItem('tast_smtp_contrasenya') || '');
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpTestDestinatari, setSmtpTestDestinatari] = useState('Tastvng@gmail.com');
  const [smtpTestStatus, setSmtpTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [smtpTestMsg, setSmtpTestMsg] = useState('');
  const [smtpSaveSuccess, setSmtpSaveSuccess] = useState(false);

  // Social Network integrations channels
  const [scInstagramConnected, setScInstagramConnected] = useState(() => localStorage.getItem('tast_sc_instagram_connected') === 'true');
  const [scInstagramHandle, setScInstagramHandle] = useState(() => localStorage.getItem('tast_sc_instagram_handle') || '@eltastvng');
  const [scFacebookConnected, setScFacebookConnected] = useState(() => localStorage.getItem('tast_sc_facebook_connected') === 'true');
  const [scFacebookHandle, setScFacebookHandle] = useState(() => localStorage.getItem('tast_sc_facebook_handle') || 'Associació Cultural El Tast');
  const [scTikTokConnected, setScTikTokConnected] = useState(() => localStorage.getItem('tast_sc_tiktok_connected') === 'true');
  const [scTikTokHandle, setScTikTokHandle] = useState(() => localStorage.getItem('tast_sc_tiktok_handle') || '@eltast_vng');

  // Simulated Connect popup modal state
  const [showConnectModal, setShowConnectModal] = useState<string | null>(null); // 'instagram' | 'facebook' | 'tiktok'
  const [connectUsername, setConnectUsername] = useState('');
  const [connectPassword, setConnectPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Social Publisher state hooks
  const [socialPostText, setSocialPostText] = useState('');
  const [socialPostPlatform, setSocialPostPlatform] = useState<'instagram' | 'facebook' | 'tiktok'>('instagram');
  const [socialPostMediaPreset, setSocialPostMediaPreset] = useState('caramels');
  const [socialPublishSuccess, setSocialPublishSuccess] = useState(false);
  const [socialPostLikes, setSocialPostLikes] = useState(150);

  // Media presets dictionary
  const mediaPresets: Record<string, string> = {
    caramels: 'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?q=80&w=800&auto=format&fit=crop',
    armilles: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
    placa: 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop',
    platja: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop'
  };

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('ALL');
  const [filterPagament, setFilterPagament] = useState<string>('ALL');
  const [filterDni, setFilterDni] = useState<string>('ALL');
  const [filterEntrega, setFilterEntrega] = useState<string>('ALL');
  const [filterEstat, setFilterEstat] = useState<string>('ALL');
  const [filterBandera, setFilterBandera] = useState<string>('ALL');

  // Bulk and complete deletion helpers
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
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
      { id: 'st-1', nom: 'Tast VNG (Admin)', usuari: 'tastvng@gmail.com', rol: 'SuperAdministrador', contrasenya: 'eltast2026', creadoEn: '01/01/2026', actiu: true },
      { id: 'st-2', nom: 'Jordi Altiplà', usuari: 'jordia', rol: 'Coordinador', contrasenya: 'jordia123', creadoEn: '02/02/2026', actiu: true },
      { id: 'st-3', nom: 'Mireia VNG', usuari: 'mireiav', rol: 'Mesa d\'Entrega', contrasenya: 'mireia99', creadoEn: '15/03/2026', actiu: true }
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

  // Synchronize administrative configurations with Supabase Settings
  useEffect(() => {
    async function loadAdminSettings() {
      try {
        const { isSupabaseConfigured, getSupabaseSetting } = await import('../supabaseClient');
        if (!isSupabaseConfigured) return;

        const host = await getSupabaseSetting('tast_smtp_host', '');
        const port = await getSupabaseSetting('tast_smtp_port', '');
        const user = await getSupabaseSetting('tast_smtp_usuari', '');
        const pass = await getSupabaseSetting('tast_smtp_contrasenya', '');

        if (host) setSmtpHost(host);
        if (port) setSmtpPort(port);
        if (user) setSmtpUsuari(user);
        if (pass) setSmtpContrasenya(pass);

        const instConn = await getSupabaseSetting('tast_sc_instagram_connected', '');
        const instHnd = await getSupabaseSetting('tast_sc_instagram_handle', '');
        const fbConn = await getSupabaseSetting('tast_sc_facebook_connected', '');
        const fbHnd = await getSupabaseSetting('tast_sc_facebook_handle', '');
        const tkConn = await getSupabaseSetting('tast_sc_tiktok_connected', '');
        const tkHnd = await getSupabaseSetting('tast_sc_tiktok_handle', '');

        if (instConn !== null && instConn !== '') setScInstagramConnected(instConn === 'true');
        if (instHnd) setScInstagramHandle(instHnd);
        if (fbConn !== null && fbConn !== '') setScFacebookConnected(fbConn === 'true');
        if (fbHnd) setScFacebookHandle(fbHnd);
        if (tkConn !== null && tkConn !== '') setScTikTokConnected(tkConn === 'true');
        if (tkHnd) setScTikTokHandle(tkHnd);

        const staff = await getSupabaseSetting<StaffMember[] | null>('tast_staff_2026', null);
        if (staff && staff.length > 0) {
          setStaffList(staff);
          localStorage.setItem('tast_staff_2026', JSON.stringify(staff));
        }
      } catch (err) {
        console.error("Failed to load admin settings from Supabase:", err);
      }
    }
    loadAdminSettings();
  }, []);

  // Manual confirmation email resender with robust CID logo embedding to prevent blank emails
  const handleResendEmail = async (item: Inscripcio) => {
    setRowSmtpSending(prev => ({ ...prev, [item.id]: 'sending' }));

    try {
      const emailList = [item.c1Email, item.c2Email].filter(Boolean).filter(email => email.includes('@'));
      if (emailList.length === 0) {
        alert(language === 'ca' ? "No s'ha trobat cap adreça de correu vàlida per als participants." : "No se encontró ninguna dirección de correo válida para los participantes.");
        setRowSmtpSending(prev => ({ ...prev, [item.id]: 'error' }));
        return;
      }

      const evName = localStorage.getItem('tast_nom_esdeveniment') || 'Carnaval 2027';
      const evAddr = localStorage.getItem('tast_direccio_esdeveniment') || 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú';
      const evHoursCa = localStorage.getItem('tast_secretaria_hours_ca') || "Dimecres i divendres, de 18:00h a 21:30h.";
      const evHoursEs = localStorage.getItem('tast_secretaria_hours_es') || "Miércoles y viernes, de 18:00h a 21:30h.";
      const smtpUsuariVal = localStorage.getItem('tast_smtp_usuari') || "tastvng@gmail.com";

      const emailSubjectCa = localStorage.getItem('tast_email_subject_ca') || `🎟️ El Tast ${evName} - Confirmació d'Inscripció`;
      const emailSubjectEs = localStorage.getItem('tast_email_subject_es') || `🎟️ El Tast ${evName} - Confirmación de Inscripción`;
      const emailSubject = `${language === 'ca' ? emailSubjectCa : emailSubjectEs} ${item.codiSeguiment}`;

      const emailBodyText = language === 'ca' 
        ? (localStorage.getItem('tast_email_body_ca') || `S'ha generat correctament el vostre comprovant per a ${evName}.`)
        : (localStorage.getItem('tast_email_body_es') || `Se ha generado correctamente vuestro comprobante para ${evName}.`);

      const subLogo = localStorage.getItem('tast_email_logo') || "";
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

      const extrasHtml = `
        ${item.teDomasBalco ? `<li>• 1x ${language === 'ca' ? 'Domàs de Balcó (Domás de Balcón)' : 'Colgadura de Balcón'}</li>` : ''}
        ${item.teMocadorsExtra > 0 ? `<li>• ${item.teMocadorsExtra}x ${language === 'ca' ? 'Mocador oficial extra (Pañuelo extra)' : 'Pañuelo oficial extra'}</li>` : ''}
      `;

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
              ${item.codiSeguiment}
            </p>
          </div>

          <!-- QR Container -->
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; padding: 15px; background-color: #f8f9fa; border: 1px solid #e1e1e6; border-radius: 20px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(item.id)}" 
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
                  ${item.c1Nom} &amp; ${item.c2Nom}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666670; font-weight: bold; text-transform: uppercase; font-size: 11px;">
                  ${language === 'ca' ? 'Categoria (Categoría):' : 'Categoría:'}
                </td>
                <td style="padding: 8px 0; text-align: right; color: #111115; font-family: monospace;">
                  ${item.categoria === CategoriaParella.ADULT 
                    ? (language === 'ca' ? 'PARELLA ADULTA' : 'PAREJA ADULTA') 
                    : (language === 'ca' ? 'PARELLA JUVENIL' : 'PAREJA JUVENIL')}
                </td>
              </tr>
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
                  ${item.preuCalculat}€
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
                ${language === 'ca' ? evHoursCa : evHoursEs}
              </p>
            </div>
          </div>

          <div style="border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center;">
            <p style="font-size: 11px; color: #99999f; margin: 0; line-height: 1.5;">
              <strong>Associació Cultural El Tast de Vilanova i la Geltrú</strong><br/>
              ${evAddr} &bull; <a href="mailto:${smtpUsuariVal}" style="color: #ff0090; text-decoration: none;">${smtpUsuariVal}</a>
            </p>
          </div>
        </div>
      `;

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
          errorsList.push(errText);
        }
      }

      if (errorsList.length === 0) {
        setRowSmtpSending(prev => ({ ...prev, [item.id]: 'success' }));
        if (onAddLog) {
          onAddLog(`📧 SMTP: Correu de confirmació manual enviat correctament a ${emailList.join(', ')}`);
        }
        if (onSaveInscripcio) {
          onSaveInscripcio({
            ...item,
            respostesCuestionari: {
              ...item.respostesCuestionari,
              estatCorreu: 'enviat'
            }
          });
        }
      } else {
        throw new Error(errorsList.join(', '));
      }
    } catch (err: any) {
      console.error(err);
      setRowSmtpSending(prev => ({ ...prev, [item.id]: 'error' }));
      if (onAddLog) {
        onAddLog(`⚠️ Error SMTP manual per a ${item.codiSeguiment}: ${err.message || err}`);
      }
      if (onSaveInscripcio) {
        onSaveInscripcio({
          ...item,
          respostesCuestionari: {
            ...item.respostesCuestionari,
            estatCorreu: 'fallat'
          }
        });
      }
    }
  };

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

  // Save SMTP server settings to LocalStorage & Supabase settings
  const handleSaveSmtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    localStorage.setItem('tast_smtp_host', smtpHost);
    localStorage.setItem('tast_smtp_port', smtpPort);
    localStorage.setItem('tast_smtp_usuari', smtpUsuari);
    localStorage.setItem('tast_smtp_contrasenya', smtpContrasenya);

    try {
      const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
      if (isSupabaseConfigured) {
        await saveSupabaseSetting('tast_smtp_host', smtpHost);
        await saveSupabaseSetting('tast_smtp_port', smtpPort);
        await saveSupabaseSetting('tast_smtp_usuari', smtpUsuari);
        await saveSupabaseSetting('tast_smtp_contrasenya', smtpContrasenya);
      }
    } catch (err) {}

    setSmtpSaveSuccess(true);
    if (onAddLog) {
      onAddLog(language === 'ca'
        ? `⚙️ Servidor SMTP configurat: ${smtpUsuari} (${smtpHost}:${smtpPort})`
        : `⚙️ Servidor SMTP configurado: ${smtpUsuari} (${smtpHost}:${smtpPort})`
      );
    }
    setTimeout(() => setSmtpSaveSuccess(false), 4000);
  };

  // Test send mail with SMTP server
  const handleTestSmtp = async () => {
    if (!smtpTestDestinatari.trim()) {
      setSmtpTestStatus('error');
      setSmtpTestMsg(language === 'ca' 
        ? "Si us plau, introduïu una adreça de correu de destí per fer la prova."
        : "Por favor, introduzca una dirección de correo de destino para realizar la prueba."
      );
      return;
    }

    setSmtpTestStatus('loading');
    setSmtpTestMsg('');

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailData: {
            to: smtpTestDestinatari.trim(),
            subject: language === 'ca' ? "Provador de Connexió SMTP - El Tast" : "Probador de Conexión SMTP - El Tast",
            html: `
              <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e1e1e6; border-radius: 20px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <span style="background-color: #ff0090; color: #ffffff; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 12px; letter-spacing: 1px; display: inline-block; text-transform: uppercase;">
                    El Tast 2026
                  </span>
                </div>
                <h2 style="color: #111115; font-size: 22px; font-weight: 800; text-align: center; margin-top: 15px; text-transform: uppercase;">
                  ${language === 'ca' ? "Connexió SMTP Reeixida" : "Conexión SMTP Exitosa"}
                </h2>
                <div style="border-top: 2px solid #ff0090; margin: 20px 0;"></div>
                <p style="font-size: 14px; line-height: 1.6; color: #333333;">
                  ${language === 'ca'
                    ? "Hola! Aquest és un correu real enviat de manera automàtica pel sistema d'inscripcions de la teva entitat <strong>El Tast de Vilanova i la Geltrú</strong> per comprovar el servei SMTP d'enviaments."
                    : "¡Hola! Este es un correo real enviado de manera automática por el sistema de inscripciones de tu entidad <strong>El Tast de Vilanova i la Geltrú</strong> para comprobar el servicio SMTP de envíos."}
                </p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 14px; font-family: monospace; font-size: 12px; border: 1px solid #ebd4e0; color: #333333; margin: 25px 0;">
                  <strong style="color: #ff0090;">⚙️ DETALLS DE CONNEXIÓ:</strong><br/>
                  • Servidor: Configurat de forma segura a les variables d'entorn de servidor (SMTP_HOST)<br/>
                  • Data/Hora: ${new Date().toLocaleString()}<br/>
                  • Canal de seguretat: TLS Cryptographic Tunnel Actiu
                </div>
                <p style="font-size: 14px; line-height: 1.6; color: #333333;">
                  ${language === 'ca'
                    ? "Com que has rebut aquest missatge electrònic correctament, el canal SMTP està llest. A partir d'ara, els teus usuaris rebran automàticament els seus PDF/QR oficials d'inscripció al seu correu de forma instantània!"
                    : "Puesto que has recibido este mensaje electrónico correctamente, el canal SMTP está listo. ¡A partir de ahora, tus usuarios recibirán automáticamente sus PDF/QR oficiales de inscripción en su correo de forma instantánea!"}
                </p>
                <div style="border-top: 1px solid #eaeaea; margin: 25px 0; padding-top: 15px; text-align: center;">
                  <p style="font-size: 11px; color: #999999; margin: 0;">
                    Desenvolupat per a l'Associació Cultural El Tast de Vilanova i la Geltrú.<br/>
                    Aquest és un correu de control tècnic autoritzat pel vostre propio SMTP.
                  </p>
                </div>
              </div>
            `
          }
        })
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(responseText.substring(0, 150) || `HTTP Error ${response.status}`);
      }

      if (response.ok && data.success) {
        setSmtpTestStatus('success');
        setSmtpTestMsg(language === 'ca'
          ? `Connexió de prova reeixida! S'ha enviat un correu real a ${smtpTestDestinatari || smtpUsuari} (MessageID: ${data.messageId}).`
          : `¡Conexión de prueba exitosa! Se ha enviado un correo real a ${smtpTestDestinatari || smtpUsuari} (MessageID: ${data.messageId}).`
        );
        if (onAddLog) {
          onAddLog(`📧 SMTP Real Test: S'ha enviat correctament un correu real a ${smtpTestDestinatari || smtpUsuari}`);
        }
      } else {
        setSmtpTestStatus('error');
        setSmtpTestMsg(language === 'ca'
          ? `Error al connectar/autenticar en el servidor SMTP: ${data.error || 'Detall desconegut'}`
          : `Error al conectar/autenticar en el servidor SMTP: ${data.error || 'Detalle desconocido'}`
        );
      }
    } catch (err: any) {
      console.error("Test SMTP error:", err);
      setSmtpTestStatus('error');
      setSmtpTestMsg(language === 'ca'
        ? `Error de xarxa en provar SMTP backend: ${err.message || err}`
        : `Error de red al probar SMTP backend: ${err.message || err}`
      );
    }
  };

  // Open oauth simulation modal
  const handleOpenConnect = (platform: string) => {
    setShowConnectModal(platform);
    setConnectUsername(
      platform === 'instagram' ? scInstagramHandle :
      platform === 'facebook' ? scFacebookHandle : scTikTokHandle
    );
    setConnectPassword('');
  };

  // Connect social platform via mock oauth flow
  const handleConfirmConnectSocial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectUsername.trim()) return;

    setIsConnecting(true);

    setTimeout(() => {
      setIsConnecting(false);
      const target = showConnectModal;
      if (target === 'instagram') {
        setScInstagramConnected(true);
        setScInstagramHandle(connectUsername);
        localStorage.setItem('tast_sc_instagram_connected', 'true');
        localStorage.setItem('tast_sc_instagram_handle', connectUsername);
      } else if (target === 'facebook') {
        setScFacebookConnected(true);
        setScFacebookHandle(connectUsername);
        localStorage.setItem('tast_sc_facebook_connected', 'true');
        localStorage.setItem('tast_sc_facebook_handle', connectUsername);
      } else if (target === 'tiktok') {
        setScTikTokConnected(true);
        setScTikTokHandle(connectUsername);
        localStorage.setItem('tast_sc_tiktok_connected', 'true');
        localStorage.setItem('tast_sc_tiktok_handle', connectUsername);
      }

      if (onAddLog) {
        onAddLog(language === 'ca'
          ? `🔗 Canal ${target?.toUpperCase()} connectat correctament: ${connectUsername}`
          : `🔗 Canal ${target?.toUpperCase()} conectado correctamente: ${connectUsername}`
        );
      }

      setShowConnectModal(null);
    }, 1500);
  };

  // Disconnect social channel
  const handleDisconnectSocial = (platform: string) => {
    if (platform === 'instagram') {
      setScInstagramConnected(false);
      localStorage.setItem('tast_sc_instagram_connected', 'false');
    } else if (platform === 'facebook') {
      setScFacebookConnected(false);
      localStorage.setItem('tast_sc_facebook_connected', 'false');
    } else if (platform === 'tiktok') {
      setScTikTokConnected(false);
      localStorage.setItem('tast_sc_tiktok_connected', 'false');
    }

    if (onAddLog) {
      onAddLog(language === 'ca'
        ? `🔌 Canal ${platform.toUpperCase()} desconnectat.`
        : `🔌 Canal ${platform.toUpperCase()} desconectado.`
      );
    }
  };

  // Publish interactive Social post and sync to NotificationFeed!
  const handlePublishSocialPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialPostText.trim()) return;

    // Check if the platform is connected first
    const isConn = 
      socialPostPlatform === 'instagram' ? scInstagramConnected :
      socialPostPlatform === 'facebook' ? scFacebookConnected : scTikTokConnected;

    if (!isConn) {
      alert(language === 'ca'
        ? `Si us plau, connecta primer el canal d'${socialPostPlatform.toUpperCase()} per permetre la publicació i sincronització automàtica.`
        : `Por favor, conecta primero el canal de ${socialPostPlatform.toUpperCase()} para permitir la publicación y sincronización automática.`
      );
      return;
    }

    const currentHandle = 
      socialPostPlatform === 'instagram' ? scInstagramHandle :
      socialPostPlatform === 'facebook' ? scFacebookHandle : scTikTokHandle;

    const newPostId = 'not-pub-' + Math.floor(Math.random() * 100000);
    const newPost: NoticiaXarxes = {
      id: newPostId,
      xarxa: socialPostPlatform,
      usuari: currentHandle,
      text: socialPostText,
      imatgeUrl: mediaPresets[socialPostMediaPreset] || mediaPresets.caramels,
      dataPublicacio: language === 'ca' ? "Fa uns instants" : "Hace unos instantes",
      enllacUrl: `https://${socialPostPlatform}.com/${currentHandle.replace('@', '')}`,
      likes: socialPostLikes
    };

    const updatedNoticies = [newPost, ...noticies];
    if (onSaveNoticies) {
      onSaveNoticies(updatedNoticies);
    } else {
      localStorage.setItem('tast_noticies_2026', JSON.stringify(updatedNoticies));
    }

    setSocialPostText('');
    setSocialPublishSuccess(true);
    if (onAddLog) {
      onAddLog(language === 'ca'
        ? `📢 S'ha publicat un post a ${socialPostPlatform.toUpperCase()} i s'ha reflectit automàticament a la web!`
        : `📢 ¡Se ha publicado un post en ${socialPostPlatform.toUpperCase()} y se ha reflejado automáticamente en la web!`
      );
    }

    setTimeout(() => setSocialPublishSuccess(false), 4000);
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newC1Nom.trim() || !newC2Nom.trim()) {
      alert("Si us plau, omple com a mínim els noms de tots dos participants.");
      return;
    }

    const countCategory = inscripcions.filter(ins => ins.categoria === newCategoria).length;
    const prefix = newCategoria === CategoriaParella.ADULT ? 'A' : 'J';
    const tracker = `${prefix}-${countCategory + 1}`;

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

  const handleAddStaffMember = async (e: React.FormEvent) => {
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
    try {
      const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
      if (isSupabaseConfigured) {
        await saveSupabaseSetting('tast_staff_2026', updated);
      }
    } catch (err) {}
    window.dispatchEvent(new Event('staffChanged'));

    if (onAddLog) {
      onAddLog(`S'ha afegit ${newStaffNom} (${newStaffRol}) al personal d'administració i s'ha desat al núvol.`);
    }

    // Reset fields
    setNewStaffNom('');
    setNewStaffUsuari('');
    setNewStaffContrasenya('');
    setNewStaffRol('Secretaria');
  };

  const handleUpdateStaffRol = async (id: string, rol: 'SuperAdministrador' | 'Secretaria' | 'Mesa d\'Entrega' | 'Coordinador') => {
    const updated = staffList.map(s => s.id === id ? { ...s, rol } : s);
    setStaffList(updated);
    localStorage.setItem('tast_staff_2026', JSON.stringify(updated));
    try {
      const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
      if (isSupabaseConfigured) {
        await saveSupabaseSetting('tast_staff_2026', updated);
      }
    } catch (err) {}
    window.dispatchEvent(new Event('staffChanged'));
    if (onAddLog) {
      onAddLog(`S'ha canviat el rol del perfil d'administrador i actualitzat a Supabase.`);
    }
  };

  const handleToggleStaffActiu = async (id: string) => {
    const updated = staffList.map(s => s.id === id ? { ...s, actiu: !s.actiu } : s);
    setStaffList(updated);
    localStorage.setItem('tast_staff_2026', JSON.stringify(updated));
    try {
      const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
      if (isSupabaseConfigured) {
        await saveSupabaseSetting('tast_staff_2026', updated);
      }
    } catch (err) {}
    window.dispatchEvent(new Event('staffChanged'));
    if (onAddLog) {
      onAddLog(`Estat d'accés del perfil de staff modificat i sincronitzat amb Supabase.`);
    }
  };

  const handleRemoveStaffMember = async (id: string, name: string) => {
    if (deleteConfirmId === id) {
      const updated = staffList.filter(s => s.id !== id);
      setStaffList(updated);
      localStorage.setItem('tast_staff_2026', JSON.stringify(updated));
      try {
        const { isSupabaseConfigured, saveSupabaseSetting } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          await saveSupabaseSetting('tast_staff_2026', updated);
        }
      } catch (err) {}
      window.dispatchEvent(new Event('staffChanged'));
      if (onAddLog) {
        onAddLog(`Retirat ${name} del canal de personal habilitat i sincronitzat amb Supabase.`);
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
  const esperaCount = inscripcions.filter(i => i.llistaEspera).length;
  
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

    // Estat filter
    const matchesEstat = filterEstat === 'ALL' || 
      (filterEstat === 'OBERTA' && (item.estatInscripcio === 'obertes' || (!item.estatInscripcio && !item.llistaEspera))) ||
      (filterEstat === 'ESPERA' && (item.estatInscripcio === 'llista_espera' || (!item.estatInscripcio && item.llistaEspera)));

    // Bandera filter
    const matchesBandera = filterBandera === 'ALL' ||
      (filterBandera === '0' && (!item.bandera || item.bandera === 0)) ||
      (filterBandera === '1' && item.bandera === 1) ||
      (filterBandera === '2' && item.bandera === 2) ||
      (filterBandera === '3' && item.bandera === 3);

    return matchesSearch && matchesCategoria && matchesPagament && matchesDni && matchesEntrega && matchesEstat && matchesBandera;
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
      const now = new Date();
      console.warn(
        `[AVÍS DE SEGURETAT - BUIDAT DE BASE DE DADES]\nFecha: ${now.toLocaleDateString()}\nHora: ${now.toLocaleTimeString()}\nS'estan esborrant un total de ${inscripcions.length} registres de la taula 'inscripciones'.\nTinent l'ordre de buidar completament la base de dades activa.`
      );
      onClearAllInscripcions();
      setSelectedIds([]);
      setShowClearConfirmModal(false);
      setClearConfirmText('');
    }
  };

  // Client-side Excel download representing true Excel .xlsx sheet export
  const exportToExcel = async () => {
    if (filteredInscripcions.length === 0) {
      alert("No hi ha dades seleccionades per exportar.");
      return;
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("COMPARSA 2026");

    // Define headers in Valencian / Catalan
    const headers = [
      'Marca temporal',
      'Dirección de correo electrónico',
      'PAREJA',
      'BANDERA',
      'NOM I COGNOM COMPARSER',
      'NOM I COGNOM COMPARSERA',
      'TELÈFON',
      'CORREU ELECTRÒNIC',
      'PREU PARELLA',
      'ARMILLA',
      'PREU ARMILLA',
      'TALLA ARMILLA (En el cas de Compra o lloguer)',
      'CLAVELLS',
      'PRE U CLA VEL S',
      'CORBATÍ',
      'PRE U COR BATI',
      'ESMO RZAR',
      'PREU ESMORZ AR',
      'TOTAL A PAGAR',
      'PAGAT',
      'PDTE. PAG',
      'FORMA PAGAMENT',
      'M',
      'FECHA INSCRIPCIÓN',
      'PREPARADO',
      'ENTREGADO',
      'ENVI O WHATS',
      'FIN INSCPCION',
      'PULSERA',
      'ENVIADO MAIL CONF. PREENS',
      'Bandera assignada'
    ];

    // Add header row
    const headerRow = ws.addRow(headers);
    
    // Style header row
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4B0082' } // Dark purple #4B0082
      };
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' } // White
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF3B006C' } },
        left: { style: 'thin', color: { argb: 'FF3B006C' } },
        bottom: { style: 'thin', color: { argb: 'FF3B006C' } },
        right: { style: 'thin', color: { argb: 'FF3B006C' } }
      };
    });

    // Enable filters on all columns
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 31 }
    };

    // Helper for dynamic concept values
    const getExtraInfo = (i: Inscripcio, nameRegex: RegExp) => {
      // 1. Search in extresSeleccionats
      const foundInSel = (i.extresSeleccionats || []).find(e => nameRegex.test(e.nom));
      if (foundInSel) {
        return {
          qty: foundInSel.quantitat,
          price: foundInSel.preuUnitari,
          total: foundInSel.quantitat * foundInSel.preuUnitari
        };
      }
      // 2. Search in respostesCuestionari keys
      const qtyKey = Object.keys(i.respostesCuestionari || {}).find(k => {
        if (k.startsWith('extra_qty_')) {
          const extraId = k.replace('extra_qty_', '');
          const extraDef = config?.tarifesDinamiques?.find((t: any) => t.id === extraId);
          return extraDef && nameRegex.test(extraDef.nom);
        }
        return false;
      });
      if (qtyKey) {
        const extraId = qtyKey.replace('extra_qty_', '');
        const extraDef = config?.tarifesDinamiques?.find((t: any) => t.id === extraId);
        const qty = Number(i.respostesCuestionari[qtyKey]) || 0;
        if (extraDef && qty > 0) {
          return {
            qty,
            price: extraDef.valor,
            total: qty * extraDef.valor
          };
        }
      }
      // 3. Direct template fallback
      const anyExtraDef = config?.tarifesDinamiques?.find((t: any) => nameRegex.test(t.nom));
      if (anyExtraDef) {
         const qty = Number(i.respostesCuestionari[`extra_qty_${anyExtraDef.id}`]) || 0;
         if (qty > 0) {
           return {
             qty,
             price: anyExtraDef.valor,
             total: qty * anyExtraDef.valor
           };
         }
      }
      return null;
    };

    // Add data rows
    filteredInscripcions.forEach((i, idx) => {
      const rowNum = idx + 2;

      // A (Marca temporal)
      const dMarca = i.creadoEn ? new Date(i.creadoEn) : null;
      
      // B (Email)
      const email = i.c1Email || "";

      // C (Pareja)
      const pareja = i.codiSeguiment || "";

      // D (Bandera)
      let bandera = (i.categoria === CategoriaParella.JUVENIL || String(i.categoria).toUpperCase() === 'JUVENIL') 
        ? 'Juvenil (13 a 16)' 
        : 'Adult (A partir de 16 anys)';
      if (i.llistaEspera) {
        bandera = "LLISTA D'ESPERA " + bandera;
      }

      // E (Nom Comparser)
      const comparser1 = `${i.c1Nom || ""} ${i.c1Cognoms || ""}`.trim();

      // F (Nom Comparsera)
      const comparser2 = `${i.c2Nom || ""} ${i.c2Cognoms || ""}`.trim();

      // G (Telefon)
      const telefon = i.c1Telefon || "";

      // H (Correu Electronic)
      const correuElectronic = i.c2Email || "";

      // I (Preu Parella)
      const preuParella = i.categoria === CategoriaParella.ADULT 
        ? (config.preuAdult || 90) 
        : (config.preuJuvenil || 60);

      // J (Armilla)
      const liniaIdFirst = config.liniisUniforme?.[0]?.id || 'lin-1';
      const selUni = i.seleccionsUniforme?.[liniaIdFirst];
      const tip1 = selUni?.c1Tipus || i.c1UniformeTipus;
      let armillaVal = 'NO';
      if (tip1 === 'lloguer' || tip1 === 'compra') {
        armillaVal = tip1.toUpperCase();
      }

      // K (Preu Armilla)
      const preuArmilla = armillaVal === 'NO' ? "" : (tip1 === 'lloguer' ? (config.liniisUniforme?.[0]?.preuLloguer || 30) : (config.liniisUniforme?.[0]?.preu || 30));

      // L (Talla Armilla)
      const tallaArmilla = armillaVal === 'NO' ? "" : (selUni?.c1Talla || i.c1Talla || "M");

      // M (Clavells)
      const clavellsInfo = getExtraInfo(i, /clavell|clavel/i);
      const clavellsVal = clavellsInfo ? "SI" : "NO";

      // N (Preu Clavells)
      const preuClavells = clavellsInfo ? clavellsInfo.total : "";

      // O (Corbati)
      const corbatiInfo = getExtraInfo(i, /corbat/i);
      const corbatiVal = corbatiInfo ? "SI" : "NO";

      // P (Preu Corbati)
      const preuCorbati = corbatiInfo ? corbatiInfo.total : "";

      // Q (Esmorzar)
      const esmorzarInfo = getExtraInfo(i, /esmorz|almuerz/i);
      const esmorzarVal = esmorzarInfo ? "SI" : "NO";

      // R (Preu Esmorzar)
      const preuEsmorzar = esmorzarInfo ? esmorzarInfo.total : "";

      // S (Total a Pagar) - Formula exactly matching requested:
      // =SI(I2="",0,I2)+SI(K2="",0,K2)+SI(P2="",0,P2)+SI(R2="",0,R2)
      const totalFormula = { formula: `IF(I${rowNum}="",0,I${rowNum})+IF(K${rowNum}="",0,K${rowNum})+IF(P${rowNum}="",0,P${rowNum})+IF(R${rowNum}="",0,R${rowNum})` };

      // T (Pagat)
      const isPaid = i.estatPagament === EstatPagament.PAGAT || String(i.estatPagament).toUpperCase() === 'PAGAT';
      const pagatAmount = isPaid ? i.preuCalculat : 0;

      // U (Pdte. Pag) - Formula exactly matching requested:
      // =SI(S2="","",S2-T2)
      const pdteFormula = { formula: `IF(S${rowNum}="","",S${rowNum}-T${rowNum})` };

      // V (Forma Pagament)
      let formaPag = "";
      if (i.metodePagament) {
        const mStr = String(i.metodePagament).toUpperCase();
        if (mStr === 'EFECTIU' || mStr === 'METALIC' || mStr === 'EFECTIVO' || mStr === 'METALICO') {
          formaPag = "METALICO";
        } else {
          formaPag = mStr;
        }
      }

      // W (M)
      const mVal = (i.creadoEn && i.c1Email) ? 'TRUE' : 'FALSE';

      // X (Fecha Inscripcion)
      let dataInscripcio = dMarca;
      if (i.actualizadoEn) {
        const dAct = new Date(i.actualizadoEn);
        if (!isNaN(dAct.getTime())) {
          dataInscripcio = dAct;
        }
      }

      // Y (Preparado)
      const preparado = (String(i.entregaMaterial) === 'PREPARAT' || String(i.entregaMaterial) === 'ENTREGAT') ? 'SI' : '';

      // Z (Entregado)
      const entregado = String(i.entregaMaterial) === 'ENTREGAT' || i.respostesCuestionari?.['entregado'] === true || String(i.respostesCuestionari?.['entregado']).toUpperCase() === 'SI' || i.respostesCuestionari?.['entrega'] === true;

      // AA (Envio whats)
      const envioWhats = i.respostesCuestionari?.['envi_whats'] === true || i.respostesCuestionari?.['whats'] === true || String(i.respostesCuestionari?.['envi_whats']).toUpperCase() === 'SI' || i.respostesCuestionari?.['envio_whats'] === true;

      // AB (Fin inscripcion)
      const finInscripcio = 'SI';

      // AC (Pulsera)
      const pulsera = i.respostesCuestionari?.['pulsera'] === true || String(i.respostesCuestionari?.['pulsera']).toUpperCase() === 'SI' || i.entregaMaterial === 'ENTREGAT';

      // AD (Enviado mail conf)
      const mailEnviat = (i.respostesCuestionari?.estatCorreu !== 'fallat' && i.respostesCuestionari?.estatCorreu !== 'error');

      // AE (Bandera assignada)
      let banderaAsignadaStr = "No assignat";
      if (i.bandera === 1) banderaAsignadaStr = "Bandera BOSS";
      else if (i.bandera === 2) banderaAsignadaStr = "Bandera No ni na";
      else if (i.bandera === 3) banderaAsignadaStr = "Bandera juvenil";

      // Add row to worksheet
      ws.addRow([
        dMarca,             // A
        email,              // B
        pareja,             // C
        bandera,            // D
        comparser1,         // E
        comparser2,         // F
        telefon,            // G
        correuElectronic,   // H
        preuParella,        // I
        armillaVal,         // J
        preuArmilla,        // K
        tallaArmilla,       // L
        clavellsVal,        // M
        preuClavells,       // N
        corbatiVal,         // O
        preuCorbati,        // P
        esmorzarVal,        // Q
        preuEsmorzar,       // R
        totalFormula,       // S  (Formula)
        pagatAmount,        // T
        pdteFormula,        // U  (Formula)
        formaPag,           // V
        mVal,               // W
        dataInscripcio,     // X
        preparado,          // Y
        entregado,          // Z   (Checkbox boolean)
        envioWhats,         // AA  (Checkbox boolean)
        finInscripcio,      // AB
        pulsera,            // AC  (Checkbox boolean)
        mailEnviat,         // AD  (Checkbox boolean)
        banderaAsignadaStr  // AE (Categoría asignada como Bandera descriptiva real)
      ]);

      // Access row to apply styles cell-by-cell
      const addedRow = ws.getRow(rowNum);
      const borderObj = {
        top: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } },
        left: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } },
        right: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } }
      };

      addedRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        // Set basic font
        cell.font = { name: 'Arial', size: 9 };
        cell.border = borderObj;
        cell.alignment = { vertical: 'middle', wrapText: false };

        // Set number formats
        if (colNum === 1) { // Marca temporal (A)
          cell.numFmt = 'dd/mm/yyyy hh:mm:ss';
        }
        else if (colNum === 24) { // Fecha inscripcion (X)
          cell.numFmt = 'dd/mm/yy';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        else if ([9, 11, 14, 16, 18, 19, 20, 21].includes(colNum)) { // Financial values
          cell.numFmt = '#,##0.00" €"';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
        else if ([3, 7, 10, 12, 13, 15, 17, 23, 25, 26, 27, 28, 29, 30, 31].includes(colNum)) { // Boolean status and shorter inputs
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Column solid fill colors
        if (colNum === 3 || colNum === 4) { // PAREJA & BANDERA -> AMARILLO (#FFFF00)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' }
          };
        } else if (colNum === 6) { // NOM I COGNOM COMPARSERA -> ROSA CLARO (#FFB6C1)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFB6C1' }
          };
        } else if (colNum === 7) { // TELÈFON -> CYAN (#00FFFF)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF00FFFF' }
          };
        } else if (colNum === 31) { // BANDERA ASIGNADA (0 = white, 1 = Pink/Fuchsia, 2 = Yellow, 3 = Blue)
          let bHexColor = 'FFFFFFFF'; // default white
          const currentBVal = i.bandera || 0;
          if (currentBVal === 1) {
            bHexColor = 'FFFFC2EB'; // Beautiful Light pink/fuchsia
          } else if (currentBVal === 2) {
            bHexColor = 'FFFFF2B2'; // Beautiful Soft Yellow
          } else if (currentBVal === 3) {
            bHexColor = 'FFC2E0FF'; // Beautiful Soft Blue
          }
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bHexColor }
          };
          cell.font = { name: 'Arial', size: 9, bold: currentBVal > 0 };
        } else {
          // default white background
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }
          };
        }

        // Exact conditional formatting rules
        // 1. ARMILLA (Col 10): "LLOGUER" -> light green, "COMPRA" -> light blue
        if (colNum === 10) {
          if (cell.value === 'LLOGUER') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE2EFDA' } // Light green
            };
          } else if (cell.value === 'COMPRA') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFDDEBF7' } // Light blue
            };
          }
        }

        // 2. PDTE. PAG (Col 21): > 0 -> light red, = 0 -> light green
        if (colNum === 21) {
          const pdteVal = (i.preuCalculat || 90) - pagatAmount;
          if (pdteVal > 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFC7CE' } // Light red
            };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFC6EFCE' } // Light green
            };
          }
        }

        // 3. FORMA PAGAMENT (Col 22): Con valor -> light green (#90EE90)
        if (colNum === 22 && formaPag) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF90EE90' } // Green
          };
        }

        // 4. PREPARADO (Col 25): "SI" -> light green
        if (colNum === 25 && preparado === 'SI') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2EFDA' } // Light green
          };
        }
      });
    });

    // Inmovilizar fila 1 y columnas hasta H (Freeze row 1 and columns A to H)
    ws.views = [
      { state: 'frozen', xSplit: 8, ySplit: 1, activeCell: 'I2' }
    ];

    // Elegant auto column width fitting adjusted to cell contents
    ws.columns.forEach(column => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const valStr = cell.value ? String(cell.value) : "";
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      });
      column.width = Math.min(maxLen + 4, 32); // Safe padding + upper bound
    });

    // Write buffer and download Excel document
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `llista_espera_tast_comparses_${new Date().toISOString().slice(0,10)}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      if (onAddLog) {
        onAddLog("Exportació a full d'Excel (.xlsx) de dades completada.");
      }
    } catch (err) {
      console.error("Error exporting to Excel via ExcelJS:", err);
      alert(language === 'ca' ? "Error en generar el fitxer d'Excel d'exportació." : "Error al generar el archivo de Excel de exportación.");
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
                ? `Gestió i validació d'inscripcions - ${localStorage.getItem('tast_nom_esdeveniment') || 'Carnaval 2027'}` 
                : `Gestión y validación de inscripciones - ${localStorage.getItem('tast_nom_esdeveniment') || 'Carnaval 2027'}`}
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
              {esperaCount > 0 && (
                <span className="text-amber-600 font-extrabold ml-1 px-1 py-0.2 bg-amber-500/10 rounded font-sans inline-block" title="Parella en llista d'espera">
                  • {esperaCount} espera
                </span>
              )}
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

      {/* Premium Dashboard Navigation Tabs */}
      <div className="flex flex-col sm:flex-row gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-2xl print:hidden">
        <button
          type="button"
          onClick={() => setActivePanelTab('inscripcions')}
          className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activePanelTab === 'inscripcions'
              ? 'bg-[#ff0090] text-white shadow-md shadow-fuchsia-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Users size={14} />
          {language === 'ca' ? "Llista d'Inscripcions" : "Lista de Inscripciones"}
        </button>

        <button
          type="button"
          onClick={() => setActivePanelTab('smtp')}
          className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activePanelTab === 'smtp'
              ? 'bg-[#ff0090] text-white shadow-md shadow-fuchsia-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Mail size={14} />
          {language === 'ca' ? "Configuració SMTP (Correu)" : "Configuración SMTP (Correo)"}
        </button>

        <button
          type="button"
          onClick={() => setActivePanelTab('xarxes')}
          className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activePanelTab === 'xarxes'
              ? 'bg-[#ff0090] text-white shadow-md shadow-fuchsia-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Share2 size={14} />
          {language === 'ca' ? "Sincro Socials / Avisos" : "Sincro Socials / Avisos"}
        </button>

        <button
          type="button"
          onClick={() => setActivePanelTab('personalitzacio')}
          className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activePanelTab === 'personalitzacio'
              ? 'bg-[#ff0090] text-white shadow-md shadow-fuchsia-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Sliders size={14} />
          {language === 'ca' ? "Personalització" : "Personalización"}
        </button>

        <button
          type="button"
          onClick={() => setActivePanelTab('cierre')}
          className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer ${
            activePanelTab === 'cierre'
              ? 'bg-[#ff0090] text-white shadow-md shadow-fuchsia-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
          id="btn-nav-cierre"
        >
          <Clock size={14} />
          {language === 'ca' ? "Cierre de Día" : "Cierre de Día"}
        </button>
      </div>

      {/* Conditionally render panels according to active tab */}
      {activePanelTab === 'inscripcions' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-fade-in" id="panel-view-inscripcions">
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
                  placeholder={language === 'ca' ? "Cerca per nom, cognom, telèfon, email o codi..." : "Buscar por nombre, apellido, teléfono, email o código..."}
                  className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all placeholder-zinc-400 font-sans text-zinc-900"
                  id="input-search-query"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="bg-zinc-900 hover:bg-black text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  id="btn-add-couple-manual"
                >
                  <Plus size={15} className="text-[#ff0090]" /> {language === 'ca' ? "Afegir Parella Manual" : "Añadir Pareja Manual"}
                </button>

                <button 
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  id="btn-export-excel"
                >
                  <FileSpreadsheet size={15} /> {language === 'ca' ? "Exportar Excel" : "Exportar Excel"}
                </button>

                {selectedIds.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setShowBulkDeleteConfirmModal(true)}
                    className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    id="btn-delete-selected"
                  >
                    <Trash2 size={15} /> {language === 'ca' ? "Esborrar seleccionats" : "Borrar seleccionados"} ({selectedIds.length})
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => {
                    setClearConfirmText('');
                    setShowClearConfirmModal(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  id="btn-clear-all"
                >
                  <Trash2 size={15} /> {language === 'ca' ? "Buidar Base de Dades" : "Vaciar Base de Datos"}
                </button>
              </div>
            </div>

            {/* Core matrix dropdown filters */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-zinc-500 font-bold uppercase tracking-wider mr-2">
                <Filter size={12} /> {language === 'ca' ? "Filtres:" : "Filtros:"}
              </div>

              {/* Category dropdown filter */}
              <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
                <span className="text-zinc-500 mr-2 font-mono">{language === 'ca' ? "Categoria" : "Categoría"}</span>
                <select 
                  value={filterCategoria} 
                  onChange={(e) => setFilterCategoria(e.target.value)}
                  className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                  id="filter-category"
                >
                  <option value="ALL">{language === 'ca' ? "Tots" : "Todos"}</option>
                  <option value={CategoriaParella.ADULT}>{language === 'ca' ? "Adults" : "Adultos"}</option>
                  <option value={CategoriaParella.JUVENIL}>{language === 'ca' ? "Juvenils" : "Juveniles"}</option>
                </select>
              </div>

              {/* Payment dropdown filter */}
              <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
                <span className="text-zinc-500 mr-2 font-mono">{language === 'ca' ? "Pagat" : "Pagado"}</span>
                <select 
                  value={filterPagament} 
                  onChange={(e) => setFilterPagament(e.target.value)}
                  className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                  id="filter-payment"
                >
                  <option value="ALL">{language === 'ca' ? "Tots" : "Todos"}</option>
                  <option value={EstatPagament.PAGAT}>{language === 'ca' ? "Sí" : "Sí"}</option>
                  <option value={EstatPagament.PENDENT}>{language === 'ca' ? "Pendent" : "Pendiente"}</option>
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
                  <option value="ALL">{language === 'ca' ? "Tots" : "Todos"}</option>
                  <option value={EstatVerificacio.VALIDAT}>{language === 'ca' ? "Validat" : "Validado"}</option>
                  <option value={EstatVerificacio.PENDENT}>{language === 'ca' ? "Pendent" : "Pendiente"}</option>
                  <option value={EstatVerificacio.REBUTJAT}>{language === 'ca' ? "Rebutjat" : "Rechazado"}</option>
                </select>
              </div>

              {/* Material Delivery dropdown filter */}
              <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
                <span className="text-zinc-500 mr-2 font-mono">{language === 'ca' ? "Material" : "Material"}</span>
                <select 
                  value={filterEntrega} 
                  onChange={(e) => setFilterEntrega(e.target.value)}
                  className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                  id="filter-delivery"
                >
                  <option value="ALL">{language === 'ca' ? "Tots" : "Todos"}</option>
                  <option value={EstatInscripcio.ENTREGAT}>{language === 'ca' ? "Entregat" : "Entregado"}</option>
                  <option value={EstatInscripcio.PENDENT}>{language === 'ca' ? "Pendent" : "Pendiente"}</option>
                </select>
              </div>

              {/* Inscription Status dropdown filter */}
              <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
                <span className="text-zinc-500 mr-2 font-mono">{language === 'ca' ? "Estat" : "Estado"}</span>
                <select 
                  value={filterEstat} 
                  onChange={(e) => setFilterEstat(e.target.value)}
                  className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                  id="filter-status"
                >
                  <option value="ALL">{language === 'ca' ? "Tots" : "Todos"}</option>
                  <option value="OBERTA">{language === 'ca' ? 'Obertes' : 'Abiertas'}</option>
                  <option value="ESPERA">{language === 'ca' ? "Llista d'espera" : 'Lista de espera'}</option>
                </select>
              </div>

              {/* Bandera filter dropdown */}
              <div className="flex items-center bg-white border border-zinc-200 px-3 py-2 rounded-xl">
                <span className="text-zinc-500 mr-2 font-mono">{language === 'ca' ? "Bandera" : "Bandera"}</span>
                <select 
                  value={filterBandera} 
                  onChange={(e) => setFilterBandera(e.target.value)}
                  className="bg-transparent font-bold text-zinc-900 border-none outline-none cursor-pointer"
                  id="filter-bandera"
                >
                  <option value="ALL">{language === 'ca' ? "Tots" : "Todos"}</option>
                  <option value="0">{language === 'ca' ? 'No assignat' : 'No asignado'}</option>
                  <option value="1">{language === 'ca' ? 'Bandera BOSS' : 'Bandera BOSS'}</option>
                  <option value="2">{language === 'ca' ? 'Bandera No ni na' : 'Bandera No ni na'}</option>
                  <option value="3">{language === 'ca' ? 'Bandera juvenil' : 'Bandera juvenil'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Primary Data Listing Grid */}
          <div className="overflow-x-auto">
            {filteredInscripcions.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                <Users className="mx-auto text-zinc-300 mb-3" size={48} />
                <p className="font-sans font-bold text-lg text-zinc-700">{language === 'ca' ? "No s'ha trobat cap parella registrada" : "No se ha encontrado ninguna pareja registrada"}</p>
                <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">{language === 'ca' ? "Comproveu els criteris de cerca o els filtres seleccionats actualment." : "Compruebe los criterios de búsqueda o los filtros seleccionados actualmente."}</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-zinc-100 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200">
                    <th className="px-2 py-4 text-center w-10">
                      <input 
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-zinc-300 text-[#ff0090] focus:ring-[#ff0090] cursor-pointer h-4 w-4"
                        id="checkbox-select-all"
                      />
                    </th>
                    <th className="px-2 md:px-3 py-4 whitespace-nowrap">{language === 'ca' ? "CODI / DATA" : "CÓDIGO / FECHA"}</th>
                    <th className="px-2 md:px-3 py-4 whitespace-nowrap">{language === 'ca' ? "PRIMER COMPARSER" : "PRIMER COMPARSER"}</th>
                    <th className="px-2 md:px-3 py-4 whitespace-nowrap">{language === 'ca' ? "SEGON COMPARSER" : "SEGUNDO COMPARSER"}</th>
                    <th className="px-2 md:px-3 py-4 text-center whitespace-nowrap">{language === 'ca' ? "CATEGORIA" : "CATEGORÍA"}</th>
                    <th className="px-2 md:px-3 py-4 text-center whitespace-nowrap">{language === 'ca' ? "BANDERA" : "BANDERA"}</th>
                    <th className="px-2 md:px-3 py-4 text-center whitespace-nowrap">{language === 'ca' ? "PAGAMENT" : "PAGO"}</th>
                    <th className="px-2 md:px-3 py-4 text-center whitespace-nowrap">{language === 'ca' ? "DNI STATUS" : "ESTADO DNI"}</th>
                    <th className="px-2 md:px-3 py-4 text-center whitespace-nowrap">{language === 'ca' ? "LLIURAMENT" : "ENTREGA"}</th>
                    <th className="px-2 md:px-3 py-4 text-center whitespace-nowrap">{language === 'ca' ? "CORREU ENVIAT" : "CORREO ENVIADO"}</th>
                    <th className="px-2 md:px-3 py-4 text-center whitespace-nowrap">{language === 'ca' ? "ACCIONS" : "ACCIONES"}</th>
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
                      <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-2 md:px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="font-mono font-bold text-zinc-900 block">{item.codiSeguiment}</span>
                          {(item.estatInscripcio === 'llista_espera' || (!item.estatInscripcio && item.llistaEspera)) ? (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase font-sans tracking-wider shrink-0 bg-amber-500/10 border border-amber-300 flex items-center gap-1">
                              🟡 ESPERA {item.posicioGlobal ? `#${item.posicioGlobal}` : ''}
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase font-sans tracking-wider shrink-0 bg-emerald-500/10 border border-emerald-300 flex items-center gap-1">
                              🟢 OBERTA {item.posicioGlobal ? `#${item.posicioGlobal}` : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">{new Date(item.creadoEn).toLocaleDateString('ca-ES')}</span>
                      </td>

                      {/* Participant 1 info */}
                      <td className="px-2 md:px-3 py-3 whitespace-nowrap">
                        <p className="font-bold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                          {item.c1Nom} {item.c1Cognoms}
                          {item.c1EsMenor && (
                            <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shrink-0" title={language === 'ca' ? "És menor d'edat" : "Es menor de edad"}>
                              MENOR
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          {item.c1Telefon} • Talla {item.c1Talla} <span className="text-[#ff0090] font-sans font-bold text-[9px] uppercase px-1 pb-0.5 bg-fuchsia-50/50 rounded border border-fuchsia-100/50 ml-1">{item.c1UniformeTipus === 'lloguer' ? (language === 'ca' ? 'Lloguer' : 'Alquiler') : (language === 'ca' ? 'Compra' : 'Compra')}</span>
                        </p>
                      </td>

                      {/* Participant 2 info */}
                      <td className="px-2 md:px-3 py-3 whitespace-nowrap">
                        <p className="font-bold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                          {item.c2Nom} {item.c2Cognoms}
                          {item.c2EsMenor && (
                            <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shrink-0" title={language === 'ca' ? "És menor d'edat" : "Es menor de edad"}>
                              MENOR
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          {item.c2Telefon} • Talla {item.c2Talla} <span className="text-[#ff0090] font-sans font-bold text-[9px] uppercase px-1 pb-0.5 bg-fuchsia-50/50 rounded border border-fuchsia-100/50 ml-1">{item.c2UniformeTipus === 'lloguer' ? (language === 'ca' ? 'Lloguer' : 'Alquiler') : (language === 'ca' ? 'Compra' : 'Compra')}</span>
                        </p>
                      </td>

                      {/* Category display */}
                      <td className="px-2 md:px-3 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold font-mono ${
                          item.categoria === CategoriaParella.ADULT 
                            ? 'bg-zinc-900 text-white' 
                            : 'bg-fuchsia-100 text-fuchsia-800'
                        }`}>
                          {item.categoria}
                        </span>
                      </td>

                      {/* Bandera column with quick selector */}
                      <td className="px-2 md:px-3 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={item.bandera || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (onSaveInscripcio) {
                              onSaveInscripcio({
                                ...item,
                                bandera: val
                              });
                            }
                          }}
                          className={`font-sans font-extrabold text-[10px] uppercase px-2 py-1.5 rounded-xl border outline-none cursor-pointer text-center tracking-tight transition-colors ${
                            (item.bandera || 0) === 1
                              ? 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 hover:bg-fuchsia-200'
                              : (item.bandera || 0) === 2
                              ? 'bg-yellow-105 text-yellow-900 border-yellow-300 hover:bg-yellow-200'
                              : (item.bandera || 0) === 3
                              ? 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200'
                              : 'bg-zinc-100 text-zinc-650 border-zinc-200 hover:bg-zinc-150'
                          }`}
                          id={`select-bandera-col-${item.id}`}
                        >
                          <option value="0">{language === 'ca' ? 'No assignat' : 'No asignado'}</option>
                          <option value="1">BOSS</option>
                          <option value="2">No ni na</option>
                          <option value="3">Juvenil</option>
                        </select>
                      </td>

                      {/* Payment status badge */}
                      <td className="px-2 md:px-3 py-3 text-center whitespace-nowrap">
                        {item.estatPagament === EstatPagament.PAGAT ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                              <CheckCircle size={10} /> <strong>{item.preuCalculat}€</strong>
                            </span>
                            <span className="text-[9px] text-zinc-400 font-mono mt-0.5">{item.metodePagament}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock size={10} /> <strong>{item.preuCalculat}€ {language === 'ca' ? "Pendent" : "Pendiente"}</strong>
                          </span>
                        )}
                      </td>

                      {/* DNI status badge */}
                      <td className="px-2 md:px-3 py-3 text-center whitespace-nowrap">
                        {item.estatDni === EstatVerificacio.VALIDAT && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                            {language === 'ca' ? "Validat" : "Validado"}
                          </span>
                        )}
                        {item.estatDni === EstatVerificacio.PENDENT && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            {language === 'ca' ? "Pendent" : "Pendiente"}
                          </span>
                        )}
                        {item.estatDni === EstatVerificacio.REBUTJAT && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 animate-pulse">
                            {language === 'ca' ? "Rebutjat" : "Rechazado"}
                          </span>
                        )}
                      </td>

                      {/* Delivery material status */}
                      <td className="px-2 md:px-3 py-3 text-center whitespace-nowrap">
                        {item.entregaMaterial === EstatInscripcio.ENTREGAT ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 text-white">
                            {language === 'ca' ? "Lliurat" : "Entregado"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-500">
                            {language === 'ca' ? "No lliurat" : "No entregado"}
                          </span>
                        )}
                      </td>

                      {/* Correu / Notificació status and manual trigger */}
                      <td className="px-2 md:px-3 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const currentStatus = rowSmtpSending[item.id] || item.respostesCuestionari?.estatCorreu || 'enviat';
                          
                          if (currentStatus === 'sending') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-50 text-fuchsia-600 animate-pulse">
                                <Send size={9} className="animate-bounce" /> {language === 'ca' ? "Enviant..." : "Enviando..."}
                              </span>
                            );
                          }
                          
                          if (currentStatus === 'fallat' || currentStatus === 'error') {
                            return (
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800" title={language === 'ca' ? "S'ha produït un error a l'SMTP" : "Se produjo un error en el SMTP"}>
                                  <AlertCircle size={10} /> {language === 'ca' ? "Fallat" : "Fallido"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleResendEmail(item)}
                                  className="p-1 text-[9px] font-extrabold bg-zinc-900 border border-zinc-200 hover:bg-[#ff0090] text-white rounded-md cursor-pointer flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
                                  title={language === 'ca' ? "Re-enviar comprovant manualment ara" : "Re-enviar comprobante manualmente ahora"}
                                >
                                  <Send size={8} /> {language === 'ca' ? "Enviar" : "Enviar"}
                                </button>
                              </div>
                            );
                          }
                          
                          // Default is success 'enviat'
                          return (
                            <div className="flex items-center justify-center gap-1.5 inline-flex">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                                <CheckCircle size={10} /> {language === 'ca' ? "Enviat" : "Enviado"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResendEmail(item)}
                                className="p-1 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-zinc-900 cursor-pointer transition-all"
                                title={language === 'ca' ? "Re-enviar comprovant" : "Volver a enviar comprobante"}
                              >
                                <RefreshCw size={10} />
                              </button>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Quick navigation action triggers */}
                      <td className="px-2 md:px-3 py-3 text-center whitespace-nowrap">
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
      )}

      {activePanelTab === 'smtp' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-md p-6 sm:p-8 space-y-6 animate-fade-in" id="panel-view-smtp">
          <div className="flex items-start gap-4 pb-4 border-b border-zinc-100">
            <div className="p-3 bg-fuchsia-50 text-[#ff0090] rounded-2xl">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="font-sans font-black text-lg text-zinc-900 uppercase tracking-tight">
                {language === 'ca' ? "CORREU OFICIAL DE L'ENTITAT (SMTP)" : "CORREO OFICIAL DE LA ENTIDAD (SMTP)"}
              </h3>
              <p className="text-xs text-zinc-500">
                {language === 'ca'
                  ? "Configuració de seguretat centralitzada de de la teva entitat de forma real."
                  : "Configuración de seguridad centralizada de tu entidad de forma real."}
              </p>
            </div>
          </div>

          <div className="bg-fuchsia-50/55 border border-fuchsia-100 rounded-2xl p-4 flex gap-3 text-xs text-zinc-600 leading-relaxed">
            <ShieldCheck size={24} className="text-[#ff0090] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-zinc-900">
                {language === 'ca' ? "Avís sobre seguretat del proveïdor" : "Aviso sobre seguridad del proveedor"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {language === 'ca'
                  ? "Com a mesura de seguretat avançada, les credencials del servidor SMTP (User, Password, Host, Port) s'han traslladat des de la base de dades directa cap a variables d'entorn d'execució xifrada del servidor. El frontend i el navegador mai tenen accés a aquestes claus."
                  : "Como medida de seguridad avanzada, las credenciales del servidor SMTP (User, Password, Host, Port) se han trasladado desde la base de datos directa hacia las variables de entorno de ejecución cifrada en el servidor. El frontend y los navegadores nunca tienen acceso a estas claves."}
              </p>
              <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono font-bold text-fuchsia-700">
                <span className="bg-fuchsia-100 px-2 py-1 rounded">SMTP_HOST</span>
                <span className="bg-fuchsia-100 px-2 py-1 rounded">SMTP_PORT</span>
                <span className="bg-fuchsia-100 px-2 py-1 rounded">SMTP_USER</span>
                <span className="bg-fuchsia-100 px-2 py-1 rounded">SMTP_PASSWORD</span>
              </div>
            </div>
          </div>

          {smtpSaveSuccess && (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs p-3.5 rounded-2xl flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-600 animate-bounce" />
              <span>
                {language === 'ca' ? "Credencials de correu SMTP de l'entitat gravades amb èxit!" : "¡Credenciales de correo SMTP de la entidad guardadas con éxito!"}
              </span>
            </div>
          )}

          {/* Interactive Console Tool: Tester Connection */}
          <div className="border border-zinc-200 rounded-3xl p-6 bg-zinc-50 space-y-4">
            <h4 className="font-sans font-black text-xs text-zinc-900 uppercase tracking-widest flex items-center gap-1.5 text-zinc-700">
              <Sparkles size={14} className="text-fuchsia-500 animate-pulse" />
              {language === 'ca' ? "PROVADOR DE CONNEXIÓ SMTP AUTOMÀTICA" : "PROBADOR DE CONEXIÓN SMTP AUTOMÁTICA"}
            </h4>
            <p className="text-[11px] text-zinc-500">
              {language === 'ca'
                ? "Abans de començar a rebre inscripcions reals, pots enviar un correu electrònic de comprovació per verificar l'autosent ràpid de la teva entitat de forma real."
                : "Antes de empezar a recibir inscripciones reales, puedes enviar un correo electrónico de comprobación para verificar el autosent rápido de tu entidad de forma real."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={smtpTestDestinatari}
                onChange={(e) => setSmtpTestDestinatari(e.target.value)}
                placeholder="destinatari@gmail.com"
                className="bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-4 py-3 text-xs focus:outline-none transition-all font-sans text-zinc-800 flex-1"
              />
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={smtpTestStatus === 'loading'}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-fuchsia-400 font-bold text-xs px-5 py-3 rounded-2xl text-white transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                {smtpTestStatus === 'loading' ? (
                  <>
                    <Clock size={14} className="animate-spin" />
                    {language === 'ca' ? "Connectant SMTP..." : "Conectando SMTP..."}
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    {language === 'ca' ? "Enviar Correu de Prova" : "Enviar Correo de Prueba"}
                  </>
                )}
              </button>
            </div>

            {smtpTestStatus !== 'idle' && (
              <div className={`p-4 rounded-2xl border text-xs leading-relaxed font-mono ${
                smtpTestStatus === 'success' 
                  ? 'bg-zinc-900 border-zinc-800 text-emerald-300' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {smtpTestStatus === 'loading' && (
                  <div className="space-y-1">
                    <p className="animate-pulse">◌ Connecting to secure SMTP tunnel {smtpHost}:{smtpPort}...</p>
                    <p className="text-zinc-500">◌ Performing TLSv1.3 cryptographic handshake...</p>
                    <p className="text-zinc-500">◌ Authenticating credentials for account: {smtpUsuari}...</p>
                  </div>
                )}
                {smtpTestStatus === 'success' && (
                  <div className="space-y-1">
                    <p className="font-bold text-white uppercase tracking-wider text-[10px]">✓ CONNEXIÓ SEGURA TLS ESTABLERTA</p>
                    <p className="text-[9px] text-zinc-500 font-mono">Server response: 220 {smtpHost} ESMTP protocol listening</p>
                    <p className="text-[9px] text-zinc-500 font-mono">Payload code: 235 Authentication Succeeded (TLS-Handshake verified)</p>
                    <p className="mt-2 text-zinc-200 font-sans leading-relaxed text-[11px]">{smtpTestMsg}</p>
                  </div>
                )}
                {smtpTestStatus === 'error' && (
                  <div className="space-y-1 col-span-2">
                    <p className="font-bold text-red-650">✗ ERROR D'ENRUTAMENT / CREDENCIALS</p>
                    <p className="text-red-700 font-sans">{smtpTestMsg}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activePanelTab === 'xarxes' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-md p-6 sm:p-8 space-y-8 animate-fade-in" id="panel-view-xarxes">
          <div className="flex items-start gap-4 pb-4 border-b border-zinc-100">
            <div className="p-3 bg-fuchsia-50 text-[#ff0090] rounded-2xl">
              <Share2 size={24} />
            </div>
            <div>
              <h3 className="font-sans font-black text-lg text-zinc-900 uppercase tracking-tight">
                {language === 'ca' ? "SINCRO DE COMPTES SOCIALS" : "SINCRO DE CUENTAS SOCIALES"}
              </h3>
              <p className="text-xs text-zinc-500">
                {language === 'ca'
                  ? "Vincula els comptes d'Instagram, Facebook o TikTok de l'associació El Tast. Quan publiquis posts a les teves xarxes socials, aquests es reflectiran automàticament a la pàgina de benvinguda de l'app."
                  : "Vincula las cuentas de Instagram, Facebook o TikTok de la asociación El Tast. Cuando publiques posts en tus redes sociales, estos se reflejarán automáticamente en la página de bienvenida de la app."}
              </p>
            </div>
          </div>

          {/* Connected Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Instagram integrated card */}
            <div className={`p-5 rounded-3xl border transition-all space-y-4 ${
              scInstagramConnected 
                ? 'bg-fuchsia-50/40 border-fuchsia-200/80 shadow-md' 
                : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div className="flex justify-between items-start">
                <span className="p-2.5 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 text-white rounded-xl">
                  <Globe size={18} />
                </span>
                {scInstagramConnected ? (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-600 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">ACTIU</span>
                ) : (
                  <span className="text-[9px] bg-zinc-200 text-zinc-500 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">DESCONNECTAT</span>
                )}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 font-sans text-xs">Instagram Graph API</h4>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{scInstagramConnected ? scInstagramHandle : "@eltastvng"}</p>
              </div>
              <div className="pt-2">
                {scInstagramConnected ? (
                  <button 
                    type="button"
                    onClick={() => handleDisconnectSocial('instagram')}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-650 text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    {language === 'ca' ? "Desvincular" : "Desvincular"}
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handleOpenConnect('instagram')}
                    className="w-full bg-gradient-to-tr from-yellow-500 via-[#e1306c] to-fuchsia-600 hover:opacity-90 text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    {language === 'ca' ? "Vincular Compte" : "Vincular Cuenta"}
                  </button>
                )}
              </div>
            </div>

            {/* Facebook integrated card */}
            <div className={`p-5 rounded-3xl border transition-all space-y-4 ${
              scFacebookConnected 
                ? 'bg-blue-50/40 border-blue-200/80 shadow-md' 
                : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div className="flex justify-between items-start">
                <span className="p-2.5 bg-blue-600 text-white rounded-xl">
                  <Globe size={18} />
                </span>
                {scFacebookConnected ? (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-600 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">ACTIU</span>
                ) : (
                  <span className="text-[9px] bg-zinc-200 text-zinc-500 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">DESCONNECTAT</span>
                )}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 font-sans text-xs">Facebook Pages Connector</h4>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">{scFacebookConnected ? scFacebookHandle : "facebook.com/eltastvng"}</p>
              </div>
              <div className="pt-2">
                {scFacebookConnected ? (
                  <button 
                    type="button"
                    onClick={() => handleDisconnectSocial('facebook')}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-650 text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    {language === 'ca' ? "Desvincular" : "Desvincular"}
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handleOpenConnect('facebook')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    {language === 'ca' ? "Vincular Compte" : "Vincular Cuenta"}
                  </button>
                )}
              </div>
            </div>

            {/* TikTok integrated card */}
            <div className={`p-5 rounded-3xl border transition-all space-y-4 ${
              scTikTokConnected 
                ? 'bg-zinc-100 border-zinc-300 shadow-md' 
                : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div className="flex justify-between items-start">
                <span className="p-2.5 bg-black text-white rounded-xl flex items-center justify-center font-bold text-[9px] uppercase tracking-wider leading-none">
                  TikTok
                </span>
                {scTikTokConnected ? (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-600 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">ACTIU</span>
                ) : (
                  <span className="text-[9px] bg-zinc-200 text-zinc-500 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">DESCONNECTAT</span>
                )}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 font-sans text-xs">TikTok Embed Creator</h4>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{scTikTokConnected ? scTikTokHandle : "@eltast_vng"}</p>
              </div>
              <div className="pt-2">
                {scTikTokConnected ? (
                  <button 
                    type="button"
                    onClick={() => handleDisconnectSocial('tiktok')}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-650 text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    {language === 'ca' ? "Desvincular" : "Desvincular"}
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handleOpenConnect('tiktok')}
                    className="w-full bg-[#010101] hover:bg-black text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    {language === 'ca' ? "Vincular Compte" : "Vincular Cuenta"}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Interactive simulator: Publicar un post i sincronització automàtica! */}
          <div className="border border-zinc-200 rounded-3xl p-6 bg-zinc-50 space-y-6">
            <div className="pb-3 border-b border-zinc-200/60 flex items-center gap-2">
              <Sparkles size={16} className="text-fuchsia-600 animate-pulse" />
              <div>
                <h4 className="font-sans font-black text-xs text-zinc-900 uppercase tracking-widest">
                  {language === 'ca' ? "PUBLICADOR I SIMULADOR DE FEED AUTOMÀTIC" : "PUBLICADOR Y SIMULADOR DE FEED AUTOMÁTICO"}
                </h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {language === 'ca'
                    ? "Quan publiqui un post a les xarxes socials de l'entitat, el webhook de sincronització automàtica l'importarà i el llistará de forma immediata."
                    : "Cuando publique un post en las redes sociales de la entidad, el webhook de sincronización automática lo importará y lo listará de forma inmediata."}
                </p>
              </div>
            </div>

            <form onSubmit={handlePublishSocialPost} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Platform select */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase font-mono">{language === 'ca' ? "Xarxa d'Origen de la Publicació" : "Red de Origen de la Publicación"}</label>
                  <select
                    value={socialPostPlatform}
                    onChange={(e) => setSocialPostPlatform(e.target.value as any)}
                    className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-3.5 py-2.5 text-xs text-zinc-800 focus:outline-none transition cursor-pointer"
                  >
                    <option value="instagram">Instagram {scInstagramConnected ? " (✓ Connectat)" : (language === 'ca' ? " (⚠️ Requerix Connexió)" : " (⚠️ Requiere Conexión)")}</option>
                    <option value="facebook">Facebook {scFacebookConnected ? " (✓ Connectat)" : (language === 'ca' ? " (⚠️ Requerix Connexió)" : " (⚠️ Requiere Conexión)")}</option>
                    <option value="tiktok">TikTok {scTikTokConnected ? " (✓ Connectat)" : (language === 'ca' ? " (⚠️ Requerix Connexió)" : " (⚠️ Requiere Conexión)")}</option>
                  </select>
                </div>

                {/* Preset image selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase font-mono">{language === 'ca' ? "Imatge temàtica adjunta" : "Imagen temática adjunta"}</label>
                  <select
                    value={socialPostMediaPreset}
                    onChange={(e) => setSocialPostMediaPreset(e.target.value)}
                    className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-3.5 py-2.5 text-xs text-zinc-850 focus:outline-none transition cursor-pointer"
                  >
                    <option value="caramels">{language === 'ca' ? "🍬 Caramels i dolços de Vilanova" : "🍬 Caramelos y dulces de Vilanova"}</option>
                    <option value="armilles">{language === 'ca' ? "🎀 Armilles de Comparsa 2026" : "🎀 Chalecos de Comparsa 2026"}</option>
                    <option value="placa">{language === 'ca' ? "💃 Salt de Comparsa a la Plaça" : "💃 Salto de Comparsa en la Plaza"}</option>
                    <option value="platja">{language === 'ca' ? "⛱️ Platja de Ribes Roges" : "⛱️ Playa de Ribes Roges"}</option>
                  </select>
                </div>

              </div>

              {/* Text Area post */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase font-mono">{language === 'ca' ? "Contingut / Text del Post" : "Contenido / Texto del Post"}</label>
                <textarea
                  rows={3}
                  value={socialPostText}
                  onChange={(e) => setSocialPostText(e.target.value)}
                  placeholder={language === 'ca' ? "Escriviu el cos de la publicació..." : "Escribe el cuerpo de la publicación..."}
                  className="w-full bg-white border border-zinc-250 focus:border-fuchsia-500 rounded-2xl p-4 text-xs focus:outline-none text-zinc-800 transition placeholder-zinc-400"
                />
              </div>

              {/* Action row */}
              <div className="flex justify-between items-center flex-wrap gap-2 pt-2 border-t border-zinc-150">
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-zinc-450 font-mono">{language === 'ca' ? "Simular Likes: " : "Simular Likes: "}</span>
                  <input
                    type="number"
                    value={socialPostLikes}
                    onChange={(e) => setSocialPostLikes(Number(e.target.value) || 0)}
                    className="w-16 bg-white border border-zinc-200 rounded px-1 text-[10px] text-zinc-805 font-mono text-center"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-zinc-950 hover:bg-black text-white font-bold text-xs px-5 py-3 rounded-2xl transition flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Send size={12} className="text-[#ff0090]" />
                  {language === 'ca' ? "Simular alta de post i sincronització" : "Simular alta de post y sincronización"}
                </button>
              </div>
            </form>

            {socialPublishSuccess && (
              <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs p-4 rounded-2xl flex items-center gap-3">
                <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">✓ Reflectit Correctament en Directe!</p>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    {language === 'ca'
                      ? "Hem sincronitzat les dades de l'API. El post s'ha registrat i ja està llistat en el caneló públic de notícies de l'aplicació en temps real!"
                      : "Hemos sincronizado los datos de la API. El post se ha registrado y ya está listado en el canal público de noticias de la aplicación en tiempo real!"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* List of currently synced posts here */}
          <div className="space-y-4">
            <h4 className="font-sans font-black text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Globe size={14} />
              {language === 'ca' ? "POSTS IMPORTATS EN DIRECTE DE LES XARXES" : "POSTS IMPORTADOS EN DIRECTO DE LAS REDES"}
            </h4>

            {noticies.length === 0 ? (
              <p className="text-zinc-400 text-xs text-center py-6">{language === 'ca' ? "No hi ha contingut sincronitzat de moment." : "No hay contenido sincronizado por el momento."}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {noticies.map((post) => (
                  <div key={post.id} className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:shadow-md transition duration-350">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="font-mono bg-white border border-zinc-200 px-2 py-0.5 rounded text-zinc-650 uppercase font-bold tracking-wider">{post.xarxa}</span>
                        <span className="text-zinc-400 font-mono">{post.dataPublicacio}</span>
                      </div>
                      <p className="text-zinc-800 line-clamp-3 text-[11px] leading-relaxed">{post.text}</p>
                    </div>

                    {post.imatgeUrl && (
                      <div className="h-28 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200">
                        <img 
                          src={post.imatgeUrl} 
                          alt="Post preview" 
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-350"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-[10px] font-mono text-zinc-550">
                      <span className="font-bold flex items-center gap-1 text-zinc-750">👤 {post.usuari}</span>
                      <span>❤️ {post.likes} likes</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activePanelTab === 'personalitzacio' && (
        <AdminPersonalitzacio onAddLog={onAddLog} />
      )}

      {activePanelTab === 'cierre' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-fade-in" id="panel-view-cierre">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="font-sans font-black text-sm text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <span className="text-lg">📊</span> {language === 'ca' ? "Cierre de Día / Resum Diari" : "Cierre de Día / Resumen Diario"}
              </h2>
              <p className="text-[10px] text-zinc-400 mt-1">
                {language === 'ca'
                  ? "Registrat i classificat diàriament per data d'inscripció per a una comptabilitat òptima. Arxivat en una pestanya diferent del vostre full de Google."
                  : "Registrado y clasificado diariamente por fecha de inscripción para una contabilidad óptima. Archivado en una pestaña diferente de su hoja de Google."}
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                if (config.googleSheetSyncUrl) {
                  import('../googleSync').then(({ syncToGoogleSheet }) => {
                    syncToGoogleSheet(inscripcions, config.googleSheetSyncUrl, config.googleSheetSyncActive || true, config).then((ok) => {
                      if (ok) {
                        alert(language === 'ca' ? "S'ha forçat la sincronia amb èxit!" : "¡Sincronización forzada con éxito!");
                      } else {
                        alert(language === 'ca' ? "No s'ha pogut forçar la sincronia." : "No se pudo forzar la sincronización.");
                      }
                    }).catch(err => {
                      console.error("Error running forced syncToGoogleSheet:", err);
                      alert(language === 'ca' ? "S'ha produït un error durant la sincronia." : "Se produjo un error durante la sincronización.");
                    });
                  }).catch(err => {
                    console.error("Error dynamic importing googleSync for manual button:", err);
                    alert(language === 'ca' ? "No s'ha pogut carregar el mòdul de sincronització." : "No se pudo cargar el módulo de sincronización.");
                  });
                } else {
                  alert(language === 'ca' ? "Activeu primer la Sincronització de Full de Google al menú Preus i Camps." : "Active primero la Sincronización de Hoja de Google en el menú Precios y Campos.");
                }
              }}
              className="bg-zinc-900 hover:bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer self-stretch md:self-auto justify-center"
            >
              <RefreshCw size={13} />
              {language === 'ca' ? "Forçar Sincro Google Sheets" : "Forzar Sincro Google Sheets"}
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Visual KPI Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                <span className="text-xl">📈</span>
                <div>
                  <h4 className="text-[9px] text-emerald-800 font-mono font-bold uppercase tracking-wider">{language === 'ca' ? "RITME MITJÀ DE INSCRIPCIÓ" : "RITMO MEDIO DE INSCRIPCIÓN"}</h4>
                  <p className="font-sans font-black text-base text-emerald-950 mt-0.5">
                    {(inscripcions.length / Math.max(1, calculateDailySummaries(inscripcions).length)).toFixed(1)} {language === 'ca' ? "parelles / dia" : "parejas / día"}
                  </p>
                </div>
              </div>
              <div className="bg-fuchsia-50/60 border border-fuchsia-100 p-4 rounded-2xl flex items-center gap-3">
                <span className="text-xl">💰</span>
                <div>
                  <h4 className="text-[9px] text-fuchsia-800 font-mono font-bold uppercase tracking-wider">{language === 'ca' ? "RECAUDACIÓ MITJANA DIÀRIA" : "RECAUDACIÓN MEDIA DIARIA"}</h4>
                  <p className="font-sans font-black text-base text-fuchsia-950 mt-0.5">
                    {(inscripcions.reduce((acc, current) => acc + (current.preuCalculat || 0), 0) / Math.max(1, calculateDailySummaries(inscripcions).length)).toFixed(2)}€ / dia
                  </p>
                </div>
              </div>
              <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <h4 className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">{language === 'ca' ? "DIES REGISTRATS AMB ACTIVITAT" : "DÍAS REGISTRADOS CON ACTIVIDAD"}</h4>
                  <p className="font-sans font-black text-base text-zinc-800 mt-0.5">
                    {calculateDailySummaries(inscripcions).length} {language === 'ca' ? "dies actius" : "días activos"}
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            {(() => {
              const domasTarifaSummary = config?.tarifesDinamiques?.find(t => t.id === 'domas' || t.tipus === 'extra_domas');
              const isDomasActiveSummary = domasTarifaSummary ? domasTarifaSummary.actiu : false;
              const domasNameSummary = domasTarifaSummary?.nom 
                ? domasTarifaSummary.nom.replace(/\s*\(€\)\s*/g, '').replace('Cànon ', '') 
                : (language === 'ca' ? "Domassos" : "Covers");

              const mocadorTarifaSummary = config?.tarifesDinamiques?.find(t => t.id === 'mocador' || t.tipus === 'extra_mocador');
              const isMocadorActiveSummary = mocadorTarifaSummary ? mocadorTarifaSummary.actiu : false;
              const mocadorNameSummary = mocadorTarifaSummary?.nom 
                ? mocadorTarifaSummary.nom.replace(/\s*\(€\)\s*/g, '').replace('Cànon ', '') 
                : (language === 'ca' ? "Mocadors" : "Pañuelos");

              const totalSummaryCols = 8 + (isDomasActiveSummary ? 1 : 0) + (isMocadorActiveSummary ? 1 : 0);

              return (
                <div className="border border-zinc-250/80 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-mono text-[9px] uppercase tracking-wider">
                          <th className="p-3.5 font-bold">{language === 'ca' ? "Data" : "Fecha"}</th>
                          <th className="p-3.5 font-bold text-center">{language === 'ca' ? "Parelles" : "Parejas"}</th>
                          <th className="p-3.5 font-bold text-center">{language === 'ca' ? "En Espera" : "En Espera"}</th>
                          <th className="p-3.5 font-bold text-right">{language === 'ca' ? "Total Tarifa" : "Total Tarifa"}</th>
                          <th className="p-3.5 font-bold text-right">{language === 'ca' ? "Efectiu" : "Efectivo"}</th>
                          <th className="p-3.5 font-bold text-right">{language === 'ca' ? "Bizum" : "Bizum"}</th>
                          <th className="p-3.5 font-bold text-center">{language === 'ca' ? "Adults / Juv" : "Adults / Juv"}</th>
                          <th className="p-3.5 font-bold text-center">{language === 'ca' ? "Menors" : "Menores"}</th>
                          {isDomasActiveSummary && <th className="p-3.5 font-bold text-center">{domasNameSummary}</th>}
                          {isMocadorActiveSummary && <th className="p-3.5 font-bold text-center">{mocadorNameSummary}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 bg-white">
                        {calculateDailySummaries(inscripcions).length === 0 ? (
                          <tr>
                            <td colSpan={totalSummaryCols} className="p-8 text-center text-zinc-400">
                              {language === 'ca' ? "No hi ha inscripcions amb dates vàlides registrades." : "No hay inscripciones con fechas válidas registradas."}
                            </td>
                          </tr>
                        ) : (
                          calculateDailySummaries(inscripcions).map((row) => (
                            <tr key={row.dateStr} className="hover:bg-zinc-50/50 transition">
                              <td className="p-3.5 font-mono font-bold text-zinc-950">{row.dateStr}</td>
                              <td className="p-3.5 text-center font-bold text-zinc-800">{row.totalRegistrations}</td>
                              <td className="p-3.5 text-center">
                                {row.waitingListCount > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px]">
                                    {row.waitingListCount}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="p-3.5 text-right font-black text-zinc-900">{row.totalRevenue.toFixed(2)}€</td>
                              <td className="p-3.5 text-right text-zinc-600">{row.cashRevenue.toFixed(2)}€</td>
                              <td className="p-3.5 text-right text-zinc-600">{row.bizumRevenue.toFixed(2)}€</td>
                              <td className="p-3.5 text-center font-mono text-[10px] text-zinc-500">
                                {row.adultsCount}A / {row.juvenilsCount}J
                              </td>
                              <td className="p-3.5 text-center">
                                {row.minorsCount > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded-md font-bold text-[10px]">
                                    {row.minorsCount}
                                  </span>
                                ) : '-'}
                              </td>
                              {isDomasActiveSummary && <td className="p-3.5 text-center text-zinc-600">{row.domasCount || '-'}</td>}
                              {isMocadorActiveSummary && <td className="p-3.5 text-center text-zinc-600">{row.extraMocadorsCount || '-'}</td>}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Note indicator block */}
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 flex items-start gap-2.5 text-zinc-500 text-[11px] leading-relaxed">
              <span className="text-base shrink-0">📌</span>
              <div>
                <p className="font-bold text-zinc-700 mb-0.5">{language === 'ca' ? "Sincronització de doble pestanya activa" : "Sincronización de doble pestaña activa"}</p>
                <p className="mb-0 text-zinc-500 text-[10px]">
                  {language === 'ca'
                    ? "Cada vegada que es realitza, s'actualitzi o s'elimina una inscripció, el programari envia la llista raw a la pestanya 'Inscripcions' i genera aquest resum de Cierre de Día a la pestanya 'Cierre del Dia' al vostre full de Google de forma automatitzada i instantània."
                    : "Cada vez que se realiza, actualiza o elimina una inscripción, el software envía la lista cruda a la pestaña 'Inscripcions' y genera este resumen de Cierre de Día en la pestaña 'Cierre del Dia' en su hoja de Google de forma automatizada e instantánea."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}



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

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                Escriu "BORRAR" en majúscules per habilitar el buidat:
              </label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="Escriu BORRAR en majúscules"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-zinc-50 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-500 font-bold tracking-wider placeholder-zinc-400"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirmModal(false);
                  setClearConfirmText('');
                }}
                className="flex-1 py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                No, cancel·lar
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearConfirmText !== 'BORRAR'}
                className="flex-1 py-1 px-4 bg-red-650 disabled:bg-zinc-100 text-white disabled:text-zinc-400 hover:bg-red-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
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

      {/* Social Network Connection Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className={`p-3 text-white rounded-2xl ${
                  showConnectModal === 'instagram' ? 'bg-gradient-to-tr from-yellow-500 via-[#e1306c] to-fuchsia-600' :
                  showConnectModal === 'facebook' ? 'bg-blue-600' : 'bg-black'
                }`}>
                  <Globe size={18} />
                </span>
                <div>
                  <h3 className="font-sans font-black text-sm text-zinc-900 uppercase tracking-tight">
                    {language === 'ca' ? `Vincular ${showConnectModal.toUpperCase()}` : `Vincular ${showConnectModal.toUpperCase()}`}
                  </h3>
                  <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
                    {language === 'ca' ? "Sincronització de canal" : "Sincronización de canal"}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowConnectModal(null)}
                className="text-zinc-450 hover:text-zinc-600 p-1 cursor-pointer transition-colors"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-2.5xl text-[10px] text-zinc-650 leading-relaxed">
              {language === 'ca' ? (
                <span>
                  Connecta el compte d'<strong>El Tast Vilanova</strong> amb la plataforma per poder llegir, publicar i auto-llistar contingut de forma centralitzada.
                </span>
              ) : (
                <span>
                  Conecta la cuenta de <strong>El Tast Vilanova</strong> con la plataforma para poder leer, publicar y auto-listar contenido de forma centralizada.
                </span>
              )}
            </div>

            <form onSubmit={handleConfirmConnectSocial} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase font-mono">
                  {language === 'ca' ? "Nom d'Usuari / Handle" : "Nombre de Usuario / Handle"}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs">@</span>
                  <input
                    type="text"
                    required
                    value={connectUsername}
                    onChange={(e) => setConnectUsername(e.target.value)}
                    placeholder="eltastvng"
                    className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl pl-8 pr-3.5 py-2.5 text-xs focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase font-mono">
                  {language === 'ca' ? "Contrasenya o Token d'Accés" : "Contraseña o Token de Acceso"}
                </label>
                <input
                  type="password"
                  required
                  value={connectPassword}
                  onChange={(e) => setConnectPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 focus:border-[#ff0090] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(null)}
                  className="flex-1 py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {language === 'ca' ? "Cancel·lar" : "Cancelar"}
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className={`flex-1 py-2.5 px-4 font-bold text-xs rounded-xl transition text-white flex items-center justify-center gap-1.5 cursor-pointer ${
                    showConnectModal === 'instagram' ? 'bg-gradient-to-tr from-yellow-500 via-[#e1306c] to-fuchsia-600 hover:opacity-90' :
                    showConnectModal === 'facebook' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-black hover:bg-zinc-900'
                  }`}
                >
                  {isConnecting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{language === 'ca' ? "Vinculant..." : "Vinculando..."}</span>
                    </>
                  ) : (
                    <span>{language === 'ca' ? "Vincular" : "Vincular"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
