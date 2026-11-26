/* global document, HTMLAnchorElement */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CumplimientoCase } from '../../../types';

const mockSave = vi.fn();
const mockText = vi.fn();

vi.mock('jspdf', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(function () {
    return {
      setFontSize: vi.fn(),
      text: mockText,
      save: mockSave,
      lastAutoTable: { finalY: 120 },
    };
  }),
}));

vi.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: vi.fn(),
}));

import {
  exportPrepolicyToDocx,
  exportPrepolicyToPdf,
  formatPrepolicyForClipboard,
} from '../../../utils/cumplimientoSlipExport';

const sampleCase: CumplimientoCase = {
  id: 'case-1',
  user_id: 'user-1',
  org_id: 'org-1',
  client_id: null,
  parent_case_id: null,
  policy_id: null,
  case_type: 'CONTRATO',
  status: 'DRAFT',
  title: 'Contrato 045-2026',
  legal_regime: 'ESTATAL_LEY_80',
  contract_type: 'OBRA',
  contract_number: '045-2026',
  contractor_name: 'CONSTRUCTORA ANDINA SAS',
  contractor_nit: '900123456-1',
  entity_name: 'ALCALDIA MUNICIPAL',
  entity_nit: '890980123-4',
  contract_value: 200_000_000,
  governing_document_names: ['minuta.pdf'],
  prepolicy_data: {
    caseType: 'CONTRATO',
    legalRegime: 'ESTATAL_LEY_80',
    contractType: 'OBRA',
    contractNumber: '045-2026',
    objectDescription: 'Construcción cubierta escolar',
    contractValue: 200_000_000,
    contractDuration: '6 meses',
    contractStartDate: '2026-04-01',
    contractEndDate: '2026-10-01',
    displayCurrency: 'BOTH',
    trmValue: 4000,
    smmlvValue: 1_750_905,
    contractor: {
      name: 'CONSTRUCTORA ANDINA SAS',
      nit: '900123456-1',
      personType: 'JURIDICA',
      address: 'Calle 10 # 5-20',
      phone: '3001112233',
    },
    beneficiary: {
      name: 'ALCALDIA MUNICIPAL',
      nit: '890980123-4',
      address: 'Plaza Principal',
      phone: '6012223344',
    },
    requiredCoverages: [
      {
        id: 'cov-1',
        name: 'Cumplimiento',
        phase: 'CONTRACTUAL',
        percentageOfContract: '10%',
        percentageNumeric: 10,
        minimumAmount: 20_000_000,
        estimatedStartDate: '2026-04-01',
        estimatedEndDate: '2026-10-01',
        validityRule: 'Plazo + 4 meses',
        isMandatory: true,
      },
    ],
    rceRequirement: {
      required: true,
      basicPloIncluded: true,
      amountSmmlv: 200,
      amountCop: 350_181_000,
      subcoverages: [],
      additionalCoverages: [
        { code: 'RC_PATRONAL', label: 'RC Patronal', included: true, sublimitSmmlv: 50 },
      ],
      startDate: '2026-04-01',
      endDate: '2026-10-01',
    },
    decreto1082Alerts: [],
  },
  checklist_data: [
    {
      id: 'chk-1',
      code: 'RUT',
      category: 'BASE',
      label: 'RUT actualizado',
      required: true,
      status: 'pending',
    },
  ],
  validation_history: [],
  created_at: '2026-11-25T10:00:00Z',
  updated_at: '2026-11-25T10:00:00Z',
};

describe('cumplimientoSlipExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('formats a clean structured text summary for Email / WhatsApp', () => {
    const text = formatPrepolicyForClipboard(sampleCase);
    expect(text).toContain('SLIP DE SOLICITUD DE COTIZACIÓN');
    expect(text).toContain('CONSTRUCTORA ANDINA SAS');
    expect(text).toContain('900123456-1');
    expect(text).toContain('ALCALDIA MUNICIPAL');
    expect(text).toContain('045-2026');
    expect(text).toContain('Cumplimiento');
    expect(text).toContain('2026-04-01 al 2026-10-01');
    expect(text).toContain('Calle 10 # 5-20');
    expect(text).toContain('6012223344');
    expect(text).toContain('$5,000.00');
    expect(text).toContain('200 SMMLV');
    expect(text).toContain('RC Patronal (50 SMMLV)');
    expect(text).toContain('[Pendiente] RUT actualizado');
  });

  it('exports Pre-policy Slip to PDF via jsPDF', () => {
    exportPrepolicyToPdf(sampleCase);
    expect(mockSave).toHaveBeenCalledWith('slip_contrato_045_2026.pdf');
  });

  it('exports Pre-policy Slip to Word (.docx) Blob', async () => {
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    await exportPrepolicyToDocx(sampleCase);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
