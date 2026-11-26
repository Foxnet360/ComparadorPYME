import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CumplimientoWorkspace } from '../../../components/cumplimiento/CumplimientoWorkspace';
import type { CumplimientoCase } from '../../../types';

const mockListCases = vi.fn();
const mockExtractPrepolicy = vi.fn();
const mockUpdateCase = vi.fn();

vi.mock('../../../services/cumplimientoService', () => ({
  listCumplimientoCases: (...args: unknown[]) => mockListCases(...args),
  extractCumplimientoPrepolicy: (...args: unknown[]) => mockExtractPrepolicy(...args),
  updateCumplimientoCase: (...args: unknown[]) => mockUpdateCase(...args),
  validateCumplimientoQuotes: vi.fn(),
  createCumplimientoModification: vi.fn(),
  deleteCumplimientoCase: vi.fn(),
}));

vi.mock('../../../components/ClauseSelector', () => ({
  ClauseSelector: () => <div data-testid="clause-selector" />,
}));

vi.mock('../../../utils/cumplimientoSlipExport', () => ({
  exportPrepolicyToPdf: vi.fn(),
  exportPrepolicyToDocx: vi.fn(),
  formatPrepolicyForClipboard: vi.fn(() => 'SLIP MOCK'),
}));

const sampleCase: CumplimientoCase = {
  id: 'case-1',
  user_id: 'user-1',
  org_id: 'org-1',
  client_id: null,
  parent_case_id: null,
  policy_id: null,
  case_type: 'CONTRATO',
  status: 'DRAFT',
  title: 'CONTRATO 045 · Alcaldía Prueba',
  legal_regime: 'ESTATAL_LEY_80',
  contract_type: 'OBRA',
  contract_number: '045-2026',
  contractor_name: 'CONSTRUCTORA ANDINA SAS',
  contractor_nit: '900123456-1',
  entity_name: 'ALCALDIA DE PRUEBA',
  entity_nit: '890980123-4',
  contract_value: 200_000_000,
  governing_document_names: ['contrato_045.pdf'],
  prepolicy_data: {
    caseType: 'CONTRATO',
    legalRegime: 'ESTATAL_LEY_80',
    contractType: 'OBRA',
    contractNumber: '045-2026',
    objectDescription: 'Construcción de cubierta escolar',
    contractValue: 200_000_000,
    contractDuration: '6 meses',
    contractor: {
      name: 'CONSTRUCTORA ANDINA SAS',
      nit: '900123456-1',
      personType: 'JURIDICA',
    },
    beneficiary: {
      name: 'ALCALDIA DE PRUEBA',
      nit: '890980123-4',
    },
    requiredCoverages: [
      {
        id: 'cov-1',
        name: 'Cumplimiento',
        percentageOfContract: '10%',
        percentageNumeric: 10,
        minimumAmount: 20_000_000,
        validityRule: 'Plazo + 4 meses',
        isMandatory: true,
      },
    ],
    decreto1082Alerts: [],
  },
  checklist_data: [
    {
      id: 'chk-1',
      code: 'CAMARA_COMERCIO_30D',
      category: 'JURIDICA',
      label: 'Cámara de Comercio <= 30 días',
      required: true,
      status: 'pending',
      maxAgeDays: 30,
    },
  ],
  validation_history: [],
  created_at: '2026-11-25T10:00:00Z',
  updated_at: '2026-11-25T10:00:00Z',
};

describe('CumplimientoWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads saved cases and opens editable Pre-póliza detail with 3 tabs', async () => {
    mockListCases.mockResolvedValue([sampleCase]);
    render(<CumplimientoWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('CONTRATO 045 · Alcaldía Prueba')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('CONTRATO 045 · Alcaldía Prueba'));
    expect(screen.getByTestId('cumplimiento-case-detail')).toBeTruthy();
    expect(screen.getByText('PDF Slip')).toBeTruthy();
    expect(screen.getByText('Word (.docx)')).toBeTruthy();
    expect(screen.getByText('Correo / WhatsApp')).toBeTruthy();

    fireEvent.click(screen.getByText('2. Checklist Cupo y SARLAFT'));
    expect(screen.getByText('Cámara de Comercio <= 30 días')).toBeTruthy();

    fireEvent.click(screen.getByText('3. Validar Cotización / Borrador'));
    expect(screen.getByText('Ejecutar Auditoría Campo a Campo')).toBeTruthy();
  });
});
