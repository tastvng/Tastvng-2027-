import React from 'react';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'url';
}

export default function TextInput({
  label,
  value,
  onChange,
  description,
  placeholder,
  required,
  type = 'text'
}: TextInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-zinc-700 font-sans">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {description && <p className="text-[11px] text-zinc-500 leading-normal">{description}</p>}
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-xs focus:border-[#ff0090] focus:outline-none transition-all shadow-inner bg-zinc-50/50"
      />
    </div>
  );
}
