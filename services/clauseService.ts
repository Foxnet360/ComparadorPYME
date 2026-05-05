import { API_BASE_URL } from "./apiConfig";

export const clauseService = {
    // === DOCUMENT API (v2) ===
    
    /**
     * Get documents from the persistent document library
     */
    getDocuments: async (params?: { insurerId?: string; documentType?: string; isActive?: boolean; latest?: boolean }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.insurerId) queryParams.append('insurerId', params.insurerId);
        if (params?.documentType) queryParams.append('documentType', params.documentType);
        if (params?.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
        if (params?.latest) queryParams.append('latest', 'true');
        
        const response = await fetch(`${API_BASE_URL}/documents?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch documents');
        const data = await response.json();
        return data.documents || [];
    },

    /**
     * Upload a new document to the persistent library
     */
    createDocument: async (
        file: File,
        metadata: { insurerName: string; documentName: string; documentType: string; productName?: string; version?: string }
    ): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('insurerName', metadata.insurerName);
        formData.append('documentName', metadata.documentName);
        formData.append('documentType', metadata.documentType);
        if (metadata.productName) formData.append('productName', metadata.productName);
        if (metadata.version) formData.append('version', metadata.version);

        const response = await fetch(`${API_BASE_URL}/documents`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create document');
        }
        return response.json();
    },

    /**
     * Delete a document by ID
     */
    deleteDocument: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete document');
    },

    /**
     * Get document versions for an insurer
     */
    getDocumentVersions: async (insurerId: string): Promise<any[]> => {
        const response = await fetch(`${API_BASE_URL}/documents?insurerId=${encodeURIComponent(insurerId)}`);
        if (!response.ok) throw new Error('Failed to fetch document versions');
        const data = await response.json();
        return data.documents || [];
    }
};