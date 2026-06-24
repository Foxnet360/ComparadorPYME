import { describe, it, expect, vi } from 'vitest';
import { parseJsonWithRepair } from '../../server/src/services/jsonRepair';

describe('parseJsonWithRepair telemetry callback', () => {
  it('emits trailing_comma when a trailing comma is repaired', () => {
    const onRepairUsed = vi.fn();
    const result = parseJsonWithRepair('{"a": 1,}', { onRepairUsed });

    expect(result.success).toBe(true);
    expect(result.wasRepaired).toBe(true);
    expect(onRepairUsed).toHaveBeenCalledWith('trailing_comma');
  });

  it('emits missing_quotes when unquoted keys are repaired', () => {
    const onRepairUsed = vi.fn();
    const result = parseJsonWithRepair('{a: 1}', { onRepairUsed });

    expect(result.success).toBe(true);
    expect(result.wasRepaired).toBe(true);
    expect(onRepairUsed).toHaveBeenCalledWith('missing_quotes');
  });

  it('emits truncated_object when braces are missing', () => {
    const onRepairUsed = vi.fn();
    const result = parseJsonWithRepair('{"a": 1', { onRepairUsed });

    expect(result.success).toBe(true);
    expect(result.wasRepaired).toBe(true);
    expect(onRepairUsed).toHaveBeenCalledWith('truncated_object');
  });

  it('emits invalid_escape when invalid escapes are repaired', () => {
    const onRepairUsed = vi.fn();
    const result = parseJsonWithRepair('{"a": "\\x41"}', { onRepairUsed });

    expect(result.success).toBe(true);
    expect(result.wasRepaired).toBe(true);
    expect(onRepairUsed).toHaveBeenCalledWith('invalid_escape');
  });

  it('emits partial_extraction when partial data is recovered', () => {
    const onRepairUsed = vi.fn();
    const broken = '{"insurerName": "SBS", "coverages": [invalid';
    const result = parseJsonWithRepair(broken, { onRepairUsed });

    expect(result.success).toBe(true);
    expect(result.wasRepaired).toBe(true);
    expect(onRepairUsed).toHaveBeenCalledWith('partial_extraction');
  });

  it('does not call the callback when no repair is needed', () => {
    const onRepairUsed = vi.fn();
    const result = parseJsonWithRepair('{"a": 1}', { onRepairUsed });

    expect(result.success).toBe(true);
    expect(result.wasRepaired).toBe(false);
    expect(onRepairUsed).not.toHaveBeenCalled();
  });

  it('does not call the callback when repair fails', () => {
    const onRepairUsed = vi.fn();
    const result = parseJsonWithRepair('not json at all', { onRepairUsed });

    expect(result.success).toBe(false);
    expect(onRepairUsed).not.toHaveBeenCalled();
  });
});
