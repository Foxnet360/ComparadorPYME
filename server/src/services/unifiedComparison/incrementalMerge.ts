/**
 * Incremental Quote Merge Helper
 * Merges newly extracted quotes, positional MatrixRow.cells, quoteMetadata,
 * and deductibleComparison into an existing ComparisonResult so users can
 * add late-arriving insurer quotes without re-uploading earlier quotes.
 */

import type { ComparisonResult, ComparisonResultQuote } from '../../controllers/analysisController';
import type { MatrixCell, MatrixRow } from '../../types';

function normalizeRowKey(row: MatrixRow): string {
  const raw = String(row.canonicalId || row.canonicalName || row.label || row.id || '')
    .trim()
    .toLowerCase();
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveUniqueInsurerName(candidate: string, existingNames: Set<string>): string {
  if (!existingNames.has(candidate)) {
    return candidate;
  }
  let suffix = 2;
  while (existingNames.has(`${candidate} (Opción ${suffix})`)) {
    suffix++;
  }
  return `${candidate} (Opción ${suffix})`;
}

function emptyMatrixCell(value = 'No cotizada'): MatrixCell {
  return {
    value,
    isExcluded: true,
    isWinner: false,
  };
}

function padCells(cells: MatrixCell[], targetCount: number, fallbackValue = 'No cotizada'): MatrixCell[] {
  if (cells.length >= targetCount) return cells.slice(0, targetCount);
  const padded = [...cells];
  while (padded.length < targetCount) {
    padded.push(emptyMatrixCell(fallbackValue));
  }
  return padded;
}

export function mergeComparisonResults(
  existing: ComparisonResult & Record<string, unknown>,
  incoming: ComparisonResult & Record<string, unknown>
): ComparisonResult & Record<string, unknown> {
  const existingQuotes = Array.isArray(existing.quotes) ? [...existing.quotes] : [];
  const incomingQuotes = Array.isArray(incoming.quotes) ? incoming.quotes : [];
  const existingCount = existingQuotes.length;
  const incomingCount = incomingQuotes.length;

  const existingNames = new Set(existingQuotes.map((q) => q.insurerName));
  const renamedMap = new Map<string, string>();

  const mergedNewQuotes: ComparisonResultQuote[] = incomingQuotes.map((q) => {
    const uniqueName = resolveUniqueInsurerName(q.insurerName, existingNames);
    existingNames.add(uniqueName);
    if (uniqueName !== q.insurerName) {
      renamedMap.set(q.insurerName, uniqueName);
    }
    return {
      ...q,
      insurerName: uniqueName,
    };
  });

  const allQuotes = [...existingQuotes, ...mergedNewQuotes];

  // Merge positional MatrixRow[] (used by UnifiedCoverageMatrix and DeductibleMatrix)
  const existingMatrix: MatrixRow[] = Array.isArray(existing.matrix)
    ? existing.matrix.map((r) => ({ ...r, cells: Array.isArray(r.cells) ? [...r.cells] : [] }))
    : [];
  const incomingMatrix: MatrixRow[] = Array.isArray(incoming.matrix) ? incoming.matrix : [];

  if (incomingMatrix.length > 0 && incomingCount > 0) {
    const incomingDataByKey = new Map<string, MatrixRow>();
    const incomingHeaders: MatrixRow[] = [];

    for (const row of incomingMatrix) {
      if (row.type === 'header') {
        incomingHeaders.push(row);
      } else if (row.type === 'data') {
        const key = normalizeRowKey(row);
        if (key && !incomingDataByKey.has(key)) {
          incomingDataByKey.set(key, row);
        }
      }
    }

    const matchedIncomingKeys = new Set<string>();
    let headerIdx = 0;

    for (let i = 0; i < existingMatrix.length; i++) {
      const row = existingMatrix[i]!;
      if (row.type === 'header') {
        const inHeader = incomingHeaders[headerIdx] || incomingHeaders[0];
        headerIdx++;
        const inCells = inHeader
          ? padCells(inHeader.cells, incomingCount, mergedNewQuotes[0]?.insurerName || 'Aseguradora')
          : mergedNewQuotes.map((q) => ({
              value: q.insurerName,
              isExcluded: false,
              isWinner: false,
            }));
        existingMatrix[i] = {
          ...row,
          cells: [...padCells(row.cells, existingCount, 'Aseguradora'), ...inCells],
        };
      } else if (row.type === 'data') {
        const key = normalizeRowKey(row);
        const matched = key ? incomingDataByKey.get(key) : undefined;
        if (matched && key) {
          matchedIncomingKeys.add(key);
        }
        const inCells = matched
          ? padCells(matched.cells, incomingCount)
          : Array.from({ length: incomingCount }, () => emptyMatrixCell());
        existingMatrix[i] = {
          ...row,
          cells: [...padCells(row.cells, existingCount), ...inCells],
        };
      }
    }

    // Append new data rows introduced only by the late quote(s)
    for (const inRow of incomingMatrix) {
      if (inRow.type !== 'data') continue;
      const key = normalizeRowKey(inRow);
      if (key && matchedIncomingKeys.has(key)) continue;
      if (key) matchedIncomingKeys.add(key);

      const leadingEmpty = Array.from({ length: existingCount }, () => emptyMatrixCell());
      const trailingIncoming = padCells(inRow.cells, incomingCount);
      existingMatrix.push({
        ...inRow,
        cells: [...leadingEmpty, ...trailingIncoming],
      });
    }
  }

  // Merge quoteMetadata (parallel to quotes[])
  const existingMetaArr = Array.isArray(existing.quoteMetadata) ? existing.quoteMetadata : [];
  const incomingMetaArr = Array.isArray(incoming.quoteMetadata) ? incoming.quoteMetadata : [];
  const mergedQuoteMetadata = [...existingMetaArr, ...incomingMetaArr];

  // Merge deductibleComparison (parallel to quotes[])
  const existingDedComp = Array.isArray(existing.deductibleComparison)
    ? existing.deductibleComparison
    : [];
  const incomingDedComp = Array.isArray(incoming.deductibleComparison)
    ? incoming.deductibleComparison
    : [];
  const mergedDeductibleComparison = [
    ...existingDedComp,
    ...incomingDedComp.map((dc) => ({
      ...dc,
      insurer: renamedMap.get(dc.insurer) || dc.insurer,
    })),
  ];

  // Recompute best quote / recommendation
  const bestQuote = allQuotes.reduce<ComparisonResultQuote | null>((best, curr) => {
    if (!best) return curr;
    return (curr.score || 0) > (best.score || 0) ? curr : best;
  }, null);

  const recommendation = bestQuote
    ? `Opción recomendada actualizada (${allQuotes.length} aseguradoras): ${bestQuote.insurerName} (${bestQuote.score ?? 0}/100 pts).`
    : existing.recommendation;

  const existingMeta = (existing.metadata as Record<string, unknown> | undefined) || {};

  return {
    ...existing,
    quotes: allQuotes,
    ...(existingMatrix.length > 0 ? { matrix: existingMatrix } : {}),
    ...(mergedQuoteMetadata.length > 0 ? { quoteMetadata: mergedQuoteMetadata } : {}),
    deductibleComparison: mergedDeductibleComparison,
    recommendation,
    metadata: {
      ...existingMeta,
      quoteCount: allQuotes.length,
      lastQuoteAddedAt: new Date().toISOString(),
    },
  };
}
