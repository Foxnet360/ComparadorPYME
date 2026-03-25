import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ [Supabase Config] Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Supabase configuration incomplete');
}

// Cliente con Service Role (privilegios completos - solo backend)
export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Cliente anónimo (solo para operaciones públicas si es necesario)
export const supabaseAnon = process.env.SUPABASE_ANON_KEY 
  ? createClient<Database>(
      SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null;

// Verificar conexión
export async function verifySupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('insurers').select('count').limit(1);
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

console.log('📦 [Supabase] Client initialized for project:', SUPABASE_URL);
