import { Router } from 'express';
import { insurerController } from '../controllers/insurerController';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

/** GET /api/insurers — list all Colombian and custom insurers (public catalog) */
router.get('/', asyncHandler(insurerController.listInsurers));

/** POST /api/insurers — create or upsert a custom insurer (super_admin only) */
router.post('/', authMiddleware, requireRole('super_admin'), asyncHandler(insurerController.createInsurer));

/** POST /api/insurers/seed — synchronize the 15 official Colombian insurers (super_admin only) */
router.post('/seed', authMiddleware, requireRole('super_admin'), asyncHandler(insurerController.seedColombianInsurers));

/** PUT /api/insurers/:id — update an insurer by id or code (super_admin only) */
router.put('/:id', authMiddleware, requireRole('super_admin'), asyncHandler(insurerController.updateInsurer));

/** DELETE /api/insurers/:id — deactivate or delete an insurer (super_admin only) */
router.delete('/:id', authMiddleware, requireRole('super_admin'), asyncHandler(insurerController.deleteInsurer));

export default router;
