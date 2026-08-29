import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { InlineNoteEditor } from '../../../components/InlineNoteEditor';

const props = {
  cellId: 'cell-1',
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe('InlineNoteEditor (SEC-3, source contract)', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../components/InlineNoteEditor.tsx'),
    'utf-8'
  );

  it('does not use dangerouslySetInnerHTML anywhere in the component', () => {
    expect(source).not.toContain('dangerouslySetInnerHTML');
  });

  it('renders the preview with react-markdown', () => {
    expect(source).toMatch(/from 'react-markdown'/);
  });
});

describe('InlineNoteEditor preview (SEC-3)', () => {
  it('does not render script tags from note content', () => {
    const { container } = render(
      <InlineNoteEditor {...props} initialContent={'hello <script>alert(1)</script>'} />
    );

    expect(container.querySelector('script')).toBeNull();
  });

  it('does not render raw HTML tags as elements', () => {
    const { container } = render(
      <InlineNoteEditor {...props} initialContent={'<img src=x onerror=alert(1)>'} />
    );

    expect(container.querySelector('img')).toBeNull();
  });

  it('strips javascript: URLs from links', () => {
    const { container } = render(
      <InlineNoteEditor {...props} initialContent={'[click](javascript:alert(1))'} />
    );

    const anchor = container.querySelector('a');
    if (anchor) {
      expect(anchor.getAttribute('href') || '').not.toMatch(/javascript:/i);
    }
  });

  it('still renders markdown formatting', () => {
    const { container } = render(
      <InlineNoteEditor {...props} initialContent={'**important** note'} />
    );

    expect(container.querySelector('strong')?.textContent).toBe('important');
  });

  it('does not use dangerouslySetInnerHTML (preview has no injected HTML sink)', () => {
    const { container } = render(
      <InlineNoteEditor {...props} initialContent={'<b>raw</b> and **md**'} />
    );

    // Raw HTML must be escaped (no <b> element), markdown must render (<strong>)
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('strong')).not.toBeNull();
  });
});
