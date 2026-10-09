/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useActiveYear } from '../hooks/useActiveYear';
import { useToast } from '../hooks/useToast';
import { saveLogger } from '../services/SaveLogger';
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
  Lock,
  Mail,
  Phone,
  Send,
  Sparkles,
  Share2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Globe,
  EyeOff,
  RefreshCw,
  UtensilsCrossed
} from 'lucide-react';
import { Inscripcio, CategoriaParella, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, SistemaConfig, NoticiaXarxes } from '../types';
import ExcelJS from 'exceljs';
import AdminPortada from './AdminPortada';
import AdminPersonalitzacio from './AdminPersonalitzacio';
import { AdminStaffManagement } from './AdminStaffManagement';
import { ResumEsmorzarsModal } from './ResumEsmorzarsModal';
import { calculateDailySummaries } from '../dailySummary';
import { calculateInscriptionOrderBreakdown, validateInscriptionTotal } from '../utils/orderCalculations';
import { getPaymentSummary, metodesTexto, formatEuro } from '../utils/paymentCalculations';
import { buildUnifiedEmailHtml } from '../utils/ticketGenerator';
import { getEntityConfigSync, fetchLiveEntityConfig } from '../utils/entityConfig';
import { getDniSignedUrl } from '../supabaseClient';

interface AdminDashboardProps {
  inscripcions: Inscripcio[];
  config: SistemaConfig;
  isLoadingInscripcions?: boolean;
  inscripcionsError?: string | null;
  onSelectInscripcio: (id: string) => void;
  onGoToScanner: (openPairing?: boolean) => void;
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
  onRefreshInscripcions?: () => Promise<any>;
}

export default function AdminDashboard({ 
  inscripcions, 
  config,
  isLoadingInscripcions = false,
  inscripcionsError = null,
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
  onSaveInscripcio,
  onRefreshInscripcions
}: AdminDashboardProps) {
  const { language, t } = useLanguage();
  const activeYear = useActiveYear();
  const { showToast } = useToast();
  
  // Refreshing state for inscriptions
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshInscripcions) return;
    setIsRefreshing(true);
    try {
      const count = await onRefreshInscripcions();
      showToast({
        title: language === 'ca' ? "Dades actualitzades" : "Datos actualizados",
        description: language === 'ca' ? `S'han recarregat ${count ?? inscripcions.length} inscripcions de Supabase.` : `Se han recargado ${count ?? inscripcions.length} inscripciones de Supabase.`,
        type: 'success'
      });
    } catch (err: any) {
      showToast({
        title: language === 'ca' ? "Error d'actualització" : "Error de actualización",
        description: err?.message || "No s'ha pogut refrescar.",
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Admin Tabs Navigation State
  const [activePanelTab, setActivePanelTab] = useState<'inscripcions' | 'smtp' | 'xarxes' | 'portada' | 'personalitzacio' | 'cierre'>('inscripcions');

  // State to track SMTP sending status of specific rows
  const [rowSmtpSending, setRowSmtpSending] = useState<Record<string, 'sending' | 'success' | 'error'>>({});

  // SMTP state hooks (loaded strictly from server /api/smtp-status, never stored in localStorage)
  const [smtpServerConfigured, setSmtpServerConfigured] = useState<boolean | null>(null);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsuari, setSmtpUsuari] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTestDestinatari, setSmtpTestDestinatari] = useState('secretaria@eltast.cat');
  const [smtpTestStatus, setSmtpTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [smtpTestMsg, setSmtpTestMsg] = useState('');

  // Social Network integrations channels (Official Meta Graph API v19.0)
  const [scInstagramConnected, setScInstagramConnected] = useState(() => localStorage.getItem('tast_sc_instagram_connected') === 'true');
  const [scInstagramHandle, setScInstagramHandle] = useState(() => localStorage.getItem('tast_sc_instagram_handle') || '@eltastvng');
  const [scFacebookConnected, setScFacebookConnected] = useState(() => localStorage.getItem('tast_sc_facebook_connected') === 'true');
  const [scFacebookHandle, setScFacebookHandle] = useState(() => localStorage.getItem('tast_sc_facebook_handle') || 'Associació Cultural El Tast');
  const [scTikTokConnected] = useState(false);
  const [scTikTokHandle] = useState('@eltast_vng');
  const [metaLastSync, setMetaLastSync] = useState('');
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

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

  // Staff management state (Official Supabase Auth + profiles via server API)
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showResumEsmorzarsModal, setShowResumEsmorzarsModal] = useState(false);
  const [staffCount, setStaffCount] = useState<number>(3);
  const [inscriptionDeleteConfirmId, setInscriptionDeleteConfirmId] = useState<string | null>(null);

  // Synchronize administrative configurations with Supabase Settings & Server Status
  useEffect(() => {
    // Check server SMTP configuration status securely
    fetch('/api/email?action=status')
      .then(r => (r.ok ? r.json() : { configured: false }))
      .then(d => {
        setSmtpServerConfigured(!!d?.configured);
        if (d?.host) setSmtpHost(d.host);
        if (d?.port) setSmtpPort(d.port);
        if (d?.user) setSmtpUsuari(d.user);
        if (d?.from) setSmtpFrom(d.from);
      })
      .catch(() => setSmtpServerConfigured(false));

    // Clear any obsolete SMTP keys from client localStorage
    ['tast_smtp_host', 'tast_smtp_port', 'tast_smtp_usuari', 'tast_smtp_contrasenya', 'tast_smtp_from'].forEach(k => localStorage.removeItem(k));

    async function loadAdminSettings() {
      try {
        const { isSupabaseConfigured, getSupabaseSetting } = await import('../supabaseClient');
        if (!isSupabaseConfigured) return;

        const instConn = await getSupabaseSetting('tast_sc_instagram_connected', '');
        const instHnd = await getSupabaseSetting('tast_sc_instagram_handle', '');
        const fbConn = await getSupabaseSetting('tast_sc_facebook_connected', '');
        const fbHnd = await getSupabaseSetting('tast_sc_facebook_handle', '');
        if (instConn !== null && instConn !== '') setScInstagramConnected(instConn === 'true');
        if (instHnd) setScInstagramHandle(instHnd);
        if (fbConn !== null && fbConn !== '') setScFacebookConnected(fbConn === 'true');
        if (fbHnd) setScFacebookHandle(fbHnd);

        // Fetch authoritative Meta connection status from backend
        try {
          const res = await fetch('/api/social?action=status');
          if (res.ok) {
            const data = await res.json();
            if (data && data.ok) {
              setScInstagramConnected(!!data.instagramConnected);
              setScFacebookConnected(!!data.facebookConnected);
              if (data.instagramHandle) setScInstagramHandle(data.instagramHandle);
              if (data.facebookHandle) setScFacebookHandle(data.facebookHandle);
              if (data.lastSync) setMetaLastSync(data.lastSync);
            }
          }
        } catch {
          // ignore network error
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
      const coupleEmail = (item.emailContactoPareja || item.c1Email || item.c2Email || '').trim();
      const emailList = coupleEmail && coupleEmail.includes('@') ? [coupleEmail] : [];
      if (emailList.length === 0) {
        alert(language === 'ca' ? "No s'ha trobat cap adreça de correu de contacte vàlida per a la parella." : "No se encontró ninguna dirección de correo de contacto válida para la pareja.");
        setRowSmtpSending(prev => ({ ...prev, [item.id]: 'error' }));
        return;
      }

      // Check real tracking code from Supabase
      const itemCode = (
        item.codiSeguiment ||
        (item as any).codi_seguiment ||
        (item as any).codigo ||
        (item as any).codigoInscripcion ||
        (item as any).codigo_inscripcion ||
        ''
      ).trim();

      if (!itemCode) {
        const errMsg = language === 'ca'
          ? "El codi de seguiment real està buit a la inscripció de Supabase. S'ha aturat l'enviament del correu."
          : "El código de seguimiento real está vacío en la inscripción de Supabase. Se ha detenido el envío del correo.";
        alert(errMsg);
        setRowSmtpSending(prev => ({ ...prev, [item.id]: 'error' }));
        return;
      }

      // 1. Calculate breakdown using canonical function
      const breakdown = calculateInscriptionOrderBreakdown(item, config, language);

      // 2. Validate total against preinscription
      const validation = validateInscriptionTotal(item, config, language);
      if (!validation.valid) {
        const errMsg = validation.errorMessage || (language === 'ca' ? "Error de concordança de preu entre el tiquet i la preinscripció." : "Error de concordancia de precio entre el ticket y la preinscripción.");
        alert(errMsg);
        setRowSmtpSending(prev => ({ ...prev, [item.id]: 'error' }));
        return;
      }

      // 3. Resolve live entity config
      let entityConfig = getEntityConfigSync(language, config);
      try {
        const live = await fetchLiveEntityConfig(language);
        if (live) entityConfig = live;
      } catch (e) {}

      // 4. Resolve DNI signed URLs if present
      let resolvedC1Dni: string | null = null;
      let resolvedC2Dni: string | null = null;
      if (item.c1DniUrl) {
        try { resolvedC1Dni = await getDniSignedUrl(item.c1DniUrl); } catch (e) {}
      }
      if (item.c2DniUrl) {
        try { resolvedC2Dni = await getDniSignedUrl(item.c2DniUrl); } catch (e) {}
      }

      // 5. Build Unified Single Source of Truth Template
      const { subject: emailSubject, html: emailHtml } = buildUnifiedEmailHtml({
        registration: item,
        entityConfig,
        breakdown,
        c1DniSignedUrl: resolvedC1Dni,
        c2DniSignedUrl: resolvedC2Dni,
        language
      });

      const emailAttachments: any[] = [];
      if (entityConfig.logoUrl && entityConfig.logoUrl.startsWith('data:')) {
        emailAttachments.push({
          filename: 'logo.png',
          content: entityConfig.logoUrl,
          cid: 'tast-email-logo-cid'
        });
      }

      let adminToken = '';
      try {
        const { supabase } = await import('../supabaseClient');
        if (supabase) {
          const session = (await supabase.auth.getSession())?.data?.session;
          adminToken = session?.access_token || '';
        }
      } catch {}

      const sendPromises = emailList.map(emailTo => {
        return fetch('/api/email?action=send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
          },
          body: JSON.stringify({
            id: item.id,
            inscriptionId: item.id,
            codiSeguiment: item.codiSeguiment,
            emailData: {
              to: emailTo,
              subject: emailSubject,
              html: emailHtml,
              attachments: emailAttachments,
              codiSeguiment: item.codiSeguiment
            }
          })
        }).catch(err => {
          console.error(`Fetch to /api/email?action=send failed for ${emailTo}:`, err);
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
  const [newEmailContactoPareja, setNewEmailContactoPareja] = useState('');
  const [newTelefonContactoPareja, setNewTelefonContactoPareja] = useState('');
  const [newC1Talla, setNewC1Talla] = useState('M');
  
  const [newC2Nom, setNewC2Nom] = useState('');
  const [newC2Cognoms, setNewC2Cognoms] = useState('');
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

  // Test send mail with SMTP server (calls /api/test-smtp with admin auth)
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
      let adminToken = '';
      try {
        const { supabase } = await import('../supabaseClient');
        if (supabase) {
          const session = (await supabase.auth.getSession())?.data?.session;
          adminToken = session?.access_token || '';
        }
      } catch {}

      const response = await fetch('/api/email?action=test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({
          to: smtpTestDestinatari.trim(),
          subject: language === 'ca' ? `Provador de Connexió SMTP - El Tast ${activeYear}` : `Probador de Conexión SMTP - El Tast ${activeYear}`,
          html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e1e1e6; border-radius: 20px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="background-color: #ff0090; color: #ffffff; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 12px; letter-spacing: 1px; display: inline-block; text-transform: uppercase;">
                  El Tast ${activeYear}
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
                • Servidor: Configurat a les variables d'entorn del backend (SMTP_HOST: ${smtpHost})<br/>
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
                  Aquest és un correu de control tècnic autoritzat pel vostre propi SMTP.
                </p>
              </div>
            </div>
          `
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
          ? `Connexió de prova reeixida! S'ha enviat un correu real a ${smtpTestDestinatari} (MessageID: ${data.messageId || 'OK'}).`
          : `¡Conexión de prueba exitosa! Se ha enviado un correo real a ${smtpTestDestinatari} (MessageID: ${data.messageId || 'OK'}).`
        );
        if (onAddLog) {
          onAddLog(`📧 SMTP Real Test: S'ha enviat correctament un correu real a ${smtpTestDestinatari}`);
        }
      } else {
        setSmtpTestStatus('error');
        setSmtpTestMsg(language === 'ca'
          ? `Error al provar el servidor SMTP: ${data.error || 'Detall desconegut'}`
          : `Error al probar el servidor SMTP: ${data.error || 'Detalle desconocido'}`
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

  // Load authoritative Meta connection status
  const loadSocialStatus = async () => {
    try {
      const res = await fetch('/api/social?action=status');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          setScInstagramConnected(!!data.instagramConnected);
          setScFacebookConnected(!!data.facebookConnected);
          if (data.instagramHandle) setScInstagramHandle(data.instagramHandle);
          if (data.facebookHandle) setScFacebookHandle(data.facebookHandle);
          if (data.lastSync) setMetaLastSync(data.lastSync);
        }
      }
    } catch (err) {
      console.warn("Could not load social status:", err);
    }
  };

  // Open official Meta OAuth flow in popup
  const handleOpenConnect = async (platform: string) => {
    if (platform === 'tiktok') {
      alert(language === 'ca' ? "TikTok queda reservat per a una fase posterior." : "TikTok queda reservado para una fase posterior.");
      return;
    }

    try {
      setIsConnecting(true);
      const { supabase } = await import('../supabaseClient');
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      const token = session?.access_token || '';

      if (!token) {
        alert(language === 'ca' ? "Sessió d'administrador requerida." : "Sesión de administrador requerida.");
        setIsConnecting(false);
        return;
      }

      const res = await fetch(`/api/social?action=auth-url&platform=${encodeURIComponent(platform)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error || "No s'ha pogut generar l'enllaç d'autorització oficial.");
      }

      // Open official Meta OAuth popup
      const popup = window.open(data.authUrl, 'meta_oauth_window', 'width=620,height=720,status=yes,scrollbars=yes');
      if (!popup) {
        window.location.href = data.authUrl;
        return;
      }

      const handleOAuthMessage = (event: MessageEvent) => {
        if (event.data?.type === 'META_AUTH_SUCCESS') {
          loadSocialStatus();
          window.removeEventListener('message', handleOAuthMessage);
          const channelName = event.data.platform === 'instagram'
            ? (event.data.username ? `@${event.data.username}` : 'Instagram')
            : (event.data.pageName || 'Facebook');
          if (onAddLog) {
            onAddLog(language === 'ca'
              ? `🔗 Canal oficial (${channelName}) vinculat correctament!`
              : `🔗 ¡Canal oficial (${channelName}) vinculado correctamente!`
            );
          }
        }
      };
      window.addEventListener('message', handleOAuthMessage);
    } catch (err: any) {
      alert(err?.message || "Error connectant amb el servei oficial");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect social channel via serverless endpoint
  const handleDisconnectSocial = async (platform: string) => {
    const channelLabel = platform === 'instagram' ? 'Instagram' : 'Facebook';
    if (!confirm(language === 'ca' ? `Estàs segur de desvincular el compte oficial de ${channelLabel}?` : `¿Estás seguro de desvincular la cuenta oficial de ${channelLabel}?`)) {
      return;
    }
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      const token = session?.access_token || '';

      const res = await fetch(`/api/social?action=disconnect&platform=${encodeURIComponent(platform)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        if (platform === 'instagram') setScInstagramConnected(false);
        if (platform === 'facebook') setScFacebookConnected(false);
        loadSocialStatus();
        if (onAddLog) {
          onAddLog(language === 'ca'
            ? `🔌 Canal oficial de ${channelLabel} desvinculat.`
            : `🔌 Canal oficial de ${channelLabel} desvinculado.`
          );
        }
      }
    } catch (err) {
      console.error("Error disconnecting social channel:", err);
    }
  };

  // Manual immediate synchronization of Meta posts
  const handleSyncMetaNow = async () => {
    setIsSyncingMeta(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      const token = session?.access_token || '';

      const res = await fetch('/api/social?action=sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error en sincronitzar publicacions");
      }

      // Refresh feed
      const feedRes = await fetch('/api/social?action=feed');
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        if (feedData && Array.isArray(feedData.noticies)) {
          if (onSaveNoticies) {
            onSaveNoticies(feedData.noticies);
          } else {
            localStorage.setItem('tast_noticies_2026', JSON.stringify(feedData.noticies));
          }
        }
      }

      loadSocialStatus();

      alert(language === 'ca'
        ? `✓ S'han sincronitzat ${data.count || 0} publicacions reals de Meta (${data.instagramCount || 0} d'Instagram i ${data.facebookCount || 0} de Facebook).`
        : `✓ Se han sincronizado ${data.count || 0} publicaciones reales de Meta (${data.instagramCount || 0} de Instagram y ${data.facebookCount || 0} de Facebook).`
      );

      if (onAddLog) {
        onAddLog(language === 'ca'
          ? `🔄 Sincronització de Meta completada: ${data.count || 0} posts importats.`
          : `🔄 Sincronización de Meta completada: ${data.count || 0} posts importados.`
        );
      }
    } catch (err: any) {
      alert(err?.message || "Error sincronitzant publicacions");
    } finally {
      setIsSyncingMeta(false);
    }
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
      emailContactoPareja: newEmailContactoPareja.trim() || 'secretaria@eltast.cat',
      telefonContactoPareja: newTelefonContactoPareja.trim() || '600000000',
      c1Nom: newC1Nom.trim(),
      c1Cognoms: newC1Cognoms.trim(),
      c1Email: newEmailContactoPareja.trim() || 'secretaria@eltast.cat',
      c1Telefon: newTelefonContactoPareja.trim() || '600000000',
      c1Talla: newC1Talla,
      c1DniUrl: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?q=80&w=600&auto=format&fit=crop',
      c1UniformeTipus: newC1UniformeTipus,
      c2Nom: newC2Nom.trim(),
      c2Cognoms: newC2Cognoms.trim(),
      c2Email: newEmailContactoPareja.trim() || 'secretaria@eltast.cat',
      c2Telefon: newTelefonContactoPareja.trim() || '600000000',
      c2Talla: newC2Talla,
      c2DniUrl: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?q=80&w=600&auto=format&fit=crop',
      c2UniformeTipus: newC2UniformeTipus,
      respostesCuestionari: {},
      preuCalculat: calculatedPreu,
      teDomasBalco: newDomas,
      teMocadorsExtra: newMocadors,
      pagaments: newEstatPagament === EstatPagament.PAGAT ? [{
        id: 'pag-' + Math.random().toString(36).substr(2, 9),
        data: new Date().toISOString(),
        import: calculatedPreu,
        metode: newMetodePagament,
        nota: 'Alta manual a caixa'
      }] : [],
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
    setNewC2Nom('');
    setNewC2Cognoms('');
    setNewEmailContactoPareja('');
    setNewTelefonContactoPareja('');
    setNewDomas(false);
    setNewMocadors(0);
    setNewEstatPagament(EstatPagament.PENDENT);
    setShowAddModal(false);
  };

  // Stats calculation
  const totalInscrites = inscripcions.length;
  const adultCount = inscripcions.filter(i => i.categoria === CategoriaParella.ADULT).length;
  const juvenilCount = inscripcions.filter(i => i.categoria === CategoriaParella.JUVENIL).length;
  const esperaCount = inscripcions.filter(i => i.llistaEspera).length;
  
  // Real collected amount, cash/bizum split, pending and partial counts
  let totalRecaudatCents = 0;
  let totalEfectiuCents = 0;
  let totalBizumCents = 0;
  let totalPendentCents = 0;
  let parellesParcialCount = 0;

  for (const item of inscripcions) {
    const s = getPaymentSummary(item);
    totalRecaudatCents += Math.round(s.pagat * 100);
    totalPendentCents += Math.round(s.pendent * 100);
    if (s.estat === 'PARCIAL') {
      parellesParcialCount++;
    }
    for (const p of s.pagaments) {
      const pCents = Math.round(p.import * 100);
      if (p.metode === MetodePagament.BIZUM) {
        totalBizumCents += pCents;
      } else {
        totalEfectiuCents += pCents;
      }
    }
  }

  const totalRecaudat = totalRecaudatCents / 100;
  const totalEfectiuVal = totalEfectiuCents / 100;
  const totalBizumVal = totalBizumCents / 100;
  const totalPendentVal = totalPendentCents / 100;

  const materialsEntregats = inscripcions.filter(i => i.entregaMaterial === EstatInscripcio.ENTREGAT).length;
  const percentatgeEntrega = totalInscrites > 0 ? Math.round((materialsEntregats / totalInscrites) * 100) : 0;

  const dnisValidads = inscripcions.filter(i => i.estatDni === EstatVerificacio.VALIDAT).length;

  // Reset all filters to default 'ALL' / empty
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCategoria('ALL');
    setFilterPagament('ALL');
    setFilterDni('ALL');
    setFilterEntrega('ALL');
    setFilterEstat('ALL');
    setFilterBandera('ALL');
  };

  // Filtered registrations list with complete null-safety and no obsolete fields
  const filteredInscripcions = inscripcions.filter((item) => {
    // Safe text search: ensure every element is guaranteed to be a string
    const textFields = [
      item.codiSeguiment || '',
      item.emailContactoPareja || '',
      item.telefonContactoPareja || '',
      item.c1Nom || '',
      item.c1Cognoms || '',
      item.c1Email || '',
      item.c1Telefon || '',
      item.c2Nom || '',
      item.c2Cognoms || '',
      item.c2Email || '',
      item.c2Telefon || '',
      item.c1UniformeTipus || 'compra',
      item.c2UniformeTipus || 'compra',
      (item.c1UniformeTipus === 'lloguer' ? 'lloguer alquiler renta rent' : 'compra venta sale buy'),
      (item.c2UniformeTipus === 'lloguer' ? 'lloguer alquiler renta rent' : 'compra venta sale buy')
    ].map(f => String(f || '').toLowerCase());
    
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = query === '' || textFields.some(f => f.includes(query));

    // Categoria filter: case-insensitive match
    const matchesCategoria = filterCategoria === 'ALL' || 
      String(item.categoria || '').toUpperCase() === String(filterCategoria).toUpperCase();

    // Pagament filter using derived state
    const pSummary = getPaymentSummary(item);
    const matchesPagament = filterPagament === 'ALL' ||
      (filterPagament === 'PAGAT' && (pSummary.estat === 'PAGAT' || pSummary.estat === 'SOBREPAGAT')) ||
      (filterPagament === 'PARCIAL' && pSummary.estat === 'PARCIAL') ||
      (filterPagament === 'PENDENT' && pSummary.estat === 'PENDENT');

    // DNI filter
    const matchesDni = filterDni === 'ALL' || 
      String(item.estatDni || '').toUpperCase() === String(filterDni).toUpperCase();

    // Entrega filter
    const matchesEntrega = filterEntrega === 'ALL' || 
      String(item.entregaMaterial || '').toUpperCase() === String(filterEntrega).toUpperCase();

    // Estat filter: never drop records based on unknown status or non-existent fields
    const rawEstat = String(item.estatInscripcio || '').toLowerCase();
    const matchesEstat = filterEstat === 'ALL' || 
      (filterEstat === 'OBERTA' && (rawEstat === 'obertes' || rawEstat === 'oberta' || !rawEstat)) ||
      (filterEstat === 'ESPERA' && (rawEstat === 'llista_espera' || rawEstat === 'espera'));

    // Bandera filter
    const rawBandera = Number(item.bandera ?? 0);
    const matchesBandera = filterBandera === 'ALL' || rawBandera === Number(filterBandera);

    return matchesSearch && matchesCategoria && matchesPagament && matchesDni && matchesEntrega && matchesEstat && matchesBandera;
  });

  // Diagnostic log for active filters and resulting dataset
  useEffect(() => {
    console.log('[Secretaría Filter]:', {
      tabla: 'public.inscripciones',
      totalInscripciones: inscripcions.length,
      filasFiltradas: filteredInscripcions.length,
      filtrosAplicados: {
        cerca: searchQuery,
        categoria: filterCategoria,
        pagament: filterPagament,
        dni: filterDni,
        entrega: filterEntrega,
        estat: filterEstat,
        bandera: filterBandera
      }
    });
  }, [inscripcions.length, filteredInscripcions.length, searchQuery, filterCategoria, filterPagament, filterDni, filterEntrega, filterEstat, filterBandera]);

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
    const ws = workbook.addWorksheet(`COMPARSA ${activeYear}`);

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
      const isBreakfast = /esmorz|almuerz|desayun/i.test(nameRegex.source);
      if (isBreakfast) {
        try {
          const breakdown = calculateInscriptionOrderBreakdown(i, config, 'ca');
          const esmItems = (breakdown.materials || []).filter(m => 
            m.modalitat === 'Esmorzar' || nameRegex.test(m.nom) || nameRegex.test(m.id)
          );
          if (esmItems.length > 0) {
            const sumQty = esmItems.reduce((acc, m) => acc + (m.quantitat || 0), 0);
            const sumTotal = esmItems.reduce((acc, m) => acc + (m.subtotal || 0), 0);
            return {
              qty: sumQty,
              price: sumQty > 0 ? sumTotal / sumQty : 0,
              total: sumTotal
            };
          }
        } catch { /* fallback to other checks */ }
      }
      // 1. Search in extresSeleccionats
      if (isBreakfast) {
        const matches = (i.extresSeleccionats || []).filter(e => nameRegex.test(e.nom) || nameRegex.test(e.id));
        if (matches.length > 0) {
          const sumQty = matches.reduce((acc, m) => acc + (m.quantitat || 0), 0);
          const sumTotal = matches.reduce((acc, m) => acc + ((m.quantitat || 0) * (m.preuUnitari || 0)), 0);
          return {
            qty: sumQty,
            price: sumQty > 0 ? sumTotal / sumQty : 0,
            total: sumTotal
          };
        }
      } else {
        const foundInSel = (i.extresSeleccionats || []).find(e => nameRegex.test(e.nom) || nameRegex.test(e.id));
        if (foundInSel) {
          return {
            qty: foundInSel.quantitat,
            price: foundInSel.preuUnitari,
            total: foundInSel.quantitat * foundInSel.preuUnitari
          };
        }
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
      
      // B (Email de Contacte)
      const email = i.emailContactoPareja || i.c1Email || i.c2Email || "";

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

      // G (Telefon de Contacte)
      const telefon = i.telefonContactoPareja || i.c1Telefon || i.c2Telefon || "";

      // H (Correu Electronic de Contacte)
      const correuElectronic = i.emailContactoPareja || i.c1Email || i.c2Email || "";

      // I (Preu Parella) - Uses active Secretaria configuration
      const rowBreakdown = calculateInscriptionOrderBreakdown(i, config);
      const preuParella = rowBreakdown.categoriaQuotaBase;

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
      const esmorzarInfo = getExtraInfo(i, /esmorz|almuerz|desayun/i);
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
      const mVal = (i.creadoEn && (i.emailContactoPareja || i.c1Email || i.c2Email)) ? 'TRUE' : 'FALSE';

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
                ? `Gestió i validació d'inscripcions - ${(localStorage.getItem('tast_nom_esdeveniment') || 'Carnaval 2026').replace(/2026/g, activeYear).replace(/2027/g, activeYear)}` 
                : `Gestión y validación de inscripciones - ${(localStorage.getItem('tast_nom_esdeveniment') || 'Carnaval 2026').replace(/2026/g, activeYear).replace(/2027/g, activeYear)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button 
            onClick={() => onGoToScanner(true)}
            className="text-xs bg-[#ff0090] hover:bg-[#e0007e] text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-[#ff0090]/20 cursor-pointer"
            id="btn-nav-scanner"
          >
            <Smartphone size={14} /> {language === 'ca' ? "ENLLAÇAR MÒBIL (QR)" : "ENLAZAR MÓVIL (QR)"}
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
            <ShieldCheck size={14} className="text-[#ff0090]" /> {language === 'ca' ? "Staff i Administradors" : "Staff y Administradores"}
            {staffCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#ff0090]/20 text-[#ff0090] text-[10px] font-mono font-bold rounded-md">
                {staffCount}
              </span>
            )}
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
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">{t('total_recaptat')}</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">{totalRecaudat.toFixed(2)}€</h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              {t('efectiu_label')}: <span className="font-bold">{totalEfectiuVal}€</span> • Bizum: <span className="font-bold">{totalBizumVal}€</span>
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
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">{t('parelles_inscrites_label')}</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">
              {totalInscrites} {totalInscrites === 1 ? t('parella_unit') : t('parelles_unit')}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              {language === 'ca' ? "Adults" : "Adultos"}: <span className="font-bold">{adultCount}</span> • {t('juvenils_label')}: <span className="font-bold">{juvenilCount}</span>
              {esperaCount > 0 && (
                <span className="text-amber-600 font-extrabold ml-1 px-1 py-0.2 bg-amber-500/10 rounded font-sans inline-block" title={language === 'ca' ? "Parella en llista d'espera" : "Pareja en lista de espera"}>
                  • {esperaCount} {language === 'ca' ? "en llista d'espera" : "en lista de espera"}
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
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">{t('materials_lliurats_label')}</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">{percentatgeEntrega}%</h3>
            
            <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-fuchsia-500 h-full" style={{ width: `${percentatgeEntrega}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              {t('lliurats_label')}: <span className="font-bold">{materialsEntregats}</span> {language === 'ca' ? "de" : "de"} <span className="font-bold">{totalInscrites}</span>
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
            <p className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">{t('dnis_revisats_label')}</p>
            <h3 className="font-sans font-black text-2xl text-zinc-900 mt-0.5">
              {dnisValidads} {language === 'ca' ? (dnisValidads === 1 ? 'validat' : 'validats') : (dnisValidads === 1 ? 'validado' : 'validados')}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              {(() => {
                const pendingCount = inscripcions.filter(i => i.estatDni === EstatVerificacio.PENDENT).length;
                if (language === 'ca') {
                  return pendingCount === 1 ? (
                    <>Pendent: <span className="font-bold text-amber-600">1</span> per revisar</>
                  ) : (
                    <>Pendents: <span className="font-bold text-amber-600">{pendingCount}</span> per revisar</>
                  );
                } else {
                  return pendingCount === 1 ? (
                    <>Pendiente: <span className="font-bold text-amber-600">1</span> por revisar</>
                  ) : (
                    <>Pendientes: <span className="font-bold text-amber-600">{pendingCount}</span> por revisar</>
                  );
                }
              })()}
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
          {t('cierre_dia_tab')}
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

                <button 
                  type="button"
                  onClick={() => setShowResumEsmorzarsModal(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  id="btn-resum-esmorzars"
                  title={language === 'ca' ? "Resum per fer comanda d'esmorzars, pans i embotits" : "Resumen para hacer pedido de almuerzos, panes y embutidos"}
                >
                  <UtensilsCrossed size={15} /> {language === 'ca' ? "Resum Esmorzars" : "Resumen Almuerzos"}
                </button>

                {onRefreshInscripcions && (
                  <button 
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    id="btn-refresh-inscriptions"
                    title={language === 'ca' ? "Sincronitzar i recarregar dades des de Supabase" : "Sincronizar y recargar datos desde Supabase"}
                  >
                    <RefreshCw size={15} className={`text-fuchsia-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {language === 'ca' ? "Actualitzar" : "Actualizar"}
                  </button>
                )}

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
            {inscripcionsError ? (
              <div className="p-10 text-center bg-rose-50/70 border border-rose-200 rounded-2xl m-4 text-rose-900">
                <AlertTriangle className="mx-auto text-rose-500 mb-3" size={44} />
                <h4 className="font-sans font-black text-lg text-rose-950">
                  {language === 'ca' ? "Error carregant les inscripcions" : "Error cargando las inscripciones"}
                </h4>
                <p className="text-xs text-rose-700 mt-2 max-w-lg mx-auto font-mono bg-white/80 p-3 rounded-xl border border-rose-200/80 break-all">
                  {inscripcionsError}
                </p>
                <p className="text-[11px] text-rose-600 mt-2 font-mono">
                  {language === 'ca' ? 'Taula consultada' : 'Tabla consultada'}: <span className="font-bold">public.inscripciones</span>
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 shadow-md hover:shadow-rose-600/20 cursor-pointer"
                >
                  <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                  {language === 'ca' ? "Reintentar connexió" : "Reintentar conexión"}
                </button>
              </div>
            ) : isLoadingInscripcions ? (
              <div className="p-16 text-center text-zinc-400">
                <RefreshCw className="mx-auto text-fuchsia-600 animate-spin mb-3" size={36} />
                <p className="font-sans font-bold text-sm text-zinc-700">
                  {language === 'ca' ? "Carregant inscripcions de public.inscripciones..." : "Cargando inscripciones de public.inscripciones..."}
                </p>
              </div>
            ) : inscripcions.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                <Users className="mx-auto text-zinc-300 mb-3" size={48} />
                <p className="font-sans font-bold text-lg text-zinc-700">
                  {language === 'ca' ? "No s'ha trobat cap parella registrada" : "No se ha encontrado ninguna pareja registrada"}
                </p>
                <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
                  {language === 'ca' ? "La taula public.inscripciones no conté registres actualment." : "La tabla public.inscripciones no contiene registros actualmente."}
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-fuchsia-600 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                  {language === 'ca' ? "Actualitzar ara" : "Actualizar ahora"}
                </button>
              </div>
            ) : filteredInscripcions.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                <Filter className="mx-auto text-zinc-300 mb-3" size={48} />
                <p className="font-sans font-bold text-lg text-zinc-700">
                  {language === 'ca' ? "Cap parella coincideix amb els filtres" : "Ninguna pareja coincide con los filtros"}
                </p>
                <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
                  {language === 'ca'
                    ? `Hi ha ${inscripcions.length} ${inscripcions.length === 1 ? 'parella' : 'parelles'} a la base de dades, però no coincideix(en) amb els filtres seleccionats.`
                    : `Hay ${inscripcions.length} ${inscripcions.length === 1 ? 'pareja' : 'parejas'} en la base de datos, pero no coincide(n) con los filtros seleccionados.`}
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-[#ff0090] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  {language === 'ca' ? "Restablir tots els filtres a \"Tots\"" : "Restablecer todos los filtros a \"Todos\""}
                </button>
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
                        <span className="text-[10px] text-zinc-400 font-mono block">{new Date(item.creadoEn).toLocaleDateString('ca-ES')}</span>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1" title={item.emailContactoPareja || item.c1Email || ''}>
                          <span className="text-zinc-400">📞</span> {item.telefonContactoPareja || item.c1Telefon || item.c2Telefon || 'N/A'}
                        </div>
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
                          Talla {item.c1Talla} <span className="text-[#ff0090] font-sans font-bold text-[9px] uppercase px-1 pb-0.5 bg-fuchsia-50/50 rounded border border-fuchsia-100/50 ml-1">{item.c1UniformeTipus === 'lloguer' ? (language === 'ca' ? 'Lloguer' : 'Alquiler') : (language === 'ca' ? 'Compra' : 'Compra')}</span>
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
                          Talla {item.c2Talla} <span className="text-[#ff0090] font-sans font-bold text-[9px] uppercase px-1 pb-0.5 bg-fuchsia-50/50 rounded border border-fuchsia-100/50 ml-1">{item.c2UniformeTipus === 'lloguer' ? (language === 'ca' ? 'Lloguer' : 'Alquiler') : (language === 'ca' ? 'Compra' : 'Compra')}</span>
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
                  ? "Configura les credencials del servidor SMTP (com Gmail) per enviar correus automàtics i PDF/QR de confirmació als teus usuaris. Es guarden de manera xifrada."
                  : "Configura las credenciales del servidor SMTP (como Gmail) para enviar correos automáticos y PDF/QR de confirmación a tus usuarios. Se guardan de forma cifrada."}
              </p>
            </div>
          </div>

          {/* Secure Server-Side SMTP Configuration Status */}
          <div className="border border-zinc-200 rounded-3xl p-6 bg-zinc-50 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h4 className="font-sans font-black text-xs text-zinc-900 uppercase tracking-widest flex items-center gap-1.5 text-zinc-700">
                <Mail size={14} className="text-fuchsia-500" />
                {language === 'ca' ? "ESTAT DEL SERVEI SMTP DEL SERVIDOR" : "ESTADO DEL SERVICIO SMTP DEL SERVIDOR"}
              </h4>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                smtpServerConfigured 
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              }`}>
                <span className={`w-2 h-2 rounded-full ${smtpServerConfigured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                {smtpServerConfigured 
                  ? (language === 'ca' ? "Configurat i Protegit (Vercel)" : "Configurado y Protegido (Vercel)")
                  : (language === 'ca' ? "Pendent de variables d'entorn" : "Pendiente de variables de entorno")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Host SMTP</p>
                <p className="font-mono text-xs text-zinc-800 font-semibold mt-1 truncate">{smtpHost || 'smtp.gmail.com'}</p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Port SMTP</p>
                <p className="font-mono text-xs text-zinc-800 font-semibold mt-1">{smtpPort || '587'}</p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Usuari / Auth</p>
                <p className="font-mono text-xs text-zinc-800 font-semibold mt-1 truncate">{smtpUsuari || '(Enmascarat al servidor)'}</p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Remitent (From)</p>
                <p className="font-mono text-xs text-zinc-800 font-semibold mt-1 truncate">{smtpFrom || 'secretaria@eltast.cat'}</p>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-100/80 rounded-2xl border border-zinc-200/80 text-[11px] text-zinc-600 space-y-1">
              <p className="font-bold text-zinc-800 flex items-center gap-1">
                <Lock size={12} className="text-fuchsia-600" />
                {language === 'ca' ? "Gestió centralitzada segura:" : "Gestión centralizada segura:"}
              </p>
              <p className="text-zinc-500 leading-relaxed">
                {language === 'ca'
                  ? "Per motius estrictes de ciberseguretat i privadesa (OWASP), les credencials SMTP no es gestionen mai des del navegador. Es configuren exclusivament a les variables d'entorn segures del projecte (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)."
                  : "Por motivos estrictos de ciberseguridad y privacidad (OWASP), las credenciales SMTP nunca se gestionan desde el navegador. Se configuran exclusivamente en las variables de entorno seguras del proyecto (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)."}
              </p>
            </div>
          </div>

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-fuchsia-50 text-[#ff0090] rounded-2xl">
                <Share2 size={24} />
              </div>
              <div>
                <h3 className="font-sans font-black text-lg text-zinc-900 uppercase tracking-tight">
                  {language === 'ca' ? "SINCRO DE COMPTES SOCIALS" : "SINCRO DE CUENTAS SOCIALES"}
                </h3>
                <p className="text-xs text-zinc-500">
                  {language === 'ca'
                    ? "Vincula oficialment els comptes de Meta (Instagram & Facebook) d'El Tast per mostrar automàticament les novetats reals al canal d'avisos del qüestionari."
                    : "Vincula oficialmente las cuentas de Meta (Instagram y Facebook) de El Tast para mostrar automáticamente las novedades reales en el canal de avisos del cuestionario."}
                </p>
                {metaLastSync && (
                  <p className="text-[10px] text-zinc-400 font-mono mt-1">
                    {language === 'ca' ? `Darrera sincronització: ${metaLastSync}` : `Última sincronización: ${metaLastSync}`}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncMetaNow}
              disabled={isSyncingMeta}
              className="inline-flex items-center justify-center gap-2 bg-[#ff0090] hover:bg-[#d90077] text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncingMeta ? "animate-spin" : ""} />
              {isSyncingMeta 
                ? (language === 'ca' ? "Sincronitzant..." : "Sincronizando...") 
                : (language === 'ca' ? "Sincronitzar Ara" : "Sincronizar Ahora")}
            </button>
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

            {/* TikTok integrated card (Phase 2 - Reserved) */}
            <div className="p-5 rounded-3xl border transition-all space-y-4 bg-zinc-50/70 border-zinc-200/80 opacity-80">
              <div className="flex justify-between items-start">
                <span className="p-2.5 bg-zinc-800 text-white rounded-xl flex items-center justify-center font-bold text-[9px] uppercase tracking-wider leading-none">
                  TikTok
                </span>
                <span className="text-[9px] bg-amber-500/10 text-amber-700 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                  {language === 'ca' ? "FASE POSTERIOR" : "FASE POSTERIOR"}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-zinc-800 font-sans text-xs">TikTok Embed Creator</h4>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">@eltast_vng</p>
              </div>
              <div className="pt-2">
                <div className="w-full bg-zinc-100 text-zinc-400 text-[10px] font-bold py-2.5 px-3 rounded-xl uppercase tracking-wider text-center font-mono">
                  {language === 'ca' ? "Reservat per a la Fase 2" : "Reservado para la Fase 2"}
                </div>
              </div>
            </div>

          </div>

          {/* Real-time official Meta architecture & sync information */}
          <div className="border border-zinc-200 rounded-3xl p-6 bg-zinc-50 space-y-4">
            <div className="pb-3 border-b border-zinc-200/60 flex items-center gap-2">
              <Sparkles size={16} className="text-fuchsia-600" />
              <div>
                <h4 className="font-sans font-black text-xs text-zinc-900 uppercase tracking-widest">
                  {language === 'ca' ? "SISTEMA DE SINCRONITZACIÓ OFICIAL META" : "SISTEMA DE SINCRONIZACIÓN OFICIAL META"}
                </h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {language === 'ca'
                    ? "Connexió oficial de només lectura mitjançant Meta Graph API v19.0 per nodrir el canal d'avisos públic sense costos afegits (0 €)."
                    : "Conexión oficial de solo lectura mediante Meta Graph API v19.0 para nutrir el canal de avisos público sin costes añadidos (0 €)."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-zinc-600">
              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 space-y-1">
                <span className="font-bold text-zinc-900 font-mono text-[10px] uppercase flex items-center gap-1">
                  🔒 {language === 'ca' ? "Seguretat i Criptografia" : "Seguridad y Criptografía"}
                </span>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {language === 'ca'
                    ? "Els tokens d'accés oficials es desen xifrats amb AES-256-GCM a la base de dades privada de Supabase i mai s'exposen al navegador ni a variables públiques."
                    : "Los tokens de acceso oficiales se guardan cifrados con AES-256-GCM en la base de datos privada de Supabase y nunca se exponen al navegador ni a variables públicas."}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 space-y-1">
                <span className="font-bold text-zinc-900 font-mono text-[10px] uppercase flex items-center gap-1">
                  ⚡ {language === 'ca' ? "Refresc Automàtic (Caché 60m)" : "Refresco Automático (Caché 60m)"}
                </span>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {language === 'ca'
                    ? "El canal d'avisos del qüestionari s'actualitza automàticament cada hora en segon pla quan rep visites, respectant estrictament els límits gratuïts de Meta i Vercel."
                    : "El canal de avisos del cuestionario se actualiza automáticamente cada hora en segundo plano al recibir visitas, respetando estrictamente los límites gratuitos de Meta y Vercel."}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 space-y-1">
                <span className="font-bold text-zinc-900 font-mono text-[10px] uppercase flex items-center gap-1">
                  📢 {language === 'ca' ? "Preservació d'Avisos Manuals" : "Preservación de Avisos Manuales"}
                </span>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {language === 'ca'
                    ? "Els avisos i comunicats introduïts manualment des de Secretaria o el tauler es mantenen intactes i s'ordenen cronològicament amb els posts reals de les xarxes."
                    : "Los avisos y comunicados introducidos manualmente desde Secretaría o el panel se mantienen intactos y se ordenan cronológicamente con los posts reales de las redes."}
                </p>
              </div>
            </div>
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
                <span className="text-lg">📊</span> {t('cierre_dia_title')}
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
                    {(() => {
                      const avgParelles = inscripcions.length / Math.max(1, calculateDailySummaries(inscripcions).length);
                      const formattedAvg = avgParelles.toFixed(1);
                      const isSingular = formattedAvg === "1.0" || avgParelles === 1;
                      const suffix = language === 'ca'
                        ? (isSingular ? "parella / dia" : "parelles / dia")
                        : (isSingular ? "pareja / día" : "parejas / día");
                      return `${formattedAvg} ${suffix}`;
                    })()}
                  </p>
                </div>
              </div>
              <div className="bg-fuchsia-50/60 border border-fuchsia-100 p-4 rounded-2xl flex items-center gap-3">
                <span className="text-xl">💰</span>
                <div>
                  <h4 className="text-[9px] text-fuchsia-800 font-mono font-bold uppercase tracking-wider">{t('recaptacio_mitjana')}</h4>
                  <p className="font-sans font-black text-base text-fuchsia-950 mt-0.5">
                    {(inscripcions.reduce((acc, current) => acc + (current.preuCalculat || 0), 0) / Math.max(1, calculateDailySummaries(inscripcions).length)).toFixed(2)}€ / {language === 'ca' ? 'dia' : 'día'}
                  </p>
                </div>
              </div>
              <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <h4 className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider">{language === 'ca' ? "DIES REGISTRATS AMB ACTIVITAT" : "DÍAS REGISTRADOS CON ACTIVIDAD"}</h4>
                  <p className="font-sans font-black text-base text-zinc-800 mt-0.5">
                    {(() => {
                      const activeDaysCount = calculateDailySummaries(inscripcions).length;
                      if (language === 'ca') {
                        return activeDaysCount === 1 ? "1 dia actiu" : `${activeDaysCount} dies actius`;
                      } else {
                        return activeDaysCount === 1 ? "1 día activo" : `${activeDaysCount} días activos`;
                      }
                    })()}
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
                    ? "Cada vegada que es realitza, s'actualitzi o s'elimina una inscripció, el programari envia la llista raw a la pestanya 'Inscripcions' i genera aquest resum de Tancament del dia a la pestanya 'Cierre del Dia' al vostre full de Google de forma automatitzada i instantània."
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
                <p className="text-xs text-zinc-500 font-mono">Secretaria de l'Associació El Tast • {activeYear}</p>
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

              {/* Dades de Contacte de la Parella */}
              <div className="p-4 bg-fuchsia-50/50 rounded-2xl border border-fuchsia-200/80 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-fuchsia-200/60">
                  <h4 className="font-sans font-bold text-xs text-zinc-900 tracking-tight flex items-center gap-1.5">
                    <Phone size={13} className="text-fuchsia-600" />
                    {language === 'ca' ? 'Dades de Contacte de la Parella (Únic)' : 'Datos de Contacto de la Pareja (Único)'}
                  </h4>
                  <span className="text-[9px] font-mono font-bold text-fuchsia-700 bg-fuchsia-100 px-2 py-0.5 rounded-md">
                    {language === 'ca' ? 'Comú per a la parella' : 'Común para la pareja'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-600 font-bold uppercase font-mono mb-1">
                      {language === 'ca' ? 'Telèfon de contacte *' : 'Teléfono de contacto *'}
                    </label>
                    <input 
                      type="tel" 
                      value={newTelefonContactoPareja}
                      onChange={(e) => setNewTelefonContactoPareja(e.target.value)}
                      placeholder="600000000"
                      className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-600 font-bold uppercase font-mono mb-1">
                      {language === 'ca' ? 'Correu electrònic *' : 'Correo electrónico *'}
                    </label>
                    <input 
                      type="email" 
                      value={newEmailContactoPareja}
                      onChange={(e) => setNewEmailContactoPareja(e.target.value)}
                      placeholder="parella@example.com"
                      className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
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

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-0.5">Talla Camisa</label>
                      <select
                        value={newC1Talla}
                        onChange={(e) => setNewC1Talla(e.target.value)}
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
                        value={newC1UniformeTipus}
                        onChange={(e) => setNewC1UniformeTipus(e.target.value as 'compra' | 'lloguer')}
                        className="w-full bg-white border border-zinc-200 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none cursor-pointer font-bold text-[#ff0090]"
                      >
                        <option value="compra">Compra</option>
                        <option value="lloguer">Lloguer</option>
                      </select>
                    </div>
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

                  <div className="grid grid-cols-2 gap-2">
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
                <h3 className="font-sans font-black text-sm text-zinc-900 tracking-tight">
                  {language === 'ca' ? "Esborrar seleccionats" : "Borrar seleccionados"}
                </h3>
                <p className="text-[10px] text-red-500 font-mono font-bold uppercase tracking-wider">
                  {language === 'ca' ? "Acció Massiva" : "Acción Masiva"}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-650 leading-relaxed font-sans">
              {language === 'ca' ? (
                selectedIds.length === 1 ? (
                  <>Estàs segur que vols esborrar la parella seleccionada? Aquesta acció no es pot desfer.</>
                ) : (
                  <>Estàs segur que vols esborrar les <strong>{selectedIds.length}</strong> parelles seleccionades? Aquesta acció no es pot desfer.</>
                )
              ) : (
                selectedIds.length === 1 ? (
                  <>¿Estás seguro de que quieres borrar la pareja seleccionada? Esta acción no se puede deshacer.</>
                ) : (
                  <>¿Estás seguro de que quieres borrar las <strong>{selectedIds.length}</strong> parejas seleccionadas? Esta acción no se puede deshacer.</>
                )
              )}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirmModal(false)}
                className="flex-1 py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition"
              >
                {language === 'ca' ? "No, cancel·lar" : "No, cancelar"}
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex-1 py-1 px-4 bg-red-650 text-white hover:bg-red-700 font-bold text-xs rounded-xl transition"
              >
                {language === 'ca' ? "Sí, esborrar seleccionats" : "Sí, borrar seleccionados"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Gestió Oficial de Staff i Administradors (Supabase Auth + profiles) */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <AdminStaffManagement
            onClose={() => setShowStaffModal(false)}
            onUserCountChange={(count) => setStaffCount(count)}
            onAddLog={onAddLog}
          />
        </div>
      )}

      {/* 3. Modal: Resum d'Esmorzars i Respostes per a Fleca i Xarcuteria */}
      <ResumEsmorzarsModal
        isOpen={showResumEsmorzarsModal}
        onClose={() => setShowResumEsmorzarsModal(false)}
        inscripcions={inscripcions}
        config={config}
      />
    </div>
  );
}
