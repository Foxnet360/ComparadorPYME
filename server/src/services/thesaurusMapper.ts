/**
 * Thesaurus Mapper Module
 * Maps extracted coverage names to canonical terms using fuzzy matching
 */

import fs from 'fs';
import path from 'path';

export interface ThesaurusEntry {
  canonicalName: string;
  variants: string[];
  category: string;
  type?: 'main' | 'sub-limit' | 'rider' | 'gastos' | 'extension';
  parentCoverage?: string;
}

export interface MappingResult {
  canonicalName: string;
  confidence: number;
  matchedVariant: string;
  needsReview: boolean;
  type?: 'main' | 'sub-limit' | 'rider' | 'gastos' | 'extension';
  parentCoverage?: string;
}

// In-memory cache
let thesaurusCache: ThesaurusEntry[] | null = null;

/**
 * Load thesaurus from file
 * Parses the markdown thesaurus file into structured format
 */
/**
 * Find thesaurus files by checking multiple possible paths
 */
function findThesaurusPaths(): { main: string | null; extensions: string | null } {
  const possiblePaths = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '..', '..'),
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..'),
  ];

  let mainPath: string | null = null;
  let extensionsPath: string | null = null;

  for (const basePath of possiblePaths) {
    if (!mainPath) {
      const candidate = path.join(basePath, 'tesauro(pyme).md');
      if (fs.existsSync(candidate)) {
        mainPath = candidate;
      }
    }
    if (!extensionsPath) {
      const candidate = path.join(basePath, 'tesauro-extensiones.md');
      if (fs.existsSync(candidate)) {
        extensionsPath = candidate;
      }
    }
    if (mainPath && extensionsPath) break;
  }

  return { main: mainPath, extensions: extensionsPath };
}

export function loadThesaurus(): ThesaurusEntry[] {
  if (thesaurusCache) return thesaurusCache;

  const paths = findThesaurusPaths();
  let entries: ThesaurusEntry[] = [];

  // Load main thesaurus
  if (!paths.main) {
    console.warn('Thesaurus file not found, using built-in thesaurus');
    entries = getBuiltInThesaurus();
  } else {
    try {
      const content = fs.readFileSync(paths.main, 'utf-8');
      entries = parseThesaurusMarkdown(content);
      console.log(`📚 [Thesaurus] Loaded ${entries.length} entries from ${paths.main}`);
    } catch (error) {
      console.warn('Failed to load thesaurus, using built-in:', error);
      entries = getBuiltInThesaurus();
    }
  }

  // Load extensions if available
  if (paths.extensions) {
    try {
      const extContent = fs.readFileSync(paths.extensions, 'utf-8');
      const extEntries = parseExtensionMarkdown(extContent);
      entries = [...entries, ...extEntries];
      console.log(`📚 [Thesaurus] Loaded ${extEntries.length} extension entries from ${paths.extensions}`);
    } catch (error) {
      console.warn('Failed to load thesaurus extensions:', error);
    }
  }

  thesaurusCache = entries;
  return thesaurusCache;
}

/**
 * Parse thesaurus markdown content
 */
function parseThesaurusMarkdown(content: string): ThesaurusEntry[] {
  const entries: ThesaurusEntry[] = [];
  const lines = content.split('\n');
  let currentCategory = '';

  for (const line of lines) {
    // Detect category headers
    const categoryMatch = line.match(/##\s*\d+\.\s*(.+)/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // Parse table rows with coverage mappings
    const tableMatch = line.match(/\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/);
    if (tableMatch) {
      const canonicalName = tableMatch[1].trim();
      const variantsText = tableMatch[2].trim();
      
      // Split variants by comma
      const variants = variantsText
        .split(/[,，]/)
        .map(v => v.trim())
        .filter(v => v.length > 0 && v !== '...');

      entries.push({
        canonicalName,
        variants,
        category: currentCategory,
      });
    }
  }

  return entries;
}

/**
 * Parse extension thesaurus markdown content
 * Handles the companion file with sub-limits and riders
 */
function parseExtensionMarkdown(content: string): ThesaurusEntry[] {
  const entries: ThesaurusEntry[] = [];
  const lines = content.split('\n');
  let currentCategory = '';
  let defaultType: ThesaurusEntry['type'] = 'sub-limit';

  for (const line of lines) {
    // Detect category headers (## 1. Sub-límites de Incendio...)
    const categoryMatch = line.match(/##\s*\d+\.\s*(.+)/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      // Set default type based on category name
      if (currentCategory.toLowerCase().includes('rider')) {
        defaultType = 'rider';
      } else if (currentCategory.toLowerCase().includes('gasto')) {
        defaultType = 'gastos';
      } else {
        defaultType = 'sub-limit';
      }
      continue;
    }

    // Skip header rows and separator rows
    if (line.includes('|---|') || line.includes('Concepto Padre') || line.includes('Sub-límite / Amparo') || line.includes('Tipo')) {
      continue;
    }

    // Parse table rows with 4 columns (Format: | Parent | Type | Name | Variants |)
    const tableMatch4 = line.match(/^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    if (tableMatch4) {
      const parent = tableMatch4[1].trim();
      const typeStr = tableMatch4[2].trim().toLowerCase();
      const name = tableMatch4[3].trim();
      const variantsText = tableMatch4[4].trim();
      
      const type = (typeStr.includes('rider') ? 'rider' : 
                   typeStr.includes('sub') ? 'sub-limit' : 
                   typeStr.includes('gasto') ? 'gastos' : 
                   typeStr.includes('extens') ? 'extension' : defaultType) as ThesaurusEntry['type'];
      
      const variants = variantsText
        .split(/[,，]/)
        .map(v => v.trim())
        .filter(v => v.length > 0 && v !== '...');

      entries.push({
        canonicalName: name,
        variants,
        category: currentCategory,
        type,
        parentCoverage: parent,
      });
      continue;
    }

    // Parse table rows with 3 columns (Format: | **Parent** | Name | Variants |)
    const tableMatch3 = line.match(/^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    if (tableMatch3) {
      const parent = tableMatch3[1].trim();
      const name = tableMatch3[2].trim();
      const variantsText = tableMatch3[3].trim();
      
      const variants = variantsText
        .split(/[,，]/)
        .map(v => v.trim())
        .filter(v => v.length > 0 && v !== '...');

      entries.push({
        canonicalName: name,
        variants,
        category: currentCategory,
        type: defaultType,
        parentCoverage: parent,
      });
    }
  }

  return entries;
}

/**
 * Built-in thesaurus for PYME coverages
 * Used when file is not available
 */
function getBuiltInThesaurus(): ThesaurusEntry[] {
  return [
    {
      canonicalName: "Incendio (Edificio y Contenidos)",
      variants: [
        "Amparo Básico (Incendio)",
        "Incendio y Rayo",
        "Amparos Aliados",
        "Actos de la Naturaleza",
        "Daños Materiales Básicos",
        "Incendio",
        "Fuego",
        "Combustión",
        "Rayo",
        "Explosión",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Terremoto y Eventos Catastróficos",
      variants: [
        "Eventos Catastróficos",
        "Amparo de TTEV",
        "Terremoto",
        "Eventos de la Naturaleza (Catastróficos)",
        "Temblor",
        "Erupción",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Sustracción / Hurto",
      variants: [
        "Sustracción",
        "Amparo de Hurto",
        "Hurto Calificado y Atraco",
        "Robo con Violencia",
        "Sustracción de Contenidos",
        "Hurto",
        "Robo",
        "Atraco",
        "Asalto",
        "AMIT",
        "All Risk",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Huelga, Motín, Asonada (HMACC)",
      variants: [
        "AMIT",
        "Terrorismo",
        "Huelga, Motín, Asonada (HMA)",
        "Vandalismo",
        "Daños por Huelga",
        "Actos Malintencionados",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Lucro Cesante",
      variants: [
        "Pérdida de Beneficios",
        "Interrupción de Negocios",
        "Business Interruption (BI)",
        "Pérdida de Utilidad Bruta",
        "Gastos Fijos y Utilidad Neta",
        "Pérdida de Renta",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Equipo Eléctrico y Electrónico",
      variants: [
        "Daño Interno de Equipos",
        "Amparo de Equipo Electrónico",
        "EE Fijos y Móviles",
        "Corto Circuito y Sobretensión",
        "Equipo Electrónico",
        "Computadores",
        "Servidores",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Rotura de Maquinaria",
      variants: [
        "Daño Interno de Maquinaria",
        "RM",
        "Daño Súbito e Imprevisto (Maquinaria)",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Transporte de Mercancías",
      variants: [
        "Transporte de Valores",
        "Transporte Propia Mercancía",
        "Amparo de Transporte",
        "Daños a la Mercancía en Tránsito",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Manejo Global / Infidelidad",
      variants: [
        "Infidelidad de Empleados",
        "Deshonestidad",
        "Póliza de Manejo",
        "Fraude de Empleados",
        "Apropiación Indebida",
      ],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Responsabilidad Civil (RCE)",
      variants: [
        "RCE Predios, Labores y Operaciones",
        "Daños a Terceros (RCE)",
        "Amparo Básico de RC",
        "RC General",
        "RC Básica",
        "Responsabilidad Civil Extracontractual",
      ],
      category: "Responsabilidad Civil",
    },
    {
      canonicalName: "Vidrios Planos",
      variants: ["Vidrios", "Cristales", "Placas de Vidrio"],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Asistencia PYME",
      variants: ["Asistencia", "Servicios de Asistencia"],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Asistencia Legal",
      variants: ["Asesoría Legal", "Defensa Legal"],
      category: "Patrimoniales",
    },
    {
      canonicalName: "Transporte de Valores",
      variants: ["Valores en Tránsito", "Transporte de Dinero"],
      category: "Patrimoniales",
    },
  ];
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[str1.length][str2.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();

  // Exact match
  if (normalized1 === normalized2) return 1.0;

  // Contains match
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const ratio = Math.min(normalized1.length, normalized2.length) / Math.max(normalized1.length, normalized2.length);
    return 0.7 + (ratio * 0.2); // 0.7-0.9 based on length ratio
  }

  // Levenshtein distance
  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - (distance / maxLength);
}

/**
 * Map extracted coverage name to canonical term
 */
export function mapCoverageName(
  extractedName: string,
  threshold: number = 0.7
): MappingResult {
  const thesaurus = loadThesaurus();
  let bestMatch: { entry: ThesaurusEntry; variant: string; score: number } | null = null;

  for (const entry of thesaurus) {
    // Check canonical name
    const canonicalScore = calculateSimilarity(extractedName, entry.canonicalName);
    if (canonicalScore > (bestMatch?.score || 0)) {
      bestMatch = { entry, variant: entry.canonicalName, score: canonicalScore };
    }

    // Check all variants
    for (const variant of entry.variants) {
      const variantScore = calculateSimilarity(extractedName, variant);
      if (variantScore > (bestMatch?.score || 0)) {
        bestMatch = { entry, variant, score: variantScore };
      }
    }
  }

  if (!bestMatch) {
    return {
      canonicalName: extractedName,
      confidence: 0,
      matchedVariant: '',
      needsReview: true,
    };
  }

  // Use type-specific threshold: 0.6 for sub-limits/riders, 0.7 for main
  const entryType = bestMatch.entry.type || 'main';
  const effectiveThreshold = entryType === 'main' ? threshold : 0.6;

  return {
    canonicalName: bestMatch.entry.canonicalName,
    confidence: bestMatch.score,
    matchedVariant: bestMatch.variant,
    needsReview: bestMatch.score < effectiveThreshold,
    type: entryType,
    parentCoverage: bestMatch.entry.parentCoverage,
  };
}

/**
 * Normalize deductible format
 */
export function normalizeDeductible(deductible: string): {
  normalized: string;
  context?: string;
  needsReview: boolean;
} {
  const trimmed = deductible.trim();

  // Handle empty
  if (!trimmed || trimmed === '') {
    return { normalized: 'No aplica', needsReview: false };
  }

  // Handle "No aplica" variants
  if (/^no\s*aplica/i.test(trimmed)) {
    return { normalized: 'No aplica', needsReview: false };
  }

  // Handle "Sin deducible" or "No tiene deducible"
  if (/^(sin\s+deducible|no\s*tiene\s*deducible)/i.test(trimmed)) {
    return { normalized: 'Sin deducible', needsReview: false };
  }

  // Handle "No aplica Deducible" → extract "No aplica"
  const noAplicaMatch = trimmed.match(/^(no\s*aplica)\s*(?:deducible)?/i);
  if (noAplicaMatch) {
    return { normalized: 'No aplica', needsReview: false };
  }

  // Handle "APLICA" or "SI APLICA" → means there IS a deductible
  if (/^(?:si\s+)?aplica/i.test(trimmed)) {
    return { normalized: 'Aplica', needsReview: false };
  }

  // Handle "INCLUIDA" or "INCLUIDO" → included in coverage, no separate deductible
  if (/^incluid[oa]/i.test(trimmed)) {
    return { normalized: 'Incluido', needsReview: false };
  }

  // Handle percentage with context: "10% / Mín. 2 SMMLV (aplica sobre pérdida)"
  // Also handles: "10 % PERD Min 1 (SMMLV)", "5% PERD Min 2 SMMLV Max 50 SMMLV"
  // Handle decimal percentages: "12,5%" or "12.5%"
  const percentWithContext = trimmed.match(/([\d.,]+\s*%)\s*(.*)/);
  if (percentWithContext) {
    const context = percentWithContext[2].trim();
    // Include context in normalized string for frontend severity parsing
    const normalizedWithContext = context 
      ? `${percentWithContext[1].replace(/\s+/g, '')} ${context}` 
      : percentWithContext[1].replace(/\s+/g, '');
    return {
      normalized: normalizedWithContext,
      context: context || undefined,
      needsReview: false,
    };
  }

  // Handle SMMLV: "5 SMMLV" or "5 SM"
  const smmlvMatch = trimmed.match(/(\d+)\s*(?:SMMLV|SM)/i);
  if (smmlvMatch) {
    return { normalized: `${smmlvMatch[1]} SMMLV`, needsReview: false };
  }

  // Handle fixed amount: "$500,000" or "$500000" (must have $ or be at least 5 digits)
  const fixedMatch = trimmed.match(/(?:\$\s*)(\d{1,3}(?:[,\.]\d{3})*|\d{5,})/);
  if (fixedMatch) {
    const cleanNumber = fixedMatch[1].replace(/[,\.]/g, '');
    return { normalized: `$${cleanNumber}`, needsReview: false };
  }

  // Unknown format
  return { normalized: trimmed, needsReview: true };
}

/**
 * Normalize all coverages in a quote using thesaurus
 */
export function normalizeCoverages(coverages: Array<{ name: string; value: string; deductible: string }>): {
  normalized: Array<{
    name: string;
    value: string;
    deductible: string;
    originalName: string;
    confidence: number;
    type?: 'main' | 'sub-limit' | 'rider' | 'gastos' | 'extension';
    parentCoverage?: string;
  }>;
  needsReview: boolean;
} {
  const normalized = coverages.map(coverage => {
    const mapping = mapCoverageName(coverage.name);
    const deductibleNorm = normalizeDeductible(coverage.deductible);

    return {
      name: mapping.canonicalName,
      value: coverage.value,
      deductible: deductibleNorm.normalized,
      originalName: coverage.name,
      confidence: mapping.confidence,
      type: mapping.type,
      parentCoverage: mapping.parentCoverage,
    };
  });

  // Use type-specific threshold for review: 0.6 for sub-limits, 0.7 for main
  const needsReview = normalized.some(c => {
    const threshold = c.type === 'main' ? 0.7 : 0.6;
    return c.confidence < threshold;
  });

  return { normalized, needsReview };
}
