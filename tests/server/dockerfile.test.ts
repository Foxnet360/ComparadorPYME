import { readFileSync } from 'fs';
import { join } from 'path';

// OPS-1 / DEV-3: the production image must be a hardened multi-stage build.
// See Informe_deuda.md (DevOps): single-stage image copied the whole repo
// (including .env*) and kept build tooling in the final image.
const dockerfile = readFileSync(join(__dirname, '../../Dockerfile'), 'utf8');

describe('Dockerfile hardening (OPS-1)', () => {
  it('uses a multi-stage build with a dedicated runtime stage', () => {
    const fromCount = (dockerfile.match(/^FROM\s+\S+/gim) ?? []).length;
    expect(fromCount).toBeGreaterThanOrEqual(3);
    expect(dockerfile).toMatch(/FROM\s+node:20-alpine\s+AS\s+runtime/i);
  });

  it('installs production-only dependencies in the dependency stage', () => {
    expect(dockerfile).toMatch(/npm ci --omit=dev/);
  });

  it('runs the container as a non-root user', () => {
    expect(dockerfile).toMatch(/^USER\s+\S+/im);
  });

  it('declares a HEALTHCHECK instruction', () => {
    expect(dockerfile).toMatch(/^HEALTHCHECK\s/im);
  });

  it('never copies environment files into the image', () => {
    expect(dockerfile).not.toMatch(/COPY\s+[^#]*\.env/);
  });

  it('does not keep build tooling or dev installs in the runtime stage', () => {
    const runtimeSection = dockerfile.slice(
      dockerfile.search(/FROM\s+node:20-alpine\s+AS\s+runtime/i)
    );
    expect(runtimeSection).not.toMatch(/npm ci(?!.*--omit=dev)/);
    expect(runtimeSection).not.toMatch(/apk add --no-cache (python3|make|g\+\+)/);
  });
});
