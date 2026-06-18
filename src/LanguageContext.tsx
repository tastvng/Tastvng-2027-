/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ca' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ca: {
    // Header
    admin_panel: 'Taulell Admin',
    secretary: 'Secretaria 🔒',
    staff_count: 'Staff Acreditat: {count} membres',
    official_server: 'Iniciant servidor El Tast...',
    // Public Form
    form_title: "Inscripció Oficial de Parelles - El Tast 2026",
    form_subtitle: "Empleneu les dades de tots dos participants de la comparsa",
    couple_category: "Categoria de la Parella",
    adult: "Adult (Major de 18 anys)",
    juvenile: "Juvenil (Fins a 17 anys)",
    adult_desc: "Inscripció estàndard per a parelles majors d'edat.",
    juvenile_desc: "Categoria especial per a menors d'edat amb autorització.",
    participant_1: "Participant 1 (Representant / Cap de Parella)",
    participant_1_desc: "Aquesta persona rebrà les notificacions oficials i del pagament.",
    participant_2: "Participant 2 (Acompanyant)",
    participant_2_desc: "Dades de la segona persona integrant de la parella.",
    first_name: "Nom",
    last_name: "Cognoms",
    email: "Correu Electrònic",
    phone: "Telèfon de Contacte",
    t_shirt_size: "Talla de Samarreta",
    dni_doc: "Document de DNI / NIE / Passaport (Cara o revers)",
    dni_help: "Pugeu una foto o feu-la amb la càmera per a la verificació oficial d'edat permesa.",
    upload_dni: "Pujar DNI",
    take_photo: "Fer Foto amb Càmera",
    change_dni: "Canviar document",
    document_uploaded: "Document adjuntat correctament",
    extras_title: "Complements Oficials del Festival (Opcional)",
    domas: "Cànon Domàs de Balcó oficial (+{price}€)",
    domas_desc: "Guarniment fúcsia tradicional d'El Tast per penjar al balcó durant els dies de comparsa.",
    mocadors_extra: "Mocadors de festa addicionals del Tast",
    mocadors_desc: "Mocadors corporatius fúcsia extras amb escut brodat de l'edició 2026.",
    accept_rgpd: "Accepto la política de privacitat, condicions i el tractament de dades d'acord amb el RGPD de l'entitat.",
    accept_presence: "Confirmo que sóc conscient de la necessitat de presentar-me de manera presencial amb el DNI físic per al lliurament dels dossiers i armilles.",
    total_price: "Preu de la Inscripció i Detall de Pagament",
    base_price_label: "Inscripció Base Parella ({category})",
    domas_extra_label: "Guarniment Domàs de Balcó",
    mocadors_extra_label: "Mocadors extra de col·lecció ({count} unitats)",
    total_to_pay: "Total a liquidar (IVA Inclòs)",
    submit_btn: "Inscriure la Parella i Pagar",
    submitting: "Processant registre de parella...",
    error_validation: "Si us plau, revisa els errors del formulari abans de continuar.",
    required_field: "Aquest camp és obligatori",
    invalid_email: "Correu electrònic no vàlid",
    invalid_phone: "El telèfon ha de tenir 9 dígits",
    required_dni: "Cal adjuntar o capturar el DNI per comprovar l'edat",
    required_checkboxes: "Heu d'acceptar les condicions del Tast i del RGPD",
    // Notification Feed
    feed_title: "Canal d'Avisos i Mitjans",
    feed_subtitle: "Comunicacions Oficials El Tast",
    verified: "Oficial i verificat",
    external_link: "Enllaç extern",
    urgent: "URGENT",
    no_news: "No hi ha avisos ni recursos de mitjans en aquest moment.",
    certified_news: "Canal d'atenció integral i actualitat certificada",
    external_video: "Enllaç de vídeo extern",
    // Confirmation screen
    conf_title: "Preinscripció Completada!",
    conf_subtitle: "El vostre registre de parella s'ha generat correctament en el sistema",
    conf_desc: "Heu rebut un correu electrònic amb les instruccions. Conserveu i copieu el vostre codi confidencial per ensenyar-lo a secretaria:",
    conf_important: "IMPORTANT: S'ha de presentar aquest codi de seguiment juntament amb el DNI físic a la seu social d'El Tast per validar oficialment la idoneïtat de la parella i recollir el dorsal de comparsa i les armilles.",
    back_btn: "Tornar al formulari principal",
    payment_status: "Estat del Pagament",
    payment_pending: "PENDENT DE LIQUIDAR A TAULA",
    registered_at: "Data de registre",
    sec_code: "Codi de Seguretat",
    // Side help widget
    help_title: "Necessites ajuda amb la inscripció?",
    help_desc_1: "El lliurament de dorsals i armilles oficials tindrà lloc a la seu de l'Associació el proper mes.",
    help_desc_2: "Per a dubtes urgents sobre formularis o pagaments de grups, podeu contactar amb la junta directiva."
  },
  es: {
    // Header
    admin_panel: 'Tablero Admin',
    secretary: 'Secretaría 🔒',
    staff_count: 'Staff Acreditado: {count} miembros',
    official_server: 'Iniciando servidor El Tast...',
    // Public Form
    form_title: "Inscripción Oficial de Parejas - El Tast 2026",
    form_subtitle: "Rellene los datos de ambos participantes de la comparsa",
    couple_category: "Categoría de la Pareja",
    adult: "Adulto (Mayor de 18 años)",
    juvenile: "Juvenil (Hasta 17 años)",
    adult_desc: "Inscripción estándar para parejas mayores de edad.",
    juvenile_desc: "Categoría especial para menores de edad con autorización.",
    participant_1: "Participante 1 (Representante / Cabeza de Pareja)",
    participant_1_desc: "Esta persona recibirá las notificaciones oficiales y del pago.",
    participant_2: "Participante 2 (Acompañante)",
    participant_2_desc: "Datos de la segunda persona integrante de la pareja.",
    first_name: "Nombre",
    last_name: "Apellidos",
    email: "Correo Electrónico",
    phone: "Teléfono de Contacto",
    t_shirt_size: "Talla de Camiseta",
    dni_doc: "Documento de DNI / NIE / Pasaporte (Cara o reverso)",
    dni_help: "Suba una foto o hágala con la cámara para la verificación oficial de edad permitida.",
    upload_dni: "Subir DNI",
    take_photo: "Hacer Foto con Cámara",
    change_dni: "Cambiar documento",
    document_uploaded: "Documento adjuntado correctamente",
    extras_title: "Complementos Oficiales del Festival (Opcional)",
    domas: "Canon Colgadura de Balcón oficial (+{price}€)",
    domas_desc: "Decoración fucsia tradicional de El Tast para colgar en el balcón durante los días de comparsa.",
    mocadors_extra: "Pañuelos de fiesta adicionales de El Tast",
    mocadors_desc: "Pañuelos corporativos fucsia extras con escudo bordado de la edición 2026.",
    accept_rgpd: "Acepto la política de privacidad, condiciones y el tratamiento de datos de acuerdo con el RGPD de la entidad.",
    accept_presence: "Confirmo que soy consciente de la necesidad de presentarme de manera presencial con el DNI físico para la entrega de dossiers y chalecos.",
    total_price: "Precio de la Inscripción y Detalle de Pago",
    base_price_label: "Inscripción Base Pareja ({category})",
    domas_extra_label: "Colgadura de Balcón Decorativa",
    mocadors_extra_label: "Pañuelos extra de colección ({count} unidades)",
    total_to_pay: "Total a liquidar (IVA Incluido)",
    submit_btn: "Inscribir la Pareja y Pagar",
    submitting: "Procesando registro de pareja...",
    error_validation: "Por favor, revise los errores del formulario antes de continuar.",
    required_field: "Este campo es obligatorio",
    invalid_email: "Correo electrónico no válido",
    invalid_phone: "El teléfono debe tener 9 dígitos",
    required_dni: "Es necesario adjuntar o capturar el DNI para comprobar la edad",
    required_checkboxes: "Debe aceptar las condiciones de El Tast y del RGPD",
    // Notification Feed
    feed_title: "Canal de Avisos y Medios",
    feed_subtitle: "Comunicaciones Oficiales El Tast",
    verified: "Oficial y verificado",
    external_link: "Enlace externo",
    urgent: "URGENTE",
    no_news: "No hay avisos ni recursos de medios en este momento.",
    certified_news: "Canal de atención integral y actualidad certificada",
    external_video: "Enlace de video externo",
    // Confirmation screen
    conf_title: "¡Preinscripción Completada!",
    conf_subtitle: "Vuestro registro de pareja se ha generado correctamente en el sistema",
    conf_desc: "Habéis recibido un correo electrónico con las instrucciones. Conservad y copiad vuestro código confidencial para enseñarlo en secretaría:",
    conf_important: "IMPORTANTE: Se debe presentar este código de seguimiento junto con el DNI físico en la sede social de El Tast para validar oficialmente la idoneidad de la pareja y recoger el dorsal de comparsa y los chalecos.",
    back_btn: "Volver al formulario principal",
    payment_status: "Estado del Pago",
    payment_pending: "PENDIENTE DE LIQUIDAR EN MESA",
    registered_at: "Fecha de registro",
    sec_code: "Código de Seguridad",
    // Side help widget
    help_title: "¿Necesitas ayuda con la inscripción?",
    help_desc_1: "La entrega de dorsales y chalecos oficiales tendrá lugar en la sede de la Asociación el próximo mes.",
    help_desc_2: "Para dudas urgentes sobre formularios o pagos de grupos, podéis contactar con la junta directiva."
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('tast_idioma_2026');
      if (saved === 'es' || saved === 'ca') {
        return saved;
      }
    } catch (e) {
      console.error(e);
    }
    return 'ca';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('tast_idioma_2026', lang);
    } catch (e) {
      console.error(e);
    }
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let text = translations[language]?.[key] || translations['ca']?.[key] || key;
    
    // Automatically replace "El Tast 2026" or "Comparses 2026" or edit references with the single source of truth
    const evName = localStorage.getItem('tast_nom_esdeveniment') || '';
    if (evName) {
      text = text.replace(/El Tast 2026/g, evName);
      text = text.replace(/Comparses 2026/g, evName);
      text = text.replace(/l'edició 2026/g, evName);
      text = text.replace(/la edición 2026/g, evName);
    }

    if (replacements) {
      Object.entries(replacements).forEach(([k, val]) => {
        text = text.replace(`{${k}}`, String(val));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
