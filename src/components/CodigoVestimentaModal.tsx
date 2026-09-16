import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface CodigoVestimentaModalProps {
  youtubeUrl?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  videoWatched?: boolean;
  videoWatchedError?: string | null;
  onVideoEnded?: () => void;
  onVideoTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoPause?: () => void;
  onVideoSeeking?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onCloseModal?: () => void;
}

export const CodigoVestimentaModal: React.FC<CodigoVestimentaModalProps> = ({ 
  youtubeUrl,
  videoRef,
  videoWatched = false,
  videoWatchedError = null,
  onVideoEnded,
  onVideoTimeUpdate,
  onVideoPause,
  onVideoSeeking,
  onCloseModal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    const fetchVideoUrl = async () => {
      try {
        const { getSupabaseSetting, isSupabaseConfigured } = await import('../supabaseClient');
        if (isSupabaseConfigured) {
          const storedUrl = await getSupabaseSetting<string>('codigo_vestimenta_url', 'https://player.vimeo.com/video/1207785599');
          setVideoUrl(storedUrl || 'https://player.vimeo.com/video/1207785599');
        } else {
          const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('codigo_vestimenta_url') : null;
          setVideoUrl(localUrl || 'https://player.vimeo.com/video/1207785599');
        }
      } catch (error) {
        console.error('Error fetching video URL from Supabase:', error);
        setVideoUrl('https://player.vimeo.com/video/1207785599');
      }
    };
    fetchVideoUrl().catch(err => {
      console.error("Unhandled error in fetchVideoUrl:", err);
      setVideoUrl('https://player.vimeo.com/video/1207785599');
    });
  }, []);

  // Ensure live previews from the admin customization panel keep updating in real-time
  useEffect(() => {
    if (youtubeUrl) {
      setVideoUrl(youtubeUrl);
    }
  }, [youtubeUrl]);

  const isYoutube = Boolean(videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')));
  const isVimeo = Boolean(videoUrl && videoUrl.includes('vimeo.com'));
  const isEmbed = isYoutube || isVimeo;

  // Enhance iframe URLs with postMessage API triggers for watch completion detection
  const embedUrl = useMemo(() => {
    if (!videoUrl) return '';
    if (isVimeo) {
      const sep = videoUrl.includes('?') ? '&' : '?';
      return `${videoUrl}${sep}api=1&player_id=vimeo_player`;
    }
    if (isYoutube) {
      const sep = videoUrl.includes('?') ? '&' : '?';
      const originParam = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
      return `${videoUrl}${sep}enablejsapi=1${originParam}`;
    }
    return videoUrl;
  }, [videoUrl, isVimeo, isYoutube]);

  // Listen for iframe postMessage events (Vimeo finish/timeupdate, YouTube state change)
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // Vimeo Player API
        if (data.event === 'finish') {
          onVideoEnded?.();
        } else if (data.event === 'timeupdate' && data.data && typeof data.data.percent === 'number') {
          if (data.data.percent >= 0.95) {
            onVideoEnded?.();
          }
        } else if (data.event === 'pause') {
          onVideoPause?.();
        }

        // YouTube Player API
        if (data.event === 'onStateChange') {
          if (data.info === 0) { // 0 = ended
            onVideoEnded?.();
          } else if (data.info === 2) { // 2 = paused
            onVideoPause?.();
          }
        }
      } catch {
        // Ignore unparseable third-party messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, onVideoEnded, onVideoPause]);

  const handleClose = () => {
    onCloseModal?.();
    setIsOpen(false);
  };

  const buttonText = language === 'ca' ? "👕 Codi de Vestimenta" : "👕 Código de Vestimenta";
  const modalTitle = language === 'ca' ? "Codi de Vestimenta" : "Código de Vestimenta";
  const closeText = language === 'ca' ? "Tancar" : "Cerrar";

  return (
    <>
      <div className="space-y-2 mb-4">
        <button
          onClick={() => setIsOpen(true)}
          type="button"
          className={`w-full font-extrabold py-3.5 px-4 rounded-xl text-base flex items-center justify-center gap-2 transition duration-200 shadow-md cursor-pointer ${
            videoWatched 
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-yellow-500 hover:bg-yellow-600 text-black"
          }`}
        >
          <span>{buttonText}</span>
          {videoWatched && <span className="text-xs bg-black/20 px-2 py-0.5 rounded-md">✓ {language === 'ca' ? "Vist" : "Visto"}</span>}
        </button>

        {/* Video status indicator banner */}
        {videoWatched ? (
          <div id="video-status-success" className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>✅ {language === 'ca' ? "Vídeo vist correctament" : "Vídeo visto correctamente"}</span>
          </div>
        ) : videoWatchedError ? (
          <div id="video-requirement-notice" className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <span>{videoWatchedError}</span>
          </div>
        ) : null}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[95vh] border border-zinc-800">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900">
              <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <span>👕</span> {modalTitle}
              </h3>
              <button
                onClick={handleClose}
                type="button"
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Container - Aspect 9:16 */}
            <div className="bg-black flex-1 flex items-center justify-center relative overflow-hidden" style={{ aspectRatio: '9/16' }}>
              {/* HTML5 video element with videoRef for native inspection, ended events and 95% duration */}
              <video
                ref={videoRef}
                id="video-cuestionari"
                src={isEmbed ? undefined : videoUrl}
                controls={!isEmbed}
                playsInline
                onEnded={onVideoEnded}
                onTimeUpdate={onVideoTimeUpdate}
                onPause={onVideoPause}
                onSeeking={onVideoSeeking}
                className={isEmbed ? "hidden" : "w-full h-full object-cover"}
              />

              {isEmbed && (
                <iframe
                  id="iframe-video-cuestionari"
                  src={embedUrl}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full object-cover"
                ></iframe>
              )}
            </div>

            {/* In-modal status banner if completed */}
            {videoWatched && (
              <div className="px-4 py-2 bg-emerald-950/80 border-t border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>✅ {language === 'ca' ? "Vídeo vist correctament" : "Vídeo visto correctamente"}</span>
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-center shrink-0">
              <button
                onClick={handleClose}
                type="button"
                className="w-full bg-[#ff0090] hover:bg-[#d40078] text-white font-extrabold py-3 px-6 rounded-xl cursor-pointer text-xs uppercase font-mono tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <span>{closeText.toUpperCase()} ✕</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
