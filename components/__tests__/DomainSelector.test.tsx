import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DomainSelector from '../DomainSelector';

describe('DomainSelector Component', () => {
  it('renders all domain options with accessible labels', () => {
    render(<DomainSelector selectedDomain="pyme" onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: /seleccionar ramo de seguro/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /pyme \/ comercial/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /seguro de autos/i })).toBeTruthy();
  });

  it('reflects default / selected value ("pyme")', () => {
    render(<DomainSelector selectedDomain="pyme" onChange={vi.fn()} />);

    const pymeBtn = screen.getByRole('radio', { name: /pyme \/ comercial/i });
    const autosBtn = screen.getByRole('radio', { name: /seguro de autos/i });

    expect(pymeBtn.getAttribute('aria-checked')).toBe('true');
    expect(autosBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('reflects selected value ("autos")', () => {
    render(<DomainSelector selectedDomain="autos" onChange={vi.fn()} />);

    const pymeBtn = screen.getByRole('radio', { name: /pyme \/ comercial/i });
    const autosBtn = screen.getByRole('radio', { name: /seguro de autos/i });

    expect(pymeBtn.getAttribute('aria-checked')).toBe('false');
    expect(autosBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('triggers onChange callback when selecting a new domain', () => {
    const handleChange = vi.fn();
    render(<DomainSelector selectedDomain="pyme" onChange={handleChange} />);

    const autosBtn = screen.getByRole('radio', { name: /seguro de autos/i });
    fireEvent.click(autosBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('autos');
  });

  it('does not trigger onChange when clicked while disabled', () => {
    const handleChange = vi.fn();
    render(<DomainSelector selectedDomain="pyme" onChange={handleChange} disabled={true} />);

    const autosBtn = screen.getByRole('radio', { name: /seguro de autos/i });
    expect(autosBtn).toHaveProperty('disabled', true);

    fireEvent.click(autosBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
