import { describe, it, expect, vi } from 'vitest';
import {
  ALL_LEGAL_DOCUMENTS,
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  SECURITY_POLICY,
  REGULATORY_DISCLAIMER,
  DATA_CONSENT_TEXT,
} from '../../data/legalContent';

describe('Legal Compliance and Colombian Habeas Data (Ley 1581)', () => {
  it('defines all 4 core legal documents with required Colombian regulatory context', () => {
    expect(ALL_LEGAL_DOCUMENTS.length).toBe(4);

    const ids = ALL_LEGAL_DOCUMENTS.map((d) => d.id);
    expect(ids).toContain('terms');
    expect(ids).toContain('privacy');
    expect(ids).toContain('security');
    expect(ids).toContain('disclaimer');
  });

  it('Terms of Service contains Human-In-The-Loop clause and Colombian jurisdiction', () => {
    const text = JSON.stringify(TERMS_OF_SERVICE);
    expect(text).toContain('Human-In-The-Loop');
    expect(text).toContain('Colombia');
    expect(text).toContain('Bogotá D.C.');
  });

  it('Privacy Policy explicitly complies with Ley 1581 de 2012 and Decreto 1377 de 2013', () => {
    const text = JSON.stringify(PRIVACY_POLICY);
    expect(text).toContain('1581 de 2012');
    expect(text).toContain('1377 de 2013');
    expect(text).toContain('Habeas Data');
    expect(text).toContain('privacidad@comparadorcsa.com');
  });

  it('Security policy documents multi-tenant RLS isolation and SHA-256 deduplication', () => {
    const text = JSON.stringify(SECURITY_POLICY);
    expect(text).toContain('Row Level Security');
    expect(text).toContain('SHA-256');
    expect(text).toContain('AES-256');
  });

  it('Regulatory disclaimer declares non-direct insurance underwriting per SFC regulations', () => {
    const text = JSON.stringify(REGULATORY_DISCLAIMER);
    expect(text).toContain('Superintendencia Financiera de Colombia');
    expect(text).toContain('No Intermediación Directa');
  });

  it('Data consent text provides mandatory disclosure notice', () => {
    expect(DATA_CONSENT_TEXT.shortCheckbox).toContain('Ley 1581 de 2012');
    expect(DATA_CONSENT_TEXT.authorizationNotice).toContain('Comparador CSA');
    expect(DATA_CONSENT_TEXT.legalVersion).toBe('2026.1');
  });
});
