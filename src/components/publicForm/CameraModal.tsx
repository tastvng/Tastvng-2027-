import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Camera } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface CameraModalProps {
  cameraActive: boolean;
  videoError: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  simulateCapture: () => void;
  stopCamera: () => void;
  capturePhoto: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  cameraActive,
  videoError,
  videoRef,
  canvasRef,
  simulateCapture,
  stopCamera,
  capturePhoto,
}) => {
  const { language } = useLanguage();

  return (
    <AnimatePresence>
      {cameraActive && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center"
          id="camera-overlay"
        >
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-lg w-full relative">
            <h3 className="font-sans font-bold text-white text-lg mb-1 tracking-tight">
              {language === 'ca' ? 'Capturadora de DNI' : 'Capturadora de DNI'}
            </h3>
            <p className="text-zinc-400 text-xs mb-4">
              {language === 'ca' 
                ? "Centreu el document nacional d'identitat (part davantera) dins el quadre." 
                : "Centre el documento nacional de identidad (parte delantera) dentro del recuadro."}
            </p>

            {/* Viewfinder stage */}
            <div className="relative aspect-[16/10] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center mb-6">
              {videoError ? (
                <div className="p-6 text-center">
                  <AlertTriangle className="mx-auto text-amber-500 mb-2" size={28} />
                  <p className="text-xs text-zinc-300 mb-4">{videoError}</p>
                  <button 
                    type="button"
                    onClick={simulateCapture}
                    className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
                    id="btn-simulate-dni"
                  >
                    {language === 'ca' ? "Simular captura amb foto d'exemple" : "Simular captura con foto de ejemplo"}
                  </button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="absolute inset-0 object-cover w-full h-full"
                  />
                  {/* Visual Crop Guide overlay */}
                  <div className="absolute inset-4 border-2 border-dashed border-fuchsia-500/80 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="text-[10px] bg-fuchsia-500/90 text-white font-bold px-2 py-1 rounded tracking-widest uppercase font-mono">
                      {language === 'ca' ? 'EMQUADREU DNI FRONT' : 'ENCUADRE DNI FRONTAL'}
                    </div>
                  </div>
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                type="button"
                onClick={stopCamera}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                id="btn-cancel-camera"
              >
                {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
              </button>
              {!videoError && (
                <button 
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-fuchsia-600/30 transition flex items-center gap-1.5 cursor-pointer"
                  id="btn-capture-camera"
                >
                  <Camera size={14} /> {language === 'ca' ? 'Fes la foto del DNI' : 'Hacer foto del DNI'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
