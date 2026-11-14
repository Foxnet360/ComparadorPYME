import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientFormModal } from '../../../components/clients/NewClientModal';
import { storageService } from '../../../services/storageService';
import type { Client } from '../../../types';

vi.mock('../../../services/storageService', () => ({
  storageService: {
    addClient: vi.fn(),
    updateClient: vi.fn(),
  },
}));

vi.mock('../../../src/services/geocodingService', () => ({
  geocodeClientAddress: vi.fn().mockResolvedValue({
    latitude: 4.65,
    longitude: -74.06,
    source: 'address_precise',
    message: 'OK',
  }),
}));

describe('ClientFormModal (unified create & edit)', () => {
  const onClose = vi.fn();
  const onClientCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageService.addClient).mockResolvedValue([]);
    vi.mocked(storageService.updateClient).mockResolvedValue([]);
  });

  it('creates a new client via storageService.addClient', async () => {
    render(
      <ClientFormModal
        isOpen={true}
        onClose={onClose}
        activeDomain="pyme"
        onClientCreated={onClientCreated}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Empresa S\.A\.S\./i), {
      target: { value: 'Acme Colombia SAS' },
    });
    fireEvent.change(screen.getByPlaceholderText(/900\.123\.456-7/i), {
      target: { value: '900111222-3' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Copropiedad \/ Cliente/i }));

    await waitFor(() => {
      expect(storageService.addClient).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(storageService.addClient).mock.calls[0][0]).toMatchObject({
      name: 'Acme Colombia SAS',
      nit: '900111222-3',
    });
    expect(onClientCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates an existing client via storageService.updateClient when editingClient is passed', async () => {
    const existing: Client = {
      id: 'client-123',
      name: 'Torres del Parque',
      nit: '800555444-1',
      city: 'Bogotá D.C.',
      department: 'Bogotá D.C.',
      latitude: 4.6097,
      longitude: -74.0817,
      seismicZone: 'Intermedia',
    };

    render(
      <ClientFormModal
        isOpen={true}
        onClose={onClose}
        activeDomain="copropiedades"
        editingClient={existing}
        onClientCreated={onClientCreated}
      />
    );

    expect(screen.getByText(/Editar Cliente \/ Copropiedad/i)).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Torres del Parque'), {
      target: { value: 'Torres del Parque PH' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => {
      expect(storageService.updateClient).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(storageService.updateClient).mock.calls[0][0]).toMatchObject({
      id: 'client-123',
      name: 'Torres del Parque PH',
      nit: '800555444-1',
    });
    expect(onClientCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
