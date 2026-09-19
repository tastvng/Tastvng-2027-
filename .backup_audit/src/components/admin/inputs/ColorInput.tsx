import React from 'react';

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
}

export default function ColorInput({
  label,
  value,
  onChange,
  description,
  required
}: ColorInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-zinc-700 font-sans">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {description && <p className="text-[11px] text-zinc-500 leading-normal">{description}</p>}
      <div className="flex gap-3 items-center">
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-16 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1 shadow-sm focus:outline-none transition-all"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FF6B35"
          className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 font-mono text-xs focus:border-[#ff0090] focus:outline-none transition-all shadow-inner bg-zinc-50/50"
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
    </div>
  );
}
