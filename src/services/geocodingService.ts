import { findGeoByCity } from '../data/colombiaGeo';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  source: 'address_precise' | 'municipality_fallback';
  displayName?: string;
  confidence?: number;
  message?: string;
}

export interface GeocodeParams {
  address: string;
  city?: string;
  department?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Normaliza y limpia una dirección colombiana para maximizar éxito en geocodificación
 */
export function normalizeColombianAddress(address: string): string {
  if (!address) return '';
  return address
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[#º°]/g, ' ')
    .replace(/\bcll\b/gi, 'Calle')
    .replace(/\bcra\b|\bkr\b/gi, 'Carrera')
    .replace(/\bdg\b/gi, 'Diagonal')
    .replace(/\btv\b/gi, 'Transversal')
    .replace(/\bav\b|\bav\.\b/gi, 'Avenida')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Geocodifica una dirección en Colombia utilizando OpenStreetMap Nominatim con
 * fallback garantizado al centroide del municipio oficial (DIVIPOLA/NSR-10).
 */
export async function geocodeClientAddress(params: GeocodeParams): Promise<GeocodeResult> {
  const { address, city, department, timeoutMs = 4000, signal } = params;

  // 1. Obtener coordenadas de referencia inicial del municipio
  const fallbackGeo = city ? findGeoByCity(city, department) : null;
  const defaultLat = fallbackGeo ? fallbackGeo.lat : 4.6097; // Bogotá D.C.
  const defaultLng = fallbackGeo ? fallbackGeo.lng : -74.0817;

  const cleanedAddress = address ? address.trim() : '';
  if (!cleanedAddress || cleanedAddress.length < 5) {
    return {
      latitude: defaultLat,
      longitude: defaultLng,
      source: 'municipality_fallback',
      message: city ? `Coordenadas base de ${city}` : 'Coordenadas de referencia',
    };
  }

  // 2. Construir query geocodificada contextualizada
  const queryParts: string[] = [cleanedAddress];
  if (city) queryParts.push(city);
  if (department && department !== city) queryParts.push(department);
  queryParts.push('Colombia');

  const queryString = queryParts.join(', ');
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    queryString
  )}&format=json&limit=1&countrycodes=co`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Encadenar con signal externo si se proporciona
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Geocoding HTTP error ${response.status}`);
    }

    const results = await response.json();
    if (Array.isArray(results) && results.length > 0 && results[0].lat && results[0].lon) {
      const topMatch = results[0];
      return {
        latitude: parseFloat(Number(topMatch.lat).toFixed(4)),
        longitude: parseFloat(Number(topMatch.lon).toFixed(4)),
        source: 'address_precise',
        displayName: topMatch.display_name,
        confidence: topMatch.importance || 0.8,
        message: 'Coordenadas geocodificadas por dirección exacta',
      };
    }
  } catch {
    // Si hay error de red, rate-limit o timeout, fallback suave e instantáneo
  }

  // 3. Fallback al centroide del municipio
  return {
    latitude: defaultLat,
    longitude: defaultLng,
    source: 'municipality_fallback',
    message: city
      ? `Dirección no ubicada exactamente; coordenadas base de ${city}`
      : 'Coordenadas de referencia municipal',
  };
}
