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
import { webhookService } from '../services/webhookService';
import {
  analysisJobQueue,
  AnalysisCancelledError,
  AnalysisJobContext,
} from '../services/analysisJobQueue';
import {
  DualExtractionResult,
  ComparisonResultQuote,
  ComparisonResult,
  AnalysisDomainResolution,
  QuoteMetadataEntry,
  toHttpError,
  resolveAnalysisUserId,
  resolveAnalysisDomain,
  resolveClientInfoFromRequest,
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

      const runPipeline = async (jobHooks?: {
        reportProgress?: AnalysisJobContext['reportProgress'];
        signal?: AbortSignal;
      }): Promise<ComparisonResult> => {
        const assertNotCancelled = () => {
          if (jobHooks?.signal?.aborted) {
            throw new AnalysisCancelledError();
          }
        };

        assertNotCancelled();
        await jobHooks?.reportProgress?.(
          'parsing',
          20,
          'Extrayendo contenido y clausulados de PDF...'
        );

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
                policyName: policy.policy_number
                  ? `Póliza ${policy.policy_number}`
                  : 'Póliza Actual',
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
            logger.warn(
              { err: e },
              `Failed to fetch policy ${policyId} for renewal reference quote`
            );
          }
        }

        assertNotCancelled();
        await jobHooks?.reportProgress?.(
          'parsing',
          35,
          'Ejecutando motor de extracción comparativa...'
        );
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
        assertNotCancelled();
        await jobHooks?.reportProgress?.(
          'matching',
          65,
          'Construyendo matriz y normalizando coberturas...'
        );
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

        const { clientName, clientInfo } = resolveClientInfoFromRequest(
          req.body as Record<string, unknown> | undefined,
          adapterResult.quoteMetadata,
          domain
        );
        comparisonResult.domain = domain;
        comparisonResult.clientInfo = clientInfo;

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
          logger.error({ err: saveError }, '❌ [Supabase] Exception saving analysis');
          throw saveError;
        }

        assertNotCancelled();
        await jobHooks?.reportProgress?.('auditing', 90, 'Auditando evidencia y trazabilidad...');

        const duration = Date.now() - startTime;
        logger.info(`✅ Analysis completed in ${duration}ms`);

        const auditEnvelope = auditGroundedComparison(comparisonResult);
        if (userId && userId !== 'anonymous') {
          void webhookService.emitEvent({
            userId,
            orgId: req.user?.orgId,
            event: 'analysis.completed',
            eventId: `analysis.completed:${(comparisonResult as ComparisonResult).id || duration}`,
            data: {
              analysisId: (comparisonResult as ComparisonResult).id ?? null,
              domain,
              quotesCount: comparisonResult.quotes?.length ?? 0,
              durationMs: duration,
            },
          });
        }
        return auditEnvelope.result;
      };

      const preferHeader = String(req.headers?.['prefer'] || '').toLowerCase();
      const wantsAsync =
        preferHeader.includes('respond-async') ||
        req.query?.async === 'true' ||
        (req.body as { async?: unknown } | undefined)?.async === 'true' ||
        (req.body as { async?: unknown } | undefined)?.async === true;

      if (wantsAsync) {
        const apiPrefix = req.originalUrl?.startsWith('/api/v1') ? '/api/v1' : '/api';
        const job = await analysisJobQueue.enqueueJob(
          {
            userId: userId || 'anonymous',
            orgId: authUser?.orgId ?? null,
          },
          (ctx) =>
            runPipeline({
              reportProgress: ctx.reportProgress,
              signal: ctx.signal,
            }),
          cleanupUploadedFiles
        );

        res.status(202).json({
          jobId: job.jobId,
          status: job.stage,
          progress: job.progress,
          statusUrl: `${apiPrefix}/analysis/jobs/${job.jobId}`,
          eventsUrl: `${apiPrefix}/analysis/jobs/${job.jobId}/events`,
          cancelUrl: `${apiPrefix}/analysis/jobs/${job.jobId}/cancel`,
        });
        return;
      }

      const finalResult = await runPipeline();
      cleanupUploadedFiles();
      res.json(finalResult);
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

      if (userId && userId !== 'anonymous') {
        void webhookService.emitEvent({
          userId,
          orgId,
          event: 'analysis.status_changed',
          eventId: `analysis.status_changed:${analysisId}:${status}`,
          data: { analysisId, status },
        });
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
