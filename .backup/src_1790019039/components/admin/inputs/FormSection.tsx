import React from 'react';

interface FormSectionProps {
  key?: string;
  title: string;
  icon?: string;
  description?: string;
  children: React.ReactNode;
}

export default function FormSection({
  title,
  icon,
  description,
  children
}: FormSectionProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 border-b border-zinc-100 pb-4">
        <h3 className="text-sm font-bold text-zinc-800 font-sans flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </h3>
        {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
