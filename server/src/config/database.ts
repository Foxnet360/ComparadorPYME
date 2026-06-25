import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import WebSocket from 'ws';

// Opciones para Node.js 20 (sin WebSocket nativo)
const realtimeOptions = {
  transport: WebSocket as any,
};

/**
 * Factory: Crea el cliente de Supabase con Service Role.
 * Valida variables de entorno y lanza error descriptivo si faltan.
 */
export function createSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase configuration incomplete: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    );
  }
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: realtimeOptions,
  });
}

/**
 * Factory: Crea el cliente anónimo de Supabase.
 * Retorna null si falta SUPABASE_ANON_KEY.
 */
export function createSupabaseAnonClient(): SupabaseClient<Database> | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: realtimeOptions,
  });
}

// Proxy singleton para lazy initialization del cliente principal
let _supabaseInstance: SupabaseClient<Database> | null = null;

function getSupabaseInstance(): SupabaseClient<Database> {
  if (!_supabaseInstance) {
    _supabaseInstance = createSupabaseClient();
    console.log('📦 [Supabase] Client initialized for project:', process.env.SUPABASE_URL);
  }
  return _supabaseInstance;
}

export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const instance = getSupabaseInstance();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

// Proxy singleton para lazy initialization del cliente anónimo
let _supabaseAnonInstance: SupabaseClient<Database> | null = null;

function getSupabaseAnonInstance(): SupabaseClient<Database> | null {
  if (_supabaseAnonInstance === null) {
    _supabaseAnonInstance = createSupabaseAnonClient();
  }
  return _supabaseAnonInstance;
}

export const supabaseAnon: SupabaseClient<Database> | null = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop) {
      const instance = getSupabaseAnonInstance();
      if (!instance) {
        return undefined;
      }
      const value = (instance as any)[prop];
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    },
  }
) as any;

// Verificar conexión
export async function verifySupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('insurers').select('count').limit(1);
    if (error) throw error;
    console.log('✅ [Supabase] Connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] Connection failed:', error);
    return false;
  }
}

// Helper para manejar errores de Supabase
export function handleSupabaseError(error: any): Error {
  if (error.code === '23505') {
    return new Error('Duplicate entry: El documento ya existe');
  }
  if (error.code === '23503') {
    return new Error('Foreign key violation: Referencia inválida');
  }
  if (error.message?.includes('bucket')) {
    return new Error('Storage error: ' + error.message);
  }
  return new Error(error.message || 'Database error');
}
