import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface CodigoVestimentaModalProps {
  youtubeUrl?: string;
}

export const CodigoVestimentaModal: React.FC<CodigoVestimentaModalProps> = ({ 
  youtubeUrl
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

  const buttonText = language === 'ca' ? "👕 Codi de Vestimenta" : "👕 Código de Vestimenta";
  const modalTitle = language === 'ca' ? "Codi de Vestimenta" : "Código de Vestimenta";
  const closeText = language === 'ca' ? "Tancar" : "Cerrar";

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        className="mb-4 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold py-3.5 px-4 rounded-xl text-base flex items-center justify-center gap-2 transition duration-200 shadow-md cursor-pointer"
      >
        {buttonText}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[999] p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[95vh] border border-zinc-800">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900">
              <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <span>👕</span> {modalTitle}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Container - Aspect 9:16 */}
            <div className="bg-black flex-1 flex items-center justify-center relative" style={{ aspectRatio: '9/16' }}>
              <iframe
                src={videoUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full object-cover"
              ></iframe>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-center shrink-0">
              <button
                onClick={() => setIsOpen(false)}
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
