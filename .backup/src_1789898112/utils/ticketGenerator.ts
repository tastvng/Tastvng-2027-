import { Inscripcio, SistemaConfig, CategoriaParella } from '../types';
import { EntityConfig } from './entityConfig';
import { InscriptionOrderBreakdown, generateItemizedBreakdownHtml } from './orderCalculations';

export interface TicketGenerationOptions {
  registration: Inscripcio;
  entityConfig: EntityConfig;
  breakdown: InscriptionOrderBreakdown;
  c1DniSignedUrl?: string | null;
  c2DniSignedUrl?: string | null;
  language?: 'ca' | 'es';
}

/**
 * Builds the canonical email HTML content using the unified single source of truth.
 * Completely free of hardcoded legacy strings, old addresses, or fabricated materials.
 */
export function buildUnifiedEmailHtml(options: TicketGenerationOptions): {
  subject: string;
  html: string;
} {
  const { registration, entityConfig, breakdown, c1DniSignedUrl, c2DniSignedUrl, language = 'ca' } = options;

  const subjectBase = language === 'ca'
    ? `Confirmació de preinscripció - ${entityConfig.nomEsdeveniment}`
    : `Confirmación de preinscripción - ${entityConfig.nomEsdeveniment}`;
  const subject = `${subjectBase} [${registration.codiSeguiment}]`;

  const isAdult = String(registration.categoria || '').toUpperCase().includes('ADULT') || 
                  registration.categoria === CategoriaParella.ADULT;
  const categoriaLabel = isAdult 
    ? (language === 'ca' ? 'PARELLA ADULTA' : 'PAREJA ADULTA') 
    : (language === 'ca' ? 'PARELLA JUVENIL' : 'PAREJA JUVENIL');

  const isLlistaEspera = registration.estatInscripcio === 'llista_espera' || (!registration.estatInscripcio && registration.llistaEspera);

  // Logo rendering
  let logoHtml = '';
  if (entityConfig.logoUrl) {
    logoHtml = `
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="${entityConfig.logoUrl}" alt="${entityConfig.nom}" style="max-height: 70px; max-width: 220px; object-fit: contain; margin: 0 auto; display: block; border-radius: 8px;" />
      </div>
    `;
  } else {
    logoHtml = `
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #ff0090; color: #ffffff; padding: 10px 24px; font-size: 13px; font-weight: bold; border-radius: 50px; letter-spacing: 1px; display: inline-block; text-transform: uppercase;">
          ${entityConfig.nom}
        </span>
      </div>
    `;
  }

  // QR representation (Rule 10: QR contains the exact saved tracking code)
  const qrIdentifier = registration.codiSeguiment;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=e6007e&data=${encodeURIComponent(qrIdentifier)}`;

  // DNI Status HTML
  const dniMissingText = language === 'ca' ? 'DNI no adjuntat' : 'DNI no adjuntado';
  const dniViewText = language === 'ca' ? 'Veure document adjunt' : 'Ver documento adjunto';

  const c1DniHtml = c1DniSignedUrl
    ? `<a href="${c1DniSignedUrl}" target="_blank" rel="noopener noreferrer" style="color: #ff0090; font-weight: bold; text-decoration: underline;">${dniViewText}</a>`
    : `<span style="color: #b45309; background-color: #fef3c7; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">⚠️ ${dniMissingText}</span>`;

  const c2DniHtml = c2DniSignedUrl
    ? `<a href="${c2DniSignedUrl}" target="_blank" rel="noopener noreferrer" style="color: #ff0090; font-weight: bold; text-decoration: underline;">${dniViewText}</a>`
    : `<span style="color: #b45309; background-color: #fef3c7; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">⚠️ ${dniMissingText}</span>`;

  // Itemized breakdown table
  const itemizedTableHtml = generateItemizedBreakdownHtml(breakdown, language);

  const contactEmail = (registration.emailContactoPareja || registration.c1Email || registration.c2Email || '').trim();
  const contactPhone = (registration.telefonContactoPareja || registration.c1Telefon || registration.c2Telefon || '').trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e4e8; border-radius: 24px; background-color: #ffffff; color: #111115;">
      ${logoHtml}

      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 11px; font-weight: 800; color: #ff0090; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
          ${language === 'ca' ? 'COMPROVANT OFICIAL DE REGISTRE' : 'COMPROBANTE OFICIAL DE REGISTRO'}
        </span>
        <h1 style="color: #111115; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">
          ${entityConfig.nom} &bull; ${entityConfig.nomEsdeveniment}
        </h1>
      </div>

      <!-- Tracking Code Box -->
      <div style="background-color: #fcf6fa; border: 1.5px dashed #ff0090; padding: 18px; border-radius: 18px; text-align: center; margin-bottom: 28px;">
        <span style="font-size: 10px; font-family: monospace; color: #cc0073; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; display: block; margin-bottom: 4px;">
          ${language === 'ca' ? 'CODI DE SEGUIMENT OFICIAL' : 'CÓDIGO DE SEGUIMIENTO OFICIAL'}
        </span>
        <span style="font-size: 28px; font-family: monospace; font-weight: 950; color: #ff0090; letter-spacing: 1.5px;">
          ${registration.codiSeguiment}
        </span>
      </div>

      <!-- QR Representation -->
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; padding: 14px; background-color: #f8f9fa; border: 1px solid #e1e1e6; border-radius: 18px;">
          <img src="${qrImgUrl}" alt="QR Codi" width="180" height="180" style="display: block; border-radius: 10px;" />
        </div>
        <p style="font-size: 11px; color: #666670; margin-top: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.5px;">
          ${language === 'ca' ? 'Presenteu aquest codi QR a Secretaria per fer el pagament' : 'Presenten este código QR en Secretaría para realizar el pago'}
        </p>
      </div>

      <!-- Couple and Registration Information Table -->
      <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 18px 0; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px; width: 40%;">
              ${language === 'ca' ? 'Parella:' : 'Pareja:'}
            </td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #111115;">
              ${registration.c1Nom} ${registration.c1Cognoms || ''} &amp; ${registration.c2Nom} ${registration.c2Cognoms || ''}
            </td>
          </tr>
          ${contactEmail ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              ${language === 'ca' ? 'Correu de contacte:' : 'Correo de contacto:'}
            </td>
            <td style="padding: 6px 0; text-align: right; color: #374151; font-family: monospace;">
              ${contactEmail}
            </td>
          </tr>
          ` : ''}
          ${contactPhone ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              ${language === 'ca' ? 'Telèfon de contacte:' : 'Teléfono de contacto:'}
            </td>
            <td style="padding: 6px 0; text-align: right; color: #374151; font-family: monospace;">
              ${contactPhone}
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              ${language === 'ca' ? 'Categoria:' : 'Categoría:'}
            </td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #111115;">
              <span style="background-color: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-family: monospace;">
                ${categoriaLabel}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              ${language === 'ca' ? 'Estat d’inscripció:' : 'Estado de inscripción:'}
            </td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold;">
              ${isLlistaEspera
                ? `<span style="color: #b45309; background-color: #fef3c7; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 6px; font-size: 11px;">${language === 'ca' ? "LLISTA D'ESPERA" : "LISTA DE ESPERA"}</span>`
                : `<span style="color: #047857; background-color: #d1fae5; border: 1px solid #10b981; padding: 2px 8px; border-radius: 6px; font-size: 11px;">${language === 'ca' ? "OBERTA" : "ABIERTA"}</span>`
              }
            </td>
          </tr>
          ${registration.posicioGlobal ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              ${language === 'ca' ? 'Posició global assignada:' : 'Posición global asignada:'}
            </td>
            <td style="padding: 6px 0; text-align: right; font-weight: 900; color: #ff0090; font-family: monospace;">
              #${registration.posicioGlobal}
            </td>
          </tr>
          ` : ''}

          <!-- DNI Links section (Requirement 10) -->
          <tr style="border-top: 1px dashed #e5e7eb;">
            <td style="padding: 8px 0 4px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              DNI ${registration.c1Nom || 'P1'}:
            </td>
            <td style="padding: 8px 0 4px 0; text-align: right; font-size: 12px;">
              ${c1DniHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0 8px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; font-size: 11px;">
              DNI ${registration.c2Nom || 'P2'}:
            </td>
            <td style="padding: 4px 0 8px 0; text-align: right; font-size: 12px;">
              ${c2DniHtml}
            </td>
          </tr>
        </table>
      </div>

      <!-- Itemized Materials Breakdown Table (Single Source of Truth) -->
      <div style="margin-bottom: 28px;">
        <span style="font-size: 11px; font-weight: 800; color: #111115; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
          ${language === 'ca' ? 'DESGLOSSAMENT OFICIAL DE MATERIALS I QUOTA:' : 'DESGLOSE OFICIAL DE MATERIALES Y CUOTA:'}
        </span>
        ${itemizedTableHtml}
      </div>

      <!-- Logistics / Entity Delivery Information (Requirement 8 & 9) -->
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 18px; margin-bottom: 28px;">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 12px; color: #111115; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 900;">
          📍 ${language === 'ca' ? 'PUNT DE RECOLLIDA I ATENCIÓ:' : 'PUNTO DE RECOGIDA Y ATENCIÓN:'}
        </h3>
        <div style="font-size: 12px; color: #374151; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">
            <strong>${entityConfig.nom}</strong><br/>
            ${entityConfig.direccio}
          </p>
          <p style="margin: 0 0 8px 0;">
            <strong>${language === 'ca' ? 'Dies de lliurament i caixa:' : 'Días de entrega y cobro:'}</strong><br/>
            ${entityConfig.diesEntrega}
          </p>
          <p style="margin: 0 0 8px 0;">
            <strong>${language === 'ca' ? 'Horari de Secretaria:' : 'Horario de Secretaría:'}</strong><br/>
            ${entityConfig.horari}
          </p>
          <p style="margin: 0;">
            <strong>${language === 'ca' ? 'Contacte oficial:' : 'Contacto oficial:'}</strong><br/>
            <a href="mailto:${entityConfig.email}" style="color: #ff0090; text-decoration: none; font-weight: bold;">${entityConfig.email}</a>
            ${entityConfig.telefon ? ` &bull; Tel: <span style="font-family: monospace; font-weight: bold;">${entityConfig.telefon}</span>` : ''}
          </p>
        </div>
      </div>

      <!-- Footer disclaimer -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 18px; text-align: center; font-size: 11px; color: #9ca3af; line-height: 1.5;">
        <p style="margin: 0;">
          <strong>${entityConfig.nom}</strong><br/>
          ${entityConfig.direccio} &bull; <a href="mailto:${entityConfig.email}" style="color: #ff0090; text-decoration: none;">${entityConfig.email}</a>
        </p>
      </div>
    </div>
  `;

  return { subject, html };
}
