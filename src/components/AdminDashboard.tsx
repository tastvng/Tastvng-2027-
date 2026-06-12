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
  EyeOff
} from 'lucide-react';
import { Inscripcio, CategoriaParella, EstatPagament, EstatVerificacio, EstatInscripcio, MetodePagament, SistemaConfig, StaffMember, NoticiaXarxes } from '../types';
import * as XLSX from 'xlsx';
import AdminPortada from './AdminPortada';
import AdminPersonalitzacio from './AdminPersonalitzacio';

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
  onSaveNoticies
}: AdminDashboardProps) {
  const { language, t } = useLanguage();
  
  // Admin Tabs Navigation State
  const [activePanelTab, setActivePanelTab] = useState<'inscripcions' | 'smtp' | 'xarxes' | 'portada' | 'personalitzacio'>('inscripcions');

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
    if (!smtpHost.trim() || !smtpPort.trim() || !smtpUsuari.trim() || !smtpContrasenya.trim()) {
      setSmtpTestStatus('error');
      setSmtpTestMsg(language === 'ca' 
        ? "Si us plau, omple tots els camps del servidor SMTP (host, port, usuari i contrasenya) abans de provar."
        : "Por favor, rellena todos los campos del servidor SMTP (host, port, usuario y contraseña) antes de probar."
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
          smtpConfig: {
            host: smtpHost,
            port: smtpPort,
            user: smtpUsuari,
            pass: smtpContrasenya,
            senderName: language === 'ca' ? "Inscripcions El Tast" : "Inscripciones El Tast"
          },
          emailData: {
            to: smtpTestDestinatari || smtpUsuari,
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
                  • Servidor: ${smtpHost}<br/>
                  • Port: ${smtpPort}<br/>
                  • Usuari: ${smtpUsuari}<br/>
                  • Data/Hora: ${new Date().toLocaleString()}<br/>
                  • Control: TLS Cryptographic Tunnel Actiu
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
          {language === 'ca' ? "Connexió Xarxes Socials" : "Conexión Redes Sociales"}
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
                  placeholder="Cerca per nom, cognom, telèfon, email o codi..."
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
                  <Plus size={15} className="text-[#ff0090]" /> Afegir Parella Manual
                </button>

                <button 
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  id="btn-export-excel"
                >
                  <FileSpreadsheet size={15} /> Exportar Excel
                </button>

                {selectedIds.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setShowBulkDeleteConfirmModal(true)}
                    className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs px-4 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
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
                  ? "Configura el protocol SMTP de secretaria per enviar rebuts de preinscripció i justificants QR directament als usuaris de forma automàtica."
                  : "Configura el protocolo SMTP de secretaría para enviar billetes de preinscripción y justificantes QR directamente a los usuarios de forma automática."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSmtp} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {language === 'ca' ? "Servidor SMTP Host" : "Servidor SMTP Host"}
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-4 py-3 text-xs focus:outline-none transition-all font-sans text-zinc-800"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {language === 'ca' ? "Port de sortida (Port)" : "Puerto de salida (Port)"}
              </label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-4 py-3 text-xs focus:outline-none transition-all font-sans text-zinc-800"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {language === 'ca' ? "Compte de Correu (Usuari)" : "Cuenta de Correo (Usuario)"}
              </label>
              <input
                type="email"
                value={smtpUsuari}
                onChange={(e) => setSmtpUsuari(e.target.value)}
                placeholder="tastvng@gmail.com"
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-4 py-3 text-xs focus:outline-none transition-all font-sans text-zinc-800"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {language === 'ca' ? "Contrasenya / Token d'Aplicació (Password)" : "Contraseña / Token de Aplicación (Password)"}
              </label>
              <div className="relative">
                <input
                  type={showSmtpPassword ? "text" : "password"}
                  value={smtpContrasenya}
                  onChange={(e) => setSmtpContrasenya(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-4 py-3 pr-10 text-xs focus:outline-none transition-all font-sans text-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#ff0090] cursor-pointer"
                >
                  {showSmtpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="md:col-span-2 bg-fuchsia-50/40 border border-fuchsia-100 rounded-2xl p-4 flex gap-3 text-xs text-zinc-655 leading-relaxed">
              <AlertCircle size={18} className="text-[#ff0090] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-zinc-900">
                  {language === 'ca' ? "Avís sobre seguretat del proveïdor" : "Aviso sobre seguridad del proveedor"}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {language === 'ca'
                    ? "Per a compreses o entitats que empren proveïdors com Gmail o Outlook, recordeu obtenir una Contrasenya d'Aplicació (App Password) des de les opcions de seguretat del vostre compte. Això manté la connexió encriptada i preveu bloquejos de trànsit."
                    : "Para comisiones o entidades que usan proveedores como Gmail o Outlook, recordad obtener una Contraseña de Aplicación (App Password) desde las opciones de seguridad de vuestra cuenta. Esto mantiene la conexión encriptada y previene bloqueos de tráfico."}
                </p>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="submit"
                className="bg-zinc-900 hover:bg-black text-white font-bold text-xs px-5 py-3 rounded-2xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Key size={14} className="text-[#ff0090]" />
                {language === 'ca' ? "Desar credencials SMTP" : "Guardar credenciales SMTP"}
              </button>
            </div>
          </form>

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
                    Desvincular
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handleOpenConnect('instagram')}
                    className="w-full bg-gradient-to-tr from-yellow-500 via-[#e1306c] to-fuchsia-600 hover:opacity-90 text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    Vincular Compte
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
                    Desvincular
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handleOpenConnect('facebook')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    Vincular Compte
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
                    Desvincular
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handleOpenConnect('tiktok')}
                    className="w-full bg-[#010101] hover:bg-black text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    Vincular Compte
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
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase font-mono">Xarxa d'Origen de la Publicació</label>
                  <select
                    value={socialPostPlatform}
                    onChange={(e) => setSocialPostPlatform(e.target.value as any)}
                    className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-3.5 py-2.5 text-xs text-zinc-800 focus:outline-none transition cursor-pointer"
                  >
                    <option value="instagram">Instagram {scInstagramConnected ? " (✓ Connectat)" : " (⚠️ Requerix Connexió)"}</option>
                    <option value="facebook">Facebook {scFacebookConnected ? " (✓ Connectat)" : " (⚠️ Requerix Connexió)"}</option>
                    <option value="tiktok">TikTok {scTikTokConnected ? " (✓ Connectat)" : " (⚠️ Requerix Connexió)"}</option>
                  </select>
                </div>

                {/* Preset image selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase font-mono">Imatge temática adjunta</label>
                  <select
                    value={socialPostMediaPreset}
                    onChange={(e) => setSocialPostMediaPreset(e.target.value)}
                    className="w-full bg-white border border-zinc-200 focus:border-fuchsia-500 rounded-2xl px-3.5 py-2.5 text-xs text-zinc-850 focus:outline-none transition cursor-pointer"
                  >
                    <option value="caramels">🍬 Caramels i dolços de Vilanova</option>
                    <option value="armilles">🎀 Armilles de Comparsa 2026</option>
                    <option value="placa">💃 Salt de Comparsa a la Plaça</option>
                    <option value="platja">⛱️ Platja de Ribes Roges</option>
                  </select>
                </div>

              </div>

              {/* Text Area post */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase font-mono">Contingut / Text del Post</label>
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
                  <span className="text-[10px] text-zinc-450 font-mono">Simular Likes: </span>
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
              <p className="text-zinc-400 text-xs text-center py-6">No hi ha contingut sincronitzat de moment.</p>
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
        <AdminPersonalitzacio language={language} onAddLog={onAddLog} />
      )}

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
