import React, { useState, useRef, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { QuoteAnalysis, MatrixRow, MatrixCell, QuoteMetadata } from '../types';
import { ChevronDown, ChevronRight, Scale, ListChecks } from 'lucide-react';
import { getDomainRegulatoryProfile } from '@shared/domainRegulatoryKnowledge';
import { PedagogicalTooltip } from './common/PedagogicalTooltip';
import { useOptimisticCorrection } from '../hooks/useOptimisticCorrection';
import { usePdfViewer, useCellNotes, useAnalysis } from '../contexts/AnalysisContext';
import { exportAnalysisToExcel } from '../services/excelExportService';
import { useToasts, ToastContainer } from './ToastNotification';
import {
  MatrixToolbar,
  MatrixMetadataCard,
  MatrixTableHeader,
  MatrixDataCell,
  MatrixMethodologyNote,
  buildExportNotes,
  isSublimitRow,
  simplifyHeaderLabel,
} from './coverageMatrix';

const PdfViewer = lazy(() => import('./PdfViewer'));

export {
  CATEGORY_CONFIGS,
  isExcludedValue,
  isSublimitRow,
  parseNumericValue,
  formatCurrency,
  buildExportNotes,
  formatMatrixValue,
  simplifyHeaderLabel,
  CoverageCell,
} from './coverageMatrix';
export type { CategoryConfig } from './coverageMatrix';

export interface UnifiedCoverageMatrixProps {
  quotes: QuoteAnalysis[];
  rows?: MatrixRow[];
  metadata?: QuoteMetadata[];
  viewMode?: 'client' | 'technical';
  analysisId?: string; // Optional ID for direct exports
  schemaVersion?: 1 | 2 | 3; // 3 = renewal (v2 + leading baseline column); rendered like v2 here — the baseline badge/delta panels live in RenewalAnalysisSection
  domain?: string;
}

export const UnifiedCoverageMatrix: React.FC<UnifiedCoverageMatrixProps> = ({
  quotes,
  rows,
  metadata,
  viewMode = 'technical',
  analysisId,
  schemaVersion: _schemaVersion,
  domain,
}) => {
  const [activeTab, setActiveTab] = useState<'coverages' | 'financials' | 'additional'>(
    'coverages'
  );
  const [hoveredCell, setHoveredCell] = useState<{ rowId: string; colIdx: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<{ rowId: string; colIdx: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Side-by-side comparison pinning (UX Hallazgo 2)
  const [pinnedColumns, setPinnedColumns] = useState<Set<number>>(new Set());

  const togglePinnedColumn = (idx: number) => {
    setPinnedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        // If clicking a 3rd when 2 are pinned, replace to keep a 2-column face-off
        if (next.size >= 2) {
          next.clear();
        }
        next.add(idx);
      }
      return next;
    });
  };

  // Regulatory Profile and Mandatory Verification Rules for active domain
  const regulatoryProfile = useMemo(() => getDomainRegulatoryProfile(domain), [domain]);

  // Compute compliance scorecard per insurer for column headers
  const complianceByInsurer = useMemo(() => {
    const map = new Map<
      string,
      { compliantCount: number; totalCount: number; isFullyCompliant: boolean; details: string }
    >();
    const total = regulatoryProfile.mandatoryVerificationRules.length;

    for (const quote of quotes) {
      const coverages = quote.coverages || [];
      let compliant = 0;
      for (const rule of regulatoryProfile.mandatoryVerificationRules) {
        const matched = coverages.find((cov) => {
          const label = `${cov.name || ''} ${cov.canonicalName || ''}`.toLowerCase();
          const val = String(cov.value || '').toLowerCase();
          const isIncluded =
            cov.isPositive !== false &&
            val.length > 0 &&
            !['no incluido', 'no incluida', 'no informado', 'excluido', 'no cubre', 'n.c.'].includes(
              val
            );
          return isIncluded && rule.keywords.some((kw) => label.includes(kw.toLowerCase()));
        });
        if (matched) compliant++;
      }
      map.set(quote.insurerName, {
        compliantCount: compliant,
        totalCount: total,
        isFullyCompliant: compliant === total,
        details: `${compliant}/${total} normas legales verificadas en este ramo (${regulatoryProfile.displayName})`,
      });
    }
    return map;
  }, [quotes, regulatoryProfile]);

  // Match row label to mandatory regulatory rule
  const getMatchingRegulatoryRule = useCallback(
    (rowLabel: string) => {
      const norm = (rowLabel || '').toLowerCase();
      return regulatoryProfile.mandatoryVerificationRules.find((rule) =>
        rule.keywords.some((kw) => norm.includes(kw.toLowerCase()))
      );
    },
    [regulatoryProfile]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { submitCorrection } = useOptimisticCorrection();
  const { openPdfViewer, pdfViewer, closePdfViewer } = usePdfViewer();
  const { state: analysisState } = useAnalysis();
  const { cellNotes, setCellNote, getCellNote } = useCellNotes();
  const { toasts, addToast, removeToast, success, error } = useToasts();
  const [savingCorrections, setSavingCorrections] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<{ rowId: string; colIdx: number } | null>(null);

  const handleDiscrepancyResolution = async (
    rowId: string,
    colIdx: number,
    selectedCategory: string
  ) => {
    const quote = quotes[colIdx];
    const cell = fullMatrix.find((r) => r.id === rowId)?.cells[colIdx];

    if (!quote || !cell) return;

    const correctionId = `${rowId}-${colIdx}`;
    setSavingCorrections((prev) => new Set(prev).add(correctionId));

    try {
      const result = await submitCorrection({
        rawName: cell.rawName || rowId,
        insurerName: quote.insurerName,
        systemMapping: cell.canonicalName || rowId,
        userCorrection: selectedCategory,
        correctionType: 'coverage_mapping',
        rawTextSnippet: cell.rawTextSnippet,
        pageNumber: cell.calculatedPage || cell.pageNumber,
      });

      if (result.success) {
        setOpenDropdown(null);
      }
    } finally {
      setSavingCorrections((prev) => {
        const next = new Set(prev);
        next.delete(correctionId);
        return next;
      });
    }
  };

  const handleOpenPdfEvidence = (cell: MatrixCell, quote: QuoteAnalysis) => {
    if (cell.calculatedPage || cell.pageNumber) {
      let resolvedPdfUrl = `/api/quotes/${quote.insurerName}/pdf`;
      // Prioritize uploaded file blob URL if available in context
      if (analysisState?.quoteFiles && analysisState.quoteFiles.length > 0) {
        const normQuoteInsurer = quote.insurerName.toLowerCase().trim();
        const matchingFile =
          analysisState.quoteFiles.find((f) => {
            const fName = f.name.toLowerCase();
            return (
              fName.includes(normQuoteInsurer) ||
              (quote.metadata?.filename && f.name === quote.metadata.filename)
            );
          }) ||
          analysisState.quoteFiles[quotes.findIndex((q) => q.insurerName === quote.insurerName)] ||
          analysisState.quoteFiles[0];

        if (matchingFile) {
          resolvedPdfUrl = URL.createObjectURL(matchingFile);
        }
      }

      openPdfViewer({
        pdfUrl: resolvedPdfUrl,
        targetPage: cell.calculatedPage || cell.pageNumber || 1,
        searchText: cell.rawTextSnippet,
        title: `Evidencia - ${quote.insurerName}`,
      });
    }
  };

  const handleCellDoubleClick = (rowId: string, colIdx: number) => {
    setEditingNote({ rowId, colIdx });
  };

  const handleSaveNote = (rowId: string, colIdx: number, content: string) => {
    const cellId = `${rowId}-${colIdx}`;
    setCellNote(cellId, content);
    setEditingNote(null);
  };

  const handleCancelNote = () => {
    setEditingNote(null);
  };

  const fullMatrix = rows ?? [];

  // Partition matrix rows according to active tabs
  const filteredRows = fullMatrix.filter((row) => {
    if (activeTab === 'coverages') return row.sectionId < 100 && row.sectionId !== 50;
    if (activeTab === 'financials') return row.sectionId === 100;
    return row.sectionId === 101;
  });

  // Sublimit folding state
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  // Compute parent-sublimit relationships
  const { parentToSublimits, sublimitToParent, totalSublimits } = useMemo(() => {
    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string>();
    let currentParentId: string | null = null;
    let count = 0;

    for (const r of filteredRows) {
      if (r.type === 'header' || r.type === 'spacer') {
        currentParentId = null;
        continue;
      }
      if (isSublimitRow(r)) {
        if (currentParentId) {
          const list = parentMap.get(currentParentId) || [];
          list.push(r.id);
          parentMap.set(currentParentId, list);
          childMap.set(r.id, currentParentId);
          count++;
        }
      } else {
        currentParentId = r.id;
      }
    }

    return { parentToSublimits: parentMap, sublimitToParent: childMap, totalSublimits: count };
  }, [filteredRows]);

  const toggleParent = (parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const allSublimitsCollapsed =
    parentToSublimits.size > 0 &&
    Array.from(parentToSublimits.keys()).every((id) => collapsedParentIds.has(id));

  const toggleAllSublimits = () => {
    if (allSublimitsCollapsed) {
      setCollapsedParentIds(new Set());
    } else {
      setCollapsedParentIds(new Set(parentToSublimits.keys()));
    }
  };

  const handleExportExcel = async (exportMode: 'technical' | 'client' = 'technical') => {
    if (!analysisId) {
      addToast('ID de análisis no disponible para exportación.', 'warning');
      return;
    }
    setIsExporting(true);
    try {
      const exportNotes = buildExportNotes(cellNotes);

      await exportAnalysisToExcel({
        analysisId,
        domain: domain || 'pyme',
        quotes,
        matrix: rows,
        exportMode,
        cellNotes: exportNotes,
      });

      success(
        exportMode === 'client'
          ? 'Excel para Cliente descargado con éxito.'
          : 'Excel Técnico descargado correctamente.'
      );
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo descargar el Excel. Inténtalo de nuevo más tarde.';
      error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <MatrixToolbar
        analysisId={analysisId}
        isExporting={isExporting}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        quotesCount={quotes.length}
        pinnedCount={pinnedColumns.size}
        onResetPinned={() => setPinnedColumns(new Set())}
        totalSublimits={totalSublimits}
        allSublimitsCollapsed={allSublimitsCollapsed}
        onToggleAllSublimits={toggleAllSublimits}
        onExportExcel={handleExportExcel}
      />

      <MatrixMetadataCard metadata={metadata} />

      {/* Grid Matrix Container */}
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        role="grid"
        aria-label="Matriz de coberturas de seguros"
      >
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <ListChecks className="text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay datos para mostrar</h3>
            <p className="text-sm max-w-md">
              La matriz de coberturas está vacía. Sube las cotizaciones de las aseguradoras para
              generar la comparativa.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[75vh] relative scroll-smooth">
            <table className="w-full text-sm border-collapse text-left">
              <MatrixTableHeader
                quotes={quotes}
                pinnedColumns={pinnedColumns}
                complianceByInsurer={complianceByInsurer}
                onTogglePinnedColumn={togglePinnedColumn}
              />
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const effectiveColumnCount =
                    pinnedColumns.size > 0 ? pinnedColumns.size + 1 : quotes.length + 1;

                  if (row.type === 'header') {
                    const displayLabel =
                      viewMode === 'client' ? simplifyHeaderLabel(row.label) : row.label;
                    return (
                      <tr key={row.id} className="bg-[#E6F0FA]/60 font-bold" role="row">
                        <td
                          role="gridcell"
                          colSpan={effectiveColumnCount}
                          className="px-6 py-3 text-xs md:text-sm text-blue-900 uppercase tracking-wide border-y border-blue-200/50 bg-[#E6F0FA]/95 sticky left-0 z-20 backdrop-blur-xs"
                        >
                          <div className="sticky left-6 inline-flex items-center gap-2 font-bold">
                            <span className="w-1.5 h-3.5 bg-blue-600 rounded-full inline-block"></span>
                            {displayLabel}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (row.type === 'spacer') {
                    return (
                      <tr key={row.id} className="bg-white h-4" role="row">
                        <td role="gridcell" colSpan={effectiveColumnCount} className="py-2"></td>
                      </tr>
                    );
                  }

                  // Check if this row is a folded sublimit
                  const parentId = sublimitToParent.get(row.id);
                  if (parentId && collapsedParentIds.has(parentId)) {
                    return null;
                  }

                  const childSublimits = parentToSublimits.get(row.id);
                  const hasSublimits = Boolean(childSublimits && childSublimits.length > 0);
                  const isCollapsed = collapsedParentIds.has(row.id);
                  const isSublimit = Boolean(parentId);

                  // Standard Data Row
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 transition-colors group ${
                        isSublimit ? 'bg-slate-50/30' : ''
                      }`}
                      role="row"
                    >
                      {/* Concept Label (Column A) */}
                      <td
                        role="gridcell"
                        className={`px-6 py-3.5 text-xs md:text-sm font-semibold text-slate-700 bg-[#F8FAFC] sticky left-0 border-r border-slate-200 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.06)] z-20 group-hover:bg-[#F1F5F9] ${
                          isSublimit ? 'pl-10 text-slate-600 font-normal !bg-slate-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {hasSublimits && (
                            <button
                              type="button"
                              onClick={() => toggleParent(row.id)}
                              className="p-1 -ml-1 rounded hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                              title={isCollapsed ? 'Desplegar sublímites' : 'Plegar sublímites'}
                            >
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                          {isSublimit && (
                            <span className="text-slate-400 font-mono text-xs select-none">↳</span>
                          )}
                          <span>{row.label}</span>
                          <PedagogicalTooltip label={row.label} />
                          {(() => {
                            const matchingRule = getMatchingRegulatoryRule(row.label);
                            if (!matchingRule || isSublimit) return null;
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0 cursor-help"
                                title={`Amparo de verificación obligatoria en Colombia:\n${matchingRule.title} (${matchingRule.legalBasis})\n${matchingRule.description}`}
                              >
                                <Scale size={11} className="text-indigo-600" />
                                <span className="hidden sm:inline">Obligatorio</span>
                              </span>
                            );
                          })()}
                          {hasSublimits && (
                            <button
                              type="button"
                              onClick={() => toggleParent(row.id)}
                              className="ml-auto text-[10px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded-full border border-blue-200/60 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {childSublimits?.length ?? 0} sublímites
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Insurer Cells */}
                      {row.cells.map((cell, colIdx) => {
                        const isPinned = pinnedColumns.has(colIdx);
                        const isHiddenByPinning = pinnedColumns.size > 0 && !isPinned;
                        const cellId = `${row.id}-${colIdx}`;
                        const cellNote = getCellNote(cellId);
                        const isEditingNote =
                          editingNote?.rowId === row.id && editingNote?.colIdx === colIdx;
                        const isHovered =
                          hoveredCell?.rowId === row.id && hoveredCell?.colIdx === colIdx;
                        const isDropdownOpen =
                          openDropdown?.rowId === row.id && openDropdown?.colIdx === colIdx;
                        const isSaving = savingCorrections.has(cellId);

                        return (
                          <MatrixDataCell
                            key={colIdx}
                            cell={cell}
                            row={row}
                            colIdx={colIdx}
                            quote={quotes[colIdx]}
                            viewMode={viewMode}
                            isPinned={isPinned}
                            isHiddenByPinning={isHiddenByPinning}
                            isSaving={isSaving}
                            cellNote={cellNote}
                            isEditingNote={isEditingNote}
                            isHovered={isHovered}
                            isDropdownOpen={isDropdownOpen}
                            dropdownRef={dropdownRef}
                            onMouseEnter={() => setHoveredCell({ rowId: row.id, colIdx })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onDoubleClick={() => handleCellDoubleClick(row.id, colIdx)}
                            onSaveNote={(content) => handleSaveNote(row.id, colIdx, content)}
                            onCancelNote={handleCancelNote}
                            onOpenPdfEvidence={handleOpenPdfEvidence}
                            onToggleDropdown={() =>
                              setOpenDropdown(
                                openDropdown?.rowId === row.id && openDropdown?.colIdx === colIdx
                                  ? null
                                  : { rowId: row.id, colIdx }
                              )
                            }
                            onResolveDiscrepancy={(selectedCategory) =>
                              handleDiscrepancyResolution(row.id, colIdx, selectedCategory)
                            }
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MatrixMethodologyNote viewMode={viewMode} />

      {/* PdfViewer Lazy Loaded */}
      {pdfViewer?.isOpen && (
        <Suspense fallback={null}>
          <PdfViewer
            isOpen={pdfViewer.isOpen}
            pdfUrl={pdfViewer.pdfUrl}
            targetPage={pdfViewer.targetPage}
            searchText={pdfViewer.searchText}
            title={pdfViewer.title}
            onClose={closePdfViewer}
          />
        </Suspense>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};
