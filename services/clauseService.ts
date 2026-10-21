import { apiClient } from './apiClient';

export interface InsurerRef {
  id: string;
  name: string;
}

export interface ClauseDocument {
  id: string;
  documentName: string;
  documentType: string;
  version?: string;
  productName?: string;
  domain?: string;
  totalPages: number;
  isActive: boolean;
  isPermanent?: boolean;
  createdAt: string;
  insurer: InsurerRef;
  deduplicated?: boolean;
  message?: string;
}

export interface DocumentQueryParams {
  insurerId?: string;
  documentType?: string;
  domain?: string;
  isActive?: boolean;
  latest?: boolean;
}

export interface CreateDocumentMetadata {
  insurerName: string;
  documentName: string;
  documentType: string;
  productName?: string;
  version?: string;
  domain?: string;
}

export const clauseService = {
  // === DOCUMENT API (v2) ===

  /**
   * Get documents from the persistent document library
   */
  getDocuments: async (params?: DocumentQueryParams): Promise<ClauseDocument[]> => {
    const queryParams = new URLSearchParams();
    if (params?.insurerId) queryParams.append('insurerId', params.insurerId);
    if (params?.documentType) queryParams.append('documentType', params.documentType);
    if (params?.domain) queryParams.append('domain', params.domain);
    if (params?.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
    if (params?.latest) queryParams.append('latest', 'true');

    const response = await apiClient.fetch(`/documents?${queryParams.toString()}`);
    const data = await response.json();
    return data.documents || [];
  },

  /**
   * Check if a permanent clause exists for an insurer and domain
   */
  checkExistingClause: async (
    insurerName: string,
    domain?: string,
    productName?: string
  ): Promise<{ exists: boolean; document: ClauseDocument | null; count: number }> => {
    try {
      const queryParams = new URLSearchParams({ insurerName });
      if (domain) queryParams.append('domain', domain);
      if (productName) queryParams.append('productName', productName);

      const response = await apiClient.fetch(`/documents/check-existing?${queryParams.toString()}`);
      if (!response.ok) {
        return { exists: false, document: null, count: 0 };
      }
      const data = await response.json();
      return {
        exists: !!data.exists,
        document: data.document || null,
        count: data.count || 0,
      };
    } catch (err) {
      console.warn('Failed to check existing clause from API', err);
      return { exists: false, document: null, count: 0 };
    }
  },

  /**
   * Upload a new document to the persistent library
   */
  createDocument: async (file: File, metadata: CreateDocumentMetadata): Promise<ClauseDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('insurerName', metadata.insurerName);
    formData.append('documentName', metadata.documentName);
    formData.append('documentType', metadata.documentType);
    if (metadata.productName) formData.append('productName', metadata.productName);
    if (metadata.version) formData.append('version', metadata.version);
    if (metadata.domain) formData.append('domain', metadata.domain);

    const response = await apiClient.fetch('/documents', {
      method: 'POST',
      body: formData,
    });

    return response.json();
  },

  /**
   * Delete a document by ID
   */
  deleteDocument: async (id: string): Promise<void> => {
    await apiClient.fetch(`/documents/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get document versions for an insurer
   */
  getDocumentVersions: async (insurerId: string): Promise<ClauseDocument[]> => {
    const response = await apiClient.fetch(`/documents?insurerId=${encodeURIComponent(insurerId)}`);
    const data = await response.json();
    return data.documents || [];
  },
};
