import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeductibleBadge, parseDeductibleForBadge } from '../../../components/DeductibleBadge';

describe('parseDeductibleForBadge', () => {
  it('correctly handles free/included/no-deductible formats', () => {
    const config = parseDeductibleForBadge('No aplica');
    expect(config.riskLevel).toBe('none');
    expect(config.label).toBe('Sin deducible');
  });

  it('correctly parses standard percentages', () => {
    const config = parseDeductibleForBadge('10% del siniestro');
    expect(config.riskLevel).toBe('medium');
    expect(config.label).toBe('10%');

    const configHigh = parseDeductibleForBadge('15% de la pérdida');
    expect(configHigh.riskLevel).toBe('high');
    expect(configHigh.label).toBe('15%');
  });

  it('correctly parses SMMLV absolute values', () => {
    const config = parseDeductibleForBadge('Min 3 SMMLV');
    expect(config.riskLevel).toBe('medium');
    expect(config.label).toBe('3 SMMLV');

    const configHigh = parseDeductibleForBadge('Min 8 SMMLV');
    expect(configHigh.riskLevel).toBe('high');
    expect(configHigh.label).toBe('8 SMMLV');
  });
});

describe('DeductibleBadge Component', () => {
  it('renders a single badge for normal deductible strings', () => {
    render(<DeductibleBadge deductible="10% min 1 SMMLV" />);
    expect(screen.getByText('10%')).toBeTruthy();
  });

  it('splits and renders multiple stacked badges for semicolon-delimited strings', () => {
    render(<DeductibleBadge deductible="Sede: 10% min 1 SMMLV; Otras: 15%" />);
    expect(screen.getByText('10%')).toBeTruthy();
    expect(screen.getByText('15%')).toBeTruthy();
  });
});
