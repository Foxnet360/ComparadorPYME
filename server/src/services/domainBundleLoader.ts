import fs from 'fs';
import path from 'path';
import { assertBundleManifest, BundleManifest } from '../schemas/domainBundleSchema';

/**
 * Resuelve la ruta de un archivo dentro del bundle de un dominio.
 * Busca en múltiples candidatos para soportar ejecución desde distintas rutas
 * (desarrollo con ts-node, tests, build en dist, etc.).
 */
export function resolveDomainBundlePath(domain: string, filename: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'data', 'domains', domain, filename),
    path.resolve(process.cwd(), '..', 'data', 'domains', domain, filename),
    path.resolve(__dirname, '..', '..', '..', 'data', 'domains', domain, filename),
    path.resolve(__dirname, '..', '..', '..', '..', 'data', 'domains', domain, filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Retorna true si el dominio solicitado contiene explícitamente el archivo especificado
 * (sin aplicar fallback a pyme).
 */
export function hasDomainSpecificFile(domain: string, filename: string): boolean {
  return resolveDomainBundlePath(domain, filename) !== null;
}

/**
 * Carga y parsea un archivo JSON del bundle de un dominio.
 * Si el archivo no existe para el dominio solicitado, hace fallback al dominio "pyme".
 * Si tampoco existe para "pyme", lanza un error claro.
 */
export function loadDomainJson<T>(domain: string, filename: string): T {
  const bundlePath = resolveDomainBundlePath(domain, filename);

  if (bundlePath) {
    try {
      const raw = fs.readFileSync(bundlePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (error) {
      throw new Error(`Failed to parse domain bundle ${filename} for domain "${domain}": ${error}`);
    }
  }

  if (domain !== 'pyme') {
    console.warn(
      `[DomainBundle] Missing ${filename} for domain "${domain}", falling back to "pyme"`
    );
    return loadDomainJson<T>('pyme', filename);
  }

  throw new Error(`Domain bundle file not found: ${filename} for domain "${domain}"`);
}

/**
 * Carga y valida el manifesto unificado de un bundle de dominio.
 * Reutiliza loadDomainJson con fallback al dominio "pyme".
 */
export function loadDomainBundleManifest(domain: string): BundleManifest {
  const raw = loadDomainJson<unknown>(domain, 'bundle.json');
  return assertBundleManifest(raw);
}
