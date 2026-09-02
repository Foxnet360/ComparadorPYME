/**
 * Clients API Routes
 * Endpoints for syncing and retrieving client profiles
 */

import { Router, Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { Database, Json } from '../types/database';

type ClientProfileRow = Database['public']['Tables']['client_profiles']['Row'];
type ClientProfileInsert = Database['public']['Tables']['client_profiles']['Insert'];
type ClientProfileUpdate = Database['public']['Tables']['client_profiles']['Update'];

interface DbError {
  message: string;
}

interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

/**
 * Narrowly typed view of the client_profiles query builder. The generated
 * schema types predate the Relationships metadata supabase-js v2 requires,
 * so untyped from() chains resolve to never; this interface documents the
 * exact operations this router performs.
 */
interface ClientProfilesChain extends PromiseLike<DbResult<ClientProfileRow[]>> {
  select(columns?: string): ClientProfilesChain;
  insert(row: ClientProfileInsert): ClientProfilesChain;
  update(row: ClientProfileUpdate): ClientProfilesChain;
  eq(column: string, value: string): ClientProfilesChain;
  order(column: string, options: { ascending: boolean }): ClientProfilesChain;
  limit(count: number): ClientProfilesChain;
  single(): PromiseLike<DbResult<ClientProfileRow>>;
}

const clientProfiles = (): ClientProfilesChain =>
  supabase.from('client_profiles') as unknown as ClientProfilesChain;

const router = Router();

// AUTH-2: a client-supplied userId (body or query) is never trusted; the
// backend derives ownership from the authenticated session instead.
const hasClientSuppliedUserId = (req: AuthenticatedRequest): boolean =>
  req.query.userId !== undefined ||
  (req.body !== undefined &&
    typeof req.body === 'object' &&
    (req.body as Record<string, unknown>).userId !== undefined);

const rejectClientSuppliedUserId = (req: AuthenticatedRequest, res: Response): boolean => {
  if (!hasClientSuppliedUserId(req)) {
    return false;
  }
  res.status(400).json({
    error: 'Bad Request',
    message: 'userId is derived from the authenticated session; do not send it',
  });
  return true;
};

/**
 * GET /api/clients
 * Retrieve all clients synced under the authenticated user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) {
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.json([]);
    }

    const { data, error } = await clientProfiles()
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [Clients API] Failed to fetch clients:', error);
      return res.status(500).json({ error: 'Database error', message: error.message });
    }

    // Transform database records back to frontend Client structures.
    const clients = (data ?? []).map((row) => {
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

    return res.json(clients);
  })
);

/**
 * POST /api/clients
 * Sync/persist a client profile under the authenticated user
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) {
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(200).json({ message: 'Saved locally' });
    }

    const client = req.body;
    if (!client || !client.name) {
      return res.status(400).json({ error: 'Bad Request', message: 'Client name is required' });
    }

    const profile: ClientProfileInsert = {
      user_id: userId,
      client_name: client.name as string,
      primary_activity: (client.industry as string | undefined) || null,
      location_city: (client.location_city as string | undefined) || null,
      raw_client_data: client as Json,
      updated_at: new Date().toISOString(),
    };

    // Check if client with same name already exists for this user to avoid duplication
    const { data: existing, error: checkError } = await clientProfiles()
      .select('id')
      .eq('user_id', userId)
      .eq('client_name', client.name as string)
      .limit(1);

    if (checkError) {
      console.warn('⚠️ [Clients API] Failed to check existing client:', checkError);
    }

    let resultData: ClientProfileRow | null;
    if (existing && existing.length > 0) {
      // Update existing
      const { data: updateData, error: updateError } = await clientProfiles()
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
      const { data: insertData, error: insertError } = await clientProfiles()
        .insert(profile)
        .select('*')
        .single();

      if (insertError) {
        console.error('❌ [Clients API] Failed to insert client:', insertError);
        return res.status(500).json({ error: 'Database error', message: insertError.message });
      }
      resultData = insertData;
    }

    return res.status(201).json(resultData?.raw_client_data || client);
  })
);

export default router;
