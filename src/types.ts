/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CategoriaParella {
  ADULT = 'ADULT',
  JUVENIL = 'JUVENIL'
}

export enum EstatVerificacio {
  PENDENT = 'PENDENT',
  VALIDAT = 'VALIDAT',
  REBUTJAT = 'REBUTJAT'
}

export enum EstatInscripcio {
  PENDENT = 'PENDENT',
  ENTREGAT = 'ENTREGAT'
}

export enum EstatPagament {
  PENDENT = 'PENDENT',
  PAGAT = 'PAGAT'
}

export enum MetodePagament {
  EFECTIU = 'EFECTIU',
  BIZUM = 'BIZUM'
}

export interface PreguntaDinamica {
  id: string;
  titol: string;
  tipus: 'text' | 'select' | 'boolean';
  opcions?: string[];
  requerit: boolean;
  activa: boolean;
}

export interface Inscripcio {
  id: string;
  codiSeguiment: string;
  categoria: CategoriaParella;
  
  // Comparser 1
  c1Nom: string;
  c1Cognoms: string;
  c1Email: string;
  c1Telefon: string;
  c1Talla: string; // Talla samarreta o armilla
  c1DniUrl: string; // Foto o fitxer de DNI
  
  // Comparser 2
  c2Nom: string;
  c2Cognoms: string;
  c2Email: string;
  c2Telefon: string;
  c2Talla: string;
  c2DniUrl: string; // Foto o fitxer de DNI

  // Camps dinàmics i addicionals
  respostesCuestionari: Record<string, string | boolean>;
  preuCalculat: number;
  teDomasBalco: boolean;
  teMocadorsExtra: number;
  
  // Estats de gestió
  estatPagament: EstatPagament;
  metodePagament: MetodePagament | null;
  estatDni: EstatVerificacio;
  entregaMaterial: EstatInscripcio;
  
  creadoEn: string;
  actualizadoEn: string;
}

export interface SistemaConfig {
  preuAdult: number;
  preuJuvenil: number;
  preuDomasBalco: number;
  preuMocadorExtra: number;
  preguntesFormulari: PreguntaDinamica[];
}

export interface NoticiaXarxes {
  id: string;
  xarxa: 'instagram' | 'facebook';
  usuari: string;
  text: string;
  imatgeUrl?: string;
  dataPublicacio: string;
  enllacUrl: string;
  likes: number;
}
