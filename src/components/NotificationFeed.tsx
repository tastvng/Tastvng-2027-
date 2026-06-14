/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { COMPARTIDES_XARXES } from '../data';
import { Instagram, Facebook, Heart, MessageSquare, ExternalLink } from 'lucide-react';

interface NotificationFeedProps {
  onAddLog?: (txt: string) => void;
}

export default function NotificationFeed({ onAddLog }: NotificationFeedProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl text-white">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h3 className="font-sans font-bold text-lg text-fuchsia-500 tracking-tight">Xarxes Socials connectades</h3>
          <p className="text-xs text-zinc-400 font-mono">@eltastvng • Avisos en directe</p>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500 font-bold"></span>
        </span>
      </div>

      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
        {COMPARTIDES_XARXES.map((post) => (
          <div key={post.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 transition-all duration-300 hover:border-fuchsia-900/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {post.xarxa === 'instagram' ? (
                  <div className="p-1.5 rounded-lg bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600">
                    <Instagram size={14} className="text-white" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-blue-600">
                    <Facebook size={14} className="text-white" />
                  </div>
                )}
                <span className="font-sans font-semibold text-xs tracking-tight">{post.usuari}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{post.dataPublicacio}</span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-3 font-sans line-clamp-3">
              {post.text}
            </p>

            {post.imatgeUrl && (
              <div className="rounded-xl overflow-hidden mb-3 relative aspect-[16/9] bg-zinc-900">
                <img 
                  src={post.imatgeUrl} 
                  alt="Post social" 
                  className="object-cover w-full h-full hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-zinc-500 text-[11px] font-mono">
              <div className="flex gap-4">
                <span className="flex items-center gap-1 hover:text-fuchsia-400 transition-colors cursor-pointer">
                  <Heart size={12} className="text-red-500 fill-red-500" /> {post.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={12} /> Comentat
                </span>
              </div>
              <a 
                href={post.enllacUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-0.5 text-fuchsia-400 hover:underline"
              >
                Veure post <ExternalLink size={10} />
              </a>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 font-mono text-center mt-4">
        Sincronització en temps real via Webhooks de Meta activa
      </p>
    </div>
  );
}
