import { Router } from 'express';
import { insurerController } from '../controllers/insurerController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/** GET /api/insurers — list all Colombian and custom insurers */
router.get('/', asyncHandler(insurerController.listInsurers));

/** POST /api/insurers — create or upsert a custom insurer */
router.post('/', asyncHandler(insurerController.createInsurer));

/** POST /api/insurers/seed — synchronize the 15 official Colombian insurers */
router.post('/seed', asyncHandler(insurerController.seedColombianInsurers));

/** PUT /api/insurers/:id — update an insurer by id or code */
router.put('/:id', asyncHandler(insurerController.updateInsurer));

/** DELETE /api/insurers/:id — deactivate or delete an insurer */
router.delete('/:id', asyncHandler(insurerController.deleteInsurer));

export default router;
