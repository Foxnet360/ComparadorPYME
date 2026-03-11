import { ClauseDocument, ClauseSummary, InsurerSummary } from "../types";

// Detect environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? 'http://localhost:8080/api' : '/api';

export const clauseService = {
    /**
     * Upload a new clause document
     */
    createClause: async (
        file: File,
        metadata: { aseguradora: string; producto: string; version: string }
    ): Promise<ClauseDocument> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('aseguradora', metadata.aseguradora);
        formData.append('producto', metadata.producto);
        formData.append('version', metadata.version);

        const response = await fetch(`${API_BASE_URL}/clauses`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create clause');
        }

        return response.json();
    },

    /**
     * Get all clauses (with optional insurer filter)
     */
    getClauses: async (aseguradora?: string): Promise<ClauseSummary[]> => {
        const url = aseguradora
            ? `${API_BASE_URL}/clauses?aseguradora=${encodeURIComponent(aseguradora)}`
            : `${API_BASE_URL}/clauses`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to get clauses');
        }
        return response.json();
    },

    /**
     * Get a specific clause by ID
     */
    getClauseById: async (id: string): Promise<ClauseDocument> => {
        const response = await fetch(`${API_BASE_URL}/clauses/${id}`);
        if (!response.ok) {
            throw new Error('Failed to get clause');
        }
        return response.json();
    },

    /**
     * Delete (deactivate) a clause
     */
    deleteClause: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/clauses/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error('Failed to delete clause');
        }
    },

    /**
     * Get list of insurers with clause counts
     */
    getInsurers: async (): Promise<InsurerSummary[]> => {
        const response = await fetch(`${API_BASE_URL}/insurers`);
        if (!response.ok) {
            throw new Error('Failed to get insurers');
        }
        return response.json();
    },

    /**
     * Re-extract sections for a clause
     */
    reExtractSections: async (id: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/clauses/${id}/extract`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error('Failed to extract sections');
        }
        return response.json();
    }
};
