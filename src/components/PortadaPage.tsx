import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { useActiveYear } from '../hooks/useActiveYear';
import TranslatedText, { useTranslatedText } from './TranslatedText';
import { Play, Image, Sparkles, ChevronRight, VolumeX, Mail, FileText, Compass, ExternalLink, Instagram, Heart, Star, Zap, Bell } from 'lucide-react';
import { ensureValidPortadaConfig, DEFAULT_PORTADA_DATA, PORTADA_CONFIG_DEFAULTS } from './AdminPortada';

export interface PortadaConfig {
  activa: boolean;
  titolCA: string;
  titolES: string;
  subtitolCA: string;
  subtitolES: string;
  descripcioCA: string;
  descripcioES: string;
  
  bgTipus: 'color' | 'imatge' | 'video';
  bgColor: string;
  bgImatgeUrl: string;
  bgVideoUrl: string;

  contingutTipus: 'none' | 'imatge' | 'video' | 'alternar';
  contingutImatgeUrl: string;
  contingutVideoUrl: string;
  
  botoTextCA: string;
  botoTextES: string;

  // Badge customization
  badgeTextCA?: string;
  badgeTextES?: string;
  badgeIcon?: 'compass' | 'instagram' | 'sparkles' | 'none' | 'heart' | 'star' | 'lightning' | 'bell';
  badgeStyle?: 'custom' | 'instagram-gradient' | 'glass-retro' | 'solid-neon' | 'cyberpunk';
  badgeBgColor?: string;
  badgeTextColor?: string;
  badgeBorderColor?: string;
  badgeSpinIcon?: boolean;

  // New photo framing & color adjustment options (optional for safety with older state)
  bgImatgeX?: number; // 0-100% position
  bgImatgeY?: number; // 0-100% position
  bgImatgeScale?: 'cover' | 'contain' | 'auto';
  bgImatgeOpacity?: number; // 0-100%
  bgImatgeSaturacio?: number; // 0-200% (default 100 for normal color, replace mix-blend-luminosity)
  bgImatgeBrightness?: number; // 0-200%
  
  contingutImatgeX?: number; // 0-100% position
  contingutImatgeY?: number; // 0-100% position
  contingutImatgeScale?: 'cover' | 'contain' | 'fill';

  // Customizable colors
  accentColor?: string;
  titolColor?: string;
  subtitolColor?: string;
  descripcioColor?: string;
  botoBgColor?: string;
  botoTextColor?: string;

  // Button advanced customization
  botoTextSize?: string;
  botoFontWeight?: string;
  botoRounded?: string;
  botoShadowSize?: string;
  botoShadowColor?: string;
  botoBorderColor?: string;
  botoBorderWidth?: number;
  botoLetterSpacing?: string;
  botoUppercase?: boolean;

  // Footer customization
  footerTextCA?: string;
  footerTextES?: string;
  footerLink1LabelCA?: string;
  footerLink1LabelES?: string;
  footerLink1Url?: string;
  footerLink2LabelCA?: string;
  footerLink2LabelES?: string;
  footerLink2Url?: string;
  footerTextColor?: string;
  footerLinkHoverColor?: string;
  footerTextSize?: string;
  footerFontWeight?: string;
  footerUppercase?: boolean;
  footerLetterSpacing?: string;
  footerBorderTopColor?: string;
  footerFontMono?: boolean;
  footerShadowEnabled?: boolean;
  cuestionariActiu?: boolean;
  ca?: {
    heading?: string;
    welcome?: string;
    description?: string;
    buttonText?: string;
    badgeText?: string;
    footerText?: string;
  };
  es?: {
    heading?: string;
    welcome?: string;
    description?: string;
    buttonText?: string;
    badgeText?: string;
    footerText?: string;
  };
}

interface PortadaPageProps {
  config: PortadaConfig;
  globalLogoColor?: string;
  globalLogoText?: string;
  globalLogoUseImage?: boolean;
  globalLogoImgUrl?: string;
  globalEstatInscripcions?: 'obertes' | 'espera' | 'tancades';
  onEnterForm: () => void;
  onGoToLogin: () => void;
}

export default function PortadaPage({
  config,
  globalLogoColor = '#ff5090',
  globalLogoText = 'T',
  globalLogoUseImage = false,
  globalLogoImgUrl = '',
  globalEstatInscripcions = 'obertes',
  onEnterForm,
  onGoToLogin
}: PortadaPageProps) {
  const { language, setLanguage } = useLanguage();
  const activeYear = useActiveYear();

  const [liveConfig, setLiveConfig] = React.useState<PortadaConfig>(() => ensureValidPortadaConfig(config, activeYear));
  const [customLogo, setCustomLogo] = React.useState(() => localStorage.getItem('tast_email_logo') || "");

  const [hoverFooter1, setHoverFooter1] = React.useState(false);
  const [hoverFooter2, setHoverFooter2] = React.useState(false);

  // Keep liveConfig synchronized when config prop changes
  React.useEffect(() => {
    setLiveConfig(ensureValidPortadaConfig(config, activeYear));
  }, [config, activeYear]);

  React.useEffect(() => {
    const loadAssets = () => {
      setCustomLogo(localStorage.getItem('tast_email_logo') || "");
      try {
        const savedPortada = localStorage.getItem('tast_portada_config_2026');
        if (savedPortada) {
          setLiveConfig(ensureValidPortadaConfig(JSON.parse(savedPortada), activeYear));
        }
      } catch (e) {}
    };
    loadAssets();

    // Ask Supabase directly for live values at mount time to populate empty incognito caches & heal DB structure
    async function loadLiveSupabaseAssets() {
      try {
        const { getSupabaseSetting, saveSupabaseSetting, isSupabaseConfigured } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          const liveLogo = await getSupabaseSetting<string>('tast_email_logo', '');
          if (liveLogo) {
            localStorage.setItem('tast_email_logo', liveLogo);
            setCustomLogo(liveLogo);
            window.dispatchEvent(new Event('hoursConfigChanged'));
          }

          const rawPortada = await getSupabaseSetting<any>('tast_portada_config_2026', null);
          if (rawPortada) {
            const validated = ensureValidPortadaConfig(rawPortada, activeYear);
            setLiveConfig(validated);
            localStorage.setItem('tast_portada_config_2026', JSON.stringify(validated));
            
            // If the rawPortada had missing ca/es or corrupt texts, heal it in Supabase
            const caHeading = rawPortada?.ca?.heading || rawPortada?.titolCA || '';
            const isCorrupted = !rawPortada.ca || !rawPortada.es || caHeading.toLowerCase().startsWith('inscripciones');
            if (isCorrupted) {
              await saveSupabaseSetting('tast_portada_config_2026', validated);
            }
          }
        }
      } catch (err) {
        console.error("Error doing live mount fetch on PortadaPage:", err);
      }
    }
    loadLiveSupabaseAssets().catch(err => {
      console.warn("Handled error in loadLiveSupabaseAssets:", err);
    });

    window.addEventListener('storage', loadAssets);
    window.addEventListener('portadaConfigChanged', loadAssets);
    window.addEventListener('hoursConfigChanged', loadAssets);
    return () => {
      window.removeEventListener('storage', loadAssets);
      window.removeEventListener('portadaConfigChanged', loadAssets);
      window.removeEventListener('hoursConfigChanged', loadAssets);
    };
  }, [activeYear]);

  const accentColor = liveConfig.accentColor || '#ff0090';
  const titolColor = liveConfig.titolColor || '#ffffff';
  const subtitolColor = liveConfig.subtitolColor || '#a1a1aa';
  const descripcioColor = liveConfig.descripcioColor || '#d4d4d8';
  const botoBgColor = liveConfig.botoBgColor || accentColor;
  const botoTextColor = liveConfig.botoTextColor || '#ffffff';

  const hexToRgba = (hex: string, alpha: number) => {
    try {
      let c = hex.substring(1);
      if (c.length === 3) {
        c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      }
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return `rgba(255, 0, 144, ${alpha})`;
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch (e) {
      return `rgba(255, 0, 144, ${alpha})`;
    }
  };

  // Resolve current active language data with 100% strict synchronization
  const currentLang = (language === 'es' ? 'es' : 'ca') as 'ca' | 'es';
  const langData = liveConfig[currentLang] || (currentLang === 'ca' ? DEFAULT_PORTADA_DATA.ca : DEFAULT_PORTADA_DATA.es);

  // 1. Heading (always in currentLang)
  let rawHeading = currentLang === 'ca'
    ? (langData?.heading || liveConfig.titolCA || DEFAULT_PORTADA_DATA.ca.heading)
    : (langData?.heading || liveConfig.titolES || DEFAULT_PORTADA_DATA.es.heading);
  if (currentLang === 'ca' && rawHeading.toLowerCase().startsWith('inscripciones')) {
    rawHeading = DEFAULT_PORTADA_DATA.ca.heading;
  } else if (currentLang === 'es' && rawHeading.toLowerCase().startsWith('inscripcions')) {
    rawHeading = DEFAULT_PORTADA_DATA.es.heading;
  }
  const titol = rawHeading.replace(/2026/g, activeYear).replace(/2027/g, activeYear);

  // 2. Subtitle / Welcome (always in currentLang)
  let rawSubtitol = currentLang === 'ca'
    ? (langData?.welcome || liveConfig.subtitolCA || DEFAULT_PORTADA_DATA.ca.welcome)
    : (langData?.welcome || liveConfig.subtitolES || DEFAULT_PORTADA_DATA.es.welcome);
  if (currentLang === 'ca' && (rawSubtitol.toLowerCase().includes('bienvenido') || rawSubtitol.toLowerCase().includes('bienvenidos'))) {
    rawSubtitol = DEFAULT_PORTADA_DATA.ca.welcome;
  } else if (currentLang === 'es' && (rawSubtitol.toLowerCase().includes('benvingut') || rawSubtitol.toLowerCase().includes('benvinguts'))) {
    rawSubtitol = DEFAULT_PORTADA_DATA.es.welcome;
  }
  const subtitol = rawSubtitol.replace(/2026/g, activeYear).replace(/2027/g, activeYear);

  // 3. Description (always in currentLang)
  let rawDescripcio = currentLang === 'ca'
    ? (langData?.description || liveConfig.descripcioCA || DEFAULT_PORTADA_DATA.ca.description)
    : (langData?.description || liveConfig.descripcioES || DEFAULT_PORTADA_DATA.es.description);
  if (currentLang === 'ca' && (rawDescripcio.toLowerCase().includes('este año') || rawDescripcio.toLowerCase().includes('asociación'))) {
    rawDescripcio = DEFAULT_PORTADA_DATA.ca.description;
  } else if (currentLang === 'es' && (rawDescripcio.toLowerCase().includes('enguany') || rawDescripcio.toLowerCase().includes('associació'))) {
    rawDescripcio = DEFAULT_PORTADA_DATA.es.description;
  }
  const descripcio = rawDescripcio.replace(/2026/g, activeYear).replace(/2027/g, activeYear);

  // 4. Button Text (always in currentLang)
  let rawBotoText = currentLang === 'ca'
    ? (langData?.buttonText || liveConfig.botoTextCA || DEFAULT_PORTADA_DATA.ca.buttonText)
    : (langData?.buttonText || liveConfig.botoTextES || DEFAULT_PORTADA_DATA.es.buttonText);
  const botoText = rawBotoText.replace(/2026/g, activeYear).replace(/2027/g, activeYear);

  // 5. Badge Text (always in currentLang)
  const rawBadgeText = globalEstatInscripcions === 'tancades'
    ? (currentLang === 'ca' ? 'Inscripcions Tancades' : 'Inscripciones Cerradas')
    : globalEstatInscripcions === 'espera'
      ? (currentLang === 'ca' ? `Llista d'Espera ${activeYear}` : `Lista de Espera ${activeYear}`)
      : (langData?.badgeText || (currentLang === 'ca' ? liveConfig.badgeTextCA : liveConfig.badgeTextES) || DEFAULT_PORTADA_DATA[currentLang].badgeText);
  const badgeText = rawBadgeText.replace(/2026/g, activeYear).replace(/2027/g, activeYear);

  // 6. Footer Text (always in currentLang)
  const rawFooterText = langData?.footerText || (currentLang === 'ca' ? liveConfig.footerTextCA : liveConfig.footerTextES) || DEFAULT_PORTADA_DATA[currentLang].footerText;
  const footerText = rawFooterText.replace(/2026/g, activeYear).replace(/2027/g, activeYear);

  // 7. Footer Links
  const footerLink1Label = currentLang === 'ca'
    ? (liveConfig?.footerLink1LabelCA || DEFAULT_PORTADA_DATA.ca.footerLink1Label)
    : (liveConfig?.footerLink1LabelES || DEFAULT_PORTADA_DATA.es.footerLink1Label);

  const footerLink2Label = currentLang === 'ca'
    ? (liveConfig?.footerLink2LabelCA || DEFAULT_PORTADA_DATA.ca.footerLink2Label)
    : (liveConfig?.footerLink2LabelES || DEFAULT_PORTADA_DATA.es.footerLink2Label);

  const footerLink1Url = liveConfig.footerLink1Url || '#';
  const footerLink2Url = liveConfig.footerLink2Url || 'mailto:secretaria@eltast.cat';
  const footerTextColor = liveConfig.footerTextColor || '#71717a';

  // Button Custom styling resolver
  const botoTextSize = liveConfig.botoTextSize || 'text-xs md:text-sm';
  const botoFontWeight = liveConfig.botoFontWeight || 'font-black';
  const botoLetterSpacing = liveConfig.botoLetterSpacing || 'tracking-wider';
  const botoUppercase = liveConfig.botoUppercase !== false;

  const botoClassName = `group flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.97] transition-all duration-300 ease-out cursor-pointer relative overflow-hidden px-6 py-4
    ${botoTextSize}
    ${botoFontWeight}
    ${botoLetterSpacing}
    ${botoUppercase ? 'uppercase' : ''}
  `;

  const botoStyle: React.CSSProperties = {
    backgroundColor: botoBgColor,
    color: botoTextColor,
    borderRadius: liveConfig.botoRounded === 'rounded-none' ? '0px'
                : liveConfig.botoRounded === 'rounded-sm' ? '0.125rem'
                : liveConfig.botoRounded === 'rounded' ? '0.25rem'
                : liveConfig.botoRounded === 'rounded-md' ? '0.375rem'
                : liveConfig.botoRounded === 'rounded-lg' ? '0.5rem'
                : liveConfig.botoRounded === 'rounded-xl' ? '0.75rem'
                : liveConfig.botoRounded === 'rounded-2xl' ? '1rem'
                : liveConfig.botoRounded === 'rounded-3xl' ? '1.5rem'
                : liveConfig.botoRounded === 'rounded-full' ? '9999px'
                : '1rem', // Default: 2xl (1rem)
    borderWidth: liveConfig.botoBorderWidth !== undefined ? `${liveConfig.botoBorderWidth}px` : '0px',
    borderColor: liveConfig.botoBorderColor || 'transparent',
    borderStyle: liveConfig.botoBorderWidth ? 'solid' : 'none',
  };

  const shadowColor = liveConfig.botoShadowColor || botoBgColor;
  if (liveConfig.botoShadowSize && liveConfig.botoShadowSize !== 'shadow-none') {
    const rgba = hexToRgba(shadowColor, 0.35);
    const shadowVal = liveConfig.botoShadowSize === 'shadow-sm' ? `0 2px 4px ${rgba}`
                    : liveConfig.botoShadowSize === 'shadow' ? `0 4px 6px ${rgba}`
                    : liveConfig.botoShadowSize === 'shadow-md' ? `0 6px 12px ${rgba}`
                    : liveConfig.botoShadowSize === 'shadow-lg' ? `0 8px 18px ${rgba}`
                    : liveConfig.botoShadowSize === 'shadow-xl' ? `0 12px 24px ${rgba}`
                    : liveConfig.botoShadowSize === 'shadow-2xl' ? `0 20px 35px ${rgba}`
                    : `0 8px 24px ${rgba}`;
    botoStyle.boxShadow = shadowVal;
  } else if (liveConfig.botoShadowSize === 'shadow-none') {
    botoStyle.boxShadow = 'none';
  } else {
    // Default soft shadow
    botoStyle.boxShadow = `0 8px 24px ${hexToRgba(botoBgColor, 0.35)}`;
  }

  // Footer styling resolver
  const footerLinkHoverColor = liveConfig.footerLinkHoverColor || accentColor;

  const footerTextStyle: React.CSSProperties = {
    fontSize: liveConfig.footerTextSize === 'text-[9px]' ? '9px'
            : liveConfig.footerTextSize === 'text-[10px]' ? '10px'
            : liveConfig.footerTextSize === 'text-xs' ? '12px'
            : liveConfig.footerTextSize === 'text-sm' ? '14px'
            : undefined, // defaults to tailwind class
    fontWeight: liveConfig.footerFontWeight === 'font-medium' ? 500
              : liveConfig.footerFontWeight === 'font-bold' ? 700
              : undefined, // defaults to tailwind style
    textTransform: liveConfig.footerUppercase === false ? 'none' : 'uppercase',
    letterSpacing: liveConfig.footerLetterSpacing === 'tracking-normal' ? 'normal'
                 : liveConfig.footerLetterSpacing === 'tracking-wide' ? '0.025em'
                 : liveConfig.footerLetterSpacing === 'tracking-wider' ? '0.05em'
                 : liveConfig.footerLetterSpacing === 'tracking-widest' ? '0.1em'
                 : undefined, // defaults to tailwind tracking-wider
    textShadow: liveConfig.footerShadowEnabled ? '1px 1px 3px rgba(0,0,0,0.85)' : undefined
  };

  // Video embed helper for YouTube backgrounds
  const getYoutubeEmbedUrl = (url: string, asBackground = false) => {
    if (!url) return '';
    let videoId = '';
    
    // Parse normal watch URL
    if (url.includes('youtube.com/watch')) {
      const match = url.match(/[?&]v=([^&#]+)/);
      if (match) videoId = match[1];
    } 
    // Parse short share URL (youtu.be)
    else if (url.includes('youtu.be/')) {
      const parts = url.split('youtu.be/');
      if (parts[1]) videoId = parts[1].split(/[?&#]/)[0];
    }
    // Parse embed URL already
    else if (url.includes('youtube.com/embed/')) {
      const parts = url.split('youtube.com/embed/');
      if (parts[1]) videoId = parts[1].split(/[?&#]/)[0];
    }

    if (!videoId) return url; // Fallback to raw

    if (asBackground) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&playlist=${videoId}&showinfo=0&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1`;
    } else {
      return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
    }
  };

  const isBgYoutubeState = liveConfig.bgTipus === 'video' && (liveConfig.bgVideoUrl.includes('youtube.com') || liveConfig.bgVideoUrl.includes('youtu.be'));
  const isContentYoutubeState = liveConfig.contingutTipus === 'video' && (liveConfig.contingutVideoUrl.includes('youtube.com') || liveConfig.contingutVideoUrl.includes('youtu.be'));

  return (
    <div 
      className="min-h-[85vh] relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col justify-between p-6 md:p-12 text-white before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/90 before:via-black/75 before:to-black/40 before:z-5"
      style={{
        backgroundColor: liveConfig.bgTipus === 'color' ? liveConfig.bgColor : '#0c0c0e',
      }}
      id="portada-landing-viewport"
    >
      {/* Immersive Background element */}
      {liveConfig.bgTipus === 'imatge' && liveConfig.bgImatgeUrl && (
        <img 
          src={liveConfig.bgImatgeUrl} 
          alt="Portada Background" 
          className="absolute inset-0 w-full h-full z-0 transition-all duration-700"
          style={{
            objectPosition: `${liveConfig.bgImatgeX ?? 50}% ${liveConfig.bgImatgeY ?? 50}%`,
            objectFit: liveConfig.bgImatgeScale || 'cover',
            opacity: (liveConfig.bgImatgeOpacity ?? 40) / 100,
            filter: `saturate(${liveConfig.bgImatgeSaturacio ?? 100}%) brightness(${liveConfig.bgImatgeBrightness ?? 100}%)`
          }}
          referrerPolicy="no-referrer"
        />
      )}

      {liveConfig.bgTipus === 'video' && liveConfig.bgVideoUrl && (
        <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
          {isBgYoutubeState ? (
            <iframe
              src={getYoutubeEmbedUrl(liveConfig.bgVideoUrl, true)}
              title="Youtube Ambient Background"
              className="absolute top-1/2 left-1/2 w-[300%] h-[300%] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 scale-105"
              frameBorder="0"
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={liveConfig.bgVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
          )}
        </div>
      )}

      {/* Floating decorative sparkles/confetti elements */}
      <div className="absolute top-12 left-1/4 pointer-events-none opacity-20 animate-pulse z-10">
        <Sparkles size={24} style={{ color: accentColor }} />
      </div>
      <div className="absolute bottom-24 right-1/4 pointer-events-none opacity-25 animate-pulse duration-1000 z-10">
        <Sparkles size={16} style={{ color: accentColor }} />
      </div>

      {/* Header bar within the landing layout */}
      <div className="relative z-10 w-full flex justify-between items-center pb-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {customLogo ? (
            <img 
              src={customLogo} 
              alt="Logo El Tast" 
              className="w-8 h-8 object-contain rounded-lg border border-white/20 shadow-lg bg-white p-0.5"
              referrerPolicy="no-referrer"
            />
          ) : globalLogoUseImage && globalLogoImgUrl ? (
            <img 
              src={globalLogoImgUrl} 
              alt="Logo El Tast" 
              className="w-8 h-8 object-contain rounded-lg border border-white/20 shadow-lg bg-white p-0.5"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="w-7 h-7 rounded flex items-center justify-center font-bold text-black tracking-widest text-sm border border-white/15 shadow-md uppercase"
              style={{ backgroundColor: globalLogoColor }}
            >
              {globalLogoText}
            </div>
          )}
          <span className="font-sans font-black text-xs md:text-sm tracking-wider uppercase text-zinc-100">
            ASSOCIACIÓ EL TAST
          </span>
        </div>

        {/* Quick Language Toggle */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
          <button
            onClick={() => setLanguage('ca')}
            className={`text-[9px] font-sans font-black tracking-tight px-2 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'ca' 
                ? 'text-white shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
            style={language === 'ca' ? { backgroundColor: accentColor } : {}}
            id="btn-portada-lang-cat"
          >
            CAT
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`text-[9px] font-sans font-black tracking-tight px-2 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'es' 
                ? 'text-white shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
            style={language === 'es' ? { backgroundColor: accentColor } : {}}
            id="btn-portada-lang-esp"
          >
            ESP
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-8 md:py-12">
        {/* Texts side */}
        <div className="lg:col-span-7 space-y-5 text-left">
          <div className="flex flex-wrap gap-3 items-center">
            {(() => {
              const badgeStyleType = liveConfig.badgeStyle || 'custom';
              const badgeBg = liveConfig.badgeBgColor || accentColor;
              const badgeTxtColor = liveConfig.badgeTextColor || '#ffffff';
              const badgeBrdColor = liveConfig.badgeBorderColor || `${accentColor}40`;

              let badgeClasses = "inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest font-black transition-all duration-300 shadow-sm ";
              let badgeStyles: React.CSSProperties = {};

              if (badgeStyleType === 'instagram-gradient') {
                badgeClasses += "bg-gradient-to-r from-amber-400 via-pink-600 to-purple-600 text-white shadow-lg shadow-pink-500/20 hover:scale-105 duration-300 rounded-full border border-white/20";
              } else if (badgeStyleType === 'glass-retro') {
                badgeClasses += "bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl shadow-inner";
              } else if (badgeStyleType === 'solid-neon') {
                badgeClasses += "bg-green-400 text-black border border-green-300 rounded-full font-bold shadow-[0_0_12px_rgba(74,222,128,0.5)]";
                badgeStyles = {
                  backgroundColor: '#22c55e',
                  color: '#000000',
                  borderColor: '#4ade80'
                };
              } else if (badgeStyleType === 'cyberpunk') {
                badgeClasses += "bg-black text-rose-500 border border-fuchsia-500 rounded-none tracking-widest shadow-[inset_0_0_8px_rgba(236,72,153,0.3)] animate-pulse";
              } else {
                // 'custom'
                badgeClasses += "bg-white/5 border rounded-full";
                badgeStyles = {
                  color: badgeTxtColor,
                  backgroundColor: badgeBg.startsWith('#') ? `${badgeBg}20` : badgeBg,
                  borderColor: badgeBrdColor
                };
              }

              return (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className={badgeClasses}
                  style={badgeStyles}
                  id="unified-status-badge"
                >
                  {/* Traffic Light Mini Representation inside the single badge */}
                  <div className="flex items-center gap-1 bg-black/60 border border-white/10 px-1.5 py-0.5 rounded-full shrink-0">
                    <div 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        globalEstatInscripcions === 'tancades'
                          ? 'bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse scale-110'
                          : 'bg-red-950/60 opacity-30 shadow-none'
                      }`}
                      title={language === 'ca' ? "Tancat" : "Cerrado"} 
                    />
                    <div 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        globalEstatInscripcions === 'espera'
                          ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse scale-110'
                          : 'bg-amber-950/60 opacity-30 shadow-none'
                      }`}
                      title={language === 'ca' ? "Llista d'espera" : "Lista de espera"} 
                    />
                    <div 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        globalEstatInscripcions === 'obertes'
                          ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse scale-110'
                          : 'bg-emerald-950/60 opacity-30 shadow-none'
                      }`}
                      title={language === 'ca' ? "Obert" : "Abierto"} 
                    />
                  </div>
                  
                  <span className="leading-none mt-0.5 sm:mt-0">
                    {badgeText}
                  </span>
                </motion.div>
              );
            })()}
          </div>

          {subtitol && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xs md:text-sm font-semibold tracking-widest uppercase font-mono"
              style={{ color: subtitolColor }}
            >
              {subtitol}
            </motion.p>
          )}

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="font-sans font-black text-3xl md:text-5xl lg:text-6xl tracking-tight leading-tight"
            style={{ color: titolColor }}
          >
            {titol}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="font-sans text-xs md:text-sm leading-relaxed max-w-2xl whitespace-pre-wrap"
            style={{ color: descripcioColor }}
          >
            {descripcio}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="pt-4 flex flex-wrap gap-4 items-center"
          >
            <button
              onClick={onEnterForm}
              className={botoClassName}
              style={botoStyle}
              id="btn-portada-jump-to-form"
            >
              {botoText}
              <ChevronRight size={16} className="group-hover:translate-x-1.5 transition-transform" />
            </button>
            <button
              onClick={onGoToLogin}
              className="text-xs font-semibold px-5 py-4 bg-white/5 hover:bg-white/10 active:bg-white/5 text-zinc-300 border border-white/10 hover:border-white/25 rounded-2xl transition duration-300 uppercase cursor-pointer"
              id="btn-portada-to-admin"
            >
              {language === 'ca' ? 'Accés Secretaria' : 'Acceso Secretaría'}
            </button>
          </motion.div>
        </div>

        {/* Media Side (Optional illustration card) */}
        {liveConfig.contingutTipus !== 'none' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-5 w-full flex justify-center lg:justify-end"
          >
            <div className="bg-zinc-950/85 backdrop-blur-md p-3.5 rounded-3xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden relative group">
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase z-20 text-zinc-300 flex items-center gap-1.5">
                {liveConfig.contingutTipus === 'video' ? <Play size={10} style={{ color: accentColor }} className="animate-pulse" /> : <Image size={10} style={{ color: accentColor }} />}
                {language === 'ca' ? 'Destacat' : 'Destacado'}
              </div>

              {liveConfig.contingutTipus === 'imatge' && liveConfig.contingutImatgeUrl && (
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                  <img 
                    src={liveConfig.contingutImatgeUrl} 
                    alt="Portada Spotlight content" 
                    className="w-full h-full group-hover:scale-103 transition duration-1000"
                    style={{
                      objectPosition: `${liveConfig.contingutImatgeX ?? 50}% ${liveConfig.contingutImatgeY ?? 50}%`,
                      objectFit: liveConfig.contingutImatgeScale || 'cover'
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {liveConfig.contingutTipus === 'video' && liveConfig.contingutVideoUrl && (
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 relative">
                  {isContentYoutubeState ? (
                    <iframe
                      src={getYoutubeEmbedUrl(liveConfig.contingutVideoUrl)}
                      title="Youtube Spotlight Video"
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={liveConfig.contingutVideoUrl}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Simple footer with legal link simulation/regulations info */}
      <div 
        className={`relative z-10 w-full pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] tracking-wider ${liveConfig.footerFontMono !== false ? 'font-mono' : 'font-sans'}`}
        style={{ 
          color: footerTextColor,
          borderTopColor: liveConfig.footerBorderTopColor || 'rgba(255, 255, 255, 0.1)',
          ...footerTextStyle 
        }}
        id="portada-landing-footer"
      >
        <span style={footerTextStyle}>{footerText}</span>
        <div className="flex gap-4">
          <a 
            href={footerLink1Url}
            target={footerLink1Url.startsWith('http') || footerLink1Url.startsWith('//') ? '_blank' : undefined}
            rel="noopener noreferrer"
            onMouseEnter={() => setHoverFooter1(true)}
            onMouseLeave={() => setHoverFooter1(false)}
            className="transition-all flex items-center gap-1 cursor-pointer hover:underline"
            style={{ 
              color: hoverFooter1 ? footerLinkHoverColor : footerTextColor,
              ...footerTextStyle 
            }}
          >
            <FileText size={10} />
            <span>{footerLink1Label}</span>
          </a>
          <span style={{ color: `${footerTextColor}80`, ...footerTextStyle }}>•</span>
          <a 
            href={footerLink2Url}
            target={footerLink2Url.startsWith('http') || footerLink2Url.startsWith('//') ? '_blank' : undefined}
            rel="noopener noreferrer"
            onMouseEnter={() => setHoverFooter2(true)}
            onMouseLeave={() => setHoverFooter2(false)}
            className="transition-all flex items-center gap-1 cursor-pointer hover:underline"
            style={{ 
              color: hoverFooter2 ? footerLinkHoverColor : footerTextColor,
              ...footerTextStyle 
            }}
          >
            <Mail size={10} />
            <span>{footerLink2Label}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
