import { useState, type Dispatch, type SetStateAction } from 'react';
import type { PdfExportOptions } from '../components/report/ExportModal';

/**
 * ARCH-1: owns the PDF export UI state for the comparison report
 * (options + modal visibility). Extracted from the ComparisonReport shell
 * so the shell only composes, and the export flow is testable in isolation.
 */
export interface PdfExportState {
  pdfOptions: PdfExportOptions;
  setPdfOptions: Dispatch<SetStateAction<PdfExportOptions>>;
  showExportModal: boolean;
  openExportModal: () => void;
  closeExportModal: () => void;
}

export const usePdfExport = (): PdfExportState => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    title: 'Reporte Ejecutivo de Seguros',
    color: [79, 70, 229],
  });

  return {
    pdfOptions,
    setPdfOptions,
    showExportModal,
    openExportModal: () => setShowExportModal(true),
    closeExportModal: () => setShowExportModal(false),
  };
};
