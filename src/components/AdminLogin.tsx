/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, User, AlertCircle, ArrowLeft, Eye, EyeOff, Sparkle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface AdminLoginProps {
  onLoginSuccess: (rememberMe: boolean) => void;
  onBackToPublic: () => void;
}

export default function AdminLogin({ onLoginSuccess, onBackToPublic }: AdminLoginProps) {
  const { language } = useLanguage();
  
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('tast_remember_me_enabled') === 'true';
  });

  const [username, setUsername] = useState(() => {
    const r = localStorage.getItem('tast_remember_me_enabled') === 'true';
    return r ? (localStorage.getItem('tast_saved_username') || '') : '';
  });
  const [password, setPassword] = useState(() => {
    const r = localStorage.getItem('tast_remember_me_enabled') === 'true';
    return r ? (localStorage.getItem('tast_saved_password') || '') : '';
  });

  const [errorError, setErrorError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const isEnabled = localStorage.getItem('tast_remember_me_enabled') === 'true';
    if (isEnabled) {
      const savedUser = localStorage.getItem('tast_saved_username') || '';
      const savedPass = localStorage.getItem('tast_saved_password') || '';
      if (savedUser && !username) setUsername(savedUser);
      if (savedPass && !password) setPassword(savedPass);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorError(language === 'ca' 
        ? "Si us plau, introduïu l'usuari i la contrasenya." 
        : "Por favor, introduzca el usuario y la contraseña.");
      return;
    }

    setIsVerifying(true);
    setErrorError(null);

    // Simulate delay
    setTimeout(() => {
      // Accepting 'admin'/'admin' or 'tast'/'tast' or 'Tastvng@gmail.com'/'tast'
      let isValid = (username === 'admin' && password === 'admin') || 
                    (username === 'tast' && password === 'tast') ||
                    (username.toLowerCase() === 'tastvng@gmail.com' && password === 'tast') ||
                    (username === 'secretaria' && password === 'eltast2026');

      // Direct lookup from manually added staff profiles
      try {
        const savedStaff = localStorage.getItem('tast_staff_2026');
        if (savedStaff) {
          const staffList = JSON.parse(savedStaff);
          const found = staffList.find((s: any) => 
            (s.usuari.toLowerCase() === username.toLowerCase() || s.nom.toLowerCase() === username.toLowerCase()) && 
            s.contrasenya === password && 
            s.actiu !== false
          );
          if (found) {
            isValid = true;
          }
        }
      } catch (e) {
        console.error("Error verifying dynamic staff credentials:", e);
      }

      setIsVerifying(false);
      if (isValid) {
        if (rememberMe) {
          localStorage.setItem('tast_remember_me_enabled', 'true');
          localStorage.setItem('tast_saved_username', username);
          localStorage.setItem('tast_saved_password', password);
        } else {
          localStorage.setItem('tast_remember_me_enabled', 'false');
          localStorage.removeItem('tast_saved_username');
          localStorage.removeItem('tast_saved_password');
        }
        onLoginSuccess(rememberMe);
      } else {
        setErrorError(language === 'ca'
          ? "L'usuari o la contrasenya no són correctes. Proveu amb credencials vàlides de secretaria."
          : "El usuario o la contraseña no son correctos. Pruebe con credenciales válidas de secretaría.");
      }
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <span className="text-[10px] bg-zinc-900 text-fuchsia-400 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono border border-zinc-800">
          {language === 'ca' ? 'Àrea Administrativa Protegida' : 'Área Administrativa Protegida'}
        </span>
        <h1 className="font-sans font-black text-3xl text-zinc-900 tracking-tight mt-3">
          {language === 'ca' ? 'Entrada Secretaria' : 'Entrada Secretaría'}
        </h1>
        <p className="text-zinc-500 text-xs mt-1">
          {language === 'ca'
            ? 'Inicieu sessió per validar DNIs, comprovar cobraments i lliurar material.'
            : 'Inicie sesión para validar DNIs, comprobar cobros y entregar material.'}
        </p>
      </div>

      <motion.div 
         initial={{ y: 15, opacity: 0 }}
         animate={{ y: 0, opacity: 1 }}
         className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 text-zinc-900 pointer-events-none -mr-4 -mt-4">
          <Sparkle size={100} className="stroke-[0.5]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errorError && (
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }}
               className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3.5 rounded-xl flex gap-1.5 items-start font-sans leading-relaxed"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorError}</span>
            </motion.div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono mb-1.5">
              {language === 'ca' ? 'Usuari o Correu *' : 'Usuario o Correo *'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 pointer-events-none">
                <User size={16} />
              </span>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-fuchsia-500 focus:bg-zinc-900 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all placeholder-zinc-600 font-sans text-white text-left"
                placeholder={language === 'ca' ? "Introduïu el vostre usuari corporatiu" : "Introduzca su usuario corporativo"}
                id="input-login-username"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono mb-1.5">
              {language === 'ca' ? 'Contrasenya *' : 'Contraseña *'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 pointer-events-none">
                <Lock size={16} />
              </span>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-fuchsia-500 focus:bg-zinc-900 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all placeholder-zinc-600 font-sans text-white text-left"
                placeholder={language === 'ca' ? "Introduïu la vostra clau secreta" : "Introduzca su clave secreta"}
                id="input-login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember me toggle */}
          <div className="flex items-center">
            <label className="flex items-center gap-2.5 text-xs text-zinc-400 select-none cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-900 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-fuchsia-600 w-4 h-4"
                id="remember_me_checkbox"
              />
              <span className="group-hover:text-zinc-200 transition-colors">
                {language === 'ca' ? "Recorda'm en aquest dispositiu" : "Recuérdame en este dispositivo"}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-xl shadow-lg shadow-fuchsia-600/25 transition-all text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            id="btn-login-submit"
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                {language === 'ca' ? 'Sincronitzant credencials...' : 'Sincronizando credenciales...'}
              </span>
            ) : (
              language === 'ca' ? "Inicia Sessió" : "Iniciar Sesión"
            )}
          </button>
        </form>
      </motion.div>

      <div className="text-center mt-6">
        <button 
          onClick={onBackToPublic}
          className="text-xs text-zinc-500 hover:text-zinc-800 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          id="btn-back-to-form"
        >
          <ArrowLeft size={12} /> {language === 'ca' ? 'Tornar al Formulari de Parella' : 'Volver al Formulario de Pareja'}
        </button>
      </div>
    </div>
  );
}
