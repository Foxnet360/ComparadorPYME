import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllyEditModal } from '../../../components/users/AllyEditModal';
import type { Ally } from '../../../types';

vi.mock('../../../services/organizationService', () => ({
  organizationService: {
    getCommercialPolicies: vi.fn().mockResolvedValue({
      offerValidityDays: 15,
      paymentConditions: 'Pago de contado o financiado',
      inspectionRequirements: 'Inspección previa',
      issuanceRequirements: 'RUT y SARLAFT',
      claimsPolicy: 'Aviso inmediato',
      intermediationScope: 'Asesoría técnica integral',
    }),
  },
}));

const mockAlly: Ally = {
  id: 'ally-123',
  name: 'Seguros del Valle S.A.S.',
  nit: '900.876.543-1',
  phone: '+57 (602) 888-9900',
  contact_email: 'contacto@segurosdelvalle.com',
  status: 'ACTIVE',
  logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

describe('AllyEditModal — Intermediary logo & format requirements', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AllyEditModal
        isOpen={false}
        onClose={vi.fn()}
        ally={mockAlly}
        onUpdate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with "Editar Intermediario" and displays technical specifications for logo', () => {
    render(
      <AllyEditModal
        isOpen={true}
        onClose={vi.fn()}
        ally={mockAlly}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Editar Intermediario')).toBeTruthy();
    expect(screen.getByText('Logo del Intermediario (PDF y Excel)')).toBeTruthy();
    // Checks that required formats and dimensions are explicitly presented to the user
    expect(screen.getByText(/PNG o JPG\/JPEG/i)).toBeTruthy();
    expect(screen.getByText(/400 × 120 px/i)).toBeTruthy();
    expect(screen.getByText(/2 MB/i)).toBeTruthy();
  });

  it('displays the existing logo image preview when provided in ally', () => {
    render(
      <AllyEditModal
        isOpen={true}
        onClose={vi.fn()}
        ally={mockAlly}
        onUpdate={vi.fn()}
      />
    );

    const img = screen.getByAltText('Logo Intermediario') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('data:image/png;base64');
  });

  it('submits updated logoUrl when saving the intermediary form', async () => {
    const onUpdateMock = vi.fn().mockResolvedValue(undefined);
    render(
      <AllyEditModal
        isOpen={true}
        onClose={vi.fn()}
        ally={mockAlly}
        onUpdate={onUpdateMock}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Actualizar Correduría/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onUpdateMock).toHaveBeenCalledWith(
        'ally-123',
        expect.objectContaining({
          name: 'Seguros del Valle S.A.S.',
          nit: '900.876.543-1',
          logoUrl: mockAlly.logoUrl,
        }),
        expect.anything()
      );
    });
  });

  it('allows removing the logo via the "Quitar" button', async () => {
    const onUpdateMock = vi.fn().mockResolvedValue(undefined);
    render(
      <AllyEditModal
        isOpen={true}
        onClose={vi.fn()}
        ally={mockAlly}
        onUpdate={onUpdateMock}
      />
    );

    const removeBtn = screen.getByRole('button', { name: /Quitar/i });
    fireEvent.click(removeBtn);

    const submitBtn = screen.getByRole('button', { name: /Actualizar Correduría/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onUpdateMock).toHaveBeenCalledWith(
        'ally-123',
        expect.objectContaining({
          logoUrl: undefined,
        }),
        expect.anything()
      );
    });
  });
});
