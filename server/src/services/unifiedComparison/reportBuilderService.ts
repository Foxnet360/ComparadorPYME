import { ParsedQuote } from '../quoteParser';
import { quoteScorer } from '../quoteScorer';
import { checkClauseDocumentExists } from '../clauseCoverageValidator';
import {
  FINANCIAL_SECTION_ID,
  DEDUCTIBLE_SECTION_ID,
  isFinancialRowLabel,
  alignMatrixRowsToQuotes,
  extractMatrixInsurers,
  alignInsurerIndices,
} from './matrixTransformer';
import {
  extractCanonicalInsurerName,
  isKnownCanonicalInsurer,
} from './insurerSanitizer';
import { semanticMatcher } from '../semanticMatcher';
import { formatCOP } from '../../utils/formatCurrency';
import { parseColombianCurrency } from '../../utils/currencyParser';
import quoteBasedAuditor from '../quoteBasedAuditor';

import { MatrixRow, QuoteAnalysis, QuoteMetadata } from '../../types';
import { InsuranceDomain } from '../../types/domain';
import { buildRegulatoryBackingPayload } from '../regulatoryAuditService';
import type { RegulatoryCheckResult } from '../../types';
import { AnalysisType } from './comparisonSchema';

export interface UnifiedQuote {
  insurerName: string;
  policyName: string;
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  deductibles: string;
  coverages: Array<{
    name: string;
    value: string;
    deductible: string;
    isPositive: boolean;
    valueSource: 'extracted';
    confidence?: number;
    section?: string;
    categoryId?: number | string | null;
    canonicalName?: string;
    matchConfidence?: number;
    matchMethod?: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
  }>;
  alerts: Array<{
    level: string;
    title: string;
    description: string;
  }>;
  scoringBreakdown: Record<string, number>;
  clientAnalysis: string;
  technicalAnalysis: string;
  score: number;
  extractionConfidence: number;
  needsReview: boolean;
  isCritical: boolean;
  validationFlags: unknown[];
  validationSummary: string;
}

export interface UnifiedComparisonReport {
  quotes: UnifiedQuote[];
  recommendation: string;
  marketAnalysis: string;
  deductibleComparison: { insurer: string; deductibleText: string }[];
  timestamp: string;
  analysisVersion: string;
  id?: string;
  matrix?: MatrixRow[];
  quoteMetadata?: QuoteMetadata[];
  schemaVersion?: 1 | 2 | 3;
  analysisType?: AnalysisType;
  policyId?: string;
  renewalId?: string;
  domain?: string;
  regulatoryBacking?: {
    domain: string;
    displayName: string;
    tagline: string;
    primaryLaws: Array<{ code: string; title: string; summary: string }>;
    thesaurusHighlights: string[];
    advisoryIntroForClient?: string;
    perQuoteCompliance?: Record<string, RegulatoryCheckResult[]>;
  };
}

/**
 * Convert MatrixRow[] from unified engine to ComparisonReport format
 */
export async function matrixRowsToComparisonReport(
  matrixRows: MatrixRow[],
  quoteFiles: Express.Multer.File[],
  options?: { graphEnabled?: boolean; templateHintsEnabled?: boolean; domain?: InsuranceDomain }
): Promise<UnifiedComparisonReport> {
  const domain = options?.domain ?? 'pyme';
  const rawFileInsurers = quoteFiles.map((f) => extractCanonicalInsurerName(f.originalname));

  const matrixInsurers = extractMatrixInsurers(matrixRows);
  const indexMap =
    matrixInsurers.length > 0
      ? alignInsurerIndices(rawFileInsurers, matrixInsurers)
      : rawFileInsurers.map((_, idx) => idx);

  const insurerNames = rawFileInsurers.map((fileInsurer, idx) => {
    const cellIdx = indexMap[idx] ?? -1;
    const matrixInsurer = cellIdx >= 0 ? matrixInsurers[cellIdx] : undefined;
    if (!isKnownCanonicalInsurer(fileInsurer) && matrixInsurer) {
      const canonicalFromMatrix = extractCanonicalInsurerName(matrixInsurer);
      if (canonicalFromMatrix && canonicalFromMatrix !== 'Desconocido') {
        return canonicalFromMatrix;
      }
    }
    return fileInsurer;
  });

  const matchCoverageCache = new Map<
    string,
    ReturnType<typeof semanticMatcher.matchCoverage>
  >();

  if (typeof semanticMatcher.matchCoveragesBatch === 'function') {
    const graphEnabled = options?.graphEnabled ?? false;
    const uniqueLabelsToMatch = Array.from(
      new Set(
        matrixRows
          .filter(
            (row) =>
              row.type === 'data' &&
              row.sectionId !== FINANCIAL_SECTION_ID &&
              !row.id?.startsWith('warning_')
          )
          .map((row) =>
            graphEnabled && row.canonicalName ? row.canonicalName : row.label || 'Cobertura'
          )
      )
    );

    if (uniqueLabelsToMatch.length > 0) {
      const batchResults = await semanticMatcher.matchCoveragesBatch(uniqueLabelsToMatch, domain);
      if (batchResults instanceof Map) {
        for (const [label, matchResult] of batchResults.entries()) {
          if (matchResult) {
            matchCoverageCache.set(`${domain}:${label}`, Promise.resolve(matchResult));
          }
        }
      }
    }
  }

  const getCachedCoverageMatch = (coverageLabel: string) => {
    const cacheKey = `${domain}:${coverageLabel}`;
    let pending = matchCoverageCache.get(cacheKey);
    if (!pending) {
      pending = semanticMatcher.matchCoverage(coverageLabel, domain);
      matchCoverageCache.set(cacheKey, pending);
    }
    return pending;
  };

  const intermediateQuotes = await Promise.all(
    insurerNames.map(async (insurerName, idx) => {
      const coverages: UnifiedQuote['coverages'] = [];
      const alerts: UnifiedQuote['alerts'] = [];
      let priceAnnual = 0;
      const cellIdx = indexMap[idx] ?? -1;
      const cellConfidences: number[] = [];

      let currentSection: string | undefined;
      const rowsToProcess: Array<{
        label: string;
        value: string;
        deductible: string;
        isExcluded: boolean;
        confidence?: number;
        section?: string;
      }> = [];

      matrixRows.forEach((row) => {
        if (row.type === 'header') {
          currentSection = row.label;
        } else if (row.type === 'data' && row.cells && cellIdx >= 0 && row.cells[cellIdx]) {
          if (row.sectionId === FINANCIAL_SECTION_ID) {
            return;
          }

          const cell = row.cells[cellIdx];
          const value = cell.value || '';

          if (typeof cell.confidence === 'number') {
            cellConfidences.push(cell.confidence);
          }

          if (row.id?.startsWith('warning_')) {
            if (value && value !== 'No informado') {
              alerts.push({
                level: 'WARNING',
                title: 'Alerta del Motor Unificado',
                description: value,
              });
            }
            return;
          }

          // If the row belongs to DEDUCIBLES section, cell.value is the deductible text itself
          const isDeductibleRow =
            row.sectionId === DEDUCTIBLE_SECTION_ID ||
            (currentSection && currentSection.toUpperCase().includes('DEDUCIBLE')) ||
            (row.label && row.label.toUpperCase().includes('DEDUCIBLE'));

          const deductibleVal = isDeductibleRow
            ? (cell.notes || (cell.value && cell.value !== 'No informado' ? cell.value : undefined)) || 'No especificado'
            : cell.notes || 'No especificado';

          rowsToProcess.push({
            label: row.label || 'Cobertura',
            value: value === 'No informado' || value === 'N.C.' ? 'No incluido' : value,
            deductible: deductibleVal,
            isExcluded: cell.isExcluded,
            confidence: cell.confidence,
            section: currentSection,
          });
        }
      });

      for (const r of rowsToProcess) {
        const row = matrixRows.find(
          (matrixRow) => matrixRow.label === r.label && matrixRow.type === 'data'
        );
        const graphEnabled = options?.graphEnabled ?? false;
        let graphMapping:
          | {
              canonicalName: string;
              matchConfidence: number;
              matchMethod: string | null;
            }
          | undefined =
          graphEnabled && row?.canonicalName
            ? {
                canonicalName: row.canonicalName,
                matchConfidence: row.matchConfidence ?? 0,
                matchMethod: row.matchMethod ?? 'graph',
              }
            : undefined;

        let categoryId: number | string | null = null;
        if (graphMapping) {
          const categoryMatch = await getCachedCoverageMatch(graphMapping.canonicalName);
          categoryId = categoryMatch?.categoryId ?? null;
        } else {
          const matchResult = await getCachedCoverageMatch(r.label);
          categoryId = matchResult?.categoryId ?? null;
          graphMapping ??= {
            canonicalName: matchResult?.canonicalName ?? r.label,
            matchConfidence: matchResult?.confidence ?? 0,
            matchMethod: (matchResult?.method || null) as
              | 'thesaurus'
              | 'fuzzy'
              | 'embedding'
              | 'llm'
              | null,
          };
        }

        const isUnmapped = categoryId === null;
        if (isUnmapped) {
          const normalizedLabel = r.label
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const billingKeywords = [
            'prima',
            'forma de pago',
            'bienes asegurados',
            'vigencia',
            'tomador',
            'asegurado',
            'poliza',
            'cotizacion',
            'gastos de expedicion',
            'iva',
            'tasa',
            'comision',
            'pago',
            'expedicion',
            'cuotas',
            'total a pagar',
          ];
          const shouldIgnore = billingKeywords.some((kw) => normalizedLabel.includes(kw));
          if (shouldIgnore) {
            continue;
          }
        }

        coverages.push({
          name: r.label,
          value: r.value,
          deductible: r.deductible,
          isPositive: !r.isExcluded,
          valueSource: 'extracted' as const,
          confidence: r.confidence,
          section: r.section,
          categoryId,
          canonicalName: graphMapping.canonicalName,
          matchConfidence: graphMapping.matchConfidence,
          matchMethod: graphMapping.matchMethod as
            | 'thesaurus'
            | 'fuzzy'
            | 'embedding'
            | 'llm'
            | null,
        });
      }

      const realConfidences = coverages.map((c) => {
        const extractionCertainty =
          typeof c.confidence === 'number'
            ? c.confidence > 1
              ? c.confidence / 100
              : c.confidence
            : 0.88;

        const matchConf = typeof c.matchConfidence === 'number' ? c.matchConfidence : 0.85;
        let methodMultiplier = 0.9;
        if (c.matchMethod === 'thesaurus' || (c.matchMethod as string) === 'graph') {
          methodMultiplier = 1.0;
        } else if (c.matchMethod === 'fuzzy') {
          methodMultiplier = 0.95;
        } else if (c.matchMethod === 'embedding') {
          methodMultiplier = 0.9;
        } else if (c.matchMethod === 'llm') {
          methodMultiplier = 0.85;
        }

        const semanticScore = matchConf * methodMultiplier;

        const hasValidValue =
          c.value !== undefined &&
          c.value !== null &&
          String(c.value).trim().length > 0 &&
          !['No informado', 'N.C.', 'NO ESPECIFICADO', 'No incluido'].includes(String(c.value).trim());
        const hasValidDeductible =
          c.deductible &&
          c.deductible.trim().length > 0 &&
          !['No especificado', 'NO ESPECIFICADO', 'N/A'].includes(c.deductible.trim());

        const evidenceScore = (hasValidValue ? 0.75 : 0.5) + (hasValidDeductible ? 0.25 : 0.0);

        const weightedScore =
          extractionCertainty * 0.45 + semanticScore * 0.4 + evidenceScore * 0.15;
        return Math.round(Math.min(99, Math.max(65, weightedScore * 100)));
      });

      const validQuotedConfidences = realConfidences.filter((_, idx) => {
        const val = String(coverages[idx]?.value || '').trim();
        return !['No informado', 'N.C.', 'NO ESPECIFICADO', 'No incluido'].includes(val);
      });

      const avgCellConfidence =
        validQuotedConfidences.length > 0
          ? Math.round(
              validQuotedConfidences.reduce((sum, val) => sum + val, 0) /
                validQuotedConfidences.length
            )
          : realConfidences.length > 0
            ? Math.round(realConfidences.reduce((sum, val) => sum + val, 0) / realConfidences.length)
            : 88;

      coverages.forEach((c, idx) => {
        if (typeof c.confidence !== 'number') {
          const confScore = realConfidences[idx] ?? avgCellConfidence;
          c.confidence = confScore > 1 ? confScore / 100 : confScore;
        }
      });

      matrixRows.forEach((row) => {
        if (row.type === 'data' && row.cells && cellIdx >= 0 && row.cells[cellIdx]) {
          const matchingCoverageIdx = coverages.findIndex((cov) => cov.name === row.label);
          if (matchingCoverageIdx >= 0) {
            const conf = realConfidences[matchingCoverageIdx]!;
            row.cells[cellIdx]!.confidence = conf > 1 ? conf / 100 : conf;
          }
        }
      });

      // Cross-populate deductibles from deductible rows if coverage deductible is not specified
      coverages.forEach((cov) => {
        if (!cov.deductible || cov.deductible === 'No especificado') {
          const normCovName = (cov.canonicalName || cov.name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

          // Find a deductible row matching coverage concepts
          const matchingDedRow = matrixRows.find((mr) => {
            if (mr.type !== 'data' || !mr.cells || cellIdx < 0 || !mr.cells[cellIdx]) return false;
            if (mr.sectionId !== DEDUCTIBLE_SECTION_ID && !mr.label.toLowerCase().includes('deducible')) {
              return false;
            }
            const normDedLabel = mr.label
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            const keyTokens = normCovName.split(/\s+/).filter((t) => t.length > 3);
            return keyTokens.some((tok) => normDedLabel.includes(tok));
          });

          if (matchingDedRow && matchingDedRow.cells[cellIdx]?.value) {
            const val = matchingDedRow.cells[cellIdx]!.value;
            if (val && val !== 'No informado' && val !== 'No especificado') {
              cov.deductible = val;
            }
          }
        }
      });

      const defaultPolicyName =
        domain === 'pyme'
          ? 'Cotización PYME'
          : `Cotización ${domain.charAt(0).toUpperCase() + domain.slice(1).replace('_', ' ')}`;

      const parsedQuote: ParsedQuote = {
        insurerName,
        policyName: defaultPolicyName,
        priceAnnual,
        currency: 'COP',
        coverages: coverages.map((c, idx) => ({
          name: c.name,
          canonicalName: c.canonicalName || c.name,
          value: c.value,
          deductible: c.deductible,
          confidence: realConfidences[idx] ?? avgCellConfidence,
          categoryId: typeof c.categoryId === 'number' ? c.categoryId : null,
          matchConfidence: c.matchConfidence,
          matchMethod: c.matchMethod,
          valueSource: 'extracted' as const,
        })),
        specialConditions: alerts.map((a) => a.description),
        rawText: '',
        parseConfidence: avgCellConfidence,
      };

      return {
        insurerName,
        policyName: defaultPolicyName,
        priceAnnual,
        priceMonthly: Math.round(priceAnnual / 12),
        currency: 'COP',
        deductibles: coverages.map((c) => c.deductible).join('; '),
        coverages,
        alerts,
        avgCellConfidence,
        parsedQuote,
      };
    })
  );

  const allParsedQuotes = intermediateQuotes.map((iq) => iq.parsedQuote);

  const isHighPriorityPremiumLabel = (label: string): boolean => {
    const norm = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      norm.includes('suma asegurada') ||
      norm.includes('valor asegurable') ||
      norm.includes('limite') ||
      norm.includes('deducible')
    ) {
      return false;
    }

    const highPriorityKeywords = [
      'total a pagar',
      'valor a pagar',
      'total liquidacion',
      'total liquidación',
      'total poliza',
      'total póliza',
      'prima con iva',
      'total prima',
      'prima total',
      'prima total anual',
      'prima minima',
      'prima mínima',
      'prima minima anual',
      'prima mínima anual',
      'costo total de la poliza',
      'costo total poliza',
      'total anual',
      'total propuesta',
      'valor de la poliza',
    ];

    const hasHighPriority = highPriorityKeywords.some((kw) => norm.includes(kw));
    if (hasHighPriority) return true;

    // Disqualify non-financial coverage rows that mention physical assets without an explicit total
    if (
      norm.includes('asegurad') ||
      norm.includes('asegurable') ||
      norm.includes('edificio') ||
      norm.includes('contenido') ||
      norm.includes('bienes') ||
      norm.includes('mercancia')
    ) {
      return false;
    }

    return false;
  };

  const isFallbackPremiumLabel = (label: string): boolean => {
    const norm = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (
      norm.includes('iva') ||
      norm.includes('gasto') ||
      norm.includes('expedicion') ||
      norm.includes('forma de pago') ||
      norm.includes('suma asegurada') ||
      norm.includes('valor asegurable') ||
      norm.includes('limite') ||
      norm.includes('deducible')
    ) {
      return false;
    }

    // Explicit net premium keywords (including Copropiedades e.g. "Prima Neta Bienes Comunes")
    if (
      norm.includes('prima neta') ||
      norm.includes('prima basica') ||
      norm.includes('prima básica') ||
      norm.includes('prima anual')
    ) {
      return true;
    }

    if (
      norm.includes('asegurad') ||
      norm.includes('asegurable') ||
      norm.includes('edificio') ||
      norm.includes('contenido') ||
      norm.includes('bienes')
    ) {
      return false;
    }
    return norm.includes('prima') || norm === 'total' || norm === 'total anual';
  };

  const hasDefinitivePremium = new Array(insurerNames.length).fill(false);

  for (const row of matrixRows) {
    if (row.type !== 'data') continue;
    if (row.sectionId !== FINANCIAL_SECTION_ID && !isFinancialRowLabel(row.label)) continue;
    if (!isHighPriorityPremiumLabel(row.label)) continue;

    for (let i = 0; i < insurerNames.length; i++) {
      const cellIdx = indexMap[i] ?? -1;
      const cell = row.cells[cellIdx];
      if (!cell) continue;

      const numericValue = parseColombianCurrency(cell.value);
      if (numericValue !== null && numericValue > 0) {
        if (domain === 'hogar' && numericValue > 100_000_000) {
          continue;
        }
        intermediateQuotes[i]!.priceAnnual = numericValue;
        intermediateQuotes[i]!.parsedQuote.priceAnnual = numericValue;
        intermediateQuotes[i]!.priceMonthly = Math.round(numericValue / 12);
        hasDefinitivePremium[i] = true;
      }
    }
  }

  for (const row of matrixRows) {
    if (row.type !== 'data') continue;
    if (row.sectionId !== FINANCIAL_SECTION_ID && !isFinancialRowLabel(row.label)) continue;
    if (!isFallbackPremiumLabel(row.label)) continue;

    for (let i = 0; i < insurerNames.length; i++) {
      if (hasDefinitivePremium[i]) continue;
      const cellIdx = indexMap[i] ?? -1;
      const cell = row.cells[cellIdx];
      if (!cell) continue;

      const numericValue = parseColombianCurrency(cell.value);
      if (numericValue !== null && numericValue > 0) {
        if (domain === 'hogar' && numericValue > 100_000_000) {
          continue;
        }
        intermediateQuotes[i]!.priceAnnual = numericValue;
        intermediateQuotes[i]!.parsedQuote.priceAnnual = numericValue;
        intermediateQuotes[i]!.priceMonthly = Math.round(numericValue / 12);
        hasDefinitivePremium[i] = true;
      }
    }
  }

  // 3rd pass: if an insurer still has no premium, inspect any financial row
  for (let i = 0; i < insurerNames.length; i++) {
    if (hasDefinitivePremium[i]) continue;
    for (const row of matrixRows) {
      if (row.type !== 'data' || row.sectionId !== FINANCIAL_SECTION_ID) continue;
      const cellIdx = indexMap[i] ?? -1;
      const cell = row.cells[cellIdx];
      if (!cell || !cell.value) continue;
      const numericValue = parseColombianCurrency(cell.value);
      if (numericValue !== null && numericValue > 0) {
        if (domain === 'hogar' && numericValue > 100_000_000) continue;
        intermediateQuotes[i]!.priceAnnual = numericValue;
        intermediateQuotes[i]!.parsedQuote.priceAnnual = numericValue;
        intermediateQuotes[i]!.priceMonthly = Math.round(numericValue / 12);
        hasDefinitivePremium[i] = true;
        break;
      }
    }
  }

  const quotes: UnifiedQuote[] = await Promise.all(
    intermediateQuotes.map(async (iq) => {
      const scoringResult = await quoteScorer.calculateScore(
        iq.parsedQuote,
        [],
        allParsedQuotes,
        undefined,
        undefined,
        domain
      );

      const audit = quoteBasedAuditor.auditQuote(
        {
          insurerName: iq.insurerName,
          policyName: iq.policyName,
          priceAnnual: iq.priceAnnual,
          currency: iq.currency,
          coverages: iq.coverages,
          alerts: [],
          scoringBreakdown: { ...scoringResult.breakdown },
          clientAnalysis: `Análisis generado por el Motor Unificado para ${iq.insurerName}`,
          technicalAnalysis: '',
          score: scoringResult.totalScore,
          deductibles: iq.deductibles,
          rawText: '',
        } as unknown as QuoteAnalysis,
        intermediateQuotes as unknown as QuoteAnalysis[],
        domain
      );

      const combinedAlerts = [...iq.alerts];
      if (audit.alerts) {
        audit.alerts.forEach((alert) => {
          const exists = combinedAlerts.some(
            (existing) => existing.description === alert.description
          );
          if (!exists) {
            combinedAlerts.push({
              level: alert.level,
              title: alert.title,
              description: alert.description,
            });
          }
        });
      }

      const hasClauseDocument = await checkClauseDocumentExists(iq.insurerName);

      return {
        insurerName: iq.insurerName,
        policyName: iq.policyName,
        priceMonthly: iq.priceMonthly,
        priceAnnual: iq.priceAnnual,
        currency: iq.currency,
        deductibles: iq.deductibles,
        coverages: iq.coverages,
        alerts: combinedAlerts,
        scoringBreakdown: scoringResult.breakdown as unknown as Record<string, number>,
        clientAnalysis: audit.summary || `Análisis para ${iq.insurerName}`,
        technicalAnalysis: `Puntaje de cobertura: ${scoringResult.breakdown.coverage}/100. Deducibles: ${scoringResult.breakdown.deductibles}/100.`,
        score: scoringResult.totalScore,
        extractionConfidence: iq.avgCellConfidence,
        needsReview: iq.avgCellConfidence < 70,
        isCritical: iq.avgCellConfidence < 50,
        isRagAvailable: hasClauseDocument,
        validationFlags: [],
        validationSummary: `Confianza de extracción: ${iq.avgCellConfidence}%. ${iq.coverages.length} coberturas procesadas.`,
        crossReferenceSummary: {
          verified: hasClauseDocument ? 1 : 0,
          phantom: 0,
          unverified: 0,
          mandatoryMissing: 0,
          optionalMissing: 0,
          criticalAlerts: combinedAlerts.filter(
            (a) => a.level === 'CRITICAL' || a.level === 'critical'
          ).length,
          warnings: combinedAlerts.filter(
            (a) => a.level === 'WARNING' || a.level === 'warning'
          ).length,
        },
        clauseValidation: {
          hasClauseDocument,
          verifiedCount: 0,
          phantomCount: 0,
          mandatoryMissingCount: 0,
          optionalMissingCount: 0,
          scoreImpact: 0,
        },
        deductibleAnalysis: null,
        contextualRisk: null,
        warrantyCompliance: null,
        legalOpinion: null,
        quoteAudit: {
          deductibleRisks: audit.deductibleRisks,
          missingCoverages: audit.missingCoverages,
          specialConditions: audit.specialConditions,
          negotiationPoints: audit.negotiationPoints,
          competitiveAdvantages: audit.competitiveAdvantages,
          overallRiskScore: audit.overallRiskScore,
          summary: audit.summary,
        },
      };
    })
  );

  quotes.sort((a, b) => b.score - a.score);
  const bestQuote = quotes[0];

  const alignedMatrixRows = alignMatrixRowsToQuotes(matrixRows, quotes, domain);
  const regulatoryBacking = buildRegulatoryBackingPayload(quotes, domain);

  return {
    quotes,
    matrix: alignedMatrixRows,
    domain,
    regulatoryBacking,
    recommendation: bestQuote
      ? `Mejor opción: ${bestQuote.insurerName} con score de ${bestQuote.score}/100. Análisis generado por el Motor Unificado de Comparación.`
      : 'No se pudieron analizar las cotizaciones',
    marketAnalysis: `Se analizaron ${quotes.length} cotizaciones de seguros ${domain.toUpperCase()} usando el Motor Unificado. ${
      bestQuote ? `Prima anual: ${formatCOP(bestQuote.priceAnnual)} COP` : ''
    }`,
    deductibleComparison: quotes.map((q) => ({
      insurer: q.insurerName,
      deductibleText: q.deductibles || 'No especificado',
    })),
    timestamp: new Date().toISOString(),
    analysisVersion: '3.0-unified',
  };
}
