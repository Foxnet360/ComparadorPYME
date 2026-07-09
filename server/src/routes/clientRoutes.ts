/**
 * Clients API Routes
 * Endpoints for syncing and retrieving client profiles
 */

import { Router } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/clients
 * Retrieve all clients synced under the authenticated user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const { data, error } = await (supabase as any)
      .from('client_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [Clients API] Failed to fetch clients:', error);
      return res.status(500).json({ error: 'Database error', message: error.message });
    }

    // Transform database records back to frontend Client structures
    const clients = (data || []).map((row: any) => {
      if (row.raw_client_data && typeof row.raw_client_data === 'object') {
        return row.raw_client_data;
      }
      return {
        id: row.id,
        name: row.client_name || '',
        nit: '',
        industry: row.primary_activity || '',
      };
    });

    res.json(clients);
  })
);

/**
 * POST /api/clients
 * Sync/persist a client profile under the authenticated user
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const client = req.body;
    if (!client || !client.name) {
      return res.status(400).json({ error: 'Bad Request', message: 'Client name is required' });
    }

    const profile = {
      user_id: userId,
      client_name: client.name,
      primary_activity: client.industry || null,
      location_city: client.location_city || null,
      raw_client_data: client,
      updated_at: new Date().toISOString(),
    };

    // Check if client with same name already exists for this user to avoid duplication
    const { data: existing, error: checkError } = await (supabase as any)
      .from('client_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('client_name', client.name)
      .limit(1);

    if (checkError) {
      console.warn('⚠️ [Clients API] Failed to check existing client:', checkError);
    }

    let resultData;
    if (existing && existing.length > 0) {
      // Update existing
      const { data: updateData, error: updateError } = await (supabase as any)
        .from('client_profiles')
        .update(profile)
        .eq('id', existing[0].id)
        .select('*')
        .single();

      if (updateError) {
        console.error('❌ [Clients API] Failed to update client:', updateError);
        return res.status(500).json({ error: 'Database error', message: updateError.message });
      }
      resultData = updateData;
    } else {
      // Insert new
      const { data: insertData, error: insertError } = await (supabase as any)
        .from('client_profiles')
        .insert(profile)
        .select('*')
        .single();

      if (insertError) {
        console.error('❌ [Clients API] Failed to insert client:', insertError);
        return res.status(500).json({ error: 'Database error', message: insertError.message });
      }
      resultData = insertData;
    }

    res.status(201).json(resultData?.raw_client_data || client);
  })
);

export default router;
