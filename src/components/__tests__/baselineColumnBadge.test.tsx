import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaselineColumnBadge } from '../../../components/BaselineColumnBadge';

describe('BaselineColumnBadge (R2.2)', () => {
  it('renders the Póliza Actual marker with the insurer name', () => {
    render(<BaselineColumnBadge insurerName="Sura" />);

    expect(screen.getByText(/póliza actual/i)).toBeTruthy();
    expect(screen.getByText(/Sura/)).toBeTruthy();
  });

  it('renders the marker without an insurer name', () => {
    render(<BaselineColumnBadge />);

    expect(screen.getByText(/póliza actual/i)).toBeTruthy();
  });
});
