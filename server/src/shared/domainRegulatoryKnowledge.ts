export interface PedagogicalExplanation {
  id: string;
  title: string;
  category: 'coverage' | 'deductible' | 'rule';
  keywords: string[];
  whatItCovers: string;
  claimImpact: string;
  comparisonTip: string;
  legalReference?: string;
}

export interface DomainRegulatoryProfile {
  domain: string;
  displayName: string;
  tagline: string;
  primaryLaws: Array<{
    code: string;
    title: string;
    summary: string;
  }>;
  mandatoryVerificationRules: Array<{
    id: string;
    title: string;
    legalBasis: string;
    description: string;
    keywords: string[];
    severityIfMissing: 'CRITICAL' | 'WARNING';
  }>;
  thesaurusHighlights: string[];
  advisoryIntroForClient: string;
}

export const DOMAIN_REGULATORY_PROFILES: Record<string, DomainRegulatoryProfile> = {
  pyme: {
    domain: 'pyme',
    displayName: 'Multirriesgo PYME / Daños Materiales',
    tagline: 'Protección integral del patrimonio empresarial, continuidad del negocio (Lucro Cesante) y responsabilidad frente a terceros.',
    primaryLaws: [
      {
        code: 'Art. 1088 Co.Co.',
        title: 'Principio Indemnizatorio y Lucro Cesante',
        summary: 'El seguro de daños comprende el daño emergente y, solo mediante acuerdo expreso en la póliza, el lucro cesante.',
      },
      {
        code: 'Art. 1102 Co.Co.',
        title: 'Regla Proporcional por Infraseguro',
        summary: 'Si el valor asegurado es inferior al valor real del bien, el asegurador solo indemniza en la proporción existente entre ambos valores.',
      },
      {
        code: 'Arts. 1127–1133 Co.Co.',
        title: 'Responsabilidad Civil Extracontractual (RCE)',
        summary: 'Ampara perjuicios patrimoniales, extrapatrimoniales y gastos de defensa judicial (Art. 1128) frente a reclamaciones directas de terceros.',
      },
      {
        code: 'Circular 050/2013 SFC',
        title: 'Estándares de Transparencia en Pólizas Comerciales',
        summary: 'Obligación de informar de manera destacada amparos básicos, sublímites, garantías de seguridad y exclusiones.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'pyme_incendio',
        title: 'Amparo Básico de Incendio y Todo Riesgo Daños Materiales',
        legalBasis: 'Arts. 1079 y 1082 Código de Comercio',
        description: 'Verifica la cobertura estructural de Edificio y Contenidos al 100% del valor asegurable para evitar penalización por infraseguro (Art. 1102 Co.Co.).',
        keywords: ['incendio', 'amparo basico', 'todo riesgo', 'edificio', 'contenidos'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'pyme_terremoto',
        title: 'Terremoto, Temblor y Erupción Volcánica',
        legalBasis: 'Reglamentación Técnica de Sismo SFC / NSR-10',
        description: 'Evalúa que el riesgo catastrófico sísmico esté cubierto al 100% y audita si el deducible aplica sobre el valor de la pérdida o sobre el valor asegurado.',
        keywords: ['terremoto', 'temblor', 'sismo', 'erupcion'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'pyme_rce',
        title: 'Responsabilidad Civil Extracontractual (PLO, Patronal y Cruzada)',
        legalBasis: 'Arts. 1127, 1128 y 1133 Código de Comercio',
        description: 'Audita la cobertura frente a demandas de terceros, incluyendo gastos de defensa y subamparos patronal, parqueaderos y contratistas.',
        keywords: ['responsabilidad civil', 'rce', 'predios', 'labores', 'terceros'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'pyme_sustraccion',
        title: 'Sustracción con y sin Violencia / Equipo Electrónico',
        legalBasis: 'Art. 1088 Código de Comercio',
        description: 'Verifica la protección de activos operativos y equipos portátiles/fijos ante hurto calificado y daños internos eléctricos.',
        keywords: ['sustraccion', 'hurto', 'robo', 'equipo electronico'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Todo Riesgo Daños Materiales (ILA)',
      'Terremoto, Temblor y Erupción Volcánica (TTEV)',
      'HMACC y AMIT (Actos Mal Intencionados de Terceros)',
      'RCE Predios, Labores y Operaciones (PLO)',
      'Lucro Cesante (Forma Inglesa vs. Forma Americana)',
      'Equipo Eléctrico y Electrónico + Móviles',
      'Rotura de Maquinaria y Sustracción Calificada',
    ],
    advisoryIntroForClient:
      'Este estudio comparativo evalúa las propuestas del mercado para proteger los activos físicos, la continuidad operativa y el patrimonio de su empresa bajo el marco del Código de Comercio colombiano (Arts. 1079–1133), identificando no solo el costo anual sino el impacto real de los deducibles y coberturas ante una eventual reclamación.',
  },
  hogar: {
    domain: 'hogar',
    displayName: 'Multirriesgo Hogar y Vivienda',
    tagline: 'Protección patrimonial de la vivienda familiar, sus contenidos y responsabilidad civil familiar conforme al EOSF y NSR-10.',
    primaryLaws: [
      {
        code: 'Art. 101 EOSF',
        title: 'Seguro Obligatorio de Incendio y Terremoto Hipotecario',
        summary: 'Exige asegurar los inmuebles por el valor comercial de la parte destructible, garantizando libertad de elección de aseguradora sin cobros por endoso.',
      },
      {
        code: 'Ley 1796 de 2016',
        title: 'Ley de Vivienda Segura y NSR-10',
        summary: 'Establece los estándares sismo-resistentes y de protección patrimonial del comprador de vivienda en Colombia.',
      },
      {
        code: 'Art. 1102 Co.Co.',
        title: 'Prevención de Infraseguro en Edificio y Contenidos',
        summary: 'Garantiza que la suma asegurada de reconstrucción y contenidos refleje el valor real para evitar recortes proporcionales en un siniestro.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'hogar_incendio',
        title: 'Incendio, Rayo y Explosión (Estructura / Contenidos)',
        legalBasis: 'Art. 101 EOSF y Art. 1079 Código de Comercio',
        description: 'Verifica que el inmueble y/o sus contenidos cuenten con amparo básico integral a valor de reconstrucción o reposición.',
        keywords: ['incendio', 'edificio', 'contenidos', 'amparo basico', 'explosion'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'hogar_terremoto',
        title: 'Terremoto, Temblor y Erupción Volcánica',
        legalBasis: 'Art. 101 EOSF y Reglamentación Sismo SFC',
        description: 'Verifica la cobertura sísmica al 100% y compara el deducible porcentual y su mínimo en SMMLV.',
        keywords: ['terremoto', 'temblor', 'sismo'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'hogar_agua',
        title: 'Daños por Agua, Anegación y Rotura de Tuberías',
        legalBasis: 'Estándar Técnico Multirriesgo Hogar SFC',
        description: 'Audita la cobertura ante el siniestro más frecuente en vivienda: daños por agua, filtraciones accidentales y eventos climáticos.',
        keywords: ['agua', 'anegacion', 'inundacion', 'tuberia', 'vientos', 'granizo'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Modalidad: Integral (Edificio + Contenidos) vs. Solo Edificio vs. Solo Contenidos',
      'Incendio y Aliados + Terremoto (100% Valor Asegurable)',
      'Daños por Agua y Eventos de la Naturaleza',
      'Hurto Calificado y Todo Riesgo Fuera del Predio (Bicicletas/Portátiles)',
      'Responsabilidad Civil Familiar y Mascotas',
      'Asistencia Domiciliaria (Plomería, Cerrajería, Electricidad y Vidrios)',
    ],
    advisoryIntroForClient:
      'Este informe comparativo analiza en detalle las alternativas de aseguramiento para su vivienda y patrimonio familiar, verificando la modalidad cotizada (Edificio, Contenidos o Integral), el alcance de las asistencias domiciliarias y cuánto tendría que asumir de su bolsillo (deducible) ante eventos como sismo, daños por agua o robo.',
  },
  autos: {
    domain: 'autos',
    displayName: 'Automóviles y Movilidad',
    tagline: 'Protección integral del vehículo (Guía Fasecolda), Responsabilidad Civil Extracontractual (Art. 1127 Co.Co.) y asistencia en viaje.',
    primaryLaws: [
      {
        code: 'Arts. 1127 y 1133 Co.Co.',
        title: 'Responsabilidad Civil Extracontractual y Acción Directa',
        summary: 'Cubre daños materiales, lesiones o muerte a terceros (incluyendo perjuicios morales y culpa grave del conductor) y defensa jurídica.',
      },
      {
        code: 'Ley 2251 de 2022',
        title: 'Ley Julián Esteban (Art. 16 — Choques Simples)',
        summary: 'Permite resolver choques simples de solo latas mediante pruebas fotográficas/video sin esperar croquis de tránsito.',
      },
      {
        code: 'Guía Fasecolda & Art. 1096 Co.Co.',
        title: 'Valoración Comercial Oficial y Subrogación Legal',
        summary: 'Determina el valor comercial de indemnización en pérdida total según el código Fasecolda del vehículo.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'autos_rce',
        title: 'Responsabilidad Civil Extracontractual (RCE)',
        legalBasis: 'Arts. 1127 y 1128 Código de Comercio',
        description: 'Verifica el límite en millones o SMMLV para responder ante daños a bienes de terceros, lesiones o muerte y asistencia jurídica penal/civil.',
        keywords: ['responsabilidad civil', 'rce', 'terceros', 'danos a bienes'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'autos_pt',
        title: 'Pérdida Total por Daños y por Hurto',
        legalBasis: 'Art. 1079 Co.Co. y Guía de Valores Fasecolda',
        description: 'Audita que el vehículo esté cubierto al 100% del valor Fasecolda idealmente con 0% de deducible en Pérdida Total.',
        keywords: ['perdida total', 'hurto total', 'danos mayor cuantia', 'destruccion total'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'autos_pp',
        title: 'Pérdida Parcial por Daños y por Hurto + Amparo Patrimonial',
        legalBasis: 'Ley 2251 de 2022 y Condicionados Autos SFC',
        description: 'Evalúa el deducible de taller en choques parciales y la inclusión del Amparo Patrimonial (cobertura pese a infracción de tránsito).',
        keywords: ['perdida parcial', 'menor cuantia', 'patrimonial', 'colision'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'RCE Daños a Terceros + Amparo Patrimonial',
      'Pérdida Total Daños y Hurto (Valor Comercial Fasecolda)',
      'Pérdida Parcial Daños y Hurto (Talleres Autorizados)',
      'Vehículo de Reemplazo (Días en PT y PP)',
      'Asistencia en Viaje, Grúa y Conductor Elegido',
      'Asistencia Jurídica en Proceso Penal y Civil',
    ],
    advisoryIntroForClient:
      'Este estudio compara las opciones de seguro para su vehículo bajo los estándares de la Guía Fasecolda y el Código de Comercio (Art. 1127), destacando el respaldo en Responsabilidad Civil frente a terceros, el costo real de reparación en taller (deducible de pérdida parcial) y los beneficios prácticos como vehículo de reemplazo, grúa y conductor elegido.',
  },
  copropiedades: {
    domain: 'copropiedades',
    displayName: 'Copropiedades y Propiedad Horizontal',
    tagline: 'Cumplimiento estricto del Art. 15 de la Ley 675 de 2001 para zonas comunes, estructura sismo-resistente (NSR-10) y RC del Administrador.',
    primaryLaws: [
      {
        code: 'Ley 675 de 2001 (Art. 15)',
        title: 'Seguro Obligatorio de Bienes Comunes',
        summary: 'Obliga a toda copropiedad a constituir póliza contra incendio y terremoto que garantice la reconstrucción total de las áreas comunes.',
      },
      {
        code: 'Ley 400/1997 y NSR-10',
        title: 'Norma Sismo Resistente Colombiana',
        summary: 'Rige la evaluación técnica de vulnerabilidad sísmica y reconstrucción estructural del edificio o conjunto.',
      },
      {
        code: 'Art. 50 Ley 675 / Ley 389 de 1997',
        title: 'Responsabilidad de Administradores y Consejo (D&O)',
        summary: 'Los administradores responden por los perjuicios que por dolo o culpa leve u omisión ocasionen a la persona jurídica o propietarios.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'cop_incendio_terremoto',
        title: 'Incendio y Terremoto sobre Bienes Comunes (Reconstrucción Total)',
        legalBasis: 'Art. 15 Ley 675 de 2001',
        description: 'Verifica el cumplimiento legal obligatorio de asegurar el 100% del valor de reconstrucción de los bienes comunes contra incendio y sismo.',
        keywords: ['incendio', 'terremoto', 'bienes comunes', 'areas comunes', 'edificio'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'cop_rce_do',
        title: 'RCE Copropiedad y RC Directores y Administradores (D&O)',
        legalBasis: 'Art. 50 Ley 675 de 2001 y Art. 1127 Co.Co.',
        description: 'Verifica la protección patrimonial de la copropiedad ante accidentes en zonas comunes/parqueaderos y la póliza D&O para el Administrador y Consejo.',
        keywords: ['responsabilidad civil', 'administrador', 'directores', 'd&o', 'parqueadero'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Incendio y Terremoto Bienes Comunes (Obligatorio Ley 675)',
      'Extensión Voluntaria a Bienes Privados',
      'Rotura de Maquinaria (Ascensores, Motobombas, Planta Eléctrica)',
      'RCE Zonas Comunes, Parqueaderos y Cruzada',
      'RC Directores y Administradores (D&O Consejo y Administración)',
      'Manejo / Infidelidad de Empleados y Cuotas de Administración',
    ],
    advisoryIntroForClient:
      'Este estudio técnico y legal para la Administración y el Consejo de Administración verifica que cada propuesta cumpla rigurosamente con el Artículo 15 de la Ley 675 de 2001 (Propiedad Horizontal), evaluando la suficiencia del valor de reconstrucción de áreas comunes, el impacto del deducible sísmico y la protección para los equipos críticos (ascensores/planta) y órganos de dirección.',
  },
  cumplimiento: {
    domain: 'cumplimiento',
    displayName: 'Cumplimiento, Garantías y Fianzas',
    tagline: 'Respaldo contractual estatal (Ley 80/1993, Ley 1150/2007 y Decreto 1082/2015) y particular con verificación de suficiencias legales.',
    primaryLaws: [
      {
        code: 'Ley 80/1993 y Ley 1150/2007 (Art. 7)',
        title: 'Régimen de Garantías en Contratación Estatal',
        summary: 'Regula la Garantía Única de Cumplimiento, su irrevocabilidad por falta de pago de prima y la declaratoria de siniestro.',
      },
      {
        code: 'Decreto 1082 de 2015',
        title: 'Suficiencias Mínimas y Vigencias Reglamentarias (SECOP)',
        summary: 'Define los porcentajes y vigencias mínimas: Seriedad (10%), Anticipo (100%), Cumplimiento (10%), Salarios (5% + 3 años), Estabilidad (5 años).',
      },
      {
        code: 'Art. 1099 Co.Co.',
        title: 'Inaplicabilidad de Infraseguro y Derecho de Subrogación',
        summary: 'En cumplimiento no aplica la regla proporcional del Art. 1102 Co.Co. y la aseguradora se subroga contra el contratista incumplido.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'cum_ejecucion',
        title: 'Cumplimiento del Contrato y Seriedad / Anticipo',
        legalBasis: 'Decreto 1082 de 2015 Arts. 2.2.1.2.3.1.9 a 2.2.1.2.3.1.12',
        description: 'Verifica que el porcentaje asegurado y la vigencia cubran el plazo de ejecución contractual y hasta la liquidación.',
        keywords: ['cumplimiento', 'seriedad', 'anticipo', 'contrato'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'cum_salarios_estabilidad',
        title: 'Pago de Salarios y Prestaciones (+3 años) y Estabilidad de Obra (+5 años)',
        legalBasis: 'Decreto 1082 de 2015 Arts. 2.2.1.2.3.1.13 y 2.2.1.2.3.1.14 / Art. 488 CST',
        description: 'Audita que el amparo laboral cubra el plazo más 3 años de prescripción laboral y que estabilidad/calidad cumpla los términos post-contractuales.',
        keywords: ['salarios', 'prestaciones', 'laboral', 'estabilidad', 'calidad'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Seriedad de la Oferta (Precontractual)',
      'Buen Manejo y Correcta Inversión del Anticipo (100%)',
      'Cumplimiento General del Contrato',
      'Pago de Salarios, Prestaciones Sociales e Indemnizaciones (+3 años)',
      'Estabilidad y Calidad de la Obra / Calidad del Servicio',
      'RCE Derivada de Cumplimiento (Anexo de Responsabilidad Civil)',
    ],
    advisoryIntroForClient:
      'Este análisis comparativo de garantías de cumplimiento verifica que las pólizas cotizadas se ajusten a las exigencias del contrato y a los topes del Decreto 1082 de 2015 / Ley 80 de 1993 (o clausulado particular), facilitando la aprobación expedita de la garantía ante la entidad contratante con las mejores condiciones de tasa y contragarantía.',
  },
  vida_grupo: {
    domain: 'vida_grupo',
    displayName: 'Vida Grupo, Colectivo y Accidentes Personales',
    tagline: 'Protección del capital humano y bienestar familiar bajo el régimen de Seguros de Personas (Arts. 1137–1162 Código de Comercio).',
    primaryLaws: [
      {
        code: 'Arts. 1137 y 1138 Co.Co.',
        title: 'Ausencia de Límite Pecuniario y No Infraseguro',
        summary: 'En los seguros de personas no existe infraseguro ni coexistencia excluyente: las indemnizaciones son acumulables.',
      },
      {
        code: 'Art. 1158 Co.Co.',
        title: 'Cláusula de Incontestabilidad y Edad Asegurable',
        summary: 'Regula la reducción de sanciones por inexactitud en la declaración de edad y la incontestabilidad tras dos años de vigencia.',
      },
      {
        code: 'Ley 100/1993 y Ley 1562/2012',
        title: 'Calificación de Pérdida de Capacidad Laboral (PCL >= 50%)',
        summary: 'Marco técnico de referencia en Colombia para la activación del amparo de Incapacidad Total y Permanente (ITP).',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'vg_muerte',
        title: 'Amparo Básico de Vida (Muerte por Cualquier Causa)',
        legalBasis: 'Art. 1137 Código de Comercio',
        description: 'Verifica el capital básico asegurado o múltiplo salarial ante fallecimiento natural o accidental.',
        keywords: ['muerte', 'fallecimiento', 'vida', 'amparo basico'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'vg_itp',
        title: 'Incapacidad Total y Permanente (ITP) y Muerte Accidental',
        legalBasis: 'Arts. 1138 Co.Co. y Estándar PCL Ley 100/1993',
        description: 'Verifica el anticipo o pago adicional del capital asegurado por invalidez (PCL >= 50%) y desmembración accidental.',
        keywords: ['incapacidad total', 'itp', 'invalidez', 'accidental', 'desmembracion'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Muerte por Cualquier Causa (Amparo Básico)',
      'Incapacidad Total y Permanente (ITP — PCL >= 50%)',
      'Doble Indemnización por Muerte Accidental y Desmembración (MAyD)',
      'Anticipo o Adicional por Enfermedades Graves',
      'Auxilio Funerario / Gastos de Sepelio y Renta Diaria por Hospitalización',
      'Edades de Ingreso y Permanencia + Requisitos de Asegurabilidad (Free Cover)',
    ],
    advisoryIntroForClient:
      'Este estudio comparativo de Vida Grupo evalúa los beneficios para sus colaboradores y asegurados bajo los artículos 1137 a 1162 del Código de Comercio, comparando capitales asegurados, límites de aceptación automática sin exámenes médicos (Free Cover), edades máximas de permanencia y tasas por millar.',
  },
  salud: {
    domain: 'salud',
    displayName: 'Salud, Pólizas Hospitalarias y Medicina Prepagada',
    tagline: 'Planes Voluntarios de Salud (PVS) regulados por la Ley 1438 de 2011, Resolución 244 de 2019 y la Superintendencia Financiera.',
    primaryLaws: [
      {
        code: 'Ley 1438 de 2011 (Art. 13)',
        title: 'Régimen de Planes Voluntarios de Salud (PVS) y Continuidad',
        summary: 'Regula la complementariedad con el Plan de Beneficios en Salud (PBS) y el reconocimiento de antigüedad/continuidad sin nuevas preexistencias.',
      },
      {
        code: 'Resolución 244 de 2019 MinSalud',
        title: 'Estándares de Cobertura y Red de Prestadores PVS',
        summary: 'Establece los lineamientos de calidad, red de atención hospitalaria/ambulatoria y transparencia en copagos/vales.',
      },
      {
        code: 'Circular 049/2013 SFC',
        title: 'Supervisión de Pólizas de Salud',
        summary: 'Regula las condiciones técnicas, períodos de carencia y reservas de las pólizas colectivas e individuales de salud.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'salud_hosp',
        title: 'Hospitalización, Cirugía y Unidad de Cuidados Intensivos (UCI)',
        legalBasis: 'Ley 1438 de 2011 y Circular 049/2013 SFC',
        description: 'Verifica la cobertura hospitalaria, honorarios médicos/quirúrgicos y estancia en habitación individual y UCI.',
        keywords: ['hospitalizacion', 'cirugia', 'uci', 'cuidados intensivos', 'clinica'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'salud_alto_costo',
        title: 'Oncología, Enfermedades de Alto Costo y Continuidad',
        legalBasis: 'Resolución 244 de 2019 MinSalud',
        description: 'Audita la cobertura de tratamientos ambulatorios de cáncer, diálisis, trasplantes, maternidad y reconocimiento de antigüedad.',
        keywords: ['cancer', 'oncologia', 'alto costo', 'maternidad', 'ambulatorio', 'preexistencia'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Hospitalización, Cirugía y UCI (Sin Límite o por Evento/Año)',
      'Tratamientos Ambulatorios de Alto Costo (Cáncer, Diálisis, Trasplantes)',
      'Consultas Externas, Exámenes Diagnósticos y Terapias',
      'Maternidad, Recién Nacido y Urgencias Nacionales/Internacionales',
      'Copagos / Cuotas Moderadoras / Reembolso Libre Elección',
      'Reconocimiento de Antigüedad y Períodos de Carencia',
    ],
    advisoryIntroForClient:
      'Este análisis comparativo de Planes Voluntarios de Salud evalúa el alcance clínico y financiero de cada propuesta conforme a la Ley 1438 de 2011, detallando el nivel de red hospitalaria, los topes de reembolso, el manejo de continuidad/preexistencias y el costo real de los copagos por uso del servicio.',
  },
  transporte: {
    domain: 'transporte',
    displayName: 'Transporte de Mercancías y Logística',
    tagline: 'Protección de carga en tránsito nacional e internacional bajo el Código de Comercio (Arts. 1117–1126), Decreto 1079/2015 e Incoterms 2020.',
    primaryLaws: [
      {
        code: 'Arts. 1117–1126 Co.Co.',
        title: 'Contrato de Seguro de Transporte',
        summary: 'Regula el seguro de mercancías por trayecto o póliza automática, el valor asegurable (costo + flete + lucro esperado) y el certificado de transporte.',
      },
      {
        code: 'Decreto 1079 de 2015',
        title: 'Decreto Único Reglamentario del Sector Transporte',
        summary: 'Establece las obligaciones de remesa terrestre de carga, manifiesto RNDC y condiciones de seguridad vial y trazabilidad satelital.',
      },
      {
        code: 'Incoterms 2020 ICC',
        title: 'Términos Internacionales de Comercio (CIF / CIP / FOB)',
        summary: 'Determina el punto exacto de transferencia del riesgo en importaciones y exportaciones marítimas, aéreas y multimodales.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'trans_basico',
        title: 'Pérdida Total y Falta de Entrega / Daños a la Carga',
        legalBasis: 'Arts. 1117 a 1122 Código de Comercio',
        description: 'Verifica el límite máximo por despacho/vehículo y la cobertura de accidentes del vehículo transportador, incendio y hurto.',
        keywords: ['perdida total', 'falta de entrega', 'averias', 'carga', 'despacho', 'hurto'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'trans_garantias',
        title: 'Garantías de Seguridad Vial (Acompañamiento, GPS, Horarios)',
        legalBasis: 'Art. 1061 Co.Co. (Garantías en Pólizas de Transporte)',
        description: 'Audita las garantías operativas exigidas (escolta, candado satelital, prohibición de tránsito nocturno) cuyo incumplimiento anularía el pago.',
        keywords: ['garantia', 'escolta', 'satelital', 'gps', 'horario', 'cargue', 'descargue'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Cobertura Completa (Todo Riesgo Carga) vs. Cobertura Básica',
      'Falta de Entrega, Hurto Calificado y Saqueo / Pillaje',
      'Avería Particular, Mojadura, Oxidación y Rotura',
      'Operaciones de Cargue y Descargue + Permanencia en Bodegas Intermedias',
      'Límite Máximo por Despacho / Vehículo y Presupuesto Anual de Movilización',
      'Garantías de Seguridad (GPS, Escolta Vehicular, Estudio de Seguridad de Conductores)',
    ],
    advisoryIntroForClient:
      'Este estudio comparativo de Transporte de Mercancías analiza las condiciones de cobertura por despacho, tasas sobre movilización anual y, muy especialmente, las garantías operativas de transporte (Art. 1061 y 1117 del Código de Comercio) para asegurar que su operación logística quede protegida de puerta a puerta sin trabas operativas.',
  },
  equipo_maquinaria: {
    domain: 'equipo_maquinaria',
    displayName: 'Maquinaria y Equipo Contratista (TREC)',
    tagline: 'Protección técnica de maquinaria amarilla, agrícola e industrial bajo los Arts. 1083–1112 del Código de Comercio y normas de seguridad.',
    primaryLaws: [
      {
        code: 'Arts. 1083–1112 Co.Co.',
        title: 'Seguros de Daños Patrimoniales y Valor de Reposición',
        summary: 'Regula el aseguramiento a valor de reposición a nuevo (sin descuento por depreciación salvo pacto) y el deber de salvamento.',
      },
      {
        code: 'Art. 1102 Co.Co.',
        title: 'Regla Proporcional en Maquinaria Amarilla e Industrial',
        summary: 'Exige asegurar cada máquina por su valor de reposición a nuevo (incluyendo fletes, montaje y aranceles) para evitar infraseguro.',
      },
      {
        code: 'Resolución 2400 de 1979',
        title: 'Estatuto de Seguridad Industrial y Operación de Maquinaria',
        summary: 'Estándares de operación certificada y mantenimiento preventivo exigidos en las garantías de la póliza.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'eqm_dano_fisico',
        title: 'Todo Riesgo Daño Físico Accidental y Eventos de la Naturaleza',
        legalBasis: 'Arts. 1083 y 1088 Código de Comercio',
        description: 'Verifica la cobertura de vuelco, colisión, derrumbe, incendio, sismo y hurto tanto en obra como durante movilización en cama baja.',
        keywords: ['dano fisico', 'maquinaria', 'equipo', 'vuelco', 'hurto', 'transporte'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'eqm_rotura_rce',
        title: 'Avería Interna / Rotura Mecánica y RCE de Operación',
        legalBasis: 'Art. 1127 Co.Co.',
        description: 'Audita si incluye daños internos mecánicos/eléctricos y Responsabilidad Civil Extracontractual por daños causados con la máquina a terceros.',
        keywords: ['rotura', 'averia', 'electrica', 'mecanica', 'responsabilidad civil', 'rce'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Todo Riesgo Equipo y Maquinaria Contratista (Daños Externos y Vuelco)',
      'Rotura de Maquinaria / Daño Interno Mecánico y Eléctrico',
      'Hurto Calificado y AMIT / Terrorismo',
      'Movilización y Transporte Terrestre (Cama Baja / Autopropulsado)',
      'Responsabilidad Civil Extracontractual de Maquinaria',
      'Gastos de Salvamento, Flete Aéreo y Horas Extras',
    ],
    advisoryIntroForClient:
      'Este informe comparativo para su flota de Maquinaria y Equipo evalúa la cobertura en frentes de obra, predios y traslados conforme al Código de Comercio, verificando que los equipos estén asegurados a valor de reposición a nuevo y comparando los deducibles por evento y las coberturas de avería interna y daños a terceros.',
  },
  casco_embarcacion: {
    domain: 'casco_embarcacion',
    displayName: 'Casco Marítimo, Fluvial y Embarcaciones',
    tagline: 'Aseguramiento naval bajo el Libro V del Código de Comercio (Arts. 1703–1772), reglamentación DIMAR e Institute Time Clauses (ITCH).',
    primaryLaws: [
      {
        code: 'Arts. 1703–1772 Co.Co.',
        title: 'Seguro Marítimo y de Navegación (Libro V)',
        summary: 'Regula el seguro de casco y maquinaria, el valor convenido, la avería gruesa, los gastos de salvamento y el abandono de la nave.',
      },
      {
        code: 'Reglamentación DIMAR',
        title: 'Dirección General Marítima — Matrícula y Navegabilidad',
        summary: 'Exige certificados vigentes de navegabilidad, dotación y zona de navegación autorizada como garantía esencial de la póliza.',
      },
      {
        code: 'Cláusulas ITCH 1.10.83',
        title: 'Institute Time Clauses - Hulls (Estándar Internacional)',
        summary: 'Marco técnico internacional que define peligros del mar, colisión (3/4 o 4/4 RDC), avería particular y cláusula Inchmaree.',
      },
    ],
    mandatoryVerificationRules: [
      {
        id: 'cas_casco',
        title: 'Pérdida Total y Parcial de Casco, Maquinaria y Aparejos',
        legalBasis: 'Arts. 1703 y ss. Código de Comercio / ITCH',
        description: 'Verifica la cobertura del casco, motores y equipos de navegación frente a peligros del mar, incendio, varadura y hundimiento.',
        keywords: ['casco', 'maquinaria', 'perdida total', 'embarcacion', 'motores', 'averias'],
        severityIfMissing: 'CRITICAL',
      },
      {
        id: 'cas_pi_salvamento',
        title: 'Protección e Indemnización (P&I / RCE Marítima) y Avería Gruesa',
        legalBasis: 'Arts. 1517 y 1740 Código de Comercio / DIMAR',
        description: 'Audita la cobertura de Responsabilidad Civil Marítima (abordaje, daños a muelles, lesiones a pasajeros/tripulación, remoción de restos) y salvamento.',
        keywords: ['p&i', 'proteccion e indemnizacion', 'responsabilidad civil', 'averia gruesa', 'salvamento'],
        severityIfMissing: 'WARNING',
      },
    ],
    thesaurusHighlights: [
      'Casco y Maquinaria (Pérdida Total Real o Constructiva y Avería Particular)',
      'Avería Gruesa y Gastos de Salvamento Marítimo',
      'Protección e Indemnización (P&I) / RC Abordaje y Daños a Muelles',
      'Responsabilidad Civil frente a Pasajeros y Tripulación',
      'Remoción de Escombros / Restos Náufragos (Exigencia DIMAR)',
      'Guerra, Huelga, Piratería y Transporte Terrestre en Tráiler',
    ],
    advisoryIntroForClient:
      'Este estudio comparativo de Casco y Maquinaria evalúa las propuestas bajo el Libro V del Código de Comercio (Arts. 1703–1772), las normas de la DIMAR y las cláusulas internacionales ITCH, detallando la protección del casco y motores, la cobertura de Protección e Indemnización (P&I) frente a terceros y los deducibles por siniestro.',
  },
};

export const PEDAGOGICAL_TOOLTIPS_CATALOG: PedagogicalExplanation[] = [
  // --- DEDUCIBLES Y REGLAS ---
  {
    id: 'ded_smmlv',
    title: 'Deducible en SMMLV (Salarios Mínimos Mensuales Legales Vigentes)',
    category: 'deductible',
    keywords: ['smmlv', 'smlmv', 'salario minimo', 'salarios minimos'],
    whatItCovers:
      'Es el monto mínimo de participación económica que asume el asegurado en cada pérdida indemnizable, expresado en múltiplos del salario mínimo mensual vigente en Colombia ($1.423.500 COP base referencia).',
    claimImpact:
      'Si el daño reclamado es inferior a los SMMLV pactados, la póliza no se activa; si lo supera, la aseguradora descuenta ese monto fijo de la indemnización final.',
    comparisonTip:
      'Como el SMMLV sube cada año por decreto presidencial, un deducible en SMMLV aumenta automáticamente en pesos cada 1 de enero. Menor número de SMMLV = menor desembolso de tu bolsillo.',
    legalReference: 'Art. 1103 Código de Comercio (Deducibles y Franquicias)',
  },
  {
    id: 'ded_uvt',
    title: 'Deducible en UVT (Unidad de Valor Tributario)',
    category: 'deductible',
    keywords: ['uvt', 'unidad de valor tributario'],
    whatItCovers:
      'Es la franquicia o participación del asegurado calculada en Unidades de Valor Tributario fijadas anualmente por la DIAN (indexadas únicamente con la inflación IPC).',
    claimImpact:
      'Al liquidar la pérdida, se multiplica el número de UVT pactado por el valor oficial de la UVT del año del siniestro y se descuenta del pago.',
    comparisonTip:
      'Suele ser más predecible a mediano plazo que el deducible en SMMLV, ya que la UVT solo crece con el IPC y no incluye aumentos reales del salario mínimo.',
    legalReference: 'Estatuto Tributario Art. 868 y Art. 1103 Co.Co.',
  },
  {
    id: 'ded_valor_asegurado_vs_perdida',
    title: 'Deducible: "% del Valor de la Pérdida" vs. "% del Valor Asegurado"',
    category: 'deductible',
    keywords: ['valor asegurado', 'valor asegurable', 'v.a.', 'suma asegurada', 'valor del articulo'],
    whatItCovers:
      'El "% del valor de la pérdida" calcula tu participación únicamente sobre el monto del daño sufrido, mientras que el "% del valor asegurado" (común en Terremoto) lo calcula sobre el valor total declarado del inmueble o bien.',
    claimImpact:
      'En un inmueble de $1.000M con un daño de $50M: un deducible del 10% de la pérdida te cuesta $5M (recibes $45M); pero un 2% del valor asegurado te cuesta $20M (solo recibes $30M, y si el daño es menor a $20M no recibes pago).',
    comparisonTip:
      'Prioriza siempre deducibles sobre el VALOR DE LA PÉRDIDA. En Terremoto, verifica que si aplica sobre el valor asegurado sea únicamente sobre el edificio o artículo afectado y no sobre toda la póliza.',
    legalReference: 'Art. 1103 Código de Comercio y Guía Técnica de Sismo SFC',
  },
  {
    id: 'ded_combinado',
    title: 'Deducible Combinado (% de la Pérdida con Mínimo en SMMLV o Pesos)',
    category: 'deductible',
    keywords: ['minimo', 'mínimo', 'min', '%', 'porcentaje'],
    whatItCovers:
      'Es una fórmula dual (ej. "10% del valor de la pérdida, mínimo 2 SMMLV") donde la aseguradora aplica siempre el MAYOR de los dos valores resultantes al liquidar el siniestro.',
    claimImpact:
      'En siniestros pequeños o medianos opera el tope mínimo en SMMLV/pesos, y en siniestros grandes entra a operar el porcentaje sobre la pérdida.',
    comparisonTip:
      'Evalúa ambos componentes: una oferta con menor porcentaje (ej. 5%) pero un mínimo muy alto (ej. 10 SMMLV) dejará sin cobertura práctica todas las pérdidas menores o cotidianas.',
    legalReference: 'Art. 1103 Código de Comercio',
  },
  {
    id: 'ded_sin_deducible',
    title: 'Sin Deducible (0% / Amparo al 100%)',
    category: 'deductible',
    keywords: ['sin deducible', 'no aplica', '0%', '100% indemnizacion', 'cero deducible'],
    whatItCovers:
      'Significa que el asegurado no tiene que asumir ningún copago ni franquicia económica cuando ocurre un siniestro amparado bajo esta cobertura.',
    claimImpact:
      'La aseguradora indemniza el 100% de la pérdida demostrada hasta el límite asegurado, sin descontar pesos ni salarios mínimos.',
    comparisonTip:
      'Es la condición más favorable del mercado, especialmente valiosa en Pérdida Total de Autos, Asistencias, Vida Grupo y ciertos amparos básicos.',
    legalReference: 'Art. 1079 y 1088 Código de Comercio',
  },
  // --- COBERTURAS TRANSVERSALES Y POR RAMO ---
  {
    id: 'cov_incendio_basico',
    title: 'Amparo Básico: Incendio, Rayo, Explosión y Todo Riesgo Daños Materiales',
    category: 'coverage',
    keywords: ['incendio', 'rayo', 'explosion', 'amparo basico', 'todo riesgo dano', 'edificio', 'contenidos'],
    whatItCovers:
      'Protege la estructura física del inmueble (Edificio) y sus bienes internos (Contenidos, maquinaria, mercancías) frente a daños materiales súbitos e imprevistos por fuego, rayo, explosión o causas accidentales no excluidas.',
    claimImpact:
      'Financia la reconstrucción, reparación o reposición a nuevo de las instalaciones y activos afectados tras un siniestro estructural.',
    comparisonTip:
      'Verifica que el valor asegurado corresponda al 100% del valor real de reconstrucción/reposición para evitar la penalización por infraseguro (Art. 1102 Co.Co.) y prefiere pólizas "Todo Riesgo" sobre "Riesgos Nombrados".',
    legalReference: 'Arts. 1079, 1082, 1088 y 1102 del Código de Comercio',
  },
  {
    id: 'cov_terremoto',
    title: 'Terremoto, Temblor, Erupción Volcánica y Eventos Sísmicos',
    category: 'coverage',
    keywords: ['terremoto', 'temblor', 'erupcion', 'sismo', 'maremoto', 'ttev'],
    whatItCovers:
      'Ampara los daños materiales directos a la edificación y sus contenidos originados por movimientos sísmicos o actividad volcánica, incluyendo remoción de escombros.',
    claimImpact:
      'Respalda el activo más valioso frente al riesgo catastrófico número uno en Colombia (obligatorio en créditos hipotecarios según Art. 101 EOSF y en copropiedades según Ley 675/2001).',
    comparisonTip:
      'Compara con lupa que cubra el 100% del valor asegurado y revisa si el deducible se calcula sobre el valor de la pérdida o sobre el valor asegurable del inmueble.',
    legalReference: 'Art. 101 EOSF · Ley 675 de 2001 Art. 15 · Norma NSR-10',
  },
  {
    id: 'cov_agua_naturaleza_amit',
    title: 'Daños por Agua, Anegación, Eventos de la Naturaleza (HMACC) y AMIT',
    category: 'coverage',
    keywords: ['anegacion', 'agua', 'inundacion', 'vientos', 'granizo', 'hmacc', 'amit', 'terrorismo', 'asonada', 'huelga', 'tuberia'],
    whatItCovers:
      'Cubre daños por fenómenos climáticos (inundación, avalancha, vientos fuertes, granizo), rotura accidental de tuberías y Actos Mal Intencionados de Terceros (AMIT, asonada, huelga, vandalismo y terrorismo).',
    claimImpact:
      'Responde ante los siniestros de mayor frecuencia en Colombia (temporada invernal y alteraciones de orden público) que pueden inundar o afectar locales, bodegas y viviendas.',
    comparisonTip:
      'Confirma que tanto Daños por Agua como AMIT/Terrorismo estén amparados al 100% del valor asegurado y no limitados a sublímites pequeños.',
    legalReference: 'Art. 1072 y 1088 del Código de Comercio · Condicionados FASECOLDA',
  },
  {
    id: 'cov_sustraccion',
    title: 'Sustracción con Violencia y Sustracción sin Violencia (Hurto)',
    category: 'coverage',
    keywords: ['sustraccion', 'hurto', 'robo', 'violencia'],
    whatItCovers:
      'La sustracción con violencia cubre el robo cuando median señales visibles de fuerza o intimidación con armas; la sustracción sin violencia (hurto simple) cubre la pérdida de equipos o bienes sin huellas de fuerza.',
    claimImpact:
      'Sin el anexo de "sustracción sin violencia", el hurto hábil de un computador portátil o equipo dentro de las instalaciones sin forzar cerraduras no tendrá cobertura.',
    comparisonTip:
      'Revisa los sublímites para contenidos fijos vs. equipos móviles y verifica qué garantías de seguridad exige la póliza (alarma monitoreada, cámaras o vigilancia).',
    legalReference: 'Art. 1061 (Garantías) y Art. 1088 del Código de Comercio',
  },
  {
    id: 'cov_equipo_electronico',
    title: 'Equipo Eléctrico, Electrónico y Equipos Móviles / Portátiles',
    category: 'coverage',
    keywords: ['equipo electronico', 'electronico', 'electrico', 'portatiles', 'moviles', 'computadores', 'eee'],
    whatItCovers:
      'Ampara computadores, servidores, equipos médicos, paneles y dispositivos móviles contra daños internos por cortocircuito, sobretensión eléctrica, caída accidental o hurto.',
    claimImpact:
      'El amparo básico de incendio excluye daños eléctricos internos; esta cobertura es la que paga cuando una variación de voltaje quema tarjetas electrónicas o se daña un portátil.',
    comparisonTip:
      'Verifica el sublímite para equipos móviles fuera del predio asegurado y la antigüedad máxima admitida para indemnizar a valor de reposición a nuevo.',
    legalReference: 'Art. 1088 del Código de Comercio (Seguros de Daños Reales)',
  },
  {
    id: 'cov_rotura_maquinaria',
    title: 'Rotura de Maquinaria y Avería Mecánica',
    category: 'coverage',
    keywords: ['rotura de maquinaria', 'maquinaria', 'ascensores', 'planta electrica', 'caldera', 'transformador', 'bienes refrigerados'],
    whatItCovers:
      'Protege maquinaria industrial, plantas eléctricas, ascensores, bombas y equipos de frío contra averías internas súbitas de origen mecánico o eléctrico e impericia operativa.',
    claimImpact:
      'Permite reparar o reemplazar motores, compresores y piezas críticas dañadas internamente para no detener la operación ni afectar bienes refrigerados.',
    comparisonTip:
      'Compara el sublímite otorgado, el deducible mínimo y si incluye el deterioro de mercancías/bienes refrigerados por falla del equipo de frío.',
    legalReference: 'Arts. 1083 a 1112 del Código de Comercio',
  },
  {
    id: 'cov_lucro_cesante',
    title: 'Lucro Cesante / Pérdida de Ingresos o Arrendamientos',
    category: 'coverage',
    keywords: ['lucro cesante', 'perdida de utilidad', 'gastos adicionales', 'canon', 'arrendamiento', 'interrupcion'],
    whatItCovers:
      'Indemniza la utilidad bruta que deja de percibir el negocio y los gastos fijos permanentes (nómina, arriendo, servicios) durante la paralización causada por un daño material amparado.',
    claimImpact:
      'Por ley (Art. 1088 Co.Co.), el lucro cesante solo se paga si fue pactado expresamente: es el salvavidas de flujo de caja mientras se reconstruye o repara el negocio.',
    comparisonTip:
      'Compara el período máximo de indemnización (ej. 6 o 12 meses), el deducible en días de espera y si opera bajo Forma Inglesa (hasta recuperar ventas) o Forma Americana (hasta reabrir).',
    legalReference: 'Art. 1088 del Código de Comercio (Acuerdo Expreso de Lucro Cesante)',
  },
  {
    id: 'cov_rce',
    title: 'Responsabilidad Civil Extracontractual (RCE - Art. 1127 Co.Co.)',
    category: 'coverage',
    keywords: ['responsabilidad civil', 'rce', 'rc ', 'terceros', 'patronal', 'parqueaderos', 'cruzada', 'plo', 'directores', 'd&o'],
    whatItCovers:
      'Protege el patrimonio del asegurado frente a las sumas que deba pagar por daños materiales, lesiones o muerte causados a terceros, incluyendo los gastos de defensa judicial.',
    claimImpact:
      'Ante una demanda civil o reclamación directa de un afectado (Art. 1133 Co.Co.), la aseguradora asume los honorarios de abogados (Art. 1128) y la indemnización patrimonial y moral.',
    comparisonTip:
      'Verifica que el límite sea suficiente y que incluya subamparos esenciales: RC Patronal (en exceso de ARL), RC Cruzada, Contratistas, Parqueaderos y Perjuicios Extrapatrimoniales.',
    legalReference: 'Arts. 1127, 1128 y 1133 del Código de Comercio · Ley 389 de 1997 Art. 4',
  },
  {
    id: 'cov_autos_perdida',
    title: 'Pérdida Total y Pérdida Parcial por Daños o Hurto (Vehículos)',
    category: 'coverage',
    keywords: ['perdida total', 'perdida parcial', 'colision', 'hurto parcial', 'hurto total', 'patrimonial', 'fasecolda'],
    whatItCovers:
      'La Pérdida Parcial cubre la reparación en taller cuando el daño es menor al 75% del valor comercial; la Pérdida Total indemniza el valor comercial Fasecolda cuando el daño supera el 75% o el vehículo es hurtado.',
    claimImpact:
      'Define cuánto dinero recibes para reponer tu vehículo en caso de robo/siniestro grave o cuánto debes pagar en el taller para retirar tu carro reparado.',
    comparisonTip:
      'Prefiere propuestas con 0% de deducible en Pérdida Total, talleres autorizados de marca y que incluyan Amparo Patrimonial y Vehículo de Reemplazo.',
    legalReference: 'Art. 1079 y 1096 Co.Co. · Ley 2251 de 2022 · Guía Fasecolda',
  },
  {
    id: 'cov_cumplimiento',
    title: 'Amparos de Cumplimiento, Anticipo, Salarios y Estabilidad de Obra',
    category: 'coverage',
    keywords: ['seriedad', 'cumplimiento', 'anticipo', 'salarios', 'prestaciones', 'estabilidad', 'calidad'],
    whatItCovers:
      'Garantiza ante la entidad contratante (pública o privada) el cumplimiento de las obligaciones del contrato, el buen manejo del anticipo, el pago de obligaciones laborales y la calidad post-entrega.',
    claimImpact:
      'Permite legalizar el contrato y desembolsar pagos; en contratación estatal no aplica infraseguro y la póliza es irrevocable por falta de pago de prima.',
    comparisonTip:
      'Verifica que los porcentajes asegurados y las vigencias coincidan exactamente con la minuta del contrato y con los mínimos del Decreto 1082 de 2015 (ej. Salarios +3 años).',
    legalReference: 'Ley 80 de 1993 · Ley 1150 de 2007 Art. 7 · Decreto 1082 de 2015',
  },
  {
    id: 'cov_asistencias',
    title: 'Servicios de Asistencia (Domiciliaria, Empresarial o en Viaje / Grúa)',
    category: 'coverage',
    keywords: ['asistencia', 'grua', 'conductor elegido', 'reemplazo', 'plomeria', 'cerrajeria', 'vidrios', 'carro taller'],
    whatItCovers:
      'Provee atención operativa inmediata 24/7 ante emergencias cotidianas (plomería, electricidad, cerrajería, vidrios, vigilancia de emergencia, grúa, carro taller o conductor elegido).',
    claimImpact:
      'Son los beneficios de mayor uso real durante el año, resuelven urgencias sin pagar deducible y sin afectar la siniestralidad de la póliza principal.',
    comparisonTip:
      'Compara el número de eventos anuales permitidos, el tope en SMMLV o kilómetros por servicio de grúa y los días de vehículo sustituto.',
    legalReference: 'Condicionados Particulares de Asistencia · Ley 1328 de 2009',
  },
];

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getDomainRegulatoryProfile(domain?: string | null): DomainRegulatoryProfile {
  const key = normalizeText(domain || 'pyme').replace(/\s+/g, '_');
  return DOMAIN_REGULATORY_PROFILES[key] || DOMAIN_REGULATORY_PROFILES.pyme!;
}

export function findPedagogicalExplanation(
  label: string,
  valueOrDeductible?: string | null,
  preferredCategory?: 'coverage' | 'deductible'
): PedagogicalExplanation {
  const normLabel = normalizeText(label);
  const normVal = normalizeText(valueOrDeductible || '');
  const combined = `${normLabel} ${normVal}`.trim();

  // If specifically looking for a deductible explanation based on the deductible value format
  if (preferredCategory === 'deductible' && normVal) {
    if (
      normVal.includes('sin deducible') ||
      normVal === 'no aplica' ||
      normVal === '0%' ||
      normVal.includes('100% indemnizacion')
    ) {
      return PEDAGOGICAL_TOOLTIPS_CATALOG.find((item) => item.id === 'ded_sin_deducible')!;
    }
    if (
      normVal.includes('valor asegurado') ||
      normVal.includes('valor asegurable') ||
      normVal.includes('v.a.')
    ) {
      return PEDAGOGICAL_TOOLTIPS_CATALOG.find(
        (item) => item.id === 'ded_valor_asegurado_vs_perdida'
      )!;
    }
    if (normVal.includes('uvt')) {
      return PEDAGOGICAL_TOOLTIPS_CATALOG.find((item) => item.id === 'ded_uvt')!;
    }
    if (normVal.includes('%') && (normVal.includes('smmlv') || normVal.includes('min'))) {
      return PEDAGOGICAL_TOOLTIPS_CATALOG.find((item) => item.id === 'ded_combinado')!;
    }
    if (normVal.includes('smmlv') || normVal.includes('smlmv')) {
      return PEDAGOGICAL_TOOLTIPS_CATALOG.find((item) => item.id === 'ded_smmlv')!;
    }
  }

  // Match by label keywords
  let bestMatch: PedagogicalExplanation | undefined;
  let bestScore = 0;

  for (const entry of PEDAGOGICAL_TOOLTIPS_CATALOG) {
    if (preferredCategory && entry.category !== preferredCategory && entry.category !== 'coverage') {
      continue;
    }
    let score = 0;
    for (const kw of entry.keywords) {
      const normKw = normalizeText(kw);
      if (normLabel.includes(normKw)) {
        score += normKw.length + 5;
      } else if (combined.includes(normKw)) {
        score += normKw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // Default consultative fallback
  if (preferredCategory === 'deductible') {
    return {
      id: 'ded_generic',
      title: `Deducible aplicable a: ${label}`,
      category: 'deductible',
      keywords: [],
      whatItCovers:
        'Representa la participación económica (franquicia o copago) que asume el asegurado de su propio bolsillo en caso de ocurrir un siniestro amparado bajo este concepto.',
      claimImpact:
        'La aseguradora descuenta este valor del monto total de la pérdida aprobada; un deducible menor implica una mayor transferencia real del riesgo a la aseguradora.',
      comparisonTip:
        'Verifica tanto el porcentaje como el tope mínimo en SMMLV ($1.423.500 COP c/u) o UVT, y confirma que aplique sobre el valor de la pérdida y no sobre el valor asegurado.',
      legalReference: 'Art. 1103 del Código de Comercio Colombiano',
    };
  }

  return {
    id: 'cov_generic',
    title: label,
    category: 'coverage',
    keywords: [],
    whatItCovers: `Amparo o condición de la póliza que establece el límite asegurado o alcance de protección para "${label}" dentro del programa de seguros.`,
    claimImpact:
      'Determina el tope máximo de responsabilidad de la aseguradora (Art. 1079 Co.Co.) ante la ocurrencia de un evento cubierto.',
    comparisonTip:
      'Compara que el límite otorgado sea suficiente para cubrir la exposición real del activo o patrimonio sin caer en infraseguro (Art. 1102 Co.Co.) ni sublímites restrictivos.',
    legalReference: 'Arts. 1079, 1088 y 1102 del Código de Comercio Colombiano',
  };
}
