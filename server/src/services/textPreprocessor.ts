/**
 * Text Pre-processing Module
 * Cleans and normalizes extracted PDF text before AI processing
 */

export interface PreprocessingResult {
  text: string;
  metadata: {
    originalLength: number;
    cleanedLength: number;
    pageCount: number;
    complexity: 'simple' | 'medium' | 'complex';
    changes: string[];
  };
}

export interface PreprocessingOptions {
  normalizeNumbers?: boolean;
  removeArtifacts?: boolean;
  fixEncoding?: boolean;
  extractSections?: boolean;
  maxPagesForSimple?: number;
}

const DEFAULT_OPTIONS: PreprocessingOptions = {
  normalizeNumbers: true,
  removeArtifacts: true,
  fixEncoding: true,
  extractSections: true,
  maxPagesForSimple: 10,
};

/**
 * Calculate content density (characters per page)
 */
export function calculateContentDensity(text: string, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return text.length / pageCount;
}

/**
 * Detect document complexity based on page count and content density
 * Dense documents (>2500 chars/page) need special handling
 */
export function detectComplexity(text: string, pageCount: number): 'simple' | 'medium' | 'complex' {
  if (pageCount <= 5) return 'simple';
  if (pageCount <= 10) return 'medium';
  
  // For documents >10 pages, check density
  const density = calculateContentDensity(text, pageCount);
  if (density > 2500) return 'complex';
  return 'medium'; // Sparse large documents treated as medium
}

/**
 * Fix common encoding issues from PDF extraction
 * Handles: UTF-8 artifacts, mixed encodings, special chars
 */
export function fixEncoding(text: string): string {
  const replacements: [RegExp, string][] = [
    [/CotizaciÃ³n/g, 'Cotización'],
    [/cotizaciÃ³n/g, 'cotización'],
    [/Aseguradora/g, 'Aseguradora'],
    [/PÃ³liza/g, 'Póliza'],
    [/pÃ³liza/g, 'póliza'],
    [/Cobertura/g, 'Cobertura'],
    [/cobertura/g, 'cobertura'],
    [/Deducible/g, 'Deducible'],
    [/deducible/g, 'deducible'],
    [/TÃ©rminos/g, 'Términos'],
    [/tÃ©rminos/g, 'términos'],
    [/CondiciÃ³n/g, 'Condición'],
    [/condiciÃ³n/g, 'condición'],
    [/Vigencia/g, 'Vigencia'],
    [/vigencia/g, 'vigencia'],
    [/Prima/g, 'Prima'],
    [/prima/g, 'prima'],
    [/Anual/g, 'Anual'],
    [/anual/g, 'anual'],
    [/Mensual/g, 'Mensual'],
    [/mensual/g, 'mensual'],
    [/Siniestro/g, 'Siniestro'],
    [/siniestro/g, 'siniestro'],
    [/Responsabilidad/g, 'Responsabilidad'],
    [/responsabilidad/g, 'responsabilidad'],
    [/Extracontractual/g, 'Extracontractual'],
    [/extracontractual/g, 'extracontractual'],
    [/Incendio/g, 'Incendio'],
    [/incendio/g, 'incendio'],
    [/Terremoto/g, 'Terremoto'],
    [/terremoto/g, 'terremoto'],
    [/CatastrÃ³fico/g, 'Catastrófico'],
    [/catastrÃ³fico/g, 'catastrófico'],
    [/MercancÃ­a/g, 'Mercancía'],
    [/mercancÃ­a/g, 'mercancía'],
    [/ElectrÃ³nico/g, 'Electrónico'],
    [/electrÃ³nico/g, 'electrónico'],
    [/ElÃ©ctrico/g, 'Eléctrico'],
    [/elÃ©ctrico/g, 'eléctrico'],
    [/MÃ¡quina/g, 'Máquina'],
    [/mÃ¡quina/g, 'máquina'],
    [/GarantÃ­a/g, 'Garantía'],
    [/garantÃ­a/g, 'garantía'],
    [/PÃ©rdida/g, 'Pérdida'],
    [/pÃ©rdida/g, 'pérdida'],
    [/Beneficio/g, 'Beneficio'],
    [/beneficio/g, 'beneficio'],
    [/InterrupciÃ³n/g, 'Interrupción'],
    [/interrupciÃ³n/g, 'interrupción'],
    [/Utilidad/g, 'Utilidad'],
    [/utilidad/g, 'utilidad'],
    [/SustracciÃ³n/g, 'Sustracción'],
    [/sustracciÃ³n/g, 'sustracción'],
    [/Hurto/g, 'Hurto'],
    [/hurto/g, 'hurto'],
    [/Robo/g, 'Robo'],
    [/robo/g, 'robo'],
    [/Transporte/g, 'Transporte'],
    [/transporte/g, 'transporte'],
    [/Valores/g, 'Valores'],
    [/valores/g, 'valores'],
    [/Vidrio/g, 'Vidrio'],
    [/vidrio/g, 'vidrio'],
    [/Plano/g, 'Plano'],
    [/plano/g, 'plano'],
    [/Asistencia/g, 'Asistencia'],
    [/asistencia/g, 'asistencia'],
    [/Legal/g, 'Legal'],
    [/legal/g, 'legal'],
    [/Huelga/g, 'Huelga'],
    [/huelga/g, 'huelga'],
    [/MotÃ­n/g, 'Motín'],
    [/motÃ­n/g, 'motín'],
    [/Asonada/g, 'Asonada'],
    [/asonada/g, 'asonada'],
    [/Vandalismo/g, 'Vandalismo'],
    [/vandalismo/g, 'vandalismo'],
    [/Terrorismo/g, 'Terrorismo'],
    [/terrorismo/g, 'terrorismo'],
    [/Deshonestidad/g, 'Deshonestidad'],
    [/deshonestidad/g, 'deshonestidad'],
    [/Infidelidad/g, 'Infidelidad'],
    [/infidelidad/g, 'infidelidad'],
    [/Fraude/g, 'Fraude'],
    [/fraude/g, 'fraude'],
    [/ApropiaciÃ³n/g, 'Apropiación'],
    [/apropiaciÃ³n/g, 'apropiación'],
    [/Indebida/g, 'Indebida'],
    [/indebida/g, 'indebida'],
    [/Fianza/g, 'Fianza'],
    [/fianza/g, 'fianza'],
    [/Cumplimiento/g, 'Cumplimiento'],
    [/cumplimiento/g, 'cumplimiento'],
    [/Anticipo/g, 'Anticipo'],
    [/anticipo/g, 'anticipo'],
    [/InversiÃ³n/g, 'Inversión'],
    [/inversiÃ³n/g, 'inversión'],
    [/Correcta/g, 'Correcta'],
    [/correcta/g, 'correcta'],
    [/Calidad/g, 'Calidad'],
    [/calidad/g, 'calidad'],
    [/Servicio/g, 'Servicio'],
    [/servicio/g, 'servicio'],
    [/Salario/g, 'Salario'],
    [/salario/g, 'salario'],
    [/PrestaciÃ³n/g, 'Prestación'],
    [/prestaciÃ³n/g, 'prestación'],
    [/Social/g, 'Social'],
    [/social/g, 'social'],
    [/Personal/g, 'Personal'],
    [/personal/g, 'personal'],
    [/Ciberseguridad/g, 'Ciberseguridad'],
    [/ciberseguridad/g, 'ciberseguridad'],
    [/ExtorsiÃ³n/g, 'Extorsión'],
    [/extorsiÃ³n/g, 'extorsión'],
    [/CibernÃ©tico/g, 'Cibernético'],
    [/cibernÃ©tico/g, 'cibernético'],
    [/Ransomware/g, 'Ransomware'],
    [/ransomware/g, 'ransomware'],
    [/Forense/g, 'Forense'],
    [/forense/g, 'forense'],
    [/Digital/g, 'Digital'],
    [/digital/g, 'digital'],
    [/NotificaciÃ³n/g, 'Notificación'],
    [/notificaciÃ³n/g, 'notificación'],
    [/RemediaciÃ³n/g, 'Remediación'],
    [/remediaciÃ³n/g, 'remediación'],
    [/ViolaciÃ³n/g, 'Violación'],
    [/violaciÃ³n/g, 'violación'],
    [/Privacidad/g, 'Privacidad'],
    [/privacidad/g, 'privacidad'],
    [/Patrimonial/g, 'Patrimonial'],
    [/patrimonial/g, 'patrimonial'],
    [/LÃ­nea/g, 'Línea'],
    [/lÃ­nea/g, 'línea'],
    [/Aliada/g, 'Aliada'],
    [/aliada/g, 'aliada'],
    [/Acto/g, 'Acto'],
    [/acto/g, 'acto'],
    [/Malintencionado/g, 'Malintencionado'],
    [/malintencionado/g, 'malintencionado'],
    [/Tercero/g, 'Tercero'],
    [/tercero/g, 'tercero'],
    [/Equipo/g, 'Equipo'],
    [/equipo/g, 'equipo'],
    [/Fijo/g, 'Fijo'],
    [/fijo/g, 'fijo'],
    [/MÃ³vil/g, 'Móvil'],
    [/mÃ³vil/g, 'móvil'],
    [/Corto/g, 'Corto'],
    [/corto/g, 'corto'],
    [/Circuito/g, 'Circuito'],
    [/circuito/g, 'circuito'],
    [/SobretensiÃ³n/g, 'Sobretensión'],
    [/sobretensiÃ³n/g, 'sobretensión'],
    [/DaÃ±o/g, 'Daño'],
    [/daÃ±o/g, 'daño'],
    [/Interno/g, 'Interno'],
    [/interno/g, 'interno'],
    [/SÃºbito/g, 'Súbito'],
    [/sÃºbito/g, 'súbito'],
    [/Imprevisto/g, 'Imprevisto'],
    [/imprevisto/g, 'imprevisto'],
    [/Propia/g, 'Propia'],
    [/propia/g, 'propia'],
    [/TrÃ¡nsito/g, 'Tránsito'],
    [/trÃ¡nsito/g, 'tránsito'],
    [/Contratista/g, 'Contratista'],
    [/contratista/g, 'contratista'],
    [/Subcontratista/g, 'Subcontratista'],
    [/subcontratista/g, 'subcontratista'],
    [/Cruzada/g, 'Cruzada'],
    [/cruzada/g, 'cruzada'],
    [/Patronal/g, 'Patronal'],
    [/patronal/g, 'patronal'],
    [/Culpa/g, 'Culpa'],
    [/culpa/g, 'culpa'],
    [/Riesgo/g, 'Riesgo'],
    [/riesgo/g, 'riesgo'],
    [/Laboral/g, 'Laboral'],
    [/laboral/g, 'laboral'],
    [/Accidente/g, 'Accidente'],
    [/accidente/g, 'accidente'],
    [/Trabajo/g, 'Trabajo'],
    [/trabajo/g, 'trabajo'],
    [/Parqueadero/g, 'Parqueadero'],
    [/parqueadero/g, 'parqueadero'],
    [/VehÃ­culo/g, 'Vehículo'],
    [/vehÃ­culo/g, 'vehículo'],
    [/PosesiÃ³n/g, 'Posesión'],
    [/posesiÃ³n/g, 'posesión'],
    [/Producto/g, 'Producto'],
    [/producto/g, 'producto'],
    [/Servicio/g, 'Servicio'],
    [/servicio/g, 'servicio'],
    [/Defectuoso/g, 'Defectuoso'],
    [/defectuoso/g, 'defectuoso'],
    [/Calidad/g, 'Calidad'],
    [/calidad/g, 'calidad'],
    [/Director/g, 'Director'],
    [/director/g, 'director'],
    [/Administrador/g, 'Administrador'],
    [/administrador/g, 'administrador'],
    [/OmisiÃ³n/g, 'Omisión'],
    [/omisiÃ³n/g, 'omisión'],
    [/Negligencia/g, 'Negligencia'],
    [/negligencia/g, 'negligencia'],
    [/Profesional/g, 'Profesional'],
    [/profesional/g, 'profesional'],
  ];

  let fixed = text;
  for (const [pattern, replacement] of replacements) {
    fixed = fixed.replace(pattern, replacement);
  }
  return fixed;
}

/**
 * Normalize Colombian numeric formats to standard format
 * Colombian: 1.234.567,89 → Standard: 1234567.89
 * Colombian: $ 8.500.000 → Standard: 8500000
 */
export function normalizeColombianNumbers(text: string): string {
  // Pattern: digits with dots as thousand separators and comma as decimal
  // e.g., 1.234.567,89 or 8.500.000
  return text.replace(
    /(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?/g,
    (match, integerPart, decimalPart) => {
      // Remove thousand separators (dots)
      const cleanInteger = integerPart.replace(/\./g, '');
      // If there's a decimal part, use dot as decimal separator
      return decimalPart ? `${cleanInteger}.${decimalPart}` : cleanInteger;
    }
  );
}

/**
 * Remove common PDF extraction artifacts
 */
export function removeArtifacts(text: string): string {
  let cleaned = text;

  // Remove standalone page numbers
  cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');

  // Remove common headers/footers patterns
  cleaned = cleaned.replace(/^(CotizaciÃ³n|Cotizacion|Page|Pagina|PÃ¡gina)\s*\d+.*$/gmi, '');

  // Remove lines that are just repeated dashes or equal signs
  cleaned = cleaned.replace(/^[\-=]{3,}$/gm, '');

  // Remove empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Extract relevant sections from long documents
 * Focus on coverage tables and premium information
 * Uses 12000 char limit for dense documents
 */
export function extractRelevantSections(text: string): string {
  const extractedSections: string[] = [];
  
  // Look for coverage-related sections
  const coveragePatterns = [
    /(?:COBERTURAS?|AMPAROS?|GARANTIAS?|SECCION(?:ES)?)[\s\S]*?(?:(?:DEDUCIBLES?|CONDICIONES|CLÃ\u0081USULAS|NOTAS?|ANEXOS?)[\s\S]*?)?(?=\n\s*\n|\Z)/i,
    /(?:DESGLOSE|DETALLE|ESPECIFICACIONES|DESCRIPCIÃ\u0093N)[\s\S]*?(?:(?:PRIMA|VALOR|TOTAL|SUMA ASEGURADA)[\s\S]*?)?(?=\n\s*\n|\Z)/i,
  ];

  for (const pattern of coveragePatterns) {
    const match = text.match(pattern);
    if (match && match[0].length > 500) {
      extractedSections.push(match[0]);
    }
  }

  // Look for premium-related sections
  const premiumPatterns = [
    /(?:PRIMA|TOTAL\s+A\s+PAGAR|VALOR\s+TOTAL|PRIMO|TARIFA)[\s\S]{0,1000}(?:\d[\d.,]+\s*(?:COP|USD|\$)?)[\s\S]{0,500}/i,
    /(?:TOTAL|VALOR)[\s\S]{0,200}(?:PRIMA|NETA|ANUAL)[\s\S]{0,500}(?:\d[\d.,]+)/i,
  ];

  for (const pattern of premiumPatterns) {
    const match = text.match(pattern);
    if (match && match[0].length > 50) {
      extractedSections.push(match[0]);
    }
  }

  // Combine all extracted sections
  if (extractedSections.length > 0) {
    const combined = extractedSections.join('\n\n---SECCION---\n\n');
    
    // Check minimum extraction size
    if (combined.length >= 2000) {
      return combined.length > 12000 
        ? combined.substring(0, 12000) + '\n[... contenido truncado ...]' 
        : combined;
    }
  }

  // Fallback: if sections too small, use first 12000 chars + premium search
  let fallback = text.length > 12000 
    ? text.substring(0, 12000) + '\n[... contenido truncado ...]' 
    : text;
  
  // Search for premium keywords in full text and append if found
  const premiumKeywords = ['prima', 'total a pagar', 'valor total', 'prima neta'];
  const premiumMatches: string[] = [];
  
  for (const keyword of premiumKeywords) {
    const regex = new RegExp(`(?:${keyword})[\\s\\S]{0,300}`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      premiumMatches.push(...matches.slice(0, 2)); // Max 2 matches per keyword
    }
  }
  
  if (premiumMatches.length > 0) {
    fallback += '\n\n---PREMIUM INFO---\n\n' + premiumMatches.join('\n');
  }

  return fallback;
}

/**
 * Main pre-processing function
 */
export function preprocessText(
  text: string,
  pageCount: number,
  options: PreprocessingOptions = {}
): PreprocessingResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const changes: string[] = [];
  let processed = text;

  // Detect complexity
  const complexity = detectComplexity(text, pageCount);

  // Fix encoding
  if (opts.fixEncoding) {
    const before = processed;
    processed = fixEncoding(processed);
    if (processed !== before) {
      changes.push('Fixed encoding issues');
    }
  }

  // Normalize numbers
  if (opts.normalizeNumbers) {
    const before = processed;
    processed = normalizeColombianNumbers(processed);
    if (processed !== before) {
      changes.push('Normalized Colombian number formats');
    }
  }

  // Remove artifacts
  if (opts.removeArtifacts) {
    const before = processed;
    processed = removeArtifacts(processed);
    if (processed !== before) {
      changes.push('Removed PDF extraction artifacts');
    }
  }

  // Extract relevant sections for complex documents
  if (opts.extractSections && complexity === 'complex') {
    const before = processed;
    processed = extractRelevantSections(processed);
    if (processed !== before) {
      changes.push('Extracted relevant sections for complex document');
    }
  }

  return {
    text: processed,
    metadata: {
      originalLength: text.length,
      cleanedLength: processed.length,
      pageCount,
      complexity,
      changes,
    },
  };
}

/**
 * Detect if text contains Colombian numeric format
 */
export function containsColombianFormat(text: string): boolean {
  return /\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/.test(text);
}

/**
 * Estimate if number format is Colombian vs international
 * Colombian: 1.234.567,89 (dots for thousands, comma for decimal)
 * International: 1,234,567.89 (commas for thousands, dot for decimal)
 */
export function detectNumberFormat(text: string): 'colombian' | 'international' | 'ambiguous' {
  const colombianPattern = /\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/g;
  const internationalPattern = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?/g;

  const colombianMatches = text.match(colombianPattern)?.length || 0;
  const internationalMatches = text.match(internationalPattern)?.length || 0;

  if (colombianMatches > internationalMatches) return 'colombian';
  if (internationalMatches > colombianMatches) return 'international';
  return 'ambiguous';
}
