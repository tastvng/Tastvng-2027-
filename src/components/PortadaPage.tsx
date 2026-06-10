import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { Play, Image, Sparkles, ChevronRight, VolumeX, Mail, FileText, Compass, ExternalLink } from 'lucide-react';

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
  
  contingutTipus: 'none' | 'imatge' | 'video';
  contingutImatgeUrl: string;
  contingutVideoUrl: string;
  
  botoTextCA: string;
  botoTextES: string;
}

interface PortadaPageProps {
  config: PortadaConfig;
  globalLogoColor?: string;
  globalLogoText?: string;
  globalLogoUseImage?: boolean;
  globalLogoImgUrl?: string;
  onEnterForm: () => void;
  onGoToLogin: () => void;
}

export default function PortadaPage({
  config,
  globalLogoColor = '#ff5090',
  globalLogoText = 'T',
  globalLogoUseImage = false,
  globalLogoImgUrl = '',
  onEnterForm,
  onGoToLogin
}: PortadaPageProps) {
  const { language, setLanguage } = useLanguage();

  const titol = language === 'ca' ? config.titolCA : config.titolES;
  const subtitol = language === 'ca' ? config.subtitolCA : config.subtitolES;
  const descripcio = language === 'ca' ? config.descripcioCA : config.descripcioES;
  const botoText = language === 'ca' ? config.botoTextCA : config.botoTextES;

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
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 mix-blend-luminosity hover:opacity-45 transition-opacity duration-700"
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
        <Sparkles size={24} className="text-[#ff0090]" />
      </div>
      <div className="absolute bottom-24 right-1/4 pointer-events-none opacity-25 animate-pulse duration-1000 z-10">
        <Sparkles size={16} className="text-[#ff0090]" />
      </div>

      {/* Header bar within the landing layout */}
      <div className="relative z-10 w-full flex justify-between items-center pb-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {globalLogoUseImage && globalLogoImgUrl ? (
            <img 
              src={globalLogoImgUrl} 
              alt="Logo El Tast" 
              className="w-8 h-8 object-contain rounded-lg border border-white/20 shadow-lg"
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
                ? 'bg-[#ff0090] text-white shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            CAT
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`text-[9px] font-sans font-black tracking-tight px-2 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'es' 
                ? 'bg-[#ff0090] text-white shadow-md' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ESP
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-8 md:py-12">
        {/* Texts side */}
        <div className="lg:col-span-7 space-y-5 text-left">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full font-mono text-[9px] text-[#ff0090] uppercase tracking-widest font-black"
          >
            <Compass size={10} className="animate-spin duration-3000" />
            {language === 'ca' ? 'Inscripcions Obertes 2026' : 'Inscripciones Abiertas 2026'}
          </motion.div>

          {subtitol && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-zinc-400 text-xs md:text-sm font-semibold tracking-widest uppercase font-mono"
            >
              {subtitol}
            </motion.p>
          )}

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="font-sans font-black text-3xl md:text-5xl lg:text-6xl tracking-tight text-white leading-tight"
          >
            {titol}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-zinc-300 font-sans text-xs md:text-sm leading-relaxed max-w-2xl whitespace-pre-wrap"
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
              className="group flex items-center justify-center gap-2.5 bg-[#ff0090] text-white hover:bg-[#ff0090]/90 font-black px-6 py-4 rounded-2xl shadow-xl shadow-fuchsia-500/20 active:scale-98 transition duration-300 tracking-wider text-xs md:text-sm uppercase cursor-pointer relative overflow-hidden"
              style={{ boxShadow: '0 8px 24px rgba(255, 0, 144, 0.3)' }}
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
                {config.contingutTipus === 'video' ? <Play size={10} className="text-[#ff0090] animate-pulse" /> : <Image size={10} className="text-[#ff0090]" />}
                {language === 'ca' ? 'Destacat' : 'Destacado'}
              </div>

              {config.contingutTipus === 'imatge' && config.contingutImatgeUrl && (
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                  <img 
                    src={config.contingutImatgeUrl} 
                    alt="Portada Spotlight content" 
                    className="w-full h-full object-cover group-hover:scale-103 transition duration-1000"
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
      <div className="relative z-10 w-full pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
        <span>© {new Date().getFullYear()} ASSOCIACIÓ COMPARSES EL TAST • VILANOVA</span>
        <div className="flex gap-4">
          <span className="text-zinc-400 hover:text-[#ff0090] transition-colors flex items-center gap-1">
            <FileText size={10} />
            {language === 'ca' ? 'Normativa' : 'Normativa'}
          </span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400 hover:text-[#ff0090] transition-colors flex items-center gap-1">
            <Mail size={10} />
            secretaria@eltast.cat
          </span>
        </div>
      </div>
    </div>
  );
}
