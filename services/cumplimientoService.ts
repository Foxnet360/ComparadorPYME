import { apiClient } from './apiClient';
import type {
  CumplimientoCase,
  CumplimientoCaseStatus,
  CumplimientoCaseType,
  CumplimientoChecklistItem,
  CumplimientoPrepolicyData,
  CumplimientoValidationRecord,
  CumplimientoValidationTarget,
} from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string; error?: string };
      message = err.message || err.error || message;
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function listCumplimientoCases(): Promise<CumplimientoCase[]> {
  return parseOrThrow(await apiClient.fetch('/cumplimiento/cases', { method: 'GET' }));
}

export async function getCumplimientoCase(id: string): Promise<CumplimientoCase> {
  return parseOrThrow(await apiClient.fetch(`/cumplimiento/cases/${id}`, { method: 'GET' }));
}

export async function extractCumplimientoPrepolicy(params: {
  files: File[];
  caseType: CumplimientoCaseType;
  isNewClient: boolean;
  title?: string;
  clientId?: string | null;
}): Promise<CumplimientoCase> {
  const form = new FormData();
  for (const file of params.files) {
    form.append('governingDocument', file);
  }
  form.append('caseType', params.caseType);
  form.append('isNewClient', String(params.isNewClient));
  if (params.title) form.append('title', params.title);
  if (params.clientId) form.append('clientId', params.clientId);

  return parseOrThrow(
    await apiClient.fetch('/cumplimiento/cases/extract', {
      method: 'POST',
      body: form,
    })
  );
}

export async function updateCumplimientoCase(
  id: string,
  patch: {
    title?: string;
    status?: CumplimientoCaseStatus;
    clientId?: string | null;
    prepolicyData?: CumplimientoPrepolicyData;
    checklistData?: CumplimientoChecklistItem[];
  }
): Promise<CumplimientoCase> {
  return parseOrThrow(
    await apiClient.fetch(`/cumplimiento/cases/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    })
  );
}

export async function validateCumplimientoQuotes(params: {
  caseId: string;
  files: File[];
  validationTarget: CumplimientoValidationTarget;
  clauseIds?: string[];
}): Promise<{ validation: CumplimientoValidationRecord; case: CumplimientoCase }> {
  const form = new FormData();
  for (const file of params.files) {
    form.append('quotes', file);
  }
  form.append('validationTarget', params.validationTarget);
  if (params.clauseIds && params.clauseIds.length > 0) {
    form.append('clauseIds', JSON.stringify(params.clauseIds));
  }

  return parseOrThrow(
    await apiClient.fetch(`/cumplimiento/cases/${params.caseId}/validate`, {
      method: 'POST',
      body: form,
    })
  );
}

export async function createCumplimientoModification(params: {
  parentCaseId: string;
  files: File[];
}): Promise<CumplimientoCase> {
  const form = new FormData();
  for (const file of params.files) {
    form.append('governingDocument', file);
  }
  return parseOrThrow(
    await apiClient.fetch(`/cumplimiento/cases/${params.parentCaseId}/modifications`, {
      method: 'POST',
      body: form,
    })
  );
}

export async function deleteCumplimientoCase(id: string): Promise<void> {
  const res = await apiClient.fetch(`/cumplimiento/cases/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    throw new Error(`No se pudo eliminar el caso (${res.status})`);
  }
}
