/**
 * Utilidades para optimizar el contexto enviado a Gemini
 * sin perder información crítica para el análisis de seguros
 */

interface ContextOptimizerOptions {
  maxQuotesLength?: number;      // Máximo chars para cotizaciones
  maxClausesLength?: number;     // Máximo chars para clausulados
  maxTotalLength?: number;       // Máximo total combinado
  preserveSections?: string[];   // Secciones a preservar
}

const DEFAULT_OPTIONS: ContextOptimizerOptions = {
  maxQuotesLength: 120000,       // ~30K tokens por cotizaciones
  maxClausesLength: 80000,       // ~20K tokens por clausulados
  maxTotalLength: 200000,        // ~50K tokens totales
  preserveSections: [
    'COBERTURA', 'DEDUCIBLE', 'EXCLUSION', 'GARANTIA', 'CONDICION',
    'COBERTURAS', 'DEDUCIBLES', 'EXCLUSIONES', 'GARANTÍAS', 'CONDICIONES',
    'SEGURO', 'PRIMA', 'VALOR ASEGURADO', 'LIMITE', 'SUB-LIMITE'
  ]
};

/**
 * Detecta si una línea contiene información estructural importante
 */
function isImportantLine(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  if (trimmed.length === 0) return false;
  
  // Es header de sección?
  const sectionPatterns = [
    /^(CAP[IÍ]TULO|SECCI[OÓ]N|ART[IÍ]CULO|CL[AÁ]USULA)\s+/i,
    /^(\d+\.|\d+\.\d+)\s+/,
    /^[A-Z][A-Z\s]{5,30}:?$/,
    /^(COBERTURA|DEDUCIBLE|EXCLUSI[OÓ]N|GARANT[IÍ]A|CONDICI[OÓ]N|PRIMA|VALOR|L[IÍ]MITE)/i
  ];
  
  return sectionPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Comprime texto eliminando redundancias pero preservando estructura
 */
function compressText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  const lines = text.split('\n');
  const importantLines: string[] = [];
  const otherLines: string[] = [];
  
  // Separar líneas importantes de relleno
  for (const line of lines) {
    if (isImportantLine(line)) {
      importantLines.push(line);
    } else if (line.trim().length > 0) {
      otherLines.push(line);
    }
  }
  
  // Calcular cuánto espacio queda para líneas no importantes
  const importantText = importantLines.join('\n');
  const remainingBudget = maxLength - importantText.length - 1000; // Buffer de seguridad
  
  if (remainingBudget <= 0) {
    // Solo caben las líneas importantes
    return importantText.substring(0, maxLength);
  }
  
  // Tomar líneas no importantes proporcionalmente
  const ratio = remainingBudget / otherLines.join('\n').length;
  const takeEvery = Math.max(1, Math.ceil(1 / ratio));
  
  const selectedOthers = otherLines.filter((_, index) => index % takeEvery === 0);
  
  // Intercalar líneas importantes con otras
  const result: string[] = [];
  let otherIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isImportantLine(line)) {
      result.push(line);
    } else if (line.trim().length > 0 && otherIndex < selectedOthers.length) {
      if (selectedOthers[otherIndex] === line) {
        result.push(line);
        otherIndex++;
      }
    }
  }
  
  let compressed = result.join('\n');
  
  // Si aún es muy largo, truncar manteniendo el inicio y final
  if (compressed.length > maxLength) {
    const halfBudget = Math.floor((maxLength - 500) / 2);
    compressed = compressed.substring(0, halfBudget) + 
      '\n\n[... CONTENIDO TRUNCADO - PRESERVANDO ESTRUCTURA CRÍTICA ...]\n\n' +
      compressed.substring(compressed.length - halfBudget);
  }
  
  return compressed;
}

/**
 * Optimiza el contexto completo para análisis de cotizaciones
 */
export function optimizeContextForAnalysis(
  quotesText: string,
  clausesText: string,
  options: ContextOptimizerOptions = {}
): { quotesText: string; clausesText: string; wasOptimized: boolean } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let optimizedQuotes = quotesText;
  let optimizedClauses = clausesText;
  let wasOptimized = false;
  
  const totalLength = quotesText.length + clausesText.length;
  
  // Si todo cabe, no optimizar
  if (totalLength <= opts.maxTotalLength!) {
    return { quotesText, clausesText, wasOptimized: false };
  }
  
  wasOptimized = true;
  
  // Estrategia 1: Comprimir clausulados primero (son menos críticos que cotizaciones)
  if (clausesText.length > opts.maxClausesLength!) {
    optimizedClauses = compressText(clausesText, opts.maxClausesLength!);
  }
  
  // Estrategia 2: Si aún es largo, comprimir cotizaciones
  const newTotal = optimizedQuotes.length + optimizedClauses.length;
  if (newTotal > opts.maxTotalLength!) {
    const availableForQuotes = opts.maxTotalLength! - optimizedClauses.length;
    optimizedQuotes = compressText(quotesText, availableForQuotes);
  }
  
  // Estrategia 3: Si aún es muy largo, truncar agresivamente clausulados
  const finalTotal = optimizedQuotes.length + optimizedClauses.length;
  if (finalTotal > opts.maxTotalLength!) {
    const maxClauses = Math.max(10000, opts.maxTotalLength! - optimizedQuotes.length);
    optimizedClauses = optimizedClauses.substring(0, maxClauses);
  }
  
  console.log(`📊 [ContextOptimizer] Optimización aplicada:`);
  console.log(`   Original: ${totalLength.toLocaleString()} chars`);
  console.log(`   Optimizado: ${(optimizedQuotes.length + optimizedClauses.length).toLocaleString()} chars`);
  console.log(`   Reducción: ${((1 - (optimizedQuotes.length + optimizedClauses.length) / totalLength) * 100).toFixed(1)}%`);
  
  return { quotesText: optimizedQuotes, clausesText: optimizedClauses, wasOptimized };
}

/**
 * Divide el análisis en lotes si hay demasiadas cotizaciones
 * pero mantiene al menos 3 cotizaciones por lote
 */
export function splitAnalysisBatches<T>(
  items: T[],
  maxPerBatch: number = 3
): T[][] {
  if (items.length <= maxPerBatch) return [items];
  
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerBatch) {
    batches.push(items.slice(i, i + maxPerBatch));
  }
  
  return batches;
}
