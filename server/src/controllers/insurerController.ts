import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/database';
import {
  COLOMBIAN_INSURERS_CATALOG,
  findColombianInsurerProfile,
  buildInsurerSvgDataUri,
  type ColombianInsurerProfile,
} from '../shared/colombianInsurersCatalog';
import { InsuranceDomain, type InsuranceDomainType } from '../shared/insuranceDomain';
import { insurerNameNormalizer } from '../services/insurerNameNormalizer';

export interface InsurerRecord extends ColombianInsurerProfile {
  svgBadgeUri: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SupabaseInsurerRow {
  id: string;
  code?: string | null;
  name: string;
  short_name?: string | null;
  official_name?: string | null;
  nit?: string | null;
  domain_url?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  monogram?: string | null;
  market_position?: string | null;
  description?: string | null;
  integration_info?: string | null;
  rpa_enabled?: boolean | null;
  api_enabled?: boolean | null;
  supported_domains?: string[] | null;
  aliases?: string[] | null;
  contact_email?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// In-memory overlay initialized with the 15 official Colombian insurers
const memoryCatalogStore = new Map<string, ColombianInsurerProfile>();
const deletedInsurerKeys = new Set<string>();

function initializeMemoryCatalog(): void {
  if (memoryCatalogStore.size > 0) return;
  for (const item of COLOMBIAN_INSURERS_CATALOG) {
    memoryCatalogStore.set(item.code, {
      ...item,
      supportedDomains: [...item.supportedDomains],
      aliases: [...item.aliases],
    });
  }
}

initializeMemoryCatalog();

function slugifyCode(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || `ins-${Date.now()}`
  );
}

function buildMonogram(name: string, provided?: string): string {
  if (provided && provided.trim()) {
    return provided.trim().toUpperCase().slice(0, 4);
  }
  const cleaned = name
    .replace(/\b(seguros|compania|compañía|de|del|la|colombia|s\.a\.|sa|generales)\b/gi, '')
    .trim();
  const token = (cleaned || name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (token.slice(0, 3) || 'SEG').slice(0, 4);
}

function enrichWithSvg(profile: ColombianInsurerProfile): InsurerRecord {
  return {
    ...profile,
    svgBadgeUri: buildInsurerSvgDataUri(profile.name, profile),
  };
}

function mergeRowWithCatalog(
  row: SupabaseInsurerRow,
  fallbackProfile?: ColombianInsurerProfile
): ColombianInsurerProfile {
  const matched =
    fallbackProfile ||
    findColombianInsurerProfile(row.code || row.name, Array.from(memoryCatalogStore.values())) ||
    findColombianInsurerProfile(row.name);

  const code = row.code || matched?.code || slugifyCode(row.name);
  const name = row.name || matched?.name || 'Aseguradora';
  const shortName = row.short_name || matched?.shortName || name;
  const officialName = row.official_name || matched?.officialName || name;
  const domainUrl = row.domain_url || matched?.domainUrl || '';
  const defaultLogoUrl = domainUrl
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainUrl.split('/')[0] || domainUrl)}&sz=128`
    : '';

  return {
    id: row.id || matched?.id || `ins-${code}`,
    code,
    name,
    shortName,
    officialName,
    nit: row.nit ?? matched?.nit ?? '',
    domainUrl,
    logoUrl: row.logo_url || matched?.logoUrl || defaultLogoUrl,
    primaryColor: row.primary_color || matched?.primaryColor || '#1E293B',
    accentColor: row.accent_color || matched?.accentColor || '#38BDF8',
    monogram: row.monogram || matched?.monogram || buildMonogram(shortName),
    marketPosition:
      row.market_position || matched?.marketPosition || 'Aseguradora aliada en Colombia',
    description:
      row.description ||
      matched?.description ||
      'Aseguradora registrada en el catálogo corporativo para análisis comparativo de pólizas y clausulados.',
    integrationInfo:
      row.integration_info ||
      matched?.integrationInfo ||
      'Integración documental y extracción inteligente',
    rpaEnabled:
      typeof row.rpa_enabled === 'boolean' ? row.rpa_enabled : (matched?.rpaEnabled ?? false),
    apiEnabled:
      typeof row.api_enabled === 'boolean' ? row.api_enabled : (matched?.apiEnabled ?? false),
    supportedDomains:
      Array.isArray(row.supported_domains) && row.supported_domains.length > 0
        ? (row.supported_domains as InsuranceDomainType[])
        : matched?.supportedDomains || [InsuranceDomain.PYME],
    aliases:
      Array.isArray(row.aliases) && row.aliases.length > 0
        ? row.aliases
        : matched?.aliases || [name.toLowerCase(), shortName.toLowerCase()],
    contactEmail: row.contact_email ?? matched?.contactEmail,
    phone: row.phone ?? matched?.phone,
    isActive: typeof row.is_active === 'boolean' ? row.is_active : (matched?.isActive ?? true),
  };
}

async function syncWithSupabase(): Promise<InsurerRecord[]> {
  initializeMemoryCatalog();

  try {
    const { data: dbRows, error } = await supabase
      .from('insurers')
      .select('*')
      .order('name', { ascending: true });

    if (!error && Array.isArray(dbRows)) {
      for (const rawRow of dbRows as SupabaseInsurerRow[]) {
        const merged = mergeRowWithCatalog(rawRow);
        if (!deletedInsurerKeys.has(merged.code) && !deletedInsurerKeys.has(merged.id)) {
          memoryCatalogStore.set(merged.code, merged);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [insurerController] Could not sync insurers from Supabase, using catalog:', err);
  }

  return Array.from(memoryCatalogStore.values())
    .filter((item) => !deletedInsurerKeys.has(item.code) && !deletedInsurerKeys.has(item.id))
    .map(enrichWithSvg);
}

export const insurerController = {
  /**
   * GET /api/insurers
   * Returns all insurers (the 15 Colombian insurers + any custom-created insurers).
   */
  listInsurers: async (req: Request, res: Response): Promise<void> => {
    try {
      const allInsurers = await syncWithSupabase();
      const { domain, rpaEnabled, apiEnabled, isActive, search } = req.query;

      const filtered = allInsurers.filter((ins) => {
        if (isActive === 'true' && !ins.isActive) return false;
        if (isActive === 'false' && ins.isActive) return false;
        if (rpaEnabled === 'true' && !ins.rpaEnabled) return false;
        if (apiEnabled === 'true' && !ins.apiEnabled) return false;
        if (typeof domain === 'string' && domain.trim() !== '') {
          const dom = domain.trim().toLowerCase() as InsuranceDomainType;
          if (!ins.supportedDomains.includes(dom)) return false;
        }
        if (typeof search === 'string' && search.trim() !== '') {
          const q = search.trim().toLowerCase();
          const match =
            ins.name.toLowerCase().includes(q) ||
            ins.shortName.toLowerCase().includes(q) ||
            ins.officialName.toLowerCase().includes(q) ||
            ins.nit.toLowerCase().includes(q) ||
            ins.description.toLowerCase().includes(q) ||
            ins.aliases.some((a) => a.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      });

      res.json({
        success: true,
        insurers: filtered,
        count: filtered.length,
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error al consultar catálogo de aseguradoras',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * POST /api/insurers
   * Creates a new insurer or updates if code/name already exists.
   */
  createInsurer: async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'El nombre de la aseguradora es obligatorio',
        });
        return;
      }

      const code =
        typeof body.code === 'string' && body.code.trim()
          ? slugifyCode(body.code)
          : slugifyCode(name);
      const shortName =
        typeof body.shortName === 'string' && body.shortName.trim() ? body.shortName.trim() : name;
      const officialName =
        typeof body.officialName === 'string' && body.officialName.trim()
          ? body.officialName.trim()
          : name;
      const nit = typeof body.nit === 'string' ? body.nit.trim() : '';
      const domainUrl = typeof body.domainUrl === 'string' ? body.domainUrl.trim() : '';
      const defaultFavicon = domainUrl
        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainUrl.split('/')[0] || domainUrl)}&sz=128`
        : '';
      const logoUrl =
        typeof body.logoUrl === 'string' && body.logoUrl.trim()
          ? body.logoUrl.trim()
          : defaultFavicon;
      const primaryColor =
        typeof body.primaryColor === 'string' && body.primaryColor.trim()
          ? body.primaryColor.trim()
          : '#1E293B';
      const accentColor =
        typeof body.accentColor === 'string' && body.accentColor.trim()
          ? body.accentColor.trim()
          : '#38BDF8';
      const monogram = buildMonogram(
        shortName,
        typeof body.monogram === 'string' ? body.monogram : undefined
      );
      const marketPosition =
        typeof body.marketPosition === 'string' && body.marketPosition.trim()
          ? body.marketPosition.trim()
          : 'Aseguradora aliada en Colombia';
      const description =
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : 'Aseguradora configurada para cotización y análisis comparativo.';
      const integrationInfo =
        typeof body.integrationInfo === 'string' && body.integrationInfo.trim()
          ? body.integrationInfo.trim()
          : 'Integración documental y extracción multimodal';
      const rpaEnabled = Boolean(body.rpaEnabled);
      const apiEnabled = Boolean(body.apiEnabled);
      const supportedDomains: InsuranceDomainType[] =
        Array.isArray(body.supportedDomains) && body.supportedDomains.length > 0
          ? (body.supportedDomains.filter((d) => typeof d === 'string') as InsuranceDomainType[])
          : [InsuranceDomain.PYME];
      const aliases: string[] =
        Array.isArray(body.aliases) && body.aliases.length > 0
          ? body.aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
          : Array.from(
              new Set([name.toLowerCase(), shortName.toLowerCase(), officialName.toLowerCase()])
            );
      const contactEmail =
        typeof body.contactEmail === 'string' && body.contactEmail.trim()
          ? body.contactEmail.trim()
          : undefined;
      const phone =
        typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : undefined;
      const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;

      let dbId = `ins-${code}-${uuidv4().slice(0, 6)}`;

      // Try inserting full columns into Supabase, fallback to basic columns if migration 028 isn't applied on remote DB
      try {
        const fullPayload = {
          code,
          name,
          short_name: shortName,
          official_name: officialName,
          nit: nit || null,
          domain_url: domainUrl || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          accent_color: accentColor,
          monogram,
          market_position: marketPosition,
          description,
          integration_info: integrationInfo,
          rpa_enabled: rpaEnabled,
          api_enabled: apiEnabled,
          supported_domains: supportedDomains,
          aliases,
          contact_email: contactEmail || null,
          phone: phone || null,
          is_active: isActive,
        };

        const { data: insertedFull, error: fullError } = await supabase
          .from('insurers')
          .upsert(fullPayload as unknown as never, { onConflict: 'name' })
          .select('id')
          .single();

        if (!fullError && insertedFull) {
          dbId = (insertedFull as { id: string }).id;
        } else {
          const basicPayload = {
            name,
            nit: nit || null,
            contact_email: contactEmail || null,
            phone: phone || null,
          };
          const { data: insertedBasic } = await supabase
            .from('insurers')
            .upsert(basicPayload as unknown as never, { onConflict: 'name' })
            .select('id')
            .single();
          if (insertedBasic) {
            dbId = (insertedBasic as { id: string }).id;
          }
        }
      } catch (dbErr) {
        console.warn('⚠️ [insurerController.createInsurer] Supabase fallback to memory:', dbErr);
      }

      const newProfile: ColombianInsurerProfile = {
        id: dbId,
        code,
        name,
        shortName,
        officialName,
        nit,
        domainUrl,
        logoUrl,
        primaryColor,
        accentColor,
        monogram,
        marketPosition,
        description,
        integrationInfo,
        rpaEnabled,
        apiEnabled,
        supportedDomains,
        aliases,
        contactEmail,
        phone,
        isActive,
      };

      deletedInsurerKeys.delete(code);
      deletedInsurerKeys.delete(dbId);
      memoryCatalogStore.set(code, newProfile);

      // Register runtime aliases in insurerNameNormalizer
      insurerNameNormalizer.addMapping(name, shortName);
      insurerNameNormalizer.addMapping(officialName, shortName);
      for (const alias of aliases) {
        insurerNameNormalizer.addMapping(alias, shortName);
      }

      res.status(201).json({
        success: true,
        insurer: enrichWithSvg(newProfile),
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error al crear aseguradora',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * PUT /api/insurers/:id
   * Updates an insurer by id, code, or name.
   */
  updateInsurer: async (req: Request, res: Response): Promise<void> => {
    try {
      const targetId = String(req.params.id || '').trim();
      const body = (req.body || {}) as Record<string, unknown>;

      initializeMemoryCatalog();

      let existingEntry: ColombianInsurerProfile | undefined;
      for (const item of memoryCatalogStore.values()) {
        if (
          item.id === targetId ||
          item.code === targetId ||
          item.name.toLowerCase() === targetId.toLowerCase()
        ) {
          existingEntry = item;
          break;
        }
      }

      if (!existingEntry) {
        existingEntry = findColombianInsurerProfile(targetId);
      }

      if (!existingEntry) {
        res.status(404).json({
          success: false,
          error: 'Aseguradora no encontrada',
        });
        return;
      }

      const updated: ColombianInsurerProfile = {
        ...existingEntry,
        name:
          typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existingEntry.name,
        shortName:
          typeof body.shortName === 'string' && body.shortName.trim()
            ? body.shortName.trim()
            : existingEntry.shortName,
        officialName:
          typeof body.officialName === 'string' && body.officialName.trim()
            ? body.officialName.trim()
            : existingEntry.officialName,
        nit: typeof body.nit === 'string' ? body.nit.trim() : existingEntry.nit,
        domainUrl:
          typeof body.domainUrl === 'string' ? body.domainUrl.trim() : existingEntry.domainUrl,
        logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl.trim() : existingEntry.logoUrl,
        primaryColor:
          typeof body.primaryColor === 'string' && body.primaryColor.trim()
            ? body.primaryColor.trim()
            : existingEntry.primaryColor,
        accentColor:
          typeof body.accentColor === 'string' && body.accentColor.trim()
            ? body.accentColor.trim()
            : existingEntry.accentColor,
        monogram:
          typeof body.monogram === 'string' && body.monogram.trim()
            ? buildMonogram(existingEntry.shortName, body.monogram)
            : existingEntry.monogram,
        marketPosition:
          typeof body.marketPosition === 'string'
            ? body.marketPosition.trim()
            : existingEntry.marketPosition,
        description:
          typeof body.description === 'string'
            ? body.description.trim()
            : existingEntry.description,
        integrationInfo:
          typeof body.integrationInfo === 'string'
            ? body.integrationInfo.trim()
            : existingEntry.integrationInfo,
        rpaEnabled:
          typeof body.rpaEnabled === 'boolean' ? body.rpaEnabled : existingEntry.rpaEnabled,
        apiEnabled:
          typeof body.apiEnabled === 'boolean' ? body.apiEnabled : existingEntry.apiEnabled,
        supportedDomains: Array.isArray(body.supportedDomains)
          ? (body.supportedDomains.filter((d) => typeof d === 'string') as InsuranceDomainType[])
          : existingEntry.supportedDomains,
        aliases: Array.isArray(body.aliases)
          ? body.aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
          : existingEntry.aliases,
        contactEmail:
          typeof body.contactEmail === 'string'
            ? body.contactEmail.trim()
            : existingEntry.contactEmail,
        phone: typeof body.phone === 'string' ? body.phone.trim() : existingEntry.phone,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : existingEntry.isActive,
      };

      memoryCatalogStore.set(updated.code, updated);

      // Persist changes to Supabase if possible
      try {
        const fullUpdate = {
          code: updated.code,
          name: updated.name,
          short_name: updated.shortName,
          official_name: updated.officialName,
          nit: updated.nit || null,
          domain_url: updated.domainUrl || null,
          logo_url: updated.logoUrl || null,
          primary_color: updated.primaryColor,
          accent_color: updated.accentColor,
          monogram: updated.monogram,
          market_position: updated.marketPosition,
          description: updated.description,
          integration_info: updated.integrationInfo,
          rpa_enabled: updated.rpaEnabled,
          api_enabled: updated.apiEnabled,
          supported_domains: updated.supportedDomains,
          aliases: updated.aliases,
          contact_email: updated.contactEmail || null,
          phone: updated.phone || null,
          is_active: updated.isActive,
          updated_at: new Date().toISOString(),
        };

        const { error: fullErr } = await supabase
          .from('insurers')
          .upsert(fullUpdate as unknown as never, { onConflict: 'name' });

        if (fullErr) {
          await supabase.from('insurers').upsert(
            {
              name: updated.name,
              nit: updated.nit || null,
              contact_email: updated.contactEmail || null,
              phone: updated.phone || null,
            } as unknown as never,
            { onConflict: 'name' }
          );
        }
      } catch (dbErr) {
        console.warn('⚠️ [insurerController.updateInsurer] DB update skipped:', dbErr);
      }

      res.json({
        success: true,
        insurer: enrichWithSvg(updated),
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar aseguradora',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * DELETE /api/insurers/:id
   * Soft-deletes or removes an insurer by id or code.
   */
  deleteInsurer: async (req: Request, res: Response): Promise<void> => {
    try {
      const targetId = String(req.params.id || '').trim();
      const hardDelete = req.query.hard === 'true';

      initializeMemoryCatalog();

      let found: ColombianInsurerProfile | undefined;
      for (const item of memoryCatalogStore.values()) {
        if (item.id === targetId || item.code === targetId) {
          found = item;
          break;
        }
      }

      if (!found) {
        res.status(404).json({
          success: false,
          error: 'Aseguradora no encontrada',
        });
        return;
      }

      if (hardDelete) {
        memoryCatalogStore.delete(found.code);
        deletedInsurerKeys.add(found.code);
        deletedInsurerKeys.add(found.id);
        try {
          await supabase.from('insurers').delete().eq('name', found.name);
        } catch {
          // Ignore DB delete error if referenced
        }
      } else {
        const deactivated: ColombianInsurerProfile = {
          ...found,
          isActive: false,
        };
        memoryCatalogStore.set(found.code, deactivated);
        try {
          await supabase
            .from('insurers')
            .update({ is_active: false, updated_at: new Date().toISOString() } as never)
            .eq('name', found.name);
        } catch {
          // Ignore if column not migrated yet
        }
      }

      res.json({
        success: true,
        message: hardDelete
          ? 'Aseguradora eliminada correctamente'
          : 'Aseguradora desactivada correctamente',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error al eliminar aseguradora',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * POST /api/insurers/seed
   * Synchronizes and upserts the 15 official Colombian insurers into Supabase and memory.
   */
  seedColombianInsurers: async (_req: Request, res: Response): Promise<void> => {
    try {
      deletedInsurerKeys.clear();
      for (const item of COLOMBIAN_INSURERS_CATALOG) {
        memoryCatalogStore.set(item.code, {
          ...item,
          supportedDomains: [...item.supportedDomains],
          aliases: [...item.aliases],
        });
      }

      let dbSyncedCount = 0;
      for (const item of COLOMBIAN_INSURERS_CATALOG) {
        try {
          const fullPayload = {
            code: item.code,
            name: item.name,
            short_name: item.shortName,
            official_name: item.officialName,
            nit: item.nit,
            domain_url: item.domainUrl,
            logo_url: item.logoUrl,
            primary_color: item.primaryColor,
            accent_color: item.accentColor,
            monogram: item.monogram,
            market_position: item.marketPosition,
            description: item.description,
            integration_info: item.integrationInfo,
            rpa_enabled: item.rpaEnabled,
            api_enabled: item.apiEnabled,
            supported_domains: item.supportedDomains,
            aliases: item.aliases,
            contact_email: item.contactEmail || null,
            phone: item.phone || null,
            is_active: item.isActive,
          };

          const { error: fullErr } = await supabase
            .from('insurers')
            .upsert(fullPayload as unknown as never, { onConflict: 'name' });

          if (!fullErr) {
            dbSyncedCount++;
          } else {
            const { error: basicErr } = await supabase.from('insurers').upsert(
              {
                name: item.name,
                nit: item.nit,
                contact_email: item.contactEmail || null,
                phone: item.phone || null,
              } as unknown as never,
              { onConflict: 'name' }
            );
            if (!basicErr) dbSyncedCount++;
          }
        } catch {
          // Continue seeding remaining insurers
        }
      }

      const list = Array.from(memoryCatalogStore.values()).map(enrichWithSvg);
      res.json({
        success: true,
        seededCount: COLOMBIAN_INSURERS_CATALOG.length,
        dbSyncedCount,
        insurers: list,
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error al sincronizar el catálogo oficial de aseguradoras',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
