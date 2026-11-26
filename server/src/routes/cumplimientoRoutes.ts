import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { rejectClientSuppliedUserId } from '../middleware/validateRequest';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../errors';
import { extractPrepolicyFromDocuments } from '../services/governingDocumentExtractor';
import { getOfficialTrm } from '../services/trmService';
import { COLOMBIA_SMMLV_2026 } from '../utils/colombianCalendar';
import {
  buildDefaultComplianceChecklist,
  evaluateDecreto1082Rules,
  extractQuoteSummaryForCumplimiento,
  validateQuotesAgainstPrepolicy,
} from '../services/cumplimientoAuditService';
import {
  appendValidationToCase,
  createCumplimientoCase,
  deleteCumplimientoCase,
  getCumplimientoCaseById,
  listCumplimientoCases,
  updateCumplimientoCase,
} from '../services/cumplimientoCaseService';
import type {
  CumplimientoCaseStatus,
  CumplimientoCaseType,
  CumplimientoChecklistItem,
  CumplimientoPrepolicyData,
  CumplimientoValidationTarget,
} from '../types/cumplimientoCase';

const uploadDir =
  process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const pdfUpload = multer({
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype === 'application/pdf' && ext === '.pdf') {
      cb(null, true);
      return;
    }
    cb(new Error('Solo se permiten archivos PDF'));
  },
});

function cleanupTempFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // Ignore cleanup failure
      }
    }
  }
}

function getUserContext(req: AuthenticatedRequest) {
  return {
    userId: requireUser(req),
    orgId: req.user?.orgId,
    role: req.user?.role,
  };
}

const router = Router();

/** GET /api/cumplimiento/trm — Official daily COP/USD TRM + 2026 SMMLV reference */
router.get(
  '/trm',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    requireUser(req);
    const trm = await getOfficialTrm();
    res.json({ ...trm, smmlv2026: COLOMBIA_SMMLV_2026 });
  })
);

/** GET /api/cumplimiento/cases */
router.get(
  '/cases',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    const cases = await listCumplimientoCases(getUserContext(req));
    res.json(cases);
  })
);

/** POST /api/cumplimiento/cases/extract — Momento 1: Documento Rector -> Pre-póliza editable + Checklist */
router.post(
  '/cases/extract',
  pdfUpload.array('governingDocument', 3),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      throw new ValidationError(
        'Debe adjuntar al menos un Documento Rector en PDF (Contrato, Pliego o Minuta).'
      );
    }

    try {
      const ctx = getUserContext(req);
      const rawType = String(req.body?.caseType || 'CONTRATO').toUpperCase();
      const caseType: CumplimientoCaseType =
        rawType === 'LICITACION' || rawType === 'OTROSI' ? rawType : 'CONTRATO';
      const isNewClient = req.body?.isNewClient !== 'false' && req.body?.isNewClient !== false;
      const clientId =
        typeof req.body?.clientId === 'string' && req.body.clientId ? req.body.clientId : null;

      const prepolicy = await extractPrepolicyFromDocuments(files, caseType);
      const checklist = buildDefaultComplianceChecklist(prepolicy, isNewClient);

      const defaultTitle =
        [
          prepolicy.contractNumber ? `${caseType} ${prepolicy.contractNumber}` : caseType,
          prepolicy.beneficiary.name ||
            prepolicy.contractor.name ||
            files[0]?.originalname.replace(/\.pdf$/i, ''),
        ]
          .filter(Boolean)
          .join(' · ') || 'Caso de Cumplimiento';

      const created = await createCumplimientoCase(ctx, {
        caseType,
        title:
          typeof req.body?.title === 'string' && req.body.title.trim()
            ? req.body.title.trim()
            : defaultTitle,
        clientId,
        governingDocumentNames: files.map((f) => f.originalname),
        prepolicyData: prepolicy,
        checklistData: checklist,
      });

      res.status(201).json(created);
    } finally {
      cleanupTempFiles(files);
    }
  })
);

/** GET /api/cumplimiento/cases/:id */
router.get(
  '/cases/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    const item = await getCumplimientoCaseById(String(req.params.id), getUserContext(req));
    res.json(item);
  })
);

/** PATCH /api/cumplimiento/cases/:id */
router.patch(
  '/cases/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    const ctx = getUserContext(req);
    const body = (req.body || {}) as {
      title?: string;
      status?: CumplimientoCaseStatus;
      clientId?: string | null;
      prepolicyData?: CumplimientoPrepolicyData;
      checklistData?: CumplimientoChecklistItem[];
    };

    let prepolicyData = body.prepolicyData;
    if (prepolicyData) {
      prepolicyData = {
        ...prepolicyData,
        decreto1082Alerts: evaluateDecreto1082Rules(prepolicyData),
      };
    }

    const updated = await updateCumplimientoCase(String(req.params.id), ctx, {
      title: body.title,
      status: body.status,
      clientId: body.clientId,
      prepolicyData,
      checklistData: body.checklistData,
    });
    res.json(updated);
  })
);

/** POST /api/cumplimiento/cases/:id/validate — Momento 2: Validar 1+ cotización o borrador contra Pre-póliza */
router.post(
  '/cases/:id/validate',
  pdfUpload.array('quotes', 5),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      throw new ValidationError(
        'Debe adjuntar al menos una cotización, borrador de póliza o anexo en PDF.'
      );
    }

    try {
      const ctx = getUserContext(req);
      const existing = await getCumplimientoCaseById(String(req.params.id), ctx);
      const rawTarget = String(req.body?.validationTarget || 'COTIZACION').toUpperCase();
      const validationTarget: CumplimientoValidationTarget =
        rawTarget === 'BORRADOR_POLIZA' || rawTarget === 'ANEXO_MODIFICACION'
          ? rawTarget
          : 'COTIZACION';

      let clauseIdsUsed: string[] = [];
      if (typeof req.body?.clauseIds === 'string' && req.body.clauseIds.trim()) {
        try {
          const parsed = JSON.parse(req.body.clauseIds);
          if (Array.isArray(parsed)) clauseIdsUsed = parsed.map(String);
        } catch {
          clauseIdsUsed = req.body.clauseIds
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
      }

      const extractedQuotes = await Promise.all(
        files.map((f) => extractQuoteSummaryForCumplimiento(f))
      );

      const record = validateQuotesAgainstPrepolicy(
        existing.prepolicy_data,
        extractedQuotes,
        validationTarget,
        clauseIdsUsed
      );

      const updatedCase = await appendValidationToCase(existing.id, ctx, record);
      res.json({ validation: record, case: updatedCase });
    } finally {
      cleanupTempFiles(files);
    }
  })
);

/** POST /api/cumplimiento/cases/:id/modifications — Momento 3: Crear Otrosí vinculado al caso base */
router.post(
  '/cases/:id/modifications',
  pdfUpload.array('governingDocument', 3),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      throw new ValidationError('Debe adjuntar el PDF del Otrosí o solicitud de modificación.');
    }

    try {
      const ctx = getUserContext(req);
      const parent = await getCumplimientoCaseById(String(req.params.id), ctx);
      const prepolicy = await extractPrepolicyFromDocuments(files, 'OTROSI', parent.prepolicy_data);
      const checklist = buildDefaultComplianceChecklist(prepolicy, false);

      const child = await createCumplimientoCase(ctx, {
        caseType: 'OTROSI',
        title: `Otrosí · ${parent.title}`,
        clientId: parent.client_id,
        parentCaseId: parent.id,
        policyId: parent.policy_id,
        governingDocumentNames: files.map((f) => f.originalname),
        prepolicyData: prepolicy,
        checklistData: checklist,
        status: 'MODIFICATION_PENDING',
      });

      res.status(201).json(child);
    } finally {
      cleanupTempFiles(files);
    }
  })
);

/** DELETE /api/cumplimiento/cases/:id */
router.delete(
  '/cases/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) return;
    await deleteCumplimientoCase(String(req.params.id), getUserContext(req));
    res.status(204).send();
  })
);

export default router;
