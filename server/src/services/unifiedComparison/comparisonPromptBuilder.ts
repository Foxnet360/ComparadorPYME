/**
 * Comparison Prompt Builder
 * Builds the multimodal prompt for Gemini 3.5 Flash to compare insurance quotes
 * Based on the successful reference prompt from prompt_agente_comparativa_seguros.md
 */

import { UnifiedComparisonSchema } from './comparisonSchema';
import { InsuranceDomain } from '../../types/domain';
import { HOGAR_GRANULAR_SECTIONS } from './hogarPromptStrategy';

export interface PromptContext {
  insurerCount: number;
  hasClauses?: boolean;
  domain?: InsuranceDomain;
}

const FLAT_ROW_LABELS = [
  'Bienes Asegurados',
  'Deducibles',
  'Prima con IVA',
  'Forma de Pago',
] as const;

const GRANULAR_SECTIONS = [
  {
    section: 'BIENES ASEGURADOS',
    rows: [
      'Mercancías',
      'Muebles y enseres',
      'Maquinaria y equipo',
      'Equipo eléctrico y electrónico',
      'Asistencia',
    ],
  },
  {
    section: 'COBERTURAS',
    rows: [
      'Amparo básico todo riesgo',
      'Terremoto',
      'Responsabilidad Civil Extracontractual (RCE)',
      'Lucro Cesante',
      'Rotura de Maquinaria',
      'Equipos eléctricos y electrónicos',
      'Gastos médicos',
      'Asistencia',
      'Vidrios',
      'Manejo global / Infidelidad',
      'Transporte de mercancías',
      'Daños por agua / Anegación',
      'HMACC-AMIT',
      'RC en proceso civil',
    ],
  },
  {
    section: 'DEDUCIBLES',
    rows: [
      'Todo Riesgo Incendio',
      'Anegación / Cobertura Extendida',
      'Terremoto',
      'HMACC-AMIT',
      'RCE',
      'Lucro Cesante',
      'Rotura de Maquinaria',
      'Equipos eléctricos y electrónicos',
      'Vidrios',
      'Manejo global / Infidelidad',
      'Transporte de mercancías',
      'Daños por agua / Anegación',
      'Sustracción con Violencia',
    ],
  },
  {
    section: 'SUSTRACCIÓN',
    rows: ['Sustracción con Violencia'],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Prima Neta Anual',
      'Gastos de Expedición',
      'IVA (19%)',
      'Total a Pagar / Prima Total Anual',
      'Forma de Pago',
    ],
  },
] as const;

export const COPROPIEDADES_GRANULAR_SECTIONS = [
  {
    section: 'BIENES Y ÁREAS COMUNES (LEY 675)',
    rows: [
      'Edificio / Estructura y Áreas Comunes',
      'Cimentación y Sótanos',
      'Maquinaria y Equipos Comunitarios (Ascensores, Subestación, Bombas)',
      'Equipos Eléctricos y Electrónicos Comunales',
      'Obras Civiles, Cerramientos y Vías Internas',
      'Salón Comunal y Zonas Recreativas',
    ],
  },
  {
    section: 'COBERTURAS OBLIGATORIAS Y PRINCIPALES',
    rows: [
      'Incendio, Rayo y/o Explosión (Bienes Comunes)',
      'Terremoto, Temblor y Erupción Volcánica (TTEV)',
      'Responsabilidad Civil Extracontractual Áreas Comunes (PLO)',
      'RCE Directores y Administradores (D&O Copropiedades)',
      'RCE Parqueaderos y Garajes',
      'RCE Patronal y Contratistas',
      'Daños por Agua, Anegación e Inundación',
      'Granizo, Vientos Fuertes, Tempestades y Huracán',
      'Actos Malintencionados de Terceros (AMIT) y Terrorismo',
      'HMACC (Huelga, Motín, Asonada, Conmoción Civil)',
      'Sustracción y Hurto de Bienes Comunes (Con y Sin Violencia)',
      'Rotura de Maquinaria y Equipos Comunitarios',
      'Equipos Electrónicos y Plantas Eléctricas',
      'Rotura de Vidrios, Fachadas y Domos Comunales',
      'Pérdida de Expensas y Cuotas de Administración',
      'Gastos de Remoción de Escombros y Preservación',
      'Asistencia y Mantenimiento de Zonas Comunes (24/7)',
    ],
  },
  {
    section: 'DEDUCIBLES',
    rows: [
      'Terremoto, Temblor y Erupción Volcánica',
      'Incendio, Rayo y Todo Riesgo Daño Material',
      'Daños por Agua, Anegación e Inundación',
      'Granizo, Vientos Fuertes y Huracán',
      'AMIT y HMACC',
      'Responsabilidad Civil Extracontractual (PLO)',
      'RCE Directores y Administradores (D&O)',
      'RCE Parqueaderos',
      'Sustracción con y sin Violencia',
      'Rotura de Maquinaria y Ascensores',
      'Equipos Eléctricos y Electrónicos',
      'Rotura de Vidrios y Cristales Comunales',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Prima Neta Anual',
      'Gastos de Expedición',
      'IVA (19%)',
      'Total a Pagar / Prima Total Anual',
      'Forma de Pago',
    ],
  },
] as const;

export const AUTOS_GRANULAR_SECTIONS = [
  {
    section: 'DATOS DEL VEHÍCULO Y BIENES',
    rows: [
      'Vehículo Asegurado (Marca / Modelo / Año / Placa)',
      'Valor Comercial Asegurado (FASECOLDA)',
      'Accesorios Especiales y Blindaje',
      'Ciudad de Circulación y Tipo de Uso',
    ],
  },
  {
    section: 'RESPONSABILIDAD CIVIL Y AMPAROS BÁSICOS',
    rows: [
      'RCE Daños a Bienes de Terceros',
      'RCE Muerte o Lesiones a una Persona',
      'RCE Muerte o Lesiones a dos o más Personas',
      'Límite Único Combinado (LUC) RCE',
      'Pérdida Total por Daños (PTD)',
      'Pérdida Total por Hurto (PTH)',
      'Pérdida Parcial por Daños (PPD)',
      'Pérdida Parcial por Hurto (PPH)',
      'Terremoto, Eventos de la Naturaleza e Inundación',
      'Amparo Patrimonial / Asistencia Jurídica en Proceso Penal',
    ],
  },
  {
    section: 'ASISTENCIAS Y BENEFICIOS',
    rows: [
      'Asistencia en Viaje 24/7 y Servicio de Grúa',
      'Carro Taller y Asistencia Mecánica Ligera',
      'Vehículo de Reemplazo / Sustituto (Días)',
      'Conductor Elegido (Eventos por año)',
      'Accidentes Personales al Conductor y Ocupantes',
      'Gastos de Transporte por Pérdida Total o Parcial',
    ],
  },
  {
    section: 'DEDUCIBLES',
    rows: [
      'Pérdida Parcial por Daños',
      'Pérdida Parcial por Hurto',
      'Pérdida Total por Daños',
      'Pérdida Total por Hurto',
      'Responsabilidad Civil Extracontractual (RCE)',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Prima Neta Anual',
      'Gastos de Expedición',
      'IVA (19%)',
      'Total a Pagar / Prima Total Anual',
      'Forma de Pago',
    ],
  },
] as const;

export const SALUD_GRANULAR_SECTIONS = [
  {
    section: 'MODALIDAD Y RED DE ATENCIÓN',
    rows: [
      'Tipo de Plan (Complementario PBS / Sustitutivo)',
      'Red de Clínicas e Instituciones Prestadoras (IPS)',
      'Cobertura Geográfica y Portabilidad Nacional',
    ],
  },
  {
    section: 'COBERTURAS HOSPITALARIAS Y QUIRÚRGICAS',
    rows: [
      'Hospitalización en Habitación Individual',
      'Unidad de Cuidados Intensivos (UCI / UCE)',
      'Honorarios Médicos y Procedimientos Quirúrgicos',
      'Hospitalización Domiciliaria (Home Care)',
      'Prótesis Quirúrgicas e Insumos Médicos',
    ],
  },
  {
    section: 'COBERTURAS AMBULATORIAS Y ESPECIALES',
    rows: [
      'Consultas Médicas Especializadas sin Remisión',
      'Exámenes de Laboratorio e Imágenes Diagnósticas',
      'Terapias de Rehabilitación (Física, Respiratoria, etc.)',
      'Tratamientos Oncológicos (Quimioterapia y Radioterapia)',
      'Maternidad, Parto y Cuidados del Recién Nacido',
      'Salud Mental (Psicología y Psiquiatría)',
      'Urgencias Odontológicas y Odontología Básica',
      'Urgencias en el Exterior y Asistencia Médica Internacional',
    ],
  },
  {
    section: 'DEDUCIBLES, COPAGOS Y CARENCIAS',
    rows: [
      'Copago por Consulta Médica Especializada',
      'Copago por Urgencias Médicas',
      'Copago por Exámenes de Diagnóstico Especializados',
      'Períodos de Carencia (Días o Meses de Espera)',
      'Tratamiento de Enfermedades Preexistentes',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Cuota Mensual por Persona',
      'Prima Anual por Persona o Colectivo',
      'IVA (19%)',
      'Total a Pagar / Tarifa Total',
      'Forma de Pago',
    ],
  },
] as const;

export const CUMPLIMIENTO_GRANULAR_SECTIONS = [
  {
    section: 'DATOS DEL CONTRATO GARANTIZADO',
    rows: [
      'Tomador / Contratista Afianzado',
      'Asegurado / Beneficiario (Entidad Estatal o Privada)',
      'Número y Objeto del Contrato Garantizado',
      'Valor Total del Contrato en COP',
      'Plazo y Término de Ejecución',
    ],
  },
  {
    section: 'GARANTÍAS CONTRACTUALES Y PRECONTRACTUALES',
    rows: [
      'Seriedad de la Oferta (% y Límite)',
      'Buen Manejo y Correcta Inversión del Anticipo (100%)',
      'Cumplimiento del Contrato (% y Límite)',
      'Pago de Salarios, Prestaciones Sociales e Indemnizaciones (% y Límite)',
      'Calidad del Servicio o de los Bienes Suministrados',
    ],
  },
  {
    section: 'GARANTÍAS POSTCONTRACTUALES Y RESPONSABILIDAD',
    rows: [
      'Estabilidad y Calidad de la Obra (% y Años de Vigencia)',
      'Garantía de Mantenimiento y Correcto Funcionamiento',
      'Responsabilidad Civil Extracontractual Derivada del Contrato',
      'Provisión de Repuestos y Accesorios',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Prima Neta de Cumplimiento',
      'Gastos de Expedición',
      'IVA (19%)',
      'Total a Pagar de la Póliza',
      'Tasa Aplicada por Amparo',
    ],
  },
] as const;

export const TRANSPORTE_GRANULAR_SECTIONS = [
  {
    section: 'TRAYECTO Y MERCANCÍAS ASEGURADAS',
    rows: [
      'Modo de Transporte (Terrestre / Marítimo / Aéreo / Multimodal)',
      'Ruta y Trayecto (Origen - Destino)',
      'Naturaleza de la Mercancía Asegurada',
      'Tipo de Póliza (Flotante / Automática / Por Viaje / Abierta)',
      'Incoterm Aplicable (CIF, FOB, DAP, etc.) y Sobrevalor (110%)',
    ],
  },
  {
    section: 'COBERTURAS DE TRÁNSITO Y CARGA',
    rows: [
      'Todo Riesgo Daño Material a la Carga',
      'Pérdida Total por Accidente del Vehículo Transportador',
      'Hurto Calificado y Hurto Simple de la Carga',
      'Saqueo, Pillaje y Falta de Entrega por Bulto Entero',
      'Rotura, Derrame, Contacto con Otras Cargas y Contaminación',
      'Avería Particular y Avería Gruesa (General Average)',
      'Cláusulas del Instituto de Londres (ICC A, B o C)',
      'Falla del Sistema de Refrigeración / Cadena de Frío',
      'Daños al Contenedor y Material de Embalaje',
    ],
  },
  {
    section: 'DEDUCIBLES Y REQUISITOS DE SEGURIDAD',
    rows: [
      'Deducible Hurto',
      'Deducible Daño Material',
      'Deducible Falta de Entrega',
      'Exigencias de Seguridad (GPS, Escolta, Horario Nocturno)',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Prima Neta / Depósito de Transporte',
      'Gastos de Expedición',
      'IVA (19%)',
      'Total a Pagar',
      'Tasa por Mil Aplicada',
    ],
  },
] as const;

export const VIDA_GRUPO_GRANULAR_SECTIONS = [
  {
    section: 'DATOS DEL GRUPO Y ASEGURABILIDAD',
    rows: [
      'Grupo Asegurado / Empresa Tomadora',
      'Número de Asegurados del Colectivo',
      'Edad Máxima de Ingreso',
      'Edad Límite de Permanencia',
      'Límite de No Asegurabilidad / Exámenes Médicos',
    ],
  },
  {
    section: 'AMPAROS PRINCIPALES DE VIDA',
    rows: [
      'Amparo Básico por Muerte (Cualquier Causa)',
      'Incapacidad Total y Permanente (ITP ≥ 50%)',
      'Muerte Accidental y Desmembración (MAyD)',
      'Anticipo o Indemnización por Enfermedades Graves',
      'Auxilio Funerario / Gastos de Sepelio',
    ],
  },
  {
    section: 'BENEFICIOS COMPLEMENTARIOS',
    rows: [
      'Renta Diaria por Hospitalización / Cirugía',
      'Auxilio de Canasta Familiar / Mantenimiento',
      'Auxilio Educativo para Hijos Estudiantes',
      'Doble Indemnización por Accidente de Tránsito',
      'Cobertura de Suicidio (Día 1 vs. Carencia de 1 Año)',
      'Exoneración de Pago de Primas por Invalidez',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Prima Neta Mensual por Persona',
      'Prima Neta Anual Total del Colectivo',
      'IVA (0% Exento Art. 427 E.T.)',
      'Total a Pagar de la Póliza',
      'Forma y Periodicidad de Pago',
    ],
  },
] as const;

export class ComparisonPromptBuilder {
  /**
   * Build the main flat-table comparison prompt.
   *
   * Asks the model for one column per insurer and exactly four rows. The
   * response can be JSON, Markdown, CSV or key-value; a parser normalizes it
   * afterwards.
   */
  buildComparisonPrompt(context: PromptContext): string {
    const rowList = FLAT_ROW_LABELS.map((label, idx) => `${idx + 1}. ${label}`).join('\n');

    return `Eres un analista de seguros en Colombia. He subido ${context.insurerCount} cotizaciones del mismo riesgo.

Genera una tabla comparativa con UNA columna por aseguradora y EXACTAMENTE estas filas:
${rowList}

Reglas:
- REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS: El array "insurers" DEBE contener ÚNICA Y EXCLUSIVAMENTE el nombre corporativo de la aseguradora (ejemplos: "ALLIANZ", "SBS", "SURA", "MAPFRE", "BOLÍVAR", "AXA COLPATRIA", "CHUBB", "HDI", "ZURICH", "SEGUROS DEL ESTADO"). NUNCA concatenes el nombre del cliente/asegurado ni el producto en "insurers" ni en "cells[].insurer". Si una cotización en Colombia menciona tanto a "HDI" como a "Liberty Seguros" (debido a la adquisición de Liberty por parte de HDI), identifícala como "HDI" a menos que sea exclusivamente una póliza antigua de Liberty sin marca HDI.
- Copia los valores textualmente como aparecen en cada cotización.
- No agrupes, no normalices a coberturas canónicas y no inventes datos.
- Si una fila no aparece en una cotización, usa "No informado".
- Responde únicamente con JSON válido que cumpla este schema:
{
  "insurers": ["Aseguradora A", ...],
  "rows": [
    {
      "label": "Bienes Asegurados",
      "cells": [
        {"insurer": "Aseguradora A", "value": "..."},
        ...
      ]
    },
    ...
  ]
}

${context.hasClauses ? 'También se proporcionan clausulados para validación; úsalos solo si una fila es ambigua, pero conserva el texto original de la cotización.' : ''}`;
  }

  /**
   * Build the v2 granular comparison prompt.
   *
   * Suggests section-aware sub-rows but explicitly allows the model to omit,
   * add, or rename rows. The response must be JSON with insurers, rows, and
   * optional section metadata.
   */
  buildV2ComparisonPrompt(
    context: PromptContext,
    templateAddons?: string[],
    domain?: InsuranceDomain
  ): string {
    const effectiveDomain = domain ?? context.domain ?? 'pyme';
    const isHogar = effectiveDomain === 'hogar';
    const isCopropiedades = effectiveDomain === 'copropiedades';
    const isAutos = effectiveDomain === 'autos';
    const isSalud = effectiveDomain === 'salud';
    const isCumplimiento = effectiveDomain === 'cumplimiento';
    const isTransporte = effectiveDomain === 'transporte';
    const isVidaGrupo = effectiveDomain === 'vida_grupo';

    let sectionsToUse: readonly { readonly section: string; readonly rows: readonly string[] }[] =
      GRANULAR_SECTIONS;
    let roleDescription = 'Eres un analista de seguros PYME y Daños Materiales en Colombia.';
    let sectionRules = '';

    if (isHogar) {
      sectionsToUse = HOGAR_GRANULAR_SECTIONS;
      roleDescription = 'Eres un analista experto en seguros de Hogar y Vivienda en Colombia.';
      sectionRules = `Reglas de Negocio para Secciones de Hogar:
1. BIENES ASEGURADOS: Identifica la tipología contratada en cada cotización: Solo Edificio/Estructura, Solo Contenidos (Muebles y Enseres) o Integral (Edificio + Contenidos).
   - Si una cotización NO ampara el Edificio (ej. póliza para arrendatario), usa exactamente "No Cotizado" para el Edificio.
   - Si una cotización NO ampara Contenidos (ej. seguro obligatorio hipotecario solo estructura), usa exactamente "No Cotizado" para Contenidos.
   - Extrae también valores de Contenidos Especiales (joyas, arte) y Equipo Eléctrico/Electrónico si figuran en la propuesta.
2. COBERTURAS: Extrae límites, amparos y condiciones para Incendio/Rayo/Explosión, Terremoto/Temblor/Erupción, Daños por Agua/Anegación, Granizo/Vendaval, Sustracción con Violencia dentro del predio, RCE Familiar y Asistencia Domiciliaria. Si una cobertura opcional no fue contratada, usa "No Incluido".
3. DEDUCIBLES: Extrae los deducibles específicos por amparo textualmente:
   - Considera la tipología contratada: si un bien no está cotizado (ej. Edificio en póliza solo contenidos), los deducibles asociados a dicho bien deben reportar "No Aplica (Edificio no cotizado)". Si Contenidos no está cotizado (ej. póliza solo edificio), reporta "No Aplica (Contenidos no cotizados)".
   - Terremoto y Sismo: suele expresarse como % del valor asegurable o % de la pérdida con mínimo en SMMLV.
   - Daños por agua, Anegación y Hurto: suele ser % de la pérdida con mínimo en SMMLV.
   - RCE y Asistencia Domiciliaria: si no aplican copago o deducible, reporta textualmente "Sin deducible". NUNCA uses "No Incluido" en la sección de deducibles si el amparo no tiene deducible; usa "Sin deducible".
4. FINANCIAL: Extrae Prima con IVA incluido, Gastos de expedición, IVA, Total prima, y Forma de pago.
   - REGLA CRÍTICA DE SEPARACIÓN PATRIMONIAL VS PRIMA: NUNCA confundas el "Valor Asegurado", "Suma Asegurada" o "Valor Total Asegurado" (que son sumas del inmueble/bienes del orden de cientos o miles de millones de COP) con la Prima o Valor a pagar de la póliza (que para Hogar suele ser de unos pocos millones de COP, ej. $1.000.000 a $15.000.000 COP).
   - La sección FINANCIAL DEBE contener ÚNICA Y EXCLUSIVAMENTE los costos o primas comerciales a pagar por el cliente. Jamás traslades valores de bienes o sumas aseguradas a esta sección ni a la fila "Total a pagar" o "Total prima".
   - Para Allianz: ubica la prima comercial del plan cotizado (ej. "Hogar Esencial", "Hogar Plus") o el "Valor a pagar" / "Total liquidación", extrayendo dicho monto exacto (ej. $3.962.567) en la fila "Total a pagar" o "Total prima".
   - Para Mapfre: ubica la "Prima Total" o "Total a pagar" con IVA incluido (ej. $4.333.254) y repórtala en "Total a pagar" o "Total prima".
   - Si la cotización indica 'Prima Mínima Anual' o valor en SMMLV (ej. '1 SMMLV Sin I.V.A. $1.750.905'), extrae obligatoriamente el monto numérico en pesos en 'Total a pagar' o 'Total prima'. NUNCA dejes la prima vacía ni en 0.`;
    } else if (isCopropiedades) {
      sectionsToUse = COPROPIEDADES_GRANULAR_SECTIONS;
      roleDescription =
        'Eres un analista experto en seguros de Copropiedades y Propiedad Horizontal en Colombia (Ley 675 de 2001 y NSR-10).';
      sectionRules = `Reglas de Negocio para Secciones de Copropiedades (Ley 675 de 2001 y NSR-10):
1. BIENES Y ÁREAS COMUNES: Extrae los valores asegurados (valor de reposición o reconstrucción a nuevo) para Edificio / Estructura Común, Cimentación y Sótanos, Maquinaria Comunitaria (Ascensores, Subestaciones, Bombas de Agua, Equipos Hidroneumáticos), Equipos Eléctricos y Electrónicos, Cerramientos y Zonas Recreativas.
2. COBERTURAS: Extrae límites y condiciones para Incendio, Terremoto (obligatorios bajo Ley 675), RCE Áreas Comunes, RCE para Directores y Administradores (D&O Copropiedades), RCE Parqueaderos, Daños por Agua / Anegación, Granizo / Vientos Fuertes, AMIT / HMACC, Sustracción de bienes comunes, Rotura de Maquinaria y Asistencia de Áreas Comunes.
3. DEDUCIBLES: REGLA DE ORO DE DEDUCIBLES: Extrae con total detalle todos los deducibles estipulados en cada cotización. No omitas ningún deducible:
   - Terremoto: extrae textualmente la fórmula (% sobre valor asegurado de la edificación o % de la pérdida con mínimo en SMMLV).
   - Daños por Agua / Anegación: extrae % de la pérdida y mínimo en SMMLV.
   - RCE y D&O: extrae % de la pérdida y mínimo en SMMLV, o "Sin deducible" si no aplica copago.
   - Si una cobertura no tiene deducible a cargo de la copropiedad, usa textualmente "Sin deducible".
4. FINANCIAL: Extrae Prima Neta, Gastos de Expedición, IVA (19%) y Total a Pagar / Prima Total Anual. NUNCA confundas la suma asegurada de los edificios con la prima a pagar de la póliza. Si una cotización indica 'Prima Mínima Anual' o valor en SMMLV (ej. '1 SMMLV Sin I.V.A. $1.750.905'), extrae obligatoriamente el monto numérico en pesos en 'Total a Pagar' o 'Prima Neta'. NUNCA dejes la prima vacía ni en 0 si figura una prima mínima o valor a pagar.
5. ESPECIFICIDAD PARA ASEGURADORAS DE COPROPIEDADES (AXA COLPATRIA, SBS, SEGUROS DEL ESTADO):
   - AXA Colpatria: Ubica la sección de liquidación de la póliza y extrae obligatoriamente Prima Neta, Gastos de Expedición, IVA y Total a Pagar. En deducibles, extrae la fórmula completa de Terremoto (% edificación o pérdida y mín SMMLV), Rotura de Maquinaria y RCE.
   - SBS Seguros: Extrae la liquidación económica del cuadro de primas ('Total Liquidación' o 'Prima Total a Pagar') y todos los deducibles especificados para zonas comunes.
   - Seguros del Estado: Localiza el cuadro 'Liquidación' ('Prima Neta Total', 'Gastos de Expedición', 'IVA' y 'Total Póliza / Total a Pagar') y los deducibles de cada amparo.`;
    } else if (isAutos) {
      sectionsToUse = AUTOS_GRANULAR_SECTIONS;
      roleDescription =
        'Eres un analista experto en seguros de Automotores y Vehículos en Colombia bajo regulación de la SFC y FASECOLDA.';
      sectionRules = `Reglas de Negocio para Secciones de Autos:
1. DATOS DEL VEHÍCULO Y BIENES: Extrae la identificación del automotor (Marca, Modelo, Año, Placa), valor comercial asegurado en guía FASECOLDA, y si ampara accesorios, blindaje o lujos especiales.
2. RESPONSABILIDAD CIVIL Y AMPAROS BÁSICOS: Extrae límites de RCE Daños a Terceros, RCE Lesiones o Muerte 1 Persona, RCE Lesiones o Muerte 2+ Personas, o Límite Único Combinado (LUC). Extrae condiciones de Pérdida Total Daños (PTD) y Pérdida Total Hurto (PTH) indicando el umbral de pérdida (75% u 80% FASECOLDA), y amparos de Pérdida Parcial Daños (PPD) y Pérdida Parcial Hurto (PPH).
3. ASISTENCIAS Y BENEFICIOS: Extrae coberturas de Grúa y Asistencia en Viaje 24/7, días de Carro Taller / Vehículo de Reemplazo (ej. 10, 15, 30 días), Conductor Elegido y Accidentes al Conductor/Ocupantes.
4. DEDUCIBLES: Extrae con exactitud cada deducible en su unidad original: porcentaje con mínimo en SMMLV (ej. 10% mín. 1 SMMLV para PPD/PPH), o "Sin deducible" si la póliza cubre al 100% sin franquicia (especialmente en Pérdida Total o RCE).
5. FINANCIAL: Extrae Prima Neta, Gastos de Expedición, IVA (19%) y Total a Pagar. Nunca confundas el valor comercial del carro con la prima a pagar. Si la cotización indica 'Prima Mínima Anual' o valor en SMMLV, extrae obligatoriamente el monto numérico en pesos en 'Total a Pagar'. NUNCA dejes la prima vacía ni en 0.`;
    } else if (isSalud) {
      sectionsToUse = SALUD_GRANULAR_SECTIONS;
      roleDescription =
        'Eres un analista experto en Planes Voluntarios de Salud (PVS) y Medicina Prepagada en Colombia bajo Res. 244/2019 MinSalud y regulación SFC.';
      sectionRules = `Reglas de Negocio para Secciones de Salud:
1. MODALIDAD Y RED DE ATENCIÓN: Identifica si el plan es Complementario al PBS de la EPS o Sustitutivo, la red de clínicas/IPS (propias vs adscritas) y portabilidad nacional.
2. COBERTURAS HOSPITALARIAS Y QUIRÚRGICAS: Extrae hospitalización en habitación individual sin límite de días, cobertura UCI/UCE, honorarios quirúrgicos y atención domiciliaria (Home Care).
3. COBERTURAS AMBULATORIAS: Extrae acceso directo a médicos especialistas sin remisión, exámenes diagnósticos de alta complejidad, terapias, tratamientos oncológicos (quimio/radioterapia) y urgencias médicas internacionales (en USD o EUR).
4. DEDUCIBLES, COPAGOS Y CARENCIAS: Extrae con precisión el valor exacto de copagos por consulta médica especializada en COP (ej. $35.000 COP), copagos por urgencias, períodos de carencia para maternidad o cirugías, y condiciones de preexistencias.
5. FINANCIAL: Extrae cuota mensual o tarifa anual por persona o colectivo, impuestos y valor total a pagar. Si la cotización indica tarifa mínima o valor anual base, extrae obligatoriamente el monto numérico en pesos. NUNCA dejes la prima vacía ni en 0.`;
    } else if (isCumplimiento) {
      sectionsToUse = CUMPLIMIENTO_GRANULAR_SECTIONS;
      roleDescription =
        'Eres un analista experto en Seguros de Cumplimiento, Fianzas y Contratación Estatal en Colombia (Ley 80 de 1993 y Decreto 1082 de 2015).';
      sectionRules = `Reglas de Negocio para Secciones de Cumplimiento:
1. DATOS DEL CONTRATO GARANTIZADO: Extrae Tomador/Contratista, Entidad Beneficiaria (estatal o privada), Número y Objeto del Contrato, y Valor Total del Contrato en COP.
2. GARANTÍAS CONTRACTUALES: Extrae porcentajes y sumas aseguradas para Seriedad de la Oferta (mín. 10%), Buen Manejo del Anticipo (100%), Cumplimiento del Contrato (10% a 20%), y Pago de Salarios y Prestaciones Sociales (5% a 15%).
3. GARANTÍAS POSTCONTRACTUALES: Extrae Estabilidad y Calidad de la Obra (término en años y %), Calidad de Bienes/Servicios, y Mantenimiento.
4. FINANCIAL: Extrae Prima Neta, Gastos de Expedición, IVA (19%) y Total a Pagar. Registra la tasa aplicada por amparo si está disponible. Si la cotización indica 'Prima Mínima' o valor mínimo en SMMLV (muy común en pólizas de cumplimiento), extrae obligatoriamente el monto numérico en pesos en 'Total a Pagar'. NUNCA dejes la prima vacía ni en 0.`;
    } else if (isTransporte) {
      sectionsToUse = TRANSPORTE_GRANULAR_SECTIONS;
      roleDescription =
        'Eres un analista experto en Seguros de Transporte de Mercancías y Carga en Colombia (Decreto 1079 de 2015 y Código de Comercio Arts. 1117-1124).';
      sectionRules = `Reglas de Negocio para Secciones de Transporte:
1. TRAYECTO Y MERCANCÍAS: Extrae modo de transporte (Terrestre, Marítimo, Aéreo, Multimodal), ruta origen-destino, tipo de mercancía y términos Incoterm (con sobre-valor ej. 110%).
2. COBERTURAS DE TRÁNSITO: Extrae amparos para Todo Riesgo Daño Material, Pérdida Total del vehículo, Hurto Calificado/Simple, Saqueo y Falta de Entrega por bulto entero, Avería Gruesa (General Average), y Cláusulas ICC del Instituto de Londres (A, B o C).
3. DEDUCIBLES Y SEGURIDAD: Extrae deducibles por amparo (% de la pérdida con mínimo en SMMLV) y requisitos obligatorios de seguridad (monitoreo GPS, escolta armada, horarios de movilización).
4. FINANCIAL: Extrae Prima Neta o Depósito, Gastos de Expedición, IVA (19%), Total a Pagar y Tasa por Mil aplicada. Si la cotización indica 'Prima Mínima de Depósito' o valor mínimo en SMMLV, extrae obligatoriamente el monto numérico en pesos en 'Total a Pagar'. NUNCA dejes la prima vacía ni en 0.`;
    } else if (isVidaGrupo) {
      sectionsToUse = VIDA_GRUPO_GRANULAR_SECTIONS;
      roleDescription =
        'Eres un analista experto en Seguros de Vida Grupo y Vida Colectivo en Colombia (Código de Comercio y regulación SFC).';
      sectionRules = `Reglas de Negocio para Secciones de Vida Grupo:
1. DATOS DEL GRUPO Y ASEGURABILIDAD: Extrae Empresa/Tomador, número de asegurados, edades límites (edad máxima de ingreso ej. 65 años, permanencia ej. 75 años) y límites sin examen médico.
2. AMPAROS PRINCIPALES: Extrae sumas aseguradas de Amparo Básico Muerte Cualquier Causa, Incapacidad Total y Permanente (ITP ≥ 50%), Muerte Accidental (MAyD), Enfermedades Graves y Auxilio Funerario.
3. BENEFICIOS COMPLEMENTARIOS: Extrae Renta Hospitalaria, Auxilio Educativo, Canasta Familiar, Doble Indemnización en accidente de tránsito, y condiciones del amparo de Suicidio (cobertura desde día 1 vs carencia 1 año según Art. 1158 Co.Co.).
4. FINANCIAL: Extrae Prima Neta por persona o colectivo, IVA (0% exento en vida bajo Art. 427 Estatuto Tributario) y Total a Pagar. Si la cotización indica prima mínima anual o mensual, extrae obligatoriamente el monto numérico en pesos. NUNCA dejes la prima vacía ni en 0.`;
    } else {
      sectionsToUse = GRANULAR_SECTIONS;
      roleDescription = 'Eres un analista de seguros PYME y Daños Materiales en Colombia.';
      sectionRules = `Reglas de Negocio para Secciones:
1. BIENES ASEGURADOS: Extrae las sumas aseguradas o descripciones de Mercancías, Muebles y enseres, Maquinaria y equipo, Equipo eléctrico y electrónico, y Asistencia.
2. COBERTURAS: Extrae límites, amparos y condiciones de cobertura para Amparo básico todo riesgo, Terremoto, Responsabilidad Civil Extracontractual (RCE), Lucro Cesante, Rotura de Maquinaria, Equipos eléctricos y electrónicos, Gastos médicos, Asistencia, Vidrios, Manejo global / Infidelidad, Transporte de mercancías, Daños por agua / Anegación, HMACC-AMIT, y RC en proceso civil.
3. DEDUCIBLES: Extrae los deducibles específicos para Todo Riesgo Incendio, Anegación / Cobertura Extendida, Terremoto, HMACC-AMIT, RCE, Lucro Cesante, Rotura de Maquinaria, Equipos eléctricos y electrónicos, Vidrios, Manejo global / Infidelidad, Transporte de mercancías, Daños por agua / Anegación, y Sustracción con Violencia. Debes incluir una fila por cada deducible que aparezca textualmente en las cotizaciones; no omitas deducibles. Si un amparo no tiene deducible, usa "Sin deducible".
4. SUSTRACCIÓN: Extrae límites y condiciones para Sustracción con Violencia.
5. FINANCIAL: Extrae Prima Neta Anual, Gastos de Expedición, IVA (19%), Total a Pagar / Prima Total Anual, y Forma de Pago. NUNCA coloques sumas aseguradas ni valores de bienes en esta sección; solo costos o primas de la póliza. Si una cotización indica Gastos de Expedición (ej. $15.000 a $80.000 COP), repórtalos en 'Gastos de Expedición'; si no figuran o dice 'incluidos', reporta 0. Si una cotización indica 'Prima Mínima Anual' (como BBVA con '1 SMMLV Sin I.V.A. $1.750.905'), extrae obligatoriamente el monto numérico en pesos en 'Total a Pagar / Prima Total Anual' o 'Prima Neta Anual' (ej. $1.750.905). NUNCA dejes la prima vacía ni en 0 si figura una prima mínima o valor a pagar.`;
    }

    const sectionList = sectionsToUse
      .map((section, sIdx) => {
        const rows = section.rows.map((row, rIdx) => `    ${rIdx + 1}. ${row}`).join('\n');
        return `  ${sIdx + 1}. ${section.section}:\n${rows}`;
      })
      .join('\n\n');

    const percentageRule = isHogar
      ? `\n- REGLA CRÍTICA DE AMPAROS PORCENTUALES (SURA Y SIMILARES): Si una cotización expresa el valor o límite de una cobertura como un porcentaje (ej. "100%", "10% hasta 50 SMMLV"), DEBES calcular y mostrar el valor monetario real en pesos con base en la suma asegurada del bien correspondiente (Edificio o Contenidos) y reportarlo como "$XXX.XXX.XXX (YY%)". NUNCA dejes únicamente "100%" sin el valor monetario absoluto si la cotización indica el valor asegurable del bien.`
      : '';

    let prompt = `${roleDescription} He subido ${context.insurerCount} cotizaciones del mismo riesgo.

Genera una tabla comparativa con UNA columna por aseguradora y filas agrupadas por sección. A continuación te sugiero filas granulares, pero PUEDES agregar o renombrar filas según lo que aparezca textualmente en cada cotización. No omitas una fila si la información existe en al menos una cotización.

${sectionList}

${sectionRules}

Reglas Generales:
- REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS: El array "insurers" DEBE contener ÚNICA Y EXCLUSIVAMENTE el nombre corporativo de la aseguradora (ejemplos: "ALLIANZ", "SBS", "SURA", "MAPFRE", "BOLÍVAR", "AXA COLPATRIA", "CHUBB", "HDI", "ZURICH", "SEGUROS DEL ESTADO"). NUNCA concatenes el nombre del cliente/asegurado (ej. "ISABEL CRISTINA VASCO") ni el ramo/producto ("HOGAR", "PYME") dentro de "insurers" ni en el campo "insurer" de las celdas. Si una cotización en Colombia menciona tanto a "HDI" como a "Liberty Seguros" (debido a la adquisición de Liberty por parte de HDI), identifícala como "HDI" a menos que sea exclusivamente una póliza antigua de Liberty sin marca HDI.
- HOMOGENEIZACIÓN DE CONCEPTOS:
  * Usa "No Cotizado" cuando un bien patrimonial (ej. Edificio o Contenido) no fue incluido en el alcance de la cotización.
  * Usa "No Incluido" cuando una cobertura u opción ofrecida por el producto no fue contratada en esta propuesta.
  * Usa "Sin deducible" en la sección de deducibles cuando el amparo no tenga copago a cargo del asegurado.
  * Usa "No Aplica (Edificio no cotizado)" o "No Aplica (Contenidos no cotizados)" en deducibles cuando el bien base no forma parte del seguro.
- REGLA CRÍTICA DE COMPLETITUD: DEBES EXTRAER EL 100% DE LAS COBERTURAS, BIENES, DEDUCIBLES Y CONDICIONES PRESENTES EN LAS COTIZACIONES. NO OMITAS NINGUNA FILA POR RESUMEN O LÍMITE DE ESPACIO. SI EXISTEN 30 O 40 AMPAROS, GENERA LAS 30 O 40 FILAS EN EL JSON.
- REGLA OBLIGATORIA DE DEDUCIBLES: En cada celda del array "cells" de coberturas, incluye en el campo "deductible" el texto textual del deducible correspondiente a ese amparo (ej. "10% de la pérdida mín. 5 SMMLV", "Sin deducible", o "No aplica"). Además, incluye obligatoriamente la sección completa "DEDUCIBLES" con filas dedicadas para cada deducible de la cotización.
- REGLA OBLIGATORIA DE LIQUIDACIÓN Y PRIMAS: En la sección "FINANCIAL", extrae sin excepción: 'Prima Neta Anual', 'Gastos de Expedición', 'IVA (19%)' y 'Total a Pagar / Prima Total Anual'. Si una cotización indica 'Prima Mínima' o monto de liquidación final, extráelo obligatoriamente en número en pesos en 'Total a Pagar'. NUNCA dejes la prima vacía ni en 0.
- REGLA DE INTEGRIDAD NUMÉRICA: Conserva intactos los montos, monedas (COP/USD), símbolos y separadores de miles/decimales. Si una cifra dice "$ 15.000.000,00" o "$ 15,000,000.00", déjala tal cual sin alterar ni mover los puntos o comas.${percentageRule}
- CITA DE PÁGINA: Extrae obligatoriamente en pageNumber el número de página exacto (1-indexado) donde figura la información dentro de la cotización.
- Copia los valores textualmente como aparecen en cada cotización.
- No agrupes, no normalices a coberturas canónicas y no inventes datos.
- Si una fila no aparece en una cotización, usa "No informado".
- Para rawText (evidencia), incluye un snippet breve (máximo 100 caracteres) SOLO cuando exista información o cobertura relevante. En celdas con 'No incluido', 'No informado' o 'No cotizado', omite el rawText o déjalo vacío para economizar tokens y garantizar la integridad de la respuesta.
- IMPORTANTE: Cierra siempre correctamente toda la estructura JSON generada hasta el último carácter ('}').
- Además, para cada cotización, extrae los siguientes metadatos de cabecera: Cliente, Tipo de Seguro, Ubicación del Riesgo, Año Construcción, Pisos, Aliado, Actividad/Ocupación, Documento, Vigencia.
- Responde únicamente con JSON válido que cumpla este schema:
{
  "insurers": ["Aseguradora A", ...],
  "quoteMetadata": [
    {
      "insurer": "Aseguradora A",
      "cliente": "...",
      "tipoSeguro": "...",
      "ubicacionRiesgo": "...",
      "anoConstruccion": "...",
      "pisos": "...",
      "aliado": "...",
      "actividadOcupacion": "...",
      "documento": "...",
      "vigencia": "..."
    },
    ...
  ],
  "rows": [
    {
      "label": "Edificio / Estructura",
      "section": "BIENES ASEGURADOS",
      "cells": [
        {"insurer": "Aseguradora A", "value": "...", "deductible": "...", "rawText": "...", "pageNumber": 1},
        ...
      ]
    },
    ...
  ]
}

${context.hasClauses ? 'También se proporcionan clausulados para validación; úsalos solo si una fila es ambigua, pero conserva el texto original de la cotización.' : ''}`;

    if (templateAddons && templateAddons.length > 0) {
      prompt += `\n\n--- Insurer-specific extraction hints ---\n\n${templateAddons.join('\n\n')}`;
    }

    return prompt;
  }

  /**
   * Build correction prompt for retry on malformed output
   */
  buildCorrectionPrompt(originalResponse: string, errorMessage: string): string {
    const trimmedResponse = originalResponse.trim();
    const formattedResponse =
      trimmedResponse.length > 40000 ? trimmedResponse.substring(0, 40000) : trimmedResponse;

    return `Tu respuesta anterior no cumplió el schema de tabla plana requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR:
${formattedResponse}

Por favor genera el JSON completo y válido con EXACTAMENTE estas filas:
1. Bienes Asegurados
2. Deducibles
3. Prima con IVA
4. Forma de Pago

Asegúrate de que:
1. El JSON tenga "insurers" como array de strings
2. El JSON tenga "rows" como array de objetos con "label" y "cells"
3. Cada celda tenga "insurer" y "value"
4. Si no encuentras una fila para una aseguradora, usa "No informado" como valor

Responde ÚNICAMENTE con el JSON corregido.`;
  }

  /**
   * Build v2 correction prompt for retry on malformed granular output
   */
  buildV2CorrectionPrompt(originalResponse: string, errorMessage: string): string {
    const trimmedResponse = originalResponse.trim();
    const formattedResponse =
      trimmedResponse.length > 40000 ? trimmedResponse.substring(0, 40000) : trimmedResponse;

    return `Tu respuesta anterior no cumplió el schema de tabla granular requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR:
${formattedResponse}

Por favor genera el JSON completo y válido con este schema:
{
  "insurers": ["Aseguradora A", ...],
  "quoteMetadata": [
    {
      "insurer": "Aseguradora A",
      "cliente": "...",

      "tipoSeguro": "...",
      "ubicacionRiesgo": "...",
      "anoConstruccion": "...",
      "pisos": "...",
      "aliado": "...",
      "actividadOcupacion": "...",
      "documento": "...",
      "vigencia": "..."
    }
  ],
  "rows": [
    {
      "label": "...",
      "section": "...",
      "cells": [
        {"insurer": "Aseguradora A", "value": "...", "rawText": "..."},
        ...
      ]
    },
    ...
  ]
}

Asegúrate de que:
1. El JSON tenga "insurers" como array de strings
2. El JSON tenga "quoteMetadata" como array de objetos con los metadatos correspondientes por aseguradora
3. El JSON tenga "rows" como array de objetos con "label", "section" y "cells"
4. Cada celda tenga "insurer" y "value"
5. Si no encuentras una fila para una aseguradora, usa "No informado" como valor

Responde ÚNICAMENTE con el JSON corregido.`;
  }

  /**
   * Build deep mode prompt for clause validation
   */
  buildDeepModePrompt(comparisonJson: string): string {
    return `Eres un analista experto en clausulados de seguros. Tu tarea es validar una comparación de cotizaciones contra los clausulados oficiales de las aseguradoras.

COMPARACIÓN ACTUAL:
${comparisonJson}

CLAUSULADOS PROPORCIONADOS:
[Los clausulados se adjuntan como documentos]

TAREA DE VALIDACIÓN:
1. Para cada deducible marcado como "Ver condiciones", busca el valor exacto en el clausulado
2. Verifica que las coberturas listadas como "Incluidas" realmente lo estén según el clausulado
3. Identifica exclusiones mencionadas en el clausulado pero no en la cotización
4. Detecta discrepancias entre lo que dice la cotización y el clausulado
5. Extrae sub-límites específicos del clausulado

Responde con un JSON que contenga:
- Las validaciones realizadas
- Los valores corregidos
- Las discrepancias encontradas
- El nivel de severidad de cada discrepancia`;
  }

  /**
   * Get the JSON Schema for structured output
   */
  getResponseSchema(): Record<string, unknown> {
    return UnifiedComparisonSchema;
  }
}

export const comparisonPromptBuilder = new ComparisonPromptBuilder();
export default comparisonPromptBuilder;
