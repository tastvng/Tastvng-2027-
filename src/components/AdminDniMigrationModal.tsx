/**
 * Modal to migrate legacy Base64 DNI images directly from public.inscripciones
 * to the private Supabase Storage 'dnis' bucket.
 * 
 * Complies with user requirements:
 * - Admin only.
 * - Reads directly via authenticated Supabase client (without passing through /api).
 * - Converts base64 to Blob and compresses to max 1280px and WebP quality 0.7 (≤ 500 KB).
 * - Uploads to bucket 'dnis' as <codiSeguiment>/c1.webp (or c2.webp) with upsert: true.
 * - Updates the column with the route only if the upload succeeds.
 * - Shows row-by-row progress and errors.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  FileCheck, 
  HardDrive, 
  ShieldCheck, 
  Play, 
  Square, 
  RefreshCw 
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { compressDniImage } from '../utils/imageCompression';
import { useLanguage } from '../LanguageContext';

export interface MigrationItem {
  id: string; // rowId_participant
  inscriptionId: string;
  codiSeguiment: string;
  participant: 'c1' | 'c2';
  participantName: string;
  originalDataUrl: string;
  status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  originalSizeBytes?: number;
  compressedSizeBytes?: number;
  storagePath?: string;
}

interface AdminDniMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete?: () => void;
}

export function AdminDniMigrationModal({
  isOpen,
  onClose,
  onMigrationComplete
}: AdminDniMigrationModalProps) {
  const { language } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [itemsToMigrate, setItemsToMigrate] = useState<MigrationItem[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const isCancelledRef = useRef(false);

  // Scan directly with Supabase client on open
  useEffect(() => {
    if (isOpen) {
      scanCandidates();
    } else {
      isCancelledRef.current = true;
      setIsMigrating(false);
    }
  }, [isOpen]);

  const scanCandidates = async () => {
    if (!supabase) {
      setScanError(language === 'ca' ? "Client de Supabase no inicialitzat." : "Cliente de Supabase no inicializado.");
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setHasScanned(false);

    try {
      // Query directly with authenticated admin client, without passing through /api
      const { data, error } = await supabase
        .from('inscripciones')
        .select('id, codiSeguiment, c1Nom, c1Cognoms, c2Nom, c2Cognoms, c1DniUrl, c2DniUrl');

      if (error) {
        throw new Error(error.message);
      }

      const candidates: MigrationItem[] = [];

      for (const row of data || []) {
        const codi = String(row.codiSeguiment || row.id || '').trim();
        
        // Check c1DniUrl
        if (typeof row.c1DniUrl === 'string' && row.c1DniUrl.startsWith('data:')) {
          const name = `${row.c1Nom || ''} ${row.c1Cognoms || ''}`.trim() || 'Participant 1';
          candidates.push({
            id: `${row.id}_c1`,
            inscriptionId: row.id,
            codiSeguiment: codi,
            participant: 'c1',
            participantName: name,
            originalDataUrl: row.c1DniUrl,
            status: 'pending',
            originalSizeBytes: Math.round(row.c1DniUrl.length * 0.75)
          });
        }

        // Check c2DniUrl
        if (typeof row.c2DniUrl === 'string' && row.c2DniUrl.startsWith('data:')) {
          const name = `${row.c2Nom || ''} ${row.c2Cognoms || ''}`.trim() || 'Participant 2';
          candidates.push({
            id: `${row.id}_c2`,
            inscriptionId: row.id,
            codiSeguiment: codi,
            participant: 'c2',
            participantName: name,
            originalDataUrl: row.c2DniUrl,
            status: 'pending',
            originalSizeBytes: Math.round(row.c2DniUrl.length * 0.75)
          });
        }
      }

      setItemsToMigrate(candidates);
      setHasScanned(true);
    } catch (err: any) {
      console.error("Error scanning inscriptions with Base64 DNI:", err);
      setScanError(err?.message || (language === 'ca' ? "Error escanejant les inscripcions." : "Error escaneando las inscripciones."));
    } finally {
      setIsScanning(false);
    }
  };

  const startMigration = async () => {
    if (!supabase || itemsToMigrate.length === 0 || isMigrating) return;

    setIsMigrating(true);
    isCancelledRef.current = false;

    for (let i = 0; i < itemsToMigrate.length; i++) {
      if (isCancelledRef.current) break;

      const item = itemsToMigrate[i];
      if (item.status === 'success') continue;

      // 1. Mark as compressing
      updateItemStatus(item.id, 'compressing');

      let compressedBlob: Blob;
      let compressedSize = 0;

      try {
        const compressed = await compressDniImage(item.originalDataUrl, 1280, 0.7);
        compressedBlob = compressed.blob;
        compressedSize = compressed.sizeBytes;
      } catch (compErr: any) {
        updateItemStatus(item.id, 'error', compErr?.message || "Error comprimint imatge Base64");
        continue;
      }

      if (isCancelledRef.current) break;

      // 2. Mark as uploading
      updateItemStatus(item.id, 'uploading', undefined, compressedSize);

      const cleanCode = item.codiSeguiment.replace(/[^A-Za-z0-9_-]/g, '_');
      const storageFilePath = `${cleanCode}/${item.participant}.webp`;

      try {
        // Upload directly to bucket 'dnis' with upsert: true
        const { error: uploadError } = await supabase.storage
          .from('dnis')
          .upload(storageFilePath, compressedBlob, {
            contentType: 'image/webp',
            upsert: true
          });

        if (uploadError) {
          updateItemStatus(item.id, 'error', `Error Supabase Storage: ${uploadError.message}`);
          continue;
        }

        // 3. Update database column with the storage path ONLY IF upload succeeded
        const updatePayload = item.participant === 'c1'
          ? { c1DniUrl: storageFilePath, actualizadoEn: new Date().toISOString() }
          : { c2DniUrl: storageFilePath, actualizadoEn: new Date().toISOString() };

        const { error: dbError } = await supabase
          .from('inscripciones')
          .update(updatePayload)
          .eq('id', item.inscriptionId);

        if (dbError) {
          updateItemStatus(item.id, 'error', `Pujat a Storage, però error guardant a BD: ${dbError.message}`);
          continue;
        }

        // 4. Mark success
        updateItemStatus(item.id, 'success', undefined, compressedSize, storageFilePath);
      } catch (err: any) {
        updateItemStatus(item.id, 'error', err?.message || "Excepció durant la migració");
      }
    }

    setIsMigrating(false);
    onMigrationComplete?.();
  };

  const stopMigration = () => {
    isCancelledRef.current = true;
    setIsMigrating(false);
  };

  const updateItemStatus = (
    id: string,
    status: MigrationItem['status'],
    errorMessage?: string,
    compressedSizeBytes?: number,
    storagePath?: string
  ) => {
    setItemsToMigrate(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        return {
          ...it,
          status,
          ...(errorMessage !== undefined ? { errorMessage } : {}),
          ...(compressedSizeBytes !== undefined ? { compressedSizeBytes } : {}),
          ...(storagePath !== undefined ? { storagePath } : {})
        };
      })
    );
  };

  if (!isOpen) return null;

  const totalCount = itemsToMigrate.length;
  const successCount = itemsToMigrate.filter(it => it.status === 'success').length;
  const errorCount = itemsToMigrate.filter(it => it.status === 'error').length;
  const progressPercent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-zinc-200/80 my-8 space-y-6 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shadow-xs">
              <UploadCloud size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                {language === 'ca' ? "Migració de DNI antics" : "Migración de DNI antiguos"}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold uppercase">
                  Base64 → Storage
                </span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {language === 'ca'
                  ? "Converteix els DNI en base64 de la BD a format WebP optimitzat (≤ 500 KB) al bucket privat 'dnis'."
                  : "Convierte los DNI en base64 de la BD a formato WebP optimizado (≤ 500 KB) en el bucket privado 'dnis'."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isMigrating}
            className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition disabled:opacity-50 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scan / Status Banner */}
        {isScanning ? (
          <div className="bg-zinc-50 rounded-2xl p-6 text-center space-y-2 border border-zinc-200/60">
            <Loader2 size={28} className="animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-zinc-700">
              {language === 'ca' ? "Escanejant la base de dades a la cerca de DNI en base64..." : "Escaneando la base de datos en busca de DNI en base64..."}
            </p>
          </div>
        ) : scanError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl p-4 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">{language === 'ca' ? "Error escanejant inscripcions" : "Error escaneando inscripciones"}</p>
              <p className="text-red-600 text-[11px] font-mono">{scanError}</p>
              <button
                type="button"
                onClick={scanCandidates}
                className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> {language === 'ca' ? "Tornar a provar" : "Reintentar"}
              </button>
            </div>
          </div>
        ) : hasScanned && totalCount === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl p-6 text-center space-y-2">
            <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
            <p className="font-bold text-sm">
              {language === 'ca' ? "Cap DNI antic en base64 detectat!" : "¡Ningún DNI antiguo en base64 detectado!"}
            </p>
            <p className="text-[11px] text-emerald-700 max-w-md mx-auto">
              {language === 'ca' 
                ? "Totes les inscripcions existents ja utilitzen rutes d'emmagatzematge o no tenen fitxer associat. La teva base de dades està optimitzada."
                : "Todas las inscripciones existentes ya utilizan rutas de almacenamiento o no tienen archivo adjunto. Tu base de datos está optimizada."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-50 border border-zinc-200/70 rounded-2xl p-3.5 text-center">
                <span className="block text-[10px] text-zinc-500 uppercase font-mono font-bold">
                  {language === 'ca' ? "DNI a migrar" : "DNI a migrar"}
                </span>
                <span className="text-2xl font-black text-zinc-900 mt-0.5 block">
                  {totalCount}
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200/70 rounded-2xl p-3.5 text-center">
                <span className="block text-[10px] text-emerald-700 uppercase font-mono font-bold">
                  {language === 'ca' ? "Migrats" : "Migrados"}
                </span>
                <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                  {successCount}
                </span>
              </div>
              <div className="bg-red-50 border border-red-200/70 rounded-2xl p-3.5 text-center">
                <span className="block text-[10px] text-red-700 uppercase font-mono font-bold">
                  {language === 'ca' ? "Errors" : "Errores"}
                </span>
                <span className="text-2xl font-black text-red-700 mt-0.5 block">
                  {errorCount}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-zinc-600">
                <span>{language === 'ca' ? "Progrés de la migració" : "Progreso de la migración"}</span>
                <span>{progressPercent}% ({successCount} / {totalCount})</span>
              </div>
              <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/70">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Items List */}
        {totalCount > 0 && (
          <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[340px] border border-zinc-200 rounded-2xl divide-y divide-zinc-100 bg-zinc-50/50">
            {itemsToMigrate.map((it) => (
              <div key={it.id} className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-zinc-100/60 transition">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-zinc-800">{it.codiSeguiment}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-200 text-zinc-700 font-bold uppercase">
                      {it.participant.toUpperCase()}
                    </span>
                    <span className="font-medium text-zinc-600 truncate max-w-[200px]">{it.participantName}</span>
                  </div>
                  {it.storagePath && (
                    <p className="text-[10px] font-mono text-emerald-700">
                      → {it.storagePath}
                    </p>
                  )}
                  {it.errorMessage && (
                    <p className="text-[10px] font-mono text-red-600">
                      ✗ {it.errorMessage}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {it.status === 'pending' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600 font-bold">
                      {language === 'ca' ? "Pendent" : "Pendiente"}
                    </span>
                  )}
                  {it.status === 'compressing' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> {language === 'ca' ? "Comprimint..." : "Comprimiendo..."}
                    </span>
                  )}
                  {it.status === 'uploading' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> {language === 'ca' ? "Pujant..." : "Subiendo..."}
                    </span>
                  )}
                  {it.status === 'success' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-emerald-600" /> {language === 'ca' ? "Completat" : "Completado"}
                    </span>
                  )}
                  {it.status === 'error' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold flex items-center gap-1">
                      <AlertTriangle size={11} className="text-red-600" /> Error
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={scanCandidates}
            disabled={isScanning || isMigrating}
            className="text-xs font-bold text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
            {language === 'ca' ? "Tornar a escanejar" : "Volver a escanear"}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {isMigrating ? (
              <button
                type="button"
                onClick={stopMigration}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Square size={13} /> {language === 'ca' ? "Aturar" : "Detener"}
              </button>
            ) : totalCount > 0 && successCount < totalCount ? (
              <button
                type="button"
                onClick={startMigration}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Play size={13} /> {language === 'ca' ? "Iniciar Migració" : "Iniciar Migración"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              disabled={isMigrating}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {language === 'ca' ? "Tancar" : "Cerrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
