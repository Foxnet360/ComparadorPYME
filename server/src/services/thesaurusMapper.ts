/**
 * Thesaurus Mapper Module
 * Maps extracted coverage names to canonical terms using fuzzy matching
 */

import fs from 'fs';
import path from 'path';
import { levenshteinDistance, calculateSimilarity } from '../utils/stringUtils';
import { coverageGraphService } from './coverageGraphService';
import type { GraphEdge } from '../types/templateGraph';

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

// In-memory cache por dominio
const thesaurusCache = new Map<string, ThesaurusEntry[]>();

/**
 * Find thesaurus files by checking multiple possible paths
 * Supports per-domain markdown files (e.g. tesauro(pyme).md)
 */
function findThesaurusPaths(domain: string = 'pyme'): { main: string | null; extensions: string | null } {
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
      const candidate = path.join(basePath, `tesauro(${domain}).md`);
      if (fs.existsSync(candidate)) {
        mainPath = candidate;
      }
    }
    if (!extensionsPath) {
      const candidate = path.join(basePath, `tesauro-extensiones-${domain}.md`);
      if (fs.existsSync(candidate)) {
        extensionsPath = candidate;
      }
    }
    // Fallback genérico para extensiones si no hay archivo específico de dominio
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

export function loadThesaurus(domain: string = 'pyme'): ThesaurusEntry[] {
  if (thesaurusCache.has(domain)) return thesaurusCache.get(domain)!;

  const paths = findThesaurusPaths(domain);
  let entries: ThesaurusEntry[] = [];

  // Load main thesaurus
  if (!paths.main) {
    console.warn(`Thesaurus file not found for domain "${domain}", using built-in thesaurus`);
    entries = getBuiltInThesaurus(domain);
  } else {
    try {
      const content = fs.readFileSync(paths.main, 'utf-8');
      entries = parseThesaurusMarkdown(content);
      console.log(`📚 [Thesaurus] Loaded ${entries.length} entries from ${paths.main}`);
    } catch (error) {
      console.warn(`Failed to load thesaurus for domain "${domain}", using built-in:`, error);
      entries = getBuiltInThesaurus(domain);
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

  thesaurusCache.set(domain, entries);
  return entries;
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
function getBuiltInThesaurus(domain: string = 'pyme'): ThesaurusEntry[] {
  if (domain !== 'pyme') {
    console.warn(`[ThesaurusMapper] No built-in thesaurus for domain "${domain}", falling back to PYME`);
  }
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
    // Sub-límites comunes
    {
      canonicalName: "Remoción de Escombros",
      variants: ["Remoción de escombros", "Remocion de escombros", "Escombros"],
      category: "Sub-límites",
      type: 'sub-limit',
      parentCoverage: "Incendio (Edificio y Contenidos)",
    },
    {
      canonicalName: "Honorarios Profesionales",
      variants: ["Honorarios profesionales", "Gastos profesionales", "Honorarios"],
      category: "Sub-límites",
      type: 'sub-limit',
      parentCoverage: "Incendio (Edificio y Contenidos)",
    },
    {
      canonicalName: "Gastos de Extinción",
      variants: ["Gastos de extinción", "Extinción de siniestro", "Gastos para extinción"],
      category: "Sub-límites",
      type: 'sub-limit',
      parentCoverage: "Incendio (Edificio y Contenidos)",
    },
    {
      canonicalName: "Flete Aéreo",
      variants: ["Flete aéreo", "Flete expreso", "Transporte aéreo"],
      category: "Sub-límites",
      type: 'sub-limit',
      parentCoverage: "Incendio (Edificio y Contenidos)",
    },
    {
      canonicalName: "Preservación de Bienes",
      variants: ["Preservación de bienes", "Gastos para preservación"],
      category: "Sub-límites",
      type: 'sub-limit',
      parentCoverage: "Incendio (Edificio y Contenidos)",
    },
  ];
}
/**
 * Map extracted coverage name to canonical term
 */
export function mapCoverageName(
  extractedName: string,
  threshold: number = 0.7,
  domain?: string
): MappingResult {
  const thesaurus = loadThesaurus(domain ?? 'pyme');
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

import { hybridDeductibleParser } from './hybridDeductibleParser';
import {
  formatDeductibleForDisplay,
  extractDeductibleContext,
} from './deductibleFormatter';

/**
 * Normalize deductible format using the canonical structured parser.
 *
 * This function no longer contains deductible regexes; it delegates to
 * hybridDeductibleParser.parseSync and deductibleFormatter helpers.
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

  const structure = hybridDeductibleParser.parseSync(trimmed);
  const normalized = formatDeductibleForDisplay(structure);
  const context = extractDeductibleContext(structure.rawText);
  const needsReview = structure.components.some((c) => c.type === 'unknown');

  return { normalized, context, needsReview };
}

/**
 * Normalize all coverages in a quote using thesaurus
 */
export function normalizeCoverages(
  coverages: Array<{ name: string; value: string; deductible: string }>,
  domain?: string
): {
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
    const mapping = mapCoverageName(coverage.name, 0.7, domain);
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

/**
 * Seed coverage graph alias edges from a list of thesaurus entries.
 * Each variant becomes an `alias_of` edge pointing to the canonical coverage name.
 */
export async function seedGraphFromEntries(
  entries: ThesaurusEntry[],
  options: {
    domain?: string;
    insurer?: string;
    weight?: number;
    clearExisting?: boolean;
  } = {}
): Promise<void> {
  const { domain = 'pyme', insurer, weight = 0.85, clearExisting } = options;

  if (clearExisting) {
    const existing = await coverageGraphService.listEdges({
      type: 'alias_of',
      domain,
      insurer,
    });
    for (const edge of existing) {
      await coverageGraphService.deleteEdge(edge.from, edge.to, edge.type, insurer, domain);
    }
  }

  const edges: GraphEdge[] = [];
  for (const entry of entries) {
    for (const variant of entry.variants) {
      edges.push({
        from: variant,
        to: entry.canonicalName,
        type: 'alias_of',
        weight,
        insurer,
        domain,
      });
    }
  }

  if (edges.length > 0) {
    await coverageGraphService.addEdges(edges);
  }
}

/**
 * Load the thesaurus for a domain and seed the coverage graph with alias edges.
 */
export async function seedGraphFromThesaurus(
  domain: string = 'pyme',
  options: {
    insurer?: string;
    weight?: number;
    clearExisting?: boolean;
  } = {}
): Promise<void> {
  const entries = loadThesaurus(domain);
  await seedGraphFromEntries(entries, { ...options, domain });
}
