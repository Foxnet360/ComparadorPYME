/**
 * Catálogo Geográfico Nacional de Colombia (DIVIPOLA / DANE / NSR-10)
 * Cobertura oficial completa de los 32 departamentos y Bogotá D.C. (1.122 municipios)
 * Incluye clasificación de zona sísmica según NSR-10 y coordenadas centroides de referencia.
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
    "code": "91",
    "name": "Amazonas",
    "capital": "Leticia",
    "municipalities": [
      {
        "name": "El Encanto",
        "zone": "Baja",
        "lat": -1.7481,
        "lng": -73.2071
      },
      {
        "name": "La Chorrera",
        "zone": "Baja",
        "lat": -1.4426,
        "lng": -72.7919
      },
      {
        "name": "La Pedrera",
        "zone": "Baja",
        "lat": -1.3203,
        "lng": -69.5855
      },
      {
        "name": "La Victoria",
        "zone": "Baja",
        "lat": 0.0549,
        "lng": -71.2232
      },
      {
        "name": "Leticia",
        "zone": "Baja",
        "lat": -4.1989,
        "lng": -69.9417
      },
      {
        "name": "Mirití - Paraná",
        "zone": "Baja",
        "lat": -0.8888,
        "lng": -70.9889
      },
      {
        "name": "Puerto Alegría",
        "zone": "Baja",
        "lat": -1.0057,
        "lng": -74.0145
      },
      {
        "name": "Puerto Arica",
        "zone": "Baja",
        "lat": -2.147,
        "lng": -71.7522
      },
      {
        "name": "Puerto Nariño",
        "zone": "Baja",
        "lat": -3.7799,
        "lng": -70.3649
      },
      {
        "name": "Puerto Santander",
        "zone": "Baja",
        "lat": -0.6212,
        "lng": -72.3842
      },
      {
        "name": "Tarapacá",
        "zone": "Baja",
        "lat": -2.8901,
        "lng": -69.7417
      }
    ]
  },
  {
    "code": "05",
    "name": "Antioquia",
    "capital": "Medellín",
    "municipalities": [
      {
        "name": "Abejorral",
        "zone": "Alta",
        "lat": 5.7893,
        "lng": -75.4287
      },
      {
        "name": "Abriaquí",
        "zone": "Alta",
        "lat": 6.6323,
        "lng": -76.0643
      },
      {
        "name": "Alejandría",
        "zone": "Alta",
        "lat": 6.3761,
        "lng": -75.1413
      },
      {
        "name": "Amagá",
        "zone": "Alta",
        "lat": 6.0387,
        "lng": -75.7022
      },
      {
        "name": "Amalfi",
        "zone": "Alta",
        "lat": 6.9097,
        "lng": -75.0775
      },
      {
        "name": "Andes",
        "zone": "Alta",
        "lat": 5.6572,
        "lng": -75.8788
      },
      {
        "name": "Angelópolis",
        "zone": "Alta",
        "lat": 6.1097,
        "lng": -75.7114
      },
      {
        "name": "Angostura",
        "zone": "Alta",
        "lat": 6.8852,
        "lng": -75.3351
      },
      {
        "name": "Anorí",
        "zone": "Alta",
        "lat": 7.0747,
        "lng": -75.1484
      },
      {
        "name": "Anzá",
        "zone": "Alta",
        "lat": 6.3026,
        "lng": -75.8544
      },
      {
        "name": "Apartadó",
        "zone": "Alta",
        "lat": 7.883,
        "lng": -76.6253
      },
      {
        "name": "Arboletes",
        "zone": "Alta",
        "lat": 8.8493,
        "lng": -76.4267
      },
      {
        "name": "Argelia",
        "zone": "Alta",
        "lat": 5.7315,
        "lng": -75.1411
      },
      {
        "name": "Armenia",
        "zone": "Alta",
        "lat": 6.1557,
        "lng": -75.7866
      },
      {
        "name": "Barbosa",
        "zone": "Alta",
        "lat": 6.4392,
        "lng": -75.3316
      },
      {
        "name": "Bello",
        "zone": "Alta",
        "lat": 6.3336,
        "lng": -75.5552
      },
      {
        "name": "Belmira",
        "zone": "Alta",
        "lat": 6.6063,
        "lng": -75.6678
      },
      {
        "name": "Betania",
        "zone": "Alta",
        "lat": 5.7462,
        "lng": -75.9768
      },
      {
        "name": "Betulia",
        "zone": "Alta",
        "lat": 6.1152,
        "lng": -75.9845
      },
      {
        "name": "Briceño",
        "zone": "Alta",
        "lat": 7.1128,
        "lng": -75.5504
      },
      {
        "name": "Buriticá",
        "zone": "Alta",
        "lat": 6.7208,
        "lng": -75.907
      },
      {
        "name": "Caicedo",
        "zone": "Alta",
        "lat": 6.4056,
        "lng": -75.9829
      },
      {
        "name": "Caldas",
        "zone": "Alta",
        "lat": 6.0911,
        "lng": -75.6337
      },
      {
        "name": "Campamento",
        "zone": "Alta",
        "lat": 6.9798,
        "lng": -75.2981
      },
      {
        "name": "Caracolí",
        "zone": "Alta",
        "lat": 6.4098,
        "lng": -74.7574
      },
      {
        "name": "Caramanta",
        "zone": "Alta",
        "lat": 5.5485,
        "lng": -75.6439
      },
      {
        "name": "Carepa",
        "zone": "Alta",
        "lat": 7.7551,
        "lng": -76.6527
      },
      {
        "name": "Carolina",
        "zone": "Alta",
        "lat": 6.726,
        "lng": -75.2832
      },
      {
        "name": "Caucasia",
        "zone": "Intermedia",
        "lat": 7.9773,
        "lng": -75.198
      },
      {
        "name": "Cañasgordas",
        "zone": "Alta",
        "lat": 6.7539,
        "lng": -76.0282
      },
      {
        "name": "Chigorodó",
        "zone": "Alta",
        "lat": 7.6661,
        "lng": -76.6815
      },
      {
        "name": "Cisneros",
        "zone": "Alta",
        "lat": 6.5378,
        "lng": -75.087
      },
      {
        "name": "Ciudad Bolívar",
        "zone": "Alta",
        "lat": 5.8503,
        "lng": -76.0215
      },
      {
        "name": "Cocorná",
        "zone": "Alta",
        "lat": 6.0583,
        "lng": -75.1855
      },
      {
        "name": "Concepción",
        "zone": "Alta",
        "lat": 6.3943,
        "lng": -75.2576
      },
      {
        "name": "Concordia",
        "zone": "Alta",
        "lat": 6.0457,
        "lng": -75.9084
      },
      {
        "name": "Copacabana",
        "zone": "Alta",
        "lat": 6.3486,
        "lng": -75.5094
      },
      {
        "name": "Cáceres",
        "zone": "Alta",
        "lat": 7.5784,
        "lng": -75.3521
      },
      {
        "name": "Dabeiba",
        "zone": "Alta",
        "lat": 6.9981,
        "lng": -76.2616
      },
      {
        "name": "Donmatías",
        "zone": "Alta",
        "lat": 6.4856,
        "lng": -75.3926
      },
      {
        "name": "Ebéjico",
        "zone": "Alta",
        "lat": 6.3256,
        "lng": -75.7664
      },
      {
        "name": "El Bagre",
        "zone": "Alta",
        "lat": 7.5975,
        "lng": -74.7991
      },
      {
        "name": "El Carmen de Viboral",
        "zone": "Alta",
        "lat": 6.0829,
        "lng": -75.3339
      },
      {
        "name": "El Santuario",
        "zone": "Alta",
        "lat": 6.1369,
        "lng": -75.2655
      },
      {
        "name": "Entrerríos",
        "zone": "Alta",
        "lat": 6.5663,
        "lng": -75.5177
      },
      {
        "name": "Envigado",
        "zone": "Alta",
        "lat": 6.1667,
        "lng": -75.5822
      },
      {
        "name": "Fredonia",
        "zone": "Alta",
        "lat": 5.928,
        "lng": -75.6751
      },
      {
        "name": "Frontino",
        "zone": "Alta",
        "lat": 6.7761,
        "lng": -76.1308
      },
      {
        "name": "Giraldo",
        "zone": "Alta",
        "lat": 6.6808,
        "lng": -75.9522
      },
      {
        "name": "Girardota",
        "zone": "Alta",
        "lat": 6.3795,
        "lng": -75.4442
      },
      {
        "name": "Granada",
        "zone": "Alta",
        "lat": 6.1429,
        "lng": -75.1844
      },
      {
        "name": "Guadalupe",
        "zone": "Alta",
        "lat": 6.8151,
        "lng": -75.2399
      },
      {
        "name": "Guarne",
        "zone": "Alta",
        "lat": 6.2779,
        "lng": -75.4416
      },
      {
        "name": "Guatapé",
        "zone": "Alta",
        "lat": 6.2325,
        "lng": -75.16
      },
      {
        "name": "Gómez Plata",
        "zone": "Alta",
        "lat": 6.6833,
        "lng": -75.22
      },
      {
        "name": "Heliconia",
        "zone": "Alta",
        "lat": 6.2068,
        "lng": -75.7343
      },
      {
        "name": "Hispania",
        "zone": "Alta",
        "lat": 5.7995,
        "lng": -75.9066
      },
      {
        "name": "Itagüí",
        "zone": "Alta",
        "lat": 6.1751,
        "lng": -75.6121
      },
      {
        "name": "Ituango",
        "zone": "Alta",
        "lat": 7.1716,
        "lng": -75.7647
      },
      {
        "name": "Jardín",
        "zone": "Alta",
        "lat": 5.5975,
        "lng": -75.819
      },
      {
        "name": "Jericó",
        "zone": "Alta",
        "lat": 5.7897,
        "lng": -75.7855
      },
      {
        "name": "La Ceja",
        "zone": "Alta",
        "lat": 6.0281,
        "lng": -75.4294
      },
      {
        "name": "La Estrella",
        "zone": "Alta",
        "lat": 6.1452,
        "lng": -75.6377
      },
      {
        "name": "La Pintada",
        "zone": "Alta",
        "lat": 5.7438,
        "lng": -75.6078
      },
      {
        "name": "La Unión",
        "zone": "Alta",
        "lat": 5.9738,
        "lng": -75.3609
      },
      {
        "name": "Liborina",
        "zone": "Alta",
        "lat": 6.6773,
        "lng": -75.8128
      },
      {
        "name": "Maceo",
        "zone": "Alta",
        "lat": 6.5521,
        "lng": -74.7872
      },
      {
        "name": "Marinilla",
        "zone": "Alta",
        "lat": 6.174,
        "lng": -75.3393
      },
      {
        "name": "Medellín",
        "zone": "Alta",
        "lat": 6.2466,
        "lng": -75.5818
      },
      {
        "name": "Montebello",
        "zone": "Alta",
        "lat": 5.9463,
        "lng": -75.5235
      },
      {
        "name": "Murindó",
        "zone": "Alta",
        "lat": 6.9777,
        "lng": -76.8175
      },
      {
        "name": "Mutatá",
        "zone": "Alta",
        "lat": 7.2429,
        "lng": -76.4359
      },
      {
        "name": "Nariño",
        "zone": "Alta",
        "lat": 5.6108,
        "lng": -75.1763
      },
      {
        "name": "Nechí",
        "zone": "Alta",
        "lat": 8.0941,
        "lng": -74.7765
      },
      {
        "name": "Necoclí",
        "zone": "Alta",
        "lat": 8.4345,
        "lng": -76.7873
      },
      {
        "name": "Olaya",
        "zone": "Alta",
        "lat": 6.6265,
        "lng": -75.8118
      },
      {
        "name": "Peque",
        "zone": "Alta",
        "lat": 7.021,
        "lng": -75.9104
      },
      {
        "name": "Peñol",
        "zone": "Alta",
        "lat": 6.2193,
        "lng": -75.2427
      },
      {
        "name": "Pueblorrico",
        "zone": "Alta",
        "lat": 5.7916,
        "lng": -75.8399
      },
      {
        "name": "Puerto Berrío",
        "zone": "Alta",
        "lat": 6.487,
        "lng": -74.41
      },
      {
        "name": "Puerto Nare",
        "zone": "Alta",
        "lat": 6.186,
        "lng": -74.583
      },
      {
        "name": "Puerto Triunfo",
        "zone": "Alta",
        "lat": 5.8713,
        "lng": -74.6412
      },
      {
        "name": "Remedios",
        "zone": "Alta",
        "lat": 7.0294,
        "lng": -74.6981
      },
      {
        "name": "Retiro",
        "zone": "Alta",
        "lat": 6.0625,
        "lng": -75.5013
      },
      {
        "name": "Rionegro",
        "zone": "Alta",
        "lat": 6.1471,
        "lng": -75.3773
      },
      {
        "name": "Sabanalarga",
        "zone": "Baja",
        "lat": 6.85,
        "lng": -75.8166
      },
      {
        "name": "Sabaneta",
        "zone": "Alta",
        "lat": 6.1499,
        "lng": -75.6155
      },
      {
        "name": "Salgar",
        "zone": "Alta",
        "lat": 5.9642,
        "lng": -75.9768
      },
      {
        "name": "San Andrés de Cuerquía",
        "zone": "Alta",
        "lat": 6.9167,
        "lng": -75.6746
      },
      {
        "name": "San Carlos",
        "zone": "Alta",
        "lat": 6.1877,
        "lng": -74.9881
      },
      {
        "name": "San Francisco",
        "zone": "Alta",
        "lat": 5.9635,
        "lng": -75.1016
      },
      {
        "name": "San Jerónimo",
        "zone": "Alta",
        "lat": 6.4481,
        "lng": -75.727
      },
      {
        "name": "San José de la Montaña",
        "zone": "Alta",
        "lat": 6.8501,
        "lng": -75.6834
      },
      {
        "name": "San Juan de Urabá",
        "zone": "Alta",
        "lat": 8.759,
        "lng": -76.5286
      },
      {
        "name": "San Luis",
        "zone": "Alta",
        "lat": 6.043,
        "lng": -74.9936
      },
      {
        "name": "San Pedro de Urabá",
        "zone": "Alta",
        "lat": 8.2769,
        "lng": -76.3806
      },
      {
        "name": "San Pedro de los Milagros",
        "zone": "Alta",
        "lat": 6.4601,
        "lng": -75.5567
      },
      {
        "name": "San Rafael",
        "zone": "Alta",
        "lat": 6.2938,
        "lng": -75.0285
      },
      {
        "name": "San Roque",
        "zone": "Alta",
        "lat": 6.4859,
        "lng": -75.0191
      },
      {
        "name": "San Vicente Ferrer",
        "zone": "Alta",
        "lat": 6.2822,
        "lng": -75.3326
      },
      {
        "name": "Santa Bárbara",
        "zone": "Alta",
        "lat": 5.8755,
        "lng": -75.5674
      },
      {
        "name": "Santa Fé de Antioquia",
        "zone": "Alta",
        "lat": 6.5565,
        "lng": -75.8266
      },
      {
        "name": "Santa Rosa de Osos",
        "zone": "Alta",
        "lat": 6.6434,
        "lng": -75.4607
      },
      {
        "name": "Santo Domingo",
        "zone": "Alta",
        "lat": 6.473,
        "lng": -75.1649
      },
      {
        "name": "Segovia",
        "zone": "Alta",
        "lat": 7.0796,
        "lng": -74.7016
      },
      {
        "name": "Sonsón",
        "zone": "Alta",
        "lat": 5.7149,
        "lng": -75.3096
      },
      {
        "name": "Sopetrán",
        "zone": "Alta",
        "lat": 6.5007,
        "lng": -75.7474
      },
      {
        "name": "Tarazá",
        "zone": "Alta",
        "lat": 7.5801,
        "lng": -75.4014
      },
      {
        "name": "Tarso",
        "zone": "Alta",
        "lat": 5.8645,
        "lng": -75.823
      },
      {
        "name": "Titiribí",
        "zone": "Alta",
        "lat": 6.0624,
        "lng": -75.7919
      },
      {
        "name": "Toledo",
        "zone": "Alta",
        "lat": 7.0103,
        "lng": -75.6923
      },
      {
        "name": "Turbo",
        "zone": "Alta",
        "lat": 8.0899,
        "lng": -76.7289
      },
      {
        "name": "Támesis",
        "zone": "Alta",
        "lat": 5.6646,
        "lng": -75.7144
      },
      {
        "name": "Uramita",
        "zone": "Alta",
        "lat": 6.8984,
        "lng": -76.1733
      },
      {
        "name": "Urrao",
        "zone": "Alta",
        "lat": 6.3173,
        "lng": -76.134
      },
      {
        "name": "Valdivia",
        "zone": "Alta",
        "lat": 7.1652,
        "lng": -75.4393
      },
      {
        "name": "Valparaíso",
        "zone": "Alta",
        "lat": 5.6146,
        "lng": -75.6245
      },
      {
        "name": "Vegachí",
        "zone": "Alta",
        "lat": 6.7735,
        "lng": -74.7987
      },
      {
        "name": "Venecia",
        "zone": "Alta",
        "lat": 5.9647,
        "lng": -75.7355
      },
      {
        "name": "Vigía del Fuerte",
        "zone": "Alta",
        "lat": 6.5882,
        "lng": -76.896
      },
      {
        "name": "Yalí",
        "zone": "Alta",
        "lat": 6.6766,
        "lng": -74.8401
      },
      {
        "name": "Yarumal",
        "zone": "Alta",
        "lat": 6.9638,
        "lng": -75.4188
      },
      {
        "name": "Yolombó",
        "zone": "Alta",
        "lat": 6.5945,
        "lng": -75.0134
      },
      {
        "name": "Yondó",
        "zone": "Alta",
        "lat": 7.004,
        "lng": -73.9124
      },
      {
        "name": "Zaragoza",
        "zone": "Alta",
        "lat": 7.4886,
        "lng": -74.8671
      }
    ]
  },
  {
    "code": "81",
    "name": "Arauca",
    "capital": "Arauca",
    "municipalities": [
      {
        "name": "Arauca",
        "zone": "Baja",
        "lat": 7.0727,
        "lng": -70.7474
      },
      {
        "name": "Arauquita",
        "zone": "Intermedia",
        "lat": 7.027,
        "lng": -71.4267
      },
      {
        "name": "Cravo Norte",
        "zone": "Intermedia",
        "lat": 6.3039,
        "lng": -70.2043
      },
      {
        "name": "Fortul",
        "zone": "Intermedia",
        "lat": 6.7967,
        "lng": -71.7688
      },
      {
        "name": "Puerto Rondón",
        "zone": "Intermedia",
        "lat": 6.2815,
        "lng": -71.1034
      },
      {
        "name": "Saravena",
        "zone": "Alta",
        "lat": 6.9539,
        "lng": -71.8728
      },
      {
        "name": "Tame",
        "zone": "Alta",
        "lat": 6.4533,
        "lng": -71.7544
      }
    ]
  },
  {
    "code": "08",
    "name": "Atlántico",
    "capital": "Barranquilla",
    "municipalities": [
      {
        "name": "Baranoa",
        "zone": "Baja",
        "lat": 10.7944,
        "lng": -74.9161
      },
      {
        "name": "Barranquilla",
        "zone": "Baja",
        "lat": 10.978,
        "lng": -74.8155
      },
      {
        "name": "Campo de la Cruz",
        "zone": "Baja",
        "lat": 10.3783,
        "lng": -74.8808
      },
      {
        "name": "Candelaria",
        "zone": "Alta",
        "lat": 10.4619,
        "lng": -74.8797
      },
      {
        "name": "Galapa",
        "zone": "Baja",
        "lat": 10.919,
        "lng": -74.8704
      },
      {
        "name": "Juan de Acosta",
        "zone": "Baja",
        "lat": 10.8325,
        "lng": -75.041
      },
      {
        "name": "Luruaco",
        "zone": "Baja",
        "lat": 10.6105,
        "lng": -75.142
      },
      {
        "name": "Malambo",
        "zone": "Baja",
        "lat": 10.8571,
        "lng": -74.7769
      },
      {
        "name": "Manatí",
        "zone": "Baja",
        "lat": 10.4491,
        "lng": -74.9569
      },
      {
        "name": "Palmar de Varela",
        "zone": "Baja",
        "lat": 10.7386,
        "lng": -74.7548
      },
      {
        "name": "Piojó",
        "zone": "Baja",
        "lat": 10.7492,
        "lng": -75.1076
      },
      {
        "name": "Polonuevo",
        "zone": "Baja",
        "lat": 10.7774,
        "lng": -74.853
      },
      {
        "name": "Ponedera",
        "zone": "Baja",
        "lat": 10.6418,
        "lng": -74.7539
      },
      {
        "name": "Puerto Colombia",
        "zone": "Baja",
        "lat": 11.0153,
        "lng": -74.8886
      },
      {
        "name": "Repelón",
        "zone": "Baja",
        "lat": 10.4934,
        "lng": -75.1255
      },
      {
        "name": "Sabanagrande",
        "zone": "Baja",
        "lat": 10.7925,
        "lng": -74.7595
      },
      {
        "name": "Sabanalarga",
        "zone": "Baja",
        "lat": 10.6321,
        "lng": -74.9213
      },
      {
        "name": "Santa Lucía",
        "zone": "Baja",
        "lat": 10.3243,
        "lng": -74.9592
      },
      {
        "name": "Santo Tomás",
        "zone": "Baja",
        "lat": 10.7587,
        "lng": -74.7579
      },
      {
        "name": "Soledad",
        "zone": "Baja",
        "lat": 10.9099,
        "lng": -74.7861
      },
      {
        "name": "Suan",
        "zone": "Baja",
        "lat": 10.3354,
        "lng": -74.8817
      },
      {
        "name": "Tubará",
        "zone": "Baja",
        "lat": 10.8736,
        "lng": -74.9787
      },
      {
        "name": "Usiacurí",
        "zone": "Baja",
        "lat": 10.743,
        "lng": -74.977
      }
    ]
  },
  {
    "code": "11",
    "name": "Bogotá D.C.",
    "capital": "Bogotá",
    "municipalities": [
      {
        "name": "Bogotá D.C.",
        "zone": "Intermedia",
        "lat": 4.6493,
        "lng": -74.107
      }
    ]
  },
  {
    "code": "13",
    "name": "Bolívar",
    "capital": "Cartagena",
    "municipalities": [
      {
        "name": "Achí",
        "zone": "Baja",
        "lat": 8.5701,
        "lng": -74.5577
      },
      {
        "name": "Altos del Rosario",
        "zone": "Baja",
        "lat": 8.7919,
        "lng": -74.1649
      },
      {
        "name": "Arenal",
        "zone": "Baja",
        "lat": 8.4589,
        "lng": -73.9411
      },
      {
        "name": "Arjona",
        "zone": "Baja",
        "lat": 10.2567,
        "lng": -75.3443
      },
      {
        "name": "Arroyohondo",
        "zone": "Baja",
        "lat": 10.2501,
        "lng": -75.0192
      },
      {
        "name": "Barranco de Loba",
        "zone": "Baja",
        "lat": 8.9478,
        "lng": -74.1044
      },
      {
        "name": "Calamar",
        "zone": "Baja",
        "lat": 10.2504,
        "lng": -74.9161
      },
      {
        "name": "Cantagallo",
        "zone": "Baja",
        "lat": 7.3787,
        "lng": -73.9146
      },
      {
        "name": "Cartagena de Indias",
        "zone": "Baja",
        "lat": 10.3851,
        "lng": -75.4963
      },
      {
        "name": "Cicuco",
        "zone": "Baja",
        "lat": 9.2743,
        "lng": -74.646
      },
      {
        "name": "Clemencia",
        "zone": "Baja",
        "lat": 10.5675,
        "lng": -75.3285
      },
      {
        "name": "Córdoba",
        "zone": "Baja",
        "lat": 9.5869,
        "lng": -74.8274
      },
      {
        "name": "El Carmen de Bolívar",
        "zone": "Baja",
        "lat": 9.7187,
        "lng": -75.1212
      },
      {
        "name": "El Guamo",
        "zone": "Baja",
        "lat": 10.031,
        "lng": -74.9761
      },
      {
        "name": "El Peñón",
        "zone": "Baja",
        "lat": 8.9883,
        "lng": -73.9493
      },
      {
        "name": "Hatillo de Loba",
        "zone": "Baja",
        "lat": 8.956,
        "lng": -74.0779
      },
      {
        "name": "Magangué",
        "zone": "Baja",
        "lat": 9.2638,
        "lng": -74.7667
      },
      {
        "name": "Mahates",
        "zone": "Baja",
        "lat": 10.2333,
        "lng": -75.1916
      },
      {
        "name": "Margarita",
        "zone": "Baja",
        "lat": 9.1578,
        "lng": -74.2851
      },
      {
        "name": "María la Baja",
        "zone": "Baja",
        "lat": 9.9824,
        "lng": -75.3005
      },
      {
        "name": "Montecristo",
        "zone": "Baja",
        "lat": 8.2972,
        "lng": -74.4712
      },
      {
        "name": "Morales",
        "zone": "Baja",
        "lat": 8.2766,
        "lng": -73.8682
      },
      {
        "name": "Norosí",
        "zone": "Baja",
        "lat": 8.5263,
        "lng": -74.038
      },
      {
        "name": "Pinillos",
        "zone": "Baja",
        "lat": 8.9149,
        "lng": -74.4623
      },
      {
        "name": "Regidor",
        "zone": "Baja",
        "lat": 8.6663,
        "lng": -73.8216
      },
      {
        "name": "Río Viejo",
        "zone": "Baja",
        "lat": 8.5879,
        "lng": -73.8405
      },
      {
        "name": "San Cristóbal",
        "zone": "Baja",
        "lat": 10.3928,
        "lng": -75.0651
      },
      {
        "name": "San Estanislao",
        "zone": "Baja",
        "lat": 10.3986,
        "lng": -75.1531
      },
      {
        "name": "San Fernando",
        "zone": "Baja",
        "lat": 9.2142,
        "lng": -74.3238
      },
      {
        "name": "San Jacinto",
        "zone": "Baja",
        "lat": 9.8303,
        "lng": -75.121
      },
      {
        "name": "San Jacinto del Cauca",
        "zone": "Baja",
        "lat": 8.2516,
        "lng": -74.7212
      },
      {
        "name": "San Juan Nepomuceno",
        "zone": "Baja",
        "lat": 9.9538,
        "lng": -75.0818
      },
      {
        "name": "San Martín de Loba",
        "zone": "Baja",
        "lat": 8.9375,
        "lng": -74.0391
      },
      {
        "name": "San Pablo",
        "zone": "Baja",
        "lat": 7.4767,
        "lng": -73.9246
      },
      {
        "name": "Santa Catalina",
        "zone": "Baja",
        "lat": 10.6053,
        "lng": -75.2879
      },
      {
        "name": "Santa Cruz de Mompox",
        "zone": "Baja",
        "lat": 9.2442,
        "lng": -74.4282
      },
      {
        "name": "Santa Rosa",
        "zone": "Baja",
        "lat": 10.4444,
        "lng": -75.3698
      },
      {
        "name": "Santa Rosa del Sur",
        "zone": "Baja",
        "lat": 7.9639,
        "lng": -74.0522
      },
      {
        "name": "Simití",
        "zone": "Baja",
        "lat": 7.9539,
        "lng": -73.9473
      },
      {
        "name": "Soplaviento",
        "zone": "Baja",
        "lat": 10.3884,
        "lng": -75.1364
      },
      {
        "name": "Talaigua Nuevo",
        "zone": "Baja",
        "lat": 9.304,
        "lng": -74.5675
      },
      {
        "name": "Tiquisio",
        "zone": "Baja",
        "lat": 8.5587,
        "lng": -74.2629
      },
      {
        "name": "Turbaco",
        "zone": "Baja",
        "lat": 10.3483,
        "lng": -75.4272
      },
      {
        "name": "Turbaná",
        "zone": "Baja",
        "lat": 10.2746,
        "lng": -75.4427
      },
      {
        "name": "Villanueva",
        "zone": "Alta",
        "lat": 10.4441,
        "lng": -75.2756
      },
      {
        "name": "Zambrano",
        "zone": "Baja",
        "lat": 9.7463,
        "lng": -74.8179
      }
    ]
  },
  {
    "code": "15",
    "name": "Boyacá",
    "capital": "Tunja",
    "municipalities": [
      {
        "name": "Almeida",
        "zone": "Intermedia",
        "lat": 4.9709,
        "lng": -73.3789
      },
      {
        "name": "Aquitania",
        "zone": "Intermedia",
        "lat": 5.5186,
        "lng": -72.884
      },
      {
        "name": "Arcabuco",
        "zone": "Intermedia",
        "lat": 5.7557,
        "lng": -73.4375
      },
      {
        "name": "Belén",
        "zone": "Intermedia",
        "lat": 5.9892,
        "lng": -72.9116
      },
      {
        "name": "Berbeo",
        "zone": "Intermedia",
        "lat": 5.2275,
        "lng": -73.1272
      },
      {
        "name": "Betéitiva",
        "zone": "Intermedia",
        "lat": 5.91,
        "lng": -72.809
      },
      {
        "name": "Boavita",
        "zone": "Intermedia",
        "lat": 6.3307,
        "lng": -72.5849
      },
      {
        "name": "Boyacá",
        "zone": "Intermedia",
        "lat": 5.4546,
        "lng": -73.3619
      },
      {
        "name": "Briceño",
        "zone": "Intermedia",
        "lat": 5.6909,
        "lng": -73.9233
      },
      {
        "name": "Buenavista",
        "zone": "Intermedia",
        "lat": 5.5126,
        "lng": -73.9422
      },
      {
        "name": "Busbanzá",
        "zone": "Intermedia",
        "lat": 5.8314,
        "lng": -72.8842
      },
      {
        "name": "Caldas",
        "zone": "Alta",
        "lat": 5.5546,
        "lng": -73.8656
      },
      {
        "name": "Campohermoso",
        "zone": "Intermedia",
        "lat": 5.0317,
        "lng": -73.1042
      },
      {
        "name": "Cerinza",
        "zone": "Intermedia",
        "lat": 5.9559,
        "lng": -72.9479
      },
      {
        "name": "Chinavita",
        "zone": "Intermedia",
        "lat": 5.1675,
        "lng": -73.3685
      },
      {
        "name": "Chiquinquirá",
        "zone": "Intermedia",
        "lat": 5.6138,
        "lng": -73.8187
      },
      {
        "name": "Chiscas",
        "zone": "Intermedia",
        "lat": 6.5531,
        "lng": -72.501
      },
      {
        "name": "Chita",
        "zone": "Intermedia",
        "lat": 6.1871,
        "lng": -72.4719
      },
      {
        "name": "Chitaraque",
        "zone": "Intermedia",
        "lat": 6.0274,
        "lng": -73.4471
      },
      {
        "name": "Chivatá",
        "zone": "Intermedia",
        "lat": 5.5589,
        "lng": -73.2825
      },
      {
        "name": "Chivor",
        "zone": "Intermedia",
        "lat": 4.8882,
        "lng": -73.3684
      },
      {
        "name": "Chíquiza",
        "zone": "Intermedia",
        "lat": 5.6398,
        "lng": -73.4495
      },
      {
        "name": "Ciénega",
        "zone": "Intermedia",
        "lat": 5.4087,
        "lng": -73.296
      },
      {
        "name": "Coper",
        "zone": "Intermedia",
        "lat": 5.4751,
        "lng": -74.0456
      },
      {
        "name": "Corrales",
        "zone": "Intermedia",
        "lat": 5.8281,
        "lng": -72.8448
      },
      {
        "name": "Covarachía",
        "zone": "Intermedia",
        "lat": 6.5002,
        "lng": -72.739
      },
      {
        "name": "Cubará",
        "zone": "Intermedia",
        "lat": 6.9973,
        "lng": -72.1079
      },
      {
        "name": "Cucaita",
        "zone": "Intermedia",
        "lat": 5.5445,
        "lng": -73.4543
      },
      {
        "name": "Cuítiva",
        "zone": "Intermedia",
        "lat": 5.5804,
        "lng": -72.9659
      },
      {
        "name": "Cómbita",
        "zone": "Intermedia",
        "lat": 5.6345,
        "lng": -73.324
      },
      {
        "name": "Duitama",
        "zone": "Intermedia",
        "lat": 5.823,
        "lng": -73.0306
      },
      {
        "name": "El Cocuy",
        "zone": "Intermedia",
        "lat": 6.4077,
        "lng": -72.4445
      },
      {
        "name": "El Espino",
        "zone": "Intermedia",
        "lat": 6.483,
        "lng": -72.497
      },
      {
        "name": "Firavitoba",
        "zone": "Intermedia",
        "lat": 5.6689,
        "lng": -72.9934
      },
      {
        "name": "Floresta",
        "zone": "Intermedia",
        "lat": 5.8595,
        "lng": -72.9181
      },
      {
        "name": "Gachantivá",
        "zone": "Intermedia",
        "lat": 5.7519,
        "lng": -73.5491
      },
      {
        "name": "Garagoa",
        "zone": "Intermedia",
        "lat": 5.0832,
        "lng": -73.3644
      },
      {
        "name": "Guacamayas",
        "zone": "Intermedia",
        "lat": 6.4597,
        "lng": -72.5008
      },
      {
        "name": "Guateque",
        "zone": "Intermedia",
        "lat": 5.0073,
        "lng": -73.4712
      },
      {
        "name": "Guayatá",
        "zone": "Intermedia",
        "lat": 4.9671,
        "lng": -73.4897
      },
      {
        "name": "Gámeza",
        "zone": "Intermedia",
        "lat": 5.8023,
        "lng": -72.8055
      },
      {
        "name": "Güicán de la Sierra",
        "zone": "Intermedia",
        "lat": 6.4629,
        "lng": -72.4118
      },
      {
        "name": "Iza",
        "zone": "Intermedia",
        "lat": 5.6116,
        "lng": -72.9796
      },
      {
        "name": "Jenesano",
        "zone": "Intermedia",
        "lat": 5.3858,
        "lng": -73.3637
      },
      {
        "name": "Jericó",
        "zone": "Intermedia",
        "lat": 6.1457,
        "lng": -72.5711
      },
      {
        "name": "La Capilla",
        "zone": "Intermedia",
        "lat": 5.0957,
        "lng": -73.4443
      },
      {
        "name": "La Uvita",
        "zone": "Intermedia",
        "lat": 6.3162,
        "lng": -72.56
      },
      {
        "name": "La Victoria",
        "zone": "Intermedia",
        "lat": 5.5238,
        "lng": -74.2344
      },
      {
        "name": "Labranzagrande",
        "zone": "Intermedia",
        "lat": 5.5627,
        "lng": -72.5778
      },
      {
        "name": "Macanal",
        "zone": "Intermedia",
        "lat": 4.9725,
        "lng": -73.3196
      },
      {
        "name": "Maripí",
        "zone": "Intermedia",
        "lat": 5.5501,
        "lng": -74.0041
      },
      {
        "name": "Miraflores",
        "zone": "Intermedia",
        "lat": 5.1965,
        "lng": -73.1456
      },
      {
        "name": "Mongua",
        "zone": "Intermedia",
        "lat": 5.7542,
        "lng": -72.7981
      },
      {
        "name": "Monguí",
        "zone": "Intermedia",
        "lat": 5.7235,
        "lng": -72.8493
      },
      {
        "name": "Moniquirá",
        "zone": "Intermedia",
        "lat": 5.8763,
        "lng": -73.5734
      },
      {
        "name": "Motavita",
        "zone": "Intermedia",
        "lat": 5.5777,
        "lng": -73.3678
      },
      {
        "name": "Muzo",
        "zone": "Intermedia",
        "lat": 5.5328,
        "lng": -74.1027
      },
      {
        "name": "Nobsa",
        "zone": "Intermedia",
        "lat": 5.768,
        "lng": -72.937
      },
      {
        "name": "Nuevo Colón",
        "zone": "Intermedia",
        "lat": 5.3553,
        "lng": -73.4568
      },
      {
        "name": "Oicatá",
        "zone": "Intermedia",
        "lat": 5.5952,
        "lng": -73.3084
      },
      {
        "name": "Otanche",
        "zone": "Intermedia",
        "lat": 5.6575,
        "lng": -74.181
      },
      {
        "name": "Pachavita",
        "zone": "Intermedia",
        "lat": 5.1401,
        "lng": -73.397
      },
      {
        "name": "Paipa",
        "zone": "Intermedia",
        "lat": 5.7799,
        "lng": -73.1178
      },
      {
        "name": "Pajarito",
        "zone": "Intermedia",
        "lat": 5.2938,
        "lng": -72.7032
      },
      {
        "name": "Panqueba",
        "zone": "Intermedia",
        "lat": 6.4434,
        "lng": -72.4594
      },
      {
        "name": "Pauna",
        "zone": "Intermedia",
        "lat": 5.6563,
        "lng": -73.9784
      },
      {
        "name": "Paya",
        "zone": "Intermedia",
        "lat": 5.6257,
        "lng": -72.4238
      },
      {
        "name": "Paz de Río",
        "zone": "Intermedia",
        "lat": 5.9876,
        "lng": -72.7491
      },
      {
        "name": "Pesca",
        "zone": "Intermedia",
        "lat": 5.5588,
        "lng": -73.0509
      },
      {
        "name": "Pisba",
        "zone": "Intermedia",
        "lat": 5.7214,
        "lng": -72.486
      },
      {
        "name": "Puerto Boyacá",
        "zone": "Alta",
        "lat": 5.9766,
        "lng": -74.5878
      },
      {
        "name": "Páez",
        "zone": "Intermedia",
        "lat": 5.0973,
        "lng": -73.0527
      },
      {
        "name": "Quípama",
        "zone": "Intermedia",
        "lat": 5.5206,
        "lng": -74.18
      },
      {
        "name": "Ramiriquí",
        "zone": "Intermedia",
        "lat": 5.4003,
        "lng": -73.3348
      },
      {
        "name": "Rondón",
        "zone": "Intermedia",
        "lat": 5.3574,
        "lng": -73.2085
      },
      {
        "name": "Ráquira",
        "zone": "Intermedia",
        "lat": 5.5391,
        "lng": -73.6325
      },
      {
        "name": "Saboyá",
        "zone": "Intermedia",
        "lat": 5.6978,
        "lng": -73.7645
      },
      {
        "name": "Samacá",
        "zone": "Intermedia",
        "lat": 5.4922,
        "lng": -73.4856
      },
      {
        "name": "San Eduardo",
        "zone": "Intermedia",
        "lat": 5.224,
        "lng": -73.0777
      },
      {
        "name": "San José de Pare",
        "zone": "Intermedia",
        "lat": 6.0189,
        "lng": -73.5454
      },
      {
        "name": "San Luis de Gaceno",
        "zone": "Intermedia",
        "lat": 4.8198,
        "lng": -73.1681
      },
      {
        "name": "San Mateo",
        "zone": "Intermedia",
        "lat": 6.4017,
        "lng": -72.5553
      },
      {
        "name": "San Miguel de Sema",
        "zone": "Intermedia",
        "lat": 5.5181,
        "lng": -73.722
      },
      {
        "name": "San Pablo de Borbur",
        "zone": "Intermedia",
        "lat": 5.6507,
        "lng": -74.07
      },
      {
        "name": "Santa María",
        "zone": "Intermedia",
        "lat": 4.8572,
        "lng": -73.2635
      },
      {
        "name": "Santa Rosa de Viterbo",
        "zone": "Intermedia",
        "lat": 5.8745,
        "lng": -72.9825
      },
      {
        "name": "Santa Sofía",
        "zone": "Intermedia",
        "lat": 5.7133,
        "lng": -73.6027
      },
      {
        "name": "Santana",
        "zone": "Intermedia",
        "lat": 6.0569,
        "lng": -73.4816
      },
      {
        "name": "Sativanorte",
        "zone": "Intermedia",
        "lat": 6.1311,
        "lng": -72.7085
      },
      {
        "name": "Sativasur",
        "zone": "Intermedia",
        "lat": 6.0932,
        "lng": -72.7124
      },
      {
        "name": "Siachoque",
        "zone": "Intermedia",
        "lat": 5.5118,
        "lng": -73.2447
      },
      {
        "name": "Soatá",
        "zone": "Intermedia",
        "lat": 6.3319,
        "lng": -72.6841
      },
      {
        "name": "Socha",
        "zone": "Intermedia",
        "lat": 5.9967,
        "lng": -72.692
      },
      {
        "name": "Socotá",
        "zone": "Intermedia",
        "lat": 6.0412,
        "lng": -72.6367
      },
      {
        "name": "Sogamoso",
        "zone": "Intermedia",
        "lat": 5.724,
        "lng": -72.9244
      },
      {
        "name": "Somondoco",
        "zone": "Intermedia",
        "lat": 4.9857,
        "lng": -73.4334
      },
      {
        "name": "Sora",
        "zone": "Intermedia",
        "lat": 5.5668,
        "lng": -73.4502
      },
      {
        "name": "Soracá",
        "zone": "Intermedia",
        "lat": 5.5009,
        "lng": -73.3328
      },
      {
        "name": "Sotaquirá",
        "zone": "Intermedia",
        "lat": 5.765,
        "lng": -73.2466
      },
      {
        "name": "Susacón",
        "zone": "Intermedia",
        "lat": 6.2303,
        "lng": -72.6903
      },
      {
        "name": "Sutamarchán",
        "zone": "Intermedia",
        "lat": 5.6198,
        "lng": -73.6205
      },
      {
        "name": "Sutatenza",
        "zone": "Intermedia",
        "lat": 5.023,
        "lng": -73.4523
      },
      {
        "name": "Sáchica",
        "zone": "Intermedia",
        "lat": 5.5843,
        "lng": -73.5425
      },
      {
        "name": "Tasco",
        "zone": "Intermedia",
        "lat": 5.9098,
        "lng": -72.781
      },
      {
        "name": "Tenza",
        "zone": "Intermedia",
        "lat": 5.0768,
        "lng": -73.4212
      },
      {
        "name": "Tibaná",
        "zone": "Intermedia",
        "lat": 5.3173,
        "lng": -73.3965
      },
      {
        "name": "Tibasosa",
        "zone": "Intermedia",
        "lat": 5.7472,
        "lng": -72.9994
      },
      {
        "name": "Tinjacá",
        "zone": "Intermedia",
        "lat": 5.5797,
        "lng": -73.6468
      },
      {
        "name": "Tipacoque",
        "zone": "Intermedia",
        "lat": 6.4192,
        "lng": -72.6917
      },
      {
        "name": "Toca",
        "zone": "Intermedia",
        "lat": 5.5665,
        "lng": -73.1848
      },
      {
        "name": "Togüí",
        "zone": "Intermedia",
        "lat": 5.9374,
        "lng": -73.5137
      },
      {
        "name": "Tota",
        "zone": "Intermedia",
        "lat": 5.5605,
        "lng": -72.9859
      },
      {
        "name": "Tunja",
        "zone": "Intermedia",
        "lat": 5.5399,
        "lng": -73.3555
      },
      {
        "name": "Tununguá",
        "zone": "Intermedia",
        "lat": 5.7306,
        "lng": -73.9332
      },
      {
        "name": "Turmequé",
        "zone": "Intermedia",
        "lat": 5.3233,
        "lng": -73.4918
      },
      {
        "name": "Tuta",
        "zone": "Intermedia",
        "lat": 5.6891,
        "lng": -73.2303
      },
      {
        "name": "Tutazá",
        "zone": "Intermedia",
        "lat": 6.0326,
        "lng": -72.856
      },
      {
        "name": "Tópaga",
        "zone": "Intermedia",
        "lat": 5.7682,
        "lng": -72.8322
      },
      {
        "name": "Ventaquemada",
        "zone": "Intermedia",
        "lat": 5.3687,
        "lng": -73.5224
      },
      {
        "name": "Villa de Leyva",
        "zone": "Intermedia",
        "lat": 5.6325,
        "lng": -73.5249
      },
      {
        "name": "Viracachá",
        "zone": "Intermedia",
        "lat": 5.4368,
        "lng": -73.2969
      },
      {
        "name": "Zetaquira",
        "zone": "Intermedia",
        "lat": 5.2834,
        "lng": -73.171
      },
      {
        "name": "Úmbita",
        "zone": "Intermedia",
        "lat": 5.2212,
        "lng": -73.4569
      }
    ]
  },
  {
    "code": "17",
    "name": "Caldas",
    "capital": "Manizales",
    "municipalities": [
      {
        "name": "Aguadas",
        "zone": "Alta",
        "lat": 5.6102,
        "lng": -75.4549
      },
      {
        "name": "Anserma",
        "zone": "Alta",
        "lat": 5.2365,
        "lng": -75.7843
      },
      {
        "name": "Aranzazu",
        "zone": "Alta",
        "lat": 5.2712,
        "lng": -75.4913
      },
      {
        "name": "Belalcázar",
        "zone": "Alta",
        "lat": 4.9938,
        "lng": -75.8119
      },
      {
        "name": "Chinchiná",
        "zone": "Alta",
        "lat": 4.9852,
        "lng": -75.6075
      },
      {
        "name": "Filadelfia",
        "zone": "Alta",
        "lat": 5.2971,
        "lng": -75.5625
      },
      {
        "name": "La Dorada",
        "zone": "Intermedia",
        "lat": 5.4608,
        "lng": -74.6688
      },
      {
        "name": "La Merced",
        "zone": "Alta",
        "lat": 5.3965,
        "lng": -75.5465
      },
      {
        "name": "Manizales",
        "zone": "Alta",
        "lat": 5.0577,
        "lng": -75.491
      },
      {
        "name": "Manzanares",
        "zone": "Alta",
        "lat": 5.2557,
        "lng": -75.1528
      },
      {
        "name": "Marmato",
        "zone": "Alta",
        "lat": 5.4742,
        "lng": -75.6
      },
      {
        "name": "Marquetalia",
        "zone": "Alta",
        "lat": 5.2975,
        "lng": -75.0531
      },
      {
        "name": "Marulanda",
        "zone": "Alta",
        "lat": 5.2843,
        "lng": -75.2597
      },
      {
        "name": "Neira",
        "zone": "Alta",
        "lat": 5.1669,
        "lng": -75.52
      },
      {
        "name": "Norcasia",
        "zone": "Alta",
        "lat": 5.5748,
        "lng": -74.8895
      },
      {
        "name": "Palestina",
        "zone": "Alta",
        "lat": 5.0179,
        "lng": -75.6246
      },
      {
        "name": "Pensilvania",
        "zone": "Alta",
        "lat": 5.3833,
        "lng": -75.1603
      },
      {
        "name": "Pácora",
        "zone": "Alta",
        "lat": 5.5272,
        "lng": -75.4596
      },
      {
        "name": "Riosucio",
        "zone": "Alta",
        "lat": 5.4237,
        "lng": -75.7021
      },
      {
        "name": "Risaralda",
        "zone": "Alta",
        "lat": 5.1645,
        "lng": -75.7672
      },
      {
        "name": "Salamina",
        "zone": "Alta",
        "lat": 5.403,
        "lng": -75.4872
      },
      {
        "name": "Samaná",
        "zone": "Alta",
        "lat": 5.4131,
        "lng": -74.9923
      },
      {
        "name": "San José",
        "zone": "Alta",
        "lat": 5.0823,
        "lng": -75.7921
      },
      {
        "name": "Supía",
        "zone": "Alta",
        "lat": 5.4468,
        "lng": -75.6497
      },
      {
        "name": "Victoria",
        "zone": "Alta",
        "lat": 5.3174,
        "lng": -74.9112
      },
      {
        "name": "Villamaría",
        "zone": "Alta",
        "lat": 5.0389,
        "lng": -75.5025
      },
      {
        "name": "Viterbo",
        "zone": "Alta",
        "lat": 5.0627,
        "lng": -75.8706
      }
    ]
  },
  {
    "code": "18",
    "name": "Caquetá",
    "capital": "Florencia",
    "municipalities": [
      {
        "name": "Albania",
        "zone": "Intermedia",
        "lat": 1.3285,
        "lng": -75.8784
      },
      {
        "name": "Belén de los Andaquíes",
        "zone": "Intermedia",
        "lat": 1.4158,
        "lng": -75.8724
      },
      {
        "name": "Cartagena del Chairá",
        "zone": "Intermedia",
        "lat": 1.3324,
        "lng": -74.8479
      },
      {
        "name": "Curillo",
        "zone": "Intermedia",
        "lat": 1.0335,
        "lng": -75.9192
      },
      {
        "name": "El Doncello",
        "zone": "Intermedia",
        "lat": 1.68,
        "lng": -75.2836
      },
      {
        "name": "El Paujíl",
        "zone": "Intermedia",
        "lat": 1.5702,
        "lng": -75.3261
      },
      {
        "name": "Florencia",
        "zone": "Intermedia",
        "lat": 1.6182,
        "lng": -75.6098
      },
      {
        "name": "La Montañita",
        "zone": "Intermedia",
        "lat": 1.4792,
        "lng": -75.4364
      },
      {
        "name": "Milán",
        "zone": "Intermedia",
        "lat": 1.2902,
        "lng": -75.5069
      },
      {
        "name": "Morelia",
        "zone": "Intermedia",
        "lat": 1.4866,
        "lng": -75.7241
      },
      {
        "name": "Puerto Rico",
        "zone": "Intermedia",
        "lat": 1.9091,
        "lng": -75.1576
      },
      {
        "name": "San José del Fragua",
        "zone": "Intermedia",
        "lat": 1.3303,
        "lng": -75.9738
      },
      {
        "name": "San Vicente del Caguán",
        "zone": "Intermedia",
        "lat": 2.1194,
        "lng": -74.7679
      },
      {
        "name": "Solano",
        "zone": "Intermedia",
        "lat": 0.6991,
        "lng": -75.2537
      },
      {
        "name": "Solita",
        "zone": "Intermedia",
        "lat": 0.8765,
        "lng": -75.6199
      },
      {
        "name": "Valparaíso",
        "zone": "Intermedia",
        "lat": 1.1946,
        "lng": -75.7067
      }
    ]
  },
  {
    "code": "85",
    "name": "Casanare",
    "capital": "Yopal",
    "municipalities": [
      {
        "name": "Aguazul",
        "zone": "Alta",
        "lat": 5.1726,
        "lng": -72.5468
      },
      {
        "name": "Chámeza",
        "zone": "Alta",
        "lat": 5.2145,
        "lng": -72.8702
      },
      {
        "name": "Hato Corozal",
        "zone": "Alta",
        "lat": 6.1541,
        "lng": -71.7642
      },
      {
        "name": "La Salina",
        "zone": "Alta",
        "lat": 6.1278,
        "lng": -72.335
      },
      {
        "name": "Maní",
        "zone": "Alta",
        "lat": 4.8168,
        "lng": -72.2814
      },
      {
        "name": "Monterrey",
        "zone": "Alta",
        "lat": 4.877,
        "lng": -72.8941
      },
      {
        "name": "Nunchía",
        "zone": "Alta",
        "lat": 5.6365,
        "lng": -72.1953
      },
      {
        "name": "Orocué",
        "zone": "Alta",
        "lat": 4.7903,
        "lng": -71.3385
      },
      {
        "name": "Paz de Ariporo",
        "zone": "Intermedia",
        "lat": 5.8798,
        "lng": -71.8903
      },
      {
        "name": "Pore",
        "zone": "Alta",
        "lat": 5.7277,
        "lng": -71.9929
      },
      {
        "name": "Recetor",
        "zone": "Alta",
        "lat": 5.2292,
        "lng": -72.761
      },
      {
        "name": "Sabanalarga",
        "zone": "Baja",
        "lat": 4.8548,
        "lng": -73.0387
      },
      {
        "name": "San Luis de Palenque",
        "zone": "Alta",
        "lat": 5.4224,
        "lng": -71.7322
      },
      {
        "name": "Sácama",
        "zone": "Alta",
        "lat": 6.0967,
        "lng": -72.2502
      },
      {
        "name": "Tauramena",
        "zone": "Alta",
        "lat": 5.019,
        "lng": -72.7466
      },
      {
        "name": "Trinidad",
        "zone": "Alta",
        "lat": 5.4122,
        "lng": -71.6628
      },
      {
        "name": "Támara",
        "zone": "Alta",
        "lat": 5.8295,
        "lng": -72.1616
      },
      {
        "name": "Villanueva",
        "zone": "Alta",
        "lat": 4.6104,
        "lng": -72.9278
      },
      {
        "name": "Yopal",
        "zone": "Alta",
        "lat": 5.3271,
        "lng": -72.3961
      }
    ]
  },
  {
    "code": "19",
    "name": "Cauca",
    "capital": "Popayán",
    "municipalities": [
      {
        "name": "Almaguer",
        "zone": "Alta",
        "lat": 1.9134,
        "lng": -76.8561
      },
      {
        "name": "Argelia",
        "zone": "Alta",
        "lat": 2.2574,
        "lng": -77.249
      },
      {
        "name": "Balboa",
        "zone": "Alta",
        "lat": 2.041,
        "lng": -77.2158
      },
      {
        "name": "Bolívar",
        "zone": "Alta",
        "lat": 1.8375,
        "lng": -76.9662
      },
      {
        "name": "Buenos Aires",
        "zone": "Alta",
        "lat": 3.0154,
        "lng": -76.6422
      },
      {
        "name": "Cajibío",
        "zone": "Alta",
        "lat": 2.6234,
        "lng": -76.5707
      },
      {
        "name": "Caldono",
        "zone": "Alta",
        "lat": 2.7981,
        "lng": -76.4843
      },
      {
        "name": "Caloto",
        "zone": "Alta",
        "lat": 3.0345,
        "lng": -76.4089
      },
      {
        "name": "Corinto",
        "zone": "Alta",
        "lat": 3.1739,
        "lng": -76.2619
      },
      {
        "name": "El Tambo",
        "zone": "Alta",
        "lat": 2.4514,
        "lng": -76.8109
      },
      {
        "name": "Florencia",
        "zone": "Intermedia",
        "lat": 1.6825,
        "lng": -77.0725
      },
      {
        "name": "Guachené",
        "zone": "Alta",
        "lat": 3.1342,
        "lng": -76.3922
      },
      {
        "name": "Guapi",
        "zone": "Alta",
        "lat": 2.5713,
        "lng": -77.888
      },
      {
        "name": "Inzá",
        "zone": "Alta",
        "lat": 2.5492,
        "lng": -76.0635
      },
      {
        "name": "Jambaló",
        "zone": "Alta",
        "lat": 2.7778,
        "lng": -76.3239
      },
      {
        "name": "La Sierra",
        "zone": "Alta",
        "lat": 2.1794,
        "lng": -76.7633
      },
      {
        "name": "La Vega",
        "zone": "Alta",
        "lat": 2.0018,
        "lng": -76.7788
      },
      {
        "name": "López de Micay",
        "zone": "Alta",
        "lat": 2.8468,
        "lng": -77.2478
      },
      {
        "name": "Mercaderes",
        "zone": "Alta",
        "lat": 1.7892,
        "lng": -77.1643
      },
      {
        "name": "Miranda",
        "zone": "Alta",
        "lat": 3.2547,
        "lng": -76.2287
      },
      {
        "name": "Morales",
        "zone": "Alta",
        "lat": 2.7547,
        "lng": -76.6291
      },
      {
        "name": "Padilla",
        "zone": "Alta",
        "lat": 3.221,
        "lng": -76.3133
      },
      {
        "name": "Patía",
        "zone": "Alta",
        "lat": 2.1159,
        "lng": -76.9811
      },
      {
        "name": "Piamonte",
        "zone": "Alta",
        "lat": 1.1175,
        "lng": -76.3276
      },
      {
        "name": "Piendamó - Tunía",
        "zone": "Alta",
        "lat": 2.6423,
        "lng": -76.5286
      },
      {
        "name": "Popayán",
        "zone": "Alta",
        "lat": 2.4596,
        "lng": -76.5994
      },
      {
        "name": "Puerto Tejada",
        "zone": "Alta",
        "lat": 3.2333,
        "lng": -76.4177
      },
      {
        "name": "Puracé",
        "zone": "Alta",
        "lat": 2.3415,
        "lng": -76.4967
      },
      {
        "name": "Páez",
        "zone": "Alta",
        "lat": 2.6457,
        "lng": -75.9707
      },
      {
        "name": "Rosas",
        "zone": "Alta",
        "lat": 2.2609,
        "lng": -76.7403
      },
      {
        "name": "San Sebastián",
        "zone": "Alta",
        "lat": 1.8385,
        "lng": -76.7695
      },
      {
        "name": "Santa Rosa",
        "zone": "Alta",
        "lat": 1.7009,
        "lng": -76.5733
      },
      {
        "name": "Santander de Quilichao",
        "zone": "Alta",
        "lat": 3.015,
        "lng": -76.4851
      },
      {
        "name": "Silvia",
        "zone": "Alta",
        "lat": 2.6119,
        "lng": -76.3798
      },
      {
        "name": "Sotará - Paispamba",
        "zone": "Alta",
        "lat": 2.2532,
        "lng": -76.6134
      },
      {
        "name": "Sucre",
        "zone": "Alta",
        "lat": 2.0382,
        "lng": -76.9263
      },
      {
        "name": "Suárez",
        "zone": "Alta",
        "lat": 2.9598,
        "lng": -76.6936
      },
      {
        "name": "Timbiquí",
        "zone": "Alta",
        "lat": 2.7773,
        "lng": -77.6675
      },
      {
        "name": "Timbío",
        "zone": "Alta",
        "lat": 2.3497,
        "lng": -76.6845
      },
      {
        "name": "Toribío",
        "zone": "Alta",
        "lat": 2.953,
        "lng": -76.2703
      },
      {
        "name": "Totoró",
        "zone": "Alta",
        "lat": 2.5103,
        "lng": -76.4036
      },
      {
        "name": "Villa Rica",
        "zone": "Alta",
        "lat": 3.1776,
        "lng": -76.458
      }
    ]
  },
  {
    "code": "20",
    "name": "Cesar",
    "capital": "Valledupar",
    "municipalities": [
      {
        "name": "Aguachica",
        "zone": "Intermedia",
        "lat": 8.3068,
        "lng": -73.614
      },
      {
        "name": "Agustín Codazzi",
        "zone": "Baja",
        "lat": 10.0405,
        "lng": -73.2384
      },
      {
        "name": "Astrea",
        "zone": "Intermedia",
        "lat": 9.4981,
        "lng": -73.9758
      },
      {
        "name": "Becerril",
        "zone": "Intermedia",
        "lat": 9.7044,
        "lng": -73.2787
      },
      {
        "name": "Bosconia",
        "zone": "Baja",
        "lat": 9.9751,
        "lng": -73.8888
      },
      {
        "name": "Chimichagua",
        "zone": "Intermedia",
        "lat": 9.2587,
        "lng": -73.8133
      },
      {
        "name": "Chiriguaná",
        "zone": "Intermedia",
        "lat": 9.3611,
        "lng": -73.5999
      },
      {
        "name": "Curumaní",
        "zone": "Intermedia",
        "lat": 9.2017,
        "lng": -73.5408
      },
      {
        "name": "El Copey",
        "zone": "Intermedia",
        "lat": 10.1499,
        "lng": -73.9627
      },
      {
        "name": "El Paso",
        "zone": "Intermedia",
        "lat": 9.6685,
        "lng": -73.742
      },
      {
        "name": "Gamarra",
        "zone": "Intermedia",
        "lat": 8.3248,
        "lng": -73.7376
      },
      {
        "name": "González",
        "zone": "Intermedia",
        "lat": 8.3896,
        "lng": -73.38
      },
      {
        "name": "La Gloria",
        "zone": "Intermedia",
        "lat": 8.6193,
        "lng": -73.8032
      },
      {
        "name": "La Jagua de Ibirico",
        "zone": "Intermedia",
        "lat": 9.5638,
        "lng": -73.3341
      },
      {
        "name": "La Paz",
        "zone": "Intermedia",
        "lat": 10.3876,
        "lng": -73.1714
      },
      {
        "name": "Manaure Balcón del Cesar",
        "zone": "Intermedia",
        "lat": 10.3908,
        "lng": -73.0295
      },
      {
        "name": "Pailitas",
        "zone": "Intermedia",
        "lat": 8.9594,
        "lng": -73.6258
      },
      {
        "name": "Pelaya",
        "zone": "Intermedia",
        "lat": 8.6895,
        "lng": -73.6667
      },
      {
        "name": "Pueblo Bello",
        "zone": "Intermedia",
        "lat": 10.4173,
        "lng": -73.5862
      },
      {
        "name": "Río de Oro",
        "zone": "Intermedia",
        "lat": 8.2923,
        "lng": -73.3864
      },
      {
        "name": "San Alberto",
        "zone": "Intermedia",
        "lat": 7.7611,
        "lng": -73.3939
      },
      {
        "name": "San Diego",
        "zone": "Intermedia",
        "lat": 10.333,
        "lng": -73.1812
      },
      {
        "name": "San Martín",
        "zone": "Intermedia",
        "lat": 7.9999,
        "lng": -73.5109
      },
      {
        "name": "Tamalameque",
        "zone": "Intermedia",
        "lat": 8.8617,
        "lng": -73.8122
      },
      {
        "name": "Valledupar",
        "zone": "Baja",
        "lat": 10.4605,
        "lng": -73.2594
      }
    ]
  },
  {
    "code": "27",
    "name": "Chocó",
    "capital": "Quibdó",
    "municipalities": [
      {
        "name": "Acandí",
        "zone": "Alta",
        "lat": 8.5122,
        "lng": -77.28
      },
      {
        "name": "Alto Baudó",
        "zone": "Alta",
        "lat": 5.5162,
        "lng": -76.9744
      },
      {
        "name": "Atrato",
        "zone": "Alta",
        "lat": 5.5314,
        "lng": -76.6357
      },
      {
        "name": "Bagadó",
        "zone": "Alta",
        "lat": 5.4097,
        "lng": -76.4161
      },
      {
        "name": "Bahía Solano",
        "zone": "Alta",
        "lat": 6.2228,
        "lng": -77.4014
      },
      {
        "name": "Bajo Baudó",
        "zone": "Alta",
        "lat": 4.9546,
        "lng": -77.3657
      },
      {
        "name": "Bojayá",
        "zone": "Alta",
        "lat": 6.5597,
        "lng": -76.8868
      },
      {
        "name": "Carmen del Darién",
        "zone": "Alta",
        "lat": 7.1583,
        "lng": -76.9708
      },
      {
        "name": "Condoto",
        "zone": "Alta",
        "lat": 5.091,
        "lng": -76.6507
      },
      {
        "name": "Cértegui",
        "zone": "Alta",
        "lat": 5.3714,
        "lng": -76.6076
      },
      {
        "name": "El Cantón del San Pablo",
        "zone": "Alta",
        "lat": 5.3353,
        "lng": -76.7268
      },
      {
        "name": "El Carmen de Atrato",
        "zone": "Alta",
        "lat": 5.8998,
        "lng": -76.1421
      },
      {
        "name": "El Litoral del San Juan",
        "zone": "Alta",
        "lat": 4.2596,
        "lng": -77.3637
      },
      {
        "name": "Istmina",
        "zone": "Alta",
        "lat": 5.1539,
        "lng": -76.6852
      },
      {
        "name": "Juradó",
        "zone": "Alta",
        "lat": 7.1036,
        "lng": -77.7628
      },
      {
        "name": "Lloró",
        "zone": "Alta",
        "lat": 5.4979,
        "lng": -76.5451
      },
      {
        "name": "Medio Atrato",
        "zone": "Alta",
        "lat": 5.9949,
        "lng": -76.783
      },
      {
        "name": "Medio Baudó",
        "zone": "Alta",
        "lat": 5.1925,
        "lng": -76.9509
      },
      {
        "name": "Medio San Juan",
        "zone": "Alta",
        "lat": 5.0983,
        "lng": -76.6944
      },
      {
        "name": "Nuevo Belén de Bajirá",
        "zone": "Alta",
        "lat": 7.3719,
        "lng": -76.7173
      },
      {
        "name": "Nuquí",
        "zone": "Alta",
        "lat": 5.7098,
        "lng": -77.2655
      },
      {
        "name": "Nóvita",
        "zone": "Alta",
        "lat": 4.9561,
        "lng": -76.6095
      },
      {
        "name": "Quibdó",
        "zone": "Alta",
        "lat": 5.6822,
        "lng": -76.6381
      },
      {
        "name": "Riosucio",
        "zone": "Alta",
        "lat": 7.4367,
        "lng": -77.1132
      },
      {
        "name": "Río Iró",
        "zone": "Alta",
        "lat": 5.1863,
        "lng": -76.4729
      },
      {
        "name": "Río Quito",
        "zone": "Alta",
        "lat": 5.4837,
        "lng": -76.7407
      },
      {
        "name": "San José del Palmar",
        "zone": "Alta",
        "lat": 4.897,
        "lng": -76.2342
      },
      {
        "name": "Sipí",
        "zone": "Alta",
        "lat": 4.6526,
        "lng": -76.6435
      },
      {
        "name": "Tadó",
        "zone": "Alta",
        "lat": 5.2649,
        "lng": -76.5586
      },
      {
        "name": "Unguía",
        "zone": "Alta",
        "lat": 8.0441,
        "lng": -77.0925
      },
      {
        "name": "Unión Panamericana",
        "zone": "Alta",
        "lat": 5.2811,
        "lng": -76.6301
      }
    ]
  },
  {
    "code": "25",
    "name": "Cundinamarca",
    "capital": "Bogotá",
    "municipalities": [
      {
        "name": "Agua de Dios",
        "zone": "Intermedia",
        "lat": 4.3753,
        "lng": -74.6692
      },
      {
        "name": "Albán",
        "zone": "Intermedia",
        "lat": 4.878,
        "lng": -74.4383
      },
      {
        "name": "Anapoima",
        "zone": "Intermedia",
        "lat": 4.5627,
        "lng": -74.5287
      },
      {
        "name": "Anolaima",
        "zone": "Intermedia",
        "lat": 4.7617,
        "lng": -74.4638
      },
      {
        "name": "Apulo",
        "zone": "Intermedia",
        "lat": 4.5203,
        "lng": -74.5939
      },
      {
        "name": "Arbeláez",
        "zone": "Intermedia",
        "lat": 4.2725,
        "lng": -74.4149
      },
      {
        "name": "Beltrán",
        "zone": "Intermedia",
        "lat": 4.8028,
        "lng": -74.7417
      },
      {
        "name": "Bituima",
        "zone": "Intermedia",
        "lat": 4.8722,
        "lng": -74.5396
      },
      {
        "name": "Bojacá",
        "zone": "Intermedia",
        "lat": 4.7372,
        "lng": -74.3446
      },
      {
        "name": "Cabrera",
        "zone": "Intermedia",
        "lat": 3.9852,
        "lng": -74.4845
      },
      {
        "name": "Cachipay",
        "zone": "Intermedia",
        "lat": 4.731,
        "lng": -74.4357
      },
      {
        "name": "Cajicá",
        "zone": "Intermedia",
        "lat": 4.92,
        "lng": -74.023
      },
      {
        "name": "Caparrapí",
        "zone": "Intermedia",
        "lat": 5.3476,
        "lng": -74.491
      },
      {
        "name": "Carmen de Carupa",
        "zone": "Intermedia",
        "lat": 5.3491,
        "lng": -73.9014
      },
      {
        "name": "Chaguaní",
        "zone": "Intermedia",
        "lat": 4.9489,
        "lng": -74.5935
      },
      {
        "name": "Chipaque",
        "zone": "Intermedia",
        "lat": 4.4427,
        "lng": -74.0449
      },
      {
        "name": "Choachí",
        "zone": "Intermedia",
        "lat": 4.527,
        "lng": -73.9229
      },
      {
        "name": "Chocontá",
        "zone": "Intermedia",
        "lat": 5.1452,
        "lng": -73.6835
      },
      {
        "name": "Chía",
        "zone": "Intermedia",
        "lat": 4.8665,
        "lng": -74.05
      },
      {
        "name": "Cogua",
        "zone": "Intermedia",
        "lat": 5.0618,
        "lng": -73.9785
      },
      {
        "name": "Cota",
        "zone": "Intermedia",
        "lat": 4.8126,
        "lng": -74.1026
      },
      {
        "name": "Cucunubá",
        "zone": "Intermedia",
        "lat": 5.2498,
        "lng": -73.7661
      },
      {
        "name": "Cáqueza",
        "zone": "Intermedia",
        "lat": 4.4041,
        "lng": -73.9465
      },
      {
        "name": "El Colegio",
        "zone": "Intermedia",
        "lat": 4.578,
        "lng": -74.4423
      },
      {
        "name": "El Peñón",
        "zone": "Intermedia",
        "lat": 5.2487,
        "lng": -74.2902
      },
      {
        "name": "El Rosal",
        "zone": "Intermedia",
        "lat": 4.8506,
        "lng": -74.2631
      },
      {
        "name": "Facatativá",
        "zone": "Intermedia",
        "lat": 4.8134,
        "lng": -74.3501
      },
      {
        "name": "Fosca",
        "zone": "Intermedia",
        "lat": 4.3391,
        "lng": -73.939
      },
      {
        "name": "Funza",
        "zone": "Intermedia",
        "lat": 4.7104,
        "lng": -74.2015
      },
      {
        "name": "Fusagasugá",
        "zone": "Intermedia",
        "lat": 4.3367,
        "lng": -74.3754
      },
      {
        "name": "Fómeque",
        "zone": "Intermedia",
        "lat": 4.4855,
        "lng": -73.8925
      },
      {
        "name": "Fúquene",
        "zone": "Intermedia",
        "lat": 5.404,
        "lng": -73.7959
      },
      {
        "name": "Gachalá",
        "zone": "Intermedia",
        "lat": 4.6936,
        "lng": -73.5202
      },
      {
        "name": "Gachancipá",
        "zone": "Intermedia",
        "lat": 4.9909,
        "lng": -73.8735
      },
      {
        "name": "Gachetá",
        "zone": "Intermedia",
        "lat": 4.8164,
        "lng": -73.6364
      },
      {
        "name": "Gama",
        "zone": "Intermedia",
        "lat": 4.7633,
        "lng": -73.611
      },
      {
        "name": "Girardot",
        "zone": "Intermedia",
        "lat": 4.3131,
        "lng": -74.7982
      },
      {
        "name": "Granada",
        "zone": "Alta",
        "lat": 4.5198,
        "lng": -74.3508
      },
      {
        "name": "Guachetá",
        "zone": "Intermedia",
        "lat": 5.3834,
        "lng": -73.687
      },
      {
        "name": "Guaduas",
        "zone": "Intermedia",
        "lat": 5.0721,
        "lng": -74.6034
      },
      {
        "name": "Guasca",
        "zone": "Intermedia",
        "lat": 4.8667,
        "lng": -73.8771
      },
      {
        "name": "Guataquí",
        "zone": "Intermedia",
        "lat": 4.5175,
        "lng": -74.7901
      },
      {
        "name": "Guatavita",
        "zone": "Intermedia",
        "lat": 4.9352,
        "lng": -73.8329
      },
      {
        "name": "Guayabal de Síquima",
        "zone": "Intermedia",
        "lat": 4.878,
        "lng": -74.4674
      },
      {
        "name": "Guayabetal",
        "zone": "Intermedia",
        "lat": 4.2153,
        "lng": -73.8151
      },
      {
        "name": "Gutiérrez",
        "zone": "Intermedia",
        "lat": 4.2547,
        "lng": -74.003
      },
      {
        "name": "Jerusalén",
        "zone": "Intermedia",
        "lat": 4.5623,
        "lng": -74.6955
      },
      {
        "name": "Junín",
        "zone": "Intermedia",
        "lat": 4.7906,
        "lng": -73.663
      },
      {
        "name": "La Calera",
        "zone": "Intermedia",
        "lat": 4.7211,
        "lng": -73.9682
      },
      {
        "name": "La Mesa",
        "zone": "Intermedia",
        "lat": 4.631,
        "lng": -74.4616
      },
      {
        "name": "La Palma",
        "zone": "Intermedia",
        "lat": 5.3588,
        "lng": -74.391
      },
      {
        "name": "La Peña",
        "zone": "Intermedia",
        "lat": 5.1989,
        "lng": -74.3941
      },
      {
        "name": "La Vega",
        "zone": "Intermedia",
        "lat": 4.9978,
        "lng": -74.3369
      },
      {
        "name": "Lenguazaque",
        "zone": "Intermedia",
        "lat": 5.3061,
        "lng": -73.7115
      },
      {
        "name": "Machetá",
        "zone": "Intermedia",
        "lat": 5.0801,
        "lng": -73.6082
      },
      {
        "name": "Madrid",
        "zone": "Intermedia",
        "lat": 4.7328,
        "lng": -74.2659
      },
      {
        "name": "Manta",
        "zone": "Intermedia",
        "lat": 5.009,
        "lng": -73.5404
      },
      {
        "name": "Medina",
        "zone": "Intermedia",
        "lat": 4.5063,
        "lng": -73.3484
      },
      {
        "name": "Mosquera",
        "zone": "Intermedia",
        "lat": 4.7065,
        "lng": -74.2212
      },
      {
        "name": "Nariño",
        "zone": "Intermedia",
        "lat": 4.3998,
        "lng": -74.8247
      },
      {
        "name": "Nemocón",
        "zone": "Intermedia",
        "lat": 5.0687,
        "lng": -73.8779
      },
      {
        "name": "Nilo",
        "zone": "Intermedia",
        "lat": 4.3058,
        "lng": -74.62
      },
      {
        "name": "Nimaima",
        "zone": "Intermedia",
        "lat": 5.126,
        "lng": -74.386
      },
      {
        "name": "Nocaima",
        "zone": "Intermedia",
        "lat": 5.0695,
        "lng": -74.3791
      },
      {
        "name": "Pacho",
        "zone": "Intermedia",
        "lat": 5.1369,
        "lng": -74.1561
      },
      {
        "name": "Paime",
        "zone": "Intermedia",
        "lat": 5.3705,
        "lng": -74.1522
      },
      {
        "name": "Pandi",
        "zone": "Intermedia",
        "lat": 4.1904,
        "lng": -74.4866
      },
      {
        "name": "Paratebueno",
        "zone": "Intermedia",
        "lat": 4.3748,
        "lng": -73.2128
      },
      {
        "name": "Pasca",
        "zone": "Intermedia",
        "lat": 4.309,
        "lng": -74.3023
      },
      {
        "name": "Puerto Salgar",
        "zone": "Intermedia",
        "lat": 5.4654,
        "lng": -74.6537
      },
      {
        "name": "Pulí",
        "zone": "Intermedia",
        "lat": 4.682,
        "lng": -74.7144
      },
      {
        "name": "Quebradanegra",
        "zone": "Intermedia",
        "lat": 5.1181,
        "lng": -74.4801
      },
      {
        "name": "Quetame",
        "zone": "Intermedia",
        "lat": 4.3299,
        "lng": -73.8632
      },
      {
        "name": "Quipile",
        "zone": "Intermedia",
        "lat": 4.7448,
        "lng": -74.5337
      },
      {
        "name": "Ricaurte",
        "zone": "Intermedia",
        "lat": 4.2821,
        "lng": -74.7729
      },
      {
        "name": "San Antonio del Tequendama",
        "zone": "Intermedia",
        "lat": 4.6161,
        "lng": -74.3514
      },
      {
        "name": "San Bernardo",
        "zone": "Intermedia",
        "lat": 4.1794,
        "lng": -74.423
      },
      {
        "name": "San Cayetano",
        "zone": "Intermedia",
        "lat": 5.3329,
        "lng": -74.0248
      },
      {
        "name": "San Francisco",
        "zone": "Intermedia",
        "lat": 4.9729,
        "lng": -74.2897
      },
      {
        "name": "San Juan de Rioseco",
        "zone": "Intermedia",
        "lat": 4.8476,
        "lng": -74.6219
      },
      {
        "name": "Sasaima",
        "zone": "Intermedia",
        "lat": 4.9622,
        "lng": -74.4326
      },
      {
        "name": "Sesquilé",
        "zone": "Intermedia",
        "lat": 5.0448,
        "lng": -73.7961
      },
      {
        "name": "Sibaté",
        "zone": "Intermedia",
        "lat": 4.4926,
        "lng": -74.2579
      },
      {
        "name": "Silvania",
        "zone": "Intermedia",
        "lat": 4.382,
        "lng": -74.4055
      },
      {
        "name": "Simijaca",
        "zone": "Intermedia",
        "lat": 5.5052,
        "lng": -73.8507
      },
      {
        "name": "Soacha",
        "zone": "Intermedia",
        "lat": 4.5793,
        "lng": -74.2155
      },
      {
        "name": "Sopó",
        "zone": "Intermedia",
        "lat": 4.9154,
        "lng": -73.9433
      },
      {
        "name": "Subachoque",
        "zone": "Intermedia",
        "lat": 4.9291,
        "lng": -74.1728
      },
      {
        "name": "Suesca",
        "zone": "Intermedia",
        "lat": 5.1035,
        "lng": -73.7982
      },
      {
        "name": "Supatá",
        "zone": "Intermedia",
        "lat": 5.0616,
        "lng": -74.2354
      },
      {
        "name": "Susa",
        "zone": "Intermedia",
        "lat": 5.4553,
        "lng": -73.8139
      },
      {
        "name": "Sutatausa",
        "zone": "Intermedia",
        "lat": 5.2475,
        "lng": -73.8532
      },
      {
        "name": "Tabio",
        "zone": "Intermedia",
        "lat": 4.9168,
        "lng": -74.0965
      },
      {
        "name": "Tausa",
        "zone": "Intermedia",
        "lat": 5.1963,
        "lng": -73.8878
      },
      {
        "name": "Tena",
        "zone": "Intermedia",
        "lat": 4.6553,
        "lng": -74.3892
      },
      {
        "name": "Tenjo",
        "zone": "Intermedia",
        "lat": 4.872,
        "lng": -74.1437
      },
      {
        "name": "Tibacuy",
        "zone": "Intermedia",
        "lat": 4.3486,
        "lng": -74.4527
      },
      {
        "name": "Tibirita",
        "zone": "Intermedia",
        "lat": 5.0523,
        "lng": -73.5045
      },
      {
        "name": "Tocaima",
        "zone": "Intermedia",
        "lat": 4.4593,
        "lng": -74.6363
      },
      {
        "name": "Tocancipá",
        "zone": "Intermedia",
        "lat": 4.9646,
        "lng": -73.9121
      },
      {
        "name": "Topaipí",
        "zone": "Intermedia",
        "lat": 5.3362,
        "lng": -74.3006
      },
      {
        "name": "Ubalá",
        "zone": "Intermedia",
        "lat": 4.7476,
        "lng": -73.5315
      },
      {
        "name": "Ubaque",
        "zone": "Intermedia",
        "lat": 4.4838,
        "lng": -73.9335
      },
      {
        "name": "Une",
        "zone": "Intermedia",
        "lat": 4.4024,
        "lng": -74.0252
      },
      {
        "name": "Venecia",
        "zone": "Intermedia",
        "lat": 4.0891,
        "lng": -74.4783
      },
      {
        "name": "Vergara",
        "zone": "Intermedia",
        "lat": 5.1173,
        "lng": -74.3462
      },
      {
        "name": "Vianí",
        "zone": "Intermedia",
        "lat": 4.8752,
        "lng": -74.5613
      },
      {
        "name": "Villa de San Diego de Ubaté",
        "zone": "Intermedia",
        "lat": 5.3075,
        "lng": -73.8144
      },
      {
        "name": "Villagómez",
        "zone": "Intermedia",
        "lat": 5.273,
        "lng": -74.1951
      },
      {
        "name": "Villapinzón",
        "zone": "Intermedia",
        "lat": 5.2164,
        "lng": -73.5957
      },
      {
        "name": "Villeta",
        "zone": "Intermedia",
        "lat": 5.0128,
        "lng": -74.4697
      },
      {
        "name": "Viotá",
        "zone": "Intermedia",
        "lat": 4.4394,
        "lng": -74.5231
      },
      {
        "name": "Yacopí",
        "zone": "Intermedia",
        "lat": 5.4593,
        "lng": -74.3381
      },
      {
        "name": "Zipacón",
        "zone": "Intermedia",
        "lat": 4.7599,
        "lng": -74.3796
      },
      {
        "name": "Zipaquirá",
        "zone": "Intermedia",
        "lat": 5.0255,
        "lng": -73.9944
      },
      {
        "name": "Útica",
        "zone": "Intermedia",
        "lat": 5.1905,
        "lng": -74.4832
      }
    ]
  },
  {
    "code": "23",
    "name": "Córdoba",
    "capital": "Montería",
    "municipalities": [
      {
        "name": "Ayapel",
        "zone": "Intermedia",
        "lat": 8.3138,
        "lng": -75.146
      },
      {
        "name": "Buenavista",
        "zone": "Intermedia",
        "lat": 8.2212,
        "lng": -75.4809
      },
      {
        "name": "Canalete",
        "zone": "Intermedia",
        "lat": 8.7869,
        "lng": -76.2415
      },
      {
        "name": "Cereté",
        "zone": "Baja",
        "lat": 8.8885,
        "lng": -75.7961
      },
      {
        "name": "Chimá",
        "zone": "Intermedia",
        "lat": 9.1497,
        "lng": -75.6269
      },
      {
        "name": "Chinú",
        "zone": "Intermedia",
        "lat": 9.1055,
        "lng": -75.3996
      },
      {
        "name": "Ciénaga de Oro",
        "zone": "Intermedia",
        "lat": 8.8758,
        "lng": -75.6208
      },
      {
        "name": "Cotorra",
        "zone": "Intermedia",
        "lat": 9.0372,
        "lng": -75.7992
      },
      {
        "name": "La Apartada",
        "zone": "Intermedia",
        "lat": 8.0501,
        "lng": -75.336
      },
      {
        "name": "Lorica",
        "zone": "Baja",
        "lat": 9.2408,
        "lng": -75.8161
      },
      {
        "name": "Los Córdobas",
        "zone": "Intermedia",
        "lat": 8.8921,
        "lng": -76.3552
      },
      {
        "name": "Momil",
        "zone": "Intermedia",
        "lat": 9.2407,
        "lng": -75.678
      },
      {
        "name": "Montelíbano",
        "zone": "Intermedia",
        "lat": 7.9738,
        "lng": -75.4168
      },
      {
        "name": "Montería",
        "zone": "Baja",
        "lat": 8.7598,
        "lng": -75.8731
      },
      {
        "name": "Moñitos",
        "zone": "Intermedia",
        "lat": 9.2452,
        "lng": -76.1291
      },
      {
        "name": "Planeta Rica",
        "zone": "Intermedia",
        "lat": 8.4082,
        "lng": -75.5832
      },
      {
        "name": "Pueblo Nuevo",
        "zone": "Intermedia",
        "lat": 8.5041,
        "lng": -75.508
      },
      {
        "name": "Puerto Escondido",
        "zone": "Intermedia",
        "lat": 9.0054,
        "lng": -76.2604
      },
      {
        "name": "Puerto Libertador",
        "zone": "Intermedia",
        "lat": 7.8889,
        "lng": -75.6718
      },
      {
        "name": "Purísima de la Concepción",
        "zone": "Intermedia",
        "lat": 9.2393,
        "lng": -75.725
      },
      {
        "name": "Sahagún",
        "zone": "Baja",
        "lat": 8.943,
        "lng": -75.4458
      },
      {
        "name": "San Andrés de Sotavento",
        "zone": "Intermedia",
        "lat": 9.1454,
        "lng": -75.5088
      },
      {
        "name": "San Antero",
        "zone": "Intermedia",
        "lat": 9.3764,
        "lng": -75.7611
      },
      {
        "name": "San Bernardo del Viento",
        "zone": "Intermedia",
        "lat": 9.3525,
        "lng": -75.9551
      },
      {
        "name": "San Carlos",
        "zone": "Intermedia",
        "lat": 8.7993,
        "lng": -75.6988
      },
      {
        "name": "San José de Uré",
        "zone": "Intermedia",
        "lat": 7.7873,
        "lng": -75.5335
      },
      {
        "name": "San Pelayo",
        "zone": "Intermedia",
        "lat": 8.9584,
        "lng": -75.8356
      },
      {
        "name": "Tierralta",
        "zone": "Intermedia",
        "lat": 8.1706,
        "lng": -76.0598
      },
      {
        "name": "Tuchín",
        "zone": "Intermedia",
        "lat": 9.1866,
        "lng": -75.554
      },
      {
        "name": "Valencia",
        "zone": "Intermedia",
        "lat": 8.255,
        "lng": -76.1508
      }
    ]
  },
  {
    "code": "94",
    "name": "Guainía",
    "capital": "Inírida",
    "municipalities": [
      {
        "name": "Barrancominas",
        "zone": "Baja",
        "lat": 3.4942,
        "lng": -69.8141
      },
      {
        "name": "Cacahual",
        "zone": "Baja",
        "lat": 3.5262,
        "lng": -67.4133
      },
      {
        "name": "Inírida",
        "zone": "Baja",
        "lat": 3.8668,
        "lng": -67.9186
      },
      {
        "name": "La Guadalupe",
        "zone": "Baja",
        "lat": 1.6325,
        "lng": -66.9637
      },
      {
        "name": "Morichal",
        "zone": "Baja",
        "lat": 2.2651,
        "lng": -69.9194
      },
      {
        "name": "Pana Pana",
        "zone": "Baja",
        "lat": 1.8657,
        "lng": -69.0099
      },
      {
        "name": "Puerto Colombia",
        "zone": "Baja",
        "lat": 2.7264,
        "lng": -67.5668
      },
      {
        "name": "San Felipe",
        "zone": "Baja",
        "lat": 1.9125,
        "lng": -67.0678
      }
    ]
  },
  {
    "code": "95",
    "name": "Guaviare",
    "capital": "San José del Guaviare",
    "municipalities": [
      {
        "name": "Calamar",
        "zone": "Baja",
        "lat": 1.961,
        "lng": -72.6552
      },
      {
        "name": "El Retorno",
        "zone": "Baja",
        "lat": 2.3302,
        "lng": -72.6273
      },
      {
        "name": "Miraflores",
        "zone": "Baja",
        "lat": 1.3375,
        "lng": -71.9504
      },
      {
        "name": "San José del Guaviare",
        "zone": "Baja",
        "lat": 2.5659,
        "lng": -72.6393
      }
    ]
  },
  {
    "code": "41",
    "name": "Huila",
    "capital": "Neiva",
    "municipalities": [
      {
        "name": "Acevedo",
        "zone": "Alta",
        "lat": 1.8052,
        "lng": -75.8887
      },
      {
        "name": "Agrado",
        "zone": "Alta",
        "lat": 2.2599,
        "lng": -75.772
      },
      {
        "name": "Aipe",
        "zone": "Alta",
        "lat": 3.224,
        "lng": -75.239
      },
      {
        "name": "Algeciras",
        "zone": "Alta",
        "lat": 2.5217,
        "lng": -75.3154
      },
      {
        "name": "Altamira",
        "zone": "Alta",
        "lat": 2.0638,
        "lng": -75.7885
      },
      {
        "name": "Baraya",
        "zone": "Alta",
        "lat": 3.1522,
        "lng": -75.0548
      },
      {
        "name": "Campoalegre",
        "zone": "Alta",
        "lat": 2.6868,
        "lng": -75.3257
      },
      {
        "name": "Colombia",
        "zone": "Alta",
        "lat": 3.3767,
        "lng": -74.8028
      },
      {
        "name": "Elías",
        "zone": "Alta",
        "lat": 2.0129,
        "lng": -75.9383
      },
      {
        "name": "Garzón",
        "zone": "Alta",
        "lat": 2.1965,
        "lng": -75.6271
      },
      {
        "name": "Gigante",
        "zone": "Alta",
        "lat": 2.384,
        "lng": -75.5477
      },
      {
        "name": "Guadalupe",
        "zone": "Alta",
        "lat": 2.0243,
        "lng": -75.7572
      },
      {
        "name": "Hobo",
        "zone": "Alta",
        "lat": 2.5808,
        "lng": -75.4477
      },
      {
        "name": "Isnos",
        "zone": "Alta",
        "lat": 1.9295,
        "lng": -76.2176
      },
      {
        "name": "La Argentina",
        "zone": "Alta",
        "lat": 2.1985,
        "lng": -75.9798
      },
      {
        "name": "La Plata",
        "zone": "Alta",
        "lat": 2.3893,
        "lng": -75.8913
      },
      {
        "name": "Neiva",
        "zone": "Alta",
        "lat": 2.9354,
        "lng": -75.2773
      },
      {
        "name": "Nátaga",
        "zone": "Alta",
        "lat": 2.5451,
        "lng": -75.8088
      },
      {
        "name": "Oporapa",
        "zone": "Alta",
        "lat": 2.0251,
        "lng": -75.9952
      },
      {
        "name": "Paicol",
        "zone": "Alta",
        "lat": 2.4497,
        "lng": -75.7732
      },
      {
        "name": "Palermo",
        "zone": "Alta",
        "lat": 2.8896,
        "lng": -75.4353
      },
      {
        "name": "Palestina",
        "zone": "Alta",
        "lat": 1.7237,
        "lng": -76.1333
      },
      {
        "name": "Pital",
        "zone": "Alta",
        "lat": 2.2666,
        "lng": -75.8045
      },
      {
        "name": "Pitalito",
        "zone": "Alta",
        "lat": 1.8526,
        "lng": -76.0494
      },
      {
        "name": "Rivera",
        "zone": "Alta",
        "lat": 2.7776,
        "lng": -75.2588
      },
      {
        "name": "Saladoblanco",
        "zone": "Alta",
        "lat": 1.9934,
        "lng": -76.0447
      },
      {
        "name": "San Agustín",
        "zone": "Alta",
        "lat": 1.8811,
        "lng": -76.2704
      },
      {
        "name": "Santa María",
        "zone": "Alta",
        "lat": 2.9396,
        "lng": -75.5862
      },
      {
        "name": "Suaza",
        "zone": "Alta",
        "lat": 1.9761,
        "lng": -75.7952
      },
      {
        "name": "Tarqui",
        "zone": "Alta",
        "lat": 2.1113,
        "lng": -75.824
      },
      {
        "name": "Tello",
        "zone": "Alta",
        "lat": 3.0675,
        "lng": -75.1388
      },
      {
        "name": "Teruel",
        "zone": "Alta",
        "lat": 2.741,
        "lng": -75.567
      },
      {
        "name": "Tesalia",
        "zone": "Alta",
        "lat": 2.4864,
        "lng": -75.7303
      },
      {
        "name": "Timaná",
        "zone": "Alta",
        "lat": 1.9745,
        "lng": -75.9322
      },
      {
        "name": "Villavieja",
        "zone": "Alta",
        "lat": 3.2188,
        "lng": -75.2172
      },
      {
        "name": "Yaguará",
        "zone": "Alta",
        "lat": 2.6647,
        "lng": -75.518
      },
      {
        "name": "Íquira",
        "zone": "Alta",
        "lat": 2.6494,
        "lng": -75.6345
      }
    ]
  },
  {
    "code": "44",
    "name": "La Guajira",
    "capital": "Riohacha",
    "municipalities": [
      {
        "name": "Albania",
        "zone": "Intermedia",
        "lat": 11.1516,
        "lng": -72.6123
      },
      {
        "name": "Barrancas",
        "zone": "Intermedia",
        "lat": 10.9587,
        "lng": -72.7936
      },
      {
        "name": "Dibulla",
        "zone": "Intermedia",
        "lat": 11.2715,
        "lng": -73.3076
      },
      {
        "name": "Distracción",
        "zone": "Intermedia",
        "lat": 10.8984,
        "lng": -72.8874
      },
      {
        "name": "El Molino",
        "zone": "Intermedia",
        "lat": 10.6535,
        "lng": -72.9267
      },
      {
        "name": "Fonseca",
        "zone": "Baja",
        "lat": 10.8867,
        "lng": -72.8463
      },
      {
        "name": "Hatonuevo",
        "zone": "Intermedia",
        "lat": 11.0689,
        "lng": -72.759
      },
      {
        "name": "La Jagua del Pilar",
        "zone": "Intermedia",
        "lat": 10.5119,
        "lng": -73.0726
      },
      {
        "name": "Maicao",
        "zone": "Baja",
        "lat": 11.3785,
        "lng": -72.2427
      },
      {
        "name": "Manaure",
        "zone": "Intermedia",
        "lat": 11.7738,
        "lng": -72.4387
      },
      {
        "name": "Riohacha",
        "zone": "Baja",
        "lat": 11.5286,
        "lng": -72.9118
      },
      {
        "name": "San Juan del Cesar",
        "zone": "Baja",
        "lat": 10.7695,
        "lng": -73.0006
      },
      {
        "name": "Uribia",
        "zone": "Baja",
        "lat": 11.7119,
        "lng": -72.2659
      },
      {
        "name": "Urumita",
        "zone": "Intermedia",
        "lat": 10.5602,
        "lng": -73.0125
      },
      {
        "name": "Villanueva",
        "zone": "Alta",
        "lat": 10.6088,
        "lng": -72.9776
      }
    ]
  },
  {
    "code": "47",
    "name": "Magdalena",
    "capital": "Santa Marta",
    "municipalities": [
      {
        "name": "Algarrobo",
        "zone": "Baja",
        "lat": 10.1881,
        "lng": -74.0611
      },
      {
        "name": "Aracataca",
        "zone": "Baja",
        "lat": 10.5898,
        "lng": -74.1867
      },
      {
        "name": "Ariguaní",
        "zone": "Baja",
        "lat": 9.847,
        "lng": -74.2365
      },
      {
        "name": "Cerro de San Antonio",
        "zone": "Baja",
        "lat": 10.3255,
        "lng": -74.8685
      },
      {
        "name": "Chivolo",
        "zone": "Baja",
        "lat": 10.0266,
        "lng": -74.6222
      },
      {
        "name": "Ciénaga",
        "zone": "Baja",
        "lat": 11.0067,
        "lng": -74.2413
      },
      {
        "name": "Concordia",
        "zone": "Baja",
        "lat": 10.2573,
        "lng": -74.833
      },
      {
        "name": "El Banco",
        "zone": "Baja",
        "lat": 9.0085,
        "lng": -73.9744
      },
      {
        "name": "El Piñón",
        "zone": "Baja",
        "lat": 10.4028,
        "lng": -74.8231
      },
      {
        "name": "El Retén",
        "zone": "Baja",
        "lat": 10.6105,
        "lng": -74.2684
      },
      {
        "name": "Fundación",
        "zone": "Baja",
        "lat": 10.5141,
        "lng": -74.1915
      },
      {
        "name": "Guamal",
        "zone": "Baja",
        "lat": 9.1444,
        "lng": -74.2237
      },
      {
        "name": "Nueva Granada",
        "zone": "Baja",
        "lat": 9.8019,
        "lng": -74.3918
      },
      {
        "name": "Pedraza",
        "zone": "Baja",
        "lat": 10.1883,
        "lng": -74.9154
      },
      {
        "name": "Pijiño del Carmen",
        "zone": "Baja",
        "lat": 9.3319,
        "lng": -74.459
      },
      {
        "name": "Pivijay",
        "zone": "Baja",
        "lat": 10.4607,
        "lng": -74.6133
      },
      {
        "name": "Plato",
        "zone": "Baja",
        "lat": 9.7967,
        "lng": -74.7845
      },
      {
        "name": "Puebloviejo",
        "zone": "Baja",
        "lat": 10.9948,
        "lng": -74.2825
      },
      {
        "name": "Remolino",
        "zone": "Baja",
        "lat": 10.702,
        "lng": -74.7162
      },
      {
        "name": "Sabanas de San Ángel",
        "zone": "Baja",
        "lat": 10.0325,
        "lng": -74.2139
      },
      {
        "name": "Salamina",
        "zone": "Baja",
        "lat": 10.4912,
        "lng": -74.7942
      },
      {
        "name": "San Sebastián de Buenavista",
        "zone": "Baja",
        "lat": 9.2417,
        "lng": -74.3515
      },
      {
        "name": "San Zenón",
        "zone": "Baja",
        "lat": 9.2451,
        "lng": -74.499
      },
      {
        "name": "Santa Ana",
        "zone": "Baja",
        "lat": 9.3243,
        "lng": -74.5668
      },
      {
        "name": "Santa Bárbara de Pinto",
        "zone": "Baja",
        "lat": 9.4323,
        "lng": -74.7047
      },
      {
        "name": "Santa Marta",
        "zone": "Baja",
        "lat": 11.2047,
        "lng": -74.1998
      },
      {
        "name": "Sitionuevo",
        "zone": "Baja",
        "lat": 10.7753,
        "lng": -74.72
      },
      {
        "name": "Tenerife",
        "zone": "Baja",
        "lat": 9.8983,
        "lng": -74.8598
      },
      {
        "name": "Zapayán",
        "zone": "Baja",
        "lat": 10.1683,
        "lng": -74.7169
      },
      {
        "name": "Zona Bananera",
        "zone": "Baja",
        "lat": 10.763,
        "lng": -74.1401
      }
    ]
  },
  {
    "code": "50",
    "name": "Meta",
    "capital": "Villavicencio",
    "municipalities": [
      {
        "name": "Acacías",
        "zone": "Alta",
        "lat": 3.9904,
        "lng": -73.766
      },
      {
        "name": "Barranca de Upía",
        "zone": "Alta",
        "lat": 4.5662,
        "lng": -72.9611
      },
      {
        "name": "Cabuyaro",
        "zone": "Alta",
        "lat": 4.2867,
        "lng": -72.7918
      },
      {
        "name": "Castilla la Nueva",
        "zone": "Alta",
        "lat": 3.83,
        "lng": -73.6873
      },
      {
        "name": "Cubarral",
        "zone": "Alta",
        "lat": 3.7937,
        "lng": -73.838
      },
      {
        "name": "Cumaral",
        "zone": "Alta",
        "lat": 4.27,
        "lng": -73.4871
      },
      {
        "name": "El Calvario",
        "zone": "Alta",
        "lat": 4.3527,
        "lng": -73.7133
      },
      {
        "name": "El Castillo",
        "zone": "Alta",
        "lat": 3.5639,
        "lng": -73.7942
      },
      {
        "name": "El Dorado",
        "zone": "Alta",
        "lat": 3.74,
        "lng": -73.8353
      },
      {
        "name": "Fuente de Oro",
        "zone": "Alta",
        "lat": 3.4629,
        "lng": -73.6181
      },
      {
        "name": "Granada",
        "zone": "Alta",
        "lat": 3.5471,
        "lng": -73.7058
      },
      {
        "name": "Guamal",
        "zone": "Alta",
        "lat": 3.8797,
        "lng": -73.7688
      },
      {
        "name": "La Macarena",
        "zone": "Alta",
        "lat": 2.1771,
        "lng": -73.7866
      },
      {
        "name": "Lejanías",
        "zone": "Alta",
        "lat": 3.5251,
        "lng": -74.0235
      },
      {
        "name": "Mapiripán",
        "zone": "Alta",
        "lat": 2.8966,
        "lng": -72.1355
      },
      {
        "name": "Mesetas",
        "zone": "Alta",
        "lat": 3.3827,
        "lng": -74.0443
      },
      {
        "name": "Puerto Concordia",
        "zone": "Alta",
        "lat": 2.624,
        "lng": -72.7602
      },
      {
        "name": "Puerto Gaitán",
        "zone": "Alta",
        "lat": 4.3149,
        "lng": -72.0876
      },
      {
        "name": "Puerto Lleras",
        "zone": "Alta",
        "lat": 3.2721,
        "lng": -73.3739
      },
      {
        "name": "Puerto López",
        "zone": "Intermedia",
        "lat": 4.0935,
        "lng": -72.9573
      },
      {
        "name": "Puerto Rico",
        "zone": "Alta",
        "lat": 2.9396,
        "lng": -73.2063
      },
      {
        "name": "Restrepo",
        "zone": "Alta",
        "lat": 4.2596,
        "lng": -73.5654
      },
      {
        "name": "San Carlos de Guaroa",
        "zone": "Alta",
        "lat": 3.7106,
        "lng": -73.2423
      },
      {
        "name": "San Juan de Arama",
        "zone": "Alta",
        "lat": 3.3737,
        "lng": -73.8758
      },
      {
        "name": "San Juanito",
        "zone": "Alta",
        "lat": 4.4582,
        "lng": -73.6767
      },
      {
        "name": "San Martín",
        "zone": "Alta",
        "lat": 3.7019,
        "lng": -73.6958
      },
      {
        "name": "Uribe",
        "zone": "Alta",
        "lat": 3.2396,
        "lng": -74.3515
      },
      {
        "name": "Villavicencio",
        "zone": "Alta",
        "lat": 4.1264,
        "lng": -73.6226
      },
      {
        "name": "Vistahermosa",
        "zone": "Alta",
        "lat": 3.1256,
        "lng": -73.751
      }
    ]
  },
  {
    "code": "52",
    "name": "Nariño",
    "capital": "Pasto",
    "municipalities": [
      {
        "name": "Albán",
        "zone": "Alta",
        "lat": 1.475,
        "lng": -77.0807
      },
      {
        "name": "Aldana",
        "zone": "Alta",
        "lat": 0.8824,
        "lng": -77.7006
      },
      {
        "name": "Ancuya",
        "zone": "Alta",
        "lat": 1.2633,
        "lng": -77.5145
      },
      {
        "name": "Arboleda",
        "zone": "Alta",
        "lat": 1.5034,
        "lng": -77.1355
      },
      {
        "name": "Barbacoas",
        "zone": "Alta",
        "lat": 1.6717,
        "lng": -78.1376
      },
      {
        "name": "Belén",
        "zone": "Alta",
        "lat": 1.5957,
        "lng": -77.0156
      },
      {
        "name": "Buesaco",
        "zone": "Alta",
        "lat": 1.3815,
        "lng": -77.1565
      },
      {
        "name": "Chachagüí",
        "zone": "Alta",
        "lat": 1.3605,
        "lng": -77.2819
      },
      {
        "name": "Colón",
        "zone": "Alta",
        "lat": 1.6439,
        "lng": -77.0198
      },
      {
        "name": "Consacá",
        "zone": "Alta",
        "lat": 1.2079,
        "lng": -77.4661
      },
      {
        "name": "Contadero",
        "zone": "Alta",
        "lat": 0.9105,
        "lng": -77.5494
      },
      {
        "name": "Cuaspud Carlosama",
        "zone": "Alta",
        "lat": 0.863,
        "lng": -77.7289
      },
      {
        "name": "Cumbal",
        "zone": "Alta",
        "lat": 0.9064,
        "lng": -77.7925
      },
      {
        "name": "Cumbitara",
        "zone": "Alta",
        "lat": 1.6472,
        "lng": -77.5786
      },
      {
        "name": "Córdoba",
        "zone": "Alta",
        "lat": 0.8546,
        "lng": -77.5179
      },
      {
        "name": "El Charco",
        "zone": "Alta",
        "lat": 2.4797,
        "lng": -78.1102
      },
      {
        "name": "El Peñol",
        "zone": "Alta",
        "lat": 1.4536,
        "lng": -77.4385
      },
      {
        "name": "El Rosario",
        "zone": "Alta",
        "lat": 1.7453,
        "lng": -77.3342
      },
      {
        "name": "El Tablón de Gómez",
        "zone": "Alta",
        "lat": 1.4273,
        "lng": -77.0971
      },
      {
        "name": "El Tambo",
        "zone": "Alta",
        "lat": 1.4079,
        "lng": -77.3908
      },
      {
        "name": "Francisco Pizarro",
        "zone": "Alta",
        "lat": 2.0406,
        "lng": -78.6584
      },
      {
        "name": "Funes",
        "zone": "Alta",
        "lat": 1.0012,
        "lng": -77.4489
      },
      {
        "name": "Guachucal",
        "zone": "Alta",
        "lat": 0.9597,
        "lng": -77.7316
      },
      {
        "name": "Guaitarilla",
        "zone": "Alta",
        "lat": 1.1296,
        "lng": -77.5498
      },
      {
        "name": "Gualmatán",
        "zone": "Alta",
        "lat": 0.9197,
        "lng": -77.5687
      },
      {
        "name": "Iles",
        "zone": "Alta",
        "lat": 0.9695,
        "lng": -77.5212
      },
      {
        "name": "Imués",
        "zone": "Alta",
        "lat": 1.0551,
        "lng": -77.4963
      },
      {
        "name": "Ipiales",
        "zone": "Alta",
        "lat": 0.8277,
        "lng": -77.6464
      },
      {
        "name": "La Cruz",
        "zone": "Alta",
        "lat": 1.6013,
        "lng": -76.9705
      },
      {
        "name": "La Florida",
        "zone": "Alta",
        "lat": 1.2975,
        "lng": -77.4029
      },
      {
        "name": "La Llanada",
        "zone": "Alta",
        "lat": 1.4729,
        "lng": -77.5809
      },
      {
        "name": "La Tola",
        "zone": "Alta",
        "lat": 2.399,
        "lng": -78.1897
      },
      {
        "name": "La Unión",
        "zone": "Alta",
        "lat": 1.6002,
        "lng": -77.1313
      },
      {
        "name": "Leiva",
        "zone": "Alta",
        "lat": 1.9345,
        "lng": -77.3061
      },
      {
        "name": "Linares",
        "zone": "Alta",
        "lat": 1.3508,
        "lng": -77.524
      },
      {
        "name": "Los Andes",
        "zone": "Alta",
        "lat": 1.4946,
        "lng": -77.5213
      },
      {
        "name": "Magüí",
        "zone": "Alta",
        "lat": 1.7656,
        "lng": -78.1829
      },
      {
        "name": "Mallama",
        "zone": "Alta",
        "lat": 1.141,
        "lng": -77.8645
      },
      {
        "name": "Mosquera",
        "zone": "Intermedia",
        "lat": 2.5071,
        "lng": -78.453
      },
      {
        "name": "Nariño",
        "zone": "Alta",
        "lat": 1.289,
        "lng": -77.358
      },
      {
        "name": "Olaya Herrera",
        "zone": "Alta",
        "lat": 2.3475,
        "lng": -78.3258
      },
      {
        "name": "Ospina",
        "zone": "Alta",
        "lat": 1.0584,
        "lng": -77.5661
      },
      {
        "name": "Pasto",
        "zone": "Alta",
        "lat": 1.2124,
        "lng": -77.2788
      },
      {
        "name": "Policarpa",
        "zone": "Alta",
        "lat": 1.6272,
        "lng": -77.4587
      },
      {
        "name": "Potosí",
        "zone": "Alta",
        "lat": 0.8066,
        "lng": -77.573
      },
      {
        "name": "Providencia",
        "zone": "Baja",
        "lat": 1.2378,
        "lng": -77.5968
      },
      {
        "name": "Puerres",
        "zone": "Alta",
        "lat": 0.8851,
        "lng": -77.5042
      },
      {
        "name": "Pupiales",
        "zone": "Alta",
        "lat": 0.8704,
        "lng": -77.636
      },
      {
        "name": "Ricaurte",
        "zone": "Alta",
        "lat": 1.2125,
        "lng": -77.9952
      },
      {
        "name": "Roberto Payán",
        "zone": "Alta",
        "lat": 1.6975,
        "lng": -78.2457
      },
      {
        "name": "Samaniego",
        "zone": "Alta",
        "lat": 1.3354,
        "lng": -77.5943
      },
      {
        "name": "San Andrés de Tumaco",
        "zone": "Alta",
        "lat": 1.8074,
        "lng": -78.7641
      },
      {
        "name": "San Bernardo",
        "zone": "Alta",
        "lat": 1.5138,
        "lng": -77.0475
      },
      {
        "name": "San Lorenzo",
        "zone": "Alta",
        "lat": 1.5034,
        "lng": -77.2154
      },
      {
        "name": "San Pablo",
        "zone": "Alta",
        "lat": 1.6694,
        "lng": -77.014
      },
      {
        "name": "San Pedro de Cartago",
        "zone": "Alta",
        "lat": 1.5516,
        "lng": -77.1194
      },
      {
        "name": "Sandoná",
        "zone": "Alta",
        "lat": 1.2834,
        "lng": -77.4731
      },
      {
        "name": "Santa Bárbara",
        "zone": "Alta",
        "lat": 2.4497,
        "lng": -77.9799
      },
      {
        "name": "Santacruz",
        "zone": "Alta",
        "lat": 1.2226,
        "lng": -77.677
      },
      {
        "name": "Sapuyes",
        "zone": "Alta",
        "lat": 1.0375,
        "lng": -77.6203
      },
      {
        "name": "Taminango",
        "zone": "Alta",
        "lat": 1.5704,
        "lng": -77.2808
      },
      {
        "name": "Tangua",
        "zone": "Alta",
        "lat": 1.0948,
        "lng": -77.3937
      },
      {
        "name": "Túquerres",
        "zone": "Alta",
        "lat": 1.085,
        "lng": -77.6167
      },
      {
        "name": "Yacuanquer",
        "zone": "Alta",
        "lat": 1.1159,
        "lng": -77.4002
      }
    ]
  },
  {
    "code": "54",
    "name": "Norte de Santander",
    "capital": "Cúcuta",
    "municipalities": [
      {
        "name": "Arboledas",
        "zone": "Alta",
        "lat": 7.643,
        "lng": -72.799
      },
      {
        "name": "Bochalema",
        "zone": "Alta",
        "lat": 7.6122,
        "lng": -72.647
      },
      {
        "name": "Bucarasica",
        "zone": "Alta",
        "lat": 8.0413,
        "lng": -72.8682
      },
      {
        "name": "Chinácota",
        "zone": "Alta",
        "lat": 7.6031,
        "lng": -72.6012
      },
      {
        "name": "Chitagá",
        "zone": "Alta",
        "lat": 7.1382,
        "lng": -72.6655
      },
      {
        "name": "Convención",
        "zone": "Alta",
        "lat": 8.4704,
        "lng": -73.3372
      },
      {
        "name": "Cucutilla",
        "zone": "Alta",
        "lat": 7.5396,
        "lng": -72.7728
      },
      {
        "name": "Cáchira",
        "zone": "Alta",
        "lat": 7.7412,
        "lng": -73.049
      },
      {
        "name": "Cácota",
        "zone": "Alta",
        "lat": 7.2687,
        "lng": -72.6421
      },
      {
        "name": "Durania",
        "zone": "Alta",
        "lat": 7.7148,
        "lng": -72.6585
      },
      {
        "name": "El Carmen",
        "zone": "Alta",
        "lat": 8.5106,
        "lng": -73.4467
      },
      {
        "name": "El Tarra",
        "zone": "Alta",
        "lat": 8.5743,
        "lng": -73.0961
      },
      {
        "name": "El Zulia",
        "zone": "Alta",
        "lat": 7.9386,
        "lng": -72.6047
      },
      {
        "name": "Gramalote",
        "zone": "Alta",
        "lat": 7.9169,
        "lng": -72.7872
      },
      {
        "name": "Hacarí",
        "zone": "Alta",
        "lat": 8.3215,
        "lng": -73.146
      },
      {
        "name": "Herrán",
        "zone": "Alta",
        "lat": 7.5065,
        "lng": -72.4835
      },
      {
        "name": "La Esperanza",
        "zone": "Alta",
        "lat": 7.6398,
        "lng": -73.3281
      },
      {
        "name": "La Playa",
        "zone": "Alta",
        "lat": 8.2112,
        "lng": -73.24
      },
      {
        "name": "Labateca",
        "zone": "Alta",
        "lat": 7.2984,
        "lng": -72.496
      },
      {
        "name": "Los Patios",
        "zone": "Alta",
        "lat": 7.8332,
        "lng": -72.5056
      },
      {
        "name": "Lourdes",
        "zone": "Alta",
        "lat": 7.9456,
        "lng": -72.8324
      },
      {
        "name": "Mutiscua",
        "zone": "Alta",
        "lat": 7.3005,
        "lng": -72.7472
      },
      {
        "name": "Ocaña",
        "zone": "Alta",
        "lat": 8.2486,
        "lng": -73.3561
      },
      {
        "name": "Pamplona",
        "zone": "Alta",
        "lat": 7.3728,
        "lng": -72.6477
      },
      {
        "name": "Pamplonita",
        "zone": "Alta",
        "lat": 7.4367,
        "lng": -72.6391
      },
      {
        "name": "Puerto Santander",
        "zone": "Alta",
        "lat": 8.36,
        "lng": -72.4114
      },
      {
        "name": "Ragonvalia",
        "zone": "Alta",
        "lat": 7.5779,
        "lng": -72.4767
      },
      {
        "name": "Salazar",
        "zone": "Alta",
        "lat": 7.7737,
        "lng": -72.8131
      },
      {
        "name": "San Calixto",
        "zone": "Alta",
        "lat": 8.4021,
        "lng": -73.2086
      },
      {
        "name": "San Cayetano",
        "zone": "Alta",
        "lat": 7.8757,
        "lng": -72.6255
      },
      {
        "name": "San José de Cúcuta",
        "zone": "Alta",
        "lat": 7.9057,
        "lng": -72.5082
      },
      {
        "name": "Santiago",
        "zone": "Alta",
        "lat": 7.8659,
        "lng": -72.7162
      },
      {
        "name": "Sardinata",
        "zone": "Alta",
        "lat": 8.0821,
        "lng": -72.8006
      },
      {
        "name": "Silos",
        "zone": "Alta",
        "lat": 7.2047,
        "lng": -72.7571
      },
      {
        "name": "Teorama",
        "zone": "Alta",
        "lat": 8.4381,
        "lng": -73.2871
      },
      {
        "name": "Tibú",
        "zone": "Alta",
        "lat": 8.6399,
        "lng": -72.7345
      },
      {
        "name": "Toledo",
        "zone": "Alta",
        "lat": 7.3077,
        "lng": -72.4819
      },
      {
        "name": "Villa Caro",
        "zone": "Alta",
        "lat": 7.9142,
        "lng": -72.9736
      },
      {
        "name": "Villa del Rosario",
        "zone": "Alta",
        "lat": 7.8477,
        "lng": -72.4698
      },
      {
        "name": "Ábrego",
        "zone": "Alta",
        "lat": 8.0816,
        "lng": -73.2217
      }
    ]
  },
  {
    "code": "86",
    "name": "Putumayo",
    "capital": "Mocoa",
    "municipalities": [
      {
        "name": "Colón",
        "zone": "Intermedia",
        "lat": 1.1901,
        "lng": -76.9726
      },
      {
        "name": "Mocoa",
        "zone": "Alta",
        "lat": 1.1512,
        "lng": -76.6542
      },
      {
        "name": "Orito",
        "zone": "Alta",
        "lat": 0.6636,
        "lng": -76.8733
      },
      {
        "name": "Puerto Asís",
        "zone": "Intermedia",
        "lat": 0.5056,
        "lng": -76.4969
      },
      {
        "name": "Puerto Caicedo",
        "zone": "Intermedia",
        "lat": 0.6878,
        "lng": -76.6061
      },
      {
        "name": "Puerto Guzmán",
        "zone": "Intermedia",
        "lat": 0.9629,
        "lng": -76.4077
      },
      {
        "name": "Puerto Leguízamo",
        "zone": "Intermedia",
        "lat": -0.1923,
        "lng": -74.7818
      },
      {
        "name": "San Francisco",
        "zone": "Intermedia",
        "lat": 1.1742,
        "lng": -76.8793
      },
      {
        "name": "San Miguel",
        "zone": "Intermedia",
        "lat": 0.3435,
        "lng": -76.9122
      },
      {
        "name": "Santiago",
        "zone": "Intermedia",
        "lat": 1.1471,
        "lng": -77.0026
      },
      {
        "name": "Sibundoy",
        "zone": "Intermedia",
        "lat": 1.2003,
        "lng": -76.9178
      },
      {
        "name": "Valle del Guamuez",
        "zone": "Alta",
        "lat": 0.4235,
        "lng": -76.9068
      },
      {
        "name": "Villagarzón",
        "zone": "Intermedia",
        "lat": 1.0288,
        "lng": -76.6172
      }
    ]
  },
  {
    "code": "63",
    "name": "Quindío",
    "capital": "Armenia",
    "municipalities": [
      {
        "name": "Armenia",
        "zone": "Alta",
        "lat": 4.536,
        "lng": -75.6808
      },
      {
        "name": "Buenavista",
        "zone": "Alta",
        "lat": 4.36,
        "lng": -75.7396
      },
      {
        "name": "Calarcá",
        "zone": "Alta",
        "lat": 4.521,
        "lng": -75.6461
      },
      {
        "name": "Circasia",
        "zone": "Alta",
        "lat": 4.6178,
        "lng": -75.6365
      },
      {
        "name": "Córdoba",
        "zone": "Alta",
        "lat": 4.3925,
        "lng": -75.6879
      },
      {
        "name": "Filandia",
        "zone": "Alta",
        "lat": 4.6743,
        "lng": -75.6584
      },
      {
        "name": "Génova",
        "zone": "Alta",
        "lat": 4.2066,
        "lng": -75.7904
      },
      {
        "name": "La Tebaida",
        "zone": "Alta",
        "lat": 4.4538,
        "lng": -75.7869
      },
      {
        "name": "Montenegro",
        "zone": "Alta",
        "lat": 4.5651,
        "lng": -75.7498
      },
      {
        "name": "Pijao",
        "zone": "Alta",
        "lat": 4.335,
        "lng": -75.7033
      },
      {
        "name": "Quimbaya",
        "zone": "Alta",
        "lat": 4.6244,
        "lng": -75.7651
      },
      {
        "name": "Salento",
        "zone": "Alta",
        "lat": 4.6372,
        "lng": -75.5708
      }
    ]
  },
  {
    "code": "66",
    "name": "Risaralda",
    "capital": "Pereira",
    "municipalities": [
      {
        "name": "Apía",
        "zone": "Alta",
        "lat": 5.1065,
        "lng": -75.9424
      },
      {
        "name": "Balboa",
        "zone": "Alta",
        "lat": 4.9491,
        "lng": -75.9587
      },
      {
        "name": "Belén de Umbría",
        "zone": "Alta",
        "lat": 5.2008,
        "lng": -75.8683
      },
      {
        "name": "Dosquebradas",
        "zone": "Alta",
        "lat": 4.8331,
        "lng": -75.6754
      },
      {
        "name": "Guática",
        "zone": "Alta",
        "lat": 5.3154,
        "lng": -75.799
      },
      {
        "name": "La Celia",
        "zone": "Alta",
        "lat": 5.0028,
        "lng": -76.0032
      },
      {
        "name": "La Virginia",
        "zone": "Alta",
        "lat": 4.8966,
        "lng": -75.8804
      },
      {
        "name": "Marsella",
        "zone": "Alta",
        "lat": 4.9358,
        "lng": -75.7388
      },
      {
        "name": "Mistrató",
        "zone": "Alta",
        "lat": 5.297,
        "lng": -75.8829
      },
      {
        "name": "Pereira",
        "zone": "Alta",
        "lat": 4.805,
        "lng": -75.7197
      },
      {
        "name": "Pueblo Rico",
        "zone": "Alta",
        "lat": 5.222,
        "lng": -76.0308
      },
      {
        "name": "Quinchía",
        "zone": "Alta",
        "lat": 5.3405,
        "lng": -75.7304
      },
      {
        "name": "Santa Rosa de Cabal",
        "zone": "Alta",
        "lat": 4.8763,
        "lng": -75.6233
      },
      {
        "name": "Santuario",
        "zone": "Alta",
        "lat": 5.0749,
        "lng": -75.9646
      }
    ]
  },
  {
    "code": "88",
    "name": "San Andrés y Providencia",
    "capital": "San Andrés",
    "municipalities": [
      {
        "name": "Providencia",
        "zone": "Baja",
        "lat": 13.3732,
        "lng": -81.3684
      },
      {
        "name": "San Andrés",
        "zone": "Baja",
        "lat": 12.5781,
        "lng": -81.7072
      }
    ]
  },
  {
    "code": "68",
    "name": "Santander",
    "capital": "Bucaramanga",
    "municipalities": [
      {
        "name": "Aguada",
        "zone": "Alta",
        "lat": 6.1624,
        "lng": -73.5231
      },
      {
        "name": "Albania",
        "zone": "Alta",
        "lat": 5.7592,
        "lng": -73.9134
      },
      {
        "name": "Aratoca",
        "zone": "Alta",
        "lat": 6.6944,
        "lng": -73.0179
      },
      {
        "name": "Barbosa",
        "zone": "Alta",
        "lat": 5.9325,
        "lng": -73.616
      },
      {
        "name": "Barichara",
        "zone": "Alta",
        "lat": 6.6341,
        "lng": -73.223
      },
      {
        "name": "Barrancabermeja",
        "zone": "Intermedia",
        "lat": 7.0649,
        "lng": -73.8492
      },
      {
        "name": "Betulia",
        "zone": "Alta",
        "lat": 6.8995,
        "lng": -73.2837
      },
      {
        "name": "Bolívar",
        "zone": "Alta",
        "lat": 5.989,
        "lng": -73.7713
      },
      {
        "name": "Bucaramanga",
        "zone": "Alta",
        "lat": 7.1165,
        "lng": -73.1326
      },
      {
        "name": "Cabrera",
        "zone": "Alta",
        "lat": 6.5921,
        "lng": -73.2465
      },
      {
        "name": "California",
        "zone": "Alta",
        "lat": 7.348,
        "lng": -72.9465
      },
      {
        "name": "Capitanejo",
        "zone": "Alta",
        "lat": 6.5274,
        "lng": -72.6954
      },
      {
        "name": "Carcasí",
        "zone": "Alta",
        "lat": 6.629,
        "lng": -72.6271
      },
      {
        "name": "Cepitá",
        "zone": "Alta",
        "lat": 6.7535,
        "lng": -72.9735
      },
      {
        "name": "Cerrito",
        "zone": "Alta",
        "lat": 6.8404,
        "lng": -72.6949
      },
      {
        "name": "Charalá",
        "zone": "Alta",
        "lat": 6.2843,
        "lng": -73.1469
      },
      {
        "name": "Charta",
        "zone": "Alta",
        "lat": 7.2808,
        "lng": -72.9688
      },
      {
        "name": "Chima",
        "zone": "Alta",
        "lat": 6.3443,
        "lng": -73.3737
      },
      {
        "name": "Chipatá",
        "zone": "Alta",
        "lat": 6.0625,
        "lng": -73.6371
      },
      {
        "name": "Cimitarra",
        "zone": "Alta",
        "lat": 6.3209,
        "lng": -73.953
      },
      {
        "name": "Concepción",
        "zone": "Alta",
        "lat": 6.7689,
        "lng": -72.6946
      },
      {
        "name": "Confines",
        "zone": "Alta",
        "lat": 6.3573,
        "lng": -73.2406
      },
      {
        "name": "Contratación",
        "zone": "Alta",
        "lat": 6.2906,
        "lng": -73.4744
      },
      {
        "name": "Coromoro",
        "zone": "Alta",
        "lat": 6.295,
        "lng": -73.0408
      },
      {
        "name": "Curití",
        "zone": "Alta",
        "lat": 6.6051,
        "lng": -73.0694
      },
      {
        "name": "El Carmen de Chucurí",
        "zone": "Alta",
        "lat": 6.7,
        "lng": -73.5107
      },
      {
        "name": "El Guacamayo",
        "zone": "Alta",
        "lat": 6.2451,
        "lng": -73.4969
      },
      {
        "name": "El Peñón",
        "zone": "Alta",
        "lat": 6.0554,
        "lng": -73.8155
      },
      {
        "name": "El Playón",
        "zone": "Alta",
        "lat": 7.4707,
        "lng": -73.2029
      },
      {
        "name": "Encino",
        "zone": "Alta",
        "lat": 6.1374,
        "lng": -73.0987
      },
      {
        "name": "Enciso",
        "zone": "Alta",
        "lat": 6.668,
        "lng": -72.6996
      },
      {
        "name": "Floridablanca",
        "zone": "Alta",
        "lat": 7.0723,
        "lng": -73.0991
      },
      {
        "name": "Florián",
        "zone": "Alta",
        "lat": 5.8047,
        "lng": -73.9714
      },
      {
        "name": "Galán",
        "zone": "Alta",
        "lat": 6.6384,
        "lng": -73.2878
      },
      {
        "name": "Girón",
        "zone": "Alta",
        "lat": 7.0704,
        "lng": -73.1668
      },
      {
        "name": "Guaca",
        "zone": "Alta",
        "lat": 6.8766,
        "lng": -72.8563
      },
      {
        "name": "Guadalupe",
        "zone": "Alta",
        "lat": 6.2458,
        "lng": -73.4193
      },
      {
        "name": "Guapotá",
        "zone": "Alta",
        "lat": 6.3086,
        "lng": -73.3207
      },
      {
        "name": "Guavatá",
        "zone": "Alta",
        "lat": 5.9543,
        "lng": -73.7009
      },
      {
        "name": "Gámbita",
        "zone": "Alta",
        "lat": 5.946,
        "lng": -73.3442
      },
      {
        "name": "Güepsa",
        "zone": "Alta",
        "lat": 6.025,
        "lng": -73.5751
      },
      {
        "name": "Hato",
        "zone": "Alta",
        "lat": 6.544,
        "lng": -73.3084
      },
      {
        "name": "Jesús María",
        "zone": "Alta",
        "lat": 5.8765,
        "lng": -73.7834
      },
      {
        "name": "Jordán",
        "zone": "Alta",
        "lat": 6.7327,
        "lng": -73.0961
      },
      {
        "name": "La Belleza",
        "zone": "Alta",
        "lat": 5.8593,
        "lng": -73.9655
      },
      {
        "name": "La Paz",
        "zone": "Alta",
        "lat": 6.1785,
        "lng": -73.5896
      },
      {
        "name": "Landázuri",
        "zone": "Alta",
        "lat": 6.2188,
        "lng": -73.8114
      },
      {
        "name": "Lebrija",
        "zone": "Alta",
        "lat": 7.1134,
        "lng": -73.2195
      },
      {
        "name": "Los Santos",
        "zone": "Alta",
        "lat": 6.7552,
        "lng": -73.1027
      },
      {
        "name": "Macaravita",
        "zone": "Alta",
        "lat": 6.5066,
        "lng": -72.5931
      },
      {
        "name": "Matanza",
        "zone": "Alta",
        "lat": 7.3232,
        "lng": -73.0156
      },
      {
        "name": "Mogotes",
        "zone": "Alta",
        "lat": 6.4752,
        "lng": -72.9698
      },
      {
        "name": "Molagavita",
        "zone": "Alta",
        "lat": 6.6743,
        "lng": -72.8092
      },
      {
        "name": "Málaga",
        "zone": "Alta",
        "lat": 6.7031,
        "lng": -72.7321
      },
      {
        "name": "Ocamonte",
        "zone": "Alta",
        "lat": 6.34,
        "lng": -73.1226
      },
      {
        "name": "Oiba",
        "zone": "Alta",
        "lat": 6.2652,
        "lng": -73.2998
      },
      {
        "name": "Onzaga",
        "zone": "Alta",
        "lat": 6.3441,
        "lng": -72.8168
      },
      {
        "name": "Palmar",
        "zone": "Alta",
        "lat": 6.5378,
        "lng": -73.2911
      },
      {
        "name": "Palmas del Socorro",
        "zone": "Alta",
        "lat": 6.4061,
        "lng": -73.2878
      },
      {
        "name": "Piedecuesta",
        "zone": "Alta",
        "lat": 6.9972,
        "lng": -73.0548
      },
      {
        "name": "Pinchote",
        "zone": "Alta",
        "lat": 6.5316,
        "lng": -73.1742
      },
      {
        "name": "Puente Nacional",
        "zone": "Alta",
        "lat": 5.8784,
        "lng": -73.6776
      },
      {
        "name": "Puerto Parra",
        "zone": "Alta",
        "lat": 6.6508,
        "lng": -74.0561
      },
      {
        "name": "Puerto Wilches",
        "zone": "Alta",
        "lat": 7.3441,
        "lng": -73.8999
      },
      {
        "name": "Páramo",
        "zone": "Alta",
        "lat": 6.4168,
        "lng": -73.1702
      },
      {
        "name": "Rionegro",
        "zone": "Alta",
        "lat": 7.265,
        "lng": -73.1502
      },
      {
        "name": "Sabana de Torres",
        "zone": "Alta",
        "lat": 7.3919,
        "lng": -73.4991
      },
      {
        "name": "San Andrés",
        "zone": "Baja",
        "lat": 6.8115,
        "lng": -72.8489
      },
      {
        "name": "San Benito",
        "zone": "Alta",
        "lat": 6.1267,
        "lng": -73.5091
      },
      {
        "name": "San Gil",
        "zone": "Alta",
        "lat": 6.552,
        "lng": -73.1348
      },
      {
        "name": "San Joaquín",
        "zone": "Alta",
        "lat": 6.4275,
        "lng": -72.8676
      },
      {
        "name": "San José de Miranda",
        "zone": "Alta",
        "lat": 6.659,
        "lng": -72.7336
      },
      {
        "name": "San Miguel",
        "zone": "Alta",
        "lat": 6.5753,
        "lng": -72.6441
      },
      {
        "name": "San Vicente de Chucurí",
        "zone": "Alta",
        "lat": 6.8804,
        "lng": -73.411
      },
      {
        "name": "Santa Bárbara",
        "zone": "Alta",
        "lat": 6.991,
        "lng": -72.9074
      },
      {
        "name": "Santa Helena del Opón",
        "zone": "Alta",
        "lat": 6.3396,
        "lng": -73.6167
      },
      {
        "name": "Simacota",
        "zone": "Alta",
        "lat": 6.4435,
        "lng": -73.3374
      },
      {
        "name": "Socorro",
        "zone": "Alta",
        "lat": 6.4639,
        "lng": -73.2612
      },
      {
        "name": "Suaita",
        "zone": "Alta",
        "lat": 6.1013,
        "lng": -73.4416
      },
      {
        "name": "Sucre",
        "zone": "Alta",
        "lat": 5.9187,
        "lng": -73.791
      },
      {
        "name": "Suratá",
        "zone": "Alta",
        "lat": 7.3666,
        "lng": -72.9842
      },
      {
        "name": "Tona",
        "zone": "Alta",
        "lat": 7.2014,
        "lng": -72.967
      },
      {
        "name": "Valle de San José",
        "zone": "Alta",
        "lat": 6.448,
        "lng": -73.1435
      },
      {
        "name": "Vetas",
        "zone": "Alta",
        "lat": 7.3098,
        "lng": -72.871
      },
      {
        "name": "Villanueva",
        "zone": "Alta",
        "lat": 6.6701,
        "lng": -73.1743
      },
      {
        "name": "Vélez",
        "zone": "Alta",
        "lat": 6.0093,
        "lng": -73.6724
      },
      {
        "name": "Zapatoca",
        "zone": "Alta",
        "lat": 6.8144,
        "lng": -73.268
      }
    ]
  },
  {
    "code": "70",
    "name": "Sucre",
    "capital": "Sincelejo",
    "municipalities": [
      {
        "name": "Buenavista",
        "zone": "Baja",
        "lat": 9.3198,
        "lng": -74.9728
      },
      {
        "name": "Caimito",
        "zone": "Baja",
        "lat": 8.7893,
        "lng": -75.1171
      },
      {
        "name": "Chalán",
        "zone": "Baja",
        "lat": 9.5454,
        "lng": -75.3127
      },
      {
        "name": "Colosó",
        "zone": "Baja",
        "lat": 9.4942,
        "lng": -75.3533
      },
      {
        "name": "Corozal",
        "zone": "Baja",
        "lat": 9.3187,
        "lng": -75.293
      },
      {
        "name": "Coveñas",
        "zone": "Baja",
        "lat": 9.4028,
        "lng": -75.6802
      },
      {
        "name": "El Roble",
        "zone": "Baja",
        "lat": 9.1006,
        "lng": -75.1984
      },
      {
        "name": "Galeras",
        "zone": "Baja",
        "lat": 9.1604,
        "lng": -75.0496
      },
      {
        "name": "Guaranda",
        "zone": "Baja",
        "lat": 8.4686,
        "lng": -74.5377
      },
      {
        "name": "La Unión",
        "zone": "Alta",
        "lat": 8.854,
        "lng": -75.2761
      },
      {
        "name": "Los Palmitos",
        "zone": "Baja",
        "lat": 9.3803,
        "lng": -75.2687
      },
      {
        "name": "Majagual",
        "zone": "Baja",
        "lat": 8.5412,
        "lng": -74.6281
      },
      {
        "name": "Morroa",
        "zone": "Baja",
        "lat": 9.3314,
        "lng": -75.3059
      },
      {
        "name": "Ovejas",
        "zone": "Baja",
        "lat": 9.5272,
        "lng": -75.229
      },
      {
        "name": "Palmito",
        "zone": "Baja",
        "lat": 9.3332,
        "lng": -75.5413
      },
      {
        "name": "Sampués",
        "zone": "Baja",
        "lat": 9.1832,
        "lng": -75.3802
      },
      {
        "name": "San Benito Abad",
        "zone": "Baja",
        "lat": 8.9301,
        "lng": -75.0311
      },
      {
        "name": "San José de Toluviejo",
        "zone": "Baja",
        "lat": 9.4518,
        "lng": -75.4408
      },
      {
        "name": "San Juan de Betulia",
        "zone": "Baja",
        "lat": 9.2731,
        "lng": -75.2436
      },
      {
        "name": "San Luis de Sincé",
        "zone": "Baja",
        "lat": 9.2443,
        "lng": -75.146
      },
      {
        "name": "San Marcos",
        "zone": "Baja",
        "lat": 8.6618,
        "lng": -75.1338
      },
      {
        "name": "San Onofre",
        "zone": "Baja",
        "lat": 9.737,
        "lng": -75.5224
      },
      {
        "name": "San Pedro",
        "zone": "Baja",
        "lat": 9.3963,
        "lng": -75.0636
      },
      {
        "name": "Santiago de Tolú",
        "zone": "Baja",
        "lat": 9.5254,
        "lng": -75.5811
      },
      {
        "name": "Sincelejo",
        "zone": "Baja",
        "lat": 9.3023,
        "lng": -75.3954
      },
      {
        "name": "Sucre",
        "zone": "Baja",
        "lat": 8.8117,
        "lng": -74.7232
      }
    ]
  },
  {
    "code": "73",
    "name": "Tolima",
    "capital": "Ibagué",
    "municipalities": [
      {
        "name": "Alpujarra",
        "zone": "Alta",
        "lat": 3.3915,
        "lng": -74.9329
      },
      {
        "name": "Alvarado",
        "zone": "Alta",
        "lat": 4.5674,
        "lng": -74.9534
      },
      {
        "name": "Ambalema",
        "zone": "Alta",
        "lat": 4.7827,
        "lng": -74.7644
      },
      {
        "name": "Anzoátegui",
        "zone": "Alta",
        "lat": 4.6318,
        "lng": -75.0938
      },
      {
        "name": "Armero",
        "zone": "Alta",
        "lat": 5.0307,
        "lng": -74.8844
      },
      {
        "name": "Ataco",
        "zone": "Alta",
        "lat": 3.5906,
        "lng": -75.3825
      },
      {
        "name": "Cajamarca",
        "zone": "Alta",
        "lat": 4.4388,
        "lng": -75.432
      },
      {
        "name": "Carmen de Apicalá",
        "zone": "Alta",
        "lat": 4.1523,
        "lng": -74.7176
      },
      {
        "name": "Casabianca",
        "zone": "Alta",
        "lat": 5.0785,
        "lng": -75.121
      },
      {
        "name": "Chaparral",
        "zone": "Alta",
        "lat": 3.7229,
        "lng": -75.4808
      },
      {
        "name": "Coello",
        "zone": "Alta",
        "lat": 4.2873,
        "lng": -74.8985
      },
      {
        "name": "Coyaima",
        "zone": "Alta",
        "lat": 3.798,
        "lng": -75.1939
      },
      {
        "name": "Cunday",
        "zone": "Alta",
        "lat": 4.0593,
        "lng": -74.6922
      },
      {
        "name": "Dolores",
        "zone": "Alta",
        "lat": 3.5391,
        "lng": -74.8968
      },
      {
        "name": "Espinal",
        "zone": "Alta",
        "lat": 4.1513,
        "lng": -74.8854
      },
      {
        "name": "Falan",
        "zone": "Alta",
        "lat": 5.1231,
        "lng": -74.953
      },
      {
        "name": "Flandes",
        "zone": "Alta",
        "lat": 4.2764,
        "lng": -74.8188
      },
      {
        "name": "Fresno",
        "zone": "Alta",
        "lat": 5.1536,
        "lng": -75.0357
      },
      {
        "name": "Guamo",
        "zone": "Alta",
        "lat": 4.031,
        "lng": -74.9681
      },
      {
        "name": "Herveo",
        "zone": "Alta",
        "lat": 5.0802,
        "lng": -75.1772
      },
      {
        "name": "Honda",
        "zone": "Intermedia",
        "lat": 5.2118,
        "lng": -74.757
      },
      {
        "name": "Ibagué",
        "zone": "Alta",
        "lat": 4.4322,
        "lng": -75.1942
      },
      {
        "name": "Icononzo",
        "zone": "Alta",
        "lat": 4.1765,
        "lng": -74.532
      },
      {
        "name": "Lérida",
        "zone": "Alta",
        "lat": 4.862,
        "lng": -74.9107
      },
      {
        "name": "Líbano",
        "zone": "Alta",
        "lat": 4.9204,
        "lng": -75.062
      },
      {
        "name": "Melgar",
        "zone": "Intermedia",
        "lat": 4.2037,
        "lng": -74.6413
      },
      {
        "name": "Murillo",
        "zone": "Alta",
        "lat": 4.8743,
        "lng": -75.171
      },
      {
        "name": "Natagaima",
        "zone": "Alta",
        "lat": 3.6243,
        "lng": -75.0932
      },
      {
        "name": "Ortega",
        "zone": "Alta",
        "lat": 3.9349,
        "lng": -75.2226
      },
      {
        "name": "Palocabildo",
        "zone": "Alta",
        "lat": 5.1209,
        "lng": -75.0222
      },
      {
        "name": "Piedras",
        "zone": "Alta",
        "lat": 4.544,
        "lng": -74.8781
      },
      {
        "name": "Planadas",
        "zone": "Alta",
        "lat": 3.1979,
        "lng": -75.6442
      },
      {
        "name": "Prado",
        "zone": "Alta",
        "lat": 3.7509,
        "lng": -74.9274
      },
      {
        "name": "Purificación",
        "zone": "Alta",
        "lat": 3.8572,
        "lng": -74.9356
      },
      {
        "name": "Rioblanco",
        "zone": "Alta",
        "lat": 3.5299,
        "lng": -75.6441
      },
      {
        "name": "Roncesvalles",
        "zone": "Alta",
        "lat": 4.0116,
        "lng": -75.606
      },
      {
        "name": "Rovira",
        "zone": "Alta",
        "lat": 4.239,
        "lng": -75.2406
      },
      {
        "name": "Saldaña",
        "zone": "Alta",
        "lat": 3.9298,
        "lng": -75.0169
      },
      {
        "name": "San Antonio",
        "zone": "Alta",
        "lat": 3.9141,
        "lng": -75.4801
      },
      {
        "name": "San Luis",
        "zone": "Alta",
        "lat": 4.1337,
        "lng": -75.0958
      },
      {
        "name": "San Sebastián de Mariquita",
        "zone": "Alta",
        "lat": 5.1997,
        "lng": -74.8893
      },
      {
        "name": "Santa Isabel",
        "zone": "Alta",
        "lat": 4.7136,
        "lng": -75.0979
      },
      {
        "name": "Suárez",
        "zone": "Alta",
        "lat": 4.0489,
        "lng": -74.8319
      },
      {
        "name": "Valle de San Juan",
        "zone": "Alta",
        "lat": 4.1975,
        "lng": -75.1157
      },
      {
        "name": "Venadillo",
        "zone": "Alta",
        "lat": 4.7179,
        "lng": -74.9293
      },
      {
        "name": "Villahermosa",
        "zone": "Alta",
        "lat": 5.0305,
        "lng": -75.1177
      },
      {
        "name": "Villarrica",
        "zone": "Alta",
        "lat": 3.9369,
        "lng": -74.6003
      }
    ]
  },
  {
    "code": "76",
    "name": "Valle del Cauca",
    "capital": "Cali",
    "municipalities": [
      {
        "name": "Alcalá",
        "zone": "Alta",
        "lat": 4.675,
        "lng": -75.7798
      },
      {
        "name": "Andalucía",
        "zone": "Alta",
        "lat": 4.1717,
        "lng": -76.1679
      },
      {
        "name": "Ansermanuevo",
        "zone": "Alta",
        "lat": 4.795,
        "lng": -75.992
      },
      {
        "name": "Argelia",
        "zone": "Alta",
        "lat": 4.7269,
        "lng": -76.1199
      },
      {
        "name": "Bolívar",
        "zone": "Alta",
        "lat": 4.3378,
        "lng": -76.1836
      },
      {
        "name": "Buenaventura",
        "zone": "Alta",
        "lat": 3.8757,
        "lng": -77.0107
      },
      {
        "name": "Bugalagrande",
        "zone": "Alta",
        "lat": 4.2084,
        "lng": -76.1568
      },
      {
        "name": "Caicedonia",
        "zone": "Alta",
        "lat": 4.3348,
        "lng": -75.8306
      },
      {
        "name": "Calima",
        "zone": "Alta",
        "lat": 3.9337,
        "lng": -76.4841
      },
      {
        "name": "Candelaria",
        "zone": "Alta",
        "lat": 3.4084,
        "lng": -76.3465
      },
      {
        "name": "Cartago",
        "zone": "Alta",
        "lat": 4.7422,
        "lng": -75.9244
      },
      {
        "name": "Dagua",
        "zone": "Alta",
        "lat": 3.6573,
        "lng": -76.6889
      },
      {
        "name": "El Cairo",
        "zone": "Alta",
        "lat": 4.7609,
        "lng": -76.2216
      },
      {
        "name": "El Cerrito",
        "zone": "Alta",
        "lat": 3.6842,
        "lng": -76.312
      },
      {
        "name": "El Dovio",
        "zone": "Alta",
        "lat": 4.5105,
        "lng": -76.2371
      },
      {
        "name": "El Águila",
        "zone": "Alta",
        "lat": 4.9061,
        "lng": -76.0428
      },
      {
        "name": "Florida",
        "zone": "Alta",
        "lat": 3.3241,
        "lng": -76.2342
      },
      {
        "name": "Ginebra",
        "zone": "Alta",
        "lat": 3.7242,
        "lng": -76.2681
      },
      {
        "name": "Guacarí",
        "zone": "Alta",
        "lat": 3.7618,
        "lng": -76.3309
      },
      {
        "name": "Guadalajara de Buga",
        "zone": "Alta",
        "lat": 3.9007,
        "lng": -76.299
      },
      {
        "name": "Jamundí",
        "zone": "Alta",
        "lat": 3.2588,
        "lng": -76.5385
      },
      {
        "name": "La Cumbre",
        "zone": "Alta",
        "lat": 3.6493,
        "lng": -76.568
      },
      {
        "name": "La Unión",
        "zone": "Alta",
        "lat": 4.5339,
        "lng": -76.0997
      },
      {
        "name": "La Victoria",
        "zone": "Alta",
        "lat": 4.5236,
        "lng": -76.0365
      },
      {
        "name": "Obando",
        "zone": "Alta",
        "lat": 4.5757,
        "lng": -75.9747
      },
      {
        "name": "Palmira",
        "zone": "Alta",
        "lat": 3.5315,
        "lng": -76.2988
      },
      {
        "name": "Pradera",
        "zone": "Alta",
        "lat": 3.4198,
        "lng": -76.2418
      },
      {
        "name": "Restrepo",
        "zone": "Alta",
        "lat": 3.8214,
        "lng": -76.5233
      },
      {
        "name": "Riofrío",
        "zone": "Alta",
        "lat": 4.1569,
        "lng": -76.2883
      },
      {
        "name": "Roldanillo",
        "zone": "Alta",
        "lat": 4.4136,
        "lng": -76.1523
      },
      {
        "name": "San Pedro",
        "zone": "Alta",
        "lat": 3.9951,
        "lng": -76.2287
      },
      {
        "name": "Santiago de Cali",
        "zone": "Alta",
        "lat": 3.4137,
        "lng": -76.5213
      },
      {
        "name": "Sevilla",
        "zone": "Alta",
        "lat": 4.2707,
        "lng": -75.9316
      },
      {
        "name": "Toro",
        "zone": "Alta",
        "lat": 4.6081,
        "lng": -76.0769
      },
      {
        "name": "Trujillo",
        "zone": "Alta",
        "lat": 4.212,
        "lng": -76.3188
      },
      {
        "name": "Tuluá",
        "zone": "Alta",
        "lat": 4.0854,
        "lng": -76.1977
      },
      {
        "name": "Ulloa",
        "zone": "Alta",
        "lat": 4.7036,
        "lng": -75.7378
      },
      {
        "name": "Versalles",
        "zone": "Alta",
        "lat": 4.575,
        "lng": -76.1992
      },
      {
        "name": "Vijes",
        "zone": "Alta",
        "lat": 3.6987,
        "lng": -76.4418
      },
      {
        "name": "Yotoco",
        "zone": "Alta",
        "lat": 3.8612,
        "lng": -76.3827
      },
      {
        "name": "Yumbo",
        "zone": "Alta",
        "lat": 3.5401,
        "lng": -76.4999
      },
      {
        "name": "Zarzal",
        "zone": "Alta",
        "lat": 4.3927,
        "lng": -76.0708
      }
    ]
  },
  {
    "code": "97",
    "name": "Vaupés",
    "capital": "Mitú",
    "municipalities": [
      {
        "name": "Carurú",
        "zone": "Baja",
        "lat": 1.0161,
        "lng": -71.3022
      },
      {
        "name": "Mitú",
        "zone": "Baja",
        "lat": 1.2532,
        "lng": -70.2326
      },
      {
        "name": "Pacoa",
        "zone": "Baja",
        "lat": 0.0207,
        "lng": -71.0043
      },
      {
        "name": "Papunahua",
        "zone": "Baja",
        "lat": 1.9081,
        "lng": -70.7609
      },
      {
        "name": "Taraira",
        "zone": "Baja",
        "lat": -0.565,
        "lng": -69.6355
      },
      {
        "name": "Yavaraté",
        "zone": "Baja",
        "lat": 0.6091,
        "lng": -69.2033
      }
    ]
  },
  {
    "code": "99",
    "name": "Vichada",
    "capital": "Puerto Carreño",
    "municipalities": [
      {
        "name": "Cumaribo",
        "zone": "Baja",
        "lat": 4.4464,
        "lng": -69.7955
      },
      {
        "name": "La Primavera",
        "zone": "Baja",
        "lat": 5.4863,
        "lng": -70.4105
      },
      {
        "name": "Puerto Carreño",
        "zone": "Baja",
        "lat": 6.1866,
        "lng": -67.4871
      },
      {
        "name": "Santa Rosalía",
        "zone": "Baja",
        "lat": 5.1364,
        "lng": -70.8595
      }
    ]
  }
];

/**
 * Encuentra información de los municipios de un departamento
 */
export function getMunicipalitiesByDepartment(departmentName: string): MunicipalityGeo[] {
  if (!departmentName) return [];
  const normalized = departmentName.trim().toLowerCase();
  const dept = COLOMBIA_DEPARTMENTS.find(
    (d) =>
      d.name.toLowerCase() === normalized ||
      d.name.toLowerCase().includes(normalized) ||
      normalized.includes(d.name.toLowerCase())
  );
  return dept ? dept.municipalities : [];
}

/**
 * Obtiene lista ordenada de todos los nombres de departamentos
 */
export function getAllDepartments(): string[] {
  return COLOMBIA_DEPARTMENTS.map((d) => d.name);
}

const COMMON_CITY_ALIASES: Record<string, string> = {
  cali: 'santiago de cali',
  cartagena: 'cartagena de indias',
  pasto: 'san juan de pasto',
  bogota: 'bogotá d.c.',
  'bogota d.c.': 'bogotá d.c.',
  cucuta: 'cúcuta',
  medellin: 'medellín',
  'san andres': 'san andrés',
};

/**
 * Normaliza cadenas para comparación fonética/lexical tolerante a tildes
 */
function cleanStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca un municipio por nombre en un departamento o a nivel nacional
 */
export function findGeoByCity(
  cityName: string,
  departmentName?: string
): { dept: string; zone: SeismicZone; lat: number; lng: number } | null {
  if (!cityName) return null;
  const rawClean = cityName.trim().toLowerCase();
  const aliasTarget = COMMON_CITY_ALIASES[rawClean] || rawClean;
  const cleanTarget = cleanStr(aliasTarget);

  // 1. Si se especifica departamento, buscar primero coincidencia exacta en él
  if (departmentName) {
    const deptObj = COLOMBIA_DEPARTMENTS.find(
      (d) => cleanStr(d.name) === cleanStr(departmentName)
    );
    if (deptObj) {
      const exact = deptObj.municipalities.find(
        (m) => cleanStr(m.name) === cleanTarget || cleanStr(m.name) === cleanStr(rawClean)
      );
      if (exact) {
        return { dept: deptObj.name, zone: exact.zone, lat: exact.lat, lng: exact.lng };
      }
    }
  }

  // 2. Coincidencia exacta en TODO el país (prioridad absoluta sobre coincidencias parciales)
  for (const dept of COLOMBIA_DEPARTMENTS) {
    const exact = dept.municipalities.find(
      (m) => cleanStr(m.name) === cleanTarget || cleanStr(m.name) === cleanStr(rawClean)
    );
    if (exact) {
      return { dept: dept.name, zone: exact.zone, lat: exact.lat, lng: exact.lng };
    }
  }

  // 3. Coincidencia con nombre de capital departamental
  for (const dept of COLOMBIA_DEPARTMENTS) {
    if (cleanStr(dept.capital) === cleanTarget || cleanStr(dept.capital) === cleanStr(rawClean)) {
      const capMatch = dept.municipalities.find(
        (m) => cleanStr(m.name).includes(cleanTarget) || cleanStr(m.name).includes(cleanStr(dept.capital))
      );
      if (capMatch) {
        return { dept: dept.name, zone: capMatch.zone, lat: capMatch.lat, lng: capMatch.lng };
      }
    }
  }

  // 4. Coincidencia parcial (prefijo o palabra contenida)
  for (const dept of COLOMBIA_DEPARTMENTS) {
    const partial = dept.municipalities.find((m) => {
      const cName = cleanStr(m.name);
      return cName.startsWith(cleanTarget) || cName.includes(cleanTarget);
    });
    if (partial) {
      return { dept: dept.name, zone: partial.zone, lat: partial.lat, lng: partial.lng };
    }
  }

  return null;
}

/**
 * Busca municipios predictivamente en todo el país o dentro de un departamento específico
 */
export function searchMunicipalities(
  query: string,
  departmentName?: string,
  limit = 20
): Array<{ name: string; department: string; zone: SeismicZone; lat: number; lng: number }> {
  if (!query || query.trim().length === 0) {
    if (departmentName) {
      return getMunicipalitiesByDepartment(departmentName).slice(0, limit).map((m) => ({
        ...m,
        department: departmentName,
      }));
    }
    return [];
  }

  const q = query.trim().toLowerCase();
  const results: Array<{ name: string; department: string; zone: SeismicZone; lat: number; lng: number }> = [];

  const targetDepts = departmentName
    ? COLOMBIA_DEPARTMENTS.filter((d) => d.name.toLowerCase() === departmentName.trim().toLowerCase())
    : COLOMBIA_DEPARTMENTS;

  for (const dept of targetDepts) {
    for (const m of dept.municipalities) {
      if (m.name.toLowerCase().includes(q)) {
        results.push({
          name: m.name,
          department: dept.name,
          zone: m.zone,
          lat: m.lat,
          lng: m.lng,
        });
        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}
