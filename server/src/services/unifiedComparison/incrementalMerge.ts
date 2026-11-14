/**
 * Incremental Quote Merge Helper
 * Merges newly extracted quotes into an existing ComparisonResult so users can
 * add late-arriving insurer quotes without re-uploading earlier quotes.
 */

import type { ComparisonResult, ComparisonResultQuote } from '../../controllers/analysisController';

interface MatrixEntry {
  categoryId?: number | string | null;
  categoryName?: string;
  canonicalName?: string;
  insurerValues?: Record<string, unknown>;
  coverages?: Record<string, unknown>;
  [key: string]: unknown;
}

function normalizeRowKey(row: MatrixEntry): string {
  const raw = String(row.canonicalName || row.categoryName || '').trim().toLowerCase();
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveUniqueInsurerName(
  candidate: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(candidate)) {
    return candidate;
  }
  let suffix = 2;
  while (existingNames.has(`${candidate} (Opción ${suffix})`)) {
    suffix++;
  }
  return `${candidate} (Opción ${suffix})`;
}

export function mergeComparisonResults(
  existing: ComparisonResult & Record<string, unknown>,
  incoming: ComparisonResult & Record<string, unknown>
): ComparisonResult & Record<string, unknown> {
  const existingQuotes = Array.isArray(existing.quotes) ? [...existing.quotes] : [];
  const incomingQuotes = Array.isArray(incoming.quotes) ? incoming.quotes : [];

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

  // Merge matrix rows if present
  const existingMatrix = Array.isArray((existing as { matrix?: MatrixEntry[] }).matrix)
    ? ([...(existing as { matrix: MatrixEntry[] }).matrix] as MatrixEntry[])
    : [];
  const incomingMatrix = Array.isArray((incoming as { matrix?: MatrixEntry[] }).matrix)
    ? ((incoming as { matrix: MatrixEntry[] }).matrix as MatrixEntry[])
    : [];

  if (incomingMatrix.length > 0) {
    const rowIndexByKey = new Map<string, number>();
    existingMatrix.forEach((row, idx) => {
      const key = normalizeRowKey(row);
      if (key) rowIndexByKey.set(key, idx);
    });

    for (const inRow of incomingMatrix) {
      const key = normalizeRowKey(inRow);
      const targetIdx = key ? rowIndexByKey.get(key) : undefined;

      const remapRecord = (rec?: Record<string, unknown>) => {
        if (!rec) return {};
        const out: Record<string, unknown> = {};
        for (const [ins, val] of Object.entries(rec)) {
          out[renamedMap.get(ins) || ins] = val;
        }
        return out;
      };

      const mappedCoverages = remapRecord(inRow.coverages);
      const mappedInsurerValues = remapRecord(inRow.insurerValues);

      if (targetIdx !== undefined) {
        const target = existingMatrix[targetIdx]!;
        existingMatrix[targetIdx] = {
          ...target,
          ...(target.coverages || Object.keys(mappedCoverages).length > 0
            ? { coverages: { ...(target.coverages || {}), ...mappedCoverages } }
            : {}),
          ...(target.insurerValues || Object.keys(mappedInsurerValues).length > 0
            ? { insurerValues: { ...(target.insurerValues || {}), ...mappedInsurerValues } }
            : {}),
        };
      } else {
        const newRow: MatrixEntry = {
          ...inRow,
          ...(inRow.coverages ? { coverages: mappedCoverages } : {}),
          ...(inRow.insurerValues ? { insurerValues: mappedInsurerValues } : {}),
        };
        rowIndexByKey.set(key, existingMatrix.length);
        existingMatrix.push(newRow);
      }
    }
  }

  // Recompute best quote / recommendation
  const bestQuote = allQuotes.reduce<ComparisonResultQuote | null>((best, curr) => {
    if (!best) return curr;
    return (curr.score || 0) > (best.score || 0) ? curr : best;
  }, null);

  const recommendation = bestQuote
    ? `Opción recomendada actualizada (${allQuotes.length} aseguradoras): ${bestQuote.insurerName} (${bestQuote.score ?? 0}/100 pts).`
    : existing.recommendation;

  const existingMeta =
    (existing.metadata as Record<string, unknown> | undefined) || {};

  return {
    ...existing,
    quotes: allQuotes,
    ...(existingMatrix.length > 0 ? { matrix: existingMatrix } : {}),
    recommendation,
    metadata: {
      ...existingMeta,
      quoteCount: allQuotes.length,
      lastQuoteAddedAt: new Date().toISOString(),
    },
  };
}
