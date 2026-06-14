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
    text: '🔥 CALENTANT MOTORS PER LES COMPARSES 2026! 🔥 Ja tenim data per a la recollida d\'armilles i mocadors oficinals. Recordeu fer la vostra inscripció digital per tenir el vostre QR a mà i evitar cues! Ens trobem a la seu. 🎀💃 #comparses #eltast #vilanova #vilanovaigeltrú',
    imatgeUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
    dataPublicacio: 'Fa 2 hores',
    enllacUrl: 'https://instagram.com',
    likes: 245
  },
  {
    id: 'not-2',
    xarxa: 'facebook',
    usuari: 'Associació Cultural El Tast',
    text: '📢 ATENCIÓ COMPARSERES I COMPARSERS! Enguany facilitem el sistema d\'inscripció. Podeu carregar el DNI directament des de la web i rebreu el codi QR de confirmació al vostre correu. En el moment de la recollida del material a la seu, només ens heu d\'ensenyar el QR, farem el pagament (Bizum o efectiu) i us endureu el mocador i la comanda en segons! 🍬🍬🍬 El Tast, cada any millor!',
    dataPublicacio: 'Ahir',
    enllacUrl: 'https://facebook.com',
    likes: 128
  },
  {
    id: 'not-3',
    xarxa: 'instagram',
    usuari: '@eltastvng',
    text: '🍬 Llestos per tirar tones de caramels a la Plaça de la Vila? 🍬 La categoria juvenil de les comparses d\'El Tast ja compta amb més de 40 parelles preinscrites! Queden poques places disponibles. Omple el formulari avui mateix!',
    imatgeUrl: 'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?q=80&w=800&auto=format&fit=crop',
    dataPublicacio: 'Fa 3 dies',
    enllacUrl: 'https://instagram.com',
    likes: 194
  }
];

export const CONFIG_INICIAL: SistemaConfig = {
  preuAdult: 90.00,
  preuJuvenil: 60.00,
  preuDomasBalco: 15.00,
  preuMocadorExtra: 6.00,
  estatInscripcions: 'obertes',
  titolSeccioTarifes: 'Tarifes i Cànons 2026',
  tarifesDinamiques: [
    { id: 'adults', nom: 'Preu Parella Adulta (€)', valor: 90.00, actiu: true, tipus: 'categoria_adult' },
    { id: 'juvenils', nom: 'Preu Parella Juvenil (€)', valor: 60.00, actiu: true, tipus: 'categoria_juvenil' },
    { id: 'domas', nom: 'Cànon Domàs de Balcó (€)', valor: 15.00, actiu: true, tipus: 'extra_domas' },
    { id: 'mocador', nom: 'Cànon Mocador Extra (€)', valor: 6.00, actiu: true, tipus: 'extra_mocador' }
  ],
  titolFormulariDinamic: "Preguntes del Qüestionari d'El Tast",
  cuestionariActiu: true,
  preguntesFormulari: [
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
  subtitol: 'Vilanova i la Geltrú 2026',
  logoColor: '#ff0090',
  logoImgUrl: '',
  logoUseImage: false,
  nomUniforme: "Talla de Samarreta",
  nomUniformeES: "Talla de Camiseta",
  opcionsUniforme: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  liniisUniforme: [
    {
      id: 'lin-1',
      nom: "Talla de Samarreta Oficial",
      nomES: "Talla de Camiseta Oficial",
      opcions: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
      requeixQuantitat: false
    },
    {
      id: 'lin-2',
      nom: "Talla de Jaqueta Tècnica",
      nomES: "Talla de Chaqueta Técnica",
      opcions: ["S", "M", "L", "XL", "XXL"],
      requeixQuantitat: true
    }
  ],
  textLegalAutoritzacioMenors: "AUTORITZACIÓ DE MENORS D'EDAT\n\nEn condició de tutor/a legal del menor inscrit, declaro sota la meva responsabilitat que autoritzo expressament la seva participació a l'esdeveniment i activitats organitzades per l'Associació Cultural El Tast (Vilanova i la Geltrú 2026).\n\nCertifico que el menor es troba en condicions físiques i de salut aptes per al correcte desenvolupament de l'activitat, i m'en faig responsable de qualsevol incidència que se'n derivi del seu estat previ de salut, així com del compliment de la normativa vigent de l'organització.",
  textLegalAutoritzacioMenorsES: "AUTORIZACIÓN DE MENORES DE EDAD\n\nEn condición de tutor/a legal del menor inscrito, declaro bajo mi responsabilidad que autorizo expresamente su participación en el evento y actividades organizadas por la Associació Cultural El Tast (Vilanova i la Geltrú 2026).\n\nCertifico que el menor se encuentra en condiciones físicas y de salud aptas para el correcto desarrollo de la actividad, y me hago responsable de cualquier incidencia que se derive de su estado previo de salud, así como del cumplimiento de la normativa de la organización."
};

export const INSCRIPCIONS_INICIALS: Inscripcio[] = [
  {
    id: 'ins-1',
    codiSeguiment: 'TAST-2026-0001',
    categoria: CategoriaParella.ADULT,
    c1Nom: 'Joan',
    c1Cognoms: 'Garcia i Romeu',
    c1Email: 'joan.garcia@gmail.com',
    c1Telefon: '600112233',
    c1Talla: 'XL',
    c1DniUrl: MOCK_DNI_1,
    c2Nom: 'Marta',
    c2Cognoms: 'Vilanova i Soler',
    c2Email: 'marta.vilanova@yahoo.es',
    c2Telefon: '600445566',
    c2Talla: 'M',
    c2DniUrl: MOCK_DNI_2,
    respostesCuestionari: {
      'preg-1': true,
      'preg-2': 'Sí, tots dos participants',
      'preg-3': 'És possible recollir la roba abans?'
    },
    preuCalculat: 105.00, // 90 + 1 mocador extra (6) + domas (15) o similar
    teDomasBalco: true,
    teMocadorsExtra: 1,
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
    c1Nom: 'Albert',
    c1Cognoms: 'Soler i Ferrando',
    c1Email: 'albert.soler@outlook.com',
    c1Telefon: '611223344',
    c1Talla: 'L',
    c1DniUrl: MOCK_DNI_3,
    c2Nom: 'Elena',
    c2Cognoms: 'Mas i Ripoll',
    c2Email: 'elena.mas@gmail.com',
    c2Telefon: '655667788',
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
    c1Nom: 'Biel',
    c1Cognoms: 'Prat i Miró',
    c1Email: 'biel.prat@hotmail.com',
    c1Telefon: '622334455',
    c1Talla: 'M',
    c1DniUrl: MOCK_DNI_2,
    c2Nom: 'Laia',
    c2Cognoms: 'Colomer i Sastre',
    c2Email: 'laia.colomer@gmail.com',
    c2Telefon: '633445566',
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
    c1Nom: 'Roger',
    c1Cognoms: 'Gisbert i Cardona',
    c1Email: 'roger.gisbert@gmail.com',
    c1Telefon: '644556677',
    c1Talla: 'XXL',
    c1DniUrl: MOCK_DNI_4,
    c2Nom: 'Teresa',
    c2Cognoms: 'Amorós i Belmonte',
    c2Email: 'teresa.amoros@gmail.com',
    c2Telefon: '677889900',
    c2Talla: 'L',
    c2DniUrl: MOCK_DNI_1,
    respostesCuestionari: {
      'preg-1': false,
      'preg-2': 'Només Comparser 1',
      'preg-3': 'Cap observació particular'
    },
    preuCalculat: 111.00, // 90 + 15 domàs + 6 mocador extra
    teDomasBalco: true,
    teMocadorsExtra: 1,
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
    c1Nom: 'Arnau',
    c1Cognoms: 'Vara i Pujol',
    c1Email: 'arnau.vara@gmail.com',
    c1Telefon: '655443322',
    c1Talla: 'S',
    c1DniUrl: MOCK_DNI_1,
    c2Nom: 'Julia',
    c2Cognoms: 'Esteve i Camps',
    c2Email: 'julia.esteve@yahoo.com',
    c2Telefon: '699887766',
    c2Talla: 'M',
    c2DniUrl: MOCK_DNI_2,
    respostesCuestionari: {
      'preg-1': true,
      'preg-2': 'No volem participar-hi',
      'preg-3': 'Preferim color clar si és possible'
    },
    preuCalculat: 75.00, // 60 + 15 domas
    teDomasBalco: true,
    teMocadorsExtra: 0,
    estatPagament: EstatPagament.PAGAT,
    metodePagament: MetodePagament.BIZUM,
    estatDni: EstatVerificacio.VALIDAT,
    entregaMaterial: EstatInscripcio.ENTREGAT,
    creadoEn: '2026-06-06T14:50:00Z',
    actualizadoEn: '2026-06-06T17:15:00Z'
  }
];
