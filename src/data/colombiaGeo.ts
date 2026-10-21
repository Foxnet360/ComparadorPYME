/**
 * Catálogo Geográfico Nacional de Colombia (DIVIPOLA / NSR-10)
 * Cobertura completa de los 32 departamentos y Bogotá D.C.
 * Incluye clasificación de zona sísmica según NSR-10 y coordenadas de referencia.
 */

export type SeismicZone = 'Alta' | 'Intermedia' | 'Baja';

export interface MunicipalityGeo {
  name: string;
  zone: SeismicZone;
  lat: number;
  lng: number;
}

export interface DepartmentGeo {
  code: string;
  name: string;
  capital: string;
  municipalities: MunicipalityGeo[];
}

export const COLOMBIA_DEPARTMENTS: DepartmentGeo[] = [
  {
    code: '11',
    name: 'Bogotá D.C.',
    capital: 'Bogotá',
    municipalities: [
      { name: 'Bogotá D.C.', zone: 'Intermedia', lat: 4.6097, lng: -74.0817 },
    ],
  },
  {
    code: '05',
    name: 'Antioquia',
    capital: 'Medellín',
    municipalities: [
      { name: 'Medellín', zone: 'Alta', lat: 6.2442, lng: -75.5812 },
      { name: 'Bello', zone: 'Alta', lat: 6.3373, lng: -75.5579 },
      { name: 'Itagüí', zone: 'Alta', lat: 6.1846, lng: -75.5991 },
      { name: 'Envigado', zone: 'Alta', lat: 6.1667, lng: -75.5833 },
      { name: 'Sabaneta', zone: 'Alta', lat: 6.1517, lng: -75.6163 },
      { name: 'Rionegro', zone: 'Alta', lat: 6.1552, lng: -75.3737 },
      { name: 'Apartadó', zone: 'Alta', lat: 7.8828, lng: -76.6258 },
      { name: 'Turbo', zone: 'Alta', lat: 8.0927, lng: -76.7282 },
      { name: 'Caucasia', zone: 'Intermedia', lat: 7.9869, lng: -75.1936 },
      { name: 'Caldas', zone: 'Alta', lat: 6.0911, lng: -75.6358 },
      { name: 'La Estrella', zone: 'Alta', lat: 6.1583, lng: -75.6431 },
      { name: 'Copacabana', zone: 'Alta', lat: 6.3469, lng: -75.5097 },
      { name: 'Girardota', zone: 'Alta', lat: 6.3758, lng: -75.4467 },
      { name: 'Marinilla', zone: 'Alta', lat: 6.1753, lng: -75.3325 },
      { name: 'Guarne', zone: 'Alta', lat: 6.2803, lng: -75.4431 },
      { name: 'Santa Rosa de Osos', zone: 'Alta', lat: 6.6475, lng: -75.4608 },
      { name: 'Yarumal', zone: 'Alta', lat: 6.9631, lng: -75.4175 },
    ],
  },
  {
    code: '08',
    name: 'Atlántico',
    capital: 'Barranquilla',
    municipalities: [
      { name: 'Barranquilla', zone: 'Baja', lat: 10.9685, lng: -74.7813 },
      { name: 'Soledad', zone: 'Baja', lat: 10.9184, lng: -74.7646 },
      { name: 'Malambo', zone: 'Baja', lat: 10.8589, lng: -74.7739 },
      { name: 'Sabanalarga', zone: 'Baja', lat: 10.6331, lng: -74.9208 },
      { name: 'Puerto Colombia', zone: 'Baja', lat: 11.0189, lng: -74.9547 },
      { name: 'Galapa', zone: 'Baja', lat: 10.8986, lng: -74.8878 },
      { name: 'Baranoa', zone: 'Baja', lat: 10.7936, lng: -74.9164 },
    ],
  },
  {
    code: '13',
    name: 'Bolívar',
    capital: 'Cartagena',
    municipalities: [
      { name: 'Cartagena', zone: 'Baja', lat: 10.3997, lng: -75.5144 },
      { name: 'Magangué', zone: 'Baja', lat: 9.2428, lng: -74.7547 },
      { name: 'Turbaco', zone: 'Baja', lat: 10.3294, lng: -75.4128 },
      { name: 'Arjona', zone: 'Baja', lat: 10.2589, lng: -75.3444 },
      { name: 'El Carmen de Bolívar', zone: 'Baja', lat: 9.7183, lng: -75.1208 },
    ],
  },
  {
    code: '15',
    name: 'Boyacá',
    capital: 'Tunja',
    municipalities: [
      { name: 'Tunja', zone: 'Intermedia', lat: 5.5353, lng: -73.3678 },
      { name: 'Duitama', zone: 'Intermedia', lat: 5.8267, lng: -73.0336 },
      { name: 'Sogamoso', zone: 'Intermedia', lat: 5.7144, lng: -72.9339 },
      { name: 'Chiquinquirá', zone: 'Intermedia', lat: 5.6186, lng: -73.8164 },
      { name: 'Paipa', zone: 'Intermedia', lat: 5.7797, lng: -73.1169 },
      { name: 'Puerto Boyacá', zone: 'Alta', lat: 5.9758, lng: -74.5878 },
      { name: 'Villa de Leyva', zone: 'Intermedia', lat: 5.6322, lng: -73.5272 },
    ],
  },
  {
    code: '17',
    name: 'Caldas',
    capital: 'Manizales',
    municipalities: [
      { name: 'Manizales', zone: 'Alta', lat: 5.0689, lng: -75.5174 },
      { name: 'La Dorada', zone: 'Intermedia', lat: 5.4542, lng: -74.6644 },
      { name: 'Chinchiná', zone: 'Alta', lat: 5.0147, lng: -75.6047 },
      { name: 'Villamaría', zone: 'Alta', lat: 5.0456, lng: -75.5161 },
      { name: 'Anserma', zone: 'Alta', lat: 5.2344, lng: -75.7836 },
      { name: 'Riosucio', zone: 'Alta', lat: 5.4217, lng: -75.7033 },
    ],
  },
  {
    code: '18',
    name: 'Caquetá',
    capital: 'Florencia',
    municipalities: [
      { name: 'Florencia', zone: 'Intermedia', lat: 1.6144, lng: -75.6064 },
      { name: 'San Vicente del Caguán', zone: 'Intermedia', lat: 2.1122, lng: -74.7678 },
      { name: 'Belén de los Andaquíes', zone: 'Intermedia', lat: 1.4172, lng: -75.8775 },
    ],
  },
  {
    code: '19',
    name: 'Cauca',
    capital: 'Popayán',
    municipalities: [
      { name: 'Popayán', zone: 'Alta', lat: 2.4419, lng: -76.6064 },
      { name: 'Santander de Quilichao', zone: 'Alta', lat: 3.0094, lng: -76.4847 },
      { name: 'Puerto Tejada', zone: 'Alta', lat: 3.2308, lng: -76.4172 },
      { name: 'Patía', zone: 'Alta', lat: 2.0689, lng: -77.0519 },
    ],
  },
  {
    code: '20',
    name: 'Cesar',
    capital: 'Valledupar',
    municipalities: [
      { name: 'Valledupar', zone: 'Baja', lat: 10.4631, lng: -73.2532 },
      { name: 'Aguachica', zone: 'Intermedia', lat: 8.3075, lng: -73.6186 },
      { name: 'Agustín Codazzi', zone: 'Baja', lat: 10.0336, lng: -73.2358 },
      { name: 'Bosconia', zone: 'Baja', lat: 9.9739, lng: -73.8858 },
    ],
  },
  {
    code: '23',
    name: 'Córdoba',
    capital: 'Montería',
    municipalities: [
      { name: 'Montería', zone: 'Baja', lat: 8.7479, lng: -75.8814 },
      { name: 'Cereté', zone: 'Baja', lat: 8.8847, lng: -75.7917 },
      { name: 'Sahagún', zone: 'Baja', lat: 8.9472, lng: -75.4431 },
      { name: 'Lorica', zone: 'Baja', lat: 9.2392, lng: -75.8139 },
      { name: 'Montelíbano', zone: 'Intermedia', lat: 7.9786, lng: -75.4194 },
    ],
  },
  {
    code: '25',
    name: 'Cundinamarca',
    capital: 'Bogotá',
    municipalities: [
      { name: 'Soacha', zone: 'Intermedia', lat: 4.5794, lng: -74.2169 },
      { name: 'Facatativá', zone: 'Intermedia', lat: 4.8142, lng: -74.3547 },
      { name: 'Chía', zone: 'Intermedia', lat: 4.8617, lng: -74.0583 },
      { name: 'Zipaquirá', zone: 'Intermedia', lat: 5.0267, lng: -74.0039 },
      { name: 'Fusagasugá', zone: 'Intermedia', lat: 4.3375, lng: -74.3644 },
      { name: 'Mosquera', zone: 'Intermedia', lat: 4.7058, lng: -74.2303 },
      { name: 'Madrid', zone: 'Intermedia', lat: 4.7328, lng: -74.2644 },
      { name: 'Funza', zone: 'Intermedia', lat: 4.7164, lng: -74.2117 },
      { name: 'Girardot', zone: 'Intermedia', lat: 4.3014, lng: -74.8028 },
      { name: 'Cajicá', zone: 'Intermedia', lat: 4.9197, lng: -74.0272 },
      { name: 'Cota', zone: 'Intermedia', lat: 4.8094, lng: -74.1039 },
      { name: 'Tocancipá', zone: 'Intermedia', lat: 4.9669, lng: -73.9147 },
      { name: 'Sopó', zone: 'Intermedia', lat: 4.9083, lng: -73.9403 },
    ],
  },
  {
    code: '27',
    name: 'Chocó',
    capital: 'Quibdó',
    municipalities: [
      { name: 'Quibdó', zone: 'Alta', lat: 5.6947, lng: -76.6583 },
      { name: 'Istmina', zone: 'Alta', lat: 5.1583, lng: -76.6858 },
      { name: 'Condoto', zone: 'Alta', lat: 5.0947, lng: -76.6517 },
      { name: 'Tadó', zone: 'Alta', lat: 5.2678, lng: -76.5517 },
      { name: 'Bahía Solano', zone: 'Alta', lat: 6.2236, lng: -77.4042 },
    ],
  },
  {
    code: '41',
    name: 'Huila',
    capital: 'Neiva',
    municipalities: [
      { name: 'Neiva', zone: 'Alta', lat: 2.9273, lng: -75.2819 },
      { name: 'Pitalito', zone: 'Alta', lat: 1.8547, lng: -76.0494 },
      { name: 'Garzón', zone: 'Alta', lat: 2.1969, lng: -75.6278 },
      { name: 'La Plata', zone: 'Alta', lat: 2.3908, lng: -75.8925 },
      { name: 'Campoalegre', zone: 'Alta', lat: 2.6869, lng: -75.3258 },
    ],
  },
  {
    code: '44',
    name: 'La Guajira',
    capital: 'Riohacha',
    municipalities: [
      { name: 'Riohacha', zone: 'Baja', lat: 11.5444, lng: -72.9072 },
      { name: 'Maicao', zone: 'Baja', lat: 11.3783, lng: -72.2408 },
      { name: 'Uribia', zone: 'Baja', lat: 11.7139, lng: -72.2658 },
      { name: 'Fonseca', zone: 'Baja', lat: 10.6083, lng: -72.8483 },
      { name: 'San Juan del Cesar', zone: 'Baja', lat: 10.7711, lng: -73.0031 },
    ],
  },
  {
    code: '47',
    name: 'Magdalena',
    capital: 'Santa Marta',
    municipalities: [
      { name: 'Santa Marta', zone: 'Baja', lat: 11.2408, lng: -74.199 },
      { name: 'Ciénaga', zone: 'Baja', lat: 11.0067, lng: -74.2503 },
      { name: 'Fundación', zone: 'Baja', lat: 10.5189, lng: -74.1864 },
      { name: 'El Banco', zone: 'Baja', lat: 9.0017, lng: -73.9744 },
      { name: 'Plato', zone: 'Baja', lat: 9.7903, lng: -74.7825 },
    ],
  },
  {
    code: '50',
    name: 'Meta',
    capital: 'Villavicencio',
    municipalities: [
      { name: 'Villavicencio', zone: 'Alta', lat: 4.142, lng: -73.6266 },
      { name: 'Acacías', zone: 'Alta', lat: 3.9875, lng: -73.7578 },
      { name: 'Granada', zone: 'Alta', lat: 3.5469, lng: -73.7067 },
      { name: 'Puerto López', zone: 'Intermedia', lat: 4.0847, lng: -72.9558 },
      { name: 'Cumaral', zone: 'Alta', lat: 4.2708, lng: -73.4878 },
    ],
  },
  {
    code: '52',
    name: 'Nariño',
    capital: 'Pasto',
    municipalities: [
      { name: 'Pasto', zone: 'Alta', lat: 1.2136, lng: -77.2811 },
      { name: 'Tumaco', zone: 'Alta', lat: 1.7986, lng: -78.8156 },
      { name: 'Ipiales', zone: 'Alta', lat: 0.8247, lng: -77.6397 },
      { name: 'Túquerres', zone: 'Alta', lat: 1.0858, lng: -77.6186 },
      { name: 'La Unión', zone: 'Alta', lat: 1.6039, lng: -77.1317 },
    ],
  },
  {
    code: '54',
    name: 'Norte de Santander',
    capital: 'Cúcuta',
    municipalities: [
      { name: 'Cúcuta', zone: 'Alta', lat: 7.8939, lng: -72.5078 },
      { name: 'Ocaña', zone: 'Alta', lat: 8.2389, lng: -73.3556 },
      { name: 'Villa del Rosario', zone: 'Alta', lat: 7.8339, lng: -72.4742 },
      { name: 'Los Patios', zone: 'Alta', lat: 7.8428, lng: -72.5078 },
      { name: 'Pamplona', zone: 'Alta', lat: 7.3758, lng: -72.6481 },
      { name: 'Tibú', zone: 'Alta', lat: 8.6389, lng: -72.7358 },
    ],
  },
  {
    code: '63',
    name: 'Quindío',
    capital: 'Armenia',
    municipalities: [
      { name: 'Armenia', zone: 'Alta', lat: 4.5339, lng: -75.6811 },
      { name: 'Calarcá', zone: 'Alta', lat: 4.5303, lng: -75.6417 },
      { name: 'La Tebaida', zone: 'Alta', lat: 4.4539, lng: -75.7878 },
      { name: 'Circasia', zone: 'Alta', lat: 4.6186, lng: -75.6358 },
      { name: 'Montenegro', zone: 'Alta', lat: 4.5667, lng: -75.75 },
      { name: 'Quimbaya', zone: 'Alta', lat: 4.6231, lng: -75.7644 },
    ],
  },
  {
    code: '66',
    name: 'Risaralda',
    capital: 'Pereira',
    municipalities: [
      { name: 'Pereira', zone: 'Alta', lat: 4.8133, lng: -75.6961 },
      { name: 'Dosquebradas', zone: 'Alta', lat: 4.8344, lng: -75.6789 },
      { name: 'Santa Rosa de Cabal', zone: 'Alta', lat: 4.8697, lng: -75.6214 },
      { name: 'La Virginia', zone: 'Alta', lat: 4.9017, lng: -75.8828 },
      { name: 'Belén de Umbría', zone: 'Alta', lat: 5.2017, lng: -75.8678 },
    ],
  },
  {
    code: '68',
    name: 'Santander',
    capital: 'Bucaramanga',
    municipalities: [
      { name: 'Bucaramanga', zone: 'Alta', lat: 7.1254, lng: -73.1198 },
      { name: 'Floridablanca', zone: 'Alta', lat: 7.0622, lng: -73.0864 },
      { name: 'Girón', zone: 'Alta', lat: 7.0683, lng: -73.1697 },
      { name: 'Piedecuesta', zone: 'Alta', lat: 6.9881, lng: -73.0497 },
      { name: 'Barrancabermeja', zone: 'Intermedia', lat: 7.0653, lng: -73.8547 },
      { name: 'San Gil', zone: 'Alta', lat: 6.5558, lng: -73.1344 },
      { name: 'Socorro', zone: 'Alta', lat: 6.4678, lng: -73.2608 },
    ],
  },
  {
    code: '70',
    name: 'Sucre',
    capital: 'Sincelejo',
    municipalities: [
      { name: 'Sincelejo', zone: 'Baja', lat: 9.3047, lng: -75.3978 },
      { name: 'Corozal', zone: 'Baja', lat: 9.3175, lng: -75.2936 },
      { name: 'San Marcos', zone: 'Baja', lat: 8.6594, lng: -75.1328 },
      { name: 'San Onofre', zone: 'Baja', lat: 9.7358, lng: -75.5264 },
    ],
  },
  {
    code: '73',
    name: 'Tolima',
    capital: 'Ibagué',
    municipalities: [
      { name: 'Ibagué', zone: 'Alta', lat: 4.4389, lng: -75.2322 },
      { name: 'Espinal', zone: 'Alta', lat: 4.1492, lng: -74.8847 },
      { name: 'Melgar', zone: 'Intermedia', lat: 4.2047, lng: -74.6408 },
      { name: 'Chaparral', zone: 'Alta', lat: 3.7239, lng: -75.5833 },
      { name: 'Honda', zone: 'Intermedia', lat: 5.2069, lng: -74.7417 },
      { name: 'Mariquita', zone: 'Intermedia', lat: 5.1989, lng: -74.8967 },
      { name: 'Líbano', zone: 'Alta', lat: 4.9228, lng: -75.0631 },
    ],
  },
  {
    code: '76',
    name: 'Valle del Cauca',
    capital: 'Cali',
    municipalities: [
      { name: 'Cali', zone: 'Alta', lat: 3.4516, lng: -76.532 },
      { name: 'Buenaventura', zone: 'Alta', lat: 3.8839, lng: -77.0311 },
      { name: 'Palmira', zone: 'Alta', lat: 3.5394, lng: -76.3036 },
      { name: 'Tuluá', zone: 'Alta', lat: 4.0847, lng: -76.1958 },
      { name: 'Buga', zone: 'Alta', lat: 3.9008, lng: -76.2978 },
      { name: 'Cartago', zone: 'Alta', lat: 4.7469, lng: -75.9117 },
      { name: 'Jamundí', zone: 'Alta', lat: 3.2606, lng: -76.5419 },
      { name: 'Yumbo', zone: 'Alta', lat: 3.5828, lng: -76.4958 },
      { name: 'Candelaria', zone: 'Alta', lat: 3.4069, lng: -76.3486 },
      { name: 'Zarzal', zone: 'Alta', lat: 4.3986, lng: -76.0767 },
      { name: 'Sevilla', zone: 'Alta', lat: 4.2678, lng: -75.9328 },
    ],
  },
  {
    code: '81',
    name: 'Arauca',
    capital: 'Arauca',
    municipalities: [
      { name: 'Arauca', zone: 'Baja', lat: 7.0847, lng: -70.7589 },
      { name: 'Saravena', zone: 'Alta', lat: 6.9539, lng: -71.8758 },
      { name: 'Tame', zone: 'Alta', lat: 6.4608, lng: -71.7331 },
      { name: 'Arauquita', zone: 'Intermedia', lat: 7.0289, lng: -71.4289 },
    ],
  },
  {
    code: '85',
    name: 'Casanare',
    capital: 'Yopal',
    municipalities: [
      { name: 'Yopal', zone: 'Alta', lat: 5.3378, lng: -72.3958 },
      { name: 'Aguazul', zone: 'Alta', lat: 5.1728, lng: -72.5472 },
      { name: 'Villanueva', zone: 'Alta', lat: 4.6067, lng: -72.9286 },
      { name: 'Tauramena', zone: 'Alta', lat: 5.0169, lng: -72.7531 },
      { name: 'Paz de Ariporo', zone: 'Intermedia', lat: 5.8797, lng: -71.8906 },
    ],
  },
  {
    code: '86',
    name: 'Putumayo',
    capital: 'Mocoa',
    municipalities: [
      { name: 'Mocoa', zone: 'Alta', lat: 1.1528, lng: -76.6528 },
      { name: 'Puerto Asís', zone: 'Intermedia', lat: 0.5056, lng: -76.5008 },
      { name: 'Orito', zone: 'Alta', lat: 0.6678, lng: -76.8728 },
      { name: 'Valle del Guamuez', zone: 'Alta', lat: 0.4539, lng: -76.9189 },
    ],
  },
  {
    code: '88',
    name: 'San Andrés y Providencia',
    capital: 'San Andrés',
    municipalities: [
      { name: 'San Andrés', zone: 'Baja', lat: 12.5847, lng: -81.7006 },
      { name: 'Providencia', zone: 'Baja', lat: 13.3556, lng: -81.3719 },
    ],
  },
  {
    code: '91',
    name: 'Amazonas',
    capital: 'Leticia',
    municipalities: [
      { name: 'Leticia', zone: 'Baja', lat: -4.2153, lng: -69.9406 },
      { name: 'Puerto Nariño', zone: 'Baja', lat: -3.7711, lng: -70.3831 },
    ],
  },
  {
    code: '94',
    name: 'Guainía',
    capital: 'Inírida',
    municipalities: [
      { name: 'Inírida', zone: 'Baja', lat: 3.8653, lng: -67.9239 },
      { name: 'Barranco Minas', zone: 'Baja', lat: 3.6558, lng: -69.7917 },
    ],
  },
  {
    code: '95',
    name: 'Guaviare',
    capital: 'San José del Guaviare',
    municipalities: [
      { name: 'San José del Guaviare', zone: 'Baja', lat: 2.5728, lng: -72.6458 },
      { name: 'El Retorno', zone: 'Baja', lat: 2.3317, lng: -72.6289 },
      { name: 'Calamar', zone: 'Baja', lat: 1.9597, lng: -72.6531 },
    ],
  },
  {
    code: '97',
    name: 'Vaupés',
    capital: 'Mitú',
    municipalities: [
      { name: 'Mitú', zone: 'Baja', lat: 1.2583, lng: -70.2333 },
      { name: 'Carurú', zone: 'Baja', lat: 1.0167, lng: -71.2833 },
      { name: 'Taraira', zone: 'Baja', lat: -0.5333, lng: -69.6667 },
    ],
  },
  {
    code: '99',
    name: 'Vichada',
    capital: 'Puerto Carreño',
    municipalities: [
      { name: 'Puerto Carreño', zone: 'Baja', lat: 6.1889, lng: -67.4858 },
      { name: 'La Primavera', zone: 'Baja', lat: 5.4908, lng: -70.4092 },
      { name: 'Cumaribo', zone: 'Baja', lat: 4.4339, lng: -69.7958 },
      { name: 'Santa Rosalía', zone: 'Baja', lat: 5.1278, lng: -70.8761 },
    ],
  },
];

/**
 * Encuentra información de un municipio o departamento
 */
export function getMunicipalitiesByDepartment(departmentName: string): MunicipalityGeo[] {
  const normalized = departmentName.trim().toLowerCase();
  const dept = COLOMBIA_DEPARTMENTS.find(
    (d) =>
      d.name.toLowerCase() === normalized ||
      d.name.toLowerCase().includes(normalized) ||
      normalized.includes(d.name.toLowerCase())
  );
  return dept ? dept.municipalities : [];
}

export function findGeoByCity(
  cityName: string,
  departmentName?: string
): { dept: string; zone: SeismicZone; lat: number; lng: number } | null {
  const normCity = cityName.trim().toLowerCase();

  // Si se especifica departamento, buscar en él primero
  if (departmentName) {
    const municipalities = getMunicipalitiesByDepartment(departmentName);
    const match = municipalities.find((m) => m.name.toLowerCase() === normCity);
    if (match) {
      return {
        dept: departmentName,
        zone: match.zone,
        lat: match.lat,
        lng: match.lng,
      };
    }
  }

  // Buscar en todos los departamentos
  for (const dept of COLOMBIA_DEPARTMENTS) {
    const match = dept.municipalities.find((m) => m.name.toLowerCase() === normCity);
    if (match) {
      return {
        dept: dept.name,
        zone: match.zone,
        lat: match.lat,
        lng: match.lng,
      };
    }
  }

  return null;
}
