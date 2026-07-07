import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface CodigoVestimentaModalProps {
  youtubeUrl?: string;
}

export const CodigoVestimentaModal: React.FC<CodigoVestimentaModalProps> = ({ 
  youtubeUrl = 'https://www.youtube.com/embed/dcY7s1F3jo0' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();

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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999] p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-zinc-100 bg-zinc-50">
              <h3 className="text-sm font-mono font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <span>👕</span> {modalTitle}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                className="text-zinc-400 hover:text-zinc-650 p-1.5 rounded-lg hover:bg-zinc-100 transition cursor-pointer"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Container - Aspect 9:16 */}
            <div className="bg-black flex-1 flex items-center justify-center" style={{ aspectRatio: '9/16' }}>
              <iframe
                width="100%"
                height="100%"
                src={youtubeUrl}
                title={modalTitle}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                className="bg-zinc-200 hover:bg-zinc-300 text-zinc-850 font-bold py-2 px-6 rounded-xl transition cursor-pointer text-xs uppercase font-sans tracking-wide"
              >
                {closeText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
