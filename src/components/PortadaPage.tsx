import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { useActiveYear } from '../hooks/useActiveYear';
import TranslatedText from './TranslatedText';
import { Play, Image, Sparkles, ChevronRight, VolumeX, Mail, FileText, Compass, ExternalLink, Instagram, Heart, Star, Zap, Bell } from 'lucide-react';

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

  const [customLogo, setCustomLogo] = React.useState(() => localStorage.getItem('tast_email_logo') || "");

  const [hoverFooter1, setHoverFooter1] = React.useState(false);
  const [hoverFooter2, setHoverFooter2] = React.useState(false);

  React.useEffect(() => {
    const loadLogo = () => {
      setCustomLogo(localStorage.getItem('tast_email_logo') || "");
    };
    loadLogo();

    // Remedy 3: Ask Supabase directly for live values at mount time to populate empty incognito caches
    async function loadLiveSupabaseAssets() {
      try {
        const { getSupabaseSetting, isSupabaseConfigured } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          const liveLogo = await getSupabaseSetting<string>('tast_email_logo', '');
          if (liveLogo) {
            localStorage.setItem('tast_email_logo', liveLogo);
            setCustomLogo(liveLogo);
            window.dispatchEvent(new Event('hoursConfigChanged'));
          }

          const livePortada = await getSupabaseSetting<any>('tast_portada_config_2026', null);
          if (livePortada) {
            localStorage.setItem('tast_portada_config_2026', JSON.stringify(livePortada));
            window.dispatchEvent(new Event('portadaConfigChanged'));
          }
        }
      } catch (err) {
        console.error("Error doing live mount fetch on PortadaPage:", err);
      }
    }
    loadLiveSupabaseAssets();

    window.addEventListener('storage', loadLogo);
    window.addEventListener('hoursConfigChanged', loadLogo);
    window.addEventListener('localStorage', loadLogo);
    return () => {
      window.removeEventListener('storage', loadLogo);
      window.removeEventListener('hoursConfigChanged', loadLogo);
      window.removeEventListener('localStorage', loadLogo);
    };
  }, []);

  const accentColor = config.accentColor || '#ff0090';
  const titolColor = config.titolColor || '#ffffff';
  const subtitolColor = config.subtitolColor || '#a1a1aa';
  const descripcioColor = config.descripcioColor || '#d4d4d8';
  const botoBgColor = config.botoBgColor || accentColor;
  const botoTextColor = config.botoTextColor || '#ffffff';

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

  const titol = (language === 'ca' ? config.titolCA : config.titolES) || (language === 'ca' ? config.titolES : config.titolCA) || '';
  const subtitol = (language === 'ca' ? config.subtitolCA : config.subtitolES) || (language === 'ca' ? config.subtitolES : config.subtitolCA) || '';
  const descripcio = (language === 'ca' ? config.descripcioCA : config.descripcioES) || (language === 'ca' ? config.descripcioES : config.descripcioCA) || '';
  const botoText = (language === 'ca' ? config.botoTextCA : config.botoTextES) || (language === 'ca' ? config.botoTextES : config.botoTextCA) || '';

  const footerTextRaw = (language === 'ca' ? config.footerTextCA : config.footerTextES) || (language === 'ca' ? config.footerTextES : config.footerTextCA) || `© ${activeYear} ASSOCIACIÓ COMPARSES EL TAST • VILANOVA`;
  const footerText = footerTextRaw.replace(/2026/g, activeYear).replace(/2027/g, activeYear);

  const footerLink1Label = (language === 'ca' ? config.footerLink1LabelCA : config.footerLink1LabelES) || (language === 'ca' ? config.footerLink1LabelES : config.footerLink1LabelCA) || 'Normativa';

  const footerLink2Label = (language === 'ca' ? config.footerLink2LabelCA : config.footerLink2LabelES) || (language === 'ca' ? config.footerLink2LabelES : config.footerLink2LabelCA) || 'secretaria@eltast.cat';

  const footerLink1Url = config.footerLink1Url || '#';
  const footerLink2Url = config.footerLink2Url || 'mailto:secretaria@eltast.cat';
  const footerTextColor = config.footerTextColor || '#71717a';

  // Button Custom styling resolver
  const botoTextSize = config.botoTextSize || 'text-xs md:text-sm';
  const botoFontWeight = config.botoFontWeight || 'font-black';
  const botoLetterSpacing = config.botoLetterSpacing || 'tracking-wider';
  const botoUppercase = config.botoUppercase !== false;

  const botoClassName = `group flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.97] transition-all duration-300 ease-out cursor-pointer relative overflow-hidden px-6 py-4
    ${botoTextSize}
    ${botoFontWeight}
    ${botoLetterSpacing}
    ${botoUppercase ? 'uppercase' : ''}
  `;

  const botoStyle: React.CSSProperties = {
    backgroundColor: botoBgColor,
    color: botoTextColor,
    borderRadius: config.botoRounded === 'rounded-none' ? '0px'
                : config.botoRounded === 'rounded-sm' ? '0.125rem'
                : config.botoRounded === 'rounded' ? '0.25rem'
                : config.botoRounded === 'rounded-md' ? '0.375rem'
                : config.botoRounded === 'rounded-lg' ? '0.5rem'
                : config.botoRounded === 'rounded-xl' ? '0.75rem'
                : config.botoRounded === 'rounded-2xl' ? '1rem'
                : config.botoRounded === 'rounded-3xl' ? '1.5rem'
                : config.botoRounded === 'rounded-full' ? '9999px'
                : '1rem', // Default: 2xl (1rem)
    borderWidth: config.botoBorderWidth !== undefined ? `${config.botoBorderWidth}px` : '0px',
    borderColor: config.botoBorderColor || 'transparent',
    borderStyle: config.botoBorderWidth ? 'solid' : 'none',
  };

  const shadowColor = config.botoShadowColor || botoBgColor;
  if (config.botoShadowSize && config.botoShadowSize !== 'shadow-none') {
    const rgba = hexToRgba(shadowColor, 0.35);
    const shadowVal = config.botoShadowSize === 'shadow-sm' ? `0 2px 4px ${rgba}`
                    : config.botoShadowSize === 'shadow' ? `0 4px 6px ${rgba}`
                    : config.botoShadowSize === 'shadow-md' ? `0 6px 12px ${rgba}`
                    : config.botoShadowSize === 'shadow-lg' ? `0 8px 18px ${rgba}`
                    : config.botoShadowSize === 'shadow-xl' ? `0 12px 24px ${rgba}`
                    : config.botoShadowSize === 'shadow-2xl' ? `0 20px 35px ${rgba}`
                    : `0 8px 24px ${rgba}`;
    botoStyle.boxShadow = shadowVal;
  } else if (config.botoShadowSize === 'shadow-none') {
    botoStyle.boxShadow = 'none';
  } else {
    // Default soft shadow
    botoStyle.boxShadow = `0 8px 24px ${hexToRgba(botoBgColor, 0.35)}`;
  }

  // Footer styling resolver
  const footerLinkHoverColor = config.footerLinkHoverColor || accentColor;

  const footerTextStyle: React.CSSProperties = {
    fontSize: config.footerTextSize === 'text-[9px]' ? '9px'
            : config.footerTextSize === 'text-[10px]' ? '10px'
            : config.footerTextSize === 'text-xs' ? '12px'
            : config.footerTextSize === 'text-sm' ? '14px'
            : undefined, // defaults to tailwind class
    fontWeight: config.footerFontWeight === 'font-medium' ? 500
              : config.footerFontWeight === 'font-bold' ? 700
              : undefined, // defaults to tailwind style
    textTransform: config.footerUppercase === false ? 'none' : 'uppercase',
    letterSpacing: config.footerLetterSpacing === 'tracking-normal' ? 'normal'
                 : config.footerLetterSpacing === 'tracking-wide' ? '0.025em'
                 : config.footerLetterSpacing === 'tracking-wider' ? '0.05em'
                 : config.footerLetterSpacing === 'tracking-widest' ? '0.1em'
                 : undefined, // defaults to tailwind tracking-wider
    textShadow: config.footerShadowEnabled ? '1px 1px 3px rgba(0,0,0,0.85)' : undefined
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

  const isBgYoutubeState = config.bgTipus === 'video' && (config.bgVideoUrl.includes('youtube.com') || config.bgVideoUrl.includes('youtu.be'));
  const isContentYoutubeState = config.contingutTipus === 'video' && (config.contingutVideoUrl.includes('youtube.com') || config.contingutVideoUrl.includes('youtu.be'));

  return (
    <div 
      className="min-h-[85vh] relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col justify-between p-6 md:p-12 text-white before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/90 before:via-black/75 before:to-black/40 before:z-5"
      style={{
        backgroundColor: config.bgTipus === 'color' ? config.bgColor : '#0c0c0e',
      }}
      id="portada-landing-viewport"
    >
      {/* Immersive Background element */}
      {config.bgTipus === 'imatge' && config.bgImatgeUrl && (
        <img 
          src={config.bgImatgeUrl} 
          alt="Portada Background" 
          className="absolute inset-0 w-full h-full z-0 transition-all duration-700"
          style={{
            objectPosition: `${config.bgImatgeX ?? 50}% ${config.bgImatgeY ?? 50}%`,
            objectFit: config.bgImatgeScale || 'cover',
            opacity: (config.bgImatgeOpacity ?? 40) / 100,
            filter: `saturate(${config.bgImatgeSaturacio ?? 100}%) brightness(${config.bgImatgeBrightness ?? 100}%)`
          }}
          referrerPolicy="no-referrer"
        />
      )}

      {config.bgTipus === 'video' && config.bgVideoUrl && (
        <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
          {isBgYoutubeState ? (
            <iframe
              src={getYoutubeEmbedUrl(config.bgVideoUrl, true)}
              title="Youtube Ambient Background"
              className="absolute top-1/2 left-1/2 w-[300%] h-[300%] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 scale-105"
              frameBorder="0"
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={config.bgVideoUrl}
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
              // Determine active badge text based on the registration state
              const badgeText = globalEstatInscripcions === 'tancades'
                ? (language === 'ca' ? 'Inscripcions Tancades' : 'Inscripciones Cerradas')
                : globalEstatInscripcions === 'espera'
                  ? (language === 'ca' ? `Llista d'Espera ${activeYear}` : `Lista de Espera ${activeYear}`)
                  : (language === 'ca' 
                      ? (config.badgeTextCA || `Inscripcions Obertes ${activeYear}`) 
                      : (config.badgeTextES || `Inscripciones Abiertas ${activeYear}`));
              
              const badgeStyleType = config.badgeStyle || 'custom';
              const badgeBg = config.badgeBgColor || accentColor;
              const badgeTxtColor = config.badgeTextColor || '#ffffff';
              const badgeBrdColor = config.badgeBorderColor || `${accentColor}40`;

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
        {config.contingutTipus !== 'none' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-5 w-full flex justify-center lg:justify-end"
          >
            <div className="bg-zinc-950/85 backdrop-blur-md p-3.5 rounded-3xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden relative group">
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase z-20 text-zinc-300 flex items-center gap-1.5">
                {config.contingutTipus === 'video' ? <Play size={10} style={{ color: accentColor }} className="animate-pulse" /> : <Image size={10} style={{ color: accentColor }} />}
                {language === 'ca' ? 'Destacat' : 'Destacado'}
              </div>

              {config.contingutTipus === 'imatge' && config.contingutImatgeUrl && (
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                  <img 
                    src={config.contingutImatgeUrl} 
                    alt="Portada Spotlight content" 
                    className="w-full h-full group-hover:scale-103 transition duration-1000"
                    style={{
                      objectPosition: `${config.contingutImatgeX ?? 50}% ${config.contingutImatgeY ?? 50}%`,
                      objectFit: config.contingutImatgeScale || 'cover'
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {config.contingutTipus === 'video' && config.contingutVideoUrl && (
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 relative">
                  {isContentYoutubeState ? (
                    <iframe
                      src={getYoutubeEmbedUrl(config.contingutVideoUrl)}
                      title="Youtube Spotlight Video"
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={config.contingutVideoUrl}
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
        className={`relative z-10 w-full pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] tracking-wider ${config.footerFontMono !== false ? 'font-mono' : 'font-sans'}`}
        style={{ 
          color: footerTextColor,
          borderTopColor: config.footerBorderTopColor || 'rgba(255, 255, 255, 0.1)',
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
