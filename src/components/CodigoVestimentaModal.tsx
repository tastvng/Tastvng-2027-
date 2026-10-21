import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Shirt, VideoOff, Copy, Check } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import Player from '@vimeo/player';

export const VIDEO_FALLBACK_SECONDS = 150;

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
  const ua = navigator.userAgent;
  return /Instagram|FBAN|FBAV|TikTok|Line/i.test(ua);
}

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

  // In-app browser detection (Instagram, Facebook, TikTok, Line)
  const [isInApp] = useState<boolean>(() => isInAppBrowser());
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Plan B fallback mode state if Vimeo SDK cannot communicate
  const [isSdkCommunicating, setIsSdkCommunicating] = useState<boolean>(false);
  const [fallbackActivated, setFallbackActivated] = useState<boolean>(false);
  const [fallbackRemainingSeconds, setFallbackRemainingSeconds] = useState<number>(VIDEO_FALLBACK_SECONDS);
  const fallbackStartTimeRef = useRef<number | null>(null);
  const sdkCommunicatingRef = useRef<boolean>(false);
  const hasEndedRef = useRef<boolean>(false);
  const videoDurationRef = useRef<number>(0);

  const activateFallback = useCallback(() => {
    if (sdkCommunicatingRef.current || hasEndedRef.current) return;
    setFallbackActivated(prev => {
      if (prev) return prev;
      fallbackStartTimeRef.current = Date.now();
      return true;
    });
  }, []);

  const markSdkCommunicating = useCallback(() => {
    sdkCommunicatingRef.current = true;
    setIsSdkCommunicating(true);
  }, []);

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const input = document.createElement('input');
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.warn('Could not copy link to clipboard:', e);
    }
  };

  // Fallback timer countdown
  useEffect(() => {
    if (!fallbackActivated || videoWatched || isSdkCommunicating) return;

    const tick = () => {
      const now = Date.now();
      const startTime = fallbackStartTimeRef.current || now;
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, VIDEO_FALLBACK_SECONDS - elapsed);
      setFallbackRemainingSeconds(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [fallbackActivated, videoWatched, isSdkCommunicating]);

  // Reference to iframe container for Vimeo Player SDK
  const vimeoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const vimeoPlayerInstanceRef = useRef<Player | null>(null);

  // Stabilize external callbacks to prevent player re-initialization on parent render
  const onVideoLoadedMetadataRef = useRef(onVideoLoadedMetadata);
  const onVideoEndedRef = useRef(onVideoEnded);
  const onVideoTimeUpdateRef = useRef(onVideoTimeUpdate);
  const onVideoPauseRef = useRef(onVideoPause);
  const onVideoSeekingRef = useRef(onVideoSeeking);

  useEffect(() => {
    onVideoLoadedMetadataRef.current = onVideoLoadedMetadata;
    onVideoEndedRef.current = onVideoEnded;
    onVideoTimeUpdateRef.current = onVideoTimeUpdate;
    onVideoPauseRef.current = onVideoPause;
    onVideoSeekingRef.current = onVideoSeeking;
  });

  // Sync / load URL from prop, Supabase or event
  const loadVideoConfig = useCallback(async (forcedUrl?: string) => {
    setIsLoading(true);
    setVideoLoadError(null);
    setIsMissingOriginal(false);

    let targetCandidate = (forcedUrl && forcedUrl.trim()) || (youtubeUrl && youtubeUrl.trim()) || '';

    if (!targetCandidate) {
      try {
        const { getCodigoVestimentaUrl } = await import('../supabaseClient');
        const stored = await getCodigoVestimentaUrl(true);
        targetCandidate = stored?.trim() || '';
      } catch {
        targetCandidate = '';
      }
    }

    if (!targetCandidate) {
      try {
        if (typeof localStorage !== 'undefined') {
          const local = localStorage.getItem('codigo_vestimenta_url');
          if (local && typeof local === 'string' && local.trim()) {
            targetCandidate = local.trim();
          }
        }
      } catch {}
    }

    if (!targetCandidate) {
      // Fallback to official Vimeo video URL
      targetCandidate = 'https://vimeo.com/1207785599';
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
      // Official Vimeo player embed URL with official app_id and dnt (do not track)
      const embedUrl = `https://player.vimeo.com/video/${vimeoInfo.videoId}?app_id=122963&dnt=1`;
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

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'codigo_vestimenta_url') {
        loadVideoConfig(e.newValue || undefined);
      }
    };

    window.addEventListener('codigoVestimentaChanged', handleConfigEvent);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('codigoVestimentaChanged', handleConfigEvent);
      window.removeEventListener('storage', handleStorageEvent);
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
    let isMounted = true;
    let readyResolved = false;

    // Safety timeout: stop spinner after 5 seconds so user can see and interact with Vimeo player
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 5000);

    // Requirement 2: If player.ready() does not resolve in 8 seconds, activate fallback mode
    const readyTimeout = setTimeout(() => {
      if (isMounted && !readyResolved && !sdkCommunicatingRef.current) {
        console.warn('[Vimeo] player.ready() not resolved in 8s -> activating fallback mode');
        activateFallback();
      }
    }, 8000);

    // Requirement 2: If after 20s from initialization no play/timeupdate event arrives, activate fallback mode
    const playTimeout = setTimeout(() => {
      if (isMounted && !sdkCommunicatingRef.current && !hasEndedRef.current) {
        console.warn('[Vimeo] No play or timeupdate event received after 20s -> activating fallback mode');
        activateFallback();
      }
    }, 20000);

    try {
      player = new Player(iframe);
      vimeoPlayerInstanceRef.current = player;

      player.ready().then(() => {
        console.log('[Vimeo event] ready');
        readyResolved = true;
        clearTimeout(safetyTimeout);
        clearTimeout(readyTimeout);
        if (isMounted) {
          setIsLoading(false);
          setVideoLoadError(null);
        }
      }).catch((err: any) => {
        console.log('[Vimeo event] ready error', err);
        clearTimeout(safetyTimeout);
        clearTimeout(readyTimeout);
        if (!isMounted) return;
        setIsLoading(false);
        activateFallback();

        const isBlocked = err?.name === 'PrivacyError' || 
          err?.name === 'SecurityError' ||
          (err?.message && (
            err.message.toLowerCase().includes('privacy') || 
            err.message.toLowerCase().includes('embed') || 
            err.message.toLowerCase().includes('block') ||
            err.message.toLowerCase().includes('permission')
          ));

        if (isBlocked) {
          setVideoLoadError(
            language === 'ca'
              ? "Vimeo ha blocat la inserció d'aquest vídeo per configuració de privadesa o permisos del domini."
              : "Vimeo ha bloqueado la inserción de este vídeo por configuración de privacidad o permisos del dominio."
          );
        } else {
          setVideoLoadError(
            language === 'ca'
              ? `No s'ha pogut carregar el vídeo oficial de Vimeo (ID 1207785599): ${err?.message || 'Error d\'inicialització'}`
              : `No se ha podido cargar el vídeo oficial de Vimeo (ID 1207785599): ${err?.message || 'Error de inicialización'}`
          );
        }
      });

      player.on('loaded', () => {
        console.log('[Vimeo event] loaded');
        clearTimeout(safetyTimeout);
        if (isMounted) {
          setIsLoading(false);
          setVideoLoadError(null);
        }
        // Trigger loadedmetadata callback
        player?.getDuration().then(duration => {
          videoDurationRef.current = duration;
          const fakeVideoElement = {
            duration,
            currentTime: 0,
            ended: false
          } as unknown as HTMLVideoElement;
          onVideoLoadedMetadataRef.current?.({ currentTarget: fakeVideoElement } as unknown as React.SyntheticEvent<HTMLVideoElement>);
        }).catch(() => {});
      });

      player.on('play', () => {
        console.log('[Vimeo event] play');
        markSdkCommunicating();
      });

      player.on('playing', () => {
        console.log('[Vimeo event] playing');
        markSdkCommunicating();
      });

      let maxWatchedSeconds = 0;

      player.on('timeupdate', (data: { seconds: number; duration: number; percent: number }) => {
        console.log('[Vimeo event] timeupdate', { seconds: data.seconds, percent: data.percent, duration: data.duration });
        markSdkCommunicating();

        if (data.duration > 0) {
          videoDurationRef.current = data.duration;
        }

        if (data.seconds > maxWatchedSeconds && data.seconds <= maxWatchedSeconds + 3) {
          maxWatchedSeconds = data.seconds;
        }

        // Requirement 1: Mark as completed if percent >= 0.95 (not 0.999) or seconds near end
        const isCompleted = data.percent >= 0.95 || (data.duration > 0 && data.seconds >= data.duration - 1.5);

        const fakeVideoElement = {
          duration: data.duration,
          currentTime: data.seconds,
          ended: isCompleted
        } as unknown as HTMLVideoElement;

        onVideoTimeUpdateRef.current?.({ currentTarget: fakeVideoElement } as unknown as React.SyntheticEvent<HTMLVideoElement>);

        if (isCompleted) {
          hasEndedRef.current = true;
          onVideoEndedRef.current?.();
        }
      });

      player.on('ended', () => {
        console.log('[Vimeo event] ended');
        markSdkCommunicating();
        hasEndedRef.current = true;
        onVideoEndedRef.current?.();
      });

      (player as any).on('finish', () => {
        console.log('[Vimeo event] finish');
        markSdkCommunicating();
        hasEndedRef.current = true;
        onVideoEndedRef.current?.();
      });

      player.on('pause', () => {
        console.log('[Vimeo event] pause');
        onVideoPauseRef.current?.();
      });

      player.on('seeked', (data: any) => {
        console.log('[Vimeo event] seeked', data);
        const seekTime = (data && typeof data.seconds === 'number') ? data.seconds : 0;
        const duration = videoDurationRef.current || (data && typeof data.duration === 'number' ? data.duration : 0);
        const isNearEnd = (duration > 0 && seekTime >= duration - 3) || (data && typeof data.percent === 'number' && data.percent >= 0.95);

        // Requirement 1: NO reviertas el tiempo si el vídeo ya ha terminado o el seek es al final
        if (!hasEndedRef.current && !videoWatched && !isNearEnd) {
          if (seekTime > maxWatchedSeconds + 2) {
            console.log('[Vimeo anti-skip] reverting from', seekTime, 'to', maxWatchedSeconds);
            player?.setCurrentTime(maxWatchedSeconds).catch(() => {});
          }
        }
        onVideoSeekingRef.current?.({} as unknown as React.SyntheticEvent<HTMLVideoElement>);
      });

      player.on('error', (err: any) => {
        console.log('[Vimeo event] error', err);
        clearTimeout(safetyTimeout);
        clearTimeout(readyTimeout);
        if (!isMounted) return;
        setIsLoading(false);
        activateFallback();

        const isBlocked = err?.name === 'PrivacyError' || 
          err?.name === 'SecurityError' ||
          (err?.message && (
            err.message.toLowerCase().includes('privacy') || 
            err.message.toLowerCase().includes('embed') || 
            err.message.toLowerCase().includes('block') ||
            err.message.toLowerCase().includes('permission')
          ));

        if (isBlocked) {
          setVideoLoadError(
            language === 'ca'
              ? "Vimeo ha blocat la inserció d'aquest vídeo per configuració de privadesa o permisos del domini."
              : "Vimeo ha bloqueado la inserción de este vídeo por configuración de privacidad o permisos del dominio."
          );
        } else {
          setVideoLoadError(
            language === 'ca'
              ? `No s'ha pogut carregar el vídeo oficial de Vimeo (ID 1207785599). Comproveu la connexió o permisos.`
              : `No se ha podido cargar el vídeo oficial de Vimeo (ID 1207785599). Compruebe la conexión o permisos.`
          );
        }
      });
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      clearTimeout(readyTimeout);
      clearTimeout(playTimeout);
      console.error('[Vimeo Init Error]', err);
      activateFallback();
      setVideoLoadError(
        language === 'ca'
          ? "No s'ha pogut inicialitzar el reproductor de Vimeo."
          : "No se ha podido inicializar el reproductor de Vimeo."
      );
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      clearTimeout(readyTimeout);
      clearTimeout(playTimeout);
      if (player) {
        try {
          player.destroy();
        } catch {
          // ignore
        }
      }
      vimeoPlayerInstanceRef.current = null;
    };
  }, [isVimeo, vimeoEmbedSrc, language]);

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

      {/* In-app browser notice (Instagram, Facebook, TikTok, Line) */}
      {isInApp && (
        <div 
          id="in-app-browser-warning"
          className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3.5 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
            <span className="leading-snug">
              {language === 'ca'
                ? "Per veure bé el vídeo, obre aquesta pàgina al navegador (Safari/Chrome)"
                : "Para ver bien el vídeo, abre esta página en el navegador (Safari/Chrome)"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition cursor-pointer active:scale-95 shadow-sm"
          >
            {copiedLink ? (
              <>
                <Check size={14} className="stroke-[2.5]" />
                <span>{language === 'ca' ? "Enllaç copiat!" : "¡Enlace copiado!"}</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>{language === 'ca' ? "Copiar enllaç" : "Copiar enlace"}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Video Container: explicit visible height, aspect-video, no display:none */}
      <div 
        id="video-player-container"
        className="w-full aspect-video min-h-[260px] sm:min-h-[340px] md:min-h-[400px] bg-black rounded-2xl overflow-hidden relative shadow-inner border border-zinc-800 flex items-center justify-center"
        style={{ minHeight: '260px', display: 'flex' }}
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
            style={{ width: '100%', height: '100%', minHeight: '260px', display: 'block', border: 'none' }}
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
            {activeUrl && (activeUrl.includes('vimeo.com') || isVimeo) && (
              <a 
                href={activeUrl.startsWith('http') ? activeUrl : `https://${activeUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#ff0090] underline hover:text-[#d60079] font-bold"
              >
                {language === 'ca' ? "Obrir vídeo a Vimeo" : "Abrir vídeo en Vimeo"}
              </a>
            )}
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
        {isLoading && !videoLoadError && !isMissingOriginal && !vimeoEmbedSrc && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-2 pointer-events-none z-10">
            <RefreshCw size={26} className="text-zinc-400 animate-spin" />
            <span className="text-[11px] text-zinc-400 font-medium">
              {language === 'ca' ? "Carregant vídeo..." : "Cargando vídeo..."}
            </span>
          </div>
        )}
      </div>

      {/* Fallback mode if Vimeo SDK cannot communicate */}
      {!isSdkCommunicating && fallbackActivated && !videoWatched && (
        <div 
          id="video-fallback-container"
          className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-fadeIn"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-xs font-bold text-amber-200">
                {language === 'ca'
                  ? "No podem comprovar automàticament que has vist el vídeo"
                  : "No podemos comprobar automáticamente que has visto el vídeo"}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                {language === 'ca'
                  ? "El navegador actual no permet la comunicació amb el reproductor. Si ja heu reproduït el vídeo, podeu confirmar-ho un cop finalitzat el temps mínim."
                  : "El navegador actual no permite la comunicación con el reproductor. Si ya has reproducido el vídeo, puedes confirmarlo una vez finalizado el tiempo mínimo."}
              </p>
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              disabled={fallbackRemainingSeconds > 0}
              onClick={() => {
                onVideoEndedRef.current?.();
              }}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                fallbackRemainingSeconds > 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg active:scale-95'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>
                {language === 'ca' ? "He vist el vídeo complet" : "He visto el vídeo completo"}
                {fallbackRemainingSeconds > 0 ? ` (${fallbackRemainingSeconds}s)` : ''}
              </span>
            </button>

            {fallbackRemainingSeconds > 0 && (
              <span className="text-[10px] text-zinc-500 font-mono text-center sm:text-right">
                {language === 'ca' ? `Es podrà prémer en ${fallbackRemainingSeconds} segons` : `Se podrá pulsar en ${fallbackRemainingSeconds} segundos`}
              </span>
            )}
          </div>
        </div>
      )}

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
