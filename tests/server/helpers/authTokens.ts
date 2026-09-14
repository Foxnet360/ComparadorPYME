/**
 * Test helper: builds an unsigned-but-well-formed JWT for the auth middleware.
 * In test env SUPABASE_JWT_SECRET is unset, so the middleware decodes without
 * verifying the signature — the payload claims are what matter.
 */
export function bearerTokenFor(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId })).toString('base64url');
  return `Bearer ${header}.${payload}.test-signature`;
}
