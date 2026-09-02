/**
 * Semantic Grouper Service
 * Groups uncategorized coverages by semantic similarity into business categories
 */

export interface CoverageGroup {
  id: string;
  name: string;
  coverages: Array<{
    rawName: string;
    insuredAmount: number | null;
    deductible: string | null;
    premium: number | null;
  }>;
}

// Semantic keywords for grouping
const GROUP_KEYWORDS: Record<string, string[]> = {
  asistencias: [
    'asistencia',
    'servicio',
    'grua',
    'grúa',
    'auxilio',
    'ayuda',
    'domiciliaria',
    'domicilio',
    'hogar',
    'casa',
    'informatica',
    'informática',
    'tecnica',
    'técnica',
    'legal',
    'juridica',
    'jurídica',
    'abogado',
    'tributaria',
    'contable',
    'contador',
    'medica',
    'médica',
    'salud',
    'ambulancia',
  ],
  'amparos-adicionales': [
    'amparo',
    'adicional',
    'complementario',
    'extra',
    'hotelero',
    'hospedaje',
    'alojamiento',
    'evento',
    'especial',
    'temporal',
    'equipo especial',
    'maquinaria especial',
    'transporte',
    'envio',
    'envío',
  ],
  'servicios-profesionales': [
    'asesoria',
    'asesoría',
    'consultoria',
    'consultoría',
    'profesional',
    'especialista',
    'experto',
    'capacitacion',
    'capacitación',
    'entrenamiento',
    'audit',
    'auditoria',
    'auditoría',
  ],
};

/**
 * Group uncategorized coverages by semantic similarity
 */
export function groupUncategorizedCoverages(
  coverages: Array<{
    rawName: string;
    insuredAmount?: number | null;
    deductible?: string | null;
    premium?: number | null;
  }>
): CoverageGroup[] {
  const groups: Record<string, CoverageGroup> = {
    asistencias: { id: 'asistencias', name: 'Asistencias y Servicios', coverages: [] },
    'amparos-adicionales': {
      id: 'amparos-adicionales',
      name: 'Amparos Adicionales',
      coverages: [],
    },
    'servicios-profesionales': {
      id: 'servicios-profesionales',
      name: 'Servicios Profesionales',
      coverages: [],
    },
    otros: { id: 'otros', name: 'Otros Servicios', coverages: [] },
  };

  for (const coverage of coverages) {
    const nameLower = coverage.rawName.toLowerCase();
    let assigned = false;

    // Try to match against group keywords
    for (const [groupId, keywords] of Object.entries(GROUP_KEYWORDS)) {
      if (keywords.some((keyword) => nameLower.includes(keyword))) {
        groups[groupId]!.coverages.push({
          rawName: coverage.rawName,
          insuredAmount: coverage.insuredAmount || null,
          deductible: coverage.deductible || null,
          premium: coverage.premium || null,
        });
        assigned = true;
        break;
      }
    }

    // If no match, put in "Otros"
    if (!assigned) {
      groups['otros']!.coverages.push({
        rawName: coverage.rawName,
        insuredAmount: coverage.insuredAmount || null,
        deductible: coverage.deductible || null,
        premium: coverage.premium || null,
      });
    }
  }

  // Return only non-empty groups
  return Object.values(groups).filter((g) => g.coverages.length > 0);
}
