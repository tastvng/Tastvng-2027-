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
  c1EsMenor?: boolean;
  c1TutorNom?: string;
  c1TutorCognoms?: string;
  c1TutorDni?: string;
  c1TutorTelefon?: string;
  c1UniformeTipus?: 'compra' | 'lloguer';
  
  // Comparser 2
  c2Nom: string;
  c2Cognoms: string;
  c2Email: string;
  c2Telefon: string;
  c2Talla: string;
  c2DniUrl: string; // Foto o fitxer de DNI
  c2EsMenor?: boolean;
  c2TutorNom?: string;
  c2TutorCognoms?: string;
  c2TutorDni?: string;
  c2TutorTelefon?: string;
  c2UniformeTipus?: 'compra' | 'lloguer';

  // Camps dinàmics i addicionals
  respostesCuestionari: Record<string, string | boolean>;
  seleccionsUniforme?: Record<string, { c1Talla: string; c2Talla: string; quantitat: number }>;
  preuCalculat: number;
  teDomasBalco: boolean;
  teMocadorsExtra: number;
  dni_reverso_1?: string;
  dni_reverso_2?: string;
  extras_seleccionats?: string[];
  total_pedido?: number;
  
  // Estats de gestió
  estatPagament: EstatPagament;
  metodePagament: MetodePagament | null;
  estatDni: EstatVerificacio;
  entregaMaterial: EstatInscripcio;
  entregaC1Uniforme?: boolean;
  entregaC2Uniforme?: boolean;
  entregaDomas?: boolean;
  entregaMocadors?: boolean;
  llistaEspera?: boolean;
  
  creadoEn: string;
  actualizadoEn: string;
}

export interface TarifaConcept {
  id: string;
  nom: string;
  valor: number;
  actiu: boolean;
  tipus: 'categoria_adult' | 'categoria_juvenil' | 'extra_domas' | 'extra_mocador' | 'extra_generic';
}

export interface LiniaUniforme {
  id: string;
  nom: string;
  nomES: string;
  opcions: string[];
  requeixQuantitat?: boolean;
}

export interface SistemaConfig {
  preuAdult: number;
  preuJuvenil: number;
  preuDomasBalco: number;
  preuMocadorExtra: number;
  preguntesFormulari: PreguntaDinamica[];
  logoText?: string;
  titolPrincipal?: string;
  titolSecundari?: string;
  subtitol?: string;
  logoColor?: string;
  titolSeccioTarifes?: string;
  tarifesDinamiques?: TarifaConcept[];
  titolFormulariDinamic?: string;
  logoImgUrl?: string;
  logoUseImage?: boolean;
  nomUniforme?: string;
  nomUniformeES?: string;
  opcionsUniforme?: string[];
  liniisUniforme?: LiniaUniforme[];
  textLegalAutoritzacioMenors?: string;
  textLegalAutoritzacioMenorsES?: string;
  estatInscripcions?: 'obertes' | 'espera' | 'tancades';
  googleSheetSyncUrl?: string;
  googleSheetSyncActive?: boolean;
  cuestionariActiu?: boolean;
}

export interface NoticiaXarxes {
  id: string;
  xarxa?: 'instagram' | 'facebook' | 'entitat';
  usuari: string;
  text: string;
  imatgeUrl?: string;
  dataPublicacio: string;
  enllacUrl?: string;
  likes?: number;
  tipus?: 'normal' | 'video' | 'nota' | 'alerta';
  videoUrl?: string;
  ressaltat?: boolean;
  titol?: string;
}

export interface StaffMember {
  id: string;
  nom: string;
  usuari: string;
  rol: 'SuperAdministrador' | 'Secretaria' | 'Mesa d\'Entrega' | 'Coordinador';
  contrasenya: string;
  creadoEn: string;
  actiu: boolean;
}
