import { describe, it, expect } from 'vitest';
import { clauseSearchStoreService } from '../clauseSearchStore';

describe('clauseSearchStoreService', () => {
  it('builds tool configuration payload correctly', () => {
    const stores = ['fileSearchStores/test-store-123'];
    const toolPayload = clauseSearchStoreService.buildToolConfig(stores, 'insurer = "SURA"');

    expect(toolPayload).toEqual({
      type: 'file_search',
      file_search_store_names: stores,
      metadata_filter: 'insurer = "SURA"',
    });
  });

  it('returns null when no store names are provided', () => {
    const toolPayload = clauseSearchStoreService.buildToolConfig([]);
    expect(toolPayload).toBeNull();
  });
});
