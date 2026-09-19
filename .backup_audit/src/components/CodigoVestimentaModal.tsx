import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Shirt, VideoOff } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

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
 * Strict console logging for failures conforming to Rule 8:
 * - URL utilizada
 * - código HTTP
 * - error de reproducción
 * Nunca muestres credenciales.
 */
function logVideoFailure(url: string, httpStatus: number | string, playError: string) {
  console.error('[Video Error]', {
    'URL utilizada': url,
    'código HTTP': httpStatus,
    'error de reproducción': playError
  });
}

/**
 * Verifies if a video URL exists, is accessible, and returns HTTP 200 / 206
 */
async function verifyVideoSource(url: string): Promise<{ ok: boolean; status: number | string; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' }
    });
    if (res.ok || res.status === 200 || res.status === 206) {
      return { ok: true, status: res.status };
    }
    return {
      ok: false,
      status: res.status,
      error: `HTTP ${res.status} ${res.statusText || 'Error de càrrega'}`
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 'N/A',
      error: err?.message || 'Error de xarxa o connexió'
    };
  }
}

/**
 * Resolves Supabase Storage URLs (handles public bucket paths, signed URLs, and storage:// protocol)
 */
async function resolveStorageOrPublicUrl(rawUrl: string): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  // Handle absolute path directly
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // If already an HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Check if it is a Supabase Storage URL that might need a fresh signed URL
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

  // Handle storage://bucket/path custom protocol
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
          if (!error && data?.signedUrl) {
            return data.signedUrl;
          }
          const pub = supabase.storage.from(bucket).getPublicUrl(objectPath);
          if (pub?.data?.publicUrl) {
            return pub.data.publicUrl;
          }
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
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isValidSource, setIsValidSource] = useState<boolean>(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [isMissingOriginal, setIsMissingOriginal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load and verify candidate video sources
  const loadAndVerifyVideo = useCallback(async () => {
    setIsLoading(true);
    setVideoLoadError(null);
    setIsMissingOriginal(false);

    let targetCandidate = youtubeUrl?.trim();

    if (!targetCandidate) {
      try {
        const { getSupabaseSetting, isSupabaseConfigured } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          const stored = await getSupabaseSetting<string>('codigo_vestimenta_url', '');
          targetCandidate = stored?.trim() || '';
        } else {
          const local = typeof localStorage !== 'undefined' ? localStorage.getItem('codigo_vestimenta_url') : null;
          targetCandidate = local?.trim() || '';
        }
      } catch {
        targetCandidate = '';
      }
    }

    if (!targetCandidate) {
      setIsMissingOriginal(true);
      setIsValidSource(false);
      setIsLoading(false);
      return;
    }

    const resolvedUrl = await resolveStorageOrPublicUrl(targetCandidate);
    if (!resolvedUrl) {
      setIsMissingOriginal(true);
      setIsValidSource(false);
      setIsLoading(false);
      return;
    }

    // Verify resolved URL
    const check = await verifyVideoSource(resolvedUrl);
    if (check.ok) {
      setVideoUrl(resolvedUrl);
      setIsValidSource(true);
      setVideoLoadError(null);
      setIsLoading(false);
      return;
    }

    // Logging in strict compliance with Rule 8
    logVideoFailure(resolvedUrl, check.status, check.error || 'Font no accessible');

    setIsValidSource(false);
    setIsLoading(false);
    const errMsg = language === 'ca'
      ? "No s'ha pogut carregar el fitxer de vídeo original. Comproveu la connexió o contacteu amb l'organització."
      : "No se ha podido cargar el archivo de vídeo original. Comprueba la conexión o contacta con la organización.";
    setVideoLoadError(errMsg);
  }, [youtubeUrl, language]);

  useEffect(() => {
    loadAndVerifyVideo();
  }, [loadAndVerifyVideo]);

  // Handle native video playback errors (Rule 8)
  const handleNativeVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const mediaErr = video?.error;
    let code: string | number = 'N/A';
    let message = 'Error de reproducció en el fitxer de vídeo';
    if (mediaErr) {
      code = mediaErr.code;
      switch (mediaErr.code) {
        case 1: message = 'Reproducció avortada per l\'usuari o navegador'; break;
        case 2: message = 'Error de descàrrega de xarxa en streaming'; break;
        case 3: message = 'Error de descodificació de còdec de vídeo'; break;
        case 4: message = 'Format no suportat o URL de vídeo no accessible'; break;
      }
    }

    logVideoFailure(videoUrl, code, message);
    setIsValidSource(false);
    const errMsg = language === 'ca'
      ? "No s'ha pogut reproduir el vídeo original. Comproveu la connexió o contacteu amb l'organització."
      : "No se ha podido reproducir el vídeo original. Comprueba la conexión o contacta con la organización.";
    setVideoLoadError(errMsg);
  }, [videoUrl, language]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement> | Event) => {
    setVideoLoadError(null);
    onVideoLoadedMetadata?.(e);
  }, [onVideoLoadedMetadata]);

  // Retry handler (Rule 9)
  const handleRetry = () => {
    setVideoLoadError(null);
    loadAndVerifyVideo();
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
        {/* Render player ONLY when source is valid */}
        {isValidSource && !isMissingOriginal && (
          <video
            ref={videoRef}
            id="video-cuestionari"
            src={videoUrl}
            key={videoUrl}
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
            <source src={videoUrl} type="video/mp4" />
            {language === 'ca' 
              ? "El vostre navegador no pot reproduir aquest vídeo." 
              : "Tu navegador no puede reproducir este vídeo."
            }
          </video>
        )}

        {/* Rule 7: Clear message when original video is not available */}
        {isMissingOriginal && !isLoading && (
          <div 
            id="video-missing-original-notice"
            className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20"
          >
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
              <VideoOff size={32} className="stroke-[2]" />
            </div>
            <h4 className="text-sm font-extrabold text-white">
              Falta cargar el vídeo original
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
              {language === 'ca'
                ? "Cal carregar el vídeo original des del panell d'administració (Personalització > Codi de vestimenta) per visualitzar la normativa."
                : "Es necesario cargar el vídeo original desde el panel de administración (Personalización > Código de vestimenta) para visualizar la normativa."
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

      {/* Requirement / Status Notice */}
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
