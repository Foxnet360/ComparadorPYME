export interface TrmSnapshot {
  value: number;
  validFrom: string;
  validTo: string;
  source: 'BANREP_DATOS_GOV' | 'FALLBACK';
  cachedAt: string;
}

const DATOS_GOV_TRM_URL =
  'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1';
const FALLBACK_TRM = 4200;

let cachedTrm: { dayKey: string; data: TrmSnapshot } | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetches the official daily COP/USD TRM published by Banco de la República (datos.gov.co),
 * caching the result per UTC calendar day and falling back safely if unreachable.
 */
export async function getOfficialTrm(): Promise<TrmSnapshot> {
  const day = todayKey();
  if (cachedTrm && cachedTrm.dayKey === day) {
    return cachedTrm.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(DATOS_GOV_TRM_URL, { signal: controller.signal });
    if (res.ok) {
      const rows = (await res.json()) as Array<{
        valor?: string;
        vigenciadesde?: string;
        vigenciahasta?: string;
      }>;
      const first = rows?.[0];
      const parsedVal = first?.valor ? parseFloat(first.valor) : NaN;
      if (Number.isFinite(parsedVal) && parsedVal > 0) {
        const snapshot: TrmSnapshot = {
          value: Math.round(parsedVal * 100) / 100,
          validFrom: (first?.vigenciadesde || day).slice(0, 10),
          validTo: (first?.vigenciahasta || day).slice(0, 10),
          source: 'BANREP_DATOS_GOV',
          cachedAt: new Date().toISOString(),
        };
        cachedTrm = { dayKey: day, data: snapshot };
        return snapshot;
      }
    }
  } catch (err) {
    console.warn('[TrmService] Failed to fetch official TRM from datos.gov.co:', err);
  } finally {
    clearTimeout(timeout);
  }

  return {
    value: FALLBACK_TRM,
    validFrom: day,
    validTo: day,
    source: 'FALLBACK',
    cachedAt: new Date().toISOString(),
  };
}

export function clearTrmCache(): void {
  cachedTrm = null;
}
