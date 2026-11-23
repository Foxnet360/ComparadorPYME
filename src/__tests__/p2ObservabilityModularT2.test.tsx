import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

import { ClauseUploadForm } from '../../components/clauses/ClauseUploadForm';
import { ClausePreviewModal } from '../../components/clauses/ClausePreviewModal';

describe('P2 Observability, Typing & Modularization (T2 / S2)', () => {
  it('migrates console.* calls to Pino logger across targeted backend routes and controllers', () => {
    const files = [
      'server/src/controllers/searchController.ts',
      'server/src/controllers/insurerController.ts',
      'server/src/controllers/analysisValidationController.ts',
      'server/src/controllers/documentController.ts',
      'server/src/controllers/compareController.ts',
      'server/src/controllers/reviewQueueController.ts',
      'server/src/routes/audit.ts',
      'server/src/routes/chat.ts',
      'server/src/routes/comparisonRoutes.ts',
      'server/src/routes/organizationRoutes.ts',
    ];
    for (const rel of files) {
      const content = readFileSync(join(__dirname, '../../', rel), 'utf8');
      expect(content).not.toMatch(/\bconsole\.(log|warn|error|info)\s*\(/);
      expect(content).toContain('logger');
    }
  });

  it('modularizes ClauseAdmin.tsx (<550 LOC) and analysisController.ts (<700 LOC)', () => {
    const clauseAdminLines = readFileSync(
      join(__dirname, '../../components/ClauseAdmin.tsx'),
      'utf8'
    ).split('\n').length;
    const analysisControllerLines = readFileSync(
      join(__dirname, '../../server/src/controllers/analysisController.ts'),
      'utf8'
    ).split('\n').length;

    expect(clauseAdminLines).toBeLessThan(550);
    expect(analysisControllerLines).toBeLessThan(700);
  });

  it('eliminates explicit any casts in ExportModal.tsx and analysisValidationController.ts', () => {
    for (const rel of [
      'components/report/ExportModal.tsx',
      'server/src/controllers/analysisValidationController.ts',
    ]) {
      const text = readFileSync(join(__dirname, '../../', rel), 'utf8');
      expect(text).not.toMatch(/:\s*any\b|as\s+any\b/);
    }
  });

  it('ClauseUploadForm and ClausePreviewModal render and fire interactive callbacks', () => {
    const onClosePreview = vi.fn();
    render(
      <ClausePreviewModal
        doc={{
          id: 'doc-1',
          documentName: 'Clausulado Multirriesgo 2026',
          documentType: 'CLAUSULADO_GENERAL',
          version: '2026.1',
          productName: 'PYME Integral',
          totalPages: 42,
          isActive: true,
          createdAt: '2026-06-01T00:00:00Z',
          domain: 'pyme',
          insurer: { id: 'i1', name: 'SURA' },
        }}
        onClose={onClosePreview}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Clausulado Multirriesgo 2026')).toBeTruthy();
    expect(screen.getByText(/42 págs\./)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /cerrar previsualización/i })[0]);
    expect(onClosePreview).toHaveBeenCalledTimes(1);

    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <ClauseUploadForm
        hasUser={true}
        formData={{
          insurerName: 'SURA',
          documentName: 'Anexo Robo',
          documentType: 'ANEXO',
          productName: '',
          version: '1.0',
          domain: 'pyme',
        }}
        selectedFile={new File(['%PDF'], 'anexo.pdf', { type: 'application/pdf' })}
        uploading={false}
        onFormDataChange={vi.fn()}
        onFileSelect={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^subir$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
