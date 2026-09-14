import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AnalysisProvider, useAnalysis } from '../../../contexts/AnalysisContext';

// Probe component to read and drive the context from assertions.
const Probe: React.FC = () => {
  const { state, setMode, setRenewalContext, reset } = useAnalysis();
  return (
    <div>
      <output data-testid="mode">{state.mode}</output>
      <output data-testid="renewal-context">{JSON.stringify(state.renewalContext)}</output>
      <button onClick={() => setMode('renewal')}>set-renewal</button>
      <button onClick={() => setRenewalContext({ policyId: 'pol-1', renewalId: 'ren-1' })}>
        set-context
      </button>
      <button onClick={() => reset()}>reset</button>
    </div>
  );
};

describe('AnalysisContext renewal mode (task 1.24, XC-3)', () => {
  it('defaults to new mode with no renewal context when absent', () => {
    render(
      <AnalysisProvider>
        <Probe />
      </AnalysisProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('new');
    expect(screen.getByTestId('renewal-context').textContent).toBe('null');
  });

  it('updates mode and renewal context via convenience methods', () => {
    render(
      <AnalysisProvider>
        <Probe />
      </AnalysisProvider>
    );

    fireEvent.click(screen.getByText('set-renewal'));
    fireEvent.click(screen.getByText('set-context'));

    expect(screen.getByTestId('mode').textContent).toBe('renewal');
    expect(screen.getByTestId('renewal-context').textContent).toBe(
      JSON.stringify({ policyId: 'pol-1', renewalId: 'ren-1' })
    );
  });

  it('reset() returns mode and renewal context to NEW-mode defaults', () => {
    render(
      <AnalysisProvider>
        <Probe />
      </AnalysisProvider>
    );

    fireEvent.click(screen.getByText('set-renewal'));
    fireEvent.click(screen.getByText('set-context'));
    fireEvent.click(screen.getByText('reset'));

    expect(screen.getByTestId('mode').textContent).toBe('new');
    expect(screen.getByTestId('renewal-context').textContent).toBe('null');
  });

  it('setRenewalContext(null) clears the context without touching mode', () => {
    const ClearProbe: React.FC = () => {
      const { state, setMode, setRenewalContext } = useAnalysis();
      return (
        <div>
          <output data-testid="mode">{state.mode}</output>
          <output data-testid="renewal-context">{JSON.stringify(state.renewalContext)}</output>
          <button
            onClick={() => {
              setMode('renewal');
              setRenewalContext({ policyId: 'pol-1', renewalId: 'ren-1' });
            }}
          >
            seed
          </button>
          <button onClick={() => setRenewalContext(null)}>clear</button>
        </div>
      );
    };

    render(
      <AnalysisProvider>
        <ClearProbe />
      </AnalysisProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('seed'));
    });
    fireEvent.click(screen.getByText('clear'));

    expect(screen.getByTestId('mode').textContent).toBe('renewal');
    expect(screen.getByTestId('renewal-context').textContent).toBe('null');
  });
});
