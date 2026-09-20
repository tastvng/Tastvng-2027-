import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Shirt, VideoOff } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import Player from '@vimeo/player';

export interface CodigoVestimentaModalProps {
  youtubeUrl?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  videoWatched?: boolean;
  videoWatchedError?: string | null;
  onVideoLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement> | Event) => void;
  onVideoEnded?: () => void;
  onVideoTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement> | Event) => void;
  onVideoPause?: () => void;
  onVideoSeeking?: (e: React.SyntheticEvent<HTMLVideoElement> | Event) => void;
  onCloseModal?: () => void;
}

/**
 * Parses Vimeo URLs into video ID and optional query params.
 * Matches formats:
 * - https://vimeo.com/1207785599
 * - https://vimeo.com/1207785599?fl=ip&fe=ec
 * - https://player.vimeo.com/video/1207785599
 */
export function parseVimeoUrl(url: string): { isVimeo: boolean; videoId: string | null; queryParams: string } {
  if (!url || typeof url !== 'string') return { isVimeo: false, videoId: null, queryParams: '' };
  const trimmed = url.trim();

  // Match vimeo.com/{id} or player.vimeo.com/video/{id}
  const vimeoRegex = /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)([0-9]+)/i;
  const match = trimmed.match(vimeoRegex);

  if (match && match[1]) {
    const qIndex = trimmed.indexOf('?');
    const queryParams = qIndex !== -1 ? trimmed.substring(qIndex) : '';
    return {
      isVimeo: true,
      videoId: match[1],
      queryParams
    };
  }

  // Also check if domain contains vimeo
  if (trimmed.includes('vimeo.com')) {
    return { isVimeo: true, videoId: null, queryParams: '' };
  }

  return { isVimeo: false, videoId: null, queryParams: '' };
}

/**
 * Resolves Supabase Storage URLs (handles public bucket paths, signed URLs, and storage:// protocol)
 */
async function resolveStorageOrPublicUrl(rawUrl: string): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/')) return trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('/storage/v1/object/')) {
      try {
        const { supabase, isSupabaseConfigured } = await import('../supabaseClient');
        if (isSupabaseConfigured && supabase) {
          const match = trimmed.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
          if (match) {
            const [, bucket, rawPath] = match;
            const cleanPath = decodeURIComponent(rawPath);
            const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 86400);
            if (!error && data?.signedUrl) {
              return data.signedUrl;
            }
          }
        }
      } catch (err) {
        console.warn('[CodigoVestimenta] Fallback for Supabase signed URL generation, keeping public URL');
      }
    }
    return trimmed;
  }

  if (trimmed.startsWith('storage://')) {
    try {
      const { supabase, isSupabaseConfigured } = await import('../supabaseClient');
      if (isSupabaseConfigured && supabase) {
        const pathWithoutProtocol = trimmed.replace('storage://', '');
        const firstSlash = pathWithoutProtocol.indexOf('/');
        if (firstSlash > 0) {
          const bucket = pathWithoutProtocol.substring(0, firstSlash);
          const objectPath = pathWithoutProtocol.substring(firstSlash + 1);
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 86400);
          if (!error && data?.signedUrl) return data.signedUrl;
          const pub = supabase.storage.from(bucket).getPublicUrl(objectPath);
          if (pub?.data?.publicUrl) return pub.data.publicUrl;
        }
      }
    } catch (err) {
      console.warn('[CodigoVestimenta] Failed to resolve storage:// URL');
    }
  }

  return null;
}

export const CodigoVestimentaModal: React.FC<CodigoVestimentaModalProps> = ({ 
  youtubeUrl,
  videoRef,
  videoWatched = false,
  videoWatchedError = null,
  onVideoLoadedMetadata,
  onVideoEnded,
  onVideoTimeUpdate,
  onVideoPause,
  onVideoSeeking,
}) => {
  const { language } = useLanguage();
  const [activeUrl, setActiveUrl] = useState<string>(youtubeUrl || '');
  const [isVimeo, setIsVimeo] = useState<boolean>(false);
  const [vimeoEmbedSrc, setVimeoEmbedSrc] = useState<string>('');
  const [isValidSource, setIsValidSource] = useState<boolean>(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [isMissingOriginal, setIsMissingOriginal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reference to iframe container for Vimeo Player SDK
  const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const vimeoPlayerInstanceRef = useRef<Player | null>(null);

  // Sync / load URL from prop, Supabase or event
  const loadVideoConfig = useCallback(async (forcedUrl?: string) => {
    setIsLoading(true);
    setVideoLoadError(null);
    setIsMissingOriginal(false);

    let targetCandidate = forcedUrl !== undefined ? forcedUrl.trim() : (youtubeUrl?.trim() || '');

    if (!targetCandidate) {
      try {
        const { getSupabaseSetting, isSupabaseConfigured } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          const stored = await getSupabaseSetting<string>('codigo_vestimenta_url', '', true);
          targetCandidate = stored?.trim() || '';
        }
      } catch {
        targetCandidate = '';
      }
    }

    if (!targetCandidate) {
      setIsMissingOriginal(true);
      setIsValidSource(false);
      setIsLoading(false);
      setActiveUrl('');
      setIsVimeo(false);
      setVimeoEmbedSrc('');
      return;
    }

    setActiveUrl(targetCandidate);

    // Check if Vimeo URL
    const vimeoInfo = parseVimeoUrl(targetCandidate);
    if (vimeoInfo.isVimeo) {
      if (!vimeoInfo.videoId) {
        setIsLoading(false);
        setIsValidSource(false);
        setVideoLoadError(
          language === 'ca'
            ? "L'enllaç de Vimeo no té un identificador vàlid."
            : "El enlace de Vimeo no contiene un identificador válido."
        );
        return;
      }

      setIsVimeo(true);
      // Convert URL to requested player URL format: https://player.vimeo.com/video/{id}
      const embedUrl = `https://player.vimeo.com/video/${vimeoInfo.videoId}`;
      setVimeoEmbedSrc(embedUrl);
      setIsValidSource(true);
      setIsMissingOriginal(false);
      setVideoLoadError(null);
      setIsLoading(false);
      return;
    }

    // Standard video (MP4, direct URL, Supabase storage)
    setIsVimeo(false);
    setVimeoEmbedSrc('');

    const resolvedUrl = await resolveStorageOrPublicUrl(targetCandidate);
    if (!resolvedUrl) {
      setIsMissingOriginal(true);
      setIsValidSource(false);
      setIsLoading(false);
      return;
    }

    setIsValidSource(true);
    setVideoLoadError(null);
    setIsLoading(false);
  }, [youtubeUrl, language]);

  // Initial load and listen for real-time changes
  useEffect(() => {
    loadVideoConfig();

    const handleConfigEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail !== undefined) {
        loadVideoConfig(customEvent.detail);
      } else {
        loadVideoConfig();
      }
    };

    window.addEventListener('codigoVestimentaChanged', handleConfigEvent);
    return () => {
      window.removeEventListener('codigoVestimentaChanged', handleConfigEvent);
    };
  }, [loadVideoConfig]);

  // Handle Vimeo Player SDK integration on iframe
  useEffect(() => {
    if (!isVimeo || !vimeoIframeRef.current) {
      if (vimeoPlayerInstanceRef.current) {
        try {
          vimeoPlayerInstanceRef.current.destroy();
        } catch {
          // ignore
        }
        vimeoPlayerInstanceRef.current = null;
      }
      return;
    }

    const iframe = vimeoIframeRef.current;
    let player: Player | null = null;

    try {
      player = new Player(iframe);
      vimeoPlayerInstanceRef.current = player;

      player.on('loaded', () => {
        setIsLoading(false);
        setVideoLoadError(null);
        // Trigger loadedmetadata callback
        player?.getDuration().then(duration => {
          const fakeVideoElement = {
            duration,
            currentTime: 0,
            ended: false
          } as unknown as HTMLVideoElement;
          onVideoLoadedMetadata?.({ currentTarget: fakeVideoElement } as unknown as React.SyntheticEvent<HTMLVideoElement>);
        }).catch(() => {});
      });

      player.on('timeupdate', (data: { seconds: number; duration: number; percent: number }) => {
        const fakeVideoElement = {
          duration: data.duration,
          currentTime: data.seconds,
          ended: data.percent >= 0.99
        } as unknown as HTMLVideoElement;

        onVideoTimeUpdate?.({ currentTarget: fakeVideoElement } as unknown as React.SyntheticEvent<HTMLVideoElement>);

        if (data.percent >= 0.95) {
          onVideoEnded?.();
        }
      });

      player.on('ended', () => {
        onVideoEnded?.();
      });

      player.on('pause', () => {
        onVideoPause?.();
      });

      player.on('seeked', () => {
        onVideoSeeking?.({} as unknown as React.SyntheticEvent<HTMLVideoElement>);
      });

      player.on('error', (err) => {
        console.error('[Vimeo Player Error]', err);
        setVideoLoadError(
          language === 'ca'
            ? `Error en el reproductor de Vimeo: ${err.message || 'No s\'ha pogut reproduir el vídeo.'}`
            : `Error en el reproductor de Vimeo: ${err.message || 'No se ha podido reproducir el vídeo.'}`
        );
      });
    } catch (err: any) {
      console.error('[Vimeo Init Error]', err);
      setVideoLoadError(
        language === 'ca'
          ? "No s'ha pogut inicialitzar el reproductor de Vimeo."
          : "No se ha podido inicializar el reproductor de Vimeo."
      );
    }

    return () => {
      if (player) {
        try {
          player.destroy();
        } catch {
          // ignore
        }
      }
      vimeoPlayerInstanceRef.current = null;
    };
  }, [isVimeo, vimeoEmbedSrc, onVideoEnded, onVideoLoadedMetadata, onVideoPause, onVideoSeeking, onVideoTimeUpdate, language]);

  // Native MP4 error handler
  const handleNativeVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const mediaErr = video?.error;
    let message = 'Error de reproducció en el fitxer de vídeo';
    if (mediaErr) {
      switch (mediaErr.code) {
        case 1: message = 'Reproducció avortada per l\'usuari o navegador'; break;
        case 2: message = 'Error de descàrrega de xarxa en streaming'; break;
        case 3: message = 'Error de descodificació de còdec de vídeo'; break;
        case 4: message = 'Format no suportat o URL de vídeo no accessible'; break;
      }
    }

    setIsValidSource(false);
    const errMsg = language === 'ca'
      ? `No s'ha pogut reproduir el vídeo: ${message}.`
      : `No se ha podido reproducir el vídeo: ${message}.`;
    setVideoLoadError(errMsg);
  }, [language]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement> | Event) => {
    setVideoLoadError(null);
    onVideoLoadedMetadata?.(e);
  }, [onVideoLoadedMetadata]);

  const handleRetry = () => {
    setVideoLoadError(null);
    loadVideoConfig();
  };

  const blockTitle = language === 'ca' ? "Codi de Vestimenta i Normativa" : "Código de Vestimenta y Normativa";
  const blockSubtitle = language === 'ca' 
    ? "Visualitzeu el vídeo complet per comprovar la vestimenta oficial i habilitar l'enviament de la preinscripció."
    : "Visualiza el vídeo completo para comprobar la vestimenta oficial y habilitar el envío de la preinscripción.";

  return (
    <div 
      id="codigo-vestimenta-block" 
      className="w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 transition-all duration-200"
    >
      {/* Block Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#ff0090]/10 border border-[#ff0090]/30 rounded-2xl text-[#ff0090] shrink-0 mt-0.5">
            <Shirt size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold font-sans text-white tracking-tight">
                {blockTitle}
              </h3>
              {videoWatched && !videoLoadError && !isMissingOriginal && (
                <span 
                  id="badge-video-completat" 
                  className="text-[11px] font-bold font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
                >
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>{language === 'ca' ? "Completat" : "Completado"}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-xl">
              {blockSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Video Container: explicit visible height, aspect-video, no display:none */}
      <div 
        id="video-player-container"
        className="w-full aspect-video min-h-[220px] sm:min-h-[320px] md:min-h-[380px] bg-black rounded-2xl overflow-hidden relative shadow-inner border border-zinc-800 flex items-center justify-center"
      >
        {/* Render Vimeo iframe player when source is Vimeo */}
        {isVimeo && isValidSource && !isMissingOriginal && vimeoEmbedSrc && (
          <iframe
            ref={vimeoIframeRef}
            id="vimeo-cuestionari-iframe"
            key={vimeoEmbedSrc}
            src={vimeoEmbedSrc}
            title="Codi de Vestimenta i Normativa"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full"
            onLoad={() => {
              setIsLoading(false);
              setVideoLoadError(null);
            }}
          />
        )}

        {/* Render native HTML5 video player for direct MP4 / Supabase storage */}
        {!isVimeo && isValidSource && !isMissingOriginal && activeUrl && (
          <video
            ref={videoRef}
            id="video-cuestionari"
            src={activeUrl}
            key={activeUrl}
            controls
            playsInline
            preload="metadata"
            muted
            className="w-full h-full object-contain bg-black"
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={onVideoEnded}
            onTimeUpdate={onVideoTimeUpdate}
            onPause={onVideoPause}
            onSeeking={onVideoSeeking}
            onError={handleNativeVideoError}
          >
            <source src={activeUrl} type="video/mp4" />
            {language === 'ca' 
              ? "El vostre navegador no pot reproduir aquest vídeo." 
              : "Tu navegador no puede reproducir este vídeo."
            }
          </video>
        )}

        {/* Rule 9: Show "Vídeo no configurat" / "Vídeo no configurado" when no URL is configured */}
        {isMissingOriginal && !isLoading && (
          <div 
            id="video-missing-original-notice"
            className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20"
          >
            <div className="p-3.5 bg-zinc-800/80 border border-zinc-700 rounded-2xl text-zinc-400">
              <VideoOff size={32} className="stroke-[2]" />
            </div>
            <h4 className="text-sm font-extrabold text-white">
              {language === 'ca' ? "Vídeo no configurat" : "Vídeo no configurado"}
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
              {language === 'ca'
                ? "Encara no s'ha configurat cap vídeo des de Secretaria (Personalització > Codi de Vestimenta)."
                : "Todavía no se ha configurado ningún vídeo desde Secretaría (Personalización > Código de Vestimenta)."
              }
            </p>
          </div>
        )}

        {/* Video Load Error Overlay */}
        {videoLoadError && !isMissingOriginal && (
          <div 
            id="video-load-error-overlay"
            className="absolute inset-0 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 z-20 animate-fade-in"
          >
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
              <AlertTriangle size={32} className="stroke-[2]" />
            </div>
            <p className="text-xs sm:text-sm text-red-300 max-w-md font-medium leading-relaxed">
              {videoLoadError}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 text-xs font-bold px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition cursor-pointer border border-zinc-700 active:scale-95 shadow-lg"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>{language === 'ca' ? "Tornar a provar" : "Reintentar"}</span>
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && !videoLoadError && !isMissingOriginal && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-2 pointer-events-none z-10">
            <RefreshCw size={26} className="text-zinc-400 animate-spin" />
            <span className="text-[11px] text-zinc-400 font-medium">
              {language === 'ca' ? "Carregant vídeo..." : "Cargando vídeo..."}
            </span>
          </div>
        )}
      </div>

      {/* Requirement / Status Notice (Appears only once) */}
      {videoWatched ? (
        <div 
          id="video-requirement-notice" 
          className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2.5"
        >
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>✅ {language === 'ca' ? "Vídeo vist correctament" : "Vídeo visto correctamente"}</span>
        </div>
      ) : (
        <div 
          id="video-requirement-notice" 
          className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-xs font-semibold flex items-center gap-2.5"
        >
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          <span>
            {videoWatchedError || (language === 'ca' 
              ? "Per continuar, cal veure el vídeo informatiu complet." 
              : "Para continuar, es necesario ver el vídeo informativo completo.")
            }
          </span>
        </div>
      )}
    </div>
  );
};
