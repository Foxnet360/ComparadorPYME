import fs from 'fs';
import path from 'path';

// Define the ontology configurations for all 9 non-PYME domains
const DOMAIN_DEFINITIONS = {
  autos: {
    l1: [
      { id: 'rc-vehicular', name: 'Responsabilidad Civil Extracontractual Vehicular', aliases: ['Responsabilidad Civil', 'RCE Vehicular', 'RC Autos'], riskType: 'liability' },
      { id: 'danos-vehiculo', name: 'Daños al Vehículo y Pérdidas', aliases: ['Daños al Vehículo', 'Daño Material Vehicular', 'Casco Autos'], riskType: 'property' },
      { id: 'asistencias-vehiculares', name: 'Asistencias y Servicios al Vehículo', aliases: ['Asistencias y Servicios', 'Asistencia Vehicular', 'Auxilio Mecánico'], riskType: 'assistance' },
      { id: 'coberturas-personas', name: 'Coberturas de Personas y Conductores', aliases: ['Coberturas de Personas', 'Accidentes Personales Conductor', 'Ocupantes'], riskType: 'personal_accident' },
      { id: 'coberturas-especiales', name: 'Coberturas Especiales y Deducibles', aliases: ['COBERTURAS ESPECIALES', 'Amparos Adicionales', 'Condiciones Particulares'], riskType: 'special' },
    ],
    categoryMapping: {
      '1': { id: 'rce-vehicular', parentId: 'rc-vehicular', riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      '2': { id: 'perdida-total', parentId: 'danos-vehiculo', riskType: 'property', typicalDeductible: '10% deducible comercial' },
      '3': { id: 'perdida-parcial', parentId: 'danos-vehiculo', riskType: 'property', typicalDeductible: '10% min 1 SMMLV' },
      '4': { id: 'carro-taller', parentId: 'asistencias-vehiculares', riskType: 'assistance', typicalDeductible: '0%' },
      '5': { id: 'asistencia-viaje', parentId: 'asistencias-vehiculares', riskType: 'assistance', typicalDeductible: '0%' },
      '6': { id: 'gastos-transporte', parentId: 'asistencias-vehiculares', riskType: 'assistance', typicalDeductible: '0%' },
      '7': { id: 'hurto-partes', parentId: 'danos-vehiculo', riskType: 'property', typicalDeductible: '10% min 1 SMMLV' },
      '8': { id: 'eventos-naturaleza', parentId: 'danos-vehiculo', riskType: 'catastrophe', typicalDeductible: '10% min 1 SMMLV' },
      '9': { id: 'conductor-adicional', parentId: 'coberturas-personas', riskType: 'personal_accident', typicalDeductible: '0%' },
      '10': { id: 'menores-25', parentId: 'coberturas-personas', riskType: 'personal_accident', typicalDeductible: '0%' },
      '11': { id: 'deducibles-autos', parentId: 'coberturas-especiales', riskType: 'condition', typicalDeductible: 'Regulado según póliza' },
      'auto_12': { id: 'soat-adicional', parentId: 'coberturas-personas', riskType: 'regulatory', typicalDeductible: '0%' },
      'auto_13': { id: 'perdida-total-definicion', parentId: 'danos-vehiculo', riskType: 'property', typicalDeductible: '10% deducible pactado' },
      'auto_14': { id: 'accesorios-blindaje', parentId: 'coberturas-especiales', riskType: 'special', typicalDeductible: '10% min 2 SMMLV' },
    },
    sublimits: [
      { id: 'rce-danos-terceros', name: 'Daños a Bienes de Terceros', parentId: 'rce-vehicular', aliases: ['Daños a bienes de terceros', 'Bienes de terceros', 'Daño a propiedad ajena'], riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      { id: 'rce-muerte-lesiones-1p', name: 'Muerte o Lesiones a una Persona', parentId: 'rce-vehicular', aliases: ['Lesiones o muerte 1 persona', 'Muerte una persona', 'Lesiones corporales 1p'], riskType: 'liability', typicalDeductible: '0%' },
      { id: 'rce-muerte-lesiones-2p', name: 'Muerte o Lesiones a dos o más Personas', parentId: 'rce-vehicular', aliases: ['Lesiones o muerte dos o más personas', 'Muerte múltiples personas', 'Límite global personas'], riskType: 'liability', typicalDeductible: '0%' },
      { id: 'rce-amparo-patrimonial', name: 'Amparo Patrimonial / Asistencia Penal y Civil', parentId: 'rce-vehicular', aliases: ['Amparo patrimonial', 'Defensa jurídica penal', 'Asistencia legal penal'], riskType: 'liability', typicalDeductible: '0%' },
      { id: 'asistencia-grua', name: 'Servicio de Grúa y Remolque', parentId: 'asistencia-viaje', aliases: ['Grúa', 'Remolque por varada o siniestro', 'Traslado de vehículo'], riskType: 'assistance', typicalDeductible: '0%' },
      { id: 'conductor-elegido', name: 'Conductor Elegido / Ángel Guardián', parentId: 'asistencia-viaje', aliases: ['Conductor elegido', 'Ángel guardián', 'Servicio de conductor'], riskType: 'assistance', typicalDeductible: '0%' },
      { id: 'blindaje-rotura', name: 'Blindaje y Cristales Especiales', parentId: 'accesorios-blindaje', aliases: ['Blindaje automotriz', 'Vidrios blindados', 'Reposición de blindaje'], riskType: 'special', typicalDeductible: '10% min 2 SMMLV' },
    ],
    compositePatterns: [
      { pattern: 'todo\\s+riesgo|plan\\s+integral|auto\\s+todo\\s+riesgo', components: ['rce-vehicular', 'perdida-total', 'perdida-parcial', 'asistencia-viaje'], confidence: 0.90 },
      { pattern: 'p[eé]rdida\\s+total.*(da[ñn]o|hurto)|ptd|fnac', components: ['perdida-total', 'perdida-total-definicion'], confidence: 0.85 },
      { pattern: 'p[eé]rdida\\s+parcial.*(da[ñn]o|hurto)', components: ['perdida-parcial', 'hurto-partes'], confidence: 0.85 },
    ]
  },

  copropiedades: {
    l1: [
      { id: 'bienes-comunes-danos', name: 'Daños Materiales sobre Bienes Comunes (Ley 675)', aliases: ['COBERTURAS OBLIGATORIAS LEY 675', 'DAÑOS MATERIALES', 'Daños a Edificios y Áreas Comunes'], riskType: 'property' },
      { id: 'catastroficos-fenomenos', name: 'Terremoto y Fenómenos de la Naturaleza', aliases: ['FENÓMENOS NATURALES', 'Eventos de la Naturaleza', 'Catastróficos PH'], riskType: 'catastrophe' },
      { id: 'responsabilidad-civil-ph', name: 'Responsabilidad Civil y Profesional de Copropiedades', aliases: ['RESPONSABILIDAD CIVIL', 'RESPONSABILIDAD PROFESIONAL', 'RC Zonas Comunes'], riskType: 'liability' },
      { id: 'maquinaria-equipos-comunes', name: 'Equipos, Maquinaria y Seguridad de Áreas Comunes', aliases: ['Maquinaria Común', 'Equipos Eléctricos Zonas Comunes', 'Seguridad PH'], riskType: 'equipment' },
      { id: 'gastos-consecuenciales-asistencia', name: 'Gastos Consecuenciales y Asistencias Copropiedad', aliases: ['GASTOS COMPLEMENTARIOS', 'PÉRDIDAS CONSECUENCIALES', 'SERVICIOS Y ASISTENCIAS'], riskType: 'assistance' },
    ],
    categoryMapping: {
      'cop_01': { id: 'incendio-bienes-comunes', parentId: 'bienes-comunes-danos', riskType: 'property', typicalDeductible: '10% min 2 SMMLV' },
      'cop_02': { id: 'terremoto-bienes-comunes', parentId: 'catastroficos-fenomenos', riskType: 'catastrophe', typicalDeductible: '10% min 5 SMMLV' },
      'cop_03': { id: 'rce-areas-comunes', parentId: 'responsabilidad-civil-ph', riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      'cop_04': { id: 'rce-directores-administradores', parentId: 'responsabilidad-civil-ph', riskType: 'liability', typicalDeductible: '10% min 2 SMMLV' },
      'cop_05': { id: 'rc-patronal-copropiedades', parentId: 'responsabilidad-civil-ph', riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      'cop_06': { id: 'equipo-maquinaria-comunes', parentId: 'maquinaria-equipos-comunes', riskType: 'equipment', typicalDeductible: '10% min 1.5 SMMLV' },
      'cop_07': { id: 'sustraccion-bienes-comunes', parentId: 'maquinaria-equipos-comunes', riskType: 'theft', typicalDeductible: '10% min 1 SMMLV' },
      'cop_08': { id: 'rotura-vidrios-fachadas', parentId: 'bienes-comunes-danos', riskType: 'property', typicalDeductible: '10% min 0.5 SMMLV' },
      'cop_09': { id: 'todo-riesgo-copropiedades', parentId: 'bienes-comunes-danos', riskType: 'property', typicalDeductible: '10% min 2 SMMLV' },
      'cop_10': { id: 'danos-agua-copropiedades', parentId: 'bienes-comunes-danos', riskType: 'property', typicalDeductible: '10% min 1.5 SMMLV' },
      'cop_11': { id: 'manejo-infidelidad-copropiedades', parentId: 'responsabilidad-civil-ph', riskType: 'fidelity', typicalDeductible: '10% min 2 SMMLV' },
      'cop_12': { id: 'amit-terrorismo-copropiedades', parentId: 'catastroficos-fenomenos', riskType: 'special', typicalDeductible: '10% min 3 SMMLV' },
      'cop_13': { id: 'granizo-vientos-copropiedades', parentId: 'catastroficos-fenomenos', riskType: 'catastrophe', typicalDeductible: '10% min 1 SMMLV' },
      'cop_14': { id: 'remocion-escombros-copropiedades', parentId: 'gastos-consecuenciales-asistencia', riskType: 'assistance', typicalDeductible: '0%' },
      'cop_15': { id: 'perdida-expensas-administracion', parentId: 'gastos-consecuenciales-asistencia', riskType: 'consequential', typicalDeductible: '3 días deducible' },
      'cop_16': { id: 'asistencia-areas-comunes', parentId: 'gastos-consecuenciales-asistencia', riskType: 'assistance', typicalDeductible: '0%' },
    },
    sublimits: [
      { id: 'rc-parqueaderos-copropiedad', name: 'RC Parqueaderos y Vigilancia en Copropiedad', parentId: 'rce-areas-comunes', aliases: ['RC parqueaderos', 'Vehículos en parqueadero común', 'Vigilancia y portería'], riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      { id: 'rc-zonas-humedas-piscinas', name: 'RC Piscinas, Zonas Húmedas y Ascensores', parentId: 'rce-areas-comunes', aliases: ['RC piscinas', 'RC zonas húmedas', 'RC ascensores'], riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      { id: 'gastos-preservacion-ph', name: 'Gastos de Preservación y Mitigación del Siniestro', parentId: 'remocion-escombros-copropiedades', aliases: ['Preservación de bienes comunes', 'Mitigación de daños'], riskType: 'assistance', typicalDeductible: '0%' },
    ],
    compositePatterns: [
      { pattern: 'todo\\s+riesgo.*copropiedad|todo\\s+riesgo.*da[ñn]o\\s+material|zonas\\s+comunes\\s+ley\\s+675', components: ['incendio-bienes-comunes', 'terremoto-bienes-comunes', 'rce-areas-comunes', 'todo-riesgo-copropiedades'], confidence: 0.90 },
      { pattern: 'terremoto.*temblor|erupci[oó]n.*volc[aá]nica', components: ['terremoto-bienes-comunes'], confidence: 0.85 },
    ]
  },

  cumplimiento: {
    l1: [
      { id: 'garantias-precontractuales', name: 'Garantías Precontractuales', aliases: ['GARANTÍAS PRECONTRACTUALES', 'Precontractual', 'Licitaciones'], riskType: 'surety' },
      { id: 'garantias-ejecucion', name: 'Garantías de Ejecución de Contrato', aliases: ['GARANTÍAS DE EJECUCIÓN', 'Ejecución Contractual', 'Amparos de Cumplimiento'], riskType: 'surety' },
      { id: 'garantias-postcontractuales', name: 'Garantías Post-Contractuales y Calidad', aliases: ['GARANTÍAS POST-CONTRACTUALES', 'Postcontractual', 'Estabilidad y Calidad'], riskType: 'surety' },
      { id: 'responsabilidad-contractual', name: 'Garantías de Responsabilidad y Daños a Terceros', aliases: ['GARANTÍAS DE RESPONSABILIDAD', 'RC en Contratos', 'Daños en Ejecución'], riskType: 'liability' },
      { id: 'garantias-manejo-normativa', name: 'Garantías de Manejo, Fidelidad y Cumplimiento Normativo Estatal', aliases: ['GARANTÍAS DE MANEJO', 'COBERTURAS DE OBRA', 'CUMPLIMIENTO NORMATIVO ESTATAL', 'CONDICIONES GENERALES'], riskType: 'surety' },
    ],
    categoryMapping: {
      'cum_01': { id: 'seriedad-oferta', parentId: 'garantias-precontractuales', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_02': { id: 'cumplimiento-contrato', parentId: 'garantias-ejecucion', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_03': { id: 'estabilidad-calidad-obra', parentId: 'garantias-postcontractuales', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_04': { id: 'correcta-inversion-anticipo', parentId: 'garantias-ejecucion', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_05': { id: 'salarios-prestaciones-laborales', parentId: 'garantias-ejecucion', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_06': { id: 'pago-danos-terceros', parentId: 'responsabilidad-contractual', riskType: 'liability', typicalDeductible: '10% min 2 SMMLV' },
      'cum_07': { id: 'calidad-bien-servicio', parentId: 'garantias-postcontractuales', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_08': { id: 'buen-manejo-bienes', parentId: 'garantias-manejo-normativa', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_09': { id: 'rce-durante-ejecucion', parentId: 'responsabilidad-contractual', riskType: 'liability', typicalDeductible: '10% min 2 SMMLV' },
      'cum_10': { id: 'trc-trm-obra', parentId: 'garantias-manejo-normativa', riskType: 'special', typicalDeductible: '10% min 3 SMMLV' },
      'cum_11': { id: 'manejo-empleados-fidelidad', parentId: 'garantias-manejo-normativa', riskType: 'fidelity', typicalDeductible: '10% min 1 SMMLV' },
      'cum_12': { id: 'manejo-individual-forgery', parentId: 'garantias-manejo-normativa', riskType: 'fidelity', typicalDeductible: '10% min 1 SMMLV' },
      'cum_13': { id: 'vigencia-condiciones-amparo', parentId: 'garantias-manejo-normativa', riskType: 'condition', typicalDeductible: 'Según pliegos' },
      'cum_14': { id: 'garantia-unica-estatal', parentId: 'garantias-manejo-normativa', riskType: 'surety', typicalDeductible: '0% sin deducible' },
      'cum_15': { id: 'garantia-mantenimiento', parentId: 'garantias-postcontractuales', riskType: 'surety', typicalDeductible: '0% sin deducible' },
    },
    sublimits: [
      { id: 'multas-sanciones-contractuales', name: 'Multas y Cláusula Penal en Contrato', parentId: 'cumplimiento-contrato', aliases: ['Multas', 'Cláusula penal pecuniaria', 'Sanciones contractuales'], riskType: 'surety', typicalDeductible: '0%' },
      { id: 'anticipo-devolucion-saldos', name: 'Devolución de Saldos no Amortizados de Anticipo', parentId: 'correcta-inversion-anticipo', aliases: ['Saldos no amortizados', 'Reintegro de anticipo'], riskType: 'surety', typicalDeductible: '0%' },
    ],
    compositePatterns: [
      { pattern: 'garant[ií]a\\s+[uú]nica|cumplimiento\\s+estatal|ley\\s+80|decreto\\s+1082', components: ['cumplimiento-contrato', 'correcta-inversion-anticipo', 'salarios-prestaciones-laborales', 'estabilidad-calidad-obra', 'garantia-unica-estatal'], confidence: 0.90 },
      { pattern: 'calidad\\s+y\\s+estabilidad|estabilidad\\s+de\\s+la?\\s*obra', components: ['estabilidad-calidad-obra', 'calidad-bien-servicio'], confidence: 0.85 },
    ]
  },

  transporte: {
    l1: [
      { id: 'danos-perdidas-carga', name: 'Daño Físico y Pérdidas de la Carga', aliases: ['COBERTURAS PRINCIPALES', 'Daño Material Mercancía', 'Pérdida en Tránsito'], riskType: 'cargo' },
      { id: 'maritimas-multimodal', name: 'Coberturas Marítimas y Multimodales', aliases: ['COBERTURAS MARÍTIMAS', 'MODALIDADES DE TRANSPORTE', 'Marítimo y Aéreo'], riskType: 'marine' },
      { id: 'responsabilidad-transporte', name: 'Responsabilidad Civil del Transportador', aliases: ['COBERTURAS DE RESPONSABILIDAD', 'RC Transportador', 'Daños a Cargas Terceros'], riskType: 'liability' },
      { id: 'cargas-especiales', name: 'Cargas Especiales, Perecederas y Peligrosas', aliases: ['COBERTURAS ESPECIALES', 'Refrigerados', 'Graneles y Mercancías Peligrosas'], riskType: 'special' },
      { id: 'condiciones-gastos-transporte', name: 'Valor Asegurado, Gastos Consecuenciales y Condiciones', aliases: ['VALOR ASEGURADO', 'COBERTURAS COMPLEMENTARIAS', 'COBERTURAS CONSECUENCIALES', 'CONDICIONES DE LA COBERTURA', 'CONDICIONES GENERALES', 'CUMPLIMIENTO NORMATIVO'], riskType: 'condition' },
    ],
    categoryMapping: {
      'tra_01': { id: 'dano-material-carga', parentId: 'danos-perdidas-carga', riskType: 'cargo', typicalDeductible: '10% del despacho' },
      'tra_02': { id: 'perdida-total-carga', parentId: 'danos-perdidas-carga', riskType: 'cargo', typicalDeductible: '10% del despacho' },
      'tra_03': { id: 'averia-particular-gruesa', parentId: 'maritimas-multimodal', riskType: 'marine', typicalDeductible: '10% min 1 SMMLV' },
      'tra_04': { id: 'rc-transportador', parentId: 'responsabilidad-transporte', riskType: 'liability', typicalDeductible: '10% min 2 SMMLV' },
      'tra_05': { id: 'robo-hurto-carga', parentId: 'danos-perdidas-carga', riskType: 'theft', typicalDeductible: '15% min 2 SMMLV' },
      'tra_06': { id: 'refrigeracion-cadena-frio', parentId: 'cargas-especiales', riskType: 'special', typicalDeductible: '10% min 2 SMMLV' },
      'tra_07': { id: 'carga-granel-peligrosa', parentId: 'cargas-especiales', riskType: 'special', typicalDeductible: '10% min 2 SMMLV' },
      'tra_08': { id: 'transporte-multimodal', parentId: 'maritimas-multimodal', riskType: 'marine', typicalDeductible: '10% del despacho' },
      'tra_09': { id: 'cobertura-fletes-impuestos', parentId: 'condiciones-gastos-transporte', riskType: 'cargo', typicalDeductible: '0%' },
      'tra_10': { id: 'dano-perdida-contenedor', parentId: 'condiciones-gastos-transporte', riskType: 'property', typicalDeductible: '10% min 1 SMMLV' },
      'tra_11': { id: 'demora-lucro-cesante', parentId: 'condiciones-gastos-transporte', riskType: 'consequential', typicalDeductible: '5 días deducible' },
      'tra_12': { id: 'deducibles-franquicias-transporte', parentId: 'condiciones-gastos-transporte', riskType: 'condition', typicalDeductible: 'Según tipo de carga' },
      'tra_13': { id: 'vigencia-tipo-poliza-transporte', parentId: 'condiciones-gastos-transporte', riskType: 'condition', typicalDeductible: 'Póliza abierta / viaje' },
      'tra_14': { id: 'marco-normativo-transporte', parentId: 'condiciones-gastos-transporte', riskType: 'regulatory', typicalDeductible: 'Dec 1079 / Incoterms' },
      'tra_15': { id: 'robo-parcial-pillaje-carga', parentId: 'danos-perdidas-carga', riskType: 'theft', typicalDeductible: '15% min 2 SMMLV' },
      'tra_16': { id: 'clausula-abandono-maritima', parentId: 'maritimas-multimodal', riskType: 'marine', typicalDeductible: '10% del embarque' },
    },
    sublimits: [
      { id: 'mojadura-humedad-carga', name: 'Mojadura y Daños por Agua Dulce o Salada', parentId: 'dano-material-carga', aliases: ['Mojadura', 'Agua de mar', 'Humedad en bodega'], riskType: 'cargo', typicalDeductible: '10% del despacho' },
      { id: 'pirateria-terrestre-asalto', name: 'Piratería Terrestre y Asalto en Carretera', parentId: 'robo-hurto-carga', aliases: ['Piratería terrestre', 'Atraco en carretera', 'Retén ilegal'], riskType: 'theft', typicalDeductible: '15% min 2 SMMLV' },
    ],
    compositePatterns: [
      { pattern: 'todo\\s+riesgo.*(transporte|carga)|institute\\s+cargo\\s+clauses\\s*\(?[aA]\)?', components: ['dano-material-carga', 'perdida-total-carga', 'robo-hurto-carga', 'averia-particular-gruesa'], confidence: 0.90 },
      { pattern: 'p[eé]rdida\\s+total.*(hurto|extrav[ií]o|carga)', components: ['perdida-total-carga', 'clausula-abandono-maritima'], confidence: 0.85 },
    ]
  },

  hogar: {
    l1: [
      { id: 'danos-basicos-vivienda', name: 'Coberturas Básicas y Estructurales de Vivienda', aliases: ['COBERTURAS BÁSICAS DE LA VIVIENDA', 'DAÑOS MATERIALES', 'EQUIPOS Y ENSERES', 'Estructura y Contenidos'], riskType: 'property' },
      { id: 'catastroficos-naturaleza-hogar', name: 'Fenómenos Naturales y Eventos Catastróficos Hogar', aliases: ['EVENTOS DE LA NATURALEZA', 'EVENTOS DE LA NATURALEZA Y AGUA', 'COBERTURAS ESPECIALES', 'Sismo y Clima'], riskType: 'catastrophe' },
      { id: 'hurto-sustraccion-hogar', name: 'Hurto y Sustracción de Bienes del Hogar', aliases: ['HURTO Y SUSTRACCIÓN', 'Robo en Vivienda', 'Bienes Personales'], riskType: 'theft' },
      { id: 'responsabilidad-civil-familiar', name: 'Responsabilidad Civil Extracontractual y Familiar', aliases: ['RESPONSABILIDAD CIVIL', 'RC Hogar', 'RC Familiar y Patronal'], riskType: 'liability' },
      { id: 'asistencias-gastos-hogar', name: 'Asistencia Domiciliaria y Gastos por Siniestro', aliases: ['ASISTENCIAS Y SERVICIOS', 'GASTOS ADICIONALES POR SINIESTRO', 'MARCO REGULATORIO Y COORDINACIÓN', 'CONDICIONADO ECONÓMICO'], riskType: 'assistance' },
    ],
    categoryMapping: {
      '1': { id: 'incendio-hogar', parentId: 'danos-basicos-vivienda', riskType: 'property', typicalDeductible: '10% min 1 SMMLV' },
      '2': { id: 'terremoto-hogar', parentId: 'catastroficos-naturaleza-hogar', riskType: 'catastrophe', typicalDeductible: '10% min 3 SMMLV' },
      '3': { id: 'danos-agua-hogar', parentId: 'catastroficos-naturaleza-hogar', riskType: 'property', typicalDeductible: '10% min 1 SMMLV' },
      '4': { id: 'granizo-vientos-hogar', parentId: 'catastroficos-naturaleza-hogar', riskType: 'catastrophe', typicalDeductible: '10% min 1 SMMLV' },
      '5': { id: 'sustraccion-dentro-predio', parentId: 'hurto-sustraccion-hogar', riskType: 'theft', typicalDeductible: '10% min 1 SMMLV' },
      '6': { id: 'sustraccion-fuera-predio', parentId: 'hurto-sustraccion-hogar', riskType: 'theft', typicalDeductible: '10% min 1 SMMLV' },
      '7': { id: 'dano-electrico-hogar', parentId: 'danos-basicos-vivienda', riskType: 'equipment', typicalDeductible: '10% min 1 SMMLV' },
      '8': { id: 'rce-hogar-familiar', parentId: 'responsabilidad-civil-familiar', riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      '9': { id: 'rc-patronal-empleados-domesticos', parentId: 'responsabilidad-civil-familiar', riskType: 'liability', typicalDeductible: '10% min 1 SMMLV' },
      '10': { id: 'asistencia-domiciliaria-247', parentId: 'asistencias-gastos-hogar', riskType: 'assistance', typicalDeductible: '0%' },
      '11': { id: 'inhabitabilidad-arrendamiento-temporal', parentId: 'asistencias-gastos-hogar', riskType: 'consequential', typicalDeductible: '0%' },
      '12': { id: 'hmce-amit-hogar', parentId: 'catastroficos-naturaleza-hogar', riskType: 'special', typicalDeductible: '10% min 2 SMMLV' },
      '13': { id: 'remocion-escombros-hogar', parentId: 'asistencias-gastos-hogar', riskType: 'assistance', typicalDeductible: '0%' },
      '14': { id: 'rotura-cristales-hogar', parentId: 'danos-basicos-vivienda', riskType: 'property', typicalDeductible: '10% min 0.5 SMMLV' },
      '15': { id: 'objetos-valor-joyas-arte', parentId: 'hurto-sustraccion-hogar', riskType: 'theft', typicalDeductible: '10% min 2 SMMLV' },
      '16': { id: 'marco-normativo-hogar-ph', parentId: 'asistencias-gastos-hogar', riskType: 'regulatory', typicalDeductible: 'Ley 675 / Ley 1796' },
      '17': { id: 'deducibles-hogar-reglamentarios', parentId: 'asistencias-gastos-hogar', riskType: 'condition', typicalDeductible: 'Norma SFC' },
    },
    sublimits: [
      { id: 'plomeria-emergencia-hogar', name: 'Plomería de Emergencia', parentId: 'asistencia-domiciliaria-247', aliases: ['Plomería urgente', 'Fontanería', 'Desatasco de tuberías'], riskType: 'assistance', typicalDeductible: '0%' },
      { id: 'electricidad-emergencia-hogar', name: 'Electricidad de Emergencia', parentId: 'asistencia-domiciliaria-247', aliases: ['Electricista urgente', 'Falla de energía hogar'], riskType: 'assistance', typicalDeductible: '0%' },
      { id: 'cerrajeria-emergencia-hogar', name: 'Cerrajería de Emergencia', parentId: 'asistencia-domiciliaria-247', aliases: ['Cerrajería urgente', 'Apertura de cerradura'], riskType: 'assistance', typicalDeductible: '0%' },
    ],
    compositePatterns: [
      { pattern: 'todo\\s+riesgo\\s+hogar|multirriesgo\\s+hogar|integral\\s+vivienda', components: ['incendio-hogar', 'terremoto-hogar', 'sustraccion-dentro-predio', 'rce-hogar-familiar', 'asistencia-domiciliaria-247'], confidence: 0.90 },
      { pattern: 'terremoto.*temblor|erupci[oó]n.*volc[aá]nica', components: ['terremoto-hogar'], confidence: 0.85 },
    ]
  },

  salud: {
    l1: [
      { id: 'coberturas-hospitalarias-cirugia', name: 'Coberturas Hospitalarias y Quirúrgicas', aliases: ['COBERTURAS HOSPITALARIAS', 'COBERTURAS DE URGENCIAS', 'Cirugía y Hospitalización'], riskType: 'hospitalization' },
      { id: 'coberturas-ambulatorias-medicas', name: 'Coberturas Ambulatorias y Medicamentos', aliases: ['ESTRUCTURA DEL PLAN', 'COBERTURAS AMBULATORIAS', 'COBERTURAS PREVENTIVAS', 'Consultas y Exámenes'], riskType: 'ambulatory' },
      { id: 'enfermedades-alto-costo-especiales', name: 'Enfermedades de Alto Costo y Especialidades', aliases: ['ENFERMEDADES DE ALTO COSTO', 'COBERTURAS ESPECIALES', 'Cáncer y Maternidad'], riskType: 'catastrophic_illness' },
      { id: 'coberturas-complementarias-viaje', name: 'Coberturas Complementarias y Asistencia Internacional', aliases: ['COBERTURAS COMPLEMENTARIAS', 'COBERTURAS DE VIAJE', 'Odontología y Óptica'], riskType: 'supplemental' },
      { id: 'red-asistencial-condiciones', name: 'Red de Prestadores y Condiciones Operativas', aliases: ['CONDICIONES DE ASEGURABILIDAD', 'RED ASISTENCIAL', 'ESTRUCTURA DE COSTOS COMPARTIDOS', 'CUMPLIMIENTO NORMATIVO'], riskType: 'condition' },
    ],
    categoryMapping: {
      'salud_01': { id: 'plan-beneficios-base', parentId: 'coberturas-ambulatorias-medicas', riskType: 'ambulatory', typicalDeductible: 'Copago fijo o cuota' },
      'salud_02': { id: 'hospitalizacion-cirugia', parentId: 'coberturas-hospitalarias-cirugia', riskType: 'hospitalization', typicalDeductible: '100% cubierto o copago' },
      'salud_03': { id: 'consulta-especialistas-telemedicina', parentId: 'coberturas-ambulatorias-medicas', riskType: 'ambulatory', typicalDeductible: 'Bono / cuota moderadora' },
      'salud_04': { id: 'medicamentos-ambulatorios-hospitalarios', parentId: 'coberturas-ambulatorias-medicas', riskType: 'ambulatory', typicalDeductible: 'Copago según vademécum' },
      'salud_05': { id: 'urgencias-salud', parentId: 'coberturas-hospitalarias-cirugia', riskType: 'hospitalization', typicalDeductible: 'Bono de urgencias' },
      'salud_06': { id: 'oncologia-alto-costo', parentId: 'enfermedades-alto-costo-especiales', riskType: 'catastrophic_illness', typicalDeductible: '0% cubierto al 100%' },
      'salud_07': { id: 'maternidad-neonatologia', parentId: 'enfermedades-alto-costo-especiales', riskType: 'catastrophic_illness', typicalDeductible: 'Carencia 300 días' },
      'salud_08': { id: 'cobertura-internacional-viaje', parentId: 'coberturas-complementarias-viaje', riskType: 'supplemental', typicalDeductible: 'US$ 50 - 100 deducible' },
      'salud_09': { id: 'salud-mental-psiquiatria', parentId: 'enfermedades-alto-costo-especiales', riskType: 'ambulatory', typicalDeductible: 'Límite sesiones/año' },
      'salud_10': { id: 'odontologia-salud', parentId: 'coberturas-complementarias-viaje', riskType: 'supplemental', typicalDeductible: 'Copago según red' },
      'salud_11': { id: 'optometria-oftalmologia', parentId: 'coberturas-complementarias-viaje', riskType: 'supplemental', typicalDeductible: 'Bono anual o copago' },
      'salud_12': { id: 'enfermedades-preexistentes', parentId: 'red-asistencial-condiciones', riskType: 'condition', typicalDeductible: 'Exclusión o extraprima' },
      'salud_13': { id: 'red-prestadores-ips', parentId: 'red-asistencial-condiciones', riskType: 'condition', typicalDeductible: 'Red abierta / cerrada' },
      'salud_14': { id: 'copagos-deducibles-cuotas', parentId: 'red-asistencial-condiciones', riskType: 'condition', typicalDeductible: 'Estructura tarifaria' },
      'salud_15': { id: 'portabilidad-carencias', parentId: 'red-asistencial-condiciones', riskType: 'regulatory', typicalDeductible: 'Ley 1438 / Res 244' },
      'salud_16': { id: 'hospitalizacion-domiciliaria', parentId: 'coberturas-hospitalarias-cirugia', riskType: 'hospitalization', typicalDeductible: '100% cubierto' },
      'salud_17': { id: 'medicina-preventiva-bienestar', parentId: 'coberturas-ambulatorias-medicas', riskType: 'ambulatory', typicalDeductible: '0% cubierto al 100%' },
    },
    sublimits: [
      { id: 'cuidados-intensivos-uci', name: 'Unidad de Cuidados Intensivos (UCI)', parentId: 'hospitalizacion-cirugia', aliases: ['UCI', 'Cuidados intensivos', 'UCE'], riskType: 'hospitalization', typicalDeductible: '0%' },
      { id: 'honorarios-quirurgicos', name: 'Honorarios Quirúrgicos y de Anestesia', parentId: 'hospitalizacion-cirugia', aliases: ['Honorarios cirujano', 'Cirugía', 'Anestesiología'], riskType: 'hospitalization', typicalDeductible: 'Copago plan' },
    ],
    compositePatterns: [
      { pattern: 'medicina\\s+prepagada\\s+total|plan\\s+integral\\s+salud|cobertura\\s+m[eé]dica\\s+completa', components: ['hospitalizacion-cirugia', 'consulta-especialistas-telemedicina', 'medicamentos-ambulatorios-hospitalarios', 'oncologia-alto-costo', 'urgencias-salud'], confidence: 0.90 },
    ]
  },

  vida_grupo: {
    l1: [
      { id: 'coberturas-principales-vida', name: 'Coberturas Principales de Vida e Invalidez', aliases: ['Coberturas Principales', 'Amparo Básico Vida', 'Muerte e Incapacidad'], riskType: 'life' },
      { id: 'accidentes-e-incapacidad', name: 'Accidentes Personales e Incapacidades', aliases: ['Accidentes e Incapacidad', 'COBERTURAS DE INCAPACIDAD', 'Muerte Accidental'], riskType: 'accident' },
      { id: 'salud-enfermedades-vida', name: 'Enfermedades Graves y Rentas Hospitalarias', aliases: ['Salud y Enfermedades', 'Enfermedades de Alto Costo Vida'], riskType: 'health' },
      { id: 'auxilios-beneficios-familiares', name: 'Auxilios Económicos y de Apoyo Familiar', aliases: ['Auxilios y Beneficios', 'Beneficios al Empleado / Familia'], riskType: 'assistance' },
      { id: 'condiciones-amparos-adicionales', name: 'Condiciones Especiales y Amparos Complementarios', aliases: ['Condiciones Especiales', 'COBERTURAS COMPLEMENTARIAS', 'Suicidio y Desempleo'], riskType: 'condition' },
    ],
    categoryMapping: {
      '1': { id: 'amparo-basico-muerte', parentId: 'coberturas-principales-vida', riskType: 'life', typicalDeductible: '0% sin deducible' },
      '2': { id: 'incapacidad-total-permanente', parentId: 'coberturas-principales-vida', riskType: 'life', typicalDeductible: '0% sin deducible' },
      '3': { id: 'muerte-accidental-desmembracion', parentId: 'accidentes-e-incapacidad', riskType: 'accident', typicalDeductible: '0% sin deducible' },
      '4': { id: 'enfermedades-graves-vida', parentId: 'salud-enfermedades-vida', riskType: 'health', typicalDeductible: 'Carencia 90 días' },
      '5': { id: 'auxilio-funerario-sepelio', parentId: 'auxilios-beneficios-familiares', riskType: 'assistance', typicalDeductible: '0% sin deducible' },
      '6': { id: 'renta-diaria-hospitalizacion', parentId: 'salud-enfermedades-vida', riskType: 'health', typicalDeductible: 'Deducible 24-48 horas' },
      '7': { id: 'exoneracion-pago-primas', parentId: 'accidentes-e-incapacidad', riskType: 'accident', typicalDeductible: '0% sin deducible' },
      '8': { id: 'condiciones-ingreso-permanencia', parentId: 'condiciones-amparos-adicionales', riskType: 'condition', typicalDeductible: 'Edad máxima pactada' },
      '9': { id: 'cobertura-suicidio', parentId: 'condiciones-amparos-adicionales', riskType: 'condition', typicalDeductible: 'Carencia 1 año o día 1' },
      '10': { id: 'auxilio-educativo-hijos', parentId: 'auxilios-beneficios-familiares', riskType: 'assistance', typicalDeductible: '0% sin deducible' },
      '11': { id: 'auxilio-canasta-familiar', parentId: 'auxilios-beneficios-familiares', riskType: 'assistance', typicalDeductible: '0% sin deducible' },
      '12': { id: 'anticipo-enfermedad-terminal', parentId: 'salud-enfermedades-vida', riskType: 'health', typicalDeductible: '50% del amparo básico' },
      '13': { id: 'doble-indemnizacion-transito', parentId: 'accidentes-e-incapacidad', riskType: 'accident', typicalDeductible: '0% sin deducible' },
      '14': { id: 'auxilio-hijos-enfermedades-congenitas', parentId: 'auxilios-beneficios-familiares', riskType: 'assistance', typicalDeductible: '0% sin deducible' },
      'vg_15': { id: 'incapacidad-parcial-permanente', parentId: 'accidentes-e-incapacidad', riskType: 'accident', typicalDeductible: 'Tabla indemnizaciones' },
      'vg_16': { id: 'renta-desempleo-involuntario', parentId: 'condiciones-amparos-adicionales', riskType: 'condition', typicalDeductible: 'Carencia 60 días' },
    },
    sublimits: [
      { id: 'desmembracion-accidental', name: 'Pérdida de Miembros o Desmembración Accidental', parentId: 'muerte-accidental-desmembracion', aliases: ['Desmembración', 'Pérdida anatómica'], riskType: 'accident', typicalDeductible: '0%' },
    ],
    compositePatterns: [
      { pattern: 'vida\\s+grupo\\s+integral|vida\\s+colectivo|vida\\s+deudores', components: ['amparo-basico-muerte', 'incapacidad-total-permanente', 'muerte-accidental-desmembracion', 'enfermedades-graves-vida'], confidence: 0.90 },
      { pattern: 'muerte\\s+accidental.*desmembraci[oó]n|mayd', components: ['muerte-accidental-desmembracion', 'doble-indemnizacion-transito'], confidence: 0.85 },
    ]
  },

  casco_embarcacion: {
    l1: [
      { id: 'danos-casco-maquinaria', name: 'Daños Materiales a Casco y Maquinaria', aliases: ['COBERTURAS PRINCIPALES', 'Casco y Maquinaria', 'Daño Físico Naval'], riskType: 'marine_hull' },
      { id: 'salvamento-averia-maritima', name: 'Avería Gruesa, Salvamento y Remolque', aliases: ['Salvamento Marítimo', 'Avería Gruesa', 'Asistencia Náutica'], riskType: 'marine_salvage' },
      { id: 'responsabilidad-civil-maritima', name: 'Responsabilidad Civil Náutica y P&I', aliases: ['COBERTURAS MARÍTIMAS AVANZADAS', 'Collision Liability', 'Protección e Indemnización'], riskType: 'marine_liability' },
      { id: 'riesgos-guerra-maritimos', name: 'Riesgos de Guerra, Piratería y Huelgas Navales', aliases: ['Guerra y Piratería', 'War and Strikes Marítimo'], riskType: 'war_marine' },
      { id: 'coberturas-maquinaria-auxiliar', name: 'Maquinaria Auxiliar y Asistencias Náuticas', aliases: ['COBERTURAS COMPLEMENTARIAS', 'Motores y Asistencia'], riskType: 'equipment' },
    ],
    categoryMapping: {
      'cas_01': { id: 'perdida-total-parcial-casco', parentId: 'danos-casco-maquinaria', riskType: 'marine_hull', typicalDeductible: '10% del valor del buque' },
      'cas_02': { id: 'averia-gruesa-salvamento', parentId: 'salvamento-averia-maritima', riskType: 'marine_salvage', typicalDeductible: '10% min 2 SMMLV' },
      'cas_03': { id: 'rc-por-abordaje-collision', parentId: 'responsabilidad-civil-maritima', riskType: 'marine_liability', typicalDeductible: '10% min 3 SMMLV' },
      'cas_04': { id: 'proteccion-indemnizacion-pi', parentId: 'responsabilidad-civil-maritima', riskType: 'marine_liability', typicalDeductible: 'US$ 1,000 - 5,000' },
      'cas_05': { id: 'riesgos-guerra-pirateria-maritima', parentId: 'riesgos-guerra-maritimos', riskType: 'war_marine', typicalDeductible: '10% deducible guerra' },
      'cas_06': { id: 'remolque-asistencia-nautica', parentId: 'salvamento-averia-maritima', riskType: 'marine_salvage', typicalDeductible: '0%' },
      'cas_07': { id: 'cobertura-motores-fuera-borda', parentId: 'coberturas-maquinaria-auxiliar', riskType: 'equipment', typicalDeductible: '10% min 1 SMMLV' },
    },
    sublimits: [],
    compositePatterns: [
      { pattern: 'institute\\s+time\\s+clauses.*hulls|todo\\s+riesgo\\s+casco|p[oó]liza\\s+mar[ií]tima\\s+casco', components: ['perdida-total-parcial-casco', 'averia-gruesa-salvamento', 'rc-por-abordaje-collision'], confidence: 0.90 },
    ]
  },

  equipo_maquinaria: {
    l1: [
      { id: 'danos-materiales-maquinaria', name: 'Daños Físicos, Rotura y Hurto de Maquinaria', aliases: ['COBERTURAS PRINCIPALES', 'Daño Físico Maquinaria', 'Rotura Mecánica'], riskType: 'equipment_damage' },
      { id: 'responsabilidad-operacion-maquinaria', name: 'Responsabilidad Civil por Operación de Maquinaria', aliases: ['RC Maquinaria', 'RC Extracontractual Operación'], riskType: 'liability' },
      { id: 'gastos-consecuenciales-movilizacion', name: 'Gastos Extraordinarios, Tránsito y Pérdidas Consecuenciales', aliases: ['COBERTURAS COMPLEMENTARIAS', 'Gastos y Tránsito'], riskType: 'consequential' },
    ],
    categoryMapping: {
      'eqm_01': { id: 'dano-fisico-accidental-maquinaria', parentId: 'danos-materiales-maquinaria', riskType: 'equipment_damage', typicalDeductible: '10% min 2 SMMLV' },
      'eqm_02': { id: 'rotura-mecanica-implosion', parentId: 'danos-materiales-maquinaria', riskType: 'equipment_damage', typicalDeductible: '10% min 2 SMMLV' },
      'eqm_03': { id: 'sustraccion-robo-maquinaria', parentId: 'danos-materiales-maquinaria', riskType: 'theft', typicalDeductible: '15% min 3 SMMLV' },
      'eqm_04': { id: 'rc-operacion-maquinaria', parentId: 'responsabilidad-operacion-maquinaria', riskType: 'liability', typicalDeductible: '10% min 2 SMMLV' },
      'eqm_05': { id: 'gastos-extraordinarios-fletes', parentId: 'gastos-consecuenciales-movilizacion', riskType: 'consequential', typicalDeductible: '0%' },
      'eqm_06': { id: 'perdida-beneficios-paralizacion', parentId: 'gastos-consecuenciales-movilizacion', riskType: 'consequential', typicalDeductible: '3 - 5 días deducible' },
      'eqm_07': { id: 'transito-movilizacion-maquinaria', parentId: 'gastos-consecuenciales-movilizacion', riskType: 'equipment_damage', typicalDeductible: '10% min 2 SMMLV' },
    },
    sublimits: [],
    compositePatterns: [
      { pattern: 'todo\\s+riesgo\\s+maquinaria|p[oó]liza\\s+cpm|equipo\\s+y\\s+maquinaria\\s+amarilla', components: ['dano-fisico-accidental-maquinaria', 'rotura-mecanica-implosion', 'sustraccion-robo-maquinaria', 'rc-operacion-maquinaria'], confidence: 0.90 },
    ]
  }
};

function generateDomainOntology(domainName) {
  const def = DOMAIN_DEFINITIONS[domainName];
  if (!def) {
    throw new Error(`No definition for domain: ${domainName}`);
  }

  const taxPath = path.resolve('data', 'domains', domainName, 'taxonomy.json');
  const thePath = path.resolve('data', 'domains', domainName, 'thesaurus.json');

  const tax = JSON.parse(fs.readFileSync(taxPath, 'utf8'));
  let theEntries = [];
  if (fs.existsSync(thePath)) {
    try {
      const rawThe = JSON.parse(fs.readFileSync(thePath, 'utf8'));
      if (Array.isArray(rawThe.entries)) theEntries = rawThe.entries;
      else if (Array.isArray(rawThe.mappings)) theEntries = rawThe.mappings;
    } catch (e) {
      console.warn(`Could not read thesaurus for ${domainName}`, e);
    }
  }

  // Build L1 nodes
  const l1Nodes = def.l1.map(g => ({
    id: g.id,
    name: g.name,
    level: 1,
    childrenIds: [],
    aliases: g.aliases || [g.name],
    riskType: g.riskType,
  }));

  // Build L2 nodes from taxonomy categories
  const l2Nodes = [];
  for (const cat of tax.categories || []) {
    const catKey = String(cat.id);
    const mapping = def.categoryMapping[catKey];
    if (!mapping) {
      console.warn(`Domain ${domainName}: unmapped category ${cat.id} (${cat.name})`);
      continue;
    }

    const theEntry = theEntries.find(e => (e.canonicalName === cat.name || e.canonicalId === cat.id));
    const combinedAliases = Array.from(new Set([
      cat.name,
      ...(cat.synonyms || []),
      ...(cat.aliases || []),
      ...(theEntry ? (theEntry.variants || []) : [])
    ]));

    const l2Node = {
      id: mapping.id,
      name: cat.name,
      level: 2,
      parentId: mapping.parentId,
      childrenIds: [],
      aliases: combinedAliases,
      riskType: mapping.riskType,
      typicalDeductible: mapping.typicalDeductible || '10%',
    };

    l2Nodes.push(l2Node);

    // Link L2 to its L1 parent
    const parentL1 = l1Nodes.find(n => n.id === mapping.parentId);
    if (parentL1) {
      if (!parentL1.childrenIds.includes(mapping.id)) {
        parentL1.childrenIds.push(mapping.id);
      }
    } else {
      console.error(`Parent L1 ${mapping.parentId} not found for L2 ${mapping.id}`);
    }
  }

  // Build L3 sublimits
  const l3Nodes = (def.sublimits || []).map(sub => {
    // Link L3 to its L2 parent
    const parentL2 = l2Nodes.find(n => n.id === sub.parentId);
    if (parentL2) {
      if (!parentL2.childrenIds.includes(sub.id)) {
        parentL2.childrenIds.push(sub.id);
      }
    } else {
      console.warn(`Parent L2 ${sub.parentId} not found for L3 ${sub.id}`);
    }

    return {
      id: sub.id,
      name: sub.name,
      level: 3,
      parentId: sub.parentId,
      childrenIds: [],
      aliases: sub.aliases || [sub.name],
      riskType: sub.riskType,
      typicalDeductible: sub.typicalDeductible || '10%',
    };
  });

  const allNodes = [...l1Nodes, ...l2Nodes, ...l3Nodes];

  const ontologyBundle = {
    version: '1.0.0',
    domain: domainName,
    nodes: allNodes,
    compositePatterns: def.compositePatterns || [],
  };

  return ontologyBundle;
}

// Generate for all 9 domains
const domainsToGenerate = Object.keys(DOMAIN_DEFINITIONS);

for (const d of domainsToGenerate) {
  const ontology = generateDomainOntology(d);
  const outPath = path.resolve('data', 'domains', d, 'ontology.json');
  fs.writeFileSync(outPath, JSON.stringify(ontology, null, 2) + '\n', 'utf8');
  console.log(`✓ Generated ${d}/ontology.json with ${ontology.nodes.length} nodes and ${ontology.compositePatterns.length} composite patterns.`);

  // Also ensure bundle.json exists and has correct manifest
  const bundlePath = path.resolve('data', 'domains', d, 'bundle.json');
  const bundleManifest = {
    version: '1.0.0',
    domain: d,
    files: ['taxonomy.json', 'ontology.json', 'thesaurus.json'],
  };
  fs.writeFileSync(bundlePath, JSON.stringify(bundleManifest, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated ${d}/bundle.json manifest.`);
}

console.log("All 9 domain ontologies successfully generated!");
