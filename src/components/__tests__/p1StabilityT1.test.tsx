import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

import { renderPageHeader } from '../../../services/pdf/pdfHeader';
import type jsPDF from 'jspdf';
import FileUploader from '../../../components/FileUploader';
import ClauseSelector from '../../../components/ClauseSelector';
import { buildAuditEnrichmentCacheKey } from '../../../hooks/useAuditEnrichment';

vi.mock('../../../services/clauseService', () => ({
  clauseService: {
    getDocuments: vi.fn(async () => [
      {
        id: 'doc-1',
        documentName: 'Clausulado PYME 2026',
        documentType: 'CLAUSULADO_GENERAL',
        version: '1.0',
        isActive: true,
        insurer: {
          id: 'ins-1',
          name: 'SURA',
        },
      },
    ]),
  },
}));

describe('P1 Stability & UX Integrity (T1 / S1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('tailwind.config.cjs scans pages/, src/, contexts/ and defines animate-progress', () => {
    const configText = readFileSync(join(__dirname, '../../../tailwind.config.cjs'), 'utf8');
    expect(configText).toContain('./pages/**/*.{js,ts,jsx,tsx}');
    expect(configText).toContain('./src/**/*.{js,ts,jsx,tsx}');
    expect(configText).toContain('./contexts/**/*.{js,ts,jsx,tsx}');
    expect(configText).toContain('progress');
  });

  it('pdfHeader prioritizes custom options.logoBase64 over profile brokerInfo.logoUrl', () => {
    const addImage = vi.fn();
    const fakeDoc = {
      getCurrentPageInfo: () => ({ pageNumber: 1 }),
      setFillColor: vi.fn(),
      setTextColor: vi.fn(),
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      text: vi.fn(),
      line: vi.fn(),
      setDrawColor: vi.fn(),
      rect: vi.fn(),
      roundedRect: vi.fn(),
      addImage,
    } as unknown as jsPDF;

    renderPageHeader({
      doc: fakeDoc,
      title: 'Test',
      today: '2026-11-22',
      pagesWithHeader: new Set(),
      primaryColor: [79, 70, 229],
      regProfile: {} as never,
      options: {
        logoBase64: 'data:image/png;base64,CUSTOM_MODAL_LOGO',
        brokerInfo: {
          name: 'Ana',
          intermediaryName: 'CSA',
          registrationNumber: '123',
          phone: '123',
          email: 'a@b.com',
          address: 'Calle 1',
          logoUrl: 'data:image/png;base64,PROFILE_LOGO',
        },
      },
    });

    expect(addImage).toHaveBeenCalledWith(
      'data:image/png;base64,CUSTOM_MODAL_LOGO',
      'PNG',
      158,
      6,
      36,
      22,
      undefined,
      'FAST'
    );
  });

  it('ClauseSelector checkbox click does not toggle insurer accordion', async () => {
    const onClausesSelected = vi.fn();
    render(
      <ClauseSelector mode="library" onModeChange={vi.fn()} onClausesSelected={onClausesSelected} />
    );

    await waitFor(() => {
      expect(screen.getByText('Clausulado PYME 2026')).toBeTruthy();
    });

    const groupCheckbox = screen.getByTitle(/seleccionar todos/i);
    fireEvent.click(groupCheckbox);

    // Document row should remain visible (accordion stayed expanded)
    expect(screen.getByText('Clausulado PYME 2026')).toBeTruthy();
  });

  it('FileUploader generates unique ids when title is empty and shows error on unsupported drop', () => {
    const { container } = render(
      <>
        <FileUploader
          title=""
          description="A"
          files={[]}
          onFilesSelected={vi.fn()}
          onRemoveFile={vi.fn()}
        />
        <FileUploader
          title=""
          description="B"
          files={[]}
          onFilesSelected={vi.fn()}
          onRemoveFile={vi.fn()}
        />
      </>
    );

    const inputs = container.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]!.id).not.toBe(inputs[1]!.id);

    const dropzone = container.querySelector('[data-testid="file-dropzone"], .border-dashed')!;
    const badFile = new File(['hello'], 'malware.exe', { type: 'application/x-msdownload' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [badFile] } });

    expect(screen.getByRole('alert').textContent).toMatch(/formato|pdf|imagen/i);
  });

  it('useAuditEnrichment builds distinct cache keys for different analyses with the same insurerName', () => {
    const q1 = [
      {
        insurerName: 'SURA',
        policyName: 'Plan A',
        priceAnnual: 1000000,
        coverages: [{ name: 'Incendio', value: '100M', deductible: '10%' }],
      },
    ] as never;
    const q2 = [
      {
        insurerName: 'SURA',
        policyName: 'Plan B',
        priceAnnual: 2500000,
        coverages: [{ name: 'Incendio', value: '200M', deductible: '5%' }],
      },
    ] as never;

    expect(buildAuditEnrichmentCacheKey(q1)).not.toBe(buildAuditEnrichmentCacheKey(q2));
  });

  it('App enforces auth guard on protected routes and shows recovery UI on /report without report', () => {
    const appSource = readFileSync(join(__dirname, '../../../App.tsx'), 'utf8');
    expect(appSource).toContain('!currentUser');
    expect(appSource).toMatch(/currentView === 'REPORT' && !report/);
  });
});
