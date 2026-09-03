import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ARCH-5 / DEV-3: the Vite entry point must live in src/ (src/main.tsx),
// not at the repo root. See Informe_deuda.md (Baja/Mantenibilidad):
// "index.tsx en la raíz del repo; no hay src/main.tsx".
const repoRoot = join(__dirname, '../..');

describe('frontend entry point location (ARCH-5)', () => {
  it('mounts the app from src/main.tsx', () => {
    expect(existsSync(join(repoRoot, 'src', 'main.tsx'))).toBe(true);
  });

  it('leaves no root-level frontend entry point behind', () => {
    expect(existsSync(join(repoRoot, 'index.tsx'))).toBe(false);
  });

  it('points the HTML template at the src/ entry point', () => {
    const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');
    expect(html).toContain('src="/src/main.tsx"');
    expect(html).not.toContain('src="/index.tsx"');
  });
});
