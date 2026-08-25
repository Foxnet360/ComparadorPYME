/**
 * Text Sanitizer & Mojibake Repair Utility.
 * Corrects double-encoded UTF-8 / ISO-8859-1 strings commonly found in PDF extractions
 * and production environment deployments.
 */

const MOJIBAKE_MAP: [RegExp, string][] = [
  [/Ã¡/g, 'á'],
  [/Ã©/g, 'é'],
  [/Ã\u00ad/g, 'í'],
  [/Ã­/g, 'í'],
  [/Ã³/g, 'ó'],
  [/Ãº/g, 'ú'],
  [/Ã±/g, 'ñ'],
  [/Ã‘/g, 'Ñ'],
  [/Ã\u0081/g, 'Á'],
  [/Ã\u0089/g, 'É'],
  [/Ã\u008d/g, 'Í'],
  [/Ã\u0093/g, 'Ó'],
  [/Ã\u009a/g, 'Ú'],
  [/Â°/g, '°'],
  [/Â/g, ''],
  [/â€“/g, '–'],
  [/â€”/g, '—'],
  [/â€œ/g, '“'],
  [/â€\u009d/g, '”'],
  [/&aacute;/gi, 'á'],
  [/&eacute;/gi, 'é'],
  [/&iacute;/gi, 'í'],
  [/&oacute;/gi, 'ó'],
  [/&uacute;/gi, 'ú'],
  [/&ntilde;/gi, 'ñ'],
  [/&Ntilde;/gi, 'Ñ'],
  [/&deg;/gi, '°'],
];

/**
 * Repair Mojibake and clean corrupt UTF-8 character sequences in a string.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';

  let sanitized = text;
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

/**
 * Deeply and recursively sanitize all string properties in a JSON object or array.
 */
export function sanitizeDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeText(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeDeep(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeDeep(value);
    }
    return result as unknown as T;
  }

  return obj;
}
