/**
 * Comparison Engine Adapter
 * Provides safe coexistence between unified and legacy comparison engines
 * Routes requests based on feature flags with automatic fallback
 */

import { MatrixRow } from "../../types";
import { UnifiedComparisonResult } from "../../types/unifiedComparison";
import { unifiedComparisonEngine } from "./unifiedComparisonEngine";
import { unifiedComparisonFlag } from "./featureFlagService";

// Note: Fallback to legacy is handled at the controller level
// This adapter only handles unified engine routing

export class ComparisonEngineAdapter {
  
  /**
   * Generate comparison using unified or legacy engine based on feature flag
   */
  async generateComparison(
    pdfPaths: string[],
    userId?: string
  ): Promise<MatrixRow[]> {
    const flagEnabled = unifiedComparisonFlag.isEnabled(userId);
    
    console.log(`🚩 [Adapter] Unified engine ${flagEnabled ? 'ENABLED' : 'DISABLED'} for user ${userId || 'anonymous'}`);

    if (flagEnabled) {
      try {
        // Try unified engine first
        console.log(`🚀 [Adapter] Using unified comparison engine`);
        const result = await unifiedComparisonEngine.compare(pdfPaths);
        
        // Transform to MatrixRow[]
        const matrixRows = this.toMatrixRows(result);
        
        console.log(`✅ [Adapter] Unified engine succeeded`);
        return matrixRows;
        
      } catch (error: any) {
        // Log failure and fallback to legacy
        console.error(`❌ [Adapter] Unified engine failed:`, error.message);
        console.log(`🔄 [Adapter] Falling back to legacy engine`);
        
        return this.fallbackToLegacy(pdfPaths, error.message);
      }
    }

    // Use legacy engine
    console.log(`📦 [Adapter] Using legacy comparison engine`);
    return this.useLegacy(pdfPaths);
  }

  /**
   * Validate comparison with clauses (deep mode)
   */
  async validateWithClauses(
    comparisonId: string,
    clausePaths: string[]
  ): Promise<MatrixRow[]> {
    console.log(`🔍 [Adapter] Deep mode validation for comparison ${comparisonId}`);

    if (!clausePaths || clausePaths.length === 0) {
      throw new Error('No clause files provided for deep mode validation');
    }

    try {
      // TODO: Retrieve original comparison from database
      // For now, this is a placeholder implementation
      
      // Call unified engine deep mode
      // const result = await unifiedComparisonEngine.validateWithClauses(
      //   originalComparison,
      //   clausePaths
      // );
      
      // return this.toMatrixRows(result);
      
      throw new Error('Deep mode not yet fully implemented');
      
    } catch (error: any) {
      console.error(`❌ [Adapter] Deep mode failed:`, error.message);
      throw error;
    }
  }

  /**
   * Transform UnifiedComparisonResult to MatrixRow[]
   */
  toMatrixRows(result: UnifiedComparisonResult): MatrixRow[] {
    const matrix: MatrixRow[] = [];
    const numInsurers = result.insurers.length;

    // Add header for client info
    matrix.push({
      type: 'header',
      id: 'client_info',
      label: `${result.client.name} - ${result.client.activity}`,
      sectionId: 0,
      cells: Array(numInsurers).fill({ value: '', isExcluded: false, isWinner: false })
    });

    // Process coverage matrix
    result.coverageMatrix.forEach((section, sectionIndex) => {
      // Add category header
      matrix.push({
        type: 'header',
        id: `section_${sectionIndex}`,
        label: section.category,
        sectionId: sectionIndex + 1,
        cells: Array(numInsurers).fill({ value: '', isExcluded: false, isWinner: false })
      });

      // Add data rows
      section.rows.forEach((row, rowIndex) => {
        matrix.push({
          type: 'data',
          id: `section_${sectionIndex}_row_${rowIndex}`,
          label: row.label,
          sectionId: sectionIndex + 1,
          cells: row.cells.map(cell => ({
            value: cell.value || 'No informado',
            isExcluded: cell.value === 'N.C.' || cell.value === 'No incluido' || cell.value === null,
            isWinner: false, // TODO: Implement winner logic
            notes: cell.notes,
            pageNumber: cell.pageNumber,
            confidence: cell.confidence
          }))
        });
      });
    });

    // Add financial section
    matrix.push({
      type: 'header',
      id: 'financials',
      label: 'PRIMAS Y COSTOS',
      sectionId: 999,
      cells: Array(numInsurers).fill({ value: '', isExcluded: false, isWinner: false })
    });

    // Add premium rows
    const premiumLabels = [
      { label: 'Prima Neta', field: 'netPremium' },
      { label: 'Gastos de Expedición', field: 'fees' },
      { label: 'IVA (19%)', field: 'taxes' },
      { label: 'TOTAL A PAGAR', field: 'total' }
    ];

    premiumLabels.forEach(({ label, field }) => {
      matrix.push({
        type: 'data',
        id: `premium_${field}`,
        label,
        sectionId: 999,
        cells: result.financials.premiums.map(p => {
          const value = (p as any)[field];
          return {
            value: value !== null && value !== undefined 
              ? `$${value.toLocaleString('es-CO')}` 
              : 'No informado',
            isExcluded: value === null || value === undefined,
            isWinner: false
          };
        })
      });
    });

    // Add metadata rows
    matrix.push({
      type: 'spacer',
      id: 'spacer_metadata',
      label: '',
      sectionId: 999,
      cells: Array(numInsurers).fill({ value: '', isExcluded: false, isWinner: false })
    });

    const metaFields = [
      { label: 'Vigencia', field: 'validity' },
      { label: 'Producto', field: 'product' },
      { label: 'Respaldo', field: 'backing' },
      { label: 'Comisión', field: 'commission' }
    ];

    metaFields.forEach(({ label, field }) => {
      matrix.push({
        type: 'data',
        id: `meta_${field}`,
        label,
        sectionId: 999,
        cells: result.financials.metadata.map(m => ({
          value: (m as any)[field] || 'No informado',
          isExcluded: !(m as any)[field],
          isWinner: false
        }))
      });
    });

    // Add analysis warnings
    if (result.analysis.warnings.length > 0) {
      matrix.push({
        type: 'spacer',
        id: 'spacer_warnings',
        label: '',
        sectionId: 999,
        cells: Array(numInsurers).fill({ value: '', isExcluded: false, isWinner: false })
      });

      matrix.push({
        type: 'header',
        id: 'warnings',
        label: '⚠️ ALERTAS',
        sectionId: 999,
        cells: Array(numInsurers).fill({ value: '', isExcluded: false, isWinner: false })
      });

      result.analysis.warnings.forEach((warning, index) => {
        matrix.push({
          type: 'data',
          id: `warning_${index}`,
          label: warning,
          sectionId: 999,
          cells: Array(numInsurers).fill({ value: '', isExcluded: false, isWinner: false })
        });
      });
    }

    return matrix;
  }

  /**
   * Fallback to legacy engine
   */
  private async fallbackToLegacy(pdfPaths: string[], errorMessage: string): Promise<MatrixRow[]> {
    console.error(`❌ [Adapter] Unified engine failed: ${errorMessage}`);
    console.log(`⚠️ [Adapter] Legacy fallback should be handled by controller`);
    throw new Error(`Unified comparison engine failed: ${errorMessage}. Please use /api/analyze for legacy processing.`);
  }

  /**
   * Use legacy engine directly
   */
  private async useLegacy(_pdfPaths: string[]): Promise<MatrixRow[]> {
    console.log(`📦 [Adapter] Legacy engine not available through adapter. Use /api/analyze endpoint.`);
    throw new Error('Legacy engine not available through unified adapter. Use /api/analyze endpoint.');
  }
}

export const comparisonEngineAdapter = new ComparisonEngineAdapter();
export default comparisonEngineAdapter;
