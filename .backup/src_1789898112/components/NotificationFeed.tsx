/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { COMPARTIDES_XARXES } from '../data';
import { 
  Instagram, 
  Facebook, 
  Heart, 
  MessageSquare, 
  ExternalLink,
  Megaphone,
  Video,
  AlertTriangle,
  FileText,
  Sparkles,
  Info
} from 'lucide-react';
import { NoticiaXarxes } from '../types';
import { useLanguage } from '../LanguageContext';
import TranslatedText from './TranslatedText';

interface NotificationFeedProps {
  onAddLog?: (txt: string) => void;
  noticies?: NoticiaXarxes[];
}

// Extract YouTube ID safely to render embed players if applicable
function getYoutubeEmbedUrl(url: string = '') {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return '';
}

export default function NotificationFeed({ onAddLog, noticies = COMPARTIDES_XARXES }: NotificationFeedProps) {
  const { language, t } = useLanguage();
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl text-white font-sans">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h3 className="font-sans font-bold text-lg text-fuchsia-500 tracking-tight">{t('feed_title')}</h3>
          <p className="text-xs text-zinc-400 font-mono font-bold tracking-wider">{t('feed_subtitle')}</p>
        </div>
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff0090] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff0090] font-bold"></span>
        </span>
      </div>

      <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1 text-zinc-350">
        {noticies.map((post) => {
          const isYoutube = post.videoUrl && (post.videoUrl.includes('youtube.com') || post.videoUrl.includes('youtu.be'));
          const youtubeEmbed = isYoutube ? getYoutubeEmbedUrl(post.videoUrl) : '';
          const isDirectVideo = post.videoUrl && post.videoUrl.match(/\.(mp4|webm|ogg)/i);

          // Determine card style based on type and high-impact highlight flag
          const isImportant = post.ressaltat || post.tipus === 'alerta';
          
          return (
            <div 
              key={post.id} 
              className={`relative overflow-hidden rounded-2xl p-4.5 transition-all duration-350 border ${
                isImportant
                  ? 'bg-zinc-950 border-fuchsia-500 shadow-lg shadow-fuchsia-500/10 scale-[1.02] ring-1 ring-fuchsia-500/25'
                  : 'bg-zinc-950/60 border-zinc-800/80 hover:border-fuchsia-900/40 hover:bg-zinc-950'
              }`}
            >
              {/* Highlight flash beam animation across the card border for ultimate visibility */}
              {isImportant && (
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 animate-pulse" />
              )}

              {/* Header section */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {/* Type Badge Selector */}
                  {post.tipus === 'alerta' ? (
                    <div className="p-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/20 animate-pulse">
                      <AlertTriangle size={13} className="text-red-500" />
                    </div>
                  ) : post.tipus === 'video' ? (
                    <div className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/20">
                      <Video size={13} className="text-amber-500" />
                    </div>
                  ) : post.tipus === 'nota' ? (
                    <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/20">
                      <FileText size={13} className="text-blue-505" />
                    </div>
                  ) : post.xarxa === 'instagram' ? (
                    <div className="p-1.5 rounded-lg bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600">
                      <Instagram size={13} className="text-white" />
                    </div>
                  ) : post.xarxa === 'facebook' ? (
                    <div className="p-1.5 rounded-lg bg-blue-600">
                      <Facebook size={13} className="text-white" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-lg bg-zinc-800 text-fuchsia-400">
                      <Megaphone size={13} />
                    </div>
                  )}

                  <div className="flex flex-col">
                    <span className="font-sans font-bold text-xs tracking-tight text-white flex items-center gap-1">
                      {language === 'ca'
                        ? (post.usuari === 'Associació Cultural El Tast' ? 'Associació Cultural El Tast' : post.usuari || 'Anunci Oficial')
                        : (post.usuari === 'Associació Cultural El Tast' ? 'Asociación Cultural El Tast' : post.usuari || 'Anuncio Oficial')}
                      {isImportant && (
                        <span className="px-1.5 py-0.5 rounded-full text-[8.5px] bg-fuchsia-500 text-white font-extrabold uppercase animate-bounce">
                          {t('urgent')}
                        </span>
                      )}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono -mt-0.5">
                      {post.dataPublicacio === "Just ara"
                        ? (language === 'ca' ? "Just ara" : "Justo ahora")
                        : post.dataPublicacio}
                    </span>
                  </div>
                </div>

                {/* Sub-badge indicating customized type */}
                <span className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono font-bold tracking-tight uppercase">
                  {post.tipus === 'alerta' ? '🚨' : post.tipus === 'video' ? '🎬' : post.tipus === 'nota' ? '📝' : '📢'}{' '}
                  {post.tipus === 'alerta' 
                    ? (language === 'ca' ? 'Alerta' : 'Alerta') 
                    : post.tipus === 'video' 
                      ? (language === 'ca' ? 'Vídeo' : 'Video') 
                      : post.tipus === 'nota' 
                        ? (language === 'ca' ? 'Nota' : 'Nota') 
                        : 'Post'}
                </span>
              </div>

              {/* Title if defined */}
              {post.titol && (
                <h4 className="font-sans font-black text-xs text-white uppercase tracking-tight mb-1.5 leading-tight flex items-center gap-1">
                  <Sparkles size={11} className="text-[#ff0090] shrink-0" />
                  <TranslatedText text={post.titol} />
                </h4>
              )}

              {/* Body Text / Description */}
              <TranslatedText 
                text={post.text} 
                as="p" 
                className={`text-xs leading-relaxed mb-3 font-sans ${isImportant ? 'text-zinc-200 font-medium' : 'text-zinc-350'}`} 
              />

              {/* Custom Video Block Embed */}
              {post.tipus === 'video' && post.videoUrl && (
                <div className="rounded-xl overflow-hidden mb-3 relative aspect-[16/9] bg-zinc-950 border border-zinc-800">
                  {youtubeEmbed ? (
                    <iframe 
                      src={youtubeEmbed}
                      title={post.titol || "Video de l'entitat"}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="no-referrer"
                    />
                  ) : isDirectVideo ? (
                    <video 
                      src={post.videoUrl} 
                      controls 
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-zinc-400 text-[10px] space-y-2">
                      <Video size={24} className="text-amber-500 animate-pulse" />
                      <div>
                        <span className="block font-bold">{t('external_video')}</span>
                        <a 
                          href={post.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-fuchsia-400 underline hover:text-fuchsia-300 font-mono"
                        >
                          {post.videoUrl}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Normal static image attachments if they coexist */}
              {post.tipus !== 'video' && post.imatgeUrl && (
                <div className="rounded-xl overflow-hidden mb-3 relative aspect-[16/9] bg-zinc-900 border border-zinc-800">
                  <img 
                    src={post.imatgeUrl} 
                    alt="Anunci o Recurs adjunt" 
                    className="object-cover w-full h-full hover:scale-103 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Bottom interaction & reference block */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-900/60 text-zinc-500 text-[10px] font-mono">
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    className="flex items-center gap-1 hover:text-[#ff0090] transition-colors"
                  >
                    <Heart size={11} className="text-red-500 fill-red-500" /> {post.likes ?? 12}
                  </button>
                  <span className="flex items-center gap-1">
                    <Info size={11} className="text-zinc-600" /> {t('verified')}
                  </span>
                </div>
                {post.enllacUrl && (
                  <a 
                    href={post.enllacUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-0.5 text-[#ff0090] hover:underline font-bold"
                  >
                    {t('external_link')} <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {noticies.length === 0 && (
          <div className="text-center py-8 text-zinc-500 space-y-2">
            <Info size={20} className="mx-auto text-zinc-600" />
            <p className="text-xs italic">{t('no_news')}</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800 text-center">
        <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider">
          {t('certified_news')}
        </span>
      </div>
    </div>
  );
}
