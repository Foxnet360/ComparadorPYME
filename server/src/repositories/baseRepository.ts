/**
 * Base Repository
 * Common database operations and error handling
 */

import { supabase } from '../config/database';
import { PostgrestError } from '@supabase/supabase-js';

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: PostgrestError
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export function handleDbError(error: PostgrestError | null, context: string): void {
  if (error) {
    console.error(`❌ [Repository] ${context}:`, error);
    throw new RepositoryError(
      `${context} failed: ${error.message}`,
      error.code,
      error
    );
  }
}

export { supabase };
