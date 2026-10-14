/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Inscripcio, 
  SistemaConfig, 
  NoticiaXarxes, 
  CategoriaParella, 
  EstatVerificacio, 
  EstatInscripcio, 
  EstatPagament, 
  MetodePagament 
} from './types';

// Dades de simulació de perfils de DNI (imatges d'Internet reals de tipus DNI mock, o placeholders bonics)
const MOCK_DNI_1 = 'https://images.unsplash.com/photo-1554080353-a576cf803bda?q=80&w=600&auto=format&fit=crop';
const MOCK_DNI_2 = 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop';
const MOCK_DNI_3 = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=600&auto=format&fit=crop';
const MOCK_DNI_4 = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop';

export const COMPARTIDES_XARXES: NoticiaXarxes[] = [
  {
    id: 'not-1',
    xarxa: 'instagram',
    usuari: '@eltastvng',
    text: '🔥 CALENTANT MOTORS PER LES COMPARSES 2027! 🔥 Ja tenim data per a la recollida d\'armilles, clavells i corbatins oficials. Recordeu fer la vostra inscripció digital per tenir el vostre QR a mà i evitar cues! Ens trobem a la seu. 🎀💃 #comparses #eltast #vilanova #vilanovaigeltrú',
    imatgeUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
    dataPublicacio: 'Octubre 2026',
    enllacUrl: 'https://instagram.com',
    likes: 245
  },
  {
    id: 'not-2',
    xarxa: 'facebook',
    usuari: 'Associació Cultural El Tast',
    text: '📢 ATENCIÓ COMPARSERES I COMPARSERS! Enguany facilitem el sistema d\'inscripció. Podeu carregar el DNI directament des de la web i rebreu el codi QR de confirmació al vostre correu. En el moment de la recollida del material a la seu, només ens heu d\'ensenyar el QR, farem el pagament (Bizum o efectiu) i us endureu els materials oficials en segons! 🍬🍬🍬 El Tast, cada any millor!',
    dataPublicacio: 'Setembre 2026',
    enllacUrl: 'https://facebook.com',
    likes: 128
  },
  {
    id: 'not-3',
    xarxa: 'instagram',
    usuari: '@eltastvng',
    text: '🍬 Llestos per tirar tones de caramels a la Plaça de la Vila? 🍬 La categoria juvenil de les comparses d\'El Tast ja compta amb més de 40 parelles preinscrites! Queden poques places disponibles. Omple el formulari avui mateix!',
    imatgeUrl: 'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?q=80&w=800&auto=format&fit=crop',
    dataPublicacio: 'Setembre 2026',
    enllacUrl: 'https://instagram.com',
    likes: 194
  }
];

/**
 * Configuració oficial d'edats de categories.
 * NOTA DE JUNTA: Es delimiten les categories per evitar solapaments.
 * Si la Junta confirma excepcionalment menors a Adulta (p. ex. 16-17 amb acompanyant adult),
 * es reflectirà aquí. Actualment queda pendent de confirmació definitiva per l'entitat.
 */
export const CONFIG_EDATS_CATEGORIES = {
  reglaDefinida: false,
  pendentConfirmacioJunta: true,
  notaJuntaCA: "[Pendent de confirmació definitiva per la Junta: determinar si la Categoria Adulta requereix estrictament majors de 18 anys o admet 16-17 anys acompanyats d'adult]",
  notaJuntaES: "[Pendiente de confirmación definitiva por la Junta: determinar si la Categoría Adulta requiere estrictamente mayores de 18 años o admite 16-17 años acompañados de adulto]",
  categoriaAdulta: {
    edatMinimaDefecte: 18,
    admetMenorsAcompanyats: false, // pendent de confirmació
    descripcioCA: "Per a persones majors de 18 anys [Criteri per a 16-17 anys pendent de confirmació per la Junta]",
    descripcioES: "Para personas mayores de 18 años [Criterio para 16-17 años pendiente de confirmación por la Junta]"
  },
  categoriaJuvenil: {
    edatMinima: 14,
    edatMaxima: 17,
    requereixTutorLegal: true,
    descripcioCA: "Per a parelles d'entre 14 i 17 anys amb autorització signada de pare/mare o tutor/a legal.",
    descripcioES: "Para parejas de entre 14 y 17 años con autorización firmada de padre/madre o tutor/a legal."
  }
};

export const DEFAULT_CATEGORIA_DESCRIPTIONS = {
  categoria_adulta_desc_ca: "Per a majors de 18 anys [Criteri 16-17 anys pendent de confirmació per la Junta].",
  categoria_adulta_desc_es: "Para mayores de 18 años [Criterio 16-17 años pendiente de confirmación por la Junta].",
  categoria_juvenil_desc_ca: "Per a parelles de 14 a 17 anys amb autorització del tutor/a legal.",
  categoria_juvenil_desc_es: "Para parejas de 14 a 17 años con autorización del tutor/a legal."
};

export const CONFIG_INICIAL: SistemaConfig = {
  preuAdult: 90.00,
  preuJuvenil: 60.00,
  estatInscripcions: 'obertes',
  armilla_opcional: true,
  titolSeccioTarifes: 'Tarifes i Cànons 2027',
  tarifesDinamiques: [
    { id: 'adults', nom: 'Preu Parella Adulta (€)', nomES: 'Precio Pareja Adulta (€)', valor: 90.00, actiu: true, tipus: 'categoria_adult' },
    { id: 'juvenils', nom: 'Preu Parella Juvenil (€)', nomES: 'Precio Pareja Juvenil (€)', valor: 60.00, actiu: true, tipus: 'categoria_juvenil' },
    { id: 'clavells', nom: 'Clavells (€)', nomES: 'Claveles (€)', valor: 8.00, actiu: true, tipus: 'extra_generic' },
    { id: 'corbati', nom: 'Corbatí (€)', nomES: 'Corbatín (€)', valor: 10.00, actiu: true, tipus: 'extra_generic' }
  ],
  titolFormulariDinamic: "Preguntes del Qüestionari d'El Tast",
  cuestionariActiu: true,
  preguntesFormulari: [
    {
      id: 'preg-esmorzar-9zzpekm',
      titol: 'Voleu esmorzar?',
      concepte: 'Esmorzar',
      ambit: 'comparser',
      tipus: 'select',
      opcions: ['Sí', 'No'],
      preus: { 'Sí': 5 },
      activa: true,
      requerit: true
    },
    {
      id: 'preg-entrepa-0tlbtv3',
      titol: "Quin tipus d'entrepà voleu?",
      ambit: 'comparser',
      tipus: 'select',
      opcions: ['Pernil salat', 'Pernil dolç', 'Formatge', 'Tonyina', 'Vegetal'],
      activa: true,
      requerit: false
    },
    {
      id: 'preg-gluten-607nm9j',
      titol: 'Amb gluten o sense gluten?',
      ambit: 'comparser',
      tipus: 'select',
      opcions: ['Amb gluten', 'Sense gluten'],
      activa: true,
      requerit: false
    },
    {
      id: 'preg-tomaquet-fxgdkya',
      titol: 'Amb tomàquet o sense?',
      ambit: 'comparser',
      tipus: 'select',
      opcions: ['Amb tomàquet', 'Sense tomàquet'],
      activa: true,
      requerit: false
    },
    {
      id: 'preg-1',
      titol: 'És la vostra primera vegada participant amb El Tast?',
      tipus: 'boolean',
      requerit: true,
      activa: true
    },
    {
      id: 'preg-2',
      titol: 'Voleu participar al dinar de germanor de després de les comparses?',
      tipus: 'select',
      opcions: ['No volem participar-hi', 'Sí, tots dos participants', 'Només Comparser 1', 'Només Comparser 2'],
      requerit: true,
      activa: true
    },
    {
      id: 'preg-3',
      titol: 'Comentaris o observacions addicionals:',
      tipus: 'text',
      requerit: false,
      activa: true
    }
  ],
  logoText: 'T',
  titolPrincipal: 'EL TAST',
  titolSecundari: 'VILANOVA',
  subtitol: 'Vilanova i la Geltrú 2027',
  logoColor: '#ff0090',
  logoImgUrl: '',
  logoUseImage: false,
  nomUniforme: "Talla d'Armilla",
  nomUniformeES: "Talla de Chaleco",
  opcionsUniforme: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  liniisUniforme: [
    {
      id: 'lin-1',
      nom: "Talla d'Armilla Oficial",
      nomES: "Talla de Chaleco Oficial",
      opcions: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
      requeixQuantitat: false,
      actiu: true,
      opcional: false,
      preu: 30,
      preuLloguer: 30,
      fianca: 0
    }
  ],
  categoriaAdultaNom: "Parella Adulta",
  categoriaAdultaNomES: "Pareja Adulta",
  categoriaJuvenilNom: "Parella Juvenil",
  categoriaJuvenilNomES: "Pareja Juvenil",
  categoriaAdultaDescCA: "Per a majors de 18 anys [Criteri 16-17 anys pendent de confirmació per la Junta].",
  categoriaAdultaDescES: "Para mayores de 18 años [Criterio 16-17 años pendiente de confirmación por la Junta].",
  categoriaJuvenilDescCA: "Per a parelles de 14 a 17 anys amb autorització del tutor/a legal.",
  categoriaJuvenilDescES: "Para parejas de 14 a 17 años con autorización del tutor/a legal.",
  categoriaAdultaActiva: true,
  categoriaJuvenilActiva: true,
  requerirDni: true,
  instruccionsDniCA: "Pugeu una imatge o foto del DNI/NIE (només cal que siguin visibles el nom i data de naixement).",
  instruccionsDniES: "Suba una imagen o foto del DNI/NIE (solo es necesario que sean visibles el nombre y la fecha de nacimiento).",
  textLegalRgpd: "En compliment del Reglament General de Protecció de Dades (RGPD), us informem que les dades facilitades seran tractades exclusivament per l'Associació Cultural El Tast per gestionar la inscripció i verificar l'edat dels participants a les Comparses de Vilanova 2027. Les dades no se cediran a tercers excepte obligació legal i les imatges aportades seran esborrades un cop verificada l'edat.",
  textLegalRgpdES: "En cumplimiento del Reglamento General de Protección de Datos (RGPD), le informamos que los datos facilitados serán tratados exclusivamente por la Associació Cultural El Tast para gestionar la inscripción y verificar la edad de los participantes en las Comparses de Vilanova 2027. Los datos no se cederán a terceros salvo obligación legal y las imágenes aportadas serán eliminadas una vez verificada la edad.",
  titolConfirmacioCA: "Inscripció Confirmada!",
  titolConfirmacioES: "¡Inscripción Confirmada!",
  missatgeConfirmacioCA: "Hem registrat la vostra parella per a l'esdeveniment de l'entitat El Tast.",
  missatgeConfirmacioES: "Hemos registrado a vuestra pareja para el evento de la entidad El Tast.",
  textLegalAutoritzacioMenors: "AUTORITZACIÓ DE PARTICIPACIÓ DE MENORS D'EDAT\n\nCom a pare/mare o tutor/a legal del menor d'edat inscrit, autoritzo expressament la seva participació a l'activitat de Comparses organitzada per l'Associació Cultural El Tast per a l'edició 2027.\n\nDeclaro que he estat informat/da de les condicions i normativa de participació, que les dades de contacte facilitades són veraces per a qualsevol comunicació organitzativa o d'urgència durant l'activitat, i que aportaré la documentació identificativa acreditativa requerida per l'organització.",
  textLegalAutoritzacioMenorsES: "AUTORIZACIÓN DE PARTICIPACIÓN DE MENORES DE EDAD\n\nComo padre/madre o tutor/a legal del menor de edad inscrito, autorizo expresamente su participación en la actividad de Comparsas organizada por la Associació Cultural El Tast para la edición 2027.\n\nDeclaro haber sido informado/a de las condiciones y normativa de participación, que los datos de contacto facilitados son veraces para cualquier comunicación organizativa o de urgencia durante la actividad, y que aportaré la documentación identificativa acreditativa requerida por la organización."
};

export const INSCRIPCIONS_INICIALS: Inscripcio[] = [
  {
    id: 'ins-1',
    codiSeguiment: 'TAST-2026-0001',
    categoria: CategoriaParella.ADULT,
    emailContactoPareja: 'joan.garcia@gmail.com',
    telefonContactoPareja: '600112233',
    c1Nom: 'Joan',
    c1Cognoms: 'Garcia i Romeu',
    c1Email: 'joan.garcia@gmail.com',
    c1Telefon: '600112233',
    c1Talla: 'XL',
    c1DniUrl: MOCK_DNI_1,
    c2Nom: 'Marta',
    c2Cognoms: 'Vilanova i Soler',
    c2Email: 'joan.garcia@gmail.com',
    c2Telefon: '600112233',
    c2Talla: 'M',
    c2DniUrl: MOCK_DNI_2,
    respostesCuestionari: {
      'preg-1': true,
      'preg-2': 'Sí, tots dos participants',
      'preg-3': 'És possible recollir la roba abans?'
    },
    preuCalculat: 90.00,
    teDomasBalco: false,
    teMocadorsExtra: 0,
    pagaments: [{
      id: 'pag-mock-1',
      data: '2026-05-18T18:45:00Z',
      import: 90.00,
      metode: MetodePagament.BIZUM,
      nota: 'Pagament complet Bizum'
    }],
    estatPagament: EstatPagament.PAGAT,
    metodePagament: MetodePagament.BIZUM,
    estatDni: EstatVerificacio.VALIDAT,
    entregaMaterial: EstatInscripcio.ENTREGAT,
    creadoEn: '2026-05-15T10:30:00Z',
    actualizadoEn: '2026-05-18T18:45:00Z'
  },
  {
    id: 'ins-2',
    codiSeguiment: 'TAST-2026-0012',
    categoria: CategoriaParella.ADULT,
    emailContactoPareja: 'albert.soler@outlook.com',
    telefonContactoPareja: '611223344',
    c1Nom: 'Albert',
    c1Cognoms: 'Soler i Ferrando',
    c1Email: 'albert.soler@outlook.com',
    c1Telefon: '611223344',
    c1Talla: 'L',
    c1DniUrl: MOCK_DNI_3,
    c2Nom: 'Elena',
    c2Cognoms: 'Mas i Ripoll',
    c2Email: 'albert.soler@outlook.com',
    c2Telefon: '611223344',
    c2Talla: 'S',
    c2DniUrl: MOCK_DNI_4,
    respostesCuestionari: {
      'preg-1': false,
      'preg-2': 'No volem participar-hi',
      'preg-3': ''
    },
    preuCalculat: 90.00,
    teDomasBalco: false,
    teMocadorsExtra: 0,
    pagaments: [],
    estatPagament: EstatPagament.PENDENT,
    metodePagament: null,
    estatDni: EstatVerificacio.PENDENT,
    entregaMaterial: EstatInscripcio.PENDENT,
    creadoEn: '2026-06-01T12:15:00Z',
    actualizadoEn: '2026-06-01T12:15:00Z'
  },
  {
    id: 'ins-3',
    codiSeguiment: 'TAST-2026-0024',
    categoria: CategoriaParella.JUVENIL,
    emailContactoPareja: 'biel.prat@hotmail.com',
    telefonContactoPareja: '622334455',
    c1Nom: 'Biel',
    c1Cognoms: 'Prat i Miró',
    c1Email: 'biel.prat@hotmail.com',
    c1Telefon: '622334455',
    c1Talla: 'M',
    c1DniUrl: MOCK_DNI_2,
    c2Nom: 'Laia',
    c2Cognoms: 'Colomer i Sastre',
    c2Email: 'biel.prat@hotmail.com',
    c2Telefon: '622334455',
    c2Talla: 'XS',
    c2DniUrl: MOCK_DNI_3,
    respostesCuestionari: {
      'preg-1': true,
      'preg-2': 'Sí, tots dos participants',
      'preg-3': 'Gràcies per tot'
    },
    preuCalculat: 60.00,
    teDomasBalco: false,
    teMocadorsExtra: 0,
    pagaments: [{
      id: 'pag-mock-3',
      data: '2026-06-05T19:10:00Z',
      import: 60.00,
      metode: MetodePagament.EFECTIU,
      nota: 'Pagament efectiu'
    }],
    estatPagament: EstatPagament.PAGAT,
    metodePagament: MetodePagament.EFECTIU,
    estatDni: EstatVerificacio.VALIDAT,
    entregaMaterial: EstatInscripcio.PENDENT,
    creadoEn: '2026-06-03T16:40:00Z',
    actualizadoEn: '2026-06-05T19:10:00Z'
  },
  {
    id: 'ins-4',
    codiSeguiment: 'TAST-2026-0035',
    categoria: CategoriaParella.ADULT,
    emailContactoPareja: 'roger.gisbert@gmail.com',
    telefonContactoPareja: '644556677',
    c1Nom: 'Roger',
    c1Cognoms: 'Gisbert i Cardona',
    c1Email: 'roger.gisbert@gmail.com',
    c1Telefon: '644556677',
    c1Talla: 'XXL',
    c1DniUrl: MOCK_DNI_4,
    c2Nom: 'Teresa',
    c2Cognoms: 'Amorós i Belmonte',
    c2Email: 'roger.gisbert@gmail.com',
    c2Telefon: '644556677',
    c2Talla: 'L',
    c2DniUrl: MOCK_DNI_1,
    respostesCuestionari: {
      'preg-1': false,
      'preg-2': 'Només Comparser 1',
      'preg-3': 'Cap observació particular'
    },
    preuCalculat: 90.00,
    teDomasBalco: false,
    teMocadorsExtra: 0,
    pagaments: [],
    estatPagament: EstatPagament.PENDENT,
    metodePagament: null,
    estatDni: EstatVerificacio.REBUTJAT,
    entregaMaterial: EstatInscripcio.PENDENT,
    creadoEn: '2026-06-05T09:20:00Z',
    actualizadoEn: '2026-06-06T11:30:00Z'
  },
  {
    id: 'ins-5',
    codiSeguiment: 'TAST-2026-0046',
    categoria: CategoriaParella.JUVENIL,
    emailContactoPareja: 'arnau.vara@gmail.com',
    telefonContactoPareja: '655443322',
    c1Nom: 'Arnau',
    c1Cognoms: 'Vara i Pujol',
    c1Email: 'arnau.vara@gmail.com',
    c1Telefon: '655443322',
    c1Talla: 'S',
    c1DniUrl: MOCK_DNI_1,
    c2Nom: 'Julia',
    c2Cognoms: 'Esteve i Camps',
    c2Email: 'arnau.vara@gmail.com',
    c2Telefon: '655443322',
    c2Talla: 'M',
    c2DniUrl: MOCK_DNI_2,
    respostesCuestionari: {
      'preg-1': true,
      'preg-2': 'No volem participar-hi',
      'preg-3': 'Preferim color clar si és possible'
    },
    preuCalculat: 60.00,
    teDomasBalco: false,
    teMocadorsExtra: 0,
    pagaments: [{
      id: 'pag-mock-5',
      data: '2026-06-06T17:00:00Z',
      import: 60.00,
      metode: MetodePagament.BIZUM,
      nota: 'Pagament Bizum'
    }],
    estatPagament: EstatPagament.PAGAT,
    metodePagament: MetodePagament.BIZUM,
    estatDni: EstatVerificacio.VALIDAT,
    entregaMaterial: EstatInscripcio.ENTREGAT,
    creadoEn: '2026-06-06T14:50:00Z',
    actualizadoEn: '2026-06-06T17:00:00Z'
  }
];
