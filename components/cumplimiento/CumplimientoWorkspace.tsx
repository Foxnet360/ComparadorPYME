import React, { useCallback, useEffect, useState } from 'react';
import { CumplimientoCaseList } from './CumplimientoCaseList';
import { CumplimientoCaseDetail } from './CumplimientoCaseDetail';
import {
  createCumplimientoModification,
  deleteCumplimientoCase,
  extractCumplimientoPrepolicy,
  listCumplimientoCases,
  updateCumplimientoCase,
  validateCumplimientoQuotes,
} from '../../services/cumplimientoService';
import type {
  CumplimientoCase,
  CumplimientoCaseStatus,
  CumplimientoCaseType,
  CumplimientoChecklistItem,
  CumplimientoPrepolicyData,
  CumplimientoValidationTarget,
} from '../../types';

export const CumplimientoWorkspace: React.FC = () => {
  const [cases, setCases] = useState<CumplimientoCase[]>([]);
  const [activeCase, setActiveCase] = useState<CumplimientoCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [creatingMod, setCreatingMod] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listCumplimientoCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron cargar los casos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const handleCreateFromDocuments = async (params: {
    files: File[];
    caseType: CumplimientoCaseType;
    isNewClient: boolean;
  }) => {
    setExtracting(true);
    setErrorMsg(null);
    try {
      const created = await extractCumplimientoPrepolicy(params);
      setCases((prev) => [created, ...prev]);
      setActiveCase(created);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error extrayendo Pre-póliza');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async (patch: {
    title?: string;
    status?: CumplimientoCaseStatus;
    prepolicyData?: CumplimientoPrepolicyData;
    checklistData?: CumplimientoChecklistItem[];
  }) => {
    if (!activeCase) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const updated = await updateCumplimientoCase(activeCase.id, patch);
      setActiveCase(updated);
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error guardando el caso');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (params: {
    files: File[];
    validationTarget: CumplimientoValidationTarget;
    clauseIds: string[];
  }) => {
    if (!activeCase) return;
    setValidating(true);
    setErrorMsg(null);
    try {
      const { case: updated } = await validateCumplimientoQuotes({
        caseId: activeCase.id,
        files: params.files,
        validationTarget: params.validationTarget,
        clauseIds: params.clauseIds,
      });
      setActiveCase(updated);
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error validando cotización/borrador');
    } finally {
      setValidating(false);
    }
  };

  const handleCreateModification = async (files: File[]) => {
    if (!activeCase) return;
    setCreatingMod(true);
    setErrorMsg(null);
    try {
      const child = await createCumplimientoModification({
        parentCaseId: activeCase.id,
        files,
      });
      setCases((prev) => [child, ...prev]);
      setActiveCase(child);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creando Otrosí');
    } finally {
      setCreatingMod(false);
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      await deleteCumplimientoCase(id);
      setCases((prev) => prev.filter((c) => c.id !== id));
      if (activeCase?.id === id) setActiveCase(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error eliminando caso');
    }
  };

  return (
    <div className="space-y-4" data-testid="cumplimiento-workspace">
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      {activeCase ? (
        <CumplimientoCaseDetail
          key={activeCase.id}
          caseRecord={activeCase}
          saving={saving}
          validating={validating}
          creatingMod={creatingMod}
          onBack={() => setActiveCase(null)}
          onSave={handleSave}
          onValidate={handleValidate}
          onCreateModification={handleCreateModification}
        />
      ) : (
        <CumplimientoCaseList
          cases={cases}
          loading={loading}
          extracting={extracting}
          onSelectCase={setActiveCase}
          onDeleteCase={handleDelete}
          onCreateFromDocuments={handleCreateFromDocuments}
        />
      )}
    </div>
  );
};
