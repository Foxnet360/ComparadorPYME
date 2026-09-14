import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RenewalTimeline } from '../../../components/RenewalTimeline';
import type { RenewalEvent } from '../../../types';

const events: RenewalEvent[] = [
  {
    id: 'e1',
    renewal_id: 'r1',
    from_state: null,
    to_state: 'detected',
    actor_id: 'system',
    payload: {},
    created_at: '2026-09-01T06:00:00Z',
  },
  {
    id: 'e2',
    renewal_id: 'r1',
    from_state: 'detected',
    to_state: 'notified',
    actor_id: 'user-a',
    payload: {},
    created_at: '2026-09-02T06:00:00Z',
  },
];

describe('RenewalTimeline (R3.1)', () => {
  it('renders each transition with from→to states and actor', () => {
    render(<RenewalTimeline events={events} />);

    expect(screen.getByText(/detected → notified/)).toBeTruthy();
    expect(screen.getByText(/user-a/)).toBeTruthy();
  });

  it('renders the initial event as creation when from_state is null', () => {
    render(<RenewalTimeline events={events} />);

    expect(screen.getByText(/creada/i)).toBeTruthy();
    expect(screen.getByText(/system/)).toBeTruthy();
  });

  it('shows an empty-state message when there are no events', () => {
    render(<RenewalTimeline events={[]} />);

    expect(screen.getByText(/sin eventos/i)).toBeTruthy();
  });
});
