import { Response, NextFunction } from 'express';
import fs from 'fs';

import { ParsedQuote } from '../services/quoteParser';
import { isMultimodalEnabled } from '../services/quoteProcessingService';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { AnalysisType } from '../services/unifiedComparison/comparisonSchema';
import { extractCanonicalInsurerName } from '../services/unifiedComparison/insurerSanitizer';

import {
  saveAnalysisHistory,
  getAnalysisHistoryByUser,
  getAnalysisById,
  updateAnalysisHistory,
} from '../repositories/analysisRepository';
import { mergeComparisonResults } from '../services/unifiedComparison/incrementalMerge';
import { getPolicyById } from '../repositories/policyRepository';
import { supabase } from '../config/database';
import { ensureClausePersistedInLibrary } from '../services/documentIndexingService';
import { auditGroundedComparison } from '../services/groundingAuditor';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';
import { InsuranceDomain, isInsuranceDomain } from '../types/domain';

interface QuoteMetadataEntry {
  insurer?: string;
  cliente?: string;
  documento?: string;
  actividadOcupacion?: string;
  ubicacionRiesgo?: string;
  vigencia?: string;
  tipoSeguro?: string;
  anoConstruccion?: string;
  pisos?: string;
  [key: string]: unknown;
}

interface ClientProfileInput {
  name?: string;
  nit?: string;
  industry?: string;
  address?: string;
  city?: string;
  department?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  constructionYear?: string;
  floorsCount?: string;
  seismicZone?: string;
  buildingType?: string;
}
import {
  DualExtractionResult,
  ComparisonResultQuote,
  ComparisonResult,
  AnalysisDomainResolution,
  toHttpError,
  resolveAnalysisUserId,
  resolveAnalysisDomain,
  generateComparison,
  matrixRowsToComparisonReport,
  extractMatrixInsurers,
  normalizeInsurerName,
  alignInsurerIndices,
  type UnifiedQuote,
  type UnifiedComparisonReport,
} from './analysisHelpers';

export {
  toHttpError,
  resolveAnalysisUserId,
  resolveAnalysisDomain,
  generateComparison,
  matrixRowsToComparisonReport,
  extractMatrixInsurers,
  normalizeInsurerName,
  alignInsurerIndices,
  type DualExtractionResult,
  type ComparisonResultQuote,
  type ComparisonResult,
  type AnalysisDomainResolution,
  type UnifiedQuote,
  type UnifiedComparisonReport,
};

export const analysisController = {
  uploadAndAnalyze: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const quoteFiles = files?.['quotes'] || [];
    const clauseFiles = files?.['clauses'] || [];
    const allUploadedFiles = [...quoteFiles, ...clauseFiles];
    let filesCleanedUp = false;
    const cleanupUploadedFiles = () => {
      if (filesCleanedUp) return;
      filesCleanedUp = true;
      allUploadedFiles.forEach((f) => {
        try {
          if (f && f.path) {
            fs.unlinkSync(f.path);
          }
        } catch (e) {
          logger.warn({ err: e }, `Failed to delete temp file ${f.path}`);
        }
      });
    };

    try {
      // AUTH-2: ownership is derived from the authenticated session; a
      // client-supplied userId is a spoofing vector and is rejected.
      if ((req.body as Record<string, unknown> | undefined)?.userId !== undefined) {
        cleanupUploadedFiles();
        res.status(400).json({
          success: false,
          error: 'userId is derived from the authenticated session; do not send it',
        });
        return;
      }

      const userId = resolveAnalysisUserId(req);
      const authUser = (req as AuthenticatedRequest).user;

      if (quoteFiles.length === 0) {
        cleanupUploadedFiles();
        res.status(400).json({ success: false, error: 'No quote files uploaded' });
        return;
      }

      const domainResolution = resolveAnalysisDomain(req.body?.domain);
      if (domainResolution.error) {
        cleanupUploadedFiles();
        res.status(400).json({ success: false, error: domainResolution.error });
        return;
      }
      const domain = domainResolution.domain;

      // Permanent Clause Library (Issue 8): persist and deduplicate any uploaded clauses
      if (clauseFiles.length > 0) {
        for (const cf of clauseFiles) {
          try {
            if (cf.path && fs.existsSync(cf.path)) {
              const buffer = fs.readFileSync(cf.path);
              await ensureClausePersistedInLibrary(
                buffer,
                cf.originalname,
                req.body?.insurerName || 'Aseguradora',
                domain
              );
            }
          } catch (clauseErr) {
            logger.warn(
              { err: clauseErr, file: cf.originalname },
              'Failed to auto-persist clause in permanent library'
            );
          }
        }
      }

      // Parse clauseIds selected from persistent library
      let selectedClauseIds: string[] = [];
      if (req.body?.clauseIds) {
        try {
          selectedClauseIds =
            typeof req.body.clauseIds === 'string'
              ? JSON.parse(req.body.clauseIds)
              : req.body.clauseIds;
          if (!Array.isArray(selectedClauseIds)) {
            selectedClauseIds = [];
          }
        } catch (e) {
          logger.warn({ err: e }, 'Failed to parse clauseIds from req.body');
        }
      }

      const rawAnalysisType = req.body?.analysisType ?? req.body?.analysis_type;
      const analysisType: AnalysisType | undefined =
        rawAnalysisType === 'renewal' ? 'renewal' : undefined;
      const policyId =
        typeof (req.body?.policyId ?? req.body?.policy_id) === 'string'
          ? (req.body.policyId ?? req.body.policy_id).trim()
          : undefined;
      const renewalId =
        typeof (req.body?.renewalId ?? req.body?.renewal_id) === 'string'
          ? (req.body.renewalId ?? req.body.renewal_id).trim()
          : undefined;

      let referenceQuote: ParsedQuote | undefined;
      if (analysisType === 'renewal' && policyId && userId) {
        try {
          const policy = await getPolicyById(userId, policyId, authUser?.orgId, authUser?.role);
          if (policy) {
            referenceQuote = {
              insurerName: policy.insurer,
              policyName: policy.policy_number ? `Póliza ${policy.policy_number}` : 'Póliza Actual',
              priceAnnual: Number(policy.premium) || 0,
              currency: 'COP',
              coverages: Array.isArray(policy.coverages)
                ? (policy.coverages as ParsedQuote['coverages'])
                : [],
              specialConditions: [],
              rawText: '',
              parseConfidence: 100,
            };
          }
        } catch (e) {
          logger.warn({ err: e }, `Failed to fetch policy ${policyId} for renewal reference quote`);
        }
      }

      logger.info(`📄 Processing ${quoteFiles.length} quotes...`);
      logger.info(`🔧 Pipeline: ${isMultimodalEnabled() ? 'Multimodal (V2)' : 'Legacy (V1)'}`);
      logger.info(`🌐 Domain: ${domain}`);

      const pdfPaths = quoteFiles.map((f) => f.path);
      const adapterResult = await comparisonEngineAdapter.generateComparison(pdfPaths, {
        userId,
        domain,
        ...(analysisType ? { analysisType } : {}),
        ...(referenceQuote ? { referenceQuote } : {}),
        ...(policyId ? { policyId } : {}),
        ...(renewalId ? { renewalId } : {}),
      });
      const matrixRows = adapterResult.matrix;

      // Debug: Log matrix structure
      logger.info(
        `📊 [Adapter Debug] engine=${adapterResult.engine}, correlationId=${adapterResult.correlationId}, matrix rows: ${matrixRows.length}`
      );
      const dataRows = matrixRows.filter((r) => r.type === 'data');
      logger.info(`📊 [Adapter Debug] Data rows: ${dataRows.length}`);
      if (dataRows.length > 0) {
        logger.info(`📊 [Adapter Debug] First data row: ${JSON.stringify(dataRows[0], null, 2)}`);
      }

      // Convert MatrixRow[] to ComparisonReport format
      const comparisonResult = (await matrixRowsToComparisonReport(matrixRows, quoteFiles, {
        graphEnabled: adapterResult.graphEnabled,
        templateHintsEnabled: adapterResult.templateHintsEnabled,
        domain,
      })) as unknown as ComparisonResult;

      comparisonResult.matrix = comparisonResult.matrix || matrixRows;
      comparisonResult.quoteMetadata = Array.isArray(adapterResult.quoteMetadata)
        ? (adapterResult.quoteMetadata as QuoteMetadataEntry[]).map((m) =>
            m && typeof m.insurer === 'string'
              ? { ...m, insurer: extractCanonicalInsurerName(m.insurer) }
              : m
          )
        : adapterResult.quoteMetadata;
      comparisonResult.schemaVersion = adapterResult.schemaVersion;
      comparisonResult.domain = domain;
      if (analysisType) {
        comparisonResult.analysisType = analysisType;
      }
      if (policyId) {
        comparisonResult.policyId = policyId;
      }
      if (renewalId) {
        comparisonResult.renewalId = renewalId;
      }

      // Propagate clause availability when clauseIds are selected from library
      if (selectedClauseIds.length > 0) {
        try {
          const { data: clauseDocs } = await supabase
            .from('document_insurer_view')
            .select('insurer_name, id')
            .in('id', selectedClauseIds);
          const activeInsurers = new Set(
            (clauseDocs || [])
              .map((d: { insurer_name?: string | null }) =>
                (d.insurer_name || '').toUpperCase().trim()
              )
              .filter(Boolean)
          );
          comparisonResult.quotes?.forEach((q: ComparisonResultQuote) => {
            const insNorm = (q.insurerName || '').toUpperCase().trim();
            if (
              activeInsurers.size === 0 ||
              activeInsurers.has(insNorm) ||
              Array.from(activeInsurers).some(
                (ai: string) => insNorm.includes(ai) || ai.includes(insNorm)
              )
            ) {
              q.isRagAvailable = true;
            }
          });
        } catch (e) {
          logger.warn({ err: e }, 'Failed to map selected clauseIds to insurers');
          comparisonResult.quotes?.forEach((q: ComparisonResultQuote) => {
            q.isRagAvailable = true;
          });
        }
      }

      // Also propagate clause availability for supplemental uploaded clauses
      if (clauseFiles.length > 0) {
        clauseFiles.forEach((cf) => {
          const fname = (cf.originalname || '').toUpperCase();
          comparisonResult.quotes?.forEach((q: ComparisonResultQuote) => {
            const insNorm = (q.insurerName || '').toUpperCase().trim();
            if (insNorm && (fname.includes(insNorm) || insNorm.includes(fname))) {
              q.isRagAvailable = true;
            }
          });
        });
      }

      // Debug: Log result structure
      logger.info(`📊 [Adapter Debug] Quotes generated: ${comparisonResult.quotes?.length || 0}`);
      comparisonResult.quotes?.forEach((q: ComparisonResultQuote, i: number) => {
        logger.info(
          `📊 [Adapter Debug] Quote ${i} (${q.insurerName}): ${q.coverages?.length || 0} coverages, price: ${q.priceAnnual}`
        );
      });

      // Client Info Resolution (Priority: Client Profile / CRUD > req.body > Quote Metadata > Defaults)
      let parsedClientProfile: ClientProfileInput | null = null;
      if (req.body.clientProfile) {
        try {
          parsedClientProfile = (
            typeof req.body.clientProfile === 'string'
              ? JSON.parse(req.body.clientProfile)
              : req.body.clientProfile
          ) as ClientProfileInput;
        } catch {
          // ignore json parse error
        }
      }

      const quoteMetadataList = (
        Array.isArray(adapterResult.quoteMetadata) ? adapterResult.quoteMetadata : []
      ) as QuoteMetadataEntry[];
      const extractedMetaClient = quoteMetadataList.find((m) => m?.cliente);
      const extractedClientName = extractedMetaClient?.cliente;
      const clientName =
        parsedClientProfile?.name ||
        (req.body.clientName &&
        req.body.clientName !== 'Cliente' &&
        req.body.clientName !== 'Prospecto General'
          ? req.body.clientName
          : extractedClientName || req.body.clientName || 'Cliente');

      const clientNit =
        parsedClientProfile?.nit ||
        quoteMetadataList.find((m) => m?.documento)?.documento ||
        req.body.clientNit;

      const clientActivity =
        parsedClientProfile?.industry ||
        req.body.clientActivity ||
        quoteMetadataList.find((m) => m?.actividadOcupacion)?.actividadOcupacion ||
        (domain === 'copropiedades'
          ? 'Edificio Residencial / Comercial (Copropiedad)'
          : domain === 'autos'
            ? 'Vehículo Particular / Flotas'
            : domain === 'hogar'
              ? 'Vivienda Residencial / Hogar'
              : 'Comercial / PYME');

      const clientLocation =
        [parsedClientProfile?.address, parsedClientProfile?.city, parsedClientProfile?.department]
          .filter(Boolean)
          .join(', ') ||
        req.body.clientLocation ||
        quoteMetadataList.find((m) => m?.ubicacionRiesgo)?.ubicacionRiesgo ||
        (parsedClientProfile?.city ? `${parsedClientProfile.city}, Colombia` : 'Colombia');

      comparisonResult.domain = domain;
      comparisonResult.clientInfo = {
        name: clientName,
        nit: clientNit || undefined,
        activity: clientActivity,
        location: clientLocation,
        address: parsedClientProfile?.address || undefined,
        city: parsedClientProfile?.city || undefined,
        department: parsedClientProfile?.department || undefined,
        contactPerson: parsedClientProfile?.contactPerson || undefined,
        email: parsedClientProfile?.email || undefined,
        phone: parsedClientProfile?.phone || undefined,
        vigencia: quoteMetadataList.find((m) => m?.vigencia)?.vigencia || undefined,
        tipoSeguro: quoteMetadataList.find((m) => m?.tipoSeguro)?.tipoSeguro || undefined,
        anoConstruccion:
          parsedClientProfile?.constructionYear ||
          quoteMetadataList.find((m) => m?.anoConstruccion)?.anoConstruccion ||
          undefined,
        pisos:
          parsedClientProfile?.floorsCount ||
          quoteMetadataList.find((m) => m?.pisos)?.pisos ||
          undefined,
        seismicZone: parsedClientProfile?.seismicZone || undefined,
        buildingType: parsedClientProfile?.buildingType || undefined,
      };

      try {
        const avgConfidence =
          comparisonResult.quotes.reduce(
            (sum: number, q: ComparisonResultQuote) => sum + (q.extractionConfidence || 0),
            0
          ) / (comparisonResult.quotes.length || 1);

        const duration = Date.now() - startTime;

        const insertData = {
          user_id: userId,
          org_id: req.user?.orgId || null,
          client_name: clientName,
          domain: domain,
          analysis_result: comparisonResult,
          recommendation: comparisonResult.recommendation || null,
          total_score: comparisonResult.quotes?.[0]?.score || null,
          extraction_confidence: Math.round(avgConfidence),
          needs_review: comparisonResult.quotes.some((q: ComparisonResultQuote) => q.needsReview),
          validation_flags_count: comparisonResult.quotes.reduce(
            (sum: number, q: ComparisonResultQuote) => sum + (q.validationFlags?.length || 0),
            0
          ),
          engine_type: adapterResult.engine,
          processing_time_ms: duration,
          confidence_score: Math.round(avgConfidence),
          unified_result: comparisonResult,
          fallback_reason: adapterResult.fallbackReason || null,
          correlation_id: adapterResult.correlationId,
          analysis_type: analysisType || null,
          policy_id: policyId || null,
          renewal_id: renewalId || null,
        };

        const savedId = await saveAnalysisHistory(insertData);
        if (savedId) {
          (comparisonResult as ComparisonResult).id = savedId;
        }
      } catch (saveError: unknown) {
        // ERR-1: a failed save must be logged and reach the central error
        // handler via next(error) — temp files are cleaned up either way.
        logger.error({ err: saveError }, '❌ [Supabase] Exception saving analysis');

        cleanupUploadedFiles();

        next(toHttpError(saveError));
        return;
      }

      // Cleanup temp files
      cleanupUploadedFiles();

      const duration = Date.now() - startTime;
      logger.info(`✅ Analysis completed in ${duration}ms`);

      const auditEnvelope = auditGroundedComparison(comparisonResult);
      res.json(auditEnvelope.result);
    } catch (error: unknown) {
      cleanupUploadedFiles();
      // ERR-1: forward to the central error handler instead of sending a raw
      // response from the controller — the handler attaches the traceId.
      logger.error({ err: error }, 'Controller Error: uploadAndAnalyze failed');
      next(toHttpError(error));
    }
  },

  /**
   * POST /api/analysis/:id/quotes
   * Appends one or more late-arriving quote PDFs to an existing comparison.
   */
  appendQuotesToAnalysis: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const quoteFiles = files?.quotes || [];
    const cleanup = () => {
      for (const file of quoteFiles) {
        if (file?.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            // ignore cleanup errors
          }
        }
      }
    };

    try {
      const analysisId = Array.isArray(req.params.id)
        ? req.params.id[0] || ''
        : String(req.params.id || '');
      if (!analysisId) {
        cleanup();
        res.status(400).json({ error: 'ID de análisis requerido.' });
        return;
      }

      if (quoteFiles.length === 0) {
        res.status(400).json({ error: 'Debe adjuntar al menos una cotización PDF adicional.' });
        return;
      }

      const existingRecord = await getAnalysisById(analysisId);
      if (!existingRecord) {
        cleanup();
        res.status(404).json({ error: 'Comparación no encontrada.' });
        return;
      }

      const userId = req.user?.id;
      const orgId = req.user?.orgId;
      const role = req.user?.role;
      const recordOrgId = (existingRecord as { org_id?: string | null }).org_id;
      const hasAccess =
        role === 'super_admin' ||
        (userId && existingRecord.user_id === userId) ||
        (orgId && recordOrgId === orgId);

      if (!hasAccess) {
        cleanup();
        res.status(403).json({ error: 'No tiene permisos para modificar esta comparación.' });
        return;
      }

      const existingResult = (existingRecord.analysis_result ||
        existingRecord.unified_result ||
        {}) as ComparisonResult & Record<string, unknown>;

      const rawDomain = req.body?.domain || existingRecord.domain || 'pyme';
      const domain: InsuranceDomain = isInsuranceDomain(rawDomain) ? rawDomain : 'pyme';
      const quotePaths = quoteFiles.map((f) => f.path);

      const adapterResult = await comparisonEngineAdapter.generateComparison(quotePaths, {
        domain,
        userId: userId || existingRecord.user_id || undefined,
      });

      const incomingResult = (await matrixRowsToComparisonReport(adapterResult.matrix, quoteFiles, {
        graphEnabled: adapterResult.graphEnabled,
        templateHintsEnabled: adapterResult.templateHintsEnabled,
        domain,
      })) as unknown as ComparisonResult & Record<string, unknown>;
      incomingResult.matrix = incomingResult.matrix || adapterResult.matrix;
      incomingResult.quoteMetadata = Array.isArray(adapterResult.quoteMetadata)
        ? (adapterResult.quoteMetadata as QuoteMetadataEntry[]).map((m) =>
            m && typeof m.insurer === 'string'
              ? { ...m, insurer: extractCanonicalInsurerName(m.insurer) }
              : m
          )
        : adapterResult.quoteMetadata;

      const merged = mergeComparisonResults(existingResult, incomingResult);
      merged.id = analysisId;

      const avgConfidence =
        merged.quotes.reduce(
          (sum: number, q: ComparisonResultQuote) => sum + (q.extractionConfidence || 0),
          0
        ) / (merged.quotes.length || 1);

      await updateAnalysisHistory(analysisId, {
        analysis_result: merged,
        unified_result: merged,
        recommendation: merged.recommendation || null,
        total_score: merged.quotes?.[0]?.score || null,
        confidence_score: Math.round(avgConfidence),
      });

      cleanup();
      const auditEnvelope = auditGroundedComparison(merged);
      res.json(auditEnvelope.result);
    } catch (error: unknown) {
      cleanup();
      logger.error({ err: error }, 'Controller Error: appendQuotesToAnalysis failed');
      next(toHttpError(error));
    }
  },

  /**
   * PATCH /api/analysis/:id/status
   * Persists workflow status (DRAFT | SENT | ACCEPTED | REJECTED) in metadata.
   */
  updateAnalysisStatus: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const analysisId = Array.isArray(req.params.id)
        ? req.params.id[0] || ''
        : String(req.params.id || '');
      const status = String((req.body as { status?: unknown })?.status || '').toUpperCase();
      const allowed = new Set(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']);
      if (!analysisId || !allowed.has(status)) {
        res.status(400).json({ error: 'ID o estado inválido.' });
        return;
      }

      const existingRecord = await getAnalysisById(analysisId);
      if (!existingRecord) {
        res.status(404).json({ error: 'Análisis no encontrado.' });
        return;
      }

      const userId = req.user?.id;
      const orgId = req.user?.orgId;
      const role = req.user?.role;
      const recordOrgId = (existingRecord as { org_id?: string | null }).org_id;
      const hasAccess =
        role === 'super_admin' ||
        (userId && existingRecord.user_id === userId) ||
        (orgId && recordOrgId === orgId);

      if (!hasAccess) {
        res.status(403).json({ error: 'No tiene permisos para actualizar este análisis.' });
        return;
      }

      const currentMeta = (existingRecord.metadata as Record<string, unknown> | null) || {};
      const ok = await updateAnalysisHistory(analysisId, {
        metadata: { ...currentMeta, status, statusUpdatedAt: new Date().toISOString() },
      });

      if (!ok) {
        res.status(500).json({ error: 'No se pudo guardar el estado.' });
        return;
      }

      res.json({ id: analysisId, status });
    } catch (error: unknown) {
      next(toHttpError(error));
    }
  },

  getHistory: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // AUTH-2: ownership is derived from the authenticated session; a
      // client-supplied userId query param is a spoofing vector.
      if (req.query.userId !== undefined) {
        res.status(400).json({
          success: false,
          error: 'userId is derived from the authenticated session; do not send it',
        });
        return;
      }

      const userId = req.user?.id ?? 'anonymous';
      const orgId = req.user?.orgId;
      const role = req.user?.role;

      const rawLimit = req.query.limit;
      const rawOffset = req.query.offset;
      const limit = rawLimit !== undefined ? parseInt(rawLimit as string, 10) : 20;
      const offset = rawOffset !== undefined ? parseInt(rawOffset as string, 10) : 0;

      if (Number.isNaN(limit) || Number.isNaN(offset) || limit < 1 || offset < 0) {
        res.status(400).json({ success: false, error: 'Invalid pagination parameters' });
        return;
      }

      const { data, total } = await getAnalysisHistoryByUser(userId, orgId, role, limit, offset);
      res.json({
        success: true,
        data,
        pagination: { limit, offset, total },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching history');
      next(error);
    }
  },
};
