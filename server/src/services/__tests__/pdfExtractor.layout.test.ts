import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pdfExtractor, PageTextItems } from '../pdfExtractor';
import { featureFlags } from '../../config/featureFlags';

const mockPages = vi.hoisted(() => ({ pages: [] as any[] }));

vi.mock('pdfjs-dist/legacy/build/pdf.js', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: mockPages.pages.length,
      getPage: (n: number) =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({
              items: mockPages.pages[n - 1] ?? [],
            }),
        }),
      getMetadata: () => Promise.resolve({ info: {} }),
      destroy: () => Promise.resolve(),
    }),
  })),
}));

function makeTextItem(
  str: string,
  x: number,
  y: number,
  width = 60,
  height = 12,
  rotation = 0
): any {
  // Build a transform matrix for the given translation and rotation (in degrees).
  const rad = (rotation * Math.PI) / 180;
  const transform = [
    Math.cos(rad),
    Math.sin(rad),
    -Math.sin(rad),
    Math.cos(rad),
    x,
    y,
  ];
  return { str, dir: 'ltr', width, height, transform, fontName: 'MockFont' };
}

function writeTempPdf(): string {
  const dir = path.join('/tmp', 'opencode');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `test-${Date.now()}.pdf`);
  fs.writeFileSync(filePath, '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\n%%EOF\n');
  return filePath;
}

describe('pdfExtractor layout-aware path', () => {
  beforeEach(() => {
    featureFlags.updateFlag('useTemplateGraphPipeline', false);
    mockPages.pages = [];
  });

  it('extractLayoutFromPdf returns page text items with positions and rotation', async () => {
    const filePath = writeTempPdf();
    mockPages.pages = [
      [
        makeTextItem('Cobertura', 100, 700),
        makeTextItem('Suma Asegurada', 260, 700),
      ],
      [makeTextItem('Página 2', 100, 700, 60, 12, 90)],
    ];

    try {
      const result = await pdfExtractor.extractLayoutFromPdf(filePath);

      expect(result).toHaveLength(2);
      expect(result[0].page).toBe(1);
      expect(result[0].items).toHaveLength(2);
      expect(result[0].items[0]).toMatchObject({
        text: 'Cobertura',
        x: 100,
        y: 700,
        rotation: 0,
      });
      expect(result[1].items[0].rotation).toBe(90);
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it('extractTextFromPdf includes pageTextItems when the layout flag is enabled', async () => {
    featureFlags.updateFlag('useTemplateGraphPipeline', true);
    const filePath = writeTempPdf();
    mockPages.pages = [[makeTextItem('BBVA', 500, 50, 60, 12, 0)]];

    try {
      const result = await pdfExtractor.extractTextFromPdf(filePath);

      expect(result.pageTextItems).toBeDefined();
      expect(result.pageTextItems).toHaveLength(1);
      expect(result.pageTextItems![0].items[0].text).toBe('BBVA');
    } finally {
      fs.unlinkSync(filePath);
    }
  });

  it('extractTextFromPdf omits pageTextItems when the layout flag is disabled', async () => {
    const filePath = writeTempPdf();
    mockPages.pages = [[makeTextItem('BBVA', 500, 50)]];

    try {
      const result = await pdfExtractor.extractTextFromPdf(filePath);

      expect(result.pageTextItems).toBeUndefined();
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});
