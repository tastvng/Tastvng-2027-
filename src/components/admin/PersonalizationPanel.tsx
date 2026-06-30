import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import ColorInput from './inputs/ColorInput';
import TextInput from './inputs/TextInput';
import FileUpload from './inputs/FileUpload';
import FormSection from './inputs/FormSection';
import PreviewBox from './PreviewBox';
import { Save, RotateCcw, HelpCircle } from 'lucide-react';

export const PERSONALIZATION_SCHEMA = {
  colores: {
    title: 'Colors / Colores',
    icon: '🎨',
    description: 'Personalitza els colors de l\'aplicació / Personaliza los colores de la aplicación',
    fields: [
      {
        id: 'primario',
        label: 'Color Principal',
        type: 'color',
        description: 'Color principal per a botons i capçaleres / Color principal de botones y encabezados',
        required: true,
        default: '#ff0090'
      },
      {
        id: 'secundario',
        label: 'Color Secundario',
        type: 'color',
        description: 'Color secundari per a accents / Color secundario para acentos',
        required: true,
        default: '#f7931e'
      },
      {
        id: 'fondo',
        label: 'Color de Fondo',
        type: 'color',
        description: 'Color de fons de l\'aplicació / Color de fondo de la aplicación',
        required: false,
        default: '#ffffff'
      }
    ]
  },
  evento: {
    title: 'Event / Evento',
    icon: '🎭',
    description: 'Informació visible de l\'esdeveniment / Información visible del evento',
    fields: [
      {
        id: 'nombre',
        label: 'Nom de l\'Esdeveniment / Nombre del Evento',
        type: 'text',
        description: 'Nom visible a tota l\'aplicació / Nombre visible en toda la aplicación',
        required: true,
        placeholder: 'Ej: Carnaval 2026',
        default: 'Carnaval 2026'
      },
      {
        id: 'any_edicio',
        label: 'Any de l\'Edició / Año de la Edición',
        type: 'text',
        description: 'Any de referència central (ex: 2026) / Año de referencia central (ej: 2026)',
        required: true,
        placeholder: 'Ej: 2026',
        default: '2026'
      },
      {
        id: 'descripcion',
        label: 'Descripció / Descripción',
        type: 'textarea',
        description: 'Breu text de benvinguda al web / Breve texto de bienvenida en la web',
        required: false,
        placeholder: 'Ej: Celebra con nosotros...',
        default: 'Inscripcions oficials per a la Comparsa El Tast'
      },
      {
        id: 'email',
        label: 'Email de Contacte / Email de Contacto',
        type: 'email',
        description: 'Email de suport de l\'organització / Email de soporte de la organización',
        required: false,
        placeholder: 'info@tast.cat',
        default: 'info@tastvng.cat'
      },
      {
        id: 'direccio',
        label: 'Direcció / Dirección',
        type: 'text',
        description: 'Adreça física de l\'esdeveniment / Dirección física del evento',
        required: false,
        placeholder: 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú',
        default: 'Plaça Soler i Carbonell, 28, Vilanova i la Geltrú'
      }
    ]
  },
  correu: {
    title: 'Correu / Correo',
    icon: '✉️',
    description: 'Configuració del correu de confirmació / Configuración del correo de confirmación',
    fields: [
      {
        id: 'subject_ca',
        label: 'Assumpte (CA)',
        type: 'text',
        description: 'Assumpte del correu en català / Asunto del correo en catalán',
        required: true,
        default: "🎟️ El Tast Comparses 2026 - Confirmació d'Inscripció"
      },
      {
        id: 'subject_es',
        label: 'Asunto (ES)',
        type: 'text',
        description: 'Asunto del correo en castellano / Asunto del correo en castellano',
        required: true,
        default: "🎟️ El Tast Comparses 2026 - Confirmación de Inscripción"
      },
      {
        id: 'body_ca',
        label: 'Cos del Correu (CA)',
        type: 'textarea',
        description: 'Text del missatge en català / Texto del mensaje en catalán',
        required: true,
        default: "S'ha generat correctament el vostre comprovant per a les comparses 2026."
      },
      {
        id: 'body_es',
        label: 'Cuerpo del Correo (ES)',
        type: 'textarea',
        description: 'Cuerpo del correo en castellano / Cuerpo del correo en castellano',
        required: true,
        default: "Se ha generado correctamente vuestro comprobante para las comparsas 2026."
      }
    ]
  },
  secretaria: {
    title: 'Horaris / Horarios',
    icon: '🕒',
    description: 'Horaris d\'atenció al públic / Horarios de atención al público',
    fields: [
      {
        id: 'hours_ca',
        label: 'Horaris (CA)',
        type: 'textarea',
        description: 'Horaris de secretaria en català / Horarios de secretaría en catalán',
        required: true,
        default: "Dimecres i divendres, de 18:00h a 21:30h directament a la seu social de l'Associació Cultural El Tast."
      },
      {
        id: 'hours_es',
        label: 'Horarios (ES)',
        type: 'textarea',
        description: 'Horarios de secretaría en castellano / Horarios de secretaría en castellano',
        required: true,
        default: "Miércoles y viernes, de 18:00h a 21:30h directamente en la sede social de la Asociación Cultural El Tast."
      }
    ]
  },
  medios: {
    title: 'Imatges / Imágenes',
    icon: '🖼️',
    description: 'Multimèdia corporatiu de l\'esdeveniment / Multimedia corporativo',
    fields: [
      {
        id: 'logo',
        label: 'Logo Principal',
        type: 'file',
        description: 'Logo de l\'organització (PNG/JPG/WEBP, máx 1.5MB) / Logo de la organización',
        required: false,
        default: ''
      },
      {
        id: 'banner',
        label: 'Banner / Portada',
        type: 'file',
        description: 'Imatge de capçalera (PNG/JPG/WEBP, máx 1.5MB) / Imagen de portada',
        required: false,
        default: ''
      }
    ]
  }
};

interface PersonalizationConfig {
  [section: string]: {
    [field: string]: string;
  };
}

interface PersonalizationPanelProps {
  onAddLog?: (txt: string) => void;
}

export default function PersonalizationPanel({ onAddLog }: PersonalizationPanelProps) {
  const { language } = useLanguage();
  const [config, setConfig] = useState<PersonalizationConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('colores');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // 1. Initialize schemas with hardcoded default values
      const defaults = Object.entries(PERSONALIZATION_SCHEMA).reduce(
        (acc, [section, sectionData]) => ({
          ...acc,
          [section]: Object.fromEntries(
            sectionData.fields.map(f => [f.id, f.default || ''])
          )
        }),
        {}
      ) as PersonalizationConfig;

      const { isSupabaseConfigured, getSupabaseSetting, supabase } = await import('../../supabaseClient');
      
      let dbConfig: any = null;

      if (isSupabaseConfigured) {
        // Load settings from local storage or from Supabase settings table if configured
        try {
          dbConfig = await getSupabaseSetting<any>('personalizacion', null);
          if (typeof dbConfig === 'string') {
            dbConfig = JSON.parse(dbConfig);
          }
        } catch (e) {
          console.warn('Could not load parsed personalizacion setting, trying direct fallback:', e);
        }

        // Direct table select as fallback
        if (!dbConfig && supabase) {
          try {
            const { data } = await supabase
              .from('sistema_config')
              .select('value')
              .eq('key', 'personalizacion')
              .single();
            if (data?.value) {
              dbConfig = JSON.parse(data.value);
            }
          } catch (err) {
            console.warn('Direct fallback read of table sistema_config failed:', err);
          }
        }

        // Load individual live/legacy values from database to ensure high-fidelity overrides
        const legacyName = await getSupabaseSetting<string>('tast_nom_esdeveniment', '');
        const legacyAny = await getSupabaseSetting<string>('tast_any_edicio', '2026');
        const legacyDir = await getSupabaseSetting<string>('tast_direccio_esdeveniment', '');
        const legacyLogo = await getSupabaseSetting<string>('tast_email_logo', '');
        const legacySubCa = await getSupabaseSetting<string>('tast_email_subject_ca', '');
        const legacySubEs = await getSupabaseSetting<string>('tast_email_subject_es', '');
        const legacyBdyCa = await getSupabaseSetting<string>('tast_email_body_ca', '');
        const legacyBdyEs = await getSupabaseSetting<string>('tast_email_body_es', '');
        const legacyHrsCa = await getSupabaseSetting<string>('tast_secretaria_hours_ca', '');
        const legacyHrsEs = await getSupabaseSetting<string>('tast_secretaria_hours_es', '');

        // Apply loaded values over defaults
        const mergedConfig = { ...defaults };
        if (dbConfig) {
          Object.keys(PERSONALIZATION_SCHEMA).forEach((section) => {
            if (dbConfig[section]) {
              mergedConfig[section] = {
                ...mergedConfig[section],
                ...dbConfig[section]
              };
            }
          });
        }

        // Override with legacy settings to guarantee consistency across all active app views
        if (legacyName) mergedConfig.evento.nombre = legacyName;
        if (legacyAny) {
          mergedConfig.evento.any_edicio = legacyAny;
          localStorage.setItem('tast_any_edicio', legacyAny);
        }
        if (legacyDir) mergedConfig.evento.direccio = legacyDir;
        if (legacyLogo) mergedConfig.medios.logo = legacyLogo;
        if (legacySubCa) mergedConfig.correu.subject_ca = legacySubCa;
        if (legacySubEs) mergedConfig.correu.subject_es = legacySubEs;
        if (legacyBdyCa) mergedConfig.correu.body_ca = legacyBdyCa;
        if (legacyBdyEs) mergedConfig.correu.body_es = legacyBdyEs;
        if (legacyHrsCa) mergedConfig.secretaria.hours_ca = legacyHrsCa;
        if (legacyHrsEs) mergedConfig.secretaria.hours_es = legacyHrsEs;

        setConfig(mergedConfig);
      } else {
        // Fallback to local storage if supabase is not available
        const localConfigStr = localStorage.getItem('personalizacion');
        if (localConfigStr) {
          setConfig(JSON.parse(localConfigStr));
        } else {
          // Individual legacy items fallback
          const localName = localStorage.getItem('tast_nom_esdeveniment');
          const localAny = localStorage.getItem('tast_any_edicio');
          const localDir = localStorage.getItem('tast_direccio_esdeveniment');
          const localLogo = localStorage.getItem('tast_email_logo');
          const localSubCa = localStorage.getItem('tast_email_subject_ca');
          const localSubEs = localStorage.getItem('tast_email_subject_es');
          const localBdyCa = localStorage.getItem('tast_email_body_ca');
          const localBdyEs = localStorage.getItem('tast_email_body_es');
          const localHrsCa = localStorage.getItem('tast_secretaria_hours_ca');
          const localHrsEs = localStorage.getItem('tast_secretaria_hours_es');

          if (localName) defaults.evento.nombre = localName;
          if (localAny) defaults.evento.any_edicio = localAny;
          if (localDir) defaults.evento.direccio = localDir;
          if (localLogo) defaults.medios.logo = localLogo;
          if (localSubCa) defaults.correu.subject_ca = localSubCa;
          if (localSubEs) defaults.correu.subject_es = localSubEs;
          if (localBdyCa) defaults.correu.body_ca = localBdyCa;
          if (localBdyEs) defaults.correu.body_es = localBdyEs;
          if (localHrsCa) defaults.secretaria.hours_ca = localHrsCa;
          if (localHrsEs) defaults.secretaria.hours_es = localHrsEs;

          setConfig(defaults);
        }
      }
    } catch (err) {
      console.error('Error loading config:', err);
      setError(language === 'ca' ? 'Error al carregar la configuració' : 'Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (section: string, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const validateConfig = (): string[] => {
    const errors: string[] = [];
    
    Object.entries(PERSONALIZATION_SCHEMA).forEach(([section, schemaData]) => {
      schemaData.fields.forEach(field => {
        const val = config[section]?.[field.id];
        if (field.required && !val) {
          errors.push(
            language === 'ca' 
              ? `El camp "${field.label.split(' / ')[0]}" és obligatori.`
              : `El campo "${field.label.split(' / ')[1] || field.label}" es requerido.`
          );
        }
        if (field.type === 'email' && val) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            errors.push(
              language === 'ca'
                ? `L'adreça de correu "${val}" no és vàlida.`
                : `La dirección de correo "${val}" no es válida.`
            );
          }
        }
      });
    });

    return errors;
  };

  const saveConfig = async () => {
    setError('');
    setSuccess('');
    
    const errors = validateConfig();
    if (errors.length > 0) {
      setError(errors.join(' | '));
      return;
    }

    setSaving(true);
    try {
      // Store in local storage for instantaneous client-side fallback/HMR updates
      localStorage.setItem('personalizacion', JSON.stringify(config));
      localStorage.setItem('tast_nom_esdeveniment', config.evento?.nombre || '');
      localStorage.setItem('tast_any_edicio', config.evento?.any_edicio || '2026');
      localStorage.setItem('tast_direccio_esdeveniment', config.evento?.direccio || '');
      localStorage.setItem('tast_email_logo', config.medios?.logo || '');
      localStorage.setItem('tast_email_subject_ca', config.correu?.subject_ca || '');
      localStorage.setItem('tast_email_subject_es', config.correu?.subject_es || '');
      localStorage.setItem('tast_email_body_ca', config.correu?.body_ca || '');
      localStorage.setItem('tast_email_body_es', config.correu?.body_es || '');
      localStorage.setItem('tast_secretaria_hours_ca', config.secretaria?.hours_ca || '');
      localStorage.setItem('tast_secretaria_hours_es', config.secretaria?.hours_es || '');

      const { isSupabaseConfigured, saveSupabaseSetting, supabase } = await import('../../supabaseClient');
      
      if (isSupabaseConfigured) {
        // 1. Save unified JSON config under key 'personalizacion'
        await saveSupabaseSetting('personalizacion', config);

        // 2. Save legacy keys individually to maintain 100% retro-compatibility with App.tsx, Confirmation.tsx, etc.
        await saveSupabaseSetting('tast_nom_esdeveniment', config.evento?.nombre || '');
        await saveSupabaseSetting('tast_any_edicio', config.evento?.any_edicio || '2026');
        await saveSupabaseSetting('tast_direccio_esdeveniment', config.evento?.direccio || '');
        await saveSupabaseSetting('tast_email_logo', config.medios?.logo || '');
        await saveSupabaseSetting('tast_email_subject_ca', config.correu?.subject_ca || '');
        await saveSupabaseSetting('tast_email_subject_es', config.correu?.subject_es || '');
        await saveSupabaseSetting('tast_email_body_ca', config.correu?.body_ca || '');
        await saveSupabaseSetting('tast_email_body_es', config.correu?.body_es || '');
        await saveSupabaseSetting('tast_secretaria_hours_ca', config.secretaria?.hours_ca || '');
        await saveSupabaseSetting('tast_secretaria_hours_es', config.secretaria?.hours_es || '');

        // 3. Optional fallback direct table upsert into 'sistema_config'
        if (supabase) {
          try {
            await supabase
              .from('sistema_config')
              .upsert([
                { key: 'personalizacion', value: JSON.stringify(config) }
              ]);
          } catch (e) {
            // Table doesn't exist, safely ignore
          }
        }
      }

      // Dispatch native window events so all active components across the application update in real time
      window.dispatchEvent(new Event('hoursConfigChanged'));
      window.dispatchEvent(new Event('eventDataChanged'));
      window.dispatchEvent(new Event('localStorage'));

      if (onAddLog) {
        onAddLog(`Personalització de l'esdeveniment "${config.evento?.nombre || 'Esdeveniment'}" desada i distribuïda amb èxit.`);
      }

      setSuccess(
        language === 'ca' 
          ? '✅ Configuració general del lloc web desada correctament!' 
          : '✅ ¡Configuración general del sitio web guardada exitosamente!'
      );
      setTimeout(() => setSuccess(''), 4500);
    } catch (err) {
      console.error('Error saving personalization:', err);
      setError(language === 'ca' ? 'Error al desar la configuració' : 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    const confirmMsg = language === 'ca'
      ? 'Esteu segur que voleu restablir els valors per defecte del disseny i informació?'
      : '¿Estás seguro de que quieres restablecer los valores por defecto del diseño e información?';

    if (confirm(confirmMsg)) {
      const defaults = Object.entries(PERSONALIZATION_SCHEMA).reduce(
        (acc, [section, data]) => ({
          ...acc,
          [section]: Object.fromEntries(
            data.fields.map(f => [f.id, f.default || ''])
          )
        }),
        {}
      ) as PersonalizationConfig;
      setConfig(defaults);
      
      setSuccess(
        language === 'ca'
          ? 'Valors per defecte carregats temporalment a la pantalla. Desa per fer-los definitius.'
          : 'Valores por defecto cargados temporalmente en pantalla. Guarda para hacerlos definitivos.'
      );
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
        <div className="h-6 w-6 rounded-full border-2 border-zinc-200 border-t-[#ff0090] animate-spin"></div>
        <p className="text-xs font-mono text-zinc-500">
          {language === 'ca' ? 'Sincronitzant dades de disseny...' : 'Sincronizando datos de diseño...'}
        </p>
      </div>
    );
  }

  const tabKeys = Object.keys(PERSONALIZATION_SCHEMA);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-800 tracking-tight font-sans">
            {language === 'ca' ? 'Personalització de Disseny i Identitat' : 'Personalización de Diseño e Identidad'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl leading-relaxed">
            {language === 'ca' 
              ? 'Gestioneu la identitat corporativa, l\'esdeveniment actiu, colors principals del lloc web, logos i previews interactius.' 
              : 'Gestiona la identidad corporativa, el evento activo, colores principales del sitio web, logotipos y previews interactivos.'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={resetToDefaults}
            disabled={saving}
            className="px-3 py-2 text-[11px] font-bold font-sans border border-zinc-200 text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Restablir"
          >
            <RotateCcw size={13} />
            {language === 'ca' ? 'Defecte' : 'Defecto'}
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 text-[11px] font-bold font-sans text-white rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: config.colores?.primario || '#ff0090' }}
          >
            <Save size={13} />
            {saving 
              ? (language === 'ca' ? 'Desant...' : 'Guardando...') 
              : (language === 'ca' ? 'Desar canvis' : 'Guardar')}
          </button>
        </div>
      </div>

      {/* Grid Layout for Forms and Preview Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Schema dynamic form container */}
        <div className="lg:col-span-7 space-y-5">
          {/* Tabs Navigation */}
          <div className="flex space-x-1 border-b border-zinc-200 pb-0.5 overflow-x-auto scrollbar-none">
            {tabKeys.map((key) => {
              const tabInfo = PERSONALIZATION_SCHEMA[key as keyof typeof PERSONALIZATION_SCHEMA];
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-xs font-bold font-sans transition-all border-b-2 whitespace-nowrap -mb-[2px] flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'border-[#ff0090] text-zinc-800 font-extrabold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-600 font-medium'
                  }`}
                  style={{ borderBottomColor: isActive ? (config.colores?.primario || '#ff0090') : undefined }}
                >
                  <span className="text-sm">{tabInfo.icon}</span>
                  {tabInfo.title.split(' / ')[language === 'ca' ? 0 : 1]}
                </button>
              );
            })}
          </div>

          {/* Form tab panels */}
          <div className="space-y-6">
            {tabKeys.map((key) => {
              if (activeTab !== key) return null;
              const tabInfo = PERSONALIZATION_SCHEMA[key as keyof typeof PERSONALIZATION_SCHEMA];
              return (
                <FormSection
                  key={key}
                  title={tabInfo.title.split(' / ')[language === 'ca' ? 0 : 1]}
                  icon={tabInfo.icon}
                  description={tabInfo.description.split(' / ')[language === 'ca' ? 0 : 1]}
                >
                  {tabInfo.fields.map((field) => (
                    <div key={field.id} className="relative">
                      {field.type === 'color' && (
                        <ColorInput
                          label={field.label}
                          value={config[key]?.[field.id] || ''}
                          onChange={(v) => updateConfig(key, field.id, v)}
                          description={field.description}
                          required={field.required}
                        />
                      )}
                      {field.type === 'text' && (
                        <TextInput
                          label={field.label}
                          value={config[key]?.[field.id] || ''}
                          onChange={(v) => updateConfig(key, field.id, v)}
                          description={field.description}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      )}
                      {field.type === 'email' && (
                        <TextInput
                          label={field.label}
                          type="email"
                          value={config[key]?.[field.id] || ''}
                          onChange={(v) => updateConfig(key, field.id, v)}
                          description={field.description}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      )}
                      {field.type === 'textarea' && (
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-zinc-700 font-sans">
                            {field.label}
                            {field.required && <span className="text-red-500"> *</span>}
                          </label>
                          {field.description && (
                            <p className="text-[11px] text-zinc-500 leading-normal">{field.description}</p>
                          )}
                          <textarea
                            value={config[key]?.[field.id] || ''}
                            onChange={(e) => updateConfig(key, field.id, e.target.value)}
                            placeholder={field.placeholder}
                            rows={4}
                            className="w-full rounded-xl border border-zinc-200 p-3.5 text-xs focus:border-[#ff0090] focus:outline-none transition-all shadow-inner bg-zinc-50/50"
                            required={field.required}
                          />
                        </div>
                      )}
                      {field.type === 'file' && (
                        <FileUpload
                          label={field.label}
                          value={config[key]?.[field.id] || ''}
                          description={field.description}
                          onChange={(v) => updateConfig(key, field.id, v)}
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
                </FormSection>
              );
            })}
          </div>
        </div>

        {/* Live preview box container */}
        <div className="lg:col-span-5 space-y-4">
          <PreviewBox config={config} />
          
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3 shadow-sm">
            <h5 className="text-xs font-bold text-zinc-700 font-sans flex items-center gap-1.5">
              <HelpCircle size={15} className="text-blue-500 shrink-0" />
              {language === 'ca' ? 'Consells d\'edició' : 'Consejos de edición'}
            </h5>
            <ul className="text-[11px] text-zinc-500 space-y-2 list-disc pl-4 leading-relaxed font-sans text-left">
              <li>
                {language === 'ca'
                  ? 'Els canvis s\'apliquen en temps real a la vista prèvia superior.'
                  : 'Los cambios se aplican en tiempo real en la vista previa superior.'}
              </li>
              <li>
                {language === 'ca'
                  ? 'Desa els canvis per persistir-los a la base de dades i actualitzar el web sencer.'
                  : 'Guarda los cambios para persistirlos en la base de datos y actualizar toda la web.'}
              </li>
              <li>
                {language === 'ca'
                  ? 'Utilitza imatges PNG transparents per al logo principal per obtenir millors resultats.'
                  : 'Utiliza imágenes PNG transparentes para el logo principal para mejores resultados.'}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 font-sans shadow-sm text-left">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 font-sans shadow-sm font-semibold text-left">
          {success}
        </div>
      )}
    </div>
  );
}
