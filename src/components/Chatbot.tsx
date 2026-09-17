import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  HelpCircle,
  Mail,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { getEntityConfigSync } from '../utils/entityConfig';

export interface ChatbotProps {
  language: 'ca' | 'es';
  activeYear?: string;
  className?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
}

const MAX_SESSION_MESSAGES = 20;

export const Chatbot: React.FC<ChatbotProps> = ({
  language = 'ca',
  activeYear,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiErrorOccurred, setAiErrorOccurred] = useState(false);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCa = language === 'ca';
  const entityInfo = getEntityConfigSync(language === 'es' ? 'es' : 'ca');

  // Initialize or restore conversation
  useEffect(() => {
    const sessionKey = `tast_chat_history_${language}`;
    const saved = sessionStorage.getItem(sessionKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (e) {
        // Ignore JSON error
      }
    }

    // Default welcoming message
    const initialWelcome: ChatMessage = {
      id: 'welcome-1',
      role: 'assistant',
      content: isCa
        ? `Hola! 👋 Sóc l'assistent virtual de **El Tast**. Et puc resoldre qualsevol dubte sobre la inscripció, categories d'adults i juvenils, preus, talles, materials, llista d'espera, recollida de mocadors, pagaments i la seu social. En què et puc ajudar?`
        : `¡Hola! 👋 Soy el asistente virtual de **El Tast**. Te puedo resolver cualquier duda sobre la inscripción, categorías de adultos y juveniles, precios, tallas, materiales, lista de espera, recogida de pañuelos, pagos y la sede social. ¿En qué te puedo ayudar?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([initialWelcome]);
  }, [language, isCa]);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      const sessionKey = `tast_chat_history_${language}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(messages));
    }
  }, [messages, language]);

  // Autoscroll to bottom when messages change or while loading
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleClearHistory = () => {
    const initialWelcome: ChatMessage = {
      id: 'welcome-' + Date.now(),
      role: 'assistant',
      content: isCa
        ? `S'ha reiniciat la conversa. 👋 En què et puc ajudar sobre El Tast?`
        : `Se ha reiniciado la conversación. 👋 ¿En qué te puedo ayudar sobre El Tast?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([initialWelcome]);
    setAiErrorOccurred(false);
    setLastFailedQuery(null);
    const sessionKey = `tast_chat_history_${language}`;
    sessionStorage.removeItem(sessionKey);
  };

  const userMessagesCount = messages.filter(m => m.role === 'user').length;
  const isLimitReached = userMessagesCount >= MAX_SESSION_MESSAGES;

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend || inputValue;
    const text = rawText.trim();
    if (!text || isLoading || isLimitReached) return;

    setInputValue('');
    setAiErrorOccurred(false);

    // If retrying, remove the previous error message if present at the end of history
    const baseHistory = messages.filter((m, idx) => !(m.isError && idx === messages.length - 1));

    // Avoid duplicate user message bubble if retrying the same last message
    const lastMsg = baseHistory[baseHistory.length - 1];
    let newHistory = baseHistory;
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== text) {
      const userMsg: ChatMessage = {
        id: 'usr-' + Date.now(),
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      newHistory = [...baseHistory, userMsg];
    }

    setMessages(newHistory);
    setIsLoading(true);

    try {
      // Map history for Gemini API
      const formattedTurns = newHistory.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          messages: formattedTurns,
          language
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data.message || data.error || `HTTP error ${res.status}`);
      }

      const reply = data.answer || data.reply || (isCa ? "No tinc aquesta informació. Contacta amb l'entitat." : "No tengo esa información. Contacta con la entidad.");

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
      setLastFailedQuery(null);
      setAiErrorOccurred(false);
    } catch (err) {
      console.warn("[Chatbot] Request failed:", err);
      setLastFailedQuery(text);
      setAiErrorOccurred(true);
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        isError: true,
        content: isCa
          ? "El servei d'intel·ligència artificial no està disponible en aquest moment. Pots consultar les preguntes freqüents a continuació o utilitzar el botó de reintentar."
          : "El servicio de inteligencia artificial no está disponible en este momento. Puedes consultar las preguntas frecuentes a continuación o utilizar el botón de reintentar.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Quick suggestion chips
  const quickSuggestions = isCa
    ? [
        { label: "💰 Preus i categories", query: "Quins són els preus i les categories de la parella?" },
        { label: "📍 On i quan recollir mocadors?", query: "On i quan es recullen els mocadors i materials?" },
        { label: "⏳ Com funciona la llista d'espera?", query: "Com funciona la llista d'espera i quan s'ha de pagar?" },
        { label: "🪪 Documentació i DNI", query: "Quina documentació i DNI cal aportar a la inscripció?" },
        { label: "👕 Talles de vestuari", query: "Quines talles d'armilles o samarretes hi ha disponibles?" }
      ]
    : [
        { label: "💰 Precios y categorías", query: "¿Cuáles son los precios y las categorías de la pareja?" },
        { label: "📍 ¿Dónde y cuándo recoger pañuelos?", query: "¿Dónde y cuándo se recogen los pañuelos y materiales?" },
        { label: "⏳ ¿Cómo funciona la lista de espera?", query: "¿Cómo funciona la lista de espera y cuándo se debe pagar?" },
        { label: "🪪 Documentación y DNI", query: "¿Qué documentación y DNI es necesario aportar en la inscripción?" },
        { label: "👕 Tallas de vestuario", query: "¿Qué tallas de chalecos o camisetas hay disponibles?" }
      ];

  // Static FAQ fallback items for when AI is unavailable
  const fallbackFaqs = isCa
    ? [
        {
          q: "Quins són els preus d'inscripció?",
          a: "Parella Adulta (majors de 18 anys): 130 € per parella (inclou 2 mocadors oficials i acreditació). Parella Juvenil (14 a 17 anys amb autorització): 95 € per parella. Domàs de balcó: 20 €. Mocadors addicionals: 6 €."
        },
        {
          q: "On i quan es recullen els materials?",
          a: `A la seu social de l'entitat (${entityInfo.direccio}). Horari d'atenció: ${entityInfo.horari}. La recollida requereix tenir el pagament confirmat i el DNI validat.`
        },
        {
          q: "Quina documentació cal adjuntar?",
          a: "El DNI/NIE o passaport de tots dos membres de la parella. En cas de menors (categoria juvenil), s'ha d'indicar el tutor/a legal i aportar la seva autorització signada."
        },
        {
          q: "Com funciona la llista d'espera?",
          a: "Si les places s'esgoten, s'assigna automàticament un codi de llista d'espera (LE...). No s'ha de pagar res fins que Secretaria confirmi una vacant i us assigni número oficial."
        },
        {
          q: "Quines formes de pagament s'accepten?",
          a: "Efectiu directament a la seu social en horari d'atenció o Bizum si està habilitat per l'entitat."
        }
      ]
    : [
        {
          q: "¿Cuáles son los precios de inscripción?",
          a: "Pareja Adulta (mayores de 18 años): 130 € por pareja (incluye 2 pañuelos oficiales y acreditación). Pareja Juvenil (14 a 17 años con autorización): 95 € por pareja. Balcón domás: 20 €. Pañuelos adicionales: 6 €."
        },
        {
          q: "¿Dónde y cuándo se recogen los materiales?",
          a: `En la sede social de la entidad (${entityInfo.direccio}). Horario de atención: ${entityInfo.horari}. La recogida requiere tener el pago confirmado y el DNI validado.`
        },
        {
          q: "¿Qué documentación es necesario adjuntar?",
          a: "El DNI/NIE o pasaporte de ambos miembros de la pareja. En caso de menores (categoría juvenil), se debe indicar el tutor/a legal y aportar su autorización firmada."
        },
        {
          q: "¿Cómo funciona la lista de espera?",
          a: "Si las plazas se agotan, se asigna automáticamente un código de lista de espera (LE...). No se debe pagar nada hasta que Secretaría confirme una vacante y os asigne número oficial."
        },
        {
          q: "¿Qué formas de pago se aceptan?",
          a: "Efectivo directamente en la sede social en horario de atención o Bizum si está habilitado por la entidad."
        }
      ];

  // Helper to render basic markdown formatting (*bold*, lists, line breaks)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bold handling
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-stone-300 my-0.5 leading-relaxed">
            {renderedLine}
          </li>
        );
      }

      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <div key={idx} className="ml-2 font-medium text-stone-200 my-1">
            {renderedLine}
          </div>
        );
      }

      return (
        <p key={idx} className={`${line.trim() === '' ? 'h-2' : 'my-1'} leading-relaxed`}>
          {renderedLine}
        </p>
      );
    });
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          id="btn-open-chatbot"
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 bg-stone-900/95 hover:bg-stone-800 text-white rounded-full shadow-2xl border-2 border-[#ff0090]/70 hover:border-[#ff0090] transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#ff0090]/50"
          aria-label={isCa ? "Obrir assistent d'ajuda" : "Abrir asistente de ayuda"}
        >
          <div className="relative flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-[#ff0090] transition-transform duration-200 group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <span className="font-bold text-sm tracking-wide text-stone-100">
            {isCa ? 'Ajuda' : 'Ayuda'}
          </span>
        </button>
      )}

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div
          id="chatbot-window"
          className="fixed inset-x-3 bottom-3 sm:inset-auto sm:right-6 sm:bottom-6 w-auto sm:w-[410px] max-h-[85vh] h-[560px] flex flex-col bg-stone-950/98 backdrop-blur-xl border border-stone-800 rounded-2xl shadow-2xl overflow-hidden z-50 text-stone-200 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
          role="dialog"
          aria-modal="true"
          aria-label={isCa ? "Finestra d'ajuda El Tast" : "Ventana de ayuda El Tast"}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-stone-900 via-stone-900 to-stone-950 border-b border-stone-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#ff0090]/20 border border-[#ff0090]/50 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#ff0090]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white truncate">
                    {isCa ? 'Assistent El Tast' : 'Asistente El Tast'}
                  </h3>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" title={isCa ? "En línia" : "En línea"}></span>
                </div>
                <p className="text-[11px] text-stone-400 truncate">
                  {isCa ? 'Inscripcions i Comparses' : 'Inscripciones y Comparsas'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="btn-clear-chat-history"
                type="button"
                onClick={handleClearHistory}
                title={isCa ? "Reiniciar conversa" : "Reiniciar conversación"}
                className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-800/80 rounded-lg transition-colors"
                aria-label={isCa ? "Reiniciar conversa" : "Reiniciar conversación"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                id="btn-close-chatbot"
                type="button"
                onClick={() => setIsOpen(false)}
                title={isCa ? "Tancar" : "Cerrar"}
                className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800/80 rounded-lg transition-colors"
                aria-label={isCa ? "Tancar xat d'ajuda" : "Cerrar chat de ayuda"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-stone-700">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-sm ${
                      isUser
                        ? 'bg-[#ff0090] text-white rounded-tr-xs'
                        : m.isError
                        ? 'bg-rose-950/40 border border-rose-900/60 text-rose-200 rounded-tl-xs'
                        : 'bg-stone-900/90 border border-stone-800 text-stone-200 rounded-tl-xs'
                    }`}
                  >
                    {renderFormattedText(m.content)}
                    {m.isError && lastFailedQuery && (
                      <div className="mt-2.5 pt-2 border-t border-rose-800/40 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-rose-300/80 italic">
                          {isCa ? 'Vols tornar a provar?' : '¿Deseas volver a probar?'}
                        </span>
                        <button
                          id="btn-retry-chat"
                          type="button"
                          onClick={() => handleSendMessage(lastFailedQuery)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-800 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{isCa ? 'Reintentar' : 'Reintentar'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1 px-1">
                    {m.timestamp}
                  </span>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-center gap-1.5 bg-stone-900/90 border border-stone-800 text-stone-400 px-3.5 py-2.5 rounded-2xl rounded-tl-xs w-fit">
                <span className="text-xs">{isCa ? 'Consultant dades...' : 'Consultando datos...'}</span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#ff0090] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-[#ff0090] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-[#ff0090] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </span>
              </div>
            )}

            {/* Fallback FAQ & Contact Accordion when AI has error */}
            {aiErrorOccurred && (
              <div className="mt-4 p-3 bg-stone-900/90 border border-stone-800 rounded-xl space-y-3">
                {lastFailedQuery && (
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-800">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider block">
                        {isCa ? 'Última consulta' : 'Última consulta'}
                      </span>
                      <p className="text-xs text-stone-300 font-medium truncate">
                        "{lastFailedQuery}"
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(lastFailedQuery)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff0090]/20 hover:bg-[#ff0090]/30 text-[#ff0090] border border-[#ff0090]/50 rounded-lg text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isCa ? 'Reintentar' : 'Reintentar'}</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{isCa ? 'Preguntes més freqüents (FAQ)' : 'Preguntas más frecuentes (FAQ)'}</span>
                </div>

                <div className="space-y-1.5">
                  {fallbackFaqs.map((faq, fIdx) => (
                    <div key={fIdx} className="border border-stone-800 rounded-lg overflow-hidden bg-stone-950/60">
                      <button
                        type="button"
                        onClick={() => setExpandedFaqIndex(expandedFaqIndex === fIdx ? null : fIdx)}
                        className="w-full flex items-center justify-between p-2 text-left text-xs font-medium text-stone-300 hover:text-white transition-colors"
                      >
                        <span>{faq.q}</span>
                        {expandedFaqIndex === fIdx ? (
                          <ChevronUp className="w-3.5 h-3.5 shrink-0 text-stone-400 ml-1" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-stone-400 ml-1" />
                        )}
                      </button>
                      {expandedFaqIndex === fIdx && (
                        <div className="p-2.5 pt-0 text-[11px] text-stone-400 leading-relaxed border-t border-stone-800/60 bg-stone-900/30">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Direct Contact Button */}
                <div className="pt-2 border-t border-stone-800">
                  <a
                    href={`mailto:${(entityInfo.email && !entityInfo.email.includes('secretaria@') ? entityInfo.email : 'tastvng@gmail.com')}?subject=${encodeURIComponent(isCa ? "Consulta Inscripcions El Tast" : "Consulta Inscripciones El Tast")}`}
                    className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-[#ff0090]/20 hover:bg-[#ff0090]/30 text-[#ff0090] border border-[#ff0090]/40 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isCa ? "Contacta amb l'entitat" : "Contactar con la entidad"}</span>
                  </a>
                  <div className="mt-2 text-[10px] text-stone-400 space-y-0.5 text-center">
                    <p>{entityInfo.direccio}</p>
                    <p>{entityInfo.horari}</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 border-t border-stone-800/80 bg-stone-950/90 overflow-x-auto flex gap-1.5 no-scrollbar">
            {quickSuggestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(q.query)}
                disabled={isLoading || isLimitReached}
                className="whitespace-nowrap px-2.5 py-1 text-[11px] bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 hover:border-stone-700 rounded-full transition-colors disabled:opacity-50 shrink-0"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-stone-900/90 border-t border-stone-800">
            {isLimitReached ? (
              <div className="text-center py-1 text-xs text-amber-400">
                {isCa
                  ? "Has assolit el límit d'aquesta sessió. Pots contactar directament a tastvng@gmail.com."
                  : "Has alcanzado el límite de esta sesión. Puedes contactar directamente a tastvng@gmail.com."}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    id="chatbot-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isCa ? "Escriu la teva consulta sobre El Tast..." : "Escribe tu consulta sobre El Tast..."}
                    maxLength={500}
                    disabled={isLoading}
                    className="w-full bg-stone-950 border border-stone-700/80 focus:border-[#ff0090] focus:ring-1 focus:ring-[#ff0090] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-stone-100 placeholder-stone-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>
                <button
                  id="btn-submit-chat-message"
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 bg-[#ff0090] hover:bg-[#d9007b] active:scale-95 text-white rounded-xl disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 shrink-0 shadow-md"
                  aria-label={isCa ? "Enviar missatge" : "Enviar mensaje"}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Session usage counter & subtle disclaimer */}
            <div className="flex items-center justify-between text-[10px] text-stone-500 mt-2 px-1">
              <span>
                {userMessagesCount}/{MAX_SESSION_MESSAGES} {isCa ? 'consultes' : 'consultas'}
              </span>
              <span className="truncate max-w-[200px]">
                {entityInfo.email && !entityInfo.email.includes('secretaria@') ? entityInfo.email : 'tastvng@gmail.com'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Chatbot;
