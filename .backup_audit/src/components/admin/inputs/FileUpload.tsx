import React, { useState } from 'react';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  label: string;
  description?: string;
  onChange: (value: string) => void;
  value?: string;
  required?: boolean;
  accept?: string;
}

export default function FileUpload({
  label,
  description,
  onChange,
  value,
  required,
  accept = 'image/*'
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("El fitxer ha de ser una imatge. / El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      alert("La imatge és massa gran (màxim 1.5MB). / La imagen es demasiado grande (máximo 1.5MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onChange(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-zinc-700 font-sans">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {description && <p className="text-[11px] text-zinc-500 leading-normal">{description}</p>}
      
      {value ? (
        <div className="relative rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 flex items-center justify-between gap-4 group">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-16 w-16 rounded-xl border border-zinc-200/60 overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-sm">
              <img src={value} alt="Preview" className="h-full w-full object-contain" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-mono text-zinc-400 truncate max-w-[200px]">
                {value.startsWith('data:') ? 'Base64 Encoded Image' : value}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm bg-white border border-zinc-100"
            title="Eliminar imatge"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center gap-2 cursor-pointer ${
            isDragging 
              ? 'border-[#ff0090] bg-fuchsia-50/20' 
              : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/30 hover:bg-zinc-50/60'
          }`}
        >
          <input
            type="file"
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            required={required && !value}
          />
          <div className="p-3 bg-white border border-zinc-100 rounded-2xl shadow-sm text-zinc-400">
            <Upload size={18} className="animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-zinc-700">
              Arrossega una imatge o fes clic per buscar-la
            </p>
            <p className="text-[10px] text-zinc-400 font-mono">
              PNG, JPG o WEBP fins a 1.5MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
