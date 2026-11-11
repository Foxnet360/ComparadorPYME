import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppFooter } from '../../../components/layout/AppFooter';
import type { UserProfile } from '../../../types';

describe('AppFooter component', () => {
  it('renders official brokerage company name, website, and SFC supervision notice', () => {
    const handleOpenLegalModal = vi.fn();
    render(<AppFooter onOpenLegalModal={handleOpenLegalModal} />);

    // Broker name appears in both column 1 and copyright footer
    expect(screen.getAllByText('Corredores de Seguros Asociados S.A.').length).toBeGreaterThanOrEqual(1);

    // Website link
    const webLink = screen.getByRole('link', { name: /correseguros\.co/i });
    expect(webLink).toBeDefined();
    expect(webLink.getAttribute('href')).toBe('https://correseguros.co/');

    // SFC supervision
    expect(screen.getByText(/Superintendencia Financiera de Colombia/i)).toBeDefined();

    // Siniestros notice
    expect(screen.getByText(/Artículo 1075 del Código de Comercio/i)).toBeDefined();
    expect(screen.getByText(/3 días hábiles/i)).toBeDefined();
  });

  it('renders customized user/advisor data when provided', () => {
    const customUser: UserProfile = {
      name: 'Mauricio Asesor',
      email: 'masesor@correseguros.co',
      phone: '+57 310 999 8888',
      intermediaryName: 'Corredores de Seguros Asociados S.A.',
      registrationNumber: 'SFC-MAT-77665',
    };

    const handleOpenLegalModal = vi.fn();
    render(
      <AppFooter
        currentUser={customUser}
        onOpenLegalModal={handleOpenLegalModal}
      />
    );

    expect(screen.getByText('Mauricio Asesor')).toBeDefined();
    expect(screen.getByText('SFC-MAT-77665')).toBeDefined();
    expect(screen.getByRole('link', { name: /\+57 310 999 8888/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /masesor@correseguros\.co/i })).toBeDefined();
  });

  it('triggers onOpenLegalModal with correct tab when legal buttons are clicked', () => {
    const handleOpenLegalModal = vi.fn();
    render(<AppFooter onOpenLegalModal={handleOpenLegalModal} />);

    // Click Terms
    const termsButton = screen.getByRole('button', {
      name: /Términos y Condiciones del Servicio/i,
    });
    fireEvent.click(termsButton);
    expect(handleOpenLegalModal).toHaveBeenCalledWith('terms');

    // Click Privacy
    const privacyButton = screen.getByRole('button', {
      name: /Política de Privacidad y Habeas Data/i,
    });
    fireEvent.click(privacyButton);
    expect(handleOpenLegalModal).toHaveBeenCalledWith('privacy');

    // Click Security
    const securityButton = screen.getByRole('button', {
      name: /Seguridad de la Información/i,
    });
    fireEvent.click(securityButton);
    expect(handleOpenLegalModal).toHaveBeenCalledWith('security');

    // Click Disclaimer
    const disclaimerButton = screen.getByRole('button', {
      name: /Descargo de Responsabilidad/i,
    });
    fireEvent.click(disclaimerButton);
    expect(handleOpenLegalModal).toHaveBeenCalledWith('disclaimer');

    expect(handleOpenLegalModal).toHaveBeenCalledTimes(4);
  });
});
