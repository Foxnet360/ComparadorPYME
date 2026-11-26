import { supabase, handleSupabaseError } from '../config/database';
import { ForbiddenError, NotFoundError } from '../errors';
import type {
  CumplimientoCase,
  CumplimientoCaseStatus,
  CumplimientoCaseType,
  CumplimientoChecklistItem,
  CumplimientoPrepolicyData,
  CumplimientoValidationRecord,
} from '../types/cumplimientoCase';

export interface CumplimientoUserContext {
  userId: string;
  orgId?: string;
  role?: string;
}

function isSuperAdmin(ctx: CumplimientoUserContext): boolean {
  return ctx.role === 'super_admin';
}

function assertCaseAccess(row: CumplimientoCase, ctx: CumplimientoUserContext): void {
  if (isSuperAdmin(ctx)) return;
  if (row.org_id && ctx.orgId && row.org_id === ctx.orgId) return;
  if (row.user_id === ctx.userId) return;
  throw new ForbiddenError('No tiene acceso a este caso de cumplimiento');
}

function deriveHeaderFields(prepolicy: CumplimientoPrepolicyData) {
  return {
    legal_regime: prepolicy.legalRegime || null,
    contract_type: prepolicy.contractType || null,
    contract_number: prepolicy.contractNumber || null,
    contractor_name: prepolicy.contractor?.name || null,
    contractor_nit: prepolicy.contractor?.nit || null,
    entity_name: prepolicy.beneficiary?.name || null,
    entity_nit: prepolicy.beneficiary?.nit || null,
    contract_value: typeof prepolicy.contractValue === 'number' ? prepolicy.contractValue : null,
  };
}

export async function listCumplimientoCases(
  ctx: CumplimientoUserContext
): Promise<CumplimientoCase[]> {
  let query = supabase
    .from('cumplimiento_cases')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!isSuperAdmin(ctx)) {
    if (ctx.orgId) {
      query = query.or(`org_id.eq.${ctx.orgId},user_id.eq.${ctx.userId}`);
    } else {
      query = query.eq('user_id', ctx.userId);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw handleSupabaseError(error);
  }
  return (data || []) as CumplimientoCase[];
}

export async function getCumplimientoCaseById(
  id: string,
  ctx: CumplimientoUserContext
): Promise<CumplimientoCase> {
  const { data, error } = await supabase
    .from('cumplimiento_cases')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new NotFoundError('Caso de cumplimiento no encontrado');
  }

  const row = data as CumplimientoCase;
  assertCaseAccess(row, ctx);
  return row;
}

export async function createCumplimientoCase(
  ctx: CumplimientoUserContext,
  input: {
    caseType: CumplimientoCaseType;
    title: string;
    clientId?: string | null;
    parentCaseId?: string | null;
    policyId?: string | null;
    governingDocumentNames: string[];
    prepolicyData: CumplimientoPrepolicyData;
    checklistData: CumplimientoChecklistItem[];
    status?: CumplimientoCaseStatus;
  }
): Promise<CumplimientoCase> {
  const payload = {
    user_id: ctx.userId,
    org_id: ctx.orgId || null,
    client_id: input.clientId || null,
    parent_case_id: input.parentCaseId || null,
    policy_id: input.policyId || null,
    case_type: input.caseType,
    status: input.status || 'DRAFT',
    title: input.title,
    ...deriveHeaderFields(input.prepolicyData),
    governing_document_names: input.governingDocumentNames,
    prepolicy_data: input.prepolicyData,
    checklist_data: input.checklistData,
    validation_history: [],
  };

  const { data, error } = await supabase
    .from('cumplimiento_cases')
    .insert(payload as never)
    .select('*')
    .single();

  if (error || !data) {
    throw error ? handleSupabaseError(error) : new Error('Error creando caso de cumplimiento');
  }
  return data as CumplimientoCase;
}

export async function updateCumplimientoCase(
  id: string,
  ctx: CumplimientoUserContext,
  patch: {
    title?: string;
    status?: CumplimientoCaseStatus;
    clientId?: string | null;
    prepolicyData?: CumplimientoPrepolicyData;
    checklistData?: CumplimientoChecklistItem[];
  }
): Promise<CumplimientoCase> {
  const existing = await getCumplimientoCaseById(id, ctx);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.clientId !== undefined) updates.client_id = patch.clientId;
  if (patch.checklistData !== undefined) updates.checklist_data = patch.checklistData;
  if (patch.prepolicyData !== undefined) {
    updates.prepolicy_data = patch.prepolicyData;
    Object.assign(updates, deriveHeaderFields(patch.prepolicyData));
  }

  const { data, error } = await supabase
    .from('cumplimiento_cases')
    .update(updates as never)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error || !data) {
    throw error ? handleSupabaseError(error) : new Error('Error actualizando caso');
  }
  return data as CumplimientoCase;
}

export async function appendValidationToCase(
  id: string,
  ctx: CumplimientoUserContext,
  record: CumplimientoValidationRecord
): Promise<CumplimientoCase> {
  const existing = await getCumplimientoCaseById(id, ctx);
  const nextHistory = [record, ...(existing.validation_history || [])];
  const nextStatus: CumplimientoCaseStatus =
    record.overallStatus === 'COMPLIANT' ? 'VALIDATED' : 'QUOTED';

  const { data, error } = await supabase
    .from('cumplimiento_cases')
    .update({
      validation_history: nextHistory,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error || !data) {
    throw error ? handleSupabaseError(error) : new Error('Error guardando validación');
  }
  return data as CumplimientoCase;
}

export async function deleteCumplimientoCase(
  id: string,
  ctx: CumplimientoUserContext
): Promise<void> {
  const existing = await getCumplimientoCaseById(id, ctx);
  const { error } = await supabase.from('cumplimiento_cases').delete().eq('id', existing.id);
  if (error) {
    throw handleSupabaseError(error);
  }
}
