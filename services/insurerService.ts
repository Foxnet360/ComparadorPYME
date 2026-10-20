import { apiClient } from './apiClient';
import {
  COLOMBIAN_INSURERS_CATALOG,
  findColombianInsurerProfile,
  buildInsurerSvgDataUri,
  type ColombianInsurerProfile,
} from '@shared/colombianInsurersCatalog';
import { InsuranceDomainType } from '@shared/insuranceDomain';

export interface InsurerEntity extends ColombianInsurerProfile {
  svgBadgeUri?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateInsurerInput = Omit<Partial<ColombianInsurerProfile>, 'id'> & {
  name: string;
};

export type UpdateInsurerInput = Partial<ColombianInsurerProfile>;

// In-memory runtime cache initialized with the 15 Colombian insurers
let insurersCache: InsurerEntity[] = COLOMBIAN_INSURERS_CATALOG.map((ins) => ({
  ...ins,
  svgBadgeUri: buildInsurerSvgDataUri(ins.name, ins),
}));

export const insurerService = {
  /**
   * Get all insurers from the backend, falling back gracefully to the Colombian catalog
   */
  getInsurers: async (includeInactive = true): Promise<InsurerEntity[]> => {
    try {
      const response = await apiClient.fetch(
        `/insurers${includeInactive ? '?includeInactive=true' : ''}`
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.insurers) && data.insurers.length > 0) {
          insurersCache = data.insurers.map((ins: InsurerEntity) => ({
            ...ins,
            svgBadgeUri: ins.svgBadgeUri || buildInsurerSvgDataUri(ins.name, ins),
          }));
          return insurersCache;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch insurers from API, falling back to local catalog:', err);
    }
    return insurersCache;
  },

  /**
   * Create a new insurer
   */
  createInsurer: async (input: CreateInsurerInput): Promise<InsurerEntity> => {
    const response = await apiClient.fetch('/insurers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error creating insurer (${response.status})`);
    }

    const data = await response.json();
    const created: InsurerEntity = {
      ...data.insurer,
      svgBadgeUri: data.insurer.svgBadgeUri || buildInsurerSvgDataUri(data.insurer.name, data.insurer),
    };

    // Update local cache
    const existingIdx = insurersCache.findIndex((i) => i.id === created.id || i.name === created.name);
    if (existingIdx >= 0) {
      insurersCache[existingIdx] = created;
    } else {
      insurersCache.unshift(created);
    }

    return created;
  },

  /**
   * Update an insurer by ID or code
   */
  updateInsurer: async (id: string, input: UpdateInsurerInput): Promise<InsurerEntity> => {
    const response = await apiClient.fetch(`/insurers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error updating insurer (${response.status})`);
    }

    const data = await response.json();
    const updated: InsurerEntity = {
      ...data.insurer,
      svgBadgeUri: data.insurer.svgBadgeUri || buildInsurerSvgDataUri(data.insurer.name, data.insurer),
    };

    const idx = insurersCache.findIndex((i) => i.id === id || i.code === id);
    if (idx >= 0) {
      insurersCache[idx] = updated;
    }

    return updated;
  },

  /**
   * Delete or deactivate an insurer
   */
  deleteInsurer: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.fetch(`/insurers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error deleting insurer (${response.status})`);
    }

    insurersCache = insurersCache.filter((i) => i.id !== id && i.code !== id);
    return await response.json();
  },

  /**
   * Synchronize the 15 official Colombian insurers with the backend
   */
  seedInsurers: async (): Promise<InsurerEntity[]> => {
    const response = await apiClient.fetch('/insurers/seed', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Error synchronizing catalog (${response.status})`);
    }

    const data = await response.json();
    if (Array.isArray(data?.insurers)) {
      insurersCache = data.insurers.map((ins: InsurerEntity) => ({
        ...ins,
        svgBadgeUri: ins.svgBadgeUri || buildInsurerSvgDataUri(ins.name, ins),
      }));
    }
    return insurersCache;
  },

  /**
   * Synchronous brand resolution for UI rendering (e.g., logo, monogram, brand colors)
   */
  resolveInsurerBrand: (insurerName?: string | null): InsurerEntity => {
    const rawName = (insurerName || 'Aseguradora').trim();
    const cached = findColombianInsurerProfile(rawName, insurersCache);
    if (cached) {
      return {
        ...cached,
        svgBadgeUri: buildInsurerSvgDataUri(cached.name, cached),
      };
    }

    const staticProfile = findColombianInsurerProfile(rawName);
    if (staticProfile) {
      return {
        ...staticProfile,
        svgBadgeUri: buildInsurerSvgDataUri(staticProfile.name, staticProfile),
      };
    }

    // Dynamic brand generation for uncataloged custom insurer
    const monogram = rawName
      .replace(/\b(seguros|compania|compañía|de|del|la|colombia|s\.a\.|sa|generales)\b/gi, '')
      .trim()
      .slice(0, 4)
      .toUpperCase() || 'SEG';

    const fallback: InsurerEntity = {
      id: `temp-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      code: rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: rawName,
      shortName: rawName.split(' ')[0] || rawName,
      officialName: rawName,
      nit: 'No especificado',
      domainUrl: '',
      logoUrl: '',
      primaryColor: '#1E293B',
      accentColor: '#38BDF8',
      monogram,
      marketPosition: 'Compañía de Seguros',
      description: `Compañía aseguradora: ${rawName}`,
      integrationInfo: 'Captura y comparación estándar',
      rpaEnabled: false,
      apiEnabled: false,
      supportedDomains: [] as InsuranceDomainType[],
      aliases: [rawName.toLowerCase()],
      isActive: true,
      svgBadgeUri: buildInsurerSvgDataUri(rawName, { monogram, primaryColor: '#1E293B', accentColor: '#38BDF8' }),
    };

    return fallback;
  },
};
