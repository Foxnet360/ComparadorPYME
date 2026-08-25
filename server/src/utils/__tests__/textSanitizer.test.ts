import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeDeep } from '../textSanitizer';

describe('textSanitizer - UTF-8 and Mojibake repair', () => {
  it('should repair double-encoded UTF-8 Mojibake strings', () => {
    expect(sanitizeText('pÃ©rdida total')).toBe('pérdida total');
    expect(sanitizeText('daÃ±o material')).toBe('daño material');
    expect(sanitizeText('pÃ³liza de salud')).toBe('póliza de salud');
    expect(sanitizeText('cobertura 360Â°')).toBe('cobertura 360°');
  });

  it('should sanitize HTML entity accented characters', () => {
    expect(sanitizeText('P&oacute;liza de P&eacute;rdida')).toBe('Póliza de Pérdida');
    expect(sanitizeText('da&ntilde;os')).toBe('daños');
  });

  it('should recursively sanitize deep objects and arrays', () => {
    const input = {
      title: 'PÃ³liza de DaÃ±os',
      items: ['pÃ©rdida 1', 'cobertura 2'],
      nested: {
        description: 'daÃ±os a terceros',
      },
    };

    const output = sanitizeDeep(input);

    expect(output).toEqual({
      title: 'Póliza de Daños',
      items: ['pérdida 1', 'cobertura 2'],
      nested: {
        description: 'daños a terceros',
      },
    });
  });
});
