import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

import { Modal } from '../../../components/common/Modal';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { AppHeader } from '../../../components/layout/AppHeader';
import ClientSelector from '../../../components/ClientSelector';
import { SummaryTab } from '../../../components/report/SummaryTab';
import { ExportModal } from '../../../components/report/ExportModal';
import RenewalDetailPage from '../../../pages/RenewalDetail';

vi.mock('../../../services/storageService', () => ({
  storageService: {
    getClients: vi.fn(async () => [
      { id: 'c1', name: 'Edificio Mirador PH', nit: '900123456', city: 'Bogotá' },
    ]),
    getCurrentUser: vi.fn(async () => null),
  },
}));

vi.mock('../../../services/portfolioService', () => ({
  listRenewals: vi.fn(async () => [
    {
      id: 'ren-1',
      policy_id: 'pol-1',
      cycle_start: '2026-12-31',
      state: 'notified',
    },
  ]),
  listRenewalEvents: vi.fn(async () => []),
  transitionRenewal: vi.fn(),
}));

describe('P1 Accessibility, Responsive & Copy Standardization (T2 / S2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    }
  });

  it('Modal renders dialog semantics and closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Prueba Accesible">
        <p>Contenido del modal</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ConfirmModal closes when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirmar acción"
        message="¿Continuar?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('AppHeader uses accessible buttons, aria-labels, and mobile menu toggle', () => {
    render(
      <AppHeader
        currentUser={{
          id: 'u1',
          name: 'Ana Gómez',
          email: 'ana@csa.co',
          role: 'analyst',
          avatarUrl: '',
        }}
        currentView="ANALYZER"
        showChatButton={true}
        chatOpen={false}
        onNavigateDashboard={vi.fn()}
        onOpenClients={vi.fn()}
        onOpenPortfolio={vi.fn()}
        onOpenAnalytics={vi.fn()}
        onOpenUsers={vi.fn()}
        onOpenInsurers={vi.fn()}
        onOpenClauseAdmin={vi.fn()}
        onToggleChat={vi.fn()}
        onOpenProfile={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /clientes/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeTruthy();
    const mobileToggle = screen.getByRole('button', { name: /menú/i });
    expect(mobileToggle).toBeTruthy();
    fireEvent.click(mobileToggle);
    expect(screen.getAllByRole('button', { name: /clientes/i }).length).toBeGreaterThanOrEqual(2);
  });

  it('ClientSelector uses semantic button trigger instead of div', async () => {
    render(<ClientSelector selectedClient={null} onSelectClient={vi.fn()} />);

    const trigger = await screen.findByRole('button', { name: /seleccionar cliente/i });
    expect(trigger.tagName).toBe('BUTTON');
    fireEvent.click(trigger);

    await waitFor(() => {
      const createBtn = screen.getByRole('button', { name: /crear nuevo cliente/i });
      expect(createBtn.tagName).toBe('BUTTON');
    });
  });

  it('ExportModal exposes dialog role, responsive max-width, Escape close, and color aria-labels', () => {
    const onClose = vi.fn();
    const report = {
      id: 'rep-1',
      clientName: 'Cliente Demo',
      bestOption: 'SURA',
      recommendation: 'Buena cobertura',
      quotes: [],
      matrix: [],
    } as never;

    render(
      <ExportModal
        report={report}
        pdfOptions={{ title: 'Reporte', logo: undefined, color: [79, 70, 229] }}
        onPdfOptionsChange={vi.fn()}
        cellNotes={{}}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toContain('max-w-[calc(100vw-2rem)]');
    const colorButtons = screen.getAllByRole('button', { name: /color/i });
    expect(colorButtons.length).toBeGreaterThanOrEqual(4);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('RenewalDetail renders Spanish human labels instead of raw enums', async () => {
    render(<RenewalDetailPage renewalId="ren-1" onBack={vi.fn()} />);
    await screen.findByText('Notificada');
    expect(screen.queryByText(/Avanzar a in_review/)).toBeNull();
    expect(screen.getByText(/Avanzar a En revisión/i)).toBeTruthy();
  });

  it('SummaryTab uses unique keys and marks only exact bestQuote reference when insurerName matches', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const q1 = {
      insurerName: 'Seguros SURA',
      policyName: 'Plan Esencial',
      priceAnnual: 1200000,
      priceFormatted: '$1.200.000',
      deductible: '10%',
      score: 88,
      recommendationReason: 'Buena',
      coverages: [],
      strengths: [],
      weaknesses: [],
    } as never;
    const q2 = {
      insurerName: 'Seguros SURA',
      policyName: 'Plan Plus',
      priceAnnual: 1800000,
      priceFormatted: '$1.800.000',
      deductible: '5%',
      score: 95,
      recommendationReason: 'Excelente',
      coverages: [],
      strengths: [],
      weaknesses: [],
    } as never;

    render(
      <SummaryTab
        quotes={[q1, q2]}
        bestQuote={q2}
        recommendation="Plan Plus recomendado"
        viewMode="technical"
        onCorrection={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    const duplicateKeyCalls = errorSpy.mock.calls.filter((args) =>
      args.some((a) => typeof a === 'string' && a.includes('same key'))
    );
    expect(duplicateKeyCalls).toHaveLength(0);
    expect(screen.getAllByText(/^MEJOR OPCIÓN$/)).toHaveLength(1);
    errorSpy.mockRestore();
  });

  it('UI components use neutral Spanish copy without Rioplatense voseo', () => {
    const files = [
      '../../../components/FileUploader.tsx',
      '../../../components/ClientManager.tsx',
      '../../../components/TechnicalDashboard.tsx',
    ];
    for (const rel of files) {
      const content = readFileSync(join(__dirname, rel), 'utf8');
      expect(content).not.toMatch(/\b(Podés|Iniciá|Seleccioná|Visualizá|gestioná|Probá|Hacé)\b/);
    }
  });
});
